#!/usr/bin/python

import os
from glob import glob
from sys import argv

if len(argv) < 4:
    print "Usage: search.py start_dir in_file out_file"

start_dir = argv[1]
in_file = argv[2]
out_file = argv[3]

files = [os.path.basename(fn) for fn in glob(start_dir + '/*') if not os.path.basename(fn).endswith('srt') and not os.path.basename(fn).endswith('idx')]
files.sort()

f = open(in_file)
d = f.read()
d = d.split('\n')
d.remove('')
d.sort()
for f in files:
    ws = f.split(' ')
    for w in ws:
        matches = []
        for m in d:
            t, n = m.split(' | ', 2)
            t = t.strip()
            n = n.strip()
            if w in n and (t, f) not in matches:
                matches.append((t, f))

        if len(matches) == 1:
            f = open(out_file, 'a')
            f.write(matches[0][0] + '-' + matches[0][1] + '\n')
            f.close()
            break
    
    #fp = n.split(' ')
    #for w in fp:
        #matches = []
        #for m in files:
            #if ' ' + w + ' ' in m or ' ' + w + '.' in m and m not in matches:
                #matches.append(m)

        #if len(matches) == 1:
            #print matches[0] + '-' + n
            #f = open(out_file, 'a')
            #f.write(t + ',' + matches[0] + '\n')
            #f.close()
            #break
