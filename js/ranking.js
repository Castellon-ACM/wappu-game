// Ranking mundial: nivel de Wapuu y récords de los minijuegos de todos los jugadores con cuenta.
// Cada persona tiene un documento público ranking/{uid} con el nombre de su Wapuu, un emoji, su nivel
// y sus récords; solo puede escribir el suyo (ver firestore.rules). Nada de correos ni datos personales.
import * as Auth from './auth.js';
import { COSMETICS } from './state.js';

const COL = 'ranking';
const TOP = 50;
const nf = new Intl.NumberFormat('es-ES');

export const BOARDS = [
  { id: 'level', emo: '🐾', name: 'Nivel', field: 'lvlScore', value: (d) => `Nv. ${d.level}`, sub: 'Los Wapuus con más nivel' },
  { id: 'lasso', emo: '🫧', name: 'Lazo', field: 'lasso', value: (d) => nf.format(d.lasso), sub: 'Récords de Lazo de pompas' },
  { id: 'rhythm', emo: '🎹', name: 'Ritmo', field: 'rhythm', value: (d) => nf.format(d.rhythm), sub: 'Récords de Ritmo de commits' },
  { id: 'plugins', emo: '🔌', name: 'Plugins', field: 'plugins', value: (d) => nf.format(d.plugins), sub: 'Récords de Enchufa plugins' },
];
const byId = Object.fromEntries(BOARDS.map(b => [b.id, b]));

let hooks = null;
let sheet = null;
let tab = 'level';
let lastMajor = '', lastSentAt = 0, lastSentScore = -1, sending = false;
const cache = {};          // tablero -> { at, rows }

// ---------------- lo que se publica ----------------
function entry(s) {
  const head = s.equipped?.head && COSMETICS.find(c => c.id === s.equipped.head);
  const g = s.games || {};
  const level = Math.max(1, Math.min(1000, Math.floor(s.level || 1)));
  return {
    name: String(s.name || 'Wapuu').trim().slice(0, 16) || 'Wapuu',
    emo: head ? head.emo : '🐾',
    level,
    lvlScore: level * 1000000 + Math.max(0, Math.min(999999, Math.floor(s.xp || 0))),
    lasso: Math.floor(g.lasso?.best || 0),
    rhythm: Math.floor(g.rhythm?.best || 0),
    plugins: Math.floor(g.plugins?.best || 0),
  };
}

// Publica la entrada si ha cambiado algo importante (nombre, nivel, récords) o, solo por la
// experiencia, como mucho cada dos minutos. Devuelve true si la entrada está al día en la nube.
export async function sync(force = false) {
  const user = Auth.currentUser();
  if (!user || !hooks || sending) return false;
  const e = entry(hooks.getState());
  const { lvlScore, ...major } = e;
  const key = JSON.stringify(major);
  const majorChanged = key !== lastMajor;
  const xpOnly = !majorChanged && lvlScore !== lastSentScore;
  if (!force && !majorChanged && (!xpOnly || Date.now() - lastSentAt < 120000)) return true;
  const h = await Auth.firestore();
  if (!h) return false;
  sending = true;
  try {
    await h.fs.setDoc(h.fs.doc(h.db, COL, user.uid), { ...e, updatedAt: h.fs.serverTimestamp() });
    lastMajor = key; lastSentAt = Date.now(); lastSentScore = lvlScore;
    for (const k of Object.keys(cache)) delete cache[k];
    return true;
  } catch (err) {
    console.warn('No se pudo publicar en el ranking', err);
    return false;
  } finally {
    sending = false;
  }
}

// ---------------- lectura ----------------
async function top(board) {
  const c = cache[board.id];
  if (c && Date.now() - c.at < 30000) return c.rows;
  const h = await Auth.firestore();
  if (!h) throw new Error('sin-firebase');
  const { fs, db } = h;
  const snap = await fs.getDocs(fs.query(fs.collection(db, COL), fs.orderBy(board.field, 'desc'), fs.limit(TOP)));
  const rows = [];
  snap.forEach(d => { const v = d.data(); if (board.id === 'level' || v[board.field] > 0) rows.push({ uid: d.id, ...v }); });
  cache[board.id] = { at: Date.now(), rows };
  return rows;
}

// Puesto que tendría un valor en un tablero (los que tienen más, más uno).
async function placeOf(board, value) {
  const h = await Auth.firestore();
  if (!h || !(value > 0)) return null;
  const { fs, db } = h;
  const q = fs.query(fs.collection(db, COL), fs.where(board.field, '>', value));
  const agg = await fs.getCountFromServer(q);
  return agg.data().count + 1;
}

// Para la pantalla final de un minijuego: «puesto #N en el mundo».
export async function positionFor(gameId, score) {
  try {
    if (!(score > 0)) return null;
    await sync();
    return await placeOf(byId[gameId], score);
  } catch (e) { return null; }
}

