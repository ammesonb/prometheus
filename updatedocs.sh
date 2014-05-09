#!/bin/bash

echo "Removing old documentation...."
rm -r /var/www/docs/*
echo "Creating documentation...."
/usr/local/bin/pod2projdocs -out /var/www/docs -lib /var/www
echo "Done."
