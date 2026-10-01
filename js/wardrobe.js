// Armario de Wapuu: más de cien cosméticos y zonas nuevas (boca, cuello, espalda y color de piel).
// Amplía la tienda (state.js) y la escena (world.js) sin tocarlas: añade entradas a COSMETICS,
// zonas a SLOT_NAMES y enseña a World a construir, colocar y animar cada prenda.
//
// Medidas del modelo (espacio de squashG): cuerpo de y 0 a 5,7, ancho ±2,3, cara en z ≈ 2,1,
// espalda en z ≈ −3,3, ojos en y 4,27, nariz en (0, 4,05, 2,2), cuello en y ≈ 3,4.
import * as THREE from 'three';
import { World } from './world.js';
import { COSMETICS, SLOT_NAMES } from './state.js';

// ---------------- zonas ----------------
// Orden de las pestañas de la tienda. Las tres primeras ya existían.
const SLOTS = [
  ['head', '🎩 Cabeza'], ['face', '👓 Ojos'], ['mouth', '👄 Boca'], ['ear', '🌼 Oreja'],
  ['neck', '🧣 Cuello'], ['back', '🎒 Espalda'], ['skin', '🎨 Color'],
];
for (const k of Object.keys(SLOT_NAMES)) delete SLOT_NAMES[k];
for (const [k, v] of SLOTS) SLOT_NAMES[k] = v;
const EXTRA_SLOTS = ['mouth', 'neck', 'back'];

// ---------------- colores ----------------
const C = {
  red: 0xE0413A, blue: 0x3858E9, green: 0x3FB950, pink: 0xFF5FA2, purple: 0x7B4FD6, black: 0x1E1E1E,
  white: 0xF4F4F4, orange: 0xF08A24, yellow: 0xF6C928, brown: 0x8B5A2B, teal: 0x1FB5A8, beige: 0xE8D3A2,
  gold: 0xF2B705, silver: 0xC9CED6, navy: 0x1D2B6B, cyan: 0x38D6F5, lime: 0x9BE15D,
};

// ---------------- ayudantes de geometría ----------------
const M = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.6, metalness: 0, ...o });
const metal = (color) => M(color, { roughness: 0.3, metalness: 0.45 });
const glow = (color, i = 0.8) => M(color, { emissive: color, emissiveIntensity: i, roughness: 0.4 });
const glass = (color = 0xDDEBFF, opacity = 0.3) => new THREE.MeshStandardMaterial({ color, transparent: true, opacity, roughness: 0.05, depthWrite: false });
const mat = (c) => (c instanceof THREE.Material ? c : M(c));
function mesh(geo, m, x = 0, y = 0, z = 0) { const o = new THREE.Mesh(geo, mat(m)); o.position.set(x, y, z); return o; }
const sphere = (r, m, x, y, z) => mesh(new THREE.SphereGeometry(r, 24, 16), m, x, y, z);
const halfSphere = (r, m, x, y, z) => mesh(new THREE.SphereGeometry(r, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2), m, x, y, z);
const cyl = (rt, rb, h, m, x, y, z, open = false) => mesh(new THREE.CylinderGeometry(rt, rb, h, 32, 1, open), m, x, y, z);
const cone = (r, h, m, x, y, z) => mesh(new THREE.ConeGeometry(r, h, 24), m, x, y, z);
const box = (w, h, d, m, x, y, z) => mesh(new THREE.BoxGeometry(w, h, d), m, x, y, z);
const torus = (r, t, m, x, y, z, arc = Math.PI * 2) => mesh(new THREE.TorusGeometry(r, t, 12, 48, arc), m, x, y, z);
const flat = (o) => { o.rotation.x = Math.PI / 2; return o; };
function extrude(shape, m, depth = 0.08) {
  const g = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false, curveSegments: 16 });
  g.center();
  return mesh(g, m);
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
    const a = Math.PI / 2 + (i / (n * 2)) * Math.PI * 2;
    const r = i % 2 ? r2 : r1;
    i ? s.lineTo(Math.cos(a) * r, Math.sin(a) * r) : s.moveTo(Math.cos(a) * r, Math.sin(a) * r);
  }
  return s;
}
// Anillo elíptico que rodea el cuerpo a la altura y (cuello o cintura).
function around(y, tube, m, sx = 2.42, sz = 2.8, cz = -0.57) {
  const t = torus(1, tube, m, 0, y, cz);
  t.rotation.x = Math.PI / 2;
  t.scale.set(sx, sz, 1);
  return t;
}
// Puntos de ese mismo contorno (para collares de perlas o flores).
function aroundPoints(y, n, sx = 2.48, sz = 2.86, cz = -0.57) {
  const pts = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    pts.push(new THREE.Vector3(Math.sin(a) * sx, y, cz + Math.cos(a) * sz));
  }
  return pts;
}
const tick = (o, fn) => { o.userData.tick = fn; return o; };

// ---------------- piezas reutilizables ----------------
function bowPiece(g, color, s = 1) {
  const m = M(color, { roughness: 0.45 });
  for (const d of [-1, 1]) {
    const c = cone(0.34 * s, 0.7 * s, m, d * 0.33 * s, 0, 0);
    c.rotation.z = d * Math.PI / 2; g.add(c);
  }
  g.add(sphere(0.16 * s, m, 0, 0, 0));
}
function flowerPiece(g, petal, center = C.yellow, s = 1, n = 6) {
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const p = sphere(0.2 * s, petal, Math.cos(a) * 0.26 * s, Math.sin(a) * 0.26 * s, 0);
    p.scale.z = 0.4; g.add(p);
  }
  g.add(sphere(0.16 * s, center, 0, 0, 0.05 * s));
}
function wingPair(g, makeWing, y = 3.4, z = -3.0) {
  const L = new THREE.Group(), R = new THREE.Group();
  // grandes y abiertas hacia los lados, para que asomen también viendo a Wapuu de frente
  L.add(makeWing()); R.add(makeWing()); L.scale.setScalar(1.4); R.scale.set(-1.4, 1.4, 1.4);
  L.position.set(0.7, y, z); R.position.set(-0.7, y, z);
  g.add(L, R);
  tick(g, (t) => { const f = Math.sin(t * 4) * 0.22; L.rotation.y = 0.3 + f; R.rotation.y = -0.3 - f; });
}

// ---------------- catálogo ----------------
// Cada prenda: id, emoji, nombre, zona, precio, nivel mínimo opcional y una función que la construye.
const BUILD = {};
const ITEMS = [];
function add(slot, id, emo, name, price, build, level) {
  ITEMS.push({ id, emo, name, slot, price, ...(level ? { level } : {}) });
  BUILD[id] = build;
}

