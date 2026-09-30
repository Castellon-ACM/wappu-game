import { World } from './world.js';
import * as S from './state.js';
import { sfx, toggleMute, isMuted, unlock } from './audio.js';

const $ = (sel) => document.querySelector(sel);
const fx = $('#fx');
const bubble = $('#bubble');

let isNew = true;
try { isNew = !localStorage.getItem('wapuu-game-v1'); } catch (e) {}
let state = S.load();
const saveNow = () => S.save(state);
let world;
let busy = false;          // hay una animación que bloquea acciones
let soapMode = false;
let lastPet = 0;
let bubbleUntil = 0;
let nextComplaint = performance.now() + 8000;
let nextBug = 0;
let nextZ = 0;
let nextFly = 0;

// 0 = limpio, 1 = muy sucio. Empieza a mancharse por debajo del 55 % de higiene.
const dirtLevel = () => Math.max(0, Math.min(1, (55 - state.stats.hygiene) / 40));

const ROOM_NAMES = { salon: 'Salón', cocina: 'Cocina', despacho: 'Despacho', bano: 'Baño', dormitorio: 'Dormitorio' };

// ---------------- utilidades de interfaz ----------------
let toastTimer;
function toast(msg, ms = 2200) {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), ms);
}

function say(text, ms = 2600) {
  bubble.textContent = text;
  bubble.hidden = false;
  bubbleUntil = performance.now() + ms;
}

function floatAt(x, y, emoji, extra = '') {
  const el = document.createElement('div');
  el.className = 'float';
  el.textContent = emoji;
  el.style.left = x + (Math.random() * 60 - 30) + 'px';
  el.style.top = y + (Math.random() * 30 - 15) + 'px';
  if (extra) el.style.cssText += extra;
  fx.appendChild(el);
  setTimeout(() => el.remove(), 1500);
}

function burst(emoji, n = 4, pos = world.headPos()) {
  for (let i = 0; i < n; i++) setTimeout(() => floatAt(pos.x, pos.y, emoji), i * 120);
}

function coinFx(n) {
  const c = $('.coins');
  c.classList.remove('bump'); void c.offsetWidth; c.classList.add('bump');
  sfx.coin();
  const r = c.getBoundingClientRect();
  floatAt(r.left + r.width / 2, r.bottom + 10, `${n > 0 ? '+' : ''}${n}🪙`, 'font-size:1rem;font-weight:900;');
}

function gain({ coins = 0, xp = 0 } = {}) {
  if (coins) { state.coins += coins; coinFx(coins); }
  const before = S.stage(state.level);
  if (xp && S.addXp(state, xp)) {
    sfx.level();
    const now = S.stage(state.level);
    world.setGrowth(now, true);
    if (now.name !== before.name) {
      toast(`¡${state.name} ha crecido! Ahora es ${now.name.toLowerCase()} (+${10 * state.level} 🪙)`, 3600);
      say('¡Mira qué grande estoy!');
    } else {
      toast(`¡Nivel ${state.level}! Ahora eres ${S.title(state.level)} (+${10 * state.level} 🪙)`, 3200);
      say('¡He crecido un poquito!');
    }
    burst('⭐', 6);
  }
  renderHud();
}

// ---------------- HUD ----------------
function renderHud() {
  $('#name-text').textContent = state.name;
  $('#level-text').textContent = `Nv. ${state.level} · ${S.stage(state.level).name}`;
  $('#level-text').title = S.title(state.level);
  $('#xp-bar').style.width = (state.xp / S.xpNeeded(state.level) * 100) + '%';
  $('#coins').textContent = state.coins;
  for (const li of document.querySelectorAll('#stats li')) {
    const v = state.stats[li.dataset.stat];
    const ring = li.querySelector('.ring');
    ring.style.setProperty('--v', v.toFixed(1));
    ring.style.setProperty('--c', v > 50 ? 'var(--ok)' : v > 25 ? 'var(--warn)' : 'var(--bad)');
    li.classList.toggle('low', v <= 25);
    li.title = `${li.querySelector('small').textContent}: ${Math.round(v)}%`;
  }
  document.querySelectorAll('.act[data-price]').forEach(b => { b.disabled = state.coins < +b.dataset.price; });
}

