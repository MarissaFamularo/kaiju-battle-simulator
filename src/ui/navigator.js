// Navigator Nova: gives tips in a text panel, and optionally speaks them aloud.

export class Navigator {
  constructor() {
    this.el = document.getElementById('nav');
    this.textEl = document.getElementById('nav-text');
    this.queue = [];
    this.current = null;
    this.cooldowns = new Map();
    this.voiceOn = true;
    this.typing = 0;
    this.showT = 0;
    this.voice = null;
    if ('speechSynthesis' in window) {
      const pickVoice = () => {
        const vs = window.speechSynthesis.getVoices();
        this.voice = vs.find((v) => /en/i.test(v.lang) && /(female|samantha|zira|jenny|aria|google uk english female|karen|moira)/i.test(v.name))
          || vs.find((v) => /en-US/i.test(v.lang)) || vs[0] || null;
      };
      pickVoice();
      window.speechSynthesis.onvoiceschanged = pickVoice;
    }
  }

  show(on) { this.el.classList.toggle('hidden', !on); }

  // key: dedupe id, priority: higher interrupts lower, cooldown: seconds before same key can repeat
  say(key, text, priority = 1, cooldown = 8) {
    const now = performance.now() / 1000;
    const last = this.cooldowns.get(key);
    if (last !== undefined && now - last < cooldown) return false;
    this.cooldowns.set(key, now);
    const msg = { key, text, priority, at: now };
    // important news interrupts; equal priority interrupts once the current line has been up a moment
    if (!this.current || priority > this.current.priority || (priority === this.current.priority && this.showT > 2.5)) {
      this.start(msg);
    } else {
      // keep the queue short and sorted
      this.queue = this.queue.filter((m) => m.key !== key);
      this.queue.push(msg);
      this.queue.sort((a, b) => b.priority - a.priority);
      if (this.queue.length > 3) this.queue.length = 3;
    }
    return true;
  }

  start(msg) {
    this.current = msg;
    this.typing = 0;
    this.showT = 0;
    this.el.classList.remove('quiet');
    this.minTime = 1.6 + msg.text.length * 0.045;
    if (this.voiceOn && 'speechSynthesis' in window) {
      try {
        window.speechSynthesis.cancel();
        const u = new SpeechSynthesisUtterance(msg.text);
        if (this.voice) u.voice = this.voice;
        u.rate = 1.08; u.pitch = 1.1; u.volume = 0.9;
        window.speechSynthesis.speak(u);
      } catch (e) { /* speech not available */ }
    }
  }

  update(dt) {
    if (!this.current) {
      const now = performance.now() / 1000;
      // drop stale lines so tips never arrive long after they matter
      this.queue = this.queue.filter((m) => now - m.at < 9);
      if (this.queue.length) this.start(this.queue.shift());
      else { this.showT += dt; if (this.showT > 4) this.el.classList.add('quiet'); }
      return;
    }
    this.showT += dt;
    this.typing = Math.min(this.current.text.length, this.typing + dt * 55);
    this.textEl.textContent = this.current.text.slice(0, Math.ceil(this.typing));
    const speaking = this.voiceOn && 'speechSynthesis' in window && window.speechSynthesis.speaking;
    if (this.showT > this.minTime && (!speaking || this.showT > this.minTime + 6)) {
      this.current = null;
      this.showT = 0;
    }
  }

  clear() {
    this.queue.length = 0;
    this.current = null;
    if ('speechSynthesis' in window) window.speechSynthesis.cancel();
  }

  setVoice(on) {
    this.voiceOn = on;
    if (!on && 'speechSynthesis' in window) window.speechSynthesis.cancel();
  }
}
