package com.catatanku.auto.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Shapes
import androidx.compose.material3.Text
import androidx.compose.material3.Typography
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import java.text.NumberFormat
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

object Brand {
    val Teal = Color(0xFF0F766E)
    val TealLight = Color(0xFF14B8A6)
    val Mint = Color(0xFFCCFBF1)
    val Bg = Color(0xFFF3F6F6)
    val Ink = Color(0xFF0B1F1D)
    val Muted = Color(0xFF64748B)
    val Good = Color(0xFF059669)
    val Bad = Color(0xFFDC2626)
    val Warn = Color(0xFFF59E0B)
    val Header = Brush.linearGradient(listOf(Color(0xFF0F766E), Color(0xFF0D9488), Color(0xFF14B8A6)))
}

private val Colors = lightColorScheme(
    primary = Brand.Teal,
    onPrimary = Color.White,
    primaryContainer = Brand.Mint,
    onPrimaryContainer = Brand.Teal,
    secondary = Brand.TealLight,
    background = Brand.Bg,
    surface = Color.White,
    onSurface = Brand.Ink,
    onSurfaceVariant = Brand.Muted,
    surfaceContainer = Color.White,
    error = Brand.Bad,
)

private val Type = Typography(
    headlineMedium = TextStyle(fontSize = 26.sp, fontWeight = FontWeight.ExtraBold, letterSpacing = (-0.5).sp),
    titleLarge = TextStyle(fontSize = 20.sp, fontWeight = FontWeight.Bold),
    titleMedium = TextStyle(fontSize = 16.sp, fontWeight = FontWeight.Bold),
    bodyMedium = TextStyle(fontSize = 14.sp, lineHeight = 20.sp),
    labelMedium = TextStyle(fontSize = 12.sp, fontWeight = FontWeight.SemiBold),
)

@Composable
fun CatatankuTheme(content: @Composable () -> Unit) = MaterialTheme(
    colorScheme = Colors,
    typography = Type,
    shapes = Shapes(medium = RoundedCornerShape(20.dp), large = RoundedCornerShape(28.dp)),
    content = content,
)

private val idr = NumberFormat.getNumberInstance(Locale("in", "ID"))
fun rupiah(n: Long) = "Rp ${idr.format(n)}"

fun timeAgo(ms: Long, now: Long = System.currentTimeMillis()): String {
    val m = (now - ms) / 60_000
    return when {
        m < 1 -> "baru saja"
        m < 60 -> "$m mnt lalu"
        m < 24 * 60 -> "${m / 60} jam lalu"
        m < 7 * 24 * 60 -> "${m / (24 * 60)} hari lalu"
        else -> SimpleDateFormat("d MMM yyyy", Locale("in", "ID")).format(Date(ms))
    }
}

fun initials(name: String) = name.split(" ").filter { it.isNotBlank() }.take(2).joinToString("") { it.first().uppercase() }.ifEmpty { "?" }

@Composable
fun InitialsAvatar(name: String, size: Dp = 44.dp, bg: Color = Color.White.copy(alpha = 0.2f), fg: Color = Color.White) {
    Box(Modifier.size(size).clip(RoundedCornerShape(size / 2.6f)).background(bg), contentAlignment = Alignment.Center) {
        Text(initials(name), color = fg, fontWeight = FontWeight.ExtraBold, fontSize = (size.value / 2.8f).sp)
    }
}
