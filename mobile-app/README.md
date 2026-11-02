# MOBILE-APP (Android, Kotlin + Jetpack Compose)

The resident app of LOCAL COMMUNITY SERVICES. It uses the **same Firebase project, data and security rules as the website** (see [../firebase/README.md](../firebase/README.md)), so there is no separate backend. Everything is on the free Spark plan.

> **Status: written, not yet built.** No Android Studio or Java was available where this code was written, so it has never been compiled or run. Expect a few small errors on the first build; send the message and they get fixed. Library versions were checked to exist.

## What it does

| Screen | |
|---|---|
| Sign in / Create account | Email + password. Residents only. Staff and administrators are told to use the website |
| Reports | Live list of your reports with counts, tap one to open it |
| New report | Issue type, description, **photo** (camera or gallery), **location** (GPS and/or tap the OpenStreetMap map, drag the pin). Photo and location are required, like on the website |
| Report detail | Photo, map, status history, and **rate the service** once it is Resolved |
| Alerts | Notifications with an unread badge. Opening the screen marks them read; "Mark all as read" too |
| Profile | Name, phone (formats as you type), address, profile picture, completeness bar, change login email (confirmation link), last login, sign out |

## Set up (once)

1. **Android Studio**: *Open* the folder `mobile-app` (not the whole repo). Let it sync; it downloads Gradle 8.10.2 and may ask to install **Android SDK 35**, accept. If it offers the *AGP Upgrade Assistant*, accepting is fine.
2. **Firebase console** → Project settings → *Your apps* → **Add app → Android**:
   - Android package name: `com.localcommunity.services`
   - App nickname: anything. Skip the SHA-1 box (not needed for email/password).
   - Download **`google-services.json`** and put it in `mobile-app/app/` (next to `build.gradle.kts`).
3. Sync again, then press **Run ▶** with an emulator or a phone (Developer options → USB debugging).

Sign in with a resident account, or tap *Create one*. A staff or admin account will be refused with a message that points to the website.

## Make an APK to share

*Build → Build Bundle(s) / APK(s) → Build APK(s)*. The file is `app/build/outputs/apk/debug/app-debug.apk`; send it to a phone and install it (allow "install unknown apps"). This is a debug build, fine for a school demo.

## How it talks to Firebase

| Thing | Where |
|---|---|
| Sign-in, profile, every read and write | [Repo.kt](app/src/main/java/com/localcommunity/services/data/Repo.kt) |
| Submit a report = ONE batch: `requests/{id}` + `requests/{id}/photo/main` + `requests/{id}/history/{auto}` | `Repo.submitReport` |
| Photos are small JPEG **data URLs** in Firestore (no Cloud Storage on the free plan) | [Images.kt](app/src/main/java/com/localcommunity/services/data/Images.kt) |
| Notifications: `is_read` false to true plus `read_at` | `Repo.markNotificationRead`, `markAllNotificationsRead` |
| Same issue types, limits and field names as `firestore.rules` | [Models.kt](app/src/main/java/com/localcommunity/services/data/Models.kt) |

## Limits (because of the free plan)

- **No push notifications** (they need a server, which needs the paid plan). An alert shows while the app is open; otherwise it is waiting in *Alerts* the next time you open the app.
- **No Google Maps** (it needs a billing account). The map is OpenStreetMap through the `osmdroid` library.

## Project map

```
app/src/main/java/com/localcommunity/services/
  LocalCommunityApp.kt   starts the sign-in watcher and the map library
  MainActivity.kt        shows AppRoot()
  data/                  Models, Repo (all Firebase calls), Images (photo compression)
  ui/                    Theme, Components, MapPicker, App (navigation + bottom bar)
  ui/screens/            Login, Reports, NewReport, ReportDetail, Notifications, Profile
  util/Phone.kt          Philippine mobile number format and check
```
