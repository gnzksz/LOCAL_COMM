// Creates the departments and the first admin account (idempotent).
//
// Against the emulators:  npm run seed   (with FIRESTORE_EMULATOR_HOST / FIREBASE_AUTH_EMULATOR_HOST set,
//                          which `firebase emulators:exec` does for you)
// Against the real project: download a service account key (Project settings > Service accounts),
//   then:  GOOGLE_APPLICATION_CREDENTIALS=./serviceAccountKey.json GCLOUD_PROJECT=<project-id> npm run seed
import { initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { FieldValue, getFirestore } from 'firebase-admin/firestore';

export const DEPARTMENTS = {
  sanitation: 'Sanitation',
  'public-works': 'Public Works / Engineering',
  electrical: 'Electrical',
  'water-drainage': 'Water & Drainage',
  'peace-order': 'Peace & Order',
};

export async function seed({ adminEmail, adminPassword } = {}) {
  const email = adminEmail || process.env.SEED_ADMIN_EMAIL || 'admin@localcomm.test';
  const password = adminPassword || process.env.SEED_ADMIN_PASSWORD || 'admin123';
  const db = getFirestore();

  for (const [id, name] of Object.entries(DEPARTMENTS)) {
    await db.doc(`departments/${id}`).set({ name, created_at: FieldValue.serverTimestamp() }, { merge: true });
  }

  let user;
  try {
    user = await getAuth().getUserByEmail(email);
    console.log(`Admin account already exists: ${email}`);
  } catch (err) {
    if (err.code !== 'auth/user-not-found') throw err;
    user = await getAuth().createUser({ email, password, displayName: 'System Administrator' });
    console.log(`Created admin account: ${email} / ${password}`);
  }
  await db.doc(`users/${user.uid}`).set(
    { name: 'System Administrator', email, role: 'admin', created_at: FieldValue.serverTimestamp() },
    { merge: true }
  );
  console.log(`Departments: ${Object.values(DEPARTMENTS).join(', ')}`);
  return user.uid;
}

// Run directly: `node scripts/seed.js`
if (import.meta.url === `file:///${process.argv[1].replaceAll('\\', '/')}`) {
  initializeApp({ projectId: process.env.GCLOUD_PROJECT || 'demo-local-comm' });
  await seed();
}
