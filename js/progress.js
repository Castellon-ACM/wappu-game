// Misiones diarias y pase de batalla infinito.
// Todo vive dentro del estado de la partida (state.daily y state.pass), así que
// se guarda en localStorage y en la nube igual que el resto.

// ---------------- misiones diarias ----------------

// Cada misión tiene un objetivo por dificultad: [fácil, media, difícil].
// null = esa misión no sale en esa dificultad.
export const MISSIONS = [
  { id: 'pet',    event: 'pet',    emo: '🤗', targets: [8, 15, 25],  text: (n) => `Dale ${n} mimos` },
  { id: 'eat',    event: 'eat',    emo: '🍽️', targets: [2, 4, 6],    text: (n) => `Dale de comer ${n} veces` },
  { id: 'commit', event: 'commit', emo: '📦', targets: [4, 10, 18],  text: (n) => `Haz ${n} commits en el despacho` },
  { id: 'bug',    event: 'bug',    emo: '🐛', targets: [3, 7, 12],   text: (n) => `Aplasta ${n} bugs` },
  { id: 'ball',   event: 'ball',   emo: '⚽', targets: [2, 4, 7],    text: (n) => `Juega a la pelota ${n} veces` },
  { id: 'dance',  event: 'dance',  emo: '💃', targets: [2, 4, 6],    text: (n) => `Baila ${n} veces` },
  { id: 'shower', event: 'shower', emo: '🚿', targets: [1, 2, 3],    text: (n) => n === 1 ? 'Dale una ducha' : `Dale ${n} duchas` },
  { id: 'toilet', event: 'toilet', emo: '🚽', targets: [1, 2, 3],    text: (n) => n === 1 ? 'Llévale al váter' : `Llévale al váter ${n} veces` },
  { id: 'scrub',  event: 'scrub',  emo: '🧼', targets: [20, 40, 70], text: (n) => `Frótale con jabón (${n} pasadas)` },
  { id: 'sleep',  event: 'sleep',  emo: '🛏️', targets: [1, 1, null], text: () => 'Déjale dormir hasta que se despierte solo' },
  { id: 'spend',  event: 'spend',  emo: '🛒', targets: [15, 35, 70], text: (n) => `Gasta ${n} monedas` },
  { id: 'earn',   event: 'earn',   emo: '🪙', targets: [15, 40, 80], text: (n) => `Gana ${n} monedas programando` },
  { id: 'happy',  event: 'happy',  emo: '😊', targets: [3, 8, 15],   text: (n, name) => `Mantén a ${name} contento ${n} min` },
];

export const DIFFS = [
  { id: 'easy',   name: 'Fácil',   xp: 30, coins: 5 },
  { id: 'medium', name: 'Media',   xp: 50, coins: 10 },
  { id: 'hard',   name: 'Difícil', xp: 80, coins: 15 },
];
export const DAILY_BONUS = { xp: 100, coins: 20 };

// Búsqueda en vivo: otros módulos (como los minijuegos) pueden añadir misiones a MISSIONS al cargar.
const byId = new Proxy({}, { get: (_, id) => MISSIONS.find(m => m.id === id) });

// Fecha local en formato AAAA-MM-DD: las misiones cambian a medianoche.
export function todayKey(d = new Date()) {
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export function msToReset(d = new Date()) {
  const next = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1);
  return next - d;
}

