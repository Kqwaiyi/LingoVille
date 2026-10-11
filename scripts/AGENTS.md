# scripts

Offline asset builds, run by hand. Their output is committed, and the game never imports these scripts.

**Rules**
- Each script names, in its header, the sources it reads, where to get them and their licence. Sources too big for the repo stay out of it.
- Rebuild an asset with its script instead of editing the output by hand.

**Testing**: no unit tests. Run the script, then look at the result in the running game (`npm run dev`) and run the Playwright smoke.

`npm run build:characters -- <folder with the unzipped Quaternius packs>`

`npm run build:town -- <folder with the unzipped Kenney kits, each in a folder named for its page>`

The town art includes every Culture Pack's props, put together part by part in `scripts/town-props.ts` from the Food Kit, the Fantasy Town Kit and the town's own kits, and the scenery, in `scripts/town-scenery.ts`. List any new source in `CREDITS.md`, and a CC-BY one under CC-BY.

What no kit has is modelled in Blender, in the repo under `art/town/` (see its `README.md`): `art/town/pieces.py` builds `town.blend` and exports `art/town/glb/`, which `build:town` reads as its `town-art` kit. Rebuild those first when a piece changes: `blender art/town/town.blend --background --python art/town/pieces.py`.

Both paint their art in the town's palette (`src/world/palette.ts`): the town by snapping each colour to its nearest (`scripts/palette.ts`), the outfit by a lightness ramp of palette browns.

`npx tsx scripts/fetch-itch.ts <page url> <part of the upload's file name> <out file>` downloads a free itch.io pack (Kenney, Quaternius) without a browser.
