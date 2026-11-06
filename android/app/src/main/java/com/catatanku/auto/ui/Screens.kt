package com.catatanku.auto.ui

import android.app.Activity
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.widget.Toast
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.GridItemSpan
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.items
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ExitToApp
import androidx.compose.material.icons.automirrored.filled.KeyboardArrowRight
import androidx.compose.material.icons.automirrored.filled.List
import androidx.compose.material.icons.automirrored.filled.Send
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.Home
import androidx.compose.material.icons.filled.Lock
import androidx.compose.material.icons.filled.Notifications
import androidx.compose.material.icons.filled.Person
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material.icons.filled.Search
import androidx.compose.material.icons.filled.Settings
import androidx.compose.material.icons.filled.Star
import androidx.compose.material.icons.filled.Warning
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.NavigationBar
import androidx.compose.material3.NavigationBarItem
import androidx.compose.material3.NavigationBarItemDefaults
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.core.graphics.drawable.toBitmap
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.compose.LifecycleEventEffect
import com.catatanku.auto.Auth
import com.catatanku.auto.BuildConfig
import com.catatanku.auto.CaptureStore
import com.catatanku.auto.CapturedItem
import com.catatanku.auto.DeviceSync
import com.catatanku.auto.SourceApp
import com.catatanku.auto.Sources
import com.catatanku.auto.SystemSetup
import com.google.firebase.auth.FirebaseUser
import com.google.firebase.firestore.FirebaseFirestore
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import java.util.Calendar

// ---------------------------------------------------------------- login

@Composable
fun LoginScreen(activity: Activity) {
    val scope = rememberCoroutineScope()
    var busy by remember { mutableStateOf(false) }
    var error by remember { mutableStateOf<String?>(null) }
    val signIn: (suspend () -> Unit) -> Unit = { block ->
        busy = true
        error = null
        scope.launch {
            runCatching { block() }.onFailure { error = it.message ?: "Gagal masuk" }
            busy = false
        }
    }
    Box(Modifier.fillMaxSize().background(Brand.Header)) {
        Column(
            Modifier.fillMaxSize().statusBarsPadding().navigationBarsPadding().padding(28.dp),
            verticalArrangement = Arrangement.SpaceBetween,
        ) {
            Column {
                Spacer(Modifier.height(32.dp))
                Box(Modifier.size(64.dp).clip(RoundedCornerShape(20.dp)).background(Color.White), contentAlignment = Alignment.Center) {
                    Text("Rp", color = Brand.Teal, fontWeight = FontWeight.ExtraBold, fontSize = 24.sp)
                }
                Spacer(Modifier.height(28.dp))
                Text("Transaksi kecatat\nsendiri. ✨", color = Color.White, fontSize = 38.sp, fontWeight = FontWeight.ExtraBold, lineHeight = 44.sp)
                Spacer(Modifier.height(14.dp))
                Text(
                    "Catatanku Auto membaca notifikasi bank & e-wallet di HP-mu, lalu mengirimnya ke Catatan Keuangan untuk kamu tinjau.",
                    color = Color.White.copy(alpha = 0.9f), fontSize = 16.sp, lineHeight = 23.sp,
                )
                Spacer(Modifier.height(24.dp))
                listOf("🏦  BCA, BRI, Mandiri, BNI, Jago, SeaBank…", "👛  GoPay, DANA, OVO, ShopeePay…", "🔒  OTP & kode rahasia tidak pernah dikirim").forEach {
                    Text(it, color = Color.White, fontSize = 15.sp, modifier = Modifier.padding(vertical = 4.dp))
                }
            }
            Column(horizontalAlignment = Alignment.CenterHorizontally) {
                error?.let { Text(it, color = Color(0xFFFFE4E6), textAlign = TextAlign.Center, modifier = Modifier.padding(bottom = 12.dp)) }
                Button(
                    onClick = { signIn { Auth.signInWithGoogle(activity) } },
                    enabled = !busy,
                    modifier = Modifier.fillMaxWidth().height(56.dp),
                    shape = RoundedCornerShape(18.dp),
                    colors = ButtonDefaults.buttonColors(containerColor = Color.White, contentColor = Brand.Teal),
                ) {
                    if (busy) CircularProgressIndicator(Modifier.size(22.dp), strokeWidth = 2.dp)
                    else Text("Masuk dengan Google", fontWeight = FontWeight.Bold, fontSize = 16.sp)
                }
                if (BuildConfig.USE_EMULATORS) {
                    TextButton(onClick = { signIn { Auth.signInFake(activity) } }, enabled = !busy) {
                        Text("Masuk (Firebase emulator)", color = Color.White)
                    }
                }
                Spacer(Modifier.height(8.dp))
                Text("Pakai akun Google yang sama dengan di web.", color = Color.White.copy(alpha = 0.8f), fontSize = 13.sp)
            }
        }
    }
}

