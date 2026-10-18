import * as THREE from 'three';
import { BACKUP, WEAPONS } from '../config.js';

const $ = (id) => document.getElementById(id);
const _p = new THREE.Vector3();

export class HUD {
  constructor() {
    this.el = $('hud');
    this.hp = $('hud-hp'); this.energy = $('hud-energy'); this.pilotRow = $('hud-pilot-row'); this.pilot = $('hud-pilot');
    this.wave = $('hud-wave'); this.plant = $('hud-plant'); this.alertEl = $('hud-alert');
    this.kaiju = $('hud-kaiju'); this.kName = $('hud-kaiju-name'); this.kHp = $('hud-kaiju-hp');
    this.radar = $('radar'); this.rc = this.radar.getContext('2d');
    this.score = $('hud-score'); this.abilities = $('abilities'); this.cross = $('crosshair');
    this.markers = $('markers'); this.dmgnums = $('dmgnums'); this.vig = $('vignette'); this.hintEl = $('hud-hint');
    this.alertT = 0;
    this.vigA = 0;
    this.markerPool = [];
    this.dmgPool = [];
    this.nums = [];
    this.abEls = {};
  }

  show(on) { this.el.classList.toggle('show', on); }

  setup(cfg) {
    $('hud-name').textContent = cfg.name;
    this.abilities.innerHTML = '';
    const list = [
      { id: 'L', k: 'LMB', n: WEAPONS[cfg.left].name.split(' ').pop() },
      { id: 'R', k: 'RMB', n: WEAPONS[cfg.right].name.split(' ').pop() },
      { id: 'drones', k: 'Q', n: 'Drones' },
      { id: 'apache', k: '1', n: 'Apaches' },
      { id: 'gunship', k: '2', n: 'Gunship' },
      { id: 'jets', k: '3', n: 'Airstrike' },
      { id: 'eject', k: 'F', n: 'Eject' },
    ];
    for (const a of list) {
      const d = document.createElement('div');
      d.className = 'ab';
      d.innerHTML = `<div class="k">${a.k}</div><div class="n">${a.n}</div><div class="cd"></div>`;
      this.abilities.appendChild(d);
      this.abEls[a.id] = { el: d, cd: d.querySelector('.cd'), n: d.querySelector('.n') };
    }
  }

  alert(text, dur = 3, blink = false) {
    this.alertEl.textContent = text;
    this.alertEl.classList.toggle('blink', blink);
    this.alertT = dur;
  }

  hint(text) { this.hintEl.textContent = text || ''; }

  hurt(amount) { this.vigA = Math.min(1, this.vigA + amount); }

  damageNumber(pos, text, weak, camera) {
    let el = this.dmgPool.pop();
    if (!el) { el = document.createElement('div'); this.dmgnums.appendChild(el); }
    el.className = 'dmg' + (weak ? ' weak' : '');
    el.textContent = text;
    el.style.display = 'block';
    this.nums.push({ el, pos: pos.clone(), t: 0, jx: (Math.random() - 0.5) * 30 });
    if (this.nums.length > 30) { const n = this.nums.shift(); n.el.style.display = 'none'; this.dmgPool.push(n.el); }
  }

