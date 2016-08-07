#!/usr/bin/python
import urllib2 as ul
from urllib import urlencode
from time import sleep
import json
import re
from pick import pick

out = raw_input('Output file: ')
outf = open(out, 'a')

series = ''
while True:
    title = raw_input('Title: ')
    if title == 'series':
        series = raw_input('Series name: ')
        continue
    elif title == 'endseries':
        series = ''
        continue
    elif title == 'quit':
        outf.close()
        break
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

    dispTitles.append('None')
    title, idx = pick(dispTitles, 'Pick a movie')
    if title == 'None': continue
    if series != '':
        outf.write('{0},'.format(series))
    outf.write(title.split('[tt')[1].split(']')[0] + '# {0}\n'.format(title))
