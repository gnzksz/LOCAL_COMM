// Ask the admin for their password again before a sensitive action (creating a staff account, archiving a request).
// A correct password is remembered for a few minutes, so several actions in a row do not ask every time.
import { reauthenticate } from './firebase.js';
import { html } from './ui.js';

const GRACE_MS = 5 * 60 * 1000;
let confirmedAt = 0;

const recentlyConfirmed = () => Date.now() - confirmedAt < GRACE_MS;

/** The "Your password" input to put inside a dialog. Empty while a recent confirmation is still valid. */
export const reauthField = () =>
  recentlyConfirmed()
    ? ''
    : html`<div class="field"><label for="admin-password">Confirm with your password</label>
        <input id="admin-password" name="admin_password" type="password" autocomplete="current-password" required />
        <span class="muted small">This action changes records, so please confirm it is you.</span></div>`;

/** Call first in the dialog's onSubmit(values). Throws (and the dialog shows it) when the password is wrong. */
export async function verifyPassword(values) {
  if (recentlyConfirmed()) return;
  await reauthenticate(values.admin_password || '');
  confirmedAt = Date.now();
}
