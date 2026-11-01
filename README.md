# LOCAL_COMM

Community service request system: residents report issues through a mobile app, admins review and assign them on a web dashboard, and staff / field personnel update progress until the issue is resolved.

| Folder | Part | Status |
|---|---|---|
| [firebase/](firebase/) | Firebase backend: Firestore rules, seed and tests | ✅ Free Spark plan (Auth + Firestore, no card). Setup in [firebase/README.md](firebase/README.md). Rules not yet run against a real project or the emulators |
| [web-admin/](web-admin/) | Admin web dashboard | ✅ Rewritten for Firebase, see [web-admin/README.md](web-admin/README.md) |
| [web-staff/](web-staff/) | Staff / field personnel web app | ✅ Rewritten for Firebase, see [web-staff/README.md](web-staff/README.md) |
| [mobile-app/](mobile-app/) | Resident mobile app (Android Studio) | ⏳ Not started |
| [backend/](backend/) | Old Node + SQLite server | ⚠️ Replaced by `firebase/`. Safe to delete once you stop running it |

## Run

1. Do the one-time Firebase setup in [firebase/README.md](firebase/README.md).
2. Start the web apps (no install needed):
   ```bash
   cd web-admin && npm start     # http://localhost:5173
   cd web-staff && npm start     # http://localhost:5174
   ```