// ---------------------------------------------------------------- shell

private enum class Tab(val label: String, val icon: ImageVector) {
    Home("Beranda", Icons.Filled.Home),
    Sources("Sumber", Icons.Filled.Star),
    History("Riwayat", Icons.AutoMirrored.Filled.List),
    Account("Akun", Icons.Filled.Person),
}

/** Live status shared by the tabs; refreshed whenever the app comes back to the foreground. */
private data class Status(val listener: Boolean, val battery: Boolean, val autostartScreen: Boolean)

private fun readStatus(context: Context) =
    Status(SystemSetup.isListenerEnabled(context), SystemSetup.isIgnoringBattery(context), SystemSetup.hasAutostartScreen(context))

@Composable
fun AppScaffold(user: FirebaseUser) {
    val context = LocalContext.current
    var tab by rememberSaveable { mutableStateOf(Tab.Home) }
    var status by remember { mutableStateOf(readStatus(context)) }
    LifecycleEventEffect(Lifecycle.Event.ON_RESUME) {
        status = readStatus(context)
        CaptureStore.flush(context)
        DeviceSync.publish()
    }
    val pending = rememberPendingCount(user.uid)

    Scaffold(
        containerColor = Brand.Bg,
        contentWindowInsets = WindowInsets(0),
        bottomBar = {
            NavigationBar(containerColor = Color.White, tonalElevation = 0.dp, modifier = Modifier.shadow(12.dp)) {
                Tab.entries.forEach { t ->
                    NavigationBarItem(
                        selected = tab == t,
                        onClick = { tab = t },
                        icon = { Icon(t.icon, null) },
                        label = { Text(t.label, fontWeight = if (tab == t) FontWeight.Bold else FontWeight.Medium) },
                        colors = NavigationBarItemDefaults.colors(
                            selectedIconColor = Brand.Teal,
                            selectedTextColor = Brand.Teal,
                            indicatorColor = Brand.Mint,
                            unselectedIconColor = Brand.Muted,
                            unselectedTextColor = Brand.Muted,
                        ),
                    )
                }
            }
        },
    ) { padding ->
        Box(Modifier.padding(padding)) {
            when (tab) {
                Tab.Home -> HomeScreen(user, status, pending, onOpenTab = { tab = it })
                Tab.Sources -> SourcesScreen()
                Tab.History -> HistoryScreen()
                Tab.Account -> AccountScreen(user, status)
            }
        }
    }
}

/** Number of items still waiting in the web inbox (live from Firestore). */
@Composable
private fun rememberPendingCount(uid: String): Int {
    var count by remember { mutableIntStateOf(0) }
    DisposableEffect(uid) {
        val reg = FirebaseFirestore.getInstance().collection("users").document(uid).collection("inbox")
            .addSnapshotListener { snap, _ -> if (snap != null) count = snap.size() }
        onDispose { reg.remove() }
    }
    return count
}

private fun openWeb(context: Context, path: String = "/review") =
    context.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(BuildConfig.WEB_URL + path)).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))

// ---------------------------------------------------------------- home

