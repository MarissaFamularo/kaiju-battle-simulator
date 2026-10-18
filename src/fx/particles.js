import * as THREE from 'three';

// CPU-simulated GPU-drawn point particles. Two pools: additive glow (fire, sparks)
// and normal-blended smoke/dust.

const vert = /* glsl */`
  attribute float aSize;
  attribute vec4 aColor;
  varying vec4 vColor;
  uniform float uScale;
  void main() {
    vColor = aColor;
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = aSize * uScale / max(1.0, -mv.z);
    gl_Position = projectionMatrix * mv;
  }
`;
const frag = /* glsl */`
  varying vec4 vColor;
  uniform float uSoft;
  void main() {
    vec2 p = gl_PointCoord - 0.5;
    float d = length(p) * 2.0;
    if (d > 1.0) discard;
    float a = pow(1.0 - d, uSoft);
    gl_FragColor = vec4(vColor.rgb, vColor.a * a);
  }
`;

class Pool {
  constructor(scene, max, additive) {
    this.max = max;
    this.count = 0;
    this.pos = new Float32Array(max * 3);
    this.col = new Float32Array(max * 4);
    this.size = new Float32Array(max);
    this.vel = new Float32Array(max * 3);
    this.life = new Float32Array(max);
    this.maxLife = new Float32Array(max);
    this.s0 = new Float32Array(max);
    this.s1 = new Float32Array(max);
    this.c0 = new Float32Array(max * 3);
    this.c1 = new Float32Array(max * 3);
    this.a0 = new Float32Array(max);
    this.grav = new Float32Array(max);
    this.drag = new Float32Array(max);
    const geo = new THREE.BufferGeometry();
    this.pa = new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage);
    this.ca = new THREE.BufferAttribute(this.col, 4).setUsage(THREE.DynamicDrawUsage);
    this.sa = new THREE.BufferAttribute(this.size, 1).setUsage(THREE.DynamicDrawUsage);
    geo.setAttribute('position', this.pa);
    geo.setAttribute('aColor', this.ca);
    geo.setAttribute('aSize', this.sa);
    geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e6);
    this.mat = new THREE.ShaderMaterial({
      vertexShader: vert, fragmentShader: frag,
      uniforms: { uScale: { value: 600 }, uSoft: { value: additive ? 1.6 : 1.1 } },
      transparent: true, depthWrite: false,
      blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
    });
    this.points = new THREE.Points(geo, this.mat);
    this.points.frustumCulled = false;
    this.points.renderOrder = additive ? 11 : 10;
    scene.add(this.points);
  }

  spawn(p, v, life, s0, s1, c0, c1, alpha, grav, drag) {
    let i;
    if (this.count < this.max) i = this.count++;
    else i = Math.floor(Math.random() * this.max);
    this.pos[i * 3] = p.x; this.pos[i * 3 + 1] = p.y; this.pos[i * 3 + 2] = p.z;
    this.vel[i * 3] = v.x; this.vel[i * 3 + 1] = v.y; this.vel[i * 3 + 2] = v.z;
    this.life[i] = life; this.maxLife[i] = life;
    this.s0[i] = s0; this.s1[i] = s1;
    this.c0[i * 3] = c0.r; this.c0[i * 3 + 1] = c0.g; this.c0[i * 3 + 2] = c0.b;
    this.c1[i * 3] = c1.r; this.c1[i * 3 + 1] = c1.g; this.c1[i * 3 + 2] = c1.b;
    this.a0[i] = alpha; this.grav[i] = grav; this.drag[i] = drag;
  }

  update(dt) {
    let i = 0;
    while (i < this.count) {
      this.life[i] -= dt;
      if (this.life[i] <= 0) {
        // swap-remove with last live particle
        const last = --this.count;
        if (i !== last) this.copy(last, i);
        continue;
      }
      const t = 1 - this.life[i] / this.maxLife[i];
      const dr = Math.max(0, 1 - this.drag[i] * dt);
      this.vel[i * 3] *= dr; this.vel[i * 3 + 2] *= dr;
      this.vel[i * 3 + 1] = this.vel[i * 3 + 1] * dr + this.grav[i] * dt;
      this.pos[i * 3] += this.vel[i * 3] * dt;
      this.pos[i * 3 + 1] += this.vel[i * 3 + 1] * dt;
      this.pos[i * 3 + 2] += this.vel[i * 3 + 2] * dt;
      if (this.pos[i * 3 + 1] < 0.3) { this.pos[i * 3 + 1] = 0.3; this.vel[i * 3 + 1] *= -0.2; }
      this.size[i] = this.s0[i] + (this.s1[i] - this.s0[i]) * t;
      for (let k = 0; k < 3; k++) this.col[i * 4 + k] = this.c0[i * 3 + k] + (this.c1[i * 3 + k] - this.c0[i * 3 + k]) * t;
      const fadeIn = Math.min(1, t * 8);
      this.col[i * 4 + 3] = this.a0[i] * fadeIn * (1 - t) ** 1.2;
      i++;
    }
    this.points.geometry.setDrawRange(0, this.count);
    this.pa.needsUpdate = this.ca.needsUpdate = this.sa.needsUpdate = true;
  }

  copy(from, to) {
    const arr3 = [this.pos, this.vel, this.c0, this.c1];
    for (const a of arr3) { a[to * 3] = a[from * 3]; a[to * 3 + 1] = a[from * 3 + 1]; a[to * 3 + 2] = a[from * 3 + 2]; }
    for (let k = 0; k < 4; k++) this.col[to * 4 + k] = this.col[from * 4 + k];
    const arr1 = [this.size, this.life, this.maxLife, this.s0, this.s1, this.a0, this.grav, this.drag];
    for (const a of arr1) a[to] = a[from];
  }

  clear() { this.count = 0; }
}

