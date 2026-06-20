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
import java.util.HashMap;
import java.util.Map;

public class MainActivity extends Activity {
    private static final int REQ_CREATE_BACKUP = 2101;
    private static final int REQ_OPEN_BACKUP = 2102;
    private WebView webView;
    private String pendingBackupJson = "";

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
    protected void onResume() {
        super.onResume();
        if (webView != null) {
            webView.postDelayed(() -> webView.evaluateJavascript("if(window.onNativeResume){window.onNativeResume();}", null), 300);
        }
    }

    @Override
    public void onBackPressed() {
        if (webView != null && webView.canGoBack()) webView.goBack();
        else super.onBackPressed();
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        if (resultCode != RESULT_OK || data == null || data.getData() == null) return;
        Uri uri = data.getData();
        if (requestCode == REQ_CREATE_BACKUP) {
            try (OutputStream os = getContentResolver().openOutputStream(uri)) {
                if (os == null) throw new Exception("无法打开保存位置");
                os.write(pendingBackupJson.getBytes(StandardCharsets.UTF_8));
                os.flush();
                callJs("if(window.onNativeBackupSaved){window.onNativeBackupSaved(true,'');}");
                Toast.makeText(this, "备份文件已保存", Toast.LENGTH_SHORT).show();
            } catch (Exception e) {
                callJs("if(window.onNativeBackupSaved){window.onNativeBackupSaved(false," + JSONObject.quote(e.toString()) + ");}");
                Toast.makeText(this, "保存失败：" + e.getMessage(), Toast.LENGTH_LONG).show();
            }
        } else if (requestCode == REQ_OPEN_BACKUP) {
            try (InputStream is = getContentResolver().openInputStream(uri)) {
                if (is == null) throw new Exception("无法打开文件");
                BufferedReader br = new BufferedReader(new InputStreamReader(is, StandardCharsets.UTF_8));
                StringBuilder sb = new StringBuilder();
                String line;
                while ((line = br.readLine()) != null) sb.append(line).append('\n');
                callJs("if(window.onNativeBackupLoaded){window.onNativeBackupLoaded(" + JSONObject.quote(sb.toString()) + ");}");
            } catch (Exception e) {
                Toast.makeText(this, "读取失败：" + e.getMessage(), Toast.LENGTH_LONG).show();
            }
        }
    }

    private void callJs(String script) {
        if (webView != null) webView.post(() -> webView.evaluateJavascript(script, null));
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
        public void saveBackupFile(String json, String filename) {
            runOnUiThread(() -> {
                try {
                    pendingBackupJson = json == null ? "{}" : json;
                    Intent intent = new Intent(Intent.ACTION_CREATE_DOCUMENT);
                    intent.addCategory(Intent.CATEGORY_OPENABLE);
                    intent.setType("application/json");
                    intent.putExtra(Intent.EXTRA_TITLE, (filename == null || filename.trim().isEmpty()) ? "student_reflect_backup.json" : filename);
                    startActivityForResult(intent, REQ_CREATE_BACKUP);
                } catch (Exception e) {
                    Toast.makeText(MainActivity.this, "无法打开保存文件窗口：" + e.getMessage(), Toast.LENGTH_LONG).show();
                }
            });
        }

        @JavascriptInterface
        public void openBackupFile() {
            runOnUiThread(() -> {
                try {
                    Intent intent = new Intent(Intent.ACTION_OPEN_DOCUMENT);
                    intent.addCategory(Intent.CATEGORY_OPENABLE);
                    intent.setType("*/*");
                    startActivityForResult(intent, REQ_OPEN_BACKUP);
                } catch (Exception e) {
                    Toast.makeText(MainActivity.this, "无法打开文件选择窗口：" + e.getMessage(), Toast.LENGTH_LONG).show();
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
                            out.put(usageJson(st, ts, pkg));
                        }
                    }
                }
                // 有些系统在查询窗口结束时没有给最后一个 App 的后台事件。
                // 这里把仍在前台的 App 截到查询结束，避免“明明打开了别的 App 但没有记录”。
                for (Map.Entry<String, Long> entry : active.entrySet()) {
                    long st = entry.getValue();
                    if (end > st) out.put(usageJson(st, end, entry.getKey()));
                }
            } catch (Exception e) {
                try { out.put(new JSONObject().put("error", e.toString())); } catch (Exception ignored) {}
            }
            return out.toString();
        }

        private JSONObject usageJson(long st, long ts, String pkg) throws Exception {
            JSONObject o = new JSONObject();
            o.put("s", st);
            o.put("e", ts);
            o.put("key", pkg);
            o.put("label", labelFor(pkg));
            o.put("src", "system");
            return o;
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
