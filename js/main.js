import { World } from './world.js';
import * as S from './state.js';
import { sfx, toggleMute, isMuted, unlock } from './audio.js';
import * as Auth from './auth.js';
import * as P from './progress.js';
import { cosmetic } from './pass-cosmetics.js';
import './wardrobe.js';
import './kitchen.js';
import { initMinigames, openGames, closeGames, ENERGY_COST } from './minigames.js';

const $ = (sel) => document.querySelector(sel);
const fx = $('#fx');
const bubble = $('#bubble');

let isNew = true;
try { isNew = !localStorage.getItem('wapuu-game-v1'); } catch (e) {}
let state = S.load();
let world;

// ---------------- cuenta y guardado en la nube ----------------
let currentUid = null;
let lastCloudMs = 0;
let cloudTimer = null;
let lastInteraction = performance.now();
document.addEventListener('pointerdown', () => { lastInteraction = performance.now(); });
document.addEventListener('keydown', () => { lastInteraction = performance.now(); });

function paintSync(text) {
  const el = $('#account-sync');
  if (el) el.textContent = text;
}

function queueCloudSave() {
  if (!currentUid) return;
  paintSync('Guardando en la nube…');
  clearTimeout(cloudTimer);
  cloudTimer = setTimeout(async () => {
    cloudTimer = null;
    const ms = await Auth.saveCloudSave(currentUid, state);
    if (ms) { lastCloudMs = ms; paintSync('Guardada en la nube ahora mismo.'); }
    else paintSync('No se ha podido guardar en la nube. Se reintentará.');
  }, 2200);
}

function persist() {
  S.save(state);
  queueCloudSave();
}

function paintAccountBox() {
  const user = Auth.currentUser();
  const box = $('#account-box');
  const guest = $('#account-guest');
  const verify = $('#account-verify');
  if (!user) {
    box.hidden = true;
    guest.hidden = false;
    return;
  }
  guest.hidden = true;
  box.hidden = false;
  $('#account-email').textContent = user.email;
  paintSync(lastCloudMs ? 'Guardada en la nube.' : 'Aún no se ha guardado en la nube.');
  verify.hidden = user.emailVerified;
}
const saveNow = () => { S.save(state); if (currentUid) Auth.saveCloudSave(currentUid, state); };
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
  // toda la experiencia cuenta también para el pase de batalla
  const passUps = xp ? P.addPassXp(state, xp) : 0;
  const levelUp = xp && S.addXp(state, xp);
  if (passUps) passLevelUp(levelUp ? 3400 : 0);
  if (levelUp) {
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
  document.querySelectorAll('[data-price]').forEach(b => { b.disabled = state.coins < +b.dataset.price; });
  if (fridge.open) $('#fridge-coins').textContent = state.coins;
  const n = P.claimableCount(state);
  const badge = $('#quests-badge');
  badge.hidden = n === 0;
  badge.textContent = n > 9 ? '9+' : n;
  $('#quests-btn').title = `Misiones y pase de batalla (pase nivel ${state.pass.tier})`;
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
    );
  }
  if (r === 'cocina') {
    box.append(btn({ emo: '🧊', label: 'Nevera', on: fridge.open, onClick: () => (fridge.open ? fridge.close() : openFridge()) }));
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
  quest('pet');
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
    quest('ball');
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
    quest('dance');
  });
}

