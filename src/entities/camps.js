import * as THREE from 'three';
import { audio } from '../audio.js';

// Survivor camps, bunkers and rescues on the huge map (docs/chapter-2-design.md).
//
// Camps: get out of the Jaeger (F) and walk the pilot into the glowing crates to
//   collect resources. What you get is random and different on every visit.
//   A tripod that steps on a camp flattens it and the resources are gone.
// Survivors: stand the Jaeger next to a camp and they climb aboard; carry them
//   to a bunker. Or press 4 near a camp to call a rescue truck from a bunker.
// Bunkers: underground and safe from tripod feet, but kaiju will attack the
//   hatch, so protect them. (They are registered with the city as "plant parts",
//   which is what makes kaiju go after them.)

const CAMP_SPOTS = [
  ['Lighthouse Camp', 950, -1700], ['Hillside Camp', 1020, 760], ['Forest Camp', -1380, -640],
  ['Riverside Camp', -1010, 620], ['South Camp', 230, 1420], ['Crater Camp', -1180, 1830], ['Ridge Camp', 2150, -640],
];
const BUNKER_SPOTS = [['Hill Bunker', 1500, 1150], ['West Bunker', -2050, 150], ['South Bunker', -950, 2250]];
const SEATS = 6;            // survivors the Jaeger can carry
const RESTOCK = 110;        // seconds until a camp has new crates
const SUIT = ['#e86a1a', '#2c8fd6', '#d94f8a', '#e0c21b', '#4fbf6a', '#b8b8c8'];

let A = null;
function assets() {
  if (A) return A;
  A = {
    tent: new THREE.ConeGeometry(7, 7, 4).rotateY(Math.PI / 4).translate(0, 3.5, 0),
    crate: new THREE.BoxGeometry(2.6, 2.2, 2.6).translate(0, 1.1, 0),
    body: new THREE.CapsuleGeometry(0.42, 0.85, 4, 8).translate(0, 1.2, 0),
    head: new THREE.SphereGeometry(0.34, 10, 8).translate(0, 2.1, 0),
    arm: new THREE.CapsuleGeometry(0.13, 0.7, 3, 6).translate(0, -0.4, 0),
    canvas: ['#7a6a48', '#5d6b52', '#8a5a44'].map((c) => new THREE.MeshStandardMaterial({ color: c, roughness: 1, flatShading: true })),
    wood: new THREE.MeshStandardMaterial({ color: '#6b5236', roughness: 1 }),
    crateMat: new THREE.MeshStandardMaterial({ color: '#3a4a30', roughness: 0.8, emissive: '#7dff5a', emissiveIntensity: 0.9 }),
    fire: new THREE.MeshBasicMaterial({ color: '#ffb040' }),
    skin: new THREE.MeshStandardMaterial({ color: '#e8c4a0', roughness: 0.8 }),
    suits: SUIT.map((c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.7 })),
    concrete: new THREE.MeshStandardMaterial({ color: '#b9b6ae', roughness: 0.85 }),
    steel: new THREE.MeshStandardMaterial({ color: '#59606b', metalness: 0.7, roughness: 0.4 }),
    lampOn: new THREE.MeshBasicMaterial({ color: '#7dffb0' }),
    truck: new THREE.MeshStandardMaterial({ color: '#5a6b3c', roughness: 0.7, metalness: 0.2 }),
    tire: new THREE.MeshStandardMaterial({ color: '#15161a', roughness: 0.9 }),
  };
  return A;
}

function makePerson(i) {
  const a = assets();
  const g = new THREE.Group();
  const body = new THREE.Mesh(a.body, a.suits[i % a.suits.length]); body.castShadow = true;
  const arm = new THREE.Mesh(a.arm, a.suits[i % a.suits.length]); arm.position.set(0.5, 1.75, 0);
  g.add(body, new THREE.Mesh(a.head, a.skin), arm);
  g.scale.setScalar(1.5);
  return { g, arm };
}

