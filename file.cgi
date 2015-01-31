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
        `openssl enc -a -A -e -aes-256-cbc -pass pass:"$key" -in /files/$sessionID-pln/$_ -out /files/$sessionID/$_`;
        `rm /files/$sessionID-pln/$_`;
    }
    system("/var/www/prometheus/./encrypt_chunk.pl \"$sessionID\" \"$key\" 0 &");
    system("/var/www/prometheus/./encrypt_chunk.pl \"$sessionID\" \"$key\" 1 &");
    system("/var/www/prometheus/./encrypt_chunk.pl \"$sessionID\" \"$key\" 2 &");

    # Calculate size
    my $size = `du -b "/files/$sessionID/0000000000" | egrep -o "[0-9]+" | head -1` * $numFiles;
    chomp($size);
    if ($size == 0) {print "nofile"; exit;}

    # Send session information and encryption key
    print `echo -n "$key" | openssl enc -a -A -e -aes-256-cbc -pass pass:"$encKey"`;
    system("echo \"$key\" > /tmp/tmp");
    print ";;;$sessionID;;;$size"; #}}}
} elsif ($state == 1) { #{{{
    # Read session parameters
    my $sessionID = $q->param('si');
    my $res = $q->param('res');
    my $offset = $session->param("$sessionID-offset");
    my $end = $offset + $res; 
    $end -= 1;
    
    my $file = "0" x (10 - length($end)) . $end;
    if (not -e "/files/$sessionID/$file") {
        foreach($offset..$end) {
            my $file = "0" x (10 - length($_)) . $_;
            if (not -e "/files/$sessionID/$file") {
                if ($_ eq $offset) {print "<<#EOF#>>";}
                last;
            }
            print `echo -n "\$(cat /files/$sessionID/$file)"`;
            print ':';
        }
    } else {
        foreach($offset..$end) {
            my $file = "0" x (10 - length($_)) . $_;
            print `echo -n "\$(cat /files/$sessionID/$file)"`;
            print ':';
        }
    }
    $session->param("$sessionID-offset", $end + 1); #}}}
} elsif ($state == 2) { #{{{
    my $sessionID = $q->param('si');
    `shred -u -n 5 /files/$sessionID/*`;
    `rm -r /files/$sessionID`;
} #}}}
exit;