  update(dt, g) {
    const m = g.mech;
    const W = window.innerWidth, H = window.innerHeight;
    if (m) {
      this.hp.style.width = `${(m.hp / m.maxHp) * 100}%`;
      this.energy.style.width = `${m.energy}%`;
    }
    const pilotOut = g.pilot && !g.pilot.dead;
    this.pilotRow.classList.toggle('hidden', !pilotOut);
    if (pilotOut) this.pilot.style.width = `${(g.pilot.hp / g.pilot.maxHp) * 100}%`;
    this.plant.style.width = `${g.city.plantIntegrity() * 100}%`;
    this.wave.textContent = g.waveLabel();
    this.alertT -= dt;
    if (this.alertT <= 0 && this.alertEl.textContent) { this.alertEl.textContent = ''; this.alertEl.classList.remove('blink'); }
    this.vigA = Math.max(0, this.vigA - dt * 1.5);
    this.vig.style.opacity = this.vigA.toFixed(2);
    this.score.innerHTML = `Kaiju defeated <b>${g.stats.kills}</b><br>Buildings smashed <b>${g.city.destroyed}</b>`;

    // abilities
    const setAb = (id, frac, ready, label) => {
      const a = this.abEls[id]; if (!a) return;
      a.cd.style.height = `${Math.max(0, Math.min(1, frac)) * 100}%`;
      a.el.classList.toggle('ready', ready);
      if (label) a.n.textContent = label;
    };
    if (m) {
      for (const k of ['L', 'R']) {
        const arm = m.arms[k];
        setAb(k, arm.cd / arm.w.cooldown, arm.cd <= 0 && m.piloted);
      }
    }
    for (const id of ['drones', 'apache', 'gunship', 'jets']) {
      const cd = g.cooldowns[id];
      setAb(id, cd / BACKUP[id].cooldown, cd <= 0);
    }
    setAb('eject', 0, true, pilotOut ? 'Board' : 'Eject');

    // target kaiju bar: nearest revealed living kaiju
    let tk = null, td = Infinity;
    const ref = pilotOut ? g.pilot.pos : (m ? m.pos : null);
    if (ref) for (const k of g.kaijus) {
      if (k.dead || k.emerging) continue;
      const d = k.pos.distanceTo(ref);
      if (d < td && d < 900) { td = d; tk = k; }
    }
    this.kaiju.classList.toggle('hidden', !tk);
    if (tk) {
      this.kName.textContent = `${tk.name.toUpperCase()}  ·  CATEGORY ${tk.cat}`;
      this.kHp.style.width = `${(tk.hp / tk.maxHp) * 100}%`;
    }

    // crosshair color
    this.cross.className = g.aimInfo ? (g.aimInfo.weak ? 'on-weak' : 'on-target') : '';

    // weak spot markers
    let mi = 0;
    for (const k of g.kaijus) {
      if (k.dead || k.emerging || !k.revealed) continue;
      for (const h of k.hitCache) {
        if (!h.weak) continue;
        _p.copy(h.p).project(g.camera);
        if (_p.z > 1) continue;
        let x = (_p.x * 0.5 + 0.5) * W, y = (-_p.y * 0.5 + 0.5) * H;
        const off = x < 0 || x > W || y < 0 || y > H;
        if (off && h.p.distanceTo(g.camera.position) > 900) continue;
        x = Math.max(40, Math.min(W - 40, x)); y = Math.max(60, Math.min(H - 60, y));
        let el = this.markerPool[mi];
        if (!el) {
          el = document.createElement('div');
          el.className = 'marker';
          el.innerHTML = '<div class="dia"></div><div class="t"></div>';
          this.markers.appendChild(el);
          this.markerPool.push(el);
        }
        el.style.display = 'block';
        el.classList.toggle('edge', off);
        el.style.left = `${x}px`; el.style.top = `${y}px`;
        el.querySelector('.t').textContent = `WEAK SPOT · ${h.name}`;
        mi++;
      }
    }
    for (let i = mi; i < this.markerPool.length; i++) this.markerPool[i].style.display = 'none';

    // damage numbers
    for (let i = this.nums.length - 1; i >= 0; i--) {
      const n = this.nums[i];
      n.t += dt;
      if (n.t > 0.9) { n.el.style.display = 'none'; this.dmgPool.push(n.el); this.nums.splice(i, 1); continue; }
      _p.copy(n.pos).project(g.camera);
      if (_p.z > 1) { n.el.style.display = 'none'; continue; }
      n.el.style.display = 'block';
      n.el.style.left = `${(_p.x * 0.5 + 0.5) * W + n.jx}px`;
      n.el.style.top = `${(-_p.y * 0.5 + 0.5) * H - n.t * 70}px`;
      n.el.style.opacity = String(1 - n.t / 0.9);
    }

    this.drawRadar(g);
  }

