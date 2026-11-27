import * as THREE from 'three';
import { FRAMES, WEAPONS, HEADS, CHESTS, PALETTE, GLOWS, DEFAULT_JAEGER, rateBuild } from '../config.js';
import { buildMech, poseBay } from '../entities/mechModel.js';
import { audio } from '../audio.js';
import { MISSIONS, campaignProgress } from '../campaign.js';

const $ = (id) => document.getElementById(id);
const STORE = 'kbs.jaeger.v1';
const SETTINGS = 'kbs.settings.v1';
const BRIGHT_LABEL = { dim: 'LOW', medium: 'MEDIUM', bright: 'HIGH' };

export function loadConfig() {
  try {
    const s = JSON.parse(localStorage.getItem(STORE) || 'null');
    if (s && FRAMES[s.frame] && WEAPONS[s.left] && WEAPONS[s.right]) {
      const c = { ...DEFAULT_JAEGER, ...s };
      if (!HEADS[c.head]) c.head = 'visor';
      if (!CHESTS[c.chest]) c.chest = 'standard';
      return c;
    }
  } catch (e) { /* storage blocked */ }
  return { ...DEFAULT_JAEGER };
}
function saveConfig(c) { try { localStorage.setItem(STORE, JSON.stringify(c)); } catch (e) { /* ignore */ } }
export function loadSettings() {
  try { return { voice: true, music: true, quality: 'high', mode: 'mission', bright: 'medium', ...JSON.parse(localStorage.getItem(SETTINGS) || '{}') }; } catch (e) { return { voice: true, music: true, quality: 'high', mode: 'mission', bright: 'medium' }; }
}
function saveSettings(s) { try { localStorage.setItem(SETTINGS, JSON.stringify(s)); } catch (e) { /* ignore */ } }

export class Hangar {
  constructor(app) {
    this.app = app;
    this.cfg = loadConfig();
    this.settings = loadSettings();
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color('#070b12');
    this.scene.fog = new THREE.Fog('#070b12', 200, 700);
    this.camera = new THREE.PerspectiveCamera(40, 1, 1, 3000);
    this.rot = 0.6;
    this.drag = null;
    this.buildScene();
    this.buildUI();
    this.rebuildMech();
  }

  buildScene() {
    const s = this.scene;
    s.add(new THREE.HemisphereLight('#6a8cff', '#201a18', 0.6));
    const key = new THREE.SpotLight('#ffffff', 6500, 700, 0.45, 0.6, 1.6);
    key.position.set(60, 180, 90);
    key.target.position.set(0, 30, 0);
    key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024);
    s.add(key, key.target);
    const rim = new THREE.SpotLight('#38d8ff', 6000, 700, 0.5, 0.7, 1.6);
    rim.position.set(-90, 120, -110);
    rim.target.position.set(0, 30, 0);
    s.add(rim, rim.target);
    this.rimLight = rim;
    const fill = new THREE.PointLight('#ff8a3a', 400, 300, 1.6);
    fill.position.set(-80, 20, 80);
    s.add(fill);

