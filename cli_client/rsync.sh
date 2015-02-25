#!/bin/bash
prom_ip="$1"
shift
out="$1"
shift
for f in "$@"
  do
    rsync -achvtr --progress --partial --password-file=rp "prom_cli@$prom_ip::prom_files/$f" $out/
  done
echo "[press any key to exit]"
read
