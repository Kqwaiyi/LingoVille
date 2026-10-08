# 30a — Character rig and Appearance Presets

**What to build:** The Character is a real low-poly character that looks like the Appearance Preset chosen at setup. The setup screen previews the real model, and the title screen shows the save's Character.

**Blocked by:** 12b — Target Language, self-assessment, name and appearance

**Spec:** [spec.md](../spec.md): Art and audio (Characters); UI and HUD (Title)

**Status:** done

- [x] One Quaternius base rig and animation library, ready to be shared by the Character, Named NPCs and Shift Customers.
- [x] The Appearance Preset pool covers about 4 body and face presets, plus hair style, hair colour and skin tone. Setup screen 4 previews the real model.
- [x] The Character walks with the shared animations.
- [x] The title screen shows the save's Character in the right third, facing the camera, at the save's place.

## Comments

- **Art source.** Quaternius's free (Standard) packs, all CC0: Universal Base Characters, Modular Character Outfits – Fantasy and Universal Animation Library. `npm run build:characters -- <folder>` assembles them into `public/characters/characters.glb` (2.4 MB) and `animations.glb` (0.5 MB). The source zips are too big for the repo; the script's header says where to get them.
- **What the free packs allow.** Only two outfits fit everyday town life (the two "peasant" outfits, on the Regular male and female skeletons), and the free tier ships no Regular heads. So each build borrows a head from the Superhero bodies, cut by bone weights from the neck up. Those skeletons match the outfits' at the spine and head.
- **Body and face presets.** Four = two builds (masculine and feminine outfit) × two faces. Hair: short, long, buns, buzzed (a cut for each face), short with a beard, bald. Six hair colours and six skin tones tint grey textures. The clothes are fixed per build. Recolouring them to the shared palette is 31a's job.
- **The Appearance Preset is now a composite** (`body`, `hairStyle`, `hairColour`, `skinTone`), matching the glossary. Clothing comes with the build, as the free packs have one everyday outfit per skeleton.
- **Save v17.** It migrates the old placeholder ids to that body, with short hair on bodies 1–2 and long on 3–4. Hair and skin become dark brown and tone 3. The old placeholders' colours were only ever 56 px setup icons (the in-game Character was a capsule), so they are not carried over.
- **Culture Pack tables.** They now name a body and face preset (`body-N`, build and face in `BODY_PRESETS`). Each persona keeps the Japanese pack's build in every pack, and the cross-reference check fails a persona whose build changes. 30b turns these entries into full looks.
- **Jog, not walk.** The Character moves at 4 m/s, about three times the walk clip's ground speed. It plays the library's jog, sped up to match, so its feet don't skate. NPCs walking at everyday speed can use `walk`.
- **Setup preview.** No separate canvas: the live scene behind setup shows the Character in the look being chosen. On screen 4 the camera eases in to a head-to-toe portrait.
- **Shared rig.** `CharacterFigure` (`src/world/CharacterFigure.tsx`) takes any Appearance Preset and a clip (`idle`, `walk`, `jog`, `talk`, `sit`, `interact`), ready for Named NPCs and Shift Customers in 30b.
