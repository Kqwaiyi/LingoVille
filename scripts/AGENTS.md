# scripts

Offline asset builds, run by hand. Their output is committed, and the game never imports these scripts.

**Rules**
- Each script names, in its header, the sources it reads, where to get them and their licence. Sources too big for the repo stay out of it.
- Rebuild an asset with its script instead of editing the output by hand.

**Testing**: no unit tests. Run the script, then look at the result in the running game (`npm run dev`) and run the Playwright smoke.

`npm run build:town -- [folder with the unzipped Kenney kits, each in a folder named for its page]`

`npm run build:surfaces`

The town art includes every Culture Pack's props, put together part by part in `scripts/town-props.ts` from the Food Kit, the Fantasy Town Kit and the town's own kits, and the scenery, in `scripts/town-scenery.ts`. List any new source in `CREDITS.md`, and a CC-BY one under CC-BY.

The buildings, street lamps, tram track and stops, trees and most of the furniture, and what no kit has, are modelled in Blender, in the repo under `art/town/` (see its `README.md`): `art/town/pieces.py` builds `town.blend` and exports `art/town/glb/`, which `build:town` reads as its `town-art` kit. Rebuild those first when a piece changes: `blender art/town/town.blend --background --python art/town/pieces.py`. The kits are optional: a piece whose kit isn't in the folder (or with no folder at all) is carried over from the `town.glb` already built, so a change to the town's own pieces needs no download.

The town build paints its art in the town's palette (`src/world/palette.ts`), snapping each colour to its nearest (`scripts/palette.ts`). The town's materials are each a palette colour and a surface (`src/world/surfaces.ts`): the Blender pieces name theirs (`colour:surface`), and `scripts/town-surfaces.ts` says what each kit piece's colours are made of. Shading is smooth where faces meet at a shallow angle and sharp at an edge (`SMOOTH_ANGLE`), not flat.

`build:surfaces` (`scripts/build-surfaces.ts`) draws each surface's detail texture into `public/town/surfaces/`: tiling noise and patterns (bricks, setts, boards, tiles, leaves), the tilt in red and green and the shade in blue. A new surface in `SURFACE_LOOKS` with a texture needs a drawing here.

The character art (Clawd, whom everyone in town is) has no build script here: it's modelled, rigged and animated in Blender and exported straight to `public/characters/clawd.glb` by `art/characters/clawd.py` (see its `README.md`).

`npx tsx scripts/fetch-itch.ts <page url> <part of the upload's file name> <out file>` downloads a free itch.io pack (Kenney, for instance) without a browser.
