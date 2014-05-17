#!/bin/bash

pg_dump -sC prometheus > prometheus.db
./updatedocs
git add *
git commit -a
