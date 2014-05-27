#!/usr/bin/perl -w

package COMMON;

use CGI;
use CGI::Session;
use CGI::Carp qw(fatalsToBrowser);
use DBI;
use DBD::Pg;
use List::MoreUtils qw(first_index);
use strict;

my $indent = '    ';

sub init {
    my $session = shift;
    my $title = shift;
    my $authorized = checkSession($session);

    print $session->header();
    my $html = "<!DOCTYPE html>\n";
    $html .= "<html>\n";
    $html .= "<head>\n";
    $html .= $indent . "<script type=\"text/javascript\" src=\"js/sha512.js\"></script>\n";
    $html .= $indent . "<script type=\"text/javascript\" src=\"js/css_browser_selector.js\"></script>\n";
    $html .= $indent . "<script type=\"text/javascript\" src=\"js/site.js\"></script>\n";
    $html .= $indent . "<script type=\"text/javascript\">
    window.onload = function() {
        document.body.style.backgroundSize = window.innerWidth + \"px \" + window.innerHeight + \"px\";
        theme = document.body.getAttribute('data-night-theme');
        d = new Date();
        // Main page
        try {
            topOffset = document.getElementById('main').offsetTop - 25;

            if (useNightTheme()) {
                document.getElementById('main').className += ' night';
                tools = document.getElementsByClassName('tool_name')
                for (t = 0; t < tools.length; t++) {tools[t].className += ' night';}
            }

            // Because browsers and OSes are dumb at rendering things
            if (css_browser_selector(navigator.userAgent).search(' win ') != -1) {
                topOffset -= 10;
                if (css_browser_selector(navigator.userAgent).search('gecko') != -1) {topOffset += 5;}
            }
            document.getElementById('tabs').style.top = topOffset + 'px';
        } catch(e) {}

        // Login
        try {
            if (useNightTheme()) {
                document.getElementById('login').className += ' night';
                fields = document.getElementsByTagName('input')
                for (i = 0; i < fields.length; i++) {switchToNight(fields[i]);}
                switchToNight(document.getElementsByTagName('button')[0]);
            }
        } catch(e) {}
        document.body.style.visibility = 'visible';
    };
    </script>\n";
    $html .= $indent . "<title>$title</title>\n";
    $html .= $indent . "<link rel=\"stylesheet\" type=\"text/css\" href=\"res/style.css\"/>\n";
    $html .= "</head>\n";
    $html .= "<body style=\"visibility: hidden;\" data-night-theme=" . $session->param('night_theme') . ">\n";
    if ($authorized == 2) {
        $html .= "<div id=\"login\">\n";
        $html .= "<img src=\"images/prometheus.png\" alt=\"Prometheus\">\n";
        $html .= "<p><strong>You are not allowed to access this from your current location.<br/>Please contact me at ammesonb\@gmail.com.</strong></p>\n";
        $html .= "</div>\n";
    } elsif ($authorized == 3) {
        $html .= "<div id=\"login\">\n";
        $html .= "<img src=\"images/prometheus.png\" alt=\"Prometheus\">\n";
        $html .= "<p><strong>This account has been disabled.<br/>Please contact me at ammesonb\@gmail.com.</strong></p>\n";
    } elsif ($authorized == 1) {
        $html .= "<div id=\"login\">\n";
        $html .= $indent . "<a href=\"/\"><img src=\"images/prometheus.png\" alt=\"Prometheus\"></a>\n";
        my $error = "&nbsp;";
        if ($session->param('attempt_login') and not $session->param('logged_in') and (($session->param('attempt_login') == 1) and ($session->param('logged_in') == 0))) {
            $error = "Incorrect username or password";
        } elsif ($session->param('timed_out')) {
            $error = "Session timed out";
        }
        $html .= $indent . "<p id=\"error\">$error</p>\n";
        $html .= $indent . "Username:&nbsp;&nbsp;<input type=\"text\">\n";
        $html .= $indent . "<br/><br/>\n";
        $html .= $indent . "&nbsp;Password:&nbsp;&nbsp;&nbsp;<input type=\"password\">\n";
        $html .= $indent . "<br/><br/>\n";
        $html .= $indent . "<button onclick=\"login()\">Log In</button>\n";
        $html .= $indent . "<script type=\"text/javascript\">
    document.getElementsByTagName('input')[0].focus();
    document.onkeydown = function (evt) {
        var keyCode = evt ? (evt.which ? evt.which : evt.keyCode) : event.keyCode;
        if (keyCode == 13) {
            document.getElementsByTagName('button')[0].click();
        }
        if (keyCode == 27) {
            document.getElementsByTagName('button')[0].click();
        } else {
            return true;
        }
    };
    </script>\n";
        $html .= "</div>\n";
    } else {
        $html .= "<img src=\"images/prometheus.png\" alt=\"Prometheus\" style=\"margin-top: -.5%;\">\n";
        my $user = $session->param('user');
        $html .= "<p id=\"userinfo\">Logged in as $user<br/><a href=\"logout.cgi\">Log Out</a></p>\n";
        $html .= "<div id=\"tabs\">\n";
        $html .= $indent . "<a href=\"#\"><div class=\"tab\" onclick=\"switchTab('home');\">Home</div></a>\n";
        $html .= "</div>\n";
        $html .= "<div id=\"main\">\n";
        $html .= "<div id=\"home\" class=\"selected\">\n";
        $html .= $indent . "<script type=\"text/javascript\">
    main = document.getElementById('main');
    main.style.width = window.innerWidth - 300 + 'px';
    main.style.marginLeft = -.5 * (window.innerWidth - 300) + 'px';
    main.style.height = window.innerHeight - 150 + 'px';
    main.style.marginTop = -.5 * (window.innerHeight - 150) + 'px';
    tabs = document.getElementById('tabs');
    tabs.style.width = window.innerWidth - 300 + 'px';
    tabs.style.marginLeft = -.5 * (window.innerWidth - 300) + 'px';
    </script>\n";

        # Get services the user has access to
        my @returnCols = ('user_id', 'array_agg(service_id)');
        my @searchCols = ('user_id');
        my @searchOps = ('=');
        my @searchVals = ($session->param('user_id'));
        my @logic = ();
        my @groupBy = ('user_id');
        my $servicesRef = searchTable('user_services', \@returnCols, \@searchCols, \@searchOps, \@searchVals, \@logic, 1, \@groupBy, 'user_id');
        my %services = %$servicesRef;
        my @serviceKeys = keys(%services);
        $servicesRef = $services{$serviceKeys[0]};
        %services = %$servicesRef;
        @serviceKeys = keys(%services);
        my @services = @services{$serviceKeys[0]};
        $servicesRef = $services[0];
        my @serviceIDs = @$servicesRef;

        my $toolsRef = getSortedTable("services", "row_order");
        my @tools = @$toolsRef;
        @services = ();
        foreach (@tools) {
            my %tool = %$_;
            if ((first_index {$_ == $tool{'id'}} @serviceIDs) == -1) {next;}
            push(@services, $tool{'service'});
            $html .= $indent . "<a href=\"#\" onclick=\"$tool{'function'}()\">\n";
            $html .= $indent x 2 . "<span class=\"tool\">\n";
            my $image = $tool{'service'};
            $image =~ s/^(.*)$/\L$1.png/;
            $image =~ s/ /_/g;
            $html .= $indent x 3 . "<img src=\"images/$image\" alt=\"$tool{'service'}\" width=\"83px\" height=\"137\">\n";
            $html .= $indent x 3 . "<p class=\"tool_name\">$tool{'service'}</p>\n";
            $html .= $indent . "</span>\n";
            $html .= $indent . "</a>\n";
        }
        $session->param('services', join(', ', @services));
        $html .= "</div>\n";
        $html .= "</div>\n";
    }
    $html .= "</body>\n";
    $html .= "</html>\n";

    return $html;
}

