package com.localcommunity.services.ui

import android.content.Context
import android.content.res.Configuration
import android.provider.Settings
import android.view.View
import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.CubicBezierEasing
import androidx.compose.animation.core.tween
import androidx.compose.foundation.Image
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Shapes
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.drawWithContent
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Rect
import androidx.compose.ui.graphics.ClipOp
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.ImageBitmap
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.graphics.drawscope.clipPath
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.unit.dp
import androidx.core.view.drawToBitmap
import kotlin.math.hypot

// ---- Light / dark mode -----------------------------------------------------------------------------------------

/**
 * The app's light/dark choice, the same idea as the website: saved on the phone, and the first time it follows the
 * phone's own setting. Every colour below reads [dark], so the whole app repaints when it changes.
 */
object ThemeState {
    private const val PREFS = "lcs"
    private const val KEY = "theme"
    private var prefs: android.content.SharedPreferences? = null

    var dark by mutableStateOf(false)
        private set

    /** The screen as it looked just before switching; drawn over the new theme and wiped away (see [ThemeRevealHost]). */
    internal var snapshot by mutableStateOf<ImageBitmap?>(null)

    fun init(context: Context) {
        prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
        val saved = prefs?.getString(KEY, null)
        dark = saved?.let { it == "dark" }
            ?: ((context.resources.configuration.uiMode and Configuration.UI_MODE_NIGHT_MASK) == Configuration.UI_MODE_NIGHT_YES)
    }

    /**
     * Switch light <-> dark with the same motion as the website: the new theme spreads from the top-right corner,
     * to the left and down. No motion when the phone has animations turned off.
     */
    fun toggle(view: View) {
        val animationsOff = Settings.Global.getFloat(view.context.contentResolver, Settings.Global.ANIMATOR_DURATION_SCALE, 1f) == 0f
        if (!animationsOff && view.width > 0 && view.height > 0) {
            snapshot = runCatching { view.drawToBitmap().asImageBitmap() }.getOrNull()
        }
        dark = !dark
        prefs?.edit()?.putString(KEY, if (dark) "dark" else "light")?.apply()
    }
}

/** One pace for every dark mode switch, the same as the website (0.85 s). */
const val THEME_MOTION_MS = 850

/** Draws the old screen over the new theme and wipes it away in a circle growing from the top-right corner. */
@Composable
fun ThemeRevealHost(content: @Composable () -> Unit) {
    Box(Modifier.fillMaxSize()) {
        content()
        val shot = ThemeState.snapshot
        if (shot != null) {
            val progress = remember(shot) { Animatable(0f) }
            LaunchedEffect(shot) {
                progress.animateTo(1f, tween(THEME_MOTION_MS, easing = CubicBezierEasing(.45f, 0f, .25f, 1f)))
                ThemeState.snapshot = null
            }
            Image(
                bitmap = shot,
                contentDescription = null,
                contentScale = ContentScale.FillBounds,
                modifier = Modifier.fillMaxSize().drawWithContent {
                    val radius = hypot(size.width, size.height) * progress.value
                    val hole = Path().apply { addOval(Rect(center = Offset(size.width, 0f), radius = radius)) }
                    clipPath(hole, ClipOp.Difference) { this@drawWithContent.drawContent() }
                },
            )
        }
    }
}

private fun pick(light: Long, dark: Long) = Color(if (ThemeState.dark) dark else light)

// ---- The City of Caloocan palette, the same as the website (light, and the website's dark mode) -----------------
// The names Violet* are kept so no other file changes: Violet is the Caloocan green.

val Violet: Color get() = pick(0xFF007A3D, 0xFF5CD18E)
val VioletDark: Color get() = pick(0xFF004D26, 0xFF92E2B2)
val VioletSoft: Color get() = pick(0xFFE3F3E9, 0xFF133D26)
val Accent = Color(0xFFFF7A00)      // orange: call-to-action buttons (the same in both)
val OnAccent = Color(0xFF004D26)    // text on orange (white would fail contrast)
val Navy: Color get() = pick(0xFF004D26, 0xFF0C2416)
val NavyDeep: Color get() = pick(0xFF00331A, 0xFF050D08)
val Gold = Color(0xFFFCD20F)
val GoldInk: Color get() = pick(0xFF7A5800, 0xFFFCD20F)     // gold as text
val Success: Color get() = pick(0xFF006C32, 0xFF3ECF7A)
val Danger: Color get() = pick(0xFFCF0921, 0xFFFF6B7D)
val Ink: Color get() = pick(0xFF10231A, 0xFFE4EFE8)
val Muted: Color get() = pick(0xFF56695E, 0xFF97B3A2)
val Line: Color get() = pick(0xFFE2EBE5, 0xFF21382A)
val Page: Color get() = pick(0xFFF4F8F5, 0xFF0A1510)
val OnPrimary: Color get() = pick(0xFFFFFFFF, 0xFF00230F)   // text and spinners on the green (light green in dark mode)

