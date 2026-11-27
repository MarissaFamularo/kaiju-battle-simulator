import * as THREE from 'three';
import { KAIJU_CATS, WORLD } from '../config.js';
import { buildKaiju } from './kaijuModel.js';
import { audio } from '../audio.js';

const PRE = ['Razor', 'Skull', 'Thunder', 'Gore', 'Spine', 'Doom', 'Crag', 'Venom', 'Storm', 'Iron', 'Shadow', 'Magma', 'Frost', 'Rift', 'Bone', 'Mega', 'Tide', 'Ash'];
const SUF = ['back', 'maw', 'jaw', 'fang', 'claw', 'horn', 'tail', 'crusher', 'scale', 'tooth', 'spitter', 'breaker', 'stomper', 'ripper'];
const TYPES = ['brute', 'stalker', 'hammer'];

const _v = new THREE.Vector3();

export class Kaiju {
  constructor(game, { cat = 1, type = null, x = 0, z = 0, from = 'ground' }) {
    this.game = game;
    const c = KAIJU_CATS[cat];
    this.cat = cat;
    this.type = type || TYPES[Math.floor(Math.random() * TYPES.length)];
    this.name = PRE[Math.floor(Math.random() * PRE.length)] + SUF[Math.floor(Math.random() * SUF.length)];
    this.scale = c.scale * (0.92 + Math.random() * 0.16);
    this.maxHp = this.hp = c.hp;
    this.dmg = c.dmg;
    this.speed = c.speed * (this.type === 'stalker' ? 1.25 : this.type === 'hammer' ? 1.05 : 1);
    this.model = buildKaiju(this.type);
    this.root = this.model.root;
    this.root.scale.setScalar(this.scale);
    this.radius = this.model.radius * this.scale;
    this.height = this.model.height * this.scale;
    this.pos = new THREE.Vector3(x, 0, z);
    this.vel = new THREE.Vector3();
    this.yaw = Math.atan2(-x, -z) + (Math.random() - 0.5);
    this.from = from;
    this.state = 'emerge';
    this.stateT = 0;
    this.emerging = true;
    this.dead = false;
    this.removeMe = false;
    this.walkPhase = Math.random() * 6;
    this.moveAmt = 0;
    this.attack = null;
    this.cd = { attack: 1, spit: 6 + Math.random() * 4, charge: 8 + Math.random() * 6, retarget: 0 };
    this.stagger = 0;
    this.aggro = 0;
    this.target = null;
    this.charging = 0;
    this.revealed = false;
    this.seenT = 0;
    this.hitCache = this.model.hit.map((h) => ({ ...h, p: new THREE.Vector3() }));
    this.weakHits = 0;
    this.lastStepSign = 1;
    this.deadT = 0;
    this.jawOpen = 0;
    this.headUp = 0;
    this.knock = new THREE.Vector3();
    game.scene.add(this.root);
    this.body = game.physics.kinematicBall(x, -50, z, this.radius * 0.9);
    this.root.position.set(x, -this.height * 1.1, z);
    this.root.rotation.y = this.yaw;
    this.updateHitCache();
  }

  get alive() { return !this.dead; }

