// Sonidos sintetizados con WebAudio: sin archivos que descargar.
let ctx = null;
let muted = false;
try { muted = localStorage.getItem('wapuu-muted') === '1'; } catch (e) {}

function ac() {
  if (!ctx) {
    const C = window.AudioContext || window.webkitAudioContext;
    if (!C) return null;
    ctx = new C();
  }
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

function tone({ f = 440, f2 = null, t = 0.12, type = 'sine', vol = 0.18, delay = 0 }) {
  if (muted) return;
  const a = ac(); if (!a) return;
  const o = a.createOscillator();
  const g = a.createGain();
  const t0 = a.currentTime + delay;
  o.type = type;
  o.frequency.setValueAtTime(f, t0);
  if (f2) o.frequency.exponentialRampToValueAtTime(f2, t0 + t);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(vol, t0 + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + t);
  o.connect(g).connect(a.destination);
  o.start(t0); o.stop(t0 + t + 0.02);
}

function noise(t = 0.6, vol = 0.12) {
  if (muted) return;
  const a = ac(); if (!a) return;
  const len = Math.floor(a.sampleRate * t);
  const buf = a.createBuffer(1, len, a.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const src = a.createBufferSource();
  const filt = a.createBiquadFilter();
  filt.type = 'lowpass'; filt.frequency.value = 900;
  const g = a.createGain(); g.gain.value = vol;
  src.buffer = buf;
  src.connect(filt).connect(g).connect(a.destination);
  src.start();
}

export const sfx = {
  tap:   () => tone({ f: 660, t: 0.06, type: 'triangle', vol: 0.12 }),
  chomp: () => { tone({ f: 220, f2: 120, t: 0.1, type: 'square', vol: 0.08 }); tone({ f: 240, f2: 130, t: 0.1, type: 'square', vol: 0.08, delay: 0.18 }); },
  coin:  () => { tone({ f: 988, t: 0.08, type: 'square', vol: 0.07 }); tone({ f: 1319, t: 0.16, type: 'square', vol: 0.07, delay: 0.07 }); },
  happy: () => { [523, 659, 784].forEach((f, i) => tone({ f, t: 0.12, type: 'triangle', vol: 0.12, delay: i * 0.08 })); },
  sad:   () => tone({ f: 330, f2: 220, t: 0.35, type: 'sine', vol: 0.12 }),
  pop:   () => tone({ f: 900, f2: 1500, t: 0.05, type: 'sine', vol: 0.06 }),
  squash:() => tone({ f: 180, f2: 60, t: 0.12, type: 'sawtooth', vol: 0.08 }),
  flush: () => noise(1.1, 0.16),
  water: () => noise(0.5, 0.06),
  level: () => { [523, 659, 784, 1047].forEach((f, i) => tone({ f, t: 0.18, type: 'square', vol: 0.07, delay: i * 0.1 })); },
  boing: () => tone({ f: 200, f2: 600, t: 0.2, type: 'sine', vol: 0.15 }),
  snore: () => tone({ f: 110, f2: 90, t: 0.6, type: 'sine', vol: 0.05 }),
};

export function isMuted() { return muted; }
export function toggleMute() {
  muted = !muted;
  try { localStorage.setItem('wapuu-muted', muted ? '1' : '0'); } catch (e) {}
  if (!muted) sfx.tap();
  return muted;
}
export function unlock() { ac(); }
