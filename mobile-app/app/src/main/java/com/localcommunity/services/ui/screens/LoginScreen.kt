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
import androidx.compose.material3.ButtonDefaults
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
import androidx.compose.runtime.mutableIntStateOf
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
import com.localcommunity.services.ui.ThemeButton
import com.localcommunity.services.ui.CardBg
import com.localcommunity.services.ui.Accent
import com.localcommunity.services.ui.Danger
import com.localcommunity.services.ui.ErrorBox
import com.localcommunity.services.ui.GoldInk
import com.localcommunity.services.ui.Ink
import com.localcommunity.services.ui.Line
import com.localcommunity.services.ui.Muted
import com.localcommunity.services.ui.Navy
import com.localcommunity.services.ui.NavyDeep
import com.localcommunity.services.ui.OnAccent
import com.localcommunity.services.ui.Sky
import com.localcommunity.services.ui.Success
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch

/**
 * The same lockout as the website: after 5 failed sign-ins the form is disabled for 30 seconds.
 * Kept while the app runs (like the website's sessionStorage); Firebase's own limit protects the server.
 */
private object Lockout {
    const val MAX_ATTEMPTS = 5
    const val LOCK_SECONDS = 30
    private var count = 0
    private var until = 0L

    fun secondsLeft(): Int = maxOf(0, ((until - System.currentTimeMillis() + 999) / 1000).toInt())

    /** Counts one failure; returns how many tries are left before the lockout (0 when it just started). */
    fun recordFailure(): Int {
        count += 1
        if (count >= MAX_ATTEMPTS) {
            count = 0
            until = System.currentTimeMillis() + LOCK_SECONDS * 1000L
            return 0
        }
        return MAX_ATTEMPTS - count
    }

    fun reset() {
        count = 0
        until = 0L
    }
}

/** 0 (empty) to 4, the same score as the website's strength meter. A password that breaks a rule never scores above 1. */
private fun passwordScore(p: String): Int {
    if (p.isEmpty()) return 0
    if (Repo.passwordProblem(p) != null) return 1
    var score = 2
    if (p.length >= 12) score++
    if (p.any { it.isLowerCase() } && p.any { it.isUpperCase() } && p.any { !it.isLetterOrDigit() }) score++
    return minOf(score, 4)
}

