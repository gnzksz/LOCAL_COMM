package com.localcommunity.services.ui

import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Shapes
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp

// The City of Caloocan palette: green (main) and orange (accent). (The names Violet* / Navy / Gold are kept so
// no other file changes: Violet is now the main green, Navy the dark green, Gold the light orange.)
val Violet = Color(0xFF00843D)      // main green: header, buttons, links
val VioletDark = Color(0xFF005A2B)
val VioletSoft = Color(0xFFE3F2E9)  // light green: cards, chips
val Accent = Color(0xFFFF7A00)      // orange: call-to-action buttons
val OnAccent = Color(0xFF003D1D)    // text on orange (white would fail contrast)
val Navy = Color(0xFF005A2B)
val NavyDeep = Color(0xFF003D1D)
val Gold = Color(0xFFFFD8A8)        // light orange: Pending badge
val GoldInk = Color(0xFF8A4B00)     // orange as text on light backgrounds
val Success = Color(0xFF006C32)
val Danger = Color(0xFFCF0921)
val Ink = Color(0xFF0F1A14)
val Muted = Color(0xFF5B6B62)
val Line = Color(0xFFE2EAE5)
val Page = Color(0xFFF5F8F6)

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
    surfaceVariant = Color(0xFFEEF3F0),
    onSurfaceVariant = Muted,
    outline = Color(0xFFD3DED7),
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
