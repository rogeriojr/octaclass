package com.octoclass.mobile;

import android.app.admin.DevicePolicyManager;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.content.pm.ResolveInfo;
import android.os.Build;
import android.provider.MediaStore;
import android.provider.Settings;
import androidx.annotation.NonNull;
import com.facebook.react.bridge.Promise;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;
import com.facebook.react.bridge.ReadableArray;

import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

/**
 * Native module for MDM controls. Requires the app to be Device Owner (provisioned via adb or zero-touch).
 */
public class KioskModule extends ReactContextBaseJavaModule {

  private final ReactApplicationContext reactContext;
  private final Set<String> lastBlockedPackages = new HashSet<>();

  public KioskModule(ReactApplicationContext reactContext) {
    super(reactContext);
    this.reactContext = reactContext;
  }

  @NonNull
  @Override
  public String getName() {
    return "KioskModule";
  }

  private DevicePolicyManager getDpm() {
    return (DevicePolicyManager) reactContext.getSystemService(Context.DEVICE_POLICY_SERVICE);
  }

  private ComponentName getAdminComponent() {
    return new ComponentName(reactContext, DeviceAdminReceiver.class);
  }

  @ReactMethod
  public void lockScreen(com.facebook.react.bridge.Promise promise) {
    DevicePolicyManager dpm = getDpm();
    ComponentName admin = getAdminComponent();
    if (dpm == null || admin == null) {
      if (promise != null) promise.reject("NO_DPM", "DevicePolicyManager unavailable");
      return;
    }
    if (!dpm.isAdminActive(admin)) {
      if (promise != null) promise.reject("NOT_DEVICE_OWNER", "App is not Device Owner. Run: adb shell dpm set-device-owner com.octoclass.mobile/.DeviceAdminReceiver");
      return;
    }
    android.os.Handler mainHandler = new android.os.Handler(android.os.Looper.getMainLooper());
    mainHandler.post(() -> {
      try {
        dpm.lockNow();
        if (promise != null) promise.resolve(true);
      } catch (Exception e) {
        if (promise != null) promise.reject("LOCK_FAILED", e.getMessage());
      }
    });
  }

  private android.app.Activity getActivity() {
    return reactContext.getCurrentActivity();
  }

  private void startActivityOnUiThread(Intent intent) {
    if (intent == null) return;
    android.os.Handler mainHandler = new android.os.Handler(android.os.Looper.getMainLooper());
    mainHandler.post(() -> {
      try {
        android.app.Activity activity = getActivity();
        if (activity != null) {
          activity.startActivity(intent);
        } else {
          reactContext.startActivity(intent);
        }
      } catch (Exception ignored) {
      }
    });
  }

