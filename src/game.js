import * as THREE from 'three';
import { WORLD, WAVES, BACKUP, KAIJU_CATS, INVASION_WAVES } from './config.js';
import { Physics } from './physics.js';
import { Particles } from './fx/particles.js';
import { City } from './world/city.js';
import { Wasteland } from './world/wasteland.js';
import { Mech } from './entities/mech.js';
import { Kaiju } from './entities/kaiju.js';
import { Projectiles } from './entities/projectiles.js';
import { Military } from './entities/military.js';
import { Drones } from './entities/drones.js';
import { Pilot } from './entities/pilot.js';
import { Tripod, lightningStrike } from './entities/tripod.js';
import { Aliens } from './entities/aliens.js';
import { Camps } from './entities/camps.js';
import { MISSIONS, unlockMission } from './campaign.js';
import { SpawnMenu } from './ui/spawnMenu.js';
import { Scouts } from './entities/scouts.js';
import { AlienShip, CoreReactor } from './entities/ship.js';
import { buildStarDestroyer } from './scenes/legion.js';
import { TRIPODS } from './config.js';
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
    this.spawnMenu = new SpawnMenu(this);
    this.lowPower = navigator.maxTouchPoints > 0 || matchMedia('(pointer: coarse)').matches; // touch devices get lighter settings
    this.input = app.input;
    this.camera = new THREE.PerspectiveCamera(58, 1, 1, 9000);
    this.view = { yaw: Math.PI, pitch: -0.05 };
    this.buildWorld();
  }

  // ---------------------------------------------------------------- world
  // kind: 'city' (the original map) or 'wasteland' (chapter 2's huge map)
  buildWorld(kind = 'city') {
    if (this.scene) this.disposeWorld();
    this.worldKind = kind;
    this.scene = new THREE.Scene();
    this.physics = new Physics();
    this.fx = new Particles(this.scene);
    this.city = kind === 'wasteland' ? new Wasteland(this.scene, this.physics, this.fx) : new City(this.scene, this.physics, this.fx);
    this.city.onPlantDamaged = (b, amt, src) => this.onPlantDamaged(b, amt, src);
    this.city.onBuildingDestroyed = (b, src) => this.onBuildingDestroyed(b, src);
    this.projectiles = new Projectiles(this);
    this.military = new Military(this);
    this.drones = new Drones(this);
    this.aliens = new Aliens(this);
    this.scouts = new Scouts(this); // friendly scout Jaegers
    this.camps = kind === 'wasteland' ? new Camps(this) : null; // survivor camps and bunkers
    this.kaijus = [];
    this.sky = null; this.shieldDome = null; this.shieldDown = false; this.rift = null; this.riftK = 0; this.moonEye = null; this.moonBall = null; this.moonAwake = 0;
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
  startMission(cfg, mode, missionIdx = 0, grounded = false) {
    const kind = mode === 'freeplay' || mode === 'campaign' ? 'wasteland' : 'city';
    // campaign: which mission, and its scratch state
    this.missionIdx = Math.max(0, Math.min(MISSIONS.length - 1, missionIdx || 0));
    this.mission = mode === 'campaign' ? MISSIONS[this.missionIdx] : null;
    this.ms = { t: 0, started: false, s: {}, gaveLaser: false };
    // Part 3: all weapons are from the future, so every weapon can hurt every tripod. The old rule only holds in the part 1 and 2 story missions.
    this.future = mode !== 'campaign' || (this.mission && this.mission.part >= 3);
    if (this.mission && this.mission.needsSpecial && !['sword', 'laser'].includes(cfg.left) && !['sword', 'laser'].includes(cfg.right)) {
      cfg.right = 'laser'; // nothing else can hurt an Uber Pod or the Emperor Pod
      this.ms.gaveLaser = true;
    }
    // the Emperor Pod is too tall for a sword to reach its body, so that mission always brings a Laser Blaster
    if (this.mission && this.mission.needsLaser && cfg.left !== 'laser' && cfg.right !== 'laser') { cfg.right = 'laser'; this.ms.gaveLaser = true; }
    if (this.dirty || kind !== this.worldKind) this.buildWorld(kind);
    this.dirty = true;
    this.fp = { t: 16, count: 0, craterCd: 0 }; // free play spawn timers
    this.cfg = cfg;
    this.mode = mode;
    this.time = 0;
    this.stats = { kills: 0, tripods: 0, shipsGone: 0, byType: {}, weakHits: 0, damage: 0, start: 0, bonks: 0 };
    this.cooldowns = { drones: 0, apache: 12, gunship: 25, jets: 35, missiles: 0 };
    this.waveIdx = -1;
    this.waveState = 'pre';
    this.waveTimer = 14;
    this.spawnQueue = [];
    const mega = (this.mission && this.mission.mega) || (mode !== 'campaign' && this.app.hangar && this.app.hangar.settings.mega); // the hangar switch works outside the story
    this.megaOn = !!mega;
    if (mega) cfg = { ...cfg, mega: 5, name: 'MEGA MECH' };
    this.mech = new Mech(this, cfg);
    this.mech.setPosition(LAND.x, 900, LAND.z);
    this.mech.yaw = Math.PI;
    this.view.yaw = Math.PI;
    this.view.pitch = -0.1;
    this.carrier = this.drones.spawnCarrier(cfg.glow, new THREE.Vector3(LAND.x, 1600, LAND.z + 600));
    this.landing = { t: 0, released: false, landed: false, vy: 0 };
    this.state = 'landing';
    this.hud.freePlay = mode === 'freeplay' || mode === 'campaign';
    this.hud.setup(cfg);
    this.over = false;
    this.lastLowArmor = 0;
    this.tutorial = 0;
    this.tutorialT = 0;
    this.moved = false;
    this.attacked = false;
    audio.intensity = 0.2;
    this.clouds();
    if ((this.mission && this.mission.part >= 3 && !this.mission.core && !this.mission.alien && !this.mission.corrupt && !this.mission.legion) || mode === 'freeplay') this.skyFleet();
    if (grounded) this.startGrounded();
  }

  // The chapter 2 opening already showed the Jaeger landing, so skip the drop and start on the ground.
  startGrounded() {
    const m = this.mech;
    const at = this.mission && this.mission.startAt ? this.mission.startAt(this) : LAND; // some missions start somewhere else
    m.setPosition(at.x, this.city.groundAt(at.x, at.z), at.z);
    if (at === LAND) this.city.damageArea(new THREE.Vector3(LAND.x, 5, LAND.z), 75, 1400, { source: 'landing', noFx: true });
    this.carrier.g.visible = false;
    this.camPivot.copy(m.pos).add(new THREE.Vector3(0, CAM.height * m.scale, 0));
    this.beginPlay();
  }

  // Part 3 sky (Patrick: "I want to see all the ships from Earth and the destroyed planet"):
  // the fleet in orbit as real ship shapes plus far-off lights, and the broken enemy planet.
  // It all rides along with the camera, so it always looks far away.
  skyFleet() {
    const sky = this.sky = new THREE.Group();
    const noFog = { fog: false, depthWrite: false };
    // far-off ships: points of light
    const n = this.lowPower ? 300 : 600, pos = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      const a = Math.random() * 6.28, r = 500 + Math.random() * 6000;
      pos.set([Math.cos(a) * r, 2400 + Math.random() * 2200, Math.sin(a) * r], i * 3);
    }
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const pts = new THREE.Points(geo, new THREE.PointsMaterial({ color: '#ff7a4a', size: 3, sizeAttenuation: false, transparent: true, opacity: 0.9, ...noFog }));
    pts.frustumCulled = false;
    // nearer ships: you can see their shape and their engines
    const SH = this.lowPower ? 90 : 170, hullGeo = new THREE.SphereGeometry(1, 10, 6); hullGeo.scale(1, 0.28, 1.6);
    const hulls = new THREE.InstancedMesh(hullGeo, new THREE.MeshBasicMaterial({ color: '#9aa2b6', ...noFog }), SH);
    const engines = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 6, 4), new THREE.MeshBasicMaterial({ color: '#ff5a2a', ...noFog }), SH * 2);
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), p = new THREE.Vector3(), sc = new THREE.Vector3(), e = new THREE.Euler();
    for (let i = 0; i < SH; i++) {
      const a = Math.random() * 6.28, r = 700 + Math.random() * 4600, size = 26 + Math.random() * 60;
      p.set(Math.cos(a) * r, 1300 + Math.random() * 1700, Math.sin(a) * r);
      const yaw = -a + (Math.random() - 0.5) * 0.5; // they circle the sky
      q.setFromEuler(e.set(0, yaw, 0));
      hulls.setMatrixAt(i, m.compose(p, q, sc.setScalar(size)));
      for (const sgn of [-1, 1]) {
        const ep = new THREE.Vector3(sgn * 0.5 * size, 0, -1.5 * size).applyQuaternion(q).add(p);
        engines.setMatrixAt(i * 2 + (sgn > 0 ? 1 : 0), m.compose(ep, q, sc.setScalar(size * 0.16)));
      }
    }
    hulls.frustumCulled = engines.frustumCulled = false;
    const fleet = this.skyShips = new THREE.Group(); fleet.add(pts, hulls, engines);
    sky.add(fleet);
    // what is left of the enemy planet: a glowing core and a cloud of broken pieces
    const wreck = new THREE.Group(); wreck.position.set(-3600, 3900, -4300);
    const core = new THREE.Mesh(new THREE.IcosahedronGeometry(330, 1), new THREE.MeshBasicMaterial({ color: '#ff5a2a', ...noFog })); wreck.add(core);
    const halo = new THREE.Mesh(new THREE.SphereGeometry(620, 20, 14), new THREE.MeshBasicMaterial({ color: '#ff8a4a', transparent: true, opacity: 0.16, blending: THREE.AdditiveBlending, ...noFog })); wreck.add(halo);
    const CH = 150, chunks = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 0), new THREE.MeshBasicMaterial({ color: '#8a2c3c', ...noFog }), CH);
    for (let i = 0; i < CH; i++) {
      p.randomDirection().multiplyScalar(380 + Math.random() ** 0.6 * 1100); p.y *= 0.55;
      q.setFromEuler(e.set(Math.random() * 6, Math.random() * 6, 0));
      chunks.setMatrixAt(i, m.compose(p, q, sc.setScalar(25 + Math.random() * 110)));
    }
    chunks.frustumCulled = false; wreck.add(chunks);
    const ring = new THREE.Mesh(new THREE.RingGeometry(900, 1500, 48), new THREE.MeshBasicMaterial({ color: '#c96a4a', transparent: true, opacity: 0.22, side: THREE.DoubleSide, ...noFog }));
    ring.rotation.x = 1.2; ring.rotation.y = 0.4; wreck.add(ring);
    this.skyWreck = wreck;
    sky.add(wreck);
    this.scene.add(sky);
  }

  // An alien ship comes down out of the sky and hovers near you, dropping tripods that are already awake.
  queueShip(cargo = ['attacker', 'attacker'], type = 'ship') {
    const ref = this.pilot && !this.pilot.dead ? this.pilot.pos : (this.mech ? this.mech.pos : new THREE.Vector3());
    const B = this.city.bound - 150;
    const a = this.view.yaw + (Math.random() - 0.5) * 1.6, d = 330 + Math.random() * 170;
    const x = THREE.MathUtils.clamp(ref.x + Math.sin(a) * d, -B, B), z = THREE.MathUtils.clamp(ref.z + Math.cos(a) * d, this.city.waterEdge + 120, B);
    const ship = new AlienShip(this, { type, x, z, cargo });
    this.kaijus.push(ship);
    audio.play('alarm');
    this.hud.alert(type === 'destroyer' ? 'STAR DESTROYER COMING DOWN' : type === 'mothership' ? 'THE MOTHERSHIP IS ENTERING THE ATMOSPHERE' : 'ALIEN SHIP ENTERING THE ATMOSPHERE', 5, true);
    this.nav.say(type === 'destroyer' ? 'destroyerWarn' : type === 'mothership' ? 'mothership' : 'shipWarn', type === 'destroyer' ? 'A Tri Legion Star Destroyer! Three prongs and a burning core. It fires a huge beam: get out of the red ring. Shoot the glowing blue core underneath it!' : type === 'mothership'
      ? 'That is the Mothership! It is enormous, and it is full of tripods. Aim for the glowing core underneath it!'
      : 'A ship is coming down out of orbit! Look up. It will drop tripods that are already awake. Shoot the glowing core underneath it!', 3, 0);
    return ship;
  }

  // Part 4: a human links with a kaiju, and it fights on our side (blue halo, green on the radar)
  spawnFriend(cat = 3) {
    const m = this.mech, a = Math.random() * 6.28, d = 130 + Math.random() * 70;
    const k = new Kaiju(this, { cat, x: m.pos.x + Math.cos(a) * d, z: m.pos.z + Math.sin(a) * d, from: 'ground', friendly: true });
    this.kaijus.push(k);
    this.hud.alert('KAIJU LINKED! IT IS ON YOUR SIDE', 4);
    this.nav.say('friend', `A pilot has linked minds with a kaiju! ${k.name} is fighting with us now. Look for the blue halo. You cannot hurt it, and it will not hurt you.`, 3, 0);
    return k;
  }

  // Part 4: a walker built by humans. It looks nothing like the alien ones, and it fights for us.
  spawnWalker() {
    const m = this.mech, a = Math.random() * 6.28, d = 150 + Math.random() * 90;
    const t = this.spawnAwake('guardian', m.pos.x + Math.cos(a) * d, m.pos.z + Math.sin(a) * d);
    this.nav.say('walker', `That white and yellow walker is ours! Humans built it. ${t.name} will fight the alien tripods with you.`, 2, 30);
    return t;
  }

  // Part 4: the tripods' base under the Earth. Turns wherever you are into a cave, and puts the Core Reactor in it.
  enterCore(x, z) {
    this.scene.fog = new THREE.Fog('#2a0a0a', 180, 1500);
    this.scene.background = new THREE.Color('#12060a');
    if (this.city.sky) this.city.sky.visible = false;
    if (this.city.sun) this.city.sun.intensity *= 0.45;
    const cave = new THREE.Group();
    const dome = new THREE.Mesh(new THREE.SphereGeometry(1700, 32, 20), new THREE.MeshBasicMaterial({ color: '#1c0b0d', side: THREE.BackSide, fog: false }));
    dome.scale.y = 0.55; cave.add(dome);
    const lava = new THREE.MeshBasicMaterial({ color: '#ff6a2a', fog: false });
    for (let i = 0; i < 46; i++) {
      const a = Math.random() * 6.28, r = 380 + Math.random() * 1000, h = 500 + Math.random() * 500;
      const p = new THREE.Mesh(new THREE.CylinderGeometry(6 + Math.random() * 10, 10 + Math.random() * 16, h, 7), lava);
      p.position.set(Math.cos(a) * r, h / 2 - 60, Math.sin(a) * r); cave.add(p);
    }
    cave.position.set(x, 0, z);
    this.scene.add(cave);
    this.scene.add(new THREE.HemisphereLight('#ff8a5a', '#3a1010', 1.1));
    this.reactor = new CoreReactor(this, { x, z });
    this.kaijus.push(this.reactor);
    return this.reactor;
  }

  // Part 5: we are on the aliens' own planet. Purple sky, a green shield overhead, and our Venture Stars above.
  enterAlienPlanet() {
    this.scene.fog = new THREE.Fog('#3a1f4a', 420, 3400);
    this.scene.background = new THREE.Color('#1a0d26');
    if (this.city.sky) this.city.sky.visible = false;
    if (this.city.sun) this.city.sun.color.set('#d8b8ff');
    this.scene.add(new THREE.HemisphereLight('#b48aff', '#1f4a3a', 0.9));
    const sky = this.sky = new THREE.Group();
    const noFog = { fog: false, depthWrite: false };
    const back = new THREE.Mesh(new THREE.SphereGeometry(8000, 24, 16), new THREE.MeshBasicMaterial({ color: '#241238', side: THREE.BackSide, ...noFog })); sky.add(back);
    // the shield: a green grid across the whole sky (it goes away when the generators are destroyed)
    this.shieldDome = new THREE.Mesh(new THREE.IcosahedronGeometry(6500, 3), new THREE.MeshBasicMaterial({ color: '#5affc0', wireframe: true, transparent: true, opacity: 0.35, ...noFog }));
    sky.add(this.shieldDome);
    // two moons
    const moons = this.skyWreck = new THREE.Group();
    for (const [x, y, z, r, c] of [[-3800, 3600, -3200, 520, '#c8b8e8'], [3000, 2600, -4600, 260, '#8affc0']]) { const m = new THREE.Mesh(new THREE.SphereGeometry(r, 20, 14), new THREE.MeshBasicMaterial({ color: c, ...noFog })); m.position.set(x, y, z); moons.add(m); }
    sky.add(moons);
    // the Venture Stars, waiting overhead
    const stars = this.skyShips = new THREE.Group();
    const white = new THREE.MeshBasicMaterial({ color: '#dfe6f0', ...noFog }), blue = new THREE.MeshBasicMaterial({ color: '#5ac8ff', ...noFog });
    for (let i = 0; i < 3; i++) {
      const g = new THREE.Group();
      g.add(new THREE.Mesh(new THREE.BoxGeometry(160, 80, 760), white));
      const stripe = new THREE.Mesh(new THREE.BoxGeometry(164, 14, 560), blue); stripe.position.y = -42; g.add(stripe);
      for (const sx of [-1, 1]) { const w = new THREE.Mesh(new THREE.BoxGeometry(200, 14, 260), white); w.position.set(sx * 170, -10, -220); g.add(w); }
      const a = i * 2.1 + 0.4;
      g.position.set(Math.cos(a) * 2300, 1500 + i * 260, Math.sin(a) * 2300); g.rotation.y = -a;
      stars.add(g);
    }
    sky.add(stars);
    this.scene.add(sky);
    // alien spires all over the land
    const spire = new THREE.MeshBasicMaterial({ color: '#7dffb0' }), spire2 = new THREE.MeshBasicMaterial({ color: '#b07dff' });
    const m = this.mech.pos;
    for (let i = 0; i < (this.lowPower ? 40 : 70); i++) {
      const a = Math.random() * 6.28, r = 260 + Math.random() * 1700, x = m.x + Math.cos(a) * r, z = m.z + Math.sin(a) * r, h = 60 + Math.random() * 240;
      if (Math.abs(x) > this.city.bound || Math.abs(z) > this.city.bound) continue;
      const c = new THREE.Mesh(new THREE.ConeGeometry(5 + Math.random() * 10, h, 5), i % 2 ? spire : spire2);
      c.position.set(x, this.city.groundAt(x, z) + h / 2 - 4, z); this.scene.add(c);
    }
  }

  // Chapter 2: Star Destroyers hang in the sky, and so does the Moon, which is alive. this.moonAwake (0 to 1) opens its eye.
  enterLegionSky() {
    const sky = this.sky = new THREE.Group();
    const noFog = { fog: false, depthWrite: false };
    const ships = this.skyShips = new THREE.Group();
    for (let i = 0; i < (this.lowPower ? 5 : 9); i++) {
      const d = buildStarDestroyer(1.6 + (i % 3) * 0.7);
      d.traverse((o) => { if (o.material) { o.material = o.material.clone(); o.material.fog = false; } });
      const a = i * 0.7 + 0.3, r = 2600 + (i % 4) * 700;
      d.position.set(Math.cos(a) * r, 1900 + (i % 3) * 500, Math.sin(a) * r); d.rotation.x = Math.PI / 2; d.rotation.z = i;
      ships.add(d);
    }
    sky.add(ships);
    const moon = this.skyWreck = new THREE.Group();
    const ball = new THREE.Group(); ball.position.set(-2600, 3700, -3800);
    ball.add(new THREE.Mesh(new THREE.SphereGeometry(620, 32, 22), new THREE.MeshBasicMaterial({ color: '#c4c4d0', ...noFog })));
    const crater = new THREE.MeshBasicMaterial({ color: '#9a9aaa', ...noFog });
    for (let i = 0; i < 12; i++) { const c = new THREE.Mesh(new THREE.CircleGeometry(40 + Math.random() * 80, 14), crater); const d = new THREE.Vector3().randomDirection(); c.position.copy(d).multiplyScalar(623); c.lookAt(d.clone().multiplyScalar(1500)); ball.add(c); }
    const eye = this.moonEye = new THREE.Group();
    const white = new THREE.Mesh(new THREE.SphereGeometry(230, 24, 16), new THREE.MeshBasicMaterial({ color: '#ffe27a', ...noFog })); white.scale.z = 0.2; eye.add(white);
    const pupil = this.moonPupil = new THREE.Mesh(new THREE.SphereGeometry(100, 16, 12), new THREE.MeshBasicMaterial({ color: '#12060a', ...noFog })); pupil.scale.set(0.5, 1, 0.3); pupil.position.z = 40; eye.add(pupil);
    const toYou = new THREE.Vector3(2600, -3700, 3800).normalize();
    eye.position.copy(toYou).multiplyScalar(600); eye.lookAt(toYou.clone().multiplyScalar(3000));
    ball.add(eye); moon.add(ball);
    this.moonBall = ball;
    sky.add(moon);
    this.scene.add(sky);
  }

  // The Moon helps: a pale beam from the sky onto one enemy.
  moonBeam(target) {
    if (!target || !this.moonBall) return;
    const to = target.hitCache ? target.hitCache[0].p.clone() : target.pos.clone();
    const from = this.moonBall.getWorldPosition(new THREE.Vector3()).sub(to).normalize().multiplyScalar(1400).add(to);
    for (let i = 0; i <= 26; i++) this.fx.glow(from.clone().lerp(to, i / 26), new THREE.Color('#fff2b0'), 70, 0.7);
    this.fx.explosion(to, 1.8); this.fx.flash(to, '#fff2b0', 12000, 0.4);
    audio.play('thunder', to, 1.3); this.shake(1, to);
    target.shield = 0;
    target.takeDamage(600, to, null, { source: 'moon', weapon: 'laser' });
    this.hud.alert('MOON BEAM!', 2.5);
    this.nav.say('moonBeam', 'The Moon is helping us! That beam came from its eye!', 2, 25);
  }

  // Part 6: the Earth has been corrupted. A sick green haze, purple growths all over the land, glowing nests.
  enterCorruption() {
    this.scene.fog = new THREE.Fog('#2f4a33', 320, 3000);
    this.scene.background = new THREE.Color('#16241a');
    if (this.city.sky) this.city.sky.visible = false;
    if (this.city.sun) { this.city.sun.color.set('#c8ffb0'); this.city.sun.intensity *= 0.8; }
    this.scene.add(new THREE.HemisphereLight('#8aff9a', '#3a1a4a', 0.8));
    const sky = this.sky = new THREE.Group();
    const noFog = { fog: false, depthWrite: false };
    sky.add(new THREE.Mesh(new THREE.SphereGeometry(8000, 24, 16), new THREE.MeshBasicMaterial({ color: '#1c3020', side: THREE.BackSide, ...noFog })));
    this.skyShips = new THREE.Group(); this.skyWreck = new THREE.Group();
    // far-off hive towers on the horizon
    const tower = new THREE.MeshBasicMaterial({ color: '#6a2a8a', ...noFog });
    for (let i = 0; i < 14; i++) { const a = i * 0.45 + 0.2, h = 900 + (i % 4) * 400; const t = new THREE.Mesh(new THREE.ConeGeometry(160 + (i % 3) * 80, h, 6), tower); t.position.set(Math.cos(a) * 5200, h / 2 - 100, Math.sin(a) * 5200); this.skyWreck.add(t); }
    sky.add(this.skyShips, this.skyWreck);
    this.scene.add(sky);
    // growths across the land near where you are
    const vine = new THREE.MeshStandardMaterial({ color: '#5a1f7a', roughness: 0.7, emissive: '#2a0a3a', emissiveIntensity: 1 });
    const bulb = new THREE.MeshBasicMaterial({ color: '#7dffb0' });
    const m = this.mech.pos, N = this.lowPower ? 55 : 110;
    const vines = new THREE.InstancedMesh(new THREE.ConeGeometry(1, 1, 6), vine, N), bulbs = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 8, 6), bulb, N);
    const mat = new THREE.Matrix4(), q = new THREE.Quaternion(), p = new THREE.Vector3(), sc = new THREE.Vector3(), e = new THREE.Euler();
    for (let i = 0; i < N; i++) {
      const a = Math.random() * 6.28, r = 120 + Math.random() * 1900, x = m.x + Math.cos(a) * r, z = m.z + Math.sin(a) * r, h = 30 + Math.random() * 130;
      const gy = this.city.groundAt(x, z);
      q.setFromEuler(e.set((Math.random() - 0.5) * 0.5, 0, (Math.random() - 0.5) * 0.5));
      vines.setMatrixAt(i, mat.compose(p.set(x, gy + h / 2 - 3, z), q, sc.set(6 + Math.random() * 9, h, 6 + Math.random() * 9)));
      bulbs.setMatrixAt(i, mat.compose(p.set(x, gy + h + 2, z), q, sc.setScalar(4 + Math.random() * 5)));
    }
    vines.frustumCulled = bulbs.frustumCulled = false;
    this.scene.add(vines, bulbs);
  }

  // Part 7: the tripods are tearing open a new dimension. A purple rift in the sky with new planets inside it.
  // this.riftK (0 to 1) is how far open it is.
