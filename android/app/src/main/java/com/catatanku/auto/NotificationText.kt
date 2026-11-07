package com.catatanku.auto

import android.app.Notification
import androidx.core.app.NotificationCompat

/**
 * Collects every text field a notification can carry. Bank apps differ a lot: some put the amount in the
 * expanded text, some in InboxStyle lines, a few in MessagingStyle or the sub-text. Reading only
 * EXTRA_TEXT missed those.
 */
object NotificationText {
    fun extract(n: Notification): Pair<String, String> {
        val e = n.extras ?: return "" to ""
        val title = (e.getCharSequence(Notification.EXTRA_TITLE_BIG) ?: e.getCharSequence(Notification.EXTRA_TITLE))?.toString().orEmpty()
        val parts = buildList {
            add(e.getCharSequence(Notification.EXTRA_BIG_TEXT) ?: e.getCharSequence(Notification.EXTRA_TEXT))
            e.getCharSequenceArray(Notification.EXTRA_TEXT_LINES)?.let { addAll(it) }
            runCatching { NotificationCompat.MessagingStyle.extractMessagingStyleFromNotification(n) }.getOrNull()
                ?.messages?.forEach { add(it.text) }
            add(e.getCharSequence(Notification.EXTRA_SUB_TEXT))
            add(e.getCharSequence(Notification.EXTRA_SUMMARY_TEXT))
            add(e.getCharSequence(Notification.EXTRA_INFO_TEXT))
        }
        return clean(title) to join(parts.mapNotNull { it?.toString() })
    }

    /** Trimmed, de-duplicated (a part already contained in another is dropped), joined in order. */
    internal fun join(parts: List<String>): String {
        val cleaned = parts.map(::clean).filter { it.isNotEmpty() }
        return cleaned.filterIndexed { i, p -> cleaned.withIndex().none { (j, q) -> j != i && q.length > p.length && q.contains(p) } }
            .distinct().joinToString(" · ")
    }

    private fun clean(s: String) = s.replace(Regex("""\s+"""), " ").trim()
}
