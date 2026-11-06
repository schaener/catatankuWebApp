package com.catatanku.auto

import android.app.Notification
import android.content.ComponentName
import android.content.Context
import android.service.notification.NotificationListenerService
import android.service.notification.StatusBarNotification
import android.util.Log

/**
 * Bound by the system once the user grants "Notification access". Android re-binds it
 * automatically after a reboot; BootReceiver additionally asks for a rebind for OEM ROMs that
 * forget, and onListenerDisconnected requests one if the system unbinds us.
 */
class NotificationCaptureService : NotificationListenerService() {

    override fun onListenerConnected() {
        Log.i(TAG, "listener connected")
        CaptureStore.flush(this)
    }

    override fun onListenerDisconnected() {
        Log.w(TAG, "listener disconnected, requesting rebind")
        requestRebind(component(this))
    }

    override fun onNotificationPosted(sbn: StatusBarNotification) {
        val n = sbn.notification ?: return
        if (BuildConfig.DEBUG) Log.d(TAG, "posted ${sbn.packageName} key=${sbn.key} flags=${n.flags}")
        if (n.flags and Notification.FLAG_GROUP_SUMMARY != 0) return
        if (!Sources.isCaptured(this, sbn.packageName)) return

        val extras = n.extras
        val title = extras.getCharSequence(Notification.EXTRA_TITLE)?.toString().orEmpty().trim()
        val text = (extras.getCharSequence(Notification.EXTRA_BIG_TEXT) ?: extras.getCharSequence(Notification.EXTRA_TEXT))
            ?.toString().orEmpty().trim()
        if (!CaptureFilter.isCandidate(title, text)) {
            if (BuildConfig.DEBUG) Log.d(TAG, "skipped (no amount or secret): $title | $text")
            return
        }

        val item = CapturedItem(
            id = CaptureFilter.idFor(sbn.packageName, sbn.key, title, text),
            packageName = sbn.packageName,
            appName = Sources.label(this, sbn.packageName),
            title = title,
            text = text,
            postedAt = sbn.postTime,
        )
        if (CaptureStore.add(this, item)) Log.i(TAG, "captured ${item.appName}: ${item.amount}")
        else if (BuildConfig.DEBUG) Log.d(TAG, "duplicate ${item.id}")
    }

    companion object {
        private const val TAG = "CaptureService"
        fun component(context: Context) = ComponentName(context, NotificationCaptureService::class.java)
    }
}
