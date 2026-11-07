package com.catatanku.auto

import android.annotation.SuppressLint
import android.app.AppOpsManager
import android.app.NotificationChannel
import android.app.NotificationManager
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.os.PowerManager
import android.os.Process
import android.provider.Settings
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat

/** Everything needed so capturing keeps working: notification access, battery, OEM autostart. */
object SystemSetup {
    fun isListenerEnabled(context: Context): Boolean =
        NotificationManagerCompat.getEnabledListenerPackages(context).contains(context.packageName)

    fun openListenerSettings(context: Context) {
        val intent = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            Intent(Settings.ACTION_NOTIFICATION_LISTENER_DETAIL_SETTINGS)
                .putExtra(Settings.EXTRA_NOTIFICATION_LISTENER_COMPONENT_NAME, NotificationCaptureService.component(context).flattenToString())
        } else {
            Intent(Settings.ACTION_NOTIFICATION_LISTENER_SETTINGS)
        }
        context.startActivity(intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
    }

    /**
     * Android 15+ hides notifications it thinks contain a one-time code from third-party listeners, and its
     * detector also fires on bank reference numbers ("No. Ref: 88123456"), hiding ordinary transfers.
     * The RECEIVE_SENSITIVE_NOTIFICATIONS app-op lifts that; it can only be granted over ADB
     * ([SENSITIVE_ADB_COMMAND]). Our own filter still drops real OTPs, so codes never leave the phone.
     */
    fun needsSensitiveAccess(): Boolean = Build.VERSION.SDK_INT >= 35

    fun hasSensitiveAccess(context: Context): Boolean {
        if (!needsSensitiveAccess()) return true
        val ops = context.getSystemService(Context.APP_OPS_SERVICE) as AppOpsManager
        return runCatching {
            ops.unsafeCheckOpNoThrow("android:receive_sensitive_notifications", Process.myUid(), context.packageName) == AppOpsManager.MODE_ALLOWED
        }.getOrDefault(false)
    }

    /** Grant + rebind the listener so the change applies immediately. */
    const val SENSITIVE_ADB_COMMAND =
        "adb shell cmd appops set com.catatanku.auto RECEIVE_SENSITIVE_NOTIFICATIONS allow && " +
            "adb shell cmd notification disallow_listener com.catatanku.auto/.NotificationCaptureService && " +
            "adb shell cmd notification allow_listener com.catatanku.auto/.NotificationCaptureService"

    fun isIgnoringBattery(context: Context): Boolean =
        (context.getSystemService(Context.POWER_SERVICE) as PowerManager).isIgnoringBatteryOptimizations(context.packageName)

    @SuppressLint("BatteryLife") // sideloaded personal app: asking directly is the whole point
    fun requestIgnoreBattery(context: Context) {
        context.startActivity(
            Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS, Uri.parse("package:${context.packageName}"))
                .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK),
        )
    }

    // Vendor screens that keep apps from being killed / allow start after boot.
    private val AUTOSTART = listOf(
        ComponentName("com.miui.securitycenter", "com.miui.permcenter.autostart.AutoStartManagementActivity"),
        ComponentName("com.coloros.safecenter", "com.coloros.safecenter.permission.startup.StartupAppListActivity"),
        ComponentName("com.coloros.safecenter", "com.coloros.safecenter.startupapp.StartupAppListActivity"),
        ComponentName("com.oplus.safecenter", "com.oplus.safecenter.startupapp.StartupAppListActivity"),
        ComponentName("com.vivo.permissionmanager", "com.vivo.permissionmanager.activity.BgStartUpManagerActivity"),
        ComponentName("com.iqoo.secure", "com.iqoo.secure.ui.phoneoptimize.AddWhiteListActivity"),
        ComponentName("com.huawei.systemmanager", "com.huawei.systemmanager.startupmgr.ui.StartupNormalAppListActivity"),
        ComponentName("com.asus.mobilemanager", "com.asus.mobilemanager.autostart.AutoStartActivity"),
        ComponentName("com.transsion.phonemaster", "com.cyin.himgr.autostart.AutoStartActivity"),
    )

    /** True when this phone has a vendor autostart screen (Xiaomi, Oppo/realme, vivo, Huawei, ...). */
    fun hasAutostartScreen(context: Context) = AUTOSTART.any { canOpen(context, it) }

    fun openAutostart(context: Context) {
        val target = AUTOSTART.firstOrNull { canOpen(context, it) }
        val intent = if (target != null) Intent().setComponent(target)
        else Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, Uri.parse("package:${context.packageName}"))
        runCatching { context.startActivity(intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)) }
    }

    private fun canOpen(context: Context, c: ComponentName) =
        context.packageManager.resolveActivity(Intent().setComponent(c), 0) != null

    private const val TEST_CHANNEL = "test"

    /** Posts a fake bank notification from this app so the user can check the whole pipeline. */
    fun postTestNotification(context: Context) {
        val nm = context.getSystemService(NotificationManager::class.java)
        nm.createNotificationChannel(NotificationChannel(TEST_CHANNEL, "Notifikasi uji", NotificationManager.IMPORTANCE_DEFAULT))
        val amount = (1..9).random() * 1000 + 500
        val notification = NotificationCompat.Builder(context, TEST_CHANNEL)
            .setSmallIcon(R.drawable.ic_stat)
            .setContentTitle("Transaksi Berhasil (uji)")
            .setContentText("Pembayaran QRIS Rp ${"%,d".format(amount).replace(',', '.')} di TOKO UJI CATATANKU berhasil")
            .setAutoCancel(true)
            .build()
        runCatching { nm.notify(System.currentTimeMillis().toInt(), notification) }
    }
}
