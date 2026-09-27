import { useEffect, useRef } from 'react';
import { useReducedMotion } from '../hooks/useMotionPrefs.js';

// Particle ASCII canvas. A fixed pool of glyph-particles renders the current
// mood (face, cube, database, terminal, pipeline, mesh, cloud, hi).
// Cursor repels nearby particles; springs pull them home; hovering words
// retargets every particle with a staggered morph. No React state per frame.

const RAMP = ['.', ':', '+', '*', '?', '%', 'S', '#', '@'];
const CRIMSON = '163,29,29';
const RADIUS = 100;

function mulberry32(a) {
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function sstep(a, b, x) {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
}

function hash2(x, y) {
  const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
  return s - Math.floor(s);
}

function ell(x, y, cx, cy, rx, ry) {
  const dx = (x - cx) / rx;
  const dy = (y - cy) / ry;
  return dx * dx + dy * dy;
}

// Naturalistic procedural face density, 0..1. x in [-0.65,0.65], y in [-0.9,1].
function faceDensity(x, y) {
  const taper = 1 - 0.26 * sstep(-0.02, 0.62, y);
  const rx = 0.44 * taper;
  const head = ell(x, y, 0, -0.06, rx, 0.56);
  let d = 0.008;

  if (head < 1.3) {
    const inside = 1 - sstep(0.78, 1.06, head);
    const edge = sstep(0.55, 1.0, head); // darker toward jaw/temples
    const cheekL = Math.exp(-(((x + 0.2) ** 2 + (y - 0.1) ** 2) / 0.07));
    const cheekR = Math.exp(-(((x - 0.2) ** 2 + (y - 0.1) ** 2) / 0.07));
    const skin = 0.3 + 0.1 * cheekL + 0.1 * cheekR + 0.16 * edge;
    d = Math.max(d, skin * inside);

    // hair — full mass with ragged edge
    const ragged = (hash2(Math.round(x * 24), Math.round(y * 24)) - 0.5) * 0.22;
    const hair = ell(x, y, 0.01, -0.42, 0.52 * taper + 0.06, 0.3);
    if (hair + ragged < 1) d = Math.max(d, (0.88 * (1 - sstep(0.5, 1, hair)) + 0.1) * inside);
    // hairline falloff
    d = Math.max(d, 0.55 * (1 - sstep(0, 0.09, Math.abs(y + 0.335))) * inside);

    for (const s of [-1, 1]) {
      // brow — soft band
      const brow = ell(x, y, s * 0.165, -0.185, 0.095, 0.03);
      if (brow < 1) d = Math.max(d, 0.62 + 0.3 * (1 - brow));
      // eye — almond with darker upper lid
      const eye = ell(x, y, s * 0.16, -0.1, 0.082, 0.034);
      if (eye < 1) d = Math.max(d, 0.72 + 0.26 * (1 - eye));
      if (ell(x, y, s * 0.16, -0.122, 0.086, 0.012) < 1) d = Math.max(d, 1);
      // catchlight keeps the eye alive
      if (ell(x, y, s * 0.148, -0.108, 0.016, 0.014) < 1) d = Math.max(d, 0.22);
      // nostril wing shading + nostril
      if (ell(x, y, s * 0.058, 0.19, 0.045, 0.05) < 1) d = Math.max(d, 0.42);
      if (ell(x, y, s * 0.052, 0.215, 0.02, 0.016) < 1) d = Math.max(d, 0.97);
      // ear
      if (ell(x, y, s * 0.45, -0.03, 0.06, 0.1) < 1) d = Math.max(d, 0.4 * inside);
    }
    // nose bridge shading (soft, one side) + tip
    const bridge = Math.exp(-(((x - 0.028) ** 2) / 0.0009)) * sstep(-0.08, -0.02, y) * (1 - sstep(0.16, 0.24, y));
    d = Math.max(d, Math.min(0.6, bridge) * inside);
    if (ell(x, y, 0.005, 0.185, 0.07, 0.04) < 1) d = Math.max(d, 0.55 * inside);
    // philtrum + lips
    if (Math.abs(x) < 0.02 && y > 0.24 && y < 0.3) d = Math.max(d, 0.35);
    if (Math.abs(x) < 0.125) {
      const yc = 0.325 - 0.028 * (x / 0.125) ** 2;
      const lip = 1 - sstep(0, 0.02, Math.abs(y - yc));
      if (lip > 0) d = Math.max(d, (0.5 + 0.45 * lip) * inside);
      if (Math.abs(y - 0.375) < 0.012) d = Math.max(d, 0.3 * inside); // lower lip shade
    }
  }

  // neck + shoulders + shadow under jaw
  if (y > 0.42 && Math.abs(x) < 0.14 && y < 0.95) d = Math.max(d, 0.34);
  if (y > 0.4 && y < 0.5 && Math.abs(x) < 0.2) d = Math.max(d, 0.5 * (1 - sstep(0.4, 0.5, y)));
  if (y > 0.55) {
    const half = 0.15 + (y - 0.55) * 1.2;
    if (Math.abs(x) < half && y < 1.0) d = Math.max(d, 0.32 * (1 - sstep(half * 0.7, half, Math.abs(x))));
  }
  return Math.min(1, Math.max(0, d));
}

// ---- shape samplers: each fills (bx,by,bz,b) with N points ----

function sampleFaceProcedural(a, N, rng) {
  let i = 0;
  let guard = 0;
  while (i < N && guard++ < N * 60) {
    const x = rng() * 1.3 - 0.65;
    const y = rng() * 1.85 - 0.9;
    const d = faceDensity(x, y) + (hash2(x * 40, y * 40) - 0.5) * 0.05;
    if (rng() < d) {
      a.bx[i] = x; a.by[i] = y; a.bz[i] = 0;
      a.b[i] = Math.min(1, d);
      i++;
    }
  }
  while (i < N) { // deterministic filler, never leaves holes
    a.bx[i] = 0; a.by[i] = 2; a.bz[i] = 0; a.b[i] = 0; i++;
  }
}

function pushPt(a, i, x, y, z, b) {
  a.bx[i] = x; a.by[i] = y; a.bz[i] = z; a.b[i] = b;
}

function sampleCube(a, N, rng) {
  const s = 0.5;
  const V = [];
  for (const x of [-s, s]) for (const y of [-s, s]) for (const z of [-s, s]) V.push([x, y, z]);
  const edges = [];
  for (let i = 0; i < 8; i++) for (let j = i + 1; j < 8; j++) {
    const d = Math.abs(V[i][0] - V[j][0]) + Math.abs(V[i][1] - V[j][1]) + Math.abs(V[i][2] - V[j][2]);
    if (Math.abs(d - 2 * s) < 1e-6) edges.push([V[i], V[j]]);
  }
  for (let i = 0; i < N; i++) {
    const e = edges[i % edges.length];
    const t = rng();
    const vert = rng() < 0.06;
    pushPt(a, i,
      e[0][0] + (e[1][0] - e[0][0]) * t,
      e[0][1] + (e[1][1] - e[0][1]) * t,
      e[0][2] + (e[1][2] - e[0][2]) * t,
      vert ? 1 : 0.55 + rng() * 0.3);
  }
}

function sampleEllipseInto(a, i, cx, cy, rx, ry, b) {
  const t = (i * 2.399963) % (Math.PI * 2); // golden-angle spread
  pushPt(a, i, cx + Math.cos(t) * rx, cy + Math.sin(t) * ry, 0, b);
}

function sampleDB(a, N, rng) {
  const levels = [-0.38, -0.02, 0.34];
  for (let i = 0; i < N; i++) {
    const r = rng();
    if (r < 0.62) {
      const lv = levels[i % 3];
      sampleEllipseInto(a, i, 0, lv, 0.36, 0.1, 0.7 + (i % 3 === 0 ? 0.25 : 0));
    } else if (r < 0.85) {
      const side = i % 2 === 0 ? -0.36 : 0.36;
      pushPt(a, i, side, -0.38 + rng() * 0.72, 0, 0.5);
    } else {
      pushPt(a, i, (rng() - 0.5) * 0.6, -0.28 + (i % 3) * 0.36 + (rng() - 0.5) * 0.05, 0, 0.9);
    }
  }
}

function sampleTerminal(a, N, rng) {
  const W = 0.46, H = 0.32;
  for (let i = 0; i < N; i++) {
    const r = rng();
    if (r < 0.42) { // frame
      const side = i % 4;
      if (side === 0) pushPt(a, i, -W + rng() * 2 * W, -H, 0, 0.75);
      else if (side === 1) pushPt(a, i, -W + rng() * 2 * W, H, 0, 0.75);
      else if (side === 2) pushPt(a, i, -W, -H + rng() * 2 * H, 0, 0.75);
      else pushPt(a, i, W, -H + rng() * 2 * H, 0, 0.75);
    } else if (r < 0.52) { // header dots
      pushPt(a, i, -W + 0.08 + (i % 3) * 0.09 + (rng() - 0.5) * 0.03, -H + 0.08 + (rng() - 0.5) * 0.03, 0, 1);
    } else if (r < 0.62) { // header rule
      pushPt(a, i, -W + rng() * 2 * W, -H + 0.16, 0, 0.6);
    } else { // text lines + cursor block
      const line = i % 3;
      const len = [0.5, 0.34, 0.2][line];
      const y = -H + 0.26 + line * 0.13;
      if (rng() < 0.12 && line === 2) pushPt(a, i, -W + 0.12 + len + 0.05, y, 0, 1);
      else pushPt(a, i, -W + 0.12 + rng() * len, y + (rng() - 0.5) * 0.02, 0, 0.85);
    }
  }
}

function samplePipeline(a, N, rng) {
  const nodes = [-0.51, -0.17, 0.17, 0.51];
  for (let i = 0; i < N; i++) {
    const r = rng();
    if (r < 0.55) {
      const nx = nodes[i % 4];
      const t = rng() * Math.PI * 2;
      pushPt(a, i, nx + Math.cos(t) * 0.1, Math.sin(t) * 0.1 * 0.9, 0, 0.9);
    } else {
      const seg = i % 3;
      const x0 = nodes[seg] + 0.1, x1 = nodes[seg + 1] - 0.1;
      pushPt(a, i, x0 + rng() * (x1 - x0), (rng() - 0.5) * 0.03, 0, 0.5);
    }
  }
}

function sampleMesh(a, N, rng) {
  for (let i = 0; i < N; i++) {
    const r = rng();
    const gx = (i % 6) / 5 - 0.5;
    const gy = (Math.floor(i / 6) % 5) / 4 - 0.5;
    if (r < 0.4) {
      pushPt(a, i, gx * 1.0 + (rng() - 0.5) * 0.06, gy * 1.1 + (rng() - 0.5) * 0.06, 0, 0.85);
    } else {
      const horiz = rng() < 0.5;
      const t = rng();
      pushPt(a, i,
        horiz ? gx * 1.0 + t * 0.2 : gx * 1.0 + (rng() - 0.5) * 0.05,
        horiz ? gy * 1.1 + (rng() - 0.5) * 0.05 : gy * 1.1 + t * 0.27,
        0, 0.45);
    }
  }
}

function sampleCloud(a, N, rng) {
  const puffs = [[-0.22, 0.02, 0.2], [0.02, -0.08, 0.26], [0.26, 0.02, 0.19]];
  for (let i = 0; i < N; i++) {
    const r = rng();
    if (r < 0.68) {
      const p = puffs[i % 3];
      const t = rng() * Math.PI * 2;
      pushPt(a, i, p[0] + Math.cos(t) * p[2], p[1] + Math.sin(t) * p[2] * 0.82, 0, 0.72);
    } else if (r < 0.85) {
      pushPt(a, i, -0.4 + rng() * 0.8, 0.2, 0, 0.6); // flat base
    } else {
      pushPt(a, i, -0.3 + (i % 4) * 0.2, 0.3 + rng() * 0.22, 0, 0.55); // drizzle links
    }
  }
}

const HI_FONT = {
  H: ['#...#', '#...#', '#...#', '#####', '#...#', '#...#', '#...#'],
  I: ['#####', '..#..', '..#..', '..#..', '..#..', '..#..', '#####'],
};

function sampleHI(a, N, rng) {
  const cells = [];
  const letters = [['H', -0.34], ['I', 0.16]];
  for (const [ch, ox] of letters) {
    HI_FONT[ch].forEach((row, r) => {
      [...row].forEach((c, col) => {
        if (c === '#') cells.push([ox + col * 0.1, -0.31 + r * 0.103]);
      });
    });
  }
  for (let i = 0; i < N; i++) {
    const c = cells[i % cells.length];
    pushPt(a, i, c[0] + (rng() - 0.5) * 0.03, c[1] + (rng() - 0.5) * 0.03, 0, 0.9);
  }
}

// Dense idle orb: solid filled disc + crisp rim + tilted orbit ring.
// Rejection-free uniform fill, so every particle lands on ink — reads as
// one heavy mass instead of the light portrait spray.
function sampleDenseOrb(a, N, rng) {
  for (let i = 0; i < N; i++) {
    const r = rng();
    if (r < 0.8) {
      // solid core — uniform disc fill, packed tight
      const rad = 0.47 * Math.sqrt(rng());
      const th = rng() * Math.PI * 2;
      const x = Math.cos(th) * rad;
      const y = Math.sin(th) * rad * 0.92;
      const core = 1 - rad / 0.47;
      pushPt(a, i, x, y, 0, Math.min(1, 0.66 + core * 0.34 + rng() * 0.1));
    } else if (r < 0.92) {
      // crisp rim
      const th = rng() * Math.PI * 2;
      const rad = 0.47 + (rng() - 0.5) * 0.04;
      pushPt(a, i, Math.cos(th) * rad, Math.sin(th) * rad * 0.92, 0, 1);
    } else {
      // tilted orbit ring
      const th = rng() * Math.PI * 2;
      const wob = (rng() - 0.5) * 0.025;
      pushPt(a, i, Math.cos(th) * 0.65, Math.sin(th) * 0.65 * 0.3 + wob, 0, 0.7 + rng() * 0.3);
    }
  }
}

const SAMPLERS = {
  face: sampleFace, cube: sampleCube, db: sampleDB, terminal: sampleTerminal,
  pipeline: samplePipeline, mesh: sampleMesh, cloud: sampleCloud, hi: sampleHI,
  dense: sampleDenseOrb,
};

// ---- reference-photo face: the portrait is sampled off-screen into a
// density field. The photograph itself is never displayed. ----

const PHOTO_SRC = '/images/himanshu-source.jpg';
// crop keeps head + neck + upper shoulders, drops side whitespace and lower shirt
const PHOTO_CROP = { top: 0.03, bottom: 0.62, left: 0.2, right: 0.8 };
const WORK_H = 64; // coarse grid: large cells, abstract texture
const FACE_K = 1.3; // portrait scale within the canvas

let photoGrid = null;
let photoPromise = null;

function loadPhoto() {
  if (photoPromise) return photoPromise;
  photoPromise = new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      try {
        photoGrid = processPhoto(img);
      } catch (err) {
        photoGrid = null;
      }
      resolve(photoGrid);
    };
    img.onerror = () => resolve(null);
    img.src = PHOTO_SRC;
  });
  return photoPromise;
}

