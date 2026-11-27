import * as THREE from 'three';
import { FRAMES, WEAPONS, WORLD, CHESTS } from '../config.js';
import { buildMech, poseBay } from './mechModel.js';
import { audio } from '../audio.js';

const POSES = {
  // columns: t, shoulderX, shoulderZ(outward), elbow, torsoTwist(toward this arm's side)
  rest: [0.1, 0, -0.35, 0],
  sword: [[0, 0.1, 0, -0.35, 0], [0.35, -2.75, 0.55, -1.0, 0.5], [0.55, -0.55, -0.55, -0.12, -0.65], [1, 0.1, 0, -0.35, 0]],
  blades: [[0, 0.1, 0, -0.35, 0], [0.3, -0.9, 0.25, -1.9, 0.35], [0.5, -1.6, -0.08, -0.05, -0.4], [1, 0.1, 0, -0.35, 0]],
  fist: [[0, 0.1, 0, -0.35, 0], [0.38, -0.55, 0.2, -2.3, 0.65], [0.5, -1.62, -0.05, 0.0, -0.55], [1, 0.1, 0, -0.35, 0]],
};

function samplePose(keys, t) {
  for (let i = 0; i < keys.length - 1; i++) {
    const a = keys[i], b = keys[i + 1];
    if (t >= a[0] && t <= b[0]) {
      let k = (t - a[0]) / (b[0] - a[0]);
      k = k * k * (3 - 2 * k);
      return [a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k, a[3] + (b[3] - a[3]) * k, a[4] + (b[4] - a[4]) * k];
    }
  }
  return keys[keys.length - 1].slice(1);
}

const _v = new THREE.Vector3();
const _w = new THREE.Vector3();

export class Mech {
  constructor(game, cfg) {
    this.game = game;
    this.cfg = cfg;
    this.frame = FRAMES[cfg.frame];
    this.model = buildMech(cfg);
    this.root = this.model.root;
    this.scale = this.frame.scale;
    this.root.scale.setScalar(this.scale);
    game.scene.add(this.root);
    this.pos = new THREE.Vector3();
    this.vel = new THREE.Vector3();
    this.vy = 0;
    this.yaw = 0;
    this.onGround = true;
    this.airTime = 0;
    this.maxHp = this.hp = Math.round(this.frame.armor * (CHESTS[cfg.chest]?.armor || 1));
    this.bayT = -1;      // Missile Bay volley timer (-1 = closed)
    this.bayShots = 0;
    this.energy = 100;
    this.radius = 9 * this.scale;
    this.height = 56 * this.scale;
    this.piloted = true;
    this.dead = false;
    this.walkPhase = 0;
    this.lastStepSign = 1;
    this.moveAmt = 0;
    this.hurtFlash = 0;
    this.arms = {
      L: this.makeArm(cfg.left, 1),
      R: this.makeArm(cfg.right, -1),
    };
    this.body = game.physics.kinematicBall(0, 10, 0, 11 * this.scale);
    this.lean = 0;
    this.twist = 0;
  }

  makeArm(wid, side) {
    return { w: WEAPONS[wid], side, t: -1, cd: 0, hitDone: false, aimT: 0, bladeOut: 0, lastUse: -10, pose: [...POSES.rest] };
  }

  get forward() { return _v.set(Math.sin(this.yaw), 0, Math.cos(this.yaw)); }

  chestPos(out = new THREE.Vector3()) { return out.set(this.pos.x, this.pos.y + 40 * this.scale, this.pos.z); }

  setPosition(x, y, z) {
    this.pos.set(x, y, z);
    this.root.position.copy(this.pos);
    this.body.setNextKinematicTranslation({ x, y: y + 11 * this.scale, z });
  }

