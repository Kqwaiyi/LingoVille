# The town's own pieces

The town's own pieces, modelled in Blender in code: the buildings themselves (`architecture.py`: walls in plaster on a stone plinth, recessed casement windows with stone surrounds, keystones and sills, the doorway's pilasters and corniced lintel, panelled doors, oak floors, tiled gable roofs with fascias, gutters and barge boards, flat roofs, parapets, quoins, downpipes, chimneys, the cast-iron street lamps, the tram track and the tram stops' shelters and poles); the trees, shrubs and hedges (`nature.py`); most of the rooms' furniture and the park's benches (`furnishings.py`); and what Kenney's kits don't have (`pieces.py`): shop awnings, strings of pennants, window boxes, bicycles, café parasols, the town clock, the park's bandstand, the bathhouse's soaking tub, street planters, the tram line's poles, rowing boats, door lanterns, books and goods to stock the shelves, the bathhouse's towel cubbies, and the backdrop's cottages, townhouses, hills and mountains.

- `pieces.py` is the source, with the modules it reads: each piece is put together in code, one function each, in the palette's colours.
- `town.blend` is what it builds, one object per piece in the `pieces` collection, to look at and tweak by eye.
- `glb/<piece>.glb` is each piece exported on its own, which `npm run build:town` (`scripts/build-town.ts`) reads as its `town-art` kit. `scripts/town-scenery.ts` says how each goes into `public/town/town.glb`.

**Rules**
- Change a piece in `pieces.py`, then rebuild: never edit `town.blend` or the GLBs by hand, or the next rebuild loses it.
- Each piece stands on the ground with its front facing -Y (glTF's +z), in metres. The town build stands it on its footprint anyway.
- Every material is a palette colour (`src/world/palette.ts`, read by `pieces.py`) and what it's made of (`src/world/surfaces.ts`), named `colour:surface`: `lavender:plaster`, `stone:stone`, `charcoal:tile`, `wood:planks`. A bare colour is matte. Window glass is `glass`, which the game draws as glass and lights at night where the part sets `glass: true`. Walls in lavender and roofs in charcoal are the colours the game repaints per building; an awning's red stripes, a bicycle's denim frame, the furniture's red upholstery and the rugs' red and brick are repainted per use too, and keep their surface.
- A piece that replaces a kit piece keeps that piece's size, and stands where the town expects it: walls 2 m long, a storey (2.4 m) high and 0.3 m thick, reaching as far in as out so they stand on their middle; a gable roof modelled for a 9 m deep building, which the town stretches; a street lamp's pole 0.58 m from its middle.
- A new piece also needs its name in `SCENERY_PIECES` (`src/world/townArt.ts`) and its parts in `scripts/town-scenery.ts`.

**Rebuilding** (Blender 5.x):

```
blender art/town/town.blend --background --python art/town/pieces.py
npm run build:town -- <folder with the unzipped Kenney kits>
```

The first rebuilds every piece, saves `town.blend` and exports the GLBs; the second builds the town art from these and the kits (carrying over the kits' pieces from the last build if the folder isn't given). With Blender open and its MCP add-on connected, `pieces.py` can be run in it as well, to look at the pieces as they're built. Then look at the result in the running game (`npm run dev`) and run the Playwright smoke.
