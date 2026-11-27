// Scout Jaegers: friendly robot pilots that walk around the map on their own and try to
// destroy the bad guys. Patrick's idea (2026-11-27). They are smaller and weaker than your
// Jaeger, carry a light Laser Blaster, and can be knocked out. A new one drops in later.
import * as THREE from 'three';
import { buildMech } from './mechModel.js';
import { segPointDist } from './projectiles.js';
import { audio } from '../audio.js';

const LOOKS = [
  { name: 'Scout Comet', primary: '#d9772b', accent: '#f1e3c8', glow: '#ffd23a' },
  { name: 'Scout Falcon', primary: '#2f8f5b', accent: '#d8e6dc', glow: '#7dffb0' },
  { name: 'Scout Nova', primary: '#8a3fc2', accent: '#e4d8f0', glow: '#ff7df0' },
  { name: 'Scout Blaze', primary: '#b8323a', accent: '#e9dcdc', glow: '#ff8a3a' },
];
const SCALE = 0.72, SPEED = 30, HP = 700;
const SEE = 1100, SHOOT = 200;        // how far they notice enemies, and how close they get before firing
const BOLT = 6, FIRE_EVERY = 1.7;     // light lasers: they help, but the big hits are yours
const _a = new THREE.Vector3(), _b = new THREE.Vector3();

export class Scouts {
  constructor(game) {
    this.game = game;
    this.list = [];
    this.want = 0;
    this.respawnT = 0;
    this.nextLook = 0;
  }

  // start a game with n scouts near the player
  deploy(n) {
    this.want = n;
    for (let i = 0; i < n; i++) this.add(140 + i * 60);
  }

  add(dist) {
    const g = this.game, look = LOOKS[this.nextLook++ % LOOKS.length];
    const ref = g.mech ? g.mech.pos : new THREE.Vector3();
    let x = ref.x, z = ref.z;
    for (let t = 0; t < 12; t++) {
      const a = Math.random() * Math.PI * 2;
      x = ref.x + Math.cos(a) * dist; z = ref.z + Math.sin(a) * dist;
      if (this.dry(x, z)) break;
    }
    const model = buildMech({ ...look, frame: 'scout', left: 'laser', right: 'laser', head: 'visor', chest: 'standard' });
    model.root.scale.setScalar(SCALE);
    g.scene.add(model.root);
    const s = {
      ...look, model, root: model.root, pos: new THREE.Vector3(x, g.city.groundAt(x, z), z), vel: new THREE.Vector3(),
      yaw: Math.random() * 6.28, hp: HP, maxHp: HP, dead: false, deadT: 0, radius: 8 * SCALE, height: 56 * SCALE,
      walkPhase: 0, moveAmt: 0, fireCd: 1 + Math.random(), burst: 0, burstT: 0, aim: 0, waypoint: null, wpT: 0, avoid: 0, avoidT: 0, target: null, thinkT: 0,
    };
    this.list.push(s);
    return s;
  }

  dry(x, z) {
    const c = this.game.city, B = c.bound - 60;
    return Math.abs(x) < B && Math.abs(z) < B && z > c.waterEdge + 40 && c.groundAt(x, z) > -1;
  }

  chest(s, out) { return out.set(s.pos.x, s.pos.y + 40 * SCALE, s.pos.z); }

  nearestEnemy(s) {
    let best = null, bd = SEE;
    for (const k of this.game.kaijus) {
      if (k.dead || k.emerging) continue;
      const d = Math.hypot(k.pos.x - s.pos.x, k.pos.z - s.pos.z);
      if (d < bd) { bd = d; best = k; }
    }
    return best;
  }

  update(dt) {
    const g = this.game;
    if (g.state === 'play' && this.list.filter((s) => !s.dead).length < this.want) {
      this.respawnT -= dt;
      if (this.respawnT <= 0) {
        this.respawnT = 50;
        const s = this.add(260);
        g.fx.ring(_a.copy(s.pos).setY(s.pos.y + 2), 4, 50, 0.6, s.glow, 0.6);
        g.nav.say('scoutNew', `${s.name} just dropped in to help!`, 1, 20);
      }
    }
    for (let i = this.list.length - 1; i >= 0; i--) {
      const s = this.list[i];
      if (s.dead) { if (this.updateWreck(s, dt)) { g.scene.remove(s.root); this.list.splice(i, 1); } continue; }
      this.think(s, dt);
      this.animate(s, dt);
    }
  }