  // ------------------------------------------------------------
  update(dt) {
    const g = this.game;
    this.stateT += dt;
    for (const k in this.cd) this.cd[k] -= dt;
    this.aggro = Math.max(0, this.aggro - dt);
    this.stagger = Math.max(0, this.stagger - dt * 0.4);

    switch (this.state) {
      case 'emerge': this.updateEmerge(dt); break;
      case 'roar': this.updateRoar(dt); break;
      case 'hunt': this.updateHunt(dt); break;
      case 'attack': this.updateAttack(dt); break;
      case 'stagger': this.updateStaggered(dt); break;
      case 'dead': this.updateDead(dt); break;
      default: break;
    }
    // knockback velocity
    if (this.knock.lengthSq() > 0.1) {
      this.pos.addScaledVector(this.knock, dt);
      this.knock.multiplyScalar(Math.max(0, 1 - dt * 4));
    }
    const B = WORLD.bound + 400;
    this.pos.x = THREE.MathUtils.clamp(this.pos.x, -B, B);
    this.pos.z = THREE.MathUtils.clamp(this.pos.z, -B - 600, B);

    this.animate(dt);
    if (this.state !== 'emerge' && this.state !== 'dead') this.root.position.set(this.pos.x, 0, this.pos.z);
    this.root.rotation.y = this.yaw;
    this.root.updateMatrixWorld(true);
    this.updateHitCache();
    if (!this.dead) this.body.setNextKinematicTranslation({ x: this.pos.x, y: Math.max(-40, this.root.position.y) + this.radius * 0.8, z: this.pos.z });
    // pulse weak spots
    const pulse = 3 + Math.sin(g.time * 6) * 1.5;
    this.model.mats.weak.emissiveIntensity = this.dead ? 0.2 : pulse;
  }

  updateHitCache() {
    for (const h of this.hitCache) {
      h.p.copy(h.off || _v.set(0, 0, 0));
      h.obj.localToWorld(h.p);
    }
  }

  updateEmerge(dt) {
    const g = this.game;
    const dur = 4;
    const t = Math.min(1, this.stateT / dur);
    if (this.stateT < dt * 1.5) {
      // breach
      const p = this.pos.clone().setY(5);
      if (this.from === 'water') {
        for (let i = 0; i < 40; i++) g.fx.steam(p.clone().add(new THREE.Vector3((Math.random() - 0.5) * 60, 0, (Math.random() - 0.5) * 60)), 1.2);
      } else {
        g.city.damageArea(p, this.radius * 2.2, 99999, { source: 'kaiju', force: 2.5 });
        g.fx.explosion(p, 1.5);
        g.city.impulseDebris(p, 120, 60);
      }
      g.fx.groundDust(p, 90, 50);
      audio.play('explosion', p, 1);
      audio.play('rumble', p, 1);
      g.shake(1.5, this.pos);
    }
    // rumble out of the ground
    const ease = 1 - (1 - t) ** 3;
    this.root.position.set(this.pos.x + (Math.random() - 0.5) * (1 - t) * 3, -this.height * 1.1 * (1 - ease), this.pos.z);
    this.root.rotation.x = (1 - ease) * -0.6;
    if (Math.random() < 0.5) {
      const p = this.pos.clone().add(new THREE.Vector3((Math.random() - 0.5) * this.radius * 3, 2, (Math.random() - 0.5) * this.radius * 3));
      if (this.from === 'water') g.fx.steam(p, 0.8); else g.fx.dust(p, 1, 3);
    }
    if (Math.random() < dt * 8 && this.from !== 'water') {
      g.city.spawnChunk(-1, this.pos.x + (Math.random() - 0.5) * this.radius * 2, 3, this.pos.z + (Math.random() - 0.5) * this.radius * 2,
        2 + Math.random() * 3, 1.5, 2 + Math.random() * 3, new THREE.Vector3((Math.random() - 0.5) * 30, 25 + Math.random() * 20, (Math.random() - 0.5) * 30), 4);
    }
    if (t >= 1) {
      this.root.rotation.x = 0;
      this.emerging = false;
      this.setState('roar');
    }
  }

  updateRoar() {
    if (this.stateT < 0.05) {
      audio.play('roar', this.pos, 1.2);
      this.game.shake(0.6, this.pos);
    }
    this.jawOpen = Math.min(1, this.stateT * 3);
    this.headUp = Math.sin(Math.min(1, this.stateT / 2.2) * Math.PI);
    if (this.stateT > 2.3) { this.jawOpen = 0; this.setState('hunt'); }
  }

  setState(s) { this.state = s; this.stateT = 0; }

