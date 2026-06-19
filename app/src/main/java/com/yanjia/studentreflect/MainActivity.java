package com.yanjia.studentreflect;

import android.app.Activity;
import android.app.AppOpsManager;
import android.app.usage.UsageEvents;
import android.app.usage.UsageStatsManager;
import android.content.Context;
import android.content.Intent;
import android.content.pm.ApplicationInfo;
import android.content.pm.PackageManager;
import android.os.Bundle;
import android.provider.Settings;
import android.webkit.JavascriptInterface;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Toast;
import org.json.JSONArray;
import org.json.JSONObject;
import java.util.HashMap;
import java.util.Map;

public class MainActivity extends Activity {
    private WebView webView;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        webView = new WebView(this);
        setContentView(webView);

        WebSettings s = webView.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setDatabaseEnabled(true);
        s.setAllowFileAccess(true);
        s.setAllowContentAccess(true);
        s.setTextZoom(100);

        webView.setWebViewClient(new WebViewClient());
        webView.addJavascriptInterface(new AndroidBridge(), "AndroidBridge");
        webView.loadUrl("file:///android_asset/app.html");
    }

    @Override
    public void onBackPressed() {
        if (webView != null && webView.canGoBack()) webView.goBack();
        else super.onBackPressed();
    }

    public class AndroidBridge {
        @JavascriptInterface
        public boolean hasUsagePermission() {
            try {
                AppOpsManager appOps = (AppOpsManager) getSystemService(Context.APP_OPS_SERVICE);
                int mode = appOps.checkOpNoThrow(AppOpsManager.OPSTR_GET_USAGE_STATS,
                        android.os.Process.myUid(), getPackageName());
                return mode == AppOpsManager.MODE_ALLOWED;
            } catch (Exception e) {
                return false;
            }
        }

        @JavascriptInterface
        public void openUsageSettings() {
            runOnUiThread(() -> {
                try {
                    Intent intent = new Intent(Settings.ACTION_USAGE_ACCESS_SETTINGS);
                    startActivity(intent);
                } catch (Exception e) {
                    Toast.makeText(MainActivity.this, "无法打开使用情况访问设置", Toast.LENGTH_SHORT).show();
                }
            });
        }

        @JavascriptInterface
        public String queryUsageEvents(String startMillis, String endMillis) {
            JSONArray out = new JSONArray();
            try {
                long start = Long.parseLong(startMillis);
                long end = Long.parseLong(endMillis);
                UsageStatsManager usm = (UsageStatsManager) getSystemService(Context.USAGE_STATS_SERVICE);
                UsageEvents events = usm.queryEvents(start, end);
                UsageEvents.Event event = new UsageEvents.Event();
                Map<String, Long> active = new HashMap<>();
                while (events.hasNextEvent()) {
                    events.getNextEvent(event);
                    String pkg = event.getPackageName();
                    int type = event.getEventType();
                    long ts = event.getTimeStamp();
                    if (pkg == null || pkg.equals(getPackageName())) continue;
                    if (type == UsageEvents.Event.MOVE_TO_FOREGROUND || type == UsageEvents.Event.ACTIVITY_RESUMED) {
                        active.put(pkg, ts);
                    } else if (type == UsageEvents.Event.MOVE_TO_BACKGROUND || type == UsageEvents.Event.ACTIVITY_PAUSED) {
                        Long st = active.remove(pkg);
                        if (st != null && ts > st) {
                            JSONObject o = new JSONObject();
                            o.put("s", st);
                            o.put("e", ts);
                            o.put("key", pkg);
                            o.put("label", labelFor(pkg));
                            o.put("src", "system");
                            out.put(o);
                        }
                    }
                }
            } catch (Exception e) {
                try { out.put(new JSONObject().put("error", e.toString())); } catch (Exception ignored) {}
            }
            return out.toString();
        }

        private String labelFor(String pkg) {
            try {
                PackageManager pm = getPackageManager();
                ApplicationInfo ai = pm.getApplicationInfo(pkg, 0);
                CharSequence label = pm.getApplicationLabel(ai);
                return label == null ? pkg : label.toString();
            } catch (Exception e) {
                return pkg;
            }
        }
    }
}