// ===== CABEZA =====
const HEAD_Y = 5.0, HEAD_Z = -0.4;
for (const [k, name, color] of [['red', 'roja', C.red], ['blue', 'azul', C.blue], ['green', 'verde', C.green], ['pink', 'rosa', C.pink]]) {
  add('head', `beanie-${k}`, '🧶', `Gorro de lana ${name}`, 14, (g) => {
    const dome = halfSphere(1.5, color, 0, 0, 0); dome.scale.y = 0.85;
    g.add(dome, flat(torus(1.47, 0.2, color, 0, 0.05, 0)), sphere(0.36, C.white, 0, 1.38, 0));
    g.position.set(0, HEAD_Y, HEAD_Z);
  });
}
for (const [k, name, color] of [['brown', 'marrón', C.brown], ['black', 'negro', C.black]]) {
  add('head', `cowboy-${k}`, '🤠', `Sombrero vaquero ${name}`, 30, (g) => {
    const brim = cyl(2.3, 2.3, 0.1, color, 0, 0, 0); brim.scale.z = 0.85;
    g.add(brim, cyl(1.0, 1.15, 1.0, color, 0, 0.5, 0), cyl(1.17, 1.17, 0.2, C.beige, 0, 0.15, 0));
    g.position.set(0, 5.6, HEAD_Z); g.rotation.z = -0.08;
  });
}
for (const [k, name, color] of [['red', 'roja', C.red], ['black', 'negra', C.black], ['blue', 'azul', C.navy]]) {
  add('head', `beret-${k}`, '🎨', `Boina ${name}`, 16, (g) => {
    const b = sphere(1.45, color, 0, 0, 0); b.scale.y = 0.32;
    g.add(b, cyl(0.06, 0.06, 0.3, color, 0, 0.55, 0));
    g.position.set(0.25, 5.55, HEAD_Z); g.rotation.z = -0.22;
  });
}
for (const [k, name, color] of [['green', 'verde', 0x6E8B3D], ['beige', 'beis', C.beige]]) {
  add('head', `bucket-${k}`, '👒', `Gorro de pescador ${name}`, 18, (g) => {
    g.add(cyl(1.1, 1.45, 0.9, color, 0, 0.45, 0), cyl(1.48, 2.0, 0.25, color, 0, 0, 0, true));
    g.position.set(0, 5.2, HEAD_Z);
  });
}
add('head', 'chef', '👨‍🍳', 'Gorro de chef', 22, (g) => {
  g.add(cyl(1.15, 1.15, 0.7, C.white, 0, 0.35, 0));
  for (const [x, z] of [[-0.55, 0], [0.55, 0], [0, 0.45], [0, -0.45], [0, 0]]) g.add(sphere(0.75, C.white, x, 1.15, z));
  g.position.set(0, 5.3, HEAD_Z);
});
add('head', 'viking', '🪓', 'Casco vikingo', 45, (g) => {
  const helm = halfSphere(1.5, metal(0x9AA3AE), 0, 0, 0); helm.scale.y = 0.85;
  g.add(helm, flat(torus(1.48, 0.12, metal(0x7A6232), 0, 0.05, 0)));
  for (const d of [-1, 1]) {
    const h = cone(0.28, 1.3, C.white, d * 1.55, 0.8, 0); h.rotation.z = -d * 0.75; g.add(h);
  }
  g.position.set(0, HEAD_Y, HEAD_Z);
}, 3);
add('head', 'santa', '🎅', 'Gorro de Papá Noel', 20, (g) => {
  const c = cone(1.25, 2.3, C.red, 0, 1.15, 0); c.rotation.z = 0.35; c.position.x = 0.35;
  g.add(c, flat(torus(1.3, 0.28, C.white, 0, 0, 0)), sphere(0.35, C.white, 0.8, 2.3, 0));
  g.position.set(0, 5.2, HEAD_Z);
});
add('head', 'witch', '🧹', 'Sombrero de bruja', 32, (g) => {
  const cn = cone(1.0, 2.8, C.black, 0, 1.4, 0); cn.rotation.z = 0.15;
  g.add(cyl(2.0, 2.0, 0.08, C.black, 0, 0, 0), cn, cyl(1.02, 1.02, 0.25, C.purple, 0, 0.18, 0));
  g.position.set(0, 5.5, HEAD_Z);
});
add('head', 'pirate', '🏴‍☠️', 'Sombrero pirata', 35, (g) => {
  const brim = cyl(1.9, 1.9, 0.15, C.black, 0, 0, 0); brim.scale.z = 0.62;
  const crown = halfSphere(1.15, C.black, 0, 0, 0); crown.scale.y = 0.75;
  g.add(brim, crown, sphere(0.26, C.white, 0, 0.45, 1.05), box(0.4, 0.07, 0.05, C.white, 0, 0.2, 1.12));
  g.position.set(0, 5.45, HEAD_Z);
});
add('head', 'grad', '🎓', 'Birrete de graduación', 28, (g) => {
  const top = box(2.5, 0.12, 2.5, C.black, 0, 0.6, 0); top.rotation.y = Math.PI / 4;
  g.add(cyl(1.1, 1.15, 0.6, C.black, 0, 0.3, 0), top, sphere(0.12, C.gold, 0, 0.7, 0), box(0.06, 0.9, 0.06, C.gold, 1.15, 0.2, 0.4));
  g.position.set(0, 5.4, HEAD_Z);
});
add('head', 'propeller', '🚁', 'Gorra de hélice', 26, (g) => {
  const dome = halfSphere(1.4, C.blue, 0, 0, 0); dome.scale.y = 0.7;
  const blades = new THREE.Group();
  blades.add(box(2.2, 0.05, 0.35, C.red, 0, 0, 0), box(0.35, 0.05, 2.2, C.yellow, 0, 0, 0));
  blades.position.y = 1.35;
  g.add(dome, cyl(0.06, 0.06, 0.4, C.black, 0, 1.15, 0), blades, sphere(0.12, C.green, 0, 1.4, 0));
  tick(blades, (t) => { blades.rotation.y = t * 9; });
  g.position.set(0, 5.05, HEAD_Z);
});
for (const [k, name, color] of [['white', 'blancas', C.white], ['pink', 'rosas', 0xFFB8D2]]) {
  add('head', `bunny-${k}`, '🐰', `Orejas de conejo ${name}`, 24, (g) => {
    for (const d of [-1, 1]) {
      const e = sphere(0.36, color, d * 0.55, 1.2, 0); e.scale.y = 3; e.rotation.z = -d * 0.15;
      const inner = sphere(0.2, 0xFF8FB3, d * 0.55, 1.2, 0.2); inner.scale.set(1, 4.2, 0.4); inner.rotation.z = -d * 0.15;
      g.add(e, inner);
    }
    g.add(around(0, 0.1, color, 1.33, 1.6, -0.1));
    g.position.set(0, 5.35, HEAD_Z);
  });
}
for (const [k, name, color] of [['black', 'negras', C.black], ['orange', 'naranjas', C.orange]]) {
  add('head', `cat-${k}`, '🐱', `Orejas de gato ${name}`, 20, (g) => {
    for (const d of [-1, 1]) {
      const e = cone(0.5, 0.95, color, d * 0.75, 0.35, 0); e.rotation.z = -d * 0.25;
      const inner = cone(0.28, 0.55, 0xFF8FB3, d * 0.75, 0.3, 0.2); inner.rotation.z = -d * 0.25;
      g.add(e, inner);
    }
    g.position.set(0, 5.5, HEAD_Z);
  });
}
add('head', 'headbow', '🎀', 'Diadema con lazo', 15, (g) => {
  g.add(around(0, 0.09, C.red, 1.33, 1.6, -0.1));
  const b = new THREE.Group(); bowPiece(b, C.red, 1.6); b.position.set(0.6, 0.35, 0.9); b.rotation.z = 0.3; g.add(b);
  g.position.set(0, 5.4, HEAD_Z);
});
add('head', 'flowercrown', '💐', 'Corona de flores', 30, (g) => {
  g.add(around(0, 0.08, 0x4E9A3A, 1.33, 1.6, -0.1));
  const cols = [C.pink, C.white, C.yellow, 0xB794F6];
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * Math.PI * 2;
    const f = new THREE.Group(); flowerPiece(f, cols[i % 4], C.yellow, 0.9);
    f.position.set(Math.sin(a) * 1.36, 0.05, -0.1 + Math.cos(a) * 1.63); f.rotation.y = a; f.rotation.x = -0.6;
    g.add(f);
  }
  g.position.set(0, 5.4, HEAD_Z);
});
add('head', 'tiara', '👸', 'Tiara', 55, (g) => {
  const s = metal(C.silver);
  const band = torus(1.25, 0.07, s, 0, 0, 0, Math.PI); band.rotation.x = Math.PI / 2; band.rotation.z = Math.PI; g.add(band);
  for (let i = 0; i < 5; i++) {
    const a = (i / 4) * Math.PI;
    const x = Math.cos(a) * 1.25, z = Math.sin(a) * 1.25;
    const sp = cone(0.12, i === 2 ? 0.75 : 0.45, s, x, i === 2 ? 0.35 : 0.22, z); g.add(sp);
    g.add(sphere(0.1, [C.pink, C.cyan, C.red, C.cyan, C.pink][i], x * 1.02, 0.12, z * 1.02));
  }
  g.position.set(0, 5.35, HEAD_Z + 0.1);
}, 4);
add('head', 'horns', '😈', 'Cuernos de diablillo', 18, (g) => {
  for (const d of [-1, 1]) { const h = cone(0.25, 0.85, C.red, d * 0.75, 0.35, 0.3); h.rotation.z = -d * 0.4; g.add(h); }
  g.position.set(0, 5.35, HEAD_Z);
});
add('head', 'alien', '👽', 'Antenas de alien', 22, (g) => {
  for (const d of [-1, 1]) {
    const a = new THREE.Group();
    a.add(cyl(0.05, 0.05, 1.1, C.lime, 0, 0.55, 0), sphere(0.2, glow(C.lime, 0.6), 0, 1.15, 0));
    a.position.set(d * 0.6, 0, 0); a.rotation.z = -d * 0.3;
    tick(a, (t) => { a.rotation.z = -d * 0.3 + Math.sin(t * 5 + d) * 0.12; });
    g.add(a);
  }
  g.add(around(0, 0.08, C.lime, 1.33, 1.6, -0.1));
  g.position.set(0, 5.4, HEAD_Z);
});
add('head', 'sombrero', '🌵', 'Sombrero mexicano', 50, (g) => {
  const brim = cyl(2.9, 2.6, 0.15, 0xE2B24C, 0, 0, 0);
  g.add(brim, cone(1.05, 1.7, 0xE2B24C, 0, 0.9, 0), cyl(0.95, 1.0, 0.25, C.red, 0, 0.3, 0), flat(torus(2.85, 0.07, C.green, 0, 0.05, 0)));
  g.position.set(0, 5.65, HEAD_Z);
}, 3);
add('head', 'fez', '🟥', 'Fez', 18, (g) => {
  g.add(cyl(0.75, 0.95, 1.0, 0xB22222, 0, 0.5, 0), cyl(0.03, 0.03, 0.7, C.black, 0.45, 0.75, 0), sphere(0.1, C.black, 0.7, 0.45, 0));
  g.position.set(0.1, 5.45, HEAD_Z);
});
add('head', 'hardhat', '👷', 'Casco de obra', 24, (g) => {
  const d = halfSphere(1.5, C.yellow, 0, 0, 0); d.scale.y = 0.75;
  const brim = cyl(1.7, 1.7, 0.08, C.yellow, 0, 0.02, 0.15);
  const ridge = box(0.2, 0.25, 2.6, C.yellow, 0, 1.0, 0);
  g.add(d, brim, ridge);
  g.position.set(0, 5.05, HEAD_Z);
});
add('head', 'straw', '👒', 'Sombrero de paja', 26, (g) => {
  g.add(cyl(2.2, 2.2, 0.08, 0xE8C872, 0, 0, 0), cyl(1.05, 1.15, 0.65, 0xE8C872, 0, 0.32, 0), cyl(1.17, 1.17, 0.18, C.red, 0, 0.12, 0));
  g.position.set(0, 5.55, HEAD_Z);
});
add('head', 'sailor', '⚓', 'Gorro de marinero', 20, (g) => {
  g.add(cyl(1.25, 1.3, 0.5, C.white, 0, 0.25, 0), cyl(1.32, 1.32, 0.12, C.navy, 0, 0.06, 0));
  g.position.set(0, 5.4, HEAD_Z);
});
add('head', 'mushroom', '🍄', 'Sombrero champiñón', 28, (g) => {
  const cap = halfSphere(1.75, C.red, 0, 0, 0); cap.scale.y = 0.7;
  g.add(cap);
  for (const [x, y, z, r] of [[0, 1.2, 0, 0.32], [0.95, 0.75, 0.6, 0.25], [-0.95, 0.75, 0.5, 0.25], [0.3, 0.7, -1.2, 0.27], [-0.6, 0.85, -0.9, 0.22], [0.55, 0.65, 1.25, 0.2]]) g.add(sphere(r, C.white, x, y, z));
  g.position.set(0, 5.05, HEAD_Z);
});
add('head', 'chick', '🐥', 'Pollito en la cabeza', 30, (g) => {
  const body = sphere(0.55, C.yellow, 0, 0.45, 0); body.scale.y = 0.85;
  const beak = cone(0.1, 0.25, C.orange, 0, 0.95, 0.42); beak.rotation.x = Math.PI / 2;
  g.add(body, sphere(0.38, C.yellow, 0, 1.0, 0.1), beak, sphere(0.06, C.black, 0.15, 1.1, 0.4), sphere(0.06, C.black, -0.15, 1.1, 0.4));
  tick(g, (t) => { g.rotation.y = Math.sin(t * 1.5) * 0.4; });
  g.position.set(0, 5.6, HEAD_Z + 0.2);
});
add('head', 'astronaut', '🧑‍🚀', 'Casco de astronauta', 120, (g) => {
  g.add(sphere(3.35, glass(0xCFE8FF, 0.22), 0, 0, 0));
  const ant = cyl(0.05, 0.05, 0.8, metal(C.silver), 1.4, 3.1, -0.4); ant.rotation.z = -0.4; g.add(ant, sphere(0.14, glow(C.red, 1), 1.72, 3.45, -0.4));
  g.position.set(0, 4.2, HEAD_Z);
}, 6);
add('head', 'pumpkin', '🎃', 'Calabaza', 34, (g) => {
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    const s = sphere(0.55, C.orange, Math.cos(a) * 0.55, 0.5, Math.sin(a) * 0.55); s.scale.set(0.8, 1, 0.8); g.add(s);
  }
  g.add(cyl(0.1, 0.12, 0.4, 0x4E7A2A, 0, 1.15, 0));
  g.position.set(0, 5.35, HEAD_Z);
});
add('head', 'unicorn', '🦄', 'Cuerno de unicornio', 40, (g) => {
  const h = cone(0.36, 1.9, metal(0xFFD1F0), 0, 0.95, 0.7); h.rotation.x = 0.3;
  g.add(h);
  for (let i = 0; i < 4; i++) { const r = torus(0.3 - i * 0.06, 0.035, C.gold, 0, 0.3 + i * 0.38, 0.78 + i * 0.11); r.rotation.x = Math.PI / 2 + 0.3; g.add(r); }
  g.position.set(0, 5.3, HEAD_Z);
}, 4);

