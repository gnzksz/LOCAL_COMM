package com.localcommunity.services.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.localcommunity.services.data.AppNotification
import com.localcommunity.services.data.Repo
import com.localcommunity.services.ui.CardBg
import com.localcommunity.services.ui.Ink
import com.localcommunity.services.ui.Muted
import com.localcommunity.services.ui.ScreenTitle
import com.localcommunity.services.ui.Violet
import com.localcommunity.services.ui.VioletSoft
import com.localcommunity.services.ui.timeAgo
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch

/** How long a notification stays marked "new" while this screen is open. */
private const val SEEN_AFTER_MS = 1500L

@Composable
fun NotificationsScreen(list: List<AppNotification>, onOpen: (AppNotification) -> Unit) {
    val unread = list.filter { !it.isRead }
    val scope = rememberCoroutineScope()

    // Everything shown here counts as seen shortly after it appears (also for ones that arrive meanwhile).
    LaunchedEffect(unread.map { it.id }) {
        if (unread.isNotEmpty()) {
            delay(SEEN_AFTER_MS)
            runCatching { Repo.markAllNotificationsRead(list) }
        }
    }

    LazyColumn(Modifier.fillMaxSize(), contentPadding = PaddingValues(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
        item {
            Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.Top) {
                Box(Modifier.weight(1f)) { ScreenTitle("Notifications", "Sent when your report is rejected, In Progress or Resolved.") }
                OutlinedButton(
                    onClick = { scope.launch { runCatching { Repo.markAllNotificationsRead(list) } } },
                    enabled = unread.isNotEmpty(),
                    shape = RoundedCornerShape(12.dp),
                ) { Text("Mark all as read", fontSize = 12.sp) }
            }
        }
        if (list.isEmpty()) {
            item { Text("No notifications yet.", color = Muted, modifier = Modifier.padding(vertical = 30.dp)) }
        }
        items(list, key = { it.id }) { n ->
            Row(
                Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(14.dp))
                    .background(if (n.isRead) CardBg else VioletSoft)
                    .clickable {
                        if (!n.isRead) scope.launch { runCatching { Repo.markNotificationRead(n.id) } }
                        onOpen(n)
                    }
                    .padding(14.dp),
                horizontalArrangement = Arrangement.spacedBy(12.dp),
            ) {
                Box(
                    Modifier
                        .padding(top = 6.dp)
                        .size(9.dp)
                        .clip(CircleShape)
                        .background(if (n.isRead) Color.Transparent else Violet)
                )
                Column(Modifier.weight(1f)) {
                    // unread: bold + dot + highlighted; read: plain (but still listed)
                    Text(n.title, fontWeight = if (n.isRead) FontWeight.Normal else FontWeight.ExtraBold, color = if (n.isRead) Muted else Ink)
                    Text(n.message, color = if (n.isRead) Muted else Ink, fontSize = 14.sp)
                    Text(timeAgo(n.createdAt), color = Muted, fontSize = 12.sp, modifier = Modifier.padding(top = 2.dp))
                }
            }
        }
    }
}
