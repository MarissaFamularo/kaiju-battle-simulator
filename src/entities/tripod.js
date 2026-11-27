import * as THREE from 'three';
import { TRIPODS, WORLD } from '../config.js';
import { audio } from '../audio.js';

// Chapter 2 tripods (see docs/chapter-2-design.md).
// A Tripod lives in game.kaijus and has the same public shape as a Kaiju
// (pos, hitCache, takeDamage, dead, emerging...), so every weapon, the radar
// and the helicopters already know how to deal with it.

const NAMES = ['Alpha', 'Bravo', 'Cobra', 'Delta', 'Echo', 'Fang', 'Ghost', 'Hammer', 'Iron', 'Jolt'];
let nameIdx = 0;

const STAND = 50;        // hull height when standing (Jaeger is about 56 tall)
const BURIED = -18;      // hull height while still underground
const L1 = 30, L2 = 34;  // thigh and shin lengths
const HIP_R = 9, FOOT_R = 34;
const LEG_ANGLES = [Math.PI, Math.PI / 3, -Math.PI / 3]; // one leg back, two in front
const BEAM_PITCH = 0.214; // scanner points down so it lights the ground ahead
const UP = new THREE.Vector3(0, 1, 0);
const BOLT = new THREE.Color('#cfe4ff');
const WHITE = new THREE.Color('#bfefff');
const RED = new THREE.Color('#ff2a1a');

const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _c = new THREE.Vector3(), _d = new THREE.Vector3();
const _q = new THREE.Quaternion();

// A lightning bolt from the sky down to (x, z).
export function lightningStrike(game, x, z, big = false) {
  const end = new THREE.Vector3(x, game.city.groundAt(x, z), z);
  const p = new THREE.Vector3(x + (Math.random() - 0.5) * 240, 900, z + (Math.random() - 0.5) * 240);
  const n = 46;
  const step = end.clone().sub(p).divideScalar(n);
  for (let i = 0; i < n; i++) {
    p.add(step);
    const j = 16 * (1 - i / n);
    p.x += (Math.random() - 0.5) * j; p.z += (Math.random() - 0.5) * j;
    game.fx.glow(p, BOLT, big ? 34 : 24, 0.2 + Math.random() * 0.08);
    if (i > 8 && Math.random() < 0.08) {
      // a little side branch
      const br = p.clone();
      const dir = new THREE.Vector3(Math.random() - 0.5, -0.5, Math.random() - 0.5).multiplyScalar(22);
      for (let k = 0; k < 7; k++) { br.add(dir); br.x += (Math.random() - 0.5) * 8; game.fx.glow(br, BOLT, 12, 0.16); }
    }
  }
  const hit = end.clone().setY(end.y + 3);
  game.fx.flash(end.clone().setY(end.y + 40), '#bcd8ff', big ? 14000 : 8000, 0.35);
  game.fx.ring(hit, 4, big ? 110 : 60, 0.5, '#cfe4ff', 0.6);
  game.fx.sparks(hit, big ? 60 : 26, 'blue');
  game.fx.dust(hit, big ? 1.4 : 0.7, big ? 14 : 6);
  game.city.damageArea(hit, big ? 26 : 14, big ? 900 : 250, { source: 'tripod', force: 1.2 });
  audio.play('thunder', end, big ? 1.6 : 1.2);
  game.shake(big ? 1.2 : 0.45, end);
}

