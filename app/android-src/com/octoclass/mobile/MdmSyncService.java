package com.octoclass.mobile;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.app.admin.DevicePolicyManager;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.app.usage.UsageEvents;
import android.app.usage.UsageStatsManager;
import android.content.pm.PackageManager;
import android.content.pm.ResolveInfo;
import android.media.AudioManager;
import android.os.Build;
import android.os.Handler;
import android.provider.Settings;
import android.os.IBinder;
import android.os.Looper;
import androidx.annotation.Nullable;
import androidx.core.app.NotificationCompat;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/**
 * Foreground service that keeps the process alive and periodically fetches device policies
 * from the backend, applying blockedApps (setApplicationHidden) via DevicePolicyManager.
 * Allows MDM control (hide/unhide apps on launcher) even when the main app is closed.
 * Requires Device Owner for setApplicationHidden to take effect.
 */
public class MdmSyncService extends Service {

  private static final String PREFS_NAME = "mdm_sync";
  private static final String KEY_DEVICE_ID = "device_id";
  private static final String KEY_API_URL = "api_url";
  private static final String KEY_LAST_USAGE_END = "last_usage_end";
  private static final String KEY_LAST_FOREGROUND_PKG = "last_foreground_pkg";
  private static final String KEY_ALLOWED_APPS = "allowed_apps";
  private static final String CHANNEL_ID = "mdm_sync_channel";
  private static final int NOTIFICATION_ID = 9001;
  private static final long POLL_INTERVAL_MS = 30_000L;
  private static final long USAGE_LOOKBACK_MS = 120_000L;
  private static final String ALERT_CHANNEL_ID = "mdm_alert_channel";
  private static final int ALERT_NOTIFICATION_ID = 9002;

  private final Set<String> lastBlockedPackages = new HashSet<>();
  private final ExecutorService executor = Executors.newSingleThreadExecutor();
  private final Handler mainHandler = new Handler(Looper.getMainLooper());
  private boolean running;

