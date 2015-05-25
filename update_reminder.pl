#!/usr/bin/perl -w

use lib '/var/www/prometheus/perl';
use Date::Simple qw(date today);
use Date::Parse qw(str2time);
use POSIX qw(strftime);
use File::Temp qw(tempfile);
use File::Slurp;
use List::MoreUtils qw(after_incl);
use DBI;
use DBD::Pg;
use COMMON;
use strict;

my $dbh = DBI->connect('DBI:Pg:dbname=prometheus', 'root');

my $mode = shift;
my $id = shift;

# Get reinder information #{{{
my $cmd = $dbh->prepare("SELECT * FROM reminders WHERE id = $id");
$cmd->execute();
my $remRef = $cmd->fetchrow_hashref();
my %reminder = %$remRef;
$cmd->finish(); #}}}

sub scheduleReminder { #{{{
    my $id = shift;
    my $strTime = shift;

    my ($sec,$min,$hour,$mday,$mon,$year,$wday,$yday,$isdst) = localtime($strTime);
    $mon = int($mon) + 1;
    $year = int($year) + 1900;
    my ($file, $filename) = tempfile();
    if (int($hour) < 10) {$hour = "0$hour";}
    if (int($min) < 10) {$min = "0$min";}
    #print "$hour:$min $year-$mon-$mday\n";
    #print "echo \"perl /var/www/update_reminder.pl r $id\" | at $hour:$min $year-$mon-$mday 2> $filename";
    `echo \"perl /var/www/prometheus/update_reminder.pl r $id\" | at $hour:$min $year-$mon-$mday 2> $filename`;
    my $jobID = read_file($filename);
    $jobID =~ s/^.*job ([0-9]+) at.*$/$1/s;
    $dbh->do("UPDATE reminders SET job_id = $jobID WHERE id = $id");
} #}}}

