// Todo en 3D: cambia cada emoji que aparece en pantalla (botones, marcadores, tienda, nevera, misiones,
// avisos, ranking…) por una imagen de un modelo 3D con luz y brillo, en el estilo de Wapuu.
//  · Prendas: miniatura del modelo 3D real que lleva Wapuu (el de la tienda).
//  · Comida, interfaz y misiones: modelos hechos aquí abajo.
//  · Lo de los minijuegos lo reutiliza de mg-sprites.js.
// Cada modelo se «fotografía» una sola vez, la primera vez que hace falta, repartido entre fotogramas.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { World } from './world.js';
import { COSMETICS, FOODS } from './state.js';
import './pass-cosmetics.js';
import './wardrobe.js';
import './kitchen.js';
import { ensureSprites, sprite } from './mg-sprites.js';

// ---------------- piezas ----------------
const P = (color, o = {}) => new THREE.MeshPhongMaterial({ color, shininess: 70, specular: 0x444444, ...o });
const MET = (color = 0xC9CED6) => new THREE.MeshPhongMaterial({ color, shininess: 150, specular: 0xFFFFFF });
const GLASS = (color = 0xCFEFFF, opacity = 0.45) => new THREE.MeshPhongMaterial({ color, transparent: true, opacity, shininess: 150, specular: 0xFFFFFF, depthWrite: false });
const GLOW = (color) => new THREE.MeshPhongMaterial({ color, emissive: color, emissiveIntensity: 0.55, shininess: 90 });
const mat = (m) => (m instanceof THREE.Material ? m : P(m));
function put(g, geo, m, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, sx = 1, sy = sx, sz = sx) {
  const o = new THREE.Mesh(geo, mat(m)); o.position.set(x, y, z); o.rotation.set(rx, ry, rz); o.scale.set(sx, sy, sz); g.add(o); return o;
}
const ball = (g, r, m, x, y, z, sx, sy, sz) => put(g, new THREE.SphereGeometry(r, 36, 24), m, x, y, z, 0, 0, 0, sx ?? 1, sy ?? sx ?? 1, sz ?? sx ?? 1);
const cyl = (g, rt, rb, h, m, x, y, z, rx = 0, ry = 0, rz = 0) => put(g, new THREE.CylinderGeometry(rt, rb, h, 40), m, x, y, z, rx, ry, rz);
const cone = (g, r, h, m, x, y, z, rx = 0, ry = 0, rz = 0) => put(g, new THREE.ConeGeometry(r, h, 32), m, x, y, z, rx, ry, rz);
const rbox = (g, w, h, d, m, x, y, z, rad = 0.12, rx = 0, ry = 0, rz = 0) => put(g, new RoundedBoxGeometry(w, h, d, 4, Math.min(rad, w / 2.1, h / 2.1, d / 2.1)), m, x, y, z, rx, ry, rz);
const tor = (g, r, t, m, x, y, z, rx = 0, ry = 0, rz = 0, arc = Math.PI * 2) => put(g, new THREE.TorusGeometry(r, t, 16, 48, arc), m, x, y, z, rx, ry, rz);
function ext(g, shape, m, depth = 0.25, x = 0, y = 0, z = 0, s = 1, rz = 0) {
  const geo = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: true, bevelSize: 0.05, bevelThickness: 0.05, bevelSegments: 3, curveSegments: 20 });
  geo.center();
  return put(g, geo, m, x, y, z, 0, 0, rz, s);
}
const poly = (pts) => { const s = new THREE.Shape(); pts.forEach(([x, y], i) => (i ? s.lineTo(x, y) : s.moveTo(x, y))); return s; };
function heart() {
  const s = new THREE.Shape(); s.moveTo(0, -0.5);
  s.bezierCurveTo(-0.15, -0.35, -0.55, -0.1, -0.55, 0.15); s.bezierCurveTo(-0.55, 0.42, -0.3, 0.5, -0.15, 0.45);
  s.bezierCurveTo(-0.06, 0.42, 0, 0.35, 0, 0.28); s.bezierCurveTo(0, 0.35, 0.06, 0.42, 0.15, 0.45);
  s.bezierCurveTo(0.3, 0.5, 0.55, 0.42, 0.55, 0.15); s.bezierCurveTo(0.55, -0.1, 0.15, -0.35, 0, -0.5);
  return s;
}
function star(r1 = 0.5, r2 = 0.22, n = 5) {
  const pts = []; for (let i = 0; i < n * 2; i++) { const a = Math.PI / 2 + (i / (n * 2)) * Math.PI * 2, r = i % 2 ? r2 : r1; pts.push([Math.cos(a) * r, Math.sin(a) * r]); }
  return poly(pts);
}
function face(g, z, s = 1, y = 0, smile = true) {
  const k = P(0x1E1E1E, { shininess: 120 });
  for (const d of [-1, 1]) { ball(g, 0.09 * s, k, d * 0.28 * s, y + 0.08 * s, z); ball(g, 0.03 * s, 0xFFFFFF, d * 0.28 * s - 0.03 * s, y + 0.11 * s, z + 0.07 * s); }
  if (smile) tor(g, 0.15 * s, 0.035 * s, k, 0, y - 0.1 * s, z + 0.02, 0, 0, Math.PI, Math.PI);
}
const rnd = (seed) => () => (seed = (seed * 16807) % 2147483647) / 2147483647;
const sprinkle = (g, n, r, y, cols, seed = 3, sz = 0.05) => { const R = rnd(seed); for (let i = 0; i < n; i++) { const a = R() * 6.28, d = Math.sqrt(R()) * r; ball(g, sz, cols[i % cols.length], Math.cos(a) * d, y, Math.sin(a) * d); } };
const bowl = (g, r, col, fill, y = 0) => { put(g, new THREE.SphereGeometry(r, 40, 20, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), col, 0, y, 0); cyl(g, r * 0.96, r * 0.96, 0.04, fill, 0, y - 0.02, 0); };
const plate = (g, r = 1, y = -0.35) => { cyl(g, r, r * 0.85, 0.08, 0xFFFFFF, 0, y, 0); tor(g, r * 0.98, 0.04, 0xEDEDED, 0, y + 0.04, 0, Math.PI / 2); };
const C = { gold: 0xF2B705, brown: 0x8B5A2B, cream: 0xFFF1D6, red: 0xE0413A, green: 0x3FB950, dkgreen: 0x2E7D32, yellow: 0xF6C928, white: 0xF7F7F7, black: 0x1E1E1E, blue: 0x3858E9, pink: 0xFF5FA2, orange: 0xF08A24, purple: 0x7B4FD6 };

