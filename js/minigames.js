// Sala de minijuegos: lista de juegos, pantalla de juego a pantalla completa, cuenta atrás, pausa,
// récords, medallas y premios. Cada juego vive en su propio módulo (mg-*.js) y solo se ocupa de su lógica.
//
// Un juego es un objeto { id, emo, name, desc, how, color, medals: [bronce, plata, oro], coinsPer, coinsCap, create(api) }.
// create(api) devuelve { update(dt), draw(ctx, w, h), pointer(type, x, y, id), score, over, extra?(), pause?(), resume?(), destroy?() }.
import { MISSIONS } from './progress.js';
import lasso from './mg-lasso.js';
import rhythm from './mg-rhythm.js';
import plugins from './mg-plugins.js';

export const GAMES = [lasso, rhythm, plugins];
const MEDALS = ['🥉', '🥈', '🥇'];
const MEDAL_BONUS = [20, 40, 80];
export const ENERGY_COST = 6;

// misión diaria nueva
MISSIONS.push({ id: 'play', event: 'play', emo: '🎮', targets: [1, 3, 5], text: (n) => n === 1 ? 'Juega un minijuego' : `Juega ${n} minijuegos` });

let hooks = null;
let sheet, overlay, canvas, ctx, topScore, topExtra, card;
let current = null;      // { game, inst, phase: 'count'|'play'|'pause'|'over', t }
let raf = 0, last = 0;
const fx = [];           // partículas y textos flotantes compartidos por todos los juegos
let shakeT = 0;

function stats(id) {
  const s = hooks.getState();
  s.games ||= {};
  s.games[id] ||= { best: 0, plays: 0, medals: 0 };
  return s.games[id];
}

// ---------------- sala ----------------
function buildSheet() {
  sheet = document.createElement('dialog');
  sheet.id = 'games';
  sheet.setAttribute('aria-labelledby', 'games-title');
  sheet.innerHTML = `
    <div class="shop-head">
      <h2 id="games-title">Minijuegos</h2>
      <div class="coins"><span aria-hidden="true">🪙</span> <strong id="games-coins">0</strong></div>
      <button id="games-close" class="icon-btn" aria-label="Cerrar minijuegos">✕</button>
    </div>
    <div id="games-list"></div>
    <p class="games-note">Cada partida cuesta ⚡${ENERGY_COST} de energía y sube el ánimo. Las monedas y la experiencia dependen de tu puntuación.</p>`;
  document.body.append(sheet);
  sheet.querySelector('#games-close').addEventListener('click', () => sheet.close());
}

function renderSheet() {
  sheet.querySelector('#games-coins').textContent = hooks.getState().coins;
  const list = sheet.querySelector('#games-list');
  list.innerHTML = '';
  for (const g of GAMES) {
    const st = stats(g.id);
    const el = document.createElement('div');
    el.className = 'game-card';
    el.style.setProperty('--gc', g.color);
    const medals = MEDALS.map((m, i) => `<span class="${i < st.medals ? 'got' : ''}" title="${m} ${g.medals[i]} puntos">${m}</span>`).join('');
    el.innerHTML = `<span class="gemo" aria-hidden="true">${g.emo}</span>
      <div class="ginfo"><strong>${g.name}</strong><span>${g.desc}</span>
      <span class="gmeta">Récord: <b>${st.best}</b> <span class="gmedals">${medals}</span></span></div>`;
    const b = document.createElement('button');
    b.className = 'claim gplay';
    b.textContent = 'Jugar';
    b.addEventListener('click', () => { hooks.unlock(); hooks.sfx.tap(); start(g); });
    el.append(b);
    list.append(el);
  }
}

export function openGames() {
  renderSheet();
  sheet.style.bottom = `${document.getElementById('rooms').getBoundingClientRect().height}px`;
  sheet.show();
}
export const gamesOpen = () => !!sheet?.open || !!current;
export function closeGames() { if (sheet?.open) sheet.close(); }

