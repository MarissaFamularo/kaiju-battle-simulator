import * as THREE from 'three';
import { WORLD, WAVES, BACKUP, KAIJU_CATS, INVASION_WAVES } from './config.js';
import { Physics } from './physics.js';
import { Particles } from './fx/particles.js';
import { City } from './world/city.js';
import { Mech } from './entities/mech.js';
import { Kaiju } from './entities/kaiju.js';
import { Projectiles } from './entities/projectiles.js';
import { Military } from './entities/military.js';
import { Drones } from './entities/drones.js';
import { Pilot } from './entities/pilot.js';
import { Tripod, lightningStrike } from './entities/tripod.js';
import { Aliens } from './entities/aliens.js';
import { audio } from './audio.js';

const $ = (id) => document.getElementById(id);
const LAND = new THREE.Vector3(0, 0, 60);
// third-person camera framing (multiplied by the Jaeger's size)
const CAM = { height: 72, dist: 150, side: 40 };

export class Game {
  constructor(app) {
    this.app = app;
    this.nav = app.nav;
    this.hud = app.hud;
    this.input = app.input;
    this.camera = new THREE.PerspectiveCamera(58, 1, 1, 9000);
    this.view = { yaw: Math.PI, pitch: -0.05 };
    this.buildWorld();
  }

  // ---------------------------------------------------------------- world
  buildWorld() {
    if (this.scene) this.disposeWorld();
    this.scene = new THREE.Scene();
    this.physics = new Physics();
    this.fx = new Particles(this.scene);
    this.city = new City(this.scene, this.physics, this.fx);
    this.city.onPlantDamaged = (b, amt, src) => this.onPlantDamaged(b, amt, src);
    this.city.onBuildingDestroyed = (b, src) => this.onBuildingDestroyed(b, src);
    this.projectiles = new Projectiles(this);
    this.military = new Military(this);
    this.drones = new Drones(this);
    this.aliens = new Aliens(this);
    this.kaijus = [];
    this.warnings = [];
    this.mech = null;
    this.pilot = null;
    this.time = 0;
    this.state = 'title';
    this.dirty = false;
    this.aimPoint = new THREE.Vector3();
    this.aimInfo = null;
    this.shakeAmt = 0;
    this.hitstopT = 0;
    this.camPivot = new THREE.Vector3();
    this.camPos = new THREE.Vector3(0, 300, 800);
    this.city.sun.castShadow = this.app.settings.quality === 'high';
    if (this.app.game) this.app.resize(); // size particles for the new world
  }

  disposeWorld() {
    this.scene.traverse((o) => {
      if (o.geometry) o.geometry.dispose();
      if (o.material) {
        const ms = Array.isArray(o.material) ? o.material : [o.material];
        for (const m of ms) {
          for (const k of ['map', 'emissiveMap', 'normalMap', 'bumpMap']) if (m[k]) m[k].dispose();
          m.dispose();
        }
      }
    });
    try { this.physics.world.free(); } catch (e) { /* already freed */ }
  }

  // ---------------------------------------------------------------- mission flow
  startMission(cfg, mode) {
    if (this.dirty) this.buildWorld();
    this.dirty = true;
    this.cfg = cfg;
    this.mode = mode;
    this.time = 0;
    this.stats = { kills: 0, tripods: 0, weakHits: 0, damage: 0, start: 0, bonks: 0 };
    this.cooldowns = { drones: 0, apache: 12, gunship: 25, jets: 35, missiles: 0 };
    this.waveIdx = -1;
    this.waveState = 'pre';
    this.waveTimer = 14;
    this.spawnQueue = [];
    this.mech = new Mech(this, cfg);
    this.mech.setPosition(LAND.x, 900, LAND.z);
    this.mech.yaw = Math.PI;
    this.view.yaw = Math.PI;
    this.view.pitch = -0.1;
    this.carrier = this.drones.spawnCarrier(cfg.glow, new THREE.Vector3(LAND.x, 1600, LAND.z + 600));
    this.landing = { t: 0, released: false, landed: false, vy: 0 };
    this.state = 'landing';
    this.hud.setup(cfg);
    this.over = false;
    this.lastLowArmor = 0;
    this.tutorial = 0;
    this.tutorialT = 0;
    this.moved = false;
    this.attacked = false;
    audio.intensity = 0.2;
    this.clouds();
  }

  clouds() {
    for (let i = 0; i < 160; i++) {
      const p = new THREE.Vector3(LAND.x + (Math.random() - 0.5) * 1400, 820 + Math.random() * 120, LAND.z + (Math.random() - 0.5) * 1400);
      this.fx.alpha.spawn(p, new THREE.Vector3(Math.random() * 3, 0, Math.random() * 3), 14, 160, 220, new THREE.Color('#d8c8d8'), new THREE.Color('#b8a8c0'), 0.55, 0, 0);
    }
  }

  waveLabel() {
    if (this.mode === 'smash') return 'FREE SMASH';
    if (this.waveIdx < 0) return 'GET READY';
    if (this.mode === 'endless') return `WAVE ${this.waveIdx + 1}`;
    if (this.mode === 'invasion') return `INVASION WAVE ${this.waveIdx + 1}`;
    return `WAVE ${this.waveIdx + 1} / ${WAVES.length}`;
  }

