import { contactPatch, saveUser } from '../data.js';
import { getProfile, refreshProfile, requestEmailChange } from '../firebase.js';
import { contactFields, html, initials, render, toast } from '../ui.js';

/** "My profile": the signed-in user edits their own name, phone, address and login email. */
export function mount(el) {
  const me = getProfile();
  render(
    el,
    html`
      <div class="page-head"><div><h1>My profile</h1><div class="muted">Keep your contact info up to date.</div></div></div>
      <form class="card" id="form" style="max-width:520px">
        <div style="display:flex;align-items:center;gap:14px;margin-bottom:18px">
          <div class="avatar" style="width:52px;height:52px;font-size:18px;background:var(--primary)">${initials(me.name)}</div>
          <div><strong>${me.email}</strong><div class="muted small">${me.role}${me.department_name ? ` · ${me.department_name}` : ''}</div></div>
        </div>
        ${contactFields(me)}
        <p class="form-error" hidden></p>
        <div class="actions"><button class="btn btn-primary" type="submit">Save changes</button></div>
      </form>

      <form class="card" id="email-form" style="max-width:520px;margin-top:20px">
        <h2>Login email</h2>
        <p class="muted small">This is the email you sign in with. To change it, enter the new email and your password.
          We send a confirmation link to the new address. You keep signing in with the old email until you open that link.
          After confirming, sign in again with the new email.</p>
        <div class="field"><label>Current email</label><input value="${me.email}" disabled /></div>
        <div class="field"><label>New email</label><input name="new_email" type="email" autocomplete="off" required /></div>
        <div class="field"><label>Your password</label><input name="password" type="password" autocomplete="current-password" required /></div>
        <p class="form-error" hidden></p>
        <p class="form-ok" hidden></p>
        <div class="actions"><button class="btn" type="submit">Send confirmation link</button></div>
      </form>`
  );

  const form = el.querySelector('#form');
  const error = form.querySelector('.form-error');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    error.hidden = true;
    const button = form.querySelector('[type=submit]');
    button.disabled = true;
    try {
      await saveUser(me.id, contactPatch({ name: form.name.value, phone: form.phone.value, address: form.address.value }));
      const fresh = await refreshProfile();
      // keep the sidebar in step with the new name
      const who = document.querySelector('.who strong');
      if (who) who.textContent = fresh.name;
      const avatar = document.querySelector('.sidebar .avatar');
      if (avatar) avatar.textContent = initials(fresh.name);
      toast('Profile saved', 'success');
    } catch (err) {
      error.textContent = err.message;
      error.hidden = false;
    } finally {
      button.disabled = false;
    }
  });

  const emailForm = el.querySelector('#email-form');
  const emailError = emailForm.querySelector('.form-error');
  const emailOk = emailForm.querySelector('.form-ok');
  emailForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    emailError.hidden = true;
    emailOk.hidden = true;
    const button = emailForm.querySelector('[type=submit]');
    button.disabled = true;
    try {
      const sentTo = await requestEmailChange(emailForm.new_email.value, emailForm.password.value);
      emailOk.textContent = `We sent a confirmation link to ${sentTo}. Open it (check Spam too) to finish. Until then you still sign in with ${me.email}.`;
      emailOk.hidden = false;
      emailForm.password.value = '';
    } catch (err) {
      emailError.textContent = err.message;
      emailError.hidden = false;
    } finally {
      button.disabled = false;
    }
  });
}
