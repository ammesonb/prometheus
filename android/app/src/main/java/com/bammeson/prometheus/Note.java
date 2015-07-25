package com.bammeson.prometheus;

import java.util.Date;

/**
 * Created by brett on 7/3/15.
 * Represents a note object
 */
public class Note implements Comparable {
    private int id;
    private String title;
    private String text;
    private Date lastModified;

    public Note(int id, String title, String text, Date lastModified) {
        this.id = id;
        this.title = title;
        this.text = text;
        this.lastModified = lastModified;
    }

    public String getTitle() {
        return title;
    }

    @Override
    public int compareTo(Object n) {
        return this.title.compareTo(((Note) n).getTitle());
    }

    public String getText() {
        return text;
    }

    public int getId() {
        return id;
    }
}
