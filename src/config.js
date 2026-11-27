// Game-wide tuning values and Jaeger part definitions.
// 1 world unit = 1 meter.

export const WORLD = {
  block: 110,          // city block size including road
  road: 26,            // road width
  grid: 14,            // blocks per side
  bound: 1150,         // how far the player can walk from center
  gravity: -32,        // a bit stronger than real so debris feels punchy
};
WORLD.half = (WORLD.block * WORLD.grid) / 2;

export const FRAMES = {
  scout: {
    id: 'scout', name: 'Scout', desc: 'Light and fast. Great at dodging.',
    armor: 1000, speed: 34, power: 0.85, scale: 0.9,
  },
  ranger: {
    id: 'ranger', name: 'Ranger', desc: 'Balanced armor, speed and power.',
    armor: 1400, speed: 27, power: 1.0, scale: 1.0,
  },
  titan: {
    id: 'titan', name: 'Titan', desc: 'Heavy armor, hits hard, moves slow.',
    armor: 2000, speed: 21, power: 1.25, scale: 1.12,
  },
};

export const WEAPONS = {
  sword: {
    id: 'sword', name: 'Energy Sword', kind: 'melee',
    desc: 'A glowing blade slides out of the forearm. Big damage.',
    damage: 62, cooldown: 0.72, reach: 44, radius: 22, smash: 1.4,
  },
  blades: {
    id: 'blades', name: 'Wrist Blades', kind: 'melee',
    desc: 'Twin knives pop out of the wrist. Super fast slashes.',
    damage: 24, cooldown: 0.28, reach: 34, radius: 18, smash: 0.8,
  },
  cannon: {
    id: 'cannon', name: 'Plasma Cannon', kind: 'ranged',
    desc: 'The hand folds into a cannon. Hit weak spots from far away.',
    damage: 38, cooldown: 0.75, speed: 420, smash: 1.0,
  },
  laser: {
    id: 'laser', name: 'Laser Blaster', kind: 'ranged',
    desc: 'Twin barrels that fire fast red laser bolts. One of the only weapons that can hurt an Uber Pod.',
    damage: 17, cooldown: 0.2, speed: 720, smash: 0.6,
  },
  fist: {
    id: 'fist', name: 'Power Fist', kind: 'melee',
    desc: 'Rocket-powered punch. Knocks kaiju back and flattens buildings.',
    damage: 46, cooldown: 0.9, reach: 30, radius: 22, smash: 3.0, knockback: 70,
  },
};

// Weapons from the future (campaign part 3, Patrick 2026-11-27): the ships took years to reach the Earth,
// so humans had time to invent these. `model` says which arm shape it uses. Claude's calls.
Object.assign(WEAPONS, {
  nova: {
    id: 'nova', name: 'Nova Cannon', kind: 'ranged', model: 'cannon', future: true,
    desc: 'FUTURE WEAPON. One huge golden blast that explodes. Slow to fire, giant damage.',
    damage: 120, cooldown: 1.3, speed: 400, smash: 2.5, color: '#ffd84a', size: 22, radius: 9, boom: 1.1,
  },
  pulse: {
    id: 'pulse', name: 'Pulse Rifle', kind: 'ranged', model: 'laser', future: true,
    desc: 'FUTURE WEAPON. A stream of green bolts, faster than anything else.',
    damage: 11, cooldown: 0.09, speed: 900, smash: 0.4, color: '#7dffb0', size: 7, radius: 4,
  },
  storm: {
    id: 'storm', name: 'Storm Launcher', kind: 'ranged', model: 'cannon', future: true,
    desc: 'FUTURE WEAPON. Fires three purple bolts in a fan. Great against Sprinters.',
    damage: 30, cooldown: 0.7, speed: 520, smash: 1.0, color: '#b07dff', size: 12, radius: 6, shots: 3, spread: 0.07,
  },
});

export const HEADS = {
  visor: { id: 'visor', name: 'Visor' },
  dome: { id: 'dome', name: 'Dome' },
  crest: { id: 'crest', name: 'Crest' },
  bubble: { id: 'bubble', name: 'Bubble Cockpit', desc: 'A glass bubble. You can see the pilot inside!' },
  hunter: { id: 'hunter', name: 'Hunter Cockpit', desc: 'Sharp V-visor and antennas for tracking kaiju.' },
  command: { id: 'command', name: 'Command Deck', desc: 'Wide window, sensor pods and a radar dish.' },
};