export class Camps {
  constructor(game) {
    this.game = game;
    this.root = new THREE.Group();
    game.scene.add(this.root);
    this.camps = [];
    this.bunkers = [];
    this.runners = [];   // little people running somewhere
    this.trucks = [];
    this.aboard = 0;     // survivors riding in the Jaeger
    this.saved = 0;
    this.inv = { scrap: 1, energy: 1, food: 0 };
    this.truckCd = 0;
    this.tipT = 0;
    const city = game.city;
    for (const [name, x, z] of CAMP_SPOTS) this.makeCamp(name, ...this.dryLand(x, z));
    for (const [name, x, z] of BUNKER_SPOTS) this.makeBunker(name, ...this.dryLand(x, z));
    void city;
  }

  // nudge a spot until it is on dry, fairly flat land
  dryLand(x, z) {
    const c = this.game.city;
    for (let i = 0; i < 80; i++) {
      // spiral outward from the spot we wanted
      const px = x + Math.cos(i * 2.4) * i * 9, pz = z + Math.sin(i * 2.4) * i * 9;
      const h = c.groundAt(px, pz);
      const slope = Math.abs(c.groundAt(px + 15, pz) - h) + Math.abs(c.groundAt(px, pz + 15) - h);
      if (h > 4 && slope < 7) return [px, pz];
    }
    return [x, z];
  }

  ground(x, z) { return this.game.city.groundAt(x, z); }

