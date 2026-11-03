package com.localcommunity.services.ui.screens

import android.widget.Toast
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.PickVisualMediaRequest
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.background
import androidx.compose.foundation.border
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
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Check
import androidx.compose.material.icons.filled.Email
import androidx.compose.material.icons.filled.Lock
import androidx.compose.material.icons.filled.LocationOn
import androidx.compose.material.icons.filled.Person
import androidx.compose.material.icons.filled.Phone
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.input.VisualTransformation
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.localcommunity.services.data.Images
import com.localcommunity.services.data.Profile
import com.localcommunity.services.data.Repo
import com.localcommunity.services.data.Report
import com.localcommunity.services.data.Status
import com.localcommunity.services.ui.Accent
import com.localcommunity.services.ui.Avatar
import com.localcommunity.services.ui.ErrorBox
import com.localcommunity.services.ui.Ink
import com.localcommunity.services.ui.Muted
import com.localcommunity.services.ui.GoldInk
import com.localcommunity.services.ui.StatCard
import com.localcommunity.services.ui.Violet
import com.localcommunity.services.ui.VioletSoft
import com.localcommunity.services.ui.formatDateTime
import com.localcommunity.services.util.Phone
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

private data class Completeness(val percent: Int, val hint: String)

private fun completeness(p: Profile): Completeness {
    val missing = buildList {
        if (p.name.isBlank()) add("full name")
        if (p.phone.isNullOrBlank()) add("phone number")
        if (p.address.isNullOrBlank()) add("address")
        if (p.photo.isNullOrBlank()) add("profile photo")
    }
    val percent = (4 - missing.size) * 25
    val list = if (missing.size > 1) missing.dropLast(1).joinToString(", ") + " and " + missing.last() else missing.firstOrNull().orEmpty()
    return Completeness(percent, if (missing.isEmpty()) "Your profile is complete. Thank you!" else "Add your $list to reach 100%.")
}