// ---------------- modelos (por emoji) ----------------
const M = {
  // --- interfaz ---
  '🪙'(g) { cyl(g, 1, 1, 0.26, MET(C.gold), 0, 0, 0, Math.PI / 2); tor(g, 0.86, 0.06, MET(0xFFD84A), 0, 0, 0.13);
    for (const [x, rz] of [[-0.3, 0.3], [-0.1, -0.3], [0.1, 0.3], [0.3, -0.3]]) rbox(g, 0.1, 0.62, 0.08, MET(0xFFE27A), x, 0, 0.16, 0.03, 0, 0, rz); },
  '🛍️'(g) { rbox(g, 1.3, 1.2, 0.7, C.pink, 0, -0.2, 0, 0.12); for (const d of [-1, 1]) tor(g, 0.24, 0.05, 0x1E1E1E, d * 0.3, 0.42, 0, 0, 0, 0, Math.PI); rbox(g, 1.32, 0.18, 0.72, 0xFFB3D3, 0, 0.25, 0, 0.05); },
  '⚙️'(g) { const m = MET(0x9AA3AE); cyl(g, 0.72, 0.72, 0.32, m, 0, 0, 0, Math.PI / 2); for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2; rbox(g, 0.32, 0.36, 0.32, m, Math.cos(a) * 0.82, Math.sin(a) * 0.82, 0, 0.05, 0, 0, a); } cyl(g, 0.28, 0.28, 0.36, 0x5A6270, 0, 0, 0.02, Math.PI / 2); },
  '🎯'(g) { [[1, C.red], [0.78, C.white], [0.56, C.red], [0.34, C.white], [0.14, C.red]].forEach(([r, c], i) => cyl(g, r, r, 0.1, c, 0, 0, i * 0.05, Math.PI / 2)); cyl(g, 0.04, 0.04, 0.9, 0x2A2A33, 0.25, 0.25, 0.5, 0.9, 0, -0.6); cone(g, 0.12, 0.25, C.blue, 0.47, 0.47, 0.82, 0.9, 0, -0.6); },
  '🔊'(g) { rbox(g, 0.45, 0.6, 0.5, 0x3A3D55, -0.45, 0, 0, 0.08); cone(g, 0.55, 0.6, 0x3A3D55, -0.05, 0, 0, 0, 0, Math.PI / 2); for (const r of [0.45, 0.75]) tor(g, r, 0.06, C.blue, 0.1, 0, 0, 0, 0, -Math.PI / 2.6, Math.PI / 1.3); },
  '🔇'(g) { rbox(g, 0.45, 0.6, 0.5, 0x3A3D55, -0.45, 0, 0, 0.08); cone(g, 0.55, 0.6, 0x3A3D55, -0.05, 0, 0, 0, 0, Math.PI / 2); for (const r of [0.8, -0.8]) rbox(g, 0.14, 0.8, 0.14, C.red, 0.55, 0, 0.1, 0.05, 0, 0, r); },
  '🐾'(g) { const m = P(0x8B5A2B); ball(g, 0.5, m, 0, -0.25, 0, 1, 0.82, 0.5); [[-0.55, 0.3], [-0.2, 0.62], [0.2, 0.62], [0.55, 0.3]].forEach(([x, y]) => ball(g, 0.22, m, x, y, 0, 1, 1.15, 0.5)); },
  '👁️'(g) { ball(g, 0.8, C.white, 0, 0, 0, 1, 0.7, 0.5); ball(g, 0.36, 0x3B82D9, 0, 0, 0.3, 1, 1, 0.4); ball(g, 0.17, C.black, 0, 0, 0.42, 1, 1, 0.3); ball(g, 0.06, C.white, -0.1, 0.1, 0.48); },
  '🙈'(g) { ball(g, 0.8, C.white, 0, 0, 0, 1, 0.7, 0.5); put(g, new THREE.SphereGeometry(0.82, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2), 0xF6C928, 0, 0, 0, 0.2, 0, 0, 1, 0.75, 0.55); tor(g, 0.6, 0.05, C.black, 0, -0.05, 0.3, 0, 0, Math.PI, Math.PI); },
  '🎮'(g) { rbox(g, 1.8, 0.95, 0.5, 0x5B3CC4, 0, 0, 0, 0.4); for (const [x, c] of [[0.42, C.red], [0.62, C.yellow], [0.52, C.green]]) ball(g, 0.09, c, x, x === 0.52 ? -0.1 : 0.1, 0.27); rbox(g, 0.42, 0.13, 0.08, 0x2A2A33, -0.5, 0, 0.27, 0.03); rbox(g, 0.13, 0.42, 0.08, 0x2A2A33, -0.5, 0, 0.27, 0.03); },
  '🛋️'(g) { const m = P(0x3858E9); rbox(g, 2, 0.45, 0.9, m, 0, -0.25, 0, 0.15); rbox(g, 2, 0.75, 0.3, m, 0, 0.25, -0.35, 0.15); for (const d of [-1, 1]) rbox(g, 0.3, 0.65, 0.9, m, d * 1.0, 0, 0, 0.13); for (const d of [-1, 1]) rbox(g, 0.85, 0.2, 0.7, 0x5B7BFF, d * 0.45, 0.05, 0.08, 0.1); },
  '🍳'(g) { cyl(g, 0.9, 0.8, 0.2, 0x2A2A33, 0, 0, 0); rbox(g, 1.0, 0.12, 0.18, 0x2A2A33, 1.25, 0.05, 0, 0.05); ball(g, 0.62, C.white, 0, 0.12, 0, 1, 0.12, 0.85); ball(g, 0.25, 0xF6B800, 0.05, 0.17, 0.05, 1, 0.55, 1); },
  '💻'(g) { rbox(g, 1.7, 0.1, 1.1, 0x9AA3AE, 0, -0.45, 0.25, 0.04); rbox(g, 1.7, 1.05, 0.08, 0x9AA3AE, 0, 0.1, -0.3, 0.04, -0.25); put(g, new THREE.PlaneGeometry(1.5, 0.85), GLOW(0x3858E9), 0, 0.12, -0.25, -0.25); },
  '🛁'(g) { rbox(g, 2, 0.75, 1, C.white, 0, -0.1, 0, 0.3); rbox(g, 1.75, 0.1, 0.8, 0x8EC9FF, 0, 0.27, 0, 0.05); for (const [x, z, r] of [[-0.5, 0.1, 0.18], [-0.25, -0.1, 0.14], [0.3, 0.15, 0.2], [0.55, -0.05, 0.13]]) ball(g, r, GLASS(), x, 0.38, z); for (const d of [-0.8, 0.8]) cyl(g, 0.06, 0.04, 0.3, MET(), d, -0.6, 0.3); },
  '🛏️'(g) { rbox(g, 1.9, 0.35, 1.2, 0x8B5A2B, 0, -0.3, 0, 0.08); rbox(g, 1.8, 0.25, 1.1, C.white, 0, -0.05, 0, 0.1); rbox(g, 1.1, 0.27, 1.12, 0x3858E9, 0.35, 0.0, 0, 0.1); rbox(g, 0.5, 0.2, 0.8, 0xFFFFFF, -0.6, 0.15, 0, 0.1); rbox(g, 0.18, 0.9, 1.25, 0x8B5A2B, -1, 0.05, 0, 0.06); },
  '🍕'(g) { ext(g, poly([[-0.8, 0.6], [0.8, 0.6], [0, -0.9]]), 0xF6C928, 0.12); rbox(g, 1.7, 0.22, 0.25, 0xD9A066, 0, 0.62, 0, 0.1); for (const [x, y] of [[-0.3, 0.3], [0.25, 0.25], [0, -0.2], [-0.05, 0.45]]) cyl(g, 0.14, 0.14, 0.05, C.red, x, y, 0.12, Math.PI / 2); },
  '⚡'(g) { ext(g, poly([[0.15, 1], [-0.5, -0.1], [-0.05, -0.1], [-0.2, -1], [0.5, 0.15], [0.05, 0.15]]), GLOW(0xF6C928), 0.25); },
  '🎈'(g) { ball(g, 0.75, P(C.red, { shininess: 120 }), 0, 0.2, 0, 1, 1.18, 1); cone(g, 0.1, 0.16, C.red, 0, -0.72, 0, Math.PI); cyl(g, 0.015, 0.015, 0.6, 0x555555, 0.05, -1.08, 0); ball(g, 0.18, 0xFFFFFF, -0.28, 0.5, 0.55, 1, 0.6, 0.3); },
  '🚽'(g) { rbox(g, 0.9, 0.7, 0.35, C.white, 0, 0.45, -0.45, 0.1); cyl(g, 0.55, 0.38, 0.6, C.white, 0, -0.15, 0.15); tor(g, 0.5, 0.08, 0xEDEDED, 0, 0.17, 0.15, Math.PI / 2); rbox(g, 0.3, 0.06, 0.06, MET(), 0.25, 0.68, -0.27, 0.02); },
  '🫧'(g) { for (const [x, y, r] of [[-0.35, -0.2, 0.55], [0.45, 0.25, 0.38], [0.1, 0.65, 0.25]]) { ball(g, r, GLASS(0xBFE6FF, 0.5), x, y, 0); ball(g, r * 0.25, 0xFFFFFF, x - r * 0.35, y + r * 0.4, r * 0.8); } },
  '🧊'(g) { rbox(g, 1.1, 1.9, 0.9, C.white, 0, 0, 0, 0.15); rbox(g, 1.12, 0.05, 0.92, 0xD0D4DC, 0, 0.3, 0, 0.02); for (const y of [0.65, -0.3]) rbox(g, 0.08, 0.35, 0.1, MET(), 0.4, y, 0.48, 0.03); },
  '⏹️'(g) { rbox(g, 1.4, 1.4, 0.4, C.red, 0, 0, 0, 0.25); rbox(g, 0.6, 0.6, 0.1, C.white, 0, 0, 0.22, 0.08); },
  '☀️'(g) { ball(g, 0.6, GLOW(0xF6C928)); for (let i = 0; i < 10; i++) { const a = i / 10 * Math.PI * 2; cone(g, 0.14, 0.38, GLOW(0xF08A24), Math.cos(a) * 0.9, Math.sin(a) * 0.9, 0, 0, 0, a - Math.PI / 2); } face(g, 0.58, 1, 0); },
  '💡'(g) { ball(g, 0.65, GLOW(0xFFE36E), 0, 0.3, 0); cyl(g, 0.32, 0.3, 0.45, MET(0xB0B6C0), 0, -0.45, 0); for (const y of [-0.35, -0.5]) tor(g, 0.32, 0.04, MET(0x8A93A3), 0, y, 0, Math.PI / 2); },
  '💛'(g) { ext(g, heart(), P(C.yellow, { shininess: 120 }), 0.3, 0, 0, 0, 1.8); },
  '❤️'(g) { ext(g, heart(), P(C.red, { shininess: 120 }), 0.3, 0, 0, 0, 1.8); },
  '💖'(g) { ext(g, heart(), P(C.pink, { shininess: 130 }), 0.3, 0, 0, 0, 1.8); },
  '🎵'(g) { const k = P(C.purple); ball(g, 0.3, k, -0.25, -0.6, 0, 1.3, 1, 0.8); cyl(g, 0.06, 0.06, 1.3, k, 0.08, 0.05, 0); rbox(g, 0.5, 0.18, 0.12, k, 0.3, 0.62, 0, 0.05, 0, 0, -0.5); },
  '😋'(g) { ball(g, 1, P(C.yellow)); face(g, 0.92, 1.2, 0.05); ball(g, 0.18, 0xFF6F8A, 0.15, -0.28, 0.9, 1, 0.8, 0.5); },
  '😊'(g) { ball(g, 1, P(C.yellow)); for (const d of [-1, 1]) { tor(g, 0.12, 0.04, C.black, d * 0.32, 0.1, 0.93, 0, 0, 0, Math.PI); ball(g, 0.14, P(0xFF8FB3, { transparent: true, opacity: 0.7 }), d * 0.55, -0.15, 0.82, 1, 1, 0.3); } tor(g, 0.25, 0.05, C.black, 0, -0.15, 0.95, 0, 0, Math.PI, Math.PI); },
  '🤗'(g) { ball(g, 1, P(C.yellow)); face(g, 0.92, 1.2, 0.15); for (const d of [-1, 1]) ball(g, 0.3, P(0xF2B705), d * 0.55, -0.55, 0.75, 1, 0.8, 0.6); ext(g, heart(), P(C.red), 0.15, 0, -0.55, 0.95, 0.5); },
  '🪲'(g) { put(g, new THREE.SphereGeometry(0.8, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2), P(0x2FBF71, { shininess: 140 }), 0, -0.1, 0, Math.PI / 2 - 0.4, 0, 0, 1, 1.25, 0.6); rbox(g, 0.04, 1.0, 0.04, C.black, 0, -0.1, 0.45, 0.01, -0.4); ball(g, 0.3, 0x2A2A33, 0, 0.75, 0.2); for (const d of [-1, 1]) for (let i = 0; i < 3; i++) cyl(g, 0.03, 0.03, 0.5, 0x2A2A33, d * 0.75, 0.2 - i * 0.35, 0, 0, 0, d * 1.3); },
  '🪰'(g) { ball(g, 0.45, 0x2A2A33, 0, -0.1, 0, 1, 1.2, 0.8); ball(g, 0.28, 0x2A2A33, 0, 0.55, 0.05); for (const d of [-1, 1]) { ball(g, 0.12, 0xC0392B, d * 0.15, 0.62, 0.22); ball(g, 0.5, GLASS(0xDDEEFF, 0.5), d * 0.55, 0.2, -0.1, 1.1, 0.5, 0.1); } },
  '✨'(g) { const s4 = star(0.55, 0.14, 4); ext(g, s4, GLOW(0xFFE36E), 0.12, -0.2, -0.1, 0, 1.2); ext(g, s4, GLOW(0xFFFFFF), 0.1, 0.55, 0.55, 0.1, 0.55); ext(g, s4, GLOW(0xFFD84A), 0.1, 0.6, -0.55, 0.1, 0.4); },
  '⭐'(g) { ext(g, star(), P(0xF6C928, { shininess: 130 }), 0.3, 0, 0, 0, 1.8); },
  '🔒'(g) { tor(g, 0.38, 0.1, MET(0x9AA3AE), 0, 0.3, 0, 0, 0, 0, Math.PI); for (const d of [-1, 1]) cyl(g, 0.1, 0.1, 0.3, MET(0x9AA3AE), d * 0.38, 0.17, 0); rbox(g, 1.1, 0.9, 0.5, MET(C.gold), 0, -0.4, 0, 0.15); ball(g, 0.1, C.black, 0, -0.35, 0.26); },
  '✅'(g) { rbox(g, 1.5, 1.5, 0.4, C.green, 0, 0, 0, 0.3); ext(g, poly([[-0.5, 0.05], [-0.3, 0.25], [-0.1, 0.05], [0.4, 0.55], [0.6, 0.35], [-0.1, -0.35]]), C.white, 0.1, 0, 0, 0.25); },
  '📦'(g) { rbox(g, 1.5, 1.1, 1.2, 0xC8925A, 0, 0, 0, 0.06); rbox(g, 0.3, 1.12, 1.22, 0xE8D3A2, 0, 0, 0, 0.03); rbox(g, 1.52, 0.06, 1.22, 0xA87444, 0, 0.3, 0, 0.02); },
  '⚽'(g) { ball(g, 1, P(0xFFFFFF, { shininess: 90 })); const R = rnd(7); const k = P(C.black);
    for (const [x, y, z] of [[0, 0, 1], [0.7, 0.55, 0.45], [-0.7, 0.55, 0.45], [0.6, -0.6, 0.55], [-0.6, -0.6, 0.55], [0, 0.95, -0.3]]) { const o = ball(g, 0.3, k, x * 0.92, y * 0.92, z * 0.92); o.lookAt(x * 2, y * 2, z * 2); o.scale.set(1, 1, 0.25); } },
  '💃'(g) { ball(g, 0.85, MET(0xC9CED6)); const R = rnd(11); for (let i = 0; i < 40; i++) { const a = R() * 6.28, b = R() * 3.14; rbox(g, 0.18, 0.18, 0.05, MET([0xFFFFFF, 0x8EC9FF, 0xFFB3D3][i % 3]), Math.sin(b) * Math.cos(a) * 0.86, Math.cos(b) * 0.86, Math.abs(Math.sin(b) * Math.sin(a)) * 0.86, 0.02); } cyl(g, 0.03, 0.03, 0.5, 0x555555, 0, 1.1, 0); },
  '🚿'(g) { cyl(g, 0.07, 0.07, 1, MET(), -0.5, 0.2, 0); cyl(g, 0.07, 0.07, 0.7, MET(), -0.2, 0.7, 0, 0, 0, Math.PI / 2); cyl(g, 0.45, 0.25, 0.22, MET(), 0.25, 0.55, 0, 0, 0, -0.6); for (let i = 0; i < 7; i++) ball(g, 0.07, GLASS(0x5FB8FF, 0.85), 0.25 + (i % 3 - 1) * 0.2, 0.05 - Math.floor(i / 3) * 0.3, 0.1, 0.8, 1.4, 0.8); },
  '🎁'(g) { rbox(g, 1.4, 1, 1.2, C.red, 0, -0.2, 0, 0.06); rbox(g, 1.5, 0.3, 1.3, C.red, 0, 0.38, 0, 0.06); rbox(g, 0.25, 1.32, 1.32, C.yellow, 0, 0, 0, 0.03); rbox(g, 1.52, 1.32, 0.25, C.yellow, 0, 0, 0, 0.03); for (const d of [-1, 1]) tor(g, 0.22, 0.07, C.yellow, d * 0.2, 0.65, 0, 0, 0, d * 0.4); },
  '🎉'(g) { cone(g, 0.45, 1.2, 0xF6C928, -0.25, -0.25, 0, 0, 0, Math.PI - 0.7); const R = rnd(5); for (let i = 0; i < 14; i++) rbox(g, 0.12, 0.12, 0.05, [C.pink, C.blue, C.green, C.red][i % 4], 0.1 + R() * 0.8, 0.1 + R() * 0.8, R() * 0.3, 0.02, 0, 0, R() * 3); },
  '🛒'(g) { const m = MET(0x9AA3AE); rbox(g, 1.4, 0.8, 0.9, P(C.blue, { transparent: true, opacity: 0.85 }), 0.1, 0.1, 0, 0.06); cyl(g, 0.05, 0.05, 0.6, m, -0.75, 0.55, 0, 0, 0, 0.5); for (const x of [-0.4, 0.55]) cyl(g, 0.15, 0.15, 0.1, 0x2A2A33, x, -0.55, 0.35, Math.PI / 2); },
  '💰'(g) { ball(g, 0.85, 0xC8A060, 0, -0.2, 0, 1, 0.9, 0.9); cone(g, 0.3, 0.45, 0xC8A060, 0, 0.75, 0, Math.PI); tor(g, 0.2, 0.06, 0x8B5A2B, 0, 0.55, 0, Math.PI / 2); cyl(g, 0.38, 0.38, 0.08, MET(C.gold), 0, -0.2, 0.78, Math.PI / 2); },
  '🍽️'(g) { cyl(g, 1, 0.85, 0.1, C.white, 0, 0, 0, Math.PI / 2 - 0.5); tor(g, 0.7, 0.04, 0xE0E0E0, 0, 0.0, 0.03, -0.5); for (const d of [-1, 1]) rbox(g, 0.1, 1.6, 0.06, MET(), d * 1.25, 0, 0, 0.03); },
  '🎨'(g) { const s = new THREE.Shape(); s.absellipse(0, 0, 1, 0.75, 0, Math.PI * 2); const h = new THREE.Path(); h.absellipse(-0.45, -0.3, 0.16, 0.16, 0, Math.PI * 2, true); s.holes.push(h); ext(g, s, 0xD9A066, 0.12);
    [[0.1, 0.4, C.red], [0.5, 0.25, C.yellow], [0.6, -0.15, C.green], [0.25, -0.45, C.blue], [-0.25, 0.35, C.pink]].forEach(([x, y, c]) => ball(g, 0.16, c, x, y, 0.12, 1, 1, 0.5)); },
  '👄'(g) { for (const d of [-1, 1]) ball(g, 0.45, P(0xE0413A, { shininess: 130 }), 0, d * 0.16, 0, 1.9, 0.55, 0.6); },
  '🔋'(g) { rbox(g, 1.7, 0.85, 0.85, 0x2A2A33, 0, 0, 0, 0.12); rbox(g, 1.1, 0.6, 0.88, GLOW(0x2FBF71), -0.2, 0, 0, 0.08); rbox(g, 0.18, 0.4, 0.4, MET(), 0.95, 0, 0, 0.05); ext(g, poly([[0.05, 0.25], [-0.15, -0.02], [0, -0.02], [-0.05, -0.25], [0.15, 0.03], [0, 0.03]]), GLOW(0xF6C928), 0.05, -0.2, 0, 0.45, 1); },
  // --- comida: fruta y verdura ---
  '🍎'(g) { ball(g, 0.9, P(C.red, { shininess: 120 }), 0, 0, 0, 1, 0.92, 1); cyl(g, 0.05, 0.06, 0.4, 0x6B4423, 0, 0.9, 0, 0, 0, 0.2); ball(g, 0.22, C.green, 0.25, 0.95, 0, 1.4, 0.5, 0.4); },
  '🍌'(g) { tor(g, 0.9, 0.24, P(0xF6D43A, { shininess: 90 }), 0, 0.4, 0, 0, 0, Math.PI * 1.15, Math.PI * 0.7); cyl(g, 0.07, 0.07, 0.25, 0x5A3A1E, -0.8, 0.85, 0, 0, 0, 0.8); },
  '🍇'(g) { const m = P(0x7B4FD6, { shininess: 130 }); [[0, 0.5], [-0.32, 0.45], [0.32, 0.45], [-0.18, 0.15], [0.18, 0.15], [0.48, 0.15], [-0.48, 0.15], [0, -0.15], [-0.3, -0.15], [0.3, -0.15], [-0.15, -0.45], [0.15, -0.45], [0, -0.72]].forEach(([x, y], i) => ball(g, 0.2, m, x, y, (i % 3) * 0.08)); cyl(g, 0.04, 0.04, 0.4, 0x6B4423, 0, 0.85, 0); ball(g, 0.25, C.green, 0.25, 0.85, 0, 1.3, 0.5, 0.3); },
  '🍓'(g) { put(g, new THREE.SphereGeometry(0.75, 32, 24), P(0xE0413A, { shininess: 120 }), 0, -0.1, 0, 0, 0, 0, 1, 1.15, 1).geometry.translate(0, 0, 0); const R = rnd(9); for (let i = 0; i < 14; i++) { const a = R() * 3 - 1.5, y = R() * 1.0 - 0.6; ball(g, 0.04, 0xFFE36E, Math.sin(a) * 0.7 * (1 - Math.abs(y) * 0.5), y, Math.cos(a) * 0.68); } for (let i = 0; i < 5; i++) cone(g, 0.12, 0.45, C.green, Math.cos(i * 1.26) * 0.25, 0.75, Math.sin(i * 1.26) * 0.25, 0, 0, Math.cos(i * 1.26) * 1.2); },
  '🍉'(g) { const s = new THREE.Shape(); s.absarc(0, 0, 1, Math.PI, 0, true); s.lineTo(-1, 0); ext(g, s, 0xE0413A, 0.3, 0, 0.2, 0); tor(g, 1, 0.1, C.dkgreen, 0, 0.45, 0, 0, 0, Math.PI, Math.PI); for (const [x, y] of [[-0.4, -0.05], [0, -0.25], [0.4, -0.05], [-0.15, 0.15], [0.2, 0.12]]) ball(g, 0.06, C.black, x, y + 0.2, 0.2, 0.7, 1, 0.5); },
  '🍊'(g) { ball(g, 0.9, P(0xF08A24, { shininess: 60 })); ball(g, 0.22, C.green, 0.15, 0.9, 0, 1.4, 0.5, 0.4); },
  '🍐'(g) { const m = P(0xB7D84A, { shininess: 90 }); ball(g, 0.8, m, 0, -0.35, 0); ball(g, 0.5, m, 0, 0.45, 0); cyl(g, 0.05, 0.05, 0.35, 0x6B4423, 0, 1.05, 0); },
  '🍒'(g) { for (const d of [-1, 1]) { ball(g, 0.42, P(0xC0122A, { shininess: 140 }), d * 0.4, -0.45, 0); cyl(g, 0.035, 0.035, 1.1, 0x4E7A2A, d * 0.2, 0.2, 0, 0, 0, -d * 0.35); } ball(g, 0.2, C.green, 0.25, 0.75, 0, 1.4, 0.5, 0.3); },
  '🍍'(g) { ball(g, 0.65, 0xE6A623, 0, -0.35, 0, 1, 1.35, 1); for (let i = 0; i < 7; i++) { const a = i / 7 * 6.28; cone(g, 0.12, 0.8, C.green, Math.cos(a) * 0.12, 0.75, Math.sin(a) * 0.12, Math.sin(a) * 0.4, 0, -Math.cos(a) * 0.4); } },
  '🥭'(g) { ball(g, 0.8, P(0xF5A623, { shininess: 90 }), 0, 0, 0, 1.15, 0.9, 0.8); ball(g, 0.5, P(0xE0413A, { transparent: true, opacity: 0.6 }), 0.35, 0.25, 0.3, 1, 1, 0.8); },
  '🍑'(g) { ball(g, 0.85, P(0xFFA07A, { shininess: 60 })); ball(g, 0.25, C.green, -0.2, 0.85, 0, 1.4, 0.5, 0.3); },
  '🥝'(g) { cyl(g, 0.85, 0.85, 0.3, 0x8B6B3E, 0, 0, 0, Math.PI / 2); cyl(g, 0.75, 0.75, 0.32, 0x7BC043, 0, 0, 0.01, Math.PI / 2); cyl(g, 0.28, 0.28, 0.34, 0xF2F2D0, 0, 0, 0.02, Math.PI / 2); for (let i = 0; i < 12; i++) { const a = i / 12 * 6.28; ball(g, 0.04, C.black, Math.cos(a) * 0.4, Math.sin(a) * 0.4, 0.17); } },
  '🥕'(g) { cone(g, 0.32, 1.6, 0xF08A24, 0, -0.2, 0, Math.PI); for (let i = 0; i < 3; i++) cone(g, 0.1, 0.6, C.green, (i - 1) * 0.12, 0.85, 0, 0, 0, (i - 1) * 0.4); },
  '🥦'(g) { cyl(g, 0.18, 0.25, 0.8, 0x8BC34A, 0, -0.5, 0); for (const [x, y, r] of [[0, 0.35, 0.45], [-0.45, 0.15, 0.35], [0.45, 0.15, 0.35], [-0.25, 0.55, 0.3], [0.25, 0.55, 0.3]]) ball(g, r, P(C.dkgreen, { shininess: 20 }), x, y, 0); },
  '🥑'(g) { ball(g, 0.8, 0x3E6B2A, 0, 0, 0, 0.85, 1.2, 0.5); ball(g, 0.68, 0xD4E59A, 0, -0.02, 0.08, 0.8, 1.1, 0.5); ball(g, 0.28, 0x8B5A2B, 0, -0.25, 0.3); },
  '🌽'(g) { ball(g, 0.4, 0xF6C928, 0, 0.2, 0, 1, 2.2, 1); const R = rnd(4); for (let i = 0; i < 30; i++) { const a = R() * 3 - 1.5, y = R() * 1.4 - 0.5; ball(g, 0.06, 0xFFD84A, Math.sin(a) * 0.38, y, Math.cos(a) * 0.38); } for (const d of [-1, 1]) ball(g, 0.35, C.green, d * 0.3, -0.45, 0.1, 0.6, 2, 0.3); },
  // --- comidas ---
  '🥚'(g) { cyl(g, 0.95, 0.95, 0.42, P(0xF2C14E, { shininess: 40 }), 0, 0, 0, 0.4); for (const [x, z] of [[-0.3, 0.2], [0.35, -0.1], [0, 0.45]]) ball(g, 0.12, 0xC88A2E, x, 0.22, z, 1, 0.3, 1); },
  '🥘'(g) { cyl(g, 1, 0.9, 0.25, 0x2A2A33, 0, 0, 0, 0.35); for (const d of [-1, 1]) tor(g, 0.15, 0.05, 0x2A2A33, d * 1.1, 0.0, 0, 0.35); cyl(g, 0.9, 0.9, 0.06, 0xF2B705, 0, 0.12, 0, 0.35); sprinkle(g, 10, 0.7, 0.18, [0x3FB950, 0xE0413A]); for (const [x, z] of [[-0.3, 0.1], [0.3, -0.2]]) tor(g, 0.15, 0.07, 0xFF8A65, x, 0.22, z, 0.35); },
  '🍔'(g) { ball(g, 0.95, P(0xD9933F, { shininess: 60 }), 0, 0.35, 0, 1, 0.5, 1); cyl(g, 0.98, 0.98, 0.1, C.green, 0, 0.05, 0); cyl(g, 0.95, 0.95, 0.12, 0xF6C928, 0, -0.07, 0); cyl(g, 0.92, 0.92, 0.25, 0x5A3A1E, 0, -0.25, 0); cyl(g, 0.9, 0.85, 0.25, 0xD9933F, 0, -0.5, 0); sprinkle(g, 8, 0.6, 0.78, [0xFFF1D6], 2, 0.05); },
  '🍟'(g) { const R = rnd(8); for (let i = 0; i < 9; i++) rbox(g, 0.13, 1.2, 0.13, 0xF6C928, (i - 4) * 0.13, 0.35 + R() * 0.25, (i % 2) * 0.12 - 0.06, 0.03, 0, 0, (R() - 0.5) * 0.25); rbox(g, 1.3, 0.9, 0.55, C.red, 0, -0.45, 0, 0.08); },
  '🌭'(g) { ball(g, 0.4, 0xC0392B, 0, 0.15, 0, 3, 0.75, 0.75); ball(g, 0.45, 0xE6B87A, 0, -0.1, 0, 2.6, 0.6, 0.9); tor(g, 0.25, 0.04, 0xF6C928, 0, 0.42, 0, Math.PI / 2, 0, 0, Math.PI * 2).scale.set(3, 1, 1); },
  '🌮'(g) { put(g, new THREE.CylinderGeometry(0.9, 0.9, 0.9, 40, 1, true, 0, Math.PI), P(0xF2C14E, { side: THREE.DoubleSide }), 0, 0, 0, 0, Math.PI / 2, -Math.PI / 2); sprinkle(g, 10, 0.6, 0.2, [C.green, C.red, 0xF6C928], 4, 0.12); },
  '🌯'(g) { cyl(g, 0.5, 0.5, 1.8, P(0xF2D8A0), 0, 0, 0, 0, 0, 0.8); ball(g, 0.42, 0x8B5A2B, 0.68, 0.6, 0.1, 1, 1, 0.3); },
  '🍝'(g) { plate(g); const R = rnd(6); for (let i = 0; i < 9; i++) tor(g, 0.25 + R() * 0.25, 0.05, 0xF6D43A, (R() - 0.5) * 0.5, -0.1 + i * 0.03, (R() - 0.5) * 0.4, Math.PI / 2 + (R() - 0.5), 0, R() * 3); ball(g, 0.4, C.red, 0, 0.15, 0, 1.2, 0.4, 1); for (const x of [-0.25, 0.25]) ball(g, 0.15, 0x6B3E26, x, 0.25, 0.05); },
  '🍜'(g) { bowl(g, 1, 0xE0413A, 0xF2D8A0, 0.2); sprinkle(g, 6, 0.6, 0.2, [0xF6D43A], 4, 0.08); ball(g, 0.25, C.white, 0.35, 0.25, 0.1, 1, 0.5, 1); ball(g, 0.12, 0xF6B800, 0.35, 0.3, 0.12, 1, 0.4, 1); for (const d of [0, 0.15]) cyl(g, 0.03, 0.03, 1.8, 0x8B5A2B, -0.3 + d, 0.6, -0.2, 0, 0, 0.9); },
  '🍣'(g) { rbox(g, 1.3, 0.5, 0.7, C.white, 0, -0.15, 0, 0.2); rbox(g, 1.45, 0.25, 0.75, 0xFF8A65, 0, 0.2, 0, 0.12); for (const x of [-0.35, -0.05, 0.25]) rbox(g, 0.08, 0.27, 0.77, 0xFFD0C0, x, 0.2, 0, 0.03, 0, 0, 0.3); rbox(g, 0.3, 0.55, 0.72, C.black, 0, 0, 0, 0.04); },
  '🍛'(g) { plate(g); ball(g, 0.5, C.white, -0.3, -0.15, 0, 1, 0.6, 1); put(g, new THREE.CylinderGeometry(0.55, 0.55, 0.12, 32), 0xC8781E, 0.35, -0.22, 0.1); sprinkle(g, 5, 0.35, -0.12, [0xF08A24, C.green], 9, 0.08); },
  '🥗'(g) { bowl(g, 1, 0xFFFFFF, 0x7BC043, 0.2); for (const [x, z, c] of [[-0.3, 0, C.green], [0.3, 0.2, C.dkgreen], [0, -0.3, 0x9BE15D], [0.2, -0.1, C.red], [-0.2, 0.3, 0xF6C928]]) ball(g, 0.28, c, x, 0.3, z, 1, 0.4, 1); },
  '🥪'(g) { const tri = poly([[-0.9, -0.6], [0.9, -0.6], [-0.9, 0.8]]); ext(g, tri, 0xF2D8A0, 0.15, 0, 0, -0.25); ext(g, tri, C.green, 0.06, 0.05, 0, -0.08, 1.02); ext(g, tri, 0xF6C928, 0.06, 0, 0, 0.02); ext(g, tri, 0xFFB3B3, 0.08, 0, 0, 0.12); ext(g, tri, 0xF2D8A0, 0.15, 0, 0, 0.3); },
  '🍲'(g) { cyl(g, 0.95, 0.85, 0.9, 0x5A6270, 0, -0.2, 0); for (const d of [-1, 1]) tor(g, 0.15, 0.05, 0x5A6270, d * 1.0, 0.1, 0, 0, Math.PI / 2); cyl(g, 0.88, 0.88, 0.05, 0xC8781E, 0, 0.25, 0); sprinkle(g, 8, 0.6, 0.3, [0xF08A24, C.green, 0xF6C928], 6, 0.1); for (let i = 0; i < 3; i++) ball(g, 0.12, GLASS(0xFFFFFF, 0.4), (i - 1) * 0.3, 0.6 + i * 0.15, 0); },
  '🍗'(g) { ball(g, 0.65, P(0xB5651D, { shininess: 70 }), -0.25, 0.1, 0, 1.2, 1, 1); cyl(g, 0.12, 0.12, 0.8, C.white, 0.6, -0.4, 0, 0, 0, 0.8); for (const d of [-1, 1]) ball(g, 0.15, C.white, 0.85 + d * 0.1, -0.7 + d * 0.1, 0); },
  '🥟'(g) { put(g, new THREE.SphereGeometry(0.85, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2), P(0xF5E6C8), 0, -0.3, 0, 0, 0, 0, 1.3, 1, 0.8); for (let i = 0; i < 5; i++) ball(g, 0.12, 0xEADBB8, (i - 2) * 0.32, 0.5, 0, 1, 0.8, 0.8); },
  '🥣'(g) { bowl(g, 1, 0xFFFFFF, 0xE0413A, 0.2); sprinkle(g, 6, 0.55, 0.25, [C.green, 0xF6C928], 5, 0.08); },
  '🍖'(g) { ball(g, 0.6, 0xB04A3A, 0, 0.2, 0, 1.2, 1, 0.9); cyl(g, 0.12, 0.12, 1.2, C.white, 0.45, -0.55, 0, 0, 0, 0.6); ball(g, 0.18, C.white, 0.75, -1.0, 0); ball(g, 0.6, 0xF2E0D0, 0.1, 0.25, 0.1, 1.05, 0.85, 0.8).material.transparent = false; },
  '🥖'(g) { ball(g, 0.35, P(0xD9A066, { shininess: 50 }), 0, 0, 0, 3, 1, 1).rotation.z = 0.3; for (let i = 0; i < 4; i++) rbox(g, 0.08, 0.3, 0.1, 0xF2D8A0, -0.6 + i * 0.4, 0.05 + i * 0.12, 0.3, 0.03, 0, 0, 0.8); },
  '🧀'(g) { ext(g, poly([[-0.9, -0.5], [0.9, -0.5], [0.9, 0.5]]), 0xF6C928, 0.9); for (const [x, y] of [[0.4, -0.15], [0.65, 0.2], [0.1, -0.3]]) ball(g, 0.12, 0xE6A623, x, y, 0.5, 1, 1, 0.3); },
  // --- dulces ---
  '🍩'(g) { tor(g, 0.6, 0.35, 0xD9A066, 0, 0, 0, 0.5); put(g, new THREE.TorusGeometry(0.6, 0.36, 16, 48), C.pink, 0, 0.05, 0.02, 0.5, 0, 0, 1, 1, 0.6); sprinkle(g, 16, 0.95, 0.28, [C.yellow, C.blue, C.white, C.green], 3, 0.05); },
  '🍰'(g) { ext(g, poly([[-0.9, -0.5], [0.9, -0.5], [-0.9, 0.3]]), 0xFFF1D6, 0.8); rbox(g, 1.85, 0.12, 0.85, C.pink, 0, -0.05, 0, 0.05); ball(g, 0.22, C.red, -0.55, 0.45, 0); ball(g, 0.18, 0xFFFFFF, -0.15, 0.25, 0); },
  '🎂'(g) { cyl(g, 0.95, 0.95, 0.55, 0xFFF1D6, 0, -0.45, 0); cyl(g, 0.97, 0.97, 0.1, C.pink, 0, -0.18, 0); cyl(g, 0.7, 0.7, 0.45, 0xFFF1D6, 0, 0.1, 0); cyl(g, 0.72, 0.72, 0.08, C.pink, 0, 0.33, 0); for (const x of [-0.3, 0, 0.3]) { cyl(g, 0.05, 0.05, 0.4, C.blue, x, 0.55, 0); ball(g, 0.07, GLOW(0xF6C928), x, 0.8, 0, 1, 1.5, 1); } },
  '🍦'(g) { cone(g, 0.45, 1.1, 0xD9A066, 0, -0.45, 0, Math.PI); for (const [y, r] of [[0.25, 0.5], [0.55, 0.38], [0.8, 0.22]]) ball(g, r, 0xFFF4F8, 0, y, 0, 1, 0.7, 1); },
  '🍫'(g) { rbox(g, 1.3, 1.7, 0.25, 0x5A3A1E, 0, 0, 0, 0.06); for (let i = 0; i < 3; i++) for (let j = 0; j < 2; j++) rbox(g, 0.5, 0.45, 0.1, 0x6E4A2C, -0.28 + j * 0.56, 0.5 - i * 0.55, 0.14, 0.05); rbox(g, 1.35, 0.7, 0.3, 0xC0392B, 0, -0.6, 0, 0.05); },
  '🍬'(g) { ball(g, 0.5, P(C.pink, { shininess: 140 }), 0, 0, 0, 1.2, 1, 1); for (const d of [-1, 1]) cone(g, 0.4, 0.6, 0xFFB3D3, d * 0.85, 0, 0, 0, 0, d * Math.PI / 2); },
  '🍭'(g) { cyl(g, 0.8, 0.8, 0.22, 0xFF5FA2, 0, 0.35, 0, Math.PI / 2); for (const r of [0.6, 0.35]) tor(g, r, 0.07, 0xFFFFFF, 0, 0.35, 0.12); cyl(g, 0.05, 0.05, 1.2, 0xFFFFFF, 0, -0.75, 0); },
  '🧁'(g) { cyl(g, 0.6, 0.45, 0.6, 0x3858E9, 0, -0.45, 0); for (const [y, r] of [[0.0, 0.7], [0.3, 0.5], [0.52, 0.3]]) ball(g, r, 0xFFE4F0, 0, y, 0, 1, 0.55, 1); ball(g, 0.15, C.red, 0, 0.75, 0); },
  '🥐'(g) { for (let i = 0; i < 5; i++) { const a = Math.PI * (0.15 + i * 0.175), r = 0.33 - Math.abs(i - 2) * 0.07; ball(g, r, P(0xD98B3A, { shininess: 60 }), Math.cos(a) * 0.65, Math.sin(a) * 0.65 - 0.3, 0, 1, 1, 1.3); } },
  '🥞'(g) { for (let i = 0; i < 4; i++) cyl(g, 0.95, 0.95, 0.2, 0xE6A64A, 0, -0.5 + i * 0.22, 0, 0.35); cyl(g, 0.9, 0.85, 0.06, 0xB5651D, 0, 0.36, 0, 0.35); rbox(g, 0.4, 0.15, 0.3, 0xFFF1A0, 0, 0.45, 0, 0.05, 0.35); },
  '🥨'(g) { const m = P(0xA0522D, { shininess: 60 }); for (const d of [-1, 1]) tor(g, 0.45, 0.13, m, d * 0.35, 0.1, 0, 0, 0, d * 0.3); tor(g, 0.5, 0.13, m, 0, -0.2, 0, 0, 0, 0, Math.PI); sprinkle(g, 10, 0.8, 0.15, [0xFFFFFF], 2, 0.04); },
  '🍿'(g) { cyl(g, 0.65, 0.5, 1.1, 0xFFFFFF, 0, -0.35, 0); for (let i = 0; i < 6; i++) rbox(g, 0.18, 1.12, 0.05, C.red, Math.cos(i) * 0.58, -0.35, Math.sin(i) * 0.58, 0.02, 0, -i); const R = rnd(2); for (let i = 0; i < 12; i++) ball(g, 0.18, 0xFFF4D6, (R() - 0.5) * 1.1, 0.3 + R() * 0.4, (R() - 0.5) * 0.9); },
  '🍮'(g) { cyl(g, 0.6, 0.85, 0.8, P(0xF6C928, { shininess: 100 }), 0, -0.2, 0); cyl(g, 0.6, 0.62, 0.15, 0x8B4513, 0, 0.25, 0); plate(g, 1.1, -0.62); },
  '🥧'(g) { cyl(g, 1, 0.85, 0.4, 0xD9A066, 0, 0, 0, 0.4); for (let i = -2; i <= 2; i++) { rbox(g, 0.12, 0.06, 1.6, 0xC8853A, i * 0.32, 0.22, 0, 0.03, 0.4); rbox(g, 1.6, 0.06, 0.12, 0xC8853A, 0, 0.22 + i * 0.12, i * 0.3, 0.03, 0.4); } },
  '🍯'(g) { ball(g, 0.75, P(0xE8A317, { shininess: 120, transparent: true, opacity: 0.92 }), 0, -0.2, 0, 1, 0.95, 1); cyl(g, 0.5, 0.5, 0.2, 0x8B5A2B, 0, 0.55, 0); cyl(g, 0.04, 0.04, 1, 0x8B5A2B, 0.35, 0.8, 0, 0, 0, -0.5); },
  '🫕'(g) { cyl(g, 0.8, 0.6, 0.7, 0xE0413A, 0, -0.2, 0); cyl(g, 0.75, 0.75, 0.05, 0x5A3A1E, 0, 0.15, 0); for (const d of [-1, 1]) { cyl(g, 0.025, 0.025, 1.3, MET(), d * 0.3, 0.6, 0, 0, 0, d * 0.4); ball(g, 0.15, 0xFF5F7A, d * 0.1, 0.25, 0); } },
  '🥮'(g) { cyl(g, 0.9, 0.9, 0.45, P(0xC8853A, { shininess: 50 }), 0, 0, 0, 0.5); for (let i = 0; i < 8; i++) { const a = i / 8 * 6.28; ball(g, 0.12, 0xB06F2A, Math.cos(a) * 0.5, 0.22, Math.sin(a) * 0.5, 1, 0.4, 1); } ball(g, 0.2, 0xB06F2A, 0, 0.24, 0, 1, 0.4, 1); },
  // --- bebidas ---
  '☕'(g) { cyl(g, 0.6, 0.5, 0.8, C.white, 0, 0, 0); tor(g, 0.25, 0.07, C.white, 0.62, 0.05, 0, 0, 0, 0); cyl(g, 0.55, 0.55, 0.04, 0x5A3A1E, 0, 0.38, 0); cyl(g, 0.95, 0.9, 0.08, C.white, 0, -0.42, 0); for (let i = 0; i < 2; i++) ball(g, 0.1, GLASS(0xFFFFFF, 0.5), -0.1 + i * 0.2, 0.7 + i * 0.25, 0); },
  '🥤'(g) { cyl(g, 0.55, 0.42, 1.3, C.red, 0, -0.2, 0); rbox(g, 1.2, 0.12, 1.2, 0xFFFFFF, 0, 0.5, 0, 0.05); cyl(g, 0.06, 0.06, 0.9, 0xFFFFFF, 0.15, 0.85, 0, 0, 0, -0.3); rbox(g, 0.9, 0.35, 0.05, 0xFFFFFF, 0, -0.2, 0.52, 0.05); },
  '🥛'(g) { cyl(g, 0.55, 0.48, 1.4, GLASS(0xFFFFFF, 0.35), 0, 0, 0); cyl(g, 0.5, 0.45, 1.15, 0xFAFAFA, 0, -0.1, 0); },
  '🧃'(g) { rbox(g, 0.9, 1.4, 0.6, 0x9BE15D, 0, 0, 0, 0.08); ball(g, 0.3, C.orange, 0, 0, 0.3, 1, 1, 0.2); cyl(g, 0.04, 0.04, 0.6, 0xFFFFFF, 0.25, 0.9, 0, 0, 0, -0.3); },
  '🍵'(g) { cyl(g, 0.7, 0.55, 0.8, 0x6E8B3D, 0, 0, 0); cyl(g, 0.65, 0.65, 0.04, 0x9BC53D, 0, 0.38, 0); for (let i = 0; i < 2; i++) ball(g, 0.1, GLASS(0xFFFFFF, 0.5), -0.1 + i * 0.2, 0.7 + i * 0.25, 0); },
  '🧋'(g) { cyl(g, 0.55, 0.45, 1.3, GLASS(0xFFFFFF, 0.3), 0, -0.1, 0); cyl(g, 0.5, 0.42, 1.0, 0xD8B48A, 0, -0.2, 0); sprinkle(g, 10, 0.35, -0.55, [0x2A2A33], 3, 0.09); put(g, new THREE.SphereGeometry(0.56, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), GLASS(0xFFFFFF, 0.4), 0, 0.55, 0); cyl(g, 0.07, 0.07, 1.2, C.pink, 0.1, 0.9, 0, 0, 0, -0.25); },
  '🍹'(g) { cone(g, 0.75, 0.9, GLASS(0xFFB3D3, 0.7), 0, 0.2, 0, Math.PI); cyl(g, 0.04, 0.04, 0.7, MET(), 0, -0.5, 0); cyl(g, 0.4, 0.4, 0.05, 0xFFFFFF, 0, -0.85, 0); cone(g, 0.4, 0.25, C.blue, 0.4, 0.95, 0, 0, 0, -0.5); cyl(g, 0.02, 0.02, 0.7, 0x8B5A2B, 0.25, 0.65, 0, 0, 0, -0.5); ball(g, 0.12, C.red, -0.45, 0.68, 0.2); },
  '🥥'(g) { put(g, new THREE.SphereGeometry(0.9, 32, 16, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), 0x6B4423, 0, 0.1, 0, 0.4); cyl(g, 0.85, 0.85, 0.05, 0xFFFDF5, 0, 0.1, 0, 0.4); cyl(g, 0.04, 0.04, 1, C.pink, 0.2, 0.55, 0, 0.4, 0, -0.3); },
};

