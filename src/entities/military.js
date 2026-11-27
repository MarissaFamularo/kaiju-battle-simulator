import * as THREE from 'three';
import { audio } from '../audio.js';

const olive = new THREE.MeshStandardMaterial({ color: '#4a5236', roughness: 0.6, metalness: 0.3 });
const grey = new THREE.MeshStandardMaterial({ color: '#6c747c', roughness: 0.5, metalness: 0.5 });
const darkM = new THREE.MeshStandardMaterial({ color: '#202428', roughness: 0.5, metalness: 0.6 });
const glass = new THREE.MeshStandardMaterial({ color: '#203040', roughness: 0.1, metalness: 0.8 });
const navRed = new THREE.MeshBasicMaterial({ color: '#ff3030' });
const navGreen = new THREE.MeshBasicMaterial({ color: '#30ff60' });

function mesh(geo, mat, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  m.castShadow = true;
  return m;
}

function buildApache() {
  const g = new THREE.Group();
  g.add(mesh(new THREE.CapsuleGeometry(1.6, 7, 4, 8).rotateX(Math.PI / 2), olive, 0, 0, 1));
  g.add(mesh(new THREE.SphereGeometry(1.4, 10, 8), glass, 0, 0.8, 4.2));
  g.add(mesh(new THREE.CylinderGeometry(0.4, 0.8, 9, 6).rotateX(Math.PI / 2), olive, 0, 0.6, -6.5));
  g.add(mesh(new THREE.BoxGeometry(0.3, 2.5, 1.6), olive, 0, 1.6, -10.5));
  g.add(mesh(new THREE.BoxGeometry(5.5, 0.3, 1.4), olive, 0, -0.4, 0.5));
  for (const s of [-1, 1]) {
    g.add(mesh(new THREE.CylinderGeometry(0.45, 0.45, 2.2, 8).rotateX(Math.PI / 2), darkM, s * 2.6, -0.9, 0.5));
  }
  g.add(mesh(new THREE.CylinderGeometry(0.15, 0.15, 2.4, 6).rotateX(Math.PI / 2), darkM, 0, -1.5, 4.5));
  const rotor = new THREE.Group();
  rotor.position.y = 2.2;
  rotor.add(mesh(new THREE.BoxGeometry(15, 0.12, 0.7), darkM));
  rotor.add(mesh(new THREE.BoxGeometry(0.7, 0.12, 15), darkM));
  g.add(rotor);
  const tail = new THREE.Group();
  tail.position.set(0.4, 1.6, -10.6);
  tail.add(mesh(new THREE.BoxGeometry(0.1, 3.6, 0.4), darkM));
  g.add(tail);
  g.add(mesh(new THREE.SphereGeometry(0.25, 6, 4), navRed, -2.8, -0.4, 0.5));
  g.add(mesh(new THREE.SphereGeometry(0.25, 6, 4), navGreen, 2.8, -0.4, 0.5));
  g.scale.setScalar(1.6);
  return { g, rotor, tail };
}

function buildGunship() {
  const g = new THREE.Group();
  g.add(mesh(new THREE.CylinderGeometry(2.6, 2.2, 30, 12).rotateX(Math.PI / 2), grey));
  g.add(mesh(new THREE.SphereGeometry(2.6, 12, 8), grey, 0, 0, 15));
  g.add(mesh(new THREE.BoxGeometry(40, 0.6, 4.5), grey, 0, 1.8, 2));
  g.add(mesh(new THREE.BoxGeometry(13, 0.4, 3), grey, 0, 1.5, -14));
  g.add(mesh(new THREE.BoxGeometry(0.4, 6, 4), grey, 0, 4.5, -14));
  const props = [];
  for (const x of [-14, -7, 7, 14]) {
    g.add(mesh(new THREE.CylinderGeometry(0.9, 0.9, 4, 8).rotateX(Math.PI / 2), darkM, x, 1.2, 4));
    const p = mesh(new THREE.BoxGeometry(4.5, 0.2, 0.3), darkM, x, 1.2, 6.2);
    g.add(p); props.push(p);
  }
  g.add(mesh(new THREE.SphereGeometry(0.3, 6, 4), navRed, -20, 1.8, 2));
  g.add(mesh(new THREE.SphereGeometry(0.3, 6, 4), navGreen, 20, 1.8, 2));
  g.scale.setScalar(1.4);
  return { g, props };
}

