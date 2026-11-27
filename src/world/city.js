import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { WORLD } from '../config.js';
import { audio } from '../audio.js';
import { makeFacade, makeBlockTexture, makeNoiseTexture } from './textures.js';

const TILE = 16; // meters covered by one facade texture tile

// ---------- geometry helpers (world-space, merged per building) ----------

class GeoBuilder {
  constructor() { this.pos = []; this.nor = []; this.uv = []; this.idx = []; }
  quad(a, b, c, d, n, uvs) {
    const i = this.pos.length / 3;
    for (const p of [a, b, c, d]) this.pos.push(p[0], p[1], p[2]);
    for (let k = 0; k < 4; k++) this.nor.push(n[0], n[1], n[2]);
    for (const t of uvs) this.uv.push(t[0], t[1]);
    this.idx.push(i, i + 1, i + 2, i, i + 2, i + 3);
  }
  // 4 vertical walls of a box with world-scaled UVs
  walls(cx, y0, cz, hw, h, hd, uo = 0, vo = 0) {
    const x0 = cx - hw, x1 = cx + hw, z0 = cz - hd, z1 = cz + hd, y1 = y0 + h;
    const W = (2 * hw) / TILE, D = (2 * hd) / TILE, v0 = vo + y0 / TILE, v1 = vo + y1 / TILE;
    // +z
    this.quad([x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1], [0, 0, 1], [[uo, v0], [uo + W, v0], [uo + W, v1], [uo, v1]]);
    // -z
    this.quad([x1, y0, z0], [x0, y0, z0], [x0, y1, z0], [x1, y1, z0], [0, 0, -1], [[uo + 0.3, v0], [uo + 0.3 + W, v0], [uo + 0.3 + W, v1], [uo + 0.3, v1]]);
    // +x
    this.quad([x1, y0, z1], [x1, y0, z0], [x1, y1, z0], [x1, y1, z1], [1, 0, 0], [[uo + 0.6, v0], [uo + 0.6 + D, v0], [uo + 0.6 + D, v1], [uo + 0.6, v1]]);
    // -x
    this.quad([x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0], [-1, 0, 0], [[uo + 0.1, v0], [uo + 0.1 + D, v0], [uo + 0.1 + D, v1], [uo + 0.1, v1]]);
  }
  top(cx, y, cz, hw, hd) {
    this.quad([cx - hw, y, cz + hd], [cx + hw, y, cz + hd], [cx + hw, y, cz - hd], [cx - hw, y, cz - hd], [0, 1, 0], [[0, 0], [1, 0], [1, 1], [0, 1]]);
  }
  box(cx, y0, cz, hw, h, hd) {
    this.walls(cx, y0, cz, hw, h, hd);
    this.top(cx, y0 + h, cz, hw, hd);
  }
  build() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.nor, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(this.uv, 2));
    g.setIndex(this.idx);
    g.computeBoundingSphere();
    g.computeBoundingBox();
    return g;
  }
  get empty() { return this.pos.length === 0; }
}

function srand(seed) {
  let s = seed >>> 0;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
}

// ---------- City ----------

export class City {
  constructor(scene, physics, fx) {
    this.scene = scene;
    this.physics = physics;
    this.fx = fx;
    this.root = new THREE.Group();
    scene.add(this.root);
    this.kind = 'city';
    this.bound = WORLD.bound;   // how far from the middle you can walk
    this.hasTerrain = false;
    this.buildings = [];
    this.hash = new Map();
    this.cell = 60;
    this.destroyed = 0;
    this.fires = [];
    this.steamVents = [];
    this.beacons = [];
    this.onPlantDamaged = null;
    this.onBuildingDestroyed = null;
    this.rng = srand(1337);
    this.tiles = new Map();
    this.beaconGeo = new THREE.SphereGeometry(1.4, 8, 6);
    this.makeMaterials();
    this.makeGround();
    this.makeSky();
    this.makeLights();
    this.generate();
    this.updateTiles();
    this.makePowerPlant();
    this.makeDecor();
    this.makeMountains();
    this.initDebris();
  }

  // ---------------- materials ----------------
  makeMaterials() {
    const styles = [
      { base: '#5d6c7a', frame: '#2a3138', glass: '#1d3a52', cols: 6, style: 'glass', color: '#ffffff', metal: 0.5, rough: 0.35 },
      { base: '#9a948a', frame: '#6e685f', glass: '#24303a', cols: 4, style: 'grid', color: '#ffffff', metal: 0.1, rough: 0.8 },
      { base: '#8a4a36', frame: '#5e3022', glass: '#1b2228', cols: 4, style: 'grid', color: '#ffffff', metal: 0.05, rough: 0.9 },
      { base: '#c8c2b4', frame: '#8f8a7e', glass: '#2b3946', cols: 5, style: 'band', color: '#ffffff', metal: 0.15, rough: 0.7 },
      { base: '#3a4552', frame: '#1c232b', glass: '#2a5a7a', cols: 8, style: 'glass', color: '#ffffff', metal: 0.6, rough: 0.3 },
      { base: '#6a6458', frame: '#47423a', glass: '#20262c', cols: 3, style: 'grid', color: '#ffffff', metal: 0.05, rough: 0.85 },
    ];
    this.wallMats = styles.map((s, i) => {
      const { map, emissive } = makeFacade({ ...s, seed: 100 + i * 17, litChance: 0.3 + (i % 3) * 0.08 });
      return new THREE.MeshStandardMaterial({
        map, emissiveMap: emissive, emissive: new THREE.Color('#ffffff'), emissiveIntensity: 0.95,
        metalness: s.metal, roughness: s.rough,
      });
    });
    this.roofMat = new THREE.MeshStandardMaterial({ color: '#4a4c50', roughness: 0.9, metalness: 0.1 });
    // see-through versions used when a building blocks the camera's view
    const ghost = (m) => { const g = m.clone(); g.transparent = true; g.opacity = 0.18; g.depthWrite = false; return g; };
    this.ghostWall = this.wallMats.map(ghost);
    this.ghostRoof = ghost(this.roofMat);
    this.ghosted = new Set();
    this.detailMat = new THREE.MeshStandardMaterial({ color: '#7d8187', roughness: 0.6, metalness: 0.5 });
    this.concreteMat = new THREE.MeshStandardMaterial({ color: '#b9b6ae', roughness: 0.85 });
    this.plantMetal = new THREE.MeshStandardMaterial({ color: '#8c939b', roughness: 0.5, metalness: 0.6 });
    this.rubbleMat = new THREE.MeshStandardMaterial({ color: '#6b665e', roughness: 1, flatShading: true });
    this.beaconMat = new THREE.MeshBasicMaterial({ color: '#ff2a2a' });
  }

