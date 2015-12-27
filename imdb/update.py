#!/usr/bin/python

from pickle import loads
from sys import argv
from os import system
from string import lowercase, uppercase, digits
from time import sleep

kind = argv[1]
f = open(kind)
d = f.read()
ms = loads(d)

verbosity = 0
if len(argv) > 2:
    verbosity = argv[2].count('v')

count = 1
for m in ms: #{{{
    print m['title']
    if verbosity:
        print "Parsing " + str(count) + " out of " + str(len(ms)) + ", ID " + m['ttid']
    values = {}
    data = m['description']
    data = "'" + data.replace("'", "''") + "'"
    data = data.replace('"', '\\"')
    system('psql prometheus -c "UPDATE movies SET description=' + data + ' WHERE ttid=\'' + m['ttid'] + '\'"')
    sleep(.1)

    count += 1 #}}}
