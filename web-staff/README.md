# WEB-STAFF

Live address: **https://local-comm-bdae9.web.app/staff/**. There is no separate sign-in here: you sign in once at `/login/` and the role in your profile brings you to this area.

Web portal for staff / field personnel. Plain HTML, CSS and JavaScript (ES modules), with nothing to install or build. It talks directly to Firebase (the SDK is loaded from Google's CDN).

## Try it before publishing

```powershell
cd C:\Users\genes\LOCAL_COMM\firebase
npm run preview      # http://localhost:5000/staff/ (rebuilds first)
```

## What it does (staff lane of the flow diagram)

- **My assignments**: reports assigned to you. New assignments show up live, with a notification.
- **Report detail**: description, photo, location map, live status history.
- **My profile**: a header with your picture (upload with the camera button), role badge and a profile completeness bar; your numbers (Assigned, In progress, Completed); edit your name, phone (formatted while typing) and address; and **Account & security** with your read-only login email, the confirmation-link flow to change it, and your last login. The page is the same file for staff and residents (`web-staff/public/js/views/profile.js` is the master, copied by `npm run build:web`).
- **Mark as In Progress** and **Mark as Resolved**, each with an optional note. The resident is notified automatically.

> `public/js/firebase.js`, `data.js`, `ui.js` and `public/css/styles.css` are copies of the ones in `web-admin`. If you change them, change both.
