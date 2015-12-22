#!/bin/bash
reset
kind=$1
file=$2
padding=`expr 5 \* 1024 \* 1024`
while read i;
do
    ttid=`echo $i | awk -F '-' '{st=index($0,"-"); print $1}'` #{{{
    mfile=`echo $i | awk -F '-' '{st=index($0,"-"); print substr($0, st+1)}'`
    if [ ! -f "$mfile" ]; then
        echo "File $mfile doesn't exist"
        continue
    fi
    echo "Calculating checksum"
    checksum=`sha512sum "$mfile" | awk -F ' ' '{print \$1}'`
    echo "Getting file info"
    size=`stat -c %s "$mfile"`
    height=`echo "$details" | egrep VIDEO_HEIGHT.* | egrep -o "[0-9]+"`
    width=`echo "$details" | egrep VIDEO_WIDTH.* | egrep -o "[0-9]+"`
    fps=`echo "$details" | egrep VIDEO_FPS.* | egrep -o "[0-9.]+"`
    res=${width}x$height
    vcodec=`echo "$details" | egrep VIDEO_FORMAT=.* | egrep -o "=.+" | egrep -o "[^=].+"`
    vrate=`expr $(echo "$details" | egrep VIDEO_BITRATE=.* | egrep -o "[0-9]+") / 1000`
    if [[ $vrate -eq "" ]]
      then
        vrate="Unknown"
    fi
    acodec=`echo "$details" | egrep AUDIO_CODEC=.* | egrep -o =.* | egrep -o "[^=]+" | head -1`
    arate=`expr $(echo "$details" | egrep AUDIO_BITRATE=.* | egrep -o "[0-9]+" | head -1) / 1000`
    if [[ $arate -eq "" ]]
      then
        arate="Unknown"
    fi
    nch=`echo "$details" | egrep NCH=.* | egrep -o "[0-9]+" | head -1`
    filename=`basename "$mfile"`
    f2=`echo "$filename" | sed 's/^[0-9 \.\-]\+//'`
    v=${kind:0:1}${f2:0:1}
    n=`echo -n $v | sha256sum | awk -F ' ' '{printf $1}'` #}}}

    echo "Storing"
    cSize=`expr $size / 1024`
    exists=`/var/www/prometheus/encfs/./fs.py f $v`
    if [ $exists = 0 ]; then #{{{
        # Since creating, add 2 GB safety margin
        newSize=`expr $cSize + $padding`K
        /var/www/prometheus/encfs/./fs.py c $v $newSize /mnt #}}}
    else #{{{
        avail=`/var/www/prometheus/encfs/./fs.py s $v /mnt`
        if [ "$avail" -lt "$cSize" ]; then
            /var/www/prometheus/encfs/./fs.py r $v `expr $cSize - $avail + $padding`K /mnt
        fi
    fi #}}}

    /var/www/prometheus/encfs/./fs.py m $v /data/$n

    rsync --partial -ahvtr "$mfile" /data/$n/
    fn=`basename "$mfile"`
    chown root:prometheus "/data/$n/$fn"
    chmod 750 "/data/$n/$fn"
    c2=`sha512sum "/data/$n/$fn" | awk -F ' ' '{print \$1}'`
    /var/www/prometheus/encfs/./fs.py d $v
    fn=`echo "$fn" | sed "s/'/''/g"`

    if [ "$checksum" = "$c2" ];
      then
        psql prometheus -c "UPDATE $kind SET file='$fn',size=$size,checksum='$checksum',resolution='$res',v_codec='$vcodec',a_codec='$acodec',v_rate='$vrate',a_rate='$arate',fps='$fps',channels='$nch' WHERE ttid='$ttid'"
        shred -u "$mfile"
    else
        echo "Failed to store $fn"
    fi
done < $file
