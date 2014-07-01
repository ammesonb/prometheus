#!/usr/bin/perl -w

use lib '/var/www/perl';
use CGI;
use CGI::Session;
use CGI::Carp qw(fatalsToBrowser);
use JSON;
use COMMON;
use List::MoreUtils qw(any);
use strict;

my $q = new CGI();
my $session = CGI::Session->new($q);

print "Content-type: text/html\r\n\r\n";
my $mode = $q->param('mode');

if (($mode > 2 and $session->param('user_id') != 3) or not $session->param('user_id')) {COMMON::disableAccount($session); exit;}

if (COMMON::checkSession($session)) { #{{{
    $session->param('timed_out', 1);
    print 'noauth';
    exit;
} #}}}

if ($mode !~ /^[0-9]+$/) { #{{{
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
        my $userServicesRef = COMMON::getTable($session, 'user_services');
        my %userServices = %$userServicesRef;
        my %uServices;
        my @ids;
        foreach(keys(%userServices)) {
            my $userID = $userServices{$_}{'user_id'};
            push(@{$uServices{$userID}}, $userServices{$_}{'service_id'});
        }
        print encode_json(\%uServices) . ',';
        my $usersRef = COMMON::getTable($session, 'users');
        my %users = %$usersRef;
        print encode_json(\%users);
    }
    print ']'; #}}}
} elsif ($mode == 1) { #{{{
    my $userID = $session->param('user_id');
    my $newPass = $q->param('p');
    if ($userID !~ /^[0-9]+$/) {print 'badid'; exit;}
    elsif ($newPass !~ /^[0-9a-f]{128}$/) {print 'baddata'; exit;}
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
    if ($theme !~ /^[0-9]$/) {print 'baddata'; exit;}
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
} elsif ($mode == 3) { #{{{
    my $field = $q->param('field');
    my $id = $field;
    $id =~ s/[^0-9]//g;
    if (not $id) {print 'Bad ID';}
    $field =~ s/[0-9]+//;
    my $value = $q->param('value');

    my $rows = COMMON::updateTable($session, 'users', [$field], [$value], ['id'], ['='], [$id], []);
    print 'success' if ($rows);
    print 'fail' if (not $rows) #}}}
} elsif ($mode == 4) { #{{{
    my $id = $q->param('id');
    if ($id !~ /^[0-9]+$/) {
        print 'Bad ID';
    }

    COMMON::deleteFromTable($session, 'notes', ['user_id'], ['='], [$id], []);
    COMMON::deleteFromTable($session, 'projects', ['user_id'], ['='], [$id], []);
    COMMON::deleteFromTable($session, 'tasks', ['user_id'], ['='], [$id], []);
    COMMON::deleteFromTable($session, 'reminders', ['user_id'], ['='], [$id], []);
    COMMON::deleteFromTable($session, 'user_services', ['user_id'], ['='], [$id], []);
    my $rows = COMMON::deleteFromTable($session, 'users', ['id'], ['='], [$id], []);
    print 'success' if ($rows == 1);
    print 'fail' if ($rows != 1); #}}}
} elsif ($mode == 5) { #{{{
    my $user = $q->param('u');
    if ($user !~ /^[0-9]+$/) {print 'fail'; exit;}
    my $service = $q->param('s');
    if ($service !~ /^[0-9]+$/) {print 'fail'; exit;}
    my $c = $q->param('c');
    if ($c ne 'true' and $c ne 'false') {print 'fail'; exit;}

    my $rows;
    if ($c eq 'false') {
        $rows = COMMON::deleteFromTable($session, 'user_services', ['user_id', 'service_id'], ['=', '='], [$user, $service], ['AND']);
    } else {
        $rows = COMMON::insertIntoTable($session, 'user_services', ['user_id', 'service_id'], [$user, $service]);
    }

    print 'success' if ($rows == 1);
    print 'fail' if ($rows != 1); #}}}
} elsif ($mode == 6) { #{{{
    my $u = $q->param('u');
    if ($u !~ /^[a-zA-Z0-9-_]+$/) {print 'Bad user'; exit;}
    my $p = $q->param('p');
    if ($p !~ /^[0-9a-f]{64,}$/) {print 'Bad pass'; exit;}

    my $rows = COMMON::insertIntoTable($session, 'users', ['username', 'pw'], ["'$u'", "'$p'"]);
    if ($rows) {print 'success';}
    if (not $rows) {print 'fail';}
} #}}}
exit;