// Chest pieces (added 2026-11-01, Patrick's request).
export const CHESTS = {
  standard: { id: 'standard', name: 'Core Plate', desc: 'The classic glowing power core.' },
  reactor: { id: 'reactor', name: 'Reactor Core', desc: 'A giant spinning reactor ring.' },
  fortress: { id: 'fortress', name: 'Fortress Plate', desc: 'Extra-thick armor. +20% armor!', armor: 1.2 },
  missiles: { id: 'missiles', name: 'Missile Bay', desc: 'Doors open and fire homing missiles. Press E in battle!' },
};

export const PALETTE = [
  '#c9d3df', '#2c5aa0', '#b8202a', '#e0a21b', '#2e8b57', '#23262d',
  '#6b3fa0', '#e86a1a', '#1aa3a3', '#f2f2f2', '#7a8796', '#d94f8a',
];
export const GLOWS = ['#38d8ff', '#ff5a1f', '#7dff5a', '#ff3af2', '#ffe14a', '#ffffff'];

export const DEFAULT_JAEGER = {
  name: 'STORM TITAN',
  primary: '#2c5aa0',
  accent: '#c9d3df',
  glow: '#38d8ff',
  frame: 'ranger',
  left: 'sword',
  right: 'cannon',
  head: 'visor',
  chest: 'standard',
};

export const KAIJU_CATS = [
  null,
  { cat: 1, hp: 800, scale: 0.8, dmg: 55, speed: 22 },
  { cat: 2, hp: 1200, scale: 0.95, dmg: 75, speed: 20 },
  { cat: 3, hp: 1750, scale: 1.1, dmg: 95, speed: 19 },
  { cat: 4, hp: 2400, scale: 1.28, dmg: 120, speed: 17 },
  { cat: 5, hp: 3300, scale: 1.5, dmg: 150, speed: 16 },
];

// Mission waves: list of kaiju categories per wave.
export const WAVES = [
  [1],
  [2],
  [2, 1],
  [3, 2],
  [4],
  [3, 3],
  [5],
];

export const BACKUP = {
  drones: { key: 'Q', name: 'Drones', cooldown: 8 },
  apache: { key: '1', name: 'Apaches', cooldown: 40 },
  gunship: { key: '2', name: 'Gunship', cooldown: 55 },
  jets: { key: '3', name: 'Airstrike', cooldown: 70 },
  missiles: { key: 'E', name: 'Missiles', cooldown: 9 },
};

// Chapter 2 tripods (docs/chapter-2-design.md). Harvester and Uber Pod come later.
export const TRIPODS = {
  attacker: {
    id: 'attacker', name: 'Attacker Tripod', short: 'Tripod', size: 1, hull: 1,
    hp: 900, speed: 16,
    laser: 8, fireEvery: 2.6,    // damage per laser bolt, seconds between 3-bolt bursts
    range: 300, cone: 0.2,       // how far the scanner light reaches, and how wide it is (radians)
  },
  // Campaign only. It harvests survivors and animals, and fights by stomping with its legs.
  harvester: {
    id: 'harvester', name: 'Harvester', short: 'Harvester', size: 1.12, hull: 1.15,
    hp: 1300, speed: 19, harvest: true, stomp: 85,
    laser: 0, fireEvery: 99, range: 260, cone: 0.24,
  },
  // The war machine. Only the Energy Sword and Laser Blaster can hurt it.
  uber: {
    id: 'uber', name: 'Uber Pod', short: 'Uber Pod', size: 1.4, hull: 1.3,
    hp: 2600, speed: 21, immune: true,
    laser: 4, fireEvery: 2.4, minigun: 8,   // laser mini guns: 8 quick bolts
    big: 34, bigEvery: 6,                   // big laser
    range: 620, cone: 0.3, lose: 12,        // advanced scanner: sees farther and wider, forgets slower
  },
  // Patrick's Emperor Pod: an Uber Pod and a Harvester in one, and much taller than any other tripod.
  emperor: {
    id: 'emperor', name: 'Emperor Pod', short: 'Emperor', size: 2, hull: 1.7, radar: 4,
    hp: 2200, speed: 17, immune: true, chip: 0.25, harvest: true, stomp: 50, crown: true,   // chip: normal weapons do a quarter damage   // made easier 2026-11-27: Patrick said it was too hard
    laser: 3, fireEvery: 3.4, minigun: 6,
    big: 20, bigEvery: 9,
    range: 620, cone: 0.32, lose: 14,
  },
};