val AccentInk: Color get() = pick(0xFF8A3D00, 0xFFFFB066)  // orange as text on light tints
val Teal = Color(0xFF0F766E)       // "Assigned" status
val Sky = Color(0xFF34A865)        // lighter green for glows

// surfaces and tints that used to be fixed light colours
val CardBg: Color get() = pick(0xFFFFFFFF, 0xFF101E16)        // cards, the bottom bar, list rows
val Placeholder: Color get() = pick(0xFFE4EDE7, 0xFF1F3628)   // empty photo, progress track
val WarnBg: Color get() = pick(0xFFFFF4C2, 0xFF3A3205)        // "verify your email" banner
val ErrorBg: Color get() = pick(0xFFFEF0EF, 0xFF3A1418)
val ErrorText: Color get() = pick(0xFFB42318, 0xFFFF9AA6)
val SuccessSoft: Color get() = pick(0xFFDDEFE5, 0xFF143A25)
val ArchivedBg: Color get() = pick(0xFFE3E9E5, 0xFF30493A)
val ArchivedText: Color get() = pick(0xFF344A3D, 0xFFE3E9E5)

// Every Material 3 role is set, so no default purple from the library shows up anywhere
// (dialogs, menus, chips, switches, sheets and text fields all use these).
private val lightColors = lightColorScheme(
    primary = Color(0xFF007A3D),
    onPrimary = Color.White,
    primaryContainer = Color(0xFFE3F3E9),
    onPrimaryContainer = Color(0xFF004D26),
    inversePrimary = Color(0xFF5CD18E),
    secondary = Accent,
    onSecondary = OnAccent,
    secondaryContainer = Color(0xFFFFE8D2),
    onSecondaryContainer = Color(0xFF8A3D00),
    tertiary = Teal,
    onTertiary = Color.White,
    tertiaryContainer = Color(0xFFD5F0EC),
    onTertiaryContainer = Color(0xFF064E48),
    background = Color(0xFFF4F8F5),
    onBackground = Color(0xFF10231A),
    surface = Color.White,
    onSurface = Color(0xFF10231A),
    surfaceVariant = Color(0xFFEDF3EF),
    onSurfaceVariant = Color(0xFF56695E),
    surfaceTint = Color(0xFF007A3D),
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
    outlineVariant = Color(0xFFE2EBE5),
    error = Color(0xFFCF0921),
    onError = Color.White,
    errorContainer = Color(0xFFFEF0EF),
    onErrorContainer = Color(0xFFB42318),
    scrim = Color(0xFF03100A),
)

// The website's dark mode, role by role.
private val darkColors = darkColorScheme(
    primary = Color(0xFF5CD18E),
    onPrimary = Color(0xFF00230F),
    primaryContainer = Color(0xFF133D26),
    onPrimaryContainer = Color(0xFF92E2B2),
    inversePrimary = Color(0xFF007A3D),
    secondary = Accent,
    onSecondary = OnAccent,
    secondaryContainer = Color(0xFF3D2410),
    onSecondaryContainer = Color(0xFFFFB066),
    tertiary = Color(0xFF5EC9BE),
    onTertiary = Color(0xFF00201D),
    tertiaryContainer = Color(0xFF0B3D39),
    onTertiaryContainer = Color(0xFFA7EDE5),
    background = Color(0xFF0A1510),
    onBackground = Color(0xFFE4EFE8),
    surface = Color(0xFF101E16),
    onSurface = Color(0xFFE4EFE8),
    surfaceVariant = Color(0xFF172A1F),
    onSurfaceVariant = Color(0xFF97B3A2),
    surfaceTint = Color(0xFF5CD18E),
    inverseSurface = Color(0xFFE4EFE8),
    inverseOnSurface = Color(0xFF172A1F),
    surfaceBright = Color(0xFF1F3628),
    surfaceDim = Color(0xFF0A1510),
    surfaceContainerLowest = Color(0xFF07100B),
    surfaceContainerLow = Color(0xFF0E1A13),
    surfaceContainer = Color(0xFF101E16),
    surfaceContainerHigh = Color(0xFF14251B),
    surfaceContainerHighest = Color(0xFF1A2D21),
    outline = Color(0xFF30493A),
    outlineVariant = Color(0xFF21382A),
    error = Color(0xFFFF6B7D),
    onError = Color(0xFF3A0008),
    errorContainer = Color(0xFF3A1418),
    onErrorContainer = Color(0xFFFF9AA6),
    scrim = Color(0xFF000000),
)

@Composable
fun LocalCommunityTheme(content: @Composable () -> Unit) {
    MaterialTheme(
        colorScheme = if (ThemeState.dark) darkColors else lightColors,
        shapes = Shapes(
            small = RoundedCornerShape(10.dp),
            medium = RoundedCornerShape(14.dp),
            large = RoundedCornerShape(20.dp),
        ),
    ) { ThemeRevealHost(content) }
}
