# LOCAL COMMUNITY SERVICES

(Short name used in the code and folders: LOCAL_COMM.)

Community service request system: residents report issues through a mobile app, admins review and assign them on a web dashboard, and staff / field personnel update progress until the issue is resolved.

## The live site

**https://local-comm-bdae9.web.app**

| Page | Address | Who |
|---|---|---|
| Landing page | `/` | everybody (written for residents; it does not mention admin or staff) |
| Sign in / sign up | `/login/` | everybody: **one login for all roles** |
| Resident (test page) | `/resident/` | residents |
| Staff | `/staff/` | field personnel |
| Admin | `/admin/` | administrators |

Nobody has to choose a role. After signing in, each person is sent to their own area by the role saved in their profile. Opening another role's area sends you to your own, and opening any area while signed out sends you to `/login/`. Only residents can create an account (`/login/?mode=register`); staff accounts are created by an admin, and the first admin is created in the Firebase console (see [firebase/README.md](firebase/README.md)).

## Folders

| Folder | Part |
|---|---|
| [landing/](landing/) | Public landing page |
| [web-login/](web-login/) | The single sign-in / sign-up page |
| [web-resident/](web-resident/) | Resident area (test page that stands in for the mobile app) |
| [web-staff/](web-staff/) | Staff area |
| [web-admin/](web-admin/) | Admin area |
| [firebase/](firebase/) | Firebase project: Firestore rules, hosting, seed and tests (free Spark plan, no card) |
| [mobile-app/](mobile-app/) | Resident Android app (Kotlin + Jetpack Compose) | ✍️ Written, **not yet built**. Open it in Android Studio, see [mobile-app/README.md](mobile-app/README.md) |
| [backend/](backend/) | Old Node + SQLite server, replaced by `firebase/`. Safe to delete |

## Publish after changing the code

```powershell
cd C:\Users\genes\LOCAL_COMM\firebase
npm run deploy:web      # landing page + all areas
npm run deploy          # also the Firestore rules
npm run preview         # try the whole site on http://localhost:5000 before publishing
```

The old addresses (`local-comm-bdae9-admin.web.app` and so on) only redirect to this site.
