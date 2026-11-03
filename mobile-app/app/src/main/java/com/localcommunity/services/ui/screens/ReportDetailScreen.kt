package com.localcommunity.services.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.produceState
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.localcommunity.services.data.HistoryEntry
import com.localcommunity.services.data.Report
import com.localcommunity.services.data.Repo
import com.localcommunity.services.data.Status
import com.localcommunity.services.ui.DataUrlImage
import com.localcommunity.services.ui.ErrorBox
import com.localcommunity.services.ui.Ink
import com.localcommunity.services.ui.MapPicker
import com.localcommunity.services.ui.Muted
import com.localcommunity.services.ui.GoldInk
import com.localcommunity.services.ui.VioletSoft
import com.localcommunity.services.ui.StatusChip
import com.localcommunity.services.ui.Violet
import com.localcommunity.services.ui.formatDateTime
import kotlinx.coroutines.flow.catch
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.launch

private sealed interface Load {
    data object Loading : Load
    data class Ok(val report: Report?) : Load
    data class Failed(val message: String) : Load
}

@Composable
fun ReportDetailScreen(id: String, onBack: () -> Unit) {
    val state by remember(id) {
        Repo.report(id).map<Report?, Load> { Load.Ok(it) }.catch { emit(Load.Failed(Repo.errorMessage(it))) }
    }.collectAsStateWithLifecycle(initialValue = Load.Loading)
    val history by remember(id) { Repo.history(id).catch { emit(emptyList()) } }.collectAsStateWithLifecycle(initialValue = emptyList())
    val fullPhoto by produceState<String?>(initialValue = null, id) { value = runCatching { Repo.photo(id) }.getOrNull() }

    Column(Modifier.fillMaxSize()) {
        TextButton(onClick = onBack, modifier = Modifier.padding(horizontal = 8.dp)) {
            Icon(Icons.AutoMirrored.Filled.ArrowBack, null, Modifier.size(18.dp))
            Text("  My reports")
        }
        when (val s = state) {
            Load.Loading -> Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) { CircularProgressIndicator() }
            is Load.Failed -> ErrorBox(s.message, Modifier.padding(16.dp).fillMaxWidth())
            is Load.Ok -> {
                val r = s.report
                if (r == null) ErrorBox("Report not found.", Modifier.padding(16.dp).fillMaxWidth())
                else Details(r, fullPhoto, history)
            }
        }
    }
}

