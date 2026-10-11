# The town's own pieces

What Kenney's kits don't have, modelled for the town in Blender: shop awnings, strings of pennants, window boxes, bicycles, café parasols, the town clock, the park's bandstand, the bathhouse's soaking tub, street planters, the tram line's poles, rowing boats, and the backdrop's cottages, townhouses, hills and mountains.

- `pieces.py` is the source: each piece is put together in code, one function each, in the palette's colours.
- `town.blend` is what it builds, one object per piece in the `pieces` collection, to look at and tweak by eye.
- `glb/<piece>.glb` is each piece exported on its own, which `npm run build:town` (`scripts/build-town.ts`) reads as its `town-art` kit. `scripts/town-scenery.ts` says how each goes into `public/town/town.glb`.

**Rules**
- Change a piece in `pieces.py`, then rebuild: never edit `town.blend` or the GLBs by hand, or the next rebuild loses it.
- Each piece stands on the ground with its front facing -Y (glTF's +z), in metres. The town build stands it on its footprint anyway.
- Every material is a palette colour (`src/world/palette.ts`, read by `pieces.py`), named after it. Window glass is `glass` (sky blue), which the game lights at night where the part sets `glass: true`. Walls in lavender and roofs in charcoal are the colours the game repaints per building, as it does the kit's walls and roofs; an awning's red stripes and a bicycle's denim frame are repainted per use too.
- A new piece also needs its name in `SCENERY_PIECES` (`src/world/townArt.ts`) and its parts in `scripts/town-scenery.ts`.

**Rebuilding** (Blender 5.x):

```
blender art/town/town.blend --background --python art/town/pieces.py
npm run build:town -- <folder with the unzipped Kenney kits>
```

The first rebuilds every piece, saves `town.blend` and exports the GLBs; the second builds the town art from the kits and these. Then look at the result in the running game (`npm run dev`) and run the Playwright smoke.
