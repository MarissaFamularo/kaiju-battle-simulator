import * as THREE from 'three';
import { buildMech } from '../entities/mechModel.js';
import { buildCarrier } from '../entities/drones.js';
import { Particles } from '../fx/particles.js';
import { audio } from '../audio.js';

const $ = (id) => document.getElementById(id);

const planetVert = `
  varying vec3 vN; varying vec3 vW; varying vec3 vObj;
  void main(){ vObj = normalize(position); vN = normalize(mat3(modelMatrix) * normal); vec4 w = modelMatrix * vec4(position,1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`;
const planetFrag = `
  uniform vec3 uSun; uniform float uTime; varying vec3 vN; varying vec3 vW; varying vec3 vObj;
  float h(vec3 p){ p = fract(p*0.3183099+0.1); p*=17.0; return fract(p.x*p.y*p.z*(p.x+p.y+p.z)); }
  float n(vec3 x){ vec3 i=floor(x); vec3 f=fract(x); f=f*f*(3.0-2.0*f);
    return mix(mix(mix(h(i),h(i+vec3(1,0,0)),f.x),mix(h(i+vec3(0,1,0)),h(i+vec3(1,1,0)),f.x),f.y),
               mix(mix(h(i+vec3(0,0,1)),h(i+vec3(1,0,1)),f.x),mix(h(i+vec3(0,1,1)),h(i+vec3(1,1,1)),f.x),f.y),f.z); }
  float fbm(vec3 p){ float a=0.5, s=0.0; for(int i=0;i<6;i++){ s+=a*n(p); p*=2.03; a*=0.5; } return s; }
  void main(){
    vec3 p = vObj * 3.0;
    float land = fbm(p);
    vec3 ocean = mix(vec3(0.02,0.08,0.2), vec3(0.03,0.18,0.35), fbm(p*4.0));
    vec3 ground = mix(vec3(0.12,0.25,0.08), vec3(0.35,0.3,0.18), fbm(p*6.0));
    vec3 col = land > 0.52 ? ground : ocean;
    float cl = smoothstep(0.55, 0.75, fbm(vObj*5.0 + vec3(uTime*0.01,0.0,0.0)));
    col = mix(col, vec3(0.95), cl*0.85);
    float d = max(0.0, dot(normalize(vN), uSun));
    vec3 lit = col * (0.05 + d*1.3);
    // city lights on night side
    float night = smoothstep(0.15, -0.1, dot(normalize(vN), uSun));
    float cityL = step(0.985, h(floor(vObj*900.0))) * step(0.52, land) * (1.0-cl);
    lit += vec3(1.0,0.75,0.4) * cityL * night * 1.5;
    gl_FragColor = vec4(lit, 1.0);
    #include <colorspace_fragment>
  }`;
const atmoFrag = `
  uniform vec3 uSun; varying vec3 vN; varying vec3 vW;
  void main(){
    vec3 v = normalize(cameraPosition - vW);
    float f = pow(1.0 - abs(dot(v, normalize(vN))), 3.0);
    float d = max(0.15, dot(normalize(vN), uSun) + 0.4);
    gl_FragColor = vec4(vec3(0.3,0.6,1.0) * f * d * 1.6, f);
  }`;