@Composable
private fun HomeScreen(user: FirebaseUser, status: Status, pending: Int, onOpenTab: (Tab) -> Unit) {
    val context = LocalContext.current
    val items by CaptureStore.items.collectAsState()
    val selected by Sources.selected.collectAsState()
    val startOfDay = remember {
        Calendar.getInstance().apply { set(Calendar.HOUR_OF_DAY, 0); set(Calendar.MINUTE, 0); set(Calendar.SECOND, 0) }.timeInMillis
    }
    val today = items.count { it.postedAt >= startOfDay }
    val queued = items.count { !it.synced }
    val name = user.displayName ?: user.email ?: "Kamu"

    LazyColumn(Modifier.fillMaxSize(), contentPadding = PaddingValues(bottom = 24.dp)) {
        item {
            Box {
                // gradient header
                Column(
                    Modifier.fillMaxWidth()
                        .clip(RoundedCornerShape(bottomStart = 32.dp, bottomEnd = 32.dp))
                        .background(Brand.Header)
                        .statusBarsPadding()
                        .padding(start = 20.dp, end = 20.dp, top = 16.dp, bottom = 72.dp),
                ) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        InitialsAvatar(name)
                        Spacer(Modifier.width(12.dp))
                        Column(Modifier.weight(1f)) {
                            Text("Halo,", color = Color.White.copy(alpha = 0.85f), fontSize = 13.sp)
                            Text(name.substringBefore(' '), color = Color.White, fontSize = 20.sp, fontWeight = FontWeight.ExtraBold)
                        }
                        Box(
                            Modifier.size(42.dp).clip(CircleShape).background(Color.White.copy(alpha = 0.18f)).clickable { openWeb(context) },
                            contentAlignment = Alignment.Center,
                        ) {
                            Icon(Icons.Filled.Notifications, "Tinjau", tint = Color.White)
                            if (pending > 0) {
                                Box(
                                    Modifier.align(Alignment.TopEnd).offset(x = 2.dp, y = (-2).dp).size(18.dp).clip(CircleShape).background(Brand.Bad),
                                    contentAlignment = Alignment.Center,
                                ) { Text(if (pending > 99) "99" else "$pending", color = Color.White, fontSize = 10.sp, fontWeight = FontWeight.Bold) }
                            }
                        }
                    }
                    Spacer(Modifier.height(18.dp))
                    StatusPill(active = status.listener && selected.isNotEmpty())
                }
                // floating summary card
                Card(
                    Modifier.align(Alignment.BottomCenter).offset(y = 44.dp).padding(horizontal = 20.dp).fillMaxWidth(),
                    shape = RoundedCornerShape(24.dp),
                    colors = CardDefaults.cardColors(containerColor = Color.White),
                    elevation = CardDefaults.cardElevation(defaultElevation = 8.dp),
                ) {
                    Row(Modifier.padding(vertical = 18.dp)) {
                        Stat("Ditangkap\nhari ini", "$today", Brand.Teal, Modifier.weight(1f))
                        Stat("Menunggu\nditinjau", "$pending", if (pending > 0) Brand.Warn else Brand.Ink, Modifier.weight(1f)) { openWeb(context) }
                        Stat("Antrian\nterkirim", if (queued == 0) "✓" else "$queued", if (queued == 0) Brand.Good else Brand.Muted, Modifier.weight(1f))
                    }
                }
            }
            Spacer(Modifier.height(60.dp))
        }

        // setup checklist (only while something is missing)
        val steps = setupSteps(context, status, selected.isNotEmpty(), onOpenTab)
        if (steps.any { !it.done }) {
            item { SectionTitle("Biar tetap jalan, walau HP direstart") }
            item {
                Card(Modifier.padding(horizontal = 20.dp).fillMaxWidth(), shape = RoundedCornerShape(22.dp), colors = CardDefaults.cardColors(containerColor = Color.White)) {
                    Column(Modifier.padding(vertical = 6.dp)) { steps.forEach { SetupRow(it) } }
                }
            }
        }

        item { SectionTitle("Aksi cepat") }
        item {
            Row(Modifier.padding(horizontal = 12.dp).fillMaxWidth(), horizontalArrangement = Arrangement.SpaceEvenly) {
                QuickAction("Tinjau\ndi web", Icons.Filled.CheckCircle, Color(0xFF0F766E)) { openWeb(context) }
                QuickAction("Pilih\nsumber", Icons.Filled.Star, Color(0xFF7C3AED)) { onOpenTab(Tab.Sources) }
                QuickAction("Kirim\nuji coba", Icons.AutoMirrored.Filled.Send, Color(0xFFEA580C)) {
                    SystemSetup.postTestNotification(context)
                    Toast.makeText(context, "Notifikasi uji dikirim", Toast.LENGTH_SHORT).show()
                }
                QuickAction("Kirim\nulang", Icons.Filled.Refresh, Color(0xFF2563EB)) {
                    CaptureStore.flush(context)
                    Toast.makeText(context, "Mengirim antrian…", Toast.LENGTH_SHORT).show()
                }
            }
        }

        item {
            Row(Modifier.padding(start = 20.dp, end = 8.dp, top = 22.dp, bottom = 6.dp), verticalAlignment = Alignment.CenterVertically) {
                Text("Terbaru", style = MaterialTheme.typography.titleMedium, modifier = Modifier.weight(1f))
                TextButton(onClick = { onOpenTab(Tab.History) }) { Text("Lihat semua") }
            }
        }
        if (items.isEmpty()) {
            item { EmptyHint("Belum ada transaksi tertangkap. Coba bayar QRIS atau tekan \"Kirim uji coba\".") }
        } else {
            items(items.take(5), key = { it.id }) { CapturedRow(it) }
        }
    }
}

