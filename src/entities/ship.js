// Alien ships (campaign part 3, Patrick 2026-11-27): "the ships are in orbit and are entering the
// atmosphere and are sending more and more ships". A ship flies down, hovers, and drops tripods that
// are already awake. It lives in game.kaijus like a tripod so every weapon, the radar and the HUD work.
import * as THREE from 'three';
import { TRIPODS } from '../config.js';
import { audio } from '../audio.js';
import { Tripod } from './tripod.js';

const NAMES = ['Viper', 'Talon', 'Raven', 'Scythe', 'Mantis', 'Hornet', 'Wraith', 'Cobra'];
let nameIdx = 0;
export const SHIPS = {
  ship: { id: 'ship', name: 'Alien Dropship', short: 'Dropship', scale: 1, hp: 850, alt: 190, dropEvery: 7, laser: 5, fireEvery: 3.4, leaves: true },   // drops its tripods, then flies away
  mothership: { id: 'mothership', name: 'The Mothership', short: 'Mothership', scale: 2.6, hp: 4200, alt: 250, dropEvery: 22, laser: 6, fireEvery: 2.4, boss: true },
};
const _a = new THREE.Vector3(), _b = new THREE.Vector3();
const GREEN = new THREE.Color('#7dffb0'), RED = new THREE.Color('#ff2a1a');

function buildShip(spec) {
  const mats = {
    hull: new THREE.MeshStandardMaterial({ color: spec.boss ? '#5a2030' : '#7c8496', metalness: 0.65, roughness: 0.35, emissive: '#1a1420', emissiveIntensity: 0.7 }),
    dark: new THREE.MeshStandardMaterial({ color: '#2a2d36', metalness: 0.7, roughness: 0.5 }),
    glow: new THREE.MeshStandardMaterial({ color: '#000', emissive: '#7dffb0', emissiveIntensity: 2.4 }),
    engine: new THREE.MeshStandardMaterial({ color: '#000', emissive: '#ff5a2a', emissiveIntensity: 3 }),
    weak: new THREE.MeshStandardMaterial({ color: '#000', emissive: '#38d8ff', emissiveIntensity: 3 }),
  };
  const root = new THREE.Group();
  const M = (geo, mat, x = 0, y = 0, z = 0) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = true; root.add(m); return m; };
  const hull = M(new THREE.SphereGeometry(30, 28, 16), mats.hull); hull.scale.set(1, 0.3, 1.5);       // long flat body, +Z is forward
  const top = M(new THREE.SphereGeometry(13, 18, 12), mats.dark, 0, 6, 6); top.scale.set(1, 0.6, 1.4);
  for (const s of [-1, 1]) {
    const wing = M(new THREE.BoxGeometry(26, 2.2, 22), mats.hull, s * 34, -1, -12); wing.rotation.y = s * 0.35; wing.rotation.z = s * -0.12;
    const eng = M(new THREE.CylinderGeometry(5, 6, 16, 12), mats.dark, s * 20, 0, -38); eng.rotation.x = Math.PI / 2;
    M(new THREE.CylinderGeometry(4.2, 4.2, 1.5, 12), mats.engine, s * 20, 0, -46.5).rotation.x = Math.PI / 2;
  }
  const strip = M(new THREE.TorusGeometry(24, 0.8, 6, 30), mats.glow, 0, -6, 0); strip.rotation.x = Math.PI / 2; strip.scale.y = 1.5;
  const bay = M(new THREE.CylinderGeometry(9, 12, 4, 16), mats.dark, 0, -9, 0);   // the hatch tripods drop from
  const core = M(new THREE.SphereGeometry(6, 14, 10), mats.weak, 0, -12, 0);      // weak spot: the glowing core under the hatch
  const gun = new THREE.Object3D(); gun.position.set(0, -6, 40); root.add(gun);
  if (spec.boss) for (let i = 0; i < 10; i++) { const a = (i / 10) * 6.28; const sp = M(new THREE.ConeGeometry(2.2, 12, 6), mats.engine, Math.sin(a) * 22, 9, Math.cos(a) * 30); sp.rotation.set(Math.cos(a) * 0.3, 0, -Math.sin(a) * 0.3); }
  root.scale.setScalar(spec.scale);
  return { root, core, gun, bay, mats };
}

