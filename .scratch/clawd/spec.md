# Spec: Everyone in town is Clawd

Status: done

Every character in the game, the Character and every NPC, becomes Clawd, the Claude Code mascot, modelled, rigged and animated in Blender. People are told apart by what they wear, not by hair and skin. Terms follow `GLOSSARY.md` (**Clawd**, **Appearance Preset**, **NPC Voice**).

## Problem Statement

The town's people were human figures built from Quaternius's packs: two builds, two faces, six hair styles, hair colours and skin tones, in one peasant outfit. The game should instead be full of Clawds, and look cute doing it.

## Solution

- **Clawd**, from references of the mascot (Claude Code's welcome-screen sprite, measured from a screenshot of it, and a 3D print of it), in `art/characters/clawd.py`: a block of orange (`#d77757`) about twice as wide as it is tall, two tall black eyes a quarter of the way in from each side, a stubby arm each side level with the eyes and four short legs, two at each end. Soft edges, glossy eyes with a glint. 1.09 m tall in town.
- **Rig**: `root`, `body`, an arm each side, four legs. Everything on the body is skinned to `body`. **Clips**: `idle` (breathing, arms swaying), `walk` (a scuttle, legs in pairs), `talk` (bouncing, an arm waving).
- **Expressions** (Patience): the eyes' shape keys (`puzzled`: one eye wide, one squinting; `strained`: squeezed shut, > <) with the body's tilt or nod and, strained, a drop of sweat. The eyes blink at random on their own.
- **Appearance Preset** becomes a hat (9 with none), eyewear (4 with none, no glass that would hide the eyes) and neckwear (5 with none), in one of 11 palette colours. Staff wear an apron in their role's colour as before.
- **NPC Voice** keeps working as the npc-voices spec built it: an NPC's look carries the build their voice suits (`NpcLook`), unseen, since Clawd's shape is the same for everyone. Named NPCs keep their builds, so their voices don't change. The Character's look has no build.
- **Counters** drop from 1.1 m to `COUNTER_HEIGHT` (0.75 m) so staff behind them, and Shift Customers across them, show their faces over the top.

## Decisions

- One GLB, `public/characters/clawd.glb`, exported straight from Blender; the Quaternius build (`scripts/build-characters.ts`) and its packs are gone, and so are their credits.
- Clawd is built at its size in town (`SCALE` in `clawd.py`), not scaled at the armature: glTF's inverse bind matrices cancel an armature's scale, so a scaled armature draws its skinned meshes at their modelled size.
- Save version 19: the Character's hair becomes a hat (short and bearded none, long a beret, buns a bow, buzzed a beanie, bald a top hat; a beard also a scarf) in a colour for the hair's; a Shift Customer at the counter is drawn again from their voice seed.
- Clips the game never played (`sit`, `interact`) aren't made; the Character walks with `walk`.

## Testing

At the seams the folders' `AGENTS.md` name: content cross-references (each Named NPC's build the same in every pack, the Named NPCs at one place dressed apart), the sim's look drawing, the store's save migration, the session builders' voice requests, `tooling/characterArt.test.ts` (the art holds every part, bone, eye shape and clip, in palette colours) and the setup screen's Playwright test. Each animation and expression was looked at in the running game.

No eval: the `ai` change is the voice request's build only (now read from the look), which no eval checks.
