// Cuentas (Firebase Authentication) y guardado en la nube (Firestore).
// Si no hay configuración de Firebase, todo se vuelve un no-op y el juego
// sigue funcionando con guardado solo en este navegador.

import { firebaseConfig } from './firebase-config.js';

const SDK = 'https://www.gstatic.com/firebasejs/10.14.1';

let authMod, fsMod, auth, db;
export let enabled = false;
let ready;

function init() {
  if (ready) return ready;
  ready = (async () => {
    if (!firebaseConfig || !firebaseConfig.apiKey) return false;
    try {
      const [{ initializeApp }, a, f] = await Promise.all([
        import(`${SDK}/firebase-app.js`),
        import(`${SDK}/firebase-auth.js`),
        import(`${SDK}/firebase-firestore.js`),
      ]);
      authMod = a; fsMod = f;
      const app = initializeApp(firebaseConfig);
      auth = authMod.getAuth(app);
      auth.languageCode = 'es';
      db = fsMod.getFirestore(app);
      enabled = true;
      return true;
    } catch (e) {
      console.error('No se pudo iniciar Firebase, se jugará sin cuenta.', e);
      enabled = false;
      return false;
    }
  })();
  return ready;
}

const ERRORS = {
  'auth/invalid-email': 'Ese correo no es válido.',
  'auth/user-disabled': 'Esta cuenta está deshabilitada.',
  'auth/user-not-found': 'Correo o contraseña incorrectos.',
  'auth/wrong-password': 'Correo o contraseña incorrectos.',
  'auth/invalid-credential': 'Correo o contraseña incorrectos.',
  'auth/missing-password': 'Escribe una contraseña.',
  'auth/email-already-in-use': 'Ya hay una cuenta con ese correo.',
  'auth/weak-password': 'La contraseña debe tener al menos 6 caracteres.',
  'auth/too-many-requests': 'Demasiados intentos. Espera un poco e inténtalo de nuevo.',
  'auth/network-request-failed': 'Sin conexión. Comprueba tu internet.',
};

function friendlyError(e) {
  return ERRORS[e?.code] || 'Ha ocurrido un error. Inténtalo de nuevo.';
}

// Vuelve al juego tras pulsar el enlace del correo de recuperación.
const CONTINUE_URL = location.origin + location.pathname;

export async function onAuthChange(cb) {
  const ok = await init();
  if (!ok) { cb(null); return () => {}; }
  return authMod.onAuthStateChanged(auth, cb);
}

export function currentUser() {
  return auth?.currentUser || null;
}

const NOT_READY = { error: 'No se pudo conectar con el servicio de cuentas. Puedes jugar sin cuenta.' };

export async function signUp(email, password) {
  if (!(await init())) return NOT_READY;
  try {
    const cred = await authMod.createUserWithEmailAndPassword(auth, email, password);
    await authMod.sendEmailVerification(cred.user, { url: CONTINUE_URL });
    return { user: cred.user };
  } catch (e) { return { error: friendlyError(e) }; }
}

export async function signIn(email, password) {
  if (!(await init())) return NOT_READY;
  try {
    const cred = await authMod.signInWithEmailAndPassword(auth, email, password);
    return { user: cred.user };
  } catch (e) { return { error: friendlyError(e) }; }
}

export async function signOutUser() {
  if (!enabled) return;
  await authMod.signOut(auth);
}

export async function resetPassword(email) {
  if (!(await init())) return NOT_READY;
  try {
    await authMod.sendPasswordResetEmail(auth, email, { url: CONTINUE_URL });
    return { ok: true };
  } catch (e) { return { error: friendlyError(e) }; }
}

export async function resendVerification() {
  if (!auth?.currentUser) return { error: 'No hay sesión iniciada.' };
  try {
    await authMod.sendEmailVerification(auth.currentUser, { url: CONTINUE_URL });
    return { ok: true };
  } catch (e) { return { error: friendlyError(e) }; }
}

// ---- Guardado en la nube ----

export async function loadCloudSave(uid) {
  if (!enabled) return null;
  try {
    const snap = await fsMod.getDoc(fsMod.doc(db, 'saves', uid));
    if (!snap.exists()) return null;
    const d = snap.data();
    return { state: JSON.parse(d.data), updatedAtMs: d.updatedAtMs || 0 };
  } catch (e) {
    console.error('No se pudo leer la partida en la nube', e);
    return null;
  }
}

export async function saveCloudSave(uid, state) {
  if (!enabled) return null;
  const updatedAtMs = Date.now();
  try {
    await fsMod.setDoc(fsMod.doc(db, 'saves', uid), {
      data: JSON.stringify(state),
      updatedAtMs,
      updatedAt: fsMod.serverTimestamp(),
    });
    return updatedAtMs;
  } catch (e) {
    console.error('No se pudo guardar la partida en la nube', e);
    return null;
  }
}

export async function peekCloudUpdatedAt(uid) {
  if (!enabled) return 0;
  try {
    const snap = await fsMod.getDoc(fsMod.doc(db, 'saves', uid));
    return snap.exists() ? (snap.data().updatedAtMs || 0) : 0;
  } catch (e) { return 0; }
}