  waveList(i) {
    if (this.mode === 'mission') return WAVES[i];
    if (this.mode === 'invasion') {
      // the table first, then it keeps growing forever
      if (i < INVASION_WAVES.length) return INVASION_WAVES[i];
      const extra = i - INVASION_WAVES.length;
      const out = [Math.min(5, 3 + Math.floor(extra / 2))];
      for (let k = 0; k < 2 + Math.floor(extra / 2); k++) out.push('T');
      return out;
    }
    const n = 1 + Math.floor(i / 3);
    const out = [];
    for (let k = 0; k < n; k++) out.push(Math.min(5, 1 + Math.floor(i / 2) - k));
    return out.map((c) => Math.max(1, c));
  }

  startWave(i) {
    this.waveIdx = i;
    const list = this.waveList(i);
    this.spawnQueue = list.map((cat, k) => ({ cat, delay: k * (this.mode === 'invasion' ? 14 : 20) + 1 }));
    this.waveState = 'fighting';
    this.hud.alert(`WAVE ${i + 1}`, 3);
    audio.play('uiBig');
    audio.intensity = Math.min(1, 0.4 + i * 0.1);
  }

  pickSpawn() {
    const ref = this.mech ? this.mech.pos : new THREE.Vector3();
    const r = Math.random();
    let x, z, from = 'ground', sector;
    if (r < 0.38) {
      x = (Math.random() - 0.5) * 1300;
      z = this.city.waterEdge - 90 - Math.random() * 180;
      from = 'water';
      sector = 'THE BAY';
    } else if (r < 0.68) {
      let tries = 0;
      do {
        const a = Math.random() * Math.PI * 2;
        const d = 880 + Math.random() * 150;
        x = Math.cos(a) * d; z = Math.sin(a) * d;
        tries++;
      } while ((z < this.city.waterEdge + 40 || Math.hypot(x - ref.x, z - ref.z) < 350) && tries < 20);
      sector = null;
    } else {
      // burst up from under the city streets
      const alive = this.city.buildings.filter((b) => b.alive && !b.plant);
      let b = null;
      for (let t = 0; t < 30 && alive.length; t++) {
        const c = alive[Math.floor(Math.random() * alive.length)];
        if (Math.hypot(c.x - ref.x, c.z - ref.z) > 380 && Math.hypot(c.x - this.city.plantCenter.x, c.z - this.city.plantCenter.z) > 280) { b = c; break; }
      }
      if (b) { x = b.x; z = b.z; } else { x = -600; z = 600; }
      sector = null;
    }
    if (!sector) {
      const a = Math.atan2(x, -z); // 0 = north
      const dirs = ['NORTH', 'NORTHEAST', 'EAST', 'SOUTHEAST', 'SOUTH', 'SOUTHWEST', 'WEST', 'NORTHWEST'];
      const idx = Math.round(((a + Math.PI * 2) % (Math.PI * 2)) / (Math.PI / 4)) % 8;
      sector = Math.hypot(x, z) < 420 ? 'DOWNTOWN' : `THE ${dirs[idx]} SIDE`;
    }
    return { x, z, from, sector };
  }

  queueKaiju(cat) {
    const s = this.pickSpawn();
    const off = new THREE.Vector3((Math.random() - 0.5) * 2, 0, (Math.random() - 0.5) * 2).normalize().multiplyScalar(Math.random() * 240);
    this.warnings.push({ t: 7 + Math.random() * 2, cat, ...s, zone: new THREE.Vector3(s.x, 0, s.z).add(off), radius: 380 });
    audio.play('alarm');
    this.hud.alert('SEISMIC ACTIVITY DETECTED', 5, true);
    const lines = [
      `Seismic activity! A category ${cat} signature somewhere near ${s.sector}. I can't pin it down!`,
      `Kaiju signature detected near ${s.sector}! It could come up anywhere around there.`,
      `Something big is moving under ${s.sector}. Category ${cat}. Get ready!`,
    ];
    this.nav.say('warn', lines[Math.floor(Math.random() * lines.length)], 3, 0);
  }

  // ---- tripods (chapter 2): lightning keeps hitting one spot ahead of you, then a tripod climbs out
  queueTripod(type = 'attacker') {
    const ref = this.pilot && !this.pilot.dead ? this.pilot.pos : (this.mech ? this.mech.pos : new THREE.Vector3());
    const B = WORLD.bound - 120;
    let x = 0, z = 0;
    for (let tries = 0; tries < 12; tries++) {
      const a = this.view.yaw + (Math.random() - 0.5) * (0.9 + tries * 0.4);
      const d = 300 + Math.random() * 130;
      x = THREE.MathUtils.clamp(ref.x + Math.sin(a) * d, -B, B);
      z = THREE.MathUtils.clamp(ref.z + Math.cos(a) * d, this.city.waterEdge + 120, B);
      const farFromMe = Math.hypot(x - ref.x, z - ref.z) > 220;
      const farFromPlant = Math.hypot(x - this.city.plantCenter.x, z - this.city.plantCenter.z) > 230;
      if (farFromMe && farFromPlant) break;
    }
    this.warnings.push({ tripod: true, type, t: 8.5, strikeT: 0.2, strikes: 0, x, z, zone: new THREE.Vector3(x, 0, z), radius: 90 });
    audio.play('alarm');
    this.hud.alert('LIGHTNING STORM AHEAD', 5, true);
    this.nav.say('tripodWarn', 'Lightning keeps hitting the same spot ahead of you! Something is coming up out of the ground. Hide behind a building so its scanner light cannot find you!', 3, 0);
  }

