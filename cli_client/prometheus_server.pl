#!/usr/bin/perl

use DBI;
use DBD::Pg;
use IO::Socket::INET;
use List::MoreUtils qw(any none);
 
my $sep = '#__#';
my $sleep_delay = .1;
my $port = 35793;
my $dest_port = 35792;

use warnings;
use strict;

my $dbh = DBI->connect("DBI:Pg:dbname=prometheus", "root");

sub fetch_all { #{{{
    my $table = shift;
    my $stmt = $dbh->prepare("SELECT * FROM $table");
    $stmt->execute();
    return $stmt->fetchall_hashref(['id']);
} #}}}

# Build virtual media database #{{{
my (%movies, %m_genres, %tv, %t_genres, %genres, %series);
%genres = %{fetch_all('genres')};
%movies = %{fetch_all('movies')};
%m_genres = %{fetch_all('movies_genre')};
%tv = %{fetch_all('tv')};
%t_genres = %{fetch_all('tv_genre')};
%series = %{fetch_all('series')};
foreach(keys %m_genres) { #{{{
    my %data = %{$m_genres{$_}};
    my %movie = %{$movies{$data{'movie'}}};
    if (none {$_ eq 'genre'} keys(%movie)) {
        $movie{'genre'} = $genres{$data{'genre'}};
    } else {
        $movie{'genre'} .= ", $genres{$data{'genre'}}";
    }
} #}}}
foreach(keys %t_genres) { #{{{
    my %data = %{$t_genres{$_}};
    my %show = %{$tv{$data{'episode'}}};
    if (none {$_ eq 'genre'} keys(%show)) {
        $show{'genre'} = $genres{$data{'genre'}};
    } else {
        $show{'genre'} .= ", $genres{$data{'genre'}}";
    }
} #}}}
my %folders = ('TV' => {}, 'Movies' => {'Other' => 'IS NULL'});
foreach(keys %series) { #{{{
    my $stmt = $dbh->prepare("SELECT EXISTS(SELECT * FROM movies WHERE series=$_)");
    $stmt->execute();
    my $data = $stmt->fetchrow_arrayref();
    my $exists = @{$data}[0];
    my %h = ($series{$_}{'name'} => "= $_");
    if ($exists) {$folders{'Movies'}{$series{$_}{'name'}} = "= $_";}
    else {$folders{'TV'}{$series{$_}{'name'}} = "= $_";}
} #}}} #}}}

# Set up sockets and get IP #{{{
my $accept_sock = IO::Socket::INET->new(LocalPort=>$port,Proto=>'tcp',Listen=>5,Reuse=>1) or die "Accept socket: $!";
my $b_cast_recv_sock = IO::Socket::INET->new(LocalPort=>$port,Proto=>'udp') or die "Recv socket: $!";
my $b_cast_send_sock = IO::Socket::INET->new(PeerPort=>$dest_port,PeerAddr=>inet_ntoa(INADDR_BROADCAST),Proto=>'udp',LocalAddr=>'localhost',Broadcast=>1,Reuse=>1) or die "Send socket: $!";
my $dev = "wlan0";
my $ip = `ip addr show dev $dev | egrep -o "inet [0-9.]*/[0-9]* brd" | egrep -o " [0-9.]+" | cut -b 2-`; #}}}

sub search_media { #{{{
    my $term = lc shift;
    my $return_title = shift;

    my @results;
    # Get movie results #{{{
    my $mStmt = $dbh->prepare("SELECT * FROM movies LEFT OUTER JOIN series on movies.series = series.id WHERE LOWER(title) LIKE '%$term%' OR LOWER(description) like '%$term%' OR LOWER(name) like '%$term%';");
    $mStmt->execute();
    my $hash = $mStmt->fetchall_hashref(['id']);
    my %hash = %$hash;
    foreach(keys %hash) {
        if ($return_title) {
            my $name = $hash{$_}{'title'};
            if ($hash{$_}{series} and $hash{$_}{series} =~ /[0-9]/) {
                $name = "$series{$hash{$_}{'series'}}{'name'} - $name";
            }
            push(@results, $name);
        } else {
            push(@results, $hash{$_});
        }
    } #}}}
    # Get TV results #{{{
    my $tStmt = $dbh->prepare("SELECT * FROM tv LEFT OUTER JOIN series on tv.series = series.id WHERE LOWER(title) LIKE '%$term%' OR LOWER(description) like '%$term%' OR LOWER(name) like '%$term%';");
    $tStmt->execute();
    $hash = $tStmt->fetchall_hashref(['id']);
    %hash = %$hash;
    foreach(keys %hash) {
        if ($return_title) {
            my $name = $hash{$_}{'title'};
            if ($hash{$_}{series} =~ /[0-9]/) {
                $name = "$series{$hash{$_}{'series'}}{'name'} - $name";
            }
            push(@results, $name);
        } else {
            push(@results, $hash{$_});
        }
    } #}}}
    return \@results;
} #}}}

