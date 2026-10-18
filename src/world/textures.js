import * as THREE from 'three';
import { WORLD } from '../config.js';

function canvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return [c, c.getContext('2d')];
}

function rand(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

// A facade tile covers 16m x 16m: `cols` windows wide, 4 floors tall.
// Returns { map, emissive } textures.
export function makeFacade({ base, frame, glass, cols = 4, style = 'grid', seed = 1, litChance = 0.35 }) {
  const S = 256;
  const r = rand(seed);
  const [c, g] = canvas(S, S);
  const [ce, ge] = canvas(S, S);
  g.fillStyle = base; g.fillRect(0, 0, S, S);
  ge.fillStyle = '#000'; ge.fillRect(0, 0, S, S);
  const floors = 4;
  const fh = S / floors, cw = S / cols;
  for (let f = 0; f < floors; f++) {
    // floor slab line
    g.fillStyle = frame;
    g.fillRect(0, f * fh, S, style === 'glass' ? 3 : 6);
    for (let k = 0; k < cols; k++) {
      let x, y, w, h;
      if (style === 'glass') {
        x = k * cw + 1; y = f * fh + 4; w = cw - 2; h = fh - 5;
      } else if (style === 'band') {
        x = k * cw; y = f * fh + fh * 0.3; w = cw; h = fh * 0.45;
      } else {
        x = k * cw + cw * 0.18; y = f * fh + fh * 0.25; w = cw * 0.64; h = fh * 0.55;
      }
      const lit = r() < litChance;
      const shade = 0.75 + r() * 0.35;
      g.fillStyle = glass;
      g.globalAlpha = shade;
      g.fillRect(x, y, w, h);
      g.globalAlpha = 1;
      // reflection streak
      g.fillStyle = 'rgba(255,255,255,0.08)';
      g.fillRect(x, y, w * 0.35, h);
      if (lit) {
        const warm = r() < 0.75;
        const col = warm ? `hsl(${38 + r() * 12}, 90%, ${60 + r() * 20}%)` : `hsl(${190 + r() * 20}, 70%, ${70 + r() * 15}%)`;
        ge.fillStyle = col;
        ge.globalAlpha = 0.5 + r() * 0.5;
        ge.fillRect(x + 1, y + 1, w - 2, h - 2);
        ge.globalAlpha = 1;
        g.fillStyle = col;
        g.globalAlpha = 0.5;
        g.fillRect(x + 1, y + 1, w - 2, h - 2);
        g.globalAlpha = 1;
      }
      if (style === 'band') continue;
      if (style !== 'glass') {
        g.fillStyle = frame;
        g.fillRect(x - 2, y + h, w + 4, 3); // sill
      }
    }
  }
  if (style === 'glass') {
    g.fillStyle = frame;
    for (let k = 0; k <= cols; k++) g.fillRect(k * cw - 1, 0, 2, S);
  }
  // grime
  for (let i = 0; i < 300; i++) {
    g.fillStyle = `rgba(0,0,0,${r() * 0.06})`;
    g.fillRect(r() * S, r() * S, 2 + r() * 8, 2 + r() * 20);
  }
  const map = new THREE.CanvasTexture(c);
  map.colorSpace = THREE.SRGBColorSpace;
  map.wrapS = map.wrapT = THREE.RepeatWrapping;
  map.anisotropy = 4;
  const emissive = new THREE.CanvasTexture(ce);
  emissive.colorSpace = THREE.SRGBColorSpace;
  emissive.wrapS = emissive.wrapT = THREE.RepeatWrapping;
  return { map, emissive };
}

// One city block: road around the edge, sidewalk, inner lot.
export function makeBlockTexture() {
  const S = 512;
  const [c, g] = canvas(S, S);
  const px = S / WORLD.block;
  const road = WORLD.road * px;
  const half = road / 2;
  // asphalt
  g.fillStyle = '#2a2c31'; g.fillRect(0, 0, S, S);
  for (let i = 0; i < 4000; i++) {
    g.fillStyle = `rgba(${Math.random() < 0.5 ? '255,255,255' : '0,0,0'},${Math.random() * 0.05})`;
    g.fillRect(Math.random() * S, Math.random() * S, 2, 2);
  }
  // sidewalk ring and lot
  const sw = 4 * px;
  g.fillStyle = '#8b8d90';
  g.fillRect(half, half, S - road, S - road);
  g.fillStyle = '#4a4d48';
  g.fillRect(half + sw, half + sw, S - road - 2 * sw, S - road - 2 * sw);
  // lane markings at the tile edges (center of roads)
  g.strokeStyle = '#d8b13a';
  g.lineWidth = 1.5;
  g.setLineDash([]);
  [[1, 0], [S - 1, 0]].forEach(([x]) => {
    g.beginPath(); g.moveTo(x, 0); g.lineTo(x, S); g.stroke();
    g.beginPath(); g.moveTo(0, x); g.lineTo(S, x); g.stroke();
  });
  g.strokeStyle = 'rgba(240,240,240,0.7)';
  g.lineWidth = 1.2;
  g.setLineDash([10, 12]);
  [half / 2, S - half / 2].forEach((x) => {
    g.beginPath(); g.moveTo(x, half); g.lineTo(x, S - half); g.stroke();
    g.beginPath(); g.moveTo(half, x); g.lineTo(S - half, x); g.stroke();
  });
  g.setLineDash([]);
  // crosswalks at corners
  g.fillStyle = 'rgba(235,235,235,0.75)';
  for (const cx of [0, S]) {
    for (const cy of [0, S]) {
      for (let k = 0; k < 6; k++) {
        const o = -half + 4 + k * (road - 8) / 6;
        g.fillRect(cx + o - (cx ? 0 : 0), cy + (cy ? -half - 6 : half), (road - 8) / 12, 6);
        g.fillRect(cx + (cx ? -half - 6 : half), cy + o, 6, (road - 8) / 12);
      }
    }
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 8;
  return t;
}

export function makeNoiseTexture({ size = 256, base = '#333', spots = '#000', count = 1600, seed = 7, scale = 1 } = {}) {
  const r = rand(seed);
  const [c, g] = canvas(size, size);
  g.fillStyle = base; g.fillRect(0, 0, size, size);
  for (let i = 0; i < count; i++) {
    const x = r() * size, y = r() * size, rad = (2 + r() * 10) * scale;
    g.fillStyle = spots;
    g.globalAlpha = 0.08 + r() * 0.25;
    g.beginPath(); g.ellipse(x, y, rad, rad * (0.5 + r()), r() * 3, 0, Math.PI * 2); g.fill();
    // wrap edges so the texture tiles
    if (x < rad || x > size - rad || y < rad || y > size - rad) {
      g.beginPath(); g.ellipse((x + size / 2) % size, (y + size / 2) % size, rad, rad, 0, 0, Math.PI * 2); g.fill();
    }
  }
  g.globalAlpha = 1;
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

// Grayscale bumpy scales for kaiju skin (used as bump map).
export function makeScaleBump(seed = 3) {
  const S = 256, r = rand(seed);
  const [c, g] = canvas(S, S);
  g.fillStyle = '#777'; g.fillRect(0, 0, S, S);
  const n = 16;
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      const cx = (x + (y % 2) * 0.5) * (S / n), cy = y * (S / n);
      const grd = g.createRadialGradient(cx, cy, 1, cx, cy, S / n * 0.7);
      const l = 150 + r() * 80;
      grd.addColorStop(0, `rgb(${l},${l},${l})`);
      grd.addColorStop(1, 'rgb(60,60,60)');
      g.fillStyle = grd;
      g.beginPath(); g.arc(cx, cy, S / n * 0.62, 0, Math.PI * 2); g.fill();
    }
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

// Panel lines for mech armor (bump + slight color variation).
export function makePanelTexture() {
  const S = 256;
  const [c, g] = canvas(S, S);
  g.fillStyle = '#bbb'; g.fillRect(0, 0, S, S);
  g.strokeStyle = '#555';
  g.lineWidth = 2;
  const r = rand(11);
  for (let i = 0; i < 14; i++) {
    const horizontal = r() < 0.5;
    const p = Math.floor(r() * 8) * 32;
    g.beginPath();
    if (horizontal) { g.moveTo(0, p); g.lineTo(S, p); } else { g.moveTo(p, 0); g.lineTo(p, S); }
    g.stroke();
  }
  g.fillStyle = '#666';
  for (let i = 0; i < 40; i++) { g.beginPath(); g.arc(r() * S, r() * S, 2, 0, Math.PI * 2); g.fill(); }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

export function makeGlowSprite(color = '#ffffff') {
  const S = 128;
  const [c, g] = canvas(S, S);
  const grd = g.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
  grd.addColorStop(0, color);
  grd.addColorStop(0.3, color);
  grd.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = grd;
  g.fillRect(0, 0, S, S);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