function buildTripod() {
  const mats = {
    hull: new THREE.MeshStandardMaterial({ color: '#8b93a6', metalness: 0.6, roughness: 0.38, emissive: '#1a2030', emissiveIntensity: 0.6 }),
    trim: new THREE.MeshStandardMaterial({ color: '#c3c9d6', metalness: 0.65, roughness: 0.3, emissive: '#1a2030', emissiveIntensity: 0.5 }),
    dark: new THREE.MeshStandardMaterial({ color: '#2a2d36', metalness: 0.7, roughness: 0.5 }),
    strip: new THREE.MeshStandardMaterial({ color: '#000', emissive: '#7dffb0', emissiveIntensity: 2.2 }),
    lights: new THREE.MeshStandardMaterial({ color: '#000', emissive: WHITE.clone(), emissiveIntensity: 0 }),
    weak: new THREE.MeshStandardMaterial({ color: '#000', emissive: '#38d8ff', emissiveIntensity: 3 }),
    beam: new THREE.MeshBasicMaterial({ color: WHITE.clone(), transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending }),
    spot: new THREE.MeshBasicMaterial({ color: WHITE.clone(), transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }),
  };
  const M = (geo, mat, x = 0, y = 0, z = 0, parent) => {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    m.castShadow = true;
    parent.add(m);
    return m;
  };
  const root = new THREE.Group();   // stays at the origin; everything below is in world space
  const body = new THREE.Group();   // the hull; local +Z is forward
  root.add(body);

  const hull = M(new THREE.SphereGeometry(13, 28, 18), mats.hull, 0, 0, 0, body);
  hull.scale.set(1, 0.55, 1.1);
  const dome = M(new THREE.SphereGeometry(8, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2), mats.trim, 0, 4.5, -2, body);
  dome.scale.y = 0.7;
  const rim = M(new THREE.TorusGeometry(13.2, 1.1, 8, 36), mats.trim, 0, 0, 0, body);
  rim.rotation.x = Math.PI / 2; rim.scale.y = 1.1;
  // eerie green running light under the rim
  const strip = M(new THREE.TorusGeometry(11.6, 0.45, 6, 36), mats.strip, 0, -2.6, 0, body);
  strip.rotation.x = Math.PI / 2; strip.scale.y = 1.1; strip.castShadow = false;
  // glowing power core underneath: the weak spot
  const core = M(new THREE.SphereGeometry(4.6, 16, 12), mats.weak, 0, -6.5, 0, body);
  for (let i = 0; i < 3; i++) {
    const a = LEG_ANGLES[i];
    M(new THREE.SphereGeometry(3.4, 12, 10), mats.dark, Math.sin(a) * HIP_R, -3, Math.cos(a) * HIP_R, body);
  }

  // ---- scanner head with 5 lights ----
  const head = new THREE.Group(); head.position.set(0, -1.5, 11.5); body.add(head);
  const hood = M(new THREE.SphereGeometry(6.5, 20, 14), mats.hull, 0, 0, 1, head);
  hood.scale.set(1.25, 0.62, 1);
  M(new THREE.BoxGeometry(13, 2.6, 1.2), mats.dark, 0, 0, 6.6, head);
  for (let i = 0; i < 5; i++) {
    const x = (i - 2) * 2.6;
    M(new THREE.CircleGeometry(0.95, 14), mats.lights, x, 0, 7.25, head);
  }
  const gun = M(new THREE.CylinderGeometry(0.9, 1.2, 5, 10), mats.dark, 0, -3.4, 4, head);
  gun.rotation.x = Math.PI / 2;
  const muzzle = new THREE.Object3D(); muzzle.position.set(0, -3.4, 7); head.add(muzzle);
  const eye = new THREE.Object3D(); eye.position.set(0, 0, 7.5); head.add(eye);
  // the scanner light cone
  const BEAM_LEN = 270;
  const coneGeo = new THREE.ConeGeometry(Math.tan(0.2) * BEAM_LEN, BEAM_LEN, 28, 1, true);
  coneGeo.translate(0, -BEAM_LEN / 2, 0);
  const beam = new THREE.Mesh(coneGeo, mats.beam);
  beam.position.copy(eye.position);
  beam.rotation.x = -(Math.PI / 2 - BEAM_PITCH);
  beam.renderOrder = 9;
  head.add(beam);
  // pool of light where the beam lands
  const spot = new THREE.Mesh(new THREE.CircleGeometry(1, 36), mats.spot);
  spot.rotation.x = -Math.PI / 2;
  spot.renderOrder = 8;
  root.add(spot);

  // ---- three legs (posed every frame in world space) ----
  const legs = [];
  const thighGeo = new THREE.CylinderGeometry(1.7, 1.4, L1, 10);
  const shinGeo = new THREE.CylinderGeometry(1.3, 0.8, L2, 10);
  for (let i = 0; i < 3; i++) {
    const thigh = M(thighGeo, mats.hull, 0, 0, 0, root);
    const shin = M(shinGeo, mats.trim, 0, 0, 0, root);
    const knee = M(new THREE.SphereGeometry(2.6, 12, 10), mats.dark, 0, 0, 0, root);
    M(new THREE.SphereGeometry(1.1, 8, 6), mats.strip, 0, 2.2, 0, knee).castShadow = false;
    const foot = new THREE.Group(); root.add(foot);
    M(new THREE.CylinderGeometry(2.2, 4.6, 2.4, 12), mats.dark, 0, 1.2, 0, foot);
    for (let t = 0; t < 3; t++) {
      const toe = M(new THREE.ConeGeometry(1.2, 5, 6), mats.trim, Math.sin(t * 2.094) * 4.6, 0.8, Math.cos(t * 2.094) * 4.6, foot);
      toe.rotation.set(Math.cos(t * 2.094) * 1.35, 0, -Math.sin(t * 2.094) * 1.35);
    }
    legs.push({ thigh, shin, knee, foot });
  }
  return { root, body, head, hull, core, muzzle, eye, beam, spot, legs, mats };
}