// ---------------- acciones por habitación ----------------
function btn({ emo, label, onClick, price, on = false, id }) {
  const b = document.createElement('button');
  b.className = 'act' + (on ? ' on' : '');
  if (id) b.id = id;
  b.innerHTML = `<span class="emo" aria-hidden="true">${emo}</span><span>${label}</span>` + (price != null ? `<span class="price">🪙 ${price}</span>` : '');
  if (price != null) b.dataset.price = price;
  b.addEventListener('click', () => { unlock(); sfx.tap(); onClick(b); });
  return b;
}

function renderActions() {
  const box = $('#actions');
  box.innerHTML = '';
  box.classList.toggle('foods', state.room === 'cocina');
  const r = state.room;
  const sleeping = state.mode === 'sleeping';

  if (r === 'salon') {
    box.append(
      btn({ emo: '🤗', label: 'Mimos', onClick: () => pet(true) }),
      btn({ emo: '⚽', label: 'Pelota', onClick: playBall }),
      btn({ emo: '💃', label: 'Bailar', onClick: dance }),
      btn({ emo: '🛍️', label: 'Tienda', onClick: openShop }),
    );
  }
  if (r === 'cocina') {
    for (const f of S.FOODS) box.append(btn({ emo: f.emo, label: f.name, price: f.price, onClick: () => eat(f) }));
  }
  if (r === 'despacho') {
    const coding = state.mode === 'coding';
    box.append(btn({ emo: coding ? '⏹️' : '💻', label: coding ? 'Parar' : 'Programar', on: coding, onClick: toggleCoding }));
    const info = document.createElement('div');
    info.className = 'act';
    info.setAttribute('aria-live', 'polite');
    info.innerHTML = `<span class="emo" aria-hidden="true">📦</span><span>${state.commits} commits</span><span class="price">🐛 ${state.bugs}</span>`;
    box.append(info);
  }
  if (r === 'bano') {
    box.append(
      btn({ emo: '🚽', label: 'Váter', onClick: toilet }),
      btn({ emo: '🧼', label: soapMode ? 'Frotando' : 'Jabón', on: soapMode, onClick: toggleSoap }),
      btn({ emo: '🚿', label: 'Ducha', onClick: shower }),
    );
  }
  if (r === 'dormitorio') {
    box.append(btn({ emo: sleeping ? '☀️' : '💡', label: sleeping ? 'Despertar' : 'Apagar luz', on: sleeping, onClick: toggleSleep }));
  }
  renderHud();
}

function tooTired() {
  if (state.stats.energy < 8) { say('Estoy demasiado cansado…'); sfx.sad(); return true; }
  return false;
}

async function run(fn) {
  if (busy) return;
  busy = true;
  try { await fn(); } finally { busy = false; }
}

function pet(fromButton = false) {
  if (busy && !fromButton) return;
  const now = performance.now();
  if (now - lastPet < 450) return;
  lastPet = now;
  if (state.mode === 'sleeping') { say('Zzz… cinco minutos más…'); return; }
  S.apply(state, { fun: 4 });
  world.squish();
  sfx.happy();
  burst('💛', 3);
  if (Math.random() < 0.3) say(['¡Qué gustito!', 'Más, más', '¡Te quiero!', '¡Prrr!'][Math.floor(Math.random() * 4)], 1600);
  gain({ xp: 1 });
}

function playBall() {
  if (tooTired()) return;
  run(async () => {
    sfx.boing();
    await world.throwBall();
    S.apply(state, { fun: 15, energy: -6, food: -3, hygiene: -2 });
    burst('🎉', 3);
    say('¡Otra vez!', 1500);
    gain({ xp: 4 });
  });
}

function dance() {
  if (tooTired()) return;
  run(async () => {
    sfx.happy();
    await world.dance();
    S.apply(state, { fun: 10, energy: -5, food: -2 });
    burst('🎵', 4);
    gain({ xp: 3 });
  });
}

function eat(food) {
  if (state.stats.food > 96) { say('Estoy lleno, gracias.'); return; }
  if (state.coins < food.price) { toast('Te faltan monedas. Programa en el despacho para ganar más.'); sfx.sad(); return; }
  run(async () => {
    state.coins -= food.price;
    renderHud();
    // la comida vuela hasta la boca
    const el = document.createElement('div');
    el.className = 'fly'; el.textContent = food.emo;
    el.style.left = innerWidth / 2 + 'px';
    el.style.top = innerHeight - 170 + 'px';
    fx.appendChild(el);
    const m = world.mouthPos();
    requestAnimationFrame(() => requestAnimationFrame(() => {
      el.style.left = m.x + 'px'; el.style.top = m.y + 'px'; el.style.transform = 'translate(-50%,-50%) scale(.4)';
    }));
    await new Promise(r => setTimeout(r, 560));
    el.remove();
    sfx.chomp();
    await world.chomp();
    S.apply(state, food.effects);
    say(food.say, 1800);
    burst('😋', 1, m);
    gain({ xp: 2 });
  });
}

