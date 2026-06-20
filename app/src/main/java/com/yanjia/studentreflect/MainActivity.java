package com.yanjia.studentreflect;

import android.app.Activity;
import android.app.AppOpsManager;
import android.app.usage.UsageEvents;
import android.app.usage.UsageStatsManager;
import android.content.Context;
import android.content.Intent;
import android.content.pm.ApplicationInfo;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Bundle;
import android.os.Process;
import android.provider.Settings;
import android.webkit.JavascriptInterface;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Toast;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.BufferedReader;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;

public class MainActivity extends Activity {
    private static final int REQ_CREATE_BACKUP = 3001;
    private static final int REQ_OPEN_BACKUP = 3002;

    private WebView webView;
    private String pendingSaveText = null;
    private String pendingSaveName = "student_reflect_backup.json";

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        webView = new WebView(this);
        setContentView(webView);

        WebSettings s = webView.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setAllowFileAccess(true);
        s.setAllowContentAccess(true);
        s.setDatabaseEnabled(true);
        s.setLoadWithOverviewMode(true);
        s.setUseWideViewPort(true);

        webView.setWebViewClient(new WebViewClient());
        webView.addJavascriptInterface(new Bridge(), "AndroidBridge");
        webView.loadUrl("file:///android_asset/app.html");
    }

    @Override
    public void onBackPressed() {
        if (webView != null && webView.canGoBack()) {
            webView.goBack();
        } else {
            super.onBackPressed();
        }
    }

    private String getAppLabel(String pkg) {
        try {
            PackageManager pm = getPackageManager();
            ApplicationInfo info = pm.getApplicationInfo(pkg, 0);
            CharSequence label = pm.getApplicationLabel(info);
            if (label != null) return label.toString();
        } catch (Exception ignored) {}
        return pkg;
    }

    private void callJs(String js) {
        runOnUiThread(() -> {
            if (webView != null) webView.evaluateJavascript(js, null);
        });
    }

    private static String jsQuote(String s) {
        return JSONObject.quote(s == null ? "" : s);
    }

    public class Bridge {
        @JavascriptInterface
        public boolean hasUsagePermission() {
            try {
                AppOpsManager appOps = (AppOpsManager) getSystemService(Context.APP_OPS_SERVICE);
                int mode = appOps.checkOpNoThrow(AppOpsManager.OPSTR_GET_USAGE_STATS, Process.myUid(), getPackageName());
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
                    intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                    startActivity(intent);
                } catch (Exception e) {
                    Toast.makeText(MainActivity.this, "无法打开权限设置，请手动搜索：使用情况访问权限", Toast.LENGTH_LONG).show();
                }
            });
        }

        @JavascriptInterface
        public String queryUsageEvents(String startMs, String endMs) {
            JSONArray out = new JSONArray();
            try {
                long start = Long.parseLong(startMs);
                long end = Long.parseLong(endMs);
                UsageStatsManager usm = (UsageStatsManager) getSystemService(Context.USAGE_STATS_SERVICE);
                if (usm == null) return out.toString();

                UsageEvents events = usm.queryEvents(start, end);
                UsageEvents.Event event = new UsageEvents.Event();
                String currentPkg = null;
                long currentStart = 0L;

                while (events.hasNextEvent()) {
                    events.getNextEvent(event);
                    int type = event.getEventType();
                    String pkg = event.getPackageName();
                    long t = event.getTimeStamp();

                    boolean foreground = (type == UsageEvents.Event.MOVE_TO_FOREGROUND || type == UsageEvents.Event.ACTIVITY_RESUMED);
                    boolean background = (type == UsageEvents.Event.MOVE_TO_BACKGROUND || type == UsageEvents.Event.ACTIVITY_PAUSED || type == UsageEvents.Event.ACTIVITY_STOPPED);

                    if (foreground) {
                        if (currentPkg != null && currentStart > 0 && t > currentStart) {
                            addUsage(out, currentPkg, currentStart, t);
                        }
                        currentPkg = pkg;
                        currentStart = t;
                    } else if (background && currentPkg != null && currentPkg.equals(pkg)) {
                        if (t > currentStart) addUsage(out, currentPkg, currentStart, t);
                        currentPkg = null;
                        currentStart = 0L;
                    }
                }
                if (currentPkg != null && currentStart > 0 && end > currentStart) {
                    addUsage(out, currentPkg, currentStart, end);
                }
            } catch (Exception e) {
                try {
                    JSONObject err = new JSONObject();
                    err.put("error", e.getMessage());
                    out.put(err);
                } catch (Exception ignored) {}
            }
            return out.toString();
        }

        private void addUsage(JSONArray out, String pkg, long s, long e) throws Exception {
            if (pkg == null || e <= s) return;
            // 太短的系统切换记录容易造成误判，过滤 3 秒以下记录。
            if (e - s < 3000L) return;
            JSONObject o = new JSONObject();
            o.put("s", s);
            o.put("e", e);
            o.put("key", pkg);
            o.put("label", getAppLabel(pkg));
            o.put("src", "system");
            out.put(o);
        }

        @JavascriptInterface
        public void saveBackupFile(String text, String filename) {
            pendingSaveText = text == null ? "" : text;
            pendingSaveName = (filename == null || filename.trim().isEmpty()) ? "student_reflect_backup.json" : filename.trim();
            runOnUiThread(() -> {
                try {
                    Intent intent = new Intent(Intent.ACTION_CREATE_DOCUMENT);
                    intent.addCategory(Intent.CATEGORY_OPENABLE);
                    intent.setType("application/json");
                    intent.putExtra(Intent.EXTRA_TITLE, pendingSaveName);
                    startActivityForResult(intent, REQ_CREATE_BACKUP);
                } catch (Exception e) {
                    callJs("window.onNativeBackupSaved && window.onNativeBackupSaved(false," + jsQuote(e.getMessage()) + ")");
                }
            });
        }

        @JavascriptInterface
        public void openBackupFile() {
            runOnUiThread(() -> {
                try {
                    Intent intent = new Intent(Intent.ACTION_OPEN_DOCUMENT);
                    intent.addCategory(Intent.CATEGORY_OPENABLE);
                    intent.setType("application/json");
                    startActivityForResult(intent, REQ_OPEN_BACKUP);
                } catch (Exception e) {
                    Toast.makeText(MainActivity.this, "无法打开文件选择器", Toast.LENGTH_LONG).show();
                }
            });
        }
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        if (resultCode != RESULT_OK || data == null || data.getData() == null) {
            if (requestCode == REQ_CREATE_BACKUP) callJs("window.onNativeBackupSaved && window.onNativeBackupSaved(false,'已取消')");
            return;
        }
        Uri uri = data.getData();
        if (requestCode == REQ_CREATE_BACKUP) {
            try (OutputStream os = getContentResolver().openOutputStream(uri)) {
                if (os == null) throw new Exception("无法写入文件");
                os.write((pendingSaveText == null ? "" : pendingSaveText).getBytes(StandardCharsets.UTF_8));
                os.flush();
                callJs("window.onNativeBackupSaved && window.onNativeBackupSaved(true,'')");
            } catch (Exception e) {
                callJs("window.onNativeBackupSaved && window.onNativeBackupSaved(false," + jsQuote(e.getMessage()) + ")");
            }
        } else if (requestCode == REQ_OPEN_BACKUP) {
            try (InputStream is = getContentResolver().openInputStream(uri);
                 BufferedReader br = new BufferedReader(new InputStreamReader(is, StandardCharsets.UTF_8))) {
                StringBuilder sb = new StringBuilder();
                String line;
                while ((line = br.readLine()) != null) sb.append(line).append('\n');
                callJs("window.onNativeBackupLoaded && window.onNativeBackupLoaded(" + jsQuote(sb.toString()) + ")");
            } catch (Exception e) {
                Toast.makeText(this, "读取失败：" + e.getMessage(), Toast.LENGTH_LONG).show();
            }
        }
    }
}
