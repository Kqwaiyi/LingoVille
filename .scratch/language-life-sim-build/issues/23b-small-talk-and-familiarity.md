# 23b — Small Talk and Familiarity

**What to build:** Pressing E on an idle Named NPC starts Small Talk. It has no goal and can't fail. Mood rises with each understood exchange, the NPC wraps up after 6–8 exchanges or when busy, and the conversation gets a lighter Recap. Over 1–2 weeks of regular visits, NPCs move from stranger to acquaintance to friend. They learn the Character's name only when told, and use it from then on. They follow up on what was talked about last time. A friend has +1 Patience.

**Blocked by:** 23a — Named NPC personas and NPC Memory records

**Spec:** [spec.md](../spec.md): Goal Interactions (Small Talk); Recap and Journal; Named NPCs, Familiarity and NPC Memory; NPC prompt assembly ("You and this person")

**Status:** done

- [x] E on an idle Named NPC (no queue, not mid-order) starts Small Talk. E starts it with a Named NPC who has no Goal Interaction on E (park regulars, shopkeeper, attendant, office clerk, receptionist, doctor, pharmacist, nurse). Staff whose E is a Goal Interaction chat on **T** instead ("· Press T to chat" in the prompt). `selectSmallTalkKey` says which (`src/store/smallTalk.test.ts`).
- [x] Small Talk mode has no completion function, can't fail, and the NPC points any stated goal to the counter instead of switching modes. `buildSmallTalkSession` offers only `learn_name` and `not_understood`; `not_understood` always answers `noted`.
- [x] The NPC wraps up after about 6–8 exchanges, or when busy. `startSmallTalk` draws the length (`SMALL_TALK.exchanges`) from the save's RNG. Once that many player turns are done, or the NPC's place has closed, the store sends `WRAP_UP_SCENE`; the goodbye then shows the closing card ("Nice chat!", Mood ↑).
- [x] Mood per understood exchange counts under a per-NPC daily cap, stored on the NPC Memory record (Vitest). `smallTalkExchange` (`src/sim/familiarity.test.ts`); Mood per exchange rises by tier (`MOOD.changes.smallTalkExchange`).
- [x] Small Talk gets the lighter Recap (snapshot of the request builder). The store now asks for it (`kind: 'smallTalk'`), and the Journal keeps a `smallTalk` page (Journal schema v5).
- [x] Familiarity comes mostly from Small Talk, and a little from successful Goal Interactions with that NPC. It shares the per-NPC daily cap with Small Talk Mood. Tier thresholds come from the tuning module, and Familiarity never decays (Vitest). Daily chats make a friend in 8 days with the current tuning.
- [x] `learn_name` is a session tool for Named NPCs, checked by the sim against the setup name. NPCs greet the Character by name from acquaintance up. Hiring sessions don't offer it, since `hire_applicant` takes the name.
- [x] The Recap's optional `lastTopic` overwrites the previous one (`rememberTopic`, after any Named NPC Recap).
- [x] The "You and this person" prompt block is built from NPC Memory, with snapshots for a stranger and a friend.
- [x] A friend has +1 Patience (Vitest). `startPatience(step, tier)`.
- [x] Familiarity never gives discounts or unlocks Help. A friend pays the same (`familiarity.test.ts`); Help is untouched.

## Comments

- **T for staff:** decided with the user. E keeps every existing Goal Interaction; T (which focuses the typed field only inside a conversation) starts Small Talk with staff.
- **Local names for the park, bookshop, bathhouse and town office:** each pack now has `townPlaces`, so `localPlaceName` (chat header, Journal, Recap prompt) works wherever a Named NPC stands.
- **Workplaces per NPC:** every Named NPC now has a workplace in the prompt. The park regulars are "one of the regulars at <park>" and not at work; the receptionist, doctor and pharmacist are at the hospital, not on the Fainting ward.
- **Idle and busy:** the cashier isn't idle while the Character carries shopping (E pays, so no T). "Busy" is the NPC's place closing mid-chat, which wraps the chat up. That's the one exception to "closing time never ends a conversation under way".
- **Small Talk can't fail:** `not_understood` always answers `noted`, and a turn the NPC didn't understand counts for nothing, even with Help open.
- **Leaving Small Talk early, or losing the connection,** counts as meeting the NPC and keeps the Mood already lifted. There's no closing card and no Recap, as with abandoning a Goal Interaction. Leaving saves.
- **Daily cap:** with the current tuning (cap 6, 2 per exchange) only the first 3 understood exchanges a day with one NPC lift Mood and Familiarity. That's the spec's shared cap, and it gives friend in 8 days of daily chats. Retune in `tuning.ts` if it feels stingy.
- **Not done here:** `usualOrder` ("the usual?"), the friend's casual-register offer and `reveal_favourite` belong to later tickets (26a/26b).
- **Prompt changed: needs a passing `npm run eval` before merging.** Every Named NPC session now has `learn_name` and a learn-name line, the "You and this person" block reads NPC Memory, and Small Talk sessions are new.
