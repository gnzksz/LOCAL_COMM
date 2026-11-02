package com.localcommunity.services.data

/** The resident's own profile document: users/{uid}. */
data class Profile(
    val id: String,
    val name: String,
    val email: String,
    val role: String,
    val phone: String?,
    val address: String?,
    val photo: String?, // small square JPEG as a data URL (no Cloud Storage on the free plan)
    val createdAt: Long?,
)

/** A service request: requests/{id}. Times are milliseconds. */
data class Report(
    val id: String,
    val issueType: String,
    val description: String,
    val thumb: String,
    val latitude: Double,
    val longitude: Double,
    val address: String?,
    val category: String?,
    val status: String,
    val staffName: String?,
    val departmentName: String?,
    val rejectionReason: String?,
    val rating: Int?,
    val feedback: String?,
    val createdAt: Long,
)

/** One line of requests/{id}/history. */
data class HistoryEntry(
    val status: String,
    val note: String?,
    val actorName: String,
    val actorRole: String,
    val createdAt: Long,
)

/** notifications/{id} */
data class AppNotification(
    val id: String,
    val requestId: String?,
    val title: String,
    val message: String,
    val isRead: Boolean,
    val createdAt: Long,
)

/** Where the app is in the sign-in process. */
sealed interface Session {
    data object Loading : Session

    /** [notice] explains why a signed-in account was refused; [stamp] makes every refusal a new value. */
    data class SignedOut(val notice: String? = null, val stamp: Long = System.nanoTime()) : Session

    data class SignedIn(val profile: Profile) : Session
}

object Status {
    const val PENDING = "Pending"
    const val ASSIGNED = "Assigned"
    const val IN_PROGRESS = "In Progress"
    const val RESOLVED = "Resolved"
    const val REJECTED = "Rejected"
    const val ARCHIVED = "Archived"
}

/** Must match the list in firestore.rules. */
val ISSUE_TYPES = listOf(
    "Garbage / Waste Collection",
    "Road Damage / Potholes",
    "Streetlight",
    "Drainage / Flooding",
    "Water Supply",
    "Noise / Disturbance",
    "Stray Animals",
    "Other",
)
