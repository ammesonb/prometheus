#!/bin/bash
# install postgresql-contrib
# psql prometheus -c "create EXTENSION pgcrypto"
apt-get install rsync xinetd
echo "[prom_files]
    path = /prom_cli
    comment = "Prometheus"
    read only = true
    use chroot = true
    list = false
    log file = /var/log/rsyncd.log
    transfer logging = true
    strict modes = true
    auth users = prom_cli
    secrets file = /etc/rsyncd.secrets" >> /etc/rsyncd.conf

echo "service rsync
  {
    disable         = no
    port            = 873
    flags           = REUSE
    socket_type     = stream
    wait            = no
    user            = root
    server          = /usr/bin/rsync
    server_args     = --daemon
    log_on_failure  += USERID
  }" > /etc/xinetd.d/rsync
if [ ! grep "rsync" /etc/services ];
  then
    echo "rsync 873/tcp" >> /etc/services
fi
service xinetd restart

perl -MCPAN -e 'install DBI'
perl -MCPAN -e 'install DBD::Pg'
perl -MCPAN -e 'install Proc::ProcessTable'
perl -MCPAN -e 'install File::Slurp'
perl -MCPAN -e 'install File::Temp'
perl -MCPAN -e 'install List::MoreUtils'
perl -MCPAN -e 'install Date::Simple'
perl -MCPAN -e 'install Date::Parse'
perl -MCPAN -e 'install JSON'
perl -MCPAN -e 'install CGI'
perl -MCPAN -e 'install CGI::Session'
perl -MCPAN -e 'install CGI::Carp'
perl -MCPAN -e 'install Crypt::OpenSSL::Random'
perl -MCPAN -e 'install Time::HiRes'
perl -MCPAN -e 'install MIME::Base64'
echo "0 */12 * * * find /files/ -type f -mtime +0 -print0 | xargs -0 -P 8 -I {} shred -uz -n 3 \"{}\" 2> /dev/null &" | crontab -
echo "0 */3 * * * rmdir /files/*" | crontab -
`./setup_files.sh`
