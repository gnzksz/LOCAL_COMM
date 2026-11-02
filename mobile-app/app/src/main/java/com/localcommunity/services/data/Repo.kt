package com.localcommunity.services.data

import com.google.firebase.FirebaseNetworkException
import com.google.firebase.auth.EmailAuthProvider
import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.auth.FirebaseAuthException
import com.google.firebase.auth.FirebaseUser
import com.google.firebase.firestore.DocumentSnapshot
import com.google.firebase.firestore.FieldValue
import com.google.firebase.firestore.FirebaseFirestore
import com.google.firebase.firestore.FirebaseFirestoreException
import com.google.firebase.firestore.Query
import com.google.firebase.firestore.QuerySnapshot
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.channels.awaitClose
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.callbackFlow
import kotlinx.coroutines.launch
import kotlinx.coroutines.tasks.await

/** An error whose message is already written for the user. */
class AppError(message: String) : Exception(message)

/**
 * Everything the app says to Firebase. It follows the same data model and the same security rules as the
 * website (see firebase/README.md): every status change is a batch that firestore.rules checks.
 */
object Repo {
    private const val WEBSITE = "https://local-comm-bdae9.web.app/login/"

    private val auth: FirebaseAuth get() = FirebaseAuth.getInstance()
    private val db: FirebaseFirestore get() = FirebaseFirestore.getInstance()

    private val _session = MutableStateFlow<Session>(Session.Loading)
    val session: StateFlow<Session> = _session.asStateFlow()

    private var started = false
    private var generation = 0
    private var pendingNotice: String? = null

    /** Starts watching the sign-in state. Call once, from the Application. */
    fun start(scope: CoroutineScope) {
        if (started) return
        started = true
        auth.addAuthStateListener { firebaseAuth ->
            scope.launch { onAuthChanged(firebaseAuth.currentUser) }
        }
    }

    // ------------------------------------------------------------------------------------------------ sign-in

    private class Loaded(val profile: Profile, val strayKey: String?)

    private suspend fun fetchProfile(uid: String): Loaded? {
        val snap = db.collection("users").document(uid).get().await()
        if (!snap.exists()) return null
        val profile = Profile(
            id = uid,
            name = snap.getString("name") ?: "",
            email = snap.getString("email") ?: "",
            role = snap.getString("role") ?: "",
            phone = snap.getString("phone"),
            address = snap.getString("address"),
            photo = snap.getString("photo"),
            createdAt = snap.millis("created_at"),
        )
        // field names must be exact: a trailing space ("name ") is easy to type in the console
        return Loaded(profile, snap.data?.keys?.firstOrNull { it != it.trim() })
    }

    private fun profileProblem(user: FirebaseUser, loaded: Loaded?, failure: Exception?): String? {
        if (failure is FirebaseFirestoreException && failure.code == FirebaseFirestoreException.Code.PERMISSION_DENIED) {
            return "Signed in, but the profile could not be read (permission denied). Ask the administrator to publish the latest rules."
        }
        if (failure != null) return "Signed in, but the profile could not be loaded: ${failure.message}"
        if (loaded == null) {
            return "Signed in as ${user.email}, but this account has no profile yet. Ask the administrator for help (account id ${user.uid})."
        }
        val p = loaded.profile
        if (p.role !in setOf("admin", "staff", "resident")) return "This account's role is \"${p.role}\", which is not valid."
        if (p.name.isBlank() || loaded.strayKey != null) {
            return "Your profile is not correct (the field \"${loaded.strayKey ?: "name"}\" is missing or has an extra space). Ask the administrator to fix it."
        }
        if (p.role != "resident") {
            return "This app is for residents. Staff and administrators: please sign in on the website $WEBSITE"
        }
        return null
    }

