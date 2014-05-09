#!/usr/bin/perl -w

use lib '/var/www/perl/';
use CGI;
use CGI::Session;
use CGI::Carp qw(fatalsToBrowser);
use COMMON;
use strict;

my $q = new CGI();
my $session = CGI::Session->new($q);
$session->param("logged_in", 0);
$session->param("attempt_login", 0);
print $q->redirect("/");
exit;

__END__

=head1 NAME

=cut

=pod

logout.cgi - Logs out

=cut

=head1 DESCRIPTION

=cut

=pod

Clears critical session parameters and redirects to root

=cut

=head1 AUTHOR

=cut

=pod

Brett Ammeson C<ammesonb@gmail.com>

=cut
