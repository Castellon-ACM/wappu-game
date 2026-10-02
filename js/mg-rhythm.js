// 🎹 Ritmo de commits: las notas caen por tres carriles y hay que tocarlas al llegar a la línea.
// La canción se compone sola mientras juegas y la melodía SOLO suena cuando aciertas: tú la tocas.
// Es infinita: cada 8 compases sube el tempo. Se acaba cuando la estabilidad del servidor llega a 0.

const LANES = [
  { c: '#38D6F5', label: '{ }' },
  { c: '#F6C928', label: '</>' },
  { c: '#FF5FA2', label: ';' },
];
// pentatónica de do en dos octavas y media
const SCALE = [261.63, 293.66, 329.63, 392.0, 440.0, 523.25, 587.33, 659.25, 783.99, 880.0];
const PROG = [[130.81, 164.81, 196.0], [196.0, 246.94, 293.66], [220.0, 261.63, 329.63], [174.61, 220.0, 261.63]]; // I V vi IV
const TRAVEL = 1.55;
const PERFECT = 0.07, GOOD = 0.15;

export default {
  id: 'rhythm',
  emo: '🎹',
  icon: 'key-1',
  name: 'Ritmo de commits',
  desc: 'Toca las notas a tiempo: la melodía la pones tú.',
  how: 'Toca cada carril cuando su nota llegue a la línea. <b>La melodía solo suena si aciertas.</b><br>Cada 8 compases va más rápido. Si fallas mucho, el servidor se cae.',
  color: '#B794F6',
  medals: [3000, 15000, 50000],
  coinsPer: 450,
  coinsCap: 40,

  create(api) {
    const C = window.AudioContext || window.webkitAudioContext;
    const ac = C ? new C() : null;
    const master = ac ? ac.createGain() : null;
    if (ac) { master.gain.value = api.isMuted() ? 0 : 0.9; master.connect(ac.destination); ac.resume?.(); }
    let t0 = null;                 // momento de inicio en el reloj de audio
    let fallback = 0;              // reloj si no hay audio
    let bpm = 96, bar = 0, nextBar = 0.6, lastLane = 1;
    let seed = 7;
    const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
    const notes = [];
    const flash = [0, 0, 0];
    let combo = 0, best = 0, stability = 100, judge = null;
    const now = () => (t0 == null ? 0 : ac ? ac.currentTime - t0 : fallback);

    const self = {
      score: 0, over: false,
      extra: () => `Servidor <b>${Math.round(stability)}%</b> · ${Math.round(bpm)} BPM${combo >= 5 ? ` · Combo <b>${combo}</b>` : ''}`,
      begin() { t0 = ac ? ac.currentTime + 0.05 : 0; },
      update, draw, pointer,
      pause() { ac?.suspend?.(); },
      resume() { ac?.resume?.(); },
      destroy() { setTimeout(() => ac?.close?.(), 300); },
    };

    // ---------- sonido ----------
    function osc(type, f, at, dur, vol, f2) {
      if (!ac) return;
      const o = ac.createOscillator(), g = ac.createGain();
      o.type = type; o.frequency.setValueAtTime(f, at);
      if (f2) o.frequency.exponentialRampToValueAtTime(f2, at + dur);
      g.gain.setValueAtTime(0.0001, at);
      g.gain.exponentialRampToValueAtTime(vol, at + 0.008);
      g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
      o.connect(g).connect(master); o.start(at); o.stop(at + dur + 0.05);
    }
    function hat(at) {
      if (!ac) return;
      const len = Math.floor(ac.sampleRate * 0.05), buf = ac.createBuffer(1, len, ac.sampleRate), d = buf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
      const s = ac.createBufferSource(), f = ac.createBiquadFilter(), g = ac.createGain();
      s.buffer = buf; f.type = 'highpass'; f.frequency.value = 7000; g.gain.value = 0.12;
      s.connect(f).connect(g).connect(master); s.start(at);
    }
    const pluck = (f, at) => { osc('triangle', f, at, 0.35, 0.28); osc('sine', f * 2, at, 0.18, 0.08); };

    // ---------- composición ----------
    function composeBar() {
      const beat = 60 / bpm, eighth = beat / 2;
      const level = Math.floor(bar / 8);
      const chord = PROG[bar % 4];
      const at = (t) => (ac ? t0 + t : 0);
      // base: bombo, charles y bajo
      for (let b = 0; b < 4; b++) {
        const tb = nextBar + b * beat;
        osc('sine', 120, at(tb), 0.22, 0.5, 45);
        hat(at(tb + eighth));
        if (b % 2 === 0) osc('square', chord[0] / 2, at(tb), beat * 0.9, 0.05);
      }
      // notas que hay que tocar
      const density = Math.min(0.78, 0.3 + level * 0.07);
      for (let e = 0; e < 8; e++) {
        const onBeat = e % 2 === 0;
        if (!onBeat && level < 1) continue;
        if (rnd() > (onBeat ? density + 0.2 : density)) continue;
        let lane = Math.max(0, Math.min(2, lastLane + Math.floor(rnd() * 3) - 1));
        if (rnd() < 0.25) lane = Math.floor(rnd() * 3);
        lastLane = lane;
        const deg = Math.min(SCALE.length - 1, lane * 3 + Math.floor(rnd() * 4));
        const t = nextBar + e * eighth;
        notes.push({ t, lane, f: SCALE[deg], hit: false, miss: false });
        if (level >= 3 && onBeat && rnd() < 0.12) {
          const l2 = (lane + 1 + Math.floor(rnd() * 2)) % 3;
          notes.push({ t, lane: l2, f: SCALE[Math.min(SCALE.length - 1, l2 * 3 + 1)], hit: false, miss: false });
        }
      }
      nextBar += beat * 4;
      bar += 1;
      if (bar % 8 === 0) {
        bpm = Math.min(172, bpm + 7);
        api.text(api.w / 2, api.h * 0.32, `¡Más rápido! ${bpm} BPM`, '#F6C928', 26);
      }
    }

    // ---------- lógica ----------
    function update(dt) {
      if (!ac) fallback += dt;
      const t = now();
      while (nextBar < t + TRAVEL + 1.2) composeBar();
      for (let i = 0; i < 3; i++) flash[i] = Math.max(0, flash[i] - dt * 4);
      for (const n of notes) {
        if (!n.hit && !n.miss && t - n.t > GOOD) {
          n.miss = true; combo = 0; stability -= 9;
          judge = { txt: 'Fallo', c: '#FF6B6B', t: 0.6 };
          osc('sawtooth', 90, ac ? ac.currentTime : 0, 0.15, 0.08, 60);
        }
      }
      while (notes.length && notes[0].t < t - 1) notes.shift();
      if (judge) judge.t -= dt;
      if (stability <= 0) { stability = 0; self.over = true; }
    }

    function pointer(type, x) {
      if (type !== 'down' || t0 == null) return;
      const lane = Math.max(0, Math.min(2, Math.floor(x / (api.w / 3))));
      flash[lane] = 1;
      const t = now();
      let bestN = null;
      for (const n of notes) {
        if (n.lane !== lane || n.hit || n.miss) continue;
        const d = Math.abs(n.t - t);
        if (d <= GOOD && (!bestN || d < Math.abs(bestN.t - t))) bestN = n;
      }
      if (!bestN) { stability -= 2; combo = 0; return; }
      bestN.hit = true;
      const d = Math.abs(bestN.t - t);
      const perfect = d <= PERFECT;
      combo += 1; best = Math.max(best, combo);
      const mult = Math.min(4, 1 + Math.floor(combo / 10));
      self.score += (perfect ? 100 : 50) * mult;
      stability = Math.min(100, stability + (perfect ? 2 : 1));
      judge = perfect ? { txt: '¡Perfecto!', c: '#9BE8C4', t: 0.5 } : { txt: 'Bien', c: '#FFFFFF', t: 0.5 };
      pluck(bestN.f, ac ? ac.currentTime : 0);
      const lw = api.w / 3;
      api.burst(lw * lane + lw / 2, api.h - 130, LANES[lane].c, perfect ? 14 : 7, 200);
      if (combo > 0 && combo % 25 === 0) api.text(api.w / 2, api.h * 0.45, `¡Combo ${combo}!`, '#F6C928', 30);
    }

    // ---------- dibujo ----------
    function rr(g, x, y, w, h, r) { g.beginPath(); g.roundRect ? g.roundRect(x, y, w, h, r) : g.rect(x, y, w, h); }
    function draw(g, w, h) {
      const t = now();
      g.fillStyle = '#12142A'; g.fillRect(0, 0, w, h);
      // código de fondo
      g.font = '600 12px "Fira Code", monospace'; g.fillStyle = 'rgba(155,225,93,.10)'; g.textAlign = 'left';
      const lines = ['add_action( "init", "wapuu" );', 'function commit() {', '  return deploy();', '}', 'git push origin main', '$posts = get_posts();'];
      for (let i = 0; i < 26; i++) g.fillText(lines[i % lines.length], 10 + (i * 37) % 60, ((i * 34 + t * 40) % (h + 40)) - 20);
      const lw = w / 3, hitY = h - 130, topY = -40;
      for (let i = 0; i < 3; i++) {
        const x = i * lw;
        g.fillStyle = `rgba(255,255,255,${0.03 + flash[i] * 0.12})`; g.fillRect(x + 4, 0, lw - 8, h);
        g.strokeStyle = 'rgba(255,255,255,.08)'; g.lineWidth = 2; g.beginPath(); g.moveTo(x, 0); g.lineTo(x, h); g.stroke();
        // diana: aro 3D que late al tocar
        api.draw(g, `ring-${i}`, x + lw / 2, hitY, 70 * (1 + flash[i] * 0.18), 70 * (1 + flash[i] * 0.18), 0, 0.65 + flash[i] * 0.35);
      }
      g.fillStyle = 'rgba(255,255,255,.18)'; g.fillRect(0, hitY - 2, w, 4);
      // notas
      for (const n of notes) {
        if (n.hit) continue;
        const k = (n.t - t) / TRAVEL;
        if (k > 1.1) continue;
        const y = hitY - k * (hitY - topY);
        const x = n.lane * lw + lw / 2;
        // tecla 3D (lleva su símbolo grabado)
        const kw = Math.min(lw * 0.78, 120);
        api.draw(g, `key-${n.lane}`, x, y, kw, kw * 0.6, 0, n.miss ? 0.3 : 1);
      }
      // pistas de dónde tocar
      g.font = '700 13px Grandstander, system-ui, sans-serif'; g.fillStyle = 'rgba(255,255,255,.45)'; g.textAlign = 'center';
      for (let i = 0; i < 3; i++) g.fillText('toca aquí', i * lw + lw / 2, h - 60);
      if (judge && judge.t > 0) {
        g.font = '900 30px Grandstander, system-ui, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
        g.globalAlpha = Math.min(1, judge.t * 3); g.lineWidth = 6; g.strokeStyle = '#1E1E1E';
        g.strokeText(judge.txt, w / 2, hitY - 90); g.fillStyle = judge.c; g.fillText(judge.txt, w / 2, hitY - 90); g.globalAlpha = 1;
      }
      if (combo >= 10) {
        g.font = '900 16px Grandstander, system-ui, sans-serif'; g.fillStyle = '#F6C928'; g.textAlign = 'center';
        g.fillText(`x${Math.min(4, 1 + Math.floor(combo / 10))}`, w / 2, hitY - 125);
      }
      if (stability < 30) { g.fillStyle = `rgba(255,60,60,${0.1 + 0.08 * Math.sin(t * 12)})`; g.fillRect(0, 0, w, h); }
    }

    return self;
  },
};
