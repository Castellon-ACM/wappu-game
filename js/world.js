// Escena 3D: habitaciones, Wapuu y sus animaciones.
import * as THREE from 'three';
import { OBJLoader } from 'three/addons/loaders/OBJLoader.js';

// Primero se busca el modelo copiado en el propio sitio (lo hace el workflow de GitHub Pages)
// y, si no está, se carga directamente del repositorio original de 3D Wapuu.
const MODEL_BASES = [
  './assets/wapuu/',
  'https://raw.githubusercontent.com/wckansai2016/3d-wapuu/master/models/for_the_3dcg/low_quality/obj/',
  'https://cdn.jsdelivr.net/gh/wckansai2016/3d-wapuu@master/models/for_the_3dcg/low_quality/obj/',
];

const COLORS = {
  body: 0xF6C928,
  ear: 0xE9761C,
  eye: 0x141414,
};

// ---------- suciedad ----------
// Manchas generadas con ruido 3D sobre la posición del modelo, así no dependen de sus UV.
const dirtUniform = { value: 0 };
function dirtify(material) {
  material.onBeforeCompile = (sh) => {
    sh.uniforms.uDirt = dirtUniform;
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vDirtPos;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvDirtPos = position;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>
uniform float uDirt;
varying vec3 vDirtPos;
float dHash(vec3 p) { p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
float dNoise(vec3 x) {
  vec3 i = floor(x); vec3 f = fract(x); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(dHash(i), dHash(i + vec3(1,0,0)), f.x), mix(dHash(i + vec3(0,1,0)), dHash(i + vec3(1,1,0)), f.x), f.y),
             mix(mix(dHash(i + vec3(0,0,1)), dHash(i + vec3(1,0,1)), f.x), mix(dHash(i + vec3(0,1,1)), dHash(i + vec3(1,1,1)), f.x), f.y), f.z);
}`)
      .replace('#include <color_fragment>', `#include <color_fragment>
if (uDirt > 0.001) {
  vec3 q = vDirtPos * 1.7;
  float n = dNoise(q) * 0.6 + dNoise(q * 2.3 + 7.0) * 0.3 + dNoise(q * 5.1 + 3.0) * 0.1;
  float th = 0.74 - uDirt * 0.3;
  float spot = smoothstep(th, th + 0.06, n);
  float speck = step(0.94 - uDirt * 0.06, dNoise(q * 9.0 + 11.0));
  diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * vec3(0.8, 0.72, 0.6), uDirt * 0.65);
  diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.30, 0.20, 0.10), max(spot, speck * 0.85) * min(1.0, uDirt * 1.5));
}`);
  };
}

const ease = {
  inOut: t => t < .5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2,
  out: t => 1 - Math.pow(1 - t, 3),
  lin: t => t,
};

// ---------- helpers de geometría ----------
function mat(color, opts = {}) {
  return new THREE.MeshStandardMaterial({ color, roughness: 0.8, metalness: 0, ...opts });
}
function box(w, h, d, color, x = 0, y = 0, z = 0, opts) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), color instanceof THREE.Material ? color : mat(color, opts));
  m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true;
  return m;
}
function cyl(rt, rb, h, color, x = 0, y = 0, z = 0, seg = 32, opts) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), color instanceof THREE.Material ? color : mat(color, opts));
  m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true;
  return m;
}
function sphere(r, color, x = 0, y = 0, z = 0, opts) {
  const m = new THREE.Mesh(new THREE.SphereGeometry(r, 24, 16), color instanceof THREE.Material ? color : mat(color, opts));
  m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true;
  return m;
}
function canvasTex(w, h, draw, repeat = null) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  if (repeat) t.repeat.set(repeat[0], repeat[1]);
  return t;
}
const tiles = (bg, line, n = 8) => canvasTex(256, 256, (g, w, h) => {
  g.fillStyle = bg; g.fillRect(0, 0, w, h);
  g.strokeStyle = line; g.lineWidth = 6;
  const s = w / n * 2;
  for (let i = 0; i <= w; i += s) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i, h); g.stroke(); g.beginPath(); g.moveTo(0, i); g.lineTo(w, i); g.stroke(); }
});
const planks = (a, b) => canvasTex(256, 256, (g, w, h) => {
  const n = 4;
  for (let i = 0; i < n; i++) {
    g.fillStyle = i % 2 ? a : b; g.fillRect(0, i * h / n, w, h / n);
    g.fillStyle = 'rgba(0,0,0,.18)'; g.fillRect(0, i * h / n, w, 3);
    g.fillRect((i * 97) % w, i * h / n, 3, h / n);
  }
});
const checker = (a, b) => canvasTex(128, 128, (g, w, h) => {
  g.fillStyle = a; g.fillRect(0, 0, w, h);
  g.fillStyle = b; g.fillRect(0, 0, w / 2, h / 2); g.fillRect(w / 2, h / 2, w / 2, h / 2);
});

// ---------- fragmentos de código para el monitor ----------
const SNIPPETS = [
  { file: 'wapuu-helper.php', code:
`<?php
/**
 * Plugin Name: Wapuu Helper
 */