  // ---------------- environment ----------------
  makeGround() {
    const size = WORLD.block * WORLD.grid;
    const tex = makeBlockTexture();
    tex.repeat.set(WORLD.grid, WORLD.grid);
    const cityMat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.92, metalness: 0.0 });
    const city = new THREE.Mesh(new THREE.PlaneGeometry(size, size), cityMat);
    city.rotation.x = -Math.PI / 2;
    city.receiveShadow = true;
    this.root.add(city);

    const grassTex = makeNoiseTexture({ base: '#3d4a2c', spots: '#1e2616', count: 2500, seed: 5 });
    grassTex.repeat.set(60, 60);
    const outer = new THREE.Mesh(new THREE.PlaneGeometry(9000, 9000), new THREE.MeshStandardMaterial({ map: grassTex, roughness: 1 }));
    outer.rotation.x = -Math.PI / 2;
    outer.position.y = -0.08;
    outer.receiveShadow = true;
    this.root.add(outer);

    // Bay to the north
    const waterNormal = makeNoiseTexture({ base: '#8080ff', spots: '#5050e0', count: 3000, seed: 9, scale: 0.6 });
    waterNormal.colorSpace = THREE.NoColorSpace;
    waterNormal.repeat.set(30, 15);
    this.waterNormal = waterNormal;
    const water = new THREE.Mesh(
      new THREE.PlaneGeometry(9000, 3600),
      new THREE.MeshStandardMaterial({ color: '#1d3b4f', roughness: 0.12, metalness: 0.6, normalMap: waterNormal, normalScale: new THREE.Vector2(0.4, 0.4) }),
    );
    water.rotation.x = -Math.PI / 2;
    this.waterEdge = -WORLD.half - 40;
    water.position.set(0, 0.6, this.waterEdge - 1800);
    water.receiveShadow = true;
    this.root.add(water);
    // seawall
    const wall = new THREE.Mesh(new THREE.BoxGeometry(9000, 3, 6), this.concreteMat);
    wall.position.set(0, 1, this.waterEdge + 3);
    this.root.add(wall);
  }

  makeSky() {
    const geo = new THREE.SphereGeometry(6000, 32, 16);
    this.sunDir = new THREE.Vector3(-0.75, 0.2, 0.35).normalize();
    const mat = new THREE.ShaderMaterial({
      side: THREE.BackSide, depthWrite: false, fog: false,
      uniforms: {
        uSun: { value: this.sunDir },
        uTop: { value: new THREE.Color('#141c44') },
        uMid: { value: new THREE.Color('#4b3c6e') },
        uHor: { value: new THREE.Color('#f0875a') },
      },
      vertexShader: `varying vec3 vDir; void main(){ vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); gl_Position.z = gl_Position.w; }`,
      fragmentShader: `
        uniform vec3 uSun, uTop, uMid, uHor; varying vec3 vDir;
        float hash(vec3 p){ p = fract(p*0.3183099+.1); p*=17.0; return fract(p.x*p.y*p.z*(p.x+p.y+p.z)); }
        void main(){
          float h = vDir.y;
          vec3 c = mix(uHor, uMid, smoothstep(-0.02, 0.25, h));
          c = mix(c, uTop, smoothstep(0.25, 0.8, h));
          float s = max(0.0, dot(vDir, uSun));
          c += vec3(1.0,0.6,0.3) * pow(s, 8.0) * 0.6;
          c += vec3(1.0,0.85,0.6) * pow(s, 600.0) * 4.0;
          // stars high up
          vec3 q = floor(vDir * 400.0);
          float st = step(0.997, hash(q)) * smoothstep(0.3, 0.8, h);
          c += vec3(st) * 0.8;
          if (h < 0.0) c = mix(uHor, vec3(0.18,0.14,0.2), smoothstep(0.0,-0.2,h));
          gl_FragColor = vec4(c, 1.0);
          #include <colorspace_fragment>
        }`,
    });
    this.sky = new THREE.Mesh(geo, mat);
    this.sky.renderOrder = -1;
    this.sky.frustumCulled = false;
    this.scene.add(this.sky);
    this.scene.fog = new THREE.Fog('#7d5f7a', 500, 3600);
  }

  makeLights() {
    const hemi = new THREE.HemisphereLight('#9fb2ff', '#4a3434', 1.1);
    this.scene.add(hemi);
    const sun = new THREE.DirectionalLight('#ffc89a', 3.0);
    sun.position.copy(this.sunDir).multiplyScalar(800);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    const sc = sun.shadow.camera;
    sc.left = -320; sc.right = 320; sc.top = 320; sc.bottom = -320; sc.near = 10; sc.far = 2200;
    sun.shadow.bias = -0.0008;
    sun.shadow.normalBias = 1.5;
    this.scene.add(sun);
    this.scene.add(sun.target);
    this.sun = sun;
    // cool rim light from opposite side
    const rim = new THREE.DirectionalLight('#6a8cff', 0.7);
    rim.position.set(600, 400, -500);
    this.scene.add(rim);
  }

  followShadow(p) {
    const s = this.sun;
    // snap to texel grid to avoid shimmering
    const step = 640 / 2048 * 4;
    const x = Math.round(p.x / step) * step, z = Math.round(p.z / step) * step;
    const gy = this.groundAt(x, z);
    s.target.position.set(x, gy, z);
    s.position.set(x + this.sunDir.x * 900, this.sunDir.y * 900 + 200 + gy, z + this.sunDir.z * 900);
  }

  // ---------------- buildings ----------------
  cellCenter(i) { return -WORLD.half + (i + 0.5) * WORLD.block; }

  isPlantCell(i, j) { return (i === 6 || i === 7) && (j === 9 || j === 10); }

  generate() {
    const r = this.rng;
    const N = WORLD.grid;
    const lot = WORLD.block - WORLD.road - 8; // usable lot (minus sidewalks)
    this.parkCells = [];
    for (let i = 0; i < N; i++) {
      for (let j = 0; j < N; j++) {
        if (this.isPlantCell(i, j)) continue;
        const cx = this.cellCenter(i), cz = this.cellCenter(j);
        const d = Math.hypot(cx, cz + 150) / WORLD.half; // downtown slightly north of center
        // keep the drop zone (center intersection) clear-ish
        if (Math.abs(cx) < 60 && Math.abs(cz) < 60 && r() < 0.5) { this.parkCells.push([cx, cz]); continue; }
        if (d > 0.45 && r() < 0.07) { this.parkCells.push([cx, cz]); continue; }
        let hMin, hMax, mats;
        if (d < 0.35) { hMin = 70; hMax = 230; mats = [0, 4, 3, 0, 4]; }
        else if (d < 0.7) { hMin = 30; hMax = 110; mats = [1, 3, 0, 5, 2]; }
        else { hMin = 12; hMax = 48; mats = [2, 5, 1, 2, 3]; }
        const split = r();
        const lots = [];
        if (split < 0.3) lots.push([cx, cz, lot / 2, lot / 2]);
        else if (split < 0.6) {
          const w = lot / 2 - 2;
          if (r() < 0.5) { lots.push([cx - lot / 4 - 1, cz, w / 2 + lot / 8 - lot / 8, lot / 2]); lots.push([cx + lot / 4 + 1, cz, w / 2, lot / 2]); }
          else { lots.push([cx, cz - lot / 4 - 1, lot / 2, w / 2]); lots.push([cx, cz + lot / 4 + 1, lot / 2, w / 2]); }
        } else {
          const q = lot / 4;
          for (const sx of [-1, 1]) for (const sz of [-1, 1]) lots.push([cx + sx * (q + 1), cz + sz * (q + 1), q - 1, q - 1]);
        }
        for (const [lx, lz, lhw, lhd] of lots) {
          const shrink = 0.82 + r() * 0.18;
          const hw = lhw * shrink, hd = lhd * shrink;
          let h = hMin + (hMax - hMin) * r() ** 1.6;
          if (lots.length === 4) h *= 0.75;
          const mat = mats[Math.floor(r() * mats.length)];
          this.addBuilding(lx, lz, hw, hd, h, mat, r);
        }
      }
    }
  }

  addBuilding(x, z, hw, hd, h, matIndex, r) {
    const walls = new GeoBuilder(), roof = new GeoBuilder();
    const pieces = [];
    const uo = r() * 10, vo = Math.floor(r() * 4) * 0.25;
    // base mass
    let y = 0;
    let cw = hw, cd = hd;
    const tiers = h > 90 && r() < 0.6 ? 2 + Math.floor(r() * 2) : 1;
    let remaining = h;
    for (let t = 0; t < tiers; t++) {
      const th = t === tiers - 1 ? remaining : remaining * (0.45 + r() * 0.2);
      walls.walls(x, y, z, cw, th, cd, uo, vo);
      pieces.push({ x, y: y + th / 2, z, hx: cw, hy: th / 2, hz: cd });
      y += th; remaining -= th;
      roof.top(x, y, z, cw, cd);
      // parapet
      roof.box(x, y, z + cd - 0.6, cw, 1.4, 0.6);
      roof.box(x, y, z - cd + 0.6, cw, 1.4, 0.6);
      if (t < tiers - 1) { cw *= 0.7 + r() * 0.12; cd *= 0.7 + r() * 0.12; }
    }
    // rooftop details
    const nDet = 1 + Math.floor(r() * 3);
    for (let k = 0; k < nDet; k++) {
      const dw = 2 + r() * Math.min(6, cw * 0.3), dd = 2 + r() * Math.min(6, cd * 0.3);
      roof.box(x + (r() - 0.5) * (cw - dw) * 1.6, y, z + (r() - 0.5) * (cd - dd) * 1.6, dw, 2 + r() * 4, dd);
    }
    let antenna = null;
    if (h > 140 && r() < 0.7) {
      const ah = 20 + r() * 30;
      roof.box(x, y, z, 0.8, ah, 0.8);
      antenna = new THREE.Vector3(x, y + ah, z);
    }
    let beacon = null;
    if (antenna) {
      beacon = new THREE.Mesh(this.beaconGeo, this.beaconMat);
      beacon.position.copy(antenna);
      this.root.add(beacon);
      this.beacons.push(beacon);
    }
    const vol = pieces.reduce((s, p) => s + p.hx * p.hy * p.hz * 8, 0);
    const b = {
      id: this.buildings.length, x, z, hw, hd, h: y, pieces, group: null, alive: true,
      hp: 0, maxHp: 0, mat: matIndex, plant: false, bodies: [], burning: false,
      geoW: walls.build(), geoR: roof.build(), beacon, ghost: null,
    };
    b.maxHp = b.hp = 50 + vol / 700;
    this.registerBuilding(b);
    this.tileFor(x, z).buildings.push(b);
    return b;
  }

  // ---- batching: buildings are merged per material into tiles to keep draw calls low ----
  tileFor(x, z) {
    const span = WORLD.block * 2;
    const i = Math.floor((x + WORLD.half) / span), j = Math.floor((z + WORLD.half) / span);
    const k = i * 1000 + j;
    if (!this.tiles.has(k)) this.tiles.set(k, { buildings: [], meshes: [], dirty: true });
    return this.tiles.get(k);
  }

  rebuildTile(t) {
    for (const m of t.meshes) { this.root.remove(m); m.geometry.dispose(); }
    t.meshes = [];
    const byMat = new Map(), roofs = [];
    const keep = [];
    for (const b of t.buildings) {
      if (!b.alive) { b.geoW.dispose(); b.geoR.dispose(); continue; }
      keep.push(b);
      if (b.ghost) continue;
      if (!byMat.has(b.mat)) byMat.set(b.mat, []);
      byMat.get(b.mat).push(b.geoW);
      roofs.push(b.geoR);
    }
    t.buildings = keep;
    const add = (geos, mat) => {
      if (!geos.length) return;
      const m = new THREE.Mesh(mergeGeometries(geos), mat);
      m.castShadow = m.receiveShadow = true;
      this.root.add(m);
      t.meshes.push(m);
    };
    for (const [mi, geos] of byMat) add(geos, this.wallMats[mi]);
    add(roofs, this.roofMat);
    t.dirty = false;
  }

  updateTiles() {
    for (const t of this.tiles.values()) if (t.dirty) this.rebuildTile(t);
  }

  registerBuilding(b) {
    for (const p of b.pieces) b.bodies.push(this.physics.fixedBox(p.x, p.y, p.z, p.hx, p.hy, p.hz));
    this.buildings.push(b);
    const c = this.cell;
    const x0 = Math.floor((b.x - b.hw) / c), x1 = Math.floor((b.x + b.hw) / c);
    const z0 = Math.floor((b.z - b.hd) / c), z1 = Math.floor((b.z + b.hd) / c);
    for (let i = x0; i <= x1; i++) for (let j = z0; j <= z1; j++) {
      const k = i * 10007 + j;
      if (!this.hash.has(k)) this.hash.set(k, []);
      this.hash.get(k).push(b);
    }
  }

  near(x, z, r) {
    const c = this.cell, out = new Set();
    const x0 = Math.floor((x - r) / c), x1 = Math.floor((x + r) / c);
    const z0 = Math.floor((z - r) / c), z1 = Math.floor((z + r) / c);
    for (let i = x0; i <= x1; i++) for (let j = z0; j <= z1; j++) {
      const a = this.hash.get(i * 10007 + j);
      if (a) for (const b of a) if (b.alive) out.add(b);
    }
    return out;
  }

  // Buildings whose footprint overlaps a circle.
  overlapping(x, z, r) {
    const res = [];
    for (const b of this.near(x, z, r)) {
      const dx = Math.max(Math.abs(x - b.x) - b.hw, 0), dz = Math.max(Math.abs(z - b.z) - b.hd, 0);
      if (dx * dx + dz * dz < r * r) res.push(b);
    }
    return res;
  }

  // ---- terrain: the original city is flat; Wasteland overrides these ----
  groundAt() { return 0; }
  terrainBlocks() { return false; }
  rayGround() { return null; }

  // Height of tallest intact building under a point (for pilot standing on roofs etc.)
  heightAt(x, z) {
    let h = this.groundAt(x, z);
    for (const b of this.near(x, z, 1)) {
      for (const p of b.pieces) {
        if (Math.abs(x - p.x) < p.hx && Math.abs(z - p.z) < p.hz) h = Math.max(h, p.y + p.hy);
      }
    }
    return h;
  }

  // Segment vs building boxes. Returns {b, point, t} for the nearest hit, or null.
  raycast(p0, p1) {
    const dx = p1.x - p0.x, dy = p1.y - p0.y, dz = p1.z - p0.z;
    const len = Math.hypot(dx, dz);
    const steps = Math.max(1, Math.ceil(len / this.cell));
    const seen = new Set();
    let best = null;
    for (let s = 0; s <= steps; s++) {
      const t = s / steps;
      for (const b of this.near(p0.x + dx * t, p0.z + dz * t, this.cell * 0.75)) {
        if (seen.has(b)) continue;
        seen.add(b);
        for (const p of b.pieces) {
          const hit = segBox(p0, dx, dy, dz, p);
          if (hit !== null && (!best || hit < best.t)) best = { b, t: hit };
        }
      }
      if (best && best.t < t) break;
    }
    if (best) best.point = new THREE.Vector3(p0.x + dx * best.t, p0.y + dy * best.t, p0.z + dz * best.t);
    return best;
  }

  // All buildings crossing a segment (used to ghost buildings between camera and player).
  occluders(p0, p1) {
    const dx = p1.x - p0.x, dy = p1.y - p0.y, dz = p1.z - p0.z;
    const len = Math.hypot(dx, dz);
    const steps = Math.max(1, Math.ceil(len / (this.cell * 0.5)));
    const out = new Set(), seen = new Set();
    for (let s = 0; s <= steps; s++) {
      const t = s / steps;
      for (const b of this.near(p0.x + dx * t, p0.z + dz * t, this.cell * 0.5)) {
        if (seen.has(b)) continue;
        seen.add(b);
        for (const p of b.pieces) {
          // pad the box a little so the camera never sits right against a wall
          const q = { x: p.x, y: p.y, z: p.z, hx: p.hx + 6, hy: p.hy + 6, hz: p.hz + 6 };
          if (segBox(p0, dx, dy, dz, q) !== null) { out.add(b); break; }
        }
      }
    }
    return out;
  }

  setGhosts(set) {
    for (const b of this.ghosted) {
      if (set.has(b) || !b.ghost) continue;
      this.root.remove(b.ghost);
      b.ghost = null;
      if (b.alive) this.tileFor(b.x, b.z).dirty = true;
    }
    const now = new Set();
    for (const b of set) {
      if (b.plant || !b.alive) continue;
      now.add(b);
      if (b.ghost) continue;
      const g = new THREE.Group();
      g.add(new THREE.Mesh(b.geoW, this.ghostWall[b.mat]), new THREE.Mesh(b.geoR, this.ghostRoof));
      this.root.add(g);
      b.ghost = g;
      this.tileFor(b.x, b.z).dirty = true;
    }
    this.ghosted = now;
    this.updateTiles();
  }

  damage(b, amount, point, dir, opts = {}) {
    if (!b.alive) return;
    if (b.bunker && opts.source !== 'kaiju') return; // only kaiju can hurt a bunker (no friendly fire, no tripod feet)
    b.hp -= amount;
    if (point) {
      if (amount > 8 && Math.random() < 0.6) this.spawnChips(b, point, dir, Math.min(6, 1 + Math.floor(amount / 20)));
      this.fx.dust(point, 0.6 + Math.min(1, amount / 80), 4 + Math.min(10, Math.floor(amount / 10)));
      if (amount > 15) audio.play('crumble', point, 0.7);
    }
    if (b.plant && this.onPlantDamaged) this.onPlantDamaged(b, amount, opts.source);
    if (b.hp <= 0) this.collapse(b, point, dir, opts);
    else if (!b.burning && b.hp < b.maxHp * 0.5 && point && this.fires.length < 24) {
      b.burning = true;
      this.fires.push({ p: point.clone(), t: 25 + Math.random() * 20, b, size: 1 + Math.random() });
    }
  }

  // Damage every building overlapping a sphere (used for stomps, explosions, bodies walking through)
  damageArea(center, radius, amount, opts = {}) {
    for (const b of this.overlapping(center.x, center.z, radius)) {
      if (center.y - radius > b.h) continue;
      const pt = new THREE.Vector3(
        THREE.MathUtils.clamp(center.x, b.x - b.hw, b.x + b.hw),
        Math.min(Math.max(center.y, 2), b.h - 1),
        THREE.MathUtils.clamp(center.z, b.z - b.hd, b.z + b.hd),
      );
      const dir = pt.clone().sub(center).setY(0);
      if (dir.lengthSq() < 0.01) dir.set(Math.random() - 0.5, 0, Math.random() - 0.5);
      dir.normalize();
      this.damage(b, amount, opts.noFx ? null : pt, dir, opts);
    }
  }

  collapse(b, point, dir, opts = {}) {
    if (!b.alive) return;
    b.alive = false;
    if (b.group) {
      this.root.remove(b.group);
      b.group.traverse((o) => { if (o.geometry) o.geometry.dispose(); });
    } else {
      if (b.ghost) { this.root.remove(b.ghost); b.ghost = null; }
      if (b.beacon) { this.root.remove(b.beacon); this.beacons.splice(this.beacons.indexOf(b.beacon), 1); }
      this.tileFor(b.x, b.z).dirty = true;
    }
    for (const body of b.bodies) this.physics.remove(body);
    b.bodies = [];
    this.fires = this.fires.filter((f) => f.b !== b);
    const d = dir ? dir.clone().setY(0).normalize() : new THREE.Vector3(Math.random() - 0.5, 0, Math.random() - 0.5).normalize();
    const force = opts.force ?? 1;
    // chunk budget
    const totalVol = b.pieces.reduce((s, p) => s + p.hx * p.hy * p.hz * 8, 0);
    const budget = b.plant ? 60 : Math.min(110, 20 + Math.floor(totalVol / 1500));
    const chunk = Math.max(6, Math.cbrt(totalVol / budget));
    let made = 0;
    for (const p of b.pieces) {
      const nx = Math.max(1, Math.round((p.hx * 2) / chunk));
      const ny = Math.max(1, Math.round((p.hy * 2) / chunk));
      const nz = Math.max(1, Math.round((p.hz * 2) / chunk));
      const sx = (p.hx * 2) / nx, sy = (p.hy * 2) / ny, sz = (p.hz * 2) / nz;
      const bottom = p.y - p.hy;
      const ground = bottom < 1;
      for (let iy = 0; iy < ny; iy++) {
        // the lowest floors turn to dust so everything above drops and breaks apart
        if (ground && iy < Math.min(2, ny - 1)) continue;
        for (let ix = 0; ix < nx; ix++) for (let iz = 0; iz < nz; iz++) {
          if (made > budget + 8) break;
          // skip some inner chunks so the pile doesn't lock together like Lego
          if (Math.random() < 0.18) continue;
          const cx = p.x - p.hx + sx * (ix + 0.5);
          const cy = bottom + sy * (iy + 0.5);
          const cz = p.z - p.hz + sz * (iz + 0.5);
          const hf = cy / Math.max(20, b.h);
          const out = new THREE.Vector3(cx - b.x, 0, cz - b.z);
          const v = new THREE.Vector3(
            d.x * (10 + 30 * hf) * force + out.x * 0.9 + (Math.random() - 0.5) * 16,
            -6 - Math.random() * 10,
            d.z * (10 + 30 * hf) * force + out.z * 0.9 + (Math.random() - 0.5) * 16,
          );
          this.spawnChunk(b.plant ? -1 : b.mat, cx, cy, cz, sx * 0.46, sy * 0.46, sz * 0.46, v, 3.5);
          made++;
        }
      }
    }
    // dust cloud & rubble pile
    const base = new THREE.Vector3(b.x, 4, b.z);
    const s = Math.min(3, 0.8 + b.h / 70);
    this.fx.dust(base, s, 26);
    this.fx.groundDust(base, Math.max(b.hw, b.hd) * 2.2, 26);
    for (let k = 0; k < 6; k++) this.fx.dust(new THREE.Vector3(b.x + (Math.random() - 0.5) * b.hw * 2, Math.random() * b.h * 0.6, b.z + (Math.random() - 0.5) * b.hd * 2), s * 0.8, 5);
    // rubble mound left behind
    const ph = 3 + Math.min(18, b.h * 0.09);
    const pile = new THREE.Mesh(this.pileGeo, this.rubbleMat);
    pile.scale.set(b.hw * 1.15, ph, b.hd * 1.15);
    pile.position.set(b.x, this.groundAt(b.x, b.z), b.z);
    pile.rotation.y = Math.random() * Math.PI * 2;
    pile.receiveShadow = true; pile.castShadow = true;
    this.root.add(pile);
    audio.play('collapse', base, Math.min(1.2, 0.5 + b.h / 150));
    this.destroyed += b.plant ? 0 : 1;
    if (this.onBuildingDestroyed) this.onBuildingDestroyed(b, opts.source);
  }

  // ---------------- debris (instanced, physics-driven) ----------------
  initDebris() {
    this.unitBox = new THREE.BoxGeometry(1, 1, 1);
    // lumpy low mound for rubble piles (unit radius, unit height)
    const pg = new THREE.ConeGeometry(1, 1, 7, 2);
    pg.translate(0, 0.5, 0);
    const pp = pg.attributes.position;
    for (let i = 0; i < pp.count; i++) {
      const y = pp.getY(i);
      if (y > 0.01 && y < 0.99) { pp.setX(i, pp.getX(i) * (0.8 + Math.random() * 0.5)); pp.setY(i, y * (0.7 + Math.random() * 0.5)); pp.setZ(i, pp.getZ(i) * (0.8 + Math.random() * 0.5)); }
      if (y >= 0.99) pp.setY(i, 0.75);
    }
    pg.computeVertexNormals();
    this.pileGeo = pg;
    const cap = 1400;
    this.debrisCap = cap;
    this.debrisMeshes = [];
    const mats = [...this.wallMats.map((m) => {
      const c = m.clone();
      c.map = m.map.clone(); c.map.repeat.set(0.6, 0.6); c.map.needsUpdate = true;
      c.emissiveMap = m.emissiveMap.clone(); c.emissiveMap.repeat.set(0.6, 0.6); c.emissiveMap.needsUpdate = true;
      c.emissiveIntensity = 0.5;
      return c;
    }), this.concreteMat];
    for (const m of mats) {
      const im = new THREE.InstancedMesh(this.unitBox, m, cap);
      im.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      im.count = 0;
      im.castShadow = true; im.receiveShadow = true;
      im.frustumCulled = false;
      this.root.add(im);
      this.debrisMeshes.push({ im, slots: new Array(cap).fill(null), next: 0, used: 0 });
    }
    this.liveDebris = [];
    this._m = new THREE.Matrix4();
    this._q = new THREE.Quaternion();
    this._s = new THREE.Vector3();
    this._p = new THREE.Vector3();
  }

  spawnChunk(matIndex, x, y, z, hx, hy, hz, vel, spin = 1) {
    const set = this.debrisMeshes[matIndex < 0 ? this.debrisMeshes.length - 1 : matIndex];
    const slot = set.next;
    set.next = (set.next + 1) % this.debrisCap;
    const old = set.slots[slot];
    if (old && old.body) { this.physics.remove(old.body); old.body = null; old.dead = true; }
    const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.random() * 0.2, Math.random() * 6, Math.random() * 0.2));
    const body = this.physics.dynamicBox(x, y, z, hx, hy, hz, { x: q.x, y: q.y, z: q.z, w: q.w });
    body.setLinvel({ x: vel.x, y: vel.y, z: vel.z }, true);
    body.setAngvel({ x: (Math.random() - 0.5) * spin, y: (Math.random() - 0.5) * spin, z: (Math.random() - 0.5) * spin }, true);
    const d = { set, slot, body, t: 0, sx: hx * 2, sy: hy * 2, sz: hz * 2, dead: false };
    set.slots[slot] = d;
    set.used = Math.max(set.used, slot + 1);
    set.im.count = set.used;
    this.liveDebris.push(d);
    this.writeChunk(d, body.translation(), body.rotation());
    return d;
  }

  writeChunk(d, t, r) {
    this._p.set(t.x, t.y, t.z);
    this._q.set(r.x, r.y, r.z, r.w);
    this._s.set(d.sx, d.sy, d.sz);
    this._m.compose(this._p, this._q, this._s);
    d.set.im.setMatrixAt(d.slot, this._m);
    d.set.im.instanceMatrix.needsUpdate = true;
  }

  spawnChips(b, point, dir, n) {
    for (let i = 0; i < n; i++) {
      const s = 1.2 + Math.random() * 2.2;
      const v = new THREE.Vector3((dir?.x ?? 0) * 25 + (Math.random() - 0.5) * 20, 8 + Math.random() * 14, (dir?.z ?? 0) * 25 + (Math.random() - 0.5) * 20);
      this.spawnChunk(b.plant ? -1 : b.mat, point.x - (dir?.x ?? 0) * 2, point.y, point.z - (dir?.z ?? 0) * 2, s, s * 0.7, s, v, 6);
    }
  }

  // Throws loose debris near a point (e.g. a stomp or explosion).
  impulseDebris(center, radius, strength) {
    for (const d of this.liveDebris) {
      if (!d.body) continue;
      const t = d.body.translation();
      const dx = t.x - center.x, dz = t.z - center.z, dy = t.y - center.y;
      const dist = Math.hypot(dx, dy, dz);
      if (dist < radius) {
        const k = (1 - dist / radius) * strength;
        d.body.setLinvel({ x: dx / (dist + 1) * k, y: k * 0.6, z: dz / (dist + 1) * k }, true);
      }
    }
  }

  updateDebris(dt) {
    let live = 0;
    for (let i = this.liveDebris.length - 1; i >= 0; i--) {
      const d = this.liveDebris[i];
      if (d.dead || !d.body) { this.liveDebris.splice(i, 1); continue; }
      d.t += dt;
      const t = d.body.translation();
      this.writeChunk(d, t, d.body.rotation());
      live++;
      // Rapier only sleeps a body once its whole contact pile is at rest,
      // so freezing sleepers never leaves chunks hanging in the air.
      const sleeping = d.body.isSleeping();
      const tooMany = live > 450;
      const expired = d.t > 40;
      if ((sleeping && d.t > 1) || expired || t.y < -20 || tooMany) {
        // freeze in place as static rubble (or hide it if it is still up in the air)
        if ((tooMany || expired) && t.y > Math.max(d.sx, d.sy, d.sz) * 1.5) {
          this._m.makeScale(0, 0, 0);
          d.set.im.setMatrixAt(d.slot, this._m);
          d.set.im.instanceMatrix.needsUpdate = true;
        }
        this.physics.remove(d.body);
        d.body = null;
        this.liveDebris.splice(i, 1);
      }
    }
  }

  // ---------------- power plant ----------------
  makePowerPlant() {
    const x0 = this.cellCenter(6) - WORLD.block / 2, x1 = this.cellCenter(7) + WORLD.block / 2;
    const z0 = this.cellCenter(9) - WORLD.block / 2, z1 = this.cellCenter(10) + WORLD.block / 2;
    const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
    this.plantCenter = new THREE.Vector3(cx, 0, cz);
    const pad = new THREE.Mesh(new THREE.PlaneGeometry(x1 - x0 - WORLD.road, z1 - z0 - WORLD.road), new THREE.MeshStandardMaterial({ color: '#77746d', roughness: 0.95 }));
    pad.rotation.x = -Math.PI / 2;
    pad.position.set(cx, 0.15, cz);
    pad.receiveShadow = true;
    this.root.add(pad);
    // painted markings
    const stripe = new THREE.Mesh(new THREE.RingGeometry(36, 39, 48), new THREE.MeshBasicMaterial({ color: '#e0b020' }));
    stripe.rotation.x = -Math.PI / 2;
    stripe.position.set(cx + 10, 0.25, cz + 5);
    this.root.add(stripe);

    this.plantParts = [];
    const addPart = (group, pieces, hp, name, chunkMat = -1) => {
      this.root.add(group);
      group.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
      const minX = Math.min(...pieces.map((p) => p.x - p.hx)), maxX = Math.max(...pieces.map((p) => p.x + p.hx));
      const minZ = Math.min(...pieces.map((p) => p.z - p.hz)), maxZ = Math.max(...pieces.map((p) => p.z + p.hz));
      const b = {
        id: this.buildings.length, x: (minX + maxX) / 2, z: (minZ + maxZ) / 2, hw: (maxX - minX) / 2, hd: (maxZ - minZ) / 2,
        h: Math.max(...pieces.map((p) => p.y + p.hy)), pieces, group, alive: true, hp, maxHp: hp, mat: chunkMat,
        plant: true, name, bodies: [], burning: false,
      };
      this.registerBuilding(b);
      this.plantParts.push(b);
      return b;
    };

    // Reactor
    {
      const g = new THREE.Group();
      const x = cx + 10, z = cz + 5;
      const base = new THREE.Mesh(new THREE.CylinderGeometry(30, 32, 30, 40), this.concreteMat);
      base.position.set(x, 15, z);
      const dome = new THREE.Mesh(new THREE.SphereGeometry(30, 40, 20, 0, Math.PI * 2, 0, Math.PI / 2), this.concreteMat);
      dome.position.set(x, 30, z);
      const band = new THREE.Mesh(new THREE.CylinderGeometry(30.6, 30.6, 3, 40, 1, true), new THREE.MeshStandardMaterial({ color: '#000', emissive: '#28e0ff', emissiveIntensity: 3 }));
      band.position.set(x, 26, z);
      this.reactorBand = band;
      g.add(base, dome, band);
      const pieces = [{ x, y: 22, z, hx: 26, hy: 22, hz: 26 }];
      this.reactor = addPart(g, pieces, 900, 'Reactor');
    }
    // Cooling towers
    const towerProfile = [];
    for (let i = 0; i <= 12; i++) {
      const t = i / 12;
      const r = 30 - 14 * Math.sin(t * Math.PI * 0.75) + (t > 0.75 ? (t - 0.75) * 8 : 0);
      towerProfile.push(new THREE.Vector2(r, t * 88));
    }
    const towerGeo = new THREE.LatheGeometry(towerProfile, 40);
    const towerMat = new THREE.MeshStandardMaterial({ color: '#d4d0c8', roughness: 0.9, side: THREE.DoubleSide });
    for (const [tx, tz] of [[cx - 62, cz - 50], [cx - 62, cz + 50]]) {
      const g = new THREE.Group();
      const m = new THREE.Mesh(towerGeo, towerMat);
      m.position.set(tx, 0, tz);
      const stripeM = new THREE.Mesh(new THREE.CylinderGeometry(19.8, 20.5, 5, 40, 1, true), new THREE.MeshStandardMaterial({ color: '#b03a2e', roughness: 0.8 }));
      stripeM.position.set(tx, 76, tz);
      g.add(m, stripeM);
      const pieces = [
        { x: tx, y: 22, z: tz, hx: 22, hy: 22, hz: 22 },
        { x: tx, y: 66, z: tz, hx: 16, hy: 22, hz: 16 },
      ];
      const part = addPart(g, pieces, 520, 'Cooling Tower');
      this.steamVents.push({ p: new THREE.Vector3(tx, 90, tz), part });
    }
    // Turbine hall
    {
      const g = new THREE.Group();
      const x = cx + 62, z = cz - 40;
      const hall = new THREE.Mesh(new THREE.BoxGeometry(50, 28, 70), this.plantMetal);
      hall.position.set(x, 14, z);
      const roof = new THREE.Mesh(new THREE.CylinderGeometry(25, 25, 70, 24, 1, false, 0, Math.PI), this.plantMetal);
      roof.rotation.x = Math.PI / 2; roof.rotation.z = Math.PI / 2;
      roof.position.set(x, 28, z);
      const sign = new THREE.Mesh(new THREE.BoxGeometry(1, 6, 40), new THREE.MeshStandardMaterial({ color: '#000', emissive: '#ffcc33', emissiveIntensity: 2 }));
      sign.position.set(x - 25.6, 20, z);
      g.add(hall, roof, sign);
      addPart(g, [{ x, y: 20, z, hx: 25, hy: 20, hz: 35 }], 480, 'Turbine Hall');
    }
    // Smokestacks
    for (const [sx, sz] of [[cx + 55, cz + 55], [cx + 75, cz + 62]]) {
      const g = new THREE.Group();
      const h = 125;
      const stack = new THREE.Mesh(new THREE.CylinderGeometry(3.5, 5.5, h, 16), this.concreteMat);
      stack.position.set(sx, h / 2, sz);
      g.add(stack);
      for (const yy of [h - 6, h - 22]) {
        const st = new THREE.Mesh(new THREE.CylinderGeometry(3.7, 3.9, 6, 16), new THREE.MeshStandardMaterial({ color: '#c0302a' }));
        st.position.set(sx, yy, sz);
        g.add(st);
      }
      const bc = new THREE.Mesh(new THREE.SphereGeometry(1.6, 8, 6), this.beaconMat);
      bc.position.set(sx, h + 1, sz);
      g.add(bc);
      this.beacons.push(bc);
      addPart(g, [{ x: sx, y: h / 2, z: sz, hx: 5, hy: h / 2, hz: 5 }], 160, 'Smokestack');
      this.steamVents.push({ p: new THREE.Vector3(sx, h, sz), part: null, smoke: true });
    }
    // Transformer yard
    {
      const g = new THREE.Group();
      const x = cx - 5, z = cz + 75;
      for (let i = 0; i < 4; i++) for (let j = 0; j < 2; j++) {
        const t = new THREE.Mesh(new THREE.BoxGeometry(8, 9, 8), this.plantMetal);
        t.position.set(x - 24 + i * 16, 4.5, z - 8 + j * 16);
        g.add(t);
        const coil = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 6, 8), new THREE.MeshStandardMaterial({ color: '#a05a30' }));
        coil.position.set(x - 24 + i * 16, 12, z - 8 + j * 16);
        g.add(coil);
      }
      addPart(g, [{ x, y: 7, z, hx: 32, hy: 7, hz: 16 }], 200, 'Transformers');
    }
    // Power pylons heading out of the plant (decorative)
    const pylonMat = new THREE.MeshStandardMaterial({ color: '#555b62', metalness: 0.7, roughness: 0.4 });
    const pylonGeo = mergeGeometries([
      new THREE.CylinderGeometry(0.8, 3.5, 50, 4).translate(0, 25, 0),
      new THREE.BoxGeometry(22, 1, 1).translate(0, 44, 0),
      new THREE.BoxGeometry(16, 1, 1).translate(0, 36, 0),
    ]);
    for (let k = 0; k < 6; k++) {
      const p = new THREE.Mesh(pylonGeo, pylonMat);
      p.position.set(cx + 140 + k * 110, 0, cz + 120);
      p.castShadow = true;
      this.root.add(p);
    }
  }

  plantIntegrity() {
    let hp = 0, max = 0;
    for (const p of this.plantParts) { max += p.maxHp; hp += Math.max(0, p.alive ? p.hp : 0); }
    return max ? hp / max : 0;
  }

  // ---------------- decor ----------------
  makeDecor() {
    const r = this.rng;
    // Trees in parks
    const trunk = new THREE.CylinderGeometry(0.6, 0.8, 5, 5).translate(0, 2.5, 0);
    const crown = new THREE.IcosahedronGeometry(4.5, 0).translate(0, 8, 0);
    const treeGeo = mergeGeometries([trunk.toNonIndexed(), crown.index ? crown.toNonIndexed() : crown]);
    const treeMat = new THREE.MeshStandardMaterial({ color: '#2f5a2a', roughness: 1, flatShading: true });
    const parkMat = new THREE.MeshStandardMaterial({ color: '#3f6a34', roughness: 1 });
    const lotSize = WORLD.block - WORLD.road - 8;
    const trees = [];
    for (const [cx, cz] of this.parkCells) {
      const g = new THREE.Mesh(new THREE.PlaneGeometry(lotSize, lotSize), parkMat);
      g.rotation.x = -Math.PI / 2; g.position.set(cx, 0.2, cz); g.receiveShadow = true;
      this.root.add(g);
      for (let k = 0; k < 22; k++) trees.push([cx + (r() - 0.5) * lotSize * 0.9, cz + (r() - 0.5) * lotSize * 0.9, 0.7 + r() * 0.8]);
    }
    // trees along the shore and outskirts
    for (let k = 0; k < 400; k++) {
      const a = r() * Math.PI * 2, d = WORLD.half + 60 + r() * 600;
      const x = Math.cos(a) * d, z = Math.sin(a) * d;
      if (z < this.waterEdge + 10) continue;
      trees.push([x, z, 1 + r() * 1.5]);
    }
    const tm = new THREE.InstancedMesh(treeGeo, treeMat, trees.length);
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3();
    trees.forEach(([x, z, sc], i) => {
      q.setFromEuler(new THREE.Euler(0, r() * 6, 0));
      m.compose(p.set(x, 0, z), q, s.set(sc, sc, sc));
      tm.setMatrixAt(i, m);
    });
    tm.castShadow = true; tm.receiveShadow = true;
    this.root.add(tm);
    this.trees = tm;

    // Cars parked along roads
    const carGeo = mergeGeometries([
      new THREE.BoxGeometry(4.4, 1.3, 2).translate(0, 0.9, 0),
      new THREE.BoxGeometry(2.4, 1, 1.8).translate(-0.2, 2, 0),
    ]);
    const carMat = new THREE.MeshStandardMaterial({ roughness: 0.4, metalness: 0.6 });
    const nCars = 900;
    const cars = new THREE.InstancedMesh(carGeo, carMat, nCars);
    const col = new THREE.Color();
    const carColors = ['#b8202a', '#2c5aa0', '#e8e8e8', '#202020', '#e0a21b', '#7a8796', '#2e8b57'];
    this.carData = [];
    for (let i = 0; i < nCars; i++) {
      const horiz = r() < 0.5;
      const line = Math.floor(r() * (WORLD.grid + 1));
      const along = -WORLD.half + r() * WORLD.half * 2;
      const lane = (r() < 0.5 ? -1 : 1) * (3 + r() * 6);
      const roadPos = -WORLD.half + line * WORLD.block + lane;
      const x = horiz ? along : roadPos, z = horiz ? roadPos : along;
      q.setFromEuler(new THREE.Euler(0, horiz ? 0 : Math.PI / 2, 0));
      m.compose(p.set(x, 0, z), q, s.set(1, 1, 1));
      cars.setMatrixAt(i, m);
      cars.setColorAt(i, col.set(carColors[Math.floor(r() * carColors.length)]));
      this.carData.push({ x, z, alive: true });
    }
    cars.castShadow = true;
    this.root.add(cars);
    this.cars = cars;

    // Street lamps (glowing heads)
    const lampGeo = new THREE.CylinderGeometry(0.25, 0.3, 10, 5).translate(0, 5, 0);
    const lamps = new THREE.InstancedMesh(lampGeo, this.detailMat, 500);
    const headMat = new THREE.MeshBasicMaterial({ color: '#ffd9a0' });
    const heads = new THREE.InstancedMesh(new THREE.SphereGeometry(0.7, 6, 4), headMat, 500);
    let n = 0;
    for (let i = 0; i <= WORLD.grid && n < 500; i++) {
      for (let j = 0; j < WORLD.grid && n < 496; j++) {
        const a = -WORLD.half + i * WORLD.block;
        const b = -WORLD.half + (j + 0.5) * WORLD.block;
        for (const [x, z] of [[a + 11, b], [b, a + 11]]) {
          if (n >= 500) break;
          m.compose(p.set(x, 0, z), q.identity(), s.set(1, 1, 1));
          lamps.setMatrixAt(n, m);
          m.compose(p.set(x, 10, z), q, s);
          heads.setMatrixAt(n, m);
          n++;
        }
      }
    }
    lamps.count = heads.count = n;
    this.root.add(lamps, heads);
  }

  // Squash cars near a point (characters walking over them)
  crushCars(x, z, r) {
    const m = new THREE.Matrix4();
    let crushed = 0;
    for (let i = 0; i < this.carData.length; i++) {
      const c = this.carData[i];
      if (!c.alive) continue;
      if (Math.abs(c.x - x) < r && Math.abs(c.z - z) < r && (c.x - x) ** 2 + (c.z - z) ** 2 < r * r) {
        c.alive = false;
        this.cars.getMatrixAt(i, m);
        const p = new THREE.Vector3(), q = new THREE.Quaternion(), s = new THREE.Vector3();
        m.decompose(p, q, s);
        s.set(1.2, 0.25, 1.3);
        m.compose(p, q, s);
        this.cars.setMatrixAt(i, m);
        this.cars.instanceMatrix.needsUpdate = true;
        crushed++;
      }
    }
    return crushed;
  }

  makeMountains() {
    const mat = new THREE.MeshStandardMaterial({ color: '#3a3550', roughness: 1, flatShading: true });
    const r = this.rng;
    const geos = [];
    for (let k = 0; k < 40; k++) {
      const a = (k / 40) * Math.PI * 2 + r() * 0.1;
      const d = 3000 + r() * 800;
      const h = 180 + r() * 420;
      const g = new THREE.ConeGeometry(300 + r() * 400, h, 6 + Math.floor(r() * 3));
      g.translate(Math.cos(a) * d, h / 2 - 20, Math.sin(a) * d);
      geos.push(g.toNonIndexed());
    }
    this.root.add(new THREE.Mesh(mergeGeometries(geos), mat));
  }

  // ---------------- per-frame ----------------
  update(dt, time) {
    this.updateTiles();
    this.updateDebris(dt);
    if (this.waterNormal) this.waterNormal.offset.set(time * 0.004, time * 0.006);
    for (let i = this.fires.length - 1; i >= 0; i--) {
      const f = this.fires[i];
      f.t -= dt;
      if (f.t <= 0) { this.fires.splice(i, 1); continue; }
      if (Math.random() < 0.6) this.fx.fire(f.p, f.size * 1.4);
    }
    for (const v of this.steamVents) {
      if (v.part && !v.part.alive) continue;
      if (Math.random() < (v.smoke ? 0.15 : 0.5)) this.fx.steam(v.p, v.smoke ? 0.35 : 1);
    }
    const blink = (Math.sin(time * 3) > 0.6);
    for (const b of this.beacons) b.visible = blink;
    if (this.reactorBand && this.reactor.alive) this.reactorBand.material.emissiveIntensity = 2.5 + Math.sin(time * 2) * 0.8;
  }
}

// Segment (p0 + t*d) vs axis-aligned box piece. Returns t in [0,1] or null.
function segBox(p0, dx, dy, dz, p) {
  let tmin = 0, tmax = 1;
  const o = [p0.x, p0.y, p0.z], d = [dx, dy, dz];
  const mn = [p.x - p.hx, p.y - p.hy, p.z - p.hz], mx = [p.x + p.hx, p.y + p.hy, p.z + p.hz];
  for (let a = 0; a < 3; a++) {
    if (Math.abs(d[a]) < 1e-8) {
      if (o[a] < mn[a] || o[a] > mx[a]) return null;
    } else {
      let t1 = (mn[a] - o[a]) / d[a], t2 = (mx[a] - o[a]) / d[a];
      if (t1 > t2) [t1, t2] = [t2, t1];
      tmin = Math.max(tmin, t1); tmax = Math.min(tmax, t2);
      if (tmin > tmax) return null;
    }
  }
  return tmin;
}

