// Password rules, shared by the sign-up form (live checklist), the strength meter and the sign-up call.
// Firebase itself only requires 6 characters; these rules are checked in the browser before the account is created.

export const PASSWORD_RULES = [
  { key: 'length', label: 'At least 8 characters', test: (p) => p.length >= 8 },
  { key: 'letter', label: 'At least one letter', test: (p) => /[A-Za-z]/.test(p) },
  { key: 'number', label: 'At least one number', test: (p) => /\d/.test(p) },
];

export const PASSWORD_HINT = 'Use at least 8 characters, with a letter and a number.';

/** '' when the password follows the rules, otherwise a sentence that says what is missing. */
export const passwordProblem = (password) => (PASSWORD_RULES.every((r) => r.test(password || '')) ? '' : PASSWORD_HINT);

/** 0 (empty) to 4. A password that breaks a rule never scores above 1. */
export function passwordScore(password) {
  const p = password || '';
  if (!p) return 0;
  if (passwordProblem(p)) return 1;
  let score = 2;
  if (p.length >= 12) score++;
  if (/[a-z]/.test(p) && /[A-Z]/.test(p) && /[^A-Za-z0-9]/.test(p)) score++;
  return Math.min(score, 4);
}

export const SCORE_LABELS = ['', 'Weak', 'Fair', 'Good', 'Strong'];