  @ReactMethod
  public void launchPackage(String packageName) {
    if (packageName == null || packageName.isEmpty()) return;
    try {
      Intent launch = reactContext.getPackageManager().getLaunchIntentForPackage(packageName);
      if (launch == null && ("com.google.android.deskclock".equals(packageName) || "com.android.deskclock".equals(packageName))) {
        String alt = "com.google.android.deskclock".equals(packageName) ? "com.android.deskclock" : "com.google.android.deskclock";
        launch = reactContext.getPackageManager().getLaunchIntentForPackage(alt);
      }
      if (launch != null) {
        launch.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_RESET_TASK_IF_NEEDED);
        startActivityOnUiThread(launch);
        return;
      }
      Intent fallback = getExplicitLaunchIntentForPackage(packageName);
      if (fallback != null) {
        fallback.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_RESET_TASK_IF_NEEDED);
        startActivityOnUiThread(fallback);
        return;
      }
      Intent queryIntent = new Intent(Intent.ACTION_MAIN).addCategory(Intent.CATEGORY_LAUNCHER).setPackage(packageName);
      List<ResolveInfo> list = reactContext.getPackageManager().queryIntentActivities(queryIntent, 0);
      if (list != null && !list.isEmpty()) {
        ResolveInfo ri = list.get(0);
        if (ri.activityInfo != null) {
          Intent generic = new Intent(Intent.ACTION_MAIN).addCategory(Intent.CATEGORY_LAUNCHER);
          generic.setComponent(new ComponentName(ri.activityInfo.packageName, ri.activityInfo.name));
          generic.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_RESET_TASK_IF_NEEDED);
          startActivityOnUiThread(generic);
        }
      }
    } catch (Exception ignored) {
    }
  }

  private Intent getExplicitLaunchIntentForPackage(String packageName) {
    if ("com.google.android.deskclock".equals(packageName) || "com.android.deskclock".equals(packageName)) {
      try {
        Intent explicit = new Intent(Intent.ACTION_MAIN).addCategory(Intent.CATEGORY_LAUNCHER);
        explicit.setComponent(new ComponentName("com.android.deskclock", "com.android.deskclock.DeskClock"));
        if (reactContext.getPackageManager().resolveActivity(explicit, 0) != null) {
          return explicit;
        }
      } catch (Exception ignored) {
      }
      try {
        Intent explicit = new Intent(Intent.ACTION_MAIN).addCategory(Intent.CATEGORY_LAUNCHER);
        explicit.setComponent(new ComponentName("com.google.android.deskclock", "com.android.deskclock.DeskClock"));
        if (reactContext.getPackageManager().resolveActivity(explicit, 0) != null) {
          return explicit;
        }
      } catch (Exception ignored) {
      }
    }
    return null;
  }

  @ReactMethod
  public void setApplicationHidden(String packageName, boolean hidden, Promise promise) {
    DevicePolicyManager dpm = getDpm();
    ComponentName admin = getAdminComponent();
    if (dpm == null || admin == null || !dpm.isAdminActive(admin)) {
      promise.resolve(false);
      return;
    }
    try {
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
        boolean ok = dpm.setApplicationHidden(admin, packageName, hidden);
        promise.resolve(ok);
      } else {
        promise.resolve(false);
      }
    } catch (Exception e) {
      promise.resolve(false);
    }
  }

  @ReactMethod
  public void setVolume(double level) {
    if (BuildConfig.DEBUG) {
      android.util.Log.d("KioskModule", "setVolume called level=" + level);
    }
    final double clampedLevel = Math.max(0, Math.min(1, level));
    android.os.Handler mainHandler = new android.os.Handler(android.os.Looper.getMainLooper());
    mainHandler.post(() -> {
      try {
        android.media.AudioManager am = (android.media.AudioManager) reactContext.getSystemService(Context.AUDIO_SERVICE);
        if (am == null) {
          if (BuildConfig.DEBUG) android.util.Log.w("KioskModule", "setVolume AudioManager null");
          return;
        }
        final int max = am.getStreamMaxVolume(android.media.AudioManager.STREAM_MUSIC);
        final int vol = Math.max(0, Math.min(max, (int) Math.round(clampedLevel * max)));
        final int stream = android.media.AudioManager.STREAM_MUSIC;
        final int flags = android.media.AudioManager.FLAG_SHOW_UI;
        android.app.Activity activity = getActivity();
        if (activity != null) {
          activity.setVolumeControlStream(stream);
        }
        am.setStreamVolume(stream, vol, flags);
        if (BuildConfig.DEBUG) {
          android.util.Log.d("KioskModule", "setVolume applied vol=" + vol + " max=" + max);
        }
      } catch (Exception e) {
        if (BuildConfig.DEBUG) {
          android.util.Log.e("KioskModule", "setVolume error", e);
        }
      }
    });
  }

  @ReactMethod
  public void setBrightness(double level) {
    if (BuildConfig.DEBUG) {
      android.util.Log.d("KioskModule", "setBrightness called level=" + level);
    }
    final float clamped = (float) Math.max(0, Math.min(1, level));
    try {
      if (Settings.System.canWrite(reactContext)) {
        int value = (int) Math.round(clamped * 255);
        Settings.System.putInt(
          reactContext.getContentResolver(),
          Settings.System.SCREEN_BRIGHTNESS_MODE,
          Settings.System.SCREEN_BRIGHTNESS_MODE_MANUAL
        );
        Settings.System.putInt(
          reactContext.getContentResolver(),
          Settings.System.SCREEN_BRIGHTNESS,
          value
        );
        if (BuildConfig.DEBUG) android.util.Log.d("KioskModule", "setBrightness system value=" + value);
      } else if (BuildConfig.DEBUG) {
        android.util.Log.d("KioskModule", "setBrightness canWrite=false, only window");
      }
      android.os.Handler mainHandler = new android.os.Handler(android.os.Looper.getMainLooper());
      mainHandler.post(() -> {
        android.app.Activity activity = getActivity();
        if (BuildConfig.DEBUG) {
          android.util.Log.d("KioskModule", "setBrightness post activity=" + (activity != null) + " window=" + (activity != null && activity.getWindow() != null));
        }
        if (activity != null && activity.getWindow() != null) {
          try {
            android.view.WindowManager.LayoutParams lp = activity.getWindow().getAttributes();
            lp.screenBrightness = clamped;
            activity.getWindow().setAttributes(lp);
            if (BuildConfig.DEBUG) {
              android.util.Log.d("KioskModule", "setBrightness applied window=" + clamped);
            }
          } catch (Exception e) {
            if (BuildConfig.DEBUG) android.util.Log.e("KioskModule", "setBrightness window error", e);
          }
        }
      });
    } catch (Exception e) {
      if (BuildConfig.DEBUG) android.util.Log.e("KioskModule", "setBrightness error", e);
    }
  }

  @ReactMethod
  public void setAllowedPackages(ReadableArray packageNames) {
    DevicePolicyManager dpm = getDpm();
    ComponentName admin = getAdminComponent();
    if (dpm == null || admin == null || !dpm.isAdminActive(admin)) return;
    try {
    Set<String> set = new HashSet<>();
    set.add(reactContext.getPackageName());
    for (int i = 0; i < packageNames.size(); i++) {
      String p = packageNames.getString(i);
      if (p != null && !p.isEmpty()) set.add(p);
    }
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
      dpm.setLockTaskPackages(admin, set.toArray(new String[0]));
    }
    } catch (Exception ignored) {
    }
  }

  @ReactMethod
  public void setBlockedPackages(ReadableArray packageNames) {
    DevicePolicyManager dpm = getDpm();
    ComponentName admin = getAdminComponent();
    if (dpm == null || admin == null || !dpm.isAdminActive(admin)) return;
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.LOLLIPOP) return;
    final String ownPackage = reactContext.getPackageName();
    try {
      Set<String> newBlocked = new HashSet<>();
      for (int i = 0; i < packageNames.size(); i++) {
        String pkg = packageNames.getString(i);
        if (pkg != null && !pkg.isEmpty() && !pkg.equals(ownPackage)) newBlocked.add(pkg);
      }
      for (String pkg : lastBlockedPackages) {
        if (!newBlocked.contains(pkg)) {
          try {
            boolean ok = dpm.setApplicationHidden(admin, pkg, false);
            if (BuildConfig.DEBUG && !ok) {
              android.util.Log.w("KioskModule", "setApplicationHidden(unhide) false for " + pkg);
            }
          } catch (Exception ignored) {
          }
        }
      }
      for (String pkg : newBlocked) {
        if (ownPackage.equals(pkg)) continue;
        try {
          boolean ok = dpm.setApplicationHidden(admin, pkg, true);
          if (BuildConfig.DEBUG) {
            android.util.Log.d("KioskModule", "setBlockedPackages hide " + pkg + " ok=" + ok);
          }
          if (!ok && BuildConfig.DEBUG) {
            android.util.Log.w("KioskModule", "setApplicationHidden(hide) false for " + pkg);
          }
        } catch (Exception e) {
          if (BuildConfig.DEBUG) android.util.Log.e("KioskModule", "setBlockedPackages hide " + pkg, e);
        }
      }
      lastBlockedPackages.clear();
      lastBlockedPackages.addAll(newBlocked);
    } catch (Exception ignored) {
    }
  }

  @ReactMethod
  public void startKiosk() {
    android.os.Handler mainHandler = new android.os.Handler(android.os.Looper.getMainLooper());
    mainHandler.post(() -> {
      try {
        android.app.Activity activity = getActivity();
        if (activity != null && Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
          activity.startLockTask();
        }
      } catch (Exception ignored) {
      }
    });
  }

  @ReactMethod
  public void stopKiosk() {
    android.os.Handler mainHandler = new android.os.Handler(android.os.Looper.getMainLooper());
    mainHandler.post(() -> {
      try {
        android.app.Activity activity = getActivity();
        if (activity != null && Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
          activity.stopLockTask();
        }
      } catch (Exception ignored) {
      }
    });
  }

  @ReactMethod
  public void startMdmSyncService(String deviceId, String backendApiUrl) {
    if (deviceId == null || backendApiUrl == null) return;
    try {
      MdmSyncService.saveConfigAndStart(reactContext.getApplicationContext(), deviceId, backendApiUrl);
    } catch (Exception e) {
      if (BuildConfig.DEBUG) android.util.Log.w("KioskModule", "startMdmSyncService", e);
    }
  }

  @ReactMethod
  public void stopMdmSyncService() {
    try {
      MdmSyncService.stop(reactContext.getApplicationContext());
    } catch (Exception e) {
      if (BuildConfig.DEBUG) android.util.Log.w("KioskModule", "stopMdmSyncService", e);
    }
  }

  @ReactMethod
  public void launchCalculator() {
    android.os.Handler mainHandler = new android.os.Handler(android.os.Looper.getMainLooper());
    mainHandler.post(() -> {
      try {
        android.content.pm.PackageManager pm = reactContext.getPackageManager();
        String[] packages = {
          "com.google.android.calculator",
          "com.android.calculator2",
          "com.google.android.calculator2",
          "com.samsung.android.app.calculator",
          "com.sec.android.app.popupcalculator"
        };
        for (String pkg : packages) {
          Intent launch = pm.getLaunchIntentForPackage(pkg);
          if (launch != null) {
            launch.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            android.app.Activity a = getActivity();
            if (a != null) a.startActivity(launch);
            else reactContext.startActivity(launch);
            return;
          }
        }
        try {
          Intent explicit = new Intent();
          explicit.setClassName("com.android.calculator2", "com.android.calculator2.Calculator");
          explicit.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
          android.app.Activity a = getActivity();
          if (a != null) a.startActivity(explicit);
          else reactContext.startActivity(explicit);
          return;
        } catch (Exception ignored) {
        }
        Intent intent = new Intent(Intent.ACTION_MAIN);
        intent.addCategory(Intent.CATEGORY_APP_CALCULATOR);
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        java.util.List<android.content.pm.ResolveInfo> list = pm.queryIntentActivities(intent, 0);
        if (list != null && !list.isEmpty()) {
          android.content.pm.ResolveInfo ri = list.get(0);
          if (ri.activityInfo != null) {
            Intent launchCalc = new Intent(Intent.ACTION_MAIN);
            launchCalc.setClassName(ri.activityInfo.packageName, ri.activityInfo.name);
            launchCalc.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            android.app.Activity a = getActivity();
            if (a != null) a.startActivity(launchCalc);
            else reactContext.startActivity(launchCalc);
            return;
          }
        }
        if (intent.resolveActivity(pm) != null) {
          android.app.Activity a = getActivity();
          if (a != null) a.startActivity(intent);
          else reactContext.startActivity(intent);
        }
      } catch (Exception e) {
        if (BuildConfig.DEBUG) android.util.Log.e("KioskModule", "launchCalculator error", e);
      }
    });
  }

  @ReactMethod
  public void setAppStoreEnabled(boolean enabled) {
  }

  @ReactMethod
  public void reboot() {
    DevicePolicyManager dpm = getDpm();
    ComponentName admin = getAdminComponent();
    if (dpm != null && admin != null && dpm.isAdminActive(admin)) {
      try {
        dpm.reboot(admin);
      } catch (Exception ignored) {
      }
    }
  }

  @ReactMethod
  public void launchCamera() {
    android.os.Handler mainHandler = new android.os.Handler(android.os.Looper.getMainLooper());
    mainHandler.post(() -> {
      try {
        String[] packages = {
          "com.google.android.GoogleCamera",
          "com.android.camera",
          "com.android.camera2"
        };
        for (String pkg : packages) {
          Intent launch = reactContext.getPackageManager().getLaunchIntentForPackage(pkg);
          if (launch != null) {
            launch.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            android.app.Activity a = getActivity();
            if (a != null) a.startActivity(launch);
            else reactContext.startActivity(launch);
            return;
          }
        }
        Intent intent = new Intent(MediaStore.ACTION_IMAGE_CAPTURE);
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        if (intent.resolveActivity(reactContext.getPackageManager()) != null) {
          android.app.Activity a = getActivity();
          if (a != null) a.startActivity(intent);
          else reactContext.startActivity(intent);
        }
      } catch (Exception ignored) {
      }
    });
  }

  @ReactMethod
  public void canWriteSystemSettings(Promise promise) {
    try {
      promise.resolve(Settings.System.canWrite(reactContext));
    } catch (Exception e) {
      promise.resolve(false);
    }
  }
}
