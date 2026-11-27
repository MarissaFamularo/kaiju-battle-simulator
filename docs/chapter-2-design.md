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

- **(Patrick, 2026-11-27, after playing.)** Tripods **attack the scout Jaegers too**, and they **roam and
  search around the map** instead of always going after him. The scanner light **does not swing back and
  forth all the time**: it points ahead, and only sometimes turns to look around.

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

4. **Emperor Pod** (added by Patrick 2026-11-27, after playing). **Very tall: taller than
   every other tripod.** It is **basically an Uber Pod and a Harvester combined.**
   **(Claude's calls:** twice the height of an Attacker, gold armor and a crown; it has the
   Uber Pod's lasers and immunity, harvests camps and animals while it hunts, and stomps a
   Jaeger that gets under its legs; it does not grab a pilot on foot; campaign mission 8,
   rare in Free Play, Y summons one in Free Smash. Patrick said it was too hard, so the same day its health
   went from 3800 to 2200, its lasers and stomp were weakened, and normal weapons now do a quarter
   damage to it (the Uber Pod is still fully immune).)

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

- **Spawn the bad guys on command** (Patrick, 2026-11-27). **(Claude's calls:** B key or the SPAWN
  button on iPad opens a menu of kaiju sizes and every tripod type; up to 8 enemies at once; not in
  Campaign or the classic Mission.) Code: `src/ui/spawnMenu.js`.

- **Bad guys spawn farther away** so you can hunt them down (Patrick, 2026-11-27). On the huge map
  kaiju come up 800 to 1400 away and tripods 650 to 1100 away; far ones are pinned to the radar rim.
- **Scout Jaegers** (Patrick, 2026-11-27): other Jaegers walking around trying to destroy the bad guys.
  **(Claude's calls:** 3 in Free Play, 2 in the other non-story modes, none in Campaign; small, colored,
  light lasers that can hurt every tripod type; they can be knocked out and a new one drops in after
  about 50 seconds.) Code: `src/entities/scouts.js`.

## The intro (instead of a loading screen)

1. You are looking at the Earth.
2. A ship hits a space station.
3. The Jaeger ejects right before the hit and heads down to the planet.
4. It is fighting a kaiju.
5. **Lightning strikes the ground 20 times** and then a tripod rises.
6. The game starts.

## Campaign part 2: the Boss Pods

Patrick, 2026-11-27, after finishing the campaign: **"new missions with new tripods like boss pods,
and the first mission shows mechs destroying tripods until the boss pods come, and five more new
tripods."** He did not say what the new tripods are, so every one below is **Claude's call** and
Patrick can rename or change any of them.

- **Sprinter Pod**: small, very fast, weak.
- **Shield Pod**: a blue bubble soaks up shots, pops, and grows back after 5 quiet seconds.
- **Mortar Pod**: stays far away and lobs slow fire bombs in a high arc.
- **Ghost Pod**: almost invisible and off the radar until it attacks; you find it by its scanner light.
- **Splitter Pod**: when destroyed, two Sprinter Pods climb out of the wreck.
- **Boss Pod: Storm King**: calls lightning down on you, with a blue warning ring first.
- **Boss Pod: Overlord**: the biggest; shield, stomp, big laser, and it calls Sprinter Pods.
- Missions 9 to 15: Scout Squadron (scouts destroy tripods until the Boss Pod comes), Catch the
  Sprinters, Break the Shield, Fire From the Sky, Ghost Hunt, Double Trouble, The Overlord.

## Build order

1. **(Built 2026-11-27.) Attacker tripod in the current city** (lightning arrival, legs-first rise, scanner,
   horn, lasers, hiding, capsule aliens, tripods vs kaiju). New INVASION mode.
2. The huge new map with free play. **(Built 2026-11-27: `src/world/wasteland.js`, FREE PLAY mode.)**
3. Survivor camps, resources, bunkers, carrying survivors. **(Built 2026-11-27: `src/entities/camps.js`. Claude's calls: R repairs with 1 scrap + 1 energy; survivors board when the Jaeger stands by a camp; 4 calls a truck; people at a stomped camp run away unhurt.)**
4. Harvester, Uber Pod, Laser Blaster weapon, campaign missions. **(Built 2026-11-27. Mission list is Claude's call, in `src/campaign.js`: First Contact, Supply Run, Rescue, The Harvester, Hold the Bunker, Monsters of the Crater, The Uber Pod.)**
   Mission 8, The Emperor Pod, added the same day.
5. The new space intro. **(Built 2026-11-27: `src/scenes/invasionIntro.js`, about 47 seconds, shown on the first chapter 2 launch each visit.)**
