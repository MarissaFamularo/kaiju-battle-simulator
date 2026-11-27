/* Touch controls for iPad (added 2026-11-08).
   Only turns on for touch screens; keyboard + mouse play is unchanged.
   Force on/off for testing with ?touch=1 or ?touch=0 in the URL.

   Left thumb: joystick to walk (push to the edge to sprint).
   Right thumb: drag anywhere to look and aim.
   Buttons: left arm, right arm, jump, GET OUT / GET IN. Ability tiles (drones,
   helicopters, gunship, airstrike, missiles, repair, truck) are tappable. Small buttons: pause, voice.
   Tapping also skips the drop cinematic and the landing.

   It drives the game's own input object (window.__kbs.input) directly. */
(function () {
  var q = new URLSearchParams(location.search).get('touch');
  var isTouch = q === '1' || (q !== '0' && (navigator.maxTouchPoints > 0 || matchMedia('(pointer: coarse)').matches));
  if (!isTouch) return;

  var LOOK_SCALE = 1.6;   // touch pixels -> mouse pixels for aiming
  var DEAD = 0.35;        // joystick dead zone (0..1)
  var SPRINT = 0.92;      // push this far to sprint

  var css = document.createElement('style');
  css.textContent = [
    'body.kbs-touch{-webkit-user-select:none;user-select:none;-webkit-touch-callout:none;touch-action:manipulation}',
    'body.kbs-touch canvas{touch-action:none}',
    'body.kbs-touch input{-webkit-user-select:text;user-select:text}',
    '#kbs-touch{position:fixed;inset:0;z-index:4;display:none;touch-action:none}',
    'body.kbs-play #kbs-touch{display:block}',
    '#kbs-look{position:absolute;inset:0}',
    '#kbs-stick{position:absolute;width:150px;height:150px;margin:-75px 0 0 -75px;border-radius:50%;',
    '  border:2px solid rgba(120,220,255,.45);background:rgba(5,15,25,.35);pointer-events:none;transition:opacity .2s}',
    '#kbs-stick.idle{opacity:.45}',
    '#kbs-knob{position:absolute;left:50%;top:50%;width:64px;height:64px;margin:-32px 0 0 -32px;border-radius:50%;',
    '  background:rgba(120,220,255,.55);box-shadow:0 0 14px rgba(56,216,255,.6)}',
    '.kbs-btn{position:absolute;border-radius:50%;display:flex;align-items:center;justify-content:center;text-align:center;',
    '  font:700 14px Orbitron,Rajdhani,sans-serif;letter-spacing:.06em;color:#fff;text-shadow:0 0 6px #000;',
    '  background:rgba(5,15,25,.55);border:2px solid rgba(120,220,255,.6);touch-action:none}',
    '.kbs-btn.down{background:rgba(56,216,255,.45);transform:scale(.94)}',
    '#kbs-fireL{width:112px;height:112px;right:150px;bottom:34px;border-color:rgba(255,120,80,.8)}',
    '#kbs-fireR{width:112px;height:112px;right:26px;bottom:120px;border-color:rgba(255,120,80,.8)}',
    '#kbs-jump{width:84px;height:84px;right:34px;bottom:18px}',
    '#kbs-eject{width:84px;height:84px;right:160px;bottom:162px;border-color:rgba(125,255,176,.85);white-space:pre}',
    '.kbs-small{width:56px;height:56px;font-size:12px}',
    '#kbs-pause{left:18px;top:118px}#kbs-voice{left:84px;top:118px}',
    /* move HUD pieces out of the thumbs' way */
    /* the tiles stay between the joystick and the fire buttons, and wrap upward if there are a lot */
    'body.kbs-touch #abilities{left:200px;right:284px;bottom:12px;z-index:6;justify-content:center;flex-wrap:wrap-reverse;gap:6px}',
    'body.kbs-touch #abilities .ab{width:66px;height:62px}',
    'body.kbs-touch #abilities .ab .k{margin-top:7px;font-size:16px}',
    'body.kbs-touch #abilities .ab .n{font-size:12px}',
    'body.kbs-touch #abilities .ab{cursor:pointer;touch-action:none}',
    'body.kbs-touch #abilities .ab.kbs-hide{display:none}',
    'body.kbs-touch #abilities .ab.down{background:rgba(56,216,255,.4)}',
    'body.kbs-touch.kbs-play #nav{bottom:auto!important;top:18px!important;left:50%!important;transform:translateX(-50%);width:min(440px,calc(100vw - 580px))!important}',
    'body.kbs-touch #hud-hint{bottom:110px}',
    '@media (max-width:1200px){body.kbs-touch #hg-right{bottom:215px}}',
    'body.kbs-touch #cine-skip{font-size:16px}',
    '#kbs-rotate{position:fixed;inset:0;z-index:50;display:none;align-items:center;justify-content:center;flex-direction:column;',
    '  background:#05070c;color:#fff;font:700 22px Orbitron,sans-serif;text-align:center;padding:30px}',
    '@media (orientation:portrait){body.kbs-touch #kbs-rotate{display:flex}}'
  ].join('\n');
  document.head.appendChild(css);

  function el(tag, id, cls, text, parent) {
    var e = document.createElement(tag);
    if (id) e.id = id;
    if (cls) e.className = cls;
    if (text) e.textContent = text;
    (parent || document.body).appendChild(e);
    return e;
  }

  function start() {
    var app = window.__kbs;
    if (!app || !app.input) return setTimeout(start, 200);
    var inp = app.input;
    document.body.classList.add('kbs-touch');

    // iPad has no mouse lock: treat the game as always "locked" while playing.
    inp.lock = function () { this.locked = true; this.fallbackLook = false; if (this.onLockChange) this.onLockChange(true); };
    inp.unlock = function () { this.locked = false; };

    // on-screen and spoken tips talk about the F key: say the button instead
    function fixF(t) {
      if (typeof t !== 'string') return t;
      return t.replace(/press F to get out/gi, 'tap GET OUT').replace(/press F to climb in/gi, 'tap GET IN').replace(/and press F\./gi, 'and tap GET IN.');
    }
    if (app.hud) {
      var h0 = app.hud.hint, a0 = app.hud.alert;
      app.hud.hint = function (t) { return h0.call(this, fixF(t)); };
      app.hud.alert = function (t, d, b) { return a0.call(this, fixF(t), d, b); };
    }
    if (app.nav && app.nav.say) {
      var s0 = app.nav.say;
      app.nav.say = function (id, t) { var args = [].slice.call(arguments); args[1] = fixF(t); return s0.apply(this, args); };
    }

    var hint = document.querySelector('.title-hint');
    if (hint) hint.textContent = 'iPad: left thumb walks, right thumb aims. Turn your sound on!';
    var skip = document.getElementById('cine-skip');
    if (skip) skip.textContent = 'TAP to skip';

    el('div', 'kbs-rotate', '', 'Turn your iPad sideways to play!');

    var root = el('div', 'kbs-touch');
    var look = el('div', 'kbs-look', '', '', root);
    var stick = el('div', 'kbs-stick', 'idle', '', root);
    var knob = el('div', 'kbs-knob', '', '', stick);
    var fireL = el('div', 'kbs-fireL', 'kbs-btn', 'LEFT\nARM', root);
    var fireR = el('div', 'kbs-fireR', 'kbs-btn', 'RIGHT\nARM', root);
    var jump = el('div', 'kbs-jump', 'kbs-btn', 'JUMP', root);
    var ejectB = el('div', 'kbs-eject', 'kbs-btn', 'GET\nOUT', root); // get out of / back into the Jaeger (F)
    var pauseB = el('div', 'kbs-pause', 'kbs-btn kbs-small', 'II', root);
    var voiceB = el('div', 'kbs-voice', 'kbs-btn kbs-small', 'VOICE', root);
    fireL.style.whiteSpace = fireR.style.whiteSpace = 'pre';

    function capture(t, id) { try { t.setPointerCapture(id); } catch (err) { /* simulated pointer */ } }
    function press(code) { if (!inp.keys.has(code)) inp.justPressed.add(code); inp.keys.add(code); }
    function release(code) { inp.keys.delete(code); }
    function tap(code) { press(code); setTimeout(function () { release(code); }, 80); }
    function aim(dx, dy) { inp.dx += dx * LOOK_SCALE; inp.dy += dy * LOOK_SCALE; }

    // ---- joystick (left 45% of the screen) + look (everything else) ----
    var home = { x: 0, y: 0 }, stickId = null, lookId = null, last = {};
    function placeHome() {
      home.x = 110; home.y = window.innerHeight - 120;
      if (stickId === null) { stick.style.left = home.x + 'px'; stick.style.top = home.y + 'px'; }
    }
    placeHome();
    window.addEventListener('resize', placeHome);
    var origin = { x: 0, y: 0 };
    var MOVE = ['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ShiftLeft'];
    function setStick(dx, dy) {
      var r = 60, d = Math.hypot(dx, dy), k = d > r ? r / d : 1;
      knob.style.transform = 'translate(' + dx * k + 'px,' + dy * k + 'px)';
      var nx = dx * k / r, ny = dy * k / r, want = {};
      if (ny < -DEAD) want.KeyW = 1;
      if (ny > DEAD) want.KeyS = 1;
      if (nx < -DEAD) want.KeyA = 1;
      if (nx > DEAD) want.KeyD = 1;
      if (d / r >= SPRINT && ny < -DEAD) want.ShiftLeft = 1;
      MOVE.forEach(function (c) { want[c] ? press(c) : release(c); });
    }
    function endStick() {
      stickId = null; knob.style.transform = ''; stick.classList.add('idle');
      MOVE.forEach(release); placeHome();
    }

    look.addEventListener('pointerdown', function (e) {
      e.preventDefault();
      if (e.clientX < window.innerWidth * 0.45 && stickId === null) {
        stickId = e.pointerId; origin.x = e.clientX; origin.y = e.clientY;
        stick.style.left = e.clientX + 'px'; stick.style.top = e.clientY + 'px';
        stick.classList.remove('idle');
      } else if (lookId === null) {
        lookId = e.pointerId;
      } else return;
      last[e.pointerId] = { x: e.clientX, y: e.clientY };
      capture(look, e.pointerId);
    });
    look.addEventListener('pointermove', function (e) {
      var p = last[e.pointerId];
      if (!p) return;
      if (e.pointerId === stickId) setStick(e.clientX - origin.x, e.clientY - origin.y);
      else if (e.pointerId === lookId) aim(e.clientX - p.x, e.clientY - p.y);
      p.x = e.clientX; p.y = e.clientY;
    });
    function lookEnd(e) {
      delete last[e.pointerId];
      if (e.pointerId === stickId) endStick();
      if (e.pointerId === lookId) lookId = null;
    }
    look.addEventListener('pointerup', lookEnd);
    look.addEventListener('pointercancel', lookEnd);

    // ---- hold buttons (fire buttons also aim while you drag your thumb) ----
    function holdButton(b, onDown, onUp, canAim) {
      var id = null, lx = 0, ly = 0;
      b.addEventListener('pointerdown', function (e) {
        e.preventDefault(); e.stopPropagation();
        if (id !== null) return;
        id = e.pointerId; lx = e.clientX; ly = e.clientY;
        capture(b, id); b.classList.add('down'); onDown();
      });
      b.addEventListener('pointermove', function (e) {
        if (e.pointerId !== id || !canAim) return;
        aim(e.clientX - lx, e.clientY - ly); lx = e.clientX; ly = e.clientY;
      });
      function up(e) { if (e.pointerId !== id) return; id = null; b.classList.remove('down'); onUp(); }
      b.addEventListener('pointerup', up);
      b.addEventListener('pointercancel', up);
    }
    function mouseBtn(n) {
      return [function () { inp.buttons.add(n); inp.justClicked.add(n); }, function () { inp.buttons.delete(n); }];
    }
    var mL = mouseBtn(0), mR = mouseBtn(2);
    holdButton(fireL, mL[0], mL[1], true);
    holdButton(fireR, mR[0], mR[1], true);
    holdButton(jump, function () { press('Space'); }, function () { release('Space'); }, false);
    holdButton(ejectB, function () { tap('KeyF'); }, function () {}, false);
    holdButton(pauseB, function () { if (app.state === 'play') app.pause(); }, function () {}, false);
    holdButton(voiceB, function () { tap('KeyV'); }, function () {}, false);

    // ---- ability tiles at the bottom become buttons ----
    var TILE_KEY = { drones: 'KeyQ', apache: 'Digit1', gunship: 'Digit2', jets: 'Digit3', missiles: 'KeyE', repair: 'KeyR', rescue: 'Digit4', eject: 'KeyF' };
    var abBox = document.getElementById('abilities');
    function tileFor(target) {
      var ab = app.hud && app.hud.abEls;
      if (!ab) return null;
      for (var id in ab) if (ab[id].el.contains(target)) return { id: id, el: ab[id].el };
      return null;
    }
    function tagTiles() {
      var ab = app.hud && app.hud.abEls;
      if (!ab) return;
      for (var id in ab) ab[id].el.classList.toggle('kbs-hide', id === 'L' || id === 'R' || id === 'eject'); // those three have their own big buttons
    }
    if (abBox) {
      abBox.style.pointerEvents = 'auto';
      abBox.addEventListener('pointerdown', function (e) {
        var t = tileFor(e.target);
        if (!t || !TILE_KEY[t.id]) return;
        e.preventDefault(); e.stopPropagation();
        tap(TILE_KEY[t.id]);
        t.el.classList.add('down');
        setTimeout(function () { t.el.classList.remove('down'); }, 150);
      });
      new MutationObserver(tagTiles).observe(abBox, { childList: true });
      tagTiles();
    }

    // ---- tap to skip the drop cinematic and the landing ----
    document.addEventListener('pointerdown', function () {
      if (app.state === 'drop' && app.drop && app.drop.skip) app.drop.skip();
      else if (app.state === 'game') tap('Space');
    }, true);

    // ---- stop iOS page zoom / bounce ----
    ['gesturestart', 'gesturechange'].forEach(function (n) {
      document.addEventListener(n, function (e) { e.preventDefault(); }, { passive: false });
    });
    document.addEventListener('touchmove', function (e) {
      if (!e.target.closest || !e.target.closest('#hangar')) e.preventDefault();
    }, { passive: false });

    // ---- show controls only during play; let go of everything otherwise ----
    var wasPlay = false;
    (function watch() {
      var play = app.state === 'play';
      var out = !!(app.game && app.game.pilot), lbl = out ? 'GET\nIN' : 'GET\nOUT';
      if (ejectB.textContent !== lbl) ejectB.textContent = lbl;
      if (play !== wasPlay) {
        document.body.classList.toggle('kbs-play', play);
        if (!play) {
          endStick(); lookId = null; last = {};
          inp.keys.clear(); inp.buttons.clear();
          [fireL, fireR, jump, ejectB].forEach(function (b) { b.classList.remove('down'); });
        }
        wasPlay = play;
      }
      requestAnimationFrame(watch);
    })();
  }
  start();
})();
