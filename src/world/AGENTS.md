# world

The React Three Fiber scene: town, character controller (Rapier), NPCs, day–night, interaction triggers, sign textures. Three.js is pinned at r186; don't bump it.

**Rules**
- Read game state only through store selectors; change it only through store actions.
- Positions live in the Rapier world. Only the current place id goes into sim state.
- `sim`, `content` and `ai` may not import this module.
- Everyone on the character rig (Character, Named NPCs, Shift Customers) is drawn by `CharacterFigure` from an Appearance Preset. The art in `public/characters/` is built by `npm run build:characters` (`scripts/build-characters.ts`): rebuild it, don't edit the GLBs. The names the game asks of the art live in `characterArt.ts`, and `tooling/characterArt.test.ts` fails art that lacks one. An NPC's Patience shows only as `CharacterFigure`'s `expression`, in town and in the conversation column's portrait (`NpcPortrait`).

**Testing**: no automated 3D visual tests and no scene-graph tests. Put rules in `sim` and test them there. Cover player-visible behaviour in the Playwright smoke.

`npm run test:e2e`
