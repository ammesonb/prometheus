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
if (COMMON::checkSession($session)) {
    $session->param('timed_out', 1);
    print 'noauth';
    exit;
}

if (not ($mode =~ /^[0-9]+$/)) {
    print 'Bad request!';
    exit;
}

if ($mode == 0) {
    my @returnCols = ('*');
    my @searchCols = ('user_id');
    my @searchOps = ('=');
    my @searchVals = ($session->param('user_id'));
    my @logic = ();
    my $projectsRef = COMMON::searchTableSort('projects', \@returnCols, \@searchCols, \@searchOps, \@searchVals, \@logic, 'id');
    my $tasksRef = COMMON::searchTableSort('tasks', \@returnCols, \@searchCols, \@searchOps, \@searchVals, \@logic, 'id');

    my @projects = @$projectsRef;
    my @tasks = @$tasksRef;
    my $count = 0;
    print '[[';
    foreach(@projects) {
        print encode_json($_);
        print ',' if ($count < $#projects);
        $count++;
    }
    print '], [';
    $count = 0;
    foreach(@tasks) {
        print encode_json($_);
        print ',' if ($count < $#tasks);
        $count++;
    }
    print ']]';
}
exit;