// ----- despacho -----
function toggleCoding() {
  if (state.mode === 'coding') { stopCoding(); return; }
  if (tooTired()) return;
  if (state.stats.food < 8) { say('No puedo programar con hambre.'); return; }
  setMode('coding');
  say('¡A picar código!', 1500);
  nextBug = performance.now() + 2500;
}
function stopCoding(msg = 'Commit y a descansar.') {
  if (state.mode !== 'coding') return;
  setMode('idle');
  say(msg, 1600);
  document.querySelectorAll('.bug').forEach(b => b.remove());
}

function onCommit(file) {
  state.commits += 1;
  world.commits = state.commits;
  const coins = 3 + Math.floor(state.level / 2);
  toast(`Commit en ${file} (+${coins} 🪙)`);
  S.apply(state, { fun: 2 });
  gain({ coins, xp: 6 });
  if (state.room === 'despacho') renderActions();
}

function spawnBug() {
  const el = document.createElement('button');
  el.className = 'bug';
  el.textContent = Math.random() < 0.2 ? '🪲' : '🐛';
  el.setAttribute('aria-label', 'Aplastar bug');
  const move = () => {
    el.style.left = (15 + Math.random() * 70) + 'vw';
    el.style.top = (28 + Math.random() * 30) + 'vh';
  };
  move();
  el.style.transition = 'left 1.2s ease-in-out, top 1.2s ease-in-out';
  fx.appendChild(el);
  const mover = setInterval(move, 1200);
  const escape = setTimeout(() => {
    clearInterval(mover); el.remove();
    if (state.mode === 'coding') { toast('Un bug se ha escapado a producción…'); S.apply(state, { fun: -3 }); renderHud(); }
  }, 5000);
  el.addEventListener('pointerdown', (e) => {
    e.stopPropagation();
    clearInterval(mover); clearTimeout(escape);
    el.classList.add('squashed');
    sfx.squash();
    state.bugs += 1;
    S.apply(state, { fun: 3 });
    gain({ coins: 3, xp: 2 });
    setTimeout(() => el.remove(), 320);
    if (state.room === 'despacho') renderActions();
  });
}

// ----- baño -----
function toilet() {
  if (state.stats.bladder > 90) { say('Ahora no tengo ganas.'); return; }
  setSoap(false);
  run(async () => {
    say('Un momento de intimidad…', 2200);
    await world.goToilet();
    sfx.flush();
    S.apply(state, { bladder: 100, hygiene: -3 });
    say('¡Qué alivio!', 1500);
    burst('✨', 3);
    gain({ xp: 3 });
  });
}

const soapCursor = $('#soap-cursor');
function moveSoap(x, y) { soapCursor.style.left = x + 'px'; soapCursor.style.top = y + 'px'; }
function setSoap(on) {
  soapMode = on;
  $('#scene').classList.toggle('soap', on);
  soapCursor.hidden = !on;
  if (on) { const b = world.bellyPos(); moveSoap(b.x + 70, b.y); }
  if (state.room === 'bano') renderActions();
}
function toggleSoap() {
  setSoap(!soapMode);
  if (soapMode) toast('Arrastra el jabón sobre Wapuu para frotarle');
}

function shower() {
  setSoap(false);
  run(async () => {
    sfx.water();
    const bonus = Math.round(state.soap * 0.25);
    // la ducha siempre lo deja limpio; con jabón, todavía más
    const target = Math.min(100, Math.max(state.stats.hygiene + 30, 80) + bonus);
    const start = state.stats.hygiene;
    const t0 = performance.now();
    const w = setInterval(() => sfx.water(), 500);
    const wash = setInterval(() => {
      const p = Math.min(1, (performance.now() - t0) / 2400);
      state.stats.hygiene = start + (target - start) * p;
      world.setDirt(dirtLevel());
    }, 80);
    await world.shower();
    clearInterval(w); clearInterval(wash);
    state.stats.hygiene = target;
    world.setDirt(dirtLevel());
    S.apply(state, { fun: 3 });
    const wasDirty = start < 40;
    state.soap = 0;
    say(bonus > 10 ? '¡Limpísimo y con olor a jabón!' : wasDirty ? '¡Por fin limpio!' : '¡Fresquito!', 1800);
    burst('✨', 4);
    gain({ xp: 3 });
  });
}