function processPhoto(img) {
  const iw = img.naturalWidth;
  const ih = img.naturalHeight;
  const sx = Math.floor(iw * PHOTO_CROP.left);
  const sy = Math.floor(ih * PHOTO_CROP.top);
  const sw = Math.floor(iw * (PHOTO_CROP.right - PHOTO_CROP.left));
  const sh = Math.floor(ih * (PHOTO_CROP.bottom - PHOTO_CROP.top));
  const gh = WORK_H;
  const gw = Math.max(24, Math.round((WORK_H * sw) / sh));
  const cv = document.createElement('canvas');
  cv.width = gw;
  cv.height = gh;
  const cx = cv.getContext('2d', { willReadFrequently: true });
  cx.drawImage(img, sx, sy, sw, sh, 0, 0, gw, gh);
  const px = cx.getImageData(0, 0, gw, gh).data;
  const n = gw * gh;
  const lum = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    lum[i] =
      (0.2126 * px[i * 4] + 0.7152 * px[i * 4 + 1] + 0.0722 * px[i * 4 + 2]) / 255;
  }
  // auto contrast from percentiles
  const sorted = Float32Array.from(lum).sort();
  const lo = sorted[Math.floor(n * 0.02)];
  const hi = sorted[Math.floor(n * 0.98)] || 1;
  const span = Math.max(1e-3, hi - lo);
  const norm = new Float32Array(n);
  for (let i = 0; i < n; i++) norm[i] = Math.min(1, Math.max(0, (lum[i] - lo) / span));
  // sobel edges — eyes, brows, lips, hairline, jaw
  const edge = new Float32Array(n);
  const at = (x, y) =>
    norm[Math.min(gh - 1, Math.max(0, y)) * gw + Math.min(gw - 1, Math.max(0, x))];
  for (let y = 0; y < gh; y++) {
    for (let x = 0; x < gw; x++) {
      const gx =
        -at(x - 1, y - 1) - 2 * at(x - 1, y) - at(x - 1, y + 1) +
        at(x + 1, y - 1) + 2 * at(x + 1, y) + at(x + 1, y + 1);
      const gy =
        -at(x - 1, y - 1) - 2 * at(x, y - 1) - at(x + 1, y - 1) +
        at(x - 1, y + 1) + 2 * at(x, y + 1) + at(x + 1, y + 1);
      edge[y * gw + x] = Math.min(1, Math.hypot(gx, gy) / 2.2);
    }
  }
  const dens = new Float32Array(n);
  const ink = new Float32Array(n);
  for (let y = 0; y < gh; y++) {
    for (let x = 0; x < gw; x++) {
      const i = y * gw + x;
      const L = norm[i];
      const white = sstep(0.8, 0.95, L); // studio backdrop suppression
      const ex = (x / (gw - 1) - 0.5) * 2;
      const ey = (y / (gh - 1) - 0.5) * 2;
      const vig = 1 - sstep(0.72, 1.05, Math.hypot(ex * 0.82, ey * 0.9));
      const subject = (1 - white) * vig;
      const k = Math.min(1, 1 - L); // ink: dark photo areas
      ink[i] = k * subject;
      dens[i] = Math.min(1, (k * 0.9 + edge[i] * 0.55) * subject + (k > 0.55 ? 0.12 * subject : 0));
    }
  }
  return { gw, gh, au: gw / gh, dens, ink };
}

