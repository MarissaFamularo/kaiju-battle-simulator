import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { initPhysics } from './physics.js';
import { Input } from './input.js';
import { Navigator } from './ui/navigator.js';
import { HUD } from './ui/hud.js';
import { Hangar, loadSettings } from './ui/hangar.js';
import { DropScene } from './scenes/drop.js';
import { Game } from './game.js';
import { audio } from './audio.js';

const $ = (id) => document.getElementById(id);
const show = (id, on) => $(id).classList.toggle('show', on);

class FrameClock {
  constructor() { this.last = performance.now(); this.elapsedTime = 0; }
  getDelta() {
    const now = performance.now();
    const d = (now - this.last) / 1000;
    this.last = now;
    this.elapsedTime += d;
    return d;
  }
}

class App {
  async boot() {
    this.setLoad(0.05, 'Starting engines...');
    this.settings = loadSettings();
    const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.0;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFShadowMap;
    $('app').appendChild(renderer.domElement);
    this.renderer = renderer;

    this.composer = new EffectComposer(renderer);
    this.renderPass = new RenderPass(new THREE.Scene(), new THREE.PerspectiveCamera());
    this.composer.addPass(this.renderPass);
    this.bloom = new UnrealBloomPass(new THREE.Vector2(window.innerWidth / 2, window.innerHeight / 2), 0.32, 0.4, 0.95);
    this.composer.addPass(this.bloom);
    this.composer.addPass(new OutputPass());

    this.input = new Input(renderer.domElement);
    this.nav = new Navigator();
    this.hud = new HUD();
    await this.tick();
    this.setLoad(0.2, 'Loading physics...');
    await initPhysics();
    this.setLoad(0.45, 'Building the city...');
    await this.tick();
    this.game = new Game(this);
    this.setLoad(0.75, 'Fueling the Jaeger...');
    await this.tick();
    this.hangar = new Hangar(this);
    this.drop = new DropScene(this);
    this.applySettings(this.settings);
    this.setLoad(1, 'Ready!');

    window.addEventListener('resize', () => this.resize());
    this.resize();
    this.input.onLockChange = (locked, failed) => this.onLockChange(locked, failed);
    this.wireButtons();
    window.addEventListener('keydown', (e) => this.onKey(e));

    this.state = 'title';
    show('loading', false);
    show('title', true);
    this.clock = new FrameClock();
    this.fpsT = 0; this.frames = 0; this.slow = 0;
    // expose for debugging/testing
    window.__kbs = this;
    renderer.setAnimationLoop(() => this.frame());
  }

  setLoad(f, text) {
    $('load-fill').style.width = `${f * 100}%`;
    $('load-text').textContent = text;
  }

  tick() { return new Promise((r) => setTimeout(r, 30)); }

  resize() {
    const w = window.innerWidth, h = window.innerHeight;
    const pr = Math.min(window.devicePixelRatio || 1, this.settings.quality === 'high' ? 1.5 : 1);
    this.renderer.setPixelRatio(pr * (this.resScale || 1));
    this.renderer.setSize(w, h);
    this.composer.setPixelRatio(pr * (this.resScale || 1));
    this.composer.setSize(w, h);
    const fovScale = h / (2 * Math.tan(THREE.MathUtils.degToRad(29)));
    if (this.game) this.game.fx.setScale(fovScale * pr * (this.resScale || 1));
    if (this.drop) this.drop.fx.setScale(h / (2 * Math.tan(THREE.MathUtils.degToRad(25))) * pr);
  }

  applySettings(s) {
    this.settings = s;
    this.renderer.toneMappingExposure = { dim: 0.55, medium: 0.72, bright: 1 }[s.bright] || 0.72;
    this.nav.setVoice(s.voice);
    audio.musicOn = s.music;
    if (!s.music) audio.stopMusic();
    else if (this.state === 'play') audio.startMusic();
    const high = s.quality === 'high';
    this.renderer.shadowMap.enabled = high;
    this.bloom.enabled = high;
    if (this.game) this.game.city.sun.castShadow = high;
    this.resize();
  }

  wireButtons() {
    $('btn-start').onclick = () => {
      audio.init();
      audio.play('uiBig');
      show('title', false);
      this.toHangar();
    };
    $('btn-launch').onclick = () => {
      audio.init();
      audio.play('uiBig');
      this.launch();
    };
    $('btn-resume').onclick = () => this.resume(true);
    $('btn-quit').onclick = () => { show('pause', false); this.game.stop(); this.toHangar(); };
    $('btn-again').onclick = () => { show('end', false); this.game.stop(); this.launch(); };
    $('btn-hangar').onclick = () => { show('end', false); this.game.stop(); this.toHangar(); };
    $('btn-endless').onclick = () => {
      if (this.game.mode === 'campaign') { // "NEXT MISSION"
        show('end', false);
        this.game.stop();
        this.hangar.settings.mission = Math.min(this.game.missionIdx + 1, 99);
        this.hangar.refreshUI();
        this.launch();
        return;
      }
      show('end', false);
      this.game.continueEndless();
      this.state = 'play';
      this.input.enabled = true;
      this.input.lock(true);
    };
  }

  toHangar() {
    this.state = 'hangar';
    this.input.enabled = false;
    this.input.unlock();
    this.nav.clear();
    this.hangar.enter();
  }