// Lays a cylinder mesh between two world points.
function place(mesh, a, b) {
  mesh.position.copy(a).add(b).multiplyScalar(0.5);
  _d.copy(b).sub(a).normalize();
  mesh.quaternion.setFromUnitVectors(UP, _d.negate()); // thick end at a
}

export class Tripod {
  constructor(game, { type = 'attacker', x = 0, z = 0 }) {
    this.game = game;
    this.isTripod = true;
    this.type = type;
    this.spec = TRIPODS[type];
    this.cat = 2; // radar dot size
    this.name = `Tripod ${NAMES[nameIdx++ % NAMES.length]}`;
    this.maxHp = this.hp = this.spec.hp;
    this.speed = this.spec.speed;
    this.radius = 12;
    this.height = 60;
    this.scale = 1;
    this.pos = new THREE.Vector3(x, game.city.groundAt(x, z), z); // pos.y is always the land height
    this.vel = new THREE.Vector3();
    this.knock = new THREE.Vector3();
    const ref = game.mech ? game.mech.pos : new THREE.Vector3();
    this.yaw = Math.atan2(ref.x - x, ref.z - z) + (Math.random() - 0.5) * 1.6;
    this.bodyY = BURIED;
    this.tilt = 0;
    this.state = 'emerge';
    this.stateT = 0;
    this.emerging = true;
    this.dead = false;
    this.removeMe = false;
    this.revealed = true;   // its weak spot (the core underneath) is always marked
    this.seenT = 0;
    this.model = buildTripod();
    this.root = this.model.root;
    game.scene.add(this.root);
    this.feet = LEG_ANGLES.map(() => ({ pos: new THREE.Vector3(x, this.pos.y + BURIED, z), from: new THREE.Vector3(), to: new THREE.Vector3(), t: -1, planted: false }));
    this.stepCd = 0;
    this.headYaw = 0;
    this.lit = 0;           // 0 = lights off, 1 = on
    this.alert = 0;         // 0 = white lights, 1 = red
    this.spotT = 0;         // how long the player has been inside the light
    this.target = null;     // { kind: 'mech' | 'pilot' | 'kaiju', ent }
    this.lostT = 0;
    this.losT = 0; this.los = false;
    this.fireCd = 2; this.burst = 0; this.burstT = 0;
    this.capsuleCd = 0;
    this.waypoint = null; this.waitT = 0;
    this.hitFlash = 0;
    this.deadT = 0;
    this.hitCache = [
      { p: new THREE.Vector3(), r: 13, weak: false },  // hull
      { p: new THREE.Vector3(), r: 5.5, weak: true, name: 'CORE' },  // power core underneath
      { p: new THREE.Vector3(), r: 7, weak: false },   // scanner head
      { p: new THREE.Vector3(), r: 4, weak: false }, { p: new THREE.Vector3(), r: 4, weak: false }, { p: new THREE.Vector3(), r: 4, weak: false }, // knees
    ];
    this.body = game.physics.kinematicBall(x, -60, z, 12);
    // break out of the ground
    const p = this.pos.clone().setY(this.pos.y + 4);
    game.city.damageArea(p, 40, 99999, { source: 'tripod', force: 2.2 });
    game.fx.explosion(p, 1.2);
    game.fx.groundDust(p, 80, 40);
    game.city.impulseDebris(p, 100, 50);
    audio.play('rumble', p, 1);
    this.pose(0);
  }

  get alive() { return !this.dead; }
  setState(s) { this.state = s; this.stateT = 0; }

  restFoot(i, out) {
    const a = this.yaw + LEG_ANGLES[i];
    out.set(this.pos.x + Math.sin(a) * FOOT_R, 0, this.pos.z + Math.cos(a) * FOOT_R);
    out.y = this.game.city.groundAt(out.x, out.z);
    return out;
  }

  headPos(out = new THREE.Vector3()) { return this.model.eye.getWorldPosition(out); }

