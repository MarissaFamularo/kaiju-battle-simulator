// The opening of Chapter 2 (Patrick, 2026-11-27): a new alien, "the Tri Legion. They make tripods and have
// star destroyers." And "in this chapter the moon wakes up."
import * as THREE from 'three';
import { audio } from '../audio.js';
import { planetVert, planetFrag } from './drop.js';

const $ = (id) => document.getElementById(id);
const T = { QUIET: 0, ARRIVE: 4, MADE: 9, FIRE: 14, WAKE: 17, END: 25 };
const MOON = new THREE.Vector3(1500, 500, -600);

// A Tri Legion Star Destroyer: three long prongs around a burning core. (Our own design.)
export function buildStarDestroyer(scale = 1) {
  const g = new THREE.Group();
  const dark = new THREE.MeshStandardMaterial({ color: '#2a0a10', metalness: 0.7, roughness: 0.4, emissive: '#1a0206', emissiveIntensity: 1 });
  const gold = new THREE.MeshStandardMaterial({ color: '#d8a83a', metalness: 0.8, roughness: 0.3, emissive: '#3a2606', emissiveIntensity: 1 });
  const fire = new THREE.MeshBasicMaterial({ color: '#ff3a1a' });
  g.add(new THREE.Mesh(new THREE.SphereGeometry(26, 20, 14), fire));
  const ring = new THREE.Mesh(new THREE.TorusGeometry(40, 5, 8, 30), gold); g.add(ring);
  for (let i = 0; i < 3; i++) {
    const arm = new THREE.Group(); arm.rotation.z = (i / 3) * Math.PI * 2;
    const prong = new THREE.Mesh(new THREE.BoxGeometry(22, 150, 16), dark); prong.position.y = 110; arm.add(prong);
    const tip = new THREE.Mesh(new THREE.ConeGeometry(15, 60, 4), gold); tip.position.y = 214; arm.add(tip);
    const vein = new THREE.Mesh(new THREE.BoxGeometry(5, 140, 18), fire); vein.position.y = 110; arm.add(vein);
    g.add(arm);
  }
  g.scale.setScalar(scale);
  return g;
}

