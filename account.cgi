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

print "Content-type: text/html\r\n\r\n";
my $mode = $q->param('mode');
if (COMMON::checkSession($session)) { #{{{
    $session->param('timed_out', 1);
    print 'noauth';
    exit;
} #}}}

if (not ($mode =~ /^[0-9]+$/)) { #{{{
    print 'Bad request!';
    exit;
} #}}}

# Need to use JSON instead - include all domains and services, not just ones which the user has access to
if ($mode == 0) { #{{{
    my $domainRef = COMMON::getTable($session, 'domains');
    my %domains = %$domainRef;
    my $serviceRef = COMMON::getTable($session, 'services');
    my %services = %$serviceRef;
    my $myServicesRef = COMMON::searchTable($session, 'user_services', ['service_id'], ['user_id'], ['='], [$session->param('user_id')], [], 0, 'service_id');
    my %myServices = %$myServicesRef;
    my @myServices = keys(%myServices);
    print '[';
    if ($session->param('is_shared')) {print '"shared",';}
    elsif ($session->param('is_admin')) {print '"admin",';}
    else {print '"normal",';}
    print encode_json(\%domains) . ',';
    print encode_json(\%services) . ',';
    print encode_json(\@myServices);
    if ($session->param('user') eq 'root') {
        print ',';
        my $usersRef = COMMON::getTable($session, 'users');
        my %users = %$usersRef;
        print encode_json(\%users);
    }
    print ']'; #}}}
} elsif ($mode == 1) { #{{{
    my $userID = $session->param('user_id');
    my $newPass = $q->param('p');
    if (not ($userID =~ /^[0-9]+$/)) {print 'badid'; exit;}
    elsif (not ($newPass =~ /^[0-9a-f]{128}$/)) {print 'baddata'; exit;}
    my @updateCols = ('pw');
    my @updateVals = ("'$newPass'");
    my @searchCols = ('id');
    my @searchOps = ('=');
    my @searchVals = ($userID);
    my @logic = ();
    my $rows = COMMON::updateTable($session, 'users', \@updateCols, \@updateVals, \@searchCols, \@searchOps, \@searchVals, \@logic);
    print 'none' if ($rows == 0);
    print 'success' if ($rows == 1);
    print 'extra' if ($rows > 1); #}}}
} elsif ($mode == 2) { #{{{
    my $theme = $q->param('theme');
    if (not ($theme =~ /^[0-9]$/)) {print 'baddata'; exit;}
    my @updateCols = ('theme');
    my @updateVals = ($theme);
    my @searchCols = ('id');
    my @searchOps = ('=');
    my @searchVals = ($session->param('user_id'));
    my @logic = ();
    my $rows = COMMON::updateTable($session, 'users', \@updateCols, \@updateVals, \@searchCols, \@searchOps, \@searchVals, \@logic);
    if ($rows >= 1) {$session->param('night_theme', $theme);}
    print 'success' if ($rows == 1);
    print 'none' if ($rows == 0);
    print 'extra' if ($rows > 1); #}}}
} elsif ($mode == 3) {
} elsif ($mode == 4) {
}
exit;
