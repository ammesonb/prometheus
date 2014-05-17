#!/bin/bash

pg_dump -sC prometheus > prometheus.db
/bin/bash /var/www/updatedocs.sh
git add *
git commit -a