const _v = new THREE.Vector3();
const _p = new THREE.Vector3();
const _r = new THREE.Vector3();
const C = (hex) => new THREE.Color(hex);
const COL = {
  fireA: C('#fff2b0'), fireB: C('#ff5a10'), fireC: C('#5a1a08'),
  smokeA: C('#3a3634'), smokeB: C('#1a1918'),
  dustA: C('#9a8f80'), dustB: C('#6f675e'),
  spark: C('#ffd27a'), sparkB: C('#ff6020'),
  blueA: C('#9ff8ff'), blueB: C('#1aa6ff'),
  goo: C('#4dff9a'), gooB: C('#0a6e3a'),
  white: C('#ffffff'), steamB: C('#c9ced6'),
};

export class Particles {
  constructor(scene) {
    this.add = new Pool(scene, 6000, true);
    this.alpha = new Pool(scene, 5000, false);
    this.scene = scene;
    this.rings = [];
    this.flashes = [];
    // shockwave ring resources
    this.ringGeo = new THREE.RingGeometry(0.8, 1, 48);
    this.ringGeo.rotateX(-Math.PI / 2);
    // pool of flash lights
    for (let i = 0; i < 4; i++) {
      const l = new THREE.PointLight('#ff9040', 0, 300, 1.5);
      l.userData.t = 0;
      scene.add(l);
      this.flashes.push(l);
    }
  }

  setScale(h) { this.add.mat.uniforms.uScale.value = h; this.alpha.mat.uniforms.uScale.value = h; }

  update(dt) {
    this.add.update(dt);
    this.alpha.update(dt);
    for (let i = this.rings.length - 1; i >= 0; i--) {
      const r = this.rings[i];
      r.userData.t += dt;
      const k = r.userData.t / r.userData.dur;
      if (k >= 1) { this.scene.remove(r); r.material.dispose(); this.rings.splice(i, 1); continue; }
      const s = r.userData.r0 + (r.userData.r1 - r.userData.r0) * (1 - (1 - k) ** 3);
      r.scale.setScalar(s);
      r.material.opacity = r.userData.a * (1 - k);
    }
    for (const l of this.flashes) {
      if (l.userData.t > 0) {
        l.userData.t -= dt;
        l.intensity = Math.max(0, l.userData.t / l.userData.dur) * l.userData.i;
      } else l.intensity = 0;
    }
  }

  flash(pos, color = '#ff9040', intensity = 3000, dur = 0.4) {
    let best = this.flashes[0];
    for (const l of this.flashes) if (l.userData.t < best.userData.t) best = l;
    best.position.copy(pos);
    best.color.set(color);
    best.userData.t = dur; best.userData.dur = dur; best.userData.i = intensity;
    best.distance = 400;
  }

