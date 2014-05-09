#!/usr/bin/perl -w

use lib '/var/www/perl/';
use CGI;
use CGI::Session;
use CGI::Carp qw(fatalsToBrowser);
use JSON;
use COMMON;
use strict;

my $q = new CGI();
my $session = CGI::Session->new($q);

my $mode = $q->param('mode');
print "Content-type: text/plain\r\n\r\n";
if (COMMON::checkSession($session) && $mode != 1) {
    $session->param('timed_out', 1);
    print "noauth";
    exit;
}

if (not ($mode =~ /^[0-9]$/)) {
    print "Bad request!";
    exit;
}

if ($mode == 0) {
    my $table = 'notes';
    my @returnCols = ('id', 'title', 'text', 'ctime', 'mtime');
    my @searchCols = ('user_id');
    my @operators = ('=');
    my @patterns = ($session->param('user_id'));
    my @logic = ();
    my $sort = "title, mtime DESC";

    my $notesRef = COMMON::searchTableSort($table, \@returnCols, \@searchCols, \@operators, \@patterns, \@logic, $sort);
    my @notes = @$notesRef;
    my $count = 0;
    print '[';
    foreach(@notes) {
        print encode_json($_);
        print ',' if ($count < ($#notes));
        $count++;
    }
    print ']';
} elsif ($mode == 1) {
    if (COMMON::checkSession($session)) {
        $session->param('timed_out', 1);
        print 'expired';
        exit;
    }

    # Check parameter validity
    my $noteID = $q->param('note_id');
    my $noteTitle = $q->param('note_title');
    my $noteText = $q->param('note_text');
    if (not ($noteID =~ /^[0-9]\+$/)) {
        print 'baddata';
        exit;
    } elsif (not COMMON::checkPrintable($noteTitle)) {
        print 'baddata';
        exit;
    } elsif (not COMMON::checkPrintable($noteText)) {
        print 'baddata';
        exit;
    }

    my @updateCols = ('title', 'text');
    my @updateVals = ($noteTitle, $noteText);
    my @filterCols = ('id');
    my @filterOps = ('=');
    my @filterCriteria = ($noteID);
    my @filterLogic = ();
    # Should update exactly one row
    my $rows = COMMON::updateTable('notes', \@updateCols, \@updateVals,
               \@filterCols, \@filterOps, \@filterCriteria, \@filterLogic);

    print 'success' if ($rows == 1);
    print 'none' if ($rows == 0);
    print 'extra' if ($rows > 1);
}

exit;

__END__

=head1 NAME

=pod

notes.cgi - backend for the notes application

=cut

=head1 DESCRIPTION

=pod

Provides the tools to view, create/update, and delete notes based on a variable 'mode' which takes value 0 to 2 respectively

=cut

=head1 AUTHOR

=pod

Brett Ammeson C<ammesonb@gmail.com>

=cut