  public static void saveConfigAndStart(Context context, String deviceId, String apiUrl) {
    if (context == null || deviceId == null || deviceId.isEmpty() || apiUrl == null || apiUrl.isEmpty()) return;
    SharedPreferences prefs = context.getApplicationContext().getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
    prefs.edit().putString(KEY_DEVICE_ID, deviceId).putString(KEY_API_URL, apiUrl.trim().replaceAll("/$", "")).apply();
    Intent intent = new Intent(context, MdmSyncService.class);
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      context.startForegroundService(intent);
    } else {
      context.startService(intent);
    }
  }

  public static void stop(Context context) {
    if (context == null) return;
    context.stopService(new Intent(context, MdmSyncService.class));
  }

  @Override
  public void onCreate() {
    super.onCreate();
  }

  @Override
  public int onStartCommand(Intent intent, int flags, int startId) {
    createNotificationChannel();
    Notification notification = buildNotification();
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
      startForeground(NOTIFICATION_ID, notification, android.content.pm.ServiceInfo.FOREGROUND_SERVICE_TYPE_DATA_SYNC);
    } else if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
      startForeground(NOTIFICATION_ID, notification);
    } else {
      startForeground(NOTIFICATION_ID, notification);
    }
    running = true;
    scheduleNextPoll();
    return START_STICKY;
  }

  @Override
  public void onDestroy() {
    running = false;
    super.onDestroy();
  }

  @Nullable
  @Override
  public IBinder onBind(Intent intent) {
    return null;
  }

  private void createNotificationChannel() {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return;
    NotificationChannel channel = new NotificationChannel(
      CHANNEL_ID,
      "MDM em segundo plano",
      NotificationManager.IMPORTANCE_LOW
    );
    channel.setDescription("Mantém a sincronização de políticas do dispositivo com o painel.");
    NotificationManager nm = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
    if (nm != null) nm.createNotificationChannel(channel);
  }

  private Notification buildNotification() {
    Intent openIntent = getPackageManager().getLaunchIntentForPackage(getPackageName());
    PendingIntent pending = openIntent != null
      ? PendingIntent.getActivity(this, 0, openIntent, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE)
      : null;
    return new NotificationCompat.Builder(this, CHANNEL_ID)
      .setContentTitle("Octaclass MDM")
      .setContentText("Sincronizando políticas em segundo plano")
      .setSmallIcon(android.R.drawable.ic_lock_lock)
      .setContentIntent(pending)
      .setOngoing(true)
      .setPriority(NotificationCompat.PRIORITY_LOW)
      .build();
  }

  private void scheduleNextPoll() {
    if (!running) return;
    mainHandler.postDelayed(this::pollAndApply, POLL_INTERVAL_MS);
  }

  private void pollAndApply() {
    if (!running) return;
    executor.execute(() -> {
      try {
        SharedPreferences prefs = getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
        String deviceId = prefs.getString(KEY_DEVICE_ID, null);
        String baseUrl = prefs.getString(KEY_API_URL, null);
        if (deviceId == null || baseUrl == null) {
          scheduleNextPoll();
          return;
        }
        String urlStr = baseUrl + "/devices/" + deviceId;
        HttpURLConnection conn = null;
        try {
          URL url = new URL(urlStr);
          conn = (HttpURLConnection) url.openConnection();
          conn.setRequestMethod("GET");
          conn.setConnectTimeout(10000);
          conn.setReadTimeout(10000);
          int code = conn.getResponseCode();
          if (code != 200) {
            scheduleNextPoll();
            return;
          }
          StringBuilder sb = new StringBuilder();
          try (BufferedReader reader = new BufferedReader(new InputStreamReader(conn.getInputStream()))) {
            String line;
            while ((line = reader.readLine()) != null) sb.append(line);
          }
          JSONObject json = new JSONObject(sb.toString());
          JSONObject policies = json.optJSONObject("policies");
          if (policies != null) {
            JSONArray blocked = policies.optJSONArray("blockedApps");
            if (blocked != null) {
              Set<String> newBlocked = new HashSet<>();
              for (int i = 0; i < blocked.length(); i++) {
                String pkg = blocked.optString(i, null);
                if (pkg != null && !pkg.isEmpty()) newBlocked.add(pkg);
              }
              applyBlockedPackages(newBlocked);
            }
            JSONArray allowed = policies.optJSONArray("allowedApps");
            if (allowed != null) {
              Set<String> allowedSet = new HashSet<>();
              allowedSet.add(getPackageName());
              for (int i = 0; i < allowed.length(); i++) {
                String pkg = allowed.optString(i, null);
                if (pkg != null && !pkg.isEmpty()) allowedSet.add(pkg);
              }
              applyLockTaskPackages(allowedSet);
              getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
                .edit()
                .putString(KEY_ALLOWED_APPS, new JSONArray(new ArrayList<>(allowedSet)).toString())
                .apply();
            }
          }
          fetchAndExecutePendingCommands(baseUrl, deviceId);
          sendHeartbeat(baseUrl, deviceId);
          collectAndSendUsageStats(baseUrl, deviceId);
        } finally {
          if (conn != null) conn.disconnect();
        }
      } catch (Exception e) {
        if (BuildConfig.DEBUG) {
          android.util.Log.w("MdmSyncService", "poll error", e);
        }
      }
      scheduleNextPoll();
    });
  }

  private void fetchAndExecutePendingCommands(String baseUrl, String deviceId) {
    List<JSONObject> pending = fetchPendingCommands(baseUrl, deviceId);
    if (pending == null || pending.isEmpty()) return;
    List<String> ackIds = new ArrayList<>();
    for (int i = 0; i < pending.size(); i++) {
      JSONObject c = pending.get(i);
      String id = c.optString("id", null);
      final String type = c.optString("type", "");
      final JSONObject payload = c.optJSONObject("payload") != null ? c.optJSONObject("payload") : new JSONObject();
      mainHandler.post(() -> executeCommand(type, payload));
      postActivity(baseUrl, deviceId, "COMMAND_EXECUTED_BACKGROUND", type, payload);
      if (id != null && !id.isEmpty()) ackIds.add(id);
    }
    if (!ackIds.isEmpty()) postAck(baseUrl, deviceId, ackIds);
  }

  private List<JSONObject> fetchPendingCommands(String baseUrl, String deviceId) {
    HttpURLConnection conn = null;
    try {
      URL url = new URL(baseUrl + "/devices/" + deviceId + "/commands/pending");
      conn = (HttpURLConnection) url.openConnection();
      conn.setRequestMethod("GET");
      conn.setConnectTimeout(8000);
      conn.setReadTimeout(8000);
      if (conn.getResponseCode() != 200) return null;
      StringBuilder sb = new StringBuilder();
      try (BufferedReader reader = new BufferedReader(new InputStreamReader(conn.getInputStream()))) {
        String line;
        while ((line = reader.readLine()) != null) sb.append(line);
      }
      JSONArray arr = new JSONArray(sb.toString());
      List<JSONObject> list = new ArrayList<>();
      for (int i = 0; i < arr.length(); i++) {
        JSONObject o = arr.optJSONObject(i);
        if (o != null) list.add(o);
      }
      return list;
    } catch (Exception e) {
      if (BuildConfig.DEBUG) android.util.Log.w("MdmSyncService", "fetch pending commands", e);
      return null;
    } finally {
      if (conn != null) try { conn.disconnect(); } catch (Exception ignored) {}
    }
  }

  private void executeCommand(String type, JSONObject payload) {
    try {
      if ("LOCK_SCREEN".equals(type)) {
        DevicePolicyManager dpm = (DevicePolicyManager) getSystemService(Context.DEVICE_POLICY_SERVICE);
        ComponentName admin = new ComponentName(this, DeviceAdminReceiver.class);
        if (dpm != null && admin != null && dpm.isAdminActive(admin)) dpm.lockNow();
      } else if ("SET_BRIGHTNESS".equals(type)) {
        double level = payload.optDouble("level", 0.8);
        if (Settings.System.canWrite(this)) {
          int value = (int) Math.round(Math.max(0, Math.min(1, level)) * 255);
          getContentResolver();
          Settings.System.putInt(getContentResolver(), Settings.System.SCREEN_BRIGHTNESS_MODE, Settings.System.SCREEN_BRIGHTNESS_MODE_MANUAL);
          Settings.System.putInt(getContentResolver(), Settings.System.SCREEN_BRIGHTNESS, value);
        }
      } else if ("VOLUME".equals(type)) {
        double level = payload.optDouble("level", 0.8);
        AudioManager am = (AudioManager) getSystemService(Context.AUDIO_SERVICE);
        if (am != null) {
          int max = am.getStreamMaxVolume(AudioManager.STREAM_MUSIC);
          int vol = Math.max(0, Math.min(max, (int) Math.round(Math.max(0, Math.min(1, level)) * max)));
          am.setStreamVolume(AudioManager.STREAM_MUSIC, vol, AudioManager.FLAG_SHOW_UI);
        }
      } else if ("LAUNCH_APP".equals(type)) {
        String pkg = payload.optString("packageName", "");
        if (pkg != null && !pkg.isEmpty()) {
          ensurePackageInLockTaskAndLaunch(pkg);
        }
      } else if ("ALERT".equals(type)) {
        String message = payload.optString("message", "");
        showAlertNotification(message);
      }
    } catch (Exception e) {
      if (BuildConfig.DEBUG) android.util.Log.w("MdmSyncService", "executeCommand " + type, e);
    }
  }

  private void ensurePackageInLockTaskAndLaunch(String pkg) {
    SharedPreferences prefs = getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
    Set<String> allowedSet = new HashSet<>();
    allowedSet.add(getPackageName());
    String stored = prefs.getString(KEY_ALLOWED_APPS, null);
    if (stored != null && !stored.isEmpty()) {
      try {
        JSONArray arr = new JSONArray(stored);
        for (int i = 0; i < arr.length(); i++) {
          String s = arr.optString(i, null);
          if (s != null && !s.isEmpty()) allowedSet.add(s);
        }
      } catch (Exception ignored) {}
    }
    if (!allowedSet.contains(pkg)) {
      allowedSet.add(pkg);
      applyLockTaskPackages(allowedSet);
      try {
        prefs.edit().putString(KEY_ALLOWED_APPS, new JSONArray(new ArrayList<>(allowedSet)).toString()).apply();
      } catch (Exception ignored) {}
    }
    launchPackageFromService(pkg);
  }

  private void applyLockTaskPackages(Set<String> packages) {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.LOLLIPOP) return;
    DevicePolicyManager dpm = (DevicePolicyManager) getSystemService(Context.DEVICE_POLICY_SERVICE);
    ComponentName admin = new ComponentName(this, DeviceAdminReceiver.class);
    if (dpm == null || admin == null || !dpm.isAdminActive(admin)) return;
    try {
      dpm.setLockTaskPackages(admin, packages.toArray(new String[0]));
    } catch (Exception e) {
      if (BuildConfig.DEBUG) android.util.Log.w("MdmSyncService", "setLockTaskPackages", e);
    }
  }

  private void launchPackageFromService(String packageName) {
    if (packageName == null || packageName.isEmpty()) return;
    try {
      Intent launch = getPackageManager().getLaunchIntentForPackage(packageName);
      if (launch == null && ("com.google.android.deskclock".equals(packageName) || "com.android.deskclock".equals(packageName))) {
        String alt = "com.google.android.deskclock".equals(packageName) ? "com.android.deskclock" : "com.google.android.deskclock";
        launch = getPackageManager().getLaunchIntentForPackage(alt);
      }
      if (launch != null) {
        launch.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_RESET_TASK_IF_NEEDED);
        startActivity(launch);
        return;
      }
      Intent queryIntent = new Intent(Intent.ACTION_MAIN).addCategory(Intent.CATEGORY_LAUNCHER).setPackage(packageName);
      List<ResolveInfo> list = getPackageManager().queryIntentActivities(queryIntent, 0);
      if (list != null && !list.isEmpty() && list.get(0).activityInfo != null) {
        ResolveInfo ri = list.get(0);
        Intent generic = new Intent(Intent.ACTION_MAIN).addCategory(Intent.CATEGORY_LAUNCHER);
        generic.setComponent(new ComponentName(ri.activityInfo.packageName, ri.activityInfo.name));
        generic.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_RESET_TASK_IF_NEEDED);
        startActivity(generic);
      }
    } catch (Exception ignored) {}
  }

  private void showAlertNotification(String message) {
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      NotificationChannel channel = new NotificationChannel(ALERT_CHANNEL_ID, "Alertas MDM", NotificationManager.IMPORTANCE_HIGH);
      NotificationManager nm = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
      if (nm != null) nm.createNotificationChannel(channel);
    }
    NotificationCompat.Builder builder = new NotificationCompat.Builder(this, ALERT_CHANNEL_ID)
      .setContentTitle("Octaclass")
      .setContentText(message != null && !message.isEmpty() ? message : "Mensagem do professor")
      .setSmallIcon(android.R.drawable.ic_dialog_alert)
      .setPriority(NotificationCompat.PRIORITY_HIGH)
      .setAutoCancel(true);
    Intent openIntent = getPackageManager().getLaunchIntentForPackage(getPackageName());
    if (openIntent != null) {
      builder.setContentIntent(PendingIntent.getActivity(this, 0, openIntent, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE));
    }
    NotificationManager nm = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
    if (nm != null) nm.notify(ALERT_NOTIFICATION_ID, builder.build());
  }

  private void postActivity(String baseUrl, String deviceId, String action, String type, JSONObject payload) {
    HttpURLConnection conn = null;
    try {
      URL url = new URL(baseUrl + "/devices/" + deviceId + "/activity");
      conn = (HttpURLConnection) url.openConnection();
      conn.setRequestMethod("POST");
      conn.setRequestProperty("Content-Type", "application/json");
      conn.setDoOutput(true);
      conn.setConnectTimeout(5000);
      conn.setReadTimeout(5000);
      JSONObject body = new JSONObject();
      body.put("action", action);
      JSONObject details = new JSONObject();
      details.put("type", type);
      details.put("payload", payload != null ? payload : new JSONObject());
      body.put("details", details);
      try (OutputStream os = conn.getOutputStream()) {
        os.write(body.toString().getBytes(java.nio.charset.StandardCharsets.UTF_8));
      }
      conn.getResponseCode();
    } catch (Exception ignored) {
    } finally {
      if (conn != null) try { conn.disconnect(); } catch (Exception ignored) {}
    }
  }

  private void postAck(String baseUrl, String deviceId, List<String> commandIds) {
    HttpURLConnection conn = null;
    try {
      URL url = new URL(baseUrl + "/devices/" + deviceId + "/commands/ack");
      conn = (HttpURLConnection) url.openConnection();
      conn.setRequestMethod("POST");
      conn.setRequestProperty("Content-Type", "application/json");
      conn.setDoOutput(true);
      conn.setConnectTimeout(5000);
      conn.setReadTimeout(5000);
      JSONObject body = new JSONObject();
      JSONArray arr = new JSONArray();
      for (String id : commandIds) arr.put(id);
      body.put("commandIds", arr);
      try (OutputStream os = conn.getOutputStream()) {
        os.write(body.toString().getBytes(java.nio.charset.StandardCharsets.UTF_8));
      }
      conn.getResponseCode();
    } catch (Exception ignored) {
    } finally {
      if (conn != null) try { conn.disconnect(); } catch (Exception ignored) {}
    }
  }

  private void collectAndSendUsageStats(String baseUrl, String deviceId) {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.LOLLIPOP) return;
    SharedPreferences prefs = getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
    long endTime = System.currentTimeMillis();
    long startTime = prefs.getLong(KEY_LAST_USAGE_END, endTime - USAGE_LOOKBACK_MS);
    if (endTime - startTime < 10_000) return;
    try {
      UsageStatsManager usm = (UsageStatsManager) getSystemService(Context.USAGE_STATS_SERVICE);
      if (usm == null) return;
      UsageEvents.Event event = new UsageEvents.Event();
      List<JSONObject> foregroundEvents = new ArrayList<>();
      List<JSONObject> backgroundEvents = new ArrayList<>();
      String lastPkg = prefs.getString(KEY_LAST_FOREGROUND_PKG, null);
      UsageEvents usageEvents = usm.queryEvents(startTime, endTime);
      while (usageEvents.hasNextEvent()) {
        usageEvents.getNextEvent(event);
        if (event.getEventType() == UsageEvents.Event.MOVE_TO_FOREGROUND) {
          String pkg = event.getPackageName();
          if (pkg != null && !pkg.isEmpty()) {
            if (lastPkg != null && !lastPkg.equals(pkg)) {
              JSONObject bg = new JSONObject();
              bg.put("package", lastPkg);
              bg.put("timestamp", event.getTimeStamp());
              backgroundEvents.add(bg);
            }
            JSONObject fg = new JSONObject();
            fg.put("package", pkg);
            fg.put("timestamp", event.getTimeStamp());
            foregroundEvents.add(fg);
            lastPkg = pkg;
          }
        }
      }
      if (lastPkg != null) prefs.edit().putString(KEY_LAST_FOREGROUND_PKG, lastPkg).apply();
      prefs.edit().putLong(KEY_LAST_USAGE_END, endTime).apply();
      if (!foregroundEvents.isEmpty()) {
        postUsageEvents(baseUrl, deviceId, "USAGE_APP_FOREGROUND", foregroundEvents);
      }
      if (!backgroundEvents.isEmpty()) {
        postUsageEvents(baseUrl, deviceId, "USAGE_APP_BACKGROUND", backgroundEvents);
      }
    } catch (SecurityException ignored) {
    } catch (Exception e) {
      if (BuildConfig.DEBUG) android.util.Log.w("MdmSyncService", "usage stats", e);
    }
  }

  private void postUsageEvents(String baseUrl, String deviceId, String action, List<JSONObject> events) {
    HttpURLConnection conn = null;
    try {
      URL url = new URL(baseUrl + "/devices/" + deviceId + "/activity");
      conn = (HttpURLConnection) url.openConnection();
      conn.setRequestMethod("POST");
      conn.setRequestProperty("Content-Type", "application/json");
      conn.setDoOutput(true);
      conn.setConnectTimeout(10000);
      conn.setReadTimeout(10000);
      JSONObject body = new JSONObject();
      body.put("action", action);
      JSONArray arr = new JSONArray();
      for (JSONObject e : events) arr.put(e);
      JSONObject details = new JSONObject();
      details.put("events", arr);
      body.put("details", details);
      try (OutputStream os = conn.getOutputStream()) {
        os.write(body.toString().getBytes(java.nio.charset.StandardCharsets.UTF_8));
      }
      conn.getResponseCode();
    } catch (Exception ignored) {
    } finally {
      if (conn != null) try { conn.disconnect(); } catch (Exception ignored) {}
    }
  }

  private void sendHeartbeat(String baseUrl, String deviceId) {
    HttpURLConnection conn = null;
    try {
      URL url = new URL(baseUrl + "/devices/" + deviceId + "/heartbeat");
      conn = (HttpURLConnection) url.openConnection();
      conn.setRequestMethod("PUT");
      conn.setConnectTimeout(5000);
      conn.setReadTimeout(5000);
      conn.getResponseCode();
    } catch (Exception ignored) {
    } finally {
      if (conn != null) try { conn.disconnect(); } catch (Exception ignored) {}
    }
  }

  private void applyBlockedPackages(Set<String> newBlocked) {
    DevicePolicyManager dpm = (DevicePolicyManager) getSystemService(Context.DEVICE_POLICY_SERVICE);
    ComponentName admin = new ComponentName(this, DeviceAdminReceiver.class);
    if (dpm == null || admin == null || !dpm.isAdminActive(admin)) return;
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.LOLLIPOP) return;
    synchronized (lastBlockedPackages) {
      for (String pkg : lastBlockedPackages) {
        if (!newBlocked.contains(pkg)) {
          try {
            dpm.setApplicationHidden(admin, pkg, false);
          } catch (Exception ignored) {}
        }
      }
      for (String pkg : newBlocked) {
        try {
          dpm.setApplicationHidden(admin, pkg, true);
        } catch (Exception ignored) {}
      }
      lastBlockedPackages.clear();
      lastBlockedPackages.addAll(newBlocked);
    }
  }
}