sub handle_commands { #{{{
    my $sock = shift;
    my $folder = '';
    while (1) {
        my $cmd = '';
        $sock->recv($cmd, 999);
        if ($cmd =~ /^cd/) { #{{{
            $cmd =~ s/^cd$sep//;
            if ($cmd =~ /\.\.\/?/) {
                $folder =~ s/\/?[^\/]*$//;
                $sock->send('ok');
            } elsif (($folder eq '' and none {$_ eq $cmd} keys(%folders)) or
                     ($folder ne '' and none {$_ eq $cmd} keys(%{$folders{$folder}}))) {
                $sock->send('nf');
            } else {
                if ($folder eq '') {$folder = $cmd;}
                else {$folder .= "/$cmd";}
                $sock->send('ok');
            } #}}}
        # Needs to accept folder argument
        } elsif ($cmd =~ /^ls/) { #{{{
            $cmd =~ s/^ls$sep//;
            if ($folder eq '') {
                $sock->send(join(";", keys(%folders)));
            } else {
                my @dirs = split(/\//, $folder);
                my $path = "\$folders";
                foreach(@dirs) {$path .= "{$_}";}
                my %contents = %{eval($path)};
                $sock->send(join(';', keys(%contents)));
            } #}}}
        } elsif ($cmd =~ /^search/) { #{{{
            $cmd =~ s/^search$sep//;
            my @results = @{search_media($cmd, 1)};
            if ($#results > -1) {
                $sock->send(join(';', @results));
            } else {
                $sock->send('No results');
            } #}}}
        } elsif ($cmd =~ /^info/) {
            $cmd =~ s/^info$sep//;
            my @results = @{search_media($cmd, 0)};
            if ($#results == -1) {
                $sock->send('nf');
            } elsif ($#results != 0) {
                my @names =
                    map { my %tmp = %$_;
                          defined $tmp{'series'} ?
                            "$series{$tmp{series}}{name} - $tmp{title}" :
                            $tmp{title}
                        } @results;
                $sock->send("choice$sep" . join(';', @names));
                my $choice = '';
                $sock->recv($choice, 999);
                @results = ($results[$choice]);
            }

            if ($#results != -1) {
                my %data = %{$results[0]};
                my $fs = 0;
                if (defined $data{size}) {
                    $fs = $data{size} / 1024 / 1024;
                }
                my @parts = 
                    ("Title: $data{title}", "IMDb link: https://imdb.com/title/tt$data{ttid}/",
                    "Year: $data{year}", "Released on: $data{released}", "Duration: $data{duration} minutes",
                    "File size: $fs MB"
                    );
                if ($data{director}) {push(@parts, "Directed by $data{director}");}
    
                if (any {$_ eq 'episode'} keys(%data)) {
                    splice(@parts, 2, 0, "Season $data{season}, episode $data{episode}");
                }
                my $text = join(';;;', @parts);
                $sock->send($text);
            }
        }
        sleep $sleep_delay;
    }
} #}}}

my $f = fork;
if (not defined $f) {print "Failed to fork\n"; exit 1;}
# Accept and verify incoming connections #{{{
if ($f == 0) {
    while (1) {
        my $client = $accept_sock->accept();
        my $data = '';
        $client->recv($data, 999);
        chomp $data;
        if ($data =~ /^auth/) { #{{{
            my @data = split(/$sep/, $data);
            my $stmt = $dbh->prepare("SELECT EXISTS(SELECT * FROM USERS WHERE user='$data[1]' AND pw='$data[2]')");
            $stmt->execute();
            my $data_ref = $stmt->fetchrow_arrayref();
            my $exists = @{$data_ref}[0];
            $client->send($exists);
            while (not $exists) { #{{{
                $data = '';
                $client->recv($data, 999);
                chomp $data;
                @data = split(/$sep/, $data);
                $stmt = $dbh->prepare("SELECT EXISTS(SELECT * FROM USERS WHERE user='$data[1]' AND pw='$data[2]')");
                $stmt->execute();
                $data_ref = $stmt->fetchrow_arrayref();
                $exists = @{$data_ref}[0];
                $client->send($exists);
                sleep $sleep_delay;
            } #}}}
            my $f = fork;
            if (not defined $f) {print "Failed to fork\n"; exit;}
            if ($f == 0) {handle_commands($client);}
        } #}}}
        sleep $sleep_delay;
    } #}}}
# Handle broadcast send/recv #{{{
} else {
    while (1) {
        my $text = '';
        $b_cast_recv_sock->recv($text, 999);
        if ($text eq 'prom_web_q') {
            if (not $b_cast_send_sock->send("prom_web_r#$ip")) {
                print "Failed to send broadcast response\n";
            }
        }
        sleep $sleep_delay;
    }
} #}}}