// One particle per coarse grid cell above threshold — a fixed lattice, not a
// spray. Light areas stay empty so the silhouette forms from density alone.
// Deterministic jitter (±~2px) and a sparse halo of escaping particles.
function samplePhotoFace(a, N, rng) {
  const { gw, gh, au, dens, ink } = photoGrid;
  const JU = 0.009; // jitter in units (~2px at typical scale)
  const kept = [];
  const halo = [];
  for (let y = 0; y < gh; y++) {
    for (let x = 0; x < gw; x++) {
      const idx = y * gw + x;
      const d = dens[idx];
      const ux = (x / (gw - 1) - 0.5) * 2 * au * FACE_K;
      const uy = (y / (gh - 1) - 0.5) * 2 * FACE_K;
      if (d >= 0.1) {
        kept.push([
          ux + (hash2(x * 1.3, y * 2.7) - 0.5) * 2 * JU,
          uy + (hash2(x * 4.2, y * 1.1) - 0.5) * 2 * JU,
          Math.min(1, ink[idx] * 1.05 + 0.1),
        ]);
      } else if (d >= 0.03) {
        halo.push([ux, uy]);
      }
    }
  }
  let i = 0;
  for (const [x, y, b] of kept) {
    if (i >= N) break;
    pushPt(a, i, x, y, 0, b);
    i++;
  }
  // sparse escaping scatter, capped near 8% of the face count
  const budget = Math.min(N - i, Math.floor(kept.length * 0.08), halo.length);
  const step = budget > 0 ? halo.length / budget : 0;
  for (let s = 0; s < budget; s++, i++) {
    const [x, y] = halo[Math.floor(s * step) % halo.length];
    pushPt(a, i, x, y, 0, 0.14);
  }
  while (i < N) {
    pushPt(a, i, 0, 2, 0, 0);
    i++;
  }
  void rng;
}