  launch() {
    this.hangar.exit();
    this.state = 'drop';
    this.nav.clear();
    this.input.enabled = true;
    // chapter 2 modes open with the invasion story the first time, then a short drop
    const ch2 = ['campaign', 'freeplay', 'invasion'].includes(this.hangar.settings.mode);
    const variant = !ch2 ? 'classic' : this.introSeen ? 'invasionShort' : 'invasion';
    if (ch2) this.introSeen = true;
    this.drop.start(this.hangar.cfg, (grounded) => this.startGame(grounded), variant);
  }

  startGame(grounded = false) {
    this.state = 'game';
    this.input.endFrame(); // the key that skipped the drop shouldn't also skip the landing
    this.game.startMission({ ...this.hangar.cfg }, this.hangar.settings.mode, this.hangar.settings.mission, grounded); // the hangar holds the mode you just picked
    this.nav.show(true);
  }

  onPlayStart() {
    this.state = 'play';
    this.input.enabled = true;
    this.input.lock();
    this.hud.hint(this.input.locked ? '' : 'CLICK TO CONTROL YOUR JAEGER');
  }

  onLockChange(locked, failed) {
    if (failed) {
      this.hud.hint('Move the mouse to the screen edges to turn');
      setTimeout(() => this.hud.hint(''), 4000);
      return;
    }
    if (locked) { this.hud.hint(''); return; }
    // lost the mouse during battle (Esc) -> pause
    if (this.state === 'play' && !this.game.over) this.pause();
  }

  pause() {
    this.state = 'paused';
    show('pause', true);
    audio.stopLoops();
  }

  resume(fromClick = false) {
    show('pause', false);
    this.state = 'play';
    this.input.lock(fromClick);
    if (!this.input.locked && !this.input.fallbackLook) this.hud.hint('CLICK TO CONTROL YOUR JAEGER');
    this.clock.getDelta();
  }

  onKey(e) {
    if (this.state === 'drop' && (e.code === 'Space' || e.code === 'Enter' || e.code === 'Escape')) this.drop.skip();
    if (this.state === 'play' && e.code === 'Escape' && !this.input.locked) this.pause();
    else if (this.state === 'paused' && e.code === 'Escape' && !this.input.locked) this.resume();
  }

  showEnd(win, s) {
    this.state = 'end';
    this.input.unlock();
    this.input.enabled = false;
    const end = $('end');
    end.classList.toggle('end-defeat', !win);
    const camp = s.campaign;
    $('end-title').textContent = win ? (camp ? (camp.last ? 'CAMPAIGN COMPLETE' : 'MISSION COMPLETE') : 'VICTORY') : s.title;
    $('end-sub').textContent = win ? (camp ? (camp.last ? `${this.hangar.cfg.name} broke the invasion!` : `Mission ${camp.n}: ${camp.title}`) : `${this.hangar.cfg.name} saved the city!`) : s.sub;
    $('end-stats').innerHTML = [
      ['Kaiju defeated', s.kills - (s.tripods || 0)], ['Tripods destroyed', s.tripods || 0], ...(s.saved !== null && s.saved !== undefined ? [['Survivors saved', s.saved]] : []), ['Weak spot hits', s.weak], ['Buildings smashed', s.buildings], ['Damage dealt', s.damage],
      ['Waves reached', s.wave], ['Power plant', `${s.plant}%`], ['Battle time', s.time],
    ].map(([a, b]) => `<div>${a} <b>${b}</b></div>`).join('');
    $('btn-endless').style.display = win && !(camp && camp.last) ? '' : 'none';
    $('btn-endless').textContent = camp ? 'NEXT MISSION' : 'KEEP FIGHTING';
    show('end', true);
  }

  frame() {
    const dt = Math.min(0.05, this.clock.getDelta());
    const t = this.clock.elapsedTime;
    this.nav.update(dt);
    let scene, camera;
    if (this.state === 'hangar') {
      this.hangar.update(dt, t);
      scene = this.hangar.scene; camera = this.hangar.camera;
    } else if (this.state === 'drop') {
      this.drop.update(dt, t);
      scene = this.drop.scene; camera = this.drop.camera;
    } else {
      if (this.state !== 'paused' && this.state !== 'end') this.game.update(dt);
      else if (this.state === 'end') this.game.update(dt * 0.3);
      scene = this.game.scene; camera = this.game.camera;
    }
    this.input.endFrame();
    this.renderPass.scene = scene;
    this.renderPass.camera = camera;
    if (this.bloom.enabled) this.composer.render(dt);
    else this.renderer.render(scene, camera);
    this.trackPerf(dt);
  }

  // Lower the render resolution if the laptop is struggling.
  trackPerf(dt) {
    this.frames++;
    this.fpsT += dt;
    if (this.fpsT >= 2) {
      const fps = this.frames / this.fpsT;
      this.fps = fps;
      this.frames = 0; this.fpsT = 0;
      if (this.state === 'play') {
        if (fps < 32) this.slow++; else this.slow = Math.max(0, this.slow - 1);
        if (this.slow >= 2 && (this.resScale || 1) > 0.6) {
          this.resScale = (this.resScale || 1) - 0.15;
          this.slow = 0;
          this.resize();
        }
      }
    }
  }
}

new App().boot().catch((e) => {
  console.error(e);
  $('load-text').textContent = 'Something went wrong starting the game: ' + e.message;
});