@Composable
private fun StatusPill(active: Boolean) {
    Row(
        Modifier.clip(RoundedCornerShape(50)).background(Color.White.copy(alpha = 0.18f)).padding(horizontal = 14.dp, vertical = 8.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Box(Modifier.size(9.dp).clip(CircleShape).background(if (active) Color(0xFF86EFAC) else Color(0xFFFCA5A5)))
        Spacer(Modifier.width(8.dp))
        Text(
            if (active) "Aktif membaca notifikasi" else "Belum aktif. Selesaikan pengaturan di bawah",
            color = Color.White, fontSize = 13.sp, fontWeight = FontWeight.SemiBold,
        )
    }
}

@Composable
private fun Stat(label: String, value: String, color: Color, modifier: Modifier, onClick: (() -> Unit)? = null) {
    Column(
        modifier.then(if (onClick != null) Modifier.clickable(onClick = onClick) else Modifier),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Text(value, color = color, fontSize = 24.sp, fontWeight = FontWeight.ExtraBold)
        Text(label, color = Brand.Muted, fontSize = 12.sp, textAlign = TextAlign.Center, lineHeight = 15.sp)
    }
}

@Composable
private fun QuickAction(label: String, icon: ImageVector, color: Color, onClick: () -> Unit) {
    Column(
        Modifier.width(78.dp).clip(RoundedCornerShape(16.dp)).clickable(onClick = onClick).padding(vertical = 6.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Box(Modifier.size(56.dp).clip(RoundedCornerShape(18.dp)).background(color.copy(alpha = 0.12f)), contentAlignment = Alignment.Center) {
            Icon(icon, null, tint = color, modifier = Modifier.size(26.dp))
        }
        Spacer(Modifier.height(6.dp))
        Text(label, fontSize = 12.sp, textAlign = TextAlign.Center, lineHeight = 15.sp, fontWeight = FontWeight.Medium)
    }
}

private data class Step(val title: String, val subtitle: String, val done: Boolean, val action: String, val onClick: () -> Unit)

private fun setupSteps(context: Context, status: Status, hasSources: Boolean, onOpenTab: (Tab) -> Unit) = buildList {
    add(Step("Izinkan akses notifikasi", "Wajib, supaya notifikasi bank & e-wallet bisa dibaca", status.listener, "Izinkan") { SystemSetup.openListenerSettings(context) })
    add(Step("Pilih aplikasi sumber", "Bank & e-wallet yang mau dicatat", hasSources, "Pilih") { onOpenTab(Tab.Sources) })
    add(Step("Matikan optimasi baterai", "Supaya tidak dihentikan sistem di latar belakang", status.battery, "Atur") { SystemSetup.requestIgnoreBattery(context) })
    // vendors like Xiaomi/Oppo/vivo block apps after a reboot unless autostart is allowed; we can't read that setting
    if (status.autostartScreen) add(Step("Izinkan mulai otomatis", "Xiaomi/Oppo/vivo: aktifkan Catatanku Auto di daftar autostart", false, "Buka") { SystemSetup.openAutostart(context) })
}

@Composable
private fun SetupRow(step: Step) {
    Row(Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 10.dp), verticalAlignment = Alignment.CenterVertically) {
        Box(
            Modifier.size(34.dp).clip(CircleShape).background(if (step.done) Brand.Good.copy(alpha = 0.12f) else Brand.Warn.copy(alpha = 0.15f)),
            contentAlignment = Alignment.Center,
        ) {
            Icon(if (step.done) Icons.Filled.CheckCircle else Icons.Filled.Warning, null, tint = if (step.done) Brand.Good else Brand.Warn, modifier = Modifier.size(20.dp))
        }
        Spacer(Modifier.width(12.dp))
        Column(Modifier.weight(1f)) {
            Text(step.title, fontWeight = FontWeight.SemiBold, fontSize = 14.sp)
            Text(step.subtitle, color = Brand.Muted, fontSize = 12.sp, lineHeight = 16.sp)
        }
        if (!step.done) {
            Button(onClick = step.onClick, shape = RoundedCornerShape(12.dp), contentPadding = PaddingValues(horizontal = 14.dp, vertical = 0.dp), modifier = Modifier.height(34.dp)) {
                Text(step.action, fontSize = 13.sp)
            }
        }
    }
}

@Composable
private fun SectionTitle(text: String) =
    Text(text, style = MaterialTheme.typography.titleMedium, modifier = Modifier.padding(start = 20.dp, end = 20.dp, top = 22.dp, bottom = 10.dp))

@Composable
private fun EmptyHint(text: String) =
    Text(text, color = Brand.Muted, textAlign = TextAlign.Center, modifier = Modifier.fillMaxWidth().padding(horizontal = 36.dp, vertical = 20.dp))

// ---------------------------------------------------------------- captured list

@Composable
private fun AppIcon(packageName: String, size: Int = 44) {
    val context = LocalContext.current
    val bitmap = remember(packageName) {
        runCatching { context.packageManager.getApplicationIcon(packageName).toBitmap(96, 96).asImageBitmap() }.getOrNull()
    }
    if (bitmap != null) Image(bitmap, null, Modifier.size(size.dp).clip(RoundedCornerShape((size / 3.2).dp)))
    else InitialsAvatar(Sources.label(context, packageName), size.dp, Brand.Mint, Brand.Teal)
}

@Composable
private fun CapturedRow(item: CapturedItem) {
    Card(
        Modifier.padding(horizontal = 20.dp, vertical = 5.dp).fillMaxWidth(),
        shape = RoundedCornerShape(20.dp),
        colors = CardDefaults.cardColors(containerColor = Color.White),
    ) {
        Row(Modifier.padding(14.dp), verticalAlignment = Alignment.CenterVertically) {
            AppIcon(item.packageName)
            Spacer(Modifier.width(12.dp))
            Column(Modifier.weight(1f)) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text(item.appName, fontWeight = FontWeight.Bold, fontSize = 14.sp, modifier = Modifier.weight(1f), maxLines = 1, overflow = TextOverflow.Ellipsis)
                    item.amount?.let { Text(rupiah(it), fontWeight = FontWeight.ExtraBold, fontSize = 15.sp) }
                }
                Text(listOf(item.title, item.text).filter { it.isNotBlank() }.joinToString(" · "), color = Brand.Muted, fontSize = 12.sp, maxLines = 2, overflow = TextOverflow.Ellipsis, lineHeight = 16.sp)
                Spacer(Modifier.height(6.dp))
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text(timeAgo(item.postedAt), color = Brand.Muted, fontSize = 11.sp, modifier = Modifier.weight(1f))
                    Chip(if (item.synced) "Terkirim" else "Antri", if (item.synced) Brand.Good else Brand.Warn)
                }
            }
        }
    }
}