    private suspend fun onAuthChanged(user: FirebaseUser?) {
        val mine = ++generation
        if (user == null) {
            _session.value = Session.SignedOut(pendingNotice)
            pendingNotice = null
            return
        }

        var loaded: Loaded? = null
        var failure: Exception? = null
        // A brand-new resident has no profile for a moment (it is written right after sign-up), so retry briefly.
        for (attempt in 0 until 4) {
            if (loaded != null || failure != null) break
            if (attempt > 0) delay(400)
            try {
                loaded = fetchProfile(user.uid)
            } catch (e: CancellationException) {
                throw e
            } catch (e: Exception) {
                failure = e
            }
        }
        if (mine != generation) return // a newer sign-in change took over

        val problem = profileProblem(user, loaded, failure)
        if (problem != null) {
            pendingNotice = problem
            auth.signOut() // the listener runs again signed out and shows the notice
            return
        }

        var profile = loaded!!.profile
        // After the user confirmed a new login email, copy it into the profile too (the rules allow exactly that).
        val loginEmail = user.email
        if (loginEmail != null && !profile.email.equals(loginEmail, ignoreCase = true)) {
            runCatching { db.collection("users").document(user.uid).update("email", loginEmail).await() }
                .onSuccess { profile = profile.copy(email = loginEmail) }
        }
        _session.value = Session.SignedIn(profile)
    }

    suspend fun signIn(email: String, password: String) {
        try {
            auth.signInWithEmailAndPassword(email.trim(), password).await()
        } catch (e: CancellationException) {
            throw e
        } catch (e: Exception) {
            throw AppError(authMessage(e))
        }
        // onAuthChanged() takes it from here
    }

    /** Resident self-registration. Staff and administrators are created by an administrator on the website. */
    suspend fun register(name: String, email: String, password: String) {
        val cleanName = name.trim().take(100)
        val cleanEmail = email.trim().lowercase()
        if (cleanName.isEmpty()) throw AppError("Name is required")
        val uid = try {
            auth.createUserWithEmailAndPassword(cleanEmail, password).await().user!!.uid
        } catch (e: CancellationException) {
            throw e
        } catch (e: Exception) {
            throw AppError(authMessage(e))
        }
        try {
            db.collection("users").document(uid).set(
                mapOf(
                    "name" to cleanName,
                    "email" to cleanEmail,
                    "role" to "resident",
                    "created_at" to FieldValue.serverTimestamp(),
                )
            ).await()
        } catch (e: CancellationException) {
            throw e
        } catch (e: Exception) {
            throw AppError(errorMessage(e))
        }
    }

    fun signOut() = auth.signOut()

    val accountCreatedAt: Long? get() = auth.currentUser?.metadata?.creationTimestamp
    val lastSignInAt: Long? get() = auth.currentUser?.metadata?.lastSignInTimestamp

    private fun authMessage(e: Exception): String = when {
        e is FirebaseNetworkException -> "Cannot reach Firebase. Check your internet connection."
        e is FirebaseAuthException -> when (e.errorCode) {
            "ERROR_INVALID_CREDENTIAL", "ERROR_WRONG_PASSWORD", "ERROR_USER_NOT_FOUND", "ERROR_INVALID_LOGIN_CREDENTIALS" -> "Incorrect email or password"
            "ERROR_INVALID_EMAIL" -> "Enter a valid email address"
            "ERROR_USER_DISABLED" -> "This account has been disabled"
            "ERROR_TOO_MANY_REQUESTS" -> "Too many attempts. Please try again later"
            "ERROR_EMAIL_ALREADY_IN_USE" -> "That email is already registered. Try signing in instead."
            "ERROR_WEAK_PASSWORD" -> "Password must be at least 6 characters."
            else -> e.message ?: "Sign-in failed"
        }
        else -> e.message ?: "Something went wrong"
    }

    /** A message for the screen from any exception. */
    fun errorMessage(e: Throwable): String = when {
        e is AppError -> e.message ?: "Something went wrong"
        e is FirebaseNetworkException -> "No internet connection."
        e is FirebaseFirestoreException && e.code == FirebaseFirestoreException.Code.PERMISSION_DENIED ->
            "That action is not allowed right now. Check the report's status and try again."
        e is FirebaseFirestoreException && e.code == FirebaseFirestoreException.Code.UNAVAILABLE -> "No internet connection."
        else -> e.message ?: "Something went wrong"
    }

    // ------------------------------------------------------------------------------------------------ reading (live)

    private fun DocumentSnapshot.millis(field: String): Long? =
        getTimestamp(field, DocumentSnapshot.ServerTimestampBehavior.ESTIMATE)?.toDate()?.time

