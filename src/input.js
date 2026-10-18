// Keyboard + mouse state with pointer lock for mouse-look.

export class Input {
  constructor(el) {
    this.el = el;
    this.keys = new Set();
    this.justPressed = new Set();
    this.buttons = new Set();
    this.justClicked = new Set();
    this.dx = 0; this.dy = 0;
    this.locked = false;
    this.enabled = false;
    this.sensitivity = 0.0022;
    this.fallbackLook = false; // used if pointer lock is unavailable
    this.mx = 0; this.my = 0;
    this.onLockChange = null;

    window.addEventListener('keydown', (e) => {
      if (!this.enabled) return;
      if (['Space', 'Tab', 'ArrowUp', 'ArrowDown'].includes(e.code)) e.preventDefault();
      if (!this.keys.has(e.code)) this.justPressed.add(e.code);
      this.keys.add(e.code);
    });
    window.addEventListener('keyup', (e) => { this.keys.delete(e.code); });
    window.addEventListener('blur', () => { this.keys.clear(); this.buttons.clear(); });
    el.addEventListener('mousedown', (e) => {
      if (!this.enabled) return;
      if (!this.locked && !this.fallbackLook) { this.lock(); return; }
      this.buttons.add(e.button);
      this.justClicked.add(e.button);
    });
    window.addEventListener('mouseup', (e) => this.buttons.delete(e.button));
    el.addEventListener('contextmenu', (e) => e.preventDefault());
    window.addEventListener('mousemove', (e) => {
      if (!this.enabled) return;
      if (this.locked) { this.dx += e.movementX; this.dy += e.movementY; }
      else if (this.fallbackLook) {
        this.mx = (e.clientX / window.innerWidth) * 2 - 1;
        this.my = (e.clientY / window.innerHeight) * 2 - 1;
      }
    });
    document.addEventListener('pointerlockchange', () => {
      this.locked = document.pointerLockElement === el;
      if (this.onLockChange) this.onLockChange(this.locked);
    });
    document.addEventListener('pointerlockerror', () => {
      // e.g. sandboxed iframe: steer by mouse position instead
      this.fallbackLook = true;
      if (this.onLockChange) this.onLockChange(false, true);
    });
  }

  lock() {
    if (this.fallbackLook) return;
    try {
      const p = this.el.requestPointerLock();
      if (p && p.catch) p.catch(() => { this.fallbackLook = true; if (this.onLockChange) this.onLockChange(false, true); });
    } catch (e) {
      this.fallbackLook = true;
    }
  }

  unlock() { if (document.pointerLockElement) document.exitPointerLock(); }

  down(code) { return this.keys.has(code); }
  pressed(code) { return this.justPressed.has(code); }
  mouse(b) { return this.buttons.has(b); }
  clicked(b) { return this.justClicked.has(b); }

  // Returns look delta in radians for this frame.
  look(dt) {
    let x = this.dx * this.sensitivity, y = this.dy * this.sensitivity;
    if (!this.locked && this.fallbackLook) {
      const dz = (v) => (Math.abs(v) < 0.15 ? 0 : (v - Math.sign(v) * 0.15) / 0.85);
      x = dz(this.mx) * 2.2 * dt;
      y = dz(this.my) * 1.4 * dt;
    }
    this.dx = 0; this.dy = 0;
    return { x, y };
  }

  endFrame() { this.justPressed.clear(); this.justClicked.clear(); }
}
