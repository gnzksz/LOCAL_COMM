# LANDING

Public landing page for LOCAL_COMM, live at **https://local-comm-bdae9.web.app**. It is written for residents: it explains how reporting works and has **Log in** and **Sign up** buttons that go to the one sign-in page (`/login/`). It does not mention the admin or staff areas.

Plain HTML, CSS and JavaScript, with nothing to install, in English. The page is in [public/index.html](public/index.html).

## Edit and publish

```powershell
cd C:\Users\genes\LOCAL_COMM\firebase
npm run preview         # the whole site on http://localhost:5000
npm run deploy:web      # publish
```

To do: add the barangay's contact details (office address, phone, email) to the footer, and change the "Android app is being built" answer in the FAQ when the app is ready.
