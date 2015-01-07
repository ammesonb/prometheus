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
    `/var/www/prometheus/encfs/./fs.py m $v /data/$hn`;

    # Encrypt source file with master key and read properties
    my $encKey = $session->param('master_key');
    `mkdir /files/$sessionID-pln`;
    `mkdir /files/$sessionID`;
    `cd /files/$sessionID-pln/; split -b 20480 -a 10 -d "/data/$hn/$file" ""`;

    # Dismount container
    `/var/www/prometheus/encfs/./fs.py d $v`;

    my $numFiles = `count=0; for f in \`ls /files/$sessionID-pln/\`; do count=\$((count+1)); done; echo \$count`;
    chomp($numFiles);

    foreach(0..999) {
        $_ = "0" x (10 - length($_)) . $_;
        `openssl enc -a -aes-256-cbc -e -pass pass:"$encKey" -in /files/$sessionID-pln/$_ -out /files/$sessionID/$_`;
        `rm /files/$sessionID-pln/$_`;
    }
    system("/var/www/prometheus/./encrypt_chunk.pl \"$sessionID\" \"$encKey\" 0 &");
    system("/var/www/prometheus/./encrypt_chunk.pl \"$sessionID\" \"$encKey\" 1 &");
    system("/var/www/prometheus/./encrypt_chunk.pl \"$sessionID\" \"$encKey\" 2 &");

    # Calculate size
    my $size = `du -b "/files/$sessionID/0000000000" | egrep -o "[0-9]+" | head -1` * $numFiles;
    chomp($size);
    if ($size == 0) {print "nofile"; exit;}

    # Send session information and encryption key
    print `echo -n "$key" | openssl enc -a -aes-256-cbc -e -pass pass:"$encKey"`;
    print ";;;$sessionID;;;$size"; #}}}
} elsif ($state == 1) { #{{{
    # Read session parameters
    my $sessionID = $q->param('si');
    my $offset = $session->param("$sessionID-offset");
    my $file = "0" x (10 - length($offset)) . $offset;

    if (not -e "/files/$sessionID/$file") {
        print "<<#EOF#>>";
        exit;
    }
    my $data = `cat /files/$sessionID/$file`;
    chomp($data);
    print $data;
    $session->param("$sessionID-offset", $offset + 1);
    system("shred -u -n 5 /files/$sessionID/$file && rm /files/$sessionID/$file &"); #}}}
} elsif ($state == 2) { #{{{
    my $sessionID = $q->param('si');
    `rm -r /files/$sessionID`;
} #}}}
exit;
