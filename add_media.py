#!/usr/bin/python
from sys import argv, exit, maxint
from os.path import basename, exists, getsize, dirname
from hashlib import sha512, sha256
from subprocess import Popen, PIPE
import os
import re
import time
import signal

import psycopg2
import psycopg2.extras

FAIL = False

def exit_gracefully(signum, frame):
  global FAIL

  signal.signal(signal.SIGINT, original_sigint)
  try:
    if raw_input("\nReally quit? (y/n)> ").lower().startswith('y'):
      print 'Exit flag set!'
      FAIL = True

  except KeyboardInterrupt:
    pass

  signal.signal(signal.SIGINT, exit_gracefully)

def preexec(): # Don't forward signals.
  os.setpgrp()

original_sigint = signal.getsignal(signal.SIGINT)
signal.signal(signal.SIGINT, exit_gracefully)

padding = 1 * (1024 ** 2)
fs = '/var/www/prometheus/encfs/./fs.py'

if len(argv) < 2:
  print 'Need file'
  exit(1)

total = maxint
if len(argv) > 2:
  total = int(argv[2])

dbConn = psycopg2.connect("dbname='prometheus' user='root' host='localhost'")
dbConn.autocommit = True
dbCursor = dbConn.cursor(cursor_factory=psycopg2.extras.DictCursor)

