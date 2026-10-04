# i18n

UI strings for each Native Language (ja, zh, en, de) as typed react-i18next resources.

**Rules**
- UI strings only. NPC speech is generated, and item names and glosses live in Culture Packs (`content`).
- Every key exists in all four languages. `en.ts` is the source; `ja`, `zh` and `de` are typed `UiStrings`, so a missing key fails the typecheck too.
- A translation fills in the same `{{placeholders}}` and wraps the same `<tags>` (rendered with `Trans`) as English. No plural keys: ja and zh have no plural forms, so reword instead.
- The UI follows the store's Native Language through `useShowNativeLanguage`. A Journal page keeps the language it was written in (`useTranslation(undefined, { lng })`).

**Testing**: Vitest that every language has the same keys, no empty strings and the same placeholders and tags. German fitting the dock and conversation column is a Playwright check (`e2e/languages.spec.ts`).

`npx vitest run src/i18n`
