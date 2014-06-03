#!/usr/bin/perl -w

use lib '/var/www/perl/';
use CGI;
use CGI::Carp qw(fatalsToBrowser);
use CGI::Session;
use DBI;
use DBD::Pg;
use COMMON;
use strict;

my $q = new CGI();
my $session = CGI::Session->new($q);
my $html = COMMON::init($session, "Prometheus");
print $html;
exit;

__END__

=head1 NAME #{{{

=pod

index.cgi - Landing page for web interface

=cut #}}}

=head1 DESCRIPTION #{{{

=pod

Provides authentication and tools panel

=cut #}}}

=head1 AUTHOR #{{{

=pod

Brett Ammeson C<ammesonb@gmail.com>

=cut #}}}
