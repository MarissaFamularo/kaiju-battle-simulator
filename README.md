# Kaiju Battle Simulator

A game by Patrick. Build your own Jaeger, drop from a space station into a big 3D city, and fight giant kaiju before they wreck the power plant.

## How to play

1. **Hangar:** name your Jaeger, pick a frame (Scout, Ranger, Titan), arm weapons, head/cockpit, chest piece, and paint colors. Navigator Nova rates your build and gives tips.
2. **Drop:** a carrier drone flies your Jaeger out of Orbital Station Aegis, through the atmosphere, and drops it on the city.
3. **Fight:** kaiju burst out of the ground or the bay somewhere random. Radar only shows a fuzzy zone until they appear. Get close so Nova can scan their glowing **weak spots** (triple damage).

### Controls

| Key | Action |
| --- | --- |
| W A S D | Walk |
| Mouse | Look / aim (click the screen to capture the mouse) |
| Left click | Left arm weapon |
| Right click | Right arm weapon |
| Shift | Sprint |
| Space | Jump (landing makes a stomp shockwave) |
| Q | Send the drone swarm (they mostly just bonk off) |
| 1 | Apache helicopters |
| 2 | Gunship |
| 3 | Jet airstrike |
| E | Fire chest missiles (Missile Bay chest only) |
| F | Eject from the Jaeger / climb back in |
| V | Navigator voice on/off |
| K | Summon a kaiju (Free Smash mode) |
| T | Summon a tripod (Free Smash mode) |
| R | Repair armor with scrap + energy (Free Play) |
| 4 | Call a rescue truck to a nearby camp (Free Play) |
| Esc | Pause |

### Weapons

- **Energy Sword:** glowing blade slides out of the forearm, biggest hit.
- **Wrist Blades:** twin knives, very fast.
- **Plasma Cannon:** hand folds into a cannon, hits weak spots from far away.
- **Power Fist:** rocket punch, knocks kaiju back and flattens buildings.
- **Laser Blaster:** fast red laser bolts; one of the two weapons that can hurt an Uber Pod.

### Cockpits and chest pieces

- **Cockpits:** Visor, Dome, Crest, Bubble Cockpit (glass bubble with the pilot inside), Hunter Cockpit (V-visor and antennas), Command Deck (wide window and radar dish).
- **Core Plate:** the classic glowing power core.
- **Reactor Core:** a giant spinning reactor ring.
- **Fortress Plate:** extra-thick armor, +20% armor.
- **Missile Bay:** press E and the chest doors open and fire 8 homing missiles (9 second cooldown).

### iPad / touch screens

Touch controls turn on by themselves on touch screens (`public/touch-controls.js`). Left thumb is a joystick (push to the edge to sprint), right thumb drags to aim, and there are LEFT ARM, RIGHT ARM and JUMP buttons. The ability tiles at the bottom can be tapped. Force touch mode on or off with `?touch=1` or `?touch=0` in the URL. Hold the iPad sideways.

### Chapter 2: the Tripod Invasion (in progress)

Patrick's full design is in `docs/chapter-2-design.md`. Built so far:

- **Attacker tripods.** Lightning hits one spot ahead of you over and over, then a tripod climbs out: legs first, then it pushes itself up. It walks on three legs.
- **Scanner.** Its head has 5 lights and a scanner beam. It cannot attack until the light finds you, so hide behind buildings. When it spots you the lights turn red and it blasts a loud horn, then fires lasers. Break its line of sight for a few seconds and it loses you.
- **Weak spot:** the glowing core underneath.
- **Little aliens.** A tripod that spots you lobs a capsule. Little black aliens hop out, climb your Jaeger and pull armor off. Press F to get out and shoot them off with your blaster. They go splat.
- **Kaiju and tripods fight each other.**
- **INVASION mode** in the hangar mixes tripods and kaiju. In Free Smash, press **T** to call a tripod.

