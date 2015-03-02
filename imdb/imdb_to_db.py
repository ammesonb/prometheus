#!/usr/bin/python

from pickle import loads
from sys import argv
from os import system
from string import lowercase, uppercase, digits

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

mainSQL = "INSERT INTO " + kind + " (" + ', '.join(columns[kind]) + ") VALUES"
genres = []
genreSQL = "INSERT INTO " + kind + "_genre (" + genreName[kind] + ", genre) VALUES "
series = []
count = 1
for m in ms: #{{{
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
            data = "'" + data.replace("'", "''") + "'"
            if column == 'released':
                data = list(data)
                data = "'" + ''.join(filter(lambda e: e in dateFormat, data)) + "'"
        elif types[column] == 'i':
            data = int(data)
            if column == 'year':
                if data < 20:
                    data += 2000
                elif data < 100:
                    data += 1900

        if column in references[kind]:
            if data == '':
                values[column] = 'NULL'
            else:
                if data not in eval(column):
                    eval(column).append(data)
                values[column] = "(SELECT id FROM " + column + " WHERE name = '" + data + "')"
        else:
            values[column] = data

    for genre in m['genre']:
        genreSQL += "((SELECT id FROM " + kind + " WHERE ttid = '" + m['ttid'] + "'), (SELECT id FROM genres WHERE name = '" + genre + "')),"
        if genre not in genres:
            genres.append(genre)

    mainSQL += '('
    for col in columns[kind]:
        if not values.has_key(col):
            mainSQL += 'null,'
            continue
        mainSQL += str(values[col]) + ','
    mainSQL = mainSQL[:-1]
    mainSQL += ')'
    if ms[-1] != m:
        mainSQL += ','
    count += 1 #}}}

# Executed in transaction, so all or none #{{{
# To avoid that, since series and genres could already exist,
# add them individually
createGenreSQL = "INSERT INTO genres (name) VALUES ('<GENRE>');"
for g in genres:
    sql = createGenreSQL.replace('<GENRE>', g)
    sql = sql.replace('"', '\\"')
    system('psql prometheus -c "' + sql + '"')
seriesSQL = "INSERT INTO series (name) VALUES ('<SERIES>');"
for s in series:
    sql = seriesSQL.replace('<SERIES>', s)
    sql = sql.replace('"', '\\"')
    system('psql prometheus -c "' + sql + '"') #}}}

genreSQL = genreSQL[:-1]
genreSQL += ';'
genreSQL = genreSQL.replace('"', '\\"')
mainSQL += ';'
mainSQL = mainSQL.replace('"', '\\"')

system('psql prometheus -c "' + mainSQL + '"')
system('psql prometheus -c "' + genreSQL + '"')