count = 0
completed = 0
files = open(argv[1]).read().split('\n')
files.sort()
for f in files:
  if f == '':
    continue

  count += 1
  if completed >= total:
    break

  ttid, mfile = f.split('-', 1)
  if not exists(mfile):
    print 'ERROR: ' + mfile + " doesn't exist"
    continue

  if total == maxint:
    print 'On {0} of {1}'.format(count, len(files))
  else:
    print 'On {0} of {1}, stopping after {2} ({3})'.format(count, len(files), total, completed)
  if f.strip() == '': continue

  table = 'movies'
  dbCursor.execute("SELECT EXISTS(SELECT 1 FROM movies WHERE ttid=%s) AS exists", [ttid])
  mresult = dbCursor.fetchone()
  if not mresult['exists']:
    table = 'tv'
    dbCursor.execute("SELECT EXISTS(SELECT 1 FROM tv WHERE ttid=%s) AS exists", [ttid])
    tresult = dbCursor.fetchone()
    if not tresult['exists']:
      print 'ERROR: ' + mfile + ' doesn\'t exist in database!'
      continue

  print ''
  print time.asctime(time.localtime(time.time())) + ': Parsing {0}'.format(mfile)
  cP = Popen(['sha512sum', mfile], stdout=PIPE, stderr=PIPE, preexec_fn=preexec)
  checksum = cP.communicate()[0]
  checksum = checksum.split(' ', 1)[0]
  if not checksum:
    print 'Bad checksum'
    if FAIL: exit()
    continue
  size = getsize(mfile)
  print time.asctime(time.localtime(time.time())) + ': Getting metadata'

  detP = Popen(['mediainfo', '-f', mfile], stderr=PIPE, stdout=PIPE)
  details, err = detP.communicate()
  details = details.split('\n')

  detP = Popen(['exiftool', mfile], stderr=PIPE, stdout=PIPE)
  exifDetails, err = detP.communicate()
  exifDetails = exifDetails.split('\n')

  width = None
  height = None
  fps = None
  nch = None

  match = [m.group(1) for l in details for m in [re.search(r'^Width *: ([0-9]+)$', l)] if m]
  if match:
    width = match[0]

  match = [m.group(1) for l in details for m in [re.search(r'^Height *: ([0-9]+)$', l)] if m]
  if match:
    height = match[0]

  if width and height:
    res = '{0}x{1}'.format(width, height)

  match = [m.group(1) for l in exifDetails for m in [re.search(r'^Video Frame Rate *: ([0-9\.]+)$', l)] if m]
  if match:
    fps = match[0]

  videoStart = -1
  match = [m.group(1) for l in details for m in [re.search(r'^(Video *)$', l)] if m]
  if match:
    videoStart = details.index(match[0])
  audioStart = -1
  match = [m.group(1) for l in details for m in [re.search(r'^(Audio *(?:#1)? *)$', l)] if m]
  if match:
    audioStart = details.index(match[0])

  match = [m.group(1) for l in details[videoStart:audioStart] for m in [re.search(r'^Codec ID *: (.+)$', l)] if m]
  vcodec = 'Unknown'
  if match:
    vcodec = match[0]

  match = [m.group(1) for l in details[videoStart:audioStart] for m in [re.search(r'^(?:\w*)? *[Bb]it rate *: ([0-9]+)$', l)] if m]
  vrate = 'Unknown'
  if match:
    vrate = int(match[0]) / 1000

  match = [m.group(1) for l in details[audioStart:] for m in [re.search(r'^Codec ID *: (.+)$', l)] if m]
  acodec = 'Unknown'
  if match:
    acodec = match[0]

  match = [m.group(1) for l in details[audioStart:] for m in [re.search(r'^Bit rate *: ([0-9]+)$', l)] if m]
  arate = 'Unknown'
  if match:
    arate = int(match[0]) / 1000

  match = [m.group(1) for l in details[audioStart:] for m in [re.search(r'^Channel\(s\) *: ([0-9]+)$', l)] if m]
  if match:
    nch = int(match[0])

  #detP = Popen(['mplayer', '-vo', 'null', '-ao', 'null', '-identify', '-frames', '0', mfile], stderr=PIPE, stdout=PIPE)
  #details, err = detP.communicate()
  #details = details.split('\n')
  #details = filter(lambda d: not (d == '' or d.startswith('Playing ') or d.startswith('Exiting..') or d.startswith('Playback') or d.startswith('MPlayer') or 'ID_SUBTITLE' in d or 'ID_SID' in d or 'subtitle' in d or 'ID_CHAPTER' in d or ' Track ID' in d or '=' not in d), details)
  #details = {x[0]:x[1] for x in map(lambda d: d.split('=', 1), details)}
  #keys = details.keys()
  #if 'ID_VIDEO_HEIGHT' not in keys or 'ID_VIDEO_WIDTH' not in keys or 'ID_VIDEO_FPS' not in keys or 'ID_AUDIO_NCH' not in keys:
    #print 'ERROR: missing critical information'
    #if FAIL: exit()
    #continue
  #height = details['ID_VIDEO_HEIGHT']
  #width = details['ID_VIDEO_WIDTH']
  #fps = details['ID_VIDEO_FPS']
  #res = '{0}x{1}'.format(width, height)
  #if 'ID_VIDEO_CODEC' not in keys:
    #vcodec = 'Unknown'
  #else:
    #vcodec = details['ID_VIDEO_CODEC']
  #if 'ID_VIDEO_BITRATE' not in keys:
    #vrate = 'Unknown'
  #else:
    #vrate = str(int(details['ID_VIDEO_BITRATE']) / 1000)
  #if vrate == '0': vrate = 'Unknown'
  #if 'ID_AUDIO_CODEC' not in keys:
    #acodec = 'Unknown'
  #else:
    #acodec = details['ID_AUDIO_CODEC']
  #if 'ID_AUDIO_BITRATE' not in keys:
    #arate = 'Unknown'
  #else:
    #arate = str(int(details['ID_AUDIO_BITRATE']) / 1000)
  #if arate == '0': arate = 'Unknown'
  #nch = details['ID_AUDIO_NCH']

  fname = basename(mfile)
  fname2 = re.sub(r'^[0-9 \.\-]+', '', fname)
  v = sha512(fname).hexdigest()[:3]

  if not width or not height or not nch or not fps:
    print 'ERROR: missing critical information: ',
    if not width:
      print 'width ',
    if not height:
      print 'height ',
    if not fps:
      print 'fps ',
    if not nch:
      print 'channels',
    print ''
    if FAIL: exit()
    continue

  print 'Vault {0}: {1} at {2}, {9} MB, fps {3} vc {4} ac {5} vb {6} ab {7} nch {8}'.format(v, fname, res, fps, vcodec, acodec, vrate, arate, nch, int(size / 1024 / 1024))
  if FAIL: exit()
  n = sha256(v).hexdigest()
  safeSize = size / 1024 + 512 * 1024

  existsP = Popen([fs, 'x', v], stderr=PIPE, stdout=PIPE, preexec_fn = preexec)
  if not eval(existsP.communicate()[0]):
    print 'ERROR: Creating new vault - SHOULD NOT BE HERE CONFIRM'
    if raw_input('Continue (type YES)? ') != 'YES':
      if FAIL: exit()
      continue
    newSize = safeSize + padding + 'K'
    cP = Popen([fs, 'c', v, newSize, '/mnt'], preexec_fn = preexec)
    cP.communicate()
  else:
    availP = Popen([fs, 's', v, '/mnt/size'], stdout=PIPE, stderr=PIPE, preexec_fn = preexec)
    avail = availP.communicate()[0].split(',')[1].replace(']', '').replace("'", '').strip()
    if not avail.isdigit():
      print 'ERROR: Got non-numeric available size: {0}'.format(avail)
      if FAIL: exit()
      continue
    avail = int(avail)
    if avail < safeSize:
      print 'WARN: Found {0} MB space, increasing by {1} MB'.format(float(avail / 1024), (safeSize - avail + padding) / 1024)
      print 'Resizing vault, please wait'
      proc = Popen([fs, 'r', v, str(safeSize - avail + padding) + 'K', '/mnt'], preexec_fn = preexec)
      proc.communicate()

  mP = Popen([fs, 'm', v, '/data/' + n], preexec_fn = preexec)
  mP.communicate()

  if exists('/data/' + n + '/' + mfile):
    print 'ERROR: {0} already exists!'.format(mfile)
    dP = Popen([fs, 'd', v], preexec_fn = preexec)
    dP.communicate()
    if FAIL: exit()
    continue

  print 'Copying data'
  rP = Popen(['rsync', '--partial', '-ahvtr', mfile, '/data/{0}/'.format(n)], stdout=PIPE, preexec_fn = preexec)
  rP.communicate()

  Popen(['chown', 'root:prometheus', '/data/{0}/{1}'.format(n, fname)], preexec_fn = preexec)
  Popen(['chmod', '750', '/data/{0}/{1}'.format(n, fname)], preexec_fn = preexec)
  cP = Popen(['sha512sum', '/data/{0}/{1}'.format(n, fname)], stdout=PIPE, stderr=PIPE, preexec_fn = preexec)
  checksum2 = cP.communicate()[0].split(' ', 1)[0]
  dP = Popen([fs, 'd', v], preexec_fn = preexec)
  dP.communicate()

  if checksum != checksum2:
    print 'Checksum mismatch for {0}: {1}, {2}!'.format(fname, checksum, checksum2)
    if FAIL: exit()
    continue

  dbCursor.execute("UPDATE {0} SET file=%s,size=%s,checksum=%s,resolution=%s,v_codec=%s,a_codec=%s,v_rate=%s,a_rate=%s,fps=%s,channels=%s WHERE ttid=%s".format(table), [fname, size, checksum, res, vcodec, acodec, vrate, arate, fps, nch, ttid])
  if dbCursor.rowcount != 1:
    print 'ERROR: Database updated {0} rows!'.format(dbCursor.rowcount)

  print 'Cleaning up'
  sP = Popen(['sync'])
  sP.communicate()

  sP = Popen(['shred', '-u', mfile])
  if FAIL: exit()
  completed += 1
