#!/usr/bin/perl -w

use lib '/var/www/perl/';
use File::Temp qw(tempfile);
use DBI;
use DBD::Pg;
use COMMON;
use strict;

my $dbh = DBI->connect('DBI:Pg:dbname=prometheus', 'root');

my $mode = shift;
my $id = shift;

my ($file, $filename, $oldFilename, %reminder);
if ($mode ne 'd') {
    ($file, $filename) = tempfile(DIR => 'reminders');
}
if ($mode ne 'c') {
    $oldFilename = shift;
    `rm $oldFilename`;
}

# Newly created reminder
if ($mode eq 'c' or $id eq '-1') {
# Run reminder
} elsif ($mode eq 'r') {
# Update reminder
} elsif ($mode eq 'u') {
# Delete reminder
} elsif ($mode eq 'd') {
}

$dbh->disconnect();
