#!/bin/bash

pg_dump -sC prometheus > prometheus.db
/bin/bash /var/www/updatedocs.sh
rsync -ahvtr --progress --partial /home/brett/Dropbox/Prometheus-Android/* android/
git add *
git commit -a
