#!/usr/bin/perl -w

use lib 'perl/';
use CGI;
use CGI::Session;
use CGI::Carp qw(fatalsToBrowser);
use Crypt::OpenSSL::Random qw(random_seed random_bytes);
use Time::HiRes qw(gettimeofday);
use MIME::Base64;
use JSON;
use COMMON;
use strict;

my $q = new CGI();
my $session = CGI::Session->new($q);

my $state = $q->param('s');
if ($state !~ /^[0-9]+$/) {print 'badstate'; exit;}

print "Content-type: text/plain\r\n\r\n";
if ($state == 0) { #{{{
    # Create session key
    my $time = gettimeofday();
    while (not random_seed($time)) {$time = gettimeofday();}
    my $key = encode_base64(random_bytes(32));
    chomp($key);
    my $file = $q->param('f');
    my $kind = $q->param('k');
    my $v = substr($kind, 0, 1) . substr($file, 0, 1);
    my $m = $v . "_m";
    my $hn = `echo -n "$m" | sha256sum | awk -F ' ' '{printf \$1}'`;
    
    # Set session variables for file
    my $sessionID = `echo -n "$key" | sha512sum | tr ' ' '\n' | head -1 | perl -pe 'chomp'`;
    $session->param("$sessionID-key", $key);
    $session->param("$sessionID-offset", 0);

    # Mount source file container
    `/var/www/encfs/./fs.py m $v /data/$hn`;

    # Encrypt source file with master key and read properties
    my $encKey = $session->param('master_key');
    `openssl enc -a -aes-256-cbc -e -pass pass:"$encKey" -in "/data/$hn/$file" -out /files/$sessionID`;
    my $size = `stat -c %s "/files/$sessionID"`;
    chomp($size);
    if ($size == 0) {print "nofile"; exit;}

    # Dismount container
    `/var/www/encfs/./fs.py d $v`;

    # Send session information and encryption key
    print `echo -n "$key" | openssl enc -a -aes-256-cbc -e -pass pass:"$encKey"`;
    print ";;;$sessionID;;;$size"; #}}}
} elsif ($state == 1) { #{{{
    # Read session parameters
    my $sessionID = $q->param('si');
    my $res = int($q->param('r'));
    if (not $res or 0 > $res) {print 'badres';}
    my $encKey = $session->param('master_key');
    my $offset = $session->param("$sessionID-offset");
    my $key = $session->param("$sessionID-key");

    # Decrypt file and re-encrypt proper chunk for sending
    my $data = `openssl enc -a -aes-256-cbc -d -pass pass:"$encKey" -in /files/$sessionID`;
    open(FILE, ">/tmp/$sessionID");
    print FILE substr($data, $offset, $res);
    close(FILE);
    `echo -n "<<#EOF#>>" >> /tmp/$sessionID` if (($offset + $res) > length($data));
    my $new = `openssl enc -a -aes-256-cbc -e -pass pass:"$key" -in /tmp/$sessionID`;
    `shred -u -n 5 /tmp/$sessionID`;
    print $new;
    $session->param("$sessionID-offset", $session->param("$sessionID-offset") + $res) #}}}
} elsif ($state == 2) { #{{{
    my $sessionID = $q->param('si');
    `rm /files/$sessionID`;
} #}}}
exit;
