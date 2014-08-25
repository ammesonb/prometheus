#!/usr/bin/perl -w

use lib 'perl/';
use CGI;
use CGI::Session;
use CGI::Carp qw(fatalsToBrowser);
use JSON;
use COMMON;
use strict;

my $q = new CGI();
my $session = CGI::Session->new($q);

if (COMMON::checkFilePermissions($session, 9)) {print 'notmine'; exit;}

print "Content-type: text/html\r\n\r\n";
my $mode = $q->param('mode');
if (COMMON::checkSession($session)) {
    $session->param('timed_out', 1);
    print 'noauth';
    exit;
}

if ($mode !~ /^[0-9]+$/) {
    print 'Bad request!';
    exit;
}

# Check data permissions #{{{
my $id;
if (0 < $mode and $mode < 3) {
    $id = $q->param('id');
    if ($id !~ /^-?[0-9]+$/) {print 'Bad id'; exit;}
    if (COMMON::checkDataPermissions($session, 'reminders', $id)) {print 'notmine'; exit;}
} #}}}

if ($mode == 0) { #{{{
    my $remindersRef = COMMON::searchTableSort($session, 'reminders', ['*'], ['user_id'], ['='], [$session->param('user_id')], [], 'message');
    my @reminders = @$remindersRef;

    print '[';
    my $count = 0;
    foreach(@reminders) {
        print encode_json($_);
        print ', ' if ($count < $#reminders);
        $count++;
    }
    print ']'; #}}}
} elsif ($mode == 1) { #{{{
    my $type = $q->param('type');
    my ($recipient, $subject);
    if ($type eq 'e') { #{{{
        $recipient = $q->param('recipient');
        if ($recipient =~ /,/) {
            if ($recipient !~ /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,4}(, *[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,4})*$/i) {
                print 'Invalid email';
                exit;
            }
        } else {
            if ($recipient !~ /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,4}$/i) {
                print 'Invalid email';
                exit;
            }
        }

        $subject = $q->param('subject');
        if (not COMMON::checkPrintable($subject)) {print 'Invalid subject'; exit;} #}}}
    } elsif ($type eq 's') { #{{{
        $recipient = $q->param('recipient');
        if ($recipient !~ /^[A-Za-z ]+(, *[A-Za-z ])*$/) {
            print 'Invalid recipients';
        }
    } #}}}

    my $message = $q->param('message');
    if (not COMMON::checkPrintable($message)) {print 'Invalid message'; exit;}
    if ($type eq 's' and length($message) == 0) {print 'Message cannot be empty'; exit;}

    my $first = $q->param('first');
    if (not COMMON::checkPrintable($first)) {print 'Invalid start time'; exit;}

    my $repeat = $q->param('repeat');
    if (not COMMON::checkPrintable($repeat)) {print 'Invalid repetition'; exit;}

    my $duration = $q->param('duration');
    if (not COMMON::checkPrintable($duration)) {print 'Invalid duration'; exit;}

    my @cols = ('user_id', 'type', 'recipient', 'message', 'next', 'first', 'repeat', 'duration');
    my @vals = ($session->param('user_id'), "'$type'", "'$recipient'", "'$message'", "'$first'", "'$first'", "'$repeat'", "'$duration'");
    if ($type eq 'e') {
        push(@cols, 'subject');
        push(@vals, "'$recipient'");
        push(@vals, "'$subject'");
    }
    my $rows;
    if ($id eq '-1' or $id == -1) {
        $rows = COMMON::insertIntoTable($session, 'reminders', \@cols, \@vals);
        my $idRef = COMMON::searchTable($session, 'reminders', ['id'],
          ['type', 'message', 'first', 'repeat', 'duration', 'user_id'], ['=', '=', '=', '=', '=', '='],
          ["'$type'", "'$message'", "'$first'", "'$repeat'", "'$duration'", $session->param('user_id')], ['AND', 'AND', 'AND', 'AND', 'AND']);
        my %ids = %$idRef;
        my @ids = keys(%ids);
        $id = $ids[0];
        if ($rows) {
            `sudo update_reminder c $id`;
        }
    } else {
        $rows = COMMON::updateTable($session, 'reminders', \@cols, \@vals, ['id'], ['='], [$id], []);
        if ($rows) {
            `sudo update_reminder u $id`;
        }
    }

    print "$id-success" if ($rows);
    print 'fail' if (not $rows); #}}}
} elsif ($mode == 2) { #{{{
    `sudo update_reminder d $id`;
    my $rows = COMMON::deleteFromTable($session, 'reminders', ['id'], ['='], [$id], []);
    print 'success' if ($rows);
    print 'fail' if (not $rows); #}}}
} elsif ($mode == 3) { #{{{
    my $smsContactsRef = COMMON::searchTable($session, 'sms', ['id', 'name'], [], [], [], []);
    my %smsContacts = %$smsContactsRef;
    my @keys = keys(%smsContacts);

    my @contacts;
    foreach(@keys) {
        push(@contacts, $smsContacts{$_}{'name'});
    }
    print encode_json(\@contacts);
} #}}}
exit;
