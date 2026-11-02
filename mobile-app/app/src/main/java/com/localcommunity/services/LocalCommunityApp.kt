package com.localcommunity.services

import android.app.Application
import com.localcommunity.services.data.Repo
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import org.osmdroid.config.Configuration
import java.io.File

class LocalCommunityApp : Application() {
    override fun onCreate() {
        super.onCreate()

        // The OpenStreetMap library: it must say who is asking for map tiles, and it keeps its cache in the app's cache folder.
        Configuration.getInstance().apply {
            userAgentValue = packageName
            osmdroidBasePath = File(cacheDir, "osmdroid")
            osmdroidTileCache = File(cacheDir, "osmdroid/tiles")
        }

        // Watch the sign-in state for as long as the app lives (Firebase itself starts automatically).
        Repo.start(CoroutineScope(SupervisorJob() + Dispatchers.Main.immediate))
    }
}