  chooseTarget() {
    const g = this.game;
    const cands = [];
    const m = g.mech;
    if (m && !m.dead) {
      const d = m.pos.distanceTo(this.pos);
      if (d < 420 || this.aggro > 0) cands.push({ kind: 'mech', ent: m, pos: m.pos, radius: m.radius, score: d * (this.aggro > 0 ? 0.3 : 1) });
    }
    if (g.pilot && !g.pilot.dead) {
      const d = g.pilot.pos.distanceTo(this.pos);
      if (d < 140) cands.push({ kind: 'pilot', ent: g.pilot, pos: g.pilot.pos, radius: 3, score: d * 1.2 });
    }
    for (const u of g.military.targets()) {
      const d = u.pos.distanceTo(this.pos);
      if (d < 160) cands.push({ kind: 'air', ent: u, pos: u.pos, radius: 8, score: d * 1.5 });
    }
    // kaiju and tripods fight each other
    for (const t of g.kaijus) {
      if (!t.isTripod || t.dead || t.emerging) continue;
      const d = t.pos.distanceTo(this.pos);
      if (d < 320) cands.push({ kind: 'tripod', ent: t, pos: t.pos, radius: t.radius, score: d * 0.9 });
    }
    if (!cands.length) {
      // go for the power plant
      let best = null, bd = Infinity;
      for (const p of g.city.plantParts) {
        if (!p.alive) continue;
        const d = Math.hypot(p.x - this.pos.x, p.z - this.pos.z);
        if (d < bd) { bd = d; best = p; }
      }
      if (best) cands.push({ kind: 'plant', ent: best, pos: new THREE.Vector3(best.x, 0, best.z), radius: Math.max(best.hw, best.hd), score: bd });
      else if (m) cands.push({ kind: 'mech', ent: m, pos: m.pos, radius: m.radius, score: 0 });
    }
    cands.sort((a, b) => a.score - b.score);
    this.target = cands[0] || null;
  }

  updateHunt(dt) {
    const g = this.game;
    if (this.cd.retarget <= 0 || !this.target || (this.target.ent.dead) || (this.target.kind === 'plant' && !this.target.ent.alive)) {
      this.chooseTarget();
      this.cd.retarget = 1;
    }
    const T = this.target;
    let moving = false;
    let speed = this.speed;
    if (T) {
      const to = _v.set(T.pos.x - this.pos.x, 0, T.pos.z - this.pos.z);
      const dist = to.length();
      const desired = Math.atan2(to.x, to.z);
      let dy = desired - this.yaw;
      dy = Math.atan2(Math.sin(dy), Math.cos(dy));
      const turn = (this.charging > 0 ? 0.6 : 1.6) * dt;
      this.yaw += THREE.MathUtils.clamp(dy, -turn, turn);
      const reach = this.reach() + T.radius;
      const facing = Math.abs(dy) < 0.8;
      // charge attack for bigger kaiju
      if (this.cat >= 2 && T.kind === 'mech' && this.cd.charge <= 0 && dist > 120 && dist < 350 && facing) {
        this.charging = 2.6;
        this.cd.charge = 14 + Math.random() * 6;
        audio.play('roar', this.pos, 0.8);
        g.nav.say('charge', `${this.name} is charging! Jump or sprint sideways!`, 2);
      }
      if (this.charging > 0) {
        this.charging -= dt;
        speed *= 2.4;
        if (T.kind === 'mech' && dist < reach * 0.9) {
          this.charging = 0;
          T.ent.takeDamage(this.dmg * 1.3, this.pos);
          T.ent.vel.addScaledVector(to.normalize(), 40);
          g.shake(1.4);
          audio.play('hit', T.pos, 1.2);
          this.cd.attack = 1.2;
        }
      }
      if (dist > reach * 0.85 || this.charging > 0) moving = true;
      // ranged spit
      if (this.cd.spit <= 0 && dist > 140 && dist < 450 && facing && (T.kind === 'mech' || T.kind === 'air' || T.kind === 'pilot')) {
        this.startAttack('spit');
        this.cd.spit = 8 + Math.random() * 6;
        return;
      }
      if (dist < reach && this.cd.attack <= 0 && this.charging <= 0) {
        if (facing) {
          const r = Math.random();
          let type = 'swipe';
          if (this.type === 'stalker') type = r < 0.6 ? 'bite' : 'tail';
          else if (this.type === 'hammer') type = r < 0.5 ? 'slam' : (r < 0.8 ? 'swipe' : 'bite');
          else type = r < 0.55 ? 'swipe' : (r < 0.8 ? 'bite' : 'tail');
          this.startAttack(type);
          return;
        }
      }
    }
    // smash through buildings
    const over = g.city.overlapping(this.pos.x, this.pos.z, this.radius * 0.9);
    if (over.length) speed *= 0.65;
    if (moving) {
      const f = _v.set(Math.sin(this.yaw), 0, Math.cos(this.yaw));
      this.vel.lerp(f.multiplyScalar(speed), Math.min(1, dt * 3));
    } else this.vel.multiplyScalar(Math.max(0, 1 - dt * 5));
    this.pos.addScaledVector(this.vel, dt);
    const sp = this.vel.length();
    if (over.length && sp > 2) {
      for (const b of over) {
        const pt = new THREE.Vector3(THREE.MathUtils.clamp(this.pos.x, b.x - b.hw, b.x + b.hw), Math.min(this.height * 0.4, b.h * 0.5), THREE.MathUtils.clamp(this.pos.z, b.z - b.hd, b.z + b.hd));
        g.city.damage(b, sp * dt * 9 * this.scale * (this.charging > 0 ? 3 : 1), Math.random() < dt * 5 ? pt : null, this.vel.clone().normalize(), { source: 'kaiju', force: 1.3 });
      }
    }
  }

