#!/usr/bin/perl -w

use lib '/var/www/perl/';
use CGI;
use CGI::Session;
use CGI::Carp qw(fatalsToBrowser);
use JSON;
use List::MoreUtils qw(first_index);
use COMMON;
use strict;

my $q = new CGI();
my $session = CGI::Session->new($q);

if (COMMON::checkFilePermissions($session, 1)) {print 'notmine'; exit;}

print "Content-type: text/plain\r\n\r\n";
my $mode = $q->param('mode');
if (COMMON::checkSession($session) && $mode != 1) { #{{{
    $session->param('timed_out', 1);
    print 'noauth';
    exit;
} #}}}

if ($mode !~ /^[0-2]$/) { #{{{
    print 'Bad request!';
    exit;
} #}}}

# Check note permissions #{{{
my $noteID;
if ($mode) {
    $noteID = $q->param('note_id');
    if ($noteID !~ /^-?[0-9]+$/) {
        print $noteID;
        print 'badid';
        exit;
    }

    if (COMMON::checkDataPermissions($session, 'notes', $noteID)) {print 'notmine'; exit;}
} #}}}

if ($mode == 0) { #{{{
    my $table = 'notes';
    my @returnCols = ('id', 'title', 'text', 'ctime', 'mtime');
    my @searchCols = ('user_id');
    my @operators = ('=');
    my @patterns = ($session->param('user_id'));
    my @logic = ();
    my $sort = 'title, mtime DESC';

    my $notesRef = COMMON::searchTableSort($session, $table, \@returnCols, \@searchCols, \@operators, \@patterns, \@logic, $sort);
    my @notes = @$notesRef;
    my $count = 0;
    print '[';
    foreach(@notes) {
        print encode_json($_);
        print ',' if ($count < ($#notes));
        $count++;
    }
    print ']'; #}}}
} elsif ($mode == 1) { #{{{
    # Check parameter validity #{{{
    my $noteTitle = $q->param('note_title');
    my $noteText = $q->param('note_text');

    # If ID is -1, create note instead of update #{{{
    if (($noteID cmp '-1') == 0) {
        if (not COMMON::checkPrintable($noteTitle)) {
            print 'baddata';
            exit;
        } elsif (not COMMON::checkPrintable($noteText)) {
            print 'baddata';
            exit;
        }
        $noteTitle =~ s/'/''/g;
        $noteText =~ s/'/''/g;
        my @columns = ('user_id', 'title', 'text');
        my @values = ($session->param('user_id'), "'$noteTitle'", "'$noteText'");
        my $rows = COMMON::insertIntoTable($session, 'notes', \@columns, \@values);
        print 'success' if ($rows == 1);
        print 'fail' if ($rows == 0);
        print 'extra' if ($rows > 1);
        exit;
    } #}}}

    if (not COMMON::checkPrintable($noteTitle)) { #{{{
        print 'baddata';
        exit; #}}}
    } elsif (not COMMON::checkPrintable($noteText)) { #{{{
        print 'baddata';
        exit;
    } #}}} #}}}

    # Update note #{{{
    $noteTitle =~ s/'/''/g;
    $noteText =~ s/'/''/g;
    my @updateCols = ('title', 'text');
    my @updateVals = ("'$noteTitle'", "'$noteText'");
    my @filterCols = ('id');
    my @filterOps = ('=');
    my @filterCriteria = ($noteID);
    my @filterLogic = ();
    # Should update exactly one row
    my $rows = COMMON::updateTable($session, 'notes', \@updateCols, \@updateVals,
               \@filterCols, \@filterOps, \@filterCriteria, \@filterLogic); #}}}

    print 'success' if ($rows == 1);
    print 'none' if ($rows == 0);
    print 'extra' if ($rows > 1); #}}} #}}}
} elsif ($mode == 2) { #{{{
        # Delete note
        my @deleteCols = ('id');
        my @deleteOps = ('=');
        my @deleteVals = ($noteID);
        my @deleteLogic = ();
        COMMON::deleteFromTable($session, 'notes', \@deleteCols, \@deleteOps, \@deleteVals, \@deleteLogic);
} #}}}

exit;

__END__

=head1 NAME #{{{

=pod

notes.cgi - backend for the notes application

=cut #}}}

=head1 DESCRIPTION #{{{

=pod

Provides the tools to view, create/update, and delete notes based on a variable 'mode' which takes value 0 to 2 respectively

=cut #}}}

=head1 AUTHOR #{{{

=pod

Brett Ammeson C<ammesonb@gmail.com>

=cut #}}}
