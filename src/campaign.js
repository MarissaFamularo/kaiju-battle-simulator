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

import { CoreReactor } from './entities/ship.js';

const s0 = { Reactor: CoreReactor };
const STORE = 'kbs.campaign.v1';
export function campaignProgress() {
  try {
    // Part 2 was added after Patrick had already finished mission 8: open mission 9 for anyone who had reached the old end
    if (!localStorage.getItem('kbs.campaign.part2')) {
      localStorage.setItem('kbs.campaign.part2', '1');
      if ((parseInt(localStorage.getItem(STORE) || '0', 10) || 0) >= 7) localStorage.setItem(STORE, '8');
    }
  } catch (e) { /* storage blocked */ }
  try { return Math.max(0, Math.min(MISSIONS.length - 1, parseInt(localStorage.getItem(STORE) || '0', 10) || 0)); } catch (e) { return 0; }
}
export function unlockMission(i) {
  try { if (i > campaignProgress()) localStorage.setItem(STORE, String(Math.min(MISSIONS.length - 1, i))); } catch (e) { /* storage blocked */ }
}

const living = (g, pred = () => true) => g.kaijus.filter((k) => !k.dead && !k.friendly && pred(k)); // friends do not count as enemies
const noneComing = (g) => !g.warnings.length && !living(g).length;
const dist = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
const beaten = (g, type) => g.stats.byType[type] || 0;                     // how many of this tripod type are destroyed
const around = (g, type) => living(g, (k) => k.type === type).length + g.warnings.filter((w) => w.type === type).length;