// ----- dormitorio -----
function toggleSleep() {
  if (state.mode === 'sleeping') { wake(); return; }
  if (state.stats.energy > 92) { say('¡No tengo nada de sueño!'); return; }
  setMode('sleeping');
  say('Buenas noches…', 1500);
}
function wake(msg) {
  if (state.mode !== 'sleeping') return;
  setMode('idle');
  say(msg || (state.stats.energy > 80 ? '¡Buenos días!' : 'Todavía tengo sueño…'), 1800);
}

function setMode(m) {
  state.mode = m;
  world.setMode(m);
  renderActions();
}

// ---------------- habitaciones ----------------
function goRoom(id) {
  if (busy) return;
  if (id === state.room) return;
  if (state.mode === 'sleeping') wake(state.stats.energy < 60 ? '¡Eh! Estaba durmiendo…' : null);
  if (state.mode === 'coding') stopCoding('Guardo el trabajo y voy.');
  setSoap(false);
  enterRoom(id);
}

function enterRoom(id) {
  state.room = id;
  world.setRoom(id);
  $('#room-name').textContent = ROOM_NAMES[id];
  document.querySelectorAll('#rooms button').forEach(b => b.setAttribute('aria-current', b.dataset.room === id ? 'page' : 'false'));
  renderActions();
}

// ---------------- entrada sobre el canvas ----------------
function setupPointer() {
  const cv = $('#scene');
  let down = false, lastSoap = 0;
  cv.addEventListener('pointerdown', (e) => {
    unlock();
    down = true;
    if (!world.hit(e.clientX, e.clientY)) return;
    if (soapMode) scrub(e); else pet();
  });
  window.addEventListener('pointermove', (e) => { if (soapMode) moveSoap(e.clientX, e.clientY); });
  cv.addEventListener('pointerdown', (e) => { if (soapMode) moveSoap(e.clientX, e.clientY); });
  cv.addEventListener('pointermove', (e) => {
    if (!down || !soapMode) return;
    const now = performance.now();
    if (now - lastSoap < 45) return;
    lastSoap = now;
    if (world.hit(e.clientX, e.clientY)) scrub(e);
  });
  const up = () => { down = false; soapCursor.classList.remove('rub'); };
  cv.addEventListener('pointerup', up);
  cv.addEventListener('pointerleave', up);
  cv.addEventListener('pointercancel', up);
}

let rubTimer;
function scrub(e) {
  soapCursor.classList.add('rub');
  clearTimeout(rubTimer);
  rubTimer = setTimeout(() => soapCursor.classList.remove('rub'), 250);
  const el = document.createElement('div');
  el.className = 'bubble-fx';
  const s = 14 + Math.random() * 26;
  el.style.width = el.style.height = s + 'px';
  el.style.left = e.clientX - s / 2 + (Math.random() * 30 - 15) + 'px';
  el.style.top = e.clientY - s / 2 + (Math.random() * 30 - 15) + 'px';
  fx.appendChild(el);
  setTimeout(() => el.remove(), 1600);
  if (Math.random() < 0.3) sfx.pop();
  state.soap = Math.min(100, state.soap + 1.5);
  S.apply(state, { hygiene: 0.35 });
  world.setDirt(dirtLevel());
  if (state.soap >= 100 && Math.random() < 0.05) say('¡Ahora a la ducha!', 1500);
}

