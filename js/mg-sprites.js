// Gráficos 3D de los minijuegos. Cada objeto (pompas, bichos, plugins, teclas, medallas…) se modela
// en 3D con three.js, con luces y brillos, y se "fotografía" una sola vez en una imagen. Los juegos
// dibujan después esas imágenes en su lienzo 2D, así que se ven en 3D pero van igual de fluidos.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

const sprites = {};
const urls = {};
let renderer = null, scene = null, camera = null;

export const BUBBLE_COLORS = [0x3858E9, 0xFF5FA2, 0xF6C928, 0x2FBF71];
export const LANE_COLORS = [0x38D6F5, 0xF6C928, 0xFF5FA2];
export const LANE_LABELS = ['{ }', '</>', ';'];
export const PLUG_COLORS = [0x3858E9, 0xFF5FA2, 0x2FBF71, 0xF08A24, 0x7B4FD6, 0x1FB5A8];

// ---------- materiales y piezas ----------
const toy = (color, o = {}) => new THREE.MeshPhongMaterial({ color, shininess: 70, specular: 0x555555, ...o });
const metal = (color = 0xC9CED6) => new THREE.MeshPhongMaterial({ color, shininess: 140, specular: 0xFFFFFF });
function mesh(geo, mat, x = 0, y = 0, z = 0) { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); return m; }
const ball = (r, mat, x, y, z) => mesh(new THREE.SphereGeometry(r, 40, 28), mat, x, y, z);

function face(g, z = 0.92, s = 1) {
  const black = toy(0x1E1E1E, { shininess: 120 });
  for (const d of [-1, 1]) {
    g.add(ball(0.1 * s, black, d * 0.3 * s, 0.06 * s, z));
    g.add(ball(0.035 * s, toy(0xFFFFFF), d * 0.3 * s - 0.03 * s, 0.1 * s, z + 0.08 * s));
    const cheek = ball(0.11 * s, toy(0xFF8FB3, { transparent: true, opacity: 0.6 }), d * 0.55 * s, -0.16 * s, z - 0.12 * s);
    cheek.scale.z = 0.3; g.add(cheek);
  }
  const smile = mesh(new THREE.TorusGeometry(0.15 * s, 0.035 * s, 10, 24, Math.PI), black, 0, -0.12 * s, z + 0.02);
  smile.rotation.z = Math.PI; g.add(smile);
}
function shine(g, r = 1) {
  const h = ball(r * 0.3, new THREE.MeshBasicMaterial({ color: 0xFFFFFF, transparent: true, opacity: 0.75 }), -0.38 * r, 0.42 * r, 0.82 * r);
  h.scale.set(1, 0.55, 0.3); h.rotation.z = 0.6; g.add(h);
}
function heartShape() {
  const s = new THREE.Shape();
  s.moveTo(0, -0.5);
  s.bezierCurveTo(-0.15, -0.35, -0.55, -0.1, -0.55, 0.15);
  s.bezierCurveTo(-0.55, 0.42, -0.3, 0.5, -0.15, 0.45);
  s.bezierCurveTo(-0.06, 0.42, 0, 0.35, 0, 0.28);
  s.bezierCurveTo(0, 0.35, 0.06, 0.42, 0.15, 0.45);
  s.bezierCurveTo(0.3, 0.5, 0.55, 0.42, 0.55, 0.15);
  s.bezierCurveTo(0.55, -0.1, 0.15, -0.35, 0, -0.5);
  return s;
}
function starShape(r1 = 0.5, r2 = 0.22, n = 5) {
  const s = new THREE.Shape();
  for (let i = 0; i <= n * 2; i++) {
    const a = Math.PI / 2 + (i / (n * 2)) * Math.PI * 2, r = i % 2 ? r2 : r1;
    i ? s.lineTo(Math.cos(a) * r, Math.sin(a) * r) : s.moveTo(Math.cos(a) * r, Math.sin(a) * r);
  }
  return s;
}
function extrude(shape, mat, depth = 0.2, bevel = 0.05) {
  const geo = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: true, bevelSize: bevel, bevelThickness: bevel, bevelSegments: 4, curveSegments: 24 });
  geo.center();
  return new THREE.Mesh(geo, mat);
}
function labelTexture(text, color = '#1E1E1E') {
  const c = document.createElement('canvas'); c.width = 256; c.height = 128;
  const x = c.getContext('2d');
  x.font = '900 78px "Fira Code", ui-monospace, monospace'; x.textAlign = 'center'; x.textBaseline = 'middle';
  x.fillStyle = color; x.fillText(text, 128, 70);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// ---------- modelos ----------
function bug(g, body = 0x7B4FD6) {
  const b = ball(0.62, toy(body), 0, -0.12, 0); b.scale.set(1, 0.85, 0.8); g.add(b);
  const stripe = toy(0x4B2A99);
  for (const y of [-0.05, -0.32]) { const s = mesh(new THREE.TorusGeometry(0.5, 0.05, 8, 32), stripe, 0, y, 0); s.rotation.x = Math.PI / 2; s.scale.set(1.05, 0.85, 1); g.add(s); }
  g.add(ball(0.36, toy(0x2A2A33), 0, 0.5, 0.15));
  for (const d of [-1, 1]) {
    g.add(ball(0.13, toy(0xFFFFFF), d * 0.15, 0.58, 0.42), ball(0.06, toy(0x111111), d * 0.15, 0.58, 0.53));
    const ant = mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.45, 8), toy(0x2A2A33), d * 0.18, 0.95, 0.05); ant.rotation.z = -d * 0.45; g.add(ant);
    g.add(ball(0.07, toy(0xF6C928), d * 0.3, 1.15, 0.05));
    for (let i = 0; i < 3; i++) {
      const leg = mesh(new THREE.CylinderGeometry(0.035, 0.03, 0.5, 8), toy(0x2A2A33), d * 0.68, -0.05 - i * 0.22, 0.05);
      leg.rotation.z = d * (1.1 + i * 0.15); g.add(leg);
    }
  }
}