@Composable
private fun Chip(text: String, color: Color) =
    Text(
        text, color = color, fontSize = 11.sp, fontWeight = FontWeight.Bold,
        modifier = Modifier.clip(RoundedCornerShape(50)).background(color.copy(alpha = 0.12f)).padding(horizontal = 10.dp, vertical = 3.dp),
    )

@Composable
private fun ScreenHeader(title: String, subtitle: String) {
    Column(
        Modifier.fillMaxWidth()
            .clip(RoundedCornerShape(bottomStart = 28.dp, bottomEnd = 28.dp))
            .background(Brand.Header)
            .statusBarsPadding()
            .padding(start = 20.dp, end = 20.dp, top = 18.dp, bottom = 22.dp),
    ) {
        Text(title, color = Color.White, fontSize = 24.sp, fontWeight = FontWeight.ExtraBold)
        Text(subtitle, color = Color.White.copy(alpha = 0.85f), fontSize = 13.sp)
    }
}

@Composable
private fun HistoryScreen() {
    val items by CaptureStore.items.collectAsState()
    LazyColumn(Modifier.fillMaxSize(), contentPadding = PaddingValues(bottom = 24.dp)) {
        item { ScreenHeader("Riwayat", "${items.size} notifikasi transaksi tertangkap di HP ini") }
        item { Spacer(Modifier.height(10.dp)) }
        if (items.isEmpty()) item { EmptyHint("Belum ada yang tertangkap.") }
        items(items, key = { it.id }) { CapturedRow(it) }
    }
}

