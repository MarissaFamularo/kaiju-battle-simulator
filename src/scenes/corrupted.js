// The opening of campaign part 6 (Patrick, 2026-11-27): "some baby tripods, then they make more tripods,
// and when the humans get back they see Earth was corrupted."
import * as THREE from 'three';
import { audio } from '../audio.js';
import { planetVert, planetFrag } from './drop.js';

const $ = (id) => document.getElementById(id);
const T = { HOME: 0, SEE: 5.5, WHY: 10.5, END: 17 };

export class CorruptedScene {
  constructor(app) {
    this.app = app; this.active = false;
    const s = this.scene = new THREE.Scene();
    s.background = new THREE.Color('#020308');
    this.camera = new THREE.PerspectiveCamera(46, 1, 1, 40000);
    const sunDir = new THREE.Vector3(0.5, 0.35, 0.8).normalize();
    s.add(new THREE.AmbientLight('#556677', 1));
    const sun = new THREE.DirectionalLight('#fff4e0', 2.2); sun.position.copy(sunDir).multiplyScalar(1000); s.add(sun);
    const n = 2500, pos = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { const v = new THREE.Vector3().randomDirection().multiplyScalar(30000); pos.set([v.x, v.y, v.z], i * 3); }
    const sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    s.add(new THREE.Points(sg, new THREE.PointsMaterial({ color: '#fff', size: 2, sizeAttenuation: false })));
    // the Earth...
    this.earthMat = new THREE.ShaderMaterial({ vertexShader: planetVert, fragmentShader: planetFrag, uniforms: { uSun: { value: sunDir }, uTime: { value: 0 } } });
    this.earth = new THREE.Mesh(new THREE.SphereGeometry(900, 96, 64), this.earthMat); s.add(this.earth);
    // ...and what has grown over it: purple veins, green glowing nests, and a sick haze
    this.veins = new THREE.Mesh(new THREE.IcosahedronGeometry(906, 5), new THREE.MeshBasicMaterial({ color: '#b04aff', wireframe: true, transparent: true, opacity: 0 }));
    s.add(this.veins);
    this.haze = new THREE.Mesh(new THREE.SphereGeometry(960, 48, 32), new THREE.MeshBasicMaterial({ color: '#5aff8a', transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }));
    s.add(this.haze);
    this.nests = new THREE.Group();
    const nestMat = new THREE.MeshBasicMaterial({ color: '#7dffb0' });
    for (let i = 0; i < 70; i++) { const m = new THREE.Mesh(new THREE.SphereGeometry(10 + Math.random() * 26, 8, 6), nestMat); m.position.copy(new THREE.Vector3().randomDirection().multiplyScalar(904)); this.nests.add(m); }
    s.add(this.nests);
    // a Venture Star coming home
    const white = new THREE.MeshStandardMaterial({ color: '#dfe6f0', metalness: 0.5, roughness: 0.4 }), blue = new THREE.MeshBasicMaterial({ color: '#5ac8ff' });
    const g = this.star = new THREE.Group();
    g.add(new THREE.Mesh(new THREE.BoxGeometry(60, 30, 280), white));
    const nose = new THREE.Mesh(new THREE.ConeGeometry(30, 90, 4), white); nose.rotation.x = Math.PI / 2; nose.rotation.z = Math.PI / 4; nose.position.z = 180; g.add(nose);
    for (const sx of [-1, 1]) { const w = new THREE.Mesh(new THREE.BoxGeometry(70, 6, 100), white); w.position.set(sx * 62, -4, -80); g.add(w); const e = new THREE.Mesh(new THREE.CylinderGeometry(13, 13, 20, 12), blue); e.rotation.x = Math.PI / 2; e.position.set(sx * 46, 0, -148); g.add(e); }
    s.add(g);
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
    this.earth.rotation.y = this.veins.rotation.y = this.nests.rotation.y = t * 0.04;
    // the ship flies in from behind the camera toward the Earth
    this.star.position.set(260, 120, 3200 - t * 95);
    this.star.rotation.y = Math.PI;
    // at first the camera is behind the ship and the Earth looks normal; then it comes around to the other side
    const k = Math.min(1, Math.max(0, (t - T.SEE + 1.5) / 4)), e = k * k * (3 - 2 * k);
    const sick = Math.min(1, Math.max(0, (t - T.SEE) / 2.5));
    this.veins.material.opacity = sick * 0.55;
    this.haze.material.opacity = sick * (0.13 + Math.sin(t * 2) * 0.03);
    this.nests.visible = sick > 0.05;
    this.nests.scale.setScalar(0.96 + sick * 0.04);
    cam.position.set(700 - e * 1500, 380 + e * 200, 3600 - t * 70);
    cam.lookAt(0, 0, 0);
    if (t < T.SEE) { if (this.enter('home')) { this.say('HOME', 'the Venture Stars are back at last'); audio.play('jet'); } }
    else if (t < T.WHY) { if (this.enter('see')) { this.say('...WHAT HAPPENED TO THE EARTH?', 'it is covered in something'); audio.play('alarm'); audio.play('horn'); } }
    else if (this.enter('why')) { this.say('THE BABY TRIPODS GOT HERE FIRST', 'they grew up. they built more. the Earth is corrupted.'); audio.play('rumble'); }
    if (t >= T.END) this.finish();
  }
}
