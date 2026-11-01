# LOCAL_COMM

Community service request system: residents report issues through a mobile app, admins review and assign them on a web dashboard, and staff / field personnel update progress until the issue is resolved.

| Folder | Part | Status |
|---|---|---|
| [firebase/](firebase/) | Firebase backend: Firestore rules, seed and tests | ✅ Free Spark plan (Auth + Firestore, no card). Setup in [firebase/README.md](firebase/README.md). Rules not yet run against a real project or the emulators |
| [web-admin/](web-admin/) | Admin web dashboard | ✅ Rewritten for Firebase, see [web-admin/README.md](web-admin/README.md) |
| [web-staff/](web-staff/) | Staff / field personnel web app | ✅ Rewritten for Firebase, see [web-staff/README.md](web-staff/README.md) |
| [web-resident/](web-resident/) | Resident test page (stands in for the mobile app) | ✅ See [web-resident/README.md](web-resident/README.md) |
| [mobile-app/](mobile-app/) | Resident mobile app (Android Studio) | ⏳ Not started |
| [backend/](backend/) | Old Node + SQLite server | ⚠️ Replaced by `firebase/`. Safe to delete once you stop running it |

## Open the apps (live on Firebase Hosting)

| Portal | Address |
|---|---|
| Admin | https://local-comm-bdae9-admin.web.app |
| Staff | https://local-comm-bdae9-staff.web.app |
| Resident (test page) | https://local-comm-bdae9-resident.web.app |

Nothing needs to run on your computer. Sign in with the accounts you created (see [firebase/README.md](firebase/README.md)).

After changing the code of a web app, publish it again (from the `firebase` folder):

```powershell
cd C:\Users\genes\LOCAL_COMM\firebase
npm run deploy:web      # web apps only
npm run deploy          # rules + web apps
```

To work on the apps locally instead, see the "Run locally" part of each README (`npm start` in the app folder, then open http://localhost:5173, 5174 or 5175).