function eat(food, fromEl) {
  if (state.stats.food > 96 && food.cat !== 'drinks') { say('Estoy lleno, gracias.'); return; }
  if (state.coins < food.price) { toast('Te faltan monedas. Programa en el despacho para ganar más.'); sfx.sad(); return; }
  run(async () => {
    state.coins -= food.price;
    quest('spend', food.price);
    renderHud();
    // la comida vuela hasta la boca
    const el = document.createElement('div');
    el.className = 'fly'; el.textContent = food.emo;
    const from = fromEl?.getBoundingClientRect();
    el.style.left = (from ? from.left + from.width / 2 : innerWidth / 2) + 'px';
    el.style.top = (from ? from.top + from.height / 3 : innerHeight - 170) + 'px';
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
    quest('eat');
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
  quest('commit');
  quest('earn', coins);
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
    quest('bug');
    quest('earn', 3);
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
    quest('toilet');
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
    quest('shower');
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
  document.querySelectorAll('#rooms button[data-room]').forEach(b => b.setAttribute('aria-current', b.dataset.room === id ? 'page' : 'false'));
  if (id !== 'cocina' && fridge.open) fridge.close();
  renderActions();
  if (id === 'cocina' && world.pet && !fridge.open) openFridge();
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
  quest('scrub');
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
    if (state.mode === 'sleeping' && state.stats.energy >= 100) { wake('¡Buenos días! Energía al 100 %.'); quest('sleep'); }
    // misiones: cambio de día y minutos de buen humor
    if (P.ensureDaily(state)) {
      toast('🎯 ¡Nuevas misiones diarias!', 3000);
      if (quests.open) renderQuests();
    }
    if (S.mood(state) === 'happy') quest('happy', dt / 60000, { quiet: true });
    if (state.mode === 'coding' && state.stats.energy < 4) stopCoding('No puedo más, necesito dormir.');
    world.setMood(S.mood(state));
    world.setDirt(dirtLevel());
    renderHud();
    if (now - lastSave > 5000) { persist(); lastSave = now; }
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

  if (!document.body.classList.contains('mg-on')) world.update();
}

// ---------------- tienda de cosméticos ----------------
const shop = $('#shop');
function openShop() {
  if (busy) return;
  if (quests.open) quests.close();
  if (fridge.open) fridge.close();
  closeGames();
  preview = null;
  renderShop();
  shop.show();
  $('#shop-close').focus();
}
let shopSlot = 'head';
let preview = null;          // prenda que se está probando (sin comprar ni poner)
const shopScroll = {};       // posición de la fila de cada pestaña
// Probador: tocar una prenda se la pone a Wapuu un momento para ver cómo le queda.
function tryOn(it) {
  if (state.equipped[it.slot] === it.id) { preview = null; world.setCosmetics(state.equipped); return; }
  preview = preview === it.id ? null : it.id;
  world.setCosmetics(preview ? { ...state.equipped, [it.slot]: it.id } : state.equipped);
  if (preview) world.squish();
}
function renderShop() {
  $('#shop-coins').textContent = state.coins;
  world.showBack(shopSlot === 'back');
  const grid = $('#shop-grid');
  const oldRow = grid.querySelector('.shop-row');
  if (oldRow) shopScroll[shopSlot] = oldRow.scrollLeft;
  const oldTabs = grid.querySelector('.shop-tabs');
  const tabsScroll = oldTabs ? oldTabs.scrollLeft : 0;
  grid.innerHTML = '';
  // pestañas por zona: la tienda es una sola fila y Wapuu se sigue viendo entero
  const tabs = document.createElement('div');
  tabs.className = 'shop-tabs scroll'; tabs.setAttribute('role', 'tablist');
  for (const slot of Object.keys(S.SLOT_NAMES)) {
    const t = document.createElement('button');
    const n = S.COSMETICS.filter(c => c.slot === slot);
    t.textContent = `${S.SLOT_NAMES[slot]} ${n.filter(c => state.owned.includes(c.id)).length}/${n.length}`;
    t.setAttribute('role', 'tab');
    t.setAttribute('aria-selected', slot === shopSlot ? 'true' : 'false');
    t.addEventListener('click', () => {
      shopSlot = slot; sfx.tap();
      if (preview) { preview = null; world.setCosmetics(state.equipped); }
      renderShop();
    });
    tabs.append(t);
  }
  const row = document.createElement('div'); row.className = 'shop-row'; row.setAttribute('role', 'tabpanel');
  for (const it of S.COSMETICS.filter(c => c.slot === shopSlot)) {
    const owned = state.owned.includes(it.id);
    const worn = state.equipped[it.slot] === it.id;
    const locked = !owned && it.level && state.level < it.level;
    const card = document.createElement('div');
    card.className = 'item' + (worn ? ' worn' : '') + (it.pass ? ' pass-item' : '') + (preview === it.id ? ' trying' : '');
    card.title = owned ? it.name : `Toca para probártelo: ${it.name}`;
    card.addEventListener('click', () => { unlock(); sfx.tap(); tryOn(it); renderShop(); });
    card.innerHTML = `<span class="emo" aria-hidden="true">${it.emo}</span><span class="iname">${it.name}</span>` + (it.pass ? '<span class="tag">Pase</span>' : '');
    const b = document.createElement('button');
    if (worn) { b.textContent = 'Quitar'; b.className = 'off'; }
    else if (owned) { b.textContent = 'Poner'; b.className = 'wear'; }
    else if (it.pass) { b.textContent = `🏆 Nv. ${it.pass}`; b.disabled = true; b.title = `Recompensa del nivel ${it.pass} del pase de batalla`; }
    else if (locked) { b.textContent = `🔒 Nv. ${it.level}`; b.disabled = true; }
    else { b.textContent = `🪙 ${it.price}`; b.disabled = state.coins < it.price; }
    b.setAttribute('aria-label', `${b.textContent} ${it.name}`);
    b.addEventListener('click', (e) => { e.stopPropagation(); shopAction(it); });
    card.append(b);
    row.append(card);
  }
  grid.append(tabs, row);
  row.scrollLeft = shopScroll[shopSlot] || 0;
  tabs.scrollLeft = tabsScroll;
  if (!oldTabs) tabs.querySelector('[aria-selected="true"]')?.scrollIntoView({ inline: 'nearest', block: 'nearest' });
}
function shopAction(it) {
  unlock();
  preview = null;
  const owned = state.owned.includes(it.id);
  if (state.equipped[it.slot] === it.id) {
    delete state.equipped[it.slot];
    sfx.tap();
  } else if (owned) {
    state.equipped[it.slot] = it.id;
    sfx.happy(); world.squish(); burst('✨', 3);
  } else {
    if (it.pass) { toast(`Se consigue en el nivel ${it.pass} del pase de batalla.`); return; }
    if (state.coins < it.price) { toast('Te faltan monedas. Programa en el despacho para ganar más.'); return; }
    state.coins -= it.price;
    quest('spend', it.price);
    state.owned.push(it.id);
    state.equipped[it.slot] = it.id;
    coinFx(-it.price);
    sfx.happy(); world.squish(); burst('✨', 4);
    say(['¡Me encanta!', '¿Me queda bien?', '¡Qué estilo!'][Math.floor(Math.random() * 3)], 1800);
    gain({ xp: 3 });
  }
  world.setCosmetics(state.equipped);
  persist();
  renderHud();
  renderShop();
}

// ---------------- nevera ----------------
const fridge = $('#fridge');
let fridgeCat = 'fruit';
const EFFECT_ICONS = { food: '🍕', energy: '⚡', fun: '🎈', hygiene: '🫧', bladder: '🚽' };
function openFridge() {
  if (shop.open) shop.close();
  if (quests.open) quests.close();
  closeGames();
  renderFridge();
  // justo encima de la barra de habitaciones, para poder salir de la cocina con la nevera abierta
  fridge.style.bottom = `${$('#rooms').getBoundingClientRect().height}px`;
  fridge.show();
  // que la boca de Wapuu quede por encima de la nevera
  const top = fridge.getBoundingClientRect().top;
  const mouth = world.mouthPos().y + world.liftNow();
  world.liftView(Math.min(innerHeight * 0.4, mouth - (top - 90)));
  if (state.room === 'cocina') renderActions();
}
function renderFridge() {
  $('#fridge-coins').textContent = state.coins;
  document.querySelectorAll('#fridge [data-cat]').forEach(t => t.setAttribute('aria-selected', t.dataset.cat === fridgeCat ? 'true' : 'false'));
  const grid = $('#fridge-grid');
  grid.innerHTML = '';
  for (const food of S.FOODS.filter(x => x.cat === fridgeCat)) {
    const b = document.createElement('button');
    b.className = 'food-card';
    b.dataset.price = food.price;
    b.disabled = state.coins < food.price;
    const fx2 = Object.entries(food.effects).filter(([k, v]) => k !== 'bladder' && v > 0).map(([k, v]) => `${EFFECT_ICONS[k]}+${v}`).join(' ');
    b.innerHTML = `<span class="emo" aria-hidden="true">${food.emo}</span><span class="fname">${food.name}</span>`
      + `<span class="ffx" aria-hidden="true">${fx2}${(food.effects.bladder || 0) < 0 ? ' 🚽!' : ''}</span><span class="price">🪙 ${food.price}</span>`;
    b.setAttribute('aria-label', `${food.name}, ${food.price} monedas`);
    b.addEventListener('click', () => { unlock(); sfx.tap(); eat(food, b); });
    grid.append(b);
  }
  grid.scrollTop = 0;
}

// ---------------- minijuegos ----------------
function setupGames() {
  initMinigames({
    getState: () => state,
    sfx, unlock, isMuted, toast,
    canPlay() {
      if (busy) return 'Espera un momento…';
      if (state.mode === 'sleeping') return `${state.name} está durmiendo. Despiértale primero.`;
      if (state.stats.energy < ENERGY_COST + 4) return `${state.name} está demasiado cansado para jugar. Necesita dormir.`;
      return true;
    },
    onStart() {
      if (state.mode === 'coding') stopCoding('¡Un descanso para jugar!');
      setSoap(false);
      S.apply(state, { energy: -ENERGY_COST, food: -2 });
      renderHud();
    },
    onFinish(game, r) {
      S.apply(state, { fun: r.quit ? 6 : 12 });
      if (r.coins || r.xp) gain({ coins: r.coins, xp: r.xp });
      quest('play');
      persist();
      renderHud();
    },
  });
  $('#games-btn').addEventListener('click', () => {
    unlock(); sfx.tap();
    const sheet = document.getElementById('games');
    if (sheet.open) { sheet.close(); return; }
    if (shop.open) shop.close();
    if (quests.open) quests.close();
    if (fridge.open) fridge.close();
    openGames();
  });
}

// ---------------- misiones diarias y pase de batalla ----------------
const quests = $('#quests');
let questTab = 'daily';

// Avisa a las misiones de que ha pasado algo (mimos, commits, duchas…).
function quest(event, amount = 1, { quiet = false } = {}) {
  const done = P.track(state, event, amount);
  for (const q of done) {
    const info = P.missionInfo(q, state.name);
    toast(`✅ Misión completada: ${info.text}`, 2800);
    sfx.happy();
  }
  if (done.length) renderHud();
  if (quests.open && (done.length || !quiet)) renderQuests();
}

function passLevelUp(delay = 0) {
  setTimeout(() => {
    toast(`🏆 ¡Nivel ${state.pass.tier} del pase de batalla! Tienes una recompensa esperando.`, 3200);
    sfx.level();
    renderHud();
    if (quests.open) renderQuests();
  }, delay);
}

function openQuests(tab) {
  if (busy) return;
  if (shop.open) shop.close();
  if (fridge.open) fridge.close();
  closeGames();
  P.ensureDaily(state);
  if (tab) questTab = tab;
  else if (P.passPending(state) && !state.daily.list.some(q => !q.claimed && q.progress >= q.target)) questTab = 'pass';
  renderQuests();
  quests.show();
  $('#quests-close').focus();
}

function fmtReset() {
  const ms = P.msToReset();
  const h = Math.floor(ms / 3600000), m = Math.floor(ms / 60000) % 60;
  return h ? `${h} h ${m} min` : `${Math.max(1, m)} min`;
}

function renderQuests() {
  $('#quests-coins').textContent = state.coins;
  $('#quests-title').textContent = questTab === 'pass' ? 'Pase de batalla' : 'Misiones diarias';
  document.querySelectorAll('#quests [data-tab]').forEach(t => t.setAttribute('aria-selected', t.dataset.tab === questTab ? 'true' : 'false'));
  const body = $('#quests-body');
  body.innerHTML = '';
  if (questTab === 'pass') renderPass(body); else renderDaily(body);
}

function questRow({ emo, text, metaHtml, pct, cls, button }) {
  const row = document.createElement('div');
  row.className = 'quest ' + cls;
  row.innerHTML = `<span class="emo" aria-hidden="true">${emo}</span>
    <div><div class="qtext">${text}</div><div class="qmeta">${metaHtml}</div>
    <span class="qbar"><span style="width:${pct}%"></span></span></div>`;
  row.append(button);
  return row;
}

function claimBtn(label, enabled, onClick) {
  const b = document.createElement('button');
  b.className = 'claim';
  b.textContent = label;
  b.disabled = !enabled;
  if (enabled) b.addEventListener('click', () => { unlock(); onClick(); });
  return b;
}

function renderDaily(body) {
  state.daily.list.forEach((q, i) => {
    const info = P.missionInfo(q, state.name);
    const pct = Math.min(100, (q.progress / q.target) * 100);
    const meta = `<span class="diff ${info.diff.id}">${info.diff.name}</span>
      <span>${info.progress}/${info.target}</span><span>· +${info.diff.xp} XP · +${info.diff.coins} 🪙</span>`;
    const label = info.claimed ? '✓' : info.done ? 'Reclamar' : `${Math.round(pct)} %`;
    body.append(questRow({
      emo: info.emo, text: info.text, metaHtml: meta, pct,
      cls: info.claimed ? 'claimed' : info.done ? 'done' : '',
      button: claimBtn(label, info.done && !info.claimed, () => {
        const r = P.claimMission(state, i);
        if (!r) return;
        sfx.happy(); burst('🎯', 3);
        gain(r);
        toast(`+${r.xp} XP y +${r.coins} 🪙`);
        persist(); renderQuests();
      }),
    }));
  });
  // premio por completar las tres
  const claimedN = state.daily.list.filter(q => q.claimed).length;
  const all = P.allMissionsDone(state);
  const b = P.DAILY_BONUS;
  body.append(questRow({
    emo: '🎁', text: 'Completa las 3 misiones del día',
    metaHtml: `<span>${claimedN}/3 reclamadas</span><span>· +${b.xp} XP · +${b.coins} 🪙</span>`,
    pct: (claimedN / 3) * 100,
    cls: state.daily.bonus ? 'claimed' : all ? 'done' : '',
    button: claimBtn(state.daily.bonus ? '✓' : 'Reclamar', all && !state.daily.bonus, () => {
      const r = P.claimBonus(state);
      if (!r) return;
      sfx.level(); burst('🎉', 6);
      say('¡Día completado!', 1800);
      gain(r);
      toast(`¡Bonus diario! +${r.xp} XP y +${r.coins} 🪙`, 3000);
      persist(); renderQuests();
    }),
  }));
  const foot = document.createElement('p');
  foot.className = 'quest-foot';
  foot.textContent = `Nuevas misiones en ${fmtReset()}. La experiencia también sube el pase de batalla.`;
  body.append(foot);
}

function tierReward(t) {
  const r = P.rewardFor(t);
  if (r.type === 'cosmetic') {
    const c = cosmetic(r.id);
    return { ...r, emo: c.emo, label: c.name, special: true };
  }
  return { ...r, special: r.type !== 'coins' };
}

function renderPass(body) {
  const p = state.pass;
  const need = P.passNeed(p.tier + 1);
  const pending = P.passPending(state);
  const head = document.createElement('div');
  head.className = 'pass-head';
  head.innerHTML = `<div class="pass-lvl"><div><small>Nivel</small><strong>${p.tier}</strong></div></div>
    <div class="pass-prog">${Math.floor(p.xp)} / ${need} XP para el nivel ${p.tier + 1}
      <span class="qbar"><span style="width:${Math.min(100, p.xp / need * 100)}%"></span></span></div>`;
  head.append(claimBtn(pending ? `Reclamar (${pending})` : 'Al día ✓', pending > 0, () => claimPassUpTo(Infinity)));
  body.append(head);

  // El pase no acaba nunca: se pintan unos cuantos niveles alrededor del progreso actual.
  const track = document.createElement('div');
  track.className = 'pass-track';
  const from = Math.max(1, p.claimed - 1);
  const to = Math.max(p.tier, p.claimed) + 14;
  let focus = null;
  for (let t = from; t <= to; t++) {
    const r = tierReward(t);
    const got = t <= p.claimed;
    const ready = !got && t <= p.tier;
    const card = document.createElement('div');
    card.className = 'tier' + (got ? ' got' : ready ? ' ready' : ' locked') + (r.special ? ' special' : '');
    card.innerHTML = `<span class="tnum">Nv. ${t}</span><span class="emo" aria-hidden="true">${r.emo}</span><span class="tname">${r.label}</span>`;
    if (got) card.append(claimBtn('✓', false));
    else if (ready) card.append(claimBtn('Reclamar', true, () => claimPassUpTo(t)));
    else card.append(claimBtn(`🔒 ${P.passNeed(t)} XP`, false));
    if (!focus && !got) focus = card;
    track.append(card);
  }
  body.append(track);
  if (focus) requestAnimationFrame(() => { track.scrollLeft = Math.max(0, focus.offsetLeft - track.offsetLeft - 8); });

  const note = document.createElement('p');
  note.className = 'pass-note';
  note.textContent = 'El pase no tiene final: cada nivel pide un poco más de experiencia que el anterior. Hay cosméticos exclusivos en los niveles 5, 10, 20, 30 y 50.';
  body.append(note);
}

function claimPassUpTo(t) {
  const got = P.claimPass(state, t);
  if (!got.length) return;
  let coins = 0;
  const news = [];
  for (const r of got) {
    if (r.coins) coins += r.coins;
    if (r.type === 'snack') S.apply(state, { food: 25, energy: 20, fun: 25, hygiene: 10 });
    if (r.type === 'cosmetic' && !state.owned.includes(r.id)) {
      state.owned.push(r.id);
      news.push(cosmetic(r.id));
    }
  }
  if (coins) gain({ coins });
  sfx.level(); burst('🏆', 4);
  if (news.length) {
    const c = news[news.length - 1];
    state.equipped[c.slot] = c.id;
    world.setCosmetics(state.equipped);
    world.squish();
    say(`¡Mira: ${c.name.toLowerCase()} del pase!`, 2200);
    toast(`Nuevo cosmético: ${news.map(n => n.emo + ' ' + n.name).join(', ')}. Lo tienes en la tienda.`, 3600);
  } else if (got.some(r => r.type === 'snack')) {
    say('¡Merienda de campeón!', 1800);
    toast(`¡Recompensa! +${coins} 🪙 y una merienda que sube todas sus necesidades.`, 3000);
  } else {
    toast(`¡Recompensa${got.length > 1 ? 's' : ''} del pase! +${coins} 🪙`, 2600);
  }
  persist();
  renderHud();
  renderQuests();
}

// ---------------- menú ----------------
function setupMenu() {
  const dlg = $('#menu');
  const open = () => {
    $('#name-input').value = state.name;
    const days = Math.max(1, Math.round((Date.now() - state.createdAt) / 86400000));
    $('#stats-line').textContent = `${S.title(state.level)}. ${state.commits} commits, ${state.bugs} bugs aplastados, ${days} día${days > 1 ? 's' : ''} juntos.`;
    paintAccountBox();
    dlg.showModal();
  };
  $('#resend-verify-btn').addEventListener('click', async () => {
    const r = await Auth.resendVerification();
    toast(r.ok ? 'Correo de verificación enviado.' : r.error);
  });
  $('#signout-btn').addEventListener('click', async () => {
    if (!confirm('¿Cerrar sesión? Tu progreso ya está guardado en la nube.')) return;
    await Auth.signOutUser();
    location.reload();
  });
  $('#account-login-btn').addEventListener('click', () => location.reload());
  $('#menu-btn').addEventListener('click', open);
  $('#shop-btn').addEventListener('click', () => { unlock(); sfx.tap(); openShop(); });
  $('#shop-close').addEventListener('click', () => shop.close());
  shop.addEventListener('close', () => {
    world.showBack(false);
    if (preview) { preview = null; world.setCosmetics(state.equipped); }
  });
  $('#fridge-close').addEventListener('click', () => fridge.close());
  fridge.addEventListener('close', () => { world.liftView(0); if (state.room === 'cocina') renderActions(); });
  document.querySelectorAll('#fridge [data-cat]').forEach(t => t.addEventListener('click', () => { sfx.tap(); fridgeCat = t.dataset.cat; renderFridge(); }));
  $('#quests-btn').addEventListener('click', () => { unlock(); sfx.tap(); quests.open ? quests.close() : openQuests(); });
  $('#quests-close').addEventListener('click', () => quests.close());
  document.querySelectorAll('#quests [data-tab]').forEach(t => t.addEventListener('click', () => { sfx.tap(); questTab = t.dataset.tab; renderQuests(); }));
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    if (shop.open) shop.close();
    if (quests.open) quests.close();
    if (fridge.open) fridge.close();
    closeGames();
  });
  $('#pet-name').addEventListener('click', open);
  $('#reset-btn').addEventListener('click', (e) => {
    if (!confirm('¿Seguro? Se borrará todo el progreso de tu Wapuu.')) { e.preventDefault(); return; }
  });
  dlg.addEventListener('close', async () => {
    if (dlg.returnValue === 'save') {
      const n = $('#name-input').value.trim();
      if (n) { state.name = n; world.name = n; world.setMode(state.mode); }
    }
    if (dlg.returnValue === 'reset') {
      state = S.reset();
      state.createdAt = Date.now();
      localStorage.removeItem('wapuu-game-v1');
      if (currentUid) await Auth.saveCloudSave(currentUid, state);
      location.reload();
      return;
    }
    persist();
    renderHud();
  });
  const mute = $('#mute');
  const paint = () => { mute.textContent = isMuted() ? '🔇' : '🔊'; };
  paint();
  mute.addEventListener('click', () => { toggleMute(); paint(); });
}

