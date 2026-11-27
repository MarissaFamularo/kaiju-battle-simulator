// The Chapter 2 campaign (docs/chapter-2-design.md). Patrick asked for "a campaign with
// a bunch of missions" and left the list to Claude, so these are built from his pieces:
// tripods, hiding, camps, survivors, bunkers, the Harvester, the crater and the Uber Pod.
// Mission 8, the Emperor Pod, is Patrick's own idea (added 2026-11-27).
//
// Each mission:
//   title, brief     shown in the hangar and read by the navigator
//   start(g, s)      runs a few seconds after touchdown (s is this mission's scratch state)
//   tick(g, s, dt)   optional, runs every frame
//   goal(g, s)       the short line shown at the top of the screen
//   done(g, s)       true when you have won
//   failed(g, s)     a reason string if you have lost, else null
//   win              what the navigator says when you win

const STORE = 'kbs.campaign.v1';
export function campaignProgress() {
  try { return Math.max(0, Math.min(MISSIONS.length - 1, parseInt(localStorage.getItem(STORE) || '0', 10) || 0)); } catch (e) { return 0; }
}
export function unlockMission(i) {
  try { if (i > campaignProgress()) localStorage.setItem(STORE, String(Math.min(MISSIONS.length - 1, i))); } catch (e) { /* storage blocked */ }
}

const living = (g, pred = () => true) => g.kaijus.filter((k) => !k.dead && pred(k));
const noneComing = (g) => !g.warnings.length && !living(g).length;
const dist = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);

