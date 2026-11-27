import * as THREE from 'three';
import { audio } from '../audio.js';
import { WORLD } from '../config.js';

export class Pilot {
  constructor(game, cfg, from) {
    this.game = game;
    const suit = new THREE.MeshStandardMaterial({ color: cfg.primary, roughness: 0.5, metalness: 0.3 });
    const white = new THREE.MeshStandardMaterial({ color: '#e8ecf0', roughness: 0.5, metalness: 0.2 });
    const dark = new THREE.MeshStandardMaterial({ color: '#202428', roughness: 0.5, metalness: 0.5 });
    const glow = new THREE.MeshStandardMaterial({ color: '#000', emissive: cfg.glow, emissiveIntensity: 3 });
    const g = new THREE.Group();
    const mk = (geo, mat, x, y, z) => { const o = new THREE.Mesh(geo, mat); o.position.set(x, y, z); o.castShadow = true; g.add(o); return o; };
    mk(new THREE.CapsuleGeometry(0.42, 0.8, 4, 8), suit, 0, 1.25, 0);
    mk(new THREE.SphereGeometry(0.34, 12, 10), white, 0, 2.05, 0);
    mk(new THREE.BoxGeometry(0.42, 0.14, 0.12), glow, 0, 2.08, 0.28);
    mk(new THREE.BoxGeometry(0.6, 0.7, 0.3), dark, 0, 1.35, -0.38);
    this.legL = mk(new THREE.CapsuleGeometry(0.16, 0.65, 4, 6), white, 0.2, 0.45, 0);
    this.legR = mk(new THREE.CapsuleGeometry(0.16, 0.65, 4, 6), white, -0.2, 0.45, 0);
    const gun = new THREE.Group();
    gun.position.set(-0.35, 1.35, 0.35);
    gun.add(new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.18, 0.9), dark));
    g.add(gun);
    this.gun = gun;
    // parachute canopy
    const chute = new THREE.Mesh(new THREE.SphereGeometry(3.2, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshStandardMaterial({ color: '#e86a1a', side: THREE.DoubleSide, roughness: 0.8 }));
    chute.position.y = 7;
    chute.scale.y = 0.5;
    chute.visible = false;
    g.add(chute);
    this.chute = chute;
    g.scale.setScalar(1.3);
    this.root = g;
    game.scene.add(g);
    this.pos = from.clone();
    this.vel = new THREE.Vector3(0, 30, 0);
    this.yaw = 0;
    this.hp = this.maxHp = 100;
    this.dead = false;
    this.onGround = false;
    this.fireCd = 0;
    this.phase = 0;
    this.shots = 0;
    audio.play('eject', this.pos, 1);
  }

  update(dt, input, view) {
    const g = this.game;
    this.yaw = view.yaw;
    const fwd = new THREE.Vector3(Math.sin(this.yaw), 0, Math.cos(this.yaw));
    const right = new THREE.Vector3(-fwd.z, 0, fwd.x);
    let mx = 0, mz = 0;
    if (!this.dead) {
      mz = (input.down('KeyW') ? 1 : 0) - (input.down('KeyS') ? 1 : 0);
      mx = (input.down('KeyD') ? 1 : 0) - (input.down('KeyA') ? 1 : 0);
    }
    const sprint = input.down('ShiftLeft');
    const speed = sprint ? 22 : 13;
    const want = new THREE.Vector3().addScaledVector(fwd, mz).addScaledVector(right, mx);
    if (want.lengthSq() > 0) want.normalize().multiplyScalar(speed);
    const ground = this.groundHeight();
    if (this.onGround) {
      this.vel.x += (want.x - this.vel.x) * Math.min(1, dt * 10);
      this.vel.z += (want.z - this.vel.z) * Math.min(1, dt * 10);
      if (input.pressed('Space') && !this.dead) { this.vel.y = 14; this.onGround = false; }
    } else {
      this.vel.x += (want.x - this.vel.x) * Math.min(1, dt * 1.5);
      this.vel.z += (want.z - this.vel.z) * Math.min(1, dt * 1.5);
      this.vel.y -= 32 * dt;
      // parachute when falling from high up
      const high = this.pos.y - ground > 12;
      if (this.vel.y < -6 && high) this.chuteOpen = true;
      if (this.chuteOpen) this.vel.y = Math.max(this.vel.y, -9);
    }
    this.chute.visible = !!this.chuteOpen && !this.onGround;
    const prev = this.pos.clone();
    this.pos.addScaledVector(this.vel, dt);
    // building walls block you
    for (const b of g.city.near(this.pos.x, this.pos.z, 2)) {
      if (!b.alive) continue;
      for (const p of b.pieces) {
        const top = p.y + p.hy;
        if (this.pos.y > top - 0.5) continue;
        if (Math.abs(this.pos.x - p.x) < p.hx + 0.6 && Math.abs(this.pos.z - p.z) < p.hz + 0.6) {
          this.pos.x = prev.x; this.pos.z = prev.z;
        }
      }
    }
    const gh = this.groundHeight();
    if (this.pos.y <= gh) {
      if (!this.onGround && this.vel.y < -20 && !this.chuteOpen) this.takeDamage(10);
      this.pos.y = gh;
      this.vel.y = 0;
      this.onGround = true;
      this.chuteOpen = false;
    } else if (this.pos.y > gh + 0.3) this.onGround = false;
    const B = g.city.bound;
    this.pos.x = THREE.MathUtils.clamp(this.pos.x, -B, B);
    this.pos.z = THREE.MathUtils.clamp(this.pos.z, -B, B);

    // shooting
    this.fireCd -= dt;
    if (!this.dead && input.mouse(0) && this.fireCd <= 0) this.shoot(view);

    // animation
    const sp = Math.hypot(this.vel.x, this.vel.z);
    this.phase += sp * dt * 0.8;
    const sw = this.onGround ? Math.sin(this.phase) * Math.min(1, sp / 10) * 0.7 : 0.3;
    this.legL.rotation.x = sw; this.legR.rotation.x = -sw;
    this.gun.rotation.x = -view.pitch;
    this.root.position.copy(this.pos);
    this.root.rotation.y = this.yaw;
  }

  groundHeight() { return this.game.city.heightAt(this.pos.x, this.pos.z); }

  shoot() {
    const g = this.game;
    this.fireCd = 0.11;
    this.shots++;
    this.root.updateMatrixWorld(true);
    const from = this.gun.localToWorld(new THREE.Vector3(0, 0, 0.6));
    const dir = g.aimPoint.clone().sub(from).normalize();
    dir.x += (Math.random() - 0.5) * 0.01; dir.y += (Math.random() - 0.5) * 0.01;
    g.projectiles.fire({ pos: from, dir, speed: 900, damage: 0.4, owner: 'pilot', kind: 'tracer', color: '#fff2a0', size: 2.5, radius: 0.8, smash: 0.6, life: 2.5 });
    audio.play('gun', this.pos, 0.6);
    if (this.shots === 15) g.nav.say('pistol', 'Your blaster is like a mosquito bite to a kaiju! Get back in the Jaeger! Walk to it and press F.', 2, 20);
    if (this.shots === 120) g.nav.say('pistol2', 'Still shooting? I admire the effort. The kaiju does not.', 1, 30);
  }

  takeDamage(amount) {
    if (this.dead) return;
    this.hp -= amount;
    this.game.onPilotHit(amount);
    if (this.hp <= 0) { this.hp = 0; this.dead = true; this.game.onPilotDown(); }
  }

  remove() { this.game.scene.remove(this.root); }
}