  spawnTripod(w) {
    lightningStrike(this, w.x, w.z, true);
    const t = new Tripod(this, { type: w.type, x: w.x, z: w.z });
    this.kaijus.push(t);
    this.hud.alert('TRIPOD RISING', 4, true);
    this.nav.say('tripodRise', `A tripod! Legs first, then it pushes itself up. That is ${t.name}. It can only attack if its scanner light finds you. Its weak spot is the glowing core underneath.`, 3, 0);
  }

  onTripodKilled(t) {
    this.stats.kills++;
    this.stats.tripods++;
    this.hud.alert(`${t.name.toUpperCase()} DESTROYED`, 3);
    this.nav.say('tripodKill', [`${t.name} is down! Great work, pilot!`, 'Tripod destroyed! Its lights are out for good.', `Timber! ${t.name} is scrap metal now.`][Math.floor(Math.random() * 3)], 3, 0);
    this.hitstop(0.35);
    audio.play('uiBig');
  }

  spawnKaiju(w) {
    const k = new Kaiju(this, { cat: w.cat, x: w.x, z: w.z, from: w.from, type: w.type });
    this.kaijus.push(k);
    this.hud.alert(`KAIJU BREACH: ${k.name.toUpperCase()}`, 4, true);
    this.nav.say('breach', `There it is! ${k.name}, category ${w.cat}. Get close so I can scan for weak spots.`, 3, 0);
    this.shake(1.2, k.pos);
  }

  // ---------------------------------------------------------------- update
  update(rawDt) {
    let dt = rawDt;
    if (this.hitstopT > 0) { this.hitstopT -= rawDt; dt = rawDt * 0.15; }
    this.time += dt;
    const input = this.input;
    const playing = this.state === 'play';

    if (this.state === 'title') {
      this.updateTitle(dt);
    } else if (this.state === 'landing') {
      this.updateLanding(dt);
    }

    if (playing) {
      const look = input.look(rawDt);
      this.view.yaw -= look.x;
      const pmin = this.pilot ? -1.2 : -0.75, pmax = this.pilot ? 1.2 : 0.85;
      this.view.pitch = THREE.MathUtils.clamp(this.view.pitch - look.y, pmin, pmax);
      this.handleKeys();
    }

    if (this.mech && (playing || this.state === 'over')) {
      const usable = playing && this.mech.piloted && !this.over;
      this.mech.update(dt, usable ? input : null, this.view);
      if (!this.mech.piloted && !this.mech.dead) this.mech.vel.multiplyScalar(0.9);
    }
    if (this.pilot && (playing || this.state === 'over')) this.pilot.update(dt, playing ? input : { down: () => false, pressed: () => false, mouse: () => false }, this.view);

    if (this.state === 'play' || this.state === 'over' || this.state === 'landing') {
      for (const k of this.kaijus) k.update(dt);
      for (let i = this.kaijus.length - 1; i >= 0; i--) if (this.kaijus[i].removeMe) { this.kaijus[i].remove(); this.kaijus.splice(i, 1); }
      this.projectiles.update(dt);
      this.military.update(dt);
      this.aliens.update(dt);
      this.drones.update(dt, this.mech && this.state !== 'landing' ? this.mech.pos : null);
    }
    if (playing) {
      this.updateWaves(dt);
      this.updateReveal(dt);
      this.updateNavigatorHints(dt);
      for (const k in this.cooldowns) this.cooldowns[k] = Math.max(0, this.cooldowns[k] - dt);
    }
    this.physics.update(dt);
    this.city.update(dt, this.time);
    this.fx.update(dt);
    this.updateCamera(rawDt);
    if (playing || this.state === 'over') this.computeAim();
    if (playing || this.state === 'over') this.hud.update(rawDt, this);
    audio.setListener(this.camera.position);
  }