// ---------------------------------------------------------------- sources

@Composable
private fun SourcesScreen() {
    val context = LocalContext.current
    val selected by Sources.selected.collectAsState()
    var apps by remember { mutableStateOf<List<SourceApp>?>(null) }
    var query by rememberSaveable { mutableStateOf("") }
    LaunchedEffect(Unit) { apps = withContext(Dispatchers.Default) { Sources.installedApps(context) } }
    val filtered = apps.orEmpty().filter { query.isBlank() || it.label.contains(query, ignoreCase = true) }
    val (suggested, others) = filtered.partition { it.suggested }

    LazyVerticalGrid(GridCells.Fixed(4), Modifier.fillMaxSize(), contentPadding = PaddingValues(bottom = 24.dp)) {
        item(span = { GridItemSpan(maxLineSpan) }) {
            Column {
                ScreenHeader("Sumber notifikasi", "${selected.size} aplikasi dipantau · tersinkron dengan web")
                OutlinedTextField(
                    value = query, onValueChange = { query = it },
                    placeholder = { Text("Cari aplikasi…") },
                    leadingIcon = { Icon(Icons.Filled.Search, null) },
                    singleLine = true,
                    shape = RoundedCornerShape(16.dp),
                    colors = OutlinedTextFieldDefaults.colors(unfocusedContainerColor = Color.White, focusedContainerColor = Color.White, unfocusedBorderColor = Color.Transparent),
                    modifier = Modifier.padding(horizontal = 20.dp, vertical = 14.dp).fillMaxWidth(),
                )
            }
        }
        if (apps == null) item(span = { GridItemSpan(maxLineSpan) }) { Box(Modifier.padding(40.dp), Alignment.Center) { CircularProgressIndicator() } }
        if (suggested.isNotEmpty()) {
            item(span = { GridItemSpan(maxLineSpan) }) { SectionTitle("Bank & e-wallet terdeteksi") }
            items(suggested, key = { it.packageName }) { AppTile(it, it.packageName in selected) { Sources.toggle(context, it.packageName) } }
        }
        if (others.isNotEmpty()) {
            item(span = { GridItemSpan(maxLineSpan) }) { SectionTitle("Aplikasi lain") }
            items(others, key = { it.packageName }) { AppTile(it, it.packageName in selected) { Sources.toggle(context, it.packageName) } }
        }
    }
}

