package com.localcommunity.services.ui

import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Shapes
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp

// The same violet look as the resident area of the website.
val Violet = Color(0xFF6D4AFF)
val VioletDark = Color(0xFF5836E0)
val VioletSoft = Color(0xFFECE7FF)
val Accent = Color(0xFFC084FC)
val Ink = Color(0xFF0F172A)
val Muted = Color(0xFF5B6785)
val Line = Color(0xFFE4E9F5)
val Page = Color(0xFFF4F7FF)

private val colors = lightColorScheme(
    primary = Violet,
    onPrimary = Color.White,
    primaryContainer = VioletSoft,
    onPrimaryContainer = Color(0xFF3A1FB0),
    secondary = Accent,
    background = Page,
    onBackground = Ink,
    surface = Color.White,
    onSurface = Ink,
    surfaceVariant = Color(0xFFEEF1F8),
    onSurfaceVariant = Muted,
    outline = Color(0xFFD5DCEE),
    outlineVariant = Line,
    error = Color(0xFFB42318),
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