// ===== OJOS =====
const EYES = (g) => g.position.set(0, 4.3, 2.12);
function frames(g, lens, frame, shapeFn) {
  for (const x of [-0.52, 0.52]) {
    const L = shapeFn(x); L.position.x = x; L.rotation.y = x * 0.5; g.add(L);
    const arm = box(0.07, 0.07, 1.2, frame, x * 1.85, 0.05, -0.55); arm.rotation.y = x > 0 ? 0.35 : -0.35; g.add(arm);
  }
  g.add(box(0.36, 0.08, 0.08, frame, 0, 0.1, 0.08));
  EYES(g);
}
for (const [k, name, color] of [['red', 'rojas', C.red], ['blue', 'azules', C.blue], ['pink', 'rosas', C.pink]]) {
  add('face', `round-${k}`, '👓', `Gafas redondas ${name}`, 16, (g) => {
    const f = M(color, { roughness: 0.3 });
    frames(g, null, f, () => { const o = new THREE.Group(); o.add(torus(0.42, 0.08, f, 0, 0, 0), mesh(new THREE.CircleGeometry(0.4, 32), glass(), 0, 0, 0.01)); return o; });
  });
}
for (const [k, name, color] of [['pink', 'rosas', C.pink], ['red', 'rojas', C.red]]) {
  add('face', `heart-${k}`, '😍', `Gafas de corazón ${name}`, 24, (g) => {
    const f = M(color, { roughness: 0.3 });
    frames(g, null, f, () => { const h = extrude(heartShape(), M(color, { roughness: 0.2, transparent: true, opacity: 0.85 }), 0.06); h.scale.setScalar(1.25); return h; });
  });
}
for (const [k, name, color] of [['gold', 'doradas', C.gold], ['purple', 'moradas', C.purple]]) {
  add('face', `starglasses-${k}`, '🤩', `Gafas de estrella ${name}`, 26, (g) => {
    const f = metal(color);
    frames(g, null, f, () => extrude(starShape(0.55, 0.26), f, 0.06));
  });
}
add('face', '3d', '🎬', 'Gafas 3D', 14, (g) => {
  const f = M(C.white);
  frames(g, null, f, (x) => {
    const o = new THREE.Group();
    o.add(box(0.85, 0.6, 0.06, f, 0, 0, 0), mesh(new THREE.PlaneGeometry(0.7, 0.45), glass(x < 0 ? 0xFF3030 : 0x30C8FF, 0.75), 0, 0, 0.04));
    return o;
  });
});
add('face', 'aviator', '🛩️', 'Gafas de aviador', 30, (g) => {
  const f = metal(C.gold);
  frames(g, null, f, () => {
    const o = new THREE.Group();
    const r = torus(0.4, 0.05, f, 0, 0, 0); r.scale.y = 1.15;
    const l = mesh(new THREE.CircleGeometry(0.38, 32), M(0x4A2A0A, { roughness: 0.05, metalness: 0.5 }), 0, 0, 0.01); l.scale.y = 1.15;
    o.add(r, l); return o;
  });
});
add('face', 'ski', '🎿', 'Gafas de esquí', 28, (g) => {
  const lens = mesh(new THREE.CylinderGeometry(2.62, 2.62, 0.75, 32, 1, true, -0.55, 1.1), M(C.orange, { metalness: 0.6, roughness: 0.1, side: THREE.DoubleSide }), 0, 0, -0.47);
  g.add(lens, around(0, 0.1, C.black, 2.3, 2.6, -0.47));
  g.position.set(0, 4.3, 0);
});
add('face', 'eyepatch', '🏴‍☠️', 'Parche pirata', 12, (g) => {
  const p = mesh(new THREE.CircleGeometry(0.42, 32), M(C.black), 0.55, 0, 0.03); p.rotation.y = 0.27; g.add(p);
  const strap = new THREE.Group(); strap.add(around(0, 0.04, C.black, 2.28, 2.55, -2.58)); strap.rotation.z = 0.28;
  g.add(strap);
  g.position.set(0, 4.3, 2.12);
});
for (const [k, name, color] of [['black', 'negro', C.black], ['red', 'rojo', C.red], ['blue', 'azul', C.blue]]) {
  add('face', `mask-${k}`, '🦹', `Antifaz ${name}`, 18, (g) => {
    const s = new THREE.Shape();
    s.moveTo(-1.15, 0.05); s.quadraticCurveTo(-1.1, 0.42, -0.55, 0.42); s.quadraticCurveTo(0, 0.35, 0.55, 0.42);
    s.quadraticCurveTo(1.1, 0.42, 1.15, 0.05); s.quadraticCurveTo(1.0, -0.4, 0.55, -0.38); s.quadraticCurveTo(0.1, -0.35, 0, -0.15);
    s.quadraticCurveTo(-0.1, -0.35, -0.55, -0.38); s.quadraticCurveTo(-1.0, -0.4, -1.15, 0.05);
    for (const x of [-0.55, 0.55]) { const h = new THREE.Path(); h.absellipse(x, 0.02, 0.24, 0.17, 0, Math.PI * 2, true); s.holes.push(h); }
    const m = extrude(s, M(color, { roughness: 0.4 }), 0.06);
    g.add(m, around(0, 0.04, color, 2.28, 2.55, -2.6));
    g.position.set(0, 4.3, 2.14);
  });
}
add('face', 'visor', '🤖', 'Visor futurista', 45, (g) => {
  const v = mesh(new THREE.CylinderGeometry(2.66, 2.66, 0.45, 32, 1, true, -0.6, 1.2), glow(C.cyan, 0.9), 0, 0, -0.47);
  v.material.side = THREE.DoubleSide; v.material.transparent = true; v.material.opacity = 0.85;
  g.add(v, around(0, 0.06, 0x2A2F3A, 2.3, 2.6, -0.47));
  g.position.set(0, 4.3, 0);
}, 4);
add('face', 'nerdtape', '🩹', 'Gafas con celo', 10, (g) => {
  const f = M(C.black, { roughness: 0.3 });
  frames(g, null, f, () => { const o = new THREE.Group(); o.add(box(0.85, 0.6, 0.1, f, 0, 0, 0), mesh(new THREE.PlaneGeometry(0.68, 0.44), glass(), 0, 0, 0.06)); return o; });
  g.add(box(0.2, 0.25, 0.12, C.white, 0, 0.08, 0.1));
});

