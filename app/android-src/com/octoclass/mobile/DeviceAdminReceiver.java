package com.octoclass.mobile;

import android.app.admin.DevicePolicyManager;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.os.Build;

/**
 * Device Admin Receiver required for Device Owner provisioning.
 * Used with adb: dpm set-device-owner com.octoclass.mobile/.DeviceAdminReceiver
 */
public class DeviceAdminReceiver extends android.app.admin.DeviceAdminReceiver {

  @Override
  public void onEnabled(Context context, Intent intent) {
    super.onEnabled(context, intent);
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP && context != null) {
      DevicePolicyManager dpm = (DevicePolicyManager) context.getSystemService(Context.DEVICE_POLICY_SERVICE);
      ComponentName admin = new ComponentName(context, DeviceAdminReceiver.class);
      if (dpm != null && admin != null && dpm.isAdminActive(admin)) {
        try {
          dpm.setUninstallBlocked(admin, context.getPackageName(), true);
        } catch (Exception ignored) {
        }
      }
    }
  }

  @Override
  public void onDisabled(Context context, Intent intent) {
    super.onDisabled(context, intent);
  }
}
