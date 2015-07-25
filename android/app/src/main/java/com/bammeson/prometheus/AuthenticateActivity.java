package com.bammeson.prometheus;

import android.app.Activity;
import android.content.Intent;
import android.os.Bundle;
import android.view.Menu;
import android.view.MenuItem;
import android.view.View;
import android.widget.Button;
import android.widget.EditText;
import android.widget.ImageView;


public class AuthenticateActivity extends Activity {

    SessionManager session;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_authenticate);

        session = SessionManager.getInstance(getApplicationContext());

        ImageView logo = (ImageView) findViewById(R.id.prometheusLogo);
        logo.setImageResource(R.drawable.prometheus);

        Button loginButton = (Button) findViewById(R.id.loginButton);
        loginButton.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View view) {
                EditText user = (EditText) findViewById(R.id.userInput);
                EditText pass = (EditText) findViewById(R.id.passInput);
                String un = user.getText().toString();
                if (!un.matches("[a-zA-Z0-9_-]+")) {
                    // TODO Print error
                    return;
                }

                if (session.authenticate(un, pass.getText().toString())) {
                    Intent i = new Intent(getApplicationContext(), AppSelectActivity.class);
                    startActivity(i);
                } else {
                    // TODO Print failure message
                }
            }
        });
    }

    @Override
    public boolean onCreateOptionsMenu(Menu menu) {
        // Inflate the menu; this adds items to the action bar if it is present.
        getMenuInflater().inflate(R.menu.menu_authenticate, menu);
        return true;
    }

    @Override
    public boolean onOptionsItemSelected(MenuItem item) {
        // Handle action bar item clicks here. The action bar will
        // automatically handle clicks on the Home/Up button, so long
        // as you specify a Log inparent activity in AndroidManifest.xml.
        int id = item.getItemId();

        //noinspection SimplifiableIfStatement
        if (id == R.id.action_settings) {
            return true;
        }

        return super.onOptionsItemSelected(item);
    }
}
