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
