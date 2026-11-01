# WEB-ADMIN

Live address: **https://local-comm-bdae9.web.app/admin/**. There is no separate sign-in here: you sign in once at `/login/` and the role in your profile brings you to this area.

Admin web dashboard. Plain HTML, CSS and JavaScript (ES modules), so there is **nothing to install or build**. It talks directly to Firebase (the SDK is loaded from Google's CDN). Node is only used to serve the files.

## Try it before publishing

```powershell
cd C:\Users\genes\LOCAL_COMM\firebase
npm run preview      # http://localhost:5000/admin/ (rebuilds first)
```

## What it does (admin lane of the flow diagram)

| Page | Features |
|---|---|
| Service requests | Live list (new reports appear in real time), search, filter by status / issue type / category / date, sort, paging |
| Report detail | Photo, description, map, live status history · **categorize** · **reject** (resident is notified) · **assign** to staff (department comes from the staff account) · **archive** once resolved · see resident rating and feedback |
| Summary reports | Totals, average rating, average time to resolve, counts by status / issue type / department, date range |
| Staff & departments | Add departments and staff accounts (you stay signed in while a staff login is created) · **edit** a staff member's name, phone, address and department |
| Residents | List of registered residents with their number of reports, search, and **edit** of name, phone and address |

Staff accounts must be created here before reports can be assigned.

> `public/js/firebase.js`, `data.js`, `ui.js` and `public/css/styles.css` are copies of the ones in `web-staff`. If you change them, change both.