  // ------------------------------------------------------------ update
  update(dt) {
    const g = this.game;
    this.stateT += dt;
    this.fireCd -= dt; this.capsuleCd -= dt; this.stepCd -= dt;
    this.hitFlash = Math.max(0, this.hitFlash - dt * 4);
    switch (this.state) {
      case 'emerge': this.updateEmerge(dt); break;
      case 'boot': this.updateBoot(dt); break;
      case 'search': this.updateSearch(dt); break;
      case 'alarm': this.updateAlarm(dt); break;
      case 'attack': this.updateAttack(dt); break;
      case 'dead': this.updateDead(dt); break;
      default: break;
    }
    if (this.knock.lengthSq() > 0.1) {
      this.pos.addScaledVector(this.knock, dt);
      this.knock.multiplyScalar(Math.max(0, 1 - dt * 4));
    }
    const B = g.city.bound;
    this.pos.x = THREE.MathUtils.clamp(this.pos.x, -B, B);
    this.pos.z = THREE.MathUtils.clamp(this.pos.z, g.city.waterEdge + 30, B);
    this.pos.y = g.city.groundAt(this.pos.x, this.pos.z);
    if (!this.dead && !this.emerging) this.walkLegs(dt);
    this.pose(dt);
    if (this.body) this.body.setNextKinematicTranslation({ x: this.pos.x, y: this.pos.y + Math.max(-60, this.bodyY), z: this.pos.z });
  }

  // legs first, then it pushes itself up
  updateEmerge(dt) {
    const g = this.game;
    const LEGS = 2.8, RISE = 2.4;
    const t = this.stateT;
    for (let i = 0; i < 3; i++) {
      const f = this.feet[i];
      const k = THREE.MathUtils.clamp((t - i * 0.5) / 1.5, 0, 1);
      const rest = this.restFoot(i, _a);
      const e = k * k * (3 - 2 * k);
      f.pos.set(this.pos.x + (rest.x - this.pos.x) * e, 0, this.pos.z + (rest.z - this.pos.z) * e);
      f.pos.y = k >= 1 ? rest.y : this.pos.y + BURIED * (1 - Math.min(1, k * 3)) + Math.sin(k * Math.PI) * 40;
      if (k > 0 && k < 1 && Math.random() < 0.4) g.fx.dust(_b.set(this.pos.x + (rest.x - this.pos.x) * 0.3, this.pos.y + 2, this.pos.z + (rest.z - this.pos.z) * 0.3), 0.7, 2);
      if (k >= 1 && !f.planted) {
        f.planted = true;
        this.footfall(f.pos, 1.3);
        g.city.spawnChunk(-1, f.pos.x, f.pos.y + 3, f.pos.z, 2, 1.2, 2, new THREE.Vector3((Math.random() - 0.5) * 30, 30, (Math.random() - 0.5) * 30), 4);
      }
    }
    if (t > LEGS) {
      const k = Math.min(1, (t - LEGS) / RISE);
      const e = 1 - (1 - k) ** 3;
      if (this.bodyY === BURIED) {
        const p = this.pos.clone().setY(this.pos.y + 4);
        g.fx.groundDust(p, 70, 40);
        g.city.impulseDebris(p, 80, 40);
        audio.play('explosion', p, 0.8);
        g.shake(1, this.pos);
      }
      this.bodyY = BURIED + 0.01 + (STAND - BURIED) * e;
      if (Math.random() < 0.5) g.fx.dust(_b.set(this.pos.x + (Math.random() - 0.5) * 30, this.pos.y + 2, this.pos.z + (Math.random() - 0.5) * 30), 0.8, 2);
      if (k >= 1) { this.emerging = false; this.setState('boot'); }
    }
  }

  updateBoot(dt) {
    // lights flicker on
    this.lit = this.stateT > 1 ? 1 : (Math.sin(this.stateT * 40) > 0 ? 1 : 0.1);
    if (this.stateT > 1.2) { this.lit = 1; this.setState('search'); }
  }

  // Is this point inside the scanner light, with nothing in the way?
  inLight(point, radius) {
    const g = this.game;
    const eye = this.headPos(_a);
    const to = _b.copy(point).sub(eye);
    const dist = to.length();
    if (dist > this.spec.range) return false;
    this.model.beam.getWorldQuaternion(_q);
    const dir = _c.set(0, -1, 0).applyQuaternion(_q);
    const ang = dir.angleTo(to);
    if (ang > this.spec.cone + Math.atan2(radius, dist) && dist > 45) return false;
    return !g.city.raycast(eye, point) && !g.city.terrainBlocks(eye, point);
  }

