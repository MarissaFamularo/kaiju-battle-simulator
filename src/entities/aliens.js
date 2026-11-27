import * as THREE from 'three';
import { audio } from '../audio.js';
import { segPointDist } from './projectiles.js';

// Capsules and the little black aliens inside them (docs/chapter-2-design.md).
// A tripod that spots you lobs a capsule at your Jaeger. Little aliens hop out,
// climb the Jaeger and drain its armor by throwing pieces off. The only way to
// get them off is to get out (F) and shoot them with the pilot's blaster.
// Kept friendly on purpose: round, big-eyed, and they just go "splat".

const DRAIN = 3.5;       // armor per second, per alien that is on the Jaeger
const ALIEN_R = 2.3;
const GOO = new THREE.Color('#4dff9a');

let shared = null;
function assets() {
  if (shared) return shared;
  shared = {
    black: new THREE.MeshStandardMaterial({ color: '#0d0d12', roughness: 0.35, metalness: 0.2 }),
    eye: new THREE.MeshStandardMaterial({ color: '#000', emissive: '#aef6ff', emissiveIntensity: 3.5 }),
    pod: new THREE.MeshStandardMaterial({ color: '#2b2f38', metalness: 0.8, roughness: 0.4 }),
    podGlow: new THREE.MeshStandardMaterial({ color: '#000', emissive: '#ff3020', emissiveIntensity: 3 }),
    body: new THREE.SphereGeometry(ALIEN_R, 14, 10),
    eyeGeo: new THREE.SphereGeometry(0.62, 10, 8),
    leg: new THREE.CylinderGeometry(0.28, 0.2, 1.8, 6),
    podBody: new THREE.CapsuleGeometry(3.4, 5, 6, 12),
    podBand: new THREE.TorusGeometry(3.5, 0.5, 6, 20),
  };
  return shared;
}

function makeAlien() {
  const A = assets();
  const g = new THREE.Group();
  const body = new THREE.Mesh(A.body, A.black);
  body.scale.y = 0.85; body.position.y = ALIEN_R * 0.9; body.castShadow = true;
  g.add(body);
  for (const s of [-1, 1]) {
    const e = new THREE.Mesh(A.eyeGeo, A.eye);
    e.position.set(s * 0.95, ALIEN_R * 1.15, ALIEN_R * 0.78);
    g.add(e);
  }
  const legs = [];
  for (let i = 0; i < 4; i++) {
    const l = new THREE.Mesh(A.leg, A.black);
    l.position.set((i % 2 ? 1 : -1) * 1.5, 0.6, (i < 2 ? 1 : -1) * 1.1);
    g.add(l); legs.push(l);
  }
  return { g, legs };
}

export class Aliens {
  constructor(game) {
    this.game = game;
    this.list = [];
    this.capsules = [];
    this.warnT = 0;
    this.hinting = false;
  }

  // ---- capsule ----
  launchCapsule(from, mech) {
    const A = assets();
    const g = new THREE.Group();
    g.add(new THREE.Mesh(A.podBody, A.pod));
    const band = new THREE.Mesh(A.podBand, A.podGlow); band.rotation.x = Math.PI / 2; g.add(band);
    this.game.scene.add(g);
    const a = Math.random() * Math.PI * 2;
    const to = new THREE.Vector3(mech.pos.x + Math.cos(a) * 42, 0, mech.pos.z + Math.sin(a) * 42).addScaledVector(mech.vel, 1.2);
    const T = 2.0, G = 60;
    const vel = to.clone().sub(from).divideScalar(T);
    vel.y = (to.y - from.y + 0.5 * G * T * T) / T;
    this.capsules.push({ g, pos: from.clone(), vel, G, landed: false, t: 0, spawn: 3, mech });
    audio.play('missile', from, 1);
    this.game.nav.say('capsule', 'It launched a capsule at you! Little aliens are inside. They will try to climb your Jaeger!', 3, 20);
  }

  count() { return this.list.filter((a) => a.state === 'run' || a.state === 'on').length; }
  onMech() { return this.list.filter((a) => a.state === 'on').length; }

