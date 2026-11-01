# FIREBASE (backend, free Spark plan)

Firebase project for LOCAL_COMM, shared by the resident mobile app, the admin dashboard and the staff portal. **No credit card needed**: it only uses Authentication and Firestore, both free on the Spark plan.

| Firebase product | Used for |
|---|---|
| Authentication (email + password) | Login for residents, staff and admins |
| Firestore | Users, departments, service requests, photos, status history, notifications. It is real-time, so dashboards update live |
| Security rules ([firestore.rules](firestore.rules)) | **The backend logic.** They only accept a change if it follows the flow in the diagram and comes from the right role |

Not used (they need the paid Blaze plan): Cloud Functions, Cloud Storage and push notifications. See [Limitations](#limitations).

## One-time setup

You already created the project (`local-comm-bdae9`, saved in [.firebaserc](.firebaserc)). In the [Firebase console](https://console.firebase.google.com/project/local-comm-bdae9):

1. **Build → Authentication → Get started →** enable **Email/Password**.
2. **Build → Firestore Database → Create database** (production mode). If you already created it, skip this. Skip **Storage** completely.
3. **Project settings → General → Your apps → Web app (`</>`)**. Register it and copy the `firebaseConfig` into
   [../web-admin/public/js/config.js](../web-admin/public/js/config.js) and [../web-staff/public/js/config.js](../web-staff/public/js/config.js) (same values in both).
4. Publish the rules. Run this **inside the `firebase` folder**:
   ```powershell
   cd C:\Users\genes\LOCAL_COMM\firebase
   npm install
   npx firebase login
   npm run deploy
   ```
5. Create the first admin and the departments (pick one):
   - **Script:** Project settings → Service accounts → *Generate new private key*, save it as `firebase/serviceAccountKey.json` (it is git-ignored; never share it), then
     ```powershell
     $env:GOOGLE_APPLICATION_CREDENTIALS="./serviceAccountKey.json"; $env:GCLOUD_PROJECT="local-comm-bdae9"; npm run seed
     ```
     This creates `admin@localcomm.test` / `admin123` (set `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD` first to change it) and 5 departments.
   - **By hand:** Authentication → *Add user*, copy its UID. Firestore → *Start collection* `users` → document id = that UID, with fields `name` (string), `email` (string), `role` = `admin` (string), `created_at` (timestamp). Add departments later in the admin dashboard.

Then run the web apps (see their READMEs) and sign in as the admin.

## Request status flow

```
Pending ──(admin: invalid)──> Rejected                                   [End]
Pending ──(admin: assign)──> Assigned ──(staff)──> In Progress ──(staff)──> Resolved ──(admin)──> Archived
                                                                      └─ resident rates / gives feedback
```

Each change is one **batch write** containing the request update, a `history` entry and (when someone must be told) a `notifications` entry. The rules reject the batch unless:

| Change | Who | Rule |
|---|---|---|
| Create report | resident | Must contain a thumbnail, the full photo (`photo/main`), a location, and start as `Pending` |
| `Pending → Rejected` | admin | Needs a `rejection_reason` |
| `Pending/Assigned → Assigned` | admin | `assigned_*` fields must match the chosen staff account (the department comes from the staff profile) |
| `Assigned → In Progress` | the assigned staff | Only that staff member |
| `In Progress → Resolved` | the assigned staff | Only that staff member |
| `Resolved → Archived` | admin | |
| `rating` + `feedback` | the resident | Only when `Resolved`, once, rating 1 to 5 |
| `category` | admin | Label for sorting/filtering |

A history entry must match the status the request has after the batch, and a notification may only go to the report's resident or assigned staff. Staff profiles can only be created by an admin.

## Data model (for the mobile app)

**Resident sign-up** (Android): create the Auth user with email + password, then write `users/{uid}`:
`{ name, email, role: "resident", created_at: serverTimestamp() }` (`role` must be `"resident"`).

**Submit a report.** Use **one `WriteBatch`** with these three writes (the rules refuse a report without photo or location):

1. `requests/{newId}`:
   ```
   resident_id: uid, resident_name, resident_email, issue_type (one of the 8 types), description,
   thumb (small JPEG data URL, max 60 000 characters), latitude, longitude, address,
   category: null, status: "Pending", assigned_staff_id: null, assigned_staff_name: null,
   assigned_department_id: null, assigned_department_name: null, rejection_reason: null,
   rating: null, feedback: null,
   created_at: serverTimestamp(), updated_at: serverTimestamp(),
   assigned_at: null, resolved_at: null, archived_at: null
   ```
2. `requests/{newId}/photo/main` = `{ data: "data:image/jpeg;base64,..." }` (max 800 000 characters, so compress to about 500 KB or less)
3. `requests/{newId}/history/{auto}` = `{ status: "Pending", note: "Report submitted", actor_id: uid, actor_name, actor_role: "resident", created_at: serverTimestamp() }`

Photos: on Android, scale the bitmap to about 1024 px on the long side and `compress(JPEG, 70)`, then Base64 it (`NO_WRAP`) and prefix `data:image/jpeg;base64,`. Make `thumb` the same way at about 96 px.

**Track status:** listen to `requests` where `resident_id == uid`, and to `requests/{id}/history` (order by `created_at`).
**Notifications:** listen to `notifications` where `user_id == uid`. Mark one read with `is_read: true` (nothing else).
**Feedback:** `update` the request with `{ rating, feedback, updated_at: serverTimestamp() }` (nothing else).

Issue types: Garbage / Waste Collection, Road Damage / Potholes, Streetlight, Drainage / Flooding, Water Supply, Noise / Disturbance, Stray Animals, Other.

## Limitations

- **No push notifications.** Notifications are real-time only while the app or page is open (Firestore listeners). Real push (FCM) needs a server, which needs Blaze.
- **Photos live in Firestore**, compressed, because Cloud Storage now needs Blaze. The free quota is 1 GiB (thousands of photos) and 50 000 reads per day, which is plenty for a barangay-sized project.
- **Rules instead of Functions.** Anyone with a valid login could write their own client, but the rules above still stop them from skipping steps, acting outside their role, or touching other people's reports. What the rules cannot stop: an admin or staff member writing a misleading note.
- Creating a staff account makes the login first, then the profile. If the second step fails you get a login without a profile; delete it in the console (Authentication) and try again.

## Testing locally with the emulators

Needs **Java 21 or newer** (JDK) on your PATH.

```powershell
cd firebase
npm test       # starts the Auth + Firestore emulators, runs scripts/smoke-test.js, stops them
```

`npm test` walks the whole flow of the diagram and also checks that the rules refuse every bad request (skipping a step, wrong role, other people's reports, forged history...). To try the web apps against the emulators, run `npm run emulators`, then in another terminal `npm run seed`, and open the web apps with `?emulator` at the end of the address (for example `http://localhost:5173/?emulator`).

> Status: the rules and this test were written but **not yet run**. Run `npm test` first if you can; the rules are the part most likely to need a fix.
