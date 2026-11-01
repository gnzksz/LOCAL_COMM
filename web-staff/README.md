# WEB-STAFF

Web portal for staff / field personnel. Plain HTML, CSS and JavaScript (ES modules), with nothing to install or build. It talks directly to Firebase (the SDK is loaded from Google's CDN).

## Run

```bash
# Set up Firebase first (see ../firebase/README.md) and paste your web config into public/js/config.js
cd web-staff
npm start            # http://localhost:5174
```

Staff accounts are created by an admin (web-admin → Staff & departments). To try it against the local emulators, open `http://localhost:5174/?emulator`.

## What it does (staff lane of the flow diagram)

- **My assignments**: reports assigned to you. New assignments show up live, with a notification.
- **Report detail**: description, photo, location map, live status history.
- **Mark as In Progress** and **Mark as Resolved**, each with an optional note. The resident is notified automatically.

> `public/js/firebase.js`, `data.js`, `ui.js` and `public/css/styles.css` are copies of the ones in `web-admin`. If you change them, change both.