// Objetos planos que se entienden mejor vistos un poco desde arriba.
const TILT = { '🍳': 0.95, '🥘': 0.8, '🍝': 0.75, '🍛': 0.75, '🥗': 0.6, '🥣': 0.6, '🍜': 0.5, '🥞': 0.45, '🍽️': 0.35, '🛁': 0.5, '🛏️': 0.45, '🥧': 0.6, '🥮': 0.6, '🍩': 0.5 };

// Juegos y medallas: reutiliza los dibujos de mg-sprites.js
const FROM_GAMES = { '🏆': 'trophy', '🥇': 'medal-2', '🥈': 'medal-1', '🥉': 'medal-0', '🐛': 'bug', '🍪': 'cookie', '🔌': 'plug-0', '🎹': 'key-1', '🖤': 'heart-empty' };

// ---------------- prendas: miniatura del modelo real ----------------
const COS_BY_EMO = {};
for (const c of COSMETICS) if (!COS_BY_EMO[c.emo]) COS_BY_EMO[c.emo] = c.id;
const COS_BY_NAME = Object.fromEntries(COSMETICS.map(c => [c.name, c]));
const cosSlot = (id) => COSMETICS.find(c => c.id === id)?.slot;
const COS_TILT = { neck: 0.75 };   // collares y bufandas: un poco desde arriba para que se vea su forma
const FOOD_BY_NAME = Object.fromEntries(FOODS.map(f => [f.name, f]));