// ---------------- pantalla de acceso ----------------
let authMode = 'signin';
let skipToGuest = null;

function setupAuthScreen() {
  const screen = $('#auth-screen');
  const form = $('#auth-form');
  const email = $('#auth-email');
  const pass = $('#auth-password');
  const pass2 = $('#auth-password2');
  const pass2Field = $('#auth-pass2-field');
  const passField = $('#auth-pass-field');
  const hint = $('#auth-hint');
  const err = $('#auth-error');
  const ok = $('#auth-ok');
  const submit = $('#auth-submit');
  const tabs = document.querySelectorAll('.auth-tabs button');
  const togglePass = $('#auth-toggle-pass');

  const HINTS = {
    signin: 'Entra para jugar en cualquier dispositivo sin perder el progreso.',
    signup: 'Crea una cuenta para guardar tu partida en la nube.',
    reset: 'Te enviaremos un correo para restablecer tu contraseña.',
  };
  const LABELS = { signin: 'Entrar', signup: 'Crear cuenta', reset: 'Enviar correo' };

  function setMode(m) {
    authMode = m;
    tabs.forEach(t => t.setAttribute('aria-selected', t.dataset.mode === m ? 'true' : 'false'));
    hint.textContent = HINTS[m];
    submit.textContent = LABELS[m];
    passField.hidden = m === 'reset';
    pass.required = m !== 'reset';
    pass2Field.hidden = m !== 'signup';
    pass2.required = m === 'signup';
    pass.autocomplete = m === 'signup' ? 'new-password' : 'current-password';
    err.hidden = true; ok.hidden = true;
  }
  tabs.forEach(t => t.addEventListener('click', () => setMode(t.dataset.mode)));
  setMode('signin');

  togglePass.addEventListener('click', () => {
    const show = pass.type === 'password';
    pass.type = show ? 'text' : 'password';
    togglePass.textContent = show ? '🙈' : '👁️';
    togglePass.setAttribute('aria-label', show ? 'Ocultar contraseña' : 'Mostrar contraseña');
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    err.hidden = true; ok.hidden = true;
    const emailVal = email.value.trim();
    if (!emailVal) return;
    submit.disabled = true;
    try {
      if (authMode === 'signin') {
        const r = await Auth.signIn(emailVal, pass.value);
        if (r.error) { err.textContent = r.error; err.hidden = false; }
      } else if (authMode === 'signup') {
        if (pass.value.length < 6) { err.textContent = 'La contraseña debe tener al menos 6 caracteres.'; err.hidden = false; return; }
        if (pass.value !== pass2.value) { err.textContent = 'Las contraseñas no coinciden.'; err.hidden = false; return; }
        const r = await Auth.signUp(emailVal, pass.value);
        if (r.error) { err.textContent = r.error; err.hidden = false; }
      } else if (authMode === 'reset') {
        const r = await Auth.resetPassword(emailVal);
        if (r.error) { err.textContent = r.error; err.hidden = false; }
        else { ok.textContent = 'Te hemos enviado un correo para restablecer tu contraseña.'; ok.hidden = false; }
      }
    } finally {
      submit.disabled = false;
    }
  });

  $('#auth-skip').addEventListener('click', () => {
    screen.hidden = true;
    if (skipToGuest) skipToGuest();
  });
}

