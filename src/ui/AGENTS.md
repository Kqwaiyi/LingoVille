# ui

React DOM over the canvas: HUD dock, conversation column, Help, Recap, Journal, setup, title, settings.

**Rules**
- Read game state only through store selectors; change it only through store actions.
- All UI strings come from `i18n`. Never import the gateway (`server/`): call it over `/api`.
- `sim`, `content` and `ai` may not import this module.

**Testing**: don't test component internals. Cover what the Player sees with the Playwright smoke in mock mode (`e2e/`).

`npm run test:e2e`