add_action( 'init', function () {
    register_post_type( 'galleta', [
        'public' => true,
        'label'  => 'Galletas',
    ] );
} );` },
  { file: 'functions.php', code:
`add_filter( 'the_title', function ( $title ) {
    if ( is_admin() ) {
        return $title;
    }
    return '🐾 ' . $title;
} );` },
  { file: 'rest-api.php', code:
`add_action( 'rest_api_init', function () {
    register_rest_route( 'wapuu/v1', '/snack', [
        'methods'  => 'GET',
        'callback' => fn() => [ 'snack' => 'paella' ],
        'permission_callback' => '__return_true',
    ] );
} );` },
  { file: 'block.json', code:
`{
    "apiVersion": 3,
    "name": "wapuu/saludo",
    "title": "Saludo de Wapuu",
    "category": "widgets",
    "icon": "pets",
    "editorScript": "file:./index.js"
}` },
  { file: 'cron.php', code:
`if ( ! wp_next_scheduled( 'wapuu_siesta' ) ) {
    wp_schedule_event( time(), 'hourly', 'wapuu_siesta' );
}
add_action( 'wapuu_siesta', function () {
    update_option( 'wapuu_energia', 100 );
} );` },
  { file: 'query.php', code:
`$galletas = new WP_Query( [
    'post_type'      => 'galleta',
    'posts_per_page' => 5,
    'orderby'        => 'rand',
] );
while ( $galletas->have_posts() ) {
    $galletas->the_post();
    the_title( '<h2>', '</h2>' );
}
wp_reset_postdata();` },
];

function highlight(line) {
  // Tokenizador mínimo para colorear PHP/JSON en el monitor
  const out = [];
  const re = /(\/\/.*$|\/\*\*?.*|^\s*\*.*$|'[^']*'|"[^"]*"|\$[a-zA-Z_]+|\b(?:function|return|if|while|new|true|false|fn)\b|[a-zA-Z_]+(?=\s*\()|<\?php)/g;
  let last = 0, m;
  while ((m = re.exec(line))) {
    if (m.index > last) out.push([line.slice(last, m.index), '#E6EDF3']);
    const t = m[0];
    let c = '#E6EDF3';
    if (t.startsWith('//') || t.startsWith('/*') || /^\s*\*/.test(t)) c = '#8B949E';
    else if (t[0] === "'" || t[0] === '"') c = '#A5D6FF';
    else if (t[0] === '$') c = '#FFA657';
    else if (/^(function|return|if|while|new|true|false|fn|<\?php)$/.test(t)) c = '#FF7B72';
    else c = '#D2A8FF';
    out.push([t, c]);
    last = m.index + t.length;
  }
  if (last < line.length) out.push([line.slice(last), '#E6EDF3']);
  return out;
}

export class World {
  constructor(canvas) {
    this.canvas = canvas;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(38, 1, 0.1, 200);
    this.camTarget = new THREE.Vector3(0, 3.4, 0);
    this.camPos = new THREE.Vector3(0, 8, 24);

    this.clock = new THREE.Clock();
    this.tweens = [];
    this.time = 0;
    this.nextBlink = 2;
    this.mode = 'idle';
    this.mood = 'ok';
    this.name = 'Wapuu';
    this.fx = { jump: 0, squash: 0, spin: 0, lean: 0, lookX: 0, eyes: 1, wag: 1, earDroop: 0 };
    this.onCommit = () => {};
    this.growth = { scale: 1, eyes: 1 };
    this.dirtTarget = 0;
    this.raycaster = new THREE.Raycaster();
    this.pointer = new THREE.Vector2();

    this._lights();
    this._rooms();
    this._showerDrops();
    this.resize();
    window.addEventListener('resize', () => this.resize());
  }

  // ---------- setup ----------
  _lights() {
    this.hemi = new THREE.HemisphereLight(0xffffff, 0x8a7a70, 1.3);
    this.scene.add(this.hemi);
    this.sun = new THREE.DirectionalLight(0xfff3e0, 1.6);
    this.sun.position.set(8, 18, 12);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(1024, 1024);
    Object.assign(this.sun.shadow.camera, { left: -16, right: 16, top: 16, bottom: -8, near: 1, far: 50 });
    this.sun.shadow.bias = -0.0008;
    this.scene.add(this.sun);
    this.fill = new THREE.DirectionalLight(0xbfd0ff, 0.5);
    this.fill.position.set(-10, 6, 8);
    this.scene.add(this.fill);
  }

  _shell(room, { wall, floor, floorTex, wallTex }) {
    const fm = floorTex ? new THREE.MeshStandardMaterial({ map: floorTex, roughness: .85 }) : mat(floor);
    const wm = wallTex ? new THREE.MeshStandardMaterial({ map: wallTex, roughness: .9 }) : mat(wall, { roughness: .95 });
    const f = box(60, 0.4, 60, fm, 0, -0.2, 22); f.castShadow = false;
    const w = box(40, 18, 0.4, wm, 0, 9, -8); w.castShadow = false;
    const l = box(0.4, 18, 22, wm, -15, 9, 1); l.castShadow = false;
    const r = box(0.4, 18, 22, wm, 15, 9, 1); r.castShadow = false;
    const skirt = box(40, 0.7, 0.2, 0xffffff, 0, 0.35, -7.75);
    room.add(f, w, l, r, skirt);
  }

  _rooms() {
    this.rooms = {};
    const wpLogo = this.wpLogoTex = new THREE.Texture();
    wpLogo.colorSpace = THREE.SRGBColorSpace;

    // ----- Salón -----
    {
      const g = new THREE.Group();
      this._shell(g, { floorTex: planks('#C98B5A', '#B97C4E'), wall: 0xF4A78B });
      g.children[0].material.map.repeat.set(8, 10);
      const rug = cyl(6.5, 6.5, 0.08, 0x3858E9, 0, 0.04, 0.5, 48); rug.castShadow = false; g.add(rug);
      const rug2 = cyl(5.3, 5.3, 0.1, 0x5B77F0, 0, 0.05, 0.5, 48); rug2.castShadow = false; g.add(rug2);
      // sofá
      const sofa = new THREE.Group();
      sofa.add(box(8, 1.8, 3.4, 0x2B3A8F, 0, 0.9, 0), box(8, 3.4, 1, 0x2B3A8F, 0, 2.3, -1.2),
        box(1, 2.6, 3.4, 0x24307A, -4, 1.3, 0), box(1, 2.6, 3.4, 0x24307A, 4, 1.3, 0),
        box(3.4, 0.6, 2.6, 0x3E50B8, -1.8, 2.1, 0.2), box(3.4, 0.6, 2.6, 0x3E50B8, 1.8, 2.1, 0.2));
      sofa.position.set(-8.5, 0, -5.6); g.add(sofa);
      // planta
      const plant = new THREE.Group();
      plant.add(cyl(1, 0.8, 1.8, 0xE9761C, 0, 0.9, 0), sphere(1.3, 0x3FA34D, 0, 2.8, 0), sphere(1, 0x4FB85C, 0.8, 3.8, 0.2), sphere(0.9, 0x36903F, -0.7, 3.6, -0.2));
      plant.position.set(10, 0, -5); g.add(plant);
      // ventana
      const win = new THREE.Group();
      win.add(box(6.4, 5.4, 0.3, 0xffffff), box(6, 5, 0.1, 0xA6D8FF, 0, 0, 0.12, { emissive: 0x6fb7ff, emissiveIntensity: .35 }),
        box(0.25, 5, 0.2, 0xffffff, 0, 0, 0.2), box(6, 0.25, 0.2, 0xffffff, 0, 0, 0.2));
      win.position.set(6, 9, -7.7); g.add(win);
      // cuadro con el logo de WordPress
      const frame = box(4.2, 4.2, 0.3, 0xFFFFFF, -8, 9.5, -7.7);
      const pic = new THREE.Mesh(new THREE.PlaneGeometry(3.4, 3.4), new THREE.MeshStandardMaterial({ map: wpLogo, roughness: .6 }));
      pic.position.set(-8, 9.5, -7.5);
      g.add(frame, pic);
      // pelota
      this.toyBall = sphere(0.75, 0xE0413A, 5, 0.75, 2.5, { roughness: .4 });
      const stripe = new THREE.Mesh(new THREE.TorusGeometry(0.75, 0.12, 8, 32), mat(0xffffff));
      this.toyBall.add(stripe);
      g.add(this.toyBall);
      this.toyBallHome = this.toyBall.position.clone();
      this.rooms.salon = { group: g, pet: new THREE.Vector3(0, 0, 0.5) };
    }

    // ----- Cocina -----
    {
      const g = new THREE.Group();
      this._shell(g, { wall: 0x9ED9C0, floorTex: checker('#F2F2F2', '#2F3A56') });
      g.children[0].material.map.repeat.set(18, 18);
      const back = new THREE.Mesh(new THREE.PlaneGeometry(22, 4), new THREE.MeshStandardMaterial({ map: tiles('#FFFFFF', '#CFE7DC', 6), roughness: .5 }));
      back.material.map.repeat.set(6, 1); back.position.set(-2, 5.9, -7.78); g.add(back);
      g.add(box(22, 3.6, 3, 0xFFFFFF, -2, 1.8, -6.4), box(22.4, 0.35, 3.3, 0x2F3A56, -2, 3.75, -6.3));
      for (let i = 0; i < 5; i++) g.add(box(3.8, 3, 0.1, 0xF0F4F8, -10.5 + i * 4.4, 1.8, -4.85));
      // fogón y olla
      g.add(box(4, 0.1, 2, 0x1E1E1E, 3, 3.95, -6.3), cyl(1, 1, 1.4, 0xE0413A, 3, 4.7, -6.3), cyl(1.1, 1.1, 0.15, 0xB23028, 3, 5.45, -6.3));
      // nevera
      const fridge = new THREE.Group();
      fridge.add(box(4, 10, 3.4, 0xE9F1F7, 0, 5, 0), box(0.25, 2.6, 0.25, 0xAAB4BE, -1.5, 6.8, 1.8), box(0.25, 1.6, 0.25, 0xAAB4BE, -1.5, 3, 1.8), box(4.05, 0.08, 3.45, 0xC4CFD8, 0, 5.2, 0));
      fridge.position.set(11.3, 0, -5.8); g.add(fridge);
      // lámpara colgante
      g.add(cyl(0.05, 0.05, 5, 0x1E1E1E, 0, 15.5, -1), cyl(0.6, 2, 1.4, 0xF6C928, 0, 12.5, -1, 32, { side: THREE.DoubleSide }));
      // cuenco
      const bowl = cyl(1.3, 0.9, 0.7, 0x3858E9, 3.8, 0.35, 2.8); g.add(bowl);
      this.rooms.cocina = { group: g, pet: new THREE.Vector3(0, 0, 0.5) };
    }

    // ----- Despacho -----
    {
      const g = new THREE.Group();
      this._shell(g, { wall: 0xF0F0F1, floor: 0x8C8F94 });
      // barra lateral estilo wp-admin
      g.add(box(4.2, 18, 0.1, 0x1D2327, -12.6, 9, -7.75));
      for (let i = 0; i < 8; i++) {
        const on = i === 2;
        g.add(box(3.4, 0.7, 0.05, on ? 0x3858E9 : 0x2C3338, -12.6, 15 - i * 1.4, -7.65));
      }
      // cartel en la pared
      const poster = canvasTex(512, 256, (c, w, h) => {
        c.fillStyle = '#3858E9'; c.fillRect(0, 0, w, h);
        c.fillStyle = '#FFFFFF'; c.font = '900 64px "Grandstander", sans-serif'; c.textAlign = 'center';
        c.fillText('Code is', w / 2, 110); c.fillText('Poetry', w / 2, 190);
      });
      const pst = new THREE.Mesh(new THREE.PlaneGeometry(6, 3), new THREE.MeshStandardMaterial({ map: poster, roughness: .8 }));
      pst.position.set(4, 10.5, -7.75); g.add(pst);
      [[-6.5, 11, 0xF6C928], [-5.2, 9.6, 0x9ED9C0], [-7.2, 9.2, 0xF4A78B]].forEach(([x, y, c]) => {
        const n = box(1.2, 1.2, 0.05, c, x, y, -7.75); n.rotation.z = (Math.random() - .5) * .3; g.add(n);
      });
      // monitor sobre la mesa con el código
      this.codeCanvas = document.createElement('canvas');
      this.codeCanvas.width = 1024; this.codeCanvas.height = 640;
      this.codeTex = new THREE.CanvasTexture(this.codeCanvas);
      this.codeTex.colorSpace = THREE.SRGBColorSpace;
      this.codeTex.anisotropy = 4;
      const mon = new THREE.Group();
      mon.add(box(5.3, 3.4, 0.3, 0x1E1E1E));
      const screen = new THREE.Mesh(new THREE.PlaneGeometry(5.05, 3.16), new THREE.MeshBasicMaterial({ map: this.codeTex, toneMapped: false }));
      screen.position.z = 0.16; mon.add(screen);
      mon.add(box(0.5, 1.2, 0.3, 0x2C3338, 0, -2.1, -0.2), box(2.2, 0.15, 1.4, 0x2C3338, 0, -2.65, -0.2));
      // escritorio
      const desk = new THREE.Group();
      desk.add(box(9, 0.45, 4, 0xC98B5A, 0, 3.1, 0), box(0.45, 3.1, 3.6, 0xA8703F, -4.1, 1.55, 0), box(0.45, 3.1, 3.6, 0xA8703F, 4.1, 1.55, 0), box(8.2, 2.2, 0.2, 0xB97C4E, 0, 2, -1.4));
      mon.position.set(-1.2, 6.0, -0.6);
      mon.rotation.y = 0.5;
      desk.add(mon);
      // teclado y taza
      const kb = box(3, 0.16, 1.1, 0x2C3338, 2.2, 3.4, 0.9); kb.rotation.y = 0.5; desk.add(kb);
      this.keys = box(2.7, 0.06, 0.8, 0x3858E9, 2.2, 3.5, 0.9); this.keys.rotation.y = 0.5; desk.add(this.keys);
      desk.add(cyl(0.45, 0.4, 0.9, 0xF6C928, -3.4, 3.78, 1.2));
      desk.position.set(-1.6, 0, 0.2); g.add(desk);
      // taburete para cuando Wapuu es pequeño
      this.stool = cyl(1.5, 1.3, 1, 0x3858E9, 2.7, 0.5, 2.2); g.add(this.stool);
      this.rooms.despacho = { group: g, pet: new THREE.Vector3(2.7, 0, 2.2), rotY: -0.55, wide: 1.6, lift: 4.4 };
    }

    // ----- Baño -----
    {
      const g = new THREE.Group();
      const wt = tiles('#CDEBF7', '#FFFFFF', 8); wt.repeat.set(8, 4);
      this._shell(g, { wallTex: wt, floorTex: tiles('#FFFFFF', '#D9E3EA', 10) });
      g.children[0].material.map.repeat.set(18, 18);
      // váter
      const wc = new THREE.Group();
      wc.add(cyl(0.9, 1.1, 2, 0xFFFFFF, 0, 1, 0), cyl(1.7, 1.2, 0.7, 0xFFFFFF, 0, 2.2, 0.4),
        cyl(1.75, 1.75, 0.18, 0xF2F4F7, 0, 2.62, 0.4), box(3.2, 2.8, 1.3, 0xFFFFFF, 0, 4, -1.2), box(0.8, 0.2, 0.3, 0xB0BEC5, 1, 5.5, -1.2));
      wc.position.set(-5.6, 0, -5.2); g.add(wc);
      this.wcSeat = new THREE.Vector3(-5.6, 2.2, -5.0);
      // lavabo y espejo
      const sink = new THREE.Group();
      sink.add(cyl(0.5, 0.7, 3.2, 0xFFFFFF, 0, 1.6, 0), cyl(1.8, 1.3, 0.8, 0xFFFFFF, 0, 3.5, 0.2), cyl(0.12, 0.12, 0.8, 0xB0BEC5, 0, 4.2, -0.9));
      sink.position.set(7, 0, -6.2); g.add(sink);
      g.add(box(4, 5, 0.2, 0xFFFFFF, 7, 8.6, -7.75), box(3.6, 4.6, 0.1, 0xCFE6F5, 7, 8.6, -7.6, { roughness: 0.05, metalness: 0.6 }));
      // ducha
      g.add(cyl(0.15, 0.15, 6, 0xB0BEC5, 0.8, 13, -7.4), box(0.3, 0.3, 7, 0xB0BEC5, 0.8, 15.8, -4), cyl(1.3, 0.6, 0.6, 0xB0BEC5, 0.8, 15.4, -0.6));
      this.showerHead = new THREE.Vector3(0, 15, -3);
      // alfombrilla y patito
      const mat_ = box(6, 0.1, 4, 0x3858E9, 0, 0.05, 0.5); mat_.castShadow = false; g.add(mat_);
      const duck = new THREE.Group();
      duck.add(sphere(0.7, 0xF6C928, 0, 0.6, 0), sphere(0.45, 0xF6C928, 0.35, 1.3, 0), box(0.35, 0.15, 0.25, 0xE9761C, 0.8, 1.25, 0));
      duck.position.set(4.5, 0, 3); duck.rotation.y = -0.6; g.add(duck);
      this.rooms.bano = { group: g, pet: new THREE.Vector3(0.8, 0, 0.5), wide: 1.4 };
    }

    // ----- Dormitorio -----
    {
      const g = new THREE.Group();
      this._shell(g, { wall: 0x4B4A8C, floor: 0x7B6BA3 });
      const bed = new THREE.Group();
      bed.add(box(8.5, 1.5, 10, 0x8A5A3C, 0, 0.75, 0), box(8.5, 5, 0.6, 0x8A5A3C, 0, 2.5, -5), box(8, 1, 9.4, 0xFFFFFF, 0, 2, 0.2),
        box(3.6, 0.8, 2, 0xF7F7F7, -1.9, 2.8, -3.6), box(3.6, 0.8, 2, 0xF7F7F7, 1.9, 2.8, -3.6));
      bed.position.set(0, 0, -2.6); g.add(bed);
      // manta (solo se ve al dormir)
      const blanketTex = canvasTex(256, 256, (c, w, h) => {
        c.fillStyle = '#3858E9'; c.fillRect(0, 0, w, h);
        c.fillStyle = '#F6C928';
        for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) if ((x + y) % 2 === 0) { c.beginPath(); c.arc(x * 32 + 16, y * 32 + 16, 5, 0, 7); c.fill(); }
      });
      this.blanket = new THREE.Group();
      const bl = new THREE.Mesh(new THREE.BoxGeometry(8.3, 2.6, 6.4, 1, 1, 1), new THREE.MeshStandardMaterial({ map: blanketTex, roughness: 0.9 }));
      bl.castShadow = true; bl.receiveShadow = true;
      bl.position.set(0, 3.3, 0.2);
      const fold = box(8.35, 0.5, 1, 0xFFFFFF, 0, 4.4, -2.7);
      this.blanket.add(bl, fold);
      this.blanket.position.set(0, 0, -1.2);
      this.blanket.visible = false;
      g.add(this.blanket);
      // mesita y lámpara
      g.add(box(2.6, 2.8, 2.4, 0xA8703F, 7, 1.4, -6), cyl(0.3, 0.5, 1.2, 0xF6C928, 7, 3.4, -6), cyl(0.7, 1.3, 1.4, 0xFFF3C4, 7, 4.6, -6, 32, { emissive: 0xFFD27A, emissiveIntensity: .4 }));
      this.lamp = new THREE.PointLight(0xFFC870, 0, 20, 1.6);
      this.lamp.position.set(7, 4.8, -5);
      g.add(this.lamp);
      // ventana con luna
      const win = new THREE.Group();
      this.nightSky = box(5.6, 4.6, 0.1, 0x1B1F4A, 0, 0, 0.12, { emissive: 0x1B1F4A, emissiveIntensity: .6 });
      const moon = sphere(0.8, 0xFFF6D5, 1.4, 1, 0.3, { emissive: 0xFFF6D5, emissiveIntensity: .9 });
      win.add(box(6, 5, 0.3, 0xFFFFFF), this.nightSky, moon, box(0.2, 4.6, 0.2, 0xFFFFFF, 0, 0, 0.2));
      for (let i = 0; i < 7; i++) win.add(sphere(0.07, 0xFFFFFF, -2.4 + Math.random() * 3, -1.8 + Math.random() * 3.8, 0.25, { emissive: 0xffffff, emissiveIntensity: 1 }));
      win.position.set(-7.5, 9.5, -7.7); g.add(win);
      this.rooms.dormitorio = { group: g, pet: new THREE.Vector3(0, 0, 4), bed: new THREE.Vector3(0, 1.9, -4.3) };
    }

    for (const r of Object.values(this.rooms)) { r.group.visible = false; this.scene.add(r.group); }
  }

  _showerDrops() {
    const n = 400;
    const geo = new THREE.BufferGeometry();
    const pos = new Float32Array(n * 3);
    this.dropSpeed = new Float32Array(n);
    for (let i = 0; i < n; i++) this._resetDrop(pos, i, true);
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    this.drops = new THREE.Points(geo, new THREE.PointsMaterial({ color: 0x4FA8FF, size: 0.32, transparent: true, opacity: 0.9 }));
    this.drops.visible = false;
    this.rooms.bano.group.add(this.drops);
  }
  _resetDrop(pos, i, rand = false) {
    const a = Math.random() * Math.PI * 2, r = Math.random() * 2.4;
    pos[i * 3] = 0.8 + Math.cos(a) * r;
    pos[i * 3 + 1] = rand ? Math.random() * 15 : 15;
    pos[i * 3 + 2] = 0.2 + Math.sin(a) * r;
    this.dropSpeed[i] = 14 + Math.random() * 8;
  }

  // ---------- carga de Wapuu ----------
  async load(onProgress = () => {}) {
    let text = null, base = null;
    for (const b of MODEL_BASES) {
      try {
        const res = await fetch(b + 'wapuu_low.obj');
        if (!res.ok) throw new Error(res.status);
        const total = +res.headers.get('content-length') || 346534;
        const reader = res.body.getReader();
        const chunks = []; let got = 0;
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          chunks.push(value); got += value.length;
          onProgress(Math.min(0.95, got / total));
        }
        text = new TextDecoder().decode(await new Blob(chunks).arrayBuffer());
        if (!text.includes('wapuu')) throw new Error('modelo no válido');
        base = b; break;
      } catch (e) { console.warn('No se pudo cargar desde', b, e); }
    }
    if (!text) throw new Error('No se pudo descargar el modelo 3D de Wapuu.');

    await new Promise((res) => {
      new THREE.TextureLoader().setCrossOrigin('anonymous').load(base + 'wp_logo.png', (t) => {
        this.wpLogoTex.image = t.image; this.wpLogoTex.needsUpdate = true; res();
      }, undefined, () => res());
    });

    const obj = new OBJLoader().parse(text);
    this._buildPet(obj);
    onProgress(1);
  }

  _buildPet(obj) {
    const bodyMat = mat(COLORS.body, { roughness: 0.55 });
    const earMat = mat(COLORS.ear, { roughness: 0.55 });
    const eyeMat = mat(COLORS.eye, { roughness: 0.15 });
    const ballMat = new THREE.MeshStandardMaterial({ map: this.wpLogoTex, roughness: 0.35 });
    dirtify(bodyMat); dirtify(earMat); dirtify(ballMat);

    this.pet = new THREE.Group();      // posición en la habitación
    this.hop = new THREE.Group();      // saltos
    this.squashG = new THREE.Group();  // estirar y aplastar
    this.pet.add(this.hop); this.hop.add(this.squashG);
    this.petMeshes = [];

    const pivot = (p) => { const g = new THREE.Group(); g.position.copy(p); this.squashG.add(g); return g; };
    this.earL = pivot(new THREE.Vector3(1.1, 4.85, -0.35));
    this.earR = pivot(new THREE.Vector3(-1.1, 4.85, -0.35));
    this.tail = pivot(new THREE.Vector3(0, 2.2, -3.1));
    this.eyes = pivot(new THREE.Vector3(0, 4.27, 1.8));

    const meshes = [];
    obj.traverse(m => { if (m.isMesh) meshes.push(m); });
    for (const m of meshes) {
      const n = m.name;
      m.castShadow = true; m.receiveShadow = true;
      let parent = this.squashG;
      if (n.includes('ball')) m.material = ballMat;
      else if (n.includes('ear_left')) { m.material = earMat; parent = this.earL; }
      else if (n.includes('ear_right')) { m.material = earMat; parent = this.earR; }
      else if (n.includes('tail')) { m.material = earMat; parent = this.tail; }
      else if (n.includes('eye')) { m.material = eyeMat; parent = this.eyes; }
      else if (n.includes('nose')) m.material = eyeMat;
      else m.material = bodyMat;
      if (parent !== this.squashG) m.position.sub(parent.position);
      parent.add(m);
      this.petMeshes.push(m);
    }

    // brillo en los ojos
    const shine = new THREE.MeshBasicMaterial({ color: 0xffffff });
    for (const x of [-0.5, 0.5]) {
      const s = new THREE.Mesh(new THREE.SphereGeometry(0.075, 12, 8), shine);
      s.position.set(x + (x > 0 ? -0.06 : -0.06), 0.13, 0.24);
      this.eyes.add(s);
    }
    // mofletes (se ven cuando está contento)
    this.cheeks = [];
    const cheekMat = new THREE.MeshBasicMaterial({ color: 0xFF7A7A, transparent: true, opacity: 0, depthWrite: false });
    for (const x of [-1.25, 1.25]) {
      const c = new THREE.Mesh(new THREE.CircleGeometry(0.3, 20), cheekMat);
      c.position.set(x, 3.95, 1.72);
      c.rotation.y = x > 0 ? 0.55 : -0.55;
      this.squashG.add(c); this.cheeks.push(c);
    }
    this.cheekMat = cheekMat;

    // soportes para cosméticos
    this.wearHead = new THREE.Group(); this.squashG.add(this.wearHead);
    this.wearFace = new THREE.Group(); this.squashG.add(this.wearFace);
    this.wearEar = new THREE.Group(); this.earR.add(this.wearEar);
    this.pet.scale.setScalar(this.growth.scale);
  }

  // ---------- crecimiento ----------
  setGrowth({ scale, eyes }, animate = false) {
    const from = this.growth.scale;
    this.growth = { scale, eyes };
    if (!this.pet) return Promise.resolve();
    this._placePet();
    if (!animate || Math.abs(from - scale) < 0.001) { this.pet.scale.setScalar(scale); return Promise.resolve(); }
    return this.tween(1.1, p => {
      const over = Math.sin(p * Math.PI) * 0.12 * (1 - p);
      this.pet.scale.setScalar(THREE.MathUtils.lerp(from, scale, p) + over);
    }, ease.out).then(() => this.pet.scale.setScalar(scale));
  }

  // ---------- suciedad ----------
  setDirt(v) { this.dirtTarget = Math.max(0, Math.min(1, v)); }

  // ---------- cosméticos ----------
  setCosmetics(eq = {}) {
    if (!this.pet) return;
    for (const [slot, g] of [['head', this.wearHead], ['face', this.wearFace], ['ear', this.wearEar]]) {
      while (g.children.length) g.remove(g.children[0]);
      if (eq[slot]) { const m = this._cosmetic(eq[slot]); if (m) g.add(m); }
    }
  }

  _cosmetic(id) {
    const g = new THREE.Group();
    const shiny = (c) => mat(c, { roughness: 0.35 });
    if (id === 'party') {
      const tex = canvasTex(256, 256, (c, w, h) => {
        c.fillStyle = '#3858E9'; c.fillRect(0, 0, w, h);
        c.fillStyle = '#F6C928';
        for (let i = -h; i < w * 2; i += 48) { c.beginPath(); c.moveTo(i, 0); c.lineTo(i + 24, 0); c.lineTo(i + 24 - h, h); c.lineTo(i - h, h); c.fill(); }
      });
      const cone = new THREE.Mesh(new THREE.ConeGeometry(1.0, 2.4, 32, 1, true), new THREE.MeshStandardMaterial({ map: tex, roughness: .6, side: THREE.DoubleSide }));
      cone.position.y = 1.2; cone.castShadow = true;
      g.add(cone, sphere(0.3, 0xE0413A, 0, 2.45, 0));
      g.position.set(0.1, 5.3, -0.35); g.rotation.z = -0.18;
    }
    if (id === 'cap') {
      const dome = new THREE.Mesh(new THREE.SphereGeometry(1.45, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2), shiny(0x3858E9));
      dome.scale.y = 0.72; dome.castShadow = true;
      const brim = cyl(1.2, 1.2, 0.1, 0x1D35B4, 0, 0.05, 1.15);
      brim.scale.z = 0.75;
      const logo = new THREE.Mesh(new THREE.CircleGeometry(0.42, 32), new THREE.MeshStandardMaterial({ map: this.wpLogoTex, roughness: .5 }));
      logo.position.set(0, 0.5, 1.28); logo.rotation.x = -0.5;
      g.add(dome, brim, logo, sphere(0.14, 0x1D35B4, 0, 1.05, 0));
      g.position.set(0, 5.05, -0.3); g.rotation.x = -0.1;
    }
    if (id === 'tophat') {
      g.add(cyl(1.5, 1.5, 0.12, 0x1E1E1E, 0, 0, 0), cyl(0.95, 0.95, 1.9, 0x1E1E1E, 0, 1, 0), cyl(0.97, 0.97, 0.35, 0xE0413A, 0, 0.25, 0));
      g.position.set(0.15, 5.45, -0.4); g.rotation.z = -0.12;
    }
    if (id === 'crown') {
      const gold = mat(0xF2B705, { roughness: 0.25, metalness: 0.7 });
      const band = new THREE.Mesh(new THREE.CylinderGeometry(1.0, 1.05, 0.6, 32, 1, true), gold);
      band.material.side = THREE.DoubleSide; band.castShadow = true;
      g.add(band);
      const gems = [0xE0413A, 0x3858E9, 0x3FB950, 0xFF5FA2, 0xFFFFFF];
      for (let i = 0; i < 5; i++) {
        const a = i / 5 * Math.PI * 2 + Math.PI / 2;
        const spike = new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.6, 12), gold);
        spike.position.set(Math.cos(a) * 1.0, 0.58, Math.sin(a) * 1.0); spike.castShadow = true;
        g.add(spike, sphere(0.13, gems[i], Math.cos(a) * 1.07, 0, Math.sin(a) * 1.07, { roughness: .1 }));
        g.add(sphere(0.08, 0xF2B705, Math.cos(a) * 1.0, 0.92, Math.sin(a) * 1.0, { metalness: .7, roughness: .25 }));
      }
      g.position.set(0, 5.55, -0.35);
    }
    if (id === 'sunglasses' || id === 'nerd') {
      const nerd = id === 'nerd';
      const frameMat = shiny(nerd ? 0x1E1E1E : 0x111111);
      for (const x of [-0.52, 0.52]) {
        const lens = nerd
          ? new THREE.Mesh(new THREE.TorusGeometry(0.4, 0.08, 10, 32), frameMat)
          : new THREE.Mesh(new THREE.CylinderGeometry(0.44, 0.44, 0.1, 32), mat(0x0B0F1A, { roughness: 0.05, metalness: 0.5 }));
        if (!nerd) lens.rotation.x = Math.PI / 2;
        lens.position.set(x, 0, 0); lens.rotation.y = x * 0.5;
        g.add(lens);
        if (nerd) {
          const glass = new THREE.Mesh(new THREE.CircleGeometry(0.38, 32), new THREE.MeshStandardMaterial({ color: 0xDDEBFF, transparent: true, opacity: 0.25, roughness: 0.05 }));
          glass.position.set(x, 0, 0.01); glass.rotation.y = x * 0.5; g.add(glass);
        }
        const arm = box(0.07, 0.07, 1.2, frameMat, x * 1.85, 0.05, -0.55);
        arm.rotation.y = x > 0 ? 0.35 : -0.35; g.add(arm);
      }
      g.add(box(0.36, 0.08, 0.08, frameMat, 0, 0.1, 0.08));
      g.position.set(0, 4.3, 2.12);
    }
    if (id === 'bow') {
      const pink = shiny(0xFF5FA2);
      for (const d of [-1, 1]) {
        const c = new THREE.Mesh(new THREE.ConeGeometry(0.34, 0.7, 20), pink);
        c.rotation.z = d * Math.PI / 2; c.position.x = d * 0.33; c.castShadow = true; g.add(c);
      }
      g.add(sphere(0.16, 0xE0418A, 0, 0, 0));
      g.position.set(-0.45, 0.55, 0.45); g.rotation.z = 0.4;
    }
    if (id === 'flower') {
      for (let i = 0; i < 6; i++) {
        const a = i / 6 * Math.PI * 2;
        const pet = sphere(0.2, 0xFFFFFF, Math.cos(a) * 0.26, Math.sin(a) * 0.26, 0);
        pet.scale.z = 0.4; g.add(pet);
      }
      g.add(sphere(0.16, 0xF2B705, 0, 0, 0.05));
      g.position.set(-0.45, 0.55, 0.5); g.rotation.x = -0.4;
    }
    g.traverse(o => { if (o.isMesh) o.castShadow = true; });
    return g;
  }

  // ---------- API pública ----------
  setRoom(id) {
    this.room = id;
    for (const [k, r] of Object.entries(this.rooms)) r.group.visible = k === id;
    const r = this.rooms[id];
    r.group.add(this.pet);
    this._placePet();
    this._applyLighting();
    this.drops.visible = false;
    this.resize();
    if (id === 'despacho') this._drawScreen();
  }

  _placePet() {
    const r = this.rooms[this.room];
    if (!r || !this.pet) return;
    const sleeping = this.mode === 'sleeping' && this.room === 'dormitorio';
    const small = 1 - this.growth.scale;
    this.pet.position.copy(sleeping ? r.bed : r.pet);
    if (!sleeping && r.lift) this.pet.position.y += r.lift * small;   // el bebé se sube a la silla
    this.pet.rotation.set(sleeping ? -0.35 : 0, r.rotY || 0, 0);
    this.blanket.visible = sleeping;
    this.blanket.scale.y = 0.35 + 0.65 * this.growth.scale;
    const h = r.lift ? r.lift * small : 0;
    this.stool.visible = h > 0.1;
    this.stool.scale.y = Math.max(h, 0.01);
    this.stool.position.y = h / 2;
  }

  _applyLighting() {
    const night = this.mode === 'sleeping';
    const inBed = this.room === 'dormitorio';
    this.hemi.intensity = night && inBed ? 0.12 : 1.3;
    this.sun.intensity = night && inBed ? 0.05 : 1.6;
    this.fill.intensity = night && inBed ? 0.18 : 0.5;
    this.fill.color.set(night && inBed ? 0x6070ff : 0xbfd0ff);
    this.lamp.intensity = inBed && night ? 0 : (inBed ? 30 : 0);
  }

  setMode(mode) {
    this.mode = mode;
    if (this.pet) this._placePet();
    this._applyLighting();
    if (this.room === 'despacho') this._drawScreen();
  }

  setMood(m) { this.mood = m; }

  // tween genérico
  tween(dur, fn, e = ease.inOut) {
    return new Promise(res => this.tweens.push({ t: 0, dur, fn, e, res }));
  }

  async jump(h = 2.2) {
    await this.tween(0.12, p => { this.fx.squash = 0.18 * p; });
    await this.tween(0.5, p => { this.fx.squash = 0.18 * (1 - Math.min(1, p * 4)) - 0.08 * Math.sin(p * Math.PI); this.fx.jump = Math.sin(p * Math.PI) * h; }, ease.lin);
    await this.tween(0.18, p => { this.fx.squash = 0.14 * Math.sin(p * Math.PI); this.fx.jump = 0; });
    this.fx.squash = 0;
  }

  async chomp() {
    for (let i = 0; i < 3; i++) await this.tween(0.16, p => { this.fx.squash = 0.12 * Math.sin(p * Math.PI); });
    this.fx.squash = 0;
  }

  async squish() {
    await this.tween(0.35, p => { this.fx.squash = 0.2 * Math.sin(p * Math.PI) * (1 - p * .3); });
    this.fx.squash = 0;
  }

  async dance() {
    const j = this.jump(1.6);
    await this.tween(1.2, p => { this.fx.spin = p * Math.PI * 2; this.fx.lean = Math.sin(p * Math.PI * 4) * 0.2; });
    await j;
    await this.jump(1.2);
    this.fx.spin = 0; this.fx.lean = 0;
  }

  async throwBall() {
    const b = this.toyBall;
    const from = new THREE.Vector3(6, 6, 12);
    const to = new THREE.Vector3(0, 1 + 6.2 * this.growth.scale, 1.8);
    const jumpP = this.tween(0.55, () => {}).then(() => this.jump(2.4));
    await this.tween(0.8, p => {
      b.position.lerpVectors(from, to, p);
      b.position.y += Math.sin(p * Math.PI) * 4;
      b.rotation.x += 0.3;
    }, ease.lin);
    const bounceFrom = b.position.clone();
    await this.tween(1.1, p => {
      b.position.lerpVectors(bounceFrom, this.toyBallHome, p);
      b.position.y = THREE.MathUtils.lerp(bounceFrom.y, 0.75, p) + Math.abs(Math.sin(p * Math.PI * 2.5)) * 3 * (1 - p);
      b.rotation.z -= 0.2;
    }, ease.lin);
    await jumpP;
  }

  async goToilet() {
    const home = this.pet.position.clone();
    const seat = this.wcSeat;
    await this.tween(0.7, p => {
      this.pet.position.lerpVectors(home, seat, p);
      this.pet.position.y += Math.sin(p * Math.PI) * 2;
      this.pet.rotation.y = Math.sin(p * Math.PI) * 0.6;
    });
    this.fx.eyes = 0.35;
    await this.tween(2.2, p => { this.fx.squash = Math.sin(p * Math.PI * 6) * 0.03; });
    this.fx.eyes = 1; this.fx.squash = 0;
    await this.tween(0.7, p => {
      this.pet.position.lerpVectors(seat, home, p);
      this.pet.position.y += Math.sin(p * Math.PI) * 2;
    });
    this.pet.rotation.y = 0;
  }

  async shower(sec = 2.6) {
    this.drops.visible = true;
    this.fx.eyes = 0.3;
    await this.tween(sec, p => { this.fx.lean = Math.sin(p * Math.PI * 8) * 0.06; }, ease.lin);
    this.drops.visible = false;
    this.fx.eyes = 1; this.fx.lean = 0;
    await this.squish();
  }

  // ---------- consultas ----------
  screenPos(local) {
    if (!this.pet) return { x: innerWidth / 2, y: innerHeight / 2 };
    const v = local.clone();
    this.squashG.localToWorld(v);
    v.project(this.camera);
    return { x: (v.x + 1) / 2 * innerWidth, y: (1 - v.y) / 2 * innerHeight };
  }
  headPos() { return this.screenPos(new THREE.Vector3(0, 6.4, 0)); }
  mouthPos() { return this.screenPos(new THREE.Vector3(0, 3.7, 2.2)); }
  bellyPos() { return this.screenPos(new THREE.Vector3(0, 2.5, 2.2)); }

  hit(clientX, clientY) {
    if (!this.pet) return false;
    const rect = this.canvas.getBoundingClientRect();
    this.pointer.set(((clientX - rect.left) / rect.width) * 2 - 1, -((clientY - rect.top) / rect.height) * 2 + 1);
    this.raycaster.setFromCamera(this.pointer, this.camera);
    return this.raycaster.intersectObjects(this.petMeshes, false).length > 0;
  }

  // ---------- monitor ----------
  _drawScreen() {
    const c = this.codeCanvas.getContext('2d');
    const W = this.codeCanvas.width, H = this.codeCanvas.height;
    c.fillStyle = '#0D1117'; c.fillRect(0, 0, W, H);
    c.fillStyle = '#1D2327'; c.fillRect(0, 0, W, 52);
    ['#FF5F57', '#FEBC2E', '#28C840'].forEach((col, i) => { c.fillStyle = col; c.beginPath(); c.arc(30 + i * 30, 26, 9, 0, 7); c.fill(); });
    c.font = '600 24px "Fira Code", monospace';
    if (this.mode !== 'coding') {
      c.fillStyle = '#C3C4C7';
      c.fillText('wp-admin · Escritorio', 130, 34);
      c.fillStyle = '#3858E9'; c.fillRect(60, 110, W - 120, 150);
      c.fillStyle = '#FFFFFF'; c.font = '900 52px "Grandstander", sans-serif';
      c.fillText(`¡Hola, ${this.name}!`, 90, 200);
      c.font = '600 28px "Fira Code", monospace'; c.fillStyle = '#8B949E';
      c.fillText('// Pulsa «Programar» para escribir', 70, 340);
      c.fillText('// código y ganar monedas.', 70, 390);
      c.fillStyle = '#3FB950';
      c.fillText(`$commits = ${this.commits || 0};`, 70, 480);
      this.codeTex.needsUpdate = true;
      this.keys.material.color.set(0x2C3338);
      return;
    }
    if (!this.snippet) { this.snippet = SNIPPETS[Math.floor(Math.random() * SNIPPETS.length)]; this.typed = 0; }
    const snip = this.snippet;
    c.fillStyle = '#C3C4C7';
    c.fillText('wp-content/plugins/wapuu/' + snip.file, 130, 34);
    const visible = snip.code.slice(0, Math.floor(this.typed));
    const lines = visible.split('\n');
    c.font = '600 30px "Fira Code", monospace';
    const lh = 46, x0 = 70;
    const start = Math.max(0, lines.length - 11);
    lines.slice(start).forEach((ln, i) => {
      const y = 100 + i * lh;
      if (y > 630) return;
      c.fillStyle = '#484F58'; c.fillText(String(start + i + 1).padStart(2, ' '), 8, y);
      let x = x0;
      for (const [t, col] of highlight(ln)) { c.fillStyle = col; c.fillText(t, x, y); x += c.measureText(t).width; }
      if (i === lines.length - 1 - start && Math.floor(this.time * 2) % 2 === 0) { c.fillStyle = '#F6C928'; c.fillRect(x + 2, y - 24, 14, 30); }
    });
    this.codeTex.needsUpdate = true;
    this.keys.material.color.set(Math.floor(this.time * 8) % 2 ? 0x3858E9 : 0x5B77F0);
  }

  // ---------- bucle ----------
  resize() {
    const w = innerWidth, h = innerHeight;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    // En vertical nos acercamos para que Wapuu quepa entre la barra de arriba y los botones
    const extra = (this.rooms && this.rooms[this.room] && this.rooms[this.room].wide) || 0;
    const halfW = w < h ? 5.3 + extra : 11;
    const tanV = Math.tan(THREE.MathUtils.degToRad(this.camera.fov / 2));
    const dist = Math.max(w < h ? 21 : 27, halfW / (tanV * this.camera.aspect));
    this.camPos.set(0, 4 + dist * 0.2, dist);
    this.camTarget.set(0, w < h ? 3.2 : 3.8, 0);
    this.camera.updateProjectionMatrix();
    if (!this._camReady) { this.camera.position.copy(this.camPos); this._camReady = true; }
  }

  update() {
    const dt = Math.min(this.clock.getDelta(), 0.05);
    this.time += dt;
    const t = this.time;

    for (let i = this.tweens.length - 1; i >= 0; i--) {
      const tw = this.tweens[i];
      tw.t += dt;
      const p = Math.min(1, tw.t / tw.dur);
      tw.fn(tw.e(p));
      if (p >= 1) { this.tweens.splice(i, 1); tw.res(); }
    }

    this.camera.position.lerp(this.camPos, 0.1);
    this.camera.lookAt(this.camTarget);

    if (this.pet) {
      const sleeping = this.mode === 'sleeping';
      const coding = this.mode === 'coding';
      const sad = this.mood === 'sad', happy = this.mood === 'happy';

      // respiración
      const breath = sleeping ? Math.sin(t * 1.6) * 0.035 : Math.sin(t * 2.4) * 0.018;
      const sq = this.fx.squash;
      this.squashG.scale.set(1 + sq * 0.6 - breath * 0.3, 1 - sq + breath, 1 + sq * 0.6 - breath * 0.3);
      const bob = coding ? Math.abs(Math.sin(t * 9)) * 0.12 : 0;
      this.hop.position.y = this.fx.jump + bob;
      this.hop.rotation.y = this.fx.spin + (coding ? Math.sin(t * 1.3) * 0.12 : 0);
      this.hop.rotation.z = this.fx.lean + (happy && !sleeping ? Math.sin(t * 2) * 0.03 : 0);
      this.hop.rotation.x = coding ? 0.12 : 0;

      // cola
      const wagSpeed = sleeping ? 0.8 : coding ? 10 : happy ? 7 : sad ? 1.5 : 4;
      const wagAmp = sleeping ? 0.04 : sad ? 0.06 : happy ? 0.28 : 0.15;
      this.tail.rotation.y = Math.sin(t * wagSpeed) * wagAmp;
      this.tail.rotation.x = sad ? 0.15 : 0;

      // orejas
      const droop = sad ? 0.55 : sleeping ? 0.35 : 0;
      this.fx.earDroop += (droop - this.fx.earDroop) * 0.08;
      const twitch = Math.max(0, Math.sin(t * 0.9) - 0.96) * 6;
      this.earL.rotation.z = -this.fx.earDroop + twitch * 0.2;
      this.earR.rotation.z = this.fx.earDroop - twitch * 0.2;

      // ojos: parpadeo, dormido, triste
      let eyeY = this.fx.eyes * (sad ? 0.75 : 1);
      if (sleeping) eyeY = 0.08;
      else if (t > this.nextBlink) {
        const bt = t - this.nextBlink;
        if (bt < 0.14) eyeY *= 0.1; else this.nextBlink = t + 2 + Math.random() * 3.5;
      }
      const eb = this.growth.eyes;
      this.eyes.scale.x = this.eyes.scale.z = eb;
      this.eyes.scale.y += (eyeY * eb - this.eyes.scale.y) * 0.5;

      // mofletes
      const cheekTarget = happy || this.fx.jump > 0.1 ? 0.55 : 0;
      this.cheekMat.opacity += (cheekTarget - this.cheekMat.opacity) * 0.08;
    }

    // la suciedad se va (o aparece) poco a poco
    dirtUniform.value += (this.dirtTarget - dirtUniform.value) * Math.min(1, dt * 2.5);

    // ducha
    if (this.drops.visible) {
      const pos = this.drops.geometry.attributes.position;
      for (let i = 0; i < pos.count; i++) {
        pos.array[i * 3 + 1] -= this.dropSpeed[i] * dt;
        if (pos.array[i * 3 + 1] < 0) this._resetDrop(pos.array, i);
      }
      pos.needsUpdate = true;
    }

    // monitor
    if (this.room === 'despacho' && this.mode === 'coding') {
      if (!this.snippet) { this.snippet = SNIPPETS[Math.floor(Math.random() * SNIPPETS.length)]; this.typed = 0; }
      this.typed += dt * 20;
      if (this.typed >= this.snippet.code.length + 20) {
        this.onCommit(this.snippet.file);
        let next;
        do { next = SNIPPETS[Math.floor(Math.random() * SNIPPETS.length)]; } while (next === this.snippet);
        this.snippet = next; this.typed = 0;
      }
      this._screenT = (this._screenT || 0) + dt;
      if (this._screenT > 0.05) { this._screenT = 0; this._drawScreen(); }
    }

    this.renderer.render(this.scene, this.camera);
  }
}