sub checkSession {
    my $session = shift;
    return 3 if ($session->param('disabled'));
    return 2 if ($session->param('blocked'));
    return 1 if (not $session->param('logged_in'));
    return 0;
}

sub connectToDB {
    return DBI->connect("DBI:Pg:dbname=prometheus", "root");
}

sub getTable {
    my $tableName = shift;
    my $dbh = connectToDB();
    my $tableRef = $dbh->selectall_hashref("SELECT * FROM $tableName", ["id"]);
    $dbh->disconnect();
    return $tableRef;
}

sub getSortedTable {
    my $tableName = shift;
    my $sortBy = shift;
    my $direction = shift;
    
    my $dir = "";
    $dir = " $direction" if ($direction);
    my $dbh = connectToDB();
    my $sth = $dbh->prepare("SELECT * FROM $tableName ORDER BY $sortBy$dir");
    $sth->execute();
    my @rows;
    while (my $rowRef = $sth->fetchrow_hashref) {
        push(@rows, $rowRef);
    }
    $dbh->disconnect();
    return \@rows;
}

sub searchTable {
    # Get arguments
    my $tableName = shift;
    my $colsRef = shift;
    my @columns = @$colsRef;
    my $searchColsRef = shift;
    my @searchColumns = @$searchColsRef;
    my $opsRef = shift;
    my @operators = @$opsRef;
    my $patternsRef = shift;
    my @patterns = @$patternsRef;
    my $logicRef = shift;
    my @logic = @$logicRef;
    my $useAgg = shift;
    my @groupColumns;
    if ($useAgg) {
        my $groupColsRef = shift;
        @groupColumns = @$groupColsRef;
    }
    my $idCol = shift;

    my $dbh = connectToDB();

    # Create query
    my $query = "SELECT " . join(', ', @columns) . " FROM $tableName WHERE ";
    for (my $i = 0; $i <= $#logic; $i++) {
        $query .= "$searchColumns[$i] $operators[$i] $patterns[$i] $logic[$i] ";
    }
    $query .= "$searchColumns[$#searchColumns] $operators[$#operators] $patterns[$#patterns]";
    $query .= " GROUP BY " . join(', ', @groupColumns) if ($useAgg);

    # Execute query
    my $sth = $dbh->prepare($query);
    $sth->execute();
    my $dataRef;
    if ($idCol) {$dataRef = $sth->fetchall_hashref([$idCol]);}
    else {$dataRef = $sth->fetchall_hashref(['id']);}
    $dbh->disconnect();

    return $dataRef;
}

