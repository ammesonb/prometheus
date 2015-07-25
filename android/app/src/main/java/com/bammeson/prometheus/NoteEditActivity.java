package com.bammeson.prometheus;

import android.app.Activity;
import android.content.Intent;
import android.os.Bundle;
import android.view.Menu;
import android.view.MenuItem;
import android.view.View;
import android.widget.Button;
import android.widget.EditText;

import java.net.MalformedURLException;
import java.net.URL;
import java.util.ArrayList;
import java.util.Collections;


public class NoteEditActivity extends Activity {
    SessionManager session;
    String id;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_note_edit);
        Intent i = new Intent();
        id = i.getStringExtra("id");
        session = (SessionManager) i.getSerializableExtra("session");
        if (!session.isAuthenticated()) {
            // TODO display some error
            Intent in = new Intent(getApplicationContext(), AuthenticateActivity.class);
            startActivity(in);
            // Should be authenticated now so continue
        }

        Button save = (Button) findViewById(R.id.saveButton);
        Button cancel = (Button) findViewById(R.id.backButton);

        save.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View view) {
                // TODO use checksum or something to detect changes?
                // TODO validate text input - what character set should it be limited to? ASCII?
                EditText title = (EditText) findViewById(R.id.noteTitle);
                EditText text = (EditText) findViewById(R.id.noteContent);
                ArrayList<String> params = new ArrayList<String>();
                Collections.addAll(params, "mode", "1", "note_id", id,
                        "note_title", title.getText().toString(), "note_text", text.getText().toString());
                try {
                    String response = session.fetchURL(
                            new URL("https://prometheus.bammeson.com/notes.cgi"), params);
                    if (response.contains("success")) {
                        // TODO success dialog
                        finish();
                    } else if (response.contains("none")) {
                        // TODO Failure dialog
                    } else if (response.contains("extra")) {
                        // TODO Print very confused statement
                    }
                } catch (MalformedURLException e) {
                    e.printStackTrace();
                }
            }
        });

        cancel.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View view) {
                // TODO prompt here for discard changes
                finish();
            }
        });
    }

    @Override
    public boolean onCreateOptionsMenu(Menu menu) {
        // Inflate the menu; this adds items to the action bar if it is present.
        getMenuInflater().inflate(R.menu.menu_note_edit, menu);
        return true;
    }

    @Override
    public boolean onOptionsItemSelected(MenuItem item) {
        // Handle action bar item clicks here. The action bar will
        // automatically handle clicks on the Home/Up button, so long
        // as you specify a parent activity in AndroidManifest.xml.
        int id = item.getItemId();

        //noinspection SimplifiableIfStatement
        if (id == R.id.action_settings) {
            return true;
        }

        return super.onOptionsItemSelected(item);
    }
}