  canSee(point) {
    const eye = this.headPos(_a);
    if (eye.distanceTo(point) > 620) return false;
    return !this.game.city.raycast(eye, point) && !this.game.city.terrainBlocks(eye, point);
  }

  nearestKaiju(max) {
    let best = null, bd = max;
    for (const k of this.game.kaijus) {
      if (k.isTripod || k.dead || k.emerging) continue;
      const d = k.pos.distanceTo(this.pos);
      if (d < bd) { bd = d; best = k; }
    }
    return best;
  }

  updateSearch(dt) {
    const g = this.game;
    this.alert = Math.max(0, this.alert - dt * 2);
    this.headYaw = Math.sin(g.time * 0.75 + this.pos.x) * 1.0;
    // spot the Jaeger or the pilot inside the light
    let seen = null;
    const m = g.mech;
    if (g.pilot && !g.pilot.dead && this.inLight(_d.copy(g.pilot.pos).setY(g.pilot.pos.y + 2), 3)) seen = { kind: 'pilot', ent: g.pilot };
    else if (m && !m.dead && this.inLight(m.chestPos(_d), m.radius)) seen = { kind: 'mech', ent: m };
    if (seen && g.state === 'play') {
      this.spotT += dt;
      if (this.spotT > 0.35) { this.spotted(seen); return; }
    } else this.spotT = Math.max(0, this.spotT - dt);
    // kaiju and tripods fight each other
    const k = this.nearestKaiju(280);
    if (k) { this.target = { kind: 'kaiju', ent: k }; this.lostT = 0; this.setState('attack'); return; }
    // patrol: wander around near the Jaeger, sweeping the light
    if (!this.waypoint) {
      const ref = m ? m.pos : this.pos;
      const a = Math.random() * Math.PI * 2, d = 140 + Math.random() * 320;
      this.waypoint = new THREE.Vector3(ref.x + Math.cos(a) * d, 0, ref.z + Math.sin(a) * d);
      this.waitT = 0; this.wpAge = 0;
    }
    this.wpAge += dt;
    const dist = this.moveToward(this.waypoint, this.speed, dt, 30);
    if (dist < 34 || this.wpAge > 40) {
      this.waitT += dt; // stand and scan for a moment, then pick a new spot
      if (this.waitT > 2.5) this.waypoint = null;
    }
  }

  // The scanner found the player: red lights and a loud horn.
  spotted(seen) {
    const g = this.game;
    this.target = seen;
    this.spotT = 0;
    this.lostT = 0;
    this.setState('alarm');
    audio.play('horn', this.pos, 1.6);
    g.hud.alert('A TRIPOD SPOTTED YOU!', 3, true);
    g.nav.say('tripodSpot', 'It spotted you! Its lights turned red. Fight back, or break its line of sight behind a building!', 3, 12);
    g.shake(0.5, this.pos);
  }

  updateAlarm(dt) {
    this.alert = Math.min(1, this.alert + dt * 4);
    this.vel.multiplyScalar(Math.max(0, 1 - dt * 4));
    this.pos.addScaledVector(this.vel, dt);
    this.faceTarget(dt);
    if (this.stateT > 1.6) {
      if (this.capsuleCd <= 0 && this.game.mech && !this.game.mech.dead && this.game.aliens) {
        this.capsuleCd = 45;
        this.game.aliens.launchCapsule(this.headPos().setY(this.pos.y + this.bodyY + 6), this.game.mech);
      }
      this.fireCd = 0.6;
      this.setState('attack');
    }
  }

  targetPoint(out) {
    const T = this.target;
    if (!T) return null;
    if (T.kind === 'mech') return T.ent.chestPos(out);
    if (T.kind === 'pilot') return out.copy(T.ent.pos).setY(T.ent.pos.y + 2);
    return out.copy(T.ent.hitCache[0].p);
  }

  faceTarget(dt) {
    const tp = this.targetPoint(_d);
    if (!tp) return 0;
    const desired = Math.atan2(tp.x - this.pos.x, tp.z - this.pos.z);
    let dy = desired - this.yaw; dy = Math.atan2(Math.sin(dy), Math.cos(dy));
    this.yaw += THREE.MathUtils.clamp(dy, -dt * 1.3, dt * 1.3);
    this.headYaw += (THREE.MathUtils.clamp(dy, -1.1, 1.1) - this.headYaw) * Math.min(1, dt * 6);
    return dy;
  }