function buildJet() {
  const g = new THREE.Group();
  g.add(mesh(new THREE.ConeGeometry(1.2, 6, 8).rotateX(Math.PI / 2), grey, 0, 0, 9));
  g.add(mesh(new THREE.CylinderGeometry(1.2, 1.4, 12, 8).rotateX(Math.PI / 2), grey, 0, 0, 0));
  g.add(mesh(new THREE.SphereGeometry(0.9, 8, 6), glass, 0, 0.9, 5));
  const wing = new THREE.Shape();
  wing.moveTo(0, 4); wing.lineTo(7, -3); wing.lineTo(7, -4.5); wing.lineTo(0, -3); wing.lineTo(-7, -4.5); wing.lineTo(-7, -3); wing.closePath();
  const wg = new THREE.ExtrudeGeometry(wing, { depth: 0.3, bevelEnabled: false }).rotateX(Math.PI / 2);
  g.add(mesh(wg, grey, 0, 0, 0));
  g.add(mesh(new THREE.BoxGeometry(0.3, 3, 2.5), grey, 0, 1.8, -5));
  const flame = new THREE.Mesh(new THREE.ConeGeometry(0.9, 4, 8).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: '#ffb060', transparent: true, opacity: 0.8 }));
  flame.position.z = -8;
  g.add(flame);
  g.scale.setScalar(1.6);
  return { g };
}

export class Military {
  constructor(game) {
    this.game = game;
    this.units = [];
  }

  // Aircraft low enough for kaiju to swat.
  targets() { return this.units.filter((u) => u.type === 'apache' && !u.down && !u.gone); }

  pickKaiju(from) {
    let best = null, bd = Infinity;
    for (const k of this.game.kaijus) {
      if (k.dead || k.emerging) continue;
      const d = k.pos.distanceTo(from);
      if (d < bd) { bd = d; best = k; }
    }
    return best;
  }

  callApaches() {
    const g = this.game;
    const base = g.mech ? g.mech.pos : new THREE.Vector3();
    for (let i = 0; i < 3; i++) {
      const m = buildApache();
      const start = new THREE.Vector3(base.x + (i - 1) * 40, 90, base.z + 1100);
      m.g.position.copy(start);
      g.scene.add(m.g);
      const u = {
        type: 'apache', ...m, pos: m.g.position, vel: new THREE.Vector3(0, 0, -70), life: 32, orbitA: (i / 3) * Math.PI * 2,
        cd: 1 + i * 0.4, gunCd: 0, down: false, gone: false, spin: 0, idx: i,
        destroy: (byKaiju) => this.downUnit(u, byKaiju),
      };
      this.units.push(u);
    }
    audio.play('jet', base, 0.3);
  }

  callGunship() {
    const g = this.game;
    const m = buildGunship();
    const base = g.mech ? g.mech.pos : new THREE.Vector3();
    m.g.position.set(base.x - 1400, 380, base.z);
    g.scene.add(m.g);
    const u = { type: 'gunship', ...m, pos: m.g.position, vel: new THREE.Vector3(110, 0, 0), life: 30, angle: Math.PI, cd: 2, shellCd: 3, down: false, gone: false, destroy: () => {} };
    this.units.push(u);
    audio.play('jet', m.g.position, 0.6);
  }

  callJets(target) {
    const g = this.game;
    const k = target || this.pickKaiju(g.mech ? g.mech.pos : new THREE.Vector3());
    const aim = k ? k.pos.clone() : (g.mech ? g.mech.pos.clone().add(new THREE.Vector3(0, 0, 200)) : new THREE.Vector3());
    const ang = Math.random() * Math.PI * 2;
    const dir = new THREE.Vector3(Math.cos(ang), 0, Math.sin(ang));
    for (let i = 0; i < 3; i++) {
      const m = buildJet();
      const side = new THREE.Vector3(-dir.z, 0, dir.x).multiplyScalar((i - 1) * 30);
      const start = aim.clone().addScaledVector(dir, -1600 - Math.abs(i - 1) * 40).add(side).setY(150 + Math.max(0, g.city.groundAt(aim.x, aim.z)));
      m.g.position.copy(start);
      m.g.lookAt(start.clone().add(dir));
      g.scene.add(m.g);
      const u = { type: 'jet', ...m, pos: m.g.position, vel: dir.clone().multiplyScalar(280), life: 14, aim: aim.clone().add(side), dropped: 0, down: false, gone: false, destroy: () => {}, soundT: 0 };
      this.units.push(u);
    }
    setTimeout(() => audio.play('jet', aim, 1), 3500);
  }

