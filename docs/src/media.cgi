#!/usr/bin/perl -w

use lib '/var/www/perl';
use CGI;
use CGI::Session;
use CGI::Carp qw(fatalsToBrowser);
use JSON;
use COMMON;
use strict;

my $q = new CGI();
my $session = CGI::Session->new($q);

my $media = $q->param('media');
if ($media ne 'tv' and $media ne 'movies') {print 'badmedia'; exit;}
my $service = $media eq 'tv' ? 6 : 4;
if (COMMON::checkFilePermissions($session, $service)) {print 'notmine'; exit;}

print "Content-type: text/html\r\n\r\n";
my $mode = $q->param('mode');
if (COMMON::checkSession($session)) {
    $session->param('timed_out', 1);
    print 'noauth';
    exit;
}

if ($mode !~ /^[0-9]+$/) {
    print 'badreq';
    exit;
}

if ($mode == 0) {
    my %genreAlias = ('tv' => 'episode', 'movies' => 'movie');
    my $mediaRef = COMMON::getTable($session, $media);
    my %media = %$mediaRef;
    my $dbh = COMMON::connectToDB($session);
    my $seriesCMD = $dbh->prepare("SELECT * FROM series WHERE id IN (SELECT series FROM $media)");
    $seriesCMD->execute();
    my $seriesRef = $seriesCMD->fetchall_hashref(['id']);
    my %series = %$seriesRef;
    my $genreCMD = $dbh->prepare("SELECT * FROM genres WHERE id IN (SELECT genre FROM $media" . "_genre WHERE $genreAlias{$media} IN (SELECT id FROM $media));");
    $genreCMD->execute();
    my $genreRef = $genreCMD->fetchall_hashref(['id']);
    my %genres = %$genreRef;

    print '[';
    print join(',', (encode_json(\%media), encode_json(\%series), encode_json(\%genres)));
    print ']';
}
exit;
