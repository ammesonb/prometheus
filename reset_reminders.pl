#!/usr/bin/perl

use DBI;
use DBD::Pg;
use strict;

my $dbh = DBI->connect("DBI:Pg:dbname=prometheus", "root");
my $cmd = $dbh->prepare("SELECT id FROM reminders");
$cmd->execute();
my $idRef = $cmd->fetchall_arrayref();
my @ids = @$idRef;

foreach(@ids) {
    my $id = @{$_}[0];
    `update_reminder c $id`;
}

$dbh->disconnect();
