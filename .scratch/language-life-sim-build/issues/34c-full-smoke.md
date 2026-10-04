# 34c — Full Playwright smoke test

**What to build:** One end-to-end smoke test proves the whole first session works in mock mode, from a fresh browser to Continue.

**Blocked by:** 34b — First café order and the closing card

**Spec:** [spec.md](../spec.md): Testing Decisions (Playwright smoke)

**Status:** ready-for-agent

- [ ] Playwright (mock mode): setup (5 screens) → First Morning → café order with the Typed Fallback → closing card → Recap → Journal entry exists → reload → Continue lands in the same state.
- [ ] The existing smoke tests are folded into it or kept, with no duplicated paths.