// ---------------- pantalla de juego ----------------
function buildOverlay() {
  overlay = document.createElement('div');
  overlay.id = 'mg';
  overlay.hidden = true;
  overlay.innerHTML = `
    <div class="mg-top">
      <button class="icon-btn" id="mg-quit" aria-label="Salir del minijuego">✕</button>
      <div class="mg-title"></div>
      <div class="mg-score"><small>Puntos</small><strong id="mg-score">0</strong></div>
    </div>
    <div class="mg-extra" id="mg-extra"></div>
    <canvas id="mg-canvas"></canvas>
    <div class="mg-card" id="mg-card" hidden></div>`;
  document.body.append(overlay);
  canvas = overlay.querySelector('#mg-canvas');
  ctx = canvas.getContext('2d');
  topScore = overlay.querySelector('#mg-score');
  topExtra = overlay.querySelector('#mg-extra');
  card = overlay.querySelector('#mg-card');
  overlay.querySelector('#mg-quit').addEventListener('click', () => {
    if (!current) return;
    if (current.phase === 'over') return quit();
    pause();
    showCard(`<h3>Pausa</h3><p>¿Seguimos?</p>`, [
      ['Seguir', () => resume(), 'primary'],
      ['Salir', () => finish(true)],
    ]);
  });
  const pt = (type) => (e) => {
    if (!current || current.phase !== 'play') return;
    const r = canvas.getBoundingClientRect();
    current.inst.pointer?.(type, e.clientX - r.left, e.clientY - r.top, e.pointerId);
    e.preventDefault();
  };
  canvas.addEventListener('pointerdown', (e) => { canvas.setPointerCapture?.(e.pointerId); pt('down')(e); });
  canvas.addEventListener('pointermove', pt('move'));
  canvas.addEventListener('pointerup', pt('up'));
  canvas.addEventListener('pointercancel', pt('up'));
  addEventListener('resize', size);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && current?.phase === 'play') {
      pause();
      showCard(`<h3>Pausa</h3><p>El juego se ha pausado.</p>`, [['Seguir', () => resume(), 'primary'], ['Salir', () => finish(true)]]);
    }
  });
}