// Espera a que haya sesión (o a que el usuario elija jugar sin cuenta).
function resolveAuth() {
  return new Promise((resolve) => {
    let settled = false;
    skipToGuest = () => {
      if (settled) return;
      settled = true;
      resolve({ uid: null, state: null, cloudMs: 0 });
    };
    Auth.onAuthChange(async (user) => {
      if (settled) {
        // La sesión cambia después de haber empezado a jugar (cierre o cambio de cuenta).
        if ((user?.uid || null) !== currentUid) location.reload();
        return;
      }
      if (!user) { $('#auth-screen').hidden = false; return; }
      settled = true;
      $('#auth-screen').hidden = true;
      const cloud = await Auth.loadCloudSave(user.uid);
      if (cloud) {
        resolve({ uid: user.uid, state: { ...S.load(), ...cloud.state }, cloudMs: cloud.updatedAtMs });
      } else {
        const ms = await Auth.saveCloudSave(user.uid, state);
        resolve({ uid: user.uid, state: null, cloudMs: ms || Date.now() });
      }
    });
  });
}

// Un dispositivo abierto sin tocar comprueba si hay una partida más reciente en la nube.
function startCloudPolling() {
  setInterval(async () => {
    if (!currentUid || document.hidden || cloudTimer) return;
    if (performance.now() - lastInteraction < 20000) return;
    const remoteMs = await Auth.peekCloudUpdatedAt(currentUid);
    if (remoteMs <= lastCloudMs) return;
    const cloud = await Auth.loadCloudSave(currentUid);
    if (!cloud || cloud.updatedAtMs <= lastCloudMs) return;
    state = { ...state, ...cloud.state };
    P.ensureProgress(state);
    lastCloudMs = cloud.updatedAtMs;
    S.save(state);
    world.name = state.name;
    world.commits = state.commits;
    world.setGrowth(S.stage(state.level));
    world.setCosmetics(state.equipped);
    world.setMode(state.mode);
    enterRoom(state.room || 'salon');
    world.setMood(S.mood(state));
    toast('Partida actualizada desde otro dispositivo.', 3000);
  }, 30000);
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

  setupAuthScreen();
  const authP = resolveAuth();

  const worldP = (async () => {
    try {
      await document.fonts?.load('600 24px "Fira Code"');
      await document.fonts?.load('900 52px "Grandstander"');
    } catch (e) {}
    try {
      await world.load(p => { bar.style.width = (5 + p * 95) + '%'; });
      return true;
    } catch (e) {
      $('#loader-text').textContent = 'No se ha podido cargar a Wapuu. Revisa tu conexión y recarga la página.';
      console.error(e);
      return false;
    }
  })();

  const auth = await authP;
  currentUid = auth.uid;
  lastCloudMs = auth.cloudMs || 0;
  if (auth.state) { state = auth.state; isNew = false; }

  if (!(await worldP)) return;

  const away = S.catchUp(state);
  P.ensureProgress(state);
  world.name = state.name;
  world.commits = state.commits;
  world.onCommit = onCommit;
  world.mode = state.mode;
  world.setGrowth(S.stage(state.level));
  world.setCosmetics(state.equipped);
  world.setDirt(dirtLevel());

  document.querySelectorAll('#rooms button[data-room]').forEach(b => b.addEventListener('click', () => { unlock(); sfx.tap(); closeGames(); goRoom(b.dataset.room); }));
  world.setMode(state.mode);
  enterRoom(state.room || 'salon');
  world.setMood(S.mood(state));
  setupPointer();
  setupMenu();
  setupGames();
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
  startCloudPolling();

  document.addEventListener('visibilitychange', () => { if (document.hidden) saveNow(); else { S.catchUp(state); renderHud(); } });
  window.addEventListener('pagehide', saveNow);
  loop();
}

start();
