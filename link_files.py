#!/usr/bin/python
from os import listdir
from os.path import basename
from sys import argv, exit
import urllib2 as ul
from urllib import urlencode
from time import sleep
import json
import re
from pick import pick

if len(argv) < 2:
    print 'Need directory'
    exit(1)

root = argv[1]
files = listdir(root)
files.sort()
out = raw_input('Output file: ')
names = open(out).read().split('\n')
names.remove('')
names = map(lambda n: basename(n.split('-', 2)[1]), names)
outf = open(out, 'a')

for f in files:
    if f in names: continue
    if len(f.split('.')[-1]) > 3: continue
    f2 = f
    if f.startswith('A '): f2 = f.replace('A ', '')
    req = ul.urlopen('http://www.imdb.com/xml/find?json=1&nr=1&tt=on&' + urlencode({'q': f2.split('.')[0]}).replace('%20', '+'))
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

    dispTitles.append('None')
    title, idx = pick(dispTitles, 'File: {0}'.format(f))
    if title == 'None': continue
    outf.write(title.split('[tt')[1].split(']')[0] + '-{0}/{1}\n'.format(root, f))

outf.close()
