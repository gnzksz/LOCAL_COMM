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
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.localcommunity.services.data.HistoryEntry
import com.localcommunity.services.data.Report
import com.localcommunity.services.ui.CardBg
import com.localcommunity.services.ui.Ink
import com.localcommunity.services.ui.Muted
import com.localcommunity.services.ui.ScreenTitle
import com.localcommunity.services.ui.StatusChip
import com.localcommunity.services.ui.Violet
import com.localcommunity.services.ui.formatDateTime

/** One status change of one of my reports. */
data class HistoryItem(val report: Report, val entry: HistoryEntry)

/** Every status change of every report, newest first: its own tab, apart from the Alerts (notifications). */
@Composable
fun HistoryScreen(items: List<HistoryItem>?, onOpen: (String) -> Unit) {
    LazyColumn(Modifier.fillMaxSize(), contentPadding = PaddingValues(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
        item { ScreenTitle("Status history", "Every status update of all your reports.") }
        when {
            items == null -> item {
                Box(Modifier.fillMaxWidth().padding(vertical = 30.dp), contentAlignment = Alignment.Center) { CircularProgressIndicator() }
            }
            items.isEmpty() -> item { Text("No status updates yet.", color = Muted, modifier = Modifier.padding(vertical = 30.dp)) }
            else -> items(items, key = { "${it.report.id}-${it.entry.createdAt}-${it.entry.status}" }) { item ->
                Row(
                    Modifier
                        .fillMaxWidth()
                        .clip(RoundedCornerShape(14.dp))
                        .background(CardBg)
                        .clickable { onOpen(item.report.id) }
                        .padding(14.dp),
                    horizontalArrangement = Arrangement.spacedBy(12.dp),
                ) {
                    Box(Modifier.padding(top = 6.dp).size(10.dp).clip(CircleShape).background(Violet))
                    Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(3.dp)) {
                        Text(item.report.issueType, fontWeight = FontWeight.ExtraBold, color = Ink)
                        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                            StatusChip(item.entry.status)
                            Text(formatDateTime(item.entry.createdAt), color = Muted, fontSize = 11.sp)
                        }
                        Text("by ${item.entry.actorName} (${item.entry.actorRole})", color = Muted, fontSize = 12.sp)
                        if (!item.entry.note.isNullOrBlank()) Text(item.entry.note, color = Ink, fontSize = 14.sp)
                    }
                }
            }
        }
    }
}