// ---------------- bucle ----------------
let lastSec = performance.now();
let lastSave = 0;
function loop() {
  requestAnimationFrame(loop);
  const now = performance.now();

  if (now - lastSec >= 1000) {
    const dt = now - lastSec; lastSec = now;
    S.tick(state, dt);
    // accidentes y cambios automáticos
    if (state.stats.bladder <= 0.5) {
      S.apply(state, { bladder: 65, hygiene: -30, fun: -12 });
      toast('¡Oh, no! Wapuu no llegó al baño a tiempo.');
      say('Uy… qué vergüenza.'); sfx.sad();
    }
    if (state.mode === 'sleeping' && state.stats.energy >= 100) wake('¡Buenos días! Energía al 100 %.');
    if (state.mode === 'coding' && state.stats.energy < 4) stopCoding('No puedo más, necesito dormir.');
    world.setMood(S.mood(state));
    world.setDirt(dirtLevel());
    renderHud();
    if (now - lastSave > 5000) { S.save(state); lastSave = now; }
  }

  // quejas periódicas
  if (now > nextComplaint) {
    nextComplaint = now + 11000 + Math.random() * 8000;
    if (state.mode !== 'sleeping' && !busy && bubble.hidden) {
      const c = S.complaint(state);
      if (c) { say(c, 3000); sfx.sad(); }
    }
  }

  // bugs mientras programa
  if (state.mode === 'coding' && state.room === 'despacho' && now > nextBug) {
    nextBug = now + 3500 + Math.random() * 4000;
    spawnBug();
  }

  // zetas al dormir
  if (state.mode === 'sleeping' && state.room === 'dormitorio' && now > nextZ) {
    nextZ = now + 1300;
    const h = world.headPos();
    const z = document.createElement('div');
    z.className = 'zzz'; z.textContent = Math.random() < 0.5 ? 'z' : 'Z';
    z.style.left = h.x + 20 + 'px'; z.style.top = h.y + 'px';
    fx.appendChild(z);
    setTimeout(() => z.remove(), 2500);
    if (Math.random() < 0.3) sfx.snore();
  }

  // moscas cuando está muy sucio
  if (dirtLevel() > 0.55 && now > nextFly && state.mode !== 'sleeping') {
    nextFly = now + 1800 + Math.random() * 2000;
    const h = world.headPos();
    const f = document.createElement('div');
    f.className = 'flybug'; f.textContent = '🪰';
    f.style.left = h.x + (Math.random() * 120 - 60) + 'px';
    f.style.top = h.y + 20 + Math.random() * 60 + 'px';
    fx.appendChild(f);
    setTimeout(() => f.remove(), 3100);
  }

  // bocadillo sigue a Wapuu
  if (!bubble.hidden) {
    if (now > bubbleUntil) bubble.hidden = true;
    const h = world.headPos();
    bubble.style.left = Math.max(120, Math.min(innerWidth - 120, h.x)) + 'px';
    bubble.style.top = Math.max(200, h.y - 6) + 'px';
  }

  world.update();
}

// ---------------- tienda de cosméticos ----------------
const shop = $('#shop');
function openShop() {
  if (busy) return;
  renderShop();
  shop.showModal();
}
function renderShop() {
  $('#shop-coins').textContent = state.coins;
  const grid = $('#shop-grid');
  grid.innerHTML = '';
  for (const slot of Object.keys(S.SLOT_NAMES)) {
    const h = document.createElement('p');
    h.className = 'shop-slot'; h.textContent = S.SLOT_NAMES[slot];
    const row = document.createElement('div'); row.className = 'shop-row';
    for (const it of S.COSMETICS.filter(c => c.slot === slot)) {
      const owned = state.owned.includes(it.id);
      const worn = state.equipped[slot] === it.id;
      const locked = !owned && it.level && state.level < it.level;
      const card = document.createElement('div');
      card.className = 'item' + (worn ? ' worn' : '');
      card.innerHTML = `<span class="emo" aria-hidden="true">${it.emo}</span><span class="iname">${it.name}</span>`;
      const b = document.createElement('button');
      if (worn) { b.textContent = 'Quitar'; b.className = 'off'; }
      else if (owned) { b.textContent = 'Poner'; b.className = 'wear'; }
      else if (locked) { b.textContent = `🔒 Nv. ${it.level}`; b.disabled = true; }
      else { b.textContent = `🪙 ${it.price}`; b.disabled = state.coins < it.price; }
      b.setAttribute('aria-label', `${b.textContent} ${it.name}`);
      b.addEventListener('click', () => shopAction(it));
      card.append(b);
      row.append(card);
    }
    grid.append(h, row);
  }
}
function shopAction(it) {
  unlock();
  const owned = state.owned.includes(it.id);
  if (state.equipped[it.slot] === it.id) {
    delete state.equipped[it.slot];
    sfx.tap();
  } else if (owned) {
    state.equipped[it.slot] = it.id;
    sfx.happy(); world.squish(); burst('✨', 3);
  } else {
    if (state.coins < it.price) { toast('Te faltan monedas. Programa en el despacho para ganar más.'); return; }
    state.coins -= it.price;
    state.owned.push(it.id);
    state.equipped[it.slot] = it.id;
    coinFx(-it.price);
    sfx.happy(); world.squish(); burst('✨', 4);
    say(['¡Me encanta!', '¿Me queda bien?', '¡Qué estilo!'][Math.floor(Math.random() * 3)], 1800);
    gain({ xp: 3 });
  }
  world.setCosmetics(state.equipped);
  S.save(state);
  renderHud();
  renderShop();
}