export class AlienShip {
  constructor(game, { type = 'ship', x = 0, z = 0, cargo = ['attacker', 'attacker'] }) {
    this.game = game;
    this.isTripod = true;   // enemy machine: tripods leave it alone, the radar draws a triangle
    this.isShip = true;
    this.type = type;
    this.spec = SHIPS[type];
    this.cat = this.spec.boss ? 4 : 3;
    this.name = this.spec.boss ? 'Mothership' : `Dropship ${NAMES[nameIdx++ % NAMES.length]}`;
    this.maxHp = this.hp = this.spec.hp;
    this.radius = 30 * this.spec.scale; this.height = 30 * this.spec.scale; this.scale = 1;
    this.cargo = [...cargo];
    this.drop = new THREE.Vector3(x, 0, z);            // the spot it hovers over
    const a = Math.random() * 6.28;
    this.pos = new THREE.Vector3(x + Math.cos(a) * 1500, 1100, z + Math.sin(a) * 1500);   // comes down out of the sky
    this.vel = new THREE.Vector3();
    this.yaw = Math.atan2(x - this.pos.x, z - this.pos.z);
    this.state = 'arrive'; this.stateT = 0;
    this.dead = false; this.emerging = false; this.revealed = true; this.removeMe = false;
    this.dropCd = 3; this.fireCd = 4; this.hitFlash = 0; this.orbit = Math.random() * 6.28; this.vy = 0;
    this.model = buildShip(this.spec);
    this.root = this.model.root;
    game.scene.add(this.root);
    this.hitCache = [
      { p: new THREE.Vector3(), r: 30 * this.spec.scale, weak: false },
      { p: new THREE.Vector3(), r: 9 * this.spec.scale, weak: true, name: 'CORE' },
    ];
    this.place();
  }

  get alive() { return !this.dead; }

  place() {
    this.root.position.copy(this.pos);
    this.root.rotation.set(this.dead ? this.tilt || 0 : Math.sin(this.game.time * 1.3) * 0.03, this.yaw, this.dead ? (this.tilt || 0) * 0.7 : 0);
    this.hitCache[0].p.copy(this.pos);
    this.model.core.getWorldPosition(this.hitCache[1].p);
  }