  downUnit(u, byKaiju) {
    if (u.down) return;
    u.down = true;
    u.vel.y = -5;
    u.spin = 6;
    this.game.fx.explosion(u.pos.clone(), 0.6);
    audio.play('smallBoom', u.pos, 1);
    if (byKaiju) this.game.nav.say('heliDown', 'We lost an Apache! Keep the kaiju busy so they can fight.', 1, 12);
  }

  update(dt) {
    const g = this.game;
    let rotorVol = 0;
    for (let i = this.units.length - 1; i >= 0; i--) {
      const u = this.units[i];
      u.life -= dt;
      if (u.type === 'apache') this.updateApache(u, dt);
      else if (u.type === 'gunship') this.updateGunship(u, dt);
      else this.updateJet(u, dt);
      if (u.type === 'apache' && !u.gone) rotorVol = Math.max(rotorVol, audio.vol(u.pos, 0.25, 700));
      if (u.gone) {
        g.scene.remove(u.g);
        this.units.splice(i, 1);
      }
    }
    audio.setLoop('rotor', rotorVol);
  }

  updateApache(u, dt) {
    const g = this.game;
    u.rotor.rotation.y += dt * 30;
    u.tail.rotation.x += dt * 40;
    if (u.down) {
      u.vel.y -= 30 * dt;
      u.pos.addScaledVector(u.vel, dt);
      u.g.rotation.y += u.spin * dt;
      g.fx.smokeTrail(u.pos, 2);
      if (Math.random() < 0.5) g.fx.fire(u.pos, 0.6);
      if (u.pos.y <= 1) {
        g.fx.explosion(u.pos.clone().setY(3), 1);
        audio.play('explosion', u.pos, 0.8);
        g.city.damageArea(u.pos, 15, 120, { source: 'military' });
        u.gone = true;
      }
      return;
    }
    const leaving = u.life <= 0;
    const k = leaving ? null : this.pickKaiju(u.pos);
    let target;
    if (k) {
      u.orbitA += dt * 0.25;
      const r = 150 + u.idx * 25;
      target = new THREE.Vector3(k.pos.x + Math.cos(u.orbitA) * r, k.pos.y + 70 + u.idx * 15 + k.height * 0.3, k.pos.z + Math.sin(u.orbitA) * r);
    } else if (leaving) {
      target = u.pos.clone().add(new THREE.Vector3(0, 60, 600));
      if (u.life < -12) u.gone = true;
    } else {
      const m = g.mech ? g.mech.pos : new THREE.Vector3();
      target = new THREE.Vector3(m.x + Math.cos(u.orbitA) * 120, 90, m.z + Math.sin(u.orbitA) * 120);
      u.orbitA += dt * 0.2;
    }
    const to = target.clone().sub(u.pos);
    const want = to.clampLength(0, 80);
    u.vel.lerp(want, Math.min(1, dt * 1.2));
    u.pos.addScaledVector(u.vel, dt);
    // face target kaiju (or travel direction)
    const look = k ? k.pos.clone().setY(u.pos.y) : u.pos.clone().add(u.vel.clone().setY(0));
    const desired = Math.atan2(look.x - u.pos.x, look.z - u.pos.z);
    let dy = desired - u.g.rotation.y; dy = Math.atan2(Math.sin(dy), Math.cos(dy));
    u.g.rotation.y += dy * Math.min(1, dt * 3);
    u.g.rotation.x = THREE.MathUtils.clamp(u.vel.length() / 80 * 0.25, 0, 0.3);
    if (k) {
      u.cd -= dt; u.gunCd -= dt;
      const dist = u.pos.distanceTo(k.pos);
      if (u.cd <= 0 && dist < 450 && Math.abs(dy) < 0.4) {
        u.cd = 1.6 + Math.random() * 0.6;
        const tgt = k.hitCache[Math.floor(Math.random() * Math.min(3, k.hitCache.length))].p;
        const dir = tgt.clone().sub(u.pos).normalize();
        g.projectiles.fire({ pos: u.pos.clone().add(new THREE.Vector3(0, -2, 0)), dir, speed: 260, damage: 9, owner: 'military', kind: 'missile', boom: 0.45, radius: 4, smash: 0.5 });
        audio.play('missile', u.pos, 0.6);
      }
      if (u.gunCd <= 0 && dist < 380) {
        u.gunCd = 0.1;
        const tgt = k.hitCache[1] ? k.hitCache[1].p : k.pos;
        const dir = tgt.clone().sub(u.pos).add(new THREE.Vector3((Math.random() - 0.5) * 10, (Math.random() - 0.5) * 10, (Math.random() - 0.5) * 10)).normalize();
        g.projectiles.fire({ pos: u.pos.clone(), dir, speed: 700, damage: 0.6, owner: 'military', kind: 'tracer', color: '#ffd070', size: 5, radius: 2, smash: 0.3 });
        if (Math.random() < 0.3) audio.play('minigun', u.pos, 0.4);
      }
    }
  }