// ===== BOCA =====
const MOUTH = (g, y = 3.75, z = 2.2) => g.position.set(0, y, z);
for (const [k, name, color] of [['brown', 'castaño', 0x5A3A1E], ['black', 'negro', C.black], ['ginger', 'pelirrojo', 0xC0531B]]) {
  add('mouth', `mustache-${k}`, '🥸', `Bigote ${name}`, 12, (g) => {
    for (const d of [-1, 1]) { const s = sphere(0.3, color, d * 0.35, 0, 0); s.scale.set(1.5, 0.55, 0.6); s.rotation.z = d * 0.3; g.add(s); }
    MOUTH(g);
  });
}
add('mouth', 'curlystache', '🎩', 'Bigote rizado', 20, (g) => {
  const m = M(C.black);
  for (const d of [-1, 1]) {
    const s = sphere(0.22, m, d * 0.3, 0, 0); s.scale.set(1.6, 0.6, 0.6); g.add(s);
    const c = torus(0.16, 0.06, m, d * 0.75, 0.12, 0, Math.PI * 1.4); c.rotation.z = d > 0 ? -0.6 : Math.PI + 0.6; c.scale.x = d; g.add(c);
  }
  MOUTH(g);
});
for (const [k, name, color] of [['white', 'blanca', C.white], ['brown', 'castaña', 0x5A3A1E]]) {
  add('mouth', `beard-${k}`, '🧔', `Barba ${name}`, 28, (g) => {
    const b = sphere(0.8, color, 0, -0.5, -0.05); b.scale.set(1.3, 0.85, 0.5);
    for (const d of [-1, 1]) { const s = sphere(0.3, color, d * 0.35, 0.05, 0.1); s.scale.set(1.5, 0.55, 0.6); g.add(s); }
    g.add(b);
    MOUTH(g, 3.7, 2.15);
  });
}
add('mouth', 'clown', '🤡', 'Nariz de payaso', 8, (g) => { g.add(sphere(0.34, M(C.red, { roughness: 0.25 }), 0, 0, 0)); g.position.set(0, 4.06, 2.28); });
for (const [k, name, color] of [['rainbow', 'arcoíris', C.pink], ['blue', 'azul', C.cyan]]) {
  add('mouth', `lolly-${k}`, '🍭', `Piruleta ${name}`, 10, (g) => {
    const stick = cyl(0.04, 0.04, 1.0, C.white, 0, 0, 0); stick.rotation.x = Math.PI / 2 - 0.4; stick.position.set(0.4, -0.1, 0.4);
    const disc = cyl(0.45, 0.45, 0.12, color, 0.4, 0.15, 0.95); disc.rotation.x = Math.PI / 2;
    const ring = torus(0.28, 0.06, C.white, 0.4, 0.15, 1.02);
    g.add(stick, disc, ring); MOUTH(g);
  });
}
add('mouth', 'rose', '🌹', 'Rosa en la boca', 22, (g) => {
  const stem = cyl(0.04, 0.04, 1.4, 0x3E7A2A, 0, 0, 0); stem.rotation.z = Math.PI / 2 - 0.15;
  const r = sphere(0.25, C.red, 0.8, 0.15, 0.05); r.scale.set(1, 1.1, 1);
  g.add(stem, r, sphere(0.18, 0xB0202A, 0.85, 0.25, 0.12)); MOUTH(g, 3.72, 2.2);
});
for (const [k, name, color] of [['pink', 'rosa', 0xFF9EC4], ['blue', 'azul', 0x8EC9FF]]) {
  add('mouth', `paci-${k}`, '🍼', `Chupete ${name}`, 10, (g) => {
    const shield = cyl(0.42, 0.42, 0.08, color, 0, 0, 0.1); shield.rotation.x = Math.PI / 2; shield.scale.y = 0.7;
    const ring = torus(0.25, 0.05, color, 0, 0, 0.25);
    g.add(shield, ring); MOUTH(g, 3.75, 2.15);
  });
}
add('mouth', 'gum', '🫧', 'Chicle', 8, (g) => {
  const b = sphere(0.55, M(0xFF8FC8, { transparent: true, opacity: 0.85, roughness: 0.2 }), 0, 0, 0.55);
  tick(b, (t) => { b.scale.setScalar(0.75 + (Math.sin(t * 1.6) * 0.5 + 0.5) * 0.45); });
  g.add(b); MOUTH(g);
});
add('mouth', 'vampire', '🧛', 'Colmillos de vampiro', 15, (g) => {
  for (const d of [-1, 1]) { const f = cone(0.07, 0.28, C.white, d * 0.2, -0.1, 0); f.rotation.x = Math.PI; g.add(f); }
  MOUTH(g, 3.72, 2.18);
});
add('mouth', 'tongue', '😛', 'Lengua fuera', 6, (g) => {
  const t = sphere(0.25, 0xFF6F8A, 0, -0.15, 0.08); t.scale.set(1, 1.3, 0.4); t.rotation.x = 0.4; g.add(t); MOUTH(g, 3.75, 2.15);
});
add('mouth', 'whistle', '📯', 'Silbato', 12, (g) => {
  const w = cyl(0.12, 0.12, 0.6, metal(C.silver), 0, 0, 0.25); w.rotation.x = Math.PI / 2;
  g.add(w, sphere(0.2, metal(C.silver), 0, -0.05, 0.55)); MOUTH(g);
});
add('mouth', 'pipebubble', '🫧', 'Pompero', 14, (g) => {
  const stick = cyl(0.04, 0.04, 0.7, C.purple, 0.35, -0.1, 0.3); stick.rotation.z = -1.1;
  const ring = torus(0.22, 0.05, C.purple, 0.75, 0.15, 0.4);
  g.add(stick, ring);
  for (let i = 0; i < 3; i++) {
    const b = sphere(0.14 + i * 0.04, glass(0xCFF3FF, 0.4), 0, 0, 0);
    tick(b, (t) => { const p = ((t * 0.5 + i / 3) % 1); b.position.set(0.9 + p * 1.2, 0.3 + p * 1.6, 0.5 + Math.sin(p * 6 + i) * 0.2); b.scale.setScalar(1 - p * 0.3); });
    g.add(b);
  }
  MOUTH(g);
});