  update(dt) {
    const g = this.game, sp = this.spec;
    this.stateT += dt;
    this.hitFlash = Math.max(0, this.hitFlash - dt * 4);
    this.model.mats.weak.emissiveIntensity = this.dead ? 0.2 : 3 + Math.sin(g.time * 6) * 1.5;
    if (this.dead) { this.updateDead(dt); this.place(); return; }
    const hoverY = g.city.groundAt(this.drop.x, this.drop.z) + sp.alt;
    if (this.state === 'leave') {
      // job done: climb away back to the fleet
      this.vy = Math.min(260, this.vy + dt * 60);
      this.pos.y += this.vy * dt;
      this.pos.addScaledVector(_a.set(Math.sin(this.yaw), 0, Math.cos(this.yaw)), (60 + this.vy) * dt);
      if (Math.random() < 0.5) g.fx.glow(_b.copy(this.pos).setY(this.pos.y - 6), RED, 36, 0.2);
      if (this.pos.y > 1500) { this.dead = true; this.gone = true; this.removeMe = true; g.stats.shipsGone++; }
      this.place();
      return;
    }
    if (this.state === 'arrive') {
      const k = Math.min(1, this.stateT / 9), e = 1 - (1 - k) ** 2;
      if (!this.from) this.from = this.pos.clone();
      this.pos.lerpVectors(this.from, _a.set(this.drop.x, hoverY, this.drop.z), e);
      if (Math.random() < 0.6) g.fx.glow(_b.copy(this.pos).setY(this.pos.y - 6), RED, 40 * sp.scale, 0.25); // glowing hot from the atmosphere
      if (k >= 1) { this.state = 'hover'; this.stateT = 0; audio.play('horn', this.pos, 0.9); }
    } else {
      // drift in a slow circle over the drop spot
      this.orbit += dt * 0.22;
      _a.set(this.drop.x + Math.cos(this.orbit) * 70, hoverY + Math.sin(g.time * 0.8) * 5, this.drop.z + Math.sin(this.orbit) * 70);
      this.pos.lerp(_a, Math.min(1, dt * 0.8));
      const ref = g.pilot && !g.pilot.dead ? g.pilot.pos : g.mech ? g.mech.pos : null;
      if (ref) { let dy = Math.atan2(ref.x - this.pos.x, ref.z - this.pos.z) - this.yaw; dy = Math.atan2(Math.sin(dy), Math.cos(dy)); this.yaw += THREE.MathUtils.clamp(dy, -dt * 0.6, dt * 0.6); }
      // drop the next tripod: it lands already awake
      this.dropCd -= dt;
      if (this.cargo.length && this.dropCd <= 0 && g.kaijus.filter((k) => !k.dead && !k.isShip && !k.friendly).length < 6) {
        this.dropCd = sp.dropEvery;
        const type = this.cargo.shift();
        const gx = this.pos.x, gz = this.pos.z, gy = g.city.groundAt(gx, gz);
        for (let i = 0; i <= 12; i++) g.fx.glow(_a.set(gx, gy + (this.pos.y - gy) * (i / 12), gz), GREEN, 26, 0.6);
        g.fx.ring(_a.set(gx, gy + 2, gz), 4, 60, 0.6, '#7dffb0', 0.7);
        g.kaijus.push(new Tripod(g, { type, x: gx, z: gz, awake: true }));
        audio.play('uiBig', this.pos, 1);
        g.hud.alert(`${this.name.toUpperCase()} DROPPED A ${TRIPODS[type].short.toUpperCase()}!`, 3, true);
        g.nav.say('shipDrop', `The ship dropped a ${TRIPODS[type].name}! It is already awake. Shoot the ship down before it drops more!`, 2, 18);
      }
      if (sp.leaves && !this.cargo.length && this.dropCd < sp.dropEvery - 3) {
        this.state = 'leave'; this.stateT = 0; this.vy = 0;
        g.hud.alert(`${this.name.toUpperCase()} IS LEAVING`, 2.5);
        g.nav.say('shipLeave', 'The ship dropped everything it had, and now it is flying away. Get the tripods!', 2, 15);
        this.place();
        return;
      }
      // a light laser of its own
      this.fireCd -= dt;
      const m = g.mech;
      if (this.fireCd <= 0 && m && !m.dead && g.state === 'play') {
        const tp = g.pilot && !g.pilot.dead ? _a.copy(g.pilot.pos).setY(g.pilot.pos.y + 2) : m.chestPos(_a);
        const from = this.model.gun.getWorldPosition(new THREE.Vector3());
        if (from.distanceTo(tp) < 620 && !g.city.raycast(from, tp)) {
          this.fireCd = sp.fireEvery + Math.random();
          const aim = tp.clone(); aim.x += (Math.random() - 0.5) * 16; aim.z += (Math.random() - 0.5) * 16;
          g.projectiles.fire({ pos: from, dir: aim.sub(from).normalize(), speed: 480, damage: sp.laser, owner: 'kaiju', src: this, color: '#ff3020', size: 11, radius: 4, smash: 0.6, life: 3 });
          audio.play('laser', this.pos, 0.7);
        } else this.fireCd = 0.5;
      }
    }
    this.place();
  }

  takeDamage(amount, point, dir, opts = {}) {
    if (this.dead) return;
    this.hp -= amount;
    this.hitFlash = 1;
    if (point && amount > 0) this.game.fx.sparks(point, opts.weak ? 30 : 12, opts.weak ? 'blue' : 'spark');
    if (this.hp <= 0) this.die();
  }

  die() {
    const g = this.game;
    this.hp = 0; this.dead = true; this.state = 'dead'; this.stateT = 0; this.tilt = 0;
    g.fx.explosion(this.pos, 1.6 * this.spec.scale);
    audio.play('explosion', this.pos, 1.2);
    g.stats.shipsGone++;
    g.onTripodKilled(this);
  }

  updateDead(dt) {
    const g = this.game;
    if (this.crashed) { if (this.stateT > 8) this.removeMe = true; return; }
    this.vy -= 60 * dt;
    this.pos.y += this.vy * dt;
    this.pos.addScaledVector(_a.set(Math.sin(this.yaw), 0, Math.cos(this.yaw)), 30 * dt);
    this.tilt = Math.min(0.9, this.tilt + dt * 0.8);
    if (Math.random() < 0.6) g.fx.fire(this.pos, 1.4);
    const floor = g.city.groundAt(this.pos.x, this.pos.z) + 8;
    if (this.pos.y <= floor) {
      this.pos.y = floor; this.crashed = true; this.stateT = 0;
      const p = this.pos.clone();
      g.fx.explosion(p, 2.2 * this.spec.scale);
      g.fx.groundDust(p, 110, 60);
      g.city.damageArea(p, 40 * this.spec.scale, 900, { source: 'tripod', force: 1.6 });
      audio.play('explosion', p, 1.4);
      g.shake(1.8, p);
    }
  }

