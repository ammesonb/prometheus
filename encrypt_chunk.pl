#!/usr/bin/perl -w

use strict;

my $sID = shift;
my $key = shift;
my $num = shift;

my $files = `ls -l /files/$sID/ | wc -l` + 1002;
for (my $i = 1000 + $num; $i < $files; $i += 3) {
    $i = "0" x (10 - length($i)) . $i;
    `openssl enc -a -aes-256-cbc -e -pass pass:"$key" -in /files/$sID-pln/$i -out /files/$sID/$i`;
    `rm /files/$sID-pln/$i`;
}
`rmdir /files/$sID-pln`;
