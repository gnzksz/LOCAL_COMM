package com.localcommunity.services.ui.screens

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.localcommunity.services.data.Report
import com.localcommunity.services.data.Status
import com.localcommunity.services.ui.DataUrlImage
import com.localcommunity.services.ui.Ink
import com.localcommunity.services.ui.Muted
import com.localcommunity.services.ui.ScreenTitle
import com.localcommunity.services.ui.StatCard
import com.localcommunity.services.ui.StatusChip
import com.localcommunity.services.ui.timeAgo

@Composable
fun ReportsScreen(reports: List<Report>, loading: Boolean, onOpen: (String) -> Unit, onNew: () -> Unit) {
    fun count(vararg s: String) = reports.count { it.status in s }

    LazyColumn(Modifier.fillMaxSize(), contentPadding = androidx.compose.foundation.layout.PaddingValues(16.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
        item { ScreenTitle("My reports", "Status updates appear here live.") }
        item {
            Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                    StatCard("Total reports", reports.size, Color(0xFF2F5BEA), Modifier.weight(1f))
                    StatCard("Pending", count(Status.PENDING), Color(0xFFB7791F), Modifier.weight(1f))
                }
                Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                    StatCard("Being fixed", count(Status.ASSIGNED, Status.IN_PROGRESS), Color(0xFF6D3FE0), Modifier.weight(1f))
                    StatCard("Resolved", count(Status.RESOLVED, Status.ARCHIVED), Color(0xFF15803D), Modifier.weight(1f))
                }
            }
        }
        if (reports.isEmpty()) {
            item {
                Column(Modifier.fillMaxWidth().padding(vertical = 36.dp), horizontalAlignment = Alignment.CenterHorizontally) {
                    Text(if (loading) "Loading…" else "You have not sent any reports yet.", color = Muted)
                    if (!loading) {
                        Button(onClick = onNew, modifier = Modifier.padding(top = 14.dp)) { Text("Send your first report") }
                    }
                }
            }
        }
        items(reports, key = { it.id }) { report -> ReportRow(report) { onOpen(report.id) } }
    }
}

@Composable
private fun ReportRow(report: Report, onClick: () -> Unit) {
    Card(
        modifier = Modifier.fillMaxWidth().clickable(onClick = onClick),
        shape = RoundedCornerShape(16.dp),
        colors = CardDefaults.cardColors(containerColor = Color.White),
        elevation = CardDefaults.cardElevation(defaultElevation = 1.dp),
    ) {
        Row(Modifier.padding(12.dp), horizontalArrangement = Arrangement.spacedBy(12.dp), verticalAlignment = Alignment.CenterVertically) {
            DataUrlImage(report.thumb, Modifier.size(64.dp).clip(RoundedCornerShape(12.dp)))
            Column(Modifier.weight(1f)) {
                Text(report.issueType, fontWeight = FontWeight.Bold, color = Ink, maxLines = 1, overflow = TextOverflow.Ellipsis)
                Text(report.description, color = Muted, fontSize = 13.sp, maxLines = 2, overflow = TextOverflow.Ellipsis)
                Row(Modifier.padding(top = 6.dp), horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically) {
                    StatusChip(report.status)
                    Text(timeAgo(report.createdAt), color = Muted, fontSize = 12.sp)
                }
            }
        }
    }
}
