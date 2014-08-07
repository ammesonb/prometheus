#!/bin/bash

kind=$1
file=$2
padding=`expr 5 \* 1024 \* 1024`
while read i;
do
    ttid=`echo $i | awk -F '-' '{st=index($0,"-"); print $1}'` #{{{
    mfile=`echo $i | awk -F '-' '{st=index($0,"-"); print substr($0, st+1)}'`
    size=`stat -c %s "$mfile"`
    size=`expr $size / 1024`
    filename=`basename "$mfile"`
    v=${kind:0:1}${filename:0:1}
    n=`echo -n $v | sha256sum | awk -F ' ' '{printf $1}'` #}}}

    exists=`/var/www/encfs/./fs.py f $v`
    if [ $exists = 0 ]; then #{{{
        # Since creating, add 2 GB safety margin
        newSize=`expr $size + $padding`K
        /var/www/encfs/./fs.py c $v $newSize /mnt #}}}
    else #{{{
        avail=`/var/www/encfs/./fs.py s $v /mnt`
        if [ $avail -lt $size ]; then
            /var/www/encfs/./fs.py r $v `expr $size - $avail + $padding`K /mnt
        fi
    fi #}}}

    mounted=`/var/www/encfs/./fs.py mtd $v` #{{{
    if [ ! -e /data/$n ]; then
        mkdir /data/$n
    fi
    /var/www/encfs/./fs.py m $v /data/$n #}}}

    cp "$mfile" /data/$n/

    if [ $mounted = 0 ]; then #{{{
        /var/www/encfs/./fs.py d $v
        rmdir /data/$n
    fi #}}}

    psql prometheus -c "UPDATE $kind SET file='$filename',size=$size WHERE ttid='$ttid'"
done < $file
