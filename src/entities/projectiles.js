import * as THREE from 'three';
import { audio } from '../audio.js';

const _a = new THREE.Vector3();
const _b = new THREE.Vector3();

// Closest distance from point c to segment ab.
export function segPointDist(a, b, c) {
  const abx = b.x - a.x, aby = b.y - a.y, abz = b.z - a.z;
  const l2 = abx * abx + aby * aby + abz * abz;
  let t = l2 > 0 ? ((c.x - a.x) * abx + (c.y - a.y) * aby + (c.z - a.z) * abz) / l2 : 0;
  t = Math.max(0, Math.min(1, t));
  const x = a.x + abx * t - c.x, y = a.y + aby * t - c.y, z = a.z + abz * t - c.z;
  return { d: Math.sqrt(x * x + y * y + z * z), t };
}

export class Projectiles {
  constructor(game) {
    this.game = game;
    this.list = [];
  }

  fire(o) {
    this.list.push({
      pos: o.pos.clone(), vel: o.dir.clone().multiplyScalar(o.speed), damage: o.damage, owner: o.owner,
      color: new THREE.Color(o.color || '#ffffff'), size: o.size || 8, radius: o.radius || 3, gravity: o.gravity || 0,
      life: o.life || 4, acid: !!o.acid, smash: o.smash ?? 1, kind: o.kind || 'plasma', boom: o.boom || 0,
      trail: o.trail || null, src: o.src || null, target: o.target || null, aimIdx: o.aimIdx || 0, age: 0,
    });
  }

  update(dt) {
    const g = this.game;
    for (let i = this.list.length - 1; i >= 0; i--) {
      const p = this.list[i];
      p.life -= dt;
      if (p.target) this.home(p, dt);
      _a.copy(p.pos);
      p.vel.y += p.gravity * dt;
      p.pos.addScaledVector(p.vel, dt);
      _b.copy(p.pos);
      // visuals
      if (p.kind === 'tracer') g.fx.glow(p.pos, p.color, p.size, 0.05);
      else if (p.kind === 'missile') { g.fx.glow(p.pos, '#ffd080', 10, 0.05); g.fx.smokeTrail(p.pos, 0.8); }
      else if (p.kind === 'shell') g.fx.glow(p.pos, '#ffcc66', 14, 0.05);
      else {
        g.fx.glow(p.pos, p.color, p.size, 0.06);
        g.fx.trail(_a.clone().lerp(_b, 0.5), p.color, p.size * 0.6);
        if (p.acid) g.fx.acid(p.pos);
      }
      let hit = null;
      // the pilot's blaster knocks little aliens off the Jaeger
      if (p.owner === 'pilot' && g.aliens) {
        const al = g.aliens.hitSeg(_a, _b, p.radius);
        if (al) { hit = { point: al.center.clone() }; g.aliens.hit(al, hit.point); }
      }
      if (hit) {
        // already hit an alien
      } else if (p.owner !== 'kaiju') {
        // vs kaiju and tripods (a tripod's lasers only hurt kaiju)
        for (const k of g.kaijus) {
          if (k.dead || k.emerging || k === p.src) continue;
          if (p.owner === 'tripod' && k.isTripod) continue;
          if (k.pos.distanceTo(p.pos) > k.height * 1.5 + 60) continue;
          let best = null;
          for (const h of k.hitCache) {
            const r = segPointDist(_a, _b, h.p);
            if (r.d < h.r + p.radius && (!best || (h.weak && !best.h.weak) || (h.weak === best.h.weak && r.t < best.t))) best = { h, t: r.t };
          }
          if (best) {
            const pt = _a.clone().lerp(_b, best.t);
            const weak = best.h.weak;
            const dmg = p.damage * (weak ? 3 : 1);
            k.takeDamage(dmg, pt, p.vel.clone().normalize(), { weak, source: p.owner, stagger: p.owner === 'player' ? 0.2 : 0.05 });
            g.onDamageDealt(k, dmg, weak, pt, p.owner);
            hit = { point: pt, kaiju: k, weak };
            break;
          }
        }
      } else {
        // kaiju projectiles vs mech / pilot / aircraft
        const m = g.mech;
        if (m && !m.dead) {
          const c = m.chestPos(new THREE.Vector3());
          c.y -= 12 * m.scale;
          if (segPointDist(_a, _b, c).d < 22 * m.scale + p.radius) {
            m.takeDamage(p.damage, p.pos);
            hit = { point: p.pos.clone() };
          }
        }
        if (!hit && g.pilot && !g.pilot.dead && segPointDist(_a, _b, g.pilot.pos).d < 4 + p.radius) {
          g.pilot.takeDamage(p.damage * 0.5, p.pos);
          hit = { point: p.pos.clone() };
        }
        if (!hit) {
          for (const u of g.military.targets()) {
            if (segPointDist(_a, _b, u.pos).d < 10 + p.radius) { u.destroy(true); hit = { point: p.pos.clone() }; break; }
          }
        }
      }
      if (!hit) {
        const bh = g.city.raycast(_a, _b);
        if (bh) {
          g.city.damage(bh.b, p.damage * p.smash, bh.point, p.vel.clone().normalize(), { source: p.owner });
          hit = { point: bh.point };
        }
      }
      const floor = hit ? 0 : g.city.groundAt(p.pos.x, p.pos.z);
      if (!hit && p.pos.y <= floor + 0.5) {
        hit = { point: p.pos.clone().setY(floor + 1) };
        g.city.damageArea(hit.point, 6, p.damage * 0.5, { source: p.owner, noFx: true });
      }
      if (hit) {
        this.impact(p, hit);
        this.list.splice(i, 1);
        continue;
      }
      if (p.life <= 0) this.list.splice(i, 1);
    }
  }

