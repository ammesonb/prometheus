#!/bin/bash

kind=$1
file=$2
padding=`expr 5 \* 1024 \* 1024`
while read i;
do
    ttid=`echo $i | awk -F '-' '{st=index($0,"-"); print $1}'` #{{{
    mfile=`echo $i | awk -F '-' '{st=index($0,"-"); print substr($0, st+1)}'`
    echo "Calculating checksum"
    checksum=`sha512sum "$mfile"`
    echo "Getting file info"
    size=`stat -c %s "$mfile"`
    size=`expr $size / 1024`
    res=`avconv -debug pict -i "$mfile" /dev/null 2>&1 | egrep -o [1-9][0-9]\+x[1-9][0-9]+ | head -1`
    vcodec=`ffprobe -pretty "$mfile" 2>&1 | egrep -o "Video: [^ ]+ " | head -1 | egrep -o " .* " | egrep -o "[^ ]+"`
    vrate=`ffprobe -pretty "$mfile" 2>&1 | egrep -o "Video: .*, [0-9]+ kb/s" | head -1 | egrep -o "[0-9]+ kb/s" | egrep -o "[0-9]+"`
    if [ $vrate -eq "" ]
      then
        vrate="Unknown"
    fi
    acodec=`ffprobe -pretty "$mfile" 2>&1 | egrep -o "Audio: [^ ]+ " | head -1 | egrep -o " .* " | egrep -o "[^ ]+"`
    arate=`ffprobe -pretty "$mfile" 2>&1 | egrep -o "Audio: .*, [0-9]+ kb/s" | head -1 | egrep -o "[0-9]+ kb/s" | egrep -o "[0-9]+"`
    if [ $arate -eq "" ]
      then
        arate="Unknown"
    fi
    filename=`basename "$mfile"`
    v=${kind:0:1}${filename:0:1}
    n=`echo -n $v | sha256sum | awk -F ' ' '{printf $1}'` #}}}

    echo "Storing"
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
    chown root:prometheus "/data/$n/$mfile"
    chmod 750 "/data/$n/$mfile"

    if [ $mounted = 0 ]; then #{{{
        /var/www/encfs/./fs.py d $v
        rmdir /data/$n
    fi #}}}

    psql prometheus -c "UPDATE $kind SET file='$filename',size=$size,checksum='$checksum',resolution='$res',v_codec='$vcodec',a_codec='$acodec',v_rate='$vrate',a_rate='$arate' WHERE ttid='$ttid'"
done < $file
