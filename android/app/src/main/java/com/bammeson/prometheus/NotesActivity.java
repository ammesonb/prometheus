package com.bammeson.prometheus;

import android.app.Activity;
import android.os.Bundle;
import android.util.Log;
import android.view.Menu;
import android.view.MenuItem;
import android.widget.ListView;

import java.util.ArrayList;


public class NotesActivity extends Activity {

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_notes);

        SessionManager session = new SessionManager(getApplicationContext());
        if (!session.isAuthenticated()) {
            Log.e("NotesActivity", "Not logged in");
            // TODO should go back a screen
            return;
        }

        ArrayList<Note> notes = session.getNotes();
        ListView noteList = (ListView)findViewById(R.id.notesList);
        // TODO set adapter and load it using returned data
        //noteList.setAdapter();
        // TODO add onclick handler to go to note selection screen
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