    private fun <T> listen(query: Query, map: (QuerySnapshot) -> T): Flow<T> = callbackFlow {
        val registration = query.addSnapshotListener { snapshot, error ->
            if (error != null) {
                close(error)
                return@addSnapshotListener
            }
            if (snapshot != null) trySend(map(snapshot))
        }
        awaitClose { registration.remove() }
    }

    private fun DocumentSnapshot.toReport(): Report? {
        val type = getString("issue_type") ?: return null
        return Report(
            id = id,
            issueType = type,
            description = getString("description") ?: "",
            thumb = getString("thumb") ?: "",
            latitude = getDouble("latitude") ?: 0.0,
            longitude = getDouble("longitude") ?: 0.0,
            address = getString("address"),
            category = getString("category"),
            status = getString("status") ?: Status.PENDING,
            staffName = getString("assigned_staff_name"),
            departmentName = getString("assigned_department_name"),
            rejectionReason = getString("rejection_reason"),
            rating = getLong("rating")?.toInt(),
            feedback = getString("feedback"),
            createdAt = millis("created_at") ?: System.currentTimeMillis(),
        )
    }

    /** My reports, newest first (live). */
    fun reports(uid: String): Flow<List<Report>> =
        listen(db.collection("requests").whereEqualTo("resident_id", uid)) { snap ->
            snap.documents.mapNotNull { it.toReport() }.sortedByDescending { it.createdAt }
        }

    /** One report (live); null if it does not exist. */
    fun report(id: String): Flow<Report?> = callbackFlow {
        val registration = db.collection("requests").document(id).addSnapshotListener { snapshot, error ->
            if (error != null) {
                close(error)
                return@addSnapshotListener
            }
            trySend(snapshot?.takeIf { it.exists() }?.toReport())
        }
        awaitClose { registration.remove() }
    }

    /** The status history of a report, oldest first (live). */
    fun history(id: String): Flow<List<HistoryEntry>> =
        listen(db.collection("requests").document(id).collection("history").orderBy("created_at")) { snap ->
            snap.documents.map {
                HistoryEntry(
                    status = it.getString("status") ?: "",
                    note = it.getString("note"),
                    actorName = it.getString("actor_name") ?: "",
                    actorRole = it.getString("actor_role") ?: "",
                    createdAt = it.millis("created_at") ?: System.currentTimeMillis(),
                )
            }
        }

    /** The full-size photo of a report (a data URL), stored apart from the report so lists stay light. */
    suspend fun photo(id: String): String? =
        db.collection("requests").document(id).collection("photo").document("main").get().await().getString("data")

    /** My notifications, newest first (live). */
    fun notifications(uid: String): Flow<List<AppNotification>> =
        listen(db.collection("notifications").whereEqualTo("user_id", uid)) { snap ->
            snap.documents.map {
                AppNotification(
                    id = it.id,
                    requestId = it.getString("request_id"),
                    title = it.getString("title") ?: "",
                    message = it.getString("message") ?: "",
                    isRead = it.getBoolean("is_read") ?: false,
                    createdAt = it.millis("created_at") ?: System.currentTimeMillis(),
                )
            }.sortedByDescending { it.createdAt }
        }

    // ------------------------------------------------------------------------------------------------ writing

    /**
     * Sends a report: ONE batch with the request, its full photo and the first history entry.
     * The rules refuse it without a photo and a location. Returns the new report's id.
     */
    suspend fun submitReport(
        me: Profile,
        issueType: String,
        description: String,
        address: String?,
        latitude: Double,
        longitude: Double,
        photo: String,
        thumb: String,
    ): String {
        val ref = db.collection("requests").document()
        val batch = db.batch()
        batch.set(
            ref,
            mapOf(
                "resident_id" to me.id,
                "resident_name" to me.name,
                "resident_email" to me.email,
                "issue_type" to issueType,
                "description" to description.trim(),
                "thumb" to thumb,
                "latitude" to latitude,
                "longitude" to longitude,
                "address" to address?.trim()?.ifEmpty { null },
                "category" to null,
                "status" to Status.PENDING,
                "assigned_staff_id" to null,
                "assigned_staff_name" to null,
                "assigned_department_id" to null,
                "assigned_department_name" to null,
                "rejection_reason" to null,
                "rating" to null,
                "feedback" to null,
                "created_at" to FieldValue.serverTimestamp(),
                "updated_at" to FieldValue.serverTimestamp(),
                "assigned_at" to null,
                "resolved_at" to null,
                "archived_at" to null,
            )
        )
        batch.set(ref.collection("photo").document("main"), mapOf("data" to photo))
        batch.set(
            ref.collection("history").document(),
            mapOf(
                "status" to Status.PENDING,
                "note" to "Report submitted",
                "actor_id" to me.id,
                "actor_name" to me.name,
                "actor_role" to "resident",
                "created_at" to FieldValue.serverTimestamp(),
            )
        )
        batch.commit().await()
        return ref.id
    }

