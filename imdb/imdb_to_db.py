#!/usr/bin/python

from pickle import loads
import sys
from sys import argv, exit
from os import system
from string import lowercase, uppercase, digits

import psycopg2
import psycopg2.extras

dbConn = psycopg2.connect("dbname='prometheus' user='root' host='localhost'")
dbConn.autocommit = True
dbCursor = dbConn.cursor(cursor_factory=psycopg2.extras.DictCursor)

kind = argv[1]
f = open(kind)
d = f.read()
ms = loads(d)

verbosity = 0
if len(argv) > 2:
    verbosity = argv[2].count('v')

columns = { #{{{
            'movies': ['ttid', 'title', 'series', 'year', 'released', 'duration', 'director', 'description'],
            'tv': ['ttid', 'title', 'series', 'year', 'released', 'season', 'episode', 'duration', 'director', 'description']
          } #}}}
types = {'ttid': 's', 'title': 's', 'year': 'i', 'released': 's', 'season': 'i', 'episode': 'i', 'duration': 'i', 'director': 's', 'description': 's', 'series': 'r', 'checksum': 's', 'resolution': 's', 'v_codec': 's', 'v_rate': 's', 'a_codec': 's', 'a_rate': 's'}
genreName = {'movies': 'movie', 'tv': ' episode'}
references = { #{{{
                'movies': ['series'],
                'tv': ['series']
             } #}}}

# Acceptable characters in a release date #{{{
dateFormat = list(lowercase)
dateFormat.extend(uppercase)
dateFormat.extend(digits)
dateFormat.extend(' _-') #}}}

count = 1
for m in ms:
    #print m['title']
    if verbosity:
        print "Parsing " + str(count) + " out of " + str(len(ms)) + ", ID " + m['ttid']
    values = {}
    for column in columns[kind]:
        try:
            data = m[column]
        except KeyError:
            print 'Missing data ' + column + '!'
            continue
        if verbosity > 1:
            print column + ': ' + data
        if types[column] == 's':
            if column == 'released':
                data = list(data)
                data = "'" + ''.join(filter(lambda e: e in dateFormat, data)) + "'"
        elif types[column] == 'i':
            try:
                data = int(data)
            except:
                print column
                print data
                exit(1)
            if column == 'year':
                if data < 20:
                    data += 2000
                elif data < 100:
                    data += 1900

        #if column in references[kind]:
            #if data == '':
                #values[column] = 'NULL'
            #else:
                #if data not in eval(column):
                    #eval(column).append(data)
                #if column != 'series' or data != -1:
                    #values[column] = "(SELECT id FROM " + column + " WHERE name = '" + data + "')"
        else:
            values[column] = data

    for genre in m['genre']:
        dbCursor.execute("SELECT EXISTS(SELECT name FROM genres WHERE name = %s)", [genre])
        if dbCursor.fetchone()[0]: continue
        dbCursor.execute("INSERT INTO genres (name) VALUES (%s)", [genre])
        genreSQL += "((SELECT id FROM " + kind + " WHERE ttid = '" + m['ttid'] + "'), (SELECT id FROM genres WHERE name = '" + genre + "')),"
        genres.append(genre)

    if m['series'] != -1:
        dbCursor.execute("SELECT id FROM series WHERE name = %s", [m['series']])
        res = dbCursor.fetchone()
        if not res:
            dbCursor.execute("INSERT INTO SERIES (name) VALUES (%s)", [m['series']])
            dbCursor.execute("SELECT id FROM series WHERE name = %s", [m['series']])
            res = dbCursor.fetchone()
        seriesID = res[0]
        m['series'] = seriesID
    else:
        m['series'] = None

    values = []
    errors = False
    for c in columns[kind]:
        try:
            values.append(m[c])
        except KeyError:
            errors = True
            print m['title'] + ' has no key "' + c + '"'
            if m['title'] == 'The Imitation Game':
                print 'override'
                values.append('2014-12-25')
                errors = False
    if errors:
        print 'Skipping'
        continue

    try:
        for col in columns[kind]:
            dbCursor.execute("SELECT EXISTS(SELECT ttid FROM {0} WHERE ttid=%s)".format(kind), [m['ttid']])
            if dbCursor.fetchone()[0]: continue
            dbCursor.execute("INSERT INTO {0} ({1}) VALUES (%s".format(kind, ','.join(columns[kind])) + ", %s" * (len(columns[kind]) - 1) + ")", values)

        for genre in m['genre']:
            dbCursor.execute('SELECT EXISTS(SELECT id FROM {0}_genre WHERE {1}=(SELECT id FROM {0} WHERE ttid=%s) AND genre=(SELECT id FROM genres WHERE name=%s))'.format(kind, genreName[kind]), [m['ttid'], genre])
    except:
        print sys.exc_info()
        print columns[kind]
        print values
        sys.exit(1)
