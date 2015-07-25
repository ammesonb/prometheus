#!/usr/bin/python

from os import system
from os.path import exists
from sys import argv
from string import printable
from HTMLParser import HTMLParser
from hashlib import sha512
import pickle
import re
from htmlentitydefs import name2codepoint
def htmlentitydecode(s):
    return re.sub('&(%s);' % '|'.join(name2codepoint),
        lambda m: unichr(name2codepoint[m.group(1)]), s)

# Basic functions to verify modes #{{{
# Works if tag name is the same as mode name
def basicTagStart(tag, attr, movie): #{{{
    return tag == attr and not movie.has_key(attr) #}}}

def basicTagEnd(tag, attr, mode): #{{{
    return tag == attr and mode == attr #}}}

def basicTagCheck(mode, attr, movie): #{{{
    return mode == attr and not movie.has_key(attr) #}}} #}}}

class IMDBParser(HTMLParser): #{{{
    def handle_starttag(self, tag, attrs): #{{{
        if basicTagStart(tag, 'title', self.media):
            self.mode = 'title'
        elif basicTagStart(tag, 'time', self.media):
            self.mode = 'time'
        elif tag == 'a' and attrs[0][0] == 'href' and 'tt_stry_gnr' in attrs[0][1]:
            self.mode = 'genre'
        elif tag == 'p' and len(attrs) and attrs[0][0] == 'itemprop' and attrs[0][1] == 'description':
            self.mode = 'desc'
        elif  tag == 'a' and attrs[0][0] == 'href' and 'tt_ov_dr' in attrs[0][1]:
            self.mode = 'director'
        elif tag == 'meta' and attrs[0][0] == 'itemprop' and attrs[0][1] == 'datePublished' and not self.media.has_key('released'):
            self.media['released'] = attrs[1][1]
        elif kind == 'tv' and not self.media.has_key('released') and tag == 'span' and len(attrs) > 1 and attrs[0][0] == 'class' and attrs[0][1] == 'itemprop' and attrs[1][1] == 'name':
            self.mode = 'released_pre'
        elif self.mode == 'released_pre' and tag == 'span' and attrs[0][0] == 'class' and attrs[0][1] == 'nobr':
            self.mode = 'released'
        elif tag == 'img' and len(attrs) > 5 and attrs[5][0] == 'itemprop' and attrs[5][1] == 'image':
            img = attrs[4][1]
            cont = 1
            try:
                url, ext = img.rsplit('SX', 1)
                url += 'SX1619_SY937'
            except ValueError:
                try:
                    url, ext = img.rsplit('SY', 1)
                    url += 'SX1619_SY937'
                except:
                    url, ext = attrs[4][1].rsplit('.', 1)
                    ext = '.' + ext

            ext = ext.split('.')[-1]
            imagePath = 'images/' + kind + '/' + self.media['ttid'] + '.' + ext
            system('curl ' + url + '.' + ext + ' -o ' + imagePath + ' > /dev/null 2>&1')
            checksum = sha512(open(imagePath, 'rb').read()).digest()
            if imageChecksums.has_key(checksum):
                system('rm ' + imagePath)
                system('ln -s ' + imageChecksums[checksum] + ' ' + imagePath)
            else:
                imageChecksums[checksum] = self.media['ttid'] + '.' + ext
            #}}}

    def handle_endtag(self, tag): #{{{
        if basicTagEnd(tag, 'title', self.mode):
            self.mode = ''
        elif basicTagEnd(tag, 'time', self.mode):
            self.mode = ''
        elif tag == 'p' and self.mode == 'desc':
            self.mode = ''
        elif tag == 'span' and self.mode == 'released':
            self.mode = ''
        elif tag == 'a':
            if self.mode in ['genre', 'director']:
                self.mode = '' #}}}

    def handle_data(self, data): #{{{
        if basicTagCheck(self.mode, 'title', self.media):
            if kind == 'movies':
                title = data.replace(' - IMDb', '').strip()
                year = title.split(' ')[-1][1:-1]
                title = ' '.join(title.split(' ')[:-1])
                self.media['title'] = title
                self.media['year'] = year
            elif kind == 'tv':
                series = data.split('"')
                series = filter(lambda e: e != '', series)

                self.media['series'] = series[0].strip()
                rest = data.split('"' + series[0] + '" ')[1]
                title, rest = rest.split('(')
                self.media['title'] = title.strip()
                year = rest.split(')')[0].split(' ')[-1].strip()
                self.media['year'] = year
        elif self.mode == 'released':
            self.media['released'] = data[1:-1]
        elif basicTagCheck(self.mode, 'time', self.media):
            data = data.strip()
            t = data.split(' ')
            try:
                t.remove('')
            except ValueError:
                pass
            self.media['duration'] = t[0].strip()
        elif self.mode == 'genre':
            if self.media.has_key('genre'):
                self.media['genre'].append(data.strip())
            else:
                self.media['genre'] = [data.strip()]
        elif basicTagCheck(self.mode, 'director', self.media):
            self.media['director'] = data.strip()
        elif basicTagCheck(self.mode, 'desc', self.media):
            self.media['description'] = data.strip() #}}} #}}}

if len(argv) <= 1:
    print "Usage: capture_imdb.py kind [ttid file]"
    exit()

imageChecksums = {}
kind = argv[1]

if len(argv) > 2:
    ttids = open(argv[2])
else:
    ttids = open('ttids')
ttids = ttids.read()
ttids = ttids.split('\n')
ttids = filter(lambda e: e != '', ttids)

series = {-1: ''}
num = 0
for ttid in ttids:
    ttids[num] = ttids[num].split('#')[0]
    num += 1

media = open(kind)
media = media.read()
if media:
    media = pickle.loads(media)
else:
    media = []

imdbParser = IMDBParser()
count = 1
for ttid in ttids: #{{{
    print 'Parsing ' + str(count) + ' out of ' + str(len(ttids)) + ', ID ' + ttid
    n = 0
    for e in ['.jpg', '.bmp', '.png']:
        if exists('images/' + ttid + e):
            n = 1
            break

    if n:
        count += 1
        continue
    s = -1
    if ',' in ttid:
        s, ttid = ttid.split(',')
    system('wget http://www.imdb.com/title/tt' + ttid + '/ > /dev/null 2>&1')
    html = open('index.html')
    html = html.read()
    html = filter(lambda x: x in printable, html)
    html = htmlentitydecode(html)
    html = filter(lambda x: x in printable, html)
    html = str(html)
    
    imdbParser.media = {'ttid': ttid}
    imdbParser.media['series'] = s
    imdbParser.kind = kind[0]
    imdbParser.mode = ''
    imdbParser.feed(html)
    if kind == 'tv':
        pattern = re.compile("<span class=\"nobr\">Season [0-9]+, Episode [0-9]+")
        match = pattern.search(html)
        if not match:
            s = raw_input('Season: ')
            s = s.strip()
            imdbParser.media['season'] = s
            e = raw_input('Episode: ')
            e = s.strip()
            imdbParser.media['episode'] = e
        else:
            location = [match.start(), match.end()]
            data = html[location[0]:location[1]].split('>')[1]
            season = data.split(',')[0].split(' ')[-1]
            imdbParser.media['season'] = season
            episode = data.split(',')[1].split(' ')[-1]
            imdbParser.media['episode'] = episode
    media.append(imdbParser.media)
    system('rm index.html*')
    count += 1 #}}}

media = pickle.dumps(media)
m = open(kind, 'w')
m.write(media)
m.close()