    /** "Rate / give feedback" once the report is Resolved (the rules allow it only once). */
    suspend fun submitFeedback(reportId: String, rating: Int, feedback: String?) {
        db.collection("requests").document(reportId).update(
            mapOf(
                "rating" to rating,
                "feedback" to feedback?.trim()?.take(1000)?.ifEmpty { null },
                "updated_at" to FieldValue.serverTimestamp(),
            )
        ).await()
    }

    suspend fun markNotificationRead(id: String) {
        db.collection("notifications").document(id)
            .update(mapOf("is_read" to true, "read_at" to FieldValue.serverTimestamp())).await()
    }

    /** Marks every unread notification in [list] as read in one batch (read ones are kept). */
    suspend fun markAllNotificationsRead(list: List<AppNotification>) {
        val unread = list.filter { !it.isRead }
        if (unread.isEmpty()) return
        val batch = db.batch()
        for (n in unread) {
            batch.update(db.collection("notifications").document(n.id), mapOf("is_read" to true, "read_at" to FieldValue.serverTimestamp()))
        }
        batch.commit().await()
    }

    // ------------------------------------------------------------------------------------------------ my profile

    private suspend fun refreshProfile() {
        val uid = auth.currentUser?.uid ?: return
        val loaded = fetchProfile(uid) ?: return
        _session.value = Session.SignedIn(loaded.profile)
    }

    suspend fun updateProfile(uid: String, name: String, phone: String?, address: String?) {
        db.collection("users").document(uid).update(
            mapOf(
                "name" to name.trim().take(100),
                "phone" to phone?.trim()?.take(30)?.ifEmpty { null },
                "address" to address?.trim()?.take(200)?.ifEmpty { null },
            )
        ).await()
        refreshProfile()
    }

    /** [photo] is a small data URL, or null to remove the picture. */
    suspend fun setPhoto(uid: String, photo: String?) {
        db.collection("users").document(uid).update("photo", photo).await()
        refreshProfile()
    }

    /**
     * Change the login email: the password is checked again, then a confirmation link is sent to the NEW address.
     * The email only changes once the link is opened. Returns the address the link was sent to.
     */
    suspend fun requestEmailChange(newEmail: String, password: String): String {
        val user = auth.currentUser ?: throw AppError("Please sign in again.")
        val current = user.email ?: throw AppError("Please sign in again.")
        val email = newEmail.trim().lowercase()
        if (!Regex("^\\S+@\\S+\\.\\S+$").matches(email)) throw AppError("Enter a valid email address.")
        if (email == current.lowercase()) throw AppError("That is already your email.")
        try {
            user.reauthenticate(EmailAuthProvider.getCredential(current, password)).await()
            user.verifyBeforeUpdateEmail(email).await()
        } catch (e: CancellationException) {
            throw e
        } catch (e: Exception) {
            throw AppError(
                if (e is FirebaseAuthException) when (e.errorCode) {
                    "ERROR_INVALID_CREDENTIAL", "ERROR_WRONG_PASSWORD" -> "Wrong password."
                    "ERROR_EMAIL_ALREADY_IN_USE" -> "That email is already used by another account."
                    "ERROR_INVALID_EMAIL" -> "Enter a valid email address."
                    "ERROR_TOO_MANY_REQUESTS" -> "Too many attempts. Please try again later."
                    "ERROR_REQUIRES_RECENT_LOGIN" -> "Please sign out, sign in again, then retry."
                    else -> e.message ?: "Could not send the link."
                } else authMessage(e)
            )
        }
        return email
    }
}