sub searchTableSort {
    # Get arguments
    my $tableName = shift;
    my $colsRef = shift;
    my @columns = @$colsRef;
    my $searchColsRef = shift;
    my @searchColumns = @$searchColsRef;
    my $opsRef = shift;
    my @operators = @$opsRef;
    my $patternsRef = shift;
    my @patterns = @$patternsRef;
    my $logicRef = shift;
    my @logic = @$logicRef;
    my $sort = shift;

    my $dbh = connectToDB();

    # Create query
    my $query = "SELECT " . join(', ', @columns) . " FROM $tableName WHERE ";
    for (my $i = 0; $i <= $#logic; $i++) {
        $query .= "$searchColumns[$i] $operators[$i] $patterns[$i] $logic[$i] ";
    }
    $query .= "$searchColumns[$#searchColumns] $operators[$#operators] $patterns[$#patterns] ORDER BY $sort";

    my $sth = $dbh->prepare($query);
    $sth->execute();

    # Create array of hash references
    my @rows;
    while (my $rowRef = $sth->fetchrow_hashref) {
        push(@rows, $rowRef);
    }

    $dbh->disconnect();
    return \@rows;
}

sub insertIntoTable {
    # Get parameters
    my $tableName = shift;
    my $insertColsRef = shift;
    my @insertColumns = @$insertColsRef;
    my $insertValsRef = shift;
    my @insertValues = @$insertValsRef;

    my $dbh = connectToDB();

    # Create query
    my $query = "INSERT INTO $tableName (" . join(', ', @insertColumns) . ') VALUES (' . join(', ', @insertValues) . ')';
    my $rows = $dbh->do($query);
    $dbh->disconnect();

    return $rows;
}

sub updateTable {
    # Get parameters
    my $tableName = shift;
    my $updateColsRef = shift;
    my @updateCols = @$updateColsRef;
    my $updateValuesRef = shift;
    my @updateValues = @$updateValuesRef;
    my $filterColsRef = shift;
    my @filterCols = @$filterColsRef;
    my $filterOpsRef = shift;
    my @filterOperators = @$filterOpsRef;
    my $filterCriteriaRef = shift;
    my @filterCriteria = @$filterCriteriaRef;
    my $filterLogicRef = shift;
    my @filterLogic = @$filterLogicRef;

    # Create query
    my $query = "UPDATE $tableName SET ";
    for (my $i = 0; $i < $#updateCols; $i++) {
        $query .= "$updateCols[$i]=$updateValues[$i], ";
    }
    $query .= "$updateCols[$#updateCols]=$updateValues[$#updateValues] WHERE ";
    for (my $i = 0; $i <= $#filterLogic; $i++) {
        $query .= "$filterCols[$i] $filterOperators[$i] $filterCriteria[$i] $filterLogic[$i] ";
    }
    $query .= "$filterCols[$#filterCols] $filterOperators[$#filterOperators] $filterCriteria[$#filterCriteria]";

    my $dbh = connectToDB();
    my $rowsChanged = $dbh->do($query);
    $dbh->disconnect;
    return $rowsChanged;
}

sub deleteFromTable {
    # Get parameters
    my $tableName = shift;
    my $deleteColsRef = shift;
    my @deleteCols = @$deleteColsRef;
    my $deleteOpsRef = shift;
    my @deleteOps = @$deleteOpsRef;
    my $deleteValsRef = shift;
    my @deleteValues = @$deleteValsRef;
    my $deleteLogicRef = shift;
    my @deleteLogic = @$deleteLogicRef;

    my $dbh = connectToDB();

    # Create query
    my $query = "DELETE FROM $tableName * WHERE ";
    for (my $i = 0; $i <= $#deleteLogic; $i++) {
        $query .= "$deleteCols[$i] $deleteOps[$i] $deleteValues[$i] $deleteLogic[$i] ";
    }
    $query .= "$deleteCols[$#deleteCols] $deleteOps[$#deleteOps] $deleteValues[$#deleteValues]";

    my $deletedRows = $dbh->do($query);
    $dbh->disconnect();

    return $deletedRows;
}

