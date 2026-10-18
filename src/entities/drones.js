import * as THREE from 'three';
import { audio } from '../audio.js';

const bodyMat = new THREE.MeshStandardMaterial({ color: '#d8dde3', roughness: 0.35, metalness: 0.6 });
const darkMat = new THREE.MeshStandardMaterial({ color: '#25292e', roughness: 0.4, metalness: 0.7 });
const stripeMat = new THREE.MeshStandardMaterial({ color: '#e0a21b', roughness: 0.4, metalness: 0.4 });

function m(geo, mat, x = 0, y = 0, z = 0) {
  const o = new THREE.Mesh(geo, mat);
  o.position.set(x, y, z);
  o.castShadow = true;
  return o;
}

// The big carrier drone that hauls the Jaeger down from orbit.
export function buildCarrier(glow = '#38d8ff') {
  const g = new THREE.Group();
  const glowMat = new THREE.MeshStandardMaterial({ color: '#000', emissive: glow, emissiveIntensity: 4 });
  g.add(m(new THREE.BoxGeometry(26, 7, 50), bodyMat));
  g.add(m(new THREE.BoxGeometry(18, 5, 30), darkMat, 0, 5, -4));
  g.add(m(new THREE.CylinderGeometry(4, 13, 10, 4, 1).rotateX(Math.PI / 2).rotateZ(Math.PI / 4), bodyMat, 0, 0, 30));
  g.add(m(new THREE.BoxGeometry(27, 1.5, 4), stripeMat, 0, 0, 18));
  g.add(m(new THREE.BoxGeometry(6, 2, 4), glowMat, 0, 2.5, 34));
  const fans = [];
  for (const [x, z] of [[-24, 18], [24, 18], [-24, -18], [24, -18]]) {
    g.add(m(new THREE.BoxGeometry(Math.abs(x) - 8, 3, 4), darkMat, x / 2, 0, z));
    const ring = m(new THREE.TorusGeometry(9, 1.6, 8, 24).rotateX(Math.PI / 2), bodyMat, x, 0, z);
    g.add(ring);
    const fan = new THREE.Group();
    fan.position.set(x, 0, z);
    fan.add(m(new THREE.BoxGeometry(16, 0.4, 1.6), darkMat));
    fan.add(m(new THREE.BoxGeometry(1.6, 0.4, 16), darkMat));
    g.add(fan);
    fans.push(fan);
    const thr = m(new THREE.CircleGeometry(7.5, 20).rotateX(Math.PI / 2), glowMat, x, -1.5, z);
    g.add(thr);
  }
  // clamps that hold the Jaeger's shoulders
  const clamps = [];
  for (const s of [-1, 1]) {
    const c = new THREE.Group();
    c.position.set(s * 12, -3, 0);
    c.add(m(new THREE.BoxGeometry(3, 12, 6), darkMat, 0, -6, 0));
    c.add(m(new THREE.BoxGeometry(6, 2, 6), stripeMat, -s * 2, -12, 0));
    g.add(c);
    clamps.push(c);
  }
  // cable lines
  return { g, fans, clamps, glowMat };
}

function buildMini() {
  const g = new THREE.Group();
  g.add(m(new THREE.BoxGeometry(2.4, 0.9, 2.4), bodyMat));
  g.add(m(new THREE.SphereGeometry(0.6, 8, 6), new THREE.MeshBasicMaterial({ color: '#ff3a3a' }), 0, -0.4, 1.1));
  const rotors = [];
  for (const [x, z] of [[-1.8, -1.8], [1.8, -1.8], [-1.8, 1.8], [1.8, 1.8]]) {
    g.add(m(new THREE.BoxGeometry(1.4, 0.3, 0.3), darkMat, x / 2, 0, z / 2));
    const r = m(new THREE.BoxGeometry(2.6, 0.08, 0.3), darkMat, x, 0.5, z);
    g.add(r); rotors.push(r);
  }
  g.scale.setScalar(1.6);
  return { g, rotors };
}

const LINES_BONK = [
  'That drone just bonked off its head.',
  'The drones are... not really helping.',
  'Drones are built for carrying, not fighting!',
  'Did that kaiju even notice?',
  'Bonk. Zero damage. Classic.',
];

export class Drones {
  constructor(game) {
    this.game = game;
    this.carrier = null;
    this.minis = [];
    this.bonks = 0;
  }

  spawnCarrier(glow, pos) {
    const c = buildCarrier(glow);
    c.g.position.copy(pos);
    this.game.scene.add(c.g);
    this.carrier = c;
    c.vel = new THREE.Vector3();
    return c;
  }