function buildCosmetic(g, id) {
  const c = COSMETICS.find(x => x.id === id);
  if (!c) return;
  if (c.slot === 'skin') {
    // un Wapuu de muestra con ese color de piel
    const body = P(c.skin.body, { shininess: c.skin.metalness ? 140 : 60, specular: c.skin.metalness ? 0xFFFFFF : 0x444444 });
    ball(g, 0.95, body, 0, 0, 0, 1, 0.92, 0.9);
    for (const d of [-1, 1]) cone(g, 0.32, 0.9, P(c.skin.ear), d * 0.9, 0.55, 0, 0, 0, d * 1.1);
    face(g, 0.8, 1, 0.05);
    return;
  }
  const m = World.prototype._cosmetic.call({ wpLogoTex: null }, id);
  if (!m) return;
  m.traverse(o => o.userData.tick?.(0));          // las animadas, en su postura inicial
  if (id.startsWith('balloon-')) m.children[1].visible = false;   // el globo sin la cuerda larga
  if (c.slot === 'back') m.rotation.y = Math.PI;   // las prendas de espalda se ven por detrás
  g.add(m);
}

// ---------------- «fotografía» ----------------
let renderer = null, scene, camera;
const urls = {};
function setup() {
  renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(1);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.setClearColor(0x000000, 0);
  scene = new THREE.Scene();
  scene.add(new THREE.HemisphereLight(0xFFFFFF, 0x7A7E99, 1.5));
  const key = new THREE.DirectionalLight(0xFFFFFF, 1.6); key.position.set(-2, 3, 4); scene.add(key);
  const rim = new THREE.DirectionalLight(0xBFD4FF, 0.7); rim.position.set(3, -1, -2); scene.add(rim);
  camera = new THREE.PerspectiveCamera(26, 1, 0.05, 80);
}
function shoot(build, size = 128, tilt = 0.28) {
  if (!renderer) setup();
  const g = new THREE.Group();
  build(g);
  g.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(g);
  if (box.isEmpty()) return '';
  const s = box.getSize(new THREE.Vector3()), c = box.getCenter(new THREE.Vector3());
  const wrap = new THREE.Group(); wrap.add(g); g.position.sub(c); scene.add(wrap);
  renderer.setSize(size, size, false);
  camera.aspect = 1;
  const r = Math.max(s.x, s.y, s.z) * 0.62;
  const dist = r / Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
  camera.position.set(0, dist * Math.sin(tilt), dist * Math.cos(tilt));
  camera.lookAt(0, 0, 0); camera.updateProjectionMatrix();
  renderer.render(scene, camera);
  const url = renderer.domElement.toDataURL('image/png');
  scene.remove(wrap);
  wrap.traverse(o => { o.geometry?.dispose(); if (o.material) [].concat(o.material).forEach(m => { m.map?.dispose(); m.dispose(); }); });
  return url;
}

