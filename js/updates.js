// Mantiene el juego al día sin que nadie tenga que borrar la caché:
// 1) registra sw.js, que pide siempre al servidor la versión más reciente de cada archivo;
// 2) al volver a la app (o tras un rato sin tocarla) comprueba si se ha publicado algo nuevo
//    y, si es así, recarga. La partida se guarda sola al recargar (evento pagehide).

// Archivos que se vigilan. Si se añade un módulo nuevo, basta con que cambie main.js para detectarlo.
const FILES = [
  'index.html', 'sw.js',
  'css/style.css', 'css/progress.css', 'css/wardrobe.css', 'css/kitchen.css', 'css/minigames.css',
  'js/main.js', 'js/world.js', 'js/state.js', 'js/audio.js', 'js/auth.js',
  'js/progress.js', 'js/pass-cosmetics.js', 'js/wardrobe.js', 'js/kitchen.js',
  'js/minigames.js', 'js/ranking.js', 'js/mg-lasso.js', 'js/mg-rhythm.js', 'js/mg-plugins.js', 'js/updates.js',
];
const SKIP_KEY = 'wapuu-update-reload';
const CHECK_EVERY_MS = 5 * 60 * 1000;
const IDLE_MS = 2 * 60 * 1000;

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('sw.js', { updateViaCache: 'none' }).catch(() => {});
}

// Tras una recarga por actualización: si sale la pantalla de acceso (era una partida sin cuenta),
// se pulsa sola «Jugar sin cuenta» para volver directamente al juego.
let skip = false;
try { skip = sessionStorage.getItem(SKIP_KEY) === '1'; sessionStorage.removeItem(SKIP_KEY); } catch (e) {}
if (skip) {
  const screen = document.getElementById('auth-screen');
  const tryskip = () => {
    if (screen && !screen.hidden) { document.getElementById('auth-skip')?.click(); obs.disconnect(); }
  };
  const obs = new MutationObserver(tryskip);
  if (screen) obs.observe(screen, { attributes: true, attributeFilter: ['hidden'] });
  setTimeout(() => obs.disconnect(), 20000);
}

async function signature() {
  try {
    const parts = await Promise.all(FILES.map(async (f) => {
      const r = await fetch(f, { method: 'HEAD', cache: 'no-store' });
      return `${f}:${r.headers.get('etag') || r.headers.get('last-modified') || r.status}`;
    }));
    return parts.join('|');
  } catch (e) {
    return null;   // sin conexión: no se puede comprobar
  }
}

let current = null;
let checking = false;
let lastTouch = Date.now();
addEventListener('pointerdown', () => { lastTouch = Date.now(); }, { passive: true });

async function check() {
  if (checking) return;
  checking = true;
  try {
    const sig = await signature();
    if (!sig) return;
    if (current === null) { current = sig; return; }
    if (sig !== current) {
      navigator.serviceWorker?.getRegistration().then(r => r?.update()).catch(() => {});
      // si se estaba jugando sin cuenta, que la pantalla de acceso no aparezca tras recargar
      const guest = document.getElementById('auth-screen')?.hidden && !document.getElementById('loader');
      try { if (guest) sessionStorage.setItem(SKIP_KEY, '1'); } catch (e) {}
      location.reload();
    }
  } finally {
    checking = false;
  }
}

check();
document.addEventListener('visibilitychange', () => { if (!document.hidden) check(); });
addEventListener('pageshow', (e) => { if (e.persisted) check(); });   // vuelta desde la caché de atrás/adelante
setInterval(() => {
  if (!document.hidden && Date.now() - lastTouch > IDLE_MS) check();
}, CHECK_EVERY_MS);