  drawRadar(g) {
    const c = this.rc, S = 200, R = 96, range = 1000;
    const center = g.pilot && !g.pilot.dead ? g.pilot.pos : g.mech ? g.mech.pos : new THREE.Vector3();
    const yaw = g.view.yaw;
    c.clearRect(0, 0, S, S);
    c.save();
    c.translate(S / 2, S / 2);
    c.beginPath(); c.arc(0, 0, R, 0, Math.PI * 2); c.clip();
    // rings
    c.strokeStyle = 'rgba(56,216,255,0.18)'; c.lineWidth = 1;
    for (const r of [R / 3, (2 * R) / 3, R]) { c.beginPath(); c.arc(0, 0, r, 0, Math.PI * 2); c.stroke(); }
    c.beginPath(); c.moveTo(-R, 0); c.lineTo(R, 0); c.moveTo(0, -R); c.lineTo(0, R); c.stroke();
    // sweep
    const sw = (g.time * 1.5) % (Math.PI * 2);
    const grd = c.createConicGradient ? c.createConicGradient(sw, 0, 0) : null;
    if (grd) {
      grd.addColorStop(0, 'rgba(56,216,255,0.25)'); grd.addColorStop(0.08, 'rgba(56,216,255,0)'); grd.addColorStop(1, 'rgba(56,216,255,0)');
      c.fillStyle = grd; c.beginPath(); c.arc(0, 0, R, 0, Math.PI * 2); c.fill();
    }
    // world -> radar: rotate so camera forward is up
    const toR = (x, z) => {
      const dx = x - center.x, dz = z - center.z;
      // forward (sin yaw, cos yaw) maps to up (0,-1)
      const fx = Math.sin(yaw), fz = Math.cos(yaw);
      const f = dx * fx + dz * fz;
      const r = dx * -fz + dz * fx;
      return [(r / range) * R, (-f / range) * R];
    };
    // bay
    {
      const [x1, y1] = toR(-3000, g.city.waterEdge), [x2, y2] = toR(3000, g.city.waterEdge);
      c.strokeStyle = 'rgba(80,160,255,0.5)'; c.lineWidth = 2;
      c.beginPath(); c.moveTo(x1, y1); c.lineTo(x2, y2); c.stroke();
    }
    // plant
    const pc = g.city.plantCenter;
    const [px, py] = toR(pc.x, pc.z);
    c.fillStyle = '#ffd23a'; c.fillRect(px - 6, py - 6, 12, 12);
    c.fillStyle = '#000'; c.font = 'bold 9px sans-serif'; c.textAlign = 'center'; c.fillText('P', px, py + 3);
    // warnings: fuzzy zones
    for (const w of g.warnings) {
      const [wx, wy] = toR(w.zone.x, w.zone.z);
      const pr = (w.radius / range) * R;
      const a = 0.25 + Math.sin(g.time * 8) * 0.15;
      c.fillStyle = `rgba(255,59,59,${a})`;
      c.beginPath(); c.arc(wx, wy, pr, 0, Math.PI * 2); c.fill();
      c.fillStyle = '#ff3b3b'; c.font = 'bold 14px sans-serif'; c.fillText('?', wx, wy + 5);
    }
    // aircraft
    c.fillStyle = '#5aff8a';
    for (const u of g.military.units) { const [x, y] = toR(u.pos.x, u.pos.z); c.fillRect(x - 2, y - 2, 4, 4); }
    // kaiju
    for (const k of g.kaijus) {
      if (k.dead) continue;
      const [x, y] = toR(k.pos.x, k.pos.z);
      const r = 4 + k.cat;
      c.fillStyle = k.emerging ? '#ff8a3a' : '#ff3b3b';
      c.shadowColor = '#ff3b3b'; c.shadowBlur = 8;
      c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.fill();
      c.shadowBlur = 0;
    }
    // mech (when pilot is outside)
    if (g.pilot && !g.pilot.dead && g.mech) {
      const [x, y] = toR(g.mech.pos.x, g.mech.pos.z);
      c.fillStyle = '#38d8ff'; c.beginPath(); c.arc(x, y, 5, 0, Math.PI * 2); c.fill();
    }
    c.restore();
    // player arrow
    c.fillStyle = '#fff';
    c.beginPath(); c.moveTo(S / 2, S / 2 - 8); c.lineTo(S / 2 + 6, S / 2 + 6); c.lineTo(S / 2, S / 2 + 2); c.lineTo(S / 2 - 6, S / 2 + 6); c.closePath(); c.fill();
    c.fillStyle = 'rgba(56,216,255,0.8)'; c.font = 'bold 10px Orbitron, sans-serif'; c.textAlign = 'center';
    c.fillText('RADAR', S / 2, S - 10);
  }

  clearTransient() {
    for (const n of this.nums) { n.el.style.display = 'none'; this.dmgPool.push(n.el); }
    this.nums.length = 0;
    for (const m of this.markerPool) m.style.display = 'none';
    this.alertEl.textContent = '';
    this.hint('');
  }
}