  update(dt, input, view) {
    const g = this.game;
    const time = g.time;
    let moveX = 0, moveZ = 0, sprint = false, jump = false;
    if (this.piloted && !this.dead && input) {
      moveZ = (input.down('KeyW') ? 1 : 0) - (input.down('KeyS') ? 1 : 0);
      moveX = (input.down('KeyD') ? 1 : 0) - (input.down('KeyA') ? 1 : 0);
      sprint = input.down('ShiftLeft') || input.down('ShiftRight');
      jump = input.pressed('Space');
      // face the camera direction
      let dy = view.yaw - this.yaw;
      dy = Math.atan2(Math.sin(dy), Math.cos(dy));
      this.yaw += dy * Math.min(1, dt * 8);
    }
    const fwd = _v.set(Math.sin(this.yaw), 0, Math.cos(this.yaw));
    const right = _w.set(-fwd.z, 0, fwd.x);
    const len = Math.hypot(moveX, moveZ);
    let speed = this.frame.speed;
    const canSprint = sprint && this.energy > 1 && moveZ >= 0 && len > 0;
    if (canSprint) { speed *= 1.75; this.energy = Math.max(0, this.energy - 28 * dt); }
    else this.energy = Math.min(100, this.energy + 16 * dt);
    if (this.pos.z < g.city.waterEdge) speed *= 0.75;
    const target = new THREE.Vector3();
    if (len > 0) {
      target.addScaledVector(fwd, moveZ / len).addScaledVector(right, moveX / len).multiplyScalar(speed);
      if (moveZ < 0) target.multiplyScalar(0.7);
    }
    // smashing through buildings slows you down
    const over = g.city.overlapping(this.pos.x, this.pos.z, this.radius);
    if (over.length) target.multiplyScalar(canSprint ? 0.6 : 0.4);
    const accel = this.onGround ? 5 : 1.5;
    this.vel.lerp(target, Math.min(1, dt * accel));
    this.pos.addScaledVector(this.vel, dt);

    // building contact damage
    const sp = this.vel.length();
    if (over.length && sp > 3) {
      for (const b of over) {
        const pt = new THREE.Vector3(
          THREE.MathUtils.clamp(this.pos.x, b.x - b.hw, b.x + b.hw), Math.min(25 * this.scale, b.h * 0.5),
          THREE.MathUtils.clamp(this.pos.z, b.z - b.hd, b.z + b.hd));
        const dmg = sp * dt * (canSprint ? 12 : 7) * this.frame.power;
        g.city.damage(b, dmg, Math.random() < dt * 6 ? pt : null, this.vel.clone().normalize(), { source: 'mech', force: canSprint ? 1.6 : 1 });
      }
    }

    // jumping
    if (jump && this.onGround) {
      this.vy = 46;
      this.onGround = false;
      this.airTime = 0;
      audio.play('punch', this.pos, 0.8);
      g.fx.groundDust(this.pos, 30, 16);
    }
    if (!this.onGround) {
      this.vy -= 75 * dt;
      this.pos.y += this.vy * dt;
      this.airTime += dt;
      if (this.pos.y <= 0) {
        this.pos.y = 0;
        this.onGround = true;
        this.land();
      }
    }

    // push away from kaiju
    for (const k of g.kaijus) {
      if (k.dead || k.emerging) continue;
      const dx = this.pos.x - k.pos.x, dz = this.pos.z - k.pos.z;
      const d = Math.hypot(dx, dz), min = this.radius + k.radius;
      if (d < min && d > 0.01) {
        const push = (min - d);
        this.pos.x += dx / d * push * 0.6; this.pos.z += dz / d * push * 0.6;
        k.pos.x -= dx / d * push * 0.4; k.pos.z -= dz / d * push * 0.4;
      }
    }
    // world bounds
    const B = WORLD.bound;
    this.pos.x = THREE.MathUtils.clamp(this.pos.x, -B, B);
    this.pos.z = THREE.MathUtils.clamp(this.pos.z, -B - 250, B);

    // attacks
    if (this.piloted && !this.dead && input) {
      if (input.mouse(0)) this.tryAttack('L', view);
      if (input.mouse(2)) this.tryAttack('R', view);
    }
    for (const k of ['L', 'R']) this.updateArm(k, dt, view, time);

    this.animate(dt, view);
    this.root.position.copy(this.pos);
    this.root.rotation.y = this.yaw;
    if (this.dead) {
      // topple over backwards
      this.deadT = (this.deadT || 0) + dt;
      const k = Math.min(1, this.deadT / 2.2);
      this.root.rotation.x = -k * k * 1.45;
      if (k >= 1 && !this.crashed) {
        this.crashed = true;
        const p = this.pos.clone().addScaledVector(this.forward, -30 * this.scale).setY(4);
        g.fx.groundDust(p, 120, 50);
        g.city.damageArea(p, 40, 600, { source: 'mech' });
        audio.play('explosion', p, 1.2);
        g.shake(2, p);
      }
    }
    this.body.setNextKinematicTranslation({ x: this.pos.x, y: this.pos.y + 11 * this.scale, z: this.pos.z });
    this.hurtFlash = Math.max(0, this.hurtFlash - dt * 3);
    this.model.mats.glow.emissiveIntensity = 2.6 + Math.sin(time * 4) * 0.6 + this.hurtFlash * 6;
    this.updateBay(dt);
  }