@Composable
private fun Details(r: Report, fullPhoto: String?, history: List<HistoryEntry>) {
    Column(
        Modifier
            .fillMaxSize()
            .verticalScroll(rememberScrollState())
            .padding(horizontal = 16.dp),
        verticalArrangement = Arrangement.spacedBy(14.dp),
    ) {
        Column {
            Text(r.issueType, fontSize = 22.sp, fontWeight = FontWeight.ExtraBold, color = Ink)
            Row(Modifier.padding(top = 6.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                StatusChip(r.status)
                Text("sent ${formatDateTime(r.createdAt)}", color = Muted, fontSize = 12.sp)
            }
        }

        Card(shape = RoundedCornerShape(18.dp), colors = CardDefaults.cardColors(containerColor = Color.White), elevation = CardDefaults.cardElevation(1.dp)) {
            Column(Modifier.padding(14.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                DataUrlImage(
                    url = fullPhoto ?: r.thumb,
                    modifier = Modifier.fillMaxWidth().height(220.dp).clip(RoundedCornerShape(14.dp)),
                    contentScale = ContentScale.Crop,
                )
                Text(r.description, color = Ink)
                InfoLine("Address", r.address ?: "—")
                InfoLine("Assigned to", if (r.staffName != null) "${r.staffName} · ${r.departmentName ?: ""}" else "—")
                if (r.rejectionReason != null) ErrorBox("Not accepted: ${r.rejectionReason}", Modifier.fillMaxWidth())
                if (r.rating != null) {
                    Text("Your feedback", fontWeight = FontWeight.Bold, color = Ink)
                    Text("★".repeat(r.rating) + "☆".repeat(5 - r.rating), color = GoldInk, fontSize = 20.sp)
                    if (!r.feedback.isNullOrBlank()) Text(r.feedback, color = Ink)
                }
            }
        }

        if (r.status == Status.RESOLVED && r.rating == null) FeedbackCard(r.id)

        Card(shape = RoundedCornerShape(18.dp), colors = CardDefaults.cardColors(containerColor = Color.White), elevation = CardDefaults.cardElevation(1.dp)) {
            Column(Modifier.padding(14.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                Text("Location", fontWeight = FontWeight.ExtraBold, color = Ink)
                MapPicker(
                    latitude = r.latitude,
                    longitude = r.longitude,
                    interactive = false,
                    modifier = Modifier.fillMaxWidth().height(200.dp).clip(RoundedCornerShape(14.dp)),
                )
            }
        }

        Card(shape = RoundedCornerShape(18.dp), colors = CardDefaults.cardColors(containerColor = Color.White), elevation = CardDefaults.cardElevation(1.dp)) {
            Column(Modifier.padding(14.dp)) {
                Text("Status history", fontWeight = FontWeight.ExtraBold, color = Ink, modifier = Modifier.padding(bottom = 10.dp))
                if (history.isEmpty()) Text("No updates yet.", color = Muted)
                history.forEach { entry ->
                    Row(Modifier.padding(bottom = 12.dp), horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                        Box(Modifier.padding(top = 5.dp).size(10.dp).clip(CircleShape).background(Violet))
                        Column {
                            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                                StatusChip(entry.status)
                                Text(formatDateTime(entry.createdAt), color = Muted, fontSize = 11.sp)
                            }
                            Text("by ${entry.actorName} (${entry.actorRole})", color = Muted, fontSize = 12.sp)
                            if (!entry.note.isNullOrBlank()) Text(entry.note, color = Ink, fontSize = 14.sp)
                        }
                    }
                }
            }
        }
        Box(Modifier.height(16.dp))
    }
}

@Composable
private fun InfoLine(label: String, value: String) {
    Row {
        Text(label, color = Muted, fontSize = 13.sp, modifier = Modifier.weight(0.4f))
        Text(value, color = Ink, fontSize = 13.sp, modifier = Modifier.weight(0.6f))
    }
}

/** "Rate / give feedback" once the report is Resolved. */
@Composable
private fun FeedbackCard(reportId: String) {
    var rating by remember { mutableIntStateOf(0) }
    var feedback by remember { mutableStateOf("") }
    var busy by remember { mutableStateOf(false) }
    var error by remember { mutableStateOf<String?>(null) }
    val scope = rememberCoroutineScope()

    Card(shape = RoundedCornerShape(18.dp), colors = CardDefaults.cardColors(containerColor = VioletSoft), elevation = CardDefaults.cardElevation(0.dp)) {
        Column(Modifier.padding(14.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
            Text("Rate the service", fontWeight = FontWeight.ExtraBold, color = Ink)
            Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                for (n in 1..5) {
                    Text(
                        if (n <= rating) "★" else "☆",
                        color = GoldInk,
                        fontSize = 34.sp,
                        modifier = Modifier.clickable { rating = n },
                    )
                }
            }
            OutlinedTextField(
                value = feedback,
                onValueChange = { feedback = it.take(1000) },
                label = { Text("Feedback (optional)") },
                minLines = 2,
                modifier = Modifier.fillMaxWidth(),
            )
            if (error != null) ErrorBox(error!!, Modifier.fillMaxWidth())
            Button(
                onClick = {
                    if (rating == 0) {
                        error = "Choose 1 to 5 stars."
                        return@Button
                    }
                    busy = true
                    error = null
                    scope.launch {
                        try {
                            Repo.submitFeedback(reportId, rating, feedback)
                        } catch (e: Exception) {
                            error = Repo.errorMessage(e)
                        }
                        busy = false
                    }
                },
                enabled = !busy,
                modifier = Modifier.fillMaxWidth().height(48.dp),
                shape = RoundedCornerShape(12.dp),
            ) { Text("Send feedback", fontWeight = FontWeight.Bold) }
        }
    }
}