export class LegionScene {
  constructor(app) {
    this.app = app; this.active = false;
    const s = this.scene = new THREE.Scene();
    s.background = new THREE.Color('#030208');
    this.camera = new THREE.PerspectiveCamera(46, 1, 1, 40000);
    const sunDir = new THREE.Vector3(-0.5, 0.35, 0.8).normalize();
    s.add(new THREE.AmbientLight('#667788', 1.1));
    const sun = new THREE.DirectionalLight('#fff4e0', 2.2); sun.position.copy(sunDir).multiplyScalar(1000); s.add(sun);
    const n = 2500, pos = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { const v = new THREE.Vector3().randomDirection().multiplyScalar(30000); pos.set([v.x, v.y, v.z], i * 3); }
    const sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    s.add(new THREE.Points(sg, new THREE.PointsMaterial({ color: '#fff', size: 2, sizeAttenuation: false })));
    this.earthMat = new THREE.ShaderMaterial({ vertexShader: planetVert, fragmentShader: planetFrag, uniforms: { uSun: { value: sunDir }, uTime: { value: 0 } } });
    const earth = new THREE.Mesh(new THREE.SphereGeometry(900, 96, 64), this.earthMat); earth.position.set(-900, -700, -400); s.add(earth);
    // the Moon... which turns out to be alive
    const moon = this.moon = new THREE.Group(); moon.position.copy(MOON);
    moon.add(new THREE.Mesh(new THREE.SphereGeometry(330, 48, 32), new THREE.MeshStandardMaterial({ color: '#b8b8c4', roughness: 0.95 })));
    const crater = new THREE.MeshStandardMaterial({ color: '#8a8a98', roughness: 1 });
    for (let i = 0; i < 16; i++) { const c = new THREE.Mesh(new THREE.CircleGeometry(18 + Math.random() * 40, 16), crater); const d = new THREE.Vector3().randomDirection(); c.position.copy(d).multiplyScalar(331); c.lookAt(d.multiplyScalar(700)); moon.add(c); }
    this.cracks = new THREE.Mesh(new THREE.IcosahedronGeometry(333, 2), new THREE.MeshBasicMaterial({ color: '#ffe27a', wireframe: true, transparent: true, opacity: 0 })); moon.add(this.cracks);
    // its eye: closed until it wakes
    this.eye = new THREE.Group();
    const white = new THREE.Mesh(new THREE.SphereGeometry(120, 28, 18), new THREE.MeshBasicMaterial({ color: '#ff8a2a' })); white.scale.z = 0.25; this.eye.add(white);
    const pupil = new THREE.Mesh(new THREE.SphereGeometry(52, 20, 14), new THREE.MeshBasicMaterial({ color: '#12060a' })); pupil.scale.set(0.55, 1, 0.3); pupil.position.z = 26; this.eye.add(pupil);
    this.pupil = pupil;
    // the eye is on the side of the Moon that faces the camera
    const CAM0 = new THREE.Vector3(-900, 300, 2000);
    const toCam = CAM0.clone().sub(MOON).normalize();
    moon.add(this.eye);
    s.add(moon);
    this.eye.position.copy(toCam).multiplyScalar(300);
    moon.updateMatrixWorld(true);
    this.eye.lookAt(CAM0);
    this.toCam = toCam;
    // three Star Destroyers
    this.ships = [];
    for (let i = 0; i < 3; i++) { const d = buildStarDestroyer(1.5 + (i === 1 ? 0.6 : 0)); d.userData.home = new THREE.Vector3(-700 + i * 520, 120 + Math.abs(i - 1) * 200, 700 - i * 150); s.add(d); this.ships.push(d); }
    this.flash = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 12), new THREE.MeshBasicMaterial({ color: '#ff8a6a', transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false })); s.add(this.flash);
    const bg = new THREE.CylinderGeometry(1, 1, 1, 10, 1, true); bg.translate(0, 0.5, 0);
    this.beam = new THREE.Mesh(bg, new THREE.MeshBasicMaterial({ color: '#ff3a1a', transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending, depthWrite: false })); s.add(this.beam);
    // the tripods that are left fly in beside them: they have teamed up
    this.pods = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 8, 6), new THREE.MeshBasicMaterial({ color: '#8b93a6' }), 60);
    this.pods.frustumCulled = false; s.add(this.pods);
  }

  start(onDone) {
    this.onDone = onDone; this.t = 0; this.beat = ''; this.active = true;
    this.app.nav.clear(); this.app.nav.show(false); this.app.game.hud.show(false); audio.stopLoops();
    $('cine').classList.add('show');
    this.update(0);
  }
  say(big, small) { const el = $('cine-title'); el.innerHTML = `${big}<small>${small || ''}</small>`; el.style.opacity = big ? 1 : 0; }
  enter(b) { if (this.beat === b) return false; this.beat = b; return true; }
  skip() { if (this.active) this.finish(); }
  finish() {
    if (!this.active) return;
    this.active = false;
    $('cine').classList.remove('show'); $('cine-title').style.opacity = 0;
    const done = this.onDone; this.onDone = null;
    if (done) done();
  }

  update(dt) {
    if (!this.active) return;
    const t = this.t += dt, cam = this.camera;
    cam.aspect = window.innerWidth / window.innerHeight; cam.updateProjectionMatrix();
    this.earthMat.uniforms.uTime.value += dt;
    this.moon.rotation.y = Math.sin(t * 0.1) * 0.05;
    // wide at first; then it closes in on the Moon as it wakes
    const zoom = Math.min(1, Math.max(0, (t - T.FIRE - 1) / 3)), zk = zoom * zoom * (3 - 2 * zoom);
    const wide = new THREE.Vector3(-1400 + t * 14, 200 + t * 4, 2200 - t * 16), close = MOON.clone().addScaledVector(this.toCam, 1150).add(new THREE.Vector3(-120, 40, 0));
    cam.position.copy(wide).lerp(close, zk);
    cam.lookAt(new THREE.Vector3(500, 300, -200).lerp(MOON, zk));
    // the destroyers snap in out of nowhere
    const k = Math.min(1, Math.max(0, (t - T.ARRIVE) / 1.2)), e = 1 - (1 - k) ** 4;
    this.ships.forEach((d, i) => {
      d.visible = t >= T.ARRIVE;
      d.position.copy(d.userData.home).add(new THREE.Vector3(-9000 * (1 - e), 0, 3000 * (1 - e)));
      d.rotation.z = t * 0.15 + i; d.lookAt(MOON); d.rotateZ(t * 0.2 + i * 2);
    });
    this.flash.material.opacity = t >= T.ARRIVE ? Math.max(0, 1 - (t - T.ARRIVE) * 1.2) : 0;
    this.flash.position.copy(this.ships[1].userData.home); this.flash.scale.setScalar(300 + (t - T.ARRIVE) * 900);
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3(), p = new THREE.Vector3();
    for (let i = 0; i < 60; i++) {
      const on = t >= T.MADE - 1 ? Math.min(1, (t - T.MADE + 1) / 2) : 0;
      p.set(-500 + (i % 12) * 150 - (1 - on) * 6000, 120 + Math.floor(i / 12) * 70 + Math.sin(t + i) * 8, 900 - Math.floor(i / 12) * 90);
      this.pods.setMatrixAt(i, m.compose(p, q, sc.set(14, 7, 14).multiplyScalar(on > 0 ? 1 : 0.001)));
    }
    this.pods.instanceMatrix.needsUpdate = true;
    // one destroyer fires on the Moon
    const firing = t >= T.FIRE && t < T.WAKE + 1.5;
    this.beam.visible = firing;
    if (firing) {
      const from = this.ships[1].position, to = MOON.clone().addScaledVector(this.toCam, 250).add(new THREE.Vector3(120, -150, 0));
      this.beam.position.copy(from);
      this.beam.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), to.clone().sub(from).normalize());
      const w = 14 + Math.sin(t * 50) * 4;
      this.beam.scale.set(w, from.distanceTo(to) * Math.min(1, (t - T.FIRE) * 3), w);
    }
    // ...and the Moon wakes up
    const wake = Math.min(1, Math.max(0, (t - T.WAKE) / 2.5));
    this.cracks.material.opacity = Math.min(0.7, Math.max(0, (t - T.FIRE - 1) / 3));
    this.eye.scale.set(1, Math.max(0.02, wake * wake * (3 - 2 * wake)), 1);
    this.pupil.position.x = Math.sin(Math.max(0, t - T.WAKE - 2.5) * 1.4) * 40; // it looks around
    if (t < T.ARRIVE) { if (this.enter('quiet')) { this.say('A NEW THREAT', 'the Earth is at peace... for now'); } }
    else if (t < T.MADE) { if (this.enter('arrive')) { this.say('THE TRI LEGION', 'and their Star Destroyers'); audio.play('thunder'); audio.play('horn'); audio.play('alarm'); } }
    else if (t < T.FIRE) { if (this.enter('made')) { this.say('"WE MADE THE TRIPODS."', 'and the tripods that are left have joined them'); audio.play('uiBig'); } }
    else if (t < T.WAKE) { if (this.enter('fire')) { this.say('THEY ARE FIRING ON THE MOON!', ''); audio.play('plasma'); audio.play('laser'); } }
    else if (this.enter('wake')) { this.say('...AND THE MOON WAKES UP', 'it was never just a rock. and it is angry.'); audio.play('rumble'); audio.play('roar'); }
    if (t >= T.END) this.finish();
  }
}
