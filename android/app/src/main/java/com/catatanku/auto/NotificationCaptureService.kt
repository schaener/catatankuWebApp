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
        // Anything posted while we were unbound (process killed, reboot, update) is still in the shade.
        runCatching { activeNotifications?.forEach(::handle) }.onFailure { Log.w(TAG, "active scan failed", it) }
        CaptureStore.flush(this)
    }

    override fun onListenerDisconnected() {
        Log.w(TAG, "listener disconnected, requesting rebind")
        requestRebind(component(this))
    }

    override fun onNotificationPosted(sbn: StatusBarNotification) = handle(sbn)

    private fun handle(sbn: StatusBarNotification) {
        val n = sbn.notification ?: return
        if (n.flags and Notification.FLAG_GROUP_SUMMARY != 0) return
        val pkg = sbn.packageName
        val (title, text) = NotificationText.extract(n)
        if (title.isEmpty() && text.isEmpty()) return
        val id = CaptureFilter.idFor(pkg, sbn.key, title, text)

        if (!Sources.isCaptured(this, pkg)) {
            // Only remember unmonitored apps that look like a bank / e-wallet and mention money; never chats etc.
            if (CaptureFilter.hasAmount("$title $text") && Sources.isFinance(Sources.label(this, pkg), pkg)) {
                skip(id, sbn, title, text, SkipReason.NOT_MONITORED)
            }
            return
        }
        when (val d = CaptureFilter.decide(title, text)) {
            is Decision.Capture -> {
                val item = CapturedItem(id, pkg, Sources.label(this, pkg), d.title, d.text, sbn.postTime)
                if (CaptureStore.add(this, item)) Log.i(TAG, "captured ${item.appName}: ${item.amount}")
            }
            is Decision.Skip ->
                if (d.reason != SkipReason.NO_AMOUNT || CaptureFilter.looksLikeTransaction("$title $text")) skip(id, sbn, title, text, d.reason)
        }
    }

    private fun skip(id: String, sbn: StatusBarNotification, title: String, text: String, reason: SkipReason) {
        if (BuildConfig.DEBUG) Log.d(TAG, "skipped ${sbn.packageName} ($reason)")
        val secret = reason == SkipReason.SECRET
        SkipLog.add(this, SkippedItem(id, sbn.packageName, Sources.label(this, sbn.packageName), if (secret) "" else title, if (secret) "" else text, reason, sbn.postTime))
    }

    companion object {
        private const val TAG = "CaptureService"
        fun component(context: Context) = ComponentName(context, NotificationCaptureService::class.java)
    }
}
