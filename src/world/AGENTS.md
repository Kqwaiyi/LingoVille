# world

The React Three Fiber scene: town, character controller (Rapier), NPCs, day–night, interaction triggers, sign textures. Three.js is pinned at r186; don't bump it.

**Rules**
- Read game state only through store selectors; change it only through store actions.
- Positions live in the Rapier world. Only the current place id goes into sim state.
- `sim`, `content` and `ai` may not import this module.

**Testing**: no automated 3D visual tests and no scene-graph tests. Put rules in `sim` and test them there. Cover player-visible behaviour in the Playwright smoke.

`npm run test:e2e`
