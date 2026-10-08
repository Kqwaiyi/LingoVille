# world

The React Three Fiber scene: town, character controller (Rapier), NPCs, day–night, interaction triggers, sign textures. Three.js is pinned at r186; don't bump it.

**Rules**
- Read game state only through store selectors; change it only through store actions.
- Positions live in the Rapier world. Only the current place id goes into sim state.
- `sim`, `content` and `ai` may not import this module.
- The town is built from kit pieces in `public/town/town.glb`, built by `npm run build:town` (`scripts/build-town.ts`) from Kenney's CC0 kits: rebuild it, don't edit the GLB. `Piece` (`Kit.tsx`) draws one; the names the game asks of the art live in `townArt.ts`. Façades, roofs and layout (`town.ts`) are the same in every Culture Pack; only `Props`, `Signs` and the groceries change with the pack.
- Per-pack props are pieces of `town.glb` too, one per `PROP_IDS` (built from `scripts/town-props.ts`). A pack lists the props it sets out at each place; `setDressing.ts` keeps the shared spots for them, by kind (door, counter, table, floor, lawn, platform, shelf), and `setOut` puts each prop in the next free spot of its kind. `tooling/setDressing.test.ts` fails a pack whose props don't fit. Signs are painted from pack strings: every place has a name board, places with a door have their hours beside it, and the café and restaurant have menus.
- Every colour the world draws is a name in `palette.ts`, the one shared palette. No `#hex` colour literals anywhere else in this folder: `tooling/townArt.test.ts` fails them, and fails town art or character outfits off the palette.
- Day and night: `daylight` in `sim` says from the game clock which two lighting presets to blend, where the sun or moon stands and whether the lamps are on (its times live in `DAYLIGHT` in `tuning.ts`). `Lighting.tsx` holds what each preset looks like, in palette colours, and blends them each frame. A window is clear while its place is open and dark while it's closed; from dusk, open places' windows and the street lights are lit, sharing one lamplight material that glows brighter as night falls.
- Everyone on the character rig (Character, Named NPCs, Shift Customers) is drawn by `CharacterFigure` from an Appearance Preset. The art in `public/characters/` is built by `npm run build:characters` (`scripts/build-characters.ts`): rebuild it, don't edit the GLBs. The names the game asks of the art live in `characterArt.ts`, and `tooling/characterArt.test.ts` fails art that lacks one. An NPC's Patience shows only as `CharacterFigure`'s `expression`, in town and in the conversation column's portrait (`NpcPortrait`).

**Testing**: no automated 3D visual tests and no scene-graph tests. Put rules in `sim` and test them there. Cover player-visible behaviour in the Playwright smoke.

`npm run test:e2e`
