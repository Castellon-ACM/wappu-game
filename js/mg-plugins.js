// 🔌 Enchufa plugins: el núcleo de WordPress gira y hay que clavarle plugins sin chocar con los que ya están.
// Cada fase cambia la forma de girar (constante, al revés, vaivén, a tirones). Cada 5 fases, un jefe: el núcleo de spam.
// Las galletas del borde dan puntos extra; los bugs clavados de antes estorban. Hay 2 vidas.

const GAP = 0.25;        // separación mínima (radianes) entre plugins
const SPEED = 1500;      // velocidad del plugin lanzado (px/s)
const N_COLORS = 6;               // plugins de colores: dibujos 3D plug-0 … plug-5 (mg-sprites.js)
const PW = 34, PH = 56;           // tamaño del plugin en pantalla
const PATTERNS = ['constante', 'al revés', 'vaivén', 'a tirones'];

export default {
  id: 'plugins',
  emo: '🔌',
  icon: 'plug-0',
  name: 'Enchufa plugins',
  desc: 'Clava plugins en el núcleo sin chocar.',
  how: 'Toca para lanzar un plugin al núcleo que gira. <b>No choques con los que ya están clavados.</b><br>{cookie} en el borde dan puntos · {bug} estorban · cada 5 fases, un jefe {boss}',
  color: '#F08A24',
  medals: [400, 1500, 4000],
  coinsPer: 50,
  coinsCap: 40,

  create(api) {
    let stage = 0, lives = 2, t = 0;
    let core = null, flying = null, falling = [], waitT = 0, msg = null;
    const self = {
      score: 0, over: false,
      extra: () => `Fase <b>${stage}</b>${core?.boss ? ' · <b>JEFE</b>' : ''} · ${api.icon('heart').repeat(lives)}${api.icon('heart-empty').repeat(Math.max(0, 2 - lives))}`,
      update, draw, pointer,
    };

    const geo = () => {
      const R = Math.min(api.w * 0.22, 92) * (core?.boss ? 1.15 : 1);
      return { cx: api.w / 2, cy: api.h * 0.34, R, launchY: api.h - 110 };
    };

    function nextStage() {
      stage += 1;
      const boss = stage % 5 === 0;
      const pattern = boss ? 'jefe' : PATTERNS[(stage - 1) % 4];
      const need = boss ? 12 : 5 + Math.min(stage, 6);
      const items = [];
      const nBugs = boss ? 3 : Math.min(5, Math.floor(stage / 2));
      const nCookies = 1 + Math.floor(Math.random() * 3);
      const free = (a) => items.every(i => Math.abs(angDiff(i.a, a)) > GAP * 1.4);
      for (let k = 0, tries = 0; k < nBugs && tries < 60; tries++) { const a = Math.random() * Math.PI * 2; if (free(a)) { items.push({ kind: 'bug', a }); k++; } }
      for (let k = 0, tries = 0; k < nCookies && tries < 60; tries++) { const a = Math.random() * Math.PI * 2; if (free(a)) { items.push({ kind: 'cookie', a }); k++; } }
      core = { rot: 0, speed: 1.5 + stage * 0.1, dir: 1, pattern, boss, need, done: 0, items, timer: 0, burst: 0 };
      if (pattern === 'al revés') core.dir = -1;
      msg = { txt: boss ? '¡JEFE: el núcleo de spam!' : `Fase ${stage} · gira ${pattern}`, t: 1.6 };
      if (boss) api.sfx.sad(); else api.sfx.boing();
    }
    nextStage();

    function angDiff(a, b) { let d = (a - b) % (Math.PI * 2); if (d > Math.PI) d -= Math.PI * 2; if (d < -Math.PI) d += Math.PI * 2; return d; }

    function rotSpeed(dt) {
      const c = core;
      c.timer += dt;
      if (c.pattern === 'vaivén') return c.speed * 1.6 * Math.sin(c.timer * 1.3);
      if (c.pattern === 'a tirones') return c.speed * (Math.floor(c.timer / 1.1) % 2 ? 2.2 : 0.25);
      if (c.pattern === 'jefe') {
        if (c.timer > (c.flipAt ||= 1.5)) { c.dir *= -1; c.flipAt = c.timer + 1.2 + Math.random() * 1.8; }
        return c.speed * 1.35 * c.dir;
      }
      return c.speed * c.dir;
    }

    function update(dt) {
      t += dt;
      if (msg) { msg.t -= dt; if (msg.t <= 0) msg = null; }
      for (const f of falling) { f.vy += 1400 * dt; f.y += f.vy * dt; f.x += f.vx * dt; f.spin += dt * 9; }
      falling = falling.filter(f => f.y < api.h + 80);
      if (waitT > 0) { waitT -= dt; if (waitT <= 0) nextStage(); return; }
      core.rot += rotSpeed(dt) * dt;
      if (!flying) return;
      const { cy, R } = geo();
      flying.y -= SPEED * dt;
      if (flying.y <= cy + R + 2) {
        // el plugin toca el núcleo por abajo; en coordenadas del núcleo (que gira) eso es el ángulo −giro
        const a = -core.rot;
        const hit = core.items.find(i => (i.kind === 'plug' || i.kind === 'bug') && Math.abs(angDiff(i.a, a)) < GAP);
        if (hit) {
          lives -= 1;
          api.shake(0.35); api.sfx.sad();
          falling.push({ x: flying.x, y: flying.y + PH / 2, vx: (Math.random() - 0.5) * 300, vy: 200, spin: 0, color: flying.color });
          api.text(flying.x, flying.y - 60, '¡Choque!', '#FF6B6B', 28);
          flying = null;
          if (lives <= 0) self.over = true;
          return;
        }
        const cookie = core.items.find(i => i.kind === 'cookie' && Math.abs(angDiff(i.a, a)) < GAP * 0.9);
        if (cookie) {
          core.items.splice(core.items.indexOf(cookie), 1);
          self.score += 25;
          api.text(api.w / 2, cy + R + 30, '+25 galleta', '#F6C928', 24); api.sfx.coin();
        }
        core.items.push({ kind: 'plug', a, color: flying.color });
        core.done += 1;
        self.score += 10 + stage * 2;
        api.sfx.chomp();
        api.burst(api.w / 2, cy + R, '#FFFFFF', 6, 120);
        flying = null;
        if (core.done >= core.need) {
          const bonus = (core.boss ? 150 : 50) * stage;
          self.score += bonus;
          const g = geo();
          api.burst(g.cx, g.cy, core.boss ? '#B794F6' : '#38D6F5', 40, 380);
          api.burst(g.cx, g.cy, '#F6C928', 20, 260);
          api.text(g.cx, g.cy, `¡Fase superada! +${bonus}`, '#F6C928', 26);
          if (core.boss) { lives = Math.min(2, lives + 1); api.text(g.cx, g.cy + 40, '+1 vida', '#FF5FA2', 26); }
          api.sfx.level();
          core.burst = 1;
          waitT = 0.9;
        }
      }
    }

    function pointer(type) {
      if (type !== 'down' || flying || waitT > 0) return;
      const { launchY } = geo();
      flying = { x: api.w / 2, y: launchY - 10, color: (stage + core.done) % N_COLORS };
      api.sfx.tap();
    }

    // Plugin 3D con las patas hacia arriba: (x, top) es la punta de las patas.
    const plug = (g, color, x, top, rot = 0) => api.draw(g, `plug-${color}`, x, top + PH / 2, PW, PH, rot);

    function draw(g, w, h) {
      const grd = g.createLinearGradient(0, 0, 0, h);
      grd.addColorStop(0, core?.boss ? '#2A1033' : '#14213D'); grd.addColorStop(1, core?.boss ? '#5B1E3A' : '#1D3A6B');
      g.fillStyle = grd; g.fillRect(0, 0, w, h);
      const { cx, cy, R, launchY } = geo();
      // estrellas
      g.fillStyle = 'rgba(255,255,255,.5)';
      for (let i = 0; i < 30; i++) { const x = (i * 97) % w, y = (i * 61) % (h * 0.8); g.fillRect(x, y, 2, 2); }
      if (core && !(waitT > 0 && core.burst)) {
        g.save(); g.translate(cx, cy); g.rotate(core.rot);
        // cosas clavadas (en el borde, mirando hacia fuera: en este marco, +y es hacia fuera)
        for (const it of core.items) {
          g.save(); g.rotate(it.a); g.translate(0, R);
          if (it.kind === 'plug') plug(g, it.color, 0, -10);
          else if (it.kind === 'bug') api.draw(g, 'bug', 0, 14, 40, 40, Math.PI);
          else api.draw(g, 'cookie', 0, 12, 34, 34);
          g.restore();
        }
        // núcleo 3D (gira con el resto)
        api.draw(g, core.boss ? 'boss' : 'core', 0, 0, R * (core.boss ? 2.55 : 2.2), R * (core.boss ? 2.55 : 2.2));
        g.restore();
        // plugins que faltan
        const left = core.need - core.done;
        api.draw(g, 'plug-0', 26, h - 38, 18, 30);
        g.font = '900 18px Grandstander, system-ui, sans-serif'; g.textAlign = 'left'; g.textBaseline = 'middle';
        g.lineWidth = 5; g.strokeStyle = '#1E1E1E'; g.strokeText(`× ${left}`, 40, h - 36);
        g.fillStyle = '#FFFFFF'; g.fillText(`× ${left}`, 40, h - 36);
      }
      // plugin preparado / volando
      if (flying) plug(g, flying.color, flying.x, flying.y);
      else if (waitT <= 0) {
        plug(g, (stage + (core?.done || 0)) % N_COLORS, w / 2, launchY - 10 + Math.sin(t * 6) * 3);
        g.font = '700 14px Grandstander, system-ui, sans-serif'; g.fillStyle = 'rgba(255,255,255,.55)'; g.textAlign = 'center';
        g.fillText('toca para lanzar', w / 2, launchY + 72);
      }
      for (const f of falling) api.draw(g, `plug-${f.color}`, f.x, f.y, PW, PH, f.spin);
      if (msg) {
        g.globalAlpha = Math.min(1, msg.t * 2);
        g.font = '900 24px Grandstander, system-ui, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
        g.lineWidth = 6; g.strokeStyle = '#1E1E1E'; g.strokeText(msg.txt, w / 2, cy + R + 90);
        g.fillStyle = core?.boss ? '#FF9EC9' : '#FFFFFF'; g.fillText(msg.txt, w / 2, cy + R + 90);
        g.globalAlpha = 1;
      }
    }

    return self;
  },
};
