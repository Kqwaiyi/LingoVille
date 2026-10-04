# 27a — Bathhouse entry

**What to build:** The Player buys bathhouse entry (#21) for a big Mood lift. It counts as a Comfort Purchase.

**Blocked by:** 13b — Greybox town of 11 places, 15b — Mood sources and the Mood modifier

**Spec:** [spec.md](../spec.md): Goal Interactions (#21); Economy (Comfort Purchases)

**Status:** ready-for-agent

- [ ] Interaction #21 (`admit(options)`) is defined and works in all four packs.
- [ ] Success charges the entry price and gives a big Mood lift, set in the tuning module (Vitest).
- [ ] The bathhouse stays open on Sundays in the de pack.