- **FREE PLAY mode: the huge map.** A destroyed city next to a giant hill you can climb, a beach and a stormy sea to the north, a river with a broken bridge, a forest, south hills, and a crater holding the head of a wrecked tripod (get too close and monsters crawl out). Kaiju and tripods turn up anywhere around you. Hills block a tripod's scanner. The radar shows where each place is. Beating an enemy repairs 30% of your armor until survivor camps are built.

- **Survivor camps** (green flags, green triangles on the radar). Get out with F and walk into the glowing green crates to collect resources. They are random and different every visit: scrap metal and energy, and sometimes food, a crate of missiles (restocks all backup), or a new part (more armor, speed or power). Crates come back after about two minutes. If a tripod steps on a camp, it is flattened and its resources are gone.
- **R repairs armor** by 30% using 1 scrap + 1 energy.
- **Saving survivors.** Stand your Jaeger next to a camp and up to 6 survivors climb aboard; carry them to a bunker (blue B on the radar). Or press **4** near a camp to call a rescue truck from the nearest bunker.
- **Bunkers** are underground. Tripod feet cannot hurt them, but kaiju attack the hatch, so protect them.

- **Laser Blaster:** a new arm weapon. Twin barrels, fast red bolts; hold the button to keep firing.
- **Harvester** (campaign only). It walks to the survivor camps and the animal herds and beams them up into the cage on its back. Captured survivors cannot be saved. It has no guns: it fights by lifting a leg and stomping you. It can grab the pilot on foot, so stay in your Jaeger.
- **Uber Pod.** Taller, with longer legs and weapons stacked on its head: laser mini guns and a big laser. Its scanner sees farther and wider and it comes straight for you. Ordinary weapons only leave a red hot mark that cools down. Only the **Energy Sword** and **Laser Blaster** hurt it. It arrives with about 20 lightning strikes.
- **CAMPAIGN:** seven missions on the huge map, unlocked one at a time and saved in the browser: First Contact, Supply Run, Rescue, The Harvester, Hold the Bunker, Monsters of the Crater, The Uber Pod. The mission list is in `src/campaign.js`.

- **The opening story.** The first time you launch a chapter 2 mode (Campaign, Free Play or Invasion) you see: the Earth; an unknown ship hitting Station Aegis; the Jaeger ejecting just before the hit and falling to the planet; a fight with a kaiju in the ruined city; twenty lightning strikes on one spot; and a tripod rising. Then the game starts with your Jaeger already on the ground. Space or a tap skips it. Later launches show a short drop instead. Code: `src/scenes/invasionIntro.js`.

**Play it:** https://marissafamularo.github.io/kaiju-battle-simulator/ (updates whenever `main` is pushed).

### Modes

- **Mission:** 7 waves, ending with a Category 5.
- **Endless:** waves keep getting bigger.
- **Free Smash:** no waves; smash the city and press K when you want a kaiju.

## Running it

Needs [Node.js](https://nodejs.org) 18 or newer.

```bash
npm install
npm run dev      # opens a local dev server, usually http://localhost:5173
npm run build    # production build in dist/
npm run preview  # serve the production build
```

Graphics can be switched to **FAST** in the hangar for slower laptops, and **BRIGHTNESS** (Low / Medium / High) changes how bright the city looks. The game also lowers its resolution automatically if the frame rate drops.

## Tech

- [Three.js](https://threejs.org) for 3D rendering with bloom glow
- [Rapier](https://rapier.rs) physics for falling building debris
- All models, textures, sounds and music are generated in code, so there are no asset files
- Navigator voice uses the browser's built-in speech

```
src/
  main.js            screens and main loop
  game.js            battle: camera, waves, spawning, combat, win/lose
  config.js          frames, weapons, kaiju categories, waves
  world/city.js      city grid, power plant, destruction and debris
  world/wasteland.js chapter 2's huge map: terrain, ruined city, landmarks, storm
  entities/          Jaeger, kaiju, pilot, military, drones, projectiles
  scenes/drop.js     space station and atmospheric entry cinematic
  ui/                hangar, HUD, navigator
```
