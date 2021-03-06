#!/usr/bin/perl -w

use lib 'perl/';
use CGI;
use CGI::Session;
use CGI::Carp qw(fatalsToBrowser);
use Time::HiRes qw(gettimeofday);
use Crypt::OpenSSL::Random qw(random_seed random_bytes);
use MIME::Base64;
use COMMON;
use strict;

my $EXPIRATION = "+30m";

my %titles = ( #{{{
    0 => "Prometheus",
    1 => "Login",
    2 => "Login",
    3 => "Blocked",
    4 => "Disabled"
); #}}}

my $q = new CGI();
my $session = CGI::Session->new($q);

if (index($q->param('a'), "'", ) != -1) { #{{{
    $session->param('attempt_login', 1);
    $session->expire('attempt_login', $EXPIRATION);
    $session->param('logged_in', 0);
    $session->expire('logged_in', $EXPIRATION);
    my $html = COMMON::init($session, 1);
    print $html;
    exit;
} #}}}

# Get user data #{{{
my @returnCols = ('id', 'is_shared', 'is_admin', 'theme', 'salt', 'domain');
my @searchCols = ('username');
my @operators = ('=');
my @patterns = ("'" . $q->param('a') . "'");
my @logic = ();
$session->param('attempt_login', 1);
$session->expire('attempt_login', $EXPIRATION);
my $userRef = COMMON::searchTable($session, 'users', \@returnCols, \@searchCols, \@operators,\@patterns, \@logic);
my %userData = %$userRef;
my @userIDs = keys %userData;
if ($#userIDs < 0) {print $q->redirect('/'); exit;}
my $userID = $userIDs[0]; #}}}

my $response = COMMON::attempt_login($session, scalar $q->param('a'), scalar $q->param('c'), $userData{$userID}{'salt'}, $userData{$userID}{'domain'});

# Create session AES key #{{{
if ($session->param('master_key') =~ /[\s]*/) {
    my $time = gettimeofday();
    while (not random_seed($time)) {$time = gettimeofday();}
    my $key = encode_base64(random_bytes(32));
    chomp($key);
    $session->param('master_key', $key);
} #}}}

# Set session parameters #{{{
$session->param('night_theme', $userData{$userID}{'theme'});
$session->expire('night_theme', $EXPIRATION);
$session->param('user', scalar $q->param("a"));
$session->expire('user', $EXPIRATION);
$session->param('user_id', $userID);
$session->expire('user_id', $EXPIRATION);
$session->param('logged_in', 0);
$session->expire('logged_in', $EXPIRATION);
$session->param('timezone', scalar $q->param('t'));
$session->param('blocked', 0);
$session->expire('blocked', $EXPIRATION);
$session->param('is_admin', $userData{$userID}{'is_admin'});
$session->expire('is_admin', $EXPIRATION);
$session->param('is_shared', $userData{$userID}{'is_shared'});
$session->expire('is_shared', $EXPIRATION);
$session->param('domain', $userData{$userID}{'domain'});
$session->expire('domain', $EXPIRATION);
$session->param('logged_in', 1) if ($response == 0);
print $q->redirect('/') if ($response == 0);
$session->param('blocked', 1) if ($response == 3);
$session->param('disabled', 1) if ($response == 4);
$session->param('disabled', 0) if ($response != 4);
$session->expire('disabled', $EXPIRATION); #}}}

my $html = COMMON::init($session, $titles{$response});
print $html;
exit;

__END__

=head1 NAME #{{{

=pod

login.cgi - Authentication backend

=cut #}}}

=head1 DESCRIPTION #{{{

=pod

Check login validity and display appropriate information

Redirects to root if login is successful

=cut #}}}

=head1 AUTHOR #{{{

=pod

Brett Ammeson C<ammesonb@gmail.com>

=cut #}}}