// Clave → imagen. Claves: un emoji, o 'cos:<id>' para una prenda concreta.
function urlFor(key) {
  if (key in urls) return urls[key];
  let url = '';
  try {
    if (key.startsWith('cos:')) url = shoot((g) => buildCosmetic(g, key.slice(4)), 128, COS_TILT[cosSlot(key.slice(4))] ?? 0.28);
    else if (M[key]) url = shoot(M[key], 128, TILT[key] ?? 0.28);
    else if (FROM_GAMES[key]) { ensureSprites(); url = sprite(FROM_GAMES[key])?.toDataURL('image/png') || ''; }
    else if (COS_BY_EMO[key]) url = shoot((g) => buildCosmetic(g, COS_BY_EMO[key]));
  } catch (e) { console.warn('icono 3D', key, e); }
  urls[key] = url;
  return url;
}
export const hasIcon = (key) => !!(M[key] || FROM_GAMES[key] || COS_BY_EMO[key] || key.startsWith('cos:'));
export const icon3d = (key, cls = 'e3d') => `<img class="${cls}" src="${urlFor(key)}" alt="" aria-hidden="true">`;

// ---------------- sustitución automática ----------------
const EMOJI = /(?:\p{Extended_Pictographic}(?:\uFE0F|\u20E3)?(?:\u200D\p{Extended_Pictographic}\uFE0F?)*)/gu;
const SKIP = new Set(['SCRIPT', 'STYLE', 'TEXTAREA', 'INPUT', 'CANVAS', 'TITLE', 'NOSCRIPT']);
const norm = (e) => (M[e] || FROM_GAMES[e] || COS_BY_EMO[e] ? e : M[e + '\uFE0F'] || COS_BY_EMO[e + '\uFE0F'] ? e + '\uFE0F' : e.replace(/\uFE0F/g, ''));
const pending = [];          // { img, key } esperando a ser fotografiados
let scheduled = false;