  ring(pos, r0, r1, dur = 0.8, color = '#ffffff', a = 0.6) {
    const m = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: a, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending });
    const mesh = new THREE.Mesh(this.ringGeo, m);
    mesh.position.copy(pos);
    mesh.position.y = Math.max(pos.y, 0.6);
    mesh.userData = { t: 0, dur, r0, r1, a };
    this.scene.add(mesh);
    this.rings.push(mesh);
  }

  rv(scale) { return _r.set(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).normalize().multiplyScalar(scale * (0.3 + Math.random() * 0.7)); }

  explosion(pos, size = 1) {
    const s = size;
    for (let i = 0; i < 40 * Math.min(2, s); i++) {
      _p.copy(pos).add(this.rv(4 * s));
      this.add.spawn(_p, this.rv(40 * s).add(_v.set(0, 10 * s, 0)), 0.5 + Math.random() * 0.6, 14 * s, 40 * s, COL.fireA, COL.fireB, 1, 8, 2.5);
    }
    for (let i = 0; i < 30 * Math.min(2, s); i++) {
      _p.copy(pos).add(this.rv(6 * s));
      this.alpha.spawn(_p, this.rv(18 * s).add(_v.set(0, 12 * s, 0)), 2 + Math.random() * 2, 20 * s, 70 * s, COL.smokeA, COL.smokeB, 0.7, 2, 1.0);
    }
    for (let i = 0; i < 30 * Math.min(2, s); i++) {
      this.add.spawn(pos, this.rv(90 * s).add(_v.set(0, 30 * s, 0)), 0.6 + Math.random() * 0.8, 3 * s, 1, COL.spark, COL.sparkB, 1, -60, 0.5);
    }
    this.flash(pos, '#ff8a3a', 4000 * s, 0.5);
  }

  sparks(pos, n = 18, color = 'spark') {
    const c0 = color === 'blue' ? COL.blueA : COL.spark;
    const c1 = color === 'blue' ? COL.blueB : COL.sparkB;
    for (let i = 0; i < n; i++) {
      this.add.spawn(pos, this.rv(70).add(_v.set(0, 15, 0)), 0.3 + Math.random() * 0.4, 4, 0.5, c0, c1, 1, -50, 1.2);
    }
  }

  dust(pos, size = 1, n = 20) {
    for (let i = 0; i < n; i++) {
      _p.copy(pos).add(this.rv(8 * size));
      _p.y = Math.max(1, _p.y);
      const v = this.rv(14 * size); v.y = Math.abs(v.y) * 0.6 + 3;
      this.alpha.spawn(_p, v, 2.5 + Math.random() * 2.5, 18 * size, 60 * size, COL.dustA, COL.dustB, 0.55, 0.5, 0.7);
    }
  }

  groundDust(pos, radius, n = 30) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      _p.set(pos.x + Math.cos(a) * radius * 0.3, 2, pos.z + Math.sin(a) * radius * 0.3);
      _v.set(Math.cos(a), 0.15, Math.sin(a)).multiplyScalar(radius * (0.8 + Math.random() * 0.8));
      this.alpha.spawn(_p, _v, 1.8 + Math.random(), 16, 50, COL.dustA, COL.dustB, 0.5, 1, 1.5);
    }
  }

  blood(pos, dir, weak = false) {
    for (let i = 0; i < (weak ? 50 : 22); i++) {
      const v = this.rv(50); if (dir) v.addScaledVector(dir, 30);
      v.y += 15;
      this.add.spawn(pos, v, 0.8 + Math.random() * 0.8, weak ? 8 : 5, 2, COL.blueA, COL.blueB, 1, -40, 0.6);
    }
    for (let i = 0; i < 8; i++) {
      this.alpha.spawn(pos, this.rv(10), 1.5, 12, 30, COL.blueB, COL.smokeB, 0.4, 0, 1);
    }
  }

  smokeTrail(pos, size = 1) {
    this.alpha.spawn(pos, this.rv(3), 1.2 + Math.random(), 4 * size, 16 * size, COL.smokeA, COL.smokeB, 0.5, 2, 0.5);
  }

  fire(pos, size = 1) {
    _p.copy(pos).add(this.rv(3 * size));
    this.add.spawn(_p, _v.set((Math.random() - 0.5) * 4, 10 + Math.random() * 10, (Math.random() - 0.5) * 4), 0.6 + Math.random() * 0.5, 10 * size, 3 * size, COL.fireA, COL.fireB, 0.9, 5, 0.5);
    if (Math.random() < 0.4) this.alpha.spawn(_p.add(_v.set(0, 6 * size, 0)), _v.set(Math.random() * 4, 8 + Math.random() * 6, Math.random() * 4), 2.5, 10 * size, 40 * size, COL.smokeA, COL.smokeB, 0.45, 1, 0.2);
  }

  steam(pos, size = 1) {
    _p.copy(pos).add(this.rv(8 * size));
    this.alpha.spawn(_p, _v.set(2 + Math.random() * 3, 6 + Math.random() * 4, Math.random() * 2), 6, 20 * size, 70 * size, COL.white, COL.steamB, 0.35, 0.3, 0.05);
  }

  glow(pos, color, size, life = 0.15, vel = null) {
    const c = color.isColor ? color : C(color);
    this.add.spawn(pos, vel || _v.set(0, 0, 0), life, size, size * 0.4, c, c, 1, 0, 0);
  }

  trail(pos, color, size = 6) {
    const c = color.isColor ? color : C(color);
    this.add.spawn(pos, this.rv(2), 0.35, size, 0.5, c, COL.white, 0.8, 0, 2);
  }

  acid(pos) {
    this.add.spawn(pos, this.rv(4), 0.4, 10, 2, COL.goo, COL.gooB, 1, 0, 1);
  }

  clear() { this.add.clear(); this.alpha.clear(); }
}
