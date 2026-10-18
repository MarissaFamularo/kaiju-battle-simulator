import * as THREE from 'three';
import { makeScaleBump } from '../world/textures.js';
import { mergeStatic } from '../util/merge.js';

let bump = null;
const SKINS = [
  ['#4a6048', '#8d9a6a'], ['#5a4462', '#a98a98'], ['#3f5266', '#8aa0b0'], ['#664a3c', '#b8946a'],
  ['#4a4e54', '#8a8e94'], ['#62542e', '#b09a5a'], ['#2f5a58', '#7ab0a2'], ['#6a3838', '#c07a62'],
];
const GLOWS = ['#22d8ff', '#36ffb0', '#ff8a1a', '#c04bff', '#2affea', '#ffe03a'];

function rnd(a, b) { return a + Math.random() * (b - a); }
function pick(a) { return a[Math.floor(Math.random() * a.length)]; }

// Ellipsoid helper: unit sphere scaled.
const sphereGeo = new THREE.SphereGeometry(1, 20, 14);
const lowSphere = new THREE.SphereGeometry(1, 12, 8);
const coneGeo = new THREE.ConeGeometry(1, 1, 6).translate(0, 0.5, 0);

export function buildKaiju(type) {
  if (!bump) bump = makeScaleBump(5);
  const [skinCol, bellyCol] = pick(SKINS);
  const glowCol = pick(GLOWS);
  const mats = {
    skin: new THREE.MeshStandardMaterial({ color: skinCol, roughness: 0.62, metalness: 0.12, bumpMap: bump, bumpScale: 2, emissive: skinCol, emissiveIntensity: 0.12 }),
    belly: new THREE.MeshStandardMaterial({ color: bellyCol, roughness: 0.8, bumpMap: bump, bumpScale: 1 }),
    spike: new THREE.MeshStandardMaterial({ color: '#1a1714', roughness: 0.5, metalness: 0.2 }),
    tooth: new THREE.MeshStandardMaterial({ color: '#e8e0c8', roughness: 0.4 }),
    glow: new THREE.MeshStandardMaterial({ color: '#000', emissive: glowCol, emissiveIntensity: 3 }),
    weak: new THREE.MeshStandardMaterial({ color: '#0a2a3a', emissive: '#29c8ff', emissiveIntensity: 4, roughness: 0.2, transparent: true, opacity: 0.92 }),
    mouth: new THREE.MeshStandardMaterial({ color: '#3a0a10', emissive: glowCol, emissiveIntensity: 0.6, roughness: 0.6 }),
  };
  const E = (mat, sx, sy, sz, x = 0, y = 0, z = 0, low = false) => {
    const m = new THREE.Mesh(low ? lowSphere : sphereGeo, mat);
    m.scale.set(sx, sy, sz); m.position.set(x, y, z);
    m.castShadow = true; m.receiveShadow = true;
    return m;
  };
  const C = (mat, r, h, x, y, z, rx = 0, rz = 0) => {
    const m = new THREE.Mesh(coneGeo, mat);
    m.scale.set(r, h, r); m.position.set(x, y, z); m.rotation.set(rx, 0, rz);
    m.castShadow = true;
    return m;
  };
  const root = new THREE.Group();
  const j = { legs: [], arms: [], tail: [], neck: [] };
  const hit = []; // {obj, r, weak, name}
  const weakCandidates = {};

  const addSpikes = (parent, n, from, to, size, tilt = -0.3) => {
    for (let i = 0; i < n; i++) {
      const t = i / Math.max(1, n - 1);
      const p = from.clone().lerp(to, t);
      const s = size * (0.6 + Math.sin(t * Math.PI) * 0.6);
      parent.add(C(mats.spike, s * 0.35, s, p.x, p.y, p.z, tilt));
    }
  };

  const makeHead = (parent, scale, hammer = false) => {
    const head = new THREE.Group();
    parent.add(head);
    if (hammer) {
      head.add(E(mats.skin, 16 * scale, 4.2 * scale, 6 * scale, 0, 1 * scale, 3 * scale));
      head.add(E(mats.skin, 6 * scale, 5 * scale, 8 * scale, 0, 0, 4 * scale));
      for (const s of [-1, 1]) head.add(E(mats.glow, 1.6 * scale, 1.6 * scale, 1.6 * scale, s * 15 * scale, 1.5 * scale, 4 * scale, true));
    } else {
      head.add(E(mats.skin, 6 * scale, 5 * scale, 9 * scale, 0, 1 * scale, 5 * scale));
      head.add(E(mats.skin, 5 * scale, 3 * scale, 6 * scale, 0, 0.5 * scale, 11 * scale)); // snout
      for (const s of [-1, 1]) {
        head.add(E(mats.glow, 1.1 * scale, 0.8 * scale, 1.1 * scale, s * 4 * scale, 2.6 * scale, 9.5 * scale, true));
        if (Math.random() < 0.7) head.add(C(mats.spike, 1.2 * scale, rnd(5, 10) * scale, s * 4 * scale, 4 * scale, 2 * scale, -0.9, s * -0.5));
      }
    }
    // jaw
    const jaw = new THREE.Group();
    jaw.position.set(0, -1.5 * scale, 2 * scale);
    head.add(jaw);
    jaw.add(E(mats.belly, 4.5 * scale, 1.8 * scale, 8.5 * scale, 0, -1 * scale, 6 * scale));
    jaw.add(E(mats.mouth, 3.6 * scale, 0.6 * scale, 7 * scale, 0, 0.3 * scale, 6 * scale, true));
    for (let i = 0; i < 6; i++) {
      for (const s of [-1, 1]) {
        jaw.add(C(mats.tooth, 0.5 * scale, 1.8 * scale, s * 3 * scale, 0.3 * scale, (3 + i * 1.6) * scale));
        head.add(C(mats.tooth, 0.5 * scale, 1.8 * scale, s * 3.3 * scale, -1 * scale, (5 + i * 1.6) * scale, Math.PI));
      }
    }
    j.head = head; j.jaw = jaw;
    return head;
  };

  const makeTail = (parent, segs, r0, len, scale) => {
    let p = parent;
    for (let i = 0; i < segs; i++) {
      const g = new THREE.Group();
      g.position.z = i === 0 ? 0 : -len * scale;
      p.add(g);
      const r = r0 * (1 - i / (segs + 1)) * scale;
      g.add(E(mats.skin, r, r * 0.9, len * 0.65 * scale, 0, 0, -len * 0.5 * scale));
      g.add(C(mats.spike, r * 0.35, r * 1.3, 0, r * 0.7, -len * 0.4 * scale, -0.5));
      j.tail.push(g);
      if (i < 3) hit.push({ obj: g, r: r * 1.2, off: new THREE.Vector3(0, 0, -len * 0.5 * scale), weak: false, name: 'tail' });
      p = g;
    }
    return j.tail[0];
  };

  let radius, height, footY = 0;

  if (type === 'brute') {
    const s = 1;
    j.hips = new THREE.Group(); j.hips.position.y = 24; root.add(j.hips);
    j.hips.add(E(mats.skin, 10, 9, 11));
    for (const side of [1, -1]) {
      const hip = new THREE.Group(); hip.position.set(side * 7.5, -1, 0); j.hips.add(hip);
      hip.add(E(mats.skin, 5, 7.5, 5.5, 0, -5, 1));
      const knee = new THREE.Group(); knee.position.set(0, -11, 2.5); hip.add(knee);
      knee.add(E(mats.skin, 3.6, 7, 3.8, 0, -5, -1.5));
      const ankle = new THREE.Group(); ankle.position.set(0, -11, -2.5); knee.add(ankle);
      ankle.add(E(mats.skin, 4.5, 2, 7, 0, -0.5, 3));
      for (const t of [-1.6, 0, 1.6]) ankle.add(C(mats.spike, 0.8, 3.5, t, -1, 9, Math.PI / 2));
      j.legs.push({ hip, knee, ankle, off: side > 0 ? 0 : Math.PI, baseHip: -0.3, baseKnee: 0.55 });
    }
    j.torso = new THREE.Group(); j.torso.position.set(0, 3, 1); j.torso.rotation.x = 0.35; j.hips.add(j.torso);
    j.torso.add(E(mats.skin, 12, 15, 11, 0, 12, 0));
    j.torso.add(E(mats.belly, 9, 12, 5, 0, 10, 7));
    j.torso.add(E(mats.skin, 14, 7, 10, 0, 22, 0)); // shoulders
    addSpikes(j.torso, 7, new THREE.Vector3(0, 28, -6), new THREE.Vector3(0, 2, -11), 9);
    // glowing stripes
    for (const sd of [-1, 1]) j.torso.add(E(mats.glow, 0.7, 9, 0.7, sd * 6, 14, -9.3, true));
    const neck = new THREE.Group(); neck.position.set(0, 26, 6); j.torso.add(neck);
    neck.add(E(mats.skin, 6, 6, 7, 0, 0, 1));
    j.neck.push(neck);
    const head = makeHead(neck, 1);
    head.position.set(0, 2, 4);
    head.rotation.x = -0.35;
    for (const side of [1, -1]) {
      const sh = new THREE.Group(); sh.position.set(side * 13, 20, 3); j.torso.add(sh);
      sh.add(E(mats.skin, 4, 8, 4, side * 1, -6, 0));
      const el = new THREE.Group(); el.position.set(side * 1, -13, 0); sh.add(el);
      el.add(E(mats.skin, 3, 7, 3, 0, -6, 1));
      const hand = new THREE.Group(); hand.position.set(0, -13, 2); el.add(hand);
      for (const t of [-1.6, 0, 1.6]) hand.add(C(mats.tooth, 0.8, 6, t, 0, 0, Math.PI * 0.8));
      sh.rotation.x = -0.6; el.rotation.x = -0.7;
      j.arms.push({ sh, el, hand, side, baseSh: -0.6, baseEl: -0.7 });
    }
    makeTail(j.hips, 7, 7.5, 9, s).position.set(0, 0, -8);
    hit.push({ obj: j.hips, r: 11, weak: false, name: 'hips' });
    hit.push({ obj: j.torso, r: 13, off: new THREE.Vector3(0, 12, 0), weak: false, name: 'body' });
    hit.push({ obj: j.torso, r: 12, off: new THREE.Vector3(0, 22, 0), weak: false, name: 'shoulders' });
    hit.push({ obj: head, r: 8, off: new THREE.Vector3(0, 0, 6), weak: false, name: 'head' });
    for (const lg of j.legs) hit.push({ obj: lg.knee, r: 5, off: new THREE.Vector3(0, -4, 0), weak: false, name: 'leg' });
    weakCandidates.chest = { obj: j.torso, pos: new THREE.Vector3(0, 14, 10.5), label: 'CHEST' };
    weakCandidates.back = { obj: j.torso, pos: new THREE.Vector3(0, 17, -10.5), label: 'BACK' };
    weakCandidates.throat = { obj: neck, pos: new THREE.Vector3(0, -4, 5), label: 'THROAT' };
    weakCandidates.tail = { obj: j.tail[1], pos: new THREE.Vector3(0, 5, -4), label: 'TAIL' };
    radius = 14; height = 62;
  } else if (type === 'stalker') {
    j.hips = new THREE.Group(); j.hips.position.y = 24; root.add(j.hips);
    j.torso = j.hips;
    j.hips.add(E(mats.skin, 12, 10, 25, 0, 0, 0));
    j.hips.add(E(mats.belly, 9, 6, 20, 0, -5, 2));
    addSpikes(j.hips, 9, new THREE.Vector3(0, 10, 18), new THREE.Vector3(0, 9, -20), 10, -0.6);
    for (const sd of [-1, 1]) j.hips.add(E(mats.glow, 0.6, 0.6, 18, sd * 10.5, 2, 0, true));
    const legPos = [[1, 16, 0], [-1, 16, Math.PI], [1, -16, Math.PI], [-1, -16, 0]];
    for (const [side, z, off] of legPos) {
      const hip = new THREE.Group(); hip.position.set(side * 10, -2, z); j.hips.add(hip);
      hip.add(E(mats.skin, 4.5, 7, 5, side * 1.5, -5, 0));
      hip.rotation.z = side * 0.15;
      const knee = new THREE.Group(); knee.position.set(side * 2, -11, 0); hip.add(knee);
      knee.add(E(mats.skin, 3.2, 6.5, 3.5, 0, -5, 0));
      const ankle = new THREE.Group(); ankle.position.set(0, -11, 0); knee.add(ankle);
      ankle.add(E(mats.skin, 4, 1.8, 5.5, 0, 0, 2));
      for (const t of [-1.4, 0, 1.4]) ankle.add(C(mats.spike, 0.7, 3, t, -0.5, 6.5, Math.PI / 2));
      j.legs.push({ hip, knee, ankle, off, baseHip: z > 0 ? -0.15 : 0.15, baseKnee: z > 0 ? 0.3 : -0.3, side });
    }
    let p = j.hips, prev = new THREE.Vector3(0, 4, 22);
    for (let i = 0; i < 3; i++) {
      const n = new THREE.Group(); n.position.copy(i === 0 ? prev : new THREE.Vector3(0, 0, 8));
      n.rotation.x = i === 0 ? -0.5 : 0.15;
      p.add(n);
      n.add(E(mats.skin, 5 - i * 0.6, 5 - i * 0.6, 6, 0, 0, 4));
      n.add(C(mats.spike, 1.2, 5, 0, 4, 3, -0.5));
      j.neck.push(n);
      p = n;
    }
    const head = makeHead(p, 1.05);
    head.position.set(0, 0, 8);
    head.rotation.x = 0.6;
    // crest horns
    head.add(C(mats.spike, 2, 14, 0, 4, 0, -1.2));
    makeTail(j.hips, 8, 7, 9, 1).position.set(0, 2, -22);
    hit.push({ obj: j.hips, r: 13, off: new THREE.Vector3(0, 0, 12), weak: false, name: 'body' });
    hit.push({ obj: j.hips, r: 13, off: new THREE.Vector3(0, 0, -10), weak: false, name: 'body' });
    hit.push({ obj: j.neck[1], r: 6, off: new THREE.Vector3(0, 0, 4), weak: false, name: 'neck' });
    hit.push({ obj: head, r: 8, off: new THREE.Vector3(0, 0, 6), weak: false, name: 'head' });
    weakCandidates.back = { obj: j.hips, pos: new THREE.Vector3(0, 10.5, -4), label: 'BACK' };
    weakCandidates.neck = { obj: j.neck[1], pos: new THREE.Vector3(0, -4, 4), label: 'NECK' };
    weakCandidates.side = { obj: j.hips, pos: new THREE.Vector3(Math.random() < 0.5 ? 11.5 : -11.5, 0, 6), label: 'SIDE' };
    weakCandidates.tail = { obj: j.tail[1], pos: new THREE.Vector3(0, 5, -4), label: 'TAIL' };
    radius = 16; height = 48;
  } else {
    // hammerhead: long-armed knuckle walker
    j.hips = new THREE.Group(); j.hips.position.y = 20; root.add(j.hips);
    j.hips.add(E(mats.skin, 10, 8, 9));
    for (const side of [1, -1]) {
      const hip = new THREE.Group(); hip.position.set(side * 7, -1, 0); j.hips.add(hip);
      hip.add(E(mats.skin, 4.5, 6, 4.8, 0, -4.5, 0.5));
      const knee = new THREE.Group(); knee.position.set(0, -9, 2); hip.add(knee);
      knee.add(E(mats.skin, 3.6, 5.5, 3.8, 0, -4, -1));
      const ankle = new THREE.Group(); ankle.position.set(0, -9, -1.5); knee.add(ankle);
      ankle.add(E(mats.skin, 4.5, 2, 6.5, 0, -0.5, 2));
      j.legs.push({ hip, knee, ankle, off: side > 0 ? 0 : Math.PI, baseHip: -0.2, baseKnee: 0.4 });
    }
    j.torso = new THREE.Group(); j.torso.position.set(0, 3, 0); j.torso.rotation.x = 0.7; j.hips.add(j.torso);
    j.torso.add(E(mats.skin, 13, 14, 11, 0, 12, 0));
    j.torso.add(E(mats.belly, 10, 10, 5, 0, 11, 7));
    j.torso.add(E(mats.skin, 19, 8, 11, 0, 22, -1));
    addSpikes(j.torso, 5, new THREE.Vector3(-8, 27, -6), new THREE.Vector3(8, 27, -6), 7, -0.2);
    for (const sd of [-1, 1]) j.torso.add(E(mats.glow, 4, 0.6, 0.6, sd * 6, 18, -10.5, true));
    const neck = new THREE.Group(); neck.position.set(0, 26, 7); neck.rotation.x = -0.5; j.torso.add(neck);
    neck.add(E(mats.skin, 6, 5, 6, 0, 0, 1));
    j.neck.push(neck);
    const head = makeHead(neck, 1, true);
    head.position.set(0, 1, 3);
    for (const side of [1, -1]) {
      const sh = new THREE.Group(); sh.position.set(side * 18, 22, 1); j.torso.add(sh);
      sh.add(E(mats.skin, 6, 11, 6, side * 1, -9, 0));
      const el = new THREE.Group(); el.position.set(side * 1, -19, 0); sh.add(el);
      el.add(E(mats.skin, 5, 10, 5, 0, -8, 0));
      const hand = new THREE.Group(); hand.position.set(0, -17, 0); el.add(hand);
      hand.add(E(mats.skin, 5.5, 4, 6, 0, -1, 1));
      for (const t of [-2, 0, 2]) hand.add(C(mats.tooth, 0.9, 5, t, -2, 5, Math.PI * 0.6));
      sh.rotation.x = -0.25; el.rotation.x = -0.35;
      j.arms.push({ sh, el, hand, side, baseSh: -0.25, baseEl: -0.35, walker: true });
    }
    makeTail(j.hips, 4, 6, 7, 1).position.set(0, 0, -7);
    hit.push({ obj: j.hips, r: 10, weak: false, name: 'hips' });
    hit.push({ obj: j.torso, r: 14, off: new THREE.Vector3(0, 12, 0), weak: false, name: 'body' });
    hit.push({ obj: j.torso, r: 14, off: new THREE.Vector3(0, 22, 0), weak: false, name: 'shoulders' });
    hit.push({ obj: head, r: 10, off: new THREE.Vector3(0, 1, 3), weak: false, name: 'head' });
    for (const a of j.arms) hit.push({ obj: a.el, r: 6, off: new THREE.Vector3(0, -8, 0), weak: false, name: 'arm' });
    weakCandidates.chest = { obj: j.torso, pos: new THREE.Vector3(0, 13, 11), label: 'CHEST' };
    weakCandidates.back = { obj: j.torso, pos: new THREE.Vector3(0, 20, -11.5), label: 'BACK' };
    weakCandidates.head = { obj: head, pos: new THREE.Vector3(0, 5.5, 2), label: 'HEAD' };
    radius = 16; height = 55;
  }

  // Pick 1-2 weak spots
  const keys = Object.keys(weakCandidates).sort(() => Math.random() - 0.5);
  const nWeak = Math.random() < 0.35 ? 2 : 1;
  const weakSpots = [];
  for (let i = 0; i < nWeak; i++) {
    const wc = weakCandidates[keys[i]];
    const sac = new THREE.Group();
    sac.position.copy(wc.pos);
    wc.obj.add(sac);
    const core = new THREE.Mesh(sphereGeo, mats.weak);
    core.scale.set(4.2, 4.2, 3.2);
    sac.add(core);
    // veiny ring
    const ring = new THREE.Mesh(new THREE.TorusGeometry(4.6, 0.8, 8, 20), mats.skin);
    sac.add(ring);
    // face the ring outward from the body part's center
    const out = wc.pos.clone().normalize();
    sac.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), out);
    weakSpots.push({ obj: sac, label: wc.label, key: keys[i] });
    hit.push({ obj: sac, r: 6.5, off: new THREE.Vector3(), weak: true, name: wc.label });
  }

  mergeStatic(root);
  root.traverse((o) => { if (o.isMesh) { o.castShadow = true; } });
  return { root, j, hit, mats, weakSpots, radius, height, glowCol, footY };
}
