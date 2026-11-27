import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { WORLD } from '../config.js';
import { City } from './city.js';
import { makeBlockTexture, makeNoiseTexture } from './textures.js';

// Chapter 2's huge map (docs/chapter-2-design.md): a destroyed city next to a
// giant hill, with a beach and a stormy sea to the north, a river, a forest,
// and a crater holding the head of a wrecked tripod.
//
// It is a City (so buildings, smashing, debris and line-of-sight all work the
// same) with real terrain around it. The ruined city itself sits on flat ground.
//
//                 N (sea, storm)
//      forest  ~~~~~~ beach ~~~~~~  lighthouse
//        |  river
//        |        RUINED CITY        GIANT HILL
//        |          (0, 0)           (1650, 250)
//      crater                south hills
//   (-1700, 1500)

export const PLACES = {
  hill: { name: 'THE GIANT HILL', x: 1650, z: 250 },
  crater: { name: 'THE CRATER', x: -1700, z: 1500 },
  forest: { name: 'THE FOREST', x: -1500, z: -950 },
  beach: { name: 'THE BEACH', x: 300, z: -2000 },
  ruins: { name: 'THE RUINED CITY', x: 0, z: 0 },
  south: { name: 'THE SOUTH HILLS', x: -300, z: 2050 },
};
const SEA_Y = -2.5;
const FLAT = WORLD.half; // the ruined city is a flat square this big (half-width)