@Composable
private fun AppTile(app: SourceApp, checked: Boolean, onClick: () -> Unit) {
    Column(
        Modifier.padding(4.dp).clip(RoundedCornerShape(16.dp)).clickable(onClick = onClick).padding(vertical = 8.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Box {
            Box(
                Modifier.size(60.dp).clip(RoundedCornerShape(18.dp)).background(Color.White)
                    .border(2.dp, if (checked) Brand.Teal else Color.Transparent, RoundedCornerShape(18.dp)),
                contentAlignment = Alignment.Center,
            ) { AppIcon(app.packageName, 44) }
            if (checked) {
                Box(
                    Modifier.align(Alignment.TopEnd).offset(x = 4.dp, y = (-4).dp).size(22.dp).clip(CircleShape).background(Brand.Teal).border(2.dp, Color.White, CircleShape),
                    contentAlignment = Alignment.Center,
                ) { Text("✓", color = Color.White, fontSize = 12.sp, fontWeight = FontWeight.Bold) }
            }
        }
        Spacer(Modifier.height(6.dp))
        Text(app.label, fontSize = 11.sp, maxLines = 2, textAlign = TextAlign.Center, overflow = TextOverflow.Ellipsis, lineHeight = 14.sp,
            fontWeight = if (checked) FontWeight.Bold else FontWeight.Normal, color = if (checked) Brand.Teal else Brand.Ink)
    }
}

// ---------------------------------------------------------------- account

@Composable
private fun AccountScreen(user: FirebaseUser, status: Status) {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    val name = user.displayName ?: user.email ?: "Kamu"
    LazyColumn(Modifier.fillMaxSize(), contentPadding = PaddingValues(bottom = 24.dp)) {
        item {
            Column(
                Modifier.fillMaxWidth().clip(RoundedCornerShape(bottomStart = 28.dp, bottomEnd = 28.dp)).background(Brand.Header)
                    .statusBarsPadding().padding(24.dp),
                horizontalAlignment = Alignment.CenterHorizontally,
            ) {
                InitialsAvatar(name, 72.dp)
                Spacer(Modifier.height(10.dp))
                Text(name, color = Color.White, fontSize = 20.sp, fontWeight = FontWeight.ExtraBold)
                Text(user.email.orEmpty(), color = Color.White.copy(alpha = 0.85f), fontSize = 13.sp)
            }
        }
        item { SectionTitle("Pengaturan") }
        item {
            Card(Modifier.padding(horizontal = 20.dp).fillMaxWidth(), shape = RoundedCornerShape(22.dp), colors = CardDefaults.cardColors(containerColor = Color.White)) {
                SettingRow(Icons.Filled.Notifications, "Akses notifikasi", if (status.listener) "Diizinkan" else "Belum diizinkan") { SystemSetup.openListenerSettings(context) }
                SettingRow(Icons.Filled.Settings, "Optimasi baterai", if (status.battery) "Tidak dibatasi" else "Dibatasi sistem") { SystemSetup.requestIgnoreBattery(context) }
                SettingRow(Icons.Filled.Refresh, "Mulai otomatis setelah restart", "Buka pengaturan autostart HP") { SystemSetup.openAutostart(context) }
                SettingRow(Icons.Filled.CheckCircle, "Buka Catatan Keuangan", BuildConfig.WEB_URL.removePrefix("https://")) { openWeb(context, "/") }
            }
        }
        item { SectionTitle("Privasi") }
        item {
            Card(Modifier.padding(horizontal = 20.dp).fillMaxWidth(), shape = RoundedCornerShape(22.dp), colors = CardDefaults.cardColors(containerColor = Color.White)) {
                Row(Modifier.padding(16.dp)) {
                    Icon(Icons.Filled.Lock, null, tint = Brand.Teal)
                    Spacer(Modifier.width(12.dp))
                    Text(
                        "Hanya notifikasi dari aplikasi yang kamu pilih dan yang menyebut nominal (Rp) yang dikirim, ke folder pribadi akunmu. " +
                            "Notifikasi berisi OTP, PIN, atau kode rahasia selalu dibuang di HP.",
                        fontSize = 13.sp, color = Brand.Muted, lineHeight = 19.sp,
                    )
                }
            }
        }
        item {
            Column(Modifier.padding(20.dp)) {
                OutlinedButton(onClick = { CaptureStore.clear(context) }, modifier = Modifier.fillMaxWidth().height(50.dp), shape = RoundedCornerShape(16.dp)) {
                    Text("Hapus riwayat di HP ini")
                }
                Spacer(Modifier.height(10.dp))
                Button(
                    onClick = { scope.launch { Auth.signOut(context) } },
                    modifier = Modifier.fillMaxWidth().height(50.dp), shape = RoundedCornerShape(16.dp),
                    colors = ButtonDefaults.buttonColors(containerColor = Brand.Bad.copy(alpha = 0.1f), contentColor = Brand.Bad),
                ) {
                    Icon(Icons.AutoMirrored.Filled.ExitToApp, null)
                    Spacer(Modifier.width(8.dp))
                    Text("Keluar", fontWeight = FontWeight.Bold)
                }
                Text("Catatanku Auto v${BuildConfig.VERSION_NAME}", color = Brand.Muted, fontSize = 12.sp, textAlign = TextAlign.Center, modifier = Modifier.fillMaxWidth().padding(top = 16.dp))
            }
        }
    }
}

@Composable
private fun SettingRow(icon: ImageVector, title: String, subtitle: String, onClick: () -> Unit) {
    Row(Modifier.fillMaxWidth().clickable(onClick = onClick).padding(16.dp), verticalAlignment = Alignment.CenterVertically) {
        Box(Modifier.size(38.dp).clip(RoundedCornerShape(12.dp)).background(Brand.Mint), contentAlignment = Alignment.Center) {
            Icon(icon, null, tint = Brand.Teal, modifier = Modifier.size(20.dp))
        }
        Spacer(Modifier.width(12.dp))
        Column(Modifier.weight(1f)) {
            Text(title, fontWeight = FontWeight.SemiBold, fontSize = 14.sp)
            Text(subtitle, color = Brand.Muted, fontSize = 12.sp)
        }
        Icon(Icons.AutoMirrored.Filled.KeyboardArrowRight, null, tint = Brand.Muted)
    }
}