// Generador pseudoaleatorio con semilla: el mismo día da las mismas misiones a la misma partida.
function seeded(str) {
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i++) { h = Math.imul(h ^ str.charCodeAt(i), 3432918353); h = (h << 13) | (h >>> 19); }
  let a = h >>> 0;
  return () => {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function rollMissions(day, salt) {
  const rnd = seeded(`${day}:${salt}`);
  const used = new Set();
  return DIFFS.map((diff, di) => {
    const pool = MISSIONS.filter(m => m.targets[di] != null && !used.has(m.id));
    const m = pool[Math.floor(rnd() * pool.length)];
    used.add(m.id);
    return { id: m.id, diff: di, target: m.targets[di], progress: 0, claimed: false };
  });
}

// Crea las misiones del día si no existen o si ha cambiado el día. Devuelve true si son nuevas.
export function ensureDaily(s) {
  const day = todayKey();
  const ok = s.daily && s.daily.day === day && Array.isArray(s.daily.list) && s.daily.list.every(q => byId[q.id]);
  if (ok) return false;
  s.daily = { day, list: rollMissions(day, s.createdAt || 0), bonus: false };
  return true;
}

export function missionInfo(q, name = 'Wapuu') {
  const m = byId[q.id];
  const diff = DIFFS[q.diff];
  const done = q.progress >= q.target;
  return {
    emo: m.emo,
    text: m.text(q.target, name),
    progress: Math.min(q.target, Math.floor(q.progress)),
    target: q.target,
    done,
    claimed: q.claimed,
    diff,
  };
}

// Suma progreso a las misiones que escuchan ese evento. Devuelve las que se acaban de completar.
export function track(s, event, amount = 1) {
  if (!s.daily) return [];
  const completed = [];
  for (const q of s.daily.list) {
    if (q.claimed || byId[q.id].event !== event) continue;
    const wasDone = q.progress >= q.target;
    q.progress = Math.min(q.target, q.progress + amount);
    if (!wasDone && q.progress >= q.target) completed.push(q);
  }
  return completed;
}

export function claimMission(s, index) {
  const q = s.daily?.list[index];
  if (!q || q.claimed || q.progress < q.target) return null;
  q.claimed = true;
  const d = DIFFS[q.diff];
  return { xp: d.xp, coins: d.coins };
}

export const allMissionsDone = (s) => !!s.daily && s.daily.list.every(q => q.claimed);

export function claimBonus(s) {
  if (!allMissionsDone(s) || s.daily.bonus) return null;
  s.daily.bonus = true;
  return { ...DAILY_BONUS };
}

// ---------------- pase de batalla ----------------

// XP que pide el nivel t del pase (t empieza en 1). Crece más rápido que lineal:
// los primeros niveles salen enseguida y cada nivel cuesta un poco más que el anterior.
//   1 → 40, 2 → 60, 3 → 90, 5 → 160, 10 → 390, 20 → 960, 50 → 3190, 100 → 7900…
export function passNeed(t) {
  const raw = 40 + 20 * Math.pow(Math.max(0, t - 1), 1.3);
  return Math.round(raw / 5) * 5;
}

// Cosméticos exclusivos del pase. Solo se consiguen así; no se pueden comprar.
export const PASS_COSMETICS = {
  5:  'star',
  10: 'monocle',
  20: 'halo',
  30: 'wizard',
  50: 'goldglasses',
};

function baseCoins(t) { return Math.min(45, 8 + Math.floor(t * 1.5)); }

// Recompensa del nivel t. El pase no tiene fin: se genera sobre la marcha.
export function rewardFor(t) {
  if (PASS_COSMETICS[t]) return { type: 'cosmetic', id: PASS_COSMETICS[t] };
  if (t % 10 === 0) return { type: 'chest', coins: baseCoins(t) * 3, emo: '💰', label: `Cofre: ${baseCoins(t) * 3} 🪙` };
  if (t % 5 === 0) return { type: 'snack', coins: baseCoins(t), emo: '🎁', label: `Merienda + ${baseCoins(t)} 🪙` };
  return { type: 'coins', coins: baseCoins(t), emo: '🪙', label: `${baseCoins(t)} monedas` };
}

export function ensurePass(s) {
  const p = s.pass;
  if (!p || typeof p !== 'object' || !Number.isFinite(p.tier)) {
    s.pass = { tier: 0, xp: 0, claimed: 0 };
    return;
  }
  p.tier = Math.max(0, Math.floor(p.tier));
  p.xp = Math.max(0, +p.xp || 0);
  p.claimed = Math.max(0, Math.min(p.tier, Math.floor(+p.claimed || 0)));
}

// Suma XP al pase. Devuelve cuántos niveles se han subido.
export function addPassXp(s, amount) {
  ensurePass(s);
  const p = s.pass;
  p.xp += amount;
  let up = 0;
  while (p.xp >= passNeed(p.tier + 1)) {
    p.xp -= passNeed(p.tier + 1);
    p.tier += 1;
    up += 1;
  }
  return up;
}

export const passPending = (s) => (s.pass ? s.pass.tier - s.pass.claimed : 0);

// Reclama las recompensas pendientes, en orden, hasta el nivel `upTo` (por defecto, todas).
export function claimPass(s, upTo = Infinity) {
  ensurePass(s);
  const out = [];
  const last = Math.min(s.pass.tier, upTo);
  while (s.pass.claimed < last) {
    s.pass.claimed += 1;
    out.push({ tier: s.pass.claimed, ...rewardFor(s.pass.claimed) });
  }
  return out;
}

// Cosas que se pueden reclamar ahora mismo (para el globito del botón).
export function claimableCount(s) {
  let n = passPending(s);
  if (s.daily) {
    n += s.daily.list.filter(q => !q.claimed && q.progress >= q.target).length;
    if (allMissionsDone(s) && !s.daily.bonus) n += 1;
  }
  return n;
}

export function ensureProgress(s) {
  ensurePass(s);
  return ensureDaily(s);
}
