# Onboarding and Native Language selection

Type: grilling
Status: resolved
Blocked by: 02, 08
Map: [Language-learning life sim](../map.md)

## Question

What happens from first launch to the first real interaction? Pin down: how Native Language is detected from the player's region, what happens when that region's language isn't one of the four (fallback? prompt?), and whether the player can override it; picking the Target Language and starting level; microphone permission flow and what happens if it's denied; and how the tutorial teaches movement, Well-being, Speaking, Help and the Typed Fallback.

From [Anatomy of an interaction](02-anatomy-of-an-interaction.md): the tutorial must teach E to talk, holding Space to speak (and the open-mic option), the Help side panel, and the Recap.

From [Life Skills and Language Proficiency models](08-life-skills-and-proficiency.md): the starting level is a self-assessment, with one of four Native-Language descriptions picked → A1, A2, B1 or B2. There is no placement test, and the first ~10 interactions correct a wrong pick quickly. One save holds one Target Language.

## Answer

Resolved on 2026-10-03 by grilling.

**Setup screens.** First launch shows four short screens, all in the Native Language, then loads the town.

1. **Native Language.** Pre-selected from `navigator.languages`: the first entry whose base tag is `ja`, `zh`, `en` or `de`. If none matches (for example a French-only browser), English is pre-selected. Detection only sets the default, and the player confirms or changes it.
2. **Target Language.** The three languages other than the Native one; the Native one is shown greyed out. Each says which Culture Pack comes with it (for example "English: set in a UK town").
3. **Self-assessment.** Four descriptions mapped to A1 / A2 / B1 / B2 (see [Life Skills and Language Proficiency models](08-life-skills-and-proficiency.md)).
4. **Mic check.** The browser permission prompt, a live level meter and "say anything". This screen can be skipped. It also has a **Skip tutorial** option.

If Character naming or appearance is added later (see the Art & audio direction fog), it becomes a fifth screen.

**Changing Native Language later.** Allowed at any time in Settings, and only the UI changes. Recaps already in the Journal stay in the language they were written in, and new ones use the new language. Native ≠ Target is always enforced.

**Mic denied or unavailable.** The save defaults to the **Typed Fallback**. The conversation UI shows a small "🎤 off. Enable in Settings" chip, and Settings has a **Retry microphone** button. Nothing is locked, because every Goal Interaction, Shift and Small Talk works typed. There is no penalty, and the reminder appears at most once per in-game day.

**Gemini key.** It is not part of onboarding. The key sits in the local server's `.env` as a developer setup step. If the server can't get a token, the game shows a plain "Voice service unavailable: check the local server" error screen (details belong to [Technical architecture](10-technical-architecture.md)).

**First Morning (the tutorial).** A scripted first morning in the real town, guided by UI prompts in the Native Language. NPCs never explain controls and stay Target-Language-only.

- **Starting state:** day 1, 07:00, at home. Balance is ~1.7 Shifts, Health full, Hunger ~60%, Thirst ~40%, Mood neutral. Rent is first due at the end of day 7.
- **Sequence:** movement → "You're thirsty: drink water at the sink" (introduces the Well-being meters) → "Get breakfast at the café" → the first café order (Goal Interaction #1 "Order a drink"). This teaches **E** to talk, **hold Space** to speak, the **Help** panel and the **Recap**.
- **The first order is real.** It costs real money and its Recap counts as Proficiency evidence, so it starts the fast-start correction. The one exception: **Patience can't run out**, and instead of failing, the barista keeps re-asking.
- **Help is pointed to, never forced.** At the greeting: "Hold Space to answer. Not sure what to say? Press H for Help (time and Patience pause)". After ~10 s of silence or the first not-understood turn, the Help key pulses.
- **Without a mic**, the same step teaches the Typed Fallback ("Type your answer and press Enter"). Push-to-talk then gets a one-time tooltip once a mic becomes available. Open mic is never taught in the First Morning, only in Settings or a tooltip.
- **Prompts don't block.** The current prompt stays pinned in a corner with a direction marker. Any equivalent action completes a step (a drink bought at the supermarket satisfies "drink something"). The tutorial can be skipped from the pause menu.
- **Closing card:** current money, "Rent is due on day 7", and "Need money? The café, supermarket and restaurant are hiring. Ask the staff for work." No marker points to a particular place. The prompts then stop.
- **Contextual tooltips** cover what the morning doesn't reach (Shifts, Fainting, the Journal after the first Recap is closed, open mic, the Typed Fallback). Each fires once, the first time it's relevant, and all of them can be turned off in Settings. They also fire when the tutorial was skipped.

**New decision: Job hiring.** Each Job begins with a one-time **hiring Goal Interaction** with that place's staff ("Can I work here?", give your name, say when you can start). These are B-level, can be retried if they fail, and anyone can be hired on day 1, so "all Jobs open from day 1" still holds. After hiring, pressing **E at the staff door** during opening hours starts a Shift. There is no schedule. This adds **3 Goal Interactions** to the catalogue in [Town and content scope](07-town-and-content-scope.md) (28 in total).

**Amended by [NPC identity and memory](11-npc-identity-and-memory.md):** the self-assessment screen also has a single "your name" field for the Character. The hiring Goal Interaction checks the spoken name against it.
