# WEB-ADMIN

Admin web dashboard. Plain HTML, CSS and JavaScript (ES modules), so there is **nothing to install or build**. It talks directly to Firebase (the SDK is loaded from Google's CDN). Node is only used to serve the files.

## Run

```bash
# 1. Set up Firebase first (see ../firebase/README.md, free Spark plan) and paste your web config into public/js/config.js
cd web-admin
npm start            # http://localhost:5173
```

Sign in with the admin account created by the seed step (default `admin@localcomm.test` / `admin123`).

To try it against the local emulators instead, open `http://localhost:5173/?emulator` (use `?emulator=off` to switch back).

## What it does (admin lane of the flow diagram)

| Page | Features |
|---|---|
| Service requests | Live list (new reports appear in real time), search, filter by status / issue type / category / date, sort, paging |
| Report detail | Photo, description, map, live status history · **categorize** · **reject** (resident is notified) · **assign** to staff (department comes from the staff account) · **archive** once resolved · see resident rating and feedback |
| Summary reports | Totals, average rating, average time to resolve, counts by status / issue type / department, date range |
| Staff & departments | Add departments and staff accounts (you stay signed in while a staff login is created) |

Staff accounts must be created here before reports can be assigned.

> `public/js/firebase.js`, `data.js`, `ui.js` and `public/css/styles.css` are copies of the ones in `web-staff`. If you change them, change both.
