# content

Zod schemas and authored data: interactions, Shift templates, Culture Packs (ja/zh/en/de), Illnesses, Comfort Purchases, places, NPC personas, appearance tables.

**Rules**
- Data plus schemas only. Never import `world`, `ui`, `voice` or `audio` (lint enforces it).
- Prices are ratios of one Shift's base pay, converted per pack.
- Each pack dresses all 11 places with props of its own (`props`): no place may be dressed just as another pack dresses it. `shelves` says how each grocery looks on the shelf. Where the props stand is the world's business.
- An interaction's tool declaration and argument validator come from one schema.
- Everyone in town is Clawd, told apart by what they wear (`appearance.ts`). Each pack dresses every Named NPC (`appearances.npcs`) in a hat, eyewear and neckwear in a colour, with the build their voice suits, the same in every pack; the Named NPCs at one place never wear the same. The colours what's worn comes in are the world's palette colours, by name.

**Testing**: Vitest validation, data in → validation result. Every schema passes, and cross-references hold in all four packs (items, persona localisations and appearances, glosses in all three other Native Languages, price conversion).

`npx vitest run src/content`