  updateAttack(dt) {
    const g = this.game;
    this.alert = Math.min(1, this.alert + dt * 4);
    let T = this.target;
    // a kaiju right next to us is the bigger problem
    const close = this.nearestKaiju(T && T.kind !== 'kaiju' ? 130 : 320);
    if (close && (!T || T.kind !== 'kaiju' || T.ent.dead)) { this.prevTarget = T && T.kind !== 'kaiju' ? T : this.prevTarget; T = this.target = { kind: 'kaiju', ent: close }; }
    if (!T || T.ent.dead || (T.kind === 'kaiju' && T.ent.pos.distanceTo(this.pos) > 420)) {
      const back = this.prevTarget && !this.prevTarget.ent.dead ? this.prevTarget : null;
      this.prevTarget = null;
      if (back) T = this.target = back; else { this.target = null; this.setState('search'); return; }
    }
    if (T.kind === 'mech' && g.pilot && T.ent.dead) { this.target = null; this.setState('search'); return; }
    const tp = this.targetPoint(new THREE.Vector3());
    const dy = this.faceTarget(dt);
    // can it still see the target?
    this.losT -= dt;
    if (this.losT <= 0) { this.losT = 0.25; this.los = T.kind === 'kaiju' ? true : this.canSee(tp); }
    if (this.los) this.lostT = 0; else this.lostT += dt;
    if (this.lostT > 6) {
      this.target = null;
      this.setState('search');
      g.hud.alert('THE TRIPOD LOST YOU', 2.5);
      g.nav.say('tripodLost', 'You lost it! Its lights went white again. Stay out of the light.', 2, 12);
      return;
    }
    // keep a firing distance
    const dist = Math.hypot(tp.x - this.pos.x, tp.z - this.pos.z);
    const want = T.kind === 'kaiju' ? 170 : 210;
    if (dist > want + 50 || !this.los) this.moveToward(tp, this.speed * 1.15, dt, 0, true);
    else if (dist < want - 80) this.moveToward(_a.copy(this.pos).multiplyScalar(2).sub(tp), this.speed * 0.8, dt, 0, true);
    else { this.vel.multiplyScalar(Math.max(0, 1 - dt * 3)); this.pos.addScaledVector(this.vel, dt); }
    // laser bursts
    if (this.burst > 0) {
      this.burstT -= dt;
      if (this.burstT <= 0) { this.burstT = 0.16; this.burst--; this.fireLaser(tp, T); }
    } else if (this.fireCd <= 0 && this.los && Math.abs(dy) < 0.5 && dist < 520) {
      this.burst = 3; this.burstT = 0;
      this.fireCd = this.spec.fireEvery + Math.random() * 0.6;
    }
  }

  fireLaser(tp, T) {
    const g = this.game;
    const from = this.model.muzzle.getWorldPosition(new THREE.Vector3());
    const aim = tp.clone();
    if (T.ent.vel) aim.addScaledVector(T.ent.vel, from.distanceTo(tp) / 520);
    aim.x += (Math.random() - 0.5) * 10; aim.y += (Math.random() - 0.5) * 10; aim.z += (Math.random() - 0.5) * 10;
    g.projectiles.fire({
      pos: from, dir: aim.sub(from).normalize(), speed: 520, damage: this.spec.laser * (T.kind === 'kaiju' ? 3 : 1),
      owner: T.kind === 'kaiju' ? 'tripod' : 'kaiju', src: this, color: '#ff3020', size: 11, radius: 4, smash: 0.6, life: 3,
    });
    g.fx.glow(from, RED, 30, 0.1);
    audio.play('laser', this.pos, 0.8);
  }

  // Walks the hull toward a point. Returns the distance left.
  moveToward(point, speed, dt, stopAt = 0, noTurn = false) {
    const g = this.game;
    const dx = point.x - this.pos.x, dz = point.z - this.pos.z;
    const dist = Math.hypot(dx, dz);
    if (!noTurn) {
      let dy = Math.atan2(dx, dz) - this.yaw; dy = Math.atan2(Math.sin(dy), Math.cos(dy));
      this.yaw += THREE.MathUtils.clamp(dy, -dt * 0.9, dt * 0.9);
    }
    const over = g.city.overlapping(this.pos.x, this.pos.z, 12).filter((b) => b.h > 30);
    if (over.length) speed *= 0.6;
    if (dist > stopAt) _a.set(dx / dist * speed, 0, dz / dist * speed); else _a.set(0, 0, 0);
    this.vel.lerp(_a, Math.min(1, dt * 2.5));
    this.pos.addScaledVector(this.vel, dt);
    // the hull pushes through tall buildings
    const sp = this.vel.length();
    if (sp > 2) for (const b of over) g.city.damage(b, sp * dt * 14, null, this.vel.clone().normalize(), { source: 'tripod', force: 1.2 });
    return dist;
  }

