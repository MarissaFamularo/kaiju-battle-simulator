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
];
