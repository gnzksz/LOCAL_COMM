package com.localcommunity.services.ui

import android.text.format.DateUtils
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.produceState
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.ImageBitmap
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.localcommunity.services.data.Images
import com.localcommunity.services.data.Status
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.text.DateFormat
import java.util.Date

/** Shows a "data:image/jpeg;base64,..." picture (or [placeholder] while there is none / it is loading). */
@Composable
fun DataUrlImage(
    url: String?,
    modifier: Modifier = Modifier,
    contentScale: ContentScale = ContentScale.Crop,
    placeholder: @Composable () -> Unit = {},
) {
    val bitmap by produceState<ImageBitmap?>(initialValue = null, url) {
        value = if (url.isNullOrBlank()) null else withContext(Dispatchers.Default) { Images.decodeDataUrl(url)?.asImageBitmap() }
    }
    val image = bitmap
    if (image != null) {
        Image(bitmap = image, contentDescription = null, modifier = modifier, contentScale = contentScale)
    } else {
        Box(modifier.background(Color(0xFFE4EDE7)), contentAlignment = Alignment.Center) { placeholder() }
    }
}

/** A round picture of the user, or their initials. */
@Composable
fun Avatar(photo: String?, name: String, size: Dp, modifier: Modifier = Modifier) {
    val initials = name.split(" ").filter { it.isNotBlank() }.take(2).joinToString("") { it.first().uppercase() }.ifEmpty { "?" }
    DataUrlImage(
        url = photo,
        modifier = modifier.size(size).clip(CircleShape).background(VioletSoft),
        placeholder = { Text(initials, color = Violet, fontWeight = FontWeight.ExtraBold, fontSize = (size.value * 0.36f).sp) },
    )
}

private data class Chip(val background: Color, val text: Color)

private fun chipColors(status: String) = when (status) {
    // the same status colours as the website
    Status.PENDING -> Chip(Color(0xFFFCD20F), Color(0xFF3B2F00))
    Status.ASSIGNED -> Chip(Color(0xFF0F766E), Color.White)
    Status.IN_PROGRESS -> Chip(Color(0xFFFF7A00), Color(0xFF2B1600))
    Status.RESOLVED -> Chip(Color(0xFF006C32), Color.White)
    Status.REJECTED -> Chip(Color(0xFFCF0921), Color.White)
    else -> Chip(Color(0xFFE3E9E5), Color(0xFF344A3D))
}

@Composable
fun StatusChip(status: String, modifier: Modifier = Modifier) {
    val c = chipColors(status)
    Box(modifier.clip(RoundedCornerShape(50)).background(c.background).padding(horizontal = 10.dp, vertical = 3.dp)) {
        Text(status, color = c.text, fontSize = 12.sp, fontWeight = FontWeight.Bold)
    }
}

/** A number with a label, like the stat cards on the website. */
@Composable
fun StatCard(label: String, value: Int, tint: Color, modifier: Modifier = Modifier) {
    Card(
        modifier = modifier,
        colors = CardDefaults.cardColors(containerColor = Color.White),
        elevation = CardDefaults.cardElevation(defaultElevation = 1.dp),
    ) {
        Row(Modifier.padding(14.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
            Box(Modifier.size(40.dp).clip(RoundedCornerShape(10.dp)).background(tint.copy(alpha = 0.15f)), contentAlignment = Alignment.Center) {
                Box(Modifier.size(12.dp).clip(CircleShape).background(tint))
            }
            Column {
                Text(value.toString(), fontSize = 24.sp, fontWeight = FontWeight.ExtraBold, color = Ink)
                Text(label, fontSize = 12.sp, color = Muted)
            }
        }
    }
}

@Composable
fun ScreenTitle(title: String, subtitle: String? = null) {
    Column(Modifier.padding(bottom = 14.dp)) {
        Text(title, style = MaterialTheme.typography.headlineSmall, fontWeight = FontWeight.ExtraBold, color = Ink)
        if (subtitle != null) Text(subtitle, color = Muted, fontSize = 14.sp)
    }
}

@Composable
fun ErrorBox(message: String, modifier: Modifier = Modifier) {
    Box(modifier.clip(RoundedCornerShape(10.dp)).background(Color(0xFFFEF0EF)).padding(12.dp)) {
        Text(message, color = Color(0xFFB42318), fontSize = 13.sp)
    }
}

/** The short reference shown on the website, e.g. "#A1B2C3". */
fun shortId(id: String): String = "#" + id.take(6).uppercase()

/** "★★★★☆" like the website; nothing when there is no rating. */
@Composable
fun Stars(rating: Int?, fontSize: Int = 13) {
    if (rating == null || rating <= 0) return
    Text("★".repeat(rating) + "☆".repeat(5 - rating), color = GoldInk, fontSize = fontSize.sp)
}

/** Submitted -> Assigned -> In progress -> Resolved, the same progress bar as the website. A rejected report stops after Submitted. */
@Composable
fun ProgressStepper(status: String, modifier: Modifier = Modifier) {
    val rejected = status == Status.REJECTED
    val steps = if (rejected) listOf("Submitted", "Rejected") else listOf("Submitted", "Assigned", "In progress", "Resolved")
    val at = if (rejected) 1 else when (status) {
        Status.ASSIGNED -> 1
        Status.IN_PROGRESS -> 2
        Status.RESOLVED, Status.ARCHIVED -> 3
        else -> 0
    }
    val finished = status == Status.RESOLVED || status == Status.ARCHIVED
    Card(
        modifier = modifier,
        shape = RoundedCornerShape(18.dp),
        colors = CardDefaults.cardColors(containerColor = Color.White),
        elevation = CardDefaults.cardElevation(1.dp),
    ) {
        Row(Modifier.padding(horizontal = 10.dp, vertical = 14.dp), horizontalArrangement = Arrangement.SpaceEvenly) {
            steps.forEachIndexed { i, label ->
                val done = i < at || (finished && i == at)
                val current = !done && i == at
                val failed = rejected && i == 1
                val dot = when {
                    failed -> Danger
                    done -> Violet
                    current -> Accent
                    else -> Line
                }
                Column(Modifier.weight(1f), horizontalAlignment = Alignment.CenterHorizontally) {
                    Box(Modifier.size(28.dp).clip(CircleShape).background(dot), contentAlignment = Alignment.Center) {
                        Text(
                            when { failed -> "✕"; done -> "✓"; else -> (i + 1).toString() },
                            color = if (done || failed) Color.White else if (current) OnAccent else Muted,
                            fontSize = 13.sp,
                            fontWeight = FontWeight.Bold,
                        )
                    }
                    Text(
                        label,
                        fontSize = 11.sp,
                        color = if (done || current || failed) Ink else Muted,
                        fontWeight = if (current) FontWeight.Bold else FontWeight.Normal,
                        modifier = Modifier.padding(top = 4.dp),
                    )
                }
            }
        }
    }
}

fun timeAgo(millis: Long): String =
    DateUtils.getRelativeTimeSpanString(millis, System.currentTimeMillis(), DateUtils.MINUTE_IN_MILLIS).toString()

fun formatDateTime(millis: Long?): String =
    if (millis == null) "—" else DateFormat.getDateTimeInstance(DateFormat.MEDIUM, DateFormat.SHORT).format(Date(millis))