  // ------------------------------------------------------------ legs
  footfall(p, power = 1) {
    const g = this.game;
    audio.play('stomp', p, 0.6 * power);
    g.fx.dust(_c.copy(p).setY(p.y + 2), 0.6 * power, 4);
    g.shake(0.2 * power, p);
    g.city.crushCars(p.x, p.z, 9);
    g.city.damageArea(_c.copy(p).setY(p.y + 4), 8, 260 * power, { source: 'tripod', force: 1.1 });
  }

  walkLegs(dt) {
    const stepping = this.feet.some((f) => f.t >= 0);
    let worst = -1, wd = 15;
    for (let i = 0; i < 3; i++) {
      const f = this.feet[i];
      if (f.t >= 0) {
        f.t += dt / 0.36;
        const k = Math.min(1, f.t);
        const e = k * k * (3 - 2 * k);
        f.pos.lerpVectors(f.from, f.to, e);
        f.pos.y += Math.sin(k * Math.PI) * 13;
        if (k >= 1) { f.t = -1; f.pos.copy(f.to); this.footfall(f.pos); this.stepCd = 0.05; }
        continue;
      }
      const rest = this.restFoot(i, _a).addScaledVector(this.vel, 0.4);
      const d = Math.hypot(rest.x - f.pos.x, rest.z - f.pos.z);
      if (d > wd) { wd = d; worst = i; }
    }
    if (worst >= 0 && (!stepping || wd > 48) && this.stepCd <= 0) {
      const f = this.feet[worst];
      f.from.copy(f.pos);
      this.restFoot(worst, f.to).addScaledVector(this.vel, 0.55);
      f.t = 0;
    }
  }

  // Puts the hull, head, light and legs where they belong.
  pose(dt) {
    const g = this.game;
    const m = this.model;
    const stepping = this.feet.some((f) => f.t >= 0);
    const bob = this.dead || this.emerging ? 0 : Math.sin(g.time * 2.2 + this.pos.z) * 0.6 - (stepping ? 0.8 : 0);
    m.body.position.set(this.pos.x, this.pos.y + this.bodyY + bob, this.pos.z);
    m.body.rotation.set(this.dead ? 0 : Math.min(0.12, this.vel.length() * 0.005), this.yaw, this.tilt * (this.fallDir || 1), 'YXZ');
    m.head.rotation.y = this.headYaw;
    m.body.updateMatrixWorld(true);
    // legs: two-bone IK from each hip to its foot
    for (let i = 0; i < 3; i++) {
      const L = m.legs[i], f = this.feet[i];
      const hip = _a.set(Math.sin(LEG_ANGLES[i]) * HIP_R, -3, Math.cos(LEG_ANGLES[i]) * HIP_R);
      m.body.localToWorld(hip);
      const to = _b.copy(f.pos).sub(hip);
      const full = to.length();
      const d = THREE.MathUtils.clamp(full, 6, L1 + L2 - 0.5);
      to.divideScalar(full || 1);
      const along = (L1 * L1 - L2 * L2 + d * d) / (2 * d);
      const h = Math.sqrt(Math.max(0, L1 * L1 - along * along));
      // knees bend up and outward
      const out = _c.set(hip.x - m.body.position.x, 0, hip.z - m.body.position.z).normalize().multiplyScalar(0.7);
      out.y = 1;
      out.addScaledVector(to, -out.dot(to)).normalize();
      const knee = L.knee.position.copy(hip).addScaledVector(to, along).addScaledVector(out, h);
      const end = _c.copy(f.pos).sub(knee).normalize().multiplyScalar(L2).add(knee);
      place(L.thigh, hip, knee);
      place(L.shin, knee, end);
      L.foot.position.copy(end);
      L.foot.rotation.y = this.yaw + LEG_ANGLES[i];
      this.hitCache[3 + i].p.copy(knee);
    }
    // hit spheres
    this.hitCache[0].p.copy(m.body.position);
    m.core.getWorldPosition(this.hitCache[1].p);
    m.head.getWorldPosition(this.hitCache[2].p);
    // lights and the scanner beam
    const lit = this.dead ? 0 : this.lit;
    m.mats.lights.emissive.copy(WHITE).lerp(RED, this.alert);
    m.mats.lights.emissiveIntensity = lit * (3.2 + Math.sin(g.time * (this.alert > 0.5 ? 14 : 3)) * 0.8) + this.hitFlash * 3;
    m.mats.weak.emissiveIntensity = this.dead ? 0.15 : 3 + Math.sin(g.time * 6) * 1.5;
    m.mats.beam.color.copy(m.mats.lights.emissive);
    m.mats.beam.opacity = lit * 0.085;
    m.mats.spot.color.copy(m.mats.lights.emissive);
    // where the middle of the beam meets the ground
    const eye = this.headPos(_a);
    m.beam.getWorldQuaternion(_q);
    const dir = _b.set(0, -1, 0).applyQuaternion(_q);
    let reach = dir.y < -0.02 ? Math.min(this.spec.range, Math.max(10, eye.y - this.pos.y) / -dir.y) : this.spec.range;
    const far = _c.copy(eye).addScaledVector(dir, reach);
    const wall = lit > 0 ? g.city.raycast(eye, far) : null;
    if (wall) { reach *= wall.t; far.copy(eye).addScaledVector(dir, reach); }
    m.spot.position.set(far.x, g.city.groundAt(far.x, far.z) + 0.7, far.z);
    m.spot.scale.setScalar(Math.max(8, Math.tan(this.spec.cone) * reach * 1.15));
    m.mats.spot.opacity = lit * (wall ? 0.05 : 0.2);
    void dt;
  }