    const floorMat = new THREE.MeshStandardMaterial({ color: '#1a1f27', metalness: 0.7, roughness: 0.4 });
    const floor = new THREE.Mesh(new THREE.CircleGeometry(600, 64), floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    s.add(floor);
    const grid = new THREE.GridHelper(1000, 50, '#1f4a66', '#14273a');
    grid.position.y = 0.05;
    s.add(grid);
    const pad = new THREE.Mesh(new THREE.CylinderGeometry(34, 36, 2, 48), new THREE.MeshStandardMaterial({ color: '#2a313b', metalness: 0.8, roughness: 0.3 }));
    pad.position.y = 1; pad.receiveShadow = true;
    s.add(pad);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(35, 0.6, 8, 64), new THREE.MeshStandardMaterial({ color: '#000', emissive: '#38d8ff', emissiveIntensity: 3 }));
    ring.rotation.x = Math.PI / 2; ring.position.y = 2.1;
    s.add(ring);
    this.ring = ring;
    // gantries
    const beamMat = new THREE.MeshStandardMaterial({ color: '#3a414b', metalness: 0.8, roughness: 0.4 });
    const stripe = new THREE.MeshStandardMaterial({ color: '#000', emissive: '#ffb020', emissiveIntensity: 1.2 });
    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1]) {
        const b = new THREE.Mesh(new THREE.BoxGeometry(5, 120, 5), beamMat);
        b.position.set(sx * 60, 60, sz * 45 - 20);
        b.castShadow = true;
        s.add(b);
      }
      for (const y of [30, 60, 90]) {
        const w = new THREE.Mesh(new THREE.BoxGeometry(6, 2.5, 100), beamMat);
        w.position.set(sx * 58, y, -20);
        s.add(w);
        const st = new THREE.Mesh(new THREE.BoxGeometry(6.2, 0.6, 100), stripe);
        st.position.set(sx * 58, y + 1.5, -20);
        s.add(st);
      }
    }
    // back wall with lights
    const wall = new THREE.Mesh(new THREE.BoxGeometry(600, 300, 4), new THREE.MeshStandardMaterial({ color: '#0e131a', metalness: 0.5, roughness: 0.6 }));
    wall.position.set(0, 150, -160);
    s.add(wall);
    for (let i = 0; i < 9; i++) {
      const l = new THREE.Mesh(new THREE.BoxGeometry(30, 2, 1), new THREE.MeshStandardMaterial({ color: '#000', emissive: '#bfe8ff', emissiveIntensity: 1.2 }));
      l.position.set(-200 + i * 50, 140, -157);
      s.add(l);
    }
    // giant number on the wall
    const c = document.createElement('canvas'); c.width = 512; c.height = 256;
    const g = c.getContext('2d');
    g.fillStyle = '#000'; g.fillRect(0, 0, 512, 256);
    g.font = '900 150px Orbitron, sans-serif'; g.fillStyle = '#e0a21b'; g.textAlign = 'center'; g.fillText('K-01', 256, 190);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(120, 60), new THREE.MeshBasicMaterial({ map: t, transparent: true, opacity: 0.25, blending: THREE.AdditiveBlending }));
    sign.position.set(0, 95, -157);
    s.add(sign);

    const el = this.app.renderer.domElement;
    el.addEventListener('pointerdown', (e) => { if (this.active) this.drag = { x: e.clientX, r: this.rot }; });
    window.addEventListener('pointerup', () => { this.drag = null; });
    window.addEventListener('pointermove', (e) => { if (this.drag && this.active) this.rot = this.drag.r + (e.clientX - this.drag.x) * 0.01; });
  }

  opt(container, items, current, onPick) {
    const el = $(container);
    el.innerHTML = '';
    for (const it of items) {
      const b = document.createElement('div');
      b.className = 'opt' + (it.id === current ? ' on' : '');
      b.innerHTML = it.label + (it.sub ? `<small>${it.sub}</small>` : '');
      b.title = it.title || '';
      b.onclick = () => { audio.init(); audio.play('ui'); onPick(it.id); };
      el.appendChild(b);
    }
  }

  swatches(container, colors, current, onPick) {
    const el = $(container);
    el.innerHTML = '';
    for (const c of colors) {
      const s = document.createElement('div');
      s.className = 'sw' + (c === current ? ' on' : '');
      s.style.background = c;
      s.onclick = () => { audio.init(); audio.play('ui'); onPick(c); };
      el.appendChild(s);
    }
  }

  buildUI() {
    const cfg = this.cfg;
    const name = $('hg-name');
    name.value = cfg.name;
    name.oninput = () => {
      cfg.name = (name.value || 'JAEGER').toUpperCase().slice(0, 18);
      saveConfig(cfg);
    };
    name.onkeydown = (e) => e.stopPropagation();
    this.refreshUI();
  }

  refreshUI() {
    const cfg = this.cfg;
    const set = (k) => (v) => {
      cfg[k] = v;
      saveConfig(cfg);
      this.refreshUI();
      this.rebuildMech();
      this.navTip(k, v);
    };
    this.opt('hg-frame', Object.values(FRAMES).map((f) => ({ id: f.id, label: f.name, title: f.desc })), cfg.frame, set('frame'));
    const wl = Object.values(WEAPONS).map((w) => ({ id: w.id, label: w.name, title: w.desc }));
    this.opt('hg-left-w', wl, cfg.left, set('left'));
    this.opt('hg-right-w', wl, cfg.right, set('right'));
    this.opt('hg-head', Object.values(HEADS).map((h) => ({ id: h.id, label: h.name, title: h.desc || '' })), cfg.head, set('head'));
    this.opt('hg-chest', Object.values(CHESTS).map((c) => ({ id: c.id, label: c.name, title: c.desc })), cfg.chest, set('chest'));
    this.swatches('hg-primary', PALETTE, cfg.primary, set('primary'));
    this.swatches('hg-accent', PALETTE, cfg.accent, set('accent'));
    this.swatches('hg-glow', GLOWS, cfg.glow, set('glow'));
    // stats
    const f = FRAMES[cfg.frame];
    const L = WEAPONS[cfg.left], R = WEAPONS[cfg.right];
    const dps = (w) => (w.damage / w.cooldown);
    const stats = [
      ['ARMOR', f.armor * (CHESTS[cfg.chest]?.armor || 1) / 2400],
      ['SPEED', f.speed / 34],
      ['POWER', ((dps(L) + dps(R)) * f.power) / 230],
      ['RANGE', ((L.kind === 'ranged') + (R.kind === 'ranged')) / 2 * 0.8 + 0.2],
      ['SMASH', ((L.smash + R.smash) / 2) * f.power / 3],
    ];
    $('hg-stats').innerHTML = stats.map(([n, v]) => `<div class="stat"><span>${n}</span><div class="bar"><div style="width:${Math.min(100, v * 100).toFixed(0)}%"></div></div></div>`).join('');
    const r = rateBuild(cfg);
    $('hg-rating-fill').style.width = `${r.score}%`;
    $('hg-rating-num').textContent = r.score;
    const descs = [`<div><b>${L.name}:</b> ${L.desc}</div>`, cfg.right !== cfg.left ? `<div><b>${R.name}:</b> ${R.desc}</div>` : ''];
    $('hg-tips').innerHTML = r.notes.map((n) => `<div>${n}</div>`).join('') + descs.join('');

    const st = this.settings;
    this.opt('hg-mode', [
      { id: 'mission', label: 'MISSION', sub: '7 waves' },
      { id: 'endless', label: 'ENDLESS', sub: 'no end' },
      { id: 'smash', label: 'FREE SMASH', sub: 'K kaiju, T tripod' },
      { id: 'invasion', label: 'INVASION', sub: 'tripods!' },
      { id: 'freeplay', label: 'FREE PLAY', sub: 'huge map' },
      { id: 'campaign', label: 'CAMPAIGN', sub: `${MISSIONS.length} missions` },
    ], st.mode, (v) => { st.mode = v; saveSettings(st); this.refreshUI(); if (v === 'campaign') this.briefMission(); });
    // campaign: pick a mission (later ones unlock as you win)
    const open = campaignProgress();
    st.mission = Math.max(0, Math.min(open, st.mission ?? open));
    $('hg-mission').style.display = st.mode === 'campaign' ? '' : 'none';
    if (st.mode === 'campaign') {
      this.opt('hg-mission', MISSIONS.map((m, i) => ({ id: i, label: i <= open ? `${i + 1}` : '🔒', sub: i <= open ? m.title : 'locked', title: i <= open ? m.brief : 'Win the mission before this one to unlock it.' })).filter((o) => o.id <= open + 1), st.mission, (i) => {
        if (i > campaignProgress()) return;
        st.mission = i; saveSettings(st); this.refreshUI(); this.briefMission();
      });
    }
    this.opt('hg-settings', [
      { id: 'voice', label: st.voice ? 'VOICE ON' : 'VOICE OFF' },
      { id: 'music', label: st.music ? 'MUSIC ON' : 'MUSIC OFF' },
      { id: 'quality', label: st.quality === 'high' ? 'GRAPHICS HIGH' : 'GRAPHICS FAST' },
      { id: 'bright', label: 'BRIGHTNESS ' + (BRIGHT_LABEL[st.bright] || 'MEDIUM') },
    ], null, (v) => {
      if (v === 'bright') st.bright = { dim: 'medium', medium: 'bright', bright: 'dim' }[st.bright] || 'dim';
      else if (v === 'quality') st.quality = st.quality === 'high' ? 'low' : 'high';
      else st[v] = !st[v];
      saveSettings(st);
      this.app.applySettings(st);
      this.refreshUI();
    });
  }

  briefMission() {
    const m = MISSIONS[this.settings.mission || 0];
    this.app.nav.say('brief', `Mission ${(this.settings.mission || 0) + 1}, ${m.title}. ${m.brief}`, 3, 0);
  }

  navTip(k, v) {
    const nav = this.app.nav;
    const cfg = this.cfg;
    if (k === 'frame') nav.say('hg-frame', `${FRAMES[v].name} frame. ${FRAMES[v].desc}`, 1, 0);
    else if (k === 'left' || k === 'right') {
      const w = WEAPONS[v];
      let extra = '';
      if (cfg.left === cfg.right && w.kind === 'ranged') extra = ' Two cannons? Keep your distance, kaiju hit hard up close.';
      else if (v === 'sword') extra = ' Swing it at the glowing weak spots for triple damage!';
      else if (v === 'cannon') extra = ' Aim with the mouse. Weak spots take triple damage.';
      else if (v === 'fist') extra = ' Great for knocking kaiju back.';
      else if (v === 'blades') extra = ' Super fast. Get close and keep slashing!';
      else if (v === 'laser') extra = ' Hold the button down to keep firing!';
      nav.say('hg-weapon', `${w.name}: ${w.desc}${extra}`, 1, 0);
    } else if (k === 'primary' || k === 'accent') nav.say('hg-paint', 'Looking sharp, pilot!', 0, 6);
    else if (k === 'glow') nav.say('hg-glow', 'That energy color shows on your blades and plasma shots.', 0, 8);
    else if (k === 'head') {
      const h = HEADS[v];
      nav.say('hg-head', h.desc ? `${h.name}! ${h.desc} That is where you sit, pilot.` : 'Nice helmet. That is where you sit, pilot!', 0, 0);
    } else if (k === 'chest') {
      nav.say('hg-chest', v === 'missiles'
        ? 'Missile Bay! In battle, press E. The chest doors open and launch homing missiles at the kaiju!'
        : `${CHESTS[v].name}. ${CHESTS[v].desc}`, 1, 0);
    }
  }

  rebuildMech() {
    if (this.mech) {
      this.scene.remove(this.mech.root);
      this.mech.root.traverse((o) => { if (o.material && o.material.dispose) o.material.dispose(); });
    }
    this.mech = buildMech(this.cfg);
    const s = FRAMES[this.cfg.frame].scale;
    this.mech.root.scale.setScalar(s);
    this.mech.root.position.y = 2;
    for (const k of ['L', 'R']) {
      const b = this.mech.blades[k];
      if (b) { b.visible = true; b.scale.y = 1; }
    }
    this.scene.add(this.mech.root);
    this.rimLight.color.set(this.cfg.glow);
    this.ring.material.emissive.set(this.cfg.glow);
  }

  enter() {
    this.active = true;
    $('hangar').classList.add('show');
    this.nav = this.app.nav;
    this.app.nav.show(true);
    this.app.nav.say('hg-hello', 'Welcome to the hangar, pilot! Pick your weapons and colors, then hit LAUNCH.', 2, 30);
  }

  exit() {
    this.active = false;
    $('hangar').classList.remove('show');
  }

  update(dt, time) {
    if (!this.drag) this.rot += dt * 0.25;
    const r = 150;
    const aspect = window.innerWidth / window.innerHeight;
    this.camera.aspect = aspect;
    this.camera.updateProjectionMatrix();
    this.camera.position.set(Math.sin(this.rot) * r, 45, Math.cos(this.rot) * r);
    this.camera.lookAt(0, 32, 0);
    const j = this.mech.j;
    j.hips.position.y = 27 + Math.sin(time * 1.2) * 0.3;
    j.shoulderL.rotation.x = 0.1 + Math.sin(time * 1.2) * 0.04;
    j.shoulderR.rotation.x = 0.1 + Math.sin(time * 1.2 + 1) * 0.04;
    j.elbowL.rotation.x = -0.35; j.elbowR.rotation.x = -0.35;
    j.head.rotation.y = Math.sin(time * 0.5) * 0.3;
    this.mech.mats.glow.emissiveIntensity = 2.6 + Math.sin(time * 3) * 0.7;
    // show off the Missile Bay doors and spin the reactor
    poseBay(this.mech.bay, dt, Math.sin(time * 0.9) > 0.2 ? 1 : 0);
    if (j.reactorSpin) j.reactorSpin.rotation.z += dt * 2;
  }
}
