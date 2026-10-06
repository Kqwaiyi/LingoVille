# 21 — The cashier job: scanning, cash and change

**What to build:** The Player gets hired at the supermarket (#27) and works cashier Shifts. Customers pay for their items, and the Player scans them and toggles bag and points card as asked. Harder customers pay cash and ask for an item from behind the counter: the Player fetches it and picks coins for change in the pack's currency. The Cashier skill suggests coins.

**Blocked by:** 20b — Barista skill, translated customers and overwork

**Spec:** [spec.md](../spec.md): Jobs and Shifts; Goal Interactions (#27); Life Skills

**Status:** done

- [x] Hiring interaction #27, with the same name check and retry rules as the barista. `INTERACTIONS.askCashierForWork`, on F at the cashier when the Character brings no shopping (with shopping, F still asks where something is).
- [x] Cashier template B (pays, bag/points or not). `cashier-pays`: 1–3 kinds of groceries, one or two of each, a bag or not and a points card or not (`ECONOMY.checkout`), paid by card.
- [x] Scanner and toggles UI. `Till` (`src/ui/ShiftPanel.tsx`): tap the shopping on the counter to scan it, Bag and Points card toggles, undo/redo/clear, Finish sale.
- [x] Cashier template I (pays cash, item from behind the counter). `cashier-pays-cash`: the same, plus one of `BEHIND_THE_COUNTER` (batteries, stamps, gift card), paid in cash: the total rounded up to any coin or note in the drawer, so ¥1,500, ¥2,000 or ¥10,000 for ¥1,280.
- [x] A coin tray with the pack's denominations, in all four packs. `currency.denominations` (¥1–¥10,000, 0.1–100元, £0.01–£50, €0.01–€50); a content test checks every price is made exactly by the smallest coin.
- [x] The exact check covers items, toggles, the fetched item and the change (Vitest). `applyShiftCustomer(state, served, { atTheTill })` (`src/sim/checkout.test.ts`); change is compared in hundredths, so float dust never fails a sale.
- [x] The Cashier skill earns XP per customer, and its mechanics aid is coin suggestions. XP is the shared per-customer rule. `suggestedChange` (Cashier 1, `LIFE_SKILLS.jobAidsFromLevel`) counts out the fewest coins (`suggestChange`) for the change due on the cash the Player **keyed in**, never on what the customer actually handed over.

## Comments

- **How change works:** the Player keys in the cash they heard ("Cash handed over"), and the till shows the change due from it, as a real till does. Hearing the amount is the language task. The coin tray hands the change over, and the aid only does the counting out. **Design call to confirm:** the level-0 till already does the subtraction, so the aid saves taps rather than arithmetic. If the subtraction should be the Player's job until Cashier 1, hide "Change due" behind the aid.
- **Customer data:** a Shift Customer has a `checkout` (bag, points card, item from behind the counter, cash handed and change due, in local money), and their `order` is everything to ring up. The sim draws the cash from the pack's `Till` (`tillFor(packId)`, from content), passed into `nextShiftCustomer`. Save v11 adds `checkout: null` to a customer at the counter.
- **Prompts changed: needs a passing `npm run eval` before merging.** The cashier Shift Customer's prompt (`YOUR SHOPPING`: they tell the cashier their bag, points card, the item from behind the counter and the cash, and never the total or change), the served scene at the till, the Shift Recap's till line, and per-Job hint examples. The barista prompts are byte-identical (no barista snapshot changed). There are no cashier eval cases yet.
- **World:** `WORKPLACES` (`src/world/town.ts`) holds each Job's staff door, the spot behind its counter and the customer's spot. The supermarket's staff door is in its west wall, level with the customers' side of the till.
- **Review tidy-ups not done (judgement calls):** "is this the till?" is decided in several places (`isCheckout`, the sim's own copy, `counterFor`, `serveTray`, the UI's `jobId === 'cashier'`, the mock's `readCheckout`). Money is a plain local `number`, with `hundredths` at each boundary rather than a Money type. The checkout Zod shape exists in both `saves.ts` and `ai/recap.ts`. `nextShiftCustomer`'s `till` is optional and throws for a checkout template without one. The cashier hints suggest asking how the customer will pay, which the till doesn't record.
- **Not covered:** the Shift-end card still doesn't show XP gained. The Playwright smoke (`e2e/cashier.spec.ts`, from B1) covers hiring, scanning, toggles, fetching, the coin tray and pay, but not the Suggest coins button, which is tested at the store seam.