// ---------------- menú ----------------
function setupMenu() {
  const dlg = $('#menu');
  const open = () => {
    $('#name-input').value = state.name;
    const days = Math.max(1, Math.round((Date.now() - state.createdAt) / 86400000));
    $('#stats-line').textContent = `${S.title(state.level)}. ${state.commits} commits, ${state.bugs} bugs aplastados, ${days} día${days > 1 ? 's' : ''} juntos.`;
    dlg.showModal();
  };
  $('#menu-btn').addEventListener('click', open);
  $('#shop-btn').addEventListener('click', () => { unlock(); sfx.tap(); openShop(); });
  $('#shop-close').addEventListener('click', () => shop.close());
  shop.addEventListener('click', (e) => {
    if (e.target !== shop) return;
    const r = shop.getBoundingClientRect();
    if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) shop.close();
  });
  $('#pet-name').addEventListener('click', open);
  $('#reset-btn').addEventListener('click', (e) => {
    if (!confirm('¿Seguro? Se borrará todo el progreso de tu Wapuu.')) { e.preventDefault(); return; }
  });
  dlg.addEventListener('close', () => {
    if (dlg.returnValue === 'save') {
      const n = $('#name-input').value.trim();
      if (n) { state.name = n; world.name = n; world.setMode(state.mode); }
    }
    if (dlg.returnValue === 'reset') {
      state = S.reset();
      state.createdAt = Date.now();
      localStorage.removeItem('wapuu-game-v1');
      location.reload();
      return;
    }
    S.save(state);
    renderHud();
  });
  const mute = $('#mute');
  const paint = () => { mute.textContent = isMuted() ? '🔇' : '🔊'; };
  paint();
  mute.addEventListener('click', () => { toggleMute(); paint(); });
}

// ---------------- arranque ----------------
async function start() {
  const bar = $('#loader-bar');
  try {
    world = new World($('#scene'));
  } catch (e) {
    $('#loader-text').textContent = 'Tu navegador no soporta WebGL, que es lo que usa Wapuu para verse en 3D.';
    return;
  }
  try {
    await document.fonts?.load('600 24px "Fira Code"');
    await document.fonts?.load('900 52px "Grandstander"');
  } catch (e) {}
  try {
    await world.load(p => { bar.style.width = (5 + p * 95) + '%'; });
  } catch (e) {
    $('#loader-text').textContent = 'No se ha podido cargar a Wapuu. Revisa tu conexión y recarga la página.';
    console.error(e);
    return;
  }

  const away = S.catchUp(state);
  world.name = state.name;
  world.commits = state.commits;
  world.onCommit = onCommit;
  world.mode = state.mode;
  world.setGrowth(S.stage(state.level));
  world.setCosmetics(state.equipped);
  world.setDirt(dirtLevel());

  document.querySelectorAll('#rooms button').forEach(b => b.addEventListener('click', () => { unlock(); sfx.tap(); goRoom(b.dataset.room); }));
  world.setMode(state.mode);
  enterRoom(state.room || 'salon');
  world.setMood(S.mood(state));
  setupPointer();
  setupMenu();
  renderHud();

  $('#loader').classList.add('done');
  setTimeout(() => $('#loader').remove(), 600);

  if (away && away.minutes >= 5) {
    const h = Math.floor(away.minutes / 60), m = away.minutes % 60;
    toast(`Has estado fuera ${h ? h + ' h ' : ''}${m} min. ${state.name} te echaba de menos.`, 3500);
  } else if (isNew) {
    setTimeout(() => say(`¡Hola! Soy ${state.name}. Cuida de mí.`, 3200), 600);
  }
  S.save(state);

  document.addEventListener('visibilitychange', () => { if (document.hidden) S.save(state); else { S.catchUp(state); renderHud(); } });
  window.addEventListener('pagehide', saveNow);
  loop();
}

start();
