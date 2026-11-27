// The ending of campaign part 2 (Patrick, 2026-11-27): a laser is shot at the enemy planet and
// destroys it, but then hundreds of ships are coming. "And then part three begins."
import * as THREE from 'three';
import { audio } from '../audio.js';
import { planetVert, planetFrag } from './drop.js';

const $ = (id) => document.getElementById(id);
// beat times in seconds
const T = { CHARGE: 0, FIRE: 5, BOOM: 8, FLEET: 14, CARD: 23, END: 28.5 };
const EARTH_R = 600;
const CANNON = new THREE.Vector3(0.78, 0.5, 0.38).normalize().multiplyScalar(EARTH_R);
const ENEMY = new THREE.Vector3(7200, 2600, 2400);
const ENEMY_R = 520;
const SHIPS = 420, CHUNKS = 170;
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _s = new THREE.Vector3(), _p = new THREE.Vector3();
const ease = (k) => { k = Math.min(1, Math.max(0, k)); return k * k * (3 - 2 * k); };

export class Outro {
  constructor(app) {
    this.app = app;
    this.active = false;
    const s = this.scene = new THREE.Scene();
    s.background = new THREE.Color('#000');
    this.camera = new THREE.PerspectiveCamera(48, 1, 1, 60000);
    const sunDir = new THREE.Vector3(0.5, 0.4, 0.75).normalize();
    s.add(new THREE.AmbientLight('#445577', 0.9));
    const sun = new THREE.DirectionalLight('#fff4e0', 2.4); sun.position.copy(sunDir).multiplyScalar(1000); s.add(sun);
    // stars
    const n = 3500, pos = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { const v = new THREE.Vector3().randomDirection().multiplyScalar(40000); pos.set([v.x, v.y, v.z], i * 3); }
    const sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    s.add(new THREE.Points(sg, new THREE.PointsMaterial({ color: '#fff', size: 2, sizeAttenuation: false })));
    // the Earth, with the cannon the survivors built
    this.earthMat = new THREE.ShaderMaterial({ vertexShader: planetVert, fragmentShader: planetFrag, uniforms: { uSun: { value: sunDir }, uTime: { value: 0 } } });
    s.add(new THREE.Mesh(new THREE.SphereGeometry(EARTH_R, 96, 64), this.earthMat));
    const cannon = this.cannon = new THREE.Group();
    cannon.position.copy(CANNON);
    cannon.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), ENEMY.clone().sub(CANNON).normalize());
    const metal = new THREE.MeshStandardMaterial({ color: '#aeb6c6', metalness: 0.7, roughness: 0.35, emissive: '#1a2030', emissiveIntensity: 0.6 });
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(7, 12, 70, 16), metal); barrel.position.y = 30; cannon.add(barrel);
    const base = new THREE.Mesh(new THREE.SphereGeometry(20, 16, 12), metal); cannon.add(base);
    for (const y of [18, 38, 58]) { const r = new THREE.Mesh(new THREE.TorusGeometry(11, 1.6, 8, 24), new THREE.MeshBasicMaterial({ color: '#38d8ff' })); r.rotation.x = Math.PI / 2; r.position.y = y; cannon.add(r); }
    this.glow = new THREE.Mesh(new THREE.SphereGeometry(1, 20, 14), new THREE.MeshBasicMaterial({ color: '#9fe8ff', transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false }));
    this.glow.position.y = 70; cannon.add(this.glow);
    s.add(cannon);
    this.muzzle = CANNON.clone().add(ENEMY.clone().sub(CANNON).normalize().multiplyScalar(70));
    // the laser
    const len = this.muzzle.distanceTo(ENEMY);
    const bg = new THREE.CylinderGeometry(1, 1, 1, 14, 1, true); bg.translate(0, 0.5, 0);
    this.beam = new THREE.Mesh(bg, new THREE.MeshBasicMaterial({ color: '#bff3ff', transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending, depthWrite: false }));
    this.beam.position.copy(this.muzzle);
    this.beam.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), ENEMY.clone().sub(this.muzzle).normalize());
    this.beamLen = len;
    s.add(this.beam);
    // the enemy planet
    this.enemy = new THREE.Mesh(new THREE.SphereGeometry(ENEMY_R, 64, 40), new THREE.MeshStandardMaterial({ color: '#7a2438', roughness: 0.8, emissive: '#3a0a18', emissiveIntensity: 0.9 }));
    this.enemy.position.copy(ENEMY);
    const veins = new THREE.Mesh(new THREE.IcosahedronGeometry(ENEMY_R * 1.004, 3), new THREE.MeshBasicMaterial({ color: '#7dffb0', wireframe: true, transparent: true, opacity: 0.25 }));
    this.enemy.add(veins);
    s.add(this.enemy);
    this.flash = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 16), new THREE.MeshBasicMaterial({ color: '#fff', transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }));
    this.flash.position.copy(ENEMY); s.add(this.flash);
    this.ring = new THREE.Mesh(new THREE.RingGeometry(0.92, 1, 64), new THREE.MeshBasicMaterial({ color: '#ffd9a0', transparent: true, opacity: 0, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false }));
    this.ring.position.copy(ENEMY); s.add(this.ring);
    // what is left of it
    this.chunks = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 0), new THREE.MeshStandardMaterial({ color: '#6a2030', roughness: 0.9, emissive: '#ff5a2a', emissiveIntensity: 0.5, flatShading: true }), CHUNKS);
    this.chunkData = [];
    for (let i = 0; i < CHUNKS; i++) this.chunkData.push({ dir: new THREE.Vector3().randomDirection(), sp: 120 + Math.random() * 520, size: 14 + Math.random() * 70, spin: new THREE.Vector3().randomDirection(), rate: Math.random() * 2 });
    s.add(this.chunks);
    // hundreds of ships, coming from far behind where the planet was
    const hull = new THREE.ConeGeometry(9, 46, 6); hull.rotateX(Math.PI / 2);
    this.ships = new THREE.InstancedMesh(hull, new THREE.MeshStandardMaterial({ color: '#8b93a6', metalness: 0.6, roughness: 0.4, emissive: '#2a1020', emissiveIntensity: 1 }), SHIPS);
    this.engines = new THREE.InstancedMesh(new THREE.SphereGeometry(8, 8, 6), new THREE.MeshBasicMaterial({ color: '#ff5a30' }), SHIPS);
    this.fleetDir = CANNON.clone().sub(ENEMY).normalize(); // they fly at the Earth
    const side = new THREE.Vector3().crossVectors(this.fleetDir, new THREE.Vector3(0, 1, 0)).normalize(), up = new THREE.Vector3().crossVectors(side, this.fleetDir);
    this.shipData = [];
    for (let i = 0; i < SHIPS; i++) {
      const a = Math.random() * 6.28, r = Math.sqrt(Math.random()) * 1900;
      const start = ENEMY.clone().addScaledVector(this.fleetDir, -900 - Math.random() * 6500).addScaledVector(side, Math.cos(a) * r).addScaledVector(up, Math.sin(a) * r * 0.6);
      this.shipData.push({ start, sp: 620 + Math.random() * 300, size: 1.6 + Math.random() * 3 });
    }
    this.shipQ = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), this.fleetDir);
    s.add(this.ships); s.add(this.engines);
    // the last card
    const card = this.card = document.createElement('div');
    card.style.cssText = 'position:fixed;inset:0;z-index:30;display:none;align-items:center;justify-content:center;flex-direction:column;text-align:center;pointer-events:none;background:rgba(0,0,0,0);transition:background 1.5s;font-family:Orbitron,sans-serif;color:#fff';
    card.innerHTML = '<div style="font-weight:900;font-size:min(9vw,84px);letter-spacing:.14em;text-shadow:0 0 30px #ff4a2a">PART 3 BEGINS</div><div style="margin-top:18px;font-size:min(3vw,24px);letter-spacing:.3em;color:#ff8a6a">THE FLEET IS COMING</div>';
    document.body.appendChild(card);
  }

  // mode 'planet': the Earth Cannon (end of part 2). mode 'bomb': the bomb you planted goes off (end of part 5).
  start(onDone, mode = 'planet') {
    this.onDone = onDone;
    this.mode = mode;
    this.enemy.material.color.set(mode === 'bomb' ? '#3a2a5a' : '#7a2438');
    this.card.innerHTML = mode === 'bomb'
      ? '<div style="font-weight:900;font-size:min(8vw,76px);letter-spacing:.12em;text-shadow:0 0 30px #5affc0">THE PLANET WENT BOOM</div><div style="margin-top:18px;font-size:min(3vw,24px);letter-spacing:.3em;color:#9fffd8">BUT THE WAR IS NOT OVER... PART 6 IS COMING</div>'
      : '<div style="font-weight:900;font-size:min(9vw,84px);letter-spacing:.14em;text-shadow:0 0 30px #ff4a2a">PART 3 BEGINS</div><div style="margin-top:18px;font-size:min(3vw,24px);letter-spacing:.3em;color:#ff8a6a">THE FLEET IS COMING</div>';
    this.t = 0; this.beat = ''; this.active = true; this.t0 = (this.t0 || 0) + 1; // t0 counts the showings, so one-time beats fire again next time
    this.enemy.visible = true; this.chunks.visible = false; this.ships.visible = this.engines.visible = false;
    this.beam.visible = false; this.flash.material.opacity = 0; this.ring.material.opacity = 0;
    this.card.style.display = 'none'; this.card.style.background = 'rgba(0,0,0,0)';
    this.app.nav.clear(); this.app.nav.show(false);
    this.app.game.hud.show(false);
    audio.stopLoops();
    $('cine').classList.add('show');
    if (mode === 'bomb') this.t = T.BOOM - 4.5; // straight to the planet: no cannon this time
    this.update(0);
  }

  title(big, small) {
    const el = $('cine-title');
    el.innerHTML = `${big}<small>${small || ''}</small>`;
    el.style.opacity = big ? 1 : 0;
  }

  skip() { if (this.active) this.finish(); }

  finish() {
    if (!this.active) return;
    this.active = false;
    $('cine').classList.remove('show');
    $('cine-title').style.opacity = 0;
    this.card.style.display = 'none';
    const done = this.onDone; this.onDone = null;
    if (done) done();
  }

  enter(beat) {
    if (this.beat === beat) return false;
    this.beat = beat;
    return true;
  }

  update(dt) {
    if (!this.active) return;
    const t = this.t += dt, cam = this.camera;
    cam.aspect = window.innerWidth / window.innerHeight; cam.updateProjectionMatrix();
    this.earthMat.uniforms.uTime.value += dt;
    const toEnemy = ENEMY.clone().sub(CANNON).normalize();
    if (this.mode === 'bomb' && t < T.BOOM) {
      // the Venture Stars are clear, and the bomb counts down
      const left = Math.ceil(T.BOOM - t);
      if (this.enter('count' + left)) { this.title(left > 3 ? 'THE BOMB IS PLANTED' : String(left), left > 3 ? 'the Venture Stars are flying clear' : ''); audio.play(left > 3 ? 'alarm' : 'uiBig'); }
      const side0 = _p.crossVectors(toEnemy, new THREE.Vector3(0, 1, 0)).normalize();
      cam.position.copy(ENEMY).addScaledVector(toEnemy, -2300).addScaledVector(side0, 700).add(new THREE.Vector3(0, 350, 0));
      cam.lookAt(ENEMY);
      return;
    }
    if (this.mode === 'bomb' && t >= T.FLEET) {
      // no fleet this time: it is over
      this.moveChunks(t - T.BOOM - 1.1);
      this.flash.material.opacity = 0; this.ring.material.opacity = Math.max(0, this.ring.material.opacity - dt * 0.3);
      if (this.enter('bombCard')) { this.title('', ''); this.card.style.display = 'flex'; requestAnimationFrame(() => { this.card.style.background = 'rgba(0,0,0,0.6)'; }); audio.play('uiBig'); }
      if (t >= T.FLEET + 6) this.finish();
      return;
    }
    if (t < T.FIRE) {
      // the cannon charges up; the enemy planet is a red dot far away
      if (this.enter('charge')) { this.title('THE EARTH CANNON', 'built from the wrecks of every tripod you destroyed'); audio.play('rumble'); }
      const k = t / T.FIRE;
      this.glow.scale.setScalar(4 + k * k * 30 + Math.sin(t * 30) * 2 * k);
      cam.position.copy(CANNON).addScaledVector(CANNON.clone().normalize(), 150).addScaledVector(toEnemy, -330 + k * 60).add(_p.set(0, 60, 90));
      cam.lookAt(this.muzzle.clone().addScaledVector(toEnemy, 900));
    } else if (t < T.BOOM) {
      // FIRE
      if (this.enter('fire')) { this.title('FIRE!', ''); audio.play('plasma'); audio.play('thunder'); audio.play('laser'); }
      const k = (t - T.FIRE) / (T.BOOM - T.FIRE);
      this.beam.visible = true;
      const w = 16 + Math.sin(t * 50) * 4;
      this.beam.scale.set(w, this.beamLen * ease(k * 3), w);
      this.glow.scale.setScalar(40 + Math.sin(t * 40) * 8);
      const sh = (1 - k) * 6;
      cam.position.copy(CANNON).addScaledVector(CANNON.clone().normalize(), 150).addScaledVector(toEnemy, -270).add(_p.set((Math.random() - 0.5) * sh, 60 + (Math.random() - 0.5) * sh, 90));
      cam.lookAt(this.muzzle.clone().addScaledVector(toEnemy, 900));
    } else if (t < T.FLEET) {
      // the planet blows apart
      const k = (t - T.BOOM) / (T.FLEET - T.BOOM), e = t - T.BOOM;
      if (this.enter('boom')) { this.title('', ''); audio.play('explosion'); audio.play('collapse'); }
      if (e > 1.1 && this.enemy.visible) {
        this.enemy.visible = false; this.chunks.visible = true; this.beam.visible = false;
        audio.play('explosion'); audio.play('thunder'); audio.play('rumble');
        this.title(this.mode === 'bomb' ? 'BOOM!' : 'THE ENEMY PLANET IS DESTROYED!', this.mode === 'bomb' ? 'the whole planet' : 'direct hit');
      }
      this.beam.scale.set(22, this.beamLen, 22);
      const boom = Math.max(0, e - 1.1);
      this.flash.scale.setScalar(ENEMY_R * (0.6 + (e < 1.1 ? e * 0.5 : 1 + boom * 2.5)));
      this.flash.material.opacity = e < 1.1 ? e * 0.8 : Math.max(0, 1 - boom * 0.6);
      this.ring.scale.setScalar(ENEMY_R * (1 + boom * 3.2));
      this.ring.material.opacity = e < 1.1 ? 0 : Math.max(0, 0.9 - boom * 0.22);
      this.ring.lookAt(cam.position);
      this.moveChunks(boom);
      const side = _p.crossVectors(toEnemy, new THREE.Vector3(0, 1, 0)).normalize();
      cam.position.copy(ENEMY).addScaledVector(toEnemy, -2300 - k * 500).addScaledVector(side, 700).add(new THREE.Vector3(0, 350, 0));
      if (e > 1.1 && boom < 1) cam.position.add(new THREE.Vector3((Math.random() - 0.5) * 30, (Math.random() - 0.5) * 30, 0).multiplyScalar(1 - boom));
      cam.lookAt(ENEMY);
    } else {
      // ...but hundreds of ships are coming
      const e = t - T.FLEET;
      if (this.enter('fleet')) { this.title('', ''); this.ships.visible = this.engines.visible = true; this.beam.visible = false; this.flash.material.opacity = 0; this.ring.material.opacity = 0; }
      if (e > 2 && this.enter2('fleetTitle')) { this.title('...BUT HUNDREDS OF SHIPS ARE COMING', 'the enemy fleet'); audio.play('horn'); audio.play('alarm'); }
      this.moveChunks(T.FLEET - T.BOOM - 1.1 + e);
      for (let i = 0; i < SHIPS; i++) {
        const d = this.shipData[i];
        _p.copy(d.start).addScaledVector(this.fleetDir, d.sp * e);
        _m.compose(_p, this.shipQ, _s.setScalar(d.size)); this.ships.setMatrixAt(i, _m);
        _p.addScaledVector(this.fleetDir, -26 * d.size);
        _m.compose(_p, this.shipQ, _s.setScalar(d.size * (0.8 + Math.sin(t * 20 + i) * 0.2))); this.engines.setMatrixAt(i, _m);
      }
      this.ships.instanceMatrix.needsUpdate = true; this.engines.instanceMatrix.needsUpdate = true;
      // the camera sits in the fleet's path, between the wreck of the planet and the Earth, and they fly past it
      const side = new THREE.Vector3().crossVectors(this.fleetDir, new THREE.Vector3(0, 1, 0)).normalize();
      cam.position.copy(ENEMY).addScaledVector(this.fleetDir, 2300 + e * 40).addScaledVector(side, 260).add(new THREE.Vector3(0, 120, 0));
      cam.lookAt(ENEMY.clone().addScaledVector(this.fleetDir, -1500));
      if (t >= T.CARD && this.enter2('card')) {
        this.title('', '');
        this.card.style.display = 'flex';
        requestAnimationFrame(() => { this.card.style.background = 'rgba(0,0,0,0.72)'; });
        audio.play('uiBig'); audio.play('horn');
      }
      if (t >= T.END) this.finish();
    }
  }

  enter2(key) { if (this['_' + key] === this.t0) return false; this['_' + key] = this.t0; return true; }

  moveChunks(e) {
    for (let i = 0; i < CHUNKS; i++) {
      const c = this.chunkData[i];
      _p.copy(ENEMY).addScaledVector(c.dir, ENEMY_R * 0.4 + c.sp * e);
      _q.setFromAxisAngle(c.spin, e * c.rate);
      _m.compose(_p, _q, _s.setScalar(c.size)); this.chunks.setMatrixAt(i, _m);
    }
    this.chunks.instanceMatrix.needsUpdate = true;
  }
}
