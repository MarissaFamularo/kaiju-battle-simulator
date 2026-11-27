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
  { id: 'sprinter', label: 'Sprinter Pod' },
  { id: 'shield', label: 'Shield Pod' },
  { id: 'mortar', label: 'Mortar Pod' },
  { id: 'ghost', label: 'Ghost Pod' },
  { id: 'splitter', label: 'Splitter Pod' },
  { id: 'titan', label: 'Titan Pod' },
  { id: 'sniper', label: 'Sniper Pod' },
  { id: 'repair', label: 'Repair Pod' },
  { id: 'flame', label: 'Flame Pod' },
  { id: 'thunder', label: 'Thunder Pod' },
  { id: 'sprinterBoss', label: 'Boss Pod: Boss Sprinter' },
  { id: 'shieldBoss', label: 'Boss Pod: Boss Shield' },
  { id: 'mortarBoss', label: 'Boss Pod: Boss Mortar' },
  { id: 'ghostBoss', label: 'Boss Pod: Boss Ghost' },
  { id: 'splitterBoss', label: 'Boss Pod: Boss Splitter' },
  { id: 'stormking', label: 'Boss Pod: Storm King' },
  { id: 'overlord', label: 'Boss Pod: Overlord' },
  { id: 'ship', label: 'Alien Dropship (drops 2, then leaves)' },
  { id: 'mothership', label: 'The Mothership' },
];
const PER_PAGE = 7;
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

  // B (or the SPAWN button): page 1, then page 2, then closed
  toggle() {
    if (!this.open && !this.allowed()) { this.game.hud.alert('NO SPAWNING IN THIS MODE: TRY FREE PLAY', 2.5); return; }
    const pages = Math.ceil(this.list().length / PER_PAGE);
    if (!this.open) { this.open = true; this.page = 0; } else if (this.page + 1 < pages) this.page++; else this.open = false;
    this.draw();
  }

  draw() {
    if (this.open) {
      const all = this.list(), pages = Math.ceil(all.length / PER_PAGE), from = this.page * PER_PAGE;
      const row = 'display:flex;gap:10px;align-items:center;padding:8px;margin-top:4px;font-size:17px;font-weight:700;border:1px solid rgba(120,220,255,.3);cursor:pointer;touch-action:none';
      this.el.innerHTML = `<div style="font:900 15px Orbitron,sans-serif;letter-spacing:.12em;color:#38d8ff;margin:2px 4px 6px">SPAWN A BAD GUY  ${this.page + 1}/${pages}</div>`
        + all.slice(from, from + PER_PAGE).map((c, i) => `<div data-i="${from + i}" style="${row}"><b style="font-family:Orbitron,sans-serif;color:#ffd23a;width:16px">${i + 1}</b>${c.label}</div>`).join('')
        + `<div data-i="-2" style="${row};justify-content:center;color:#ffd23a">${this.page + 1 < pages ? 'MORE BAD GUYS ▸ (B)' : 'CLOSE (B)'}</div>`;
    }
    this.el.style.display = this.open ? 'block' : 'none';
  }

  close() { this.open = false; this.draw(); }

  // i is a position in the whole list; number keys pass a position on the page you are looking at
  pickKey(n) { this.pick(this.page * PER_PAGE + n); }

  pick(i) {
    if (i === -2) { this.toggle(); return; }
    const g = this.game, c = this.list()[i];
    this.close();
    if (!c) return;
    const busy = g.kaijus.filter((k) => !k.dead).length + g.warnings.length;
    if (busy >= MAX_ENEMIES) { g.hud.alert('TOO MANY BAD GUYS! BEAT SOME FIRST', 2.5); return; }
    if (/^k\d$/.test(c.id)) g.queueKaiju(+c.id[1]);
    else if (c.id === 'ship') g.queueShip(['attacker', ['sprinter', 'shield', 'mortar', 'ghost', 'splitter', 'sniper', 'repair', 'flame', 'thunder'][Math.floor(Math.random() * 9)]]);
    else if (c.id === 'mothership') g.queueShip(['attacker', 'flame', 'repair', 'thunder', 'titan'], 'mothership');
    else g.queueTripod(c.id);
  }
}
