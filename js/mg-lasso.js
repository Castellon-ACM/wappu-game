// 🫧 Lazo de pompas: suben pompas de colores y hay que rodearlas con el dedo.
// Rodear varias del mismo color a la vez multiplica los puntos (n² × 10) y encadenar lazos sube el combo.
// La pompa arcoíris vale por cualquier color, el reloj da tiempo y el bug lo quita.

const COLORS = [
  { c: '#3858E9', l: '#8EA2FF' },   // azul WordPress
  { c: '#FF5FA2', l: '#FFB3D3' },   // rosa
  { c: '#F6C928', l: '#FFE89A' },   // amarillo Wapuu
  { c: '#2FBF71', l: '#9BE8C4' },   // verde
];
const ROUND = 60;

function pointInPoly(x, y, pts) {
  let inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const a = pts[i], b = pts[j];
    if ((a.y > y) !== (b.y > y) && x < ((b.x - a.x) * (y - a.y)) / (b.y - a.y) + a.x) inside = !inside;
  }
  return inside;
}

export default {
  id: 'lasso',
  emo: '🫧',
  name: 'Lazo de pompas',
  desc: 'Rodea pompas del mismo color con el dedo.',
  how: 'Dibuja un lazo alrededor de pompas <b>del mismo color</b>. ¡Cuantas más en un solo lazo, muchos más puntos!<br>🌈 vale por cualquier color · ⏱️ da tiempo · 🐛 te lo quita.',
  color: '#8EC5FF',
  medals: [600, 2000, 5000],
  coinsPer: 60,
  coinsCap: 40,

  create(api) {
    const bubbles = [];
    let path = null;            // trazo del dedo
    let time = ROUND;
    let spawnT = 0, elapsed = 0, combo = 0, comboT = 0;
    const self = {
      score: 0,
      over: false,
      extra: () => `⏱️ <b>${Math.ceil(time)}</b>${combo > 1 ? ` · 🔥 combo x${Math.min(combo, 6)}` : ''}`,
      update,
      draw,
      pointer,
    };

    function spawn() {
      const r = 24 + Math.random() * 10;
      const roll = Math.random();
      let kind = 'color';
      if (elapsed > 6 && roll < 0.07) kind = 'bug';
      else if (roll < 0.11) kind = 'rainbow';
      else if (roll < 0.14 && time < ROUND - 5) kind = 'clock';
      const speed = 45 + Math.random() * 35 + elapsed * 1.4;
      bubbles.push({
        x: r + Math.random() * (api.w - 2 * r), y: api.h + r, r, kind,
        col: Math.floor(Math.random() * COLORS.length),
        vy: -speed, ph: Math.random() * 6, wob: 10 + Math.random() * 18, born: elapsed,
      });
    }
    for (let i = 0; i < 8; i++) { spawn(); bubbles[i].y = api.h * (0.35 + Math.random() * 0.6); }

    function update(dt) {
      elapsed += dt;
      time -= dt;
      if (time <= 0) { time = 0; self.over = true; return; }
      comboT -= dt;
      if (comboT <= 0) combo = 0;
      spawnT -= dt;
      const every = Math.max(0.28, 0.7 - elapsed * 0.007);
      while (spawnT <= 0) { spawn(); spawnT += every; }
      for (let i = bubbles.length - 1; i >= 0; i--) {
        const b = bubbles[i];
        b.y += b.vy * dt;
        b.ph += dt * 2;
        if (b.y < -b.r * 2) bubbles.splice(i, 1);
      }
    }

    function bx(b) { return b.x + Math.sin(b.ph) * b.wob; }

    function closeLasso() {
      if (!path || path.length < 8) { path = null; return; }
      const inside = bubbles.filter(b => pointInPoly(bx(b), b.y, path));
      path = null;
      if (!inside.length) return;
      const bugs = inside.filter(b => b.kind === 'bug');
      const clocks = inside.filter(b => b.kind === 'clock');
      const colored = inside.filter(b => b.kind === 'color');
      const rainbows = inside.filter(b => b.kind === 'rainbow');
      const cols = new Set(colored.map(b => b.col));
      const pop = (b, color) => { api.burst(bx(b), b.y, color, 10); bubbles.splice(bubbles.indexOf(b), 1); };

      if (bugs.length) {
        for (const b of bugs) pop(b, '#7B4FD6');
        time = Math.max(0, time - 5 * bugs.length);
        combo = 0;
        api.shake(0.3); api.sfx.sad();
        api.text(bx(bugs[0]), bugs[0].y, `-${5 * bugs.length}s 🐛`, '#FF6B6B', 26);
        return;
      }
      for (const b of clocks) { pop(b, '#FFFFFF'); time = Math.min(ROUND, time + 5); api.text(bx(b), b.y, '+5s ⏱️', '#9BE8C4', 24); api.sfx.coin(); }
      if (cols.size > 1) {
        // colores mezclados: no explota ninguna
        api.text(api.w / 2, api.h * 0.4, '¡Solo un color!', '#FFB3D3', 26);
        api.sfx.sad();
        combo = 0;
        return;
      }
      const group = [...colored, ...rainbows];
      if (group.length < 2) {
        if (group.length === 1 && !clocks.length) api.text(bx(group[0]), group[0].y, 'Mínimo 2', '#FFFFFF', 18);
        return;
      }
      const n = group.length;
      combo += 1; comboT = 2.2;
      const mult = Math.min(combo, 6);
      const pts = 10 * n * n * mult;
      self.score += pts;
      const col = cols.size ? COLORS[[...cols][0]].c : '#FFFFFF';
      const cx = group.reduce((s, b) => s + bx(b), 0) / n, cy = group.reduce((s, b) => s + b.y, 0) / n;
      for (const b of group) pop(b, col);
      api.text(cx, cy, `+${pts}${mult > 1 ? ` x${mult}` : ''}`, '#FFFFFF', 22 + Math.min(18, n * 2));
      if (n >= 6) api.text(cx, cy - 34, n >= 9 ? '¡BRUTAL!' : '¡Genial!', '#F6C928', 28);
      api.sfx.pop(); if (n >= 4) setTimeout(() => api.sfx.pop(), 80); if (n >= 6) api.sfx.coin();
    }

    function pointer(type, x, y) {
      if (type === 'down') { path = [{ x, y }]; return; }
      if (!path) return;
      if (type === 'move') {
        const l = path[path.length - 1];
        if (Math.hypot(x - l.x, y - l.y) < 6) return;
        path.push({ x, y });
        // si el trazo vuelve cerca del principio, el lazo se cierra solo y se puede seguir dibujando
        if (path.length > 18) {
          const f = path[0];
          if (Math.hypot(x - f.x, y - f.y) < 34) { closeLasso(); path = [{ x, y }]; }
        }
        if (path.length > 400) path.shift();
      }
      if (type === 'up') closeLasso();
    }

    function draw(g, w, h) {
      const grd = g.createLinearGradient(0, 0, 0, h);
      grd.addColorStop(0, '#1D2B6B'); grd.addColorStop(1, '#3B82D9');
      g.fillStyle = grd; g.fillRect(0, 0, w, h);
      // brillos de fondo
      g.fillStyle = 'rgba(255,255,255,.06)';
      for (let i = 0; i < 6; i++) { g.beginPath(); g.arc((i * 137) % w, (i * 251 + elapsed * 12) % h, 30 + i * 8, 0, Math.PI * 2); g.fill(); }

      for (const b of bubbles) {
        const x = bx(b), y = b.y, r = b.r;
        if (b.kind === 'color' || b.kind === 'rainbow') {
          let fill;
          if (b.kind === 'rainbow') {
            fill = g.createLinearGradient(x - r, y - r, x + r, y + r);
            ['#FF5F5F', '#F6C928', '#2FBF71', '#38D6F5', '#7B4FD6'].forEach((c, i) => fill.addColorStop(i / 4, c));
          } else {
            fill = g.createRadialGradient(x - r * 0.35, y - r * 0.35, r * 0.1, x, y, r);
            fill.addColorStop(0, COLORS[b.col].l); fill.addColorStop(1, COLORS[b.col].c);
          }
          g.fillStyle = fill;
          g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
          g.lineWidth = 3; g.strokeStyle = 'rgba(30,30,30,.55)'; g.stroke();
          // carita
          g.fillStyle = '#1E1E1E';
          g.beginPath(); g.arc(x - r * 0.28, y - r * 0.05, r * 0.1, 0, Math.PI * 2); g.arc(x + r * 0.28, y - r * 0.05, r * 0.1, 0, Math.PI * 2); g.fill();
          g.beginPath(); g.arc(x, y + r * 0.15, r * 0.18, 0.15 * Math.PI, 0.85 * Math.PI); g.lineWidth = 2; g.stroke();
          g.fillStyle = 'rgba(255,255,255,.7)';
          g.beginPath(); g.ellipse(x - r * 0.4, y - r * 0.45, r * 0.22, r * 0.12, -0.6, 0, Math.PI * 2); g.fill();
        } else {
          g.fillStyle = b.kind === 'bug' ? 'rgba(60,20,90,.85)' : 'rgba(255,255,255,.85)';
          g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
          g.lineWidth = 3; g.strokeStyle = b.kind === 'bug' ? '#B794F6' : '#2FBF71'; g.stroke();
          g.font = `${r * 1.15}px system-ui, sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
          g.fillText(b.kind === 'bug' ? '🐛' : '⏱️', x, y + 2);
        }
      }
      if (path && path.length > 1) {
        g.lineCap = 'round'; g.lineJoin = 'round';
        g.strokeStyle = 'rgba(255,255,255,.35)'; g.lineWidth = 14;
        g.beginPath(); g.moveTo(path[0].x, path[0].y); for (const p of path) g.lineTo(p.x, p.y); g.stroke();
        g.strokeStyle = '#FFFFFF'; g.lineWidth = 4; g.setLineDash([10, 8]); g.lineDashOffset = -elapsed * 60;
        g.stroke(); g.setLineDash([]);
        g.fillStyle = '#F6C928'; g.beginPath(); g.arc(path[0].x, path[0].y, 8, 0, Math.PI * 2); g.fill();
      }
      if (time < 10 && time > 0) {
        g.fillStyle = `rgba(255,80,80,${0.12 + 0.1 * Math.sin(elapsed * 10)})`;
        g.fillRect(0, 0, w, h);
      }
    }

    return self;
  },
};
