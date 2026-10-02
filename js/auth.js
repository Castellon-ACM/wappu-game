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
      // Persistencia explícita en el almacenamiento del navegador: la sesión sobrevive
      // a cerrar la pestaña o el navegador (getAuth la elige solo y en algunos
      // navegadores se quedaba en memoria).
      try {
        auth = authMod.initializeAuth(app, {
          persistence: [authMod.indexedDBLocalPersistence, authMod.browserLocalPersistence, authMod.browserSessionPersistence],
        });
      } catch (e) {
        auth = authMod.getAuth(app);
      }
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

// ---- Duración de la sesión ----
// "Mantener la sesión iniciada" guarda la sesión 30 días desde la última vez que se abre el juego.
// Sin marcarla, la sesión termina al cerrar la pestaña.
const SESSION_DAYS = 30;
const SESSION_KEY = 'wapuu-session';

function readSession() {
  try { return JSON.parse(localStorage.getItem(SESSION_KEY)); } catch (e) { return null; }
}
function touchSession(uid) {
  try { localStorage.setItem(SESSION_KEY, JSON.stringify({ uid, until: Date.now() + SESSION_DAYS * 86400000 })); } catch (e) {}
}
function clearSession() {
  try { localStorage.removeItem(SESSION_KEY); } catch (e) {}
}
function wantsRemember() {
  const box = document.getElementById('auth-remember');
  return box ? box.checked : true;
}
async function applyRemember() {
  const remember = wantsRemember();
  await authMod.setPersistence(auth, remember ? authMod.indexedDBLocalPersistence : authMod.browserSessionPersistence);
  return remember;
}

// Vuelve al juego tras pulsar el enlace del correo de recuperación.
const CONTINUE_URL = location.origin + location.pathname;

export async function onAuthChange(cb) {
  const ok = await init();
  if (!ok) { cb(null); return () => {}; }
  return authMod.onAuthStateChanged(auth, async (user) => {
    if (user) {
      const sess = readSession();
      if (sess && sess.uid === user.uid && sess.until < Date.now()) {
        // han pasado más de 30 días sin abrir el juego: se pide entrar otra vez
        clearSession();
        await authMod.signOut(auth);
        return;   // onAuthStateChanged volverá a llamar con null
      }
      // sesión recordada: se renueva el plazo cada vez que se abre el juego
      if (!sess || sess.uid === user.uid) touchSession(user.uid);
    }
    cb(user);
  });
}

export function currentUser() {
  return auth?.currentUser || null;
}

const NOT_READY = { error: 'No se pudo conectar con el servicio de cuentas. Puedes jugar sin cuenta.' };

export async function signUp(email, password) {
  if (!(await init())) return NOT_READY;
  try {
    if (await applyRemember()) touchSession(null); else clearSession();
    const cred = await authMod.createUserWithEmailAndPassword(auth, email, password);
    if (wantsRemember()) touchSession(cred.user.uid);
    // la cuenta ya está creada: si el correo de verificación falla, no se trata como error
    sendVerification(cred.user).catch((e) => console.warn('No se pudo enviar la verificación', e));
    return { user: cred.user };
  } catch (e) { return { error: friendlyError(e) }; }
}

export async function signIn(email, password) {
  if (!(await init())) return NOT_READY;
  try {
    if (await applyRemember()) touchSession(null); else clearSession();
    const cred = await authMod.signInWithEmailAndPassword(auth, email, password);
    if (wantsRemember()) touchSession(cred.user.uid);
    return { user: cred.user };
  } catch (e) { return { error: friendlyError(e) }; }
}

export async function signOutUser() {
  if (!enabled) return;
  clearSession();
  await authMod.signOut(auth);
}

export async function resetPassword(email) {
  if (!(await init())) return NOT_READY;
  try {
    await authMod.sendPasswordResetEmail(auth, email, { url: CONTINUE_URL });
    return { ok: true };
  } catch (e) { return { error: friendlyError(e) }; }
}

// Con enlace de vuelta al juego; si Firebase no acepta esa dirección, se envía sin él.
async function sendVerification(user) {
  try { await authMod.sendEmailVerification(user, { url: CONTINUE_URL }); }
  catch (e) {
    if (e?.code === 'auth/unauthorized-continue-uri' || e?.code === 'auth/invalid-continue-uri') await authMod.sendEmailVerification(user);
    else throw e;
  }
}

export async function resendVerification() {
  if (!auth?.currentUser) return { error: 'No hay sesión iniciada.' };
  try {
    await sendVerification(auth.currentUser);
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

// ---- Acceso a Firestore para otros módulos (el ranking) ----
export async function firestore() {
  await init();
  return enabled ? { fs: fsMod, db } : null;
}