  remove() {
    this.game.scene.remove(this.root);
    this.root.traverse((o) => { if (o.geometry) o.geometry.dispose(); });
    for (const k in this.model.mats) this.model.mats[k].dispose();
  }
}

// The Core Reactor (campaign part 4): the heart of the tripods' base under the Earth. It does not move.
// It wakes up guard tripods until it is destroyed.
export class CoreReactor {
  constructor(game, { x = 0, z = 0, generator = false, heart = false, pylon = false, gate = false }) {
    this.game = game;
    this.isTripod = true; this.isShip = true;
    this.generator = generator;   // part 5: a smaller green one that powers the planet's shield, and has no guards
    this.heart = heart;           // part 6: a purple Corruption Heart. No guards of its own.
    this.quiet = pylon || gate;   // part 7: Gate Pylons (blue) and the Dimension Gate itself. No guards of their own.
    this.type = gate ? 'gate' : pylon ? 'pylon' : heart ? 'heart' : generator ? 'generator' : 'reactor';
    this.spec = gate ? { name: 'THE DIMENSION GATE', short: 'Gate' } : pylon ? { name: 'Gate Pylon', short: 'Pylon' } : heart ? { name: 'Corruption Heart', short: 'Heart' } : generator ? { name: 'Shield Generator', short: 'Generator' } : { name: 'The Core Reactor', short: 'Reactor' };
    this.cat = generator || heart ? 3 : 4;
    this.name = gate ? 'Dimension Gate' : pylon ? 'Gate Pylon' : heart ? 'Corruption Heart' : generator ? 'Shield Generator' : 'Core Reactor';
    this.maxHp = this.hp = gate ? 4200 : pylon ? 900 : heart ? 1000 : generator ? 1300 : 3200;
    this.radius = 40; this.height = 60; this.scale = 1;
    this.pos = new THREE.Vector3(x, game.city.groundAt(x, z) + 75, z);
    this.vel = new THREE.Vector3();
    this.state = 'hover'; this.dead = false; this.emerging = false; this.revealed = true; this.removeMe = false;
    this.cargo = []; this.guardCd = 10; this.deadT = 0; this.hitFlash = 0;
    const root = this.root = new THREE.Group();
    this.mats = {
      core: new THREE.MeshStandardMaterial({ color: '#000', emissive: gate ? '#c07dff' : pylon ? '#38a8ff' : heart ? '#b04aff' : generator ? '#3aff9a' : '#ff5a2a', emissiveIntensity: 3 }),
      ring: new THREE.MeshStandardMaterial({ color: '#8b93a6', metalness: 0.7, roughness: 0.35, emissive: '#2a1010', emissiveIntensity: 1 }),
      weak: new THREE.MeshStandardMaterial({ color: '#000', emissive: '#38d8ff', emissiveIntensity: 3 }),
    };
    root.add(new THREE.Mesh(new THREE.SphereGeometry(30, 28, 20), this.mats.core));
    this.rings = [];
    for (let i = 0; i < 3; i++) { const r = new THREE.Mesh(new THREE.TorusGeometry(44 + i * 9, 3, 8, 40), this.mats.ring); root.add(r); this.rings.push(r); }
    this.eye = new THREE.Mesh(new THREE.SphereGeometry(9, 14, 10), this.mats.weak); this.eye.position.set(0, 0, 31); root.add(this.eye);
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(8, 16, 80, 12), this.mats.ring); stem.position.y = -70; root.add(stem);
    root.position.copy(this.pos);
    game.scene.add(root);
    this.hitCache = [{ p: this.pos.clone(), r: 34, weak: false }, { p: new THREE.Vector3(), r: 11, weak: true, name: 'EYE' }];
    if (gate) {
      // the doorway to the new dimension: much bigger, with the new planets already showing inside it
      const K = 2.8;
      this.pos.y = game.city.groundAt(x, z) + 75 * K; root.position.copy(this.pos); root.scale.setScalar(K);
      this.radius *= K; this.height *= K;
      this.hitCache[0].p.copy(this.pos); this.hitCache[0].r *= K; this.hitCache[1].r *= K;
      this.planets = new THREE.Group();
      for (const [c, r, d] of [['#5ac8ff', 5, 16], ['#ffb04a', 3.5, 22], ['#7dffb0', 4, 12], ['#ff7df0', 2.6, 26]]) { const pl = new THREE.Mesh(new THREE.SphereGeometry(r, 12, 8), new THREE.MeshBasicMaterial({ color: c })); pl.position.set(d, 0, 0); const arm = new THREE.Group(); arm.rotation.y = Math.random() * 6; arm.rotation.z = Math.random() - 0.5; arm.add(pl); this.planets.add(arm); }
      root.add(this.planets);
      this.mats.core.transparent = true; this.mats.core.opacity = 0.45;
    }
  }

  get alive() { return !this.dead; }

  update(dt) {
    const g = this.game;
    this.hitFlash = Math.max(0, this.hitFlash - dt * 4);
    if (this.dead) {
      this.deadT += dt;
      if (Math.random() < 0.7) g.fx.explosion(_a.copy(this.pos).add(_b.set((Math.random() - 0.5) * 120, (Math.random() - 0.5) * 80, (Math.random() - 0.5) * 120)), 0.8 + Math.random());
      this.root.scale.setScalar(Math.max(0.01, 1 - this.deadT / 3));
      if (this.deadT > 3) this.removeMe = true;
      return;
    }
    if (this.planets) this.planets.children.forEach((a, i) => { a.rotation.y += dt * (0.5 + i * 0.25); });
    this.rings.forEach((r, i) => { r.rotation.x = g.time * (0.6 + i * 0.3); r.rotation.y = g.time * (0.4 + i * 0.2) + i; });
    this.mats.core.emissiveIntensity = 2.6 + Math.sin(g.time * 4) * 0.8 + this.hitFlash * 3;
    // the eye follows the Jaeger
    const m = g.mech;
    if (m) this.root.rotation.y = Math.atan2(m.pos.x - this.pos.x, m.pos.z - this.pos.z);
    this.eye.getWorldPosition(this.hitCache[1].p);
    // wake up a guard now and then
    this.guardCd -= dt;
    if (this.generator && Math.random() < 0.3) g.fx.glow(_a.copy(this.pos).setY(this.pos.y + 60 + Math.random() * 700), GREEN, 22, 0.5); // its beam feeds the shield
    if (!this.generator && !this.heart && !this.quiet && this.guardCd <= 0 && g.state === 'play') {
      this.guardCd = 16;
      if (g.kaijus.filter((k) => !k.dead && !k.friendly && !k.isShip).length < (g.lowPower ? 3 : 4)) {
        const a = Math.random() * 6.28, d = 150 + Math.random() * 120;
        const type = ['attacker', 'gatling', 'boom', 'tank'][Math.floor(Math.random() * 4)];
        g.spawnAwake(type, this.pos.x + Math.cos(a) * d, this.pos.z + Math.sin(a) * d);
        g.nav.say('coreGuard', 'The reactor woke up another guard! Keep shooting the reactor!', 2, 20);
      }
    }
  }

  takeDamage(amount, point, dir, opts = {}) {
    if (this.dead) return;
    if (this.locked) { // the Gate cannot be hurt while its pylons are standing
      this.hitFlash = 1;
      if (opts.source === 'mech' || opts.source === 'player') { this.game.hud.alert('THE GATE IS PROTECTED: DESTROY THE PYLONS', 2); }
      return;
    }
    this.hp -= amount;
    this.hitFlash = 1;
    if (point && amount > 0) this.game.fx.sparks(point, opts.weak ? 30 : 12, opts.weak ? 'blue' : 'spark');
    if (this.hp <= 0) {
      this.hp = 0; this.dead = true; this.state = 'dead';
      audio.play('explosion', this.pos, 1.5); audio.play('thunder', this.pos, 1.2);
      this.game.shake(2.5, this.pos);
      this.game.onTripodKilled(this);
    }
  }

  remove() {
    this.game.scene.remove(this.root);
    this.root.traverse((o) => { if (o.geometry) o.geometry.dispose(); });
    for (const k in this.mats) this.mats[k].dispose();
  }
}
