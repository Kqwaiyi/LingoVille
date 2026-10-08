# 27 — Bathhouse, gym and Fitness

**What to build:** The Player buys bathhouse entry (#21) for a big Mood lift; it counts as a Comfort Purchase. The Player can also join the gym (#22). Membership lasts 30 days and is renewed by talking to the attendant. With membership, one gym session a day (about 1 game hour) gives Fitness XP and a small Mood lift. Fitness lowers the chance of Illness and slows Health loss when Hunger or Thirst is at zero.

**Blocked by:** 13b — Greybox town of 11 places and tram travel, 15 — Sleep, Mood sources and the Mood modifier, 17b — Cooking and Life Skills

**Spec:** [spec.md](../spec.md): Goal Interactions (#21, #22); Economy (Comfort Purchases); Life Skills (Fitness); Decisions made before ticketing (6)

**Status:** done

- [x] Interaction #21 (`admit(options)`) is defined and works in all four packs.
- [x] Bathhouse success charges the entry price and gives a big Mood lift, set in the tuning module (Vitest).
- [x] The bathhouse stays open on Sundays in the de pack.
- [x] Interaction #22 (`register_member()`) is defined, with a short renewal path for an expired membership, and works in all four packs.
- [x] Membership lasts 30 in-game days and costs about 0.5 Shift. It is never charged automatically and never becomes debt. Once it expires, sessions are refused until it's renewed (Vitest).
- [x] `gymSession`: one a day, taking about 1 game hour, giving Fitness XP × the Mood modifier and a small Mood lift (Vitest).
- [x] Fitness lowers Illness chance by up to 40% at level 5, recorded for Illness, and slows the Health drain at zero Hunger or Thirst (Vitest).

## Comments

- **Bath (#21):** `buyBathEntry` (`admit(options)`, B), E at the attendant. The new good `bath-entry` (0.1 Shift: ¥600, 24元, £6, €6) is a Comfort Purchase of kind `bathhouse`, so it goes through the usual order path. `MOOD.changes.bathhouse` moved into `MOOD.changes.comfortPurchase.bathhouse` (8, the biggest of the kinds, on top of the success lift). `options` (`towel`, `sauna`) are flavour only: both come with entry, like the supermarket's bag.
- **Gym (#22):** `joinTheGym` and `renewGymMembership` share `register_member(kind)` (I). Gemini rejects an OBJECT with no properties, so the completion takes `kind: 'join' | 'renew'`, which is flavour only: the sim knows which. Membership is the good `gym-membership`, priced at `ECONOMY.gymMembershipInShifts` so each pack rounds it (¥3,000, 120元, £30, €30), and the `registerMember` effect sets `gymMembershipUntilDay` (`membershipBoughtUntil`). Renewing early adds the 30 days on after the days already paid for. Nothing ever charges it again, and it never becomes debt.
- **Which key (decided):** E at the attendant sells a bath. F joins the gym ("Press F to ask about the gym"), renews it once it has run out ("Press F to renew your gym membership"), and offers nothing while it runs. T chats. `Bringing` gained `gymMembership` (`sim` `gymMembership(state)`: `none`, `active` or `expired`).
- **Gym sessions:** `gymSession(state, hours)` at a new `gym` interactable (a running machine by the bathhouse's west wall, `BATHHOUSE_GYM`), E to work out. It ticks `LIFE_SKILLS.gymSessionGameMinutes` (60), then gives `xpPerGymSession` × the Mood modifier the session started in and `MOOD.changes.gymSession`. Fainting during it gives nothing. It counts toward the day it started. `gymRefusal` says why not (`notMember`, `expired`, `doneToday`, `closed`), which the store shows as a toast.
- **Fitness:** the Health drain at zero Hunger or Thirst is multiplied by 1 at level 0 down to `fitnessDeprivedDrainAtMax` (0.6) at level 5, so a fit Character faints later. **Illness should multiply its daily chance by `fitnessIllnessFactor(state)`** (1 at level 0, 0.6 at level 5), exported from `sim` for 28a.
- **Facts:** a new fact source, `bathhouse`, gives the entry and membership prices and how membership works. Town places can now carry staff `facts` in a pack (`localPlaceFacts`), and each pack's bathhouse has its own (bath manners, the de sauna, the en steam room, where the gym is). The bathhouse stays a town place rather than a shop, so its UI label doesn't change.
- **Prompts:** the session builder has goal rules for `admit` and `registerMember`, which answer "done". The generic rules said "served".
- **Sunday in de** was already open in `places.ts` (from 13a). `bathhouse.test.ts` checks the attendant sells a bath on a de Sunday.
- **Mock:** the attendant asks about a towel and reads back the bath with its price before `admit`, reads back membership before `register_member`, and renewing, reads it back as it greets. All four packs are covered in `mockVoiceSession.test.ts`, and `e2e/bathhouse.spec.ts` is the ja smoke (bath, gym refused, join then work out).
- **Decisions from the review (judgement calls):**
  - While membership runs, F at the attendant offers nothing, so a member asks about gym rules on T (Small Talk), not #22. Renewing early can't be started in play, but the sim still adds the 30 days on after the days paid for, rather than losing them, if it ever is.
  - `gymRefusal` says the bathhouse is closed before anything about membership.
  - The goods' names don't say "30 days" (that's `ECONOMY.gymMembershipDays`, which the `bathhouse` facts state). The facts' "once a day" is still prose, not `LIFE_SKILLS.gymSessionsPerDay`.
  - Adding an effect kind still means edits in `EffectKind`, `EffectFor`, the definition schema, `resolveEffect`, `goalBlock` and the mock's `castNpc`. The mock tells a renewal from a join by the renewal goal's text in the system instruction.
- **Not done:** prompts changed (three new attendant sessions, the `bathhouse` facts), so this needs a passing `npm run eval` before merging. It hasn't been run.