  handleKeys() {
    const input = this.input;
    if (input.pressed('KeyQ') && this.cooldowns.drones <= 0) {
      if (this.drones.launchSwarm()) this.cooldowns.drones = BACKUP.drones.cooldown;
    }
    if (input.pressed('Digit1') && this.cooldowns.apache <= 0) {
      this.military.callApaches();
      this.cooldowns.apache = BACKUP.apache.cooldown;
      this.nav.say('apache', 'Apache helicopters inbound! They will hit the kaiju with missiles.', 2, 0);
    }
    if (input.pressed('Digit2') && this.cooldowns.gunship <= 0) {
      this.military.callGunship();
      this.cooldowns.gunship = BACKUP.gunship.cooldown;
      this.nav.say('gunship', 'Gunship on station! It will circle high and rain fire on the kaiju.', 2, 0);
    }
    if (input.pressed('Digit3') && this.cooldowns.jets <= 0) {
      this.military.callJets();
      this.cooldowns.jets = BACKUP.jets.cooldown;
      this.nav.say('jets', 'Airstrike incoming! Stay clear of the bombs!', 2, 0);
    }
    if (input.pressed('KeyE') && this.cooldowns.missiles <= 0 && this.mech && this.mech.model.bay && this.mech.launchMissiles()) {
      this.cooldowns.missiles = BACKUP.missiles.cooldown;
      this.nav.say('missiles', 'Missile bay open! Fox two!', 1, 20);
    }
    if (input.pressed('KeyF')) this.toggleEject();
    if (input.pressed('KeyV')) {
      this.app.settings.voice = !this.app.settings.voice;
      this.app.applySettings(this.app.settings);
      this.hud.alert(this.app.settings.voice ? 'NAVIGATOR VOICE ON' : 'NAVIGATOR VOICE OFF', 1.5);
    }
    if (input.pressed('KeyK') && this.mode === 'smash') {
      const cat = 1 + Math.floor(Math.random() * 4);
      this.queueKaiju(cat);
    }
    if (input.pressed('KeyT') && this.mode === 'smash' && !this.warnings.some((w) => w.tripod)) this.queueTripod();
  }

  toggleEject() {
    const m = this.mech;
    if (!m || m.dead) return;
    if (m.piloted) {
      m.root.updateMatrixWorld(true);
      const from = m.model.j.cockpit.getWorldPosition(new THREE.Vector3());
      this.pilot = new Pilot(this, this.cfg, from);
      const f = new THREE.Vector3(Math.sin(m.yaw), 0, Math.cos(m.yaw));
      this.pilot.vel.copy(f.multiplyScalar(18)).setY(32);
      m.piloted = false;
      m.vel.set(0, 0, 0);
      this.nav.say('eject', 'You ejected?! Your blaster will barely tickle a kaiju. Walk back to the Jaeger and press F to climb in.', 3, 0);
      this.hud.alert('PILOT EJECTED', 2);
    } else if (this.pilot) {
      const d = Math.hypot(this.pilot.pos.x - m.pos.x, this.pilot.pos.z - m.pos.z);
      if (d < 32 * m.scale && this.pilot.pos.y < 40) {
        this.pilot.remove();
        this.pilot = null;
        m.piloted = true;
        this.view.pitch = 0;
        this.nav.say('board', 'Welcome back, pilot! Systems online.', 2, 0);
        audio.play('uiBig');
      } else {
        this.hud.alert('GET CLOSER TO YOUR JAEGER', 1.5);
      }
    }
  }

  updateTitle(dt) {
    const a = this.time * 0.05;
    this.camPos.set(Math.sin(a) * 820, 300 + Math.sin(a * 2) * 40, Math.cos(a) * 820);
    this.camera.position.copy(this.camPos);
    this.camera.lookAt(0, 40, 100);
    this.city.followShadow(new THREE.Vector3(0, 0, 0));
  }

