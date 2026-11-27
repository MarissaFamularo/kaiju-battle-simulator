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
- Patrick then asked for a boss pod "for each new pod": **Boss Sprinter, Boss Shield, Boss Mortar** (three
  bombs at once), **Boss Ghost, Boss Splitter** (splits into two Splitters, which split into Sprinters).
  Each one rises at the end of its pod's mission (10 to 14). Storm King and Overlord were kept as well.
- Missions 9 to 15: Scout Squadron (scouts destroy tripods until the Boss Pod comes), Catch the
  Sprinters, Break the Shield, Fire From the Sky, Ghost Hunt, Double Trouble, The Overlord.

### The ending, and wrecks (Patrick, 2026-11-27)

- **When tripods fall, they stay.** (Claude's call: the newest 14 wrecks stay; older ones are cleared.)
- **At the end of the last mission a laser gets shot at the enemy planet and destroys it, but then it
  shows hundreds of ships coming. And then part three begins.** Built as `src/scenes/outro.js`, about
  28 seconds: the Earth Cannon charges, fires, the planet blows apart, 420 ships fly past, and a
  "PART 3 BEGINS" card. Part 3 itself is not designed yet: that is Patrick's to describe.

## Part 3: The Fleet

Patrick, 2026-11-27, in his words: **"All the tripods used to be asleep but now they are awake, so the
ships are in orbit and are entering the atmosphere and are sending more and more ships. But it took years
for the ships to get to Earth, so humans are now a type three race, so more weapons. Now all weapons are
from the future, so all weapons can hurt tripods."** Plus (as best we could read it) more campaign.

Built the same day. **Claude's calls:**
- **Every weapon hurts every tripod** in Part 3 missions and in all the non-story modes. The Uber Pod's
  immunity still holds in the Part 1 and 2 story missions, where it is the point of the mission.
- **Three future weapons** in the hangar: Nova Cannon, Pulse Rifle, Storm Launcher.
- **Alien Dropships** come down out of orbit, hover, and drop tripods that are **already awake** (no
  lightning, no climbing out). Weak spot: the glowing core underneath. **The Mothership** is the big one.
- The sky in Part 3 is full of orange lights: the fleet in orbit.
- Patrick, later the same day: "I want the ships to come down, drop the tripods, then leave, and I want to
  see all the ships from Earth and the destroyed planet. And new tripods." Dropships now leave after their
  last drop (the Mothership stays: Claude's call, it is the boss). The Part 3 and Free Play sky shows the
  fleet as ship shapes and lights, and the broken enemy planet. Five new tripods, all Claude's calls:
  **Titan Pod** (huge, armored, stomps), **Sniper Pod** (sees far, one strong fast shot), **Repair Pod**
  (fixes other tripods), **Flame Pod** (runs up and breathes fire), **Thunder Pod** (calls lightning).
- Missions 16 to 19: Years Later, They Are All Awake, More and More Ships, The Mothership.
- Code: `src/entities/ship.js`, `WEAPONS` in `src/config.js`, `src/campaign.js`.

## Part 4: The War

Patrick, 2026-11-27, in his words: "The people link with the kaiju to make friends and save their home. But
ten new tripods, and now it's a war, so more campaign, more tripods spawn faster. Humans made their own
tripods, looks very different. And one of the missions has us sneak into the tripods' base under the earth
in its core. Could you make, when they sneak in, a funny animation?"

Built the same day. **Claude's calls:**
- **Linked kaiju**: a friendly kaiju with a blue halo (green on the radar). It only attacks alien machines, it
  cannot hurt the Jaeger, and the Jaeger cannot hurt it.
- **Guardian Walker**: the human-made tripod. White and yellow, square cabin with a windshield, antennas, a
  flag, blue lights. It fights alien tripods and wild kaiju.
- **Ten new tripods**: Tank, Gatling, Blink (teleports), Boom (runs up and explodes), Magnet (pulls you in),
  Leech (steals armor to repair itself), Commander (calls Attackers), Acid (lobs green blobs), Shadow
  (invisible sniper), Colossus (the biggest walker).
- **War pace**: in Free Play enemies arrive about every 24 to 42 seconds instead of 40 to 70, with up to 5 at once.
- **The funny sneak-in** (`src/scenes/sneak.js`): the Jaeger tiptoes past a guard tripod in a terrible tripod
  costume, says BEEP BOOP, the costume falls off with a clang, the guard is asleep, the Jaeger runs.
- **The Core**: the crater becomes a cave with the Core Reactor in it. Destroy it, then run back out in 80 seconds.
- **The ending of part 4** (Patrick): "Could the end of the last mission be a message from the aliens, and it
  says: we're still alive, our base is on another planet with a shield, we're coming." Built as
  `src/scenes/alienMessage.js`: the four lines type out in green over their shielded planet, and a new
  fleet lifts off.
- Missions 20 to 24: The Link, Our Own Walkers, All-Out War, Into the Core, The Colossus.

## Part 5: The Alien Planet

Patrick, 2026-11-27, in his words: "In part five the Venture Stars deliver hundreds of mechs like Titans,
Rangers and the walking Guardians, hundreds, and they are all on the planet. Then we plant a bomb and the
planet goes boom."

Built the same day. **Claude's calls:**
- **The Venture Stars** opening (`src/scenes/venture.js`): three white carrier ships arrive over the shielded
  planet, open their bays, and hundreds of mechs drop.
- **The alien planet**: the huge map with a purple sky, a green shield grid overhead, two moons, alien spires,
  and the Venture Stars in the sky.
- **The army**: up to 300 mechs in ranks behind you (Titans blue, Rangers silver, Guardian Walkers yellow).
  They are scenery. The mechs that fight are your allies: Titan, Ranger and Scout Jaegers plus Guardian Walkers.
- Missions 25 to 27: The Venture Stars (destroy 3 Shield Generators), Hold the Landing Zone, Plant the Bomb
  (carry it to the red beam, hold 6 seconds, run to the blue beam in 90 seconds).
- **The ending**: the bomb counts down and the planet goes boom ("THE PLANET WENT BOOM. BUT THE WAR IS NOT
  OVER... PART 6 IS COMING").
- **Patrick's plan for the whole story (2026-11-27): "At part ten is when the war ends, but a lot more
  stuff before part ten."** Parts 6 to 10 are not designed yet. Do not end the war before part 10.

## Part 6: The Corrupted Earth

Patrick, 2026-11-27, in his words: "After that I don't want the war to end. Some baby tripods, then they make
more tripods, and when the humans get back they see Earth was corrupted."

Built the same day. **Claude's calls:**
- The Part 5 ending now shows a few tiny pods escaping the explosion ("BUT SOME BABY TRIPODS ESCAPED...").
- **Baby Tripod**: tiny, pink, quick and weak. Left alone for 45 seconds it **grows up** into an Attacker.
- **Factory Pod**: a slow walking factory that keeps building Baby Tripods (how "they make more tripods").
- **The return** (`src/scenes/corrupted.js`): a Venture Star comes home, the camera comes around, and the Earth
  is covered in purple veins and glowing green nests.
- **The corrupted Earth**: green haze, purple growths with glowing bulbs, hive towers on the horizon.
- **Corruption Hearts**: glowing purple balls that feed the growths.
- Missions 28 to 30: Home?, The Factory Pods, Hearts of the Corruption. The war is NOT over at the end.

## Part 7: The New Dimension

Patrick, 2026-11-27, in his words: "This time the tripods got an advantage. They learn how to make ultra pods
that have the power of all of the tripods combined and is as tall as five mechs, and are trying to make a new
dimension with planets, and the mechs are trying to stop them."

Built the same day. **Claude's calls:**
- **ULTRA POD**: size 5 (five times an Attacker, which is Jaeger height). It has a shield, laser mini guns, a
  big laser, fire bombs, lightning, a magnet, a stomp, and it calls Attackers. 5200 health. Any weapon hurts it.
- **The rift**: a purple tear in the sky with five new planets inside. It grows as the dimension opens.
- **Gate Pylons** (blue) feed the rift; **the Dimension Gate** is a giant glowing ball with planets spinning
  inside, and cannot be hurt until its pylons are destroyed.
- Missions 31 to 33: The Ultra Pod, The Pylons (the only mission you can lose on a timer: about 5 minutes),
  Stop the New Dimension. It ends with one Ultra Pod escaping through the Gate. The war is not over.

## Parts 8 and 9: The Colliding Realities, and Part 10: The End of the War

Patrick, 2026-11-27, in his words: "Part 8, the colliding realities. The rift is not stable. More are here. And
part 9 and part 8 are in the same part. New campaign: the end of the war. The mega mech vs ultra pods. Mega mech
is as tall as an ultra pod."

Built the same day. **Claude's calls:**
- **Parts 8 and 9 are one block** of missions (34 to 36): three, four, then five unstable rifts that flicker,
  purple lightning near you, **Glitch Pods** from another reality (colors keep changing, they teleport), kaiju
  from another reality, two Ultra Pods at once, and three Rift Anchors to destroy.
- **The Mega Mech** (missions 37 and 38): your own Jaeger at 5 times the size, which is Ultra Pod height. Seven
  times the armor, five times the damage, faster, and its feet flatten ordinary tripods.
- **ULTRA POD PRIME**: the final boss, 7500 health.
- **The last ending**: the corruption fades off the Earth and the card says THE WAR IS OVER.

## Story Chapter 2: The Tri Legion

Patrick, 2026-11-27, in his words: "Now a new threat. Now is chapter 2. The tripods team up with the new
threat." "A new alien, and in this chapter the moon wakes up." "The Tri Legion. They make tripods and have star
destroyers."

Built the same day. **Claude's calls:**
- **The Tri Legion** look: black, red and gold, with a three-pointed crest. Legion Trooper (shielded, four
  lasers), Legion Forge (builds any kind of tripod), LEGION GENERAL (boss).
- **Star Destroyers** are our own design, not copied from anything: three long prongs around a burning core.
  They hover, fire a big beam with a red warning ring, and drop Troopers.
- **The Moon** is alive. In the opening a Star Destroyer fires on it, it cracks, and a giant yellow eye opens.
  In the sky its eye opens a little more each mission.
  **Patrick, asked directly: the Moon is an ENEMY.** In mission 41 it fires Moon Beams at YOU, with an orange
  warning ring first. (The first build wrongly had it helping; that was Claude's guess and was changed.)
- Missions 39 to 41: The Tri Legion, Star Destroyer, The Moon Wakes Up. It ends "To be continued".

## Build order

1. **(Built 2026-11-27.) Attacker tripod in the current city** (lightning arrival, legs-first rise, scanner,
   horn, lasers, hiding, capsule aliens, tripods vs kaiju). New INVASION mode.
2. The huge new map with free play. **(Built 2026-11-27: `src/world/wasteland.js`, FREE PLAY mode.)**
3. Survivor camps, resources, bunkers, carrying survivors. **(Built 2026-11-27: `src/entities/camps.js`. Claude's calls: R repairs with 1 scrap + 1 energy; survivors board when the Jaeger stands by a camp; 4 calls a truck; people at a stomped camp run away unhurt.)**
4. Harvester, Uber Pod, Laser Blaster weapon, campaign missions. **(Built 2026-11-27. Mission list is Claude's call, in `src/campaign.js`: First Contact, Supply Run, Rescue, The Harvester, Hold the Bunker, Monsters of the Crater, The Uber Pod.)**
   Mission 8, The Emperor Pod, added the same day.
5. The new space intro. **(Built 2026-11-27: `src/scenes/invasionIntro.js`, about 47 seconds, shown on the first chapter 2 launch each visit.)**
