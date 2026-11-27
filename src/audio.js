// All sound effects are synthesized with WebAudio, so the game needs no audio files.

class AudioEngine {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.sfxGain = null;
    this.musicGain = null;
    this.noiseBuf = null;
    this.loops = new Map();
    this.musicOn = true;
    this.listenerPos = { x: 0, y: 0, z: 0 };
    this._musicTimer = null;
    this._step = 0;
    this.intensity = 0; // 0 calm, 1 battle
  }

  init() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.7;
    const comp = this.ctx.createDynamicsCompressor();
    comp.threshold.value = -14;
    comp.ratio.value = 6;
    this.master.connect(comp).connect(this.ctx.destination);
    this.sfxGain = this.ctx.createGain();
    this.sfxGain.connect(this.master);
    this.musicGain = this.ctx.createGain();
    this.musicGain.gain.value = 0.22;
    this.musicGain.connect(this.master);
    const len = this.ctx.sampleRate * 2;
    this.noiseBuf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = this.noiseBuf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  }

  get ok() { return !!this.ctx; }

  setListener(p) { this.listenerPos = p; }

  // Volume falloff by distance from the listener (camera).
  vol(pos, base = 1, range = 900) {
    if (!pos) return base;
    const dx = pos.x - this.listenerPos.x, dy = pos.y - this.listenerPos.y, dz = pos.z - this.listenerPos.z;
    const d = Math.sqrt(dx * dx + dy * dy + dz * dz);
    return base * Math.max(0, 1 - d / range) ** 1.5;
  }

  noise(dur, { freq = 800, q = 1, type = 'lowpass', gain = 0.5, attack = 0.005, freqEnd = null, out = null } = {}) {
    const c = this.ctx, t = c.currentTime;
    const src = c.createBufferSource();
    src.buffer = this.noiseBuf;
    src.loop = true;
    src.playbackRate.value = 0.5 + Math.random();
    const f = c.createBiquadFilter();
    f.type = type; f.frequency.value = freq; f.Q.value = q;
    if (freqEnd) f.frequency.exponentialRampToValueAtTime(Math.max(20, freqEnd), t + dur);
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, gain), t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f).connect(g).connect(out || this.sfxGain);
    src.start(t, Math.random());
    src.stop(t + dur + 0.05);
    return g;
  }

  tone(dur, { type = 'sine', freq = 440, freqEnd = null, gain = 0.3, attack = 0.005, delay = 0, out = null } = {}) {
    const c = this.ctx, t = c.currentTime + delay;
    const o = c.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (freqEnd) o.frequency.exponentialRampToValueAtTime(Math.max(10, freqEnd), t + dur);
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, gain), t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(out || this.sfxGain);
    o.start(t);
    o.stop(t + dur + 0.05);
  }

  play(name, pos = null, scale = 1) {
    if (!this.ctx) return;
    const v = this.vol(pos, scale, name === 'explosion' || name === 'roar' || name === 'collapse' || name === 'thunder' || name === 'horn' ? 1800 : 900);
    if (v < 0.02) return;
    switch (name) {
      case 'stomp':
        this.tone(0.35, { freq: 70, freqEnd: 28, gain: 0.55 * v });
        this.noise(0.25, { freq: 300, gain: 0.25 * v });
        break;
      case 'smallStep':
        this.noise(0.08, { freq: 900, gain: 0.08 * v });
        break;
      case 'swing':
        this.noise(0.28, { freq: 600, freqEnd: 2500, type: 'bandpass', q: 2, gain: 0.35 * v, attack: 0.08 });
        this.tone(0.3, { type: 'sawtooth', freq: 110, freqEnd: 180, gain: 0.06 * v });
        break;
      case 'hit':
        this.tone(0.2, { type: 'square', freq: 220, freqEnd: 60, gain: 0.25 * v });
        this.noise(0.25, { freq: 2500, type: 'bandpass', q: 1.5, gain: 0.4 * v });
        break;
      case 'weak':
        this.tone(0.4, { type: 'sawtooth', freq: 880, freqEnd: 220, gain: 0.18 * v });
        this.tone(0.4, { type: 'sine', freq: 1320, freqEnd: 330, gain: 0.12 * v });
        this.noise(0.3, { freq: 3000, type: 'bandpass', gain: 0.3 * v });
        break;
      case 'plasma':
        this.tone(0.35, { type: 'sawtooth', freq: 1200, freqEnd: 90, gain: 0.18 * v });
        this.tone(0.25, { type: 'sine', freq: 600, freqEnd: 150, gain: 0.2 * v });
        break;
      case 'punch':
        this.noise(0.15, { freq: 1500, freqEnd: 300, gain: 0.3 * v, attack: 0.02 });
        this.tone(0.3, { type: 'sawtooth', freq: 90, freqEnd: 40, gain: 0.2 * v });
        break;
      case 'explosion':
        this.noise(1.6, { freq: 1800, freqEnd: 80, gain: 0.7 * v });
        this.tone(0.9, { freq: 90, freqEnd: 25, gain: 0.6 * v });
        break;
      case 'smallBoom':
        this.noise(0.6, { freq: 2200, freqEnd: 200, gain: 0.35 * v });
        this.tone(0.4, { freq: 120, freqEnd: 40, gain: 0.3 * v });
        break;
      case 'collapse':
        this.noise(2.8, { freq: 500, freqEnd: 60, gain: 0.55 * v, attack: 0.1 });
        this.noise(1.5, { freq: 2500, freqEnd: 400, type: 'bandpass', gain: 0.15 * v, attack: 0.05 });
        break;
      case 'crumble':
        this.noise(0.5, { freq: 900, freqEnd: 200, gain: 0.25 * v });
        break;
      case 'roar': this.roar(v); break;
      case 'gun':
        this.noise(0.06, { freq: 3500, type: 'highpass', gain: 0.25 * v });
        this.tone(0.06, { type: 'square', freq: 300, freqEnd: 100, gain: 0.08 * v });
        break;
      case 'minigun':
        this.noise(0.05, { freq: 2000, type: 'bandpass', gain: 0.18 * v });
        break;
      case 'missile':
        this.noise(0.8, { freq: 3000, freqEnd: 800, type: 'bandpass', gain: 0.2 * v, attack: 0.05 });
        break;
      case 'bonk':
        this.tone(0.12, { type: 'triangle', freq: 600, freqEnd: 900, gain: 0.25 * v });
        this.tone(0.1, { type: 'square', freq: 200, gain: 0.05 * v, delay: 0.02 });
        break;
      case 'alarm':
        for (let i = 0; i < 3; i++) {
          this.tone(0.22, { type: 'square', freq: 880, gain: 0.12, delay: i * 0.5 });
          this.tone(0.22, { type: 'square', freq: 660, gain: 0.12, delay: i * 0.5 + 0.25 });
        }
        break;
      case 'ui':
        this.tone(0.08, { type: 'triangle', freq: 900, freqEnd: 1300, gain: 0.12 });
        break;
      case 'uiBig':
        this.tone(0.3, { type: 'sawtooth', freq: 200, freqEnd: 800, gain: 0.12 });
        this.tone(0.4, { type: 'sine', freq: 400, freqEnd: 1600, gain: 0.1, delay: 0.1 });
        break;
      case 'blade':
        this.tone(0.4, { type: 'sawtooth', freq: 140, freqEnd: 420, gain: 0.12 * v, attack: 0.05 });
        this.noise(0.3, { freq: 4000, type: 'highpass', gain: 0.1 * v });
        break;
      case 'jet':
        this.noise(2.5, { freq: 1200, freqEnd: 300, type: 'bandpass', gain: 0.4 * v, attack: 0.6 });
        break;
      case 'hurt':
        this.tone(0.3, { type: 'square', freq: 150, freqEnd: 50, gain: 0.25 });
        this.noise(0.3, { freq: 1000, gain: 0.3 });
        break;
      case 'rumble':
        this.noise(2.5, { freq: 120, gain: 0.5 * v, attack: 0.8 });
        break;
      case 'thunder':
        this.noise(0.18, { freq: 5000, type: 'highpass', gain: 0.6 * v });
        this.noise(1.8, { freq: 900, freqEnd: 60, gain: 0.6 * v, attack: 0.02 });
        this.tone(1.2, { freq: 70, freqEnd: 30, gain: 0.35 * v });
        break;
      case 'horn':
        // the tripod's loud horn: two long low blasts
        for (const d of [0, 1.15]) {
          this.tone(1.0, { type: 'sawtooth', freq: d ? 62 : 82, gain: 0.3 * v, attack: 0.08, delay: d });
          this.tone(1.0, { type: 'sawtooth', freq: d ? 93.5 : 123.5, gain: 0.22 * v, attack: 0.08, delay: d });
          this.tone(1.0, { type: 'square', freq: d ? 124 : 164, gain: 0.07 * v, attack: 0.1, delay: d });
        }
        break;
      case 'laser':
        this.tone(0.2, { type: 'square', freq: 1900, freqEnd: 260, gain: 0.1 * v });
        this.tone(0.16, { type: 'sawtooth', freq: 900, freqEnd: 200, gain: 0.1 * v });
        break;
      case 'splat':
        this.noise(0.18, { freq: 700, freqEnd: 150, gain: 0.4 * v });
        this.tone(0.2, { type: 'sine', freq: 240, freqEnd: 70, gain: 0.25 * v });
        break;
      case 'eject':
        this.noise(0.6, { freq: 400, freqEnd: 3000, type: 'bandpass', gain: 0.3, attack: 0.02 });
        break;
      default: break;
    }
  }

  roar(v = 1) {
    const c = this.ctx, t = c.currentTime;
    const dur = 2.2;
    const o = c.createOscillator();
    o.type = 'sawtooth';
    const base = 55 + Math.random() * 30;
    o.frequency.setValueAtTime(base * 1.6, t);
    o.frequency.linearRampToValueAtTime(base * 2.2, t + 0.4);
    o.frequency.linearRampToValueAtTime(base, t + dur);
    const lfo = c.createOscillator();
    lfo.frequency.value = 28;
    const lfoG = c.createGain();
    lfoG.gain.value = 25;
    lfo.connect(lfoG).connect(o.frequency);
    const ws = c.createWaveShaper();
    const curve = new Float32Array(256);
    for (let i = 0; i < 256; i++) { const x = i / 128 - 1; curve[i] = Math.tanh(x * 4); }
    ws.curve = curve;
    const f1 = c.createBiquadFilter(); f1.type = 'bandpass'; f1.frequency.value = 500; f1.Q.value = 2;
    f1.frequency.linearRampToValueAtTime(800, t + 0.5);
    f1.frequency.linearRampToValueAtTime(300, t + dur);
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.6 * v, t + 0.25);
    g.gain.setValueAtTime(0.6 * v, t + dur * 0.6);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(ws).connect(f1).connect(g).connect(this.sfxGain);
    o.start(t); lfo.start(t);
    o.stop(t + dur + 0.1); lfo.stop(t + dur + 0.1);
    this.noise(dur, { freq: 700, type: 'bandpass', q: 1, gain: 0.25 * v, attack: 0.2 });
  }

  // Looping sounds such as helicopter rotors. Call setLoop each frame with a volume.
  setLoop(name, volume) {
    if (!this.ctx) return;
    let l = this.loops.get(name);
    if (!l && volume > 0.01) {
      const c = this.ctx;
      const src = c.createBufferSource();
      src.buffer = this.noiseBuf; src.loop = true;
      const f = c.createBiquadFilter();
      const g = c.createGain(); g.gain.value = 0;
      let mod = null;
      if (name === 'rotor') {
        f.type = 'lowpass'; f.frequency.value = 400;
        mod = c.createOscillator(); mod.type = 'square'; mod.frequency.value = 13;
        const mg = c.createGain(); mg.gain.value = 0.5;
        const amp = c.createGain(); amp.gain.value = 0.5;
        mod.connect(mg).connect(amp.gain);
        src.connect(f).connect(amp).connect(g);
        mod.start();
      } else if (name === 'wind') {
        f.type = 'bandpass'; f.frequency.value = 500; f.Q.value = 0.6;
        src.connect(f).connect(g);
      } else if (name === 'fire') {
        f.type = 'lowpass'; f.frequency.value = 900;
        src.connect(f).connect(g);
      } else {
        f.type = 'lowpass'; f.frequency.value = 300;
        src.connect(f).connect(g);
      }
      g.connect(this.sfxGain);
      src.start();
      l = { src, g, mod, f };
      this.loops.set(name, l);
    }
    if (l) l.g.gain.setTargetAtTime(Math.max(0, volume), this.ctx.currentTime, 0.1);
  }

  stopLoops() {
    for (const l of this.loops.values()) {
      try { l.src.stop(); if (l.mod) l.mod.stop(); } catch (e) { /* already stopped */ }
    }
    this.loops.clear();
  }

  // Simple procedural battle music: driving bass + drums in a minor key.
  startMusic() {
    if (!this.ctx || this._musicTimer) return;
    const bpm = 132;
    const stepDur = 60 / bpm / 4;
    let next = this.ctx.currentTime + 0.1;
    const bassNotes = [40, 40, 52, 40, 43, 40, 47, 45]; // MIDI, E minor-ish
    const prog = [0, 0, 3, -2];
    const midi = (n) => 440 * 2 ** ((n - 69) / 12);
    const sched = () => {
      if (!this.ctx) return;
      while (next < this.ctx.currentTime + 0.25) {
        const s = this._step % 16;
        const bar = Math.floor(this._step / 16) % 4;
        const t0 = next - this.ctx.currentTime;
        const I = this.intensity;
        if (this.musicOn) {
          // kick
          if (s % 4 === 0) this.tone(0.25, { freq: 120, freqEnd: 40, gain: 0.5, delay: t0, out: this.musicGain });
          // snare
          if (I > 0.3 && (s === 4 || s === 12)) this.noiseAt(t0, 0.15, 1800, 0.3);
          // hats
          if (I > 0.1 && s % 2 === 1) this.noiseAt(t0, 0.03, 7000, 0.08, 'highpass');
          // bass ostinato
          if (s % 2 === 0) {
            const n = bassNotes[(s / 2) % 8] + prog[bar];
            this.tone(stepDur * 1.8, { type: 'sawtooth', freq: midi(n), gain: 0.12 + 0.08 * I, delay: t0, out: this.musicGain });
          }
          // stabs when intense
          if (I > 0.6 && s === 0) {
            const r = 64 + prog[bar];
            [0, 3, 7].forEach((iv) => this.tone(0.5, { type: 'square', freq: midi(r + iv), gain: 0.04, delay: t0, out: this.musicGain }));
          }
        }
        this._step++;
        next += stepDur;
      }
    };
    this._musicTimer = setInterval(sched, 60);
  }

  noiseAt(delay, dur, freq, gain, type = 'bandpass') {
    const c = this.ctx, t = c.currentTime + delay;
    const src = c.createBufferSource();
    src.buffer = this.noiseBuf;
    const f = c.createBiquadFilter(); f.type = type; f.frequency.value = freq;
    const g = c.createGain();
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f).connect(g).connect(this.musicGain);
    src.start(t, Math.random()); src.stop(t + dur + 0.02);
  }

  stopMusic() {
    if (this._musicTimer) clearInterval(this._musicTimer);
    this._musicTimer = null;
  }
}

export const audio = new AudioEngine();