  updateLanding(dt) {
    const L = this.landing;
    L.t += dt;
    const c = this.carrier;
    const m = this.mech;
    const skip = this.input.pressed('Space') || this.input.pressed('Enter');
    if (!L.released) {
      const k = Math.min(1, L.t / 6);
      const e = 1 - (1 - k) ** 2;
      c.g.position.set(LAND.x, 1600 - e * 1180, LAND.z + 600 * (1 - e));
      c.g.rotation.x = (1 - e) * 0.2;
      m.setPosition(c.g.position.x, c.g.position.y - 63 * m.scale, c.g.position.z);
      m.yaw = Math.PI; m.root.rotation.y = Math.PI;
      // legs dangle
      m.model.j.legL.rotation.x = 0.15 + Math.sin(L.t * 2) * 0.05;
      m.model.j.legR.rotation.x = 0.1 - Math.sin(L.t * 2) * 0.05;
      m.model.j.kneeL.rotation.x = 0.3; m.model.j.kneeR.rotation.x = 0.2;
      for (const f of c.fans) f.rotation.y += dt * 30;
      audio.setLoop('wind', 0.12);
      if (L.t < 0.1) this.nav.say('land1', `Over the city now. Releasing ${this.cfg.name} in 3... 2... 1...`, 3, 0);
      // camera: side view of the drop
      this.camPos.lerp(new THREE.Vector3(c.g.position.x + 170, c.g.position.y + 70, c.g.position.z - 170), Math.min(1, dt * 3));
      this.camera.position.copy(this.camPos);
      this.camera.lookAt(c.g.position.x, c.g.position.y - 140, c.g.position.z);
      if (L.t > 6 || skip) {
        L.released = true;
        L.vy = -10;
        for (const cl of c.clamps) cl.rotation.z = 0.6 * Math.sign(cl.position.x);
        audio.play('punch', c.g.position, 1);
        this.nav.say('land2', 'Jaeger released! Brace for impact!', 3, 0);
        if (skip) { m.setPosition(LAND.x, 120, LAND.z); L.vy = -120; }
      }
    } else if (!L.landed) {
      L.vy -= 80 * dt;
      m.pos.y += L.vy * dt;
      m.setPosition(LAND.x, m.pos.y, LAND.z);
      m.model.j.legL.rotation.x = -0.3; m.model.j.legR.rotation.x = 0.1;
      m.model.j.kneeL.rotation.x = 0.6; m.model.j.kneeR.rotation.x = 0.4;
      m.model.j.shoulderL.rotation.z = 0.5; m.model.j.shoulderR.rotation.z = -0.5;
      if (Math.random() < 0.6) this.fx.trail(m.chestPos().add(new THREE.Vector3(0, 10, 0)), '#ffffff', 30);
      c.g.position.y += dt * 60;
      this.camPos.lerp(new THREE.Vector3(m.pos.x + 140, Math.max(40, m.pos.y + 60), m.pos.z - 140), Math.min(1, dt * 4));
      this.camera.position.copy(this.camPos);
      this.camera.lookAt(m.pos.x, m.pos.y + 20, m.pos.z);
      if (m.pos.y <= 0) {
        L.landed = true;
        L.landT = L.t;
        m.setPosition(LAND.x, 0, LAND.z);
        audio.setLoop('wind', 0);
        audio.play('explosion', m.pos, 1.3);
        audio.play('stomp', m.pos, 1.5);
        this.fx.groundDust(m.pos, 120, 40);
        this.fx.ring(m.pos, 10, 200, 1.0, '#ffe8c0', 0.7);
        this.fx.dust(m.pos.clone().setY(5), 1.8, 10);
        this.city.damageArea(new THREE.Vector3(LAND.x, 5, LAND.z), 75, 1400, { source: 'landing', force: 2.2 });
        this.city.crushCars(LAND.x, LAND.z, 70);
        this.shake(2.5);
      }
    } else {
      const k = L.t - L.landT;
      // crouch then stand
      const crouch = Math.max(0, 1 - k / 1.2);
      m.model.j.hips.position.y = 27 - crouch * 10;
      m.model.j.legL.rotation.x = -0.9 * crouch; m.model.j.legR.rotation.x = -0.9 * crouch;
      m.model.j.kneeL.rotation.x = 1.8 * crouch; m.model.j.kneeR.rotation.x = 1.8 * crouch;
      m.model.j.ankleL.rotation.x = -0.9 * crouch; m.model.j.ankleR.rotation.x = -0.9 * crouch;
      m.model.j.shoulderL.rotation.z = 0.5 * crouch; m.model.j.shoulderR.rotation.z = -0.5 * crouch;
      m.model.j.torso.rotation.x = 0.4 * crouch;
      const target = this.thirdPersonCam(m.pos.clone().add(new THREE.Vector3(0, CAM.height * m.scale, 0)), CAM.dist * m.scale, CAM.side * m.scale);
      this.camPos.lerp(target, Math.min(1, dt * 2));
      this.camera.position.copy(this.camPos);
      const dir = this.viewDir();
      this.camera.lookAt(this.camPos.clone().addScaledVector(dir, 1000));
      this.camPivot.copy(m.pos).add(new THREE.Vector3(0, CAM.height * m.scale, 0));
      if (k > 1.6) this.beginPlay();
    }
  }

  beginPlay() {
    this.state = 'play';
    this.hud.show(true);
    this.app.onPlayStart();
    this.nav.say('touchdown', `Touchdown! ${this.cfg.name} is in the city. Move with W A S D and look with the mouse.`, 3, 0);
    this.stats.start = this.time;
    if (this.app.settings.music) audio.startMusic();
    if (this.mode === 'smash') {
      setTimeout(() => this.nav.say('smashMode', 'Free Smash mode! Smash anything you want. Press K whenever you want a kaiju to show up, or T for a tripod.', 3, 0), 6000);
    }
  }