  reach() { return (this.type === 'stalker' ? 40 : this.type === 'hammer' ? 42 : 36) * this.scale; }

  startAttack(type) {
    const dur = { swipe: 1.1, bite: 1.0, tail: 1.4, slam: 1.5, spit: 1.3 }[type];
    this.attack = { type, t: 0, dur, hitDone: false, side: Math.random() < 0.5 ? 0 : 1 };
    this.setState('attack');
    this.vel.multiplyScalar(0.2);
    if (type === 'spit' || type === 'slam') audio.play('roar', this.pos, 0.5);
  }

  updateAttack(dt) {
    const a = this.attack;
    a.t += dt / a.dur;
    if (this.target && a.type !== 'tail') {
      const T = this.target;
      const desired = Math.atan2(T.pos.x - this.pos.x, T.pos.z - this.pos.z);
      let dy = desired - this.yaw; dy = Math.atan2(Math.sin(dy), Math.cos(dy));
      this.yaw += THREE.MathUtils.clamp(dy, -dt * 1.2, dt * 1.2) * (a.t < 0.5 ? 1 : 0);
    }
    this.pos.addScaledVector(this.vel, dt);
    this.vel.multiplyScalar(Math.max(0, 1 - dt * 4));
    const hitAt = a.type === 'slam' ? 0.55 : a.type === 'spit' ? 0.55 : 0.5;
    if (a.t >= hitAt && !a.hitDone) { a.hitDone = true; this.resolveAttack(a); }
    if (a.t >= 1) {
      this.attack = null;
      this.cd.attack = 0.8 + Math.random() * 1.2 - (this.cat - 1) * 0.1;
      this.setState('hunt');
    }
  }

