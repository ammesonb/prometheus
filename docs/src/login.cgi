#!/usr/bin/perl -w

use lib '/var/www/perl';
use CGI;
use CGI::Session;
use CGI::Carp qw(fatalsToBrowser);
use COMMON;
use strict;

my %titles = (
    0 => "Prometheus",
    1 => "Login",
    2 => "Login",
    3 => "Blocked"
);

my $q = new CGI();
my $session = CGI::Session->new($q);
my $response = COMMON::attempt_login($q->param('a'), $q->param('c'));

# Get user data
my @returnCols = ('id');
my @searchCols = ('username');
my @operators = ('=');
my @patterns = ("'" . $q->param('a') . "'");
my @logic = ();
my $userRef = COMMON::searchTable('users', \@returnCols, \@searchCols, \@operators,\@patterns, \@logic);
my %userData = %$userRef;
my @userIDs = keys %userData;
my $userID = $userIDs[0];

# Set session parameters
$session->param('attempt_login', 1);
$session->expire('attempt_login', '+30m');
$session->param('user', $q->param("a"));
$session->expire('user', '+30m');
$session->param('user_id', $userID);
$session->expire('user_id', '+30m');
$session->param('logged_in', 0);
$session->expire('logged_in', '+30m');
$session->param('blocked', 0);
$session->expire('blocked', '+30m');
$session->param('logged_in', 1) if ($response == 0);
$session->param('blocked', 1) if ($response == 3);
if ($response == 0) {
    print $q->redirect("/");
}
my $html = COMMON::init($session, $titles{$response});
print $html;
exit;

__END__

=head1 NAME

=pod

login.cgi - Authentication backend

=cut

=head1 DESCRIPTION

=pod

Check login validity and display appropriate information

Redirects to root if login is successful

=cut

=head1 AUTHOR

=pod

Brett Ammeson C<ammesonb@gmail.com>

=cut