  // ---- Missile Bay (E key) ----
  launchMissiles() {
    if (!this.model.bay || this.dead || !this.piloted) return false;
    this.bayT = 0;
    this.bayShots = 8;
    audio.play('blade', this.pos, 0.8); // doors opening
    return true;
  }

  updateBay(dt) {
    const j = this.model.j;
    if (j.reactorSpin) j.reactorSpin.rotation.z += dt * 3;
    const bay = this.model.bay;
    if (!bay) return;
    if (this.bayT >= 0) {
      this.bayT += dt;
      let n = 8 - this.bayShots;
      while (this.bayShots > 0 && this.bayT >= 0.45 + n * 0.11) { this.fireMissile(n); this.bayShots--; n++; }
      if (this.bayT > 2.4) this.bayT = -1;
    }
    poseBay(bay, dt, this.bayT >= 0 ? 1 : 0);
  }

  fireMissile(k) {
    const g = this.game;
    const bay = this.model.bay;
    this.root.updateMatrixWorld(true);
    const from = bay.muzzles[k % bay.muzzles.length].getWorldPosition(new THREE.Vector3());
    let target = g.aimInfo && g.aimInfo.kaiju && !g.aimInfo.kaiju.dead ? g.aimInfo.kaiju : null;
    if (!target) {
      let best = Infinity;
      for (const q of g.kaijus) {
        if (q.dead || q.emerging) continue;
        const d = q.pos.distanceTo(this.pos);
        if (d < best && d < 1400) { best = d; target = q; }
      }
    }
    const dir = this.forward.clone().multiplyScalar(0.75)
      .add(new THREE.Vector3((Math.random() - 0.5) * 0.5, 0.55 + Math.random() * 0.3, (Math.random() - 0.5) * 0.5)).normalize();
    g.projectiles.fire({
      pos: from, dir, speed: 150, damage: 34 * this.frame.power, owner: 'player', kind: 'missile',
      boom: 0.75, radius: 6, smash: 1.3, life: 6, target, aimIdx: k,
    });
    g.fx.glow(from, '#ffb060', 40, 0.15);
    audio.play('missile', this.pos, 0.9);
  }

  land() {
    const g = this.game;
    const power = Math.min(1.6, 0.4 + this.airTime);
    audio.play('stomp', this.pos, 1.2);
    audio.play('smallBoom', this.pos, 0.6 * power);
    g.fx.groundDust(this.pos, 60 * power, 40);
    g.fx.ring(this.pos, 5, 90 * power, 0.7, '#ffe0b0', 0.5);
    g.shake(1.2 * power);
    g.city.damageArea(new THREE.Vector3(this.pos.x, 5, this.pos.z), 34 * this.scale * power, 140 * power * this.frame.power, { source: 'mech', force: 1.5 });
    g.city.impulseDebris(this.pos, 80, 40 * power);
    g.city.crushCars(this.pos.x, this.pos.z, 30 * power);
    for (const k of g.kaijus) {
      if (k.dead) continue;
      if (k.pos.distanceTo(this.pos) < 55 * power + k.radius) {
        k.takeDamage(22 * power * this.frame.power, k.pos.clone().setY(10), new THREE.Vector3().subVectors(k.pos, this.pos).normalize(), { stagger: 0.6, source: 'mech' });
      }
    }
  }

  tryAttack(key, view) {
    const a = this.arms[key];
    if (a.cd > 0 || a.t >= 0) return;
    a.cd = a.w.cooldown;
    a.lastUse = this.game.time;
    if (a.w.kind === 'ranged') {
      a.aimT = 1.2;
      this.fireCannon(key);
    } else {
      a.t = 0;
      a.hitDone = false;
      audio.play(a.w.id === 'fist' ? 'punch' : 'swing', this.pos, 0.9);
    }
  }

