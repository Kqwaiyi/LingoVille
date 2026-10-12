# Credits

The art and sound the game ships with, and their licences. Sourcing is CC0 first. A CC-BY asset must be listed under **CC-BY** with its creator, title, source and licence, as the licence asks. The in-game credits screen (Settings → Credits) reads this file itself, so keep each list a table under its heading. The CC-BY table's columns are `Asset | Creator | Source | Licence | Used for`, with the licence as `CC BY 4.0` (or whichever version); `tooling/credits.test.ts` checks the shape.

## CC-BY

None yet.

## CC0

These are public domain (CC0 1.0). No credit is required, but they're credited here anyway.

| Asset | Creator | Source | Used for |
| --- | --- | --- | --- |
| Building Kit | Kenney | https://kenney.nl/assets/building-kit | The running machine, and parts of the Culture Packs' props |
| City Kit (Roads) | Kenney | https://kenney.nl/assets/city-kit-roads | The running machine's belt |
| Train Kit | Kenney | https://kenney.nl/assets/train-kit | The trams |
| Furniture Kit | Kenney | https://kenney.nl/assets/furniture-kit | Some of the furniture (shelves, desks, the bathroom's), and parts of the Culture Packs' props |
| Nature Kit | Kenney | https://kenney.nl/assets/nature-kit | Flowers, rocks, lilies, grass and fences |
| Food Kit | Kenney | https://kenney.nl/assets/food-kit | Food, dishes, pots and packaging in the Culture Packs' props |
| Fantasy Town Kit | Kenney | https://kenney.nl/assets/fantasy-town-kit | The fountain, market stalls and a cart; stools, benches and pointed roofs in the Culture Packs' props |
| Universal Base Characters | Quaternius | https://quaternius.itch.io/universal-base-characters | Everyone's bodies, heads and hair |
| Modular Character Outfits – Fantasy | Quaternius | https://quaternius.itch.io/modular-character-outfits-fantasy | Everyone's everyday clothes |
| Universal Animation Library | Quaternius | https://quaternius.itch.io/universal-animation-library | Everyone's animations |

All of it is recoloured to the town's palette by `npm run build:town` and `npm run build:characters`, and its surfaces (wood, cloth, leaves, stone) are drawn with the town's own detail textures.

The buildings themselves (walls, windows, doors, floors, tiled roofs, parapets, quoins, downpipes and chimneys), the street lamps, the tram track and stops, the benches, the trees, bushes and hedges, most of the rooms' furniture, and what no kit has (awnings, pennants, window boxes, bicycles, parasols, the town clock, the bandstand, the bath, planters, tram poles, boats, door lanterns, the shelves' books and goods, the bathhouse's cubbies, the backdrop's houses, hills and mountains) are modelled for the game in Blender, in `art/town/`. The surfaces' detail textures (plaster, brick, stone, tiles, boards, cloth, leaves, grass, tarmac, setts, paving, gravel) are drawn by the game's own script (`scripts/build-surfaces.ts`), so there's no texture source to credit.

The music, ambient sound and UI sounds are synthesised by the game as it plays (`src/audio`), so there are no sound files to credit.

The sky, with its clouds, sun, moon and stars, is drawn by the game's own shaders (`src/world/Sky.tsx`), so there are no sky textures to credit.
