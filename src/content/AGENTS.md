# content

Zod schemas and authored data: interactions, Shift templates, Culture Packs (ja/zh/en/de), Illnesses, Comfort Purchases, places, NPC personas, appearance tables.

**Rules**
- Data plus schemas only. Never import `world`, `ui` or `voice` (lint enforces it).
- Prices are ratios of one Shift's base pay, converted per pack.
- An interaction's tool declaration and argument validator come from one schema.

**Testing**: Vitest validation, data in → validation result. Every schema passes, and cross-references hold in all four packs (items, persona localisations and appearances, glosses in all three other Native Languages, price conversion).

`npx vitest run src/content`