  updateGunship(u, dt) {
    const g = this.game;
    for (const p of u.props) p.rotation.z += dt * 40;
    const leaving = u.life <= 0;
    const k = leaving ? null : this.pickKaiju(u.pos);
    const c = k ? k.pos : (g.mech ? g.mech.pos : new THREE.Vector3());
    const r = 320;
    if (!leaving) {
      // fly toward orbit then circle counter-clockwise (left side facing center)
      const off = u.pos.clone().sub(c).setY(0);
      const dist = off.length();
      const tangent = new THREE.Vector3(-off.z, 0, off.x).normalize();
      const radial = off.normalize().multiplyScalar((r - dist) * 0.02);
      const want = tangent.add(radial).normalize().multiplyScalar(110);
      if (dist > r * 1.8) want.copy(c.clone().sub(u.pos).setY(0).normalize().multiplyScalar(110));
      u.vel.lerp(want, Math.min(1, dt * 0.8));
    } else if (u.life < -15) u.gone = true;
    u.pos.addScaledVector(u.vel, dt);
    u.pos.y += (380 + Math.max(0, g.city.groundAt(c.x, c.z)) - u.pos.y) * dt;
    u.g.rotation.y = Math.atan2(u.vel.x, u.vel.z);
    u.g.rotation.z = leaving ? 0 : -0.25;
    if (k && u.pos.distanceTo(k.pos) < r * 1.6) {
      u.cd -= dt; u.shellCd -= dt;
      if (u.cd <= 0) {
        u.cd = 0.12;
        const tgt = k.hitCache[Math.floor(Math.random() * k.hitCache.length)].p;
        const dir = tgt.clone().sub(u.pos).add(new THREE.Vector3((Math.random() - 0.5) * 16, 0, (Math.random() - 0.5) * 16)).normalize();
        g.projectiles.fire({ pos: u.pos.clone(), dir, speed: 800, damage: 1.5, owner: 'military', kind: 'tracer', color: '#ff9a40', size: 7, radius: 3, smash: 0.5 });
        if (Math.random() < 0.4) audio.play('minigun', u.pos, 0.5);
      }
      if (u.shellCd <= 0) {
        u.shellCd = 2.5;
        const tgt = k.pos.clone().setY(k.pos.y + k.height * 0.4);
        const dir = tgt.sub(u.pos).normalize();
        g.projectiles.fire({ pos: u.pos.clone(), dir, speed: 500, damage: 28, owner: 'military', kind: 'shell', boom: 1, radius: 6, smash: 1 });
        audio.play('smallBoom', u.pos, 0.4);
      }
    }
  }

  updateJet(u, dt) {
    const g = this.game;
    u.pos.addScaledVector(u.vel, dt);
    const along = u.pos.clone().sub(u.aim).dot(u.vel.clone().normalize());
    if (along > -520 && along < -60 && u.dropped < 6) {
      // bombs keep flying forward ~270m while falling, so release early
      const due = Math.floor((along + 520) / 76);
      while (u.dropped <= due && u.dropped < 6) {
        u.dropped++;
        g.projectiles.fire({ pos: u.pos.clone().add(new THREE.Vector3(0, -3, 0)), dir: u.vel.clone().normalize(), speed: 150, damage: 70, owner: 'military', kind: 'shell', boom: 1.6, radius: 8, gravity: -90, smash: 4, life: 6 });
      }
    }
    if (Math.random() < 0.6) g.fx.smokeTrail(u.pos.clone().addScaledVector(u.vel.clone().normalize(), -12), 0.6);
    if (u.life <= 0) u.gone = true;
  }

  clear() {
    for (const u of this.units) this.game.scene.remove(u.g);
    this.units.length = 0;
    audio.setLoop('rotor', 0);
  }
}
