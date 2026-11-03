package com.localcommunity.services

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.runtime.SideEffect
import androidx.compose.ui.graphics.toArgb
import com.localcommunity.services.ui.AppRoot
import com.localcommunity.services.ui.LocalCommunityTheme
import com.localcommunity.services.ui.Page
import com.localcommunity.services.ui.ThemeState
import com.localcommunity.services.ui.Violet

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContent {
            // The status bar follows the theme: Caloocan green in light mode, the dark page colour in dark mode.
            val dark = ThemeState.dark
            SideEffect {
                @Suppress("DEPRECATION")
                window.statusBarColor = (if (dark) Page else Violet).toArgb()
                window.setBackgroundDrawable(android.graphics.drawable.ColorDrawable(Page.toArgb()))
                // dark status bar icons on the light page, light icons on the dark page
                androidx.core.view.WindowCompat.getInsetsController(window, window.decorView).isAppearanceLightStatusBars = !dark
            }
            LocalCommunityTheme {
                AppRoot()
            }
        }
    }
}