const BUILD = {
  bubble(g, i) { g.add(ball(1, toy(BUBBLE_COLORS[i], { shininess: 110 }))); face(g); shine(g); },
  bubbleRainbow(g) {
    const geo = new THREE.SphereGeometry(1, 48, 32);
    const col = [], c = new THREE.Color(), p = geo.attributes.position;
    for (let i = 0; i < p.count; i++) { c.setHSL(((p.getX(i) + p.getY(i)) * 0.25 + 0.5) % 1, 0.8, 0.6); col.push(c.r, c.g, c.b); }
    geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    g.add(new THREE.Mesh(geo, new THREE.MeshPhongMaterial({ vertexColors: true, shininess: 110, specular: 0x666666 })));
    face(g); shine(g);
  },
  bubbleBug(g) {
    const inner = new THREE.Group(); bug(inner); inner.scale.setScalar(0.62); inner.position.y = -0.05; g.add(inner);
    g.add(ball(1, new THREE.MeshPhongMaterial({ color: 0x9B7BFF, transparent: true, opacity: 0.32, shininess: 140, specular: 0xFFFFFF, depthWrite: false })));
    shine(g);
  },
  bubbleClock(g) {
    g.add(ball(1, new THREE.MeshPhongMaterial({ color: 0xDFF7EA, transparent: true, opacity: 0.55, shininess: 140, specular: 0xFFFFFF, depthWrite: false })));
    const dial = mesh(new THREE.CylinderGeometry(0.62, 0.62, 0.18, 40), toy(0xFFFDF5), 0, 0, 0.1); dial.rotation.x = Math.PI / 2; g.add(dial);
    const rim = mesh(new THREE.TorusGeometry(0.62, 0.08, 12, 40), toy(0x2FBF71), 0, 0, 0.2); g.add(rim);
    const dark = toy(0x1E1E1E);
    const h1 = mesh(new THREE.BoxGeometry(0.07, 0.38, 0.05), dark, 0.0, 0.17, 0.24); g.add(h1);
    const h2 = mesh(new THREE.BoxGeometry(0.06, 0.28, 0.05), dark, 0.12, -0.06, 0.24); h2.rotation.z = -1.0; g.add(h2);
    g.add(ball(0.06, toy(0xE0413A), 0, 0, 0.27));
    const bell = mesh(new THREE.CylinderGeometry(0.12, 0.16, 0.12, 20), toy(0x2FBF71), 0, 0.72, 0.05); g.add(bell);
    shine(g);
  },
  bug(g) { bug(g); },
  core(g) {
    const blue = toy(0x3858E9, { shininess: 90 });
    const disc = mesh(new THREE.CylinderGeometry(1, 1, 0.42, 64), blue); disc.rotation.x = Math.PI / 2; g.add(disc);
    const edge = mesh(new THREE.TorusGeometry(1, 0.08, 12, 64), toy(0x1D2B6B), 0, 0, 0); g.add(edge);
    g.add(mesh(new THREE.TorusGeometry(0.74, 0.06, 12, 64), toy(0xFFFFFF), 0, 0, 0.22));
    // una «W» hecha de cuatro barras
    const white = toy(0xFFFFFF, { shininess: 100 });
    for (const [x, rz] of [[-0.36, 0.3], [-0.12, -0.3], [0.12, 0.3], [0.36, -0.3]]) {
      const bar = mesh(new THREE.BoxGeometry(0.11, 0.78, 0.12), white, x, 0, 0.25); bar.rotation.z = rz; g.add(bar);
    }
    // tornillos del borde para que se note el giro
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      g.add(ball(0.06, metal(0xF6C928), Math.cos(a) * 0.87, Math.sin(a) * 0.87, 0.22));
    }
  },
  boss(g) {
    const purple = toy(0x5B1E8A, { shininess: 90 });
    const disc = mesh(new THREE.CylinderGeometry(0.82, 0.82, 0.44, 64), purple); disc.rotation.x = Math.PI / 2; g.add(disc);
    for (let i = 0; i < 14; i++) {
      const a = (i / 14) * Math.PI * 2;
      const sp = mesh(new THREE.ConeGeometry(0.11, 0.3, 16), toy(0xB794F6), Math.cos(a) * 0.9, Math.sin(a) * 0.9, 0);
      sp.rotation.z = a - Math.PI / 2; g.add(sp);
    }
    for (const d of [-1, 1]) {
      g.add(ball(0.17, toy(0xFFFFFF), d * 0.28, 0.1, 0.25), ball(0.08, toy(0xE0413A, { emissive: 0x550000 }), d * 0.26, 0.06, 0.38));
      const brow = mesh(new THREE.BoxGeometry(0.34, 0.08, 0.08), toy(0x1E1E1E), d * 0.28, 0.36, 0.3); brow.rotation.z = d * 0.4; g.add(brow);
    }
    const mouth = mesh(new THREE.TorusGeometry(0.22, 0.05, 10, 24, Math.PI), toy(0x1E1E1E), 0, -0.36, 0.26); g.add(mouth);
  },
  plug(g, i) {
    const body = mesh(new RoundedBoxGeometry(0.62, 1.0, 0.42, 5, 0.14), toy(PLUG_COLORS[i], { shininess: 90 }), 0, -0.1, 0); g.add(body);
    g.add(mesh(new RoundedBoxGeometry(0.64, 0.12, 0.44, 3, 0.05), toy(0xFFFFFF), 0, 0.12, 0));
    for (const d of [-1, 1]) g.add(mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.5, 16), metal(), d * 0.15, 0.62, 0));
    const cable = mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.45, 16), toy(0x2A2A33), 0, -0.8, 0); g.add(cable);
  },
  cookie(g) {
    const c = mesh(new THREE.CylinderGeometry(0.9, 0.9, 0.3, 40), toy(0xD9A066, { shininess: 30 })); c.rotation.x = Math.PI / 2 - 0.35; g.add(c);
    const chip = toy(0x5A3A1E, { shininess: 60 });
    for (const [x, y] of [[-0.35, 0.3], [0.3, 0.38], [0.05, -0.05], [-0.4, -0.3], [0.42, -0.25], [0, 0.6], [-0.05, -0.55]]) g.add(ball(0.11, chip, x, y, 0.2 + y * 0.12));
  },
  key(g, i) {
    const cap = mesh(new RoundedBoxGeometry(1.7, 0.95, 0.7, 5, 0.22), toy(LANE_COLORS[i], { shininess: 90 })); g.add(cap);
    const top = mesh(new RoundedBoxGeometry(1.4, 0.7, 0.2, 4, 0.1), toy(new THREE.Color(LANE_COLORS[i]).offsetHSL(0, 0, 0.12).getHex()), 0, 0.02, 0.32); g.add(top);
    const label = mesh(new THREE.PlaneGeometry(1.2, 0.6), new THREE.MeshBasicMaterial({ map: labelTexture(LANE_LABELS[i]), transparent: true }), 0, 0, 0.44); g.add(label);
  },
  ring(g, i) {
    g.add(mesh(new THREE.TorusGeometry(0.82, 0.13, 20, 64), toy(LANE_COLORS[i], { emissive: new THREE.Color(LANE_COLORS[i]).multiplyScalar(0.25), shininess: 120 })));
  },
  heart(g) { g.add(extrude(heartShape(), toy(0xE0413A, { shininess: 120 }), 0.25, 0.08)); g.children[0].scale.setScalar(1.55); },
  heartEmpty(g) { g.add(extrude(heartShape(), toy(0x55576A, { shininess: 60 }), 0.25, 0.08)); g.children[0].scale.setScalar(1.55); },
  medal(g, i) {
    const col = [0xC97A3A, 0xC9CED6, 0xF2B705][i];
    for (const d of [-1, 1]) { const r = mesh(new THREE.BoxGeometry(0.32, 0.9, 0.06), toy(d < 0 ? 0x3858E9 : 0xE0413A), d * 0.2, 0.55, -0.15); r.rotation.z = d * 0.35; g.add(r); }
    const disc = mesh(new THREE.CylinderGeometry(0.62, 0.62, 0.16, 48), metal(col), 0, -0.18, 0); disc.rotation.x = Math.PI / 2; g.add(disc);
    const st = extrude(starShape(0.36, 0.16), metal(new THREE.Color(col).offsetHSL(0, 0, 0.12).getHex()), 0.08, 0.03); st.position.set(0, -0.18, 0.12); g.add(st);
  },
  trophy(g) {
    const gold = metal(0xF2B705);
    const pts = [[0, -0.1], [0.52, -0.05], [0.6, 0.35], [0.66, 0.8], [0.6, 0.82], [0.5, 0.42], [0.0, 0.4]].map(([x, y]) => new THREE.Vector2(x, y));
    const cup = mesh(new THREE.LatheGeometry(pts, 48), gold, 0, -0.05, 0); g.add(cup);
    for (const d of [-1, 1]) {
      const h = mesh(new THREE.TorusGeometry(0.22, 0.06, 12, 24, Math.PI * 1.2), gold, 0.62, 0.42, 0);
      h.rotation.z = -Math.PI * 0.6;
      const side = new THREE.Group(); side.add(h); side.scale.x = d;   // la izquierda es la derecha en espejo
      g.add(side);
    }
    g.add(mesh(new THREE.CylinderGeometry(0.1, 0.16, 0.4, 20), gold, 0, -0.32, 0));
    g.add(mesh(new RoundedBoxGeometry(0.8, 0.22, 0.5, 3, 0.06), toy(0x5A3A1E), 0, -0.62, 0));
    const st = extrude(starShape(0.18, 0.08), toy(0xFFFFFF), 0.04, 0.02); st.position.set(0, 0.35, 0.58); g.add(st);
  },
};

