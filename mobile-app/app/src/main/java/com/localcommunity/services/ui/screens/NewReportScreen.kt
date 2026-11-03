package com.localcommunity.services.ui.screens

import android.Manifest
import android.annotation.SuppressLint
import android.content.Context
import android.content.pm.PackageManager
import android.net.Uri
import android.widget.Toast
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.PickVisualMediaRequest
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.Image
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
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.ImageBitmap
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.core.content.ContextCompat
import androidx.core.content.FileProvider
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewmodel.compose.viewModel
import com.google.android.gms.location.LocationServices
import com.google.android.gms.location.Priority
import com.google.android.gms.tasks.CancellationTokenSource
import com.localcommunity.services.data.ISSUE_TYPES
import com.localcommunity.services.data.Images
import com.localcommunity.services.data.Profile
import com.localcommunity.services.data.Repo
import com.localcommunity.services.ui.ErrorBox
import com.localcommunity.services.ui.Ink
import com.localcommunity.services.ui.MapPicker
import com.localcommunity.services.ui.Muted
import com.localcommunity.services.ui.ScreenTitle
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.tasks.await
import kotlinx.coroutines.withContext
import java.io.File
import java.util.Locale
import kotlin.math.abs
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.runtime.mutableStateOf as stateOf

/** Keeps the form while the phone is rotated. Same checks as the website. */
class NewReportViewModel : ViewModel() {
    var issueType by stateOf("")
    var description by stateOf("")
    var address by stateOf("")
    var latitude by stateOf<Double?>(null)
    var longitude by stateOf<Double?>(null)
    var preview by stateOf<ImageBitmap?>(null)
    var photoInfo by stateOf<String?>(null)
    var busy by stateOf(false)
    var error by stateOf<String?>(null)

    private var photo: String? = null
    private var thumb: String? = null

    suspend fun choosePhoto(context: Context, uri: Uri) {
        error = null
        try {
            val result = withContext(Dispatchers.Default) { Images.reportPhoto(context, uri) }
            photo = result.photo
            thumb = result.thumb
            preview = result.preview.asImageBitmap()
            photoInfo = "${result.photo.length / 1024} KB after compressing"
        } catch (e: Exception) {
            error = e.message ?: "Could not read that photo."
        }
    }

    fun removePhoto() {
        photo = null
        thumb = null
        preview = null
        photoInfo = null
    }

    fun setLocation(lat: Double, lng: Double) {
        latitude = lat
        longitude = lng
        error = null
    }

    /** Returns the new report's id, or null (and sets [error]). */
    suspend fun submit(me: Profile): String? {
        error = null
        // "Photo and location attached?" -> No: complete details
        val p = photo
        val t = thumb
        val lat = latitude
        val lng = longitude
        when {
            issueType.isEmpty() -> error = "Please choose the issue type."
            description.isBlank() -> error = "Please describe the problem."
            p == null || t == null -> error = "Please attach a photo."
            lat == null || lng == null -> error = "Please add the location."
        }
        if (error != null) return null
        busy = true
        try {
            val id = Repo.submitReport(me, issueType, description, address, lat!!, lng!!, p!!, t!!)
            issueType = ""
            description = ""
            address = ""
            latitude = null
            longitude = null
            removePhoto()
            return id
        } catch (e: Exception) {
            error = Repo.errorMessage(e)
            return null
        } finally {
            busy = false
        }
    }
}

@SuppressLint("MissingPermission")
private suspend fun currentLocation(context: Context): Pair<Double, Double>? {
    val client = LocationServices.getFusedLocationProviderClient(context)
    val location = client.getCurrentLocation(Priority.PRIORITY_HIGH_ACCURACY, CancellationTokenSource().token).await()
    return location?.let { it.latitude to it.longitude }
}