// ---- Campaign part 2 (Patrick, 2026-11-27): five new tripods and the boss pods. All Claude's calls. ----
Object.assign(TRIPODS, {
  sprinter: {
    id: 'sprinter', name: 'Sprinter Pod', short: 'Sprinter', size: 0.75, hull: 0.8, tint: '#58c97a',
    hp: 450, speed: 34, laser: 5, fireEvery: 1.6, range: 280, cone: 0.22,
    intro: 'A Sprinter Pod! It is small and very fast. It is weak, so catch it and it will not last long.',
  },
  shield: {
    id: 'shield', name: 'Shield Pod', short: 'Shield', size: 1.1, hull: 1.1, tint: '#4a86d8',
    hp: 900, speed: 15, laser: 8, fireEvery: 2.6, range: 300, cone: 0.2,
    shield: 350, shieldWait: 5,   // the bubble soaks up this much damage, and starts refilling after this many quiet seconds
    intro: 'A Shield Pod! That blue bubble soaks up your shots. Keep hitting it until the bubble pops, then finish it before the bubble comes back.',
  },
  mortar: {
    id: 'mortar', name: 'Mortar Pod', short: 'Mortar', size: 1.05, hull: 1.2, tint: '#d98a3a',
    hp: 800, speed: 12, laser: 0, fireEvery: 4.5, mortar: 26, range: 520, cone: 0.24,
    intro: 'A Mortar Pod! It lobs slow fire bombs from far away. Watch them in the sky and keep moving, then get close: it is slow.',
  },
  ghost: {
    id: 'ghost', name: 'Ghost Pod', short: 'Ghost', size: 1, hull: 0.95, tint: '#5a4a80',
    hp: 650, speed: 20, laser: 9, fireEvery: 2.2, range: 300, cone: 0.2, cloak: true,
    intro: 'A Ghost Pod! It is almost invisible and it is not on your radar. Look for its scanner light on the ground.',
  },
  splitter: {
    id: 'splitter', name: 'Splitter Pod', short: 'Splitter', size: 1.25, hull: 1.25, tint: '#d8c23a',
    hp: 1000, speed: 15, laser: 8, fireEvery: 2.6, range: 300, cone: 0.2, split: { type: 'sprinter', n: 2 },
    intro: 'A Splitter Pod! Be ready: when you destroy it, two Sprinter Pods climb out of the wreck.',
  },
  // ---- boss pods: big, named, with a special attack. Any weapon can hurt them. ----
  stormking: {
    id: 'stormking', name: 'Boss Pod: Storm King', short: 'Storm King', size: 1.7, hull: 1.5, tint: '#39507a', boss: '#7db8ff', radar: 4,
    hp: 3000, speed: 16, laser: 5, fireEvery: 3.2, minigun: 5, range: 520, cone: 0.28, lose: 12,
    storm: 30, stormEvery: 7,    // calls lightning down on you: a ring on the ground warns you first
    intro: 'A Boss Pod! That is the Storm King. It calls lightning down on you. When you see the blue ring on the ground, MOVE!',
  },
  overlord: {
    id: 'overlord', name: 'Boss Pod: Overlord', short: 'Overlord', size: 2.2, hull: 1.9, tint: '#5a1f2a', boss: '#ff5a3a', radar: 4,
    hp: 3600, speed: 15, laser: 4, fireEvery: 3.2, minigun: 6, big: 22, bigEvery: 9, stomp: 45, range: 620, cone: 0.3, lose: 14,
    shield: 450, shieldWait: 7,
    summon: { type: 'sprinter', every: 30, max: 2 },
    intro: 'The Overlord! The biggest Boss Pod of all. It has a shield, it stomps, and it calls Sprinter Pods to help it. Pop the shield first!',
  },
});