  updateWaves(dt) {
    // warnings counting down to a breach
    for (let i = this.warnings.length - 1; i >= 0; i--) {
      const w = this.warnings[i];
      w.t -= dt;
      if (w.tripod) {
        // lightning hits the same spot over and over, faster and faster
        w.strikeT -= dt;
        if (w.strikeT <= 0 && w.t > 0.4) {
          w.strikes++;
          w.strikeT = 0.3 + Math.random() * 0.5 + w.t * 0.08;
          lightningStrike(this, w.x + (Math.random() - 0.5) * 50, w.z + (Math.random() - 0.5) * 50);
        }
        if (w.t <= 0) { this.warnings.splice(i, 1); this.spawnTripod(w); }
        continue;
      }
      if (w.t < 3 && Math.random() < dt * 4) this.shake(0.3, new THREE.Vector3(w.x, 0, w.z));
      if (w.t <= 0) { this.warnings.splice(i, 1); this.spawnKaiju(w); }
    }
    if (this.mode === 'smash') return;
    for (let i = this.spawnQueue.length - 1; i >= 0; i--) {
      const s = this.spawnQueue[i];
      s.delay -= dt;
      if (s.delay <= 0) { this.spawnQueue.splice(i, 1); if (s.cat === 'T') this.queueTripod(); else this.queueKaiju(s.cat); }
    }
    const living = this.kaijus.filter((k) => !k.dead).length;
    if (this.waveState === 'pre') {
      this.waveTimer -= dt;
      if (this.waveTimer <= 0) this.startWave(0);
    } else if (this.waveState === 'fighting') {
      if (!living && !this.spawnQueue.length && !this.warnings.length) {
        const last = this.mode === 'mission' && this.waveIdx >= WAVES.length - 1;
        if (last) { this.victory(); return; }
        this.waveState = 'cleared';
        this.waveTimer = 12;
        const heal = this.mech.maxHp * 0.4;
        this.mech.hp = Math.min(this.mech.maxHp, this.mech.hp + heal);
        this.hud.alert('WAVE CLEARED', 3);
        this.nav.say('cleared', this.mode === 'invasion' ? 'Wave cleared! Repair crews patched up your armor. Watch the sky for more lightning.' : 'Wave cleared! Repair crews patched up your armor. More kaiju are coming.', 3, 0);
        audio.intensity = 0.25;
      }
    } else if (this.waveState === 'cleared') {
      this.waveTimer -= dt;
      if (this.waveTimer <= 0) this.startWave(this.waveIdx + 1);
    }
  }

  updateReveal(dt) {
    const ref = this.pilot ? this.pilot.pos : this.mech.pos;
    for (const k of this.kaijus) {
      if (k.dead || k.emerging || k.revealed) continue;
      const d = k.pos.distanceTo(ref);
      const onScreen = (() => {
        const p = k.pos.clone().setY(k.height * 0.5).project(this.camera);
        return p.z < 1 && Math.abs(p.x) < 1 && Math.abs(p.y) < 1;
      })();
      if (d < 650 && onScreen) k.seenT += dt;
      if (k.seenT > 1.5) {
        k.revealed = true;
        const labels = k.model.weakSpots.map((w) => w.label);
        const where = labels.length > 1 ? `${labels[0]} and ${labels[1]}` : labels[0];
        const tips = {
          BACK: 'Get behind it!', TAIL: 'Hit it near the base of the tail!', CHEST: 'Hit it right in the chest!', THROAT: 'Aim up at its throat!',
          NECK: 'Go for the neck!', SIDE: 'Circle around to its side!', HEAD: 'Aim high at its head!',
        };
        this.nav.say('weak-' + k.name, `Scan complete! ${k.name}'s weak spot${labels.length > 1 ? 's are' : ' is'} on its ${where}. ${tips[labels[0]] || ''} Glowing blue spots take triple damage!`, 3, 0);
        audio.play('uiBig');
      }
    }
  }

  updateNavigatorHints(dt) {
    const m = this.mech;
    const t = this.time - this.stats.start;
    if (this.input.down('KeyW') || this.input.down('KeyA') || this.input.down('KeyS') || this.input.down('KeyD')) this.moved = true;
    if (this.input.mouse(0) || this.input.mouse(2)) this.attacked = true;
    if (t > 7 && this.tutorial === 0) { this.tutorial = 1; this.nav.say('tut1', 'Left click and right click use your arm weapons. Try smashing a building!', 1, 0); }
    if (t > 16 && this.tutorial === 1) { this.tutorial = 2; this.nav.say('tut2', 'Hold SHIFT to sprint and press SPACE to jump. Landing makes a big stomp!', 1, 0); }
    if (t > 40 && this.tutorial === 2) { this.tutorial = 3; this.nav.say('tut3', 'Need help? Press 1 for Apache helicopters, 2 for a gunship, 3 for an airstrike, or Q for drones.', 1, 0); }
    if (m && m.hp / m.maxHp < 0.3 && this.time - this.lastLowArmor > 25 && !m.dead) {
      this.lastLowArmor = this.time;
      this.nav.say('lowArmor', 'Armor critical! Back off and call in backup!', 3, 0);
      this.hud.alert('ARMOR CRITICAL', 3, true);
    }
  }

  // ---------------------------------------------------------------- combat helpers
  hitKaiju(point, radius, dmg, dir, opts = {}) {
    let result = null;
    for (const k of this.kaijus) {
      if (k.dead || k.emerging) continue;
      if (k.pos.distanceTo(point) > k.height * 1.6 + radius) continue;
      let best = null;
      for (const h of k.hitCache) {
        // weak spots need a more precise hit than the body
        const d = h.p.distanceTo(point) - h.r - (h.weak ? radius * 0.5 : radius);
        if (d < 0 && (!best || (h.weak && !best.weak) || (h.weak === best.weak && d < best.d))) best = { ...h, d };
      }
      if (best) {
        const weak = best.weak;
        const total = dmg * (weak ? 3 : 1);
        const hp = best.p.clone().lerp(point, 0.4);
        k.takeDamage(total, hp, dir, { ...opts, weak });
        this.onDamageDealt(k, total, weak, hp, opts.source);
        if (!result) result = { kaiju: k, weak, point: hp };
      }
    }
    return result;
  }

