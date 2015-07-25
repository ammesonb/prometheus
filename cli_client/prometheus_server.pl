#!/usr/bin/perl

use DBI;
use DBD::Pg;
use IO::Socket::INET;
use List::MoreUtils qw(any none);
 
my $sep = '#__#';
my $sleep_delay = .1;
my $port = 35794;
my $dest_port = 35792;

use warnings;
use strict;

my $dbh = DBI->connect("DBI:Pg:dbname=prometheus", "root");

sub fetch_all { #{{{
    my $table = shift;
    my $index = shift;
    my $stmt = $dbh->prepare("SELECT * FROM $table");
    $stmt->execute();
    if (not defined $index) {
        return $stmt->fetchall_hashref(['id']);
    } else {
        return $stmt->fetchall_hashref([$index]);
    }
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
my $dev = "eth1";
my $ip = `ip addr show dev $dev | egrep -o "inet [0-9.]*/[0-9]* brd" | egrep -o " [0-9.]+" | cut -b 2-`;
my $accept_sock = IO::Socket::INET->new(LocalPort=>$port,Proto=>'tcp',Listen=>5,Reuse=>1) or die "Accept socket: $!";
my $b_cast_recv_sock = IO::Socket::INET->new(LocalPort=>$port,Proto=>'udp') or die "Recv socket: $!";
my $b_cast_send_sock = IO::Socket::INET->new(PeerPort=>$dest_port,PeerAddr=>'255.255.255.255',Proto=>'udp',LocalAddr=>$ip,Broadcast=>1,Reuse=>1) or die "Send socket: $!";
$b_cast_send_sock->sockopt(SO_BROADCAST, 1); #}}}

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

sub single_select { #{{{
    my $sock = shift;
    my $results = shift;
    my @results = @$results;

    if ($#results == -1) {
        $sock->send('nf');
        return undef;
    } elsif ($#results != 0) {
        my @names = @results;
        if (ref($results[0]) eq 'HASH') {
            @names =
                map { my %tmp = %$_;
                      defined $tmp{'series'} ?
                      "$series{$tmp{series}}{name} - $tmp{title}" :
                      $tmp{title}
                    } @results;
        }
        $sock->send("choice$sep" . join(';', @names));
        my $choice = '';
        $sock->recv($choice, 999);
        @results = ($choice);
    } else {
        return $results[0];
    }
    @results = @{search_media($results[0], 0)};
} #}}}

sub prepare_file { #{{{
    my $result = shift;
    my %result = %$result;
    my $kind = 'm';
    if (any {$_ eq 'episode'} keys(%result)) {$kind = 't';}
    my $file = $result{file};
    $file =~ s/^[0-9\.\- ]*//;
    my $v = $kind . substr($file, 0, 1);
    my $m = $v . '_m';
    my $hn = `echo -n "$m" | sha256sum | awk -F ' ' '{printf \$1}'`;
    my $cs = '-1';
    if (-e "/prom_cli/$result{file}") {
        $cs = `sha512sum "/prom_cli/$result{file}" | awk -F ' ' '{print \$1}'`;
        chomp $cs;
    }
    if (defined $result{checksum} and $cs ne $result{checksum}) {
        `../encfs/./fs.py m $v /data/$hn`;
        `rsync --partial -achvtr "/data/$hn/$result{file}" /prom_cli/`;
        `../encfs/./fs.py d $v`;
        `sync`;
        `chmod 755 "/prom_cli/$result{file}"`;
    }
} #}}}

sub handle_commands { #{{{
    my $sock = shift;
    my $folder = '';
    while (1) {
        my $cmd = '';
        $sock->recv($cmd, 999);
        chomp $cmd;
        if ($cmd !~ /^rm$sep/) {$cmd = lc $cmd;}
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
        } elsif ($cmd =~ /^info/) { #{{{
            $cmd =~ s/^info$sep//;
            my @results = @{search_media($cmd, 0)};
            my $result = single_select($sock, \@results);
            if (not defined $result) {next;}

            my %data = %$result;
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
            $sock->send($text); #}}}
        } elsif ($cmd =~ /^get$sep/) { #{{{
            $cmd =~ s/^get$sep//;
            my @results = @{search_media($cmd, 0)};
            my $result = single_select($sock, \@results);
            if (not defined $result) {next;}
            prepare_file($result);
            my %result = %$result;
            $sock->send($result{file}); #}}}
        } elsif ($cmd =~ /^gets$sep/) { #{{{
            $cmd =~ s/gets$sep//;
            my $stmt = $dbh->prepare("SELECT * FROM series WHERE LOWER(name) LIKE '%$cmd%'");
            $stmt->execute();
            my %retSeries = %{$stmt->fetchall_hashref(['name'])};
            my @retNames = keys %retSeries;
            my $serID = undef;
            if ($#retNames == 0) {
                $serID = $retSeries{$retNames[0]}{id};
            } else {
                my $choice = single_select($sock, \@retNames);
                $serID = $retSeries{$choice}{id};
            }
            if (not defined $serID) {$sock->send('nf'); next;}

            $stmt = $dbh->prepare("SELECT * FROM movies WHERE series=$serID AND file IS NOT NULL");
            $stmt->execute();
            my %data = %{$stmt->fetchall_hashref(['id'])};
            my @ids = keys %data;
            if ($#ids == -1) {
                $stmt = $dbh->prepare("SELECT * FROM tv WHERE series=$serID AND file IS NOT NULL");
                $stmt->execute();
                %data = %{$stmt->fetchall_hashref(['id'])};
                @ids = keys %data;
            }
            if ($#ids == -1) {$sock->send('nf'); next;}

            my @files;
            $sock->send('prep');
            foreach(@ids) {
                my %data = %{$data{$_}};
                prepare_file(\%data);
                push(@files, $data{file});
            }
            $sock->send(join(';', @files)); #}}}
        } elsif ($cmd =~ /^getse$sep/) { #{{{
            $cmd =~ s/^getse$sep//;
            my @parts = split(/ /, $cmd);
            my $sN = $parts[$#parts];
            pop @parts;
            my $show = lc join(' ', @parts);

            my $stmt = $dbh->prepare("SELECT * FROM series WHERE LOWER(name) LIKE '%$show%'");
            $stmt->execute();
            my %retSeries = %{$stmt->fetchall_hashref(['name'])};
            my @retNames = keys %retSeries;
            my $serID = undef;
            if ($#retNames == 0) {
                $serID = $retSeries{$retNames[0]}{id};
            } else {
                my $choice = single_select($sock, \@retNames);
                $serID = $retSeries{$choice}{id};
            }
            if (not defined $serID) {$sock->send('nf'); next;}

            $stmt = $dbh->prepare("SELECT * FROM tv WHERE series=$serID AND season=$sN AND file IS NOT NULL");
            $stmt->execute();
            my %retEps = %{$stmt->fetchall_hashref(['id'])};
            my @retIDs = keys %retEps;
            my $epID = undef;
            my @files;
            if ($#retIDs >= 0) {
                $sock->send('prep');
                foreach(@retIDs) {
                    my %data = %{$retEps{$_}};
                    prepare_file(\%data);
                    push(@files, $data{file});
                }
            } else {
                $sock->send('ns');
                next;
            }
            $sock->send(join(';', @files)); #}}}
        } elsif ($cmd =~ /^rm$sep/) { #{{{
            $cmd =~ s/^rm$sep//;
            chomp $cmd;
            if (not `ps aux | grep "/prom_cli/$cmd" | grep -v grep` and -e "/prom_cli/$cmd") {
                `shred -n 3 -u "/prom_cli/$cmd" &`;
            }
            $sock->send('done');
        } #}}}
        sleep $sleep_delay;
    }
} #}}}

my $f = fork;
if (not defined $f) {print "Failed to fork\n"; exit 1;}
# Accept and verify incoming connections #{{{
if ($f == 0) {
    while (1) {
        my $client = $accept_sock->accept();
        print "Got client\n";
        my $data = '';
        $client->recv($data, 999);
        chomp $data;
        if ($data =~ /^auth/) { #{{{
            my @data = split(/$sep/, $data);
            my $stmt = $dbh->prepare("SELECT EXISTS(SELECT 1 FROM users WHERE pw=encode(digest('$data[2]' || (SELECT salt FROM users WHERE username='$data[1]'), 'sha512'), 'hex') AND username='$data[1]')");
            $stmt->execute();
            my $data_ref = $stmt->fetchrow_arrayref();
            my $exists = @{$data_ref}[0];
            $client->send($exists);
            while (not $exists) { #{{{
                $data = '';
                $client->recv($data, 999);
                chomp $data;
                @data = split(/$sep/, $data);
                my $stmt = $dbh->prepare("SELECT EXISTS(SELECT 1 FROM users WHERE pw=encode(digest('$data[2]' || (SELECT salt FROM users WHERE username='$data[1]'), 'sha512'), 'hex') AND username='$data[1]')");
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
        print "Got broadcast message\n";
        if ($text eq 'prom_web_q') {
            if (not $b_cast_send_sock->send("prom_web_r#$ip")) {
                print "Failed to send broadcast response\n";
            }
        }
        sleep $sleep_delay;
    }
} #}}}