// ===== OREJA ===== (coordenadas de la oreja derecha: la base queda en 0,0,0)
const EAR = (g, x = -0.45, y = 0.55, z = 0.5) => g.position.set(x, y, z);
add('ear', 'rose-ear', '🌺', 'Flor rosa', 12, (g) => { flowerPiece(g, C.pink, C.yellow, 1.1, 7); EAR(g); g.rotation.x = -0.4; });
add('ear', 'sunflower', '🌻', 'Girasol', 14, (g) => { flowerPiece(g, C.yellow, 0x5A3A1E, 1.25, 10); EAR(g); g.rotation.x = -0.4; });
for (const [k, name, color] of [['blue', 'azul', C.blue], ['red', 'rojo', C.red], ['purple', 'morado', C.purple], ['yellow', 'amarillo', C.gold]]) {
  add('ear', `bow-${k}`, '🎀', `Lazo ${name}`, 12, (g) => { bowPiece(g, color); EAR(g); g.rotation.z = 0.4; });
}
for (const [k, name, m] of [['gold', 'de oro', () => metal(C.gold)], ['silver', 'de plata', () => metal(C.silver)]]) {
  add('ear', `hoop-${k}`, '💫', `Aro ${name}`, 20, (g) => { const r = torus(0.3, 0.075, m(), 0, 0, 0); r.rotation.y = 0.3; g.add(r, sphere(0.09, m(), 0, 0.3, 0)); EAR(g, -1.5, -0.3, 0.25); });
}
add('ear', 'pearl', '🦪', 'Pendiente de perla', 24, (g) => {
  g.add(sphere(0.09, metal(C.gold), 0, 0.18, 0), cyl(0.025, 0.025, 0.2, metal(C.gold), 0, 0.08, 0), sphere(0.21, M(0xFFF8EE, { roughness: 0.15, metalness: 0.2 }), 0, -0.1, 0)); EAR(g, -1.5, -0.2, 0.25);
});
for (const [k, name, color] of [['red', 'roja', C.red], ['blue', 'azul', C.teal]]) {
  add('ear', `feather-${k}`, '🪶', `Pluma ${name}`, 14, (g) => {
    const f = sphere(0.2, color, 0, 0.55, 0); f.scale.set(0.6, 3, 0.2);
    g.add(f, cyl(0.025, 0.025, 1.2, C.white, 0, 0.5, 0.03)); EAR(g, -0.6, 0.45, 0.3); g.rotation.z = 0.5;
  });
}
add('ear', 'leaf', '🍃', 'Hoja', 8, (g) => { const l = sphere(0.3, 0x4E9A3A, 0, 0, 0); l.scale.set(0.5, 1.2, 0.15); g.add(l); EAR(g); g.rotation.z = 0.6; });
add('ear', 'cherries', '🍒', 'Cerezas', 12, (g) => {
  g.add(sphere(0.17, C.red, -0.15, -0.25, 0), sphere(0.17, C.red, 0.15, -0.3, 0));
  for (const d of [-1, 1]) { const s = cyl(0.02, 0.02, 0.4, 0x3E7A2A, d * 0.08, -0.05, 0); s.rotation.z = d * 0.4; g.add(s); }
  EAR(g, -1.45, -0.05, 0.3);
});
add('ear', 'bell-ear', '🔔', 'Cascabel', 14, (g) => {
  const b = sphere(0.26, metal(C.gold), 0, -0.1, 0); g.add(b, torus(0.09, 0.035, metal(C.gold), 0, 0.2, 0), box(0.3, 0.04, 0.04, C.black, 0, -0.15, 0.25));
  tick(g, (t) => { g.rotation.z = Math.sin(t * 6) * 0.2; });
  EAR(g, -1.5, -0.3, 0.25);
});
add('ear', 'heartpin', '💖', 'Chapa de corazón', 10, (g) => { const h = extrude(heartShape(), M(C.pink, { roughness: 0.3 }), 0.08); h.scale.setScalar(0.6); g.add(h); EAR(g); g.rotation.x = -0.4; });
for (const [k, name, color] of [['blue', 'azul', C.cyan], ['orange', 'naranja', C.orange]]) {
  add('ear', `butterfly-${k}`, '🦋', `Mariposa ${name}`, 18, (g) => {
    const wings = [];
    for (const d of [-1, 1]) {
      const w = new THREE.Group();
      const a = sphere(0.25, color, d * 0.22, 0.1, 0); a.scale.set(1, 1.1, 0.12);
      const b = sphere(0.16, color, d * 0.18, -0.2, 0); b.scale.set(1, 1, 0.12);
      w.add(a, b); wings.push([w, d]); g.add(w);
    }
    g.add(box(0.06, 0.45, 0.06, C.black, 0, 0, 0));
    tick(g, (t) => { for (const [w, d] of wings) w.rotation.y = d * Math.sin(t * 8) * 0.6; });
    EAR(g); g.rotation.z = 0.3;
  });
}
add('ear', 'clover', '🍀', 'Trébol', 16, (g) => {
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
    const h = extrude(heartShape(), M(0x3FA34D), 0.05); h.scale.setScalar(0.35); h.position.set(Math.cos(a) * 0.17, Math.sin(a) * 0.17, 0); h.rotation.z = a + Math.PI / 2; g.add(h);
  }
  EAR(g); g.rotation.x = -0.4;
});

