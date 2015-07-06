package com.bammeson.prometheus;

import android.app.Activity;
import android.content.Intent;
import android.os.Bundle;
import android.util.Log;
import android.view.Menu;
import android.view.MenuItem;
import android.view.View;
import android.widget.AdapterView;
import android.widget.ArrayAdapter;
import android.widget.ListView;

import java.util.ArrayList;
import java.util.Collections;


public class NotesActivity extends Activity {
    ArrayList<Note> notes;
    SessionManager session;

    // TODO add creation capability - settings, or title bar?
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_notes);

        Intent i = new Intent();
        session = (SessionManager) i.getSerializableExtra("session");
        if (!session.isAuthenticated()) {
            Log.e("NotesActivity", "Not logged in");
            finish();
            return;
        }

        notes = session.getNotes();
        Collections.sort(notes);
        ArrayList<String> noteTitles = new ArrayList<String>();
        for (Note n : notes) {
            noteTitles.add(n.getTitle());
        }
        ListView noteList = (ListView) findViewById(R.id.notesList);
        ArrayAdapter<String> adp = new ArrayAdapter<String>(this,
                android.R.layout.simple_list_item_1, noteTitles);
        noteList.setAdapter(adp);

        noteList.setOnItemClickListener(new AdapterView.OnItemClickListener() {
            @Override
            public void onItemClick(AdapterView<?> adapterView, View view, int pos, long l) {
                Intent i = new Intent(getApplicationContext(), NoteEditActivity.class);
                i.putExtra("session", session);
                i.putExtra("id", notes.get(pos).getId());
                i.putExtra("title", notes.get(pos).getTitle());
                i.putExtra("text", notes.get(pos).getText());
                startActivity(i);
            }
        });
    }

    @Override
    public boolean onCreateOptionsMenu(Menu menu) {
        // Inflate the menu; this adds items to the action bar if it is present.
        getMenuInflater().inflate(R.menu.menu_notes, menu);
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