  // ---- hits from the pilot's blaster ----
  hitSeg(a, b, radius) {
    for (const al of this.list) {
      if (al.state !== 'run' && al.state !== 'on') continue;
      if (segPointDist(a, b, al.center).d < ALIEN_R + 1.6 + radius) return al;
    }
    return null;
  }

  hit(al, point) {
    const g = this.game;
    al.hp--;
    g.fx.sparks(point || al.center, 8, 'blue');
    if (al.hp > 0) { audio.play('bonk', al.center, 0.8); return; }
    // knocked off: fall and go splat
    al.state = 'fall';
    const m = g.mech;
    const out = al.center.clone().sub(m ? m.chestPos() : al.center).setY(0);
    if (out.lengthSq() < 0.01) out.set(1, 0, 0);
    al.vel.copy(out.normalize().multiplyScalar(9)).setY(8);
    audio.play('bonk', al.center, 1);
    const left = this.count();
    if (left === 0) {
      g.nav.say('aliensClear', 'That was the last one! Your Jaeger is clean. Walk back and press F to climb in.', 3, 0);
      g.hud.alert('ALL ALIENS CLEARED', 2.5);
    } else g.nav.say('alienHit', ['Got one!', 'Splat! Nice shot!', 'One down!'][Math.floor(Math.random() * 3)], 1, 3);
  }

