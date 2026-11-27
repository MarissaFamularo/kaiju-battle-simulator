# Chapter 2: The Tripod Invasion

Patrick's design, told to Claude on 2026-11-27. Loosely inspired by H. G. Wells's
*The War of the Worlds* (1898). This file is the rulebook for the chapter: what
Patrick asked for, in his words where possible. Things marked **(Claude's call)**
were left to "use your best judgement" and can be changed by Patrick any time.

## The big idea

You are still a Jaeger pilot, but now **kaiju AND tripods** come after you.
Kaiju and tripods also **fight each other**.

## Tripods

### How a tripod arrives
- No teleporting in. **Lightning hits the ground over and over in one spot ahead of you.**
- Eventually a tripod comes out of that spot: **all 3 legs first, then it pushes itself up.**
- Tripods have a real **walking animation**.

### The scanner
- The tripod's **head is a scanner with 5 lights** on it.
- It **does not attack until it spots you inside its light.**
- You can **hide behind buildings and the giant hill.**
- When it spots you: **the lights turn red and it makes a loud horn sound.**
- When it spots you it also **sends down a capsule that shoots out aliens** (see below).

### Three types (more in the future)
1. **Attacker tripod** (the normal one). Shoots lasers at your mech. Same height as your Jaeger.
2. **Harvester** (campaign missions only). Harvests **survivors from camps and animals**,
   because the aliens are trying to destroy all life forms. A captured survivor
   **cannot be saved**, so the job is to stop it before it gets there. You are safe
   from capture inside your Jaeger. It fights back by **trying to step on you with its legs**.
3. **Uber Pod** (the war machine). **Laser mini guns and big lasers**, stacked on a
   **taller head**, with **longer legs**. **Advanced scanners**: detects you from farther
   away, and the moment it detects you it targets you and heads straight there.
   Normal weapons do **no damage**: they only leave a **red hot mark that the tripod
   cools down**. Only the special Jaeger weapons hurt it: **Energy Swords and Laser Blasters**.

### Little black aliens
- Come out of the capsule. **Don't make them too scary.**
- They **climb up your Jaeger** and **drain your armor by throwing off pieces.**
- To get them off you **get out of your Jaeger and shoot them with your gun.**
  Your gun is very effective against them.
- When shot they **fall off and go splat on the ground.**

## The world

- A **huge map**: a **destroyed city next to a giant hill**, with lots of varied terrain.
- **Beaches**, and a **big storm off the coast** you can see in the distance.
- A **crater with the head of a destroyed tripod** in it. Get too close and **monsters come out**.
- "Use your imagination" for the rest. **(Claude's call:** a forest and a river.)
- Kaiju and tripods spawn **all over the map**.

### Survivor camps
- You can get out of the Jaeger and **collect resources** at small survivor camps.
- Resources are **random and different every visit**: **scrap metal and energy to
  repair armor**, and sometimes **new parts, missiles, food, anything**.
- Camps are a bad place to survive: **tripods can step on a camp, and then its
  resources are gone.**
- You can **save survivors**: carry them **to a bunker in your Jaeger**, or
  **call in vehicles** to take them.

### Bunkers
- Underground, with a bunch of survivors inside trying to survive.
- You can **protect** them.

## Modes

- **Campaign** with a bunch of missions. (Mission list: **Claude's call**, to be proposed.)
- **Free play**: kaiju and tripods randomly spawn around the huge map, with
  survivor camps and bunkers.
- The original city game stays as its own mode.

## The intro (instead of a loading screen)

1. You are looking at the Earth.
2. A ship hits a space station.
3. The Jaeger ejects right before the hit and heads down to the planet.
4. It is fighting a kaiju.
5. **Lightning strikes the ground 20 times** and then a tripod rises.
6. The game starts.

## Build order

1. **(Built 2026-11-27.) Attacker tripod in the current city** (lightning arrival, legs-first rise, scanner,
   horn, lasers, hiding, capsule aliens, tripods vs kaiju). New INVASION mode.
2. The huge new map with free play. **(Built 2026-11-27: `src/world/wasteland.js`, FREE PLAY mode.)**
3. Survivor camps, resources, bunkers, carrying survivors.
4. Harvester, Uber Pod, Laser Blaster weapon, campaign missions.
5. The new space intro.
