package com.localcommunity.services.ui

import android.widget.Toast
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.DateRange
import androidx.compose.material.icons.filled.Home
import androidx.compose.material.icons.filled.Notifications
import androidx.compose.material.icons.filled.Person
import androidx.compose.material3.Badge
import androidx.compose.material3.BadgedBox
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.NavigationBar
import androidx.compose.material3.NavigationBarItem
import androidx.compose.material3.NavigationBarItemDefaults
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.navigation.NavGraph.Companion.findStartDestination
import androidx.navigation.NavType
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.currentBackStackEntryAsState
import androidx.navigation.compose.rememberNavController
import androidx.navigation.navArgument
import com.localcommunity.services.data.AppNotification
import com.localcommunity.services.data.Profile
import com.localcommunity.services.data.Repo
import com.localcommunity.services.data.Report
import com.localcommunity.services.data.Session
import com.localcommunity.services.ui.screens.HistoryItem
import com.localcommunity.services.ui.screens.HistoryScreen
import com.localcommunity.services.ui.screens.LoginScreen
import com.localcommunity.services.ui.screens.NewReportScreen
import com.localcommunity.services.ui.screens.NotificationsScreen
import com.localcommunity.services.ui.screens.ProfileScreen
import com.localcommunity.services.ui.screens.ReportDetailScreen
import com.localcommunity.services.ui.screens.ReportsScreen
import com.localcommunity.services.ui.screens.VerifyEmailScreen
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.catch
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.flow.flowOf
import kotlinx.coroutines.flow.map

/** Switches between the sign-in screen and the app, depending on who is signed in. */
@Composable
fun AppRoot() {
    val session by Repo.session.collectAsStateWithLifecycle()
    when (val s = session) {
        Session.Loading -> Box(Modifier.fillMaxSize().background(Page), contentAlignment = Alignment.Center) { CircularProgressIndicator(color = Violet) }
        is Session.SignedOut -> LoginScreen(s.notice, s.stamp)
        is Session.SignedIn -> MainScaffold(s.profile)
    }
}

private data class Tab(val route: String, val label: String, val icon: ImageVector)

private val tabs = listOf(
    Tab("reports", "Reports", Icons.Filled.Home),
    Tab("new", "New", Icons.Filled.Add),
    Tab("notifications", "Alerts", Icons.Filled.Notifications),
    Tab("history", "History", Icons.Filled.DateRange),
    Tab("profile", "Profile", Icons.Filled.Person),
)

@Composable
private fun MainScaffold(profile: Profile) {
    val context = LocalContext.current
    val nav = rememberNavController()
    val backStack by nav.currentBackStackEntryAsState()
    val route = backStack?.destination?.route
    val verified by Repo.emailVerified.collectAsStateWithLifecycle()

    // One live list of each, shared by every screen (so the badge and the screens always agree).
    val reports by remember(profile.id) {
        Repo.reports(profile.id).map<List<Report>, List<Report>?> { it }.catch { emit(emptyList()) }
    }.collectAsStateWithLifecycle(initialValue = null)
    val notifications by remember(profile.id) {
        Repo.notifications(profile.id).map<List<AppNotification>, List<AppNotification>?> { it }.catch { emit(emptyList()) }
    }.collectAsStateWithLifecycle(initialValue = null)
    val unread = notifications.orEmpty().count { !it.isRead }

    // The History tab: the status history of every report, merged, newest first (live).
    // Listeners are only rebuilt when a report is added or removed, not on every status change.
    val reportList = reports
    val history by remember(reportList?.map { it.id }) {
        val flow: Flow<List<HistoryItem>?> = when {
            reportList == null -> flowOf(null)
            reportList.isEmpty() -> flowOf(emptyList())
            else -> combine(reportList.map { r ->
                Repo.history(r.id).catch { emit(emptyList()) }.map { list -> list.map { HistoryItem(r, it) } }
            }) { parts -> parts.flatMap { it }.sortedByDescending { it.entry.createdAt } }
        }
        flow
    }.collectAsStateWithLifecycle(initialValue = null)

    // A short message when a new notification arrives while the app is open.
    var known by remember { mutableStateOf<Set<String>?>(null) }
    LaunchedEffect(notifications) {
        val list = notifications ?: return@LaunchedEffect
        val before = known
        if (before != null) {
            list.filter { it.id !in before && !it.isRead }.forEach { Toast.makeText(context, it.title, Toast.LENGTH_LONG).show() }
        }
        known = list.map { it.id }.toSet()
    }

    Scaffold(
        containerColor = Page,
        bottomBar = {
            if (route in tabs.map { it.route }) {
                NavigationBar(containerColor = Color.White) {
                    tabs.forEach { tab ->
                        NavigationBarItem(
                            selected = route == tab.route,
                            onClick = {
                                nav.navigate(tab.route) {
                                    popUpTo(nav.graph.findStartDestination().id) { saveState = true }
                                    launchSingleTop = true
                                    restoreState = true
                                }
                            },
                            icon = {
                                if (tab.route == "notifications" && unread > 0) {
                                    BadgedBox(badge = { Badge { Text(if (unread > 99) "99+" else unread.toString()) } }) { Icon(tab.icon, tab.label) }
                                } else {
                                    Icon(tab.icon, tab.label)
                                }
                            },
                            label = { Text(tab.label) },
                            colors = NavigationBarItemDefaults.colors(indicatorColor = VioletSoft, selectedIconColor = Violet, selectedTextColor = Violet),
                        )
                    }
                }
            }
        },
    ) { inner ->
        Column(Modifier.padding(inner)) {
        if (!verified) {
            Row(
                Modifier.fillMaxWidth().background(Color(0xFFFFF4C2)).padding(horizontal = 16.dp, vertical = 2.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Text("Verify your email to send reports.", fontSize = 13.sp, fontWeight = FontWeight.SemiBold, color = GoldInk, modifier = Modifier.weight(1f))
                TextButton(onClick = { nav.navigate("new") { launchSingleTop = true } }) { Text("Verify now") }
            }
        }
        NavHost(nav, startDestination = "reports", modifier = Modifier.weight(1f)) {
            composable("reports") {
                ReportsScreen(
                    reports = reports.orEmpty(),
                    loading = reports == null,
                    onOpen = { nav.navigate("detail/$it") },
                    onNew = { nav.navigate("new") },
                )
            }
            composable("new") {
                // Nobody can send a report before confirming their email (the security rules refuse it).
                if (verified) {
                    NewReportScreen(profile) { id ->
                        nav.navigate("detail/$id") { popUpTo("reports") }
                    }
                } else {
                    VerifyEmailScreen(profile.email)
                }
            }
            composable("notifications") {
                NotificationsScreen(notifications.orEmpty()) { n ->
                    if (n.requestId != null) nav.navigate("detail/${n.requestId}")
                }
            }
            composable("history") {
                HistoryScreen(history) { id -> nav.navigate("detail/$id") }
            }
            composable("profile") { ProfileScreen(profile, reports.orEmpty()) }
            composable("detail/{id}", arguments = listOf(navArgument("id") { type = NavType.StringType })) { entry ->
                ReportDetailScreen(id = entry.arguments?.getString("id").orEmpty(), onBack = { nav.popBackStack() })
            }
        }
        }
    }
}