export class DropScene {
  constructor(app) {
    this.app = app;
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color('#000000');
    this.camera = new THREE.PerspectiveCamera(50, 1, 1, 30000);
    this.fx = new Particles(this.scene);
    const s = this.scene;
    const sunDir = new THREE.Vector3(0.6, 0.35, 0.7).normalize();
    this.sunDir = sunDir;
    s.add(new THREE.AmbientLight('#334466', 0.6));
    const sun = new THREE.DirectionalLight('#fff4e0', 2.2);
    sun.position.copy(sunDir).multiplyScalar(1000);
    s.add(sun);
    // stars
    const n = 4000, pos = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      const v = new THREE.Vector3().randomDirection().multiplyScalar(15000);
      pos.set([v.x, v.y, v.z], i * 3);
    }
    const sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    this.stars = new THREE.Points(sg, new THREE.PointsMaterial({ color: '#ffffff', size: 2, sizeAttenuation: false }));
    s.add(this.stars);
    // planet
    this.planetMat = new THREE.ShaderMaterial({ vertexShader: planetVert, fragmentShader: planetFrag, uniforms: { uSun: { value: sunDir }, uTime: { value: 0 } } });
    this.planet = new THREE.Mesh(new THREE.SphereGeometry(5600, 96, 64), this.planetMat);
    this.planet.position.set(0, -6500, 0);
    s.add(this.planet);
    const atmo = new THREE.Mesh(new THREE.SphereGeometry(5800, 96, 64), new THREE.ShaderMaterial({
      vertexShader: planetVert, fragmentShader: atmoFrag, uniforms: { uSun: { value: sunDir } },
      transparent: true, blending: THREE.AdditiveBlending, depthWrite: false,
    }));
    atmo.position.copy(this.planet.position);
    s.add(atmo);
    this.atmo = atmo;
    this.buildStation();
    // entry sky (inside atmosphere)
    this.entrySky = new THREE.Mesh(new THREE.SphereGeometry(8000, 32, 16), new THREE.ShaderMaterial({
      side: THREE.BackSide, depthWrite: false, transparent: true,
      uniforms: { uK: { value: 0 } },
      vertexShader: 'varying vec3 vD; void main(){ vD = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
      fragmentShader: `uniform float uK; varying vec3 vD; void main(){
        vec3 top = vec3(0.01,0.01,0.05); vec3 mid = vec3(0.35,0.08,0.05); vec3 bot = vec3(0.9,0.28,0.05);
        vec3 c = mix(bot, mid, smoothstep(-0.9, -0.2, vD.y));
        c = mix(c, top, smoothstep(-0.2, 0.5, vD.y));
        gl_FragColor = vec4(c, uK);
        #include <colorspace_fragment>
      }`,
    }));
    this.entrySky.visible = false;
    s.add(this.entrySky);
    // plasma shell
    this.plasma = new THREE.Mesh(new THREE.SphereGeometry(1, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.ShaderMaterial({
      transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide,
      uniforms: { uT: { value: 0 }, uK: { value: 0 } },
      vertexShader: 'varying vec3 vP; varying vec3 vN; varying vec3 vW; void main(){ vP = position; vN = normalize(mat3(modelMatrix)*normal); vec4 w = modelMatrix*vec4(position,1.0); vW = w.xyz; gl_Position = projectionMatrix*viewMatrix*w; }',
      fragmentShader: `uniform float uT, uK; varying vec3 vP; varying vec3 vN; varying vec3 vW;
        float h(vec2 p){ return fract(sin(dot(p, vec2(12.9898,78.233)))*43758.5453); }
        void main(){
          float stripes = h(floor(vec2(atan(vP.z, vP.x)*12.0, vP.y*6.0 - uT*30.0)));
          float edge = 1.0 - vP.y;
          vec3 v = normalize(cameraPosition - vW);
          float rim = pow(1.0 - abs(dot(v, vN)), 1.5);
          float a = uK * (0.35 + rim*0.9) * (0.6 + stripes*0.5) * edge;
          vec3 c = mix(vec3(1.0,0.45,0.1), vec3(1.0,0.95,0.7), rim);
          gl_FragColor = vec4(c*2.2, a);
        }`,
    }));
    this.plasma.rotation.x = Math.PI; // dome facing down (the direction of travel)
    this.plasma.scale.set(48, 80, 48);
    this.plasma.visible = false;
    s.add(this.plasma);
  }