// A boss version of each new pod (Patrick, 2026-11-27: "one for each new pod"). Bigger, tougher, with spikes.
Object.assign(TRIPODS, {
  sprinterBoss: { ...TRIPODS.sprinter, id: 'sprinterBoss', name: 'Boss Pod: Boss Sprinter', short: 'Boss Sprinter', size: 1.3, hull: 1.25, boss: '#7dffb0', radar: 4,
    hp: 1800, speed: 30, laser: 5, minigun: 5, fireEvery: 2.2, range: 420, lose: 10,
    intro: 'A Boss Pod! The Boss Sprinter is as fast as the little ones, but big and tough. Cut it off instead of chasing it!' },
  shieldBoss: { ...TRIPODS.shield, id: 'shieldBoss', name: 'Boss Pod: Boss Shield', short: 'Boss Shield', size: 1.6, hull: 1.5, boss: '#6fc0ff', radar: 4,
    hp: 2200, speed: 14, shield: 700, shieldWait: 5, range: 420, lose: 10,
    intro: 'A Boss Pod! The Boss Shield has a huge bubble. Do not stop shooting, or the bubble grows back!' },
  mortarBoss: { ...TRIPODS.mortar, id: 'mortarBoss', name: 'Boss Pod: Boss Mortar', short: 'Boss Mortar', size: 1.6, hull: 1.6, boss: '#ffb04a', radar: 4,
    hp: 2200, speed: 11, mortar: 22, mortarCount: 3, fireEvery: 5, range: 600, lose: 10,
    intro: 'A Boss Pod! The Boss Mortar fires three fire bombs at once. Do not stand still!' },
  ghostBoss: { ...TRIPODS.ghost, id: 'ghostBoss', name: 'Boss Pod: Boss Ghost', short: 'Boss Ghost', size: 1.5, hull: 1.4, boss: '#c9a0ff', radar: 4,
    hp: 2000, speed: 19, laser: 6, minigun: 5, fireEvery: 2.8, range: 420, lose: 5,   // it loses you fast and vanishes again
    intro: 'A Boss Pod! The Boss Ghost is huge, but you still cannot see it until it attacks. If it loses you, it disappears again!' },
  splitterBoss: { ...TRIPODS.splitter, id: 'splitterBoss', name: 'Boss Pod: Boss Splitter', short: 'Boss Splitter', size: 1.8, hull: 1.7, boss: '#fff07a', radar: 4,
    hp: 2400, speed: 14, range: 420, lose: 10, split: { type: 'splitter', n: 2 },
    intro: 'A Boss Pod! The Boss Splitter splits into two Splitter Pods, and each of those splits into two Sprinters. That is seven pods in one!' },
});

// Part 3 tripods (Patrick, 2026-11-27: "and new tripods"). They come from the fleet. All Claude's calls.
Object.assign(TRIPODS, {
  titan: {
    id: 'titan', name: 'Titan Pod', short: 'Titan', size: 1.9, hull: 1.8, tint: '#6a6f7c', radar: 3,
    hp: 3000, speed: 9, laser: 6, fireEvery: 3, stomp: 55, range: 340, cone: 0.24,
    intro: 'A Titan Pod! Huge, slow, and covered in armor. It takes a LOT of hits, and it stomps. Do not stand under it!',
  },
  sniper: {
    id: 'sniper', name: 'Sniper Pod', short: 'Sniper', size: 1.15, hull: 0.9, tint: '#2f8f8a',
    hp: 600, speed: 13, laser: 0, fireEvery: 99, big: 26, bigEvery: 5, bigSpeed: 760, bigRange: 900, range: 800, cone: 0.12, far: 900, lose: 9,
    intro: 'A Sniper Pod! It sees very far with a thin light, and fires one strong, fast shot. Stay behind buildings until you are close.',
  },
  repair: {
    id: 'repair', name: 'Repair Pod', short: 'Repair', size: 0.95, hull: 1, tint: '#3fb86a',
    hp: 700, speed: 18, laser: 4, fireEvery: 3, range: 280, cone: 0.2, heal: 45, healRange: 280,
    intro: 'A Repair Pod! It fixes the other tripods near it with a green beam. Destroy the Repair Pod FIRST!',
  },
  flame: {
    id: 'flame', name: 'Flame Pod', short: 'Flame', size: 1, hull: 1.05, tint: '#c8452a',
    hp: 850, speed: 22, laser: 0, fireEvery: 99, flame: 5, range: 280, cone: 0.24,
    intro: 'A Flame Pod! It runs right up to you and breathes fire. Keep your distance and shoot it from far away.',
  },
  thunder: {
    id: 'thunder', name: 'Thunder Pod', short: 'Thunder', size: 1.1, hull: 1, tint: '#4a5fc8',
    hp: 800, speed: 15, laser: 6, fireEvery: 3.2, storm: 18, stormEvery: 6, range: 380, cone: 0.22,
    intro: 'A Thunder Pod! It calls lightning down on you, like a little Storm King. Get out of the blue ring!',
  },
});

