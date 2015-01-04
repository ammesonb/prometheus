#!/usr/bin/perl -w

use strict;

my $sID = shift;
my $key = shift;
my $num = shift;

my $files = `ls -l /files/$sID/ | wc -l` + 1002;
for (my $i = 1000 + $num; $i < $files; $i += 3) {
    $i = "0" x (10 - length($i)) . $i;
    `openssl enc -a -aes-256-cbc -e -pass pass:"$encKey" -i /files/$sessionID-pln/$i -out /files/$sessionID/$i`;
    `rm /files/$sessionID-pln/$_`;
}
`rmdir /files/$sessionID-pln`;
