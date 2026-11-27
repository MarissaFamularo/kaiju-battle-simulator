import * as THREE from 'three';
import { buildKaiju } from '../entities/kaijuModel.js';
import { Tripod, lightningStrike } from '../entities/tripod.js';
import { audio } from '../audio.js';

// Chapter 2's opening (docs/chapter-2-design.md), played by DropScene in place of the
// classic drop. Patrick's storyboard:
//   1. You are looking at the Earth.
//   2. A ship hits a space station.
//   3. The Jaeger ejects right before the hit and heads down to the planet.
//   4. It is fighting a kaiju.
//   5. Lightning strikes the ground 20 times, and then a tripod rises.
//   6. The game starts.
//
// Times (seconds) for each beat. The short version starts at DESCENT and stops after ENTRY.
export const T = { EARTH: 0, SHIP: 5, EJECT: 8.3, HIT: 10, DESCENT: 13, ENTRY: 17, FIGHT: 22, STORM: 30, RISE: 37.5, HORN: 44, END: 47.5 };
const STRIKE_AT = new THREE.Vector3(-150, 0, -190);
const $ = (id) => document.getElementById(id);

// The alien ship, and the little ground set for the fight. Built once.
export function buildInvasionProps(d) {
  // ---- the ship that hits the station ----
  const ship = new THREE.Group();
  const hullMat = new THREE.MeshStandardMaterial({ color: '#3b3f48', metalness: 0.85, roughness: 0.35 });
  const glow = new THREE.MeshStandardMaterial({ color: '#000', emissive: '#7dffb0', emissiveIntensity: 3 });
  const body = new THREE.Mesh(new THREE.SphereGeometry(70, 28, 18), hullMat); body.scale.set(1, 0.35, 2.2);
  const dome = new THREE.Mesh(new THREE.SphereGeometry(34, 20, 12), hullMat); dome.scale.set(1, 0.6, 1.6); dome.position.y = 18;
  const strip = new THREE.Mesh(new THREE.TorusGeometry(64, 2.5, 6, 40), glow); strip.rotation.x = Math.PI / 2; strip.scale.set(1, 2.2, 1); strip.position.y = -6;
  ship.add(body, dome, strip);
  for (const s of [-1, 1]) { const e = new THREE.Mesh(new THREE.CylinderGeometry(9, 13, 30, 12), glow); e.rotation.x = Math.PI / 2; e.position.set(s * 30, 0, -150); ship.add(e); }
  ship.scale.setScalar(1.7);
  ship.visible = false;
  d.scene.add(ship);
  d.ship = ship;

  // ---- ruined city set for the fight ----
  const set = new THREE.Group();
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(6000, 6000), new THREE.MeshStandardMaterial({ color: '#35333a', roughness: 1 }));
  ground.rotation.x = -Math.PI / 2;
  set.add(ground);
  const wall = new THREE.MeshStandardMaterial({ color: '#5a5d68', roughness: 0.9 });
  const lit = new THREE.MeshStandardMaterial({ color: '#4a4d58', roughness: 0.9, emissive: '#ffb860', emissiveIntensity: 0.25 });
  let seed = 7;
  const r = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  for (let i = 0; i < 70; i++) {
    const a = r() * Math.PI * 2, dist = 190 + r() * 900;
    const x = Math.cos(a) * dist, z = Math.sin(a) * dist - 80;
    if (Math.hypot(x - STRIKE_AT.x, z - STRIKE_AT.z) < 110) continue; // keep the lightning spot clear
    if (Math.hypot(x - 90, z - 110) < 230) continue; // and keep buildings away from where the camera stands
    if (x > -20 && z > -150 && z < 60) continue; // nothing between the camera and the fight
    const w = 30 + r() * 40, h = 20 + r() * 130, dp = 30 + r() * 40;
    const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, dp), r() < 0.3 ? lit : wall);
    b.position.set(x, h / 2, z);
    b.rotation.y = r() * 0.3; b.rotation.z = r() < 0.2 ? (r() - 0.5) * 0.25 : 0; // a few are leaning
    set.add(b);
  }
  const rubble = new THREE.MeshStandardMaterial({ color: '#5b5750', roughness: 1, flatShading: true });
  for (let i = 0; i < 40; i++) {
    const p = new THREE.Mesh(new THREE.DodecahedronGeometry(6 + r() * 14, 0), rubble);
    p.position.set((r() - 0.5) * 700, 1, (r() - 0.5) * 700 - 60); p.scale.y = 0.45;
    set.add(p);
  }
  const sky = new THREE.Mesh(new THREE.SphereGeometry(7000, 24, 12), new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    vertexShader: 'varying vec3 vD; void main(){ vD = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: `varying vec3 vD; void main(){
      vec3 c = mix(vec3(0.94,0.53,0.35), vec3(0.29,0.24,0.43), smoothstep(-0.02, 0.25, vD.y));
      c = mix(c, vec3(0.08,0.11,0.27), smoothstep(0.25, 0.8, vD.y));
      gl_FragColor = vec4(c, 1.0);
      #include <colorspace_fragment>
    }`,
  }));
  set.add(sky);
  set.add(new THREE.HemisphereLight('#9fb2ff', '#4a3434', 1.0));
  set.visible = false;
  d.scene.add(set);
  d.groundSet = set;

  // just enough of a "game" for a Tripod and for lightning to work in a cutscene
  d.stage = {
    scene: d.scene, fx: d.fx, time: 0, state: 'cine', mech: null, pilot: null, kaijus: [], aliens: null, camps: null,
    physics: { kinematicBall: () => ({ setNextKinematicTranslation() {} }), remove() {} },
    city: { groundAt: () => 0, damageArea() {}, damage() {}, impulseDebris() {}, raycast: () => null, overlapping: () => [], crushCars() {}, spawnChunk() {}, terrainBlocks: () => false, waterEdge: -1e9, bound: 1e9 },
    shake: (a) => { d.shakeAmt = Math.min(3, (d.shakeAmt || 0) + a); },
    hud: { alert() {} }, nav: { say() {} }, onTripodKilled() {}, defeat() {},
  };
}

// Put everything back to the start of the intro.
export function resetInvasion(d, full) {
  d.iv = { step: -1, strikes: 0, strikeT: 0, boomT: 0, swing: 0, full };
  d.shakeAmt = 0;
  d.ship.visible = false;
  d.groundSet.visible = false;
  d.scene.fog = null;
  for (const o of [d.planet, d.atmo, d.stars, d.station]) o.visible = true;
  d.station.rotation.set(0, 0, 0); d.station.position.set(0, 120, 0);
  d.ring.position.set(0, 0, 0); d.ring.rotation.x = 0; d.ring.rotation.z = 0;
  if (d.tripod) { d.tripod.remove(); d.tripod = null; }
  if (d.kaiju) { d.scene.remove(d.kaiju.root); d.kaiju = null; }
  d.carrier.g.visible = true;
  d.t = full ? 0 : T.DESCENT;
}

export function cleanupInvasion(d) {
  d.groundSet.visible = false;
  d.ship.visible = false;
  d.scene.fog = null;
  if (d.tripod) { d.tripod.remove(); d.tripod = null; }
  if (d.kaiju) { d.scene.remove(d.kaiju.root); d.kaiju = null; }
  if (d.mech && d.mech.root.parent === d.scene) d.scene.remove(d.mech.root);
  for (const o of [d.planet, d.atmo, d.stars, d.station]) o.visible = true;
  // put the station back together for next time
  d.station.rotation.set(0, 0, 0);
  d.ring.position.set(0, 0, 0); d.ring.rotation.x = 0; d.ring.rotation.z = 0;
}

function beat(d, n, title, sub, key, line) {
  if (d.iv.step >= n) return false;
  d.iv.step = n;
  d.iv.beatT = d.t;
  d.title(title, sub);
  if (line) d.app.nav.say(key, line, 3, 0);
  return true;
}

export function updateInvasion(d, dt, time) {
  const t = d.t, iv = d.iv, cam = d.camera, c = d.carrier, fx = d.fx;
  const name = d.cfg.name;
  const stationPos = d.station.position;

  if (t < T.SHIP) {
    // 1. looking at the Earth
    if (beat(d, 0, 'EARTH', 'ORBITAL STATION AEGIS · ALL QUIET', 'iv1', `Station Aegis to ${name}. Everything is quiet tonight, pilot. Just look at that view.`)) audio.play('uiBig');
    c.g.position.set(0, -10, 0); c.g.rotation.set(0, 0, 0);
    const k = t / T.SHIP;
    cam.position.set(-1500 + k * 500, 900 - k * 260, 2300 - k * 700);
    cam.lookAt(0, -700 + k * 300, 0);
  } else if (t < T.HIT) {
    // 2. a ship comes in fast
    if (beat(d, 1, 'UNKNOWN SHIP', 'COLLISION COURSE', 'iv2', 'Wait. Something is coming in fast. It is going to hit the station! Launch the Jaeger. NOW!')) { audio.play('alarm'); d.ship.visible = true; }
    const k = (t - T.SHIP) / (T.HIT - T.SHIP);
    const e = k * k;
    d.ship.position.set(2900 * (1 - e), 120 + 900 * (1 - e), -2700 * (1 - e));
    d.ship.lookAt(stationPos);
    if (Math.random() < 0.7) fx.add.spawn(d.ship.position.clone().add(fx.rv(40)), fx.rv(20), 0.8, 40, 6, GREEN, GREEN, 0.8, 0, 0);
    // 3. the Jaeger ejects just before the hit
    if (t > T.EJECT) {
      if (iv.step < 2) { iv.step = 2; audio.play('eject', null, 1); audio.play('punch', null, 1); }
      const q = t - T.EJECT;
      c.g.position.set(0, -10 - q * q * 34, q * 70);
      c.g.rotation.x = Math.min(0.3, q * 0.2);
    } else { c.g.position.set(0, -10, 0); c.g.rotation.set(0, 0, 0); }
    cam.position.set(-430 + k * 60, 170 - k * 40, 440);
    const look = new THREE.Vector3().lerpVectors(stationPos, d.ship.position, 0.25 * (1 - k));
    cam.lookAt(look);
  } else if (t < T.DESCENT) {
    // the hit
    if (beat(d, 3, 'STATION AEGIS IS HIT', '', 'iv3', `${name} is away! Go, go, go!`)) { audio.play('explosion', null, 1.4); fx.flash(stationPos, '#fff0c0', 20000, 0.6); d.shakeAmt = 3; }
    const q = t - T.HIT;
    d.ship.position.set(-q * 150, 120 - q * 40, q * 150); // it ploughs on through
    d.ship.rotation.z += dt * 0.6;
    d.station.rotation.z = q * 0.12; d.station.rotation.x = q * 0.07;
    d.ring.position.set(q * 60, q * 25, -q * 30); d.ring.rotation.x = q * 0.5; // the ring tears off
    iv.boomT -= dt;
    if (iv.boomT <= 0) {
      iv.boomT = 0.12 + Math.random() * 0.15;
      const p = stationPos.clone().add(new THREE.Vector3((Math.random() - 0.5) * 420, (Math.random() - 0.5) * 160, (Math.random() - 0.5) * 220));
      fx.explosion(p, 2.5 + Math.random() * 2.5);
      if (Math.random() < 0.5) audio.play('explosion', null, 0.7);
    }
    const e = t - T.EJECT;
    c.g.position.set(0, -10 - e * e * 34, e * 70);
    c.g.rotation.x = 0.3;
    // watch from below the drone as the station burns above it
    cam.position.copy(c.g.position).add(new THREE.Vector3(70, -70, 150));
    cam.lookAt(c.g.position.clone().lerp(stationPos, 0.35));
  } else if (t < T.ENTRY) {
    // heading down to the planet
    if (iv.full) beat(d, 4, 'DESCENT', 'THE JAEGER GOT OUT JUST IN TIME', 'iv4', 'We made it out! That ship broke into pieces, and the pieces are falling to Earth with us. Heading for the surface.');
    else if (beat(d, 4, 'DESCENT', 'TARGET: THE RUINED CITY', 'iv4s', `Dropping ${name} into the ruined city. Stay sharp, pilot. They are down there.`)) audio.play('uiBig');
    const k = t - T.DESCENT;
    const base = c.g.userData.descentFrom || (c.g.userData.descentFrom = iv.full ? c.g.position.clone() : new THREE.Vector3(0, -700, 330));
    c.g.position.set(base.x, base.y - k * 60 - k * k * 6, base.z + k * 35);
    c.g.rotation.x = 0.3;
    d.station.rotation.z += dt * 0.05;
    // burning wreckage falls alongside
    if (iv.full && Math.random() < 0.5) {
      const p = c.g.position.clone().add(new THREE.Vector3((Math.random() - 0.5) * 500, 120 + Math.random() * 200, (Math.random() - 0.5) * 400));
      fx.add.spawn(p, new THREE.Vector3(0, -260, 40), 1.2, 16, 3, FIRE_A, FIRE_B, 1, 0, 0);
    }
    cam.position.copy(c.g.position).add(new THREE.Vector3(55, 45, -110));
    cam.lookAt(c.g.position.clone().add(new THREE.Vector3(0, -50, 80)));
    audio.setLoop('wind', Math.min(0.15, k * 0.04));
  } else if (t < T.FIGHT) {
    // atmospheric entry (same look as the classic drop)
    if (beat(d, 5, 'ATMOSPHERIC ENTRY', 'HULL TEMPERATURE RISING', 'iv5', 'Entering the atmosphere! Hang on!')) {
      audio.play('rumble', null, 1);
      c.g.userData.descentFrom = null;
      d.entrySky.visible = true; d.plasma.visible = true;
      for (const o of [d.planet, d.atmo, d.stars, d.station, d.ship]) o.visible = false;
    }
    const k = (t - T.ENTRY) / (T.FIGHT - T.ENTRY);
    const heat = Math.sin(Math.min(1, k * 1.3) * Math.PI * 0.5) * (k > 0.85 ? (1 - k) / 0.15 : 1);
    c.g.position.set(0, 0, 0);
    c.g.rotation.set(0.15 + Math.sin(time * 13) * 0.02 * heat, 0, Math.sin(time * 9) * 0.03 * heat);
    d.entrySky.material.uniforms.uK.value = Math.min(1, k * 3);
    d.plasma.position.set(0, -55, 0);
    d.plasma.material.uniforms.uT.value = time;
    d.plasma.material.uniforms.uK.value = heat;
    const sh = heat * 3;
    cam.position.set(Math.sin(t * 0.4) * 30 + 150 + (Math.random() - 0.5) * sh, 10 + (Math.random() - 0.5) * sh, 160);
    cam.lookAt(0, -45, 0);
    d.entrySky.position.copy(cam.position);
    for (let i = 0; i < 30 * heat + 1; i++) {
      const a = Math.random() * Math.PI * 2, r = 30 + Math.random() * 40;
      fx.add.spawn(new THREE.Vector3(Math.cos(a) * r, -120 + Math.random() * 30, Math.sin(a) * r), new THREE.Vector3(Math.cos(a) * 30, 300 + Math.random() * 200, Math.sin(a) * 30), 0.6, 6 + Math.random() * 10, 1, FIRE_A, FIRE_B, 0.9 * heat, 0, 0);
    }
    audio.setLoop('fire', heat * 0.35);
    audio.setLoop('wind', 0.2 + heat * 0.2);
    if (!iv.full && k > 0.97) { d.entrySky.visible = false; d.plasma.visible = false; d.finish(); }
  } else {
    groundScene(d, dt, time);
  }
  // camera shake
  if (d.shakeAmt > 0.01) {
    cam.position.x += (Math.random() - 0.5) * d.shakeAmt * 3; cam.position.y += (Math.random() - 0.5) * d.shakeAmt * 3;
    d.shakeAmt *= Math.max(0, 1 - dt * 3);
  }
  $('cine-title').style.opacity = d.t - (iv.beatT || 0) < 3.6 ? 1 : 0;
}

const GREEN = new THREE.Color('#7dffb0');
const FIRE_A = new THREE.Color('#fff0b0'), FIRE_B = new THREE.Color('#ff3a08');
const MECH_AT = new THREE.Vector3(0, 0, 20), KAIJU_AT = new THREE.Vector3(0, 0, -62);
const _camRise = new THREE.Vector3(-35, 20, 170);

// 4 and 5: the fight on the ground, twenty lightning strikes, and the tripod
function groundScene(d, dt, time) {
  const t = d.t, iv = d.iv, cam = d.camera, fx = d.fx;
  const m = d.mech;
  if (beat(d, 6, 'THE RUINED CITY', 'A KAIJU WAS WAITING', 'iv6', 'Touchdown! And we are not alone. Kaiju, dead ahead!')) {
    // swap space for the ground
    d.entrySky.visible = false; d.plasma.visible = false;
    audio.setLoop('fire', 0); audio.setLoop('wind', 0.05);
    d.carrier.g.remove(m.root);
    d.carrier.g.visible = false;
    d.scene.add(m.root);
    m.root.position.copy(MECH_AT);
    m.root.rotation.set(0, Math.PI, 0); // facing -Z, toward the kaiju
    m.j.shoulderL.rotation.set(0, 0, 0); m.j.shoulderR.rotation.set(0, 0, 0);
    m.j.legL.rotation.x = 0; m.j.legR.rotation.x = 0;
    for (const k of ['L', 'R']) { const b = m.blades[k]; if (b) { b.visible = true; b.scale.y = 1; } }
    d.kaiju = buildKaiju('brute');
    d.kaiju.root.position.copy(KAIJU_AT);
    d.scene.add(d.kaiju.root);
    d.groundSet.visible = true;
    d.scene.fog = new THREE.Fog('#7d5f7a', 400, 2600);
    fx.clear();
    audio.play('stomp', null, 1.4); audio.play('roar', null, 1);
    d.shakeAmt = 2;
  }
  d.stage.time = time;
  const K = d.kaiju;
  const storm = t >= T.STORM;
  // the fight: trade blows until the lightning starts, then both stop and look
  if (!storm) {
    iv.swing += dt;
    const ph = (iv.swing % 1.7) / 1.7;
    // Jaeger's left arm winds up and swings
    m.j.shoulderL.rotation.x = ph < 0.4 ? -2.6 * (ph / 0.4) : ph < 0.55 ? -2.6 + 2.2 * ((ph - 0.4) / 0.15) : -0.4 * (1 - (ph - 0.55) / 0.45);
    m.j.elbowL.rotation.x = -0.5;
    m.j.torso.rotation.y = Math.sin(ph * Math.PI * 2) * 0.35;
    m.root.position.z = MECH_AT.z - Math.sin(ph * Math.PI) * 9;
    // kaiju rears back, then lunges
    K.root.position.z = KAIJU_AT.z + Math.sin((ph + 0.5) * Math.PI * 2) * 7;
    K.root.rotation.x = Math.sin((ph + 0.5) * Math.PI * 2) * 0.12;
    if (K.j.jaw) K.j.jaw.rotation.x = 0.3 + Math.sin(time * 5) * 0.25;
    for (const arm of K.j.arms || []) arm.sh.rotation.x = arm.baseSh + Math.sin(ph * Math.PI * 2 + (arm.side > 0 ? 0 : 2)) * 0.9;
    if (ph > 0.5 && !iv.hit) {
      iv.hit = true;
      const p = new THREE.Vector3(4, 38, -30);
      fx.sparks(p, 40, 'blue'); fx.blood(p, null, true);
      audio.play('hit', null, 1); if (Math.random() < 0.5) audio.play('roar', null, 0.6);
      d.shakeAmt = 0.8;
    }
    if (ph < 0.2) iv.hit = false;
    const a = (t - T.FIGHT) * 0.12;
    cam.position.set(125 * Math.cos(a) + 10, 34 + (t - T.FIGHT) * 1.5, 70 * Math.sin(a) + 40);
    cam.lookAt(0, 32, -22);
  } else {
    if (beat(d, 7, 'LIGHTNING', 'IT KEEPS HITTING THE SAME SPOT', 'iv7', 'Lightning! Again. And again. It keeps hitting the same spot. What IS that?')) audio.play('alarm');
    // twenty strikes
    iv.strikeT -= dt;
    if (iv.strikes < 20 && iv.strikeT <= 0 && t < T.RISE) {
      iv.strikes++;
      iv.strikeT = (T.RISE - T.STORM - 0.6) / 20;
      lightningStrike(d.stage, STRIKE_AT.x + (Math.random() - 0.5) * 50, STRIKE_AT.z + (Math.random() - 0.5) * 50, iv.strikes === 20);
      $('cine-title').innerHTML = `LIGHTNING<small>STRIKE ${iv.strikes} OF 20</small>`;
      iv.beatT = t;
    }
    // both fighters stop and turn toward it
    const turn = Math.min(1, (t - T.STORM) / 1.5);
    m.root.rotation.y = Math.PI + turn * 0.75;
    m.j.shoulderL.rotation.x += (0.1 - m.j.shoulderL.rotation.x) * Math.min(1, dt * 4);
    m.j.torso.rotation.y *= 1 - Math.min(1, dt * 4);
    K.root.rotation.y = turn * 1.1; K.root.rotation.x *= 1 - Math.min(1, dt * 4);
    if (t >= T.RISE) {
      if (beat(d, 8, 'THEY WERE UNDER THE GROUND', '', 'iv8', 'Something is coming up. Legs! Three legs! Pilot, that is not a kaiju.')) {
        d.tripod = new Tripod(d.stage, { type: 'attacker', x: STRIKE_AT.x, z: STRIKE_AT.z });
        d.tripod.yaw = Math.atan2(MECH_AT.x - STRIKE_AT.x, MECH_AT.z - STRIKE_AT.z);
      }
      const tp = d.tripod;
      if (tp.state === 'search') tp.setState('idle'); // it just stands there, scanning
      tp.update(dt);
      if (tp.state === 'idle') tp.headYaw = Math.sin(time * 1.2) * 0.5;
      if (t >= T.HORN) {
        if (beat(d, 9, 'KAIJU BATTLE SIMULATOR', 'CHAPTER 2 · THE TRIPOD INVASION', 'iv9', 'It sees us. Here it comes, pilot!')) { audio.play('horn', null, 1.6); d.shakeAmt = 1; }
        tp.alert = Math.min(1, tp.alert + dt * 3);
        tp.headYaw *= 1 - Math.min(1, dt * 5);
      }
    }
    // look past the fighters at the lightning spot, then up at the tripod
    const k = Math.min(1, (t - T.STORM) / 2.5);
    const e = k * k * (3 - 2 * k);
    cam.position.set(135 - e * 60, 40 + e * 5, 95 + e * 60);
    const rise = Math.max(0, Math.min(1, (t - T.RISE) / 5));
    // when the tripod comes up, slide over so the fighters are at the edge and it fills the middle
    const sl = Math.min(1, Math.max(0, (t - T.RISE + 1.5) / 3)), se = sl * sl * (3 - 2 * sl);
    cam.position.lerp(_camRise, se);
    cam.lookAt(new THREE.Vector3(0, 32, -22).lerp(new THREE.Vector3(STRIKE_AT.x, 20 + rise * 32, STRIKE_AT.z), e));
  }
  if (t >= T.END) d.finish();
}