// Part 4: THE WAR (Patrick, 2026-11-27): "ten new tripods". All ten are Claude's calls.
Object.assign(TRIPODS, {
  tank: {
    id: 'tank', name: 'Tank Pod', short: 'Tank', size: 1.05, hull: 1.35, tint: '#5f6b4a',
    hp: 1500, speed: 10, laser: 0, fireEvery: 99, big: 22, bigEvery: 4.5, range: 360, cone: 0.22,
    intro: 'A Tank Pod! Thick armor and one big cannon. It is slow, so keep moving and its shots will miss.',
  },
  gatling: {
    id: 'gatling', name: 'Gatling Pod', short: 'Gatling', size: 1, hull: 1, tint: '#8a8f3a',
    hp: 800, speed: 17, laser: 2.5, minigun: 12, fireEvery: 2.4, range: 320, cone: 0.22,
    intro: 'A Gatling Pod! It sprays a whole stream of tiny lasers. Get behind something!',
  },
  blink: {
    id: 'blink', name: 'Blink Pod', short: 'Blink', size: 0.95, hull: 0.9, tint: '#b04ad8',
    hp: 650, speed: 16, laser: 7, fireEvery: 2.4, range: 320, cone: 0.22, blink: 7,
    intro: 'A Blink Pod! It teleports. One second it is far away, the next it is right beside you!',
  },
  boom: {
    id: 'boom', name: 'Boom Pod', short: 'Boom', size: 0.8, hull: 0.9, tint: '#e0622a',
    hp: 380, speed: 30, laser: 0, fireEvery: 99, boom: 70, range: 300, cone: 0.24,
    intro: 'A Boom Pod! It runs straight at you and blows itself up. Shoot it before it gets close!',
  },
  magnet: {
    id: 'magnet', name: 'Magnet Pod', short: 'Magnet', size: 1.1, hull: 1.1, tint: '#3a6ad8',
    hp: 900, speed: 13, laser: 6, fireEvery: 3, range: 360, cone: 0.24, magnet: 46,
    intro: 'A Magnet Pod! It pulls your Jaeger toward it. Walk away from it, or sprint sideways!',
  },
  leech: {
    id: 'leech', name: 'Leech Pod', short: 'Leech', size: 1, hull: 1, tint: '#7a2f6a',
    hp: 800, speed: 19, laser: 0, fireEvery: 99, leech: 14, range: 300, cone: 0.22,
    intro: 'A Leech Pod! Its red beam steals your armor to repair itself. Break the beam by getting behind a building.',
  },
  commander: {
    id: 'commander', name: 'Commander Pod', short: 'Commander', size: 1.3, hull: 1.2, tint: '#3a3f58', boss: '#ffd23a',
    hp: 1400, speed: 14, laser: 7, fireEvery: 2.8, range: 380, cone: 0.24, summon: { type: 'attacker', every: 22, max: 2 },
    intro: 'A Commander Pod! It calls Attacker Tripods to help it. Take out the Commander and the calling stops.',
  },
  acid: {
    id: 'acid', name: 'Acid Pod', short: 'Acid', size: 1, hull: 1.05, tint: '#4a9a2a',
    hp: 750, speed: 14, laser: 0, fireEvery: 3.4, mortar: 12, mortarCount: 2, mortarColor: '#8dff3a', acid: true, range: 460, cone: 0.24,
    intro: 'An Acid Pod! It lobs two green blobs at a time. Do not stand where they land.',
  },
  shadow: {
    id: 'shadow', name: 'Shadow Pod', short: 'Shadow', size: 1.1, hull: 0.9, tint: '#2a2a3a',
    hp: 600, speed: 14, laser: 0, fireEvery: 99, big: 22, bigEvery: 5.5, bigSpeed: 760, bigRange: 900, range: 760, cone: 0.12, far: 900, lose: 5, cloak: true,
    intro: 'A Shadow Pod! An invisible sniper. Watch for its thin light on the ground, and follow the shot back to it.',
  },
  colossus: {
    id: 'colossus', name: 'Colossus Pod', short: 'Colossus', size: 2.6, hull: 2.2, tint: '#4a4f5c', boss: '#ff3a3a', radar: 4,
    hp: 4200, speed: 8, laser: 5, minigun: 4, fireEvery: 3.2, stomp: 60, range: 460, cone: 0.28, lose: 12,
    intro: 'The Colossus Pod! The biggest walking machine there has ever been. Stay out from under its feet, and hit it with everything!',
  },
  // "Humans made their own tripods, looks very different": this one is on YOUR side.
  guardian: {
    id: 'guardian', name: 'Guardian Walker', short: 'Guardian', size: 1, hull: 1, human: true,
    hp: 1100, speed: 18, laser: 8, fireEvery: 2.2, range: 340, cone: 0.24, lose: 8,
  },
});