  impact(p, hit) {
    const g = this.game;
    if (p.kind === 'tracer') {
      g.fx.sparks(hit.point, 5);
      return;
    }
    if (p.boom > 0) {
      g.fx.explosion(hit.point, p.boom);
      audio.play(p.boom > 0.8 ? 'explosion' : 'smallBoom', hit.point, 0.8);
      g.city.damageArea(hit.point, 14 * p.boom, p.damage, { source: p.owner, force: 1.5 });
      g.city.impulseDebris(hit.point, 40 * p.boom, 30);
      return;
    }
    if (p.acid) {
      for (let i = 0; i < 25; i++) g.fx.acid(hit.point.clone().add(new THREE.Vector3((Math.random() - 0.5) * 20, Math.random() * 10, (Math.random() - 0.5) * 20)));
      g.fx.explosion(hit.point, 0.5);
      audio.play('smallBoom', hit.point, 0.7);
      return;
    }
    g.fx.sparks(hit.point, 24, hit.kaiju ? 'blue' : 'spark');
    g.fx.glow(hit.point, p.color, 70, 0.2);
    g.fx.flash(hit.point, '#' + p.color.getHexString(), 2500, 0.2);
    audio.play(hit.weak ? 'weak' : 'smallBoom', hit.point, 0.7);
  }

  // Homing missiles: after a short launch arc, steer toward one of the target's hit spots.
  home(p, dt) {
    p.age += dt;
    const k = p.target;
    if (k.dead) { p.target = null; return; }
    if (p.age <= 0.3) return;
    const hc = k.hitCache && k.hitCache.length ? k.hitCache[p.aimIdx % k.hitCache.length] : null;
    const aim = hc ? hc.p : k.pos.clone().setY(k.height * 0.5 || 40);
    const sp = Math.min(420, p.vel.length() + dt * 260);
    p.vel.lerp(aim.clone().sub(p.pos).normalize().multiplyScalar(sp), Math.min(1, dt * 5));
  }

  clear() { this.list.length = 0; }
}
