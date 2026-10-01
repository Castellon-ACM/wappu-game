// Cosméticos exclusivos del pase de batalla: datos para la tienda y modelos 3D.
// Amplía World._cosmetic sin tocar world.js: si el id es del pase, lo construye aquí.
import * as THREE from 'three';
import { World } from './world.js';
import { COSMETICS } from './state.js';

// Exclusivos del pase (pass = nivel del pase en el que se consiguen). Salen en la tienda, pero no se venden.
COSMETICS.push(
  { id: 'star',        emo: '⭐', name: 'Estrella',      slot: 'ear',  pass: 5 },
  { id: 'monocle',     emo: '🧐', name: 'Monóculo',      slot: 'face', pass: 10 },
  { id: 'halo',        emo: '😇', name: 'Aureola',       slot: 'head', pass: 20 },
  { id: 'wizard',      emo: '🧙', name: 'Gorro de mago', slot: 'head', pass: 30 },
  { id: 'goldglasses', emo: '🕶️', name: 'Gafas de oro',  slot: 'face', pass: 50 },
);
export const cosmetic = (id) => COSMETICS.find(c => c.id === id);

const mat = (color, opts = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.8, metalness: 0, ...opts });
const gold = () => mat(0xF2B705, { roughness: 0.25, metalness: 0.7 });
function sphere(r, m, x = 0, y = 0, z = 0) {
  const s = new THREE.Mesh(new THREE.SphereGeometry(r, 24, 16), m);
  s.position.set(x, y, z);
  return s;
}
function box(w, h, d, m, x = 0, y = 0, z = 0) {
  const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
  b.position.set(x, y, z);
  return b;
}
const glassMat = () => new THREE.MeshStandardMaterial({ color: 0xDDEBFF, transparent: true, opacity: 0.3, roughness: 0.05 });

const BUILDERS = {
  star(g) {
    const m = gold();
    for (let i = 0; i < 5; i++) {
      const a = i / 5 * Math.PI * 2 + Math.PI / 2;
      const tip = new THREE.Mesh(new THREE.ConeGeometry(0.13, 0.32, 12), m);
      tip.position.set(Math.cos(a) * 0.22, Math.sin(a) * 0.22, 0);
      tip.rotation.z = a - Math.PI / 2;
      g.add(tip);
    }
    const core = sphere(0.17, m); core.scale.z = 0.6; g.add(core);
    g.position.set(-0.45, 0.55, 0.5); g.rotation.x = -0.4;
  },
  monocle(g) {
    const m = gold();
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.07, 10, 32), m);
    ring.position.set(0.52, 0, 0); ring.rotation.y = 0.26;
    const glass = new THREE.Mesh(new THREE.CircleGeometry(0.4, 32), glassMat());
    glass.position.set(0.52, 0, 0.01); glass.rotation.y = 0.26;
    g.add(ring, glass);
    for (let i = 1; i <= 6; i++) g.add(sphere(0.04, m, 0.87 + i * 0.03, -0.2 - i * 0.16, -0.05 * i));   // cadenita
    g.position.set(0, 4.3, 2.12);
  },
  halo(g) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(1.0, 0.11, 12, 48),
      mat(0xFFE36E, { roughness: 0.2, metalness: 0.4, emissive: 0xFFC800, emissiveIntensity: 0.6 }));
    ring.rotation.x = Math.PI / 2;
    g.add(ring);
    g.position.set(0, 6.25, -0.3); g.rotation.x = 0.22;
  },
  wizard(g) {
    const purple = mat(0x5B3CC4, { roughness: 0.6 });
    const brim = new THREE.Mesh(new THREE.CylinderGeometry(1.55, 1.55, 0.1, 32), purple);
    const cone = new THREE.Mesh(new THREE.ConeGeometry(1.0, 2.8, 32), purple);
    cone.position.y = 1.4; cone.rotation.z = 0.12;
    g.add(brim, cone);
    const dot = mat(0xF6C928, { emissive: 0xF6C928, emissiveIntensity: 0.5 });
    for (const [x, y, z] of [[0.45, 0.6, 0.62], [-0.35, 1.2, 0.5], [0.2, 1.9, 0.3], [-0.55, 0.45, 0.55]]) g.add(sphere(0.1, dot, x, y, z));
    g.position.set(0.1, 5.35, -0.4); g.rotation.z = -0.1;
  },
  goldglasses(g) {
    const frame = gold();
    for (const x of [-0.52, 0.52]) {
      const rim = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.07, 10, 32), frame);
      rim.position.set(x, 0, 0); rim.rotation.y = x * 0.5;
      const lens = new THREE.Mesh(new THREE.CircleGeometry(0.4, 32), mat(0x2A1A00, { roughness: 0.05, metalness: 0.6 }));
      lens.position.set(x, 0, 0.01); lens.rotation.y = x * 0.5;
      const arm = box(0.07, 0.07, 1.2, frame, x * 1.85, 0.05, -0.55);
      arm.rotation.y = x > 0 ? 0.35 : -0.35;
      g.add(rim, lens, arm);
    }
    g.add(box(0.36, 0.08, 0.08, frame, 0, 0.1, 0.08));
    g.position.set(0, 4.3, 2.12);
  },
};

const base = World.prototype._cosmetic;
World.prototype._cosmetic = function (id) {
  const build = BUILDERS[id];
  if (!build) return base.call(this, id);
  const g = new THREE.Group();
  build(g);
  g.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  return g;
};
