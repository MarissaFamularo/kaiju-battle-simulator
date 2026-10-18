import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { makePanelTexture } from '../world/textures.js';
import { mergeStatic } from '../util/merge.js';

let panelTex = null;
const geoCache = new Map();
function rbox(w, h, d, r = 0.8) {
  const k = `${w}|${h}|${d}|${r}`;
  if (!geoCache.has(k)) geoCache.set(k, new RoundedBoxGeometry(w, h, d, 2, Math.min(r, w / 2, h / 2, d / 2)));
  return geoCache.get(k);
}

// Builds the Jaeger model. Local +Z is forward, feet at y=0.
// Returns { root, j (joints), mats, blades: {left, right}, muzzle: {left,right}, cockpit }
export function buildMech(cfg) {
  if (!panelTex) { panelTex = makePanelTexture(); panelTex.repeat.set(0.15, 0.15); }
  const mats = {
    primary: new THREE.MeshStandardMaterial({ color: cfg.primary, metalness: 0.55, roughness: 0.42, bumpMap: panelTex, bumpScale: 1.2 }),
    accent: new THREE.MeshStandardMaterial({ color: cfg.accent, metalness: 0.6, roughness: 0.38 }),
    dark: new THREE.MeshStandardMaterial({ color: '#2a2d33', metalness: 0.75, roughness: 0.45 }),
    glow: new THREE.MeshStandardMaterial({ color: '#000000', emissive: cfg.glow, emissiveIntensity: 4 }),
    blade: new THREE.MeshStandardMaterial({ color: '#ffffff', emissive: cfg.glow, emissiveIntensity: 5, transparent: true, opacity: 0.95 }),
  };
  // world-scale panel UVs look better on big parts
  const M = (geo, mat, x = 0, y = 0, z = 0) => {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    m.castShadow = true; m.receiveShadow = true;
    return m;
  };
  const root = new THREE.Group();
  const j = {};

  // ---- hips & legs ----
  j.hips = new THREE.Group(); j.hips.position.y = 27; root.add(j.hips);
  j.hips.add(M(rbox(16, 6, 10, 1.5), mats.dark, 0, 0, 0));
  j.hips.add(M(rbox(10, 5, 4, 1), mats.primary, 0, -1, 5.5));
  j.hips.add(M(rbox(8, 4, 3, 1), mats.accent, 0, -1, -5.5));

  for (const side of [1, -1]) {
    const leg = new THREE.Group(); leg.position.set(side * 6.5, -1, 0);
    j.hips.add(leg);
    leg.add(M(new THREE.SphereGeometry(3.4, 16, 12), mats.dark));
    leg.add(M(rbox(6.5, 13, 7.5, 1.5), mats.primary, 0, -7, 0));
    leg.add(M(rbox(7, 4, 2, 0.8), mats.accent, side * 0.3, -5, 3.8));
    // piston
    leg.add(M(new THREE.CylinderGeometry(0.7, 0.7, 10, 8), mats.dark, side * 3.6, -7, -2));
    const knee = new THREE.Group(); knee.position.y = -13.5;
    leg.add(knee);
    knee.add(M(new THREE.SphereGeometry(3, 14, 10), mats.dark));
    knee.add(M(rbox(6, 6, 3, 1.2), mats.accent, 0, 0.5, 3.2));
    knee.add(M(rbox(6, 12, 7, 1.5), mats.primary, 0, -6.5, -0.5));
    knee.add(M(rbox(6.4, 7, 2.6, 1), mats.dark, 0, -8, 3));
    const ankle = new THREE.Group(); ankle.position.y = -12.5;
    knee.add(ankle);
    ankle.add(M(rbox(7, 2.4, 13, 1), mats.dark, 0, -0.2, 1.5));
    ankle.add(M(rbox(6, 2, 5, 0.9), mats.accent, 0, 1.2, 5.5));
    ankle.add(M(rbox(5, 1.5, 4, 0.6), mats.primary, 0, 1.3, -3.5));
    j[side > 0 ? 'legL' : 'legR'] = leg;
    j[side > 0 ? 'kneeL' : 'kneeR'] = knee;
    j[side > 0 ? 'ankleL' : 'ankleR'] = ankle;
  }

  // ---- torso ----
  j.torso = new THREE.Group(); j.torso.position.y = 2; j.hips.add(j.torso);
  j.torso.add(M(rbox(10, 6, 8, 1.5), mats.dark, 0, 3, 0)); // waist
  j.chest = new THREE.Group(); j.chest.position.y = 6; j.torso.add(j.chest);
  j.chest.add(M(rbox(22, 14, 13, 2.5), mats.primary, 0, 7, 0));
  j.chest.add(M(rbox(16, 6, 3, 1.5), mats.accent, 0, 11, 6.2));
  j.chest.add(M(rbox(9, 5, 2, 1), mats.dark, -6, 3, 6.5));
  j.chest.add(M(rbox(9, 5, 2, 1), mats.dark, 6, 3, 6.5));
  // chest reactor core
  const coreRing = M(new THREE.TorusGeometry(3.2, 0.7, 10, 28), mats.dark, 0, 6, 6.8);
  const core = M(new THREE.CircleGeometry(3, 28), mats.glow, 0, 6, 6.9);
  j.chest.add(coreRing, core);
  j.core = core;
  // back vents / thrusters
  for (const s of [-1, 1]) {
    j.chest.add(M(rbox(5, 10, 4, 1), mats.dark, s * 5, 8, -7.5));
    const vent = M(new THREE.CircleGeometry(1.6, 16), mats.glow, s * 5, 4, -9.6);
    vent.rotation.y = Math.PI;
    j.chest.add(vent);
  }

  // ---- head ----
  j.head = new THREE.Group(); j.head.position.set(0, 15, 1.5); j.chest.add(j.head);
  j.head.add(M(rbox(6, 3, 6, 1), mats.dark, 0, 0.5, 0)); // neck
  if (cfg.head === 'dome') {
    j.head.add(M(new THREE.SphereGeometry(4.6, 20, 14, 0, Math.PI * 2, 0, Math.PI * 0.62), mats.primary, 0, 3, 0));
    const vis = M(new THREE.TorusGeometry(4.3, 0.7, 8, 24, Math.PI * 0.9), mats.glow, 0, 4, 0.2);
    vis.rotation.set(0, 0, Math.PI * 0.05 + Math.PI);
    vis.rotation.x = Math.PI / 2 - 0.25; vis.rotation.z = Math.PI * 0.05;
    vis.position.set(0, 4.2, 0.4);
    j.head.add(vis);
    j.head.add(M(rbox(9.5, 1.2, 8, 0.5), mats.accent, 0, 2.6, 0));
  } else if (cfg.head === 'crest') {
    j.head.add(M(rbox(7, 6, 7, 1.6), mats.primary, 0, 4.5, 0));
    j.head.add(M(rbox(1.4, 8, 9, 0.6), mats.accent, 0, 8, -1));
    j.head.add(M(rbox(5.5, 1.1, 1, 0.4), mats.glow, -0.0, 5.2, 3.6));
    for (const s of [-1, 1]) {
      const fin = M(rbox(1, 5, 6, 0.4), mats.accent, s * 4.2, 6, -1);
      fin.rotation.z = s * 0.4;
      j.head.add(fin);
    }
  } else {
    j.head.add(M(rbox(8, 5.5, 7, 1.8), mats.primary, 0, 4.2, 0));
    j.head.add(M(rbox(7, 1.6, 1.2, 0.5), mats.glow, 0, 4.6, 3.5));
    j.head.add(M(rbox(9, 1.4, 6, 0.6), mats.accent, 0, 7, -0.5));
  }
  j.cockpit = new THREE.Object3D(); j.cockpit.position.set(0, 4, 0); j.head.add(j.cockpit);

  // ---- arms ----
  const blades = {}, muzzle = {}, weapons = {};
  for (const side of [1, -1]) {
    const key = side > 0 ? 'L' : 'R';
    const wid = side > 0 ? cfg.left : cfg.right;
    const sh = new THREE.Group(); sh.position.set(side * 14.5, 10, 0);
    j.chest.add(sh);
    sh.add(M(new THREE.SphereGeometry(3.8, 16, 12), mats.dark));
    const pad = M(rbox(9.5, 6, 11, 2), mats.accent, side * 1.6, 2.6, 0);
    pad.rotation.z = side * -0.25;
    sh.add(pad);
    const padTop = M(rbox(9, 1.6, 11.5, 0.6), mats.primary, side * 2.4, 5.2, 0);
    padTop.rotation.z = side * -0.25;
    sh.add(padTop);
    sh.add(M(rbox(5.5, 11, 5.5, 1.3), mats.primary, side * 0.6, -6.5, 0));
    const el = new THREE.Group(); el.position.set(side * 0.6, -12.5, 0);
    sh.add(el);
    el.add(M(new THREE.SphereGeometry(2.6, 12, 10), mats.dark));
    // forearm housing (bigger, Pacific Rim style)
    el.add(M(rbox(6.8, 12, 7.2, 1.6), mats.primary, 0, -6.5, 0));
    el.add(M(rbox(7.2, 3, 7.6, 1), mats.accent, 0, -2.5, 0));
    const stripe = M(rbox(0.6, 7, 1, 0.25), mats.glow, side * 3.5, -7, 2.5);
    el.add(stripe);
    const hand = new THREE.Group(); hand.position.y = -13;
    el.add(hand);
    weapons[key] = wid;
    if (wid === 'cannon') {
      const barrel = M(new THREE.CylinderGeometry(2.4, 3, 9, 16), mats.dark, 0, -3.5, 0);
      hand.add(barrel);
      hand.add(M(new THREE.CylinderGeometry(3.2, 3.2, 2, 16), mats.accent, 0, -1, 0));
      const ring = M(new THREE.TorusGeometry(1.7, 0.45, 8, 20), mats.glow, 0, -8.1, 0);
      ring.rotation.x = Math.PI / 2;
      hand.add(ring);
      const mz = new THREE.Object3D(); mz.position.y = -9; hand.add(mz);
      muzzle[key] = mz;
    } else {
      const fistScale = wid === 'fist' ? 1.55 : 1;
      const fist = M(rbox(5.2 * fistScale, 5.4 * fistScale, 5.6 * fistScale, 1.4), wid === 'fist' ? mats.accent : mats.dark, 0, -2.6 * fistScale, 0.4);
      hand.add(fist);
      if (wid === 'fist') {
        for (const s of [-1, 1]) hand.add(M(new THREE.CylinderGeometry(0.8, 0.8, 9, 8), mats.dark, s * 3.2, 3, -3.4));
        hand.add(M(rbox(6, 1.2, 1.2, 0.4), mats.glow, 0, -4, 4.8));
      } else {
        hand.add(M(rbox(5.4, 1.5, 1.2, 0.4), mats.primary, 0, -1.5, 3.3));
      }
      if (wid === 'sword' || wid === 'blades') {
        const bladeGroup = new THREE.Group();
        bladeGroup.position.set(0, 1, wid === 'sword' ? 0 : 3.6);
        el.add(bladeGroup); // blades emerge from the forearm, past the hand
        bladeGroup.position.set(side * 0, -4, 4.2);
        const list = [];
        const mk = (len, w, x) => {
          const g = new THREE.Group();
          g.position.x = x;
          const geo = new THREE.BoxGeometry(w, len, 0.9).translate(0, -len / 2, 0);
          const blade = new THREE.Mesh(geo, mats.blade);
          const tip = new THREE.Mesh(new THREE.ConeGeometry(w * 0.7, 4, 4).rotateX(Math.PI).translate(0, -len - 2, 0), mats.blade);
          tip.scale.z = 0.3;
          g.add(blade, tip);
          bladeGroup.add(g);
          list.push(g);
        };
        if (wid === 'sword') mk(34, 3.4, 0);
        else { mk(17, 1.6, -1.6); mk(17, 1.6, 1.6); }
        bladeGroup.userData.list = list;
        bladeGroup.scale.y = 0.02;
        bladeGroup.visible = false;
        blades[key] = bladeGroup;
      }
      const mz = new THREE.Object3D(); mz.position.y = -6; hand.add(mz);
      muzzle[key] = mz;
    }
    j['shoulder' + key] = sh;
    j['elbow' + key] = el;
    j['hand' + key] = hand;
  }

  // Cockpit glow light for nice rim
  mergeStatic(root);
  root.traverse((o) => { if (o.isMesh) o.userData.mech = true; });
  return { root, j, mats, blades, muzzle, weapons };
}