// Part 6: THE CORRUPTED EARTH (Patrick, 2026-11-27): "some baby tripods, then they make more tripods".
Object.assign(TRIPODS, {
  baby: {
    id: 'baby', name: 'Baby Tripod', short: 'Baby', size: 0.42, hull: 0.5, tint: '#ff9ad8',
    hp: 110, speed: 30, laser: 2, fireEvery: 1.8, range: 190, cone: 0.26, lose: 4,
    grow: { after: 45, into: 'attacker' },   // leave one alone and it grows up
    intro: 'Baby Tripods! They are tiny and quick, and they do not hit hard. But leave one alone for long and it grows up into a full Attacker Tripod. Get them while they are small!',
  },
  factory: {
    id: 'factory', name: 'Factory Pod', short: 'Factory', size: 1.5, hull: 1.7, tint: '#6a4a2a', boss: '#ff9ad8', radar: 4,
    hp: 1900, speed: 6, laser: 0, fireEvery: 99, range: 300, cone: 0.24,
    summon: { type: 'baby', every: 9, max: 5, always: true },   // it builds Baby Tripods all the time, not only in a fight
    intro: 'A Factory Pod! That is how they make more tripods. It keeps building Baby Tripods until you destroy it.',
  },
});

// Part 7 (Patrick, 2026-11-27): "ultra pods that have the power of all of the tripods combined and is as
// tall as five mechs". Shield + laser mini guns + big laser + fire bombs + lightning + stomp + magnet, and
// it calls Attackers. Any weapon hurts it, but it has a LOT of health.
Object.assign(TRIPODS, {
  ultra: {
    id: 'ultra', name: 'ULTRA POD', short: 'Ultra Pod', size: 5, hull: 3.4, tint: '#20242c', boss: '#ff3aff', radar: 4,
    hp: 5200, speed: 9, range: 720, cone: 0.3, lose: 14, far: 760,
    laser: 4, minigun: 6, fireEvery: 3.4,
    big: 22, bigEvery: 8, bigRange: 700,
    lob: { dmg: 15, count: 2, every: 7 },
    storm: 20, stormEvery: 9,
    stomp: 55, magnet: 16,
    shield: 600, shieldWait: 6,
    summon: { type: 'attacker', every: 34, max: 2 },
    intro: 'An ULTRA POD! It is as tall as five Jaegers and it has the power of every tripod at once: a shield, lasers, fire bombs, lightning, a magnet and giant feet. Pop the shield, stay out of the blue rings, and do NOT stand under it!',
  },
});

// Parts 8 and 9: THE COLLIDING REALITIES, and part 10: THE END OF THE WAR (Patrick, 2026-11-27).
Object.assign(TRIPODS, {
  // a tripod from another reality: its colors keep changing and it blinks around
  glitch: {
    id: 'glitch', name: 'Glitch Pod', short: 'Glitch', size: 1.05, hull: 1, tint: '#ffffff', glitch: true,
    hp: 750, speed: 18, laser: 7, fireEvery: 2.4, range: 320, cone: 0.22, blink: 5,
    intro: 'A Glitch Pod! It came out of the rift, from another reality. Its colors keep changing, and it keeps jumping from place to place.',
  },
  ultraPrime: {
    ...TRIPODS.ultra, id: 'ultraPrime', name: 'ULTRA POD PRIME', short: 'Ultra Prime', boss: '#ffd23a', tint: '#3a1010',
    hp: 7500, shield: 800,
    intro: 'ULTRA POD PRIME! The last and strongest one. This is the final battle of the whole war. You can do it, pilot!',
  },
});

