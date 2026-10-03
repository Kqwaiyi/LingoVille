# 04 — Order a drink and pay

**What to build:** The Player orders a drink at the café (Goal Interaction #1) by typing to the mock barista. The barista reads the order back and the Player confirms. The drink is served, payment is taken automatically, Thirst and Mood rise, and a closing card shows something like "Hot latte · −¥450 · Mood ↑". If the Character can't afford it, the barista says so and the conversation continues. Gibberish turns cost hidden Patience. At zero, the barista ends politely and the interaction fails, with a small Mood dip and no charge.

**Blocked by:** 03 — Talk to the barista (mock NPC, typed)

**Spec:** [spec.md](../spec.md): Goal Interactions; Economy; Sim interface

**Status:** ready-for-agent

- [ ] `defineInteraction` content schema: place, NPC role, one goal, facts from the Culture Pack, a completion function with typed arguments, a band and the effect on success. One Zod schema produces both the tool declaration and the argument validator, and a `content` test proves it.
- [ ] Interaction #1 is defined, with one Culture Pack's café menu. Prices are authored as ratios of a Shift's base pay.
- [ ] The prompt requires a read-back and confirmation before the completion function is called, and the mock NPC follows that rule.
- [ ] `applyInteractionOutcome` validates the arguments and checks affordability (money is never in the prompt). Success applies payment, the effect and a small Mood boost. Failure has no effect or charge and a smaller Mood dip. Abandonment costs nothing. Vitest covers each case.
- [ ] Patience starts from the step table in the tuning module. It drops on `not_understood()` or an empty or unreadable transcript, never on a clarifying re-ask. At 0 the NPC ends the conversation as failed.
- [ ] Patience appears only as a placeholder NPC expression (real faces come in ticket 30), never as a number.
- [ ] The closing card shows the outcome and effects with Skip Recap and See Recap. See Recap may be disabled until ticket 06.
- [ ] Playwright (mock mode): walk to the café, order a drink with the Typed Fallback, then see the closing card and the money drop.