function size() {
  if (!canvas || overlay.hidden) return;
  const dpr = Math.min(2, devicePixelRatio || 1);
  const r = canvas.getBoundingClientRect();
  canvas.width = Math.round(r.width * dpr);
  canvas.height = Math.round(r.height * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}
const W = () => canvas.getBoundingClientRect().width;
const H = () => canvas.getBoundingClientRect().height;

function showCard(html, buttons) {
  card.innerHTML = `<div class="mg-card-in">${html}<div class="mg-btns"></div></div>`;
  const box = card.querySelector('.mg-btns');
  for (const [label, fn, cls] of buttons) {
    const b = document.createElement('button');
    b.className = 'mg-btn' + (cls ? ' ' + cls : '');
    b.textContent = label;
    b.addEventListener('click', () => { hooks.sfx.tap(); card.hidden = true; fn(); });
    box.append(b);
  }
  card.hidden = false;
}

// API que reciben los juegos
function makeApi(game) {
  return {
    get w() { return W(); },
    get h() { return H(); },
    sfx: hooks.sfx,
    isMuted: hooks.isMuted,
    text(x, y, str, color = '#fff', size = 22) { fx.push({ kind: 'text', x, y, str, color, size, t: 0, life: 0.9 }); },
    burst(x, y, color = '#fff', n = 10, speed = 180) {
      for (let i = 0; i < n; i++) {
        const a = Math.random() * Math.PI * 2, v = speed * (0.4 + Math.random() * 0.8);
        fx.push({ kind: 'dot', x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, color, r: 2 + Math.random() * 4, t: 0, life: 0.5 + Math.random() * 0.4 });
      }
    },
    shake(t = 0.25) { shakeT = Math.max(shakeT, t); },
    say(msg) { topExtra.dataset.say = msg; },
    game,
  };
}

function start(game) {
  const why = hooks.canPlay();
  if (why !== true) { hooks.toast(why); hooks.sfx.sad(); return; }
  if (sheet.open) sheet.close();
  hooks.onStart(game);
  overlay.hidden = false;
  overlay.style.setProperty('--gc', game.color);
  overlay.querySelector('.mg-title').textContent = `${game.emo} ${game.name}`;
  document.body.classList.add('mg-on');
  size();
  fx.length = 0;
  const inst = game.create(makeApi(game));
  current = { game, inst, phase: 'intro', t: 0 };
  topScore.textContent = '0';
  topExtra.innerHTML = '';
  showCard(`<div class="mg-big">${game.emo}</div><h3>${game.name}</h3><p>${game.how}</p>`, [['¡A jugar!', () => countdown(), 'primary']]);
  last = performance.now();
  cancelAnimationFrame(raf);
  raf = requestAnimationFrame(frame);
}

function countdown() {
  current.phase = 'count';
  current.t = 3;
  hooks.sfx.tap();
}
function pause() { if (current?.phase === 'play') { current.phase = 'pause'; current.inst.pause?.(); } }
function resume() { if (current?.phase === 'pause') { current.phase = 'play'; current.inst.resume?.(); last = performance.now(); } }

function frame(now) {
  if (!current) return;
  raf = requestAnimationFrame(frame);
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  const w = W(), h = H();
  const { inst } = current;

  if (current.phase === 'count') {
    const before = Math.ceil(current.t);
    current.t -= dt;
    if (Math.ceil(current.t) !== before && current.t > 0) hooks.sfx.tap();
    if (current.t <= 0) { current.phase = 'play'; hooks.sfx.boing(); inst.begin?.(); }
  } else if (current.phase === 'play') {
    inst.update(dt);
    if (inst.over) finish(false);
  }

  ctx.save();
  if (shakeT > 0) { shakeT -= dt; ctx.translate((Math.random() - 0.5) * 10, (Math.random() - 0.5) * 10); }
  inst.draw(ctx, w, h);
  // efectos compartidos
  for (let i = fx.length - 1; i >= 0; i--) {
    const p = fx[i];
    p.t += dt;
    if (p.t >= p.life) { fx.splice(i, 1); continue; }
    const k = 1 - p.t / p.life;
    ctx.globalAlpha = Math.min(1, k * 1.5);
    if (p.kind === 'dot') {
      p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 300 * dt;
      ctx.fillStyle = p.color;
      ctx.beginPath(); ctx.arc(p.x, p.y, p.r * k + 0.5, 0, Math.PI * 2); ctx.fill();
    } else {
      ctx.font = `900 ${p.size}px Grandstander, system-ui, sans-serif`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.lineWidth = 5; ctx.strokeStyle = 'rgba(30,30,30,.85)';
      const y = p.y - p.t * 60;
      ctx.strokeText(p.str, p.x, y); ctx.fillStyle = p.color; ctx.fillText(p.str, p.x, y);
    }
    ctx.globalAlpha = 1;
  }
  if (current.phase === 'count') {
    const n = Math.ceil(current.t);
    const k = current.t - Math.floor(current.t);
    ctx.font = `900 ${90 + k * 40}px Grandstander, system-ui, sans-serif`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.lineWidth = 10; ctx.strokeStyle = '#1E1E1E'; ctx.fillStyle = '#F6C928';
    ctx.strokeText(n, w / 2, h / 2); ctx.fillText(n, w / 2, h / 2);
  }
  ctx.restore();

  topScore.textContent = Math.floor(inst.score);
  const extra = inst.extra?.() || '';
  if (topExtra.dataset.last !== extra) { topExtra.innerHTML = extra; topExtra.dataset.last = extra; }
}

function finish(quitEarly) {
  if (!current || current.phase === 'over') return;
  const { game, inst } = current;
  current.phase = 'over';
  inst.destroy?.();
  const score = Math.floor(inst.score);
  const st = stats(game.id);
  st.plays += 1;
  const record = score > st.best;
  if (record) st.best = score;
  // medallas nuevas
  let bonus = 0;
  const gotMedals = [];
  while (st.medals < 3 && score >= game.medals[st.medals]) {
    bonus += MEDAL_BONUS[st.medals];
    gotMedals.push(MEDALS[st.medals]);
    st.medals += 1;
  }
  const coins = Math.min(game.coinsCap, Math.floor(score / game.coinsPer)) + bonus;
  const xp = 5 + Math.floor(Math.min(game.coinsCap, score / game.coinsPer) * 1.5);
  hooks.onFinish(game, { score, coins, xp, record, medals: gotMedals, quit: quitEarly });
  const next = game.medals[st.medals];
  showCard(`
    <div class="mg-big">${record && score > 0 ? '🏆' : game.emo}</div>
    <h3>${record && score > 0 ? '¡Nuevo récord!' : quitEarly ? 'Partida terminada' : '¡Se acabó!'}</h3>
    <p class="mg-final">${score} puntos</p>
    <p>Récord: <b>${st.best}</b>${next ? ` · Siguiente medalla ${MEDALS[st.medals]} a los ${next}` : ' · ¡Todas las medallas!'}</p>
    ${gotMedals.length ? `<p class="mg-medal">${gotMedals.join(' ')} ¡Medalla nueva! +${bonus} 🪙</p>` : ''}
    <p class="mg-reward">+${coins} 🪙 · +${xp} XP</p>`, [
    ['Otra vez', () => { quit(true); start(game); }, 'primary'],
    ['Salir', () => quit()],
  ]);
  if (record && score > 0) hooks.sfx.level(); else hooks.sfx.coin();
}

function quit(silent) {
  cancelAnimationFrame(raf);
  current = null;
  overlay.hidden = true;
  card.hidden = true;
  document.body.classList.remove('mg-on');
  if (!silent) openGames();
}

export function initMinigames(h) {
  hooks = h;
  buildSheet();
  buildOverlay();
}
