# 34b — First café order and the closing card

**What to build:** The First Morning's café order can't fail. The Help tab pulses if the Player goes quiet. Without a mic, the tutorial teaches the Typed Fallback. The morning ends with a card showing the Player's money, "Rent is due on day 7" and a hint that three places are hiring.

**Blocked by:** 34a — First Morning steps and banner

**Spec:** [spec.md](../spec.md): Onboarding (First Morning); Goal Interactions (Patience)

**Status:** ready-for-agent

- [ ] Patience can't run out in the First Morning café order (Vitest).
- [ ] The Help tab pulses after about 10 s of silence or the first not-understood turn. Help is pointed to, never forced.
- [ ] Without a mic, the tutorial teaches the Typed Fallback. Open mic is never taught here.
- [ ] The closing card shows money, "Rent is due on day 7" and the hint that three places are hiring.