// Si el emoji es el dibujo de la tarjeta de una prenda, se usa esa prenda exacta.
function contextKey(node, e) {
  if (!node.parentElement?.classList.contains('emo')) return null;   // solo el dibujo, no el precio
  const box = node.parentElement.closest('.item, .tier, .food-card');
  if (!box) return null;
  const name = box.querySelector('.iname, .tname, .fname')?.textContent?.replace(/ · probando$/, '').trim();
  if (box.classList.contains('food-card')) return null;
  const c = name && COS_BY_NAME[name];
  return c ? `cos:${c.id}` : null;
}

function convert(node) {
  const text = node.nodeValue;
  if (!text || !EMOJI.test(text)) return;
  EMOJI.lastIndex = 0;
  const parent = node.parentElement;
  if (!parent || SKIP.has(parent.tagName) || parent.closest('[data-no3d]')) return;
  const frag = document.createDocumentFragment();
  let last = 0, changed = false;
  for (const m of text.matchAll(EMOJI)) {
    const e = norm(m[0]);
    const key = contextKey(node, e) || (hasIcon(e) ? e : null);
    if (!key) continue;
    if (m.index > last) frag.append(text.slice(last, m.index));
    const img = document.createElement('img');
    img.className = 'e3d'; img.alt = ''; img.decoding = 'async';
    if (key in urls) { if (urls[key]) img.src = urls[key]; } else pending.push({ img, key });
    frag.append(img);
    last = m.index + m[0].length;
    changed = true;
  }
  if (!changed) return;
  if (last < text.length) frag.append(text.slice(last));
  node.replaceWith(frag);
  schedule();
}

