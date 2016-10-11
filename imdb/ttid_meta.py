#!/usr/bin/python
import urllib2 as ul
from urllib import urlencode
from time import sleep
import json
import re
from pick import pick
from sys import argv, exit
from os.path import exists, basename, getsize
from os import listdir
import psycopg2
import psycopg2.extras
from subprocess import Popen
from hashlib import sha512, sha256

fs = '/var/www/prometheus/encfs/./fs.py'

if len(argv) > 2:
    print 'Need directory'
    exit()

iout = raw_input('ttid imdb scrape output file: ')
fout = raw_input('ttid link output file: ')
infoOut = open(iout, 'a')
fileOut = open(fout, 'a')

root = argv[1]
files = listdir(root)
files.sort()
names = open(fout).read().split('\n')
try:
    names.remove('')
except:
    pass
names = map(lambda n: basename(n.split('-', 2)[1]), names)

dbConn = psycopg2.connect("dbname='prometheus' user='root' host='localhost'")
dbCursor = dbConn.cursor(cursor_factory=psycopg2.extras.DictCursor)

series = ''
def searchIMDB(title):
    req = ul.urlopen('http://www.imdb.com/xml/find?json=1&nr=1&tt=on&' + urlencode({'q': title}).replace('%20', '+'))
    sleep(0.2)
    data = req.read()
    obj = json.loads(data.strip())
    titles = {}
    titleOrder = []
    dispTitles = []
    for k in ['title_popular', 'title_substring', 'title_approx']:
        if not obj.has_key(k): continue
        for m in obj[k]:
            titleOrder.append(m['title'])
            disp = m['title']
            if re.match(r'[0-9]{4},', m['title_description']):
                disp += ' ({0})'.format(m['title_description'].split(',')[0])
            elif re.match(r'[0-9]{4} ', m['title_description']):
                disp += ' ({0})'.format(m['title_description'].split(' ')[0])
            dispTitles.append(disp + '  [{0}]'.format(m['id']))
            titles[m['title']] = {'ttid': m['id'].replace('tt', '')}
    return [titles, titleOrder, dispTitles]

def checkMatch(f, search=None, isFile=True):
    global series
    if f in names: return
    if len(f.split('.')[-1]) > 3 and isFile: return

    if search:
        titles, titleOrder, dispTitles = searchIMDB(search)
    else:
        titles, titleOrder, dispTitles = searchIMDB(f.split('.')[0].lstrip('A '))

    if series != '':
        dispTitles.append('New series')
        dispTitles.append('End series')
    else:
        dispTitles.append('Series')
    dispTitles.append('None')
    dispString = 'Pick a movie ({0}), series {1}'.format(f, series)
    title, idx = pick(dispTitles, dispString)
    if title == 'None':
        title = raw_input('Title (empty or q to give up): ')
        # Avoid an infinite loop where file is not found
        if title == '' or title == 'q': return
        checkMatch(f, title, False)
        return
    elif title == 'Series':
        series = raw_input('Series name: ')
        dispString = 'Pick a movie ({0}), series {1}'.format(f, series)
        title, idx = pick(dispTitles, dispString)
    elif title == 'End series':
        series = ''
        dispString = 'Pick a movie ({0}), series {1}'.format(f, series)
        title, idx = pick(dispTitles, dispString)
    elif title == 'New series':
        series = raw_input('Series name: ')
        dispString = 'Pick a movie ({0}), series {1}'.format(f, series)
        title, idx = pick(dispTitles, dispString)

    ttid = title.split('[tt')[1].split(']')[0]
    dbCursor.execute("SELECT EXISTS(SELECT 1 FROM movies WHERE ttid=%s) AS exists", [ttid])
    res = dbCursor.fetchone()['exists']
    v = sha512(f).hexdigest()[:3]
    if res:
        n = sha256(v).hexdigest()
        mP = Popen([fs, 'm', v, '/data/' + n])
        mP.communicate()
        p = '/data/{0}/{1}'.format(n, f)
        nsize = str(int(getsize(root + '/' + f) / 1024 / 1024)) + " MB"
        osize = 0
        if exists(p):
            osize = str(int(getsize('/data/{0}/{1}'.format(n, f))) / 1024 / 1024) + " MB"
        dP = Popen([fs, 'd', v])
        dP.communicate()

        dbCursor.execute("SELECT file, size FROM movies WHERE ttid=%s", [ttid])
        res = dbCursor.fetchone()
        if res and res['file']:
            dsize = str(int(res['size']) / 1024 / 1024) + " MB"
            if exists(p):
                osize = str(int(getsize('/data/{0}/{1}'.format(n, f))) / 1024 / 1024) + " MB"
                if res['file'] == f:
                    print 'File already exists in storage - existing file: {0}, new: {1}, db: {2}'.format(osize, nsize, dsize)
                    resolve = raw_input('[S]kip, [O]verwrite: ')
                    # if not overwrite, don't continue
                    if not resolve.startswith('O') and not resolve.startswith('o'):
                        print 'Skipping'
                        return
            else:
                print 'DB file doesn\'t exist or isn\'t integrated, old DB file size: {0}, new: {1}'.format(dsize, nsize)
                resolve = raw_input('[S]kip, [O]verwrite: ')
                # if not overwrite, don't continue
                if not resolve.startswith('O') and not resolve.startswith('o'):
                    print 'Skipping'
                    return
        
    if series != '':
        infoOut.write('{0},'.format(series))
    infoOut.write(ttid + '# {0}\n'.format(title))
    fileOut.write(ttid + '-{0}/{1}\n'.format(root, f))

if __name__ == "__main__":
    for f in files:
        infoOut = open(iout, 'a')
        fileOut = open(fout, 'a')
        checkMatch(f) 
        infoOut.close()
        fileOut.close()