  buildStation() {
    const st = new THREE.Group();
    const white = new THREE.MeshStandardMaterial({ color: '#cfd6de', metalness: 0.6, roughness: 0.4 });
    const dark = new THREE.MeshStandardMaterial({ color: '#2a2f36', metalness: 0.7, roughness: 0.4 });
    const panel = new THREE.MeshStandardMaterial({ color: '#1b3a7a', metalness: 0.9, roughness: 0.25, emissive: '#081a40', emissiveIntensity: 0.5 });
    const lights = new THREE.MeshStandardMaterial({ color: '#000', emissive: '#ffd890', emissiveIntensity: 3 });
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(32, 32, 120, 24), white);
    st.add(hub);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(170, 14, 16, 64), white);
    ring.rotation.x = Math.PI / 2;
    const ringG = new THREE.Group(); ringG.add(ring);
    for (let i = 0; i < 4; i++) {
      const sp = new THREE.Mesh(new THREE.BoxGeometry(170, 6, 6), dark);
      sp.position.x = 85; const g = new THREE.Group(); g.rotation.y = (i / 4) * Math.PI * 2; g.add(sp); ringG.add(g);
    }
    for (let i = 0; i < 48; i++) {
      const w = new THREE.Mesh(new THREE.BoxGeometry(4, 3, 1), lights);
      const a = (i / 48) * Math.PI * 2;
      w.position.set(Math.cos(a) * 184.5, 0, Math.sin(a) * 184.5);
      w.lookAt(0, 0, 0);
      ringG.add(w);
    }
    st.add(ringG);
    this.ring = ringG;
    for (const s of [-1, 1]) {
      const arm = new THREE.Mesh(new THREE.BoxGeometry(260, 4, 4), dark);
      arm.position.set(s * 130 + s * 160, 40, 0);
      st.add(arm);
      for (let k = 0; k < 4; k++) {
        const p = new THREE.Mesh(new THREE.BoxGeometry(50, 1, 70), panel);
        p.position.set(s * (200 + k * 58), 40, 0);
        st.add(p);
      }
    }
    // deployment bay under the hub
    const bay = new THREE.Mesh(new THREE.BoxGeometry(90, 50, 120), white);
    bay.position.set(0, -80, 0);
    st.add(bay);
    const bayGlow = new THREE.Mesh(new THREE.BoxGeometry(70, 2, 100), new THREE.MeshStandardMaterial({ color: '#000', emissive: '#ffb030', emissiveIntensity: 3 }));
    bayGlow.position.set(0, -106, 0);
    st.add(bayGlow);
    const name = document.createElement('canvas'); name.width = 512; name.height = 128;
    const g = name.getContext('2d');
    g.fillStyle = '#cfd6de'; g.fillRect(0, 0, 512, 128);
    g.font = '900 72px Orbitron, sans-serif'; g.fillStyle = '#b8202a'; g.textAlign = 'center'; g.fillText('AEGIS', 256, 95);
    const t = new THREE.CanvasTexture(name); t.colorSpace = THREE.SRGBColorSpace;
    const label = new THREE.Mesh(new THREE.PlaneGeometry(60, 15), new THREE.MeshStandardMaterial({ map: t }));
    label.position.set(0, -70, 60.5);
    st.add(label);
    this.blinkers = [];
    for (const [x, y, z] of [[45, -55, 60], [-45, -55, 60], [0, 62, 0], [430, 40, 0], [-430, 40, 0]]) {
      const b = new THREE.Mesh(new THREE.SphereGeometry(2, 8, 6), new THREE.MeshBasicMaterial({ color: '#ff3030' }));
      b.position.set(x, y, z);
      st.add(b);
      this.blinkers.push(b);
    }
    st.position.set(0, 120, 0);
    this.scene.add(st);
    this.station = st;
  }

  start(cfg, onDone) {
    this.onDone = onDone;
    this.t = 0;
    this.done = false;
    if (this.carrier) this.scene.remove(this.carrier.g);
    this.carrier = buildCarrier(cfg.glow);
    this.mech = buildMech(cfg);
    this.mech.root.position.y = -60;
    this.mech.j.shoulderL.rotation.z = 0.15; this.mech.j.shoulderR.rotation.z = -0.15;
    this.mech.j.legL.rotation.x = 0.1; this.mech.j.legR.rotation.x = 0.1;
    this.carrier.g.add(this.mech.root);
    this.scene.add(this.carrier.g);
    this.carrier.g.position.set(0, 0, 0);
    this.cfg = cfg;
    this.fx.clear();
    this.titleStep = -1;
    $('cine').classList.add('show');
    this.app.nav.show(true);
    audio.setLoop('wind', 0);
  }

  title(text, sub) {
    const el = $('cine-title');
    el.innerHTML = text + (sub ? `<small>${sub}</small>` : '');
    el.style.opacity = 1;
  }

  finish() {
    if (this.done) return;
    this.done = true;
    $('cine').classList.remove('show');
    audio.setLoop('wind', 0);
    audio.setLoop('fire', 0);
    this.scene.remove(this.carrier.g);
    if (this.onDone) this.onDone();
  }

  skip() { this.finish(); }

  update(dt, time) {
    if (this.done) return;
    this.t += dt;
    const t = this.t;
    const cam = this.camera;
    cam.aspect = window.innerWidth / window.innerHeight;
    cam.updateProjectionMatrix();
    this.planetMat.uniforms.uTime.value = time;
    this.ring.rotation.y += dt * 0.05;
    for (const b of this.blinkers) b.visible = Math.sin(time * 4) > 0;
    const c = this.carrier;
    for (const f of c.fans) f.rotation.y += dt * 30;
    const nav = this.app.nav;
    const name = this.cfg.name;

    if (t < 6) {
      if (this.titleStep < 0) {
        this.titleStep = 0;
        this.title('ORBITAL STATION AEGIS', 'JAEGER DEPLOYMENT BAY 3');
        nav.say('drop1', `Station Aegis, this is Navigator Nova. ${name} is locked in. Launching drop drone!`, 3, 0);
        audio.play('uiBig');
      }
      const k = Math.max(0, t - 1);
      c.g.position.set(0, -10 - k * k * 2.5, k * 22);
      c.g.rotation.x = Math.min(0.25, k * 0.05);
      cam.position.set(-300 + t * 8, 40 - t * 4, 260);
      cam.lookAt(c.g.position.x * 0.5, c.g.position.y * 0.5 + 30, c.g.position.z * 0.5);
    } else if (t < 11) {
      if (this.titleStep < 1) {
        this.titleStep = 1;
        this.title('DESCENT', 'TARGET: COASTAL CITY · POWER GRID DEFENSE');
        nav.say('drop2', 'Heading down to the city. Kaiju have been spotted near the power plant!', 3, 0);
      }
      const k = t - 6;
      const base = new THREE.Vector3(0, -10 - 25 * 2.5, 5 * 22);
      c.g.position.set(0, base.y - k * 40 - k * k * 6, base.z + k * 35);
      c.g.rotation.x = 0.25 + k * 0.05;
      const camOff = new THREE.Vector3(55, 45, -110);
      cam.position.copy(c.g.position).add(camOff);
      cam.lookAt(c.g.position.clone().add(new THREE.Vector3(0, -50, 80)));
      audio.setLoop('wind', k / 5 * 0.15);
    } else if (t < 17) {
      if (this.titleStep < 2) {
        this.titleStep = 2;
        this.title('ATMOSPHERIC ENTRY', 'HULL TEMPERATURE RISING');
        nav.say('drop3', 'Entering the atmosphere! It is going to get hot and bumpy. Hang on!', 3, 0);
        audio.play('rumble', null, 1);
        this.entrySky.visible = true;
        this.plasma.visible = true;
        this.planet.visible = false;
        this.atmo.visible = false;
        this.stars.visible = false;
        this.station.visible = false;
      }
      const k = (t - 11) / 6;
      const heat = Math.sin(Math.min(1, k * 1.3) * Math.PI * 0.5) * (k > 0.85 ? (1 - k) / 0.15 : 1);
      c.g.position.set(0, 0, 0);
      c.g.rotation.set(0.15 + Math.sin(time * 13) * 0.02 * heat, 0, Math.sin(time * 9) * 0.03 * heat);
      this.entrySky.material.uniforms.uK.value = Math.min(1, k * 3);
      this.entrySky.position.copy(cam.position);
      this.plasma.position.set(0, -55, 0);
      this.plasma.material.uniforms.uT.value = time;
      this.plasma.material.uniforms.uK.value = heat;
      const shake = heat * 3;
      cam.position.set(Math.sin(t * 0.4) * 30 + 150 + (Math.random() - 0.5) * shake, 10 + (Math.random() - 0.5) * shake, 160);
      cam.lookAt(0, -45, 0);
      // streaks of fire flying past
      for (let i = 0; i < 30 * heat + 1; i++) {
        // fire streaks peel off the heat shield and race upward past the drone
        const a = Math.random() * Math.PI * 2, r = 30 + Math.random() * 40;
        const p = new THREE.Vector3(Math.cos(a) * r, -120 + Math.random() * 30, Math.sin(a) * r);
        this.fx.add.spawn(p, new THREE.Vector3(Math.cos(a) * 30, 300 + Math.random() * 200, Math.sin(a) * 30), 0.6, 6 + Math.random() * 10, 1, new THREE.Color('#fff0b0'), new THREE.Color('#ff3a08'), 0.9 * heat, 0, 0);
      }
      if (Math.random() < 0.3) this.fx.alpha.spawn(new THREE.Vector3((Math.random() - 0.5) * 80, 20, (Math.random() - 0.5) * 80), new THREE.Vector3(0, 120, 0), 1.5, 30, 90, new THREE.Color('#4a3a34'), new THREE.Color('#1a1414'), 0.4 * heat, 0, 0);
      audio.setLoop('fire', heat * 0.35);
      audio.setLoop('wind', 0.2 + heat * 0.2);
      if (k > 0.97) {
        this.entrySky.visible = false;
        this.plasma.visible = false;
        this.planet.visible = true; this.atmo.visible = true; this.stars.visible = true; this.station.visible = true;
        this.finish();
      }
    }
    // title fade
    const within = t < 6 ? t : t < 11 ? t - 6 : t - 11;
    $('cine-title').style.opacity = within < 3.5 ? 1 : 0;
    this.fx.update(dt);
  }
}