const smooth = (x, a, b) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
function hash2(i, j) { const s = Math.sin(i * 127.1 + j * 311.7) * 43758.5453; return s - Math.floor(s); }
function vnoise(x, z) {
  const i = Math.floor(x), j = Math.floor(z), fx = x - i, fz = z - j;
  const u = fx * fx * (3 - 2 * fx), v = fz * fz * (3 - 2 * fz);
  const a = hash2(i, j), b = hash2(i + 1, j), c = hash2(i, j + 1), d = hash2(i + 1, j + 1);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
const fbm = (x, z) => vnoise(x, z) * 0.6 + vnoise(x * 2.1, z * 2.1) * 0.28 + vnoise(x * 4.3, z * 4.3) * 0.12;
const riverX = (z) => -1280 + 150 * Math.sin(z / 420) + 80 * Math.sin(z / 170 + 1);

// Height of the land at (x, z). The whole game asks this through city.groundAt().
export function terrainHeight(x, z) {
  const edge = Math.max(Math.abs(x), Math.abs(z));
  const k = smooth(edge, FLAT + 40, FLAT + 340); // 0 inside the city, 1 out in the wild
  if (k <= 0) return 0;
  let h = 13 + (fbm(x / 300, z / 300) - 0.5) * 44; // gently rolling, mostly above the water
  // the giant hill
  const dh = Math.hypot(x - PLACES.hill.x, z - PLACES.hill.z);
  const hk = 1 - smooth(dh, 0, 1080);
  h += 340 * hk ** 1.7 + (fbm(x / 120 + 9, z / 120) - 0.5) * 46 * hk;
  // smaller hills to the south
  h += 130 * (1 - smooth(Math.hypot(x - PLACES.south.x, z - PLACES.south.z), 0, 640)) ** 1.5;
  h += 80 * (1 - smooth(Math.hypot(x - 900, z - 1900), 0, 420)) ** 1.5;
  // crater: a raised rim around a deep bowl
  const dc = Math.hypot(x - PLACES.crater.x, z - PLACES.crater.z);
  // (it sits on a raised shelf so the bowl stays dry instead of filling with water)
  h += 56 * (1 - smooth(dc, 280, 640)) + 40 * Math.exp(-(((dc - 255) / 75) ** 2)) - 48 * (1 - smooth(dc, 0, 235));
  // river running north to the sea
  if (z < 1500) {
    const rk = (1 - smooth(Math.abs(x - riverX(z)), 28, 100)) * smooth(1500 - z, 0, 300);
    h += (-7.5 - h) * rk;
  }
  // beach sloping into the sea
  h += (-10 - h) * smooth(-z, 1700, 2350);
  return h * k;
}

export class Wasteland extends City {
  constructor(scene, physics, fx) {
    super(scene, physics, fx);
    this.kind = 'wasteland';
    this.bound = 2500;
    this.hasTerrain = true;
    this.noPlant = true;
    this.places = PLACES;
    this.stormT = 2;
  }

  groundAt(x, z) { return terrainHeight(x, z); }

  // True if the land itself is in the way between two points (hills block scanners).
  terrainBlocks(p0, p1) {
    const dx = p1.x - p0.x, dy = p1.y - p0.y, dz = p1.z - p0.z;
    const n = Math.ceil(Math.hypot(dx, dz) / 40);
    for (let i = 1; i < n; i++) {
      const t = i / n;
      if (terrainHeight(p0.x + dx * t, p0.z + dz * t) > p0.y + dy * t + 1) return true;
    }
    return false;
  }

  // Where a ray first touches the land. Returns the distance, or null.
  rayGround(o, d, max) {
    let prev = 0;
    for (let t = 25; t <= max; t += 25) {
      if (o.y + d.y * t <= terrainHeight(o.x + d.x * t, o.z + d.z * t)) {
        let a = prev, b = t;
        for (let i = 0; i < 6; i++) {
          const m = (a + b) / 2;
          if (o.y + d.y * m <= terrainHeight(o.x + d.x * m, o.z + d.z * m)) b = m; else a = m;
        }
        return b;
      }
      prev = t;
    }
    return null;
  }

  nearestPlace(x, z) {
    let best = PLACES.ruins, bd = Infinity;
    for (const p of Object.values(PLACES)) {
      const d = Math.hypot(p.x - x, p.z - z);
      if (d < bd) { bd = d; best = p; }
    }
    if (Math.abs(x - riverX(z)) < 200 && z < 1400 && bd > 500) return { name: 'THE RIVER', x, z };
    return best;
  }

  // ---------------- materials: the lights are mostly out ----------------
  makeMaterials() {
    super.makeMaterials();
    for (const m of this.wallMats) { m.emissiveIntensity = 0.22; m.color.set('#b0a8a0'); }
    for (const m of this.ghostWall) { m.emissiveIntensity = 0.22; }
  }

  // ---------------- ground ----------------
  makeGround() {
    // cracked city streets on the flat part
    const size = WORLD.block * WORLD.grid;
    const tex = makeBlockTexture();
    tex.repeat.set(WORLD.grid, WORLD.grid);
    const streets = new THREE.Mesh(new THREE.PlaneGeometry(size, size), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.95, color: '#9a938c' }));
    streets.rotation.x = -Math.PI / 2;
    streets.receiveShadow = true;
    this.root.add(streets);

    // the land
    const SIZE = 7000, N = 230;
    const geo = new THREE.PlaneGeometry(SIZE, SIZE, N, N);
    geo.rotateX(-Math.PI / 2);
    const pos = geo.attributes.position;
    const col = new Float32Array(pos.count * 3);
    const c = new THREE.Color();
    const grassA = new THREE.Color('#7a9150'), grassB = new THREE.Color('#4f6a3a'), sand = new THREE.Color('#e2d09a');
    const rock = new THREE.Color('#a39cab'), scorch = new THREE.Color('#6a625a'), ash = new THREE.Color('#756c70'), mud = new THREE.Color('#8a7f60');
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), z = pos.getZ(i);
      const h = terrainHeight(x, z);
      const edge = Math.max(Math.abs(x), Math.abs(z));
      pos.setY(i, edge < FLAT + 30 ? -0.6 : h);
      // colour by what kind of place it is
      const n = fbm(x / 90, z / 90);
      c.copy(grassA).lerp(grassB, n);
      const slope = Math.abs(terrainHeight(x + 20, z) - h) + Math.abs(terrainHeight(x, z + 20) - h);
      c.lerp(rock, smooth(slope, 9, 20) * 0.9);
      c.lerp(rock, smooth(h, 230, 330) * 0.6);
      c.lerp(scorch, (1 - smooth(edge, FLAT, FLAT + 420)) * 0.85);
      c.lerp(ash, 1 - smooth(Math.hypot(x - PLACES.crater.x, z - PLACES.crater.z), 200, 420));
      if (h < 5) c.lerp(z < -1500 ? sand : mud, 1 - smooth(h, 0, 5));
      col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
    }
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    geo.computeVertexNormals();
    const noise = makeNoiseTexture({ base: '#ffffff', spots: '#cfcfcf', count: 2600, seed: 5 });
    noise.repeat.set(110, 110);
    const land = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, map: noise, roughness: 1, metalness: 0 }));
    land.receiveShadow = true;
    this.root.add(land);
    this.land = land;

    // sea and river share one sheet of water just below street level
    const waterNormal = makeNoiseTexture({ base: '#8080ff', spots: '#5050e0', count: 3000, seed: 9, scale: 0.6 });
    waterNormal.colorSpace = THREE.NoColorSpace;
    waterNormal.repeat.set(40, 40);
    this.waterNormal = waterNormal;
    const water = new THREE.Mesh(new THREE.PlaneGeometry(14000, 14000),
      new THREE.MeshStandardMaterial({ color: '#17323f', roughness: 0.14, metalness: 0.6, normalMap: waterNormal, normalScale: new THREE.Vector2(0.4, 0.4) }));
    water.rotation.x = -Math.PI / 2;
    water.position.y = SEA_Y;
    this.root.add(water);
    this.waterEdge = -2080; // north of this line you are wading in the sea
  }

  makeSky() {
    super.makeSky();
    this.scene.fog = new THREE.Fog('#6c5a70', 700, 4600);
  }

  // ---------------- the ruined city ----------------
  isPlantCell() { return false; }

  addBuilding(x, z, hw, hd, h, matIndex, r) {
    this.rubbleSpots ??= [];
    // lots of buildings are already gone
    if (r() < 0.42) { this.rubbleSpots.push([x, z, hw, hd, h]); return null; }
    const b = super.addBuilding(x, z, hw, hd, Math.min(135, h * (0.3 + r() * 0.5)), matIndex, r);
    b.hp = b.maxHp * (0.35 + r() * 0.5); // and the rest are already cracked
    if (r() < 0.05) this.fires.push({ p: new THREE.Vector3(x, b.h * 0.85, z), t: 1e9, b, size: 1.6 });
    return b;
  }

  // no power plant out here
  makePowerPlant() {
    this.plantParts = [];
    this.plantCenter = new THREE.Vector3(0, 0, 0);
  }

  plantIntegrity() { return 1; }

  // ---------------- everything scattered on the land ----------------
  makeDecor() {
    super.makeDecor();
    const r = this.rng;
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3();
    // the old outskirts trees: stand them on the land
    for (let i = 0; i < this.trees.count; i++) {
      this.trees.getMatrixAt(i, m);
      m.decompose(p, q, s);
      p.y = terrainHeight(p.x, p.z);
      if (p.y < 0.5 && Math.max(Math.abs(p.x), Math.abs(p.z)) > FLAT) s.set(0, 0, 0);
      m.compose(p, q, s);
      this.trees.setMatrixAt(i, m);
    }
    this.trees.instanceMatrix.needsUpdate = true;

    // rubble piles where buildings used to be
    const pileGeo = new THREE.DodecahedronGeometry(1, 0).scale(1, 0.55, 1).translate(0, 0.25, 0);
    const piles = new THREE.InstancedMesh(pileGeo, this.rubbleMat, this.rubbleSpots.length);
    this.rubbleSpots.forEach(([x, z, hw, hd, h], i) => {
      q.setFromEuler(new THREE.Euler(0, r() * 6, 0));
      m.compose(p.set(x, 0, z), q, s.set(hw * 1.2, 4 + Math.min(16, h * 0.08), hd * 1.2));
      piles.setMatrixAt(i, m);
    });
    piles.castShadow = piles.receiveShadow = true;
    this.root.add(piles);

    // forest, plus trees dotted over the whole map
    const trunk = new THREE.CylinderGeometry(0.7, 1, 9, 5).translate(0, 4.5, 0);
    const pine = mergeGeometries([trunk.toNonIndexed(), new THREE.ConeGeometry(5.5, 13, 6).translate(0, 13, 0).toNonIndexed(), new THREE.ConeGeometry(4, 10, 6).translate(0, 20, 0).toNonIndexed()]);
    const spots = [];
    const tryTree = (x, z, sc) => {
      if (Math.max(Math.abs(x), Math.abs(z)) < FLAT + 60 || Math.abs(x) > 3200 || Math.abs(z) > 3200) return;
      const h = terrainHeight(x, z);
      if (h < 1.5 || h > 250) return;
      if (Math.hypot(x - PLACES.crater.x, z - PLACES.crater.z) < 380) return;
      spots.push([x, h, z, sc]);
    };
    for (let k = 0; k < 1500; k++) {
      const a = r() * Math.PI * 2, d = Math.sqrt(r()) * 760;
      tryTree(PLACES.forest.x + Math.cos(a) * d, PLACES.forest.z + Math.sin(a) * d * 0.8, 1.1 + r() * 1.4);
    }
    for (let k = 0; k < 1100; k++) tryTree((r() - 0.5) * 6200, (r() - 0.5) * 6200, 0.9 + r() * 1.2);
    const pines = new THREE.InstancedMesh(pine, new THREE.MeshStandardMaterial({ color: '#3d6b40', roughness: 1, flatShading: true }), spots.length);
    spots.forEach(([x, y, z, sc], i) => {
      q.setFromEuler(new THREE.Euler(0, r() * 6, 0));
      m.compose(p.set(x, y - 0.5, z), q, s.set(sc, sc * (0.8 + r() * 0.5), sc));
      pines.setMatrixAt(i, m);
    });
    pines.castShadow = true;
    this.root.add(pines);

    // boulders on the hills
    const rocks = [];
    for (let k = 0; k < 900 && rocks.length < 320; k++) {
      const x = (r() - 0.5) * 6000, z = (r() - 0.5) * 6000;
      const h = terrainHeight(x, z);
      if (h > 60 || (h > 8 && r() < 0.08)) rocks.push([x, h, z, 3 + r() * 9]);
    }
    const rockMesh = new THREE.InstancedMesh(new THREE.DodecahedronGeometry(1, 0), new THREE.MeshStandardMaterial({ color: '#9a94a2', roughness: 1, flatShading: true }), rocks.length);
    rocks.forEach(([x, y, z, sc], i) => {
      q.setFromEuler(new THREE.Euler(r() * 3, r() * 6, r() * 3));
      m.compose(p.set(x, y + sc * 0.2, z), q, s.set(sc, sc * 0.7, sc * (0.7 + r() * 0.6)));
      rockMesh.setMatrixAt(i, m);
    });
    rockMesh.castShadow = rockMesh.receiveShadow = true;
    this.root.add(rockMesh);

    this.makeLandmarks();
    this.makeStorm();
  }

  makeLandmarks() {
    const metal = new THREE.MeshStandardMaterial({ color: '#8b93a6', metalness: 0.6, roughness: 0.4, emissive: '#1a2030', emissiveIntensity: 0.6 });
    const dark = new THREE.MeshStandardMaterial({ color: '#1c1d22', metalness: 0.6, roughness: 0.6 });
    const add = (mesh, x, y, z) => { mesh.position.set(x, y, z); mesh.castShadow = true; this.root.add(mesh); return mesh; };

    // the head of a destroyed tripod, half buried in the crater
    const cx = PLACES.crater.x, cz = PLACES.crater.z, cy = terrainHeight(cx, cz);
    const wreck = new THREE.Group();
    const hull = new THREE.Mesh(new THREE.SphereGeometry(13, 24, 16), metal); hull.scale.set(1, 0.55, 1.1);
    const hood = new THREE.Mesh(new THREE.SphereGeometry(6.5, 16, 12), metal); hood.scale.set(1.25, 0.62, 1); hood.position.set(0, -1.5, 12.5);
    wreck.add(hull, hood);
    const deadLight = new THREE.MeshStandardMaterial({ color: '#000', emissive: '#ff2a1a', emissiveIntensity: 0 });
    for (let i = 0; i < 5; i++) {
      const l = new THREE.Mesh(new THREE.CircleGeometry(0.95, 12), i === 3 ? deadLight : dark);
      l.position.set((i - 2) * 2.6, -1.5, 18.8);
      wreck.add(l);
    }
    for (const a of [0.4, 2.6, 4.4]) { // broken leg stumps
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(1.7, 1.4, 22, 8), metal);
      leg.position.set(Math.sin(a) * 13, -3, Math.cos(a) * 13);
      leg.rotation.set(Math.cos(a) * 1.1, 0, -Math.sin(a) * 1.1);
      wreck.add(leg);
    }
    wreck.scale.setScalar(2.2);
    wreck.position.set(cx, cy + 7, cz);
    wreck.rotation.set(0.35, 0.8, -0.3);
    wreck.traverse((o) => { if (o.isMesh) o.castShadow = true; });
    this.root.add(wreck);
    this.wreckLight = deadLight;
    const glow = new THREE.PointLight('#7dffb0', 1800, 520, 1.6); // eerie light in the bowl
    glow.position.set(cx, cy + 45, cz);
    this.root.add(glow);
    this.steamVents.push({ p: new THREE.Vector3(cx, cy + 22, cz), part: null, smoke: true });

    // radio tower on top of the giant hill
    const hx = PLACES.hill.x, hz = PLACES.hill.z, hy = terrainHeight(hx, hz);
    add(new THREE.Mesh(new THREE.CylinderGeometry(1, 5, 90, 4), metal), hx, hy + 45, hz);
    for (const y of [30, 55, 78]) add(new THREE.Mesh(new THREE.BoxGeometry(16 - y * 0.12, 1, 1), metal), hx, hy + y, hz);
    const tb = add(new THREE.Mesh(this.beaconGeo, this.beaconMat), hx, hy + 91, hz);
    this.beacons.push(tb);

    // lighthouse on the beach
    const lx = 1150, lz = -1930, ly = terrainHeight(lx, lz);
    add(new THREE.Mesh(new THREE.CylinderGeometry(5, 8, 60, 14), this.concreteMat), lx, ly + 30, lz);
    add(new THREE.Mesh(new THREE.CylinderGeometry(6, 6, 4, 14), new THREE.MeshStandardMaterial({ color: '#a8322a', roughness: 0.8 })), lx, ly + 44, lz);
    add(new THREE.Mesh(new THREE.CylinderGeometry(4, 4, 7, 12), new THREE.MeshStandardMaterial({ color: '#000', emissive: '#ffe9a8', emissiveIntensity: 2.5 })), lx, ly + 63.5, lz);
    add(new THREE.Mesh(new THREE.ConeGeometry(6, 6, 12), dark), lx, ly + 70, lz);

    // a ship wrecked on the sand
    const sx = -350, sz = -2050;
    const ship = new THREE.Group();
    const sh = new THREE.Mesh(new THREE.BoxGeometry(34, 18, 150), new THREE.MeshStandardMaterial({ color: '#5a3a30', roughness: 0.9 }));
    const deck = new THREE.Mesh(new THREE.BoxGeometry(24, 16, 30), this.concreteMat); deck.position.set(0, 16, -40);
    const stack = new THREE.Mesh(new THREE.CylinderGeometry(4, 4, 16, 10), dark); stack.position.set(0, 30, -40);
    ship.add(sh, deck, stack);
    ship.position.set(sx, terrainHeight(sx, sz) + 5, sz);
    ship.rotation.set(0.05, 0.7, 0.28);
    ship.traverse((o) => { if (o.isMesh) o.castShadow = true; });
    this.root.add(ship);

    // the broken bridge over the river, west of the city
    const bz = 55, bx = riverX(bz);
    for (const side of [-1, 1]) {
      add(new THREE.Mesh(new THREE.BoxGeometry(10, 26, 16), this.concreteMat), bx + side * 60, 6, bz);
      const span = add(new THREE.Mesh(new THREE.BoxGeometry(70, 3, 20), this.concreteMat), bx + side * 95, terrainHeight(bx + side * 130, bz) + 9, bz);
      span.rotation.z = side * 0.12;
      const fallen = add(new THREE.Mesh(new THREE.BoxGeometry(38, 3, 20), this.concreteMat), bx + side * 28, 3, bz);
      fallen.rotation.z = side * -0.6;
    }
  }

  // The big storm off the coast: far-away clouds that flicker with lightning.
  makeStorm() {
    const g = new THREE.Group();
    g.position.set(200, 0, -5600);
    const cloudMat = new THREE.MeshBasicMaterial({ color: '#17142a', fog: false });
    this.stormFlash = new THREE.MeshBasicMaterial({ color: '#17142a', fog: false });
    const r = this.rng;
    for (let i = 0; i < 26; i++) {
      const c = new THREE.Mesh(new THREE.SphereGeometry(600 + r() * 500, 12, 8), i % 4 === 0 ? this.stormFlash : cloudMat);
      c.scale.y = 0.34;
      c.position.set((r() - 0.5) * 9000, 900 + r() * 500, (r() - 0.5) * 900);
      g.add(c);
    }
    // sheets of rain under the clouds
    const rain = new THREE.Mesh(new THREE.PlaneGeometry(13000, 1000), new THREE.MeshBasicMaterial({ color: '#221f38', transparent: true, opacity: 0.5, fog: false, depthWrite: false }));
    rain.position.set(0, 450, 200);
    g.add(rain);
    // a jagged bolt that shows for a blink
    const pts = [];
    let x = 0;
    for (let y = 900; y >= 0; y -= 90) { pts.push(new THREE.Vector3(x, y, 0)); x += (r() - 0.5) * 150; }
    const quads = [];
    for (let i = 0; i < pts.length - 1; i++) {
      const a = pts[i], b = pts[i + 1];
      const q = new THREE.PlaneGeometry(22, a.distanceTo(b) + 10);
      q.rotateZ(Math.atan2(-(b.x - a.x), -(b.y - a.y)) + Math.PI);
      q.translate((a.x + b.x) / 2, (a.y + b.y) / 2, 0);
      quads.push(q);
    }
    this.stormBolt = new THREE.Mesh(mergeGeometries(quads), new THREE.MeshBasicMaterial({ color: '#e6eeff', fog: false, side: THREE.DoubleSide }));
    this.stormBolt.position.z = 320;
    this.stormBolt.visible = false;
    g.add(this.stormBolt);
    this.scene.add(g);
    this.storm = g;
  }

  makeMountains() {
    const mat = new THREE.MeshStandardMaterial({ color: '#3a3550', roughness: 1, flatShading: true });
    const r = this.rng;
    const geos = [];
    for (let k = 0; k < 44; k++) {
      const a = (k / 44) * Math.PI * 2 + r() * 0.1;
      if (Math.sin(a) < -0.45) continue; // open sea to the north
      const d = 4700 + r() * 700;
      const h = 300 + r() * 600;
      const g = new THREE.ConeGeometry(500 + r() * 500, h, 6 + Math.floor(r() * 3));
      g.translate(Math.cos(a) * d, h / 2 - 30, Math.sin(a) * d);
      geos.push(g.toNonIndexed());
    }
    this.root.add(new THREE.Mesh(mergeGeometries(geos), mat));
  }

  update(dt, time) {
    for (let i = this.fires.length - 1; i >= 0; i--) if (this.fires[i].b && !this.fires[i].b.alive && this.fires[i].t > 1e6) this.fires[i].t = 20;
    super.update(dt, time);
    // storm lightning
    this.stormT -= dt;
    if (this.stormT <= 0) {
      this.stormT = 1.5 + Math.random() * 5;
      this.flashT = 0.16 + Math.random() * 0.14;
      this.stormBolt.position.x = (Math.random() - 0.5) * 4200;
      this.stormBolt.scale.x = Math.random() < 0.5 ? 1 : -1;
    }
    this.flashT = Math.max(0, (this.flashT || 0) - dt);
    const on = this.flashT > 0 && Math.sin(time * 90) > -0.3;
    this.stormBolt.visible = on;
    this.stormFlash.color.set(on ? '#7f8fd8' : '#17142a');
    if (this.wreckLight) this.wreckLight.emissiveIntensity = Math.sin(time * 1.3) > 0.92 ? 2.5 : 0; // one light still blinks
  }
}