  resolveAttack(a) {
    const g = this.game;
    const T = this.target;
    const f = new THREE.Vector3(Math.sin(this.yaw), 0, Math.cos(this.yaw));
    const reach = this.reach();
    if (a.type === 'spit') {
      const head = this.model.j.head;
      const from = head.localToWorld(new THREE.Vector3(0, 0, 14));
      if (T) {
        const tp = T.pos.clone().setY(T.kind === 'mech' ? 35 : T.pos.y + 2);
        const dist = tp.distanceTo(from);
        const lead = T.ent.vel ? T.ent.vel.clone().multiplyScalar(dist / 240) : new THREE.Vector3();
        const dir = tp.add(lead).sub(from).normalize();
        g.projectiles.fire({ pos: from, dir, speed: 240, damage: this.dmg * 0.6, owner: 'kaiju', color: '#5dff8a', size: 22, radius: 9, gravity: -20, acid: true, smash: 1 });
      }
      audio.play('plasma', this.pos, 0.6);
      return;
    }
    let center, radius, dmg = this.dmg;
    if (a.type === 'tail') {
      center = this.pos.clone().setY(15 * this.scale);
      radius = reach * 1.25;
      dmg *= 0.8;
      audio.play('swing', this.pos, 1);
    } else if (a.type === 'slam') {
      center = this.pos.clone().addScaledVector(f, reach * 0.8).setY(4);
      radius = reach * 0.9;
      dmg *= 1.2;
      g.fx.groundDust(center, 70, 40);
      g.fx.ring(center, 5, 80, 0.6, '#ffe0b0', 0.5);
      g.city.impulseDebris(center, 90, 50);
      audio.play('stomp', center, 1.5);
      audio.play('smallBoom', center, 1);
      g.shake(1.1, center);
    } else {
      center = this.pos.clone().addScaledVector(f, reach * 0.75).setY(a.type === 'bite' ? 35 * this.scale : 28 * this.scale);
      radius = reach * 0.7;
      audio.play(a.type === 'bite' ? 'punch' : 'swing', this.pos, 1);
    }
    // smash buildings in the strike zone
    g.city.damageArea(center, radius * 0.8, dmg * 1.5, { source: 'kaiju', force: 1.8 });
    // hit targets in range
    const m = g.mech;
    if (m && !m.dead) {
      const d = Math.hypot(m.pos.x - center.x, m.pos.z - center.z);
      if (d < radius + m.radius && m.pos.y < center.y + 40) m.takeDamage(dmg, this.pos);
    }
    if (g.pilot && !g.pilot.dead) {
      const d = Math.hypot(g.pilot.pos.x - center.x, g.pilot.pos.z - center.z);
      if (d < radius + 4 && g.pilot.pos.y < center.y + 30) g.pilot.takeDamage(dmg * 0.6, this.pos);
    }
    for (const u of g.military.targets()) {
      if (u.pos.distanceTo(center) < radius + 25) u.destroy(true);
    }
    for (const t of g.kaijus) {
      if (!t.isTripod || t.dead || t.emerging) continue;
      if (Math.hypot(t.pos.x - center.x, t.pos.z - center.z) < radius + t.radius + 14) t.takeDamage(dmg * 1.6, t.hitCache[0].p.clone(), f, { source: 'kaiju', knockback: 30 });
    }
    if (T && T.kind === 'plant' && T.ent.alive) {
      const pt = new THREE.Vector3(THREE.MathUtils.clamp(center.x, T.ent.x - T.ent.hw, T.ent.x + T.ent.hw), Math.min(center.y, T.ent.h * 0.6), THREE.MathUtils.clamp(center.z, T.ent.z - T.ent.hd, T.ent.z + T.ent.hd));
      if (pt.distanceTo(center) < radius + 25) g.city.damage(T.ent, dmg * 1.5, pt, f, { source: 'kaiju' });
    }
  }

  updateStaggered(dt) {
    this.vel.multiplyScalar(Math.max(0, 1 - dt * 5));
    this.pos.addScaledVector(this.vel, dt);
    if (this.stateT > 1.3) this.setState('hunt');
  }

