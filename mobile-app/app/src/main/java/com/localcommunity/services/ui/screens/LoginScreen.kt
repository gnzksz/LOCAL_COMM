package com.localcommunity.services.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Email
import androidx.compose.material.icons.filled.Lock
import androidx.compose.material.icons.filled.Person
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
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
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.input.VisualTransformation
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.localcommunity.services.data.Repo
import com.localcommunity.services.ui.ErrorBox
import com.localcommunity.services.ui.Ink
import com.localcommunity.services.ui.Muted
import kotlinx.coroutines.launch

/** One sign-in screen: sign in, or create a resident account. [stamp] changes every time the account is refused. */
@Composable
fun LoginScreen(notice: String?, stamp: Long) {
    var registering by rememberSaveable { mutableStateOf(false) }
    var name by rememberSaveable { mutableStateOf("") }
    var email by rememberSaveable { mutableStateOf("") }
    var password by rememberSaveable { mutableStateOf("") }
    var showPassword by rememberSaveable { mutableStateOf(false) }
    var error by remember { mutableStateOf(notice) }
    var busy by remember { mutableStateOf(false) }
    val scope = rememberCoroutineScope()

    // An account that was refused after signing in (no profile, not a resident...) comes back here with a notice.
    LaunchedEffect(stamp) {
        busy = false
        if (notice != null) error = notice
    }

    fun submit() {
        if (busy) return
        busy = true
        error = null
        scope.launch {
            try {
                if (registering) Repo.register(name, email, password) else Repo.signIn(email, password)
                // Repo takes it from here: the app switches screens when the account is accepted,
                // or this screen gets a notice. Keep the spinner until then.
            } catch (e: Exception) {
                error = Repo.errorMessage(e)
                busy = false
            }
        }
    }

    Box(
        Modifier
            .fillMaxSize()
            .background(Brush.verticalGradient(listOf(Color(0xFF1B1550), Color(0xFF4A2FC4), Color(0xFF6D4AFF))))
    ) {
        Column(
            Modifier
                .fillMaxSize()
                .verticalScroll(rememberScrollState())
                .padding(20.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.Center,
        ) {
            Box(Modifier.size(64.dp).clip(RoundedCornerShape(18.dp)).background(Color.White), contentAlignment = Alignment.Center) {
                Text("LCS", color = Color(0xFF6D4AFF), fontWeight = FontWeight.ExtraBold, fontSize = 20.sp)
            }
            Text(
                "LOCAL COMMUNITY SERVICES",
                color = Color.White,
                fontWeight = FontWeight.ExtraBold,
                fontSize = 18.sp,
                textAlign = TextAlign.Center,
                modifier = Modifier.padding(top = 14.dp),
            )
            Text(
                "Report it. Track it. See it resolved.",
                color = Color(0xFFD9D0FF),
                fontSize = 14.sp,
                textAlign = TextAlign.Center,
                modifier = Modifier.padding(top = 4.dp, bottom = 24.dp),
            )

            Card(
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(24.dp),
                colors = CardDefaults.cardColors(containerColor = Color.White),
                elevation = CardDefaults.cardElevation(defaultElevation = 8.dp),
            ) {
                Column(Modifier.padding(22.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                    Text(if (registering) "Create your account" else "Welcome back", fontSize = 22.sp, fontWeight = FontWeight.ExtraBold, color = Ink)
                    Text(if (registering) "Register as a resident" else "Sign in to your account", color = Muted, fontSize = 14.sp)

                    if (registering) {
                        OutlinedTextField(
                            value = name,
                            onValueChange = { name = it },
                            label = { Text("Full name") },
                            leadingIcon = { Icon(Icons.Filled.Person, null) },
                            singleLine = true,
                            modifier = Modifier.fillMaxWidth(),
                        )
                    }
                    OutlinedTextField(
                        value = email,
                        onValueChange = { email = it },
                        label = { Text("Email") },
                        leadingIcon = { Icon(Icons.Filled.Email, null) },
                        singleLine = true,
                        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Email),
                        modifier = Modifier.fillMaxWidth(),
                    )
                    OutlinedTextField(
                        value = password,
                        onValueChange = { password = it },
                        label = { Text("Password") },
                        leadingIcon = { Icon(Icons.Filled.Lock, null) },
                        trailingIcon = { TextButton(onClick = { showPassword = !showPassword }) { Text(if (showPassword) "Hide" else "Show") } },
                        visualTransformation = if (showPassword) VisualTransformation.None else PasswordVisualTransformation(),
                        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Password),
                        singleLine = true,
                        modifier = Modifier.fillMaxWidth(),
                    )

                    if (error != null) ErrorBox(error!!, Modifier.fillMaxWidth())

                    Button(
                        onClick = ::submit,
                        enabled = !busy && email.isNotBlank() && password.isNotBlank() && (!registering || name.isNotBlank()),
                        modifier = Modifier.fillMaxWidth().height(50.dp),
                        shape = RoundedCornerShape(14.dp),
                    ) {
                        if (busy) CircularProgressIndicator(Modifier.size(20.dp), color = Color.White, strokeWidth = 2.dp)
                        else Text(if (registering) "Create account" else "Sign in", fontWeight = FontWeight.Bold)
                    }

                    TextButton(
                        onClick = {
                            registering = !registering
                            error = null
                        },
                        modifier = Modifier.fillMaxWidth(),
                    ) {
                        Text(if (registering) "Already have an account? Sign in" else "No account yet? Create one")
                    }
                }
            }
            Text(
                "Staff and administrators sign in on the website.",
                color = Color(0xFFD9D0FF),
                fontSize = 12.sp,
                textAlign = TextAlign.Center,
                modifier = Modifier.padding(top = 16.dp),
            )
        }
    }
}
