package com.localcommunity.services

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import com.localcommunity.services.ui.AppRoot
import com.localcommunity.services.ui.LocalCommunityTheme

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContent {
            LocalCommunityTheme {
                AppRoot()
            }
        }
    }
}
