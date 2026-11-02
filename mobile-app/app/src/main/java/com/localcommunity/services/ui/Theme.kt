package com.localcommunity.services.ui

import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Shapes
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp

// The City of Caloocan palette, the same as the website. (The names Violet* are kept so no other file changes:
// Violet is now the royal blue.)
val Violet = Color(0xFF0035AA)
val VioletDark = Color(0xFF002368)
val VioletSoft = Color(0xFFE6ECFA)
val Accent = Color(0xFFFF7A00)      // orange: call-to-action buttons
val OnAccent = Color(0xFF002368)    // text on orange (white would fail contrast)
val Navy = Color(0xFF002368)
val NavyDeep = Color(0xFF001A4D)
val Gold = Color(0xFFFCD20F)
val GoldInk = Color(0xFF7A5800)     // gold as text on light backgrounds
val Success = Color(0xFF006C32)
val Danger = Color(0xFFCF0921)
val Ink = Color(0xFF0F172A)
val Muted = Color(0xFF5B6785)
val Line = Color(0xFFE4E9F5)
val Page = Color(0xFFF5F7FC)

private val colors = lightColorScheme(
    primary = Violet,
    onPrimary = Color.White,
    primaryContainer = VioletSoft,
    onPrimaryContainer = Navy,
    secondary = Accent,
    background = Page,
    onBackground = Ink,
    surface = Color.White,
    onSurface = Ink,
    surfaceVariant = Color(0xFFEEF1F8),
    onSurfaceVariant = Muted,
    outline = Color(0xFFD5DCEE),
    outlineVariant = Line,
    error = Danger,
)

@Composable
fun LocalCommunityTheme(content: @Composable () -> Unit) {
    MaterialTheme(
        colorScheme = colors,
        shapes = Shapes(
            small = RoundedCornerShape(10.dp),
            medium = RoundedCornerShape(14.dp),
            large = RoundedCornerShape(20.dp),
        ),
        content = content,
    )
}
