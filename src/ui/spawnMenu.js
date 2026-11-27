// The spawn menu: Patrick asked to "spawn the bad guys on command" (2026-11-27).
// B (or the SPAWN button on iPad) opens it; press the number or tap a row to pick.
// Works in every mode except Campaign and the classic Mission, where the story decides who shows up.
const CHOICES = [
  { id: 'k1', label: 'Kaiju · small (category 1)' },
  { id: 'k3', label: 'Kaiju · big (category 3)' },
  { id: 'k5', label: 'Kaiju · giant (category 5)' },
  { id: 'attacker', label: 'Attacker Tripod' },
  { id: 'harvester', label: 'Harvester', needsCamps: true },
  { id: 'uber', label: 'Uber Pod' },
  { id: 'emperor', label: 'Emperor Pod' },
];
const MAX_ENEMIES = 8;

export class SpawnMenu {
  constructor(game) {
    this.game = game;
    this.open = false;
    const el = this.el = document.createElement('div');
    el.id = 'spawn-menu';
    el.style.cssText = 'position:absolute;left:18px;top:190px;width:290px;display:none;pointer-events:auto;background:rgba(5,10,18,.88);border:1px solid rgba(120,220,255,.6);padding:8px;font-family:Rajdhani,sans-serif;color:#fff;z-index:7';
    document.getElementById('hud').appendChild(el);
    el.addEventListener('pointerdown', (e) => {
      const row = e.target.closest('[data-i]');
      e.preventDefault(); e.stopPropagation();
      if (row) this.pick(+row.dataset.i);
    });
  }

  allowed() { return !['campaign', 'mission'].includes(this.game.mode); }
  list() { return CHOICES.filter((c) => !c.needsCamps || this.game.camps); }

  toggle() {
    if (!this.open && !this.allowed()) { this.game.hud.alert('NO SPAWNING IN THIS MODE: TRY FREE PLAY', 2.5); return; }
    this.open = !this.open;
    if (this.open) {
      this.el.innerHTML = '<div style="font:900 15px Orbitron,sans-serif;letter-spacing:.12em;color:#38d8ff;margin:2px 4px 6px">SPAWN A BAD GUY</div>'
        + this.list().map((c, i) => `<div data-i="${i}" style="display:flex;gap:10px;align-items:center;padding:9px 8px;margin-top:4px;font-size:17px;font-weight:700;border:1px solid rgba(120,220,255,.3);cursor:pointer;touch-action:none"><b style="font-family:Orbitron,sans-serif;color:#ffd23a;width:16px">${i + 1}</b>${c.label}</div>`).join('')
        + '<div data-i="-1" style="padding:8px;margin-top:6px;text-align:center;font-weight:700;color:#9fb3c8;cursor:pointer;touch-action:none">CLOSE (B)</div>';
    }
    this.el.style.display = this.open ? 'block' : 'none';
  }

  close() { if (this.open) this.toggle(); }

  pick(i) {
    const g = this.game, c = this.list()[i];
    this.close();
    if (!c) return;
    const busy = g.kaijus.filter((k) => !k.dead).length + g.warnings.length;
    if (busy >= MAX_ENEMIES) { g.hud.alert('TOO MANY BAD GUYS! BEAT SOME FIRST', 2.5); return; }
    if (c.id[0] === 'k') g.queueKaiju(+c.id[1]);
    else g.queueTripod(c.id);
  }
}