sub attempt_login {
    my $username = shift;
    my $pass = shift;
    my $domainID = shift;

    my @domainCols = ('id', 'regex');
    my @searchCols = ('id');
    my @searchOps = ('=');
    my @searchVals = ($domainID);
    my @logic = ();
    my $domainRegexRef = searchTable('domains', \@domainCols, \@searchCols, \@searchOps, \@searchVals, \@logic);
    my %domainRegex = %$domainRegexRef;
    my $domainRegex = $domainRegex{$domainID}{'regex'};

    my $usersRef = getTable("users");
    my %usersHash = %$usersRef;

    foreach(keys %usersHash) {
        my $userRef = $usersHash{$_};
        my %user = %$userRef;
        
        if (($username cmp $user{'username'}) == 0) {
            return 4 if ($user{'disabled'});
            if (($pass cmp $user{'pw'}) == 0) {
                return 0 if (($ENV{'REMOTE_ADDR'}) =~ /$domainRegex/);
                return 3;
            } else {
                return 1;
            }
        }
    }

    return 2;
}

sub checkPrintable {
    my $str = shift;

    return ($str =~ /^[\n\r\t\x20-\x7E]*$/);
}

1;

__END__

=head1 NAME

=cut

=pod

COMMON - provides basic database and html functions 

=cut

=head1 DESCRIPTION

Various functions used for the backend of the web interface

=cut

=head1 METHODS

=head2 init

=pod 

Takes a CGI session and page title as arguments

Initializes main view for web interface, including
verifying user has proper authorization
and is in acceptable location

=cut

=head2 checkSession

=pod

Takes a CGI session

Returns boolean for user being logged in

=cut

=head2 connectToDB

=pod

Returns a handle to the local database, connected as user 'root'

=cut

=head2 getTable

=pod

Takes a table name, requires the table to have a primary key with name 'id'

Returns a reference to a hash of the table where the first index is the id,
then the rows are indexed by their column names

=cut

=head2 getSortedTable

=pod

Takes a table name, a column name, and optionally a direction to sort ('ASC' or 'DESC')

Returns a reference to an array of references to hashes, indexed by column name

=cut

=head2 searchTable

=pod

Takes a table name, reference to an array of columns to return,
reference to an array of columns to search on,
reference to an array of operators to use,
reference to an array of patterns to search the columns by,
reference to an array of logic operators to combine the terms,
and optionally a boolean to specify if aggregate functions are used
If so, it will also take a reference to an array of columns to group by

Returns a reference to a hash of the filtered table

=cut

=head2 searchTableSort

=pod

Takes a table name, reference to an array of columns to return, reference to an array of columns to search on,
reference to an array of operators to use,
reference to an array of patterns to search the columns by,
reference to an array of logic operators to combine the terms,
and a sort string of the format 'column_name[,column2]... [ASC || DESC]

Returns a reference to an array of sorted hash references to rows that matched the filter

=cut

=head2 insertIntoTable

=pod

Takes a table name, a reference to an array of columns to fill with value,
and a reference to an array of values to fill the columns with.

Returns the number of rows created.

=cut

=head2 updateTable

=pod

Takes a table name, reference to an array of columns to update,
reference to an array of values to update the columns with,
reference to an array of columns to filter by,
reference to an array of operators to use,
reference to an array of patterns to filter the columns with,
and a reference to an array of logic operators to use to combine the terms

Returns the number of rows updated.

=cut

=head2 deleteFromTable

=pod

Takes a table name, a reference to an array of columns to filter the deletion on,
a reference to an array of operators to use for filtering,
a reference to an array of values to filter the columns by,
and a reference to an array of logic operators to combine the filters with.

Returns the number of rows deleted

=cut

=head2 attempt_login

=pod

Takes a username and a (hashed) password

=pod

Returns the login state:

=over

=item

    0 => Success
    1 => Invalid user/pass combination
    2 => Username doesn't exit
    3 => Domain blocked
    4 => Account disabled

=back

=cut

=head2 check_printable

=pod

Takes a string and returns true if it is between hex 20 and 7E, AKA a printable ASCII character

=cut

=head1 AUTHOR

=cut

=pod

Brett Ammeson C<ammesonb@gmail.com>

=cut
