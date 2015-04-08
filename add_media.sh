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
    res=`avconv -debug pict -i "$mfile" /dev/null 2>&1 | egrep -o [1-9][0-9]\+x[1-9][0-9]+ | head -1`
    vcodec=`ffprobe -pretty "$mfile" 2>&1 | egrep -o "Video: [^ ]+ " | head -1 | egrep -o " .* " | egrep -o "[^ ]+"`
    vrate=`ffprobe -pretty "$mfile" 2>&1 | egrep -o "Video: .*, [0-9]+ kb/s" | head -1 | egrep -o "[0-9]+ kb/s" | egrep -o "[0-9]+"`
    if [[ $vrate -eq "" ]]
      then
        vrate="Unknown"
    fi
    acodec=`ffprobe -pretty "$mfile" 2>&1 | egrep -o "Audio: [^ ]+ " | head -1 | egrep -o " .* " | egrep -o "[^ ]+" | sed 's/ *, *//g'`
    arate=`ffprobe -pretty "$mfile" 2>&1 | egrep -o "Audio: .*, [0-9]+ kb/s" | head -1 | egrep -o "[0-9]+ kb/s" | egrep -o "[0-9]+"`
    if [[ $arate -eq "" ]]
      then
        arate="Unknown"
    fi
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
        #psql prometheus -c "UPDATE $kind SET file='$fn',size=$size,checksum='$checksum',resolution='$res',v_codec='$vcodec',a_codec='$acodec',v_rate='$vrate',a_rate='$arate' WHERE ttid='$ttid'"
        rm "$mfile"
    else
        echo "Failed to store $fn"
    fi
done < $file