  fireCannon(key) {
    const g = this.game;
    const a = this.arms[key];
    const mz = this.model.muzzle[key];
    this.root.updateMatrixWorld(true);
    const from = mz.getWorldPosition(new THREE.Vector3());
    // keep projectiles from spawning inside a building we're hugging
    const aim = g.aimPoint.clone();
    const dir = aim.sub(from).normalize();
    g.projectiles.fire({
      pos: from, dir, speed: a.w.speed, damage: a.w.damage * this.frame.power, owner: 'player',
      color: this.cfg.glow, size: 12, smash: a.w.smash, radius: 6,
    });
    g.fx.glow(from, this.cfg.glow, 60, 0.12);
    g.fx.flash(from, this.cfg.glow, 2500, 0.15);
    audio.play('plasma', this.pos, 0.9);
  }

  updateArm(key, dt, view, time) {
    const a = this.arms[key];
    a.cd = Math.max(0, a.cd - dt);
    a.aimT = Math.max(0, a.aimT - dt);
    let target;
    if (a.t >= 0) {
      const dur = Math.max(0.24, a.w.cooldown * 0.85);
      a.t += dt / dur;
      if (a.t >= 0.5 && !a.hitDone) { a.hitDone = true; this.meleeHit(key, view); }
      if (a.t >= 1) a.t = -1;
      target = samplePose(POSES[a.w.id], Math.min(1, Math.max(0, a.t)));
      // aim the swing up/down with the camera
      target[0] -= view.pitch * 0.6 * Math.sin(Math.PI * Math.min(1, Math.max(0, a.t)));
    } else if (a.aimT > 0 && a.w.kind === 'ranged') {
      target = [-Math.PI / 2 - view.pitch * 0.9, -0.12, -0.05, 0.15];
    } else {
      const swing = Math.sin(this.walkPhase) * 0.4 * this.moveAmt * a.side;
      target = [0.1 + swing, 0.05, -0.35 - this.moveAmt * 0.2, 0];
    }
    const k = Math.min(1, dt * (a.t >= 0 ? 30 : 10));
    for (let i = 0; i < 4; i++) a.pose[i] += (target[i] - a.pose[i]) * k;
    const j = this.model.j;
    j['shoulder' + key].rotation.x = a.pose[0];
    j['shoulder' + key].rotation.z = a.pose[1] * a.side;
    j['elbow' + key].rotation.x = a.pose[2];
    // blade extension
    const blade = this.model.blades[key];
    if (blade) {
      const want = (a.t >= 0 || time - a.lastUse < 2.5) ? 1 : 0;
      if (want && a.bladeOut < 0.05) audio.play('blade', this.pos, 0.7);
      a.bladeOut += (want - a.bladeOut) * Math.min(1, dt * (want ? 14 : 4));
      blade.scale.y = Math.max(0.02, a.bladeOut);
      blade.visible = a.bladeOut > 0.03;
      if (blade.visible && a.t >= 0.35 && a.t <= 0.6) {
        // swing trail
        const tip = new THREE.Vector3(0, a.w.id === 'sword' ? -36 : -18, 0);
        blade.localToWorld(tip);
        this.game.fx.trail(tip, this.cfg.glow, 22);
      }
    }
  }

  meleeHit(key, view) {
    const g = this.game;
    const a = this.arms[key];
    const w = a.w;
    const s = this.scale;
    const fwd = new THREE.Vector3(Math.sin(this.yaw), 0, Math.cos(this.yaw));
    const h = THREE.MathUtils.clamp(40 * s + view.pitch * 55, 6, 80);
    const point = this.pos.clone().addScaledVector(fwd, w.reach * s).setY(this.pos.y + h);
    const dmg = w.damage * this.frame.power;
    const res = g.hitKaiju(point, w.radius * s, dmg, fwd, { knockback: w.knockback || 8, source: 'mech', stagger: w.id === 'fist' ? 0.8 : 0.25 });
    const hb = g.city.damageArea(point, w.radius * s * 0.8, dmg * w.smash, { source: 'mech', force: w.id === 'fist' ? 2.2 : 1.3 });
    g.city.impulseDebris(point, 40, 30);
    if (res) {
      g.shake(res.weak ? 0.9 : 0.5);
      g.hitstop(res.weak ? 0.08 : 0.04);
      audio.play(res.weak ? 'weak' : 'hit', point, 1);
      if (w.id !== 'fist') g.fx.sparks(res.point, 26, 'blue');
      else { g.fx.explosion(res.point, 0.5); }
    }
  }

