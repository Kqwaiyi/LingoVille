# world

The React Three Fiber scene: town, character controller (Rapier), NPCs, day–night, interaction triggers, sign textures. Three.js is pinned at r186; don't bump it.

**Rules**
- Read game state only through store selectors; change it only through store actions.
- Positions live in the Rapier world. Only the current place id goes into sim state.
- `sim`, `content` and `ai` may not import this module.
- The town is built from kit pieces in `public/town/town.glb`, built by `npm run build:town` (`scripts/build-town.ts`) from Kenney's CC0 kits: rebuild it, don't edit the GLB. `Piece` (`Kit.tsx`) draws one; the names the game asks of the art live in `townArt.ts`. Façades, roofs and layout (`town.ts`) are the same in every Culture Pack; only `Props`, `Signs` and goods change with the pack.
- Every colour the world draws is a name in `palette.ts`, the one shared palette. No `#hex` colour literals anywhere else in this folder: `tooling/townArt.test.ts` fails them, and fails town art or character outfits off the palette.
- Everyone on the character rig (Character, Named NPCs, Shift Customers) is drawn by `CharacterFigure` from an Appearance Preset. The art in `public/characters/` is built by `npm run build:characters` (`scripts/build-characters.ts`): rebuild it, don't edit the GLBs. The names the game asks of the art live in `characterArt.ts`, and `tooling/characterArt.test.ts` fails art that lacks one. An NPC's Patience shows only as `CharacterFigure`'s `expression`, in town and in the conversation column's portrait (`NpcPortrait`).

**Testing**: no automated 3D visual tests and no scene-graph tests. Put rules in `sim` and test them there. Cover player-visible behaviour in the Playwright smoke.

`npm run test:e2e`
