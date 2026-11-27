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
| Esc | Pause |

### Weapons

- **Energy Sword:** glowing blade slides out of the forearm, biggest hit.
- **Wrist Blades:** twin knives, very fast.
- **Plasma Cannon:** hand folds into a cannon, hits weak spots from far away.
- **Power Fist:** rocket punch, knocks kaiju back and flattens buildings.

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

Still to come: the huge map, survivor camps and bunkers, the Harvester and Uber Pod, the campaign, and the new space intro.

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
  entities/          Jaeger, kaiju, pilot, military, drones, projectiles
  scenes/drop.js     space station and atmospheric entry cinematic
  ui/                hangar, HUD, navigator
```