private fun hasLocationPermission(context: Context) =
    ContextCompat.checkSelfPermission(context, Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED ||
        ContextCompat.checkSelfPermission(context, Manifest.permission.ACCESS_COARSE_LOCATION) == PackageManager.PERMISSION_GRANTED

@Composable
fun NewReportScreen(me: Profile, onSent: (String) -> Unit) {
    val vm: NewReportViewModel = viewModel()
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    var menuOpen by remember { mutableStateOf(false) }
    var locating by remember { mutableStateOf(false) }
    var cameraUri by remember { mutableStateOf<Uri?>(null) }

    fun locate() {
        if (locating) return
        locating = true
        scope.launch {
            try {
                val here = currentLocation(context)
                if (here != null) vm.setLocation(here.first, here.second)
                else vm.error = "Could not get your location. Turn on GPS, tap the map, or try again."
            } catch (e: Exception) {
                vm.error = "Could not get your location. Turn on GPS, or tap the map."
            }
            locating = false
        }
    }

    val permissions = rememberLauncherForActivityResult(ActivityResultContracts.RequestMultiplePermissions()) { granted ->
        if (granted.values.any { it }) locate() else vm.error = "Location permission was refused. You can still tap the map to place the pin."
    }
    val takePicture = rememberLauncherForActivityResult(ActivityResultContracts.TakePicture()) { saved ->
        val uri = cameraUri
        if (saved && uri != null) scope.launch { vm.choosePhoto(context, uri) }
    }
    val pickPicture = rememberLauncherForActivityResult(ActivityResultContracts.PickVisualMedia()) { uri ->
        if (uri != null) scope.launch { vm.choosePhoto(context, uri) }
    }

    fun openCamera() {
        val folder = File(context.cacheDir, "camera").apply { mkdirs() }
        val uri = FileProvider.getUriForFile(context, "${context.packageName}.fileprovider", File(folder, "capture.jpg"))
        cameraUri = uri
        takePicture.launch(uri)
    }

    Column(
        Modifier
            .fillMaxSize()
            .verticalScroll(rememberScrollState())
            .padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(14.dp),
    ) {
        ScreenTitle("New report", "A photo and a location are required, so the barangay can find and fix the problem.")

        SectionCard("1  What is the problem?") {
            Box {
                OutlinedButton(onClick = { menuOpen = true }, modifier = Modifier.fillMaxWidth().height(52.dp), shape = RoundedCornerShape(12.dp)) {
                    Text(vm.issueType.ifEmpty { "Choose the issue type" }, modifier = Modifier.weight(1f), color = if (vm.issueType.isEmpty()) Muted else Ink)
                    Text("▾", color = Muted)
                }
                DropdownMenu(expanded = menuOpen, onDismissRequest = { menuOpen = false }) {
                    ISSUE_TYPES.forEach { type ->
                        DropdownMenuItem(text = { Text(type) }, onClick = {
                            vm.issueType = type
                            menuOpen = false
                        })
                    }
                }
            }
            OutlinedTextField(
                value = vm.description,
                onValueChange = { vm.description = it.take(2000) },
                label = { Text("Description") },
                placeholder = { Text("What is wrong, how long has it been like this?") },
                minLines = 4,
                modifier = Modifier.fillMaxWidth(),
            )
            OutlinedTextField(
                value = vm.address,
                onValueChange = { vm.address = it.take(200) },
                label = { Text("Address / landmark (optional)") },
                singleLine = true,
                modifier = Modifier.fillMaxWidth(),
            )
        }

        SectionCard("2  Photo evidence") {
            val preview = vm.preview
            if (preview != null) {
                Image(
                    bitmap = preview,
                    contentDescription = "Preview of the chosen photo",
                    contentScale = ContentScale.Crop,
                    modifier = Modifier.fillMaxWidth().height(200.dp).clip(RoundedCornerShape(14.dp)),
                )
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text(vm.photoInfo ?: "", color = Muted, fontSize = 12.sp, modifier = Modifier.weight(1f))
                    TextButton(onClick = vm::removePhoto) { Text("Remove photo") }
                }
            } else {
                Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                    Button(onClick = ::openCamera, modifier = Modifier.weight(1f).height(52.dp), shape = RoundedCornerShape(12.dp)) { Text("Take a photo") }
                    OutlinedButton(
                        onClick = { pickPicture.launch(PickVisualMediaRequest(ActivityResultContracts.PickVisualMedia.ImageOnly)) },
                        modifier = Modifier.weight(1f).height(52.dp),
                        shape = RoundedCornerShape(12.dp),
                    ) { Text("From gallery") }
                }
            }
        }

        SectionCard("3  Location") {
            MapPicker(
                latitude = vm.latitude,
                longitude = vm.longitude,
                onPick = vm::setLocation,
                modifier = Modifier.fillMaxWidth().height(260.dp).clip(RoundedCornerShape(14.dp)),
            )
            Text("Tap the map to drop a pin, then drag it to fine-tune. Or use your current location, or type the coordinates.", color = Muted, fontSize = 12.sp)
            // Latitude and longitude boxes, like the website: they follow the pin, and typing moves the pin.
            var latText by remember { mutableStateOf("") }
            var lngText by remember { mutableStateOf("") }
            LaunchedEffect(vm.latitude, vm.longitude) {
                val lat = vm.latitude
                val lng = vm.longitude
                if (lat != null && lng != null && (latText.toDoubleOrNull() != lat || lngText.toDoubleOrNull() != lng)) {
                    latText = "%.6f".format(Locale.US, lat)
                    lngText = "%.6f".format(Locale.US, lng)
                }
            }
            fun typed() {
                val lat = latText.toDoubleOrNull()
                val lng = lngText.toDoubleOrNull()
                if (lat != null && lng != null && abs(lat) <= 90 && abs(lng) <= 180) vm.setLocation(lat, lng)
            }
            Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                OutlinedTextField(
                    value = latText,
                    onValueChange = { latText = it.take(20); typed() },
                    label = { Text("Latitude") },
                    placeholder = { Text("14.5995") },
                    singleLine = true,
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal),
                    modifier = Modifier.weight(1f),
                )
                OutlinedTextField(
                    value = lngText,
                    onValueChange = { lngText = it.take(20); typed() },
                    label = { Text("Longitude") },
                    placeholder = { Text("120.9842") },
                    singleLine = true,
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal),
                    modifier = Modifier.weight(1f),
                )
            }
            OutlinedButton(
                onClick = {
                    if (hasLocationPermission(context)) locate()
                    else permissions.launch(arrayOf(Manifest.permission.ACCESS_FINE_LOCATION, Manifest.permission.ACCESS_COARSE_LOCATION))
                },
                enabled = !locating,
                modifier = Modifier.fillMaxWidth().height(48.dp),
                shape = RoundedCornerShape(12.dp),
            ) { Text(if (locating) "Locating…" else "Use my location") }
        }

        if (vm.error != null) ErrorBox(vm.error!!, Modifier.fillMaxWidth())

        Button(
            onClick = {
                scope.launch {
                    val id = vm.submit(me)
                    if (id != null) {
                        Toast.makeText(context, "Report sent. Status: Pending", Toast.LENGTH_SHORT).show()
                        onSent(id)
                    }
                }
            },
            enabled = !vm.busy,
            modifier = Modifier.fillMaxWidth().height(54.dp),
            shape = RoundedCornerShape(14.dp),
        ) {
            if (vm.busy) CircularProgressIndicator(Modifier.size(22.dp), color = Color.White, strokeWidth = 2.dp)
            else Text("Send report", fontWeight = FontWeight.Bold, fontSize = 16.sp)
        }
        Box(Modifier.height(8.dp))
    }
}

@Composable
private fun SectionCard(title: String, content: @Composable () -> Unit) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        shape = RoundedCornerShape(18.dp),
        colors = CardDefaults.cardColors(containerColor = Color.White),
        elevation = CardDefaults.cardElevation(defaultElevation = 1.dp),
    ) {
        Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
            Text(title, fontWeight = FontWeight.ExtraBold, color = Ink, fontSize = 16.sp)
            content()
        }
    }
}
