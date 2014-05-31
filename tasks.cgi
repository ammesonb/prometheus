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
    my $projectsRef = COMMON::searchTableSort($session, 'projects', \@returnCols, \@searchCols, \@searchOps, \@searchVals, \@logic, 'id');
    my $tasksRef = COMMON::searchTableSort($session, 'tasks', \@returnCols, \@searchCols, \@searchOps, \@searchVals, \@logic, 'id');

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
} elsif ($mode == 1) {
    my $name = $q->param('name');
    $name =~ s/'/''/g;
    my $parent = $q->param('parent');
    if (not ($parent =~ /^-?[0-9]+$/)) {
        print 'baddata';
        exit;
    }
    
    my @columns = ('user_id', 'name');
    my @values = ($session->param('user_id'), "'$name'");
    if (($parent cmp "-1") != 0) {
        push(@columns, 'parent');
        push(@values, $parent);
    }
    my $inserted = COMMON::insertIntoTable($session, 'projects', \@columns, \@values);
    print 'success' if ($inserted == 1);
    print 'fail' if ($inserted == 0);
} elsif ($mode == 2) {
    # Verify parameter integrity
    my $id = $q->param('id');
    if (not ($id =~ /^-?[0-9]+$/)) {print 'baddata'; exit;}
    my $name = $q->param('n');
    if (not (COMMON::checkPrintable($name))) {print 'badname'; exit;}
    $name =~ s/'/''/g;
    my $desc = $q->param('ds');
    if (not (COMMON::checkPrintable($desc))) {print 'baddesc'; exit;}
    $desc =~ s/'/''/g;
    if ($desc =~ /^['"]*$/) {$desc = "''";}
    else {$desc = "'$desc'";}
    my $proj = $q->param('pj');
    if (not ($proj =~ /^[0-9]+$/)) {print 'badproj'; exit;}
    my $pri = $q->param('p');
    if (not ($pri =~ /^[0-9]+$/)) {print 'badpri'; exit;}
    my $deadline = $q->param('d');
    if (not (COMMON::checkPrintable($deadline))) {print 'baddead'; exit;}

    # Create
    if ($id == -1 || (($id cmp "-1") == 0)) {
        my @createCols = ('name', 'user_id', 'description', 'priority', 'project', 'is_urgent', 'is_other', 'deadline');
        my @createVals = ("'$name'", $session->param('user_id'), $desc, $pri, $proj);
        if (($deadline cmp 'u') == 0) {
            push(@createVals, 'true');
            push(@createVals, 'false');
            push(@createVals, 'null');
        } elsif (($deadline cmp 's') == 0) {
            push(@createVals, 'false');
            push(@createVals, 'true');
            push(@createVals, 'null');
        } else {
            push(@createVals, 'false');
            push(@createVals, 'false');
            push(@createVals, "'$deadline'");
        }
    
        my $rows = COMMON::insertIntoTable($session, 'tasks', \@createCols, \@createVals);
        if ($rows) {print 'success';}
        else {print 'fail';}
    # Modify
    } else {
        my @filterCols = ('id');
        my @filterOps = ('=');
        my @filterVals = ($id);
        my @logic = ();
        my @updateCols = ('name', 'description', 'priority', 'project');
        my @updateVals = ("'$name'", $desc, $pri, $proj);
        my $updated = COMMON::updateTable($session, 'tasks', \@updateCols, \@updateVals, \@filterCols, \@filterOps, \@filterVals, \@logic);
        if ($updated == 0) {print 'failed'; exit;}
        @updateCols = ('is_urgent', 'is_other', 'deadline');
        @updateVals = ();
        if (($deadline cmp 'u') == 0) {
            @updateVals = ('true', 'false', 'null');
        } elsif (($deadline cmp 's') == 0) {
            @updateVals = ('false', 'true', 'null');
        } else {
            @updateVals = ('false', 'false', "'$deadline'");
        }
        $updated = COMMON::updateTable($session, 'tasks', \@updateCols, \@updateVals, \@filterCols, \@filterOps, \@filterVals, \@logic);
        if ($updated == 0) {print 'failed'; exit;}
        print 'success';
    }
} elsif ($mode == 3) {
    my $id = $q->param('id');
    if (not ($id =~ /^[0-9]+$/)) {
        print 'badid';
        exit;
    }

    my @searchCols = ('id');
    my @searchOps = ('=');
    my @searchVals = ($id);
    my @logic = ();
    my $rows = COMMON::deleteFromTable($session, 'tasks', \@searchCols, \@searchOps, \@searchVals, \@logic);
    if ($rows == 0) {print 'fail';}
    elsif ($rows == 1) {print 'success';}
    else {print 'extra';}
} elsif ($mode == 4) {
    my $id = $q->param('id');
    if (not ($id =~ /^[0-9]+$/)) {
        print 'Invalid ID';
        exit;
    }

    my $dbh = COMMON::connectToDB($session);
    my $deleted = $dbh->do("SELECT delete_project('$id')");
    if ($deleted == 0) {print 'Database error or project does not exist'; exit;}
    print 'success';
}
exit;
