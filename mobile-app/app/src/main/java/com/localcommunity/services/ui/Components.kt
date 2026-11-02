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
        Box(modifier.background(Color(0xFFE7ECF7)), contentAlignment = Alignment.Center) { placeholder() }
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
    Status.ASSIGNED -> Chip(Color(0xFF0035AA), Color.White)
    Status.IN_PROGRESS -> Chip(Color(0xFFFF7A00), Color(0xFF2B1600))
    Status.RESOLVED -> Chip(Color(0xFF006C32), Color.White)
    Status.REJECTED -> Chip(Color(0xFFCF0921), Color.White)
    else -> Chip(Color(0xFFE2E8F0), Color(0xFF334155))
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

fun timeAgo(millis: Long): String =
    DateUtils.getRelativeTimeSpanString(millis, System.currentTimeMillis(), DateUtils.MINUTE_IN_MILLIS).toString()

fun formatDateTime(millis: Long?): String =
    if (millis == null) "—" else DateFormat.getDateTimeInstance(DateFormat.MEDIUM, DateFormat.SHORT).format(Date(millis))
