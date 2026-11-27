// The funny sneak-in (campaign part 4, Patrick 2026-11-27): "one of the missions has us sneak in to the
// tripods' base under the earth in its core. Could you make, when they sneak in, a funny animation?"
// The Jaeger tiptoes past a guard tripod wearing a terrible tripod costume.
import * as THREE from 'three';
import { audio } from '../audio.js';
import { buildMech } from '../entities/mechModel.js';

const $ = (id) => document.getElementById(id);
const T = { IN: 0, CAUGHT: 5, BEEP: 8.5, OK: 12.5, HAT: 15.5, RUN: 20.5, END: 23.5 };
const ease = (k) => { k = Math.min(1, Math.max(0, k)); return k * k * (3 - 2 * k); };

export class SneakScene {
  constructor(app) {
    this.app = app;
    this.active = false;
    const s = this.scene = new THREE.Scene();
    s.background = new THREE.Color('#12060a');
    s.fog = new THREE.Fog('#12060a', 300, 900);
    this.camera = new THREE.PerspectiveCamera(42, 1, 1, 3000);
    s.add(new THREE.AmbientLight('#aa7766', 1.1));
    const key = new THREE.DirectionalLight('#ffd0b0', 1.6); key.position.set(120, 260, 300); s.add(key);
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(3000, 900), new THREE.MeshStandardMaterial({ color: '#2a1a1c', roughness: 0.95 }));
    floor.rotation.x = -Math.PI / 2; s.add(floor);
    const wall = new THREE.Mesh(new THREE.PlaneGeometry(3000, 500), new THREE.MeshStandardMaterial({ color: '#1c0f12', roughness: 1 }));
    wall.position.set(0, 250, -220); s.add(wall);
    const glow = new THREE.MeshBasicMaterial({ color: '#ff6a2a' });
    for (let i = 0; i < 9; i++) { const p = new THREE.Mesh(new THREE.CylinderGeometry(4, 7, 200 + (i % 3) * 60, 8), glow); p.position.set(-520 + i * 130, 100, -180 + (i % 2) * 30); s.add(p); }
    // the guard: a simple cartoon tripod
    const g = this.guard = new THREE.Group();
    const metal = new THREE.MeshStandardMaterial({ color: '#8b93a6', metalness: 0.6, roughness: 0.4, emissive: '#1a2030', emissiveIntensity: 0.6 });
    const body = new THREE.Mesh(new THREE.SphereGeometry(16, 24, 16), metal); body.scale.set(1, 0.55, 1); body.position.y = 70; g.add(body);
    for (let i = 0; i < 3; i++) { const a = (i / 3) * 6.28 + 0.5; const leg = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 1.2, 76, 8), metal); leg.position.set(Math.cos(a) * 14, 36, Math.sin(a) * 14); leg.rotation.set(Math.sin(a) * 0.22, 0, -Math.cos(a) * 0.22); g.add(leg); }
    this.guardHead = new THREE.Group(); this.guardHead.position.y = 66; g.add(this.guardHead);
    const hood = new THREE.Mesh(new THREE.SphereGeometry(8, 16, 12), metal); hood.scale.set(1.2, 0.6, 1); hood.position.z = 15; this.guardHead.add(hood);
    this.guardLights = new THREE.MeshBasicMaterial({ color: '#bfefff' });
    for (let i = 0; i < 5; i++) { const l = new THREE.Mesh(new THREE.CircleGeometry(1.1, 12), this.guardLights); l.position.set((i - 2) * 3, 0, 23.2); this.guardHead.add(l); }
    this.beamMat = new THREE.MeshBasicMaterial({ color: '#bfefff', transparent: true, opacity: 0.13, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending });
    const cone = new THREE.ConeGeometry(46, 190, 20, 1, true); cone.translate(0, -95, 0);
    const beam = new THREE.Mesh(cone, this.beamMat); beam.position.z = 22; beam.rotation.x = -1.15; this.guardHead.add(beam);
    g.position.set(110, 0, -70);
    s.add(g);
    this.restYaw = 0.9;       // looking away, to the right
    this.mechRoot = null;
  }

  // the worst tripod costume ever: a pot-lid saucer, three stick legs, and lights drawn on
  costume() {
    const hat = new THREE.Group();
    const lid = new THREE.Mesh(new THREE.SphereGeometry(9, 18, 10), new THREE.MeshStandardMaterial({ color: '#b9a27a', roughness: 0.9 })); lid.scale.set(1, 0.35, 1); hat.add(lid);
    const knob = new THREE.Mesh(new THREE.SphereGeometry(1.6, 8, 6), new THREE.MeshStandardMaterial({ color: '#6a5a40' })); knob.position.y = 3.6; hat.add(knob);
    const stick = new THREE.MeshStandardMaterial({ color: '#8a6a3a', roughness: 1 });
    for (let i = 0; i < 3; i++) { const a = (i / 3) * 6.28; const l = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 13, 6), stick); l.position.set(Math.cos(a) * 7.5, -6, Math.sin(a) * 7.5); l.rotation.z = Math.cos(a) * 0.3; hat.add(l); }
    const dot = new THREE.MeshBasicMaterial({ color: '#ffe14a' });
    for (let i = 0; i < 5; i++) { const d = new THREE.Mesh(new THREE.CircleGeometry(0.9, 10), dot); d.position.set((i - 2) * 2.4, 0.6, 8.6); hat.add(d); }
    return hat;
  }

  start(cfg, onDone) {
    this.onDone = onDone; this.t = 0; this.beat = ''; this.active = true;
    if (this.mechRoot) this.scene.remove(this.mechRoot);
    this.mech = buildMech(cfg);
    this.mechRoot = this.mech.root;
    this.mechRoot.rotation.y = Math.PI / 2;   // walking to the right
    this.scene.add(this.mechRoot);
    this.hat = this.costume();
    this.scene.add(this.hat);
    this.hatOff = 0;
    this.app.nav.clear(); this.app.nav.show(false);
    this.app.game.hud.show(false);
    audio.stopLoops();
    $('cine').classList.add('show');
    this.update(0);
  }

  say(big, small) { const el = $('cine-title'); el.innerHTML = `${big}<small>${small || ''}</small>`; el.style.opacity = big ? 1 : 0; }
  enter(b) { if (this.beat === b) return false; this.beat = b; return true; }
  skip() { if (this.active) this.finish(); }

  finish() {
    if (!this.active) return;
    this.active = false;
    $('cine').classList.remove('show');
    $('cine-title').style.opacity = 0;
    const done = this.onDone; this.onDone = null;
    if (done) done();
  }

  // exaggerated tiptoe: high knees, hands up like a cartoon burglar
  tiptoe(phase, amt, hands = 1) {
    const j = this.mech.j;
    const hip = Math.sin(phase) * 0.55 * amt;
    const kL = Math.max(0, -Math.cos(phase)) * 1.5 * amt, kR = Math.max(0, Math.cos(phase)) * 1.5 * amt;
    j.legL.rotation.x = -hip - kL * 0.4; j.legR.rotation.x = hip - kR * 0.4;
    j.kneeL.rotation.x = kL; j.kneeR.rotation.x = kR;
    j.ankleL.rotation.x = 0.5 * amt; j.ankleR.rotation.x = 0.5 * amt;
    j.hips.position.y = 27 + Math.abs(Math.sin(phase)) * 2.2 * amt;
    j.torso.rotation.x = 0.22 * amt;
    for (const k of ['L', 'R']) { j['shoulder' + k].rotation.x = -1.1 * hands; j['elbow' + k].rotation.x = -1.5 * hands; }
  }

  update(dt) {
    if (!this.active) return;
    const t = this.t += dt, cam = this.camera, j = this.mech.j, root = this.mechRoot;
    cam.aspect = window.innerWidth / window.innerHeight; cam.updateProjectionMatrix();
    cam.position.set(10, 48, 300); cam.lookAt(10, 44, 0);
    let x = -270, headYaw = this.restYaw, lights = '#bfefff';
    root.rotation.z = 0; j.head.rotation.y = 0;
    if (t < T.CAUGHT) {
      if (this.enter('in')) this.say('THE SECRET TUNNEL', 'shhh... nobody will notice a thing');
      const k = t / T.CAUGHT;
      x = -270 + k * 215;
      this.tiptoe(t * 3.2, 1);
      if (Math.sin(t * 3.2) > 0.98) audio.play('smallStep', null, 0.3);
    } else if (t < T.BEEP) {
      // the guard turns and looks straight at it. The Jaeger freezes with one leg in the air.
      if (this.enter('caught')) { this.say('GUARD TRIPOD:  "?"', 'uh oh'); audio.play('horn', null, 0.35); }
      x = -55;
      headYaw = this.restYaw + (-2.4 - this.restYaw) * ease((t - T.CAUGHT) / 0.8);
      lights = '#ffd23a';
      this.tiptoe(1.2, 1); // frozen mid-step
    } else if (t < T.OK) {
      if (this.enter('beep')) { this.say('JAEGER:  "BEEP BOOP. I AM DEFINITELY A TRIPOD."', 'very convincing'); audio.play('ui'); }
      x = -55; headYaw = -2.4; lights = '#ffd23a';
      this.tiptoe(1.2, 1);
      root.rotation.z = Math.sin(t * 9) * 0.07;   // a stiff little robot wiggle
      if (Math.sin(t * 9) > 0.97) audio.play('ui');
    } else if (t < T.HAT) {
      if (this.enter('ok')) { this.say('GUARD TRIPOD:  "...OK."', ''); audio.play('uiBig'); }
      x = -55;
      headYaw = -2.4 + (this.restYaw + 2.4) * ease((t - T.OK) / 1.2);
      this.tiptoe(1.2, 1);
    } else if (t < T.RUN) {
      const e = t - T.HAT;
      // tiptoe on... and the costume falls off with a clang
      if (e < 1.6) { if (this.enter('on')) this.say('', ''); x = -55 + e * 45; this.tiptoe(t * 3.2, 1); }
      else {
        x = 17;
        if (this.enter('hat')) { this.say('CLANG!', ''); audio.play('bonk'); this.hatOff = 0.001; }
        if (e > 2.6 && this.enter2('zzz')) { this.say('GUARD TRIPOD:  "Zzzzz"', 'phew. it is asleep'); }
        this.tiptoe(1.2, 0.6);
        j.head.rotation.y = e < 2.6 ? -0.9 : 0.9;     // looks at the guard, then at the hat
        if (e > 3.6) this.hatOff = Math.max(0, this.hatOff - dt * 2.2); else this.hatOff = Math.min(1, this.hatOff + dt * 2.5);
      }
    } else {
      if (this.enter('run')) { this.say('INSIDE THE CORE', 'go go go'); audio.play('eject'); }
      const e = t - T.RUN;
      x = 17 + e * e * 130;
      this.tiptoe(t * 16, 0.9, 0.3);
      if (t >= T.END) { this.finish(); return; }
    }
    root.position.set(x, 0, 0);
    this.guardHead.rotation.y = headYaw;
    this.guardLights.color.set(lights); this.beamMat.color.set(lights);
    // the costume sits on the head, unless it has fallen off
    root.updateMatrixWorld(true);
    const top = j.head.getWorldPosition(new THREE.Vector3()); top.y += 9;
    const k = ease(this.hatOff || 0);
    this.hat.position.set(top.x + k * 26, top.y * (1 - k) + 4 * k, top.z + k * 30);
    this.hat.rotation.set(k * 2.6, 0, k * 0.8);
  }

  enter2(key) { if (this['_' + key]) return false; this['_' + key] = true; setTimeout(() => { this['_' + key] = false; }, 8000); return true; }
}
