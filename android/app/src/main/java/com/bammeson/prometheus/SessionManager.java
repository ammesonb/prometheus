package com.bammeson.prometheus;

import android.content.Context;
import android.net.ConnectivityManager;
import android.net.NetworkInfo;
import android.util.Log;

import org.apache.http.HttpResponse;
import org.apache.http.NameValuePair;
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
import java.net.HttpCookie;
import java.net.MalformedURLException;
import java.net.URL;
import java.security.InvalidKeyException;
import java.security.NoSuchAlgorithmException;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.Map;

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
    private static SessionManager instance;
    CookieManager cookieManager;
    private String sessionID;
    private String aesKey;
    private boolean authenticated = false;

    private SessionManager(Context ctx) {
        Log.i("SessionManager", "Creating new instance");
        Log.i("SessionManager", "Verifying internet connectivity");
        ConnectivityManager connmgr = (ConnectivityManager) ctx.getSystemService(Context.CONNECTIVITY_SERVICE);
        NetworkInfo networkInfo = connmgr.getActiveNetworkInfo();
        if (networkInfo == null || !networkInfo.isConnected()) {
            Log.e("SessionManager", "No internet connection detected");
            return;
        }

        Log.d("SessionManager", "Setting cookie handler");
        cookieManager = new CookieManager();
        CookieHandler.setDefault(cookieManager);

        class Auth implements Runnable {

            @Override
            public void run() {
                try {
                    String data = fetchURL(new URL("https://prometheus.bammeson.com"), new ArrayList<String>());
                    SessionManager sm = SessionManager.getInstance();
                    sm.setAesKey(data.split("var master_key = '")[1].split("'")[0]);
                    List<HttpCookie> cookies = cookieManager.getCookieStore().getCookies();
                    for (HttpCookie c : cookies) {
                        if (c.getName().equalsIgnoreCase("CGISESSID")) {
                            sm.setSessionID(c.getValue());
                        }
                    }
                } catch (IOException e) {
                    Log.e("SessionManager", "Failed to fetch auth data");
                    e.printStackTrace();
                }
            }
        }

        Thread auth = new Thread(new Auth());
        auth.start();

    }

    public static SessionManager getInstance(Context ctx) {
        if (instance == null) instance = new SessionManager(ctx);
        return instance;
    }

    public static SessionManager getInstance() {
        return instance;
    }

    public String getAesKey() {
        return aesKey;
    }

    private void setAesKey(String aesKey) {
        Log.d("SessionManager", "Got AES key " + aesKey);
        this.aesKey = aesKey;
    }

    public String getSessionID() {
        return sessionID;
    }

    private void setSessionID(String sessionID) {
        Log.d("SessionManager", "Got session ID " + sessionID);
        this.sessionID = sessionID;
    }

    protected boolean authenticate(String user, String pass) {
        Log.i("SessionManager", "Attempting authentication");
        try {
            SecretKeySpec skeySpec = new SecretKeySpec(aesKey.getBytes("UTF-8"), "AES");
            Cipher cipher = Cipher.getInstance("AES/CBC");
            cipher.init(Cipher.ENCRYPT_MODE, skeySpec);
            byte[] encPass = cipher.doFinal(pass.getBytes());
            // This needs to be encoded into hex or base64 or something
            ArrayList<String> auth = new ArrayList<>();
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

        } catch (UnsupportedEncodingException | NoSuchAlgorithmException | InvalidKeyException |
                BadPaddingException | IllegalBlockSizeException | NoSuchPaddingException e) {
            e.printStackTrace();
        }
        return false;
    }

    protected String fetchURL(URL url, ArrayList<String> postData) {
        Log.v("SessionManager", "Fetching URL " + url.getPath());
        if (postData.size() == 0) {
            HttpsURLConnection conn;
            int read = 0;
            byte[] data = new byte[50000];
            InputStream in;
            try {
                conn = (HttpsURLConnection) url.openConnection();
                in = new BufferedInputStream(conn.getInputStream());
                Log.v("SessionManager", "Available data: " + in.available());
                while (in.available() > 0) {
                    // If exceeds available size, create new array with another 50K of storage
                    if (read + in.available() > data.length) {
                        byte[] data2 = new byte[data.length + 50000];
                        System.arraycopy(data, 0, data2, 0, data.length);
                        data = data2;
                    }
                    read += in.read(data);
                }

                Map<String, List<String>> headerFields = conn.getHeaderFields();
                List<String> cookiesHeader = headerFields.get("Set-Cookie");
                if (cookiesHeader != null) {
                    List<HttpCookie> cookies = cookieManager.getCookieStore().getCookies();
                    for (String cookie : cookiesHeader) {
                        HttpCookie hCookie = HttpCookie.parse(cookie).get(0);
                        boolean exists = false;
                        for (HttpCookie c : cookies)
                            if (c.getName().equals(hCookie.getName()) &&
                                    c.getValue().equals(hCookie.getValue())) {
                                exists = true;
                                break;
                            }

                        if (!exists) cookieManager.getCookieStore().add(null, hCookie);
                    }
                } else {
                    Log.e("SessionManager", "Received no cookie headers from server!");
                }
                conn.disconnect();
            } catch (IOException e) {
                e.printStackTrace();
                return "";
            }

            if (read <= 0) {
                Log.e("SessionManager", "No data received from: " + url.toString());
                return "";
            }

            Log.v("SessionManager", "Post returned string of length " + new String(data).length());
            return new String(data);
        } else {
            HttpClient client = new DefaultHttpClient();
            HttpPost post = new HttpPost(url.toString());
            List<NameValuePair> values = new ArrayList<>(postData.size() / 2);
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
                Log.v("SessionManager", "Get returned string of length " + response.toString().length());
                return response.toString();
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
        ArrayList<Note> notes = new ArrayList<>();
        String data;
        try {
            data = fetchURL(new URL("https://prometheus.bammeson.com/notes.cgi"),
                    new ArrayList<>(Arrays.asList("mode", "0")));
        } catch (MalformedURLException e) {
            e.printStackTrace();
            return null;
        }
        // TODO convert fetchURL string to something compatible with JsonReader (InputStream)
        return notes;
    }

    public ArrayList<String> getApps() {
        // TODO fetch list of allowed apps - parse from landing?
        return null;
    }
}
