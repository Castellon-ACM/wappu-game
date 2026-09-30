// Estado del juego, reglas de las necesidades y guardado en localStorage.

const KEY = 'wapuu-game-v1';
const MAX_OFFLINE_MS = 12 * 60 * 60 * 1000; // como mucho 12 h de desgaste fuera del juego

export const STATS = ['food', 'energy', 'fun', 'bladder', 'hygiene'];

// Puntos por minuto. Negativo = baja.
const RATES = {
  awake:    { food: -1.6, energy: -1.0, fun: -1.4, bladder: -1.8, hygiene: -0.8 },
  sleeping: { food: -0.6, energy: +6.0, fun: -0.2, bladder: -0.7, hygiene: -0.2 },
  coding:   { food: -2.6, energy: -3.2, fun: -1.0, bladder: -2.2, hygiene: -1.0 },
};

export const LEVEL_TITLES = [
  'Becario del plugin',
  'Junior de functions.php',
  'Cazador de hooks',
  'Maestro de bloques',
  'Mago de la REST API',
  'Contribuidor del core',
  'Leyenda del WordCamp',
];

export const FOODS = [
  { id: 'cookie',  emo: '🍪', name: 'Cookie',  price: 3,  effects: { food: 8,  fun: 6 },               say: '¡Acepto todas las cookies!' },
  { id: 'apple',   emo: '🍎', name: 'Manzana', price: 4,  effects: { food: 14, hygiene: 3 },           say: 'Crujiente y sana.' },
  { id: 'coffee',  emo: '☕', name: 'Café',    price: 5,  effects: { food: 6,  energy: 18, bladder: -10 }, say: 'Café = código.' },
  { id: 'water',   emo: '🥤', name: 'Agua',    price: 2,  effects: { food: 4,  bladder: -14, hygiene: 2 }, say: 'Hidratación nivel pro.' },
  { id: 'pizza',   emo: '🍕', name: 'Pizza',   price: 10, effects: { food: 32, fun: 6, hygiene: -4 },  say: 'Pizza de deploy.' },
  { id: 'tortilla',emo: '🥚', name: 'Tortilla',price: 12, effects: { food: 38, energy: 4 },            say: 'Con cebolla, por supuesto.' },
  { id: 'paella',  emo: '🥘', name: 'Paella',  price: 18, effects: { food: 55, fun: 10 },              say: '¡Esto es un WordCamp!' },
];

const clamp = (v, a = 0, b = 100) => Math.max(a, Math.min(b, v));

function fresh() {
  return {
    name: 'Wapuu',
    stats: { food: 75, energy: 80, fun: 70, bladder: 70, hygiene: 85 },
    coins: 25,
    xp: 0,
    level: 1,
    commits: 0,
    bugs: 0,
    mode: 'idle',      // idle | sleeping | coding
    room: 'salon',
    soap: 0,           // espuma acumulada en el baño
    lastTick: Date.now(),
    createdAt: Date.now(),
  };
}

export function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const s = { ...fresh(), ...JSON.parse(raw) };
      s.stats = { ...fresh().stats, ...s.stats };
      return s;
    }
  } catch (e) { /* storage no disponible */ }
  return fresh();
}

export function save(s) {
  try { localStorage.setItem(KEY, JSON.stringify(s)); } catch (e) { /* sin guardado */ }
}

export function reset() {
  try { localStorage.removeItem(KEY); } catch (e) {}
  return fresh();
}

// Aplica el paso del tiempo. Devuelve un resumen si hubo mucho rato fuera.
export function catchUp(s) {
  const now = Date.now();
  const gap = Math.min(now - (s.lastTick || now), MAX_OFFLINE_MS);
  s.lastTick = now;
  if (gap < 60_000) return null;
  const before = { ...s.stats };
  // Programar no sigue fuera del juego: se queda idle.
  if (s.mode === 'coding') s.mode = 'idle';
  applyRates(s, gap / 60000, { floor: 5 });
  if (s.mode === 'sleeping' && s.stats.energy >= 100) s.mode = 'idle';
  return { minutes: Math.round(gap / 60000), before, after: { ...s.stats } };
}

export function tick(s, dtMs) {
  s.lastTick = Date.now();
  applyRates(s, dtMs / 60000);
}

function applyRates(s, minutes, { floor = 0 } = {}) {
  const r = RATES[s.mode] || RATES.awake;
  const mode = s.mode === 'idle' ? RATES.awake : r;
  for (const k of STATS) {
    let v = s.stats[k] + mode[k] * minutes;
    // Estar sucio o con ganas de ir al baño baja el ánimo
    s.stats[k] = clamp(v, Math.min(floor, s.stats[k]));
  }
  if (s.stats.hygiene < 25 || s.stats.bladder < 15 || s.stats.food < 15) {
    s.stats.fun = clamp(s.stats.fun - 1.2 * minutes);
  }
}

export function apply(s, effects) {
  for (const [k, v] of Object.entries(effects)) {
    if (k in s.stats) s.stats[k] = clamp(s.stats[k] + v);
  }
}

export function xpNeeded(level) { return 40 + level * 30; }

// Suma experiencia. Devuelve true si sube de nivel.
export function addXp(s, amount) {
  s.xp += amount;
  let up = false;
  while (s.xp >= xpNeeded(s.level)) {
    s.xp -= xpNeeded(s.level);
    s.level += 1;
    s.coins += 10 * s.level;
    up = true;
  }
  return up;
}

export function title(level) {
  return LEVEL_TITLES[Math.min(level - 1, LEVEL_TITLES.length - 1)];
}

export function mood(s) {
  const { food, energy, fun, bladder, hygiene } = s.stats;
  const avg = (food + energy + fun + bladder + hygiene) / 5;
  const min = Math.min(food, energy, fun, bladder, hygiene);
  if (min < 12 || avg < 30) return 'sad';
  if (avg > 70 && min > 40) return 'happy';
  return 'ok';
}

// La necesidad más urgente, para que Wapuu se queje.
export function complaint(s) {
  const lines = {
    food: ['Tengo hambre…', '¿Hay pizza en la cocina?', 'Mi tripa hace 404.'],
    energy: ['Tengo sueño…', 'Necesito una siesta.', 'Me quedo sin batería.'],
    fun: ['Me aburro…', '¿Jugamos un rato?', 'Necesito mimos.'],
    bladder: ['¡Necesito ir al baño!', '¡Corre, al váter!', 'Esto urge…'],
    hygiene: ['Huelo a código legacy.', 'Necesito un baño.', 'Estoy pegajoso…'],
  };
  let worst = null, v = 101;
  for (const k of STATS) if (s.stats[k] < v) { v = s.stats[k]; worst = k; }
  if (v > 35) return null;
  const opts = lines[worst];
  return opts[Math.floor(Math.random() * opts.length)];
}
