package com.catatanku.auto

import android.content.Context
import android.content.Intent
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow

/** Icons are not loaded here (expensive for 100+ apps); the UI fetches them lazily via AppIcons. */
data class SourceApp(val packageName: String, val label: String, val suggested: Boolean)

/**
 * Which apps' notifications are captured. The local copy (SharedPreferences) is what the listener
 * reads, so it works offline and right after a reboot; DeviceSync mirrors it to Firestore so the
 * selection can also be changed from the web.
 */
object Sources {
    private const val PREFS = "sources"
    private const val KEY_SELECTED = "selected"
    private const val KEY_SEEN = "seen"
    private const val KEY_INITIALIZED = "initialized"
    const val SHELL = "com.android.shell"

    // Indonesian banks & e-wallets, matched on app label or package name.
    private val FINANCE = Regex(
        """(?i)\b(bca|mybca|klikbca|bri|brimo|mandiri|livin|bni|wondr|jago|seabank|cimb|octo|permata|danamon|btn|bsi|byond|jenius|blu|allo|superbank|krom|neo|ocbc|nyala|uob|tmrw|maybank|m2u|digibank|dbs|line bank|hibank|bank|gopay|gojek|dana|ovo|shopee|shopeepay|linkaja|astrapay|isaku|i\.saku|sakuku|flip|doku|grab|kredivo|akulaku|bibit|ajaib|bareksa)\b""",
    )

    private val _selected = MutableStateFlow<Set<String>>(emptySet())
    val selected: StateFlow<Set<String>> = _selected.asStateFlow()

    private fun prefs(context: Context) = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)

    fun load(context: Context): Set<String> {
        val p = prefs(context)
        if (!p.getBoolean(KEY_INITIALIZED, false)) {
            p.edit().putStringSet(KEY_SELECTED, emptySet()).putBoolean(KEY_INITIALIZED, true).apply()
            autoSelectNewFinanceApps(context)
        }
        _selected.value = p.getStringSet(KEY_SELECTED, emptySet())!!.toSet()
        return _selected.value
    }

    private fun save(context: Context, next: Set<String>) {
        prefs(context).edit().putStringSet(KEY_SELECTED, next).apply()
        _selected.value = next
    }

    /** User toggled an app on the phone. */
    fun toggle(context: Context, packageName: String) {
        val on = packageName !in load(context)
        save(context, if (on) _selected.value + packageName else _selected.value - packageName)
        DeviceSync.setSelected(packageName, on)
    }

    /** Switch several apps at once (web "Nyalakan semua" / single switch inside the app). */
    fun setMany(context: Context, packages: Collection<String>, on: Boolean) {
        val current = load(context)
        val next = if (on) current + packages else current - packages.toSet()
        if (next == current) return
        save(context, next)
        packages.forEach { DeviceSync.setSelected(it, on) }
    }

    /** Selection changed elsewhere (web). */
    fun applyRemote(context: Context, remote: Set<String>) {
        if (remote != load(context)) save(context, remote)
    }

    /**
     * Bank / e-wallet apps installed since we last looked are switched on automatically, once.
     * Returns the packages that were added.
     */
    fun autoSelectNewFinanceApps(context: Context): Set<String> {
        val p = prefs(context)
        val seen = p.getStringSet(KEY_SEEN, emptySet())!!
        val apps = installedApps(context)
        val added = apps.filter { it.suggested && it.packageName !in seen }.map { it.packageName }.toSet()
        p.edit().putStringSet(KEY_SEEN, apps.map { it.packageName }.toSet()).apply()
        if (added.isNotEmpty()) {
            save(context, (p.getStringSet(KEY_SELECTED, emptySet())!! + added))
            added.forEach { DeviceSync.setSelected(it, true) }
        }
        return added
    }

    /** Own test notifications are always captured. */
    fun isCaptured(context: Context, packageName: String): Boolean =
        packageName == context.packageName || packageName in load(context)

    fun isFinance(label: String, packageName: String) = FINANCE.containsMatchIn("$label ${packageName.replace('.', ' ')}")

    fun label(context: Context, packageName: String): String = runCatching {
        val pm = context.packageManager
        pm.getApplicationLabel(pm.getApplicationInfo(packageName, 0)).toString()
    }.getOrDefault(packageName)

    /** Launchable apps (no QUERY_ALL_PACKAGES needed thanks to the <queries> launcher intent in the manifest). */
    fun installedApps(context: Context): List<SourceApp> {
        val pm = context.packageManager
        val launcher = Intent(Intent.ACTION_MAIN).addCategory(Intent.CATEGORY_LAUNCHER)
        val apps = pm.queryIntentActivities(launcher, 0)
            .map { it.activityInfo.applicationInfo }
            .distinctBy { it.packageName }
            .filter { it.packageName != context.packageName }
            .map {
                val label = pm.getApplicationLabel(it).toString()
                SourceApp(it.packageName, label, isFinance(label, it.packageName))
            }
        // Debug builds expose `adb shell cmd notification post` as a selectable source for testing.
        val debug = if (BuildConfig.DEBUG) listOf(SourceApp(SHELL, "Shell (adb uji)", true)) else emptyList()
        return (debug + apps).sortedWith(compareByDescending<SourceApp> { it.suggested }.thenBy { it.label.lowercase() })
    }
}
