# WEB-RESIDENT (test page)

Live address: **https://local-comm-bdae9-resident.web.app** (published with `npm run deploy:web` in the `firebase` folder). Nothing has to run on your computer.

A small web page that stands in for the resident **mobile app** while it is not built yet, so the whole flow can be tested in a browser. It uses the same Firestore rules and the same data model the Android app will use (see [../firebase/README.md](../firebase/README.md)).

## Run locally (optional)

```powershell
cd C:\Users\genes\LOCAL_COMM\web-resident
npm start            # http://localhost:5175
```

Click **No account yet? Register**, then:

- **New report**: issue type, description, a **photo** (compressed in the browser) and a **location** ("Use my location" or type the coordinates). Sending without a photo or location is refused, like in the diagram.
- **My reports**: live status of every report, with a history timeline.
- **Rate the service** once a report is Resolved.
- **My profile**: edit your own name, phone and address.
- **Notifications**: sent when a report is rejected, In Progress or Resolved.

> `public/js/firebase.js`, `data.js`, `ui.js` and `public/css/styles.css` are copies of the ones in `web-admin`. If you change them, change all of them.