// ---------- «fotografía» ----------
// view: 'front' (de frente), 'top' (un poco desde arriba).
const LIST = [
  ...BUBBLE_COLORS.map((_, i) => ['bubble-' + i, (g) => BUILD.bubble(g, i), 128, 128]),
  ['bubble-rainbow', BUILD.bubbleRainbow, 128, 128],
  ['bubble-bug', BUILD.bubbleBug, 128, 128],
  ['bubble-clock', BUILD.bubbleClock, 128, 128],
  ['bug', BUILD.bug, 128, 128, 'top'],
  ['core', BUILD.core, 320, 320],
  ['boss', BUILD.boss, 320, 320],
  ...PLUG_COLORS.map((_, i) => ['plug-' + i, (g) => BUILD.plug(g, i), 96, 160]),
  ['cookie', BUILD.cookie, 128, 128],
  ...LANE_COLORS.map((_, i) => ['key-' + i, (g) => BUILD.key(g, i), 200, 120, 'top']),
  ...LANE_COLORS.map((_, i) => ['ring-' + i, (g) => BUILD.ring(g, i), 128, 128]),
  ['heart', BUILD.heart, 64, 64],
  ['heart-empty', BUILD.heartEmpty, 64, 64],
  ...[0, 1, 2].map(i => ['medal-' + i, (g) => BUILD.medal(g, i), 96, 96]),
  ['trophy', BUILD.trophy, 160, 160],
];

