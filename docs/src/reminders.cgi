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
} elsif ($mode == 1) {
} elsif ($mode == 2) {
}
exit;
