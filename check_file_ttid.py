#!/usr/bin/python
from sys import argv, exit
import psycopg2
import psycopg2.extras

if len(argv) < 2:
    print 'Need file'
    exit(1)

ttids = open(argv[1]).read().split('\n')
ttids = map(lambda t: t.split('-')[0], ttids)
ttids.remove('')

dbConn = psycopg2.connect("dbname='prometheus' user='root' host='localhost'")
dbConn.autocommit = True
dbCursor = dbConn.cursor(cursor_factory=psycopg2.extras.DictCursor)

count = 0
for ttid in ttids:
    dbCursor.execute("SELECT EXISTS(SELECT 1 FROM movies WHERE ttid=%s) AS exists", [ttid])
    result = dbCursor.fetchone()
    if not result['exists']:
        print ttid
    else:
        count += 1

print str(count) + ' out of ' + str(len(ttids)) + ' exist'