  animate(dt, view) {
    const j = this.model.j;
    // local velocity for walk direction
    const fwd = Math.sin(this.yaw) * this.vel.x + Math.cos(this.yaw) * this.vel.z;
    const sp = this.vel.length();
    const amt = Math.min(1.3, sp / this.frame.speed);
    this.moveAmt += (amt - this.moveAmt) * Math.min(1, dt * 6);
    const dir = fwd < -1 ? -1 : 1;
    const stride = 15 * this.scale;
    if (this.onGround) this.walkPhase += dir * (sp * dt / stride) * Math.PI;
    const ph = this.walkPhase, A = this.moveAmt;
    if (this.onGround) {
      const hipL = Math.sin(ph) * 0.55 * A;
      const kneeL = Math.max(0, -Math.cos(ph) * dir) * 1.0 * A;
      const kneeR = Math.max(0, Math.cos(ph) * dir) * 1.0 * A;
      j.legL.rotation.x = -hipL;
      j.legR.rotation.x = hipL;
      j.kneeL.rotation.x = kneeL;
      j.kneeR.rotation.x = kneeR;
      j.ankleL.rotation.x = -(-hipL + kneeL) * 0.6;
      j.ankleR.rotation.x = -(hipL + kneeR) * 0.6;
      j.hips.position.y = 27 - Math.abs(Math.sin(ph)) * 1.4 * A + 0.4 * A;
      // footsteps
      const s = Math.sign(Math.sin(ph));
      if (A > 0.15 && s !== this.lastStepSign && s !== 0) {
        this.lastStepSign = s;
        this.footstep(s > 0 ? -1 : 1);
      }
    } else {
      const k = Math.min(1, this.airTime * 4);
      j.legL.rotation.x = -0.5 * k; j.legR.rotation.x = -0.2 * k;
      j.kneeL.rotation.x = 1.0 * k; j.kneeR.rotation.x = 0.6 * k;
      j.hips.position.y = 27;
    }
    // torso: lean with speed, twist from attacks
    let twist = 0;
    for (const key of ['L', 'R']) twist += this.arms[key].pose[3] * this.arms[key].side;
    this.twist += (twist - this.twist) * Math.min(1, dt * 12);
    j.torso.rotation.y = this.twist;
    j.torso.rotation.x = 0.08 * A * dir;
    j.torso.rotation.z = Math.sin(ph) * 0.03 * A;
    j.chest.rotation.x = -view.pitch * 0.25;
    j.head.rotation.x = -view.pitch * 0.35;
  }

  footstep(side) {
    const g = this.game;
    const f = new THREE.Vector3(Math.cos(this.yaw) * side * 6.5 * this.scale, 0, -Math.sin(this.yaw) * side * 6.5 * this.scale).add(this.pos);
    audio.play('stomp', f, 0.55);
    g.fx.dust(f.setY(2), 0.5, 5);
    g.shake(0.15);
    g.city.crushCars(f.x, f.z, 8 * this.scale);
    if (f.z < g.city.waterEdge) for (let i = 0; i < 6; i++) g.fx.steam(f, 0.4);
  }

  takeDamage(amount, from) {
    if (this.dead) return;
    this.hp -= amount;
    this.hurtFlash = 1;
    const p = this.chestPos();
    this.game.fx.sparks(p, 30);
    if (from) {
      const push = new THREE.Vector3().subVectors(this.pos, from).setY(0).normalize().multiplyScalar(amount * 0.25);
      this.vel.add(push);
    }
    this.game.onMechHit(amount);
    if (this.hp <= 0) {
      this.hp = 0;
      this.dead = true;
      this.game.onMechDestroyed();
    }
  }

  remove() {
    this.game.scene.remove(this.root);
    this.game.physics.remove(this.body);
  }
}
