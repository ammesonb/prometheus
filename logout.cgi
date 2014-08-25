#!/usr/bin/perl -w

use lib 'perl/';
use CGI;
use CGI::Session;
use CGI::Carp qw(fatalsToBrowser);
use COMMON;
use strict;

my $q = new CGI();
my $session = CGI::Session->new($q);
$session->param("logged_in", 0);
$session->param("attempt_login", 0);
$session->param('timed_out', 0);
$session->param('night_theme', 0);
$session->param('blocked', 0);
$session->param('disabled', 0);
print $q->redirect("/");
exit;

__END__

=head1 NAME */ #{{{

=pod

logout.cgi - Logs out

=cut #}}}

=head1 DESCRIPTION */ #{{{

=pod

Clears critical session parameters and redirects to root

=cut #}}}

=head1 AUTHOR */ #{{{

=pod

Brett Ammeson C<ammesonb@gmail.com>

=cut #}}}
