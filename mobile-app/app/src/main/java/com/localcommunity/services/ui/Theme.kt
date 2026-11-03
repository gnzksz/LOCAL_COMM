package com.localcommunity.services.ui

import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Shapes
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp

// The City of Caloocan palette, the same as the website. (The names Violet* are kept so no other file changes:
// Violet is now the Caloocan green.)
val Violet = Color(0xFF007A3D)
val VioletDark = Color(0xFF004D26)
val VioletSoft = Color(0xFFE3F3E9)
val Accent = Color(0xFFFF7A00)      // orange: call-to-action buttons
val OnAccent = Color(0xFF004D26)    // text on orange (white would fail contrast)
val Navy = Color(0xFF004D26)
val NavyDeep = Color(0xFF00331A)
val Gold = Color(0xFFFCD20F)
val GoldInk = Color(0xFF7A5800)     // gold as text on light backgrounds
val Success = Color(0xFF006C32)
val Danger = Color(0xFFCF0921)
val Ink = Color(0xFF10231A)
val Muted = Color(0xFF56695E)
val Line = Color(0xFFE2EBE5)
val Page = Color(0xFFF4F8F5)

val AccentInk = Color(0xFF8A3D00)  // orange as text on light tints
val Teal = Color(0xFF0F766E)       // "Assigned" status
val Sky = Color(0xFF34A865)        // lighter green for glows

// Every Material 3 role is set, so no default purple from the library shows up anywhere
// (dialogs, menus, chips, switches, sheets and text fields all use these).
private val colors = lightColorScheme(
    primary = Violet,
    onPrimary = Color.White,
    primaryContainer = VioletSoft,
    onPrimaryContainer = Navy,
    inversePrimary = Color(0xFF5CD18E),
    secondary = Accent,
    onSecondary = OnAccent,
    secondaryContainer = Color(0xFFFFE8D2),
    onSecondaryContainer = AccentInk,
    tertiary = Teal,
    onTertiary = Color.White,
    tertiaryContainer = Color(0xFFD5F0EC),
    onTertiaryContainer = Color(0xFF064E48),
    background = Page,
    onBackground = Ink,
    surface = Color.White,
    onSurface = Ink,
    surfaceVariant = Color(0xFFEDF3EF),
    onSurfaceVariant = Muted,
    surfaceTint = Violet,
    inverseSurface = Color(0xFF172A1F),
    inverseOnSurface = Color(0xFFE4EFE8),
    surfaceBright = Color.White,
    surfaceDim = Color(0xFFE6EEE9),
    surfaceContainerLowest = Color.White,
    surfaceContainerLow = Color(0xFFF8FBF9),
    surfaceContainer = Color(0xFFF4F8F5),
    surfaceContainerHigh = Color(0xFFEDF3EF),
    surfaceContainerHighest = Color(0xFFE6EFE9),
    outline = Color(0xFFC7D5CC),
    outlineVariant = Line,
    error = Danger,
    onError = Color.White,
    errorContainer = Color(0xFFFEF0EF),
    onErrorContainer = Color(0xFFB42318),
    scrim = Color(0xFF03100A),
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