  computeAim() {
    const origin = this.camera.position;
    const dir = this.viewDir();
    let best = 2500, info = null;
    for (const k of this.kaijus) {
      if (k.dead || k.emerging) continue;
      for (const h of k.hitCache) {
        // ray-sphere
        const oc = origin.clone().sub(h.p);
        const b = oc.dot(dir);
        const c = oc.lengthSq() - h.r * h.r;
        const disc = b * b - c;
        if (disc < 0) continue;
        const t = -b - Math.sqrt(disc);
        if (t > 20 && (t < best - (h.weak ? 15 : 0))) { best = t; info = { kaiju: k, weak: h.weak }; }
      }
    }
    // little aliens (so the pilot's blaster aims right at them)
    for (const al of this.aliens.list) {
      if (al.state !== 'run' && al.state !== 'on') continue;
      const oc = origin.clone().sub(al.center);
      const b = oc.dot(dir);
      const disc = b * b - (oc.lengthSq() - 16);
      if (disc < 0) continue;
      const t = -b - Math.sqrt(disc);
      if (t > 2 && t < best) { best = t; info = { alien: al, weak: false }; }
    }
    const far = origin.clone().addScaledVector(dir, best);
    const bh = this.city.raycast(origin.clone().addScaledVector(dir, 30), far);
    if (bh) { best = 30 + (best - 30) * bh.t; info = null; }
    if (dir.y < 0) {
      const tg = -origin.y / dir.y;
      if (tg < best) { best = tg; info = null; }
    }
    this.aimPoint.copy(origin).addScaledVector(dir, best);
    this.aimInfo = info;
  }