  think(s, dt) {
    const g = this.game, c = g.city;
    s.thinkT -= dt; s.fireCd -= dt; s.aim = Math.max(0, s.aim - dt);
    if (s.thinkT <= 0) { s.thinkT = 0.5; s.target = this.nearestEnemy(s); }
    const T = s.target && !s.target.dead ? s.target : null;
    let goal = null, stop = 30, speed = SPEED;
    if (T) {
      goal = T.pos; stop = SHOOT * 0.8 + (T.radius || 10);
      const d = Math.hypot(T.pos.x - s.pos.x, T.pos.z - s.pos.z);
      // enemies that get right on top of a scout hurt it
      if (d < (T.radius || 10) + 46) this.hurt(s, 30 * dt, T.pos);
      if (d < SHOOT + (T.radius || 10) + 40) {
        const want = Math.atan2(T.pos.x - s.pos.x, T.pos.z - s.pos.z);
        let dy = want - s.yaw; dy = Math.atan2(Math.sin(dy), Math.cos(dy));
        s.yaw += THREE.MathUtils.clamp(dy, -dt * 3, dt * 3);
        s.aim = 0.6;
        if (s.burst > 0) {
          s.burstT -= dt;
          if (s.burstT <= 0) { s.burstT = 0.18; s.burst--; this.fire(s, T); }
        } else if (s.fireCd <= 0 && Math.abs(dy) < 0.3) { s.burst = 2; s.burstT = 0; s.fireCd = FIRE_EVERY + Math.random() * 0.6; }
        if (d < stop) goal = null;
      }
    } else {
      // patrol: wander around the area the player is in
      s.wpT -= dt;
      if (!s.waypoint || s.wpT <= 0 || Math.hypot(s.waypoint.x - s.pos.x, s.waypoint.z - s.pos.z) < 40) {
        const ref = g.mech ? g.mech.pos : s.pos;
        for (let t = 0; t < 8; t++) {
          const a = Math.random() * Math.PI * 2, d = 150 + Math.random() * 450;
          const x = ref.x + Math.cos(a) * d, z = ref.z + Math.sin(a) * d;
          if (this.dry(x, z)) { s.waypoint = new THREE.Vector3(x, 0, z); break; }
        }
        s.wpT = 25;
      }
      goal = s.waypoint; speed = SPEED * 0.7;
    }
    if (goal) {
      let head = Math.atan2(goal.x - s.pos.x, goal.z - s.pos.z);
      // walk around tall buildings and stay out of deep water
      s.avoidT -= dt;
      const blocked = (h) => { const x = s.pos.x + Math.sin(h) * 26, z = s.pos.z + Math.cos(h) * 26; return c.overlapping(x, z, 9).some((b) => b.h > 12) || c.groundAt(x, z) < -3 || z < c.waterEdge + 10; };
      if (blocked(head)) { if (s.avoidT <= 0) { s.avoid = Math.random() < 0.5 ? 1 : -1; s.avoidT = 1.5; } let n = 0; while (blocked(head) && n++ < 6) head += s.avoid * 0.5; if (n > 6) speed = 0; }
      if (!T || s.aim <= 0) { let dy = head - s.yaw; dy = Math.atan2(Math.sin(dy), Math.cos(dy)); s.yaw += THREE.MathUtils.clamp(dy, -dt * 2.5, dt * 2.5); }
      _a.set(Math.sin(head) * speed, 0, Math.cos(head) * speed);
    } else _a.set(0, 0, 0);
    s.vel.lerp(_a, Math.min(1, dt * 4));
    s.pos.addScaledVector(s.vel, dt);
    s.pos.y = c.groundAt(s.pos.x, s.pos.z);
    // enemy shots that pass through a scout hit it
    for (const p of g.projectiles.list) {
      if (p.owner !== 'kaiju' || p.life <= 0) continue;
      if (Math.abs(p.pos.x - s.pos.x) > 40 || Math.abs(p.pos.z - s.pos.z) > 40) continue;
      if (p.pos.distanceTo(this.chest(s, _b)) < 16 * SCALE + p.radius + 6) { this.hurt(s, p.damage, p.pos); p.life = 0; g.fx.sparks(p.pos, 14); }
    }
  }