function setup() {
  const c = document.createElement('canvas');
  renderer = new THREE.WebGLRenderer({ canvas: c, alpha: true, antialias: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(1);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.setClearColor(0x000000, 0);
  scene = new THREE.Scene();
  scene.add(new THREE.HemisphereLight(0xFFFFFF, 0x7A7E99, 1.45));
  const key = new THREE.DirectionalLight(0xFFFFFF, 1.6); key.position.set(-2, 3, 4); scene.add(key);
  const rim = new THREE.DirectionalLight(0xBFD4FF, 0.7); rim.position.set(3, -1, -2); scene.add(rim);
  camera = new THREE.PerspectiveCamera(28, 1, 0.1, 50);
}

function shoot([name, build, w, h, view]) {
  const g = new THREE.Group();
  build(g);
  // encuadre: cabe entero con un pequeño margen
  const box = new THREE.Box3().setFromObject(g);
  const size = box.getSize(new THREE.Vector3()), center = box.getCenter(new THREE.Vector3());
  g.position.sub(center);
  scene.add(g);
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  const fit = Math.max(size.y, size.x / camera.aspect) * 0.5 * 1.08;
  const dist = fit / Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) + size.z * 0.5;
  if (view === 'top') camera.position.set(0, dist * 0.45, dist * 0.9); else camera.position.set(0, 0, dist);
  camera.lookAt(0, 0, 0);
  camera.updateProjectionMatrix();
  renderer.render(scene, camera);
  const out = document.createElement('canvas'); out.width = w; out.height = h;
  out.getContext('2d').drawImage(renderer.domElement, 0, 0);
  sprites[name] = out;
  scene.remove(g);
  g.traverse(o => { o.geometry?.dispose(); o.material?.map?.dispose(); o.material?.dispose(); });
}

// Prepara todas las imágenes la primera vez que se necesitan (unos milisegundos).
export function ensureSprites() {
  if (renderer || Object.keys(sprites).length) return;
  try {
    setup();
    for (const item of LIST) shoot(item);
  } catch (e) {
    console.warn('No se pudieron preparar los gráficos 3D de los minijuegos', e);
  } finally {
    if (renderer) { renderer.dispose(); renderer.forceContextLoss?.(); renderer = null; }
  }
}

export const sprite = (name) => sprites[name] || null;
export function spriteURL(name) {
  if (!urls[name] && sprites[name]) urls[name] = sprites[name].toDataURL('image/png');
  return urls[name] || '';
}
// <img> para usar dentro de textos (marcadores, tarjetas…)
export const icon = (name, cls = 'mg-ico') => `<img class="${cls}" src="${spriteURL(name)}" alt="" aria-hidden="true">`;

// Dibuja una imagen centrada en (x, y) con un tamaño y un giro.
export function drawSprite(g, name, x, y, w, h = w, rot = 0, alpha = 1) {
  const s = sprites[name];
  if (!s) return;
  g.save();
  g.globalAlpha *= alpha;
  g.translate(x, y);
  if (rot) g.rotate(rot);
  g.drawImage(s, -w / 2, -h / 2, w, h);
  g.restore();
}