// ===== CUELLO =====
const NECK_Y = 3.42;
for (const [k, name, color] of [['red', 'roja', C.red], ['black', 'negra', C.black], ['blue', 'azul', C.blue], ['pink', 'rosa', C.pink]]) {
  add('neck', `bowtie-${k}`, '🎀', `Pajarita ${name}`, 14, (g) => { bowPiece(g, color, 1.25); g.position.set(0, NECK_Y, 2.28); });
}
for (const [k, name, color] of [['red', 'roja', C.red], ['blue', 'azul', C.navy], ['green', 'verde', 0x2E8B57]]) {
  add('neck', `tie-${k}`, '👔', `Corbata ${name}`, 16, (g) => {
    const knot = box(0.32, 0.26, 0.14, color, 0, 0, 0);
    const s = new THREE.Shape(); s.moveTo(-0.13, 0); s.lineTo(0.13, 0); s.lineTo(0.3, -0.95); s.lineTo(0, -1.2); s.lineTo(-0.3, -0.95); s.lineTo(-0.13, 0);
    const blade = mesh(new THREE.ExtrudeGeometry(s, { depth: 0.06, bevelEnabled: false }), M(color), 0, -0.1, 0.02);
    blade.rotation.x = -0.22;
    g.add(knot, blade); g.position.set(0, NECK_Y, 2.28);
  });
}
for (const [k, name, color, stripe] of [['red', 'roja', C.red, C.white], ['blue', 'azul', C.blue, C.cyan], ['green', 'verde', C.green, C.yellow], ['purple', 'morada', C.purple, C.pink]]) {
  add('neck', `scarf-${k}`, '🧣', `Bufanda ${name}`, 22, (g) => {
    g.add(around(NECK_Y, 0.24, color));
    const end = box(0.55, 1.3, 0.16, color, 0.75, NECK_Y - 0.75, 2.3); end.rotation.z = 0.12;
    g.add(end, box(0.56, 0.12, 0.17, stripe, 0.7, NECK_Y - 1.0, 2.31), box(0.56, 0.12, 0.17, stripe, 0.68, NECK_Y - 1.25, 2.31));
  }, k === 'purple' ? 2 : undefined);
}
add('neck', 'pearls', '📿', 'Collar de perlas', 40, (g) => {
  const m = M(0xFFF8EE, { roughness: 0.15, metalness: 0.2 });
  for (const p of aroundPoints(NECK_Y - 0.05, 34)) g.add(sphere(0.13, m, p.x, p.y, p.z));
}, 3);
add('neck', 'goldchain', '⛓️', 'Cadena de oro', 60, (g) => {
  g.add(around(NECK_Y - 0.05, 0.08, metal(C.gold)));
  const pend = cyl(0.3, 0.3, 0.08, metal(C.gold), 0, NECK_Y - 0.45, 2.42); pend.rotation.x = Math.PI / 2;
  g.add(pend, sphere(0.1, metal(C.gold), 0, NECK_Y - 0.15, 2.32));
}, 5);
add('neck', 'medal', '🥇', 'Medalla de oro', 35, (g) => {
  for (const d of [-1, 1]) { const r = box(0.2, 0.9, 0.04, C.blue, d * 0.18, NECK_Y - 0.35, 2.3); r.rotation.z = d * 0.25; g.add(r); }
  const m = cyl(0.35, 0.35, 0.08, metal(C.gold), 0, NECK_Y - 0.85, 2.48); m.rotation.x = Math.PI / 2;
  const st = extrude(starShape(0.2, 0.09), metal(0xFFE36E), 0.03); st.position.set(0, NECK_Y - 0.85, 2.54);
  g.add(m, st);
});
add('neck', 'bellcollar', '🔔', 'Collar con cascabel', 18, (g) => {
  g.add(around(NECK_Y, 0.13, C.red));
  const bell = new THREE.Group(); bell.add(sphere(0.25, metal(C.gold), 0, 0, 0), box(0.3, 0.04, 0.04, C.black, 0, -0.05, 0.24));
  bell.position.set(0, NECK_Y - 0.3, 2.38);
  tick(bell, (t) => { bell.rotation.z = Math.sin(t * 5) * 0.25; });
  g.add(bell);
});
add('neck', 'lei', '🌸', 'Collar hawaiano', 26, (g) => {
  const cols = [C.pink, C.yellow, C.white, C.orange, 0xB794F6];
  aroundPoints(NECK_Y - 0.05, 18).forEach((p, i) => {
    const f = new THREE.Group(); flowerPiece(f, cols[i % 5], C.yellow, 0.8);
    f.position.copy(p); f.lookAt(p.x * 2, p.y, (p.z + 0.57) * 2 - 0.57); g.add(f);
  });
});
for (const [k, name, color] of [['red', 'roja', C.red], ['blue', 'azul', C.blue]]) {
  add('neck', `bandana-${k}`, '🤠', `Pañuelo ${name}`, 14, (g) => {
    g.add(around(NECK_Y, 0.11, color));
    const s = new THREE.Shape(); s.moveTo(-0.85, 0); s.lineTo(0.85, 0); s.lineTo(0, -0.9); s.lineTo(-0.85, 0);
    const tri = mesh(new THREE.ExtrudeGeometry(s, { depth: 0.05, bevelEnabled: false }), M(color), 0, NECK_Y + 0.05, 2.3);
    tri.rotation.x = -0.25; g.add(tri);
    for (const [x, y] of [[-0.3, -0.2], [0.25, -0.3], [0, -0.55]]) g.add(sphere(0.06, C.white, x, NECK_Y + y + 0.05, 2.36));
  });
}
add('neck', 'ruff', '🤡', 'Gorguera', 22, (g) => {
  for (const p of aroundPoints(NECK_Y, 26, 2.45, 2.83)) { const s = sphere(0.3, C.white, p.x, p.y, p.z); s.scale.set(1, 0.6, 1); g.add(s); }
});
add('neck', 'bib', '🍽️', 'Babero', 10, (g) => {
  g.add(around(NECK_Y, 0.06, C.white));
  const b = cyl(0.75, 0.75, 0.05, C.white, 0, NECK_Y - 0.55, 2.42); b.rotation.x = Math.PI / 2 - 0.25;
  const h = extrude(heartShape(), M(C.red), 0.03); h.scale.setScalar(0.45); h.position.set(0, NECK_Y - 0.55, 2.5); h.rotation.x = -0.25;
  g.add(b, h);
});
add('neck', 'headset', '🎧', 'Cascos al cuello', 30, (g) => {
  g.add(around(NECK_Y + 0.05, 0.08, C.black));
  for (const d of [-1, 1]) { const c = cyl(0.42, 0.42, 0.3, C.black, d * 1.5, NECK_Y, 1.45); c.rotation.z = Math.PI / 2; c.rotation.y = d * 0.6; g.add(c, sphere(0.2, C.red, d * 1.68, NECK_Y, 1.55)); }
});