  fire(s, T) {
    const g = this.game;
    const mz = s.model.muzzle && (s.model.muzzle.R || s.model.muzzle.L);
    const from = mz ? mz.getWorldPosition(new THREE.Vector3()) : this.chest(s, new THREE.Vector3());
    const h = T.hitCache[0]; // they aim for the body; finding the weak spot is your job
    const aim = h.p.clone();
    aim.x += (Math.random() - 0.5) * 8; aim.y += (Math.random() - 0.5) * 8; aim.z += (Math.random() - 0.5) * 8;
    g.projectiles.fire({ pos: from, dir: aim.sub(from).normalize(), speed: 620, damage: BOLT, owner: 'ally', weapon: 'laser', src: s, color: s.glow, size: 9, radius: 3, smash: 0.2, life: 2.5 });
    g.fx.glow(from, new THREE.Color(s.glow), 22, 0.1);
    audio.play('laser', s.pos, 0.5);
  }

  hurt(s, amount, from) {
    if (s.dead) return;
    s.hp -= amount;
    if (amount > 5) this.game.fx.sparks(this.chest(s, _b), 10);
    if (s.hp > 0) return;
    const g = this.game;
    s.dead = true; s.hp = 0;
    this.respawnT = 50;
    g.fx.explosion(this.chest(s, new THREE.Vector3()), 0.9);
    audio.play('explosion', s.pos, 0.8);
    g.hud.alert(`${s.name.toUpperCase()} IS DOWN`, 2.5);
    g.nav.say('scoutDown', `${s.name} is knocked out! The pilot ejected safely. Another scout is on the way.`, 2, 8);
  }

  updateWreck(s, dt) {
    s.deadT += dt;
    s.root.rotation.x = Math.min(1.45, s.deadT * 1.6); // falls on its face
    s.root.position.set(s.pos.x, s.pos.y + Math.sin(Math.min(1.45, s.deadT * 1.6)) * 4, s.pos.z);
    if (s.deadT < 6 && Math.random() < 0.15) this.game.fx.fire(this.chest(s, _b).setY(s.pos.y + 6), 0.7);
    if (s.deadT > 12) s.root.position.y -= (s.deadT - 12) * 6;
    return s.deadT > 16;
  }

  animate(s, dt) {
    const j = s.model.j, sp = s.vel.length();
    const A = s.moveAmt += (Math.min(1.2, sp / SPEED) - s.moveAmt) * Math.min(1, dt * 6);
    s.walkPhase += (sp * dt / (15 * SCALE)) * Math.PI;
    const ph = s.walkPhase;
    const hip = Math.sin(ph) * 0.55 * A, kL = Math.max(0, -Math.cos(ph)) * A, kR = Math.max(0, Math.cos(ph)) * A;
    j.legL.rotation.x = -hip; j.legR.rotation.x = hip;
    j.kneeL.rotation.x = kL; j.kneeR.rotation.x = kR;
    j.ankleL.rotation.x = -(-hip + kL) * 0.6; j.ankleR.rotation.x = -(hip + kR) * 0.6;
    j.hips.position.y = 27 - Math.abs(Math.sin(ph)) * 1.4 * A;
    j.torso.rotation.x = 0.08 * A;
    for (const [k, side] of [['L', 1], ['R', -1]]) {
      const up = s.aim > 0 ? -Math.PI / 2 : 0.1 + Math.sin(ph) * 0.4 * A * side;
      const sh = j['shoulder' + k], el = j['elbow' + k];
      if (sh) sh.rotation.x += (up - sh.rotation.x) * Math.min(1, dt * 10);
      if (el) el.rotation.x += ((s.aim > 0 ? -0.05 : -0.35) - el.rotation.x) * Math.min(1, dt * 10);
    }
    for (const k of ['L', 'R']) { const b = s.model.blades && s.model.blades[k]; if (b) b.visible = false; }
    s.root.position.copy(s.pos);
    s.root.rotation.y = s.yaw;
  }
}