/** Live strength bar and requirement checklist, like the website's sign-up form. */
@Composable
private fun StrengthMeter(password: String) {
    val score = passwordScore(password)
    val color = when (score) {
        1 -> Danger
        2 -> Accent
        3 -> Sky
        4 -> Success
        else -> Line
    }
    Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
        Box(Modifier.fillMaxWidth().height(6.dp).clip(RoundedCornerShape(3.dp)).background(Line)) {
            Box(Modifier.fillMaxWidth(score / 4f).height(6.dp).clip(RoundedCornerShape(3.dp)).background(color))
        }
        if (score > 0) Text("Password strength: ${listOf("", "Weak", "Fair", "Good", "Strong")[score]}", fontSize = 12.sp, color = Muted)
        listOf(
            "At least 8 characters" to (password.length >= 8),
            "At least one letter" to password.any { it.isLetter() },
            "At least one number" to password.any { it.isDigit() },
        ).forEach { (label, ok) ->
            Text((if (ok) "✓ " else "• ") + label, fontSize = 12.sp, color = if (ok) Success else Muted)
        }
    }
}

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
    var forgot by rememberSaveable { mutableStateOf(false) }
    var resetSent by remember { mutableStateOf(false) }
    val scope = rememberCoroutineScope()
    var lockedFor by remember { mutableIntStateOf(Lockout.secondsLeft()) }
    var triesNote by remember { mutableStateOf<String?>(null) }

    // While the lockout lasts, a countdown shows how long is left.
    LaunchedEffect(lockedFor > 0) {
        while (lockedFor > 0) {
            delay(1000)
            lockedFor = Lockout.secondsLeft()
        }
    }

    // An account that was refused after signing in (no profile, not a resident...) comes back here with a notice.
    LaunchedEffect(stamp) {
        busy = false
        if (notice != null) error = notice
    }

    fun submit() {
        if (busy) return
        val signingIn = !forgot && !registering
        if (signingIn && Lockout.secondsLeft() > 0) {
            lockedFor = Lockout.secondsLeft()
            return
        }
        busy = true
        error = null
        triesNote = null
        scope.launch {
            try {
                if (forgot) {
                    Repo.sendPasswordReset(email)
                    resetSent = true
                    busy = false
                } else if (registering) {
                    Repo.register(name, email, password)
                } else {
                    Repo.signIn(email, password)
                    Lockout.reset()
                }
                // Repo takes it from here: the app switches screens when the account is accepted,
                // or this screen gets a notice. Keep the spinner until then.
            } catch (e: Exception) {
                error = Repo.errorMessage(e)
                busy = false
                if (signingIn) {
                    val left = Lockout.recordFailure()
                    if (left == 0) lockedFor = Lockout.secondsLeft()
                    else if (left <= 2) triesNote = "$left attempt${if (left == 1) "" else "s"} left before sign-in is paused for ${Lockout.LOCK_SECONDS} seconds."
                }
            }
        }
    }

    Box(
        Modifier
            .fillMaxSize()
            .background(Brush.verticalGradient(listOf(Navy, NavyDeep)))
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
                Text("LCS", color = Navy, fontWeight = FontWeight.ExtraBold, fontSize = 20.sp)
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
                color = Color(0xFFD6ECDD),
                fontSize = 14.sp,
                textAlign = TextAlign.Center,
                modifier = Modifier.padding(top = 4.dp, bottom = 24.dp),
            )

            Card(
                modifier = Modifier.fillMaxWidth(),
                shape = RoundedCornerShape(24.dp),
                colors = CardDefaults.cardColors(containerColor = CardBg),
                elevation = CardDefaults.cardElevation(defaultElevation = 8.dp),
            ) {
                Column(Modifier.padding(22.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                    Text(
                        if (forgot) "Forgot your password?" else if (registering) "Create your account" else "Welcome back",
                        fontSize = 22.sp, fontWeight = FontWeight.ExtraBold, color = Ink,
                    )
                    Text(
                        if (forgot) "Enter your email and we will send you a link to choose a new password." else if (registering) "Register as a resident" else "Sign in to your account",
                        color = Muted, fontSize = 14.sp,
                    )

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
                    if (!forgot) OutlinedTextField(
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

                    if (registering) StrengthMeter(password)
                    val signingIn = !registering && !forgot
                    if (signingIn && lockedFor > 0) {
                        ErrorBox("Too many failed attempts. You can try again in $lockedFor second${if (lockedFor == 1) "" else "s"}.", Modifier.fillMaxWidth())
                    } else if (signingIn && triesNote != null) {
                        Text(triesNote!!, color = GoldInk, fontSize = 12.sp)
                    }
                    if (resetSent) {
                        Text(
                            "If an account exists for this email, we have sent a link to choose a new password. Check your inbox, and the spam folder too.",
                            color = Success, fontSize = 13.sp,
                        )
                    }
                    if (error != null) ErrorBox(error!!, Modifier.fillMaxWidth())

                    Button(
                        onClick = ::submit,
                        enabled = !busy && !(lockedFor > 0 && !registering && !forgot) && email.isNotBlank() && (forgot || password.isNotBlank()) && (!registering || name.isNotBlank()),
                        modifier = Modifier.fillMaxWidth().height(50.dp),
                        shape = RoundedCornerShape(14.dp),
                        colors = ButtonDefaults.buttonColors(containerColor = Accent, contentColor = OnAccent),
                    ) {
                        if (busy) CircularProgressIndicator(Modifier.size(20.dp), color = OnAccent, strokeWidth = 2.dp)
                        else Text(if (forgot) "Send reset link" else if (registering) "Create account" else "Sign in", fontWeight = FontWeight.Bold)
                    }

                    if (!registering && !forgot) {
                        TextButton(
                            onClick = {
                                forgot = true
                                resetSent = false
                                error = null
                            },
                            modifier = Modifier.fillMaxWidth(),
                        ) { Text("Forgot password?") }
                    }
                    TextButton(
                        onClick = {
                            if (forgot) {
                                forgot = false
                            } else {
                                registering = !registering
                            }
                            error = null
                        },
                        modifier = Modifier.fillMaxWidth(),
                    ) {
                        Text(if (forgot) "← Back to sign in" else if (registering) "Already have an account? Sign in" else "No account yet? Create one")
                    }
                }
            }
            Text(
                "Staff and administrators sign in on the website.\nServing the City of Caloocan",
                color = Color(0xFFD6ECDD),
                fontSize = 12.sp,
                textAlign = TextAlign.Center,
                modifier = Modifier.padding(top = 16.dp),
            )
        }
        // Dark mode before signing in, like the 🌙 button on the website's sign-in page
        ThemeButton(Modifier.align(Alignment.TopEnd).padding(16.dp))
    }
}