enterRift(count = 1, unstable = false) {
    const noFog = { fog: false, depthWrite: false };
    const spots = [[1500, 3600, -4200], [-3200, 3000, -3000], [3600, 2800, 1200], [-1200, 4200, 3600], [-4200, 2600, 600]];
    this.riftList = []; this.riftUnstable = unstable;
    const all = this.rift = new THREE.Group();
    for (let n = 0; n < count; n++) {
      const rift = new THREE.Group();
      rift.add(new THREE.Mesh(new THREE.CircleGeometry(1000, 40), new THREE.MeshBasicMaterial({ color: '#12041f', side: THREE.DoubleSide, ...noFog })));
      rift.add(new THREE.Mesh(new THREE.RingGeometry(980, 1120, 48), new THREE.MeshBasicMaterial({ color: n % 2 ? '#ff7d5a' : '#c07dff', side: THREE.DoubleSide, transparent: true, opacity: 0.9, ...noFog })));
      rift.add(new THREE.Mesh(new THREE.RingGeometry(1100, 1500, 48), new THREE.MeshBasicMaterial({ color: '#7d3aff', side: THREE.DoubleSide, transparent: true, opacity: 0.25, blending: THREE.AdditiveBlending, ...noFog })));
      const planets = [];
      for (const [c, r, x, y] of [['#5ac8ff', 230, -380, 160], ['#ffb04a', 150, 330, 300], ['#7dffb0', 190, 260, -330], ['#ff7df0', 110, -300, -380], ['#e8e0ff', 70, 20, 30]]) {
        const pl = new THREE.Mesh(new THREE.SphereGeometry(r, 20, 14), new THREE.MeshBasicMaterial({ color: c, ...noFog })); pl.position.set(x, y, 40); rift.add(pl); planets.push(pl);
      }
      rift.position.set(...spots[n % spots.length]);
      rift.lookAt(0, 300, 0);
      rift.userData = { planets, size: n === 0 ? 1 : 0.55 + (n % 3) * 0.12, phase: n * 1.7 };
      all.add(rift); this.riftList.push(rift);
    }
    this.riftK = 0.35;
    (this.sky || this.scene).add(all);
  }

  // Parts 8 and 9: the rifts are not stable. Purple lightning comes down near you, out of the rifts.
  updateRiftStorm(dt) {
    this.stormT = (this.stormT ?? 4) - dt;
    if (this.stormT > 0 || !this.mech) return;
    this.stormT = 3 + Math.random() * 4;
    const a = Math.random() * 6.28, d = 150 + Math.random() * 380;
    lightningStrike(this, this.mech.pos.x + Math.cos(a) * d, this.mech.pos.z + Math.sin(a) * d, Math.random() < 0.3);
  }

  // Part 5: "hundreds of mechs... and they are all on the planet". The army that the Venture Stars dropped
  // stands in ranks behind you. (The ones that actually fight are your allies; these hold the landing zone.)
  addArmy(x, z, yaw) {
    const N = this.lowPower ? 150 : 300;
    const geos = [new THREE.BoxGeometry(11, 22, 8), new THREE.BoxGeometry(8, 17, 6), new THREE.BoxGeometry(12, 7, 12)];
    const cols = ['#2c5aa0', '#c9d3df', '#f2c230'];
    const fx = Math.sin(yaw), fz = Math.cos(yaw);
    const m = new THREE.Matrix4(), q = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, yaw, 0)), p = new THREE.Vector3(), sc = new THREE.Vector3(1, 1, 1);
    for (let kind = 0; kind < 3; kind++) {
      const mesh = new THREE.InstancedMesh(geos[kind], new THREE.MeshStandardMaterial({ color: cols[kind], roughness: 0.6, metalness: 0.3 }), N / 3);
      const legs = new THREE.InstancedMesh(new THREE.BoxGeometry(kind === 2 ? 14 : 7, kind === 2 ? 26 : 16, 3), new THREE.MeshStandardMaterial({ color: '#39404e' }), N / 3);
      for (let i = 0; i < N / 3; i++) {
        const row = Math.floor(i / 10) * 3 + kind, col = i % 10;
        const back = 120 + row * 34, side = (col - 4.5) * 30 + (row % 2) * 12;
        const px = x - fx * back + fz * side, pz = z - fz * back - fx * side, gy = this.city.groundAt(px, pz);
        const legH = kind === 2 ? 26 : 16;
        legs.setMatrixAt(i, m.compose(p.set(px, gy + legH / 2, pz), q, sc));
        mesh.setMatrixAt(i, m.compose(p.set(px, gy + legH + (kind === 2 ? 3.5 : kind === 0 ? 11 : 8.5), pz), q, sc));
      }
      mesh.castShadow = false; mesh.frustumCulled = false; legs.frustumCulled = false;
      this.scene.add(mesh, legs);
    }
  }

  // a tall beam of light that marks a place to go
  addBeacon(x, z, color = '#ff3a3a') {
    const b = new THREE.Mesh(new THREE.CylinderGeometry(7, 7, 900, 10, 1, true), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.45, depthWrite: false, fog: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending }));
    b.position.set(x, this.city.groundAt(x, z) + 450, z);
    this.scene.add(b);
    return b;
  }

  // a tripod that is already awake and walking (part 3: nothing is asleep underground any more)
  spawnAwake(type, x, z) {
    const t = new Tripod(this, { type, x, z, awake: true });
    this.kaijus.push(t);
    return t;
  }

  clouds() {
    for (let i = 0; i < 160; i++) {
      const p = new THREE.Vector3(LAND.x + (Math.random() - 0.5) * 1400, 820 + Math.random() * 120, LAND.z + (Math.random() - 0.5) * 1400);
      this.fx.alpha.spawn(p, new THREE.Vector3(Math.random() * 3, 0, Math.random() * 3), 14, 160, 220, new THREE.Color('#d8c8d8'), new THREE.Color('#b8a8c0'), 0.55, 0, 0);
    }
  }

  waveLabel() {
    if (this.mode === 'smash') return 'FREE SMASH';
    if (this.mode === 'freeplay') return 'FREE PLAY';
    if (this.mode === 'campaign') return this.ms.started ? `M${this.missionIdx + 1} · ${this.mission.goal(this, this.ms.s)}` : `MISSION ${this.missionIdx + 1}: ${this.mission.title.toUpperCase()}`;
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

  // On the huge map enemies can come up anywhere around you.
  pickWildSpawn() {
    const ref = this.pilot && !this.pilot.dead ? this.pilot.pos : (this.mech ? this.mech.pos : new THREE.Vector3());
    const B = this.city.bound - 150;
    const a = Math.random() * Math.PI * 2, d = 800 + Math.random() * 600; // far away, so you get to hunt it down
    const x = THREE.MathUtils.clamp(ref.x + Math.cos(a) * d, -B, B);
    const z = THREE.MathUtils.clamp(ref.z + Math.sin(a) * d, -B, B);
    const wet = this.city.groundAt(x, z) < -2;
    return { x, z, from: wet ? 'water' : 'ground', sector: this.city.nearestPlace(x, z).name };
  }

  pickSpawn() {
    if (this.city.hasTerrain) return this.pickWildSpawn();
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

  queueKaiju(cat, spot = null) {
    const s = spot || this.pickSpawn();
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
  queueTripod(type = 'attacker', near = false) {
    const ref = this.pilot && !this.pilot.dead ? this.pilot.pos : (this.mech ? this.mech.pos : new THREE.Vector3());
    const B = this.city.bound - 120;
    let x = 0, z = 0;
    for (let tries = 0; tries < 12; tries++) {
      const a = this.view.yaw + (Math.random() - 0.5) * (0.9 + tries * 0.4);
      const d = this.city.hasTerrain && !near ? 650 + Math.random() * 450 : 330 + Math.random() * 200; // far off on the big map
      x = THREE.MathUtils.clamp(ref.x + Math.sin(a) * d, -B, B);
      z = THREE.MathUtils.clamp(ref.z + Math.cos(a) * d, this.city.waterEdge + 120, B);
      const farFromMe = Math.hypot(x - ref.x, z - ref.z) > 220;
      const farFromPlant = this.city.noPlant || Math.hypot(x - this.city.plantCenter.x, z - this.city.plantCenter.z) > 230;
      if (farFromMe && farFromPlant) break;
    }
    // the Uber Pod gets the full 20 lightning strikes
    this.warnings.push({ tripod: true, type, t: type === 'emperor' || TRIPODS[type].boss ? 15 : type === 'uber' ? 13 : 8.5, quick: type === 'uber' || type === 'emperor' || !!TRIPODS[type].boss, strikeT: 0.2, strikes: 0, x, z, zone: new THREE.Vector3(x, 0, z), radius: 90 });
    audio.play('alarm');
    this.hud.alert('LIGHTNING STORM AHEAD', 5, true);
    this.nav.say('tripodWarn', 'Lightning keeps hitting the same spot ahead of you! Something is coming up out of the ground. Hide behind a building so its scanner light cannot find you!', 3, 0);
  }

  spawnTripod(w) {
    lightningStrike(this, w.x, w.z, true);
    const t = new Tripod(this, { type: w.type, x: w.x, z: w.z });
    this.kaijus.push(t);
    this.hud.alert(`${TRIPODS[w.type].name.toUpperCase()} RISING`, 4, true);
    if (w.type === 'harvester') this.nav.say('harvRise', `That is a Harvester! It is going after the survivor camps and the animals. Catch it before it gets there, and watch out for its legs: it stomps!`, 3, 0);
    else if (w.type === 'emperor') this.nav.say('emperorRise', `The Emperor Pod! It is taller than every other tripod. It has the Uber Pod's lasers AND the Harvester's cage, and it stomps. Only your Energy Sword or Laser Blaster can hurt it!`, 3, 0);
    else if (w.type === 'uber') this.nav.say('uberRise', this.future ? `An Uber Pod! Look at the size of it. Stacked lasers and long legs. Good thing your weapons are from the future: they all hurt it now!` : `An Uber Pod! Look at the size of it. Stacked lasers and long legs. Remember: only your Energy Sword or Laser Blaster can hurt it!`, 3, 0);
    else if (TRIPODS[w.type].intro) this.nav.say('rise_' + w.type, TRIPODS[w.type].intro, 3, 0);
    else this.nav.say('tripodRise', `A tripod! Legs first, then it pushes itself up. That is ${t.name}. It can only attack if its scanner light finds you. Its weak spot is the glowing core underneath.`, 3, 0);
    return t;
  }

  onTripodKilled(t) {
    if (t.friendly) { this.hud.alert(`OUR ${t.name.toUpperCase()} WAS DESTROYED`, 3); this.nav.say('walkerDown', `We lost ${t.name}! The crew got out safely.`, 2, 10); return; }
    this.stats.kills++;
    this.stats.tripods++;
    this.stats.byType[t.type] = (this.stats.byType[t.type] || 0) + 1;
    this.fieldRepair();
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
      for (const k of this.kaijus) {
        // one broken enemy must not freeze the whole game: report it and take it off the map
        try { k.update(dt); } catch (e) { this.app.reportError(e, k.type || 'kaiju'); k.dead = true; k.removeMe = true; }
      }
      { // fallen tripods stay on the map; keep the newest 14 wrecks
        const wrecks = this.kaijus.filter((k) => k.isTripod && k.dead && k.landed);
        if (wrecks.length > (this.lowPower ? 5 : 14)) wrecks[0].removeMe = true; // fewer on iPads and phones, to save memory
      }
      for (let i = this.kaijus.length - 1; i >= 0; i--) if (this.kaijus[i].removeMe) { this.kaijus[i].remove(); this.kaijus.splice(i, 1); }
      this.projectiles.update(dt);
      this.military.update(dt);
      this.aliens.update(dt);
      this.scouts.update(dt);
      if (this.camps) this.camps.update(dt);
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
    if (this.sky) { // the fleet and the broken planet stay far away, and the ships circle slowly
      this.sky.position.set(this.camera.position.x, 0, this.camera.position.z);
      this.skyShips.rotation.y += rawDt * (this.shieldDome ? 0.004 : 0.012);
      if (!this.moonEye) this.skyWreck.rotation.y += rawDt * (this.shieldDome ? 0.001 : 0.01); // (the Moon stays put)
      if (this.moonEye) { const w = this.moonAwake || 0; this.moonEye.scale.set(1, Math.max(0.02, w), 1); this.moonPupil.position.x = Math.sin(this.time * 0.7) * 70 * w; }
      if (this.rift) for (const r of this.riftList) {
        const u = r.userData, wob = this.riftUnstable ? Math.sin(this.time * 7 + u.phase) * 0.06 + (Math.random() < 0.04 ? 0.12 : 0) : Math.sin(this.time * 2) * 0.015;
        const k = Math.max(0.01, (0.25 + this.riftK * 0.85) * u.size + wob);
        r.scale.set(k, k, 1);
        u.planets.forEach((p, i) => { p.position.z = 40 + Math.sin(this.time * 0.6 + i + u.phase) * 30; if (this.riftUnstable) p.position.x += Math.sin(this.time * 1.3 + i * 2 + u.phase) * 0.9; }); // the planets drift toward each other
      }
      if (this.shieldDome) { this.shieldDome.rotation.y += rawDt * 0.006; this.shieldDome.material.opacity += ((this.shieldDown ? 0 : 0.3 + Math.sin(this.time * 1.5) * 0.08) - this.shieldDome.material.opacity) * Math.min(1, rawDt * 1.5); }
    }
    if (playing || this.state === 'over') this.computeAim();
    if (playing || this.state === 'over') this.hud.update(rawDt, this);
    audio.setListener(this.camera.position);
  }

  handleKeys() {
    const input = this.input;
    // spawn menu: B opens it, then a number picks (the numbers do not call air support while it is open)
    if (input.pressed('KeyB')) this.spawnMenu.toggle();
    if (this.spawnMenu.open) {
      for (let i = 1; i <= 9; i++) if (input.pressed(`Digit${i}`)) { this.spawnMenu.pickKey(i - 1); break; }
      return;
    }
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
    if (this.camps && input.pressed('KeyR')) this.camps.repair();
    if (this.camps && input.pressed('Digit4')) this.camps.callTruck();
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
    if (input.pressed('KeyY') && this.mode === 'smash' && !this.warnings.some((w) => w.tripod)) this.queueTripod('emperor');
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
    // scout Jaegers help out everywhere except the story modes
    if (this.mission && this.mission.scouts) this.scouts.deploy(this.mission.scouts, this.mission.scoutPower || 1, this.mission.allyFrames || ['scout']); // some missions bring a squadron
    if (this.mission && this.mission.legion) this.enterLegionSky();
    if (this.mission && this.mission.corrupt) this.enterCorruption();
    if (this.mission && this.mission.rift) this.enterRift(this.mission.rift === true ? 1 : this.mission.rift, !!this.mission.storm);
    if (this.megaOn && this.scene.fog) { this.scene.fog.near = 1100; this.scene.fog.far = 7000; } // you are 5 times bigger, so you see 5 times farther
    if (this.mission && this.mission.alien) { this.enterAlienPlanet(); this.addArmy(this.mech.pos.x, this.mech.pos.z, this.mech.yaw); }
    if (this.mission) { for (let i = 0; i < (this.mission.friends || 0); i++) this.spawnFriend(); for (let i = 0; i < (this.mission.walkers || 0); i++) this.spawnWalker(); }
    if (!['campaign', 'mission'].includes(this.mode)) {
      this.scouts.deploy(this.mode === 'freeplay' ? 3 : 2);
      setTimeout(() => this.nav.say('scouts', 'Scout Jaegers are patrolling with you. They are the small colored arrows on your radar, and they shoot at any bad guy they find.', 2, 0), 38000);
    }
    if (this.mode === 'freeplay') {
      setTimeout(() => this.nav.say('freePlay', 'Free Play! This is the big map. The giant hill is east, the beach and the storm are north, the forest is northwest and the crater is southwest. Kaiju and tripods can show up anywhere.', 3, 0), 6000);
      setTimeout(() => this.nav.say('freePlay2', 'Look for green flags: those are survivor camps. Get out with F to collect supplies, or stand your Jaeger next to a camp to pick up survivors and carry them to a bunker.', 2, 0), 22000);
    }
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
          w.strikeT = w.quick ? 0.3 + Math.random() * 0.35 + w.t * 0.03 : 0.3 + Math.random() * 0.5 + w.t * 0.08;
          lightningStrike(this, w.x + (Math.random() - 0.5) * 50, w.z + (Math.random() - 0.5) * 50);
        }
        if (w.t <= 0) { this.warnings.splice(i, 1); this.spawnTripod(w); }
        continue;
      }
      if (w.t < 3 && Math.random() < dt * 4) this.shake(0.3, new THREE.Vector3(w.x, 0, w.z));
      if (w.t <= 0) { this.warnings.splice(i, 1); this.spawnKaiju(w); }
    }
    if (this.mode === 'smash') return;
    if (this.mode === 'freeplay') { this.updateFreePlay(dt); return; }
    if (this.mode === 'campaign') { this.updateCampaign(dt); return; }
    for (let i = this.spawnQueue.length - 1; i >= 0; i--) {
      const s = this.spawnQueue[i];
      s.delay -= dt;
      if (s.delay <= 0) { this.spawnQueue.splice(i, 1); if (s.cat === 'T') this.queueTripod(); else this.queueKaiju(s.cat); }
    }
    const living = this.kaijus.filter((k) => !k.dead && !k.friendly).length;
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

  // Free play: kaiju and tripods keep turning up around the huge map.
  updateFreePlay(dt) {
    const fp = this.fp;
    fp.t -= dt;
    const busy = this.kaijus.filter((k) => !k.dead && !k.friendly).length + this.warnings.length;
    if (fp.t <= 0) {
      if (busy < (this.lowPower ? 4 : 5)) { // it is a war now: more at once, and sooner
        fp.count++;
        fp.t = 24 + Math.random() * 18;
        if (Math.random() < 0.5) this.queueTripod(fp.count > 9 && Math.random() < 0.15 && !this.kaijus.some((k) => k.type === 'emperor' && !k.dead) ? 'emperor' : fp.count > 6 && Math.random() < 0.25 ? 'uber' : fp.count > 2 && Math.random() < 0.5 ? ['sprinter', 'shield', 'mortar', 'ghost', 'splitter', 'titan', 'sniper', 'repair', 'flame', 'thunder', 'tank', 'gatling', 'blink', 'boom', 'magnet', 'leech', 'commander', 'acid', 'shadow', 'baby', 'factory'][Math.floor(Math.random() * 21)] : 'attacker'); // an Uber Pod now and then, later on; the Emperor Pod is rare
        else this.queueKaiju(Math.min(5, 1 + Math.floor(fp.count / 3) + (Math.random() < 0.3 ? 1 : 0)));
        audio.intensity = Math.min(1, 0.4 + fp.count * 0.04);
      } else fp.t = 10;
    }
    this.checkCrater(dt);
  }

  // Campaign: run the current mission and watch for a win or a loss.
  updateCampaign(dt) {
    const ms = this.ms, M = this.mission;
    if (M.storm && ms.started) this.updateRiftStorm(dt);
    ms.t += dt;
    if (!ms.started) {
      if (ms.t < 5) return;
      ms.started = true;
      this.hud.alert(`MISSION ${this.missionIdx + 1}: ${M.title.toUpperCase()}`, 4);
      if (ms.gaveLaser) this.nav.say('gaveLaser', 'I bolted a Laser Blaster onto your right arm for this mission. You are going to need it!', 3, 0);
      M.start(this, ms.s);
      return;
    }
    if (M.tick) M.tick(this, ms.s, dt);
    if (ms.t < 10 || this.over) return;
    const why = M.failed(this, ms.s);
    if (why) { this.nav.say('mFail', why, 3, 0); this.defeat('MISSION FAILED', why); return; }
    if (M.done(this, ms.s)) {
      unlockMission(this.missionIdx + 1);
      this.victory();
    }
  }

  // The crater: get too close to the wrecked tripod head and monsters come out.
  checkCrater(dt) {
    const fp = this.fp;
    fp.craterCd -= dt;
    const c = this.city.places.crater;
    const ref = this.pilot && !this.pilot.dead ? this.pilot.pos : this.mech.pos;
    if (fp.craterCd <= 0 && Math.hypot(ref.x - c.x, ref.z - c.z) < 330) {
      fp.craterCd = 150;
      this.hud.alert('SOMETHING IS MOVING IN THE CRATER', 4, true);
      this.nav.say('crater', 'You got too close to the wrecked tripod! Something is crawling out of the crater. Two of them!', 3, 0);
      for (const s of [-1, 1]) this.warnings.push({ t: 2.5 + (s > 0 ? 1.5 : 0), cat: 1, type: 'stalker', x: c.x + s * 70, z: c.z + 40, from: 'ground', sector: c.name, zone: new THREE.Vector3(c.x, 0, c.z), radius: 120 });
      audio.play('alarm');
    }
  }

  // A win patches up a little armor. Real repairs come from scrap and energy found at survivor camps (R).
  fieldRepair() {
    if (!this.camps || !this.mech || this.mech.dead) return;
    this.mech.hp = Math.min(this.mech.maxHp, this.mech.hp + this.mech.maxHp * 0.1);
  }

  updateReveal(dt) {
    const ref = this.pilot ? this.pilot.pos : this.mech.pos;
    for (const k of this.kaijus) {
      if (k.dead || k.emerging || k.revealed || k.isTripod || k.friendly) continue; // the scan is for kaiju; tripods and ships have no weak-spot list
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
      if (k.dead || k.emerging || k.friendly) continue;
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
      if (k.dead || k.emerging || k.friendly) continue;
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
    if (this.city.hasTerrain) {
      const tg = this.city.rayGround(origin, dir, best);
      if (tg !== null && tg < best) { best = tg; info = null; }
    } else if (dir.y < 0) {
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
    p.y = Math.max(p.y, this.city.groundAt(p.x, p.z) + 4);
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
    if (k.friendly) { this.hud.alert(`${k.name.toUpperCase()} IS DOWN`, 3); this.nav.say('friendDown', `${k.name} cannot fight any more. It fought bravely for its home.`, 2, 0); return; }
    this.stats.kills++;
    this.fieldRepair();
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
    if (b.bunker) {
      if (b.hp <= 0) { if (this.camps) this.camps.bunkerLost(b); return; }
      this.nav.say('bunkerHit', `${b.name} is under attack! Survivors are hiding in there. Get that kaiju away from it!`, 3, 15);
      this.hud.alert(`${b.name.toUpperCase()} UNDER ATTACK`, 2, true);
      return;
    }
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
    this.nav.say('victory', this.mission ? this.mission.win : `Mission complete! ${this.cfg.name} saved the city! You are a real Jaeger pilot!`, 3, 0);
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
      saved: this.camps ? this.camps.saved : null,
      campaign: this.mission ? { n: this.missionIdx + 1, title: this.mission.title, last: this.missionIdx >= MISSIONS.length - 1, ending: this.mission.ending } : null,
      weak: this.stats.weakHits,
      buildings: this.city.destroyed,
      damage: Math.round(this.stats.damage),
      wave: this.waveIdx + 1,
      time: `${Math.floor(secs / 60)}:${String(Math.floor(secs % 60)).padStart(2, '0')}`,
      plant: Math.round(this.city.plantIntegrity() * 100),
    };
  }

  stop() {
    this.spawnMenu.close();
    this.hud.show(false);
    this.hud.clearTransient();
    audio.stopMusic();
    audio.stopLoops();
    this.state = 'idle';
  }
}

export { KAIJU_CATS, WORLD };