  // ------------------------------------------------------------ damage
  takeDamage(amount, point, dir, opts = {}) {
    if (this.dead || this.emerging) return;
    const g = this.game;
    this.hp -= amount;
    this.hitFlash = 1;
    if (point) g.fx.sparks(point, opts.weak ? 30 : 12, opts.weak ? 'blue' : 'spark');
    if (opts.knockback && dir) this.knock.addScaledVector(dir, opts.knockback * 0.3);
    if (this.hp <= 0) { this.die(); return; }
    // shooting it gives you away
    const src = opts.source;
    if ((src === 'mech' || src === 'player' || src === 'pilot') && (this.state === 'search' || this.state === 'boot')) {
      const m = g.mech;
      if (src === 'pilot' && g.pilot && !g.pilot.dead) this.spotted({ kind: 'pilot', ent: g.pilot });
      else if (m && !m.dead) this.spotted({ kind: 'mech', ent: m });
    } else if (src === 'kaiju' && this.state === 'search') {
      const k = this.nearestKaiju(400);
      if (k) { this.target = { kind: 'kaiju', ent: k }; this.setState('attack'); }
    }
  }

  die() {
    const g = this.game;
    this.hp = 0;
    this.dead = true;
    this.target = null;
    this.setState('dead');
    this.vy = 0;
    this.fallDir = Math.random() < 0.5 ? 1 : -1;
    g.physics.remove(this.body);
    this.body = null;
    const p = this.model.body.position.clone();
    g.fx.explosion(p, 1.4);
    audio.play('explosion', p, 1);
    audio.play('horn', this.pos, 0.7);
    g.onTripodKilled(this);
  }

  updateDead(dt) {
    const g = this.game;
    this.deadT += dt;
    this.lit = 0;
    if (!this.landed) {
      this.vy -= 55 * dt;
      this.bodyY += this.vy * dt;
      this.tilt = Math.min(0.55, this.tilt + dt * 0.5);
      if (Math.random() < 0.3) g.fx.fire(this.model.body.position, 1.2);
      if (this.bodyY <= 8) {
        this.bodyY = 8;
        this.landed = true;
        const p = this.pos.clone().setY(this.pos.y + 5);
        g.fx.explosion(p, 1.6);
        g.fx.groundDust(p, 90, 50);
        g.city.damageArea(p, 30, 500, { source: 'tripod', force: 1.5 });
        g.city.impulseDebris(p, 100, 50);
        audio.play('explosion', p, 1.2);
        g.shake(1.6, p);
      }
    } else {
      if (this.deadT < 9 && Math.random() < 0.2) g.fx.fire(this.model.body.position, 1);
      if (this.deadT > 14) {
        this.root.position.y -= dt * 4; // root sits at the origin, so this sinks the whole wreck
        if (this.deadT > 22) this.removeMe = true;
      }
    }
  }

  remove() {
    this.game.scene.remove(this.root);
    if (this.body) this.game.physics.remove(this.body);
    this.root.traverse((o) => { if (o.geometry) o.geometry.dispose(); });
    for (const k in this.model.mats) this.model.mats[k].dispose();
  }
}
