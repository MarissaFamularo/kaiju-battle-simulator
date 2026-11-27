// The end of campaign part 4 (Patrick, 2026-11-27): "Could the end of the last mission be a message from
// the aliens, and it says: we're still alive, our base is on another planet with a shield, we're coming."
import * as THREE from 'three';
import { audio } from '../audio.js';

const $ = (id) => document.getElementById(id);
const LINES = ['WE ARE STILL ALIVE.', 'OUR BASE IS ON ANOTHER PLANET.', 'IT HAS A SHIELD.', 'WE ARE COMING.'];
const T = { STATIC: 0, TYPE: 3.5, CARD: 19, END: 24.5 };
const PER_LINE = 3.6;      // seconds each line gets
const SHIPS = 260;
const _m = new THREE.Matrix4(), _p = new THREE.Vector3(), _s = new THREE.Vector3();

export class AlienMessage {
  constructor(app) {
    this.app = app;
    this.active = false;
    const s = this.scene = new THREE.Scene();
    s.background = new THREE.Color('#020503');
    this.camera = new THREE.PerspectiveCamera(46, 1, 1, 40000);
    s.add(new THREE.AmbientLight('#335544', 1));
    const sun = new THREE.DirectionalLight('#c8ffe0', 2); sun.position.set(-600, 300, 700); s.add(sun);
    const n = 2500, pos = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { const v = new THREE.Vector3().randomDirection().multiplyScalar(30000); pos.set([v.x, v.y, v.z], i * 3); }
    const sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    s.add(new THREE.Points(sg, new THREE.PointsMaterial({ color: '#9fffc8', size: 2, sizeAttenuation: false })));
    // their other planet, under a shield
    this.planet = new THREE.Mesh(new THREE.SphereGeometry(600, 64, 40), new THREE.MeshStandardMaterial({ color: '#3a2a5a', roughness: 0.85, emissive: '#1a0a2a', emissiveIntensity: 0.9 }));
    const cities = new THREE.Mesh(new THREE.IcosahedronGeometry(603, 4), new THREE.MeshBasicMaterial({ color: '#7dffb0', wireframe: true, transparent: true, opacity: 0.12 }));
    this.planet.add(cities);
    s.add(this.planet);
    this.shieldMat = new THREE.MeshBasicMaterial({ color: '#5affc0', transparent: true, opacity: 0.16, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
    this.shield = new THREE.Mesh(new THREE.SphereGeometry(760, 48, 32), this.shieldMat); s.add(this.shield);
    this.gridMat = new THREE.MeshBasicMaterial({ color: '#9fffd8', wireframe: true, transparent: true, opacity: 0.22, depthWrite: false });
    this.grid = new THREE.Mesh(new THREE.IcosahedronGeometry(764, 2), this.gridMat); s.add(this.grid);
    // the new fleet lifting off
    const hull = new THREE.ConeGeometry(7, 34, 6); hull.rotateX(Math.PI / 2);
    this.ships = new THREE.InstancedMesh(hull, new THREE.MeshBasicMaterial({ color: '#c8ffe0' }), SHIPS);
    this.shipData = [];
    for (let i = 0; i < SHIPS; i++) { const a = Math.random() * 6.28, r = Math.sqrt(Math.random()) * 520; this.shipData.push({ x: Math.cos(a) * r, y: Math.sin(a) * r * 0.7, delay: Math.random() * 3.5, sp: 380 + Math.random() * 300, size: 0.8 + Math.random() * 1.8 }); }
    this.ships.frustumCulled = false;
    s.add(this.ships);
    // the message itself: green text on a flickering screen
    const el = this.el = document.createElement('div');
    el.style.cssText = 'position:fixed;inset:0;z-index:30;display:none;flex-direction:column;align-items:center;justify-content:center;pointer-events:none;text-align:center;font-family:monospace;color:#7dffb0;text-shadow:0 0 14px #2aff8a;background:repeating-linear-gradient(0deg,rgba(0,0,0,.22) 0 2px,rgba(0,0,0,0) 2px 5px)';
    el.innerHTML = '<div id="am-head" style="font:700 min(3.2vw,22px) Orbitron,monospace;letter-spacing:.35em;color:#ff5a3a;text-shadow:0 0 12px #ff3a1a;margin-bottom:5vh"></div><div id="am-text" style="font-weight:700;font-size:min(5.4vw,46px);line-height:1.5;letter-spacing:.08em;min-height:6em;max-width:92vw"></div><div id="am-foot" style="margin-top:4vh;font:700 min(2.6vw,18px) Orbitron,monospace;letter-spacing:.3em;color:#fff;opacity:0;transition:opacity 1.2s"></div>';
    document.body.appendChild(el);
  }

  start(onDone) {
    this.onDone = onDone; this.t = 0; this.active = true; this.shown = -1; this.beat = '';
    this.el.style.display = 'flex';
    this.el.querySelector('#am-text').textContent = '';
    this.el.querySelector('#am-foot').style.opacity = 0;
    this.app.nav.clear();
    this.app.game.hud.show(false);
    audio.stopLoops();
    this.update(0);
  }

  skip() { if (this.active) this.finish(); }
  finish() {
    if (!this.active) return;
    this.active = false;
    this.el.style.display = 'none';
    const done = this.onDone; this.onDone = null;
    if (done) done();
  }
  enter(b) { if (this.beat === b) return false; this.beat = b; return true; }

  update(dt) {
    if (!this.active) return;
    const t = this.t += dt, cam = this.camera;
    cam.aspect = window.innerWidth / window.innerHeight; cam.updateProjectionMatrix();
    const head = this.el.querySelector('#am-head'), text = this.el.querySelector('#am-text'), foot = this.el.querySelector('#am-foot');
    // slow push in on the shielded planet
    const k = Math.min(1, t / T.CARD);
    cam.position.set(900 - k * 300, 300 - k * 80, 3300 - k * 1100);
    cam.lookAt(0, 0, 0);
    this.planet.rotation.y = t * 0.03;
    this.grid.rotation.y = -t * 0.05; this.grid.rotation.x = t * 0.02;
    this.shieldMat.opacity = 0.13 + Math.sin(t * 2.2) * 0.05;
    this.gridMat.opacity = 0.18 + Math.sin(t * 3.1 + 1) * 0.08;
    this.el.style.opacity = 0.9 + Math.random() * 0.1; // screen flicker
    if (t < T.TYPE) {
      if (this.enter('static')) { audio.play('alarm'); }
      head.textContent = Math.floor(t * 2.5) % 2 ? 'INCOMING TRANSMISSION' : '';
      text.textContent = '';
    } else {
      head.textContent = 'MESSAGE FROM THE ALIENS';
      // type the lines out one letter at a time
      const e = t - T.TYPE;
      let out = '';
      LINES.forEach((line, i) => {
        const le = e - i * PER_LINE;
        if (le <= 0) return;
        const chars = Math.min(line.length, Math.floor(le * 16));
        out += line.slice(0, chars) + (chars < line.length ? '_' : '') + '\n';
        if (i > this.shown) { this.shown = i; audio.play(i === LINES.length - 1 ? 'horn' : 'uiBig'); }
      });
      text.style.whiteSpace = 'pre-line';
      text.textContent = out;
      if (Math.floor(e * 16) !== this.lastTick && e < LINES.length * PER_LINE) { this.lastTick = Math.floor(e * 16); if (this.lastTick % 3 === 0) audio.play('ui'); }
    }
    // "WE ARE COMING": the ships rise through the shield, toward the camera
    const launch = t - (T.TYPE + (LINES.length - 1) * PER_LINE);
    const toCam = _p.copy(cam.position).normalize();
    for (let i = 0; i < SHIPS; i++) {
      const d = this.shipData[i];
      const le = Math.max(0, launch - d.delay);
      const right = new THREE.Vector3().crossVectors(toCam, new THREE.Vector3(0, 1, 0)).normalize(), up = new THREE.Vector3().crossVectors(right, toCam);
      const p = new THREE.Vector3().copy(toCam).multiplyScalar(620 + le * d.sp).addScaledVector(right, d.x).addScaledVector(up, d.y);
      const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), toCam);
      this.ships.setMatrixAt(i, _m.compose(p, q, _s.setScalar(le > 0 ? d.size : 0.0001)));
    }
    this.ships.instanceMatrix.needsUpdate = true;
    if (t >= T.CARD) {
      if (this.enter('card')) { foot.textContent = 'TO BE CONTINUED IN PART 5'; foot.style.opacity = 1; audio.play('horn'); }
    }
    if (t >= T.END) this.finish();
  }
}