  // ---------------- building things ----------------
  makeCamp(name, x, z) {
    const a = assets();
    const g = new THREE.Group();
    const y = this.ground(x, z);
    g.position.set(x, y, z);
    const tents = [];
    for (let i = 0; i < 3; i++) {
      const an = i * 2.1 + 0.4;
      const t = new THREE.Mesh(a.tent, a.canvas[i % 3]);
      const tx = Math.cos(an) * 13, tz = Math.sin(an) * 13;
      t.position.set(tx, this.ground(x + tx, z + tz) - y, tz);
      t.rotation.y = an; t.castShadow = true;
      g.add(t); tents.push(t);
    }
    // campfire
    for (let i = 0; i < 3; i++) { const log = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 3, 5), a.wood); log.rotation.set(Math.PI / 2, 0, i * 1.05); log.position.y = 0.3; g.add(log); }
    const flame = new THREE.Mesh(new THREE.ConeGeometry(0.9, 2.4, 6), a.fire); flame.position.y = 1.5; g.add(flame);
    // flag so you can spot the camp from far away
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.25, 22, 5), a.wood); pole.position.set(-9, 11, -9); g.add(pole);
    const flag = new THREE.Mesh(new THREE.PlaneGeometry(6, 3.5), new THREE.MeshBasicMaterial({ color: '#7dff5a', side: THREE.DoubleSide })); flag.position.set(-5.8, 20, -9); g.add(flag);
    // resource crates (glow green while there is something to collect)
    const crates = new THREE.Group(); crates.position.set(8, 0, 9);
    for (const [cx, cy, cz] of [[0, 0, 0], [3, 0, 0.4], [1.4, 2.2, 0.2]]) { const c = new THREE.Mesh(a.crate, a.crateMat); c.position.set(cx, cy, cz); c.rotation.y = cx * 0.3; c.castShadow = true; crates.add(c); }
    crates.position.y = this.ground(x + 8, z + 9) - y;
    g.add(crates);
    this.root.add(g);
    const camp = { name, x, z, y, g, tents, crates, flame, flag, stocked: true, restock: 0, crushed: false, people: [], visits: 0 };
    const n = 2 + Math.floor(Math.random() * 4);
    for (let i = 0; i < n; i++) {
      const p = makePerson(this.camps.length + i);
      const an = Math.random() * 6.28, d = 3.5 + Math.random() * 4;
      p.home = new THREE.Vector3(x + Math.cos(an) * d, 0, z + Math.sin(an) * d);
      p.home.y = this.ground(p.home.x, p.home.z);
      p.g.position.copy(p.home);
      p.g.rotation.y = an + Math.PI;
      p.seed = Math.random() * 9;
      this.root.add(p.g);
      camp.people.push(p);
    }
    this.camps.push(camp);
  }

  makeBunker(name, x, z) {
    const a = assets();
    const city = this.game.city;
    const y = this.ground(x, z);
    const g = new THREE.Group();
    const mound = new THREE.Mesh(new THREE.SphereGeometry(16, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2), a.concrete);
    mound.scale.y = 0.55; mound.position.set(x, y - 1, z);
    const door = new THREE.Mesh(new THREE.BoxGeometry(9, 8, 3), a.steel); door.position.set(x, y + 3.5, z + 14);
    const lamp = new THREE.Mesh(new THREE.SphereGeometry(1, 8, 6), a.lampOn); lamp.position.set(x, y + 9, z + 14.5);
    const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.5, 26, 5), a.steel); mast.position.set(x - 6, y + 20, z - 4);
    const light = new THREE.Mesh(new THREE.SphereGeometry(1.3, 8, 6), a.lampOn); light.position.set(x - 6, y + 33.5, z - 4);
    g.add(mound, door, lamp, mast, light);
    g.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
    city.root.add(g);
    // a "building" the city knows about, so kaiju can attack it and it can be smashed
    const pieces = [{ x, y: y + 4, z, hx: 14, hy: 5, hz: 14 }];
    const b = {
      id: city.buildings.length, x, z, hw: 14, hd: 14, h: y + 9, pieces, group: g, alive: true, hp: 2400, maxHp: 2400,
      mat: -1, plant: true, bunker: true, name, bodies: [], burning: false,
    };
    city.registerBuilding(b);
    city.plantParts.push(b);
    this.bunkers.push({ name, x, z, y, b, inside: 4 + Math.floor(Math.random() * 6), door: new THREE.Vector3(x, y, z + 17) });
  }

  // ---------------- queries ----------------
  nearestBunker(x, z) {
    let best = null, bd = Infinity;
    for (const k of this.bunkers) {
      if (!k.b.alive) continue;
      const d = Math.hypot(k.x - x, k.z - z);
      if (d < bd) { bd = d; best = k; }
    }
    return best;
  }

  nearestCamp(x, z, withPeople = false) {
    let best = null, bd = Infinity;
    for (const c of this.camps) {
      if (c.crushed || (withPeople && !c.people.length)) continue;
      const d = Math.hypot(c.x - x, c.z - z);
      if (d < bd) { bd = d; best = c; }
    }
    return best ? { camp: best, dist: bd } : null;
  }

  // a camp for a patrolling tripod to wander into
  randomCampNear(x, z, max) {
    const list = this.camps.filter((c) => !c.crushed && Math.hypot(c.x - x, c.z - z) < max);
    return list.length ? list[Math.floor(Math.random() * list.length)] : null;
  }

  // ---------------- things that happen ----------------
  // A tripod foot came down here.
  stomp(p) {
    for (const c of this.camps) {
      if (c.crushed || Math.hypot(c.x - p.x, c.z - p.z) > 17) continue;
      c.crushed = true; c.stocked = false;
      for (const t of c.tents) { t.scale.set(1.3, 0.08, 1.3); t.rotation.z = 0.2; }
      c.crates.visible = false; c.flame.visible = false; c.flag.visible = false;
      this.game.fx.groundDust(new THREE.Vector3(c.x, c.y, c.z), 40, 24);
      audio.play('collapse', p, 0.7);
      // nobody gets hurt: everyone runs for the nearest bunker (but they are not "saved" by you)
      const k = this.nearestBunker(c.x, c.z);
      for (const person of c.people) this.runners.push({ ...person, to: k ? k.door.clone() : new THREE.Vector3(c.x + 200, 0, c.z), speed: 24, then: 'gone' });
      c.people = [];
      this.game.hud.alert(`${c.name.toUpperCase()} WAS STEPPED ON`, 3.5, true);
      this.game.nav.say('campStomp', `Oh no, the tripod stepped on ${c.name}! The people ran away in time, but all the resources there are gone.`, 3, 8);
    }
  }

  // The pilot walked into the crates.
  collect(c) {
    const g = this.game;
    c.stocked = false; c.restock = RESTOCK; c.visits++;
    c.crates.visible = false;
    const got = { scrap: 1 + Math.floor(Math.random() * 3), energy: 1 + Math.floor(Math.random() * 2), food: 0 };
    const lines = [`${got.scrap} scrap metal`, `${got.energy} energy`];
    let extra = '';
    const r = Math.random();
    if (r < 0.3) { got.food = 1 + Math.floor(Math.random() * 2); lines.push(`${got.food} food`); if (g.pilot) g.pilot.hp = g.pilot.maxHp; }
    else if (r < 0.55) { for (const k in g.cooldowns) g.cooldowns[k] = 0; lines.push('a crate of missiles'); extra = ' The missiles restocked your helicopters, gunship, jets and missile bay!'; }
    else if (r < 0.75 && g.mech) {
      const m = g.mech;
      const pick = Math.floor(Math.random() * 3);
      if (pick === 0) { m.maxHp = Math.round(m.maxHp * 1.1); m.hp += m.maxHp * 0.1; lines.push('a NEW PART: Armor Plating'); extra = ' Armor Plating gives your Jaeger 10 percent more armor!'; }
      else if (pick === 1) { m.frame = { ...m.frame, speed: m.frame.speed * 1.1 }; lines.push('a NEW PART: Leg Motors'); extra = ' Leg Motors make your Jaeger 10 percent faster!'; }
      else { m.frame = { ...m.frame, power: m.frame.power * 1.12 }; lines.push('a NEW PART: Power Cell'); extra = ' The Power Cell makes every weapon hit harder!'; }
    }
    for (const k in got) this.inv[k] += got[k];
    audio.play('uiBig');
    g.fx.sparks(new THREE.Vector3(c.x + 8, c.y + 3, c.z + 9), 24, 'blue');
    g.hud.alert(`FOUND: ${lines.join(', ').toUpperCase()}`, 4);
    g.nav.say('loot', `You found ${lines.join(', ')} at ${c.name}.${extra} Press R in your Jaeger to repair armor with scrap and energy.`, 2, 0);
  }

  // R: one scrap + one energy repairs 30% armor
  repair() {
    const g = this.game, m = g.mech;
    if (!m || m.dead || !m.piloted) return;
    if (m.hp >= m.maxHp - 1) { g.hud.alert('ARMOR IS ALREADY FULL', 1.5); return; }
    if (this.inv.scrap < 1 || this.inv.energy < 1) {
      g.hud.alert('NEED 1 SCRAP + 1 ENERGY TO REPAIR', 2.5);
      g.nav.say('noScrap', 'No repair supplies! Find a survivor camp, get out with F, and walk into the glowing green crates.', 2, 10);
      return;
    }
    this.inv.scrap--; this.inv.energy--;
    m.hp = Math.min(m.maxHp, m.hp + m.maxHp * 0.3);
    audio.play('uiBig');
    g.fx.sparks(m.chestPos(), 30, 'blue');
    g.hud.alert('ARMOR REPAIRED +30%', 2);
  }

  // 4: a rescue truck drives out from the nearest bunker
  callTruck() {
    const g = this.game;
    const ref = g.pilot && !g.pilot.dead ? g.pilot.pos : g.mech.pos;
    const near = this.nearestCamp(ref.x, ref.z, true);
    if (this.truckCd > 0) { g.hud.alert('RESCUE TRUCK IS BUSY', 1.5); return; }
    if (!near || near.dist > 260) { g.hud.alert('GET CLOSER TO A CAMP WITH SURVIVORS', 2); return; }
    const k = this.nearestBunker(near.camp.x, near.camp.z);
    if (!k) { g.hud.alert('NO BUNKER LEFT TO SEND A TRUCK', 2); return; }
    const a = assets();
    const t = new THREE.Group();
    const bed = new THREE.Mesh(new THREE.BoxGeometry(4.5, 3.2, 9), a.truck); bed.position.set(0, 3, -1.5);
    const cab = new THREE.Mesh(new THREE.BoxGeometry(4.3, 3, 3.4), a.truck); cab.position.set(0, 3, 5);
    t.add(bed, cab);
    for (const sx of [-2.3, 2.3]) for (const sz of [-4, 0, 4.6]) { const w = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.2, 0.9, 10), a.tire); w.rotation.z = Math.PI / 2; w.position.set(sx, 1.2, sz); t.add(w); }
    t.traverse((o) => { if (o.isMesh) o.castShadow = true; });
    t.scale.setScalar(1.5);
    t.position.copy(k.door);
    this.root.add(t);
    this.trucks.push({ g: t, pos: k.door.clone(), camp: near.camp, bunker: k, state: 'out', load: 0, t: 0 });
    this.truckCd = 25;
    audio.play('uiBig');
    g.hud.alert('RESCUE TRUCK ON THE WAY', 2.5);
    g.nav.say('truck', `A rescue truck is driving out from ${k.name} to ${near.camp.name}. Keep the tripods away from it!`, 2, 0);
  }

  save(n, bunker) {
    if (!n) return;
    const g = this.game;
    this.saved += n; bunker.inside += n;
    audio.play('uiBig');
    g.hud.alert(`${n} SURVIVOR${n > 1 ? 'S' : ''} SAFE IN ${bunker.name.toUpperCase()}`, 3.5);
    g.nav.say('saved', [`${n} more safe underground. You have saved ${this.saved} people, pilot!`, `They made it into ${bunker.name}! That is ${this.saved} saved.`][Math.floor(Math.random() * 2)], 2, 0);
  }

  // a kaiju wrecked a bunker hatch
  bunkerLost(b) {
    const k = this.bunkers.find((x) => x.b === b);
    if (!k) return;
    this.game.hud.alert(`${k.name.toUpperCase()} HATCH DESTROYED`, 4, true);
    this.game.nav.say('bunkerLost', `The kaiju smashed the hatch of ${k.name}. The people inside are safe deep underground, but nobody else can get in there now.`, 3, 0);
  }

  // ---------------- every frame ----------------
  update(dt) {
    const g = this.game, time = g.time;
    const m = g.mech, pilot = g.pilot && !g.pilot.dead ? g.pilot : null;
    this.truckCd -= dt;
    const playing = g.state === 'play';

    for (const c of this.camps) {
      if (c.crushed) continue;
      c.flame.scale.y = 1 + Math.sin(time * 9 + c.x) * 0.25;
      c.flag.rotation.y = Math.sin(time * 2 + c.z) * 0.3;
      if (Math.random() < 0.08) g.fx.fire(new THREE.Vector3(c.x, c.y + 1.5, c.z), 0.4);
      // new crates after a while, with different stuff inside
      if (!c.stocked) { c.restock -= dt; if (c.restock <= 0) { c.stocked = true; c.crates.visible = true; } }
      c.crates.rotation.y = Math.sin(time * 1.5) * 0.05;
      // survivors wave at you
      for (const p of c.people) { p.arm.rotation.z = -2.4 + Math.sin(time * 7 + p.seed) * 0.5; p.g.position.y = p.home.y + Math.abs(Math.sin(time * 3 + p.seed)) * 0.25; }
      if (!playing) continue;
      // the pilot collects the crates by walking into them
      if (pilot && c.stocked && Math.hypot(pilot.pos.x - (c.x + 9), pilot.pos.z - (c.z + 9)) < 8) this.collect(c);
      // the Jaeger picks up survivors by standing next to the camp
      if (m && m.piloted && !m.dead && c.people.length && this.aboard < SEATS && m.vel.length() < 8) {
        const d = Math.hypot(m.pos.x - c.x, m.pos.z - c.z);
        if (d < 55) {
          c.loadT = (c.loadT || 0) + dt;
          if (c.loadT > 0.6) {
            c.loadT = 0;
            const p = c.people.pop();
            this.aboard++;
            this.runners.push({ ...p, to: m.pos.clone(), speed: 30, then: 'board' });
            g.hud.alert(`SURVIVOR CLIMBING ABOARD (${this.aboard}/${SEATS})`, 1.5);
            if (this.aboard === 1) g.nav.say('aboard', 'Survivors are climbing into your Jaeger! Carry them to a bunker. Bunkers are the green B on your radar.', 2, 30);
            audio.play('ui');
          }
        }
      }
    }

    // drop survivors off at a bunker
    if (playing && m && m.piloted && this.aboard > 0 && m.vel.length() < 8) {
      for (const k of this.bunkers) {
        if (!k.b.alive || Math.hypot(m.pos.x - k.x, m.pos.z - k.z) > 60) continue;
        k.unloadT = (k.unloadT || 0) + dt;
        if (k.unloadT > 0.5) {
          k.unloadT = 0;
          this.aboard--;
          const p = makePerson(Math.floor(Math.random() * 6));
          p.g.position.copy(m.pos);
          this.root.add(p.g);
          this.runners.push({ ...p, to: k.door.clone(), speed: 26, then: 'save', bunker: k });
        }
      }
    }

    // people running to the Jaeger or to a bunker door
    for (let i = this.runners.length - 1; i >= 0; i--) {
      const r = this.runners[i];
      if (r.then === 'board' && m) r.to.copy(m.pos);
      const dx = r.to.x - r.g.position.x, dz = r.to.z - r.g.position.z;
      const d = Math.hypot(dx, dz);
      const stepLen = r.speed * dt;
      if (d < Math.max(3, stepLen) || (r.then === 'board' && d < 9)) {
        this.root.remove(r.g);
        this.runners.splice(i, 1);
        if (r.then === 'save') this.save(1, r.bunker);
        continue;
      }
      r.g.position.x += dx / d * stepLen; r.g.position.z += dz / d * stepLen;
      r.g.position.y = this.ground(r.g.position.x, r.g.position.z) + Math.abs(Math.sin(time * 14 + i)) * 0.5;
      r.g.rotation.y = Math.atan2(dx, dz);
      r.arm.rotation.z = Math.sin(time * 14 + i) * 1.2;
    }

    // rescue trucks
    for (let i = this.trucks.length - 1; i >= 0; i--) {
      const t = this.trucks[i];
      const goal = t.state === 'out' ? new THREE.Vector3(t.camp.x - 12, 0, t.camp.z + 4) : t.bunker.door;
      if (t.state === 'load') {
        t.t += dt;
        if (t.t > 0.7 && t.camp.people.length && !t.camp.crushed) {
          t.t = 0;
          const p = t.camp.people.pop();
          t.load++;
          this.runners.push({ ...p, to: t.pos.clone(), speed: 22, then: 'gone' });
        }
        if (!t.camp.people.length || t.camp.crushed) { if (t.t > 1.5) t.state = 'back'; }
        continue;
      }
      const dx = goal.x - t.pos.x, dz = goal.z - t.pos.z;
      const d = Math.hypot(dx, dz);
      if (d < 6) {
        if (t.state === 'out') { t.state = 'load'; t.t = 0; }
        else { this.save(t.load, t.bunker); this.root.remove(t.g); this.trucks.splice(i, 1); }
        continue;
      }
      const sp = 42 * dt;
      t.pos.x += dx / d * sp; t.pos.z += dz / d * sp;
      const y = this.ground(t.pos.x, t.pos.z);
      t.pos.y = Math.max(y, -1.8); // it can ford the river
      t.g.position.copy(t.pos);
      t.g.rotation.y = Math.atan2(dx, dz);
      t.g.rotation.x = -Math.atan2(this.ground(t.pos.x + dx / d * 6, t.pos.z + dz / d * 6) - y, 6) * 0.8;
      if (Math.random() < 0.3) g.fx.dust(t.pos, 0.25, 1);
    }

    // a hint when you are standing in a camp on foot
    if (playing && pilot) {
      const n = this.nearestCamp(pilot.pos.x, pilot.pos.z);
      if (n && n.dist < 45 && n.camp.stocked) g.hud.hint('Walk into the glowing green crates to collect them');
      else if (n && n.dist < 45 && this.hinted) g.hud.hint('');
      this.hinted = !!(n && n.dist < 45);
    }
  }

  dispose() { this.game.scene.remove(this.root); }
}