// ---------------- hoja del ranking ----------------
function build() {
  sheet = document.createElement('dialog');
  sheet.id = 'ranking';
  sheet.setAttribute('aria-labelledby', 'ranking-title');
  sheet.innerHTML = `
    <div class="shop-head">
      <h2 id="ranking-title">🏆 Ranking mundial</h2>
      <button id="ranking-close" class="icon-btn" aria-label="Cerrar el ranking">✕</button>
    </div>
    <div class="shop-tabs scroll" role="tablist" id="ranking-tabs"></div>
    <p class="rk-sub" id="ranking-sub"></p>
    <ol class="rk-list" id="ranking-list"></ol>
    <div class="rk-me" id="ranking-me"></div>`;
  document.body.append(sheet);
  sheet.querySelector('#ranking-close').addEventListener('click', () => sheet.close());
  const tabs = sheet.querySelector('#ranking-tabs');
  for (const b of BOARDS) {
    const t = document.createElement('button');
    t.type = 'button'; t.dataset.board = b.id; t.setAttribute('role', 'tab');
    t.textContent = `${b.emo} ${b.name}`;
    t.addEventListener('click', () => { hooks.sfx.tap(); tab = b.id; render(); });
    tabs.append(t);
  }
}

function row(pos, d, mine, board) {
  const li = document.createElement('li');
  li.className = 'rk-row' + (mine ? ' mine' : '') + (pos <= 3 ? ` top${pos}` : '');
  const p = document.createElement('span'); p.className = 'rk-pos'; p.textContent = ['🥇', '🥈', '🥉'][pos - 1] || `#${pos}`;
  const e = document.createElement('span'); e.className = 'rk-emo'; e.textContent = d.emo || '🐾'; e.setAttribute('aria-hidden', 'true');
  const n = document.createElement('span'); n.className = 'rk-name';
  n.textContent = d.name || 'Wapuu';
  if (mine) { const y = document.createElement('small'); y.textContent = ' · tú'; n.append(y); }
  if (board.id !== 'level') { const l = document.createElement('small'); l.className = 'rk-lvl'; l.textContent = `Nv. ${d.level}`; n.append(l); }
  const v = document.createElement('span'); v.className = 'rk-val'; v.textContent = board.value(d);
  li.append(p, e, n, v);
  return li;
}

async function render() {
  const board = byId[tab];
  sheet.querySelectorAll('#ranking-tabs [data-board]').forEach(t => t.setAttribute('aria-selected', t.dataset.board === tab ? 'true' : 'false'));
  sheet.querySelector('#ranking-sub').textContent = board.sub;
  const list = sheet.querySelector('#ranking-list');
  const me = sheet.querySelector('#ranking-me');
  list.innerHTML = '<li class="rk-msg">Cargando…</li>';
  me.innerHTML = '';
  const user = Auth.currentUser();
  const mine = entry(hooks.getState());
  try {
    if (user) await sync();
    const rows = await top(board);
    if (tab !== board.id) return;
    list.innerHTML = '';
    if (!rows.length) list.innerHTML = '<li class="rk-msg">Todavía no hay nadie. ¡Sé el primero!</li>';
    rows.forEach((d, i) => list.append(row(i + 1, d, user && d.uid === user.uid, board)));
    // tu puesto
    if (!user) {
      me.innerHTML = '<p>Para salir en el ranking necesitas una cuenta (así se sabe de quién es cada récord).</p>';
      const b = document.createElement('button');
      b.className = 'claim'; b.textContent = 'Crear cuenta o entrar';
      b.addEventListener('click', () => location.reload());
      me.append(b);
    } else if (!rows.some(d => d.uid === user.uid)) {
      const val = mine[board.field];
      if (board.id !== 'level' && !(val > 0)) {
        me.innerHTML = '<p>Juega una partida para entrar en este ranking.</p>';
      } else {
        const pos = await placeOf(board, val);
        if (tab !== board.id) return;
        me.innerHTML = '';
        if (pos) { const ol = document.createElement('ol'); ol.className = 'rk-list'; ol.append(row(pos, mine, true, board)); me.append(ol); }
      }
    } else {
      me.innerHTML = '<p>¡Estás en el top 50! 🎉</p>';
    }
  } catch (err) {
    console.warn('No se pudo cargar el ranking', err);
    list.innerHTML = '<li class="rk-msg">El ranking no está disponible ahora mismo. Comprueba tu conexión e inténtalo luego.</li>';
  }
}

export function openRanking(board = 'level') {
  if (!sheet) build();
  tab = byId[board] ? board : 'level';
  sheet.style.bottom = `${document.getElementById('rooms').getBoundingClientRect().height}px`;
  sheet.show();
  render();
}
export function closeRanking() { if (sheet?.open) sheet.close(); }

export function initRanking(h) {
  hooks = h;
  // el nivel y la experiencia cambian jugando: se publican solos de vez en cuando
  setInterval(() => { if (!document.hidden) sync(); }, 60000);
  document.addEventListener('visibilitychange', () => { if (document.hidden) sync(); });
  setTimeout(() => sync(true), 4000);
}
