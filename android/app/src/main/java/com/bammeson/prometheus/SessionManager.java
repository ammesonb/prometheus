package com.bammeson.prometheus;

import android.content.Context;
import android.net.ConnectivityManager;
import android.net.NetworkInfo;
import android.util.Log;

import org.apache.http.HttpResponse;
import org.apache.http.NameValuePair;
import org.apache.http.client.ClientProtocolException;
import org.apache.http.client.HttpClient;
import org.apache.http.client.entity.UrlEncodedFormEntity;
import org.apache.http.client.methods.HttpPost;
import org.apache.http.impl.client.DefaultHttpClient;
import org.apache.http.message.BasicNameValuePair;

import java.io.BufferedInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.UnsupportedEncodingException;
import java.net.CookieHandler;
import java.net.CookieManager;
import java.net.MalformedURLException;
import java.net.URL;
import java.security.InvalidKeyException;
import java.security.NoSuchAlgorithmException;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;

import javax.crypto.BadPaddingException;
import javax.crypto.Cipher;
import javax.crypto.IllegalBlockSizeException;
import javax.crypto.NoSuchPaddingException;
import javax.crypto.spec.SecretKeySpec;
import javax.net.ssl.HttpsURLConnection;

/**
 * Created by brett on 7/2/15.
 * This class is the interface which will handle all
 * network requests and data forwarding between the server
 * and the Android application
 */
public class SessionManager {
    private String sessionID;
    private String aesKey;
    private boolean authenticated = false;

    SessionManager(Context ctx) {
        ConnectivityManager connmgr = (ConnectivityManager)ctx.getSystemService(Context.CONNECTIVITY_SERVICE);
        NetworkInfo networkInfo = connmgr.getActiveNetworkInfo();
        if (networkInfo == null || !networkInfo.isConnected()) {
            Log.e("SessionManager", "No internet connection detected");
            return;
        }

        CookieManager cookieManager = new CookieManager();
        CookieHandler.setDefault(cookieManager);

        try {
            String data = fetchURL(new URL("https://prometheus.bammeson.com"), new ArrayList<String>());
            aesKey = data.split("var master_key = '")[1].split("'")[0];
            // TODO Session ID should be set here too
        } catch (IOException e) {
            e.printStackTrace();
        }
    }

    protected String getID() {
        return sessionID;
    }

    protected boolean authenticate(String user, String pass) {
        try {
            SecretKeySpec skeySpec = new SecretKeySpec(aesKey.getBytes("UTF-8"), "AES");
            Cipher cipher = Cipher.getInstance("AES/CBC");
            cipher.init(Cipher.ENCRYPT_MODE, skeySpec);
            byte[] encPass = cipher.doFinal(pass.getBytes());
            // This needs to be encoded into hex or base64 or something
            ArrayList<String> auth = new ArrayList<String>();
            auth.add("a");
            auth.add(user);
            auth.add("c");
            auth.add(new String(encPass));
            auth.add("t");
            // TODO get actual timezone
            auth.add("America/New York");
            try {
                String response = fetchURL(new URL("https://prometheus.bammeson.com/login.cgi"), auth);
                // TODO response should have a redirect if it is authorized, so proceed
                authenticated = true;
            } catch (MalformedURLException e) {
                e.printStackTrace();
            }

        } catch (UnsupportedEncodingException e) {
            e.printStackTrace();
        } catch (NoSuchAlgorithmException e) {
            e.printStackTrace();
        } catch (NoSuchPaddingException e) {
            e.printStackTrace();
        } catch (InvalidKeyException e) {
            e.printStackTrace();
        } catch (BadPaddingException e) {
            e.printStackTrace();
        } catch (IllegalBlockSizeException e) {
            e.printStackTrace();
        }
        return false;
    }

    private String fetchURL(URL url, ArrayList<String> postData) {
        if (postData.size() == 0) {
            HttpsURLConnection conn;
            int read;
            byte[] data;
            try {
                conn = (HttpsURLConnection)url.openConnection();
                InputStream in = new BufferedInputStream(conn.getInputStream());
                data = new byte[in.available()];
                read = in.read(data);
                conn.disconnect();
            } catch (IOException e) {
                e.printStackTrace();
                return "";
            }

            if (read <= 0) {
                Log.e("SessionManager", "No data received from: " + url.toString());
                return "";
            }

            return new String(data);
        } else {
            HttpClient client = new DefaultHttpClient();
            HttpPost post = new HttpPost(url.toString());
            List<NameValuePair> values = new ArrayList<NameValuePair>(postData.size() / 2);
            for (int i = 0; i < postData.size(); i += 2) {
                values.add(new BasicNameValuePair(postData.get(i), postData.get(i + 1)));
            }
            try {
                post.setEntity(new UrlEncodedFormEntity(values));
                HttpResponse response = client.execute(post);
                if (response.toString().length() == 0) {
                    Log.e("SessionManager", "No data received from: " + url.toString());
                    return "";
                }
                return response.toString();
            } catch (UnsupportedEncodingException e) {
                e.printStackTrace();
            } catch (ClientProtocolException e) {
                e.printStackTrace();
            } catch (IOException e) {
                e.printStackTrace();
            }

            return "";
        }
    }

    public boolean isAuthenticated() {
        return authenticated;
    }

    public ArrayList<Note> getNotes() {
        ArrayList<Note> notes = new ArrayList<Note>();
        String data;
        try {
            data = fetchURL(new URL("https://prometheus.bammeson.com/notes.cgi"),
                    new ArrayList<String>(Arrays.asList("mode", "0")));
        } catch (MalformedURLException e) {
            e.printStackTrace();
            return null;
        }
        // TODO convert fetchURL string to something compatible with JsonReader (InputStream)
        // then load it into the list view
        return notes;
    }
}
