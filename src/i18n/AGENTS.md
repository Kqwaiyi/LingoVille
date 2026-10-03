# i18n

UI strings for each Native Language (ja, zh, en, de) as typed react-i18next resources.

**Rules**
- UI strings only. NPC speech is generated, and item names and glosses live in Culture Packs (`content`).
- Every key exists in all four languages.

**Testing**: Vitest that every language has the same keys.

`npx vitest run src/i18n`
