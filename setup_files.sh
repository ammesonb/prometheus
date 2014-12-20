#!/bin/bash
addgroup prometheus
adduser root prometheus
adduser www-data prometheus
sed -i 's/^www-data:\(.*\):\/usr\/sbin\/nologin/www-data:\1:\/bin\/bash/' /etc/passwd
echo "www-data ALL=NOPASSWD:/sbin/losetup,/sbin/cryptsetup,/bin/mount,/bin/umount,/bin/dd,/sbin/mkfs.ext4,/sbin/tune2fs,/sbin/e2fsck,/sbin/resize2fs,/usr/bin/python,/usr/bin/perl,/bin/rmdir" >> /etc/sudoers
service sudo restart

if [ -d "/data" ]; then
    echo "/data directory must not exist!"
    exit 1
fi
mkdir /data
touch /data/la77cD30f7D31F40
chmod 660 /data/la77cD30f7D31F40
echo "#!/bin/bash
rm -r files/*
rm -r [^rl]
echo -n \"\" > /data/la77cD30f7D31F40*" > /data/reset.sh
chmod +x /data/reset.sh

if [ -d "/files" ]; then
    echo "/files directory must not exist!"
    exit 1
fi

chown -R root:prometheus /data
chmod 770 /data
chown -R root:prometheus /files
chmod 770 /files