// Adds a boss fight to the end of a mission: when the mission's own goal is done, the boss version
// of that pod rises, and the mission is won when the boss and everything it made are destroyed.
function withBoss(m, boss, bossName) {
  return {
    ...m,
    brief: `${m.brief} Then its Boss Pod shows up!`,
    start(g, s) { s.bossSent = false; m.start(g, s); },
    tick(g, s, dt) {
      if (m.tick && !s.bossSent) m.tick(g, s, dt);
      if (!s.bossSent && m.done(g, s)) {
        s.bossSent = true;
        g.hud.alert('A BOSS POD IS COMING!', 5, true);
        g.queueTripod(boss, true);
      }
    },
    goal: (g, s) => (s.bossSent ? (beaten(g, boss) ? 'Destroy everything that came out of it' : `Destroy the Boss Pod: ${bossName}`) : m.goal(g, s)),
    done: (g, s) => s.bossSent && beaten(g, boss) >= 1 && noneComing(g),
  };
}

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
    win: 'You destroyed the Emperor Pod! But the scouts are reporting new kinds of tripods, and something they call Boss Pods.',
    needsSpecial: true, needsLaser: true,
  },
  // ------------------------------------------------------------------ PART 2: THE BOSS PODS
  // Patrick finished part 1 on 2026-11-27 and asked for new missions with five new tripods and boss
  // pods, starting with a mission where the other mechs destroy tripods until the boss pods come.
  {
    title: 'Scout Squadron',
    brief: 'Part 2! Four Scout Jaegers are fighting tripods in the ruined city. Help them destroy 4 tripods. But be ready: the scouts say a Boss Pod is on its way.',
    scouts: 4, scoutPower: 3,   // a veteran squadron, so you really see them win
    start(g, s) { s.sent = 0; s.boss = false; g.nav.say('m9', 'Your Scout Squadron is here: Comet, Falcon, Nova and Blaze. Watch them work, and help them out!', 3, 0); },
    tick(g, s) {
      if (!s.boss && s.sent < 4 && around(g, 'attacker') < 2 && g.ms.t > 7) { s.sent++; g.queueTripod('attacker', true); }
      if (!s.boss && beaten(g, 'attacker') >= 4) {
        s.boss = true;
        g.hud.alert('THE BOSS POD IS COMING!', 5, true);
        g.queueTripod('stormking', true);
      }
    },
    goal: (g, s) => (s.boss ? 'Destroy the Boss Pod: Storm King' : `Help the scouts destroy 4 tripods (${Math.min(4, beaten(g, 'attacker'))}/4)`),
    done: (g, s) => s.boss && beaten(g, 'stormking') >= 1,
    failed: () => null,
    win: 'The Storm King is down! Your squadron is cheering. But that was only the first Boss Pod.',
  },
  withBoss({
    title: 'Catch the Sprinters',
    brief: 'A new tripod: the Sprinter Pod. Small, fast and hard to catch. Three of them are racing around. Destroy all 3.',
    start(g, s) { s.sent = 0; },
    tick(g, s) { if (s.sent < 3 && around(g, 'sprinter') < 2) { s.sent++; g.queueTripod('sprinter', s.sent === 1); } },
    goal: (g) => `Destroy 3 Sprinter Pods (${Math.min(3, beaten(g, 'sprinter'))}/3)`,
    done: (g) => beaten(g, 'sprinter') >= 3,
    failed: () => null,
    win: 'All the Sprinters and the Boss Sprinter are caught! Nothing outruns you.',
  }, 'sprinterBoss', 'Boss Sprinter'),
  withBoss({
    title: 'Break the Shield',
    brief: 'A new tripod: the Shield Pod. A blue bubble soaks up your shots. Keep hitting until the bubble pops, then finish it before the bubble grows back. Destroy 2.',
    start(g, s) { s.sent = 1; g.queueTripod('shield', true); },
    tick(g, s) { if (s.sent < 2 && beaten(g, 'shield') >= 1 && around(g, 'shield') < 1) { s.sent++; g.queueTripod('shield'); } },
    goal: (g) => `Destroy 2 Shield Pods (${Math.min(2, beaten(g, 'shield'))}/2)`,
    done: (g) => beaten(g, 'shield') >= 2,
    failed: () => null,
    win: 'Every shield popped, even the giant one. Great shooting!',
  }, 'shieldBoss', 'Boss Shield'),
  withBoss({
    title: 'Fire From the Sky',
    brief: 'A new tripod: the Mortar Pod. It stays far away and lobs slow fire bombs in a high arc. Watch the sky, keep moving, and get in close. Destroy 2.',
    start(g, s) { g.queueTripod('mortar'); g.queueTripod('mortar'); },
    goal: (g) => `Destroy 2 Mortar Pods (${Math.min(2, beaten(g, 'mortar'))}/2)`,
    done: (g) => beaten(g, 'mortar') >= 2,
    failed: () => null,
    win: 'No more fire bombs! Even the Boss Mortar could not hit you.',
  }, 'mortarBoss', 'Boss Mortar'),
  withBoss({
    title: 'Ghost Hunt',
    brief: 'A new tripod: the Ghost Pod. It is almost invisible and it hides from your radar. Look for its scanner light moving on the ground. Find and destroy 2.',
    start(g, s) { g.queueTripod('ghost', true); g.queueTripod('ghost', true); },
    goal: (g) => `Find and destroy 2 Ghost Pods (${Math.min(2, beaten(g, 'ghost'))}/2)`,
    done: (g) => beaten(g, 'ghost') >= 2,
    failed: () => null,
    win: 'You found every ghost, even the Boss Ghost. They cannot hide from you.',
  }, 'ghostBoss', 'Boss Ghost'),
  withBoss({
    title: 'Double Trouble',
    brief: 'A new tripod: the Splitter Pod. When you destroy it, two Sprinter Pods climb out of the wreck! Destroy the Splitter and both Sprinters.',
    start(g, s) { g.queueTripod('splitter', true); },
    goal: (g) => (beaten(g, 'splitter') ? `Destroy the Sprinters that came out (${Math.min(2, beaten(g, 'sprinter'))}/2)` : 'Destroy the Splitter Pod'),
    done: (g) => beaten(g, 'splitter') >= 1 && beaten(g, 'sprinter') >= 2,
    failed: () => null,
    win: 'One Boss Pod turned into seven pods, and you beat every one of them!',
  }, 'splitterBoss', 'Boss Splitter'),
  {
    title: 'The Overlord',
    brief: 'The last and biggest Boss Pod: the Overlord. It has a shield, it stomps, it fires a big laser, and it calls Sprinter Pods to help. Your Scout Squadron is coming with you. Pop the shield and bring it down!',
    scouts: 3,
    start(g, s) { g.queueTripod('overlord', true); },
    goal: () => 'Destroy the Boss Pod: Overlord',
    done: (g) => beaten(g, 'overlord') >= 1,
    failed: () => null,
    win: 'THE OVERLORD IS DESTROYED! Every Boss Pod is beaten. Now the Earth Cannon is ready to fire at the enemy planet!',
    ending: 'planet',   // plays the ending scene: the laser, the planet, the fleet
  },
  // ------------------------------------------------------------------ PART 3: THE FLEET
  // Patrick, 2026-11-27: "All the tripods used to be asleep but now they are awake, so the ships are in
  // orbit and are entering the atmosphere and are sending more and more ships. But it took years for the
  // ships to get to Earth, so humans are now a type three race, so more weapons. Now all weapons are from
  // the future, so all weapons can hurt tripods." The missions themselves are Claude's calls.
  {
    title: 'Years Later',
    part: 3,
    brief: 'Part 3! The fleet took years to reach the Earth. In that time humans became a Type Three civilization and invented weapons from the future: every weapon can hurt every tripod now, and there are three new ones in the hangar. The ships are in orbit. The first ones are coming down. Each ship drops its tripods and flies away. Shoot it down before it finishes if you can, and destroy every tripod it drops.',
    start(g, s) { s.sent = 1; g.queueShip(['attacker', 'attacker']); },
    tick(g, s) { if (s.sent < 2 && g.stats.shipsGone >= 1) { s.sent++; g.queueShip(['flame', 'thunder']); } },
    goal: (g) => (g.stats.shipsGone >= 2 ? 'Destroy the tripods they dropped' : `Stop 2 alien ships and their tripods (ship ${Math.min(2, g.stats.shipsGone + 1)}/2)`),
    done: (g) => g.stats.shipsGone >= 2 && noneComing(g),
    failed: () => null,
    win: 'Two ships dealt with! But look up: the sky is full of them, and you can see what is left of their planet.',
  },
  {
    title: 'They Are All Awake',
    part: 3, scouts: 3, scoutPower: 2,
    brief: 'The tripods that were asleep underground have ALL woken up. No more lightning: six of them are already walking around the map, and five are new kinds from the fleet: Sniper, Repair, Flame, Thunder and Titan. Hunt them down with your Scout Squadron. Destroy all 6.',
    start(g, s) {
      const types = ['attacker', 'sniper', 'repair', 'flame', 'thunder', 'titan'];
      const B = g.city.bound - 200;
      types.forEach((type, i) => {
        const a = (i / types.length) * 6.28 + Math.random() * 0.6, d = 550 + Math.random() * 500;
        const x = Math.max(-B, Math.min(B, g.mech.pos.x + Math.cos(a) * d)), z = Math.max(g.city.waterEdge + 150, Math.min(B, g.mech.pos.z + Math.sin(a) * d));
        g.spawnAwake(type, x, z);
      });
      s.sent = true;
      g.hud.alert('6 TRIPODS ARE AWAKE', 4, true);
    },
    goal: (g) => `Hunt down the awake tripods (${Math.min(6, g.stats.tripods)}/6)`,
    done: (g, s) => s.sent && g.stats.tripods >= 6 && noneComing(g),
    failed: () => null,
    win: 'All six hunted down. Nothing is asleep any more, and nothing got past you.',
  },
  {
    title: 'More and More Ships',
    part: 3, scouts: 2,
    brief: 'They are sending more and more ships. First one, then two, then three at once. They drop their tripods and leave. Shoot down the ones you can, and destroy everything they drop.',
    start(g, s) { s.wave = 0; s.wait = 0; },
    tick(g, s, dt) {
      if (s.wave >= 3 || !noneComing(g)) return;
      s.wait -= dt;
      if (s.wait > 0) return;
      s.wave++; s.wait = 6;
      const cargo = [['attacker', 'flame'], ['sniper', 'repair'], ['thunder', 'sprinter']];
      for (let i = 0; i < s.wave; i++) g.queueShip(cargo[i]);
      g.hud.alert(`WAVE ${s.wave} OF 3: ${s.wave} SHIP${s.wave > 1 ? 'S' : ''}`, 4, true);
    },
    goal: (g, s) => `Wave ${Math.max(1, s.wave || 1)}/3: destroy everything the ships drop (${beaten(g, 'ship')} shot down)`,
    done: (g, s) => s.wave >= 3 && g.stats.shipsGone >= 6 && noneComing(g),
    failed: () => null,
    win: 'Three waves beaten! But something huge just moved in front of the moon.',
  },
  {
    title: 'The Mothership',
    part: 3, scouts: 3,   // normal-strength scouts, so the Mothership is yours to shoot down
    brief: 'The Mothership is coming down. It is the biggest ship in the fleet and it is full of tripods. This one does NOT leave. Aim for the glowing core underneath it. Bring it down, and destroy everything it drops!',
    start(g, s) { g.queueShip(['attacker', 'flame', 'repair', 'thunder', 'sniper', 'titan'], 'mothership'); s.sent = true; },
    goal: (g) => (beaten(g, 'mothership') ? 'Destroy everything it dropped' : 'Shoot down the Mothership'),
    done: (g, s) => s.sent && beaten(g, 'mothership') >= 1 && noneComing(g),
    failed: () => null,
    win: 'THE MOTHERSHIP IS DOWN! The fleet is pulling back. But the kaiju are watching us, and they do not look angry any more...',
  },
  // ------------------------------------------------------------------ PART 4: THE WAR
  // Patrick, 2026-11-27: "The people link with the kaiju to make friends and save their home. But ten new
  // tripods, and now it's a war, so more campaign, more tripods spawn faster. Humans made their own tripods,
  // looks very different. And one of the missions has us sneak into the tripods' base under the earth in its
  // core. Could you make, when they sneak in, a funny animation?" The missions are Claude's calls.
  {
    title: 'The Link',
    part: 4, friends: 1,
    brief: 'Part 4: THE WAR. The aliens are wrecking the kaiju\'s home too. So a pilot tried something new: linking minds with a kaiju. It worked! A kaiju with a blue halo is your friend now. Fight three waves of brand new tripods together.',
    start(g, s) { s.wave = 0; s.wait = 4; },
    tick(g, s, dt) {
      if (s.wave >= 3 || !noneComing(g)) return;
      s.wait -= dt;
      if (s.wait > 0) return;
      s.wave++; s.wait = 5;
      const cargo = [['tank', 'gatling'], ['blink', 'boom', 'boom'], ['magnet', 'leech']];
      g.queueShip(cargo[s.wave - 1]);
      g.hud.alert(`WAVE ${s.wave} OF 3`, 4, true);
      if (!g.kaijus.some((k) => k.friendly && !k.dead && !k.isTripod)) g.spawnFriend(); // a new friend links in if the last one fell
    },
    goal: (g, s) => `Fight beside your kaiju friend: wave ${Math.max(1, s.wave || 1)}/3`,
    done: (g, s) => s.wave >= 3 && g.stats.shipsGone >= 3 && noneComing(g),
    failed: () => null,
    win: 'You and your kaiju friend beat them all! More kaiju are linking with pilots every day.',
  },
  {
    title: 'Our Own Walkers',
    part: 4, walkers: 3,
    brief: 'Humans have built their own walkers! They look nothing like the alien ones: white and yellow, with a square cabin and blue lights. Three Guardian Walkers are with you. Together, destroy the Commander Pod and its army.',
    start(g, s) {
      const types = ['commander', 'shadow', 'acid', 'attacker', 'gatling'];
      const B = g.city.bound - 200;
      types.forEach((type, i) => {
        const a = g.view.yaw + (i - 2) * 0.5, d = 480 + Math.random() * 260;
        g.spawnAwake(type, Math.max(-B, Math.min(B, g.mech.pos.x + Math.sin(a) * d)), Math.max(g.city.waterEdge + 150, Math.min(B, g.mech.pos.z + Math.cos(a) * d)));
      });
      s.sent = true;
      g.hud.alert('THE COMMANDER AND ITS ARMY ARE AHEAD', 4, true);
    },
    goal: (g) => (beaten(g, 'commander') ? 'Destroy the rest of its army' : 'Destroy the Commander Pod and its army'),
    done: (g, s) => s.sent && beaten(g, 'commander') >= 1 && noneComing(g),
    failed: () => null,
    win: 'The Commander is scrap! Our walkers work. The factories are building hundreds more.',
  },
  {
    title: 'All-Out War',
    part: 4, friends: 1, walkers: 2, scouts: 2,
    brief: 'This is war. Tripods are coming faster than ever, and they are all different. You have a kaiju friend, two Guardian Walkers and two Scout Jaegers. Destroy 14 tripods!',
    start(g, s) { s.sent = 0; s.wait = 3; },
    tick(g, s, dt) {
      s.wait -= dt;
      if (s.sent >= 14 || s.wait > 0) return;
      if (living(g).length + g.warnings.length >= (g.lowPower ? 4 : 5)) return;
      s.wait = 6;
      const types = ['tank', 'gatling', 'blink', 'boom', 'magnet', 'leech', 'acid', 'shadow', 'attacker', 'sprinter', 'flame', 'thunder'];
      s.sent++;
      g.queueTripod(types[Math.floor(Math.random() * types.length)], Math.random() < 0.7);
    },
    goal: (g) => `Destroy 14 tripods (${Math.min(14, g.stats.tripods)}/14)`,
    done: (g, s) => s.sent >= 14 && g.stats.tripods >= 14 && noneComing(g),
    failed: () => null,
    win: 'Fourteen down! We are winning the war on the surface. Now we know where they are coming from: a base, deep under the Earth.',
  },
  {
    title: 'Into the Core',
    part: 4, core: true, cutscene: 'sneak',
    brief: 'The tripods have a base under the Earth, in its core. You are going to sneak in through the crater, wearing a tripod costume. (It is not a very good costume.) Get past the guards, destroy the Core Reactor, then run back out before the cave falls in!',
    startAt: (g) => { const c = g.city.places.crater; return { x: c.x + 330, z: c.z + 250 }; },
    start(g, s) {
      const c = g.city.places.crater;
      s.exit = { x: g.mech.pos.x, z: g.mech.pos.z };
      s.reactor = g.enterCore(c.x, c.z);
      g.fp.craterCd = 99999; // the crater monsters are not home
      for (const [type, a] of [['attacker', 0.6], ['gatling', 2.4], ['tank', 4.2]]) g.spawnAwake(type, c.x + Math.cos(a) * 190, c.z + Math.sin(a) * 190);
      g.nav.say('core', 'You are in! This is the tripods\' base. The glowing ball in the middle is the Core Reactor. Stay out of the guards\' lights for as long as you can, then destroy it!', 3, 0);
    },
    tick(g, s, dt) {
      if (!s.reactor || !s.reactor.dead) return;
      if (s.escape === undefined) {
        s.escape = 80;
        g.hud.alert('THE CORE IS COLLAPSING! RUN BACK TO THE TUNNEL', 6, true);
        g.nav.say('coreRun', 'The reactor is destroyed and the whole cave is coming down! Run back to where you came in. Go, go, go!', 3, 0);
      }
      s.escape -= dt;
      if (Math.random() < 0.25) g.shake(0.5);
      if (Math.random() < 0.3) { const a = Math.random() * 6.28, d = Math.random() * 500; g.fx.groundDust(g.mech.pos.clone().add({ x: Math.cos(a) * d, y: 4, z: Math.sin(a) * d }), 60, 20); }
    },
    goal: (g, s) => (s.escape === undefined ? 'Destroy the Core Reactor' : `RUN back to the tunnel! ${Math.max(0, Math.ceil(s.escape))} seconds  (${Math.round(dist(g.mech.pos, s.exit))} away)`),
    done: (g, s) => s.escape !== undefined && s.escape < 76 && dist(g.mech.pos, s.exit) < 90, // (a few seconds in, so the collapse always gets to start)
    failed: (g, s) => (s.escape !== undefined && s.escape <= 0 ? 'The core collapsed before you got out.' : null),
    win: 'You made it out! The base under the Earth is gone. No more tripods will ever wake up down there.',
  },
  {
    title: 'The Colossus',
    part: 4, friends: 1, walkers: 2, scouts: 2,
    brief: 'The aliens have one machine left: the Colossus Pod, the biggest walker ever built. Everyone is here for this one: your kaiju friend, the Guardian Walkers and the Scout Jaegers. Bring it down and save the home we all share!',
    start(g, s) { g.queueTripod('colossus', true); g.queueTripod('gatling', true); s.sent = true; s.next = 30; },
    tick(g, s, dt) { s.next -= dt; if (s.next <= 0 && beaten(g, 'colossus') < 1 && living(g).length < 3 && !g.warnings.length) { s.next = 30; g.queueTripod(['boom', 'blink', 'tank'][Math.floor(Math.random() * 3)], true); } },
    goal: (g) => (beaten(g, 'colossus') ? 'Destroy the last tripods' : 'Bring down the Colossus Pod'),
    done: (g, s) => s.sent && beaten(g, 'colossus') >= 1 && noneComing(g),
    failed: () => null,
    win: 'THE COLOSSUS HAS FALLEN! Humans and kaiju saved their home together, and you led the way, pilot! Wait... we are picking up a signal.',
    ending: 'message',   // plays the message from the aliens
  },
  // ------------------------------------------------------------------ PART 5: THE ALIEN PLANET
  // Patrick, 2026-11-27: "In part five the Venture Stars deliver hundreds of mechs like Titans, Rangers and
  // the walking Guardians, hundreds, and they are all on the planet. Then we plant a bomb and the planet
  // goes boom." The missions are Claude's calls.
  {
    title: 'The Venture Stars',
    part: 5, alien: true, cutscene: 'venture', scouts: 4, walkers: 2, allyFrames: ['titan', 'ranger', 'scout'], scoutPower: 2,
    brief: 'Part 5! Giant ships called Venture Stars have carried hundreds of mechs to the alien planet: Titans, Rangers and Guardian Walkers. The whole army is down. But the planet has a shield, and the bomb cannot come through it. Destroy the 3 Shield Generators!',
    startAt: (g) => { const c = g.city.places.forest; return { x: c.x + 250, z: c.z + 250 }; },
    start(g, s) {
      s.gens = [];
      const m = g.mech.pos, B = g.city.bound - 250;
      for (let i = 0; i < 3; i++) {
        const a = g.mech.yaw + (i - 1) * 0.9, d = 600 + i * 160;
        const x = Math.max(-B, Math.min(B, m.x + Math.sin(a) * d)), z = Math.max(g.city.waterEdge + 200, Math.min(B, m.z + Math.cos(a) * d));
        const gen = new s0.Reactor(g, { x, z, generator: true });
        g.kaijus.push(gen); s.gens.push(gen);
        g.spawnAwake(['attacker', 'gatling', 'tank'][i], x + 90, z + 60);
      }
      g.hud.alert('DESTROY THE 3 SHIELD GENERATORS', 5, true);
      g.nav.say('p5', 'We are on their planet. Look at the green grid in the sky: that is the shield. The three Shield Generators are the green glowing balls ahead, with beams going up. Your army is right behind you!', 3, 0);
    },
    tick(g, s) {
      if (s.gens && !g.shieldDown && beaten(g, 'generator') >= 3) {
        g.shieldDown = true;
        g.hud.alert('THE SHIELD IS DOWN!', 5, true);
        g.nav.say('shieldDown', 'The shield is gone! Look up, the sky is clear. Now the bomb can come down.', 3, 0);
      }
    },
    goal: (g) => (beaten(g, 'generator') >= 3 ? 'Destroy the last guards' : `Destroy the Shield Generators (${Math.min(3, beaten(g, 'generator'))}/3)`),
    done: (g, s) => !!s.gens && beaten(g, 'generator') >= 3 && noneComing(g),
    failed: () => null,
    win: 'The shield is down! The Venture Stars are bringing the bomb.',
  },
  {
    title: 'Hold the Landing Zone',
    part: 5, alien: true, scouts: 4, walkers: 2, friends: 1, allyFrames: ['titan', 'ranger', 'scout'],
    brief: 'The aliens know we are here, and they are throwing everything at the landing zone while the bomb is unloaded. You have Titans, Rangers, Guardian Walkers and a kaiju friend. Destroy 16 tripods and hold the line!',
    startAt: (g) => { const c = g.city.places.forest; return { x: c.x + 250, z: c.z + 250 }; },
    start(g, s) { s.sent = 0; s.wait = 3; g.shieldDown = true; },
    tick(g, s, dt) {
      s.wait -= dt;
      if (s.sent >= 16 || s.wait > 0) return;
      if (living(g).length + g.warnings.length >= (g.lowPower ? 4 : 5)) return;
      s.wait = 5;
      const types = ['tank', 'gatling', 'blink', 'boom', 'magnet', 'leech', 'acid', 'attacker', 'sprinter', 'flame', 'thunder', 'shield', 'commander'];
      s.sent++;
      g.queueTripod(types[Math.floor(Math.random() * types.length)], true);
    },
    goal: (g) => `Hold the landing zone: destroy 16 tripods (${Math.min(16, g.stats.tripods)}/16)`,
    done: (g, s) => s.sent >= 16 && g.stats.tripods >= 16 && noneComing(g),
    failed: () => null,
    win: 'The landing zone held! The bomb is ready. It is the size of a house, and only a Jaeger can carry it.',
  },
  {
    title: 'Plant the Bomb',
    part: 5, alien: true, scouts: 3, walkers: 2, allyFrames: ['titan', 'ranger', 'scout'], ending: 'bomb',
    brief: 'This is it. Carry the bomb to the red beam of light, hold still for 6 seconds to plant it, then RUN back to the blue beam where the Venture Star will pick you up. You get 90 seconds. Then the planet goes boom.',
    startAt: (g) => { const c = g.city.places.forest; return { x: c.x + 250, z: c.z + 250 }; },
    start(g, s) {
      g.shieldDown = true;
      const m = g.mech.pos, B = g.city.bound - 250;
      s.exit = { x: m.x, z: m.z };
      s.site = { x: Math.max(-B, Math.min(B, m.x + Math.sin(g.mech.yaw) * 820)), z: Math.max(g.city.waterEdge + 200, Math.min(B, m.z + Math.cos(g.mech.yaw) * 820)) };
      g.addBeacon(s.site.x, s.site.z, '#ff3a3a');
      g.addBeacon(s.exit.x, s.exit.z, '#38a8ff');
      s.stage = 0; s.plant = 0; s.next = 8;
      g.nav.say('bomb', 'You are carrying the bomb. Walk to the RED beam of light straight ahead. Your army will keep the tripods busy.', 3, 0);
    },
    tick(g, s, dt) {
      s.next -= dt;
      if (s.next <= 0 && living(g).length + g.warnings.length < 3) { s.next = 12; g.queueTripod(['attacker', 'gatling', 'boom', 'blink', 'tank', 'flame'][Math.floor(Math.random() * 6)], true); }
      if (s.stage === 0 && dist(g.mech.pos, s.site) < 85) { s.stage = 1; g.hud.alert('HOLD STILL: PLANTING THE BOMB', 4, true); }
      if (s.stage === 1) {
        if (dist(g.mech.pos, s.site) < 120) s.plant += dt;
        if (s.plant >= 6) {
          s.stage = 2; s.timer = 90;
          g.hud.alert('BOMB PLANTED! RUN TO THE BLUE BEAM', 6, true);
          g.nav.say('bombRun', 'The bomb is planted and it is counting down! Run back to the BLUE beam. The Venture Star is waiting. Go, go, go!', 3, 0);
        }
      }
      if (s.stage === 2) s.timer -= dt;
    },
    goal: (g, s) => (s.stage === 2 ? `RUN to the blue beam! ${Math.max(0, Math.ceil(s.timer))} seconds  (${Math.round(dist(g.mech.pos, s.exit))} away)`
      : s.stage === 1 ? `Planting the bomb: hold still ${Math.max(0, Math.ceil(6 - s.plant))}`
        : `Carry the bomb to the red beam (${s.site ? Math.round(dist(g.mech.pos, s.site)) : '?'} away)`),
    done: (g, s) => s.stage === 2 && dist(g.mech.pos, s.exit) < 100,
    failed: (g, s) => (s.stage === 2 && s.timer <= 0 ? 'The bomb went off before you reached the Venture Star.' : null),
    win: 'You are aboard the Venture Star! Everyone is clear. Three... two... one...',
  },
  // ------------------------------------------------------------------ PART 6: THE CORRUPTED EARTH
  // Patrick, 2026-11-27: "After that I don't want the war to end. Some baby tripods, then they make more
  // tripods, and when the humans get back they see Earth was corrupted." The war ends in part 10, not before.
  {
    title: 'Home?',
    part: 6, corrupt: true, cutscene: 'corrupted', scouts: 2, allyFrames: ['ranger', 'scout'],
    brief: 'Part 6! You are home. But some Baby Tripods escaped the explosion and got to the Earth first. They grew up, they built more, and now the whole Earth is corrupted. The city is crawling with Baby Tripods. Destroy 14 of them, and be quick: a baby left alone grows up into an Attacker!',
    start(g, s) { s.sent = 0; s.wait = 2; },
    tick(g, s, dt) {
      s.wait -= dt;
      if (s.sent >= 14 || s.wait > 0 || living(g).length >= (g.lowPower ? 5 : 7)) return;
      s.wait = 7;
      const a = Math.random() * 6.28, d = 240 + Math.random() * 200, B = g.city.bound - 200;
      for (let i = 0; i < 3 && s.sent < 14; i++, s.sent++) g.spawnAwake('baby', Math.max(-B, Math.min(B, g.mech.pos.x + Math.cos(a) * d + i * 35)), Math.max(g.city.waterEdge + 150, Math.min(B, g.mech.pos.z + Math.sin(a) * d + (i % 2) * 35)));
      g.hud.alert('BABY TRIPODS!', 2.5, true);
      if (s.sent === 3) g.nav.say('rise_baby', 'Baby Tripods! They are tiny and quick, and they do not hit hard. But leave one alone for long and it grows up into a full Attacker Tripod. Get them while they are small!', 3, 0);
    },
    goal: (g) => `Destroy the Baby Tripods before they grow up (${Math.min(14, beaten(g, 'baby'))}/14 babies, ${beaten(g, 'attacker')} grown-ups)`,
    done: (g, s) => s.sent >= 14 && noneComing(g),
    failed: () => null,
    win: 'The babies are gone from this street. But where are they all coming from?',
  },
  {
    title: 'The Factory Pods',
    part: 6, corrupt: true, scouts: 2, walkers: 1, allyFrames: ['titan', 'ranger'],
    brief: 'Now we know how they make more tripods: Factory Pods. Each one is a slow walking factory that keeps building Baby Tripods. There are 3 of them. Destroy all 3, and every baby they built.',
    start(g, s) {
      const B = g.city.bound - 250, m = g.mech.pos;
      for (let i = 0; i < 3; i++) { const a = g.mech.yaw + (i - 1) * 1.1, d = 520 + i * 170; g.spawnAwake('factory', Math.max(-B, Math.min(B, m.x + Math.sin(a) * d)), Math.max(g.city.waterEdge + 200, Math.min(B, m.z + Math.cos(a) * d))); }
      s.sent = true;
      g.hud.alert('3 FACTORY PODS ARE BUILDING BABIES', 5, true);
      g.nav.say('rise_factory', 'Factory Pods! That is how they make more tripods. Each one keeps building Baby Tripods until you destroy it. They are the big brown ones on your radar.', 3, 0);
    },
    goal: (g) => (beaten(g, 'factory') >= 3 ? 'Destroy the last babies and grown-ups' : `Destroy the Factory Pods (${Math.min(3, beaten(g, 'factory'))}/3)`),
    done: (g, s) => s.sent && beaten(g, 'factory') >= 3 && noneComing(g),
    failed: () => null,
    win: 'All three factories are scrap! No more babies from them. Now for the purple stuff growing everywhere.',
  },
  {
    title: 'Hearts of the Corruption',
    part: 6, corrupt: true, scouts: 2, walkers: 2, friends: 1, allyFrames: ['titan', 'ranger'],
    brief: 'The purple growths are fed by Corruption Hearts: glowing purple balls hidden around the city. Destroy all 5 to clean this part of the Earth. Tripods are guarding them, and your kaiju friend and the Guardian Walkers are back to help.',
    start(g, s) {
      s.hearts = [];
      const B = g.city.bound - 250, m = g.mech.pos;
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * 6.28 + 0.4, d = 480 + (i % 2) * 260;
        const x = Math.max(-B, Math.min(B, m.x + Math.cos(a) * d)), z = Math.max(g.city.waterEdge + 200, Math.min(B, m.z + Math.sin(a) * d));
        const h = new s0.Reactor(g, { x, z, heart: true });
        g.kaijus.push(h); s.hearts.push(h);
        g.spawnAwake(['attacker', 'gatling', 'baby', 'flame', 'tank'][i], x + 80, z + 50);
      }
      s.next = 25;
      g.hud.alert('DESTROY THE 5 CORRUPTION HEARTS', 5, true);
    },
    tick(g, s, dt) { s.next -= dt; if (s.next <= 0 && beaten(g, 'heart') < 5 && living(g, (k) => !k.isShip).length < 3) { s.next = 25; for (let i = 0; i < 2; i++) g.spawnAwake('baby', g.mech.pos.x + 200 + i * 40, g.mech.pos.z + 180); } },
    goal: (g) => (beaten(g, 'heart') >= 5 ? 'Destroy the last guards' : `Destroy the Corruption Hearts (${Math.min(5, beaten(g, 'heart'))}/5)`),
    done: (g, s) => !!s.hearts && beaten(g, 'heart') >= 5 && noneComing(g),
    failed: () => null,
    win: 'The city is clean again! But this was only one city. The whole Earth is still corrupted, and the war is far from over.',
  },
  // ------------------------------------------------------------------ PART 7: THE NEW DIMENSION
  // Patrick, 2026-11-27: "This time the tripods got an advantage. They learn how to make ultra pods that
  // have the power of all of the tripods combined and is as tall as five mechs, and are trying to make a new
  // dimension with planets, and the mechs are trying to stop them."
  {
    title: 'The Ultra Pod',
    part: 7, corrupt: true, rift: true, scouts: 4, walkers: 2, friends: 1, allyFrames: ['titan', 'ranger', 'titan', 'scout'],
    brief: 'Part 7! The tripods have the advantage now. They have learned to build an ULTRA POD: as tall as five Jaegers, with the power of every tripod combined. And look at the sky: they are tearing open a new dimension. Every mech we have is here. Bring the Ultra Pod down!',
    start(g, s) {
      const m = g.mech.pos, B = g.city.bound - 300;
      g.spawnAwake('ultra', Math.max(-B, Math.min(B, m.x + Math.sin(g.mech.yaw) * 520)), Math.max(g.city.waterEdge + 250, Math.min(B, m.z + Math.cos(g.mech.yaw) * 520)));
      s.sent = true;
      g.hud.alert('ULTRA POD!', 5, true);
      g.nav.say('rise_ultra', 'An ULTRA POD! It is as tall as five Jaegers and it has the power of every tripod at once: a shield, lasers, fire bombs, lightning, a magnet and giant feet. Pop the shield, stay out of the blue rings, and do NOT stand under it!', 3, 0);
    },
    goal: (g) => (beaten(g, 'ultra') ? 'Destroy the tripods it called' : 'Bring down the ULTRA POD'),
    done: (g, s) => s.sent && beaten(g, 'ultra') >= 1 && noneComing(g),
    failed: () => null,
    win: 'The Ultra Pod is down! It took all of us. And they are building more.',
  },
  {
    title: 'The Pylons',
    part: 7, corrupt: true, rift: true, scouts: 3, walkers: 2, allyFrames: ['titan', 'ranger', 'scout'],
    brief: 'The rift in the sky is growing. Four blue Gate Pylons on the ground are feeding it. Destroy all 4 before the new dimension opens all the way! Each pylon you destroy slows it down.',
    start(g, s) {
      s.pylons = []; s.charge = 0;
      const m = g.mech.pos, B = g.city.bound - 250;
      for (let i = 0; i < 4; i++) {
        const a = (i / 4) * 6.28 + 0.6, d = 520 + (i % 2) * 220;
        const x = Math.max(-B, Math.min(B, m.x + Math.cos(a) * d)), z = Math.max(g.city.waterEdge + 200, Math.min(B, m.z + Math.sin(a) * d));
        const p = new s0.Reactor(g, { x, z, pylon: true });
        g.kaijus.push(p); s.pylons.push(p);
        g.addBeacon(x, z, '#38a8ff');
        g.spawnAwake(['gatling', 'tank', 'shield', 'flame'][i], x + 80, z + 60);
      }
      g.hud.alert('DESTROY THE 4 GATE PYLONS', 5, true);
    },
    tick(g, s, dt) {
      if (!s.pylons) return;
      const left = 4 - Math.min(4, beaten(g, 'pylon'));
      s.charge = Math.min(100, s.charge + dt * left * 0.085);   // about 5 minutes with all four standing
      g.riftK = 0.35 + s.charge / 100 * 0.65;
    },
    goal: (g, s) => `Destroy the Gate Pylons (${Math.min(4, beaten(g, 'pylon'))}/4)   new dimension: ${Math.floor(s.charge || 0)}% open`,
    done: (g, s) => !!s.pylons && beaten(g, 'pylon') >= 4,
    failed: (g, s) => ((s.charge || 0) >= 100 ? 'The new dimension opened all the way.' : null),
    win: 'All four pylons are down and the rift has stopped growing! Now we can reach the Gate itself.',
  },
  {
    title: 'Stop the New Dimension',
    part: 7, corrupt: true, rift: true, scouts: 4, walkers: 2, friends: 1, allyFrames: ['titan', 'ranger', 'titan', 'scout'],
    brief: 'This is the Dimension Gate: a giant glowing ball with new planets already spinning inside it. Two blue pylons protect it and an Ultra Pod guards it. Destroy the 2 pylons, then destroy the Gate before the tripods can walk through to their new dimension!',
    start(g, s) {
      const m = g.mech.pos, B = g.city.bound - 300;
      const gx = Math.max(-B, Math.min(B, m.x + Math.sin(g.mech.yaw) * 700)), gz = Math.max(g.city.waterEdge + 250, Math.min(B, m.z + Math.cos(g.mech.yaw) * 700));
      s.gate = new s0.Reactor(g, { x: gx, z: gz, gate: true }); s.gate.locked = true; g.kaijus.push(s.gate);
      for (const sx of [-1, 1]) { const p = new s0.Reactor(g, { x: gx + sx * 230, z: gz + 60, pylon: true }); g.kaijus.push(p); g.addBeacon(gx + sx * 230, gz + 60, '#38a8ff'); }
      g.spawnAwake('ultra', gx - 60, gz - 260);
      g.riftK = 0.8;
      g.hud.alert('THE DIMENSION GATE', 5, true);
      g.nav.say('gate', 'There it is: the Dimension Gate. You cannot hurt it while the two blue pylons are standing. Pylons first, then the Gate. And watch out for the Ultra Pod!', 3, 0);
    },
    tick(g, s) {
      if (s.gate && s.gate.locked && beaten(g, 'pylon') >= 2) { s.gate.locked = false; g.hud.alert('THE GATE IS OPEN TO ATTACK!', 4, true); g.nav.say('gateOpen', 'Both pylons are down! The Gate can be hurt now. Hit it with everything!', 3, 0); }
      if (s.gate && s.gate.dead) g.riftK = Math.max(0, g.riftK - 0.01);
    },
    goal: (g, s) => (s.gate && s.gate.locked ? `Destroy the 2 pylons protecting the Gate (${Math.min(2, beaten(g, 'pylon'))}/2)` : 'Destroy the Dimension Gate!'),
    done: (g) => beaten(g, 'gate') >= 1,
    failed: () => null,
    win: 'The Gate is destroyed and the rift is closing! But the scouts saw one Ultra Pod walk through just before it closed, and the rift did not close all the way...',
  },
  // ------------------------------------------------------------------ PARTS 8 AND 9: THE COLLIDING REALITIES
  // Patrick, 2026-11-27: "Part 8, the colliding realities. The rift is not stable. More are here. And part 9
  // and part 8 are in the same part." So this block is both parts.
  {
    title: 'The Rift Is Not Stable',
    part: 8, corrupt: true, rift: 3, storm: true, scouts: 3, walkers: 2, allyFrames: ['titan', 'ranger', 'scout'],
    brief: 'Parts 8 and 9: THE COLLIDING REALITIES. The Ultra Pod that got through broke something. The rift is not stable, and now there are three of them. Other realities are crashing into ours: purple lightning, kaiju from somewhere else, and Glitch Pods whose colors keep changing. Destroy 14 of whatever falls out!',
    start(g, s) { s.sent = 0; s.wait = 3; },
    tick(g, s, dt) {
      s.wait -= dt;
      if (s.sent >= 14 || s.wait > 0 || living(g).length + g.warnings.length >= (g.lowPower ? 4 : 5)) return;
      s.wait = 6; s.sent++;
      const a = Math.random() * 6.28, d = 260 + Math.random() * 260, B = g.city.bound - 200;
      const x = Math.max(-B, Math.min(B, g.mech.pos.x + Math.cos(a) * d)), z = Math.max(g.city.waterEdge + 150, Math.min(B, g.mech.pos.z + Math.sin(a) * d));
      if (s.sent % 5 === 0) { g.queueKaiju(4); return; } // a kaiju from another reality: not a friend
      const type = ['glitch', 'glitch', 'blink', 'shadow', 'gatling', 'boom', 'thunder', 'baby'][Math.floor(Math.random() * 8)];
      g.fx.flash({ x, y: g.city.groundAt(x, z) + 60, z }, '#c07dff', 9000, 0.4);
      g.spawnAwake(type, x, z);
      g.hud.alert('SOMETHING FELL OUT OF THE RIFT', 2.5, true);
    },
    goal: (g) => `Destroy what falls out of the rifts (${Math.min(14, g.stats.kills)}/14)`,
    done: (g, s) => s.sent >= 14 && g.stats.kills >= 14 && noneComing(g),
    failed: () => null,
    win: 'That is everything that fell out... for now. The rifts are getting bigger.',
  },
  {
    title: 'More Are Here',
    part: 8, corrupt: true, rift: 4, storm: true, scouts: 4, walkers: 2, friends: 1, allyFrames: ['titan', 'ranger', 'titan', 'scout'],
    brief: 'More are here. Two ULTRA PODS just stepped out of two different rifts at the same time, and they brought Glitch Pods with them. Every mech, every walker and every kaiju friend is on the field. Bring them both down!',
    start(g, s) {
      const m = g.mech.pos, B = g.city.bound - 300;
      for (const sgn of [-1, 1]) g.spawnAwake('ultra', Math.max(-B, Math.min(B, m.x + Math.sin(g.mech.yaw + sgn * 0.7) * 620)), Math.max(g.city.waterEdge + 250, Math.min(B, m.z + Math.cos(g.mech.yaw + sgn * 0.7) * 620)));
      g.spawnAwake('glitch', m.x + 200, m.z + 240); g.spawnAwake('glitch', m.x - 220, m.z + 220);
      s.sent = true;
      g.hud.alert('TWO ULTRA PODS!', 5, true);
    },
    goal: (g) => `Bring down both Ultra Pods (${Math.min(2, beaten(g, 'ultra'))}/2)`,
    done: (g, s) => s.sent && beaten(g, 'ultra') >= 2 && noneComing(g),
    failed: () => null,
    win: 'Both Ultra Pods are down! But the realities are still crashing together. We have to pin them apart.',
  },
  {
    title: 'Realities Collide',
    part: 8, corrupt: true, rift: 5, storm: true, scouts: 3, walkers: 2, friends: 1, allyFrames: ['titan', 'ranger', 'scout'],
    brief: 'Five rifts now, and the planets inside them are drifting into each other. Three Rift Anchors on the ground are holding the realities together. Destroy all 3 so the realities come apart again, while everything from the other side tries to stop you.',
    start(g, s) {
      s.anchors = true;
      const m = g.mech.pos, B = g.city.bound - 250;
      for (let i = 0; i < 3; i++) {
        const a = g.mech.yaw + (i - 1) * 1.2, d = 560 + (i % 2) * 200;
        const x = Math.max(-B, Math.min(B, m.x + Math.sin(a) * d)), z = Math.max(g.city.waterEdge + 200, Math.min(B, m.z + Math.cos(a) * d));
        g.kaijus.push(new s0.Reactor(g, { x, z, pylon: true }));
        g.addBeacon(x, z, '#c07dff');
        g.spawnAwake(['glitch', 'tank', 'shield'][i], x + 80, z + 60);
      }
      g.riftK = 1; s.next = 14;
      g.hud.alert('DESTROY THE 3 RIFT ANCHORS', 5, true);
    },
    tick(g, s, dt) {
      g.riftK = 1 - Math.min(3, beaten(g, 'pylon')) * 0.28;
      s.next -= dt;
      if (s.next <= 0 && beaten(g, 'pylon') < 3 && living(g, (k) => !k.isShip).length < 3) { s.next = 14; g.spawnAwake(['glitch', 'blink', 'boom'][Math.floor(Math.random() * 3)], g.mech.pos.x + 240, g.mech.pos.z + 200); }
    },
    goal: (g) => (beaten(g, 'pylon') >= 3 ? 'Destroy what is left' : `Destroy the Rift Anchors (${Math.min(3, beaten(g, 'pylon'))}/3)`),
    done: (g, s) => !!s.anchors && beaten(g, 'pylon') >= 3 && noneComing(g),
    failed: () => null,
    win: 'The realities are coming apart again! But three Ultra Pods are still on our side of the rift. Good thing we built something too: THE MEGA MECH.',
  },
  // ------------------------------------------------------------------ PART 10: THE END OF THE WAR
  // Patrick: "The end of the war. The mega mech vs ultra pods. Mega mech is as tall as an ultra pod."
  {
    title: 'The Mega Mech',
    part: 10, corrupt: true, rift: 2, mega: true, scouts: 3, allyFrames: ['titan', 'ranger', 'scout'],
    brief: 'Part 10: THE END OF THE WAR. Climb into the MEGA MECH. It is as tall as an Ultra Pod, five times the size of your Jaeger, and it hits five times as hard. Ordinary tripods are so small now that you can step on them. Destroy the Ultra Pod and everything around it!',
    startAt: () => ({ x: -200, z: 1250 }),
    start(g, s) {
      const m = g.mech.pos, B = g.city.bound - 300, f = { x: Math.sin(g.mech.yaw), z: Math.cos(g.mech.yaw) };
      g.spawnAwake('ultra', Math.max(-B, Math.min(B, m.x + f.x * 900)), Math.max(g.city.waterEdge + 250, Math.min(B, m.z + f.z * 900)));
      for (let i = 0; i < 6; i++) g.spawnAwake(['attacker', 'gatling', 'tank', 'baby', 'flame', 'attacker'][i], m.x + f.x * 420 + (i - 2.5) * 110, m.z + f.z * 420 + (i % 2) * 90);
      s.sent = true;
      g.nav.say('mega', 'You are in the MEGA MECH! Look how small everything is. You can step right on the little tripods. The Ultra Pod is the same size as you now. Go get it!', 3, 0);
    },
    goal: (g) => (beaten(g, 'ultra') ? 'Stomp the rest!' : 'MEGA MECH vs ULTRA POD'),
    done: (g, s) => s.sent && beaten(g, 'ultra') >= 1 && noneComing(g),
    failed: () => null,
    win: 'The Mega Mech works! One Ultra Pod down. Two more, and their leader, are all that is left.',
  },
  {
    title: 'The End of the War',
    part: 10, corrupt: true, rift: 1, mega: true, scouts: 3, friends: 1, allyFrames: ['titan', 'ranger', 'scout'], ending: 'peace',
    brief: 'This is the last battle of the whole war. Two Ultra Pods, and then ULTRA POD PRIME, the strongest machine the tripods ever built. You are in the Mega Mech. Everyone on Earth is watching. Finish it, pilot!',
    startAt: () => ({ x: -200, z: 1250 }),
    start(g, s) {
      const m = g.mech.pos, B = g.city.bound - 300;
      for (const sgn of [-1, 1]) g.spawnAwake('ultra', Math.max(-B, Math.min(B, m.x + Math.sin(g.mech.yaw + sgn * 0.6) * 950)), Math.max(g.city.waterEdge + 250, Math.min(B, m.z + Math.cos(g.mech.yaw + sgn * 0.6) * 950)));
      s.prime = false;
      g.hud.alert('THE LAST BATTLE', 5, true);
    },
    tick(g, s) {
      if (!s.prime && beaten(g, 'ultra') >= 2) {
        s.prime = true;
        const m = g.mech.pos, B = g.city.bound - 300;
        g.spawnAwake('ultraPrime', Math.max(-B, Math.min(B, m.x + Math.sin(g.mech.yaw) * 800)), Math.max(g.city.waterEdge + 250, Math.min(B, m.z + Math.cos(g.mech.yaw) * 800)));
        g.hud.alert('ULTRA POD PRIME!', 6, true);
        g.nav.say('rise_ultraPrime', 'ULTRA POD PRIME! The last and strongest one. This is the final battle of the whole war. You can do it, pilot!', 3, 0);
      }
    },
    goal: (g, s) => (s.prime ? 'Destroy ULTRA POD PRIME and end the war!' : `Destroy the Ultra Pods (${Math.min(2, beaten(g, 'ultra'))}/2)`),
    done: (g, s) => s.prime && beaten(g, 'ultraPrime') >= 1,
    failed: () => null,
    win: 'ULTRA POD PRIME HAS FALLEN! It is over. The war is over!',
  },
  // ================================================================== CHAPTER 2: THE TRI LEGION
  // Patrick, 2026-11-27: "Now a new threat. Now is chapter 2. The tripods team up with the new threat."
  // "A new alien, and in this chapter the moon wakes up." "The Tri Legion. They make tripods and have star
  // destroyers." The missions are Claude's calls. Patrick says the Moon is an ENEMY.
  {
    title: 'The Tri Legion',
    part: 11, legion: true, cutscene: 'legion', scouts: 3, walkers: 1, allyFrames: ['titan', 'ranger', 'scout'],
    brief: 'CHAPTER 2: THE TRI LEGION. A new alien has come: the Tri Legion. They are the ones who MADE the tripods, and the tripods that are left have teamed up with them. Their Star Destroyers are in the sky. And something very strange is happening to the Moon. Destroy the first 12 machines they send down!',
    start(g, s) { s.sent = 0; s.wait = 3; },
    tick(g, s, dt) {
      s.wait -= dt;
      if (s.sent >= 12 || s.wait > 0 || living(g).length + g.warnings.length >= (g.lowPower ? 4 : 5)) return;
      s.wait = 6; s.sent++;
      const type = s.sent % 3 === 0 ? 'legionTrooper' : ['attacker', 'gatling', 'tank', 'flame', 'blink', 'sprinter'][Math.floor(Math.random() * 6)];
      const a = g.view.yaw + (Math.random() - 0.5) * 2.4, d = 280 + Math.random() * 240, B = g.city.bound - 200;
      g.spawnAwake(type, Math.max(-B, Math.min(B, g.mech.pos.x + Math.sin(a) * d)), Math.max(g.city.waterEdge + 150, Math.min(B, g.mech.pos.z + Math.cos(a) * d)));
      if (type === 'legionTrooper' && s.sent === 3) g.nav.say('rise_legionTrooper', 'A Legion Trooper! This is what the Tri Legion builds for itself: black and gold, with a shield and four lasers at a time.', 3, 0);
    },
    goal: (g) => `Destroy the Tri Legion's first wave (${Math.min(12, g.stats.tripods)}/12)`,
    done: (g, s) => s.sent >= 12 && g.stats.tripods >= 12 && noneComing(g),
    failed: () => null,
    win: 'The first wave is beaten. Did you see the Moon? There is a crack in it. A glowing one.',
  },
  {
    title: 'Star Destroyer',
    part: 11, legion: true, scouts: 4, walkers: 2, friends: 1, allyFrames: ['titan', 'ranger', 'titan', 'scout'],
    brief: 'A Star Destroyer is coming down: three giant prongs around a burning core. It fires a huge beam (get out of the red ring!) and it drops Legion Troopers. Shoot the glowing blue core underneath it and bring it down. Then a Legion Forge shows up to build more.',
    start(g, s) { g.queueShip(['legionTrooper', 'legionTrooper', 'legionTrooper'], 'destroyer'); s.sent = true; s.forge = false; g.moonAwake = 0.25; },
    tick(g, s) {
      if (!s.forge && beaten(g, 'destroyer') >= 1) {
        s.forge = true;
        const m = g.mech.pos, B = g.city.bound - 250;
        g.spawnAwake('legionForge', Math.max(-B, Math.min(B, m.x + Math.sin(g.mech.yaw) * 420)), Math.max(g.city.waterEdge + 200, Math.min(B, m.z + Math.cos(g.mech.yaw) * 420)));
        g.hud.alert('A LEGION FORGE!', 4, true);
        g.nav.say('rise_legionForge', 'A Legion Forge! The Tri Legion MAKE the tripods, and this is how. It can build any kind. Destroy it!', 3, 0);
      }
    },
    goal: (g, s) => (!beaten(g, 'destroyer') ? 'Shoot down the Star Destroyer' : !beaten(g, 'legionForge') ? 'Destroy the Legion Forge' : 'Destroy everything it built'),
    done: (g, s) => s.forge && beaten(g, 'legionForge') >= 1 && noneComing(g),
    failed: () => null,
    win: 'One Star Destroyer down, and no more Forge. Look up. The Moon has opened one eye.',
  },
  {
    title: 'The Moon Wakes Up',
    part: 11, legion: true, scouts: 4, walkers: 2, friends: 1, allyFrames: ['titan', 'ranger', 'titan', 'scout'],
    brief: 'The LEGION GENERAL is here with two Star Destroyers. And it gets worse: the Moon is awake, it was never just a rock, and it is an ENEMY. Its eye is opening. When it is wide open it fires Moon Beams down at you. Watch for the orange ring on the ground and get out of it. Defeat the General!',
    start(g, s) {
      const m = g.mech.pos, B = g.city.bound - 300;
      g.spawnAwake('legionGeneral', Math.max(-B, Math.min(B, m.x + Math.sin(g.mech.yaw) * 560)), Math.max(g.city.waterEdge + 250, Math.min(B, m.z + Math.cos(g.mech.yaw) * 560)));
      g.queueShip(['legionTrooper'], 'destroyer'); g.queueShip(['legionTrooper'], 'destroyer');
      s.sent = true; s.beam = 10; s.at = null; g.moonAwake = 0.3;
      g.hud.alert('THE LEGION GENERAL', 5, true);
      g.nav.say('rise_legionGeneral', 'The LEGION GENERAL! The leader of the Tri Legion on Earth. Shield, lasers, lightning, and it calls Troopers. Everything we have, right now!', 3, 0);
    },
    tick(g, s, dt) {
      g.moonAwake = Math.min(1, (g.moonAwake || 0) + dt * 0.05);
      if (g.moonAwake < 0.95) return;
      if (!s.said) { s.said = true; g.hud.alert('THE MOON IS AWAKE!', 5, true); g.nav.say('moonAwake', 'Look at the Moon! Its eye is wide open, and it is looking right at us. It is on THEIR side. Watch out for its beam!', 3, 0); }
      if (s.at) {
        // the warning ring, then the beam
        s.at.t -= dt;
        if (Math.random() < 0.6) g.fx.ring({ x: s.at.x, y: g.city.groundAt(s.at.x, s.at.z) + 1.5, z: s.at.z }, 34, 38, 0.25, '#ffb04a', 0.85);
        if (s.at.t <= 0) { g.moonBeam(s.at.x, s.at.z); s.at = null; }
        return;
      }
      s.beam -= dt;
      if (s.beam > 0) return;
      s.beam = 11;
      s.at = { x: g.mech.pos.x, z: g.mech.pos.z, t: 2 };
      g.hud.alert('MOON BEAM COMING! MOVE!', 2.5, true);
      g.nav.say('moonBeam', 'The Moon is aiming at you! Get out of the orange ring!', 2, 14);
    },
    goal: (g) => (beaten(g, 'legionGeneral') ? 'Destroy the last of the Legion here' : 'Defeat the LEGION GENERAL (and dodge the Moon Beams)'),
    done: (g, s) => s.sent && beaten(g, 'legionGeneral') >= 1 && noneComing(g),
    failed: () => null,
    win: 'The General has fallen! But the Moon is awake, it is angry, and it is still staring down at the Earth. To be continued...',
  },
];
