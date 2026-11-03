package com.localcommunity.services.ui.screens

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
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
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.localcommunity.services.data.Repo
import com.localcommunity.services.ui.OnPrimary
import com.localcommunity.services.ui.CardBg
import com.localcommunity.services.ui.ErrorBox
import com.localcommunity.services.ui.Ink
import com.localcommunity.services.ui.Muted
import com.localcommunity.services.ui.ScreenTitle
import com.localcommunity.services.ui.Success
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch

private const val COOLDOWN_SECONDS = 60

/**
 * "Verify your email": shown instead of the New report form until the resident confirmed their email.
 * When the email is confirmed, [Repo.emailVerified] flips and the app replaces this screen by the form.
 */
@Composable
fun VerifyEmailScreen(email: String) {
    var busy by remember { mutableStateOf(false) }
    var error by remember { mutableStateOf<String?>(null) }
    var info by remember { mutableStateOf<String?>(null) }
    var cooldown by remember { mutableStateOf(0) }
    val scope = rememberCoroutineScope()

    // The Resend button waits 60 seconds after each use, so the inbox is not flooded.
    LaunchedEffect(cooldown) {
        if (cooldown > 0) {
            delay(1000)
            cooldown -= 1
        }
    }

    Column(Modifier.fillMaxWidth().verticalScroll(rememberScrollState()).padding(16.dp), verticalArrangement = Arrangement.spacedBy(14.dp)) {
        ScreenTitle("Verify your email", "Confirming your email keeps accounts safe and lets us reach you about your reports.")
        Card(
            shape = RoundedCornerShape(20.dp),
            colors = CardDefaults.cardColors(containerColor = CardBg),
            modifier = Modifier.fillMaxWidth(),
        ) {
            Column(Modifier.padding(20.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                Text("Check your inbox", fontSize = 19.sp, fontWeight = FontWeight.ExtraBold, color = Ink)
                Text(
                    "We sent a confirmation link to $email. Open the email, tap the link, then come back here and press \"I have verified\". " +
                        "It can take a minute to arrive: look in the spam folder too.",
                    color = Ink, fontSize = 14.sp,
                )
                Text("You can still look at your reports, but sending a new report needs a verified email.", color = Muted, fontSize = 13.sp)

                info?.let { Text(it, color = Success, fontSize = 13.sp) }
                error?.let { ErrorBox(it, Modifier.fillMaxWidth()) }

                Button(
                    onClick = {
                        if (busy) return@Button
                        busy = true
                        error = null
                        info = null
                        scope.launch {
                            try {
                                if (!Repo.checkVerified()) {
                                    error = "We do not see the confirmation yet. Open the email, tap the link, then press this button again."
                                }
                            } catch (e: Exception) {
                                error = Repo.errorMessage(e)
                            }
                            busy = false
                        }
                    },
                    enabled = !busy,
                    modifier = Modifier.fillMaxWidth().height(50.dp),
                    shape = RoundedCornerShape(14.dp),
                ) {
                    if (busy) CircularProgressIndicator(Modifier.size(20.dp), color = OnPrimary, strokeWidth = 2.dp)
                    else Text("I have verified", fontWeight = FontWeight.Bold)
                }

                OutlinedButton(
                    onClick = {
                        error = null
                        info = null
                        scope.launch {
                            try {
                                Repo.sendVerification()
                                info = "Email sent to $email. Check your inbox."
                                cooldown = COOLDOWN_SECONDS
                            } catch (e: Exception) {
                                error = Repo.errorMessage(e)
                            }
                        }
                    },
                    enabled = cooldown == 0 && !busy,
                    modifier = Modifier.fillMaxWidth().height(50.dp),
                    shape = RoundedCornerShape(14.dp),
                ) {
                    Text(if (cooldown > 0) "Resend email (${cooldown}s)" else "Resend email")
                }
            }
        }
    }
}
