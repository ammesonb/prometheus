package com.bammeson.prometheus;

import java.util.Date;

/**
 * Created by brett on 7/3/15.
 * Represents a note object
 */
public class Note {
    private String title;
    private String text;
    private Date lastModified;

    public Note(String title, String text, Date lastModified) {
        this.title = title;
        this.text = text;
        this.lastModified = lastModified;
    }
}
