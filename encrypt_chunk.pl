#!/usr/bin/perl -w

use strict;

my $sID = shift;
my $key = shift;
my $num = shift;

my $files = `ls -l /files/$sID-pln/ | wc -l` + 1002;
for (my $i = (1000 + $num); $i < $files; $i += 3) {
    $i = "0" x (10 - length($i)) . $i;
    `openssl enc -a -A -e -aes-256-cbc -pass pass:"$key" -in /files/$sID-pln/$i -out /files/$sID/$i`;
    `rm /files/$sID-pln/$i 2>&1 >/dev/null`;
}
`rmdir /files/$sID-pln 2>&1 /dev/null`;