  viewDir() {
    const { yaw, pitch } = this.view;
    return new THREE.Vector3(Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), Math.cos(yaw) * Math.cos(pitch));
  }

  thirdPersonCam(pivot, dist, side) {
    const dir = this.viewDir();
    const right = new THREE.Vector3(-Math.cos(this.view.yaw), 0, Math.sin(this.view.yaw));
    const p = pivot.clone().addScaledVector(dir, -dist).addScaledVector(right, side);
    p.y = Math.max(p.y, 4);
    return p;
  }

  updateCamera(dt) {
    const cam = this.camera;
    cam.aspect = window.innerWidth / window.innerHeight;
    cam.updateProjectionMatrix();
    if (this.debugCam) {
      // used by automated screenshot tests
      cam.position.copy(this.debugCam.pos);
      cam.lookAt(this.debugCam.look);
      this.city.followShadow(this.debugCam.look);
      return;
    }
    if (this.state === 'play' || this.state === 'over') {
      let pivot, dist, side;
      if (this.pilot && !this.pilot.dead) {
        pivot = this.pilot.pos.clone().add(new THREE.Vector3(0, 3.2, 0));
        dist = 9; side = 1.6;
      } else if (this.mech) {
        const s = this.mech.scale;
        pivot = this.mech.pos.clone().add(new THREE.Vector3(0, CAM.height * s, 0));
        dist = CAM.dist * s; side = CAM.side * s;
        if (this.mech.dead) { dist = 160; this.view.yaw += dt * 0.2; }
      }
      this.camPivot.lerp(pivot, Math.min(1, dt * 12));
      const target = this.thirdPersonCam(this.camPivot, dist, side);
      // buildings between the camera and the player turn see-through
      this.ghostT = (this.ghostT || 0) - dt;
      if (this.ghostT <= 0) {
        this.ghostT = 0.1;
        const look = this.pilot && !this.pilot.dead ? this.pilot.pos.clone().setY(this.pilot.pos.y + 1.5) : this.mech.pos.clone().setY(this.mech.pos.y + 30 * this.mech.scale);
        this.city.setGhosts(this.city.occluders(look, target));
      }
      this.camPos.copy(target);
      cam.position.copy(this.camPos);
      cam.lookAt(this.camPos.clone().addScaledVector(this.viewDir(), 1000));
      this.city.followShadow(this.camPivot);
    } else if (this.state === 'landing') {
      this.city.followShadow(this.mech.pos);
    }
    // screen shake
    if (this.shakeAmt > 0.001) {
      const s = this.shakeAmt * 2.2;
      cam.position.x += (Math.random() - 0.5) * s;
      cam.position.y += (Math.random() - 0.5) * s;
      cam.position.z += (Math.random() - 0.5) * s;
      cam.rotation.z += (Math.random() - 0.5) * this.shakeAmt * 0.01;
      this.shakeAmt *= Math.max(0, 1 - dt * 5);
    }
  }

  shake(amount, pos) {
    let a = amount;
    if (pos) a *= Math.max(0, 1 - pos.distanceTo(this.camera.position) / 900);
    this.shakeAmt = Math.min(4, this.shakeAmt + a);
  }

  hitstop(t) { this.hitstopT = Math.max(this.hitstopT, t); }

  // ---------------------------------------------------------------- events
  onDamageDealt(k, dmg, weak, pt, src) {
    if (!this.stats) return;
    if (src === 'mech' || src === 'player' || src === 'pilot' || src === 'drone') {
      this.stats.damage += dmg;
      if (src !== 'pilot' || Math.random() < 0.15) this.hud.damageNumber(pt, weak ? `WEAK! ${Math.round(dmg)}` : `${dmg < 1 ? dmg.toFixed(1) : Math.round(dmg)}`, weak, this.camera);
    }
    if (weak) {
      this.stats.weakHits++;
      if (this.stats.weakHits === 1) this.nav.say('firstWeak', 'Direct hit on the weak spot! Triple damage! Keep hitting it!', 2, 0);
      else if (this.stats.weakHits % 6 === 0) this.nav.say('weakAgain', ['Nice shot!', 'Right on the weak spot!', 'It felt that one!', 'Keep it up, pilot!'][Math.floor(Math.random() * 4)], 1, 4);
    }
  }

  onKaijuKilled(k) {
    this.stats.kills++;
    this.hud.alert(`${k.name.toUpperCase()} DEFEATED`, 3);
    this.nav.say('kill', [`${k.name} is down! Great work, pilot!`, `Kaiju defeated! The city is safer thanks to you.`, `That's how a Jaeger does it! ${k.name} is finished.`][Math.floor(Math.random() * 3)], 3, 0);
    this.hitstop(0.35);
    audio.play('uiBig');
  }

  onMechHit(amount) {
    this.hud.hurt(Math.min(0.8, amount / 120));
    this.shake(Math.min(2, amount / 50));
    audio.play('hurt');
  }

  onMechDestroyed() {
    const m = this.mech;
    if (this.pilot) { this.nav.say('mechDead', 'Your Jaeger has been destroyed!', 3, 0); }
    for (let i = 0; i < 6; i++) {
      setTimeout(() => {
        const p = m.chestPos().add(new THREE.Vector3((Math.random() - 0.5) * 30, (Math.random() - 0.5) * 40, (Math.random() - 0.5) * 30));
        this.fx.explosion(p, 1.2);
        audio.play('explosion', p, 1);
      }, i * 280);
    }
    m.piloted = false;
    this.fallMech = true;
    this.defeat('JAEGER DESTROYED', `${this.cfg.name} took too much damage.`);
  }

  onPilotHit(amount) {
    this.hud.hurt(Math.min(1, amount / 40));
    audio.play('hurt');
  }

  onPilotDown() {
    this.defeat('PILOT DOWN', 'Walking around next to a kaiju is dangerous!');
  }

  onPlantDamaged(b, amount, src) {
    if (src === 'mech' || src === 'player' || src === 'landing') {
      this.nav.say('plantOops', 'Hey! Careful! That is the power plant we are protecting!', 2, 10);
    } else if (src === 'kaiju') {
      this.nav.say('plantHit', 'The power plant is under attack! Get over there and stop that kaiju!', 3, 15);
      this.hud.alert('POWER PLANT UNDER ATTACK', 2, true);
    }
    if (this.state === 'play' && this.city.plantIntegrity() <= 0.02) {
      this.defeat('POWER PLANT LOST', 'The kaiju destroyed the power plant.');
    }
  }

  onBuildingDestroyed(b, src) {
    if (b.plant) return;
    const n = this.city.destroyed;
    if (src === 'mech' && (n === 10 || n === 50 || n === 100 || n === 200)) {
      const lines = {
        10: 'Ten buildings down. Try not to smash too much of the city, pilot!',
        50: 'Fifty buildings?! The mayor is going to send us a bill.',
        100: 'One hundred buildings! Are you fighting kaiju or helping them?',
        200: 'Two hundred buildings. I think you might BE the kaiju now.',
      };
      this.nav.say('smash' + n, lines[n], 1, 0);
    }
  }

  victory() {
    if (this.over) return;
    this.over = true;
    this.state = 'over';
    this.nav.say('victory', `Mission complete! ${this.cfg.name} saved the city! You are a real Jaeger pilot!`, 3, 0);
    audio.play('uiBig');
    setTimeout(() => { if (this.state === 'over') this.app.showEnd(true, this.summary()); }, 3500);
  }

  defeat(title, sub) {
    if (this.over) return;
    this.over = true;
    this.state = 'over';
    audio.intensity = 0.1;
    setTimeout(() => { if (this.state === 'over') this.app.showEnd(false, { ...this.summary(), title, sub }); }, 3500);
  }

  continueEndless() {
    this.mode = 'endless';
    this.over = false;
    this.state = 'play';
    this.waveState = 'cleared';
    this.waveTimer = 5;
    this.mech.hp = this.mech.maxHp;
  }

  summary() {
    const secs = Math.max(0, this.time - (this.stats.start || 0));
    return {
      kills: this.stats.kills,
      tripods: this.stats.tripods,
      weak: this.stats.weakHits,
      buildings: this.city.destroyed,
      damage: Math.round(this.stats.damage),
      wave: this.waveIdx + 1,
      time: `${Math.floor(secs / 60)}:${String(Math.floor(secs % 60)).padStart(2, '0')}`,
      plant: Math.round(this.city.plantIntegrity() * 100),
    };
  }

  stop() {
    this.hud.show(false);
    this.hud.clearTransient();
    audio.stopMusic();
    audio.stopLoops();
    this.state = 'idle';
  }
}

export { KAIJU_CATS, WORLD };