function walk(root) {
  if (root.nodeType === 3) return convert(root);
  if (root.nodeType !== 1 || SKIP.has(root.tagName)) return;
  const tw = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const list = [];
  while (tw.nextNode()) list.push(tw.currentNode);
  list.forEach(convert);
}

// Las fotos se hacen poco a poco (≈10 ms por fotograma) para que nada se trabe.
function schedule() {
  if (scheduled || !pending.length) return;
  scheduled = true;
  requestAnimationFrame(() => {
    scheduled = false;
    const t0 = performance.now();
    while (pending.length && performance.now() - t0 < 10) {
      const { img, key } = pending.shift();
      const u = urlFor(key);
      if (u) img.src = u;
    }
    // las que ya estaban hechas, de golpe
    for (let i = pending.length - 1; i >= 0; i--) if (pending[i].key in urls) { if (urls[pending[i].key]) pending[i].img.src = urls[pending[i].key]; pending.splice(i, 1); }
    schedule();
  });
}

export function start3dIcons() {
  walk(document.body);
  new MutationObserver((muts) => {
    for (const m of muts) {
      if (m.type === 'characterData') convert(m.target);
      else m.addedNodes.forEach(walk);
    }
  }).observe(document.body, { childList: true, subtree: true, characterData: true });
}
