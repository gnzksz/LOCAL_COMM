// Client-side lockout: after 5 failed sign-ins the form is disabled for 30 seconds.
// The counter lives in sessionStorage, so refreshing the page does not clear it. This only slows down a person at the
// keyboard (anyone can clear their own browser storage); Firebase's own "too many requests" limit protects the server.

const KEY = 'lcs_login_lock';
export const MAX_ATTEMPTS = 5;
export const LOCK_SECONDS = 30;

const read = () => {
  try {
    return JSON.parse(sessionStorage.getItem(KEY)) || { count: 0, until: 0 };
  } catch {
    return { count: 0, until: 0 };
  }
};
const write = (state) => {
  try {
    sessionStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    /* private mode: no lockout memory */
  }
};

/** Seconds left of the current lockout, 0 when the form may be used. */
export const lockedSeconds = () => Math.max(0, Math.ceil((read().until - Date.now()) / 1000));

/** How many tries remain before the lockout starts. */
export const attemptsLeft = () => MAX_ATTEMPTS - read().count;

/** Count one failed sign-in. Returns the lockout length in seconds when this failure started one, otherwise 0. */
export function recordFailure() {
  const state = read();
  if (state.until > Date.now()) return lockedSeconds();
  state.count += 1;
  if (state.count >= MAX_ATTEMPTS) {
    write({ count: 0, until: Date.now() + LOCK_SECONDS * 1000 });
    return LOCK_SECONDS;
  }
  write(state);
  return 0;
}

export const resetFailures = () => write({ count: 0, until: 0 });