// CHAPTER 2: THE TRI LEGION (Patrick, 2026-11-27): "A new alien... the Tri Legion. They make tripods and
// have star destroyers." Black, red and gold, with a three-pointed crest. All Claude's calls.
Object.assign(TRIPODS, {
  legionTrooper: {
    id: 'legionTrooper', name: 'Legion Trooper', short: 'Trooper', size: 1.2, hull: 1.15, legion: true,
    hp: 1300, speed: 17, laser: 8, minigun: 4, fireEvery: 2.4, range: 360, cone: 0.24, shield: 250, shieldWait: 6,
    intro: 'A Legion Trooper! This is what the Tri Legion builds for itself: black and gold, with a shield and four lasers at a time.',
  },
  legionForge: {
    id: 'legionForge', name: 'Legion Forge', short: 'Forge', size: 1.6, hull: 1.8, legion: true, boss: '#ffb03a', radar: 4,
    hp: 2400, speed: 6, laser: 0, fireEvery: 99, range: 300, cone: 0.24,
    summon: { types: ['attacker', 'gatling', 'boom', 'baby', 'flame', 'blink'], every: 10, max: 5, always: true },
    intro: 'A Legion Forge! The Tri Legion MAKE the tripods, and this is how. It can build any kind. Destroy it!',
  },
  legionGeneral: {
    id: 'legionGeneral', name: 'LEGION GENERAL', short: 'General', size: 2.4, hull: 2.1, legion: true, boss: '#ff3a1a', radar: 4,
    hp: 5000, speed: 12, laser: 5, minigun: 6, fireEvery: 3, big: 24, bigEvery: 7, bigRange: 640, storm: 22, stormEvery: 8, stomp: 55,
    shield: 500, shieldWait: 6, range: 620, cone: 0.3, lose: 14, far: 700,
    summon: { type: 'legionTrooper', every: 28, max: 2 },
    intro: 'The LEGION GENERAL! The leader of the Tri Legion on Earth. Shield, lasers, lightning, and it calls Troopers. Everything we have, right now!',
  },
});

// Invasion mode waves: numbers are kaiju categories, 'T' is an attacker tripod.
export const INVASION_WAVES = [
  ['T'],
  [1, 'T'],
  ['T', 'T'],
  [2, 'T'],
  [3, 'T', 'T'],
  [2, 2, 'T'],
  [4, 'T', 'T'],
];

export function rateBuild(cfg) {
  // Returns a 0-100 "navigator score" and the reasons behind it.
  const f = FRAMES[cfg.frame];
  const L = WEAPONS[cfg.left], R = WEAPONS[cfg.right];
  let score = 60;
  const notes = [];
  const melee = [L, R].filter((w) => w.kind === 'melee').length;
  const ranged = 2 - melee;
  if (melee === 1 && ranged === 1) { score += 18; notes.push('One melee + one ranged weapon covers close and far fights.'); }
  if (ranged === 2) { score -= 6; notes.push('Two cannons hit weak spots from far, but kaiju that get close will hurt.'); }
  if (melee === 2) { score += 4; notes.push('Two melee weapons do huge damage, but you have to get right up close.'); }
  if (cfg.left === 'sword' || cfg.right === 'sword') { score += 8; notes.push('The Energy Sword has the best damage per hit.'); }
  if (cfg.left === cfg.right) { score -= 4; notes.push('Matching weapons look cool, but mixing gives you more options.'); }
  if (f.id === 'titan' && melee >= 1) { score += 8; notes.push('Titan frame + melee = heavy hits that stagger big kaiju.'); }
  if (f.id === 'scout' && ranged >= 1) { score += 8; notes.push('Scout speed + cannon lets you strike and run.'); }
  if (f.id === 'scout' && melee === 2) { score -= 6; notes.push('Scouts have thin armor. Getting close with two blades is risky.'); }
  if (f.id === 'ranger') { score += 4; notes.push('Ranger frame is a solid all-rounder.'); }
  if (cfg.left === 'fist' || cfg.right === 'fist') notes.push('Power Fist knocks kaiju back and smashes buildings flat.');
  return { score: Math.max(10, Math.min(100, score)), notes };
}