  updateDead(dt) {
    this.deadT += dt;
    const t = Math.min(1, this.deadT / 1.6);
    const e = t * t;
    this.root.rotation.z = e * (Math.PI / 2 - 0.15) * this.fallDir;
    this.root.position.set(this.pos.x, Math.sin(t * Math.PI) * 3, this.pos.z);
    if (this.deadT > 1.5 && !this.landed) {
      this.landed = true;
      const side = new THREE.Vector3(Math.cos(this.yaw) * this.fallDir * -this.height * 0.4, 5, -Math.sin(this.yaw) * this.fallDir * -this.height * 0.4).add(this.pos);
      this.game.fx.groundDust(side, 90, 50);
      this.game.city.damageArea(side, this.height * 0.45, 400, { source: 'kaiju', force: 1.5 });
      this.game.city.impulseDebris(side, 120, 50);
      audio.play('explosion', side, 1);
      this.game.shake(1.5, side);
    }
    if (this.deadT > 2 && this.deadT < 10 && Math.random() < 0.15) this.game.fx.blood(this.model.hit[1] ? this.hitCache[1].p : this.pos, null);
    if (this.deadT > 14) {
      this.root.position.y -= dt * 4;
      if (this.deadT > 22) this.removeMe = true;
    }
  }

  // ------------------------------------------------------------
  takeDamage(amount, point, dir, opts = {}) {
    if (this.dead || this.emerging) return;
    const g = this.game;
    this.hp -= amount;
    if (opts.source === 'mech' || opts.source === 'pilot') this.aggro = 12;
    if (point) g.fx.blood(point, dir, opts.weak);
    this.stagger += (opts.stagger || 0.1) + (opts.weak ? 0.45 : 0);
    if (opts.knockback && dir) this.knock.addScaledVector(dir, opts.knockback);
    if (opts.weak) this.weakHits++;
    if (this.hp <= 0) { this.die(); return; }
    if (this.stagger > 1.1 && this.state !== 'stagger') {
      this.stagger = 0;
      this.attack = null;
      this.charging = 0;
      this.setState('stagger');
      audio.play('roar', this.pos, 0.5);
    }
  }

  die() {
    this.hp = 0;
    this.dead = true;
    this.attack = null;
    this.setState('dead');
    this.fallDir = Math.random() < 0.5 ? 1 : -1;
    audio.play('roar', this.pos, 1);
    for (const h of this.hitCache) if (h.weak) this.game.fx.blood(h.p, null, true);
    this.game.physics.remove(this.body);
    this.body = null;
    this.game.onKaijuKilled(this);
  }

