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

/** Why a notification from a bank / e-wallet was not captured; shown in Tinjau → Riwayat. */
enum class SkipReason(val label: String, val hint: String) {
    NOT_MONITORED("Aplikasi belum dipantau", "Nyalakan aplikasi ini di tab Sumber"),
    NO_AMOUNT("Nominal tidak terbaca", "Tidak ada \"Rp\" / \"IDR\" / \"Nominal\" di teksnya"),
    SECRET("Berisi kode rahasia", "OTP / PIN tidak pernah dikirim, isinya tidak disimpan"),
    HIDDEN("Disembunyikan Android", "Aktifkan \"Notifikasi sensitif\" di tab Akun, lalu tekan Catat untuk yang ini"),
}

sealed interface Decision {
    /** Upload [title] / [text]: safety warnings already stripped. */
    data class Capture(val title: String, val text: String) : Decision
    data class Skip(val reason: SkipReason) : Decision
}

/**
 * On-device gate: decides what may leave the phone. Parsing happens later (app + web).
 *
 * Banks append warnings like "Jangan berikan PIN/OTP kepada siapapun" to ordinary transfer notifications.
 * Dropping every notification that mentions "OTP" lost real transactions, so we now:
 *  1. drop only notifications that actually carry a one-time code (keyword next to a 4-8 digit number),
 *  2. strip warning sentences (PIN / OTP / password / "jangan berikan ...") before upload,
 *  3. require an amount in what remains.
 */
object CaptureFilter {
    private val AMOUNT = Regex(
        """(?i)(?:rp\.?|idr)\s?(\d[\d.,]*)|(?:nominal|sebesar|senilai|jumlah|total|amount)\s*:?\s*(\d{1,3}(?:[.,]\d{3})+(?:[.,]\d{2})?)""",
    )
    // PLN "token" numbers and transaction reference numbers are not secrets, so they're not code words.
    private const val CODE_WORD = """(?:\botp\b|kode\s+(?:verifikasi|otp|rahasia|keamanan|aktivasi|unik|akses)|one[- ]time|verification code|\bpin\b)"""
    // Same sentence only: a '.' is allowed solely as a thousands separator ("Rp 500.000").
    private const val SAME_SENTENCE = """(?:[^.!?\n]|\.(?=\d)){0,60}?"""
    private const val CODE = """\b\d{4,8}\b(?![.,\-]?\d)"""
    // "Kode OTP 123456", "Kode verifikasi kamu 4821", "OTP untuk transfer Rp 500.000: 123456", "482913 adalah kode OTP"
    private val ONE_TIME_CODE = Regex(
        """(?i)$CODE_WORD\s*$CODE|$CODE_WORD$SAME_SENTENCE(?:adalah|:|is|=|anda|kamu)\s*$CODE|$CODE\s*(?:adalah|is|merupakan)\s*(?:kode|otp|code)""",
    )
    private val WARNING = Regex(
        """(?i)\botp\b|\bm-?pin\b|\bpin\b|password|kata sandi|jangan\s+(?:berikan|bagikan|sebarkan|beritahu\w*)|one[- ]time|kode\s+(?:verifikasi|rahasia|keamanan|aktivasi)""",
    )
    private val SENTENCE_END = Regex("""(?<=[.!?\n])\s+""")
    private val HIDDEN_BY_SYSTEM = Regex("""(?i)sensitive notification content hidden|konten notifikasi sensitif|isi notifikasi sensitif""")

    private val TRANSACTION_WORDS = Regex("""(?i)transfer|transaksi|pembayaran|\bbayar|debit|kredit|dana masuk|terima|top ?-?up|tarik tunai|penarikan|qris|terkirim|mutasi""")

    fun hasAmount(s: String) = AMOUNT.containsMatchIn(s)

    /** Worth listing as "not recorded" even without an amount (keeps marketing pushes out of that list). */
    fun looksLikeTransaction(s: String) = TRANSACTION_WORDS.containsMatchIn(s)

    fun decide(title: String, text: String): Decision {
        val all = "$title $text"
        if (HIDDEN_BY_SYSTEM.containsMatchIn(all)) return Decision.Skip(SkipReason.HIDDEN)
        if (ONE_TIME_CODE.containsMatchIn(all)) return Decision.Skip(SkipReason.SECRET)
        val cleanTitle = stripWarnings(title)
        val cleanText = stripWarnings(text)
        return when {
            hasAmount("$cleanTitle $cleanText") -> Decision.Capture(cleanTitle, cleanText)
            // the amount only appeared inside a security sentence ("Masukkan m-PIN untuk transfer Rp ...")
            hasAmount(all) -> Decision.Skip(SkipReason.SECRET)
            else -> Decision.Skip(SkipReason.NO_AMOUNT)
        }
    }

    /** Drops sentences that mention PIN / OTP / passwords; the rest of the notification is kept verbatim. */
    fun stripWarnings(s: String): String =
        if (!WARNING.containsMatchIn(s)) s.trim()
        else s.split(SENTENCE_END).filterNot { WARNING.containsMatchIn(it) }.joinToString(" ").trim()

    /** Rough amount for display on the phone ("Rp 1.250.000,00" -> 1250000). */
    fun findAmount(s: String): Long? {
        val m = AMOUNT.find(s) ?: return null
        val raw = m.groupValues[1].ifEmpty { m.groupValues[2] }
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