# Newly created reminder #{{{
if ($mode eq 'c') {
    scheduleReminder($id, str2time($reminder{'next'})); #}}}
# Run reminder #{{{
} elsif ($mode eq 'r') {
    # Send reminder #{{{
    my $recipient = $reminder{'recipient'};
    my $subject = '';
    my $message = $reminder{'message'};
    $message =~ s/"/\\\\"/g;
    if ($reminder{'type'} eq 's') {
        my @recipients = split(/, */, $recipient);
        $recipient = '';
        my $cmd = $dbh->prepare('SELECT * FROM sms');
        $cmd->execute();
        my $contactsRef = $cmd->fetchall_hashref(['id']);
        $cmd->finish();
        my %contacts = COMMON::reIndexHash($contactsRef, 'name');
        foreach(@recipients) {
            $recipient .= "'" . $contacts{$_}{'address'} . "', ";
        }
        $recipient = substr($recipient, 0, -2);
        `echo $message | msmtp -t $recipient`;
    } elsif ($reminder{'type'} eq 'e') {
        $subject = " -s \\\"$reminder{'subject'}\\\"";
        `su prometheus-reminder-daemon -c "echo \\\"$message\\\" | mail$subject $recipient"`;
    }
    #}}}

    # Determine next execution time #{{{
    my $next = $reminder{'next'};
    my $repeat = $reminder{'repeat'};
    # If a plain numerical day or week offset, don't need to do anything fancy
    # since they have a uniform difference and therefore can just add second equivalency
    if ($repeat =~ /^[dw][0-9]+$/) {
        $next = str2time($next);
        my %conv = ('d' => 86400, 'w' => '604800');
        $next += $conv{substr($repeat, 0, 1)};
    # If using a day-based weekly occurrence
    } elsif (substr($repeat, 0, 1) eq 'w') {
        $next = str2time($next);
        my $dow = today->day_of_week;
        my $dIndex = index($repeat, $dow);
        my $difference;
        # If at end of list of days, go back to first one
        if ((length($repeat) - 2) == $dIndex) {
            $difference = (7 - $dow) + int(substr($repeat, 2, 1));
        } else {
            $difference = int(substr($repeat, $dIndex + 1, 1)) - $dow;
        }
        $next += ($difference * 86400);
    # Month offset
    } elsif (substr($repeat, 0, 1) eq 'm') {
        my $curMonth = int(substr($next, 5, 2));
        my $monthGap = int(substr($repeat, 1));
        my $curYear = int(substr($next, 0, 4));

        my $month = $curMonth + $monthGap;
        if ($month > 12) {
            $month -= 12;
            $curYear++;
        }
        $next =~ s/^[0-9]{4}/$curYear/;
        $next =~ s/-[0-9]{2}-/-$month-/;
        $next = str2time($next);
    } elsif (substr($repeat, 0, 1) eq 'y') {
        my $year = int(substr($next, 0, 4));
        my $yearGap = int(substr($repeat, 1));
        $year += $yearGap;
        substr($next, 0, 4, $year);
        $next = str2time($next);
    } #}}}

    # Check if this is last reminder #{{{
    my $difference = $next - str2time($reminder{'next'});
    my $first = str2time($reminder{'first'});
    my $duration = $reminder{'duration'};
    my $completed = 0;
    if (substr($duration, 0, 1) eq 'd') {
        my $endTime = str2time(substr($duration, 1));
        $completed = ($endTime < $next);
    } elsif (substr($duration, 0, 1) eq 'f' and
        int(substr($duration, 1)) < int($reminder{'count'})) {
        $completed = 1;
    } #}}}

    # Delete reminder if necessary #{{{
    if ($repeat eq 'o' or $completed) {
        $dbh->do("DELETE FROM reminders * WHERE id = $id"); #}}}
    # Otherwise schedule next runtime #{{{
    } else {
        scheduleReminder($id, $next);
        my $strNext = strftime('%Y-%m-%d %H:%M:00-0400', localtime $next);
        $dbh->do("UPDATE reminders SET next = '$strNext', count = count + 1 WHERE id = $id");
    } #}}} #}}}
# Update reminder #{{{
# If being updated, that means it will not have gone over its expected runtime
# Also, do not need to check if the new conditions warrant deletion, since
# that will be taken care of on next run
} elsif ($mode eq 'u') {
    `atrm $reminder{'job_id'}`;
    if (str2time($reminder{'first'}) > `date +%s`) { #{{{
        scheduleReminder($id, str2time($reminder{'first'})); #}}}
    } else { #{{{
        my $next = 0;
        # If using a simple offset, find next occurrence after now #{{{
        if ($reminder{'repeat'} =~ /^[dwmy][0-9]+$/) {
            my $offset = substr($reminder{'repeat'}, 0, 1);
            my $gap = int(substr($reminder{'repeat'}, 1));
            my %intervals = ('d' => 86400, 'w' => 604800);
            my $now = `date +%s`;
            my$strNext = $reminder{'first'};
            while ($now > $next) { #{{{
                if ($offset eq 'd' or $offset eq 'w') { #{{{
                    $next += $intervals{$offset} * $gap; #}}}
                } elsif ($offset eq 'm') { #{{{
                    my $nextMonth = int(substr($strNext, 5, 2));
                    $nextMonth += $gap;
                    if ($nextMonth > 12) {$nextMonth -= 12;}
                    if ($nextMonth < 10) {$nextMonth = "0$nextMonth";}
                    substr($strNext, 5, 2, $nextMonth);
                    $next = str2time($strNext); #}}}
                } elsif ($offset eq 'y') { #{{{
                    my $nextYear = int(substr($strNext, 0, 4));
                    $nextYear += $gap;
                    substr($strNext, 0, 4, $nextYear);
                    $next = str2time($strNext);
                } #}}}
            } #}}} #}}}
        # If using several days in a week #{{{
        } else {
            # Find next day after today on which the reminder should be sent
            my $days = substr($reminder{'repeat'}, 2, -1);
            my @days = split(//, $days);
            my $dow = today->day_of_week;
            my $nextDay = after_incl {$_ > $dow} @days;

            # Calculate next reminder time based off of current date
            # and initial reminder time
            my $dayOffset;
            if ($nextDay) {
                $dayOffset = $nextDay - $dow;
            } else {
                $dayOffset = 7 - $dow + $days[0];
            }
            $next = str2time(today . " " . substr($reminder{'first'}, 11));
            $next += $dayOffset * 86400;
        } #}}}
        scheduleReminder($id, $next);
    } #}}} #}}}
# Delete reminder #{{{
} elsif ($mode eq 'd') {
    my $cmd = $dbh->prepare("SELECT job_id FROM reminders WHERE id = $id");
    $cmd->execute();
    my $dataRef = $cmd->fetchall_hashref('job_id');
    my %data = %$dataRef;
    my @jobIDs = keys(%data);
    my $job = $jobIDs[0];
    `atrm $job`;
    $cmd->finish();
} #}}}

$dbh->disconnect();