// ===== ESPALDA =====
add('back', 'angel', '👼', 'Alas de ángel', 60, (g) => {
  wingPair(g, () => {
    const w = new THREE.Group();
    for (let i = 0; i < 4; i++) { const f = sphere(0.55 - i * 0.05, C.white, 0.7 + i * 0.45, 0.35 - i * 0.28, 0); f.scale.set(1.3, 0.55, 0.18); f.rotation.z = -0.4 - i * 0.15; w.add(f); }
    return w;
  });
}, 4);
for (const [k, name, color] of [['black', 'negras', 0x2A2A33], ['purple', 'moradas', C.purple]]) {
  add('back', `bat-${k}`, '🦇', `Alas de murciélago ${name}`, 45, (g) => {
    wingPair(g, () => {
      const s = new THREE.Shape(); s.moveTo(0, 0); s.lineTo(2.2, 0.7); s.quadraticCurveTo(2.0, 0.1, 2.2, -0.3);
      s.quadraticCurveTo(1.7, -0.2, 1.5, -0.6); s.quadraticCurveTo(1.1, -0.3, 0.8, -0.7); s.quadraticCurveTo(0.6, -0.3, 0, -0.3);
      const m = mesh(new THREE.ExtrudeGeometry(s, { depth: 0.05, bevelEnabled: false }), M(color, { side: THREE.DoubleSide }), 0, 0, 0);
      return m;
    });
  }, 3);
}
for (const [k, name, a, b] of [['blue', 'azules', C.cyan, C.blue], ['orange', 'naranjas', C.orange, C.yellow], ['pink', 'rosas', C.pink, 0xB794F6]]) {
  add('back', `bfly-${k}`, '🦋', `Alas de mariposa ${name}`, 40, (g) => {
    wingPair(g, () => {
      const w = new THREE.Group();
      const up = sphere(0.9, a, 0.85, 0.45, 0); up.scale.set(1, 1.1, 0.08);
      const lo = sphere(0.6, b, 0.6, -0.6, 0); lo.scale.set(1, 1.1, 0.08);
      w.add(up, lo, sphere(0.25, C.white, 1.05, 0.65, 0.06)); return w;
    }, 3.2);
  });
}
add('back', 'fairy', '🧚', 'Alas de hada', 50, (g) => {
  wingPair(g, () => {
    const w = new THREE.Group(); const m = glass(0xBFF4FF, 0.45);
    const up = sphere(0.85, m, 0.8, 0.5, 0); up.scale.set(0.8, 1.3, 0.05); up.rotation.z = -0.5;
    const lo = sphere(0.55, m, 0.55, -0.45, 0); lo.scale.set(0.8, 1.2, 0.05); lo.rotation.z = 0.5;
    w.add(up, lo); return w;
  }, 3.3);
}, 4);
add('back', 'dragon', '🐉', 'Alas de dragón', 80, (g) => {
  wingPair(g, () => {
    const w = new THREE.Group();
    const s = new THREE.Shape(); s.moveTo(0, 0); s.lineTo(1.2, 1.3); s.lineTo(2.6, 1.0); s.quadraticCurveTo(2.2, 0.4, 2.4, -0.2);
    s.quadraticCurveTo(1.8, 0.1, 1.6, -0.5); s.quadraticCurveTo(1.0, -0.1, 0, -0.4);
    w.add(mesh(new THREE.ExtrudeGeometry(s, { depth: 0.05, bevelEnabled: false }), M(0x2E8B57, { side: THREE.DoubleSide }), 0, 0, 0));
    const bone = cyl(0.06, 0.04, 1.8, 0x1E5E3A, 0.6, 0.65, 0.04); bone.rotation.z = -0.83; w.add(bone);
    return w;
  });
}, 6);
for (const [k, name, color] of [['red', 'roja', C.red], ['blue', 'azul', C.blue], ['green', 'verde', C.green]]) {
  add('back', `backpack-${k}`, '🎒', `Mochila ${name}`, 25, (g) => {
    const b = box(2.0, 2.0, 0.9, color, 0, 0, 0);
    g.add(b, box(1.4, 0.8, 0.3, color, 0, -0.45, -0.55), box(1.45, 0.08, 0.32, C.black, 0, -0.1, -0.56));
    for (const d of [-1, 1]) g.add(box(0.2, 1.8, 0.1, C.black, d * 0.7, 0.1, 0.48));
    g.position.set(0, 3.1, -3.55); g.rotation.x = -0.12;
  });
}
for (const [k, name, color] of [['red', 'roja', C.red], ['black', 'negra', 0x23232B], ['purple', 'morada', C.purple]]) {
  add('back', `cape-${k}`, '🦸', `Capa ${name}`, 35, (g) => {
    // cuelga de la nuca (por detrás de las orejas) hasta el suelo y ondea un poco
    const c = mesh(new THREE.CylinderGeometry(2.8, 3.5, 4.3, 32, 8, true, Math.PI - 0.9, 1.8), M(color, { side: THREE.DoubleSide, roughness: 0.7 }), 0, 2.45, -0.45);
    const pos = c.geometry.attributes.position; const base = Float32Array.from(pos.array);
    tick(c, (t) => {
      for (let i = 0; i < pos.count; i++) {
        const y = base[i * 3 + 1], x = base[i * 3];
        const k2 = (2.15 - y) / 4.3;
        pos.array[i * 3 + 2] = base[i * 3 + 2] - Math.sin(t * 2.2 + x * 1.3) * 0.22 * k2;
      }
      pos.needsUpdate = true;
    });
    g.add(c);
    for (const d of [-1, 1]) g.add(sphere(0.16, metal(C.gold), d * 2.19, 4.55, -2.19));
  }, k === 'purple' ? 3 : undefined);
}
add('back', 'jetpack', '🚀', 'Mochila cohete', 90, (g) => {
  const m = metal(C.silver);
  for (const d of [-1, 1]) {
    g.add(cyl(0.42, 0.42, 1.8, m, d * 0.5, 0, 0), cone(0.42, 0.5, C.red, d * 0.5, 1.15, 0));
    const fl = cone(0.3, 0.9, glow(C.orange, 1.2), d * 0.5, -1.35, 0); fl.rotation.x = Math.PI;
    tick(fl, (t) => { fl.scale.y = 0.75 + Math.abs(Math.sin(t * 25 + d)) * 0.5; });
    g.add(fl);
  }
  g.position.set(0, 3.2, -3.6);
}, 7);
add('back', 'shell', '🐢', 'Caparazón de tortuga', 40, (g) => {
  const s = halfSphere(2.0, 0x4E8A3A, 0, 0, 0); s.scale.set(1.05, 1.15, 0.45); s.rotation.x = -Math.PI / 2;
  g.add(s);
  for (const [x, y] of [[0, 0], [0.9, 0.6], [-0.9, 0.6], [0.9, -0.6], [-0.9, -0.6], [0, 1.2], [0, -1.2]]) {
    const h = cyl(0.42, 0.42, 0.1, 0x7BB35A, x, y, -0.82); h.rotation.x = Math.PI / 2; h.geometry = new THREE.CylinderGeometry(0.42, 0.42, 0.1, 6); g.add(h);
  }
  g.position.set(0, 2.7, -2.9);
});
for (const [k, name, color] of [['red', 'rojo', C.red], ['blue', 'azul', C.blue], ['yellow', 'amarillo', C.yellow], ['heart', 'de corazón', C.pink]]) {
  add('back', `balloon-${k}`, '🎈', `Globo ${name}`, 12, (g) => {
    const top = new THREE.Vector3(1.7, 7.3, -3.2);
    const ball = k === 'heart'
      ? (() => { const h = extrude(heartShape(), M(color, { roughness: 0.25 }), 0.5); h.scale.setScalar(1.7); return h; })()
      : (() => { const s = sphere(0.8, M(color, { roughness: 0.25 }), 0, 0, 0); s.scale.y = 1.15; return s; })();
    const holder = new THREE.Group(); holder.add(ball); holder.position.copy(top);
    const from = new THREE.Vector3(0.4, 3.6, -3.3);
    const str = cyl(0.015, 0.015, 1, C.white, 0, 0, 0);
    g.add(holder, str);
    tick(g, (t) => {
      holder.position.set(top.x + Math.sin(t * 0.9) * 0.25, top.y + Math.sin(t * 1.3) * 0.15, top.z);
      const mid = from.clone().add(holder.position).multiplyScalar(0.5);
      const dir = holder.position.clone().sub(from);
      str.position.copy(mid); str.scale.y = dir.length() - 0.8;
      str.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());
    });
  });
}