export const MISSIONS = [
  {
    title: 'First Contact',
    brief: 'Lightning is hitting the same spot in the ruined city. Something is coming up. Find out what it is, and destroy it.',
    start(g) { g.queueTripod('attacker'); },
    goal: () => 'Destroy the tripod',
    done: (g) => g.stats.tripods >= 1,
    failed: () => null,
    win: 'You beat the first tripod! But there will be more. A lot more.',
  },
  {
    title: 'Supply Run',
    brief: 'Your Jaeger needs supplies. Find two survivor camps (green flags), get out with F, and collect their crates. Watch for tripods.',
    start(g, s) { s.next = 45; g.nav.say('m2', 'Camps are the green triangles on your radar. Walk your Jaeger there, press F to get out, and walk into the glowing crates.', 3, 0); },
    tick(g, s, dt) { s.next -= dt; if (s.next <= 0 && living(g).length < 1 && !g.warnings.length) { s.next = 70; g.queueTripod('attacker'); } },
    goal: (g) => `Collect supplies at 2 camps (${Math.min(2, g.camps.visits)}/2)`,
    done: (g) => g.camps.visits >= 2,
    failed: () => null,
    win: 'Supplies collected! Remember: R repairs your armor with scrap and energy.',
  },
  {
    title: 'Rescue',
    brief: 'Tripods are stepping on the camps. Save 6 survivors: stand your Jaeger next to a camp so they climb aboard, then carry them to a bunker. Or press 4 to call a rescue truck.',
    start(g, s) { s.next = 30; },
    tick(g, s, dt) { s.next -= dt; if (s.next <= 0 && living(g).length < 2 && !g.warnings.length) { s.next = 60; g.queueTripod('attacker'); } },
    goal: (g) => `Save 6 survivors (${Math.min(6, g.camps.saved)}/6)`,
    done: (g) => g.camps.saved >= 6,
    failed: (g) => (g.camps.saved + g.camps.aboard + g.camps.camps.reduce((n, c) => n + c.people.length, 0) + g.camps.runners.length + g.camps.trucks.reduce((n, t) => n + t.load, 0) < 6 ? 'There are not enough survivors left to save.' : null),
    win: 'Six people are safe underground because of you. That is what a Jaeger pilot is for.',
  },
  {
    title: 'The Harvester',
    brief: 'A new kind of tripod: the Harvester. It takes survivors and animals, and once it has them we cannot get them back. Destroy it before it takes 8 survivors. It fights by stomping, and it can grab you on foot, so stay in your Jaeger!',
    start(g, s) { g.queueTripod('harvester'); s.sent = true; },
    goal: (g) => `Destroy the Harvester (it has taken ${g.camps.harvested}/8)`,
    done: (g, s) => s.sent && !g.warnings.length && g.kaijus.some((k) => k.type === 'harvester' && k.dead) && !living(g, (k) => k.type === 'harvester').length,
    failed: (g) => (g.camps.harvested >= 8 ? 'The Harvester filled its cage with survivors.' : null),
    win: 'The Harvester is scrap! Everyone still in the camps is safe.',
  },
  {
    title: 'Hold the Bunker',
    brief: 'Kaiju have found the Hill Bunker, southeast of the giant hill. Get there and protect the hatch through three attacks. Only kaiju can break a bunker.',
    start(g, s) { s.bunker = g.camps.bunkers[0]; s.wave = 0; s.wait = 0; g.nav.say('m5', `Head for ${s.bunker.name}. It is a blue B on your radar, to the southeast. The attack starts when you get there.`, 3, 0); },
    tick(g, s, dt) {
      if (!s.bunker) return;
      const there = dist(g.mech.pos, s.bunker) < 320;
      if (s.wave === 0 && !there) return;
      if (s.wave > 0 && !noneComing(g)) return;
      s.wait -= dt;
      if (s.wait > 0 || s.wave >= 3) return;
      s.wave++;
      s.wait = 8;
      const waves = [[2], [2, 2], [3, 'T']];
      waves[s.wave - 1].forEach((c, i) => {
        if (c === 'T') { g.queueTripod('attacker'); return; }
        const a = Math.random() * 6.28;
        g.queueKaiju(c, { x: s.bunker.x + Math.cos(a) * (330 + i * 60), z: s.bunker.z + Math.sin(a) * (330 + i * 60), from: 'ground', sector: s.bunker.name.toUpperCase() });
      });
      g.hud.alert(`ATTACK ${s.wave} OF 3`, 3);
    },
    goal: (g, s) => (s.wave ? `Protect ${s.bunker.name}: attack ${s.wave}/3` : 'Go to the Hill Bunker (blue B, southeast)'),
    done: (g, s) => s.wave >= 3 && s.wait <= 0 && noneComing(g),
    failed: (g, s) => (s.bunker && !s.bunker.b.alive ? `The kaiju broke the hatch of ${s.bunker.name}.` : null),
    win: 'The bunker held! Everyone inside is cheering for you.',
  },
  {
    title: 'Monsters of the Crater',
    brief: 'Something lives in the crater with the wrecked tripod head, far to the southwest. Go there, wake it up, and beat everything that crawls out.',
    start(g, s) { s.stage = 0; g.fp.craterCd = 0; g.nav.say('m6', 'The crater is southwest. Look for CRATER on your radar and the green glow.', 3, 0); },
    tick(g, s, dt) {
      g.checkCrater(dt);
      if (s.stage === 0 && g.fp.craterCd > 0) { s.stage = 1; s.t = 18; }
      if (s.stage === 1) {
        s.t -= dt;
        if (s.t <= 0) {
          s.stage = 2;
          const c = g.city.places.crater;
          g.queueKaiju(4, { x: c.x, z: c.z - 60, from: 'ground', sector: c.name });
          g.nav.say('m6b', 'Something much bigger is coming out of the crater. That must be the mother!', 3, 0);
        }
      }
      g.fp.craterCd = Math.max(g.fp.craterCd, s.stage ? 9999 : 0); // it only wakes up once
    },
    goal: (g, s) => (s.stage ? 'Defeat everything from the crater' : 'Go to the crater (southwest)'),
    done: (g, s) => s.stage === 2 && noneComing(g),
    failed: () => null,
    win: 'The crater is quiet now. Nothing else is coming out of there.',
  },
  {
    title: 'The Uber Pod',
    brief: 'The war machine is here: the Uber Pod. Taller, with laser mini guns and big lasers, and it sees you from far away. Normal weapons only leave a red mark. You need an Energy Sword or a Laser Blaster.',
    start(g, s) { g.queueTripod('uber'); s.sent = true; s.next = 80; },
    tick(g, s, dt) { s.next -= dt; if (s.next <= 0 && living(g).length < 2 && !g.warnings.length) { s.next = 80; g.queueTripod('attacker'); } },
    goal: () => 'Destroy the Uber Pod (Energy Sword or Laser Blaster only)',
    done: (g, s) => s.sent && g.kaijus.some((k) => k.type === 'uber' && k.dead),
    failed: () => null,
    win: 'You destroyed the Uber Pod! But the lightning is not stopping. Something even bigger is coming.',
    needsSpecial: true,
  },
  {
    title: 'The Emperor Pod',
    brief: 'The leader of the invasion: the Emperor Pod. It is taller than every other tripod. It shoots like an Uber Pod, harvests like a Harvester, and stomps. Destroy it before it takes 10 survivors. Only an Energy Sword or a Laser Blaster can hurt it.',
    start(g, s) { g.queueTripod('emperor'); s.sent = true; },
    goal: (g) => `Destroy the Emperor Pod (it has taken ${g.camps.harvested}/10)`,
    done: (g, s) => s.sent && g.kaijus.some((k) => k.type === 'emperor' && k.dead),
    failed: (g) => (g.camps.harvested >= 10 ? 'The Emperor Pod filled its cage with survivors.' : null),
    win: 'You destroyed the Emperor Pod! The invasion is broken, and the survivors can come out. You did it, pilot!',
    needsSpecial: true,
  },
];