@Composable
fun ProfileScreen(profile: Profile, reports: List<Report>) {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    val done = completeness(profile)

    // ---- personal information ----
    var name by remember(profile.id) { mutableStateOf(profile.name) }
    var phone by remember(profile.id) { mutableStateOf(profile.phone?.let(Phone::format).orEmpty()) }
    var address by remember(profile.id) { mutableStateOf(profile.address.orEmpty()) }
    var saving by remember { mutableStateOf(false) }
    var saveError by remember { mutableStateOf<String?>(null) }

    val phoneProblem = Phone.problem(phone)
    val dirty = name.trim() != profile.name ||
        phone.trim() != profile.phone?.let(Phone::format).orEmpty() ||
        address.trim() != profile.address.orEmpty()
    val canSave = dirty && name.isNotBlank() && phoneProblem == null && !saving

    // ---- profile picture ----
    var photoBusy by remember { mutableStateOf(false) }
    val pickPhoto = rememberLauncherForActivityResult(ActivityResultContracts.PickVisualMedia()) { uri ->
        if (uri == null) return@rememberLauncherForActivityResult
        photoBusy = true
        scope.launch {
            try {
                val url = withContext(Dispatchers.Default) { Images.avatar(context, uri) }
                Repo.setPhoto(profile.id, url)
                Toast.makeText(context, "Photo updated", Toast.LENGTH_SHORT).show()
            } catch (e: Exception) {
                Toast.makeText(context, Repo.errorMessage(e), Toast.LENGTH_LONG).show()
            }
            photoBusy = false
        }
    }

    // ---- login email ----
    var newEmail by rememberSaveable { mutableStateOf("") }
    var password by rememberSaveable { mutableStateOf("") }
    var showPassword by rememberSaveable { mutableStateOf(false) }
    var emailBusy by remember { mutableStateOf(false) }
    var emailError by remember { mutableStateOf<String?>(null) }
    var sentTo by remember { mutableStateOf<String?>(null) }

    Column(
        Modifier
            .fillMaxSize()
            .verticalScroll(rememberScrollState())
            .padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(14.dp),
    ) {
        // ---- header: banner, avatar, name, completeness ----
        Card(shape = RoundedCornerShape(20.dp), colors = CardDefaults.cardColors(containerColor = Color.White), elevation = CardDefaults.cardElevation(1.dp)) {
            Box {
                Box(Modifier.fillMaxWidth().height(104.dp).background(Brush.horizontalGradient(listOf(Violet, Accent))))
                Column(Modifier.padding(start = 16.dp, end = 16.dp, top = 56.dp, bottom = 16.dp)) {
                    Box {
                        Avatar(profile.photo, profile.name, 92.dp, Modifier.border(4.dp, Color.White, CircleShape))
                        if (photoBusy) {
                            Box(Modifier.size(92.dp), contentAlignment = Alignment.Center) { CircularProgressIndicator(Modifier.size(28.dp), strokeWidth = 3.dp) }
                        }
                    }
                    Text(profile.name, fontSize = 22.sp, fontWeight = FontWeight.ExtraBold, color = Ink, modifier = Modifier.padding(top = 10.dp))
                    Text(profile.email, color = Muted, fontSize = 14.sp)
                    Row(Modifier.padding(top = 8.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        Box(Modifier.clip(RoundedCornerShape(50)).background(VioletSoft).padding(horizontal = 12.dp, vertical = 3.dp)) {
                            Text("Resident", color = Violet, fontWeight = FontWeight.Bold, fontSize = 12.sp)
                        }
                        TextButton(onClick = { pickPhoto.launch(PickVisualMediaRequest(ActivityResultContracts.PickVisualMedia.ImageOnly)) }, enabled = !photoBusy) {
                            Text("Change photo")
                        }
                        if (profile.photo != null) {
                            TextButton(
                                onClick = {
                                    scope.launch {
                                        try {
                                            Repo.setPhoto(profile.id, null)
                                        } catch (e: Exception) {
                                            Toast.makeText(context, Repo.errorMessage(e), Toast.LENGTH_LONG).show()
                                        }
                                    }
                                },
                                enabled = !photoBusy,
                            ) { Text("Remove") }
                        }
                    }
                    Row(Modifier.padding(top = 10.dp).fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                        Text("Profile completeness", fontWeight = FontWeight.Bold, fontSize = 13.sp, color = Ink)
                        Text("${done.percent}%", fontWeight = FontWeight.ExtraBold, fontSize = 13.sp, color = Violet)
                    }
                    LinearProgressIndicator(
                        progress = { done.percent / 100f },
                        modifier = Modifier.fillMaxWidth().padding(vertical = 6.dp).height(8.dp).clip(RoundedCornerShape(50)),
                        color = Violet,
                        trackColor = Color(0xFFE6EFE9),
                    )
                    Text(done.hint, color = if (done.percent == 100) Color(0xFF006C32) else Muted, fontSize = 12.sp)
                }
            }
        }

        // ---- the three numbers ----
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            StatCard("Reports", reports.size, Violet, Modifier.weight(1f))
            StatCard("Pending", reports.count { it.status == Status.PENDING }, GoldInk, Modifier.weight(1f))
            StatCard("Resolved", reports.count { it.status == Status.RESOLVED || it.status == Status.ARCHIVED }, Color(0xFF006C32), Modifier.weight(1f))
        }

        // ---- personal information ----
        Card(shape = RoundedCornerShape(18.dp), colors = CardDefaults.cardColors(containerColor = Color.White), elevation = CardDefaults.cardElevation(1.dp)) {
            Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                Text("Personal information", fontWeight = FontWeight.ExtraBold, color = Ink, fontSize = 16.sp)
                OutlinedTextField(
                    value = name,
                    onValueChange = { name = it.take(100) },
                    label = { Text("Full name") },
                    leadingIcon = { Icon(Icons.Filled.Person, null) },
                    isError = name.isBlank(),
                    supportingText = { if (name.isBlank()) Text("Your name is required.") },
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth(),
                )
                OutlinedTextField(
                    value = phone,
                    onValueChange = { phone = Phone.format(it) },
                    label = { Text("Phone number") },
                    placeholder = { Text("0917 123 4567") },
                    leadingIcon = { Icon(Icons.Filled.Phone, null) },
                    isError = phoneProblem != null,
                    supportingText = { if (phoneProblem != null) Text(phoneProblem) },
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Phone),
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth(),
                )
                OutlinedTextField(
                    value = address,
                    onValueChange = { address = it.take(200) },
                    label = { Text("Address") },
                    placeholder = { Text("Purok / street / barangay") },
                    leadingIcon = { Icon(Icons.Filled.LocationOn, null) },
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth(),
                )
                if (saveError != null) ErrorBox(saveError!!, Modifier.fillMaxWidth())
                Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp, Alignment.End), verticalAlignment = Alignment.CenterVertically) {
                    if (dirty) {
                        TextButton(onClick = {
                            name = profile.name
                            phone = profile.phone?.let(Phone::format).orEmpty()
                            address = profile.address.orEmpty()
                            saveError = null
                        }) { Text("Reset changes") }
                    }
                    Button(
                        onClick = {
                            saving = true
                            saveError = null
                            scope.launch {
                                try {
                                    Repo.updateProfile(profile.id, name, phone, address)
                                    Toast.makeText(context, "Profile updated", Toast.LENGTH_SHORT).show()
                                } catch (e: Exception) {
                                    saveError = Repo.errorMessage(e)
                                }
                                saving = false
                            }
                        },
                        enabled = canSave,
                        shape = RoundedCornerShape(12.dp),
                        modifier = Modifier.height(48.dp),
                    ) {
                        if (saving) CircularProgressIndicator(Modifier.size(20.dp), color = Color.White, strokeWidth = 2.dp)
                        else Text("Save changes", fontWeight = FontWeight.Bold)
                    }
                }
            }
        }

        // ---- account & security ----
        Card(shape = RoundedCornerShape(18.dp), colors = CardDefaults.cardColors(containerColor = Color.White), elevation = CardDefaults.cardElevation(1.dp)) {
            Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                Text("Account & security", fontWeight = FontWeight.ExtraBold, color = Ink, fontSize = 16.sp)
                if (sentTo != null) {
                    Column(Modifier.fillMaxWidth().padding(vertical = 8.dp), horizontalAlignment = Alignment.CenterHorizontally) {
                        Box(Modifier.size(56.dp).clip(CircleShape).background(Color(0xFFDDEFE5)), contentAlignment = Alignment.Center) {
                            Icon(Icons.Filled.Check, null, tint = Color(0xFF006C32), modifier = Modifier.size(28.dp))
                        }
                        Text("Check your new email inbox", fontWeight = FontWeight.ExtraBold, fontSize = 17.sp, color = Ink, modifier = Modifier.padding(top = 10.dp))
                        Text(
                            "We sent a confirmation link to $sentTo. Open it (check Spam too) to finish. Until then you still sign in with ${profile.email}.",
                            color = Muted,
                            fontSize = 13.sp,
                            textAlign = TextAlign.Center,
                            modifier = Modifier.padding(top = 4.dp),
                        )
                        TextButton(onClick = {
                            sentTo = null
                            newEmail = ""
                        }) { Text("Use a different email") }
                    }
                } else {
                    Text(
                        "This is the email you sign in with. To change it, enter the new email and your password. We send a confirmation link to the new address, and you keep signing in with the old one until you open it.",
                        color = Muted,
                        fontSize = 12.sp,
                    )
                    OutlinedTextField(
                        value = profile.email,
                        onValueChange = {},
                        label = { Text("Current email") },
                        leadingIcon = { Icon(Icons.Filled.Email, null) },
                        trailingIcon = { Icon(Icons.Filled.Lock, null) },
                        readOnly = true,
                        enabled = false,
                        singleLine = true,
                        modifier = Modifier.fillMaxWidth(),
                    )
                    OutlinedTextField(
                        value = newEmail,
                        onValueChange = { newEmail = it },
                        label = { Text("New email") },
                        leadingIcon = { Icon(Icons.Filled.Email, null) },
                        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Email),
                        singleLine = true,
                        modifier = Modifier.fillMaxWidth(),
                    )
                    OutlinedTextField(
                        value = password,
                        onValueChange = { password = it },
                        label = { Text("Your password") },
                        leadingIcon = { Icon(Icons.Filled.Lock, null) },
                        trailingIcon = { TextButton(onClick = { showPassword = !showPassword }) { Text(if (showPassword) "Hide" else "Show") } },
                        visualTransformation = if (showPassword) VisualTransformation.None else PasswordVisualTransformation(),
                        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Password),
                        singleLine = true,
                        modifier = Modifier.fillMaxWidth(),
                    )
                    if (emailError != null) ErrorBox(emailError!!, Modifier.fillMaxWidth())
                    OutlinedButton(
                        onClick = {
                            emailBusy = true
                            emailError = null
                            scope.launch {
                                try {
                                    sentTo = Repo.requestEmailChange(newEmail, password)
                                    password = ""
                                } catch (e: Exception) {
                                    emailError = Repo.errorMessage(e)
                                }
                                emailBusy = false
                            }
                        },
                        enabled = !emailBusy && newEmail.isNotBlank() && password.isNotBlank(),
                        modifier = Modifier.fillMaxWidth().height(48.dp),
                        shape = RoundedCornerShape(12.dp),
                    ) {
                        if (emailBusy) CircularProgressIndicator(Modifier.size(20.dp), strokeWidth = 2.dp)
                        else Text("Send confirmation link")
                    }
                }
            }
        }

        // ---- activity + sign out ----
        Card(shape = RoundedCornerShape(18.dp), colors = CardDefaults.cardColors(containerColor = Color.White), elevation = CardDefaults.cardElevation(1.dp)) {
            Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                Text("Account activity", fontWeight = FontWeight.ExtraBold, color = Ink, fontSize = 16.sp)
                Row { Text("Account created", color = Muted, fontSize = 13.sp, modifier = Modifier.weight(0.45f)); Text(formatDateTime(Repo.accountCreatedAt ?: profile.createdAt), fontSize = 13.sp, modifier = Modifier.weight(0.55f)) }
                Row { Text("Last login", color = Muted, fontSize = 13.sp, modifier = Modifier.weight(0.45f)); Text(formatDateTime(Repo.lastSignInAt), fontSize = 13.sp, modifier = Modifier.weight(0.55f)) }
            }
        }
        OutlinedButton(onClick = { Repo.signOut() }, modifier = Modifier.fillMaxWidth().height(50.dp), shape = RoundedCornerShape(14.dp)) {
            Text("Sign out", fontWeight = FontWeight.Bold)
        }
        Box(Modifier.height(8.dp))
    }
}
