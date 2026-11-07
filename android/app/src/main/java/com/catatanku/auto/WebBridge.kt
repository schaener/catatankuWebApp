package com.catatanku.auto

import android.content.ClipData
import android.content.ClipboardManager
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.provider.Settings
import android.util.Base64
import android.util.Log
import android.webkit.JavascriptInterface
import android.webkit.WebView
import android.widget.Toast
import androidx.activity.ComponentActivity
import androidx.core.graphics.drawable.toBitmap
import androidx.credentials.exceptions.GetCredentialCancellationException
import androidx.lifecycle.lifecycleScope
import kotlinx.coroutines.launch
import org.json.JSONArray
import org.json.JSONObject
import java.io.ByteArrayOutputStream

/**
 * window.CatatankuNative — the only things the web app can't do itself (see src/platform/native.js,
 * keep both sides in sync). Sync methods return JSON strings; async ones answer through
 * window.__nativeResolve(id, value, error).
 *
 * JS interfaces are reachable from any page the WebView loads, so every call first checks that the
 * current page is our own web app origin ([allowedOrigin]); MainActivity also refuses to navigate elsewhere.
 */
class WebBridge(
    private val activity: ComponentActivity,
    private val webView: WebView,
    private val allowedOrigin: String,
) {
    private val main = Handler(Looper.getMainLooper())

    /** Updated on the main thread whenever the WebView navigates; read from the JS binder thread. */
    @Volatile var currentOrigin: String = ""

    private inline fun <T> guarded(fallback: T, block: () -> T): T =
        if (currentOrigin == allowedOrigin) block() else fallback.also { Log.w(TAG, "blocked bridge call from $currentOrigin") }

    @JavascriptInterface
    fun getDeviceStatus(): String = guarded("null") {
        val ctx = activity.applicationContext
        JSONObject()
            .put("listener", SystemSetup.isListenerEnabled(ctx))
            .put("battery", SystemSetup.isIgnoringBattery(ctx))
            .put("autostartScreen", SystemSetup.hasAutostartScreen(ctx))
            .put("sensitiveNeeded", SystemSetup.needsSensitiveAccess())
            .put("sensitive", SystemSetup.hasSensitiveAccess(ctx))
            .put("sources", Sources.load(ctx).count { it != Sources.SHELL || BuildConfig.DEBUG })
            .put("appVersion", BuildConfig.VERSION_NAME)
            .put("device", "${Build.MANUFACTURER.replaceFirstChar { it.uppercase() }} ${Build.MODEL}")
            .put("deviceId", DeviceSync.deviceId(ctx))
            .toString()
    }

    @JavascriptInterface
    fun openSetting(target: String): Unit = guarded(Unit) {
        main.post {
            when (target) {
                "listener" -> SystemSetup.openListenerSettings(activity)
                "battery" -> SystemSetup.requestIgnoreBattery(activity)
                "autostart" -> SystemSetup.openAutostart(activity)
                else -> activity.startActivity(Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, Uri.parse("package:${activity.packageName}")))
            }
        }
    }

    @JavascriptInterface
    fun copySensitiveCommand(): Unit = guarded(Unit) {
        main.post {
            val cm = activity.getSystemService(Context.CLIPBOARD_SERVICE) as ClipboardManager
            cm.setPrimaryClip(ClipData.newPlainText("adb", SystemSetup.SENSITIVE_ADB_COMMAND))
            Toast.makeText(activity, "Perintah ADB disalin. Jalankan di komputer yang tersambung ke HP ini.", Toast.LENGTH_LONG).show()
        }
    }

    /** Installed apps with their on/off state, read on the phone itself (works offline, no sync needed). */
    @JavascriptInterface
    fun getSources(): String = guarded("[]") {
        val ctx = activity.applicationContext
        val on = Sources.load(ctx)
        JSONArray(Sources.installedApps(ctx).map {
            JSONObject().put("packageName", it.packageName).put("label", it.label).put("suggested", it.suggested).put("on", it.packageName in on)
        }).toString()
    }

    /** App launcher icon as a PNG data URL (96px), "" if unknown. The web caches it per session. */
    @JavascriptInterface
    fun getAppIcon(packageName: String): String = guarded("") {
        runCatching {
            val bmp = activity.packageManager.getApplicationIcon(packageName).toBitmap(ICON_PX, ICON_PX)
            val out = ByteArrayOutputStream()
            bmp.compress(android.graphics.Bitmap.CompressFormat.PNG, 100, out)
            "data:image/png;base64," + Base64.encodeToString(out.toByteArray(), Base64.NO_WRAP)
        }.getOrDefault("")
    }

    /** packagesJson: JSON array of package names. */
    @JavascriptInterface
    fun setSources(packagesJson: String, on: Boolean): Unit = guarded(Unit) {
        val arr = runCatching { JSONArray(packagesJson) }.getOrNull() ?: return@guarded
        Sources.setMany(activity.applicationContext, List(arr.length()) { arr.getString(it) }, on)
    }

    @JavascriptInterface
    fun getSkipped(): String = guarded("[]") { JSONArray(SkipLog.items.value.map { it.toJson() }).toString() }

    @JavascriptInterface
    fun removeSkipped(id: String): Unit = guarded(Unit) { SkipLog.remove(activity, id) }

    @JavascriptInterface
    fun clearSkipped(): Unit = guarded(Unit) { SkipLog.clear(activity) }

    @JavascriptInterface
    fun getCaptured(): String = guarded("[]") { JSONArray(CaptureStore.items.value.map { it.toJson() }).toString() }

    @JavascriptInterface
    fun postTestNotification(): Unit = guarded(Unit) { main.post { SystemSetup.postTestNotification(activity) } }

    @JavascriptInterface
    fun flush(): Unit = guarded(Unit) { CaptureStore.flush(activity) }

    @JavascriptInterface
    fun share(text: String): Unit = guarded(Unit) {
        main.post {
            val send = Intent(Intent.ACTION_SEND).setType("text/plain").putExtra(Intent.EXTRA_TEXT, text)
            activity.startActivity(Intent.createChooser(send, "Bagikan"))
        }
    }

    @JavascriptInterface
    fun hasSession(): Boolean = guarded(false) { Auth.hasSession }

    @JavascriptInterface
    fun signOut(): Unit = guarded(Unit) { activity.lifecycleScope.launch { Auth.signOut(activity) } }

    @JavascriptInterface
    fun signIn(callbackId: String, silent: Boolean): Unit = guarded(Unit) {
        activity.lifecycleScope.launch {
            runCatching { Auth.signInForWeb(activity, silent) }
                .onSuccess { resolve(callbackId, it, null) }
                .onFailure {
                    Log.w(TAG, "sign-in failed", it)
                    resolve(callbackId, null, if (it is GetCredentialCancellationException) "cancelled" else it.message ?: "Gagal masuk")
                }
        }
    }

    private fun resolve(id: String, value: String?, error: String?) = main.post {
        val v = value?.let(JSONObject::quote) ?: "null"
        val e = error?.let(JSONObject::quote) ?: "null"
        webView.evaluateJavascript("window.__nativeResolve && window.__nativeResolve(${JSONObject.quote(id)}, $v, $e)", null)
    }

    /** Native -> web events: 'native:resume', 'native:captured', 'native:sources'. */
    fun emit(event: String) = main.post {
        webView.evaluateJavascript("window.dispatchEvent(new CustomEvent(${JSONObject.quote(event)}))", null)
    }

    companion object {
        private const val TAG = "WebBridge"
        const val NAME = "CatatankuNative"
        private const val ICON_PX = 96
    }
}
