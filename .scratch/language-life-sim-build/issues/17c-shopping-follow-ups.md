# 17c — Shopping follow-ups: fainting with a basket, can't afford, asking with shopping, mock read-back

**What to build:** Close the gaps the 17a review found in how shopping behaves. A basket must never survive Fainting. A Player who can't afford their shopping must have a way forward. The Player must be able to ask where something is even with shopping in the basket. And the mock cashier must read back the total, as the real one does.

**Blocked by:** 17a — Supermarket and convenience store: groceries, inventory, finding an item and counter food

**Spec:** [spec.md](../spec.md): Goal Interactions (Flow step 4, #4, #5); user story 53 (read-back with the price)

**Status:** ready-for-agent

- [ ] Fainting clears the basket and the shelf marker (store Vitest). `faint()` sets `placeId: 'clinic'` itself, so the store's `enterPlace` never sees the Character leave the supermarket and doesn't clear them. Confirm this with a failing test first.
- [ ] Can't afford at the till has a way forward. The spec's Flow says that when the Character can't afford it, "the NPC says so in the Target Language and the conversation continues". Today the cashier is told to say "They can put something back and come again", but `putBack` is disabled during a conversation, so the Player has to leave and start again. Either let the Player put things back mid-conversation (the cashier's FACTS and total would then need to follow the basket), or change the prompt and the mock so the cashier ends politely. Decide which, and test it at the store seam.
- [ ] #5 is reachable with shopping in the basket. `interactionStartedWithE('cashier', { shopping })` sends E to #4 whenever the basket isn't empty, so a Player can't ask where a second item is after picking up the first. Options: a second key or choice at the cashier, or a separate floor-staff spot. The spec has one staff role per counter, so check that before adding an NPC.
- [ ] The mock cashier's read-back includes the total, like the real prompt's ("read back the total from FACTS"). The mock gets the basket through the session (FACTS), or through a structured field added to `NpcSession`. Test it in all four packs (`mockVoiceSession.test.ts`), and update `e2e/groceries.spec.ts`.