  // ---- update ----
  update(dt) {
    const g = this.game;
    const m = g.mech;
    for (let i = this.capsules.length - 1; i >= 0; i--) {
      const c = this.capsules[i];
      c.t += dt;
      if (!c.landed) {
        c.vel.y -= c.G * dt;
        c.pos.addScaledVector(c.vel, dt);
        c.g.position.copy(c.pos);
        c.g.rotation.x += dt * 5;
        g.fx.smokeTrail(c.pos, 1.2);
        if (c.pos.y <= 3.5) {
          c.pos.y = 3.5; c.landed = true; c.t = 0;
          c.g.position.copy(c.pos);
          c.g.rotation.set(Math.PI / 2, 0, Math.random() * 3);
          g.fx.groundDust(c.pos, 30, 14);
          g.fx.sparks(c.pos, 20);
          audio.play('smallBoom', c.pos, 0.8);
          g.shake(0.4, c.pos);
        }
      } else {
        // pop the aliens out one at a time
        if (c.spawn > 0 && c.t > 0.5 + (3 - c.spawn) * 0.35) { c.spawn--; this.spawnAlien(c.pos); }
        if (c.t > 7) c.g.position.y -= dt * 2;
        if (c.t > 10) { g.scene.remove(c.g); this.capsules.splice(i, 1); }
      }
    }

    let draining = 0;
    for (let i = this.list.length - 1; i >= 0; i--) {
      const a = this.list[i];
      a.t += dt;
      if (a.state === 'run') {
        if (!m || m.dead) { a.vel.set(0, 0, 0); }
        else {
          const dx = m.pos.x - a.pos.x, dz = m.pos.z - a.pos.z;
          const d = Math.hypot(dx, dz);
          a.yaw = Math.atan2(dx, dz);
          a.pos.x += dx / d * 36 * dt; a.pos.z += dz / d * 36 * dt;
          a.pos.y = Math.abs(Math.sin(a.t * 9)) * 1.6;
          if (d < 9 * m.scale) {
            a.state = 'on';
            a.ang = Math.atan2(-dx, -dz) - m.yaw; // which side it grabbed
            a.h = 2; a.wantH = 26 + Math.random() * 26;
            a.throwT = 1 + Math.random();
          }
        }
        a.g.position.copy(a.pos);
        a.g.rotation.set(0, a.yaw, 0);
      } else if (a.state === 'on') {
        if (!m || m.dead) { a.state = 'fall'; a.vel.set(0, 2, 0); continue; }
        a.h = Math.min(a.wantH, a.h + dt * 9);
        a.ang += Math.sin(a.t * 0.7 + a.seed) * dt * 0.25;
        // hug the Jaeger's surface: thin at the legs, wide at the chest
        const wide = THREE.MathUtils.smoothstep(a.h, 24, 34);
        const rx = 8 + wide * 5, rz = 6.5 + wide * 2.5;
        a.pos.set(Math.sin(a.ang) * rx, a.h, Math.cos(a.ang) * rz);
        m.root.localToWorld(a.pos);
        a.g.position.copy(a.pos);
        a.g.rotation.set(-Math.PI / 2 + 0.3, 0, 0);
        a.g.rotateOnWorldAxis(UPV, m.yaw + a.ang + Math.PI); // back faces outward, eyes up
        if (a.h > 8) {
          draining++;
          a.throwT -= dt;
          if (a.throwT <= 0) {
            // rip a piece of armor off and toss it
            a.throwT = 1.1 + Math.random() * 0.8;
            const out = new THREE.Vector3(Math.sin(m.yaw + a.ang), 0, Math.cos(m.yaw + a.ang));
            g.city.spawnChunk(-1, a.pos.x + out.x * 2, a.pos.y, a.pos.z + out.z * 2, 0.9, 0.5, 0.9, out.multiplyScalar(22).setY(14), 4);
            g.fx.sparks(a.pos, 8);
            audio.play('crumble', a.pos, 0.5);
          }
        }
      } else if (a.state === 'fall') {
        a.vel.y -= 45 * dt;
        a.pos.addScaledVector(a.vel, dt);
        a.g.position.copy(a.pos);
        a.g.rotation.x += dt * 7; a.g.rotation.z += dt * 4;
        if (a.pos.y <= 0) {
          a.pos.y = 0; a.state = 'splat'; a.t = 0;
          a.g.position.copy(a.pos);
          a.g.rotation.set(0, Math.random() * 6, 0);
          a.g.scale.set(1.9, 0.14, 1.9);
          for (const l of a.legs) l.visible = false;
          for (let k = 0; k < 14; k++) g.fx.add.spawn(a.pos, g.fx.rv(16).setY(6 + Math.random() * 10), 0.5 + Math.random() * 0.4, 5, 1, GOO, GOO, 1, -40, 1);
          audio.play('splat', a.pos, 1);
        }
      } else if (a.state === 'splat') {
        if (a.t > 6) { g.scene.remove(a.g); this.list.splice(i, 1); continue; }
      }
      // wiggle the legs
      for (let k = 0; k < a.legs.length; k++) a.legs[k].rotation.x = Math.sin(a.t * 14 + k * 1.7) * 0.7;
      a.center.copy(a.pos); a.center.y += a.state === 'on' ? 0 : ALIEN_R * 0.9;
    }

    // armor drain and warnings
    if (draining && m && !m.dead && g.state === 'play') {
      m.hp -= DRAIN * draining * dt;
      if (m.hp <= 0) m.takeDamage(1);
      this.warnT -= dt;
      if (this.warnT <= 0) {
        this.warnT = 6;
        if (!g.pilot) g.hud.alert('ALIENS ON YOUR JAEGER!', 2.5, true);
        g.nav.say('aliensOn', 'Aliens are climbing your Jaeger and pulling off armor! Press F to get out, then shoot them off with your blaster!', 3, 25);
      }
    }
    const want = this.count() > 0 && g.state === 'play';
    if (want) g.hud.hint(g.pilot ? 'Shoot the aliens off your Jaeger!' : (draining ? 'Aliens on your Jaeger!  Press F to get out and shoot them' : ''));
    else if (this.hinting) g.hud.hint('');
    this.hinting = want;
  }

  spawnAlien(at) {
    const { g, legs } = makeAlien();
    this.game.scene.add(g);
    const pos = at.clone().setY(0);
    pos.x += (Math.random() - 0.5) * 6; pos.z += (Math.random() - 0.5) * 6;
    this.list.push({ g, legs, pos, center: pos.clone(), vel: new THREE.Vector3(), state: 'run', hp: 2, t: Math.random() * 3, yaw: 0, seed: Math.random() * 9 });
    audio.play('bonk', at, 0.6);
  }

  clear() {
    for (const a of this.list) this.game.scene.remove(a.g);
    for (const c of this.capsules) this.game.scene.remove(c.g);
    this.list.length = 0; this.capsules.length = 0;
  }
}

const UPV = new THREE.Vector3(0, 1, 0);
