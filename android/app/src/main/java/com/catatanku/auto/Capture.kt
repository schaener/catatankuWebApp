package com.catatanku.auto

import android.content.Context
import android.os.Build
import android.util.Log
import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.firestore.FirebaseFirestore
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import org.json.JSONArray
import org.json.JSONObject
import java.io.File
import java.security.MessageDigest

/** A notification that looked like a money movement, waiting to be (or already) sent to the web inbox. */
data class CapturedItem(
    val id: String,
    val packageName: String,
    val appName: String,
    val title: String,
    val text: String,
    val postedAt: Long,
    val synced: Boolean = false,
) {
    val amount: Long? get() = CaptureFilter.findAmount("$title $text")

    fun toJson() = JSONObject()
        .put("id", id).put("packageName", packageName).put("appName", appName)
        .put("title", title).put("text", text).put("postedAt", postedAt).put("synced", synced)

    companion object {
        fun fromJson(o: JSONObject) = CapturedItem(
            o.getString("id"), o.getString("packageName"), o.getString("appName"),
            o.optString("title"), o.optString("text"), o.getLong("postedAt"), o.optBoolean("synced"),
        )
    }
}

/**
 * Cheap on-device filter. Real parsing happens on the web (src/utils/notifParser.js) so it can be
 * improved without reinstalling the app; here we only decide what is allowed to leave the phone.
 */
object CaptureFilter {
    private val AMOUNT = Regex("""(?i)(?:rp\.?|idr)\s?(\d[\d.,]*)""")
    // Never upload one-time codes or security messages, even if they mention an amount.
    private val SECRET = Regex(
        """(?i)\botp\b|kode\s+(?:verifikasi|otp|rahasia|keamanan|aktivasi|unik)|jangan\s+(?:berikan|bagikan|sebarkan|beritahu)|one[- ]time|\bm-?pin\b|password|kata sandi""",
    )

    fun isCandidate(title: String, text: String): Boolean {
        val all = "$title $text"
        return AMOUNT.containsMatchIn(all) && !SECRET.containsMatchIn(all)
    }

    /** Rough amount for display on the phone ("Rp 1.250.000,00" -> 1250000). */
    fun findAmount(s: String): Long? {
        val raw = AMOUNT.find(s)?.groupValues?.get(1) ?: return null
        val digits = raw.replace(Regex("""[.,]\d{1,2}$"""), "").replace(Regex("""[.,]"""), "")
        return digits.toLongOrNull()?.takeIf { it > 0 }
    }

    /** Same notification re-posted (updates, re-alerts) maps to the same id, so it is stored once. */
    fun idFor(packageName: String, key: String, title: String, text: String): String {
        val bytes = MessageDigest.getInstance("SHA-1").digest("$packageName|$key|$title|$text".toByteArray())
        return bytes.joinToString("") { "%02x".format(it) }.take(32)
    }
}

/**
 * Local journal of captured items (survives reboots and app restarts) + upload to
 * users/{uid}/inbox/{id}. Items stay queued while signed out or offline and are retried on
 * login, on listener (re)connect and after boot. Uploads are idempotent (deterministic ids).
 */
object CaptureStore {
    private const val TAG = "CaptureStore"
    private const val MAX_ITEMS = 300
    private val _items = MutableStateFlow<List<CapturedItem>>(emptyList())
    val items: StateFlow<List<CapturedItem>> = _items.asStateFlow()
    private var file: File? = null

    @Synchronized
    fun init(context: Context) {
        if (file != null) return
        file = File(context.filesDir, "captured.json")
        _items.value = runCatching {
            val arr = JSONArray(file!!.readText())
            (0 until arr.length()).map { CapturedItem.fromJson(arr.getJSONObject(it)) }
        }.getOrDefault(emptyList())
    }

    @Synchronized
    private fun save(list: List<CapturedItem>) {
        val trimmed = list.sortedByDescending { it.postedAt }.take(MAX_ITEMS)
        _items.value = trimmed
        file?.writeText(JSONArray(trimmed.map { it.toJson() }).toString())
    }

    /** Returns false when the item was already captured. */
    fun add(context: Context, item: CapturedItem): Boolean {
        init(context)
        if (_items.value.any { it.id == item.id }) return false
        save(listOf(item) + _items.value)
        flush(context)
        return true
    }

    private fun markSynced(id: String) = synchronized(this) {
        save(_items.value.map { if (it.id == id) it.copy(synced = true) else it })
    }

    fun clear(context: Context) {
        init(context)
        save(emptyList())
    }

    /** Upload everything not yet synced. Safe to call often. */
    fun flush(context: Context) {
        init(context)
        val uid = FirebaseAuth.getInstance().currentUser?.uid ?: return
        val inbox = FirebaseFirestore.getInstance().collection("users").document(uid).collection("inbox")
        for (item in _items.value.filterNot { it.synced }) {
            inbox.document(item.id).set(
                mapOf(
                    "packageName" to item.packageName,
                    "appName" to item.appName,
                    "title" to item.title,
                    "text" to item.text,
                    "postedAt" to item.postedAt,
                    "device" to "${Build.MANUFACTURER} ${Build.MODEL}",
                    "capturedBy" to "android",
                ),
            ).addOnSuccessListener { markSynced(item.id) }
                .addOnFailureListener { Log.w(TAG, "upload ${item.id} failed, will retry", it) }
        }
    }
}