// ===== COLOR DE PIEL =====
// body = cuerpo, ear = orejas y cola. extra = otros ajustes del material (brillo metálico, etc.).
const SKINS = [
  ['pink', '🩷', 'Rosa chicle', 0xFF9EC9, 0xE0558F, 40],
  ['mint', '🌿', 'Menta', 0x9BE8C4, 0x2FA77A, 40],
  ['sky', '🩵', 'Celeste', 0x9FD3FF, 0x3B82D9, 40],
  ['lilac', '💜', 'Lila', 0xC7A8FF, 0x7B4FD6, 40],
  ['snow', '🤍', 'Blanco nieve', 0xF6F6F2, 0xB8C2CC, 50],
  ['red', '❤️', 'Rojo fuego', 0xF0564A, 0xA32020, 50],
  ['orange', '🧡', 'Mandarina', 0xFFA33A, 0xC85A12, 40],
  ['lime', '💚', 'Lima', 0xB7E34A, 0x5E9A1E, 40],
  ['choco', '🍫', 'Chocolate', 0x8B5A3C, 0x4E2E1C, 50],
  ['night', '🖤', 'Noche', 0x3A3D55, 0x7B4FD6, 70, {}, 3],
  ['gold', '🏆', 'Oro', 0xF2C230, 0xB8860B, 150, { metalness: 0.75, roughness: 0.25 }, 8],
  ['silver', '🥈', 'Plata', 0xD9DEE6, 0x8A93A3, 120, { metalness: 0.75, roughness: 0.25 }, 6],
];
for (const [k, emo, name, body, ear, price, extra = {}, level] of SKINS) {
  ITEMS.push({ id: `skin-${k}`, emo, name, slot: 'skin', price, skin: { body, ear, ...extra }, ...(level ? { level } : {}) });
}

COSMETICS.push(...ITEMS);
const SKIN_BY_ID = Object.fromEntries(ITEMS.filter(i => i.slot === 'skin').map(i => [i.id, i.skin]));

// ---------------- integración con World ----------------
const baseCosmetic = World.prototype._cosmetic;
World.prototype._cosmetic = function (id) {
  const build = BUILD[id];
  if (!build) return baseCosmetic.call(this, id);
  const g = new THREE.Group();
  build(g);
  g.traverse(o => { if (o.isMesh) { o.castShadow = true; } });
  return g;
};

World.prototype._wearGroup = function (slot) {
  this._extraWear ||= {};
  if (!this._extraWear[slot]) { const g = new THREE.Group(); this.squashG.add(g); this._extraWear[slot] = g; }
  return this._extraWear[slot];
};

World.prototype._applySkin = function (id) {
  if (!this._skin) {
    const find = (hex) => this.petMeshes.map(m => m.material).find(m => m.color && m.color.getHex() === hex);
    const body = find(0xF6C928), ear = find(0xE9761C);
    if (!body || !ear) return;
    this._skin = { body, ear, orig: { roughness: body.roughness, metalness: body.metalness } };
  }
  const { body, ear, orig } = this._skin;
  const s = SKIN_BY_ID[id];
  body.color.setHex(s ? s.body : 0xF6C928);
  ear.color.setHex(s ? s.ear : 0xE9761C);
  for (const m of [body, ear]) {
    m.metalness = s?.metalness ?? orig.metalness;
    m.roughness = s?.roughness ?? orig.roughness;
  }
};

const baseSetCosmetics = World.prototype.setCosmetics;
World.prototype.setCosmetics = function (eq = {}) {
  baseSetCosmetics.call(this, eq);
  if (!this.pet) return;
  for (const slot of EXTRA_SLOTS) {
    const g = this._wearGroup(slot);
    while (g.children.length) g.remove(g.children[0]);
    if (eq[slot]) { const m = this._cosmetic(eq[slot]); if (m) g.add(m); }
  }
  this._applySkin(eq.skin);
  // prendas animadas (hélices, alas, globos…)
  this._ticks = [];
  const groups = [this.wearHead, this.wearFace, this.wearEar, ...EXTRA_SLOTS.map(s => this._wearGroup(s))];
  for (const g of groups) g.traverse(o => { if (o.userData.tick) this._ticks.push(o.userData.tick); });
};

// En la pestaña Espalda de la tienda, Wapuu se da la vuelta para enseñar alas, mochilas y capas.
World.prototype.showBack = function (on) { this._backTarget = on ? Math.PI : 0; };

const baseUpdate = World.prototype.update;
World.prototype.update = function (...args) {
  if (this._ticks?.length) {
    const t = performance.now() / 1000;
    for (const fn of this._ticks) fn(t);
  }
  if (this.squashG) {
    const target = this._backTarget || 0;
    const r = this.squashG.rotation;
    if (Math.abs(r.y - target) > 0.001) r.y += (target - r.y) * 0.12;
    else r.y = target;
  }
  return baseUpdate.apply(this, args);
};

export const wardrobeCount = ITEMS.length;
