# WEB-LOGIN

The one sign-in and sign-up page of LOCAL_COMM, at **https://local-comm-bdae9.web.app/login/**.

- Everybody uses the same form. After signing in, `onSession()` in `public/js/firebase.js` reads the `role` of the user's profile and opens `/admin/`, `/staff/` or `/resident/`.
- `/login/?mode=register` shows the sign-up form. Only residents can register here; staff accounts are created by an admin.
- If an account cannot be used (no profile, wrong role name, a typo like `"name "` in a field name), the page says exactly what to fix, including the user's UID.

`public/js/firebase.js`, `ui.js` and `public/css/styles.css` are copies of the ones in `web-admin` (kept in sync by `npm run build:web` in the `firebase` folder).
