package com.catatanku.auto

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.service.notification.NotificationListenerService
import android.util.Log

/** After a reboot or app update: make sure the listener is bound and upload anything queued. */
class BootReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        Log.i("BootReceiver", "received ${intent.action}")
        if (SystemSetup.isListenerEnabled(context)) {
            NotificationListenerService.requestRebind(NotificationCaptureService.component(context))
        }
        val pending = goAsync()
        CaptureStore.flush(context)
        DeviceSync.publish()
        // give Firestore a moment to hand the writes to its persistent queue
        android.os.Handler(context.mainLooper).postDelayed({ pending.finish() }, 3000)
    }
}