  // ------------------------------------------------------------
  animate(dt) {
    const j = this.model.j;
    const t = this.game.time;
    const sp = this.vel.length();
    const A = this.dead ? 0 : Math.min(1.4, sp / this.speed);
    this.moveAmt += (A - this.moveAmt) * Math.min(1, dt * 5);
    const stride = (this.type === 'stalker' ? 13 : 12) * this.scale;
    this.walkPhase += (sp * dt / stride) * Math.PI;
    const ph = this.walkPhase, M = this.moveAmt;
    for (const lg of j.legs) {
      const p = ph + lg.off;
      lg.hip.rotation.x = lg.baseHip + Math.sin(p) * 0.45 * M;
      lg.knee.rotation.x = lg.baseKnee + Math.max(0, Math.cos(p)) * 0.6 * M;
      lg.ankle.rotation.x = -(lg.baseHip + lg.baseKnee) * 0.5 - Math.sin(p) * 0.2 * M;
    }
    // footsteps
    const s = Math.sign(Math.sin(ph));
    if (M > 0.2 && s !== this.lastStepSign && s !== 0 && !this.dead) {
      this.lastStepSign = s;
      audio.play('stomp', this.pos, 0.7);
      this.game.shake(0.25, this.pos);
      this.game.fx.dust(this.pos.clone().setY(2), 0.8, 4);
      this.game.city.crushCars(this.pos.x, this.pos.z, this.radius);
    }
    j.hips.position.y = (j.hips.userData.baseY ??= j.hips.position.y) - Math.abs(Math.sin(ph)) * 1.2 * M;
    j.hips.rotation.z = Math.sin(ph) * 0.05 * M;
    // breathing
    if (j.torso !== j.hips) {
      j.torso.userData.baseRx ??= j.torso.rotation.x;
      j.torso.rotation.x = j.torso.userData.baseRx + Math.sin(t * 1.5) * 0.03;
      j.torso.rotation.y = 0;
    }
    // arms
    let armSwing = 0;
    const a = this.attack;
    for (const arm of j.arms) {
      let sh = arm.baseSh + Math.sin(ph + (arm.side > 0 ? Math.PI : 0)) * (arm.walker ? 0.5 : 0.25) * M;
      let el = arm.baseEl;
      if (a && (a.type === 'swipe' && (arm.side > 0) === (a.side === 0) || a.type === 'slam')) {
        const k = a.t;
        if (k < 0.45) { sh = arm.baseSh - 2.2 * (k / 0.45); el = arm.baseEl - 0.6 * (k / 0.45); }
        else if (k < 0.6) { const q = (k - 0.45) / 0.15; sh = arm.baseSh - 2.2 + 2.9 * q; el = arm.baseEl - 0.6 + 0.8 * q; }
        else { const q = (k - 0.6) / 0.4; sh = arm.baseSh + 0.7 * (1 - q); el = arm.baseEl + 0.2 * (1 - q); }
        armSwing = 1;
      }
      arm.sh.rotation.x += (sh - arm.sh.rotation.x) * Math.min(1, dt * 18);
      arm.el.rotation.x += (el - arm.el.rotation.x) * Math.min(1, dt * 18);
    }
    // attack body motions
    let jaw = this.state === 'roar' ? this.jawOpen : 0.08 + Math.sin(t * 2) * 0.05;
    let headPitch = this.state === 'roar' ? -this.headUp * 0.7 : 0;
    let spin = 0, lunge = 0;
    if (a) {
      const k = a.t;
      if (a.type === 'bite') { jaw = k < 0.5 ? k * 2 : Math.max(0, 1 - (k - 0.5) * 4); lunge = Math.sin(Math.min(1, k * 1.6) * Math.PI) * 0.35; }
      if (a.type === 'spit') { jaw = Math.sin(k * Math.PI); headPitch = k < 0.5 ? -k * 1.2 : -(1 - k) * 1.2; }
      if (a.type === 'tail') spin = Math.sin(k * Math.PI) * Math.PI * 1.1;
      if (a.type === 'slam') lunge = Math.sin(k * Math.PI) * 0.4;
      if (a.type === 'swipe') lunge = Math.sin(k * Math.PI) * 0.15;
    }
    if (this.state === 'stagger') { headPitch = -0.5 * Math.sin(this.stateT * 4); jaw = 0.7; }
    if (j.jaw) j.jaw.rotation.x = jaw * 0.7;
    if (j.neck[0]) {
      j.neck[0].userData.baseRx ??= j.neck[0].rotation.x;
      j.neck[0].rotation.x = j.neck[0].userData.baseRx + headPitch + lunge;
    }
    if (j.torso !== j.hips) j.torso.rotation.x += lunge * 0.6;
    j.hips.rotation.y = spin;
    // tail sway
    j.tail.forEach((seg, i) => {
      seg.rotation.y = Math.sin(t * 2 - i * 0.7) * 0.12 + (spin ? Math.sin(spin) * 0.25 : 0);
      seg.rotation.x = (i === 0 ? -0.12 : 0.02) + Math.sin(t * 1.3 - i * 0.5) * 0.03;
    });
    if (this.charging > 0) { this.game.fx.dust(this.pos.clone().setY(3), 1, 1); }
    void armSwing;
  }

  remove() {
    this.game.scene.remove(this.root);
    if (this.body) this.game.physics.remove(this.body);
    this.root.traverse((o) => { if (o.material && o.material.dispose) o.material.dispose(); });
  }
}
