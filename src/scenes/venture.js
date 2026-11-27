// The opening of campaign part 5 (Patrick, 2026-11-27): "Venture Stars deliver hundreds of mechs like
// Titans, Rangers and the walking Guardians, hundreds, and they are all on the planet."
import * as THREE from 'three';
import { audio } from '../audio.js';

const $ = (id) => document.getElementById(id);
const T = { ARRIVE: 0, OPEN: 6, DROP: 9, END: 19 };
const MECHS = 420;
const _m = new THREE.Matrix4(), _p = new THREE.Vector3(), _q = new THREE.Quaternion(), _s = new THREE.Vector3();

export class VentureScene {
  constructor(app) {
    this.app = app; this.active = false;
    const s = this.scene = new THREE.Scene();
    s.background = new THREE.Color('#05030a');
    this.camera = new THREE.PerspectiveCamera(46, 1, 1, 40000);
    s.add(new THREE.AmbientLight('#667799', 1.2));
    const sun = new THREE.DirectionalLight('#fff0e0', 2.2); sun.position.set(-500, 400, 800); s.add(sun);
    const n = 2500, pos = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { const v = new THREE.Vector3().randomDirection().multiplyScalar(30000); pos.set([v.x, v.y, v.z], i * 3); }
    const sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    s.add(new THREE.Points(sg, new THREE.PointsMaterial({ color: '#fff', size: 2, sizeAttenuation: false })));
    // the alien planet and its shield, below
    const planet = new THREE.Mesh(new THREE.SphereGeometry(2600, 64, 40), new THREE.MeshStandardMaterial({ color: '#3a2a5a', roughness: 0.85, emissive: '#1a0a2a', emissiveIntensity: 0.9 }));
    planet.position.set(600, -3300, -900); s.add(planet);
    const shield = new THREE.Mesh(new THREE.IcosahedronGeometry(2780, 3), new THREE.MeshBasicMaterial({ color: '#5affc0', wireframe: true, transparent: true, opacity: 0.25 }));
    shield.position.copy(planet.position); s.add(shield); this.shield = shield;
    // three Venture Stars: long white carriers with blue engines and a glowing drop bay underneath
    const white = new THREE.MeshStandardMaterial({ color: '#dfe6f0', metalness: 0.5, roughness: 0.4 });
    const dark = new THREE.MeshStandardMaterial({ color: '#39404e', metalness: 0.6, roughness: 0.5 });
    const blue = new THREE.MeshBasicMaterial({ color: '#5ac8ff' });
    this.bayMat = new THREE.MeshBasicMaterial({ color: '#ffd23a', transparent: true, opacity: 0 });
    this.stars = [];
    for (let i = 0; i < 3; i++) {
      const g = new THREE.Group();
      const hull = new THREE.Mesh(new THREE.BoxGeometry(90, 46, 420), white); g.add(hull);
      const nose = new THREE.Mesh(new THREE.ConeGeometry(46, 130, 4), white); nose.rotation.x = Math.PI / 2; nose.rotation.z = Math.PI / 4; nose.position.z = 270; g.add(nose);
      const bridge = new THREE.Mesh(new THREE.BoxGeometry(50, 30, 70), dark); bridge.position.set(0, 36, -110); g.add(bridge);
      for (const sx of [-1, 1]) { const w = new THREE.Mesh(new THREE.BoxGeometry(110, 8, 150), white); w.position.set(sx * 95, -6, -120); g.add(w); const e = new THREE.Mesh(new THREE.CylinderGeometry(20, 20, 30, 12), blue); e.rotation.x = Math.PI / 2; e.position.set(sx * 70, 0, -222); g.add(e); }
      const stripe = new THREE.Mesh(new THREE.BoxGeometry(92, 8, 300), blue); stripe.position.y = 10; g.add(stripe);
      const bay = new THREE.Mesh(new THREE.BoxGeometry(60, 4, 220), this.bayMat); bay.position.y = -25; g.add(bay);
      g.userData.home = new THREE.Vector3(-330 + i * 330, 120 - i * 70, -200 - i * 260);
      s.add(g); this.stars.push(g);
    }
    // hundreds of mechs: three kinds, drawn as simple shapes
    const box = new THREE.BoxGeometry(1, 1, 1);
    this.mechs = new THREE.InstancedMesh(box, new THREE.MeshStandardMaterial({ roughness: 0.6, metalness: 0.3 }), MECHS);
    this.mechData = [];
    const colors = [new THREE.Color('#2c5aa0'), new THREE.Color('#c9d3df'), new THREE.Color('#f2c230')]; // Titans, Rangers, Guardian Walkers
    for (let i = 0; i < MECHS; i++) {
      const kind = i % 3, ship = i % 3 === 0 ? Math.floor(Math.random() * 3) : (i + 1) % 3;
      this.mechData.push({ ship, kind, ox: (Math.random() - 0.5) * 50, oz: (Math.random() - 0.5) * 200, delay: Math.random() * 6.5, sp: 150 + Math.random() * 120, spin: Math.random() * 6 });
      this.mechs.setColorAt(i, colors[kind]);
    }
    this.mechs.frustumCulled = false;
    s.add(this.mechs);
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
    this.shield.rotation.y = t * 0.02;
    const k = Math.min(1, t / T.OPEN), e = 1 - (1 - k) ** 3;
    this.stars.forEach((g, i) => { g.position.copy(g.userData.home).add(_p.set(0, 0, -2600 * (1 - e))); g.position.y += Math.sin(t * 0.7 + i) * 4; });
    cam.position.set(520 - t * 6, 60 - t * 9, 760 - t * 4);
    cam.lookAt(0, -60 - t * 8, -300);
    if (t < T.OPEN) { if (this.enter('arrive')) { this.say('THE VENTURE STARS', 'carrying every mech the Earth has built'); audio.play('rumble'); audio.play('jet'); } }
    else if (t < T.DROP) { if (this.enter('open')) { this.say('HUNDREDS OF TITANS, RANGERS AND GUARDIAN WALKERS', 'bay doors opening'); audio.play('alarm'); } }
    else if (this.enter('drop')) { this.say('DROP!', 'all of them, onto the alien planet'); audio.play('eject'); audio.play('uiBig'); }
    this.bayMat.opacity = Math.min(1, Math.max(0, (t - T.OPEN) / 2));
    const de = t - T.DROP;
    for (let i = 0; i < MECHS; i++) {
      const d = this.mechData[i], le = de - d.delay, ship = this.stars[d.ship].position;
      if (le <= 0) { this.mechs.setMatrixAt(i, _m.compose(_p.set(0, -99999, 0), _q.identity(), _s.setScalar(0.001))); continue; }
      _p.set(ship.x + d.ox + 80 * le * 0.15, ship.y - 30 - d.sp * le - 20 * le * le, ship.z + d.oz - 40 * le);
      _q.setFromAxisAngle(_s.set(1, 0, 0), 0.3 + Math.sin(d.spin + le) * 0.2);
      // Titans are big and wide, Rangers medium, Guardian Walkers flat with long legs
      _s.set(d.kind === 0 ? 13 : d.kind === 1 ? 9 : 14, d.kind === 0 ? 24 : d.kind === 1 ? 19 : 9, d.kind === 0 ? 10 : d.kind === 1 ? 7 : 14);
      this.mechs.setMatrixAt(i, _m.compose(_p, _q, _s));
    }
    this.mechs.instanceMatrix.needsUpdate = true;
    if (this.mechs.instanceColor) this.mechs.instanceColor.needsUpdate = true;
    if (t >= T.END) this.finish();
  }
}