// Photo when available, procedural stand-in while it loads.
function sampleFace(a, N, rng) {
  if (photoGrid) return samplePhotoFace(a, N, rng);
  return sampleFaceProcedural(a, N, rng);
}

const MOOD_LABEL = {
  face: 'ascii portrait', cube: 'assembling blocks', db: 'database cylinders',
  terminal: 'terminal window', pipeline: 'deployment pipeline', mesh: 'server mesh',
  cloud: 'cloud puffs', hi: 'the word hi', dense: 'dense orb',
};

export default function FaceCanvas({ mood }) {
  const wrapRef = useRef(null);
  const canvasRef = useRef(null);
  const moodRef = useRef(mood);
  const apiRef = useRef(null);
  const reduced = useReducedMotion();

  // keep parent prop reachable from inside the loop without re-subscribing
  useEffect(() => {
    moodRef.current = mood;
    if (apiRef.current) apiRef.current.morph(mood);
  }, [mood]);

  useEffect(() => {
    const wrap = wrapRef.current;
    const canvas = canvasRef.current;
    if (!wrap || !canvas) return;
    const ctx = canvas.getContext('2d');
    const coarse = window.matchMedia('(pointer: coarse)').matches;
    const dpr = Math.min(2, window.devicePixelRatio || 1);

    const P = {
      n: 0, px: null, py: null, vx: null, vy: null,
      ox: null, oy: null, br: null, gl: null, hold: null, ph: null,
      w: 0, h: 0, scale: 1, cx: 0, cy: 0, glyphPx: 9,
      mx: -9999, my: -9999, inside: false,
      base3: null, anim: null, t0: performance.now(),
      seed: 1234567,
    };

    function build(moodName, scatter) {
      const rect = wrap.getBoundingClientRect();
      const w = Math.max(80, rect.width);
      const h = Math.max(80, rect.height);
      P.w = w; P.h = h;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const small = w < 420 || coarse;
      const n = small ? 1850 : 3300;
      const rng = mulberry32(P.seed);
      P.n = n;
      P.px = new Float32Array(n); P.py = new Float32Array(n);
      P.vx = new Float32Array(n); P.vy = new Float32Array(n);
      P.ox = new Float32Array(n); P.oy = new Float32Array(n);
      P.br = new Float32Array(n); P.gl = new Uint8Array(n);
      P.hold = new Float32Array(n); P.ph = new Float32Array(n);
      P.base3 = { bx: new Float32Array(n), by: new Float32Array(n), bz: new Float32Array(n), b: new Float32Array(n) };
      P.scale = Math.min(w, h) * 0.48;
      P.cx = w / 2; P.cy = h * 0.5;
      P.glyphPx = Math.max(7, Math.min(10, P.scale * 0.036));
      ctx.font = `${P.glyphPx}px "JetBrains Mono", ui-monospace, monospace`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      SAMPLERS[moodName](P.base3, n, rng);
      const now = performance.now();
      for (let i = 0; i < n; i++) {
        const tx = P.cx + P.base3.bx[i] * P.scale;
        const ty = P.cy + P.base3.by[i] * P.scale;
        P.ox[i] = tx; P.oy[i] = ty;
        P.br[i] = P.base3.b[i];
        P.gl[i] = Math.min(RAMP.length - 1, Math.floor(P.br[i] * RAMP.length * rng()));
        P.ph[i] = rng() * Math.PI * 2;
        if (scatter) {
          P.px[i] = rng() * w; P.py[i] = rng() * h;
          P.hold[i] = now + 150 + rng() * 1400;
        } else {
          P.px[i] = tx; P.py[i] = ty;
          P.hold[i] = 0;
        }
      }
      P.anim = moodName === 'cube' ? 'cube' : moodName === 'pipeline' ? 'pipeline' : null;
      P.t0 = now;
    }

    function morph(moodName) {
      if (!P.n) return;
      const rng = mulberry32((P.seed = (P.seed + 7919) % 100000));
      SAMPLERS[moodName](P.base3, P.n, rng);
      const now = performance.now();
      for (let i = 0; i < P.n; i++) {
        const tx = P.cx + P.base3.bx[i] * P.scale;
        const ty = P.cy + P.base3.by[i] * P.scale;
        const dist = Math.hypot(tx - P.px[i], ty - P.py[i]);
        // staggered decode: far-travelling particles leave later
        P.hold[i] = now + Math.min(700, dist * 0.5) + rng() * 220;
        P.ox[i] = tx; P.oy[i] = ty;
        P.br[i] = P.base3.b[i];
      }
      P.anim = moodName === 'cube' ? 'cube' : moodName === 'pipeline' ? 'pipeline' : null;
      P.t0 = now;
      wrap.setAttribute('aria-label', `ascii canvas showing ${MOOD_LABEL[moodName] || moodName}`);
    }
    apiRef.current = { morph };

    function targets(t) {
      // returns per-frame animated targets for cube rotation; else base
      if (P.anim === 'cube') {
        const a = (t - P.t0) * 0.00045;
        const ca = Math.cos(a), sa = Math.sin(a);
        const tilt = 0.42, ct = Math.cos(tilt), st = Math.sin(tilt);
        return { ca, sa, ct, st, cube: true };
      }
      return { cube: false };
    }

    function frame(now) {
      const dt = Math.min(3, (now - (frame.last || now)) / 16.667 || 1);
      frame.last = now;
      const T = targets(now);
      const damp = Math.pow(0.9, dt);
      const k = 0.024 * dt;
      const t = (now - P.t0) / 1000;

      for (let i = 0; i < P.n; i++) {
        let tx = P.ox[i];
        let ty = P.oy[i];
        if (T.cube) {
          const x = P.base3.bx[i], y = P.base3.by[i], z = P.base3.bz[i];
          const x1 = x * T.ca + z * T.sa;
          const z1 = -x * T.sa + z * T.ca;
          const y1 = y * T.ct - z1 * T.st;
          tx = P.cx + x1 * P.scale;
          ty = P.cy + y1 * P.scale;
        } else {
          // idle breathing keeps the composition organic
          tx += Math.sin(t * 0.9 + P.ph[i]) * 1.4;
          ty += Math.cos(t * 0.7 + P.ph[i] * 1.3) * 1.4;
        }

        let vx = P.vx[i], vy = P.vy[i];
        if (now >= P.hold[i]) {
          vx += (tx - P.px[i]) * k;
          vy += (ty - P.py[i]) * k;
        }
        // cursor repulsion
        if (P.inside) {
          const dx = P.px[i] - P.mx;
          const dy = P.py[i] - P.my;
          const d2 = dx * dx + dy * dy;
          if (d2 < RADIUS * RADIUS && d2 > 0.01) {
            const d = Math.sqrt(d2);
            const f = (1 - d / RADIUS) ** 2 * 5.2 * dt;
            vx += (dx / d) * f;
            vy += (dy / d) * f;
          }
        }
        vx *= damp; vy *= damp;
        const sp2 = vx * vx + vy * vy;
        if (sp2 > 144) { const s = 12 / Math.sqrt(sp2); vx *= s; vy *= s; }
        P.vx[i] = vx; P.vy[i] = vy;
        P.px[i] += vx * dt; P.py[i] += vy * dt;
      }

      // living texture: re-roll a slice of glyphs
      const slice = Math.max(24, (P.n / 50) | 0);
      for (let s = 0; s < slice; s++) {
        const i = (Math.random() * P.n) | 0;
        P.gl[i] = Math.min(RAMP.length - 1, Math.floor(P.br[i] * RAMP.length * Math.random()));
      }

      ctx.clearRect(0, 0, P.w, P.h);
      for (let i = 0; i < P.n; i++) {
        let b = P.br[i];
        if (P.anim === 'pipeline') b *= 0.62 + 0.38 * Math.sin(P.base3.bx[i] * 5 - t * 5);
        let boost = 0;
        if (P.inside) {
          const dx = P.px[i] - P.mx, dy = P.py[i] - P.my;
          const d = Math.hypot(dx, dy);
          if (d < RADIUS) boost = (1 - d / RADIUS) * 0.55;
        }
        const a = Math.min(1, 0.2 + b * 0.8 + boost);
        if (a < 0.04) continue;
        ctx.fillStyle = `rgba(${CRIMSON},${a.toFixed(3)})`;
        ctx.fillText(RAMP[P.gl[i]], P.px[i], P.py[i]);
      }
    }

    function drawStatic() {
      ctx.clearRect(0, 0, P.w, P.h);
      for (let i = 0; i < P.n; i++) {
        const a = 0.2 + P.br[i] * 0.8;
        if (a < 0.04) continue;
        ctx.fillStyle = `rgba(${CRIMSON},${a.toFixed(3)})`;
        ctx.fillText(RAMP[P.gl[i]], P.ox[i], P.oy[i]);
      }
    }

    let raf = 0;
    frame.last = 0;
    function loop(now) {
      frame(now);
      raf = requestAnimationFrame(loop);
    }

    function pos(e) {
      const r = canvas.getBoundingClientRect();
      return { x: e.clientX - r.left, y: e.clientY - r.top };
    }
    const onMove = (e) => {
      const p = pos(e);
      P.mx = (p.x / canvas.clientWidth) * P.w;
      P.my = (p.y / canvas.clientHeight) * P.h;
      P.inside = true;
    };
    const onLeave = () => { P.inside = false; };
    const onTouch = (e) => {
      const t = e.touches[0];
      if (!t) return;
      const r = canvas.getBoundingClientRect();
      P.mx = ((t.clientX - r.left) / r.width) * P.w;
      P.my = ((t.clientY - r.top) / r.height) * P.h;
      P.inside = true;
      clearTimeout(onTouch.t);
      onTouch.t = setTimeout(() => { P.inside = false; }, 1200);
    };

    const ro = new ResizeObserver(() => {
      build(moodRef.current, false);
      if (reduced) drawStatic();
    });

    build(mood, true);
    // entrance: procedural assembles first, then decodes into the real portrait
    loadPhoto().then((grid) => {
      if (grid && moodRef.current === 'face' && apiRef.current) apiRef.current.morph('face');
    });
    ro.observe(wrap);
    if (reduced) {
      drawStatic();
    } else {
      wrap.addEventListener('mousemove', onMove, { passive: true });
      wrap.addEventListener('mouseleave', onLeave);
      wrap.addEventListener('touchstart', onTouch, { passive: true });
      wrap.addEventListener('touchmove', onTouch, { passive: true });
      document.addEventListener('visibilitychange', onVis);
      raf = requestAnimationFrame(loop);
    }

    function onVis() {
      if (reduced) return;
      if (document.hidden) {
        cancelAnimationFrame(raf);
        raf = 0;
        frame.last = 0;
      } else if (!raf) {
        raf = requestAnimationFrame(loop);
      }
    }

    return () => {
      ro.disconnect();
      cancelAnimationFrame(raf);
      clearTimeout(onTouch.t);
      document.removeEventListener('visibilitychange', onVis);
      wrap.removeEventListener('mousemove', onMove);
      wrap.removeEventListener('mouseleave', onLeave);
      wrap.removeEventListener('touchstart', onTouch);
      wrap.removeEventListener('touchmove', onTouch);
      apiRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reduced]);

  return (
    <div className="face-wrap">
      <div
        ref={wrapRef}
        role="img"
        aria-label="ascii canvas showing a portrait"
        style={{ position: 'absolute', inset: 0 }}
      >
        <canvas ref={canvasRef} aria-hidden />
      </div>
    </div>
  );
}
