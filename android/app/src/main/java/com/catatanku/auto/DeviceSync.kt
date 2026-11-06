package com.catatanku.auto

import android.annotation.SuppressLint
import android.content.Context
import android.os.Build
import android.util.Log
import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.firestore.DocumentReference
import com.google.firebase.firestore.FieldValue
import com.google.firebase.firestore.FirebaseFirestore
import com.google.firebase.firestore.ListenerRegistration
import com.google.firebase.firestore.SetOptions
import java.util.UUID

/**
 * Mirrors this phone to users/{uid}/devices/{deviceId}:
 *   { name, platform, appVersion, lastSeen, listenerEnabled, batteryUnrestricted,
 *     installedApps: [{packageName, label, suggested}], selected: [packageName] }
 * The web reads it to show the phone's status and toggles `selected`; we listen and apply
 * those changes to the local copy the notification listener uses.
 */
@SuppressLint("StaticFieldLeak") // holds the application context only
object DeviceSync {
    private const val TAG = "DeviceSync"
    private var app: Context? = null
    private var registration: ListenerRegistration? = null
    private var listeningUid: String? = null

    fun deviceId(context: Context): String {
        val prefs = context.getSharedPreferences("device", Context.MODE_PRIVATE)
        return prefs.getString("id", null) ?: UUID.randomUUID().toString().also { prefs.edit().putString("id", it).apply() }
    }

    private fun doc(): DocumentReference? {
        val ctx = app ?: return null
        val uid = FirebaseAuth.getInstance().currentUser?.uid ?: return null
        return FirebaseFirestore.getInstance().collection("users").document(uid).collection("devices").document(deviceId(ctx))
    }

    /** Called once from Application.onCreate: follows sign-in / sign-out. */
    fun init(context: Context) {
        app = context.applicationContext
        FirebaseAuth.getInstance().addAuthStateListener { auth ->
            val uid = auth.currentUser?.uid
            if (uid != listeningUid) {
                registration?.remove()
                registration = null
                listeningUid = uid
                if (uid != null) {
                    publish()
                    listen()
                }
            }
        }
    }

    /** Push installed apps + status. Creates the doc with the local selection the first time. */
    fun publish() {
        val ctx = app ?: return
        val ref = doc() ?: return
        Sources.autoSelectNewFinanceApps(ctx)
        val apps = Sources.installedApps(ctx).map {
            mapOf("packageName" to it.packageName, "label" to it.label, "suggested" to it.suggested)
        }
        val data = mutableMapOf(
            "name" to "${Build.MANUFACTURER.replaceFirstChar { it.uppercase() }} ${Build.MODEL}",
            "platform" to "android",
            "osVersion" to Build.VERSION.RELEASE,
            "appVersion" to BuildConfig.VERSION_NAME,
            "installedApps" to apps,
            "listenerEnabled" to SystemSetup.isListenerEnabled(ctx),
            "batteryUnrestricted" to SystemSetup.isIgnoringBattery(ctx),
            "lastSeen" to FieldValue.serverTimestamp(),
        )
        ref.get().addOnCompleteListener { snap ->
            // Only seed `selected` for a new device; afterwards it is owned by toggles on either side.
            if (snap.isSuccessful && snap.result?.contains("selected") != true) data["selected"] = Sources.load(ctx).toList()
            ref.set(data, SetOptions.merge()).addOnFailureListener { Log.w(TAG, "publish failed", it) }
        }
    }

    private fun listen() {
        val ctx = app ?: return
        registration = doc()?.addSnapshotListener { snap, err ->
            if (err != null) {
                Log.w(TAG, "listen failed", err)
                return@addSnapshotListener
            }
            @Suppress("UNCHECKED_CAST")
            val remote = (snap?.get("selected") as? List<String>)?.toSet() ?: return@addSnapshotListener
            Sources.applyRemote(ctx, remote)
        }
    }

    /** Toggle from the phone; array ops so a simultaneous toggle on the web isn't overwritten. */
    fun setSelected(packageName: String, on: Boolean) {
        val ref = doc() ?: return
        ref.set(
            mapOf("selected" to if (on) FieldValue.arrayUnion(packageName) else FieldValue.arrayRemove(packageName)),
            SetOptions.merge(),
        )
    }
}