  launchSwarm() {
    const g = this.game;
    if (!this.carrier) return false;
    const target = g.military.pickKaiju(this.carrier.g.position);
    if (!target) { g.nav.say('noKaiju', 'No kaiju to send the drones at yet.', 1, 4); return false; }
    for (let i = 0; i < 8; i++) {
      const d = buildMini();
      d.g.position.copy(this.carrier.g.position).add(new THREE.Vector3((Math.random() - 0.5) * 30, -6, (Math.random() - 0.5) * 30));
      g.scene.add(d.g);
      this.minis.push({
        ...d, pos: d.g.position, vel: new THREE.Vector3((Math.random() - 0.5) * 30, -10, (Math.random() - 0.5) * 30),
        target, aim: Math.floor(Math.random() * target.hitCache.length), state: 'attack', t: 0, bonks: 0, life: 14, wob: Math.random() * 6,
        spin: new THREE.Vector3(),
      });
    }
    audio.play('eject', this.carrier.g.position, 0.6);
    g.nav.say('drones', 'Drones away! ...They are mostly for carrying stuff, though.', 1, 5);
    return true;
  }

  update(dt, followPos) {
    const g = this.game;
    const c = this.carrier;
    if (c) {
      for (const f of c.fans) f.rotation.y += dt * 25;
      if (followPos) {
        const want = followPos.clone().add(new THREE.Vector3(-40, 170, -60));
        c.vel.lerp(want.sub(c.g.position).multiplyScalar(0.8), Math.min(1, dt * 1.5));
        c.g.position.addScaledVector(c.vel, dt);
        c.g.position.y += Math.sin(g.time * 1.3) * 0.05;
        c.g.rotation.z = THREE.MathUtils.clamp(-c.vel.x * 0.004, -0.2, 0.2);
        c.g.rotation.x = THREE.MathUtils.clamp(c.vel.z * 0.004, -0.2, 0.2);
      }
    }
    for (let i = this.minis.length - 1; i >= 0; i--) {
      const d = this.minis[i];
      d.life -= dt;
      d.t += dt;
      for (const r of d.rotors) r.rotation.y += dt * 50;
      const k = d.target;
      if (d.state === 'attack' && (!k || k.dead || d.life < 4)) d.state = 'home';
      if (d.state === 'attack') {
        const tp = k.hitCache[d.aim % k.hitCache.length].p;
        const to = tp.clone().sub(d.pos);
        const dist = to.length();
        d.wob += dt * 5;
        const wobble = new THREE.Vector3(Math.sin(d.wob) * 15, Math.cos(d.wob * 1.3) * 8, Math.cos(d.wob) * 15);
        d.vel.lerp(to.normalize().multiplyScalar(95).add(wobble), Math.min(1, dt * 2.5));
        if (dist < k.hitCache[d.aim % k.hitCache.length].r + 3) {
          // bonk!
          d.bonks++;
          this.bonks++;
          audio.play('bonk', d.pos, 0.9);
          g.fx.sparks(d.pos, 6);
          k.takeDamage(1, d.pos.clone(), null, { source: 'drone', stagger: 0 });
          g.onDamageDealt(k, 1, false, d.pos.clone(), 'drone');
          d.vel.multiplyScalar(-0.8).add(new THREE.Vector3((Math.random() - 0.5) * 50, 35, (Math.random() - 0.5) * 50));
          d.spin.set((Math.random() - 0.5) * 20, (Math.random() - 0.5) * 20, (Math.random() - 0.5) * 20);
          d.state = 'dazed';
          d.t = 0;
          if (this.bonks % 6 === 1) g.nav.say('bonk', LINES_BONK[Math.floor(Math.random() * LINES_BONK.length)], 0, 6);
          if (Math.random() < 0.25) {
            // pop
            g.fx.explosion(d.pos.clone(), 0.15);
            audio.play('smallBoom', d.pos, 0.3);
            g.scene.remove(d.g);
            this.minis.splice(i, 1);
            continue;
          }
        }
      } else if (d.state === 'dazed') {
        d.vel.y -= 20 * dt;
        d.vel.multiplyScalar(1 - dt * 0.8);
        d.g.rotation.x += d.spin.x * dt; d.g.rotation.z += d.spin.z * dt;
        d.spin.multiplyScalar(1 - dt * 1.5);
        if (d.t > 1.5) { d.state = d.bonks < 3 ? 'attack' : 'home'; d.g.rotation.set(0, 0, 0); }
      } else {
        const home = c ? c.g.position : d.pos.clone().add(new THREE.Vector3(0, 100, 0));
        const to = home.clone().sub(d.pos);
        d.vel.lerp(to.normalize().multiplyScalar(80), Math.min(1, dt * 2));
        if (d.pos.distanceTo(home) < 12 || d.life < -10) { g.scene.remove(d.g); this.minis.splice(i, 1); continue; }
      }
      d.pos.addScaledVector(d.vel, dt);
      if (d.pos.y < 2) { d.pos.y = 2; d.vel.y = Math.abs(d.vel.y) * 0.5; }
      if (d.state !== 'dazed') d.g.rotation.y = Math.atan2(d.vel.x, d.vel.z);
    }
  }

  clear() {
    for (const d of this.minis) this.game.scene.remove(d.g);
    this.minis.length = 0;
    if (this.carrier) this.game.scene.remove(this.carrier.g);
    this.carrier = null;
  }
}
