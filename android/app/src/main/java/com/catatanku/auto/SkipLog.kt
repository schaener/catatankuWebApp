package com.catatanku.auto

import android.content.Context
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import org.json.JSONArray
import org.json.JSONObject
import java.io.File

/** A bank / e-wallet notification that was NOT captured, and why. Stored on the phone only. */
data class SkippedItem(
    val id: String,
    val packageName: String,
    val appName: String,
    val title: String,
    /** Empty for [SkipReason.SECRET]: the content of a code notification is never kept. */
    val text: String,
    val reason: SkipReason,
    val postedAt: Long,
) {
    fun toJson(): JSONObject = JSONObject()
        .put("id", id).put("packageName", packageName).put("appName", appName).put("title", title)
        .put("text", text).put("reason", reason.name).put("postedAt", postedAt)

    companion object {
        fun fromJson(o: JSONObject) = SkippedItem(
            o.getString("id"), o.getString("packageName"), o.getString("appName"), o.optString("title"), o.optString("text"),
            runCatching { SkipReason.valueOf(o.getString("reason")) }.getOrDefault(SkipReason.NO_AMOUNT), o.getLong("postedAt"),
        )
    }
}

/**
 * Last [MAX] skipped notifications, so "why wasn't my transfer recorded?" has a visible answer.
 * Never uploaded. Same journal pattern as [CaptureStore].
 */
object SkipLog {
    private const val MAX = 50
    private val _items = MutableStateFlow<List<SkippedItem>>(emptyList())
    val items: StateFlow<List<SkippedItem>> = _items.asStateFlow()
    private var file: File? = null

    @Synchronized
    fun init(context: Context) {
        if (file != null) return
        file = File(context.filesDir, "skipped.json")
        _items.value = runCatching {
            val arr = JSONArray(file!!.readText())
            (0 until arr.length()).map { SkippedItem.fromJson(arr.getJSONObject(it)) }
        }.getOrDefault(emptyList())
    }

    @Synchronized
    fun add(context: Context, item: SkippedItem) {
        init(context)
        if (_items.value.any { it.id == item.id }) return
        save(listOf(item) + _items.value)
    }

    @Synchronized
    fun remove(context: Context, id: String) {
        init(context)
        save(_items.value.filterNot { it.id == id })
    }

    @Synchronized
    fun clear(context: Context) {
        init(context)
        save(emptyList())
    }

    private fun save(list: List<SkippedItem>) {
        val trimmed = list.sortedByDescending { it.postedAt }.take(MAX)
        _items.value = trimmed
        file?.writeText(JSONArray(trimmed.map { it.toJson() }).toString())
    }
}
