# Life Skills and Language Proficiency models

Type: grilling
Status: resolved
Blocked by: 02
Map: [Language-learning life sim](../map.md)

## Question

How do the two progression systems work? For Life Skills: which ones exist, how each grows, and what each unlocks or improves. For Language Proficiency: the scale (CEFR A1–C2, or simpler), which signals from interactions move it and by how much, how the starting level is chosen, and concretely how NPCs adapt to it (vocabulary, speed, patience, use of Native Language).

The [Core loop and economy](01-core-loop-and-economy.md) ticket fixes the following:
- A Job-relevant Life Skill earns a Shift pay raise.
- The Newcomer Discount and the per-interaction stakes at work both scale with Language Proficiency, so this ticket must define the steps they key off.
- Still open here: whether NPC forgiveness and how generous Help is should also tighten as Proficiency rises.

The [Anatomy of an interaction](02-anatomy-of-an-interaction.md) ticket adds the following:
- Starting Patience for each Proficiency step (higher at lower Proficiency).
- What the Recap evaluation sends as Proficiency signals, and how much each finished interaction counts, whatever the outcome.
- Conversations never raise Life Skills.

The [Voice conversation prototype](06-voice-conversation-prototype.md) ticket adds the following:
- Clarifying re-asks are free. Patience falls only on turns the NPC can't make sense of at all, which was once in 24 turns in the playtest, so starting Patience values can be small (the prototype used 4, 3 and 2 for beginner, intermediate and advanced).

The [Town and content scope](07-town-and-content-scope.md) ticket adds the following:
- Every Goal Interaction and Shift customer template is tagged with a placeholder band, **B/I/A**. This ticket maps those bands onto its Proficiency scale and decides how a Shift weights its customers toward the player's band.
- Life Skills have hooks in the town: the home kitchen (Cooking, which sets how good cooked groceries are) and the gym at the bathhouse (Fitness, available after signing up).

## Answer

Resolved by grilling on 2026-10-03. New term in `GLOSSARY.md`: **Proficiency Step**. The Life Skill entry now lists all five skills.

### Language Proficiency

**Scale.** A hidden continuous score sorted into six **Proficiency Steps**, CEFR A1–C2. The placeholder bands from [Town and content scope](07-town-and-content-scope.md) map as **B = A1–A2, I = B1–B2, A = C1–C2**. The player never sees the score or the step. There is one score per save, and each save has one Character and one Target Language, so learning a second language means starting a new save.

**Starting level.** The player picks one of four self-descriptions, written in the Native Language. There is no placement test.

| Self-description | Starting step |
|---|---|
| "Never studied it" | A1 |
| "I know the basics" | A2 |
| "I can hold simple conversations" | B1 |
| "I'm comfortable" | B2 |

C1 and C2 can only be earned. The flow itself belongs to [Onboarding and Native Language selection](09-onboarding-and-native-language.md).

**What moves it: evidence, not XP.** After each finished conversation, the Recap evaluation estimates the CEFR level the player showed. The hidden score moves partway toward that estimate, as a moving average.
- **Weight by evidence.** Very short conversations (1–2 player turns) count very little. Each `not_understood()` turn counts as evidence of a lower level.
- **Shift results** count as listening evidence. They are exact checks, and Job skills never help with understanding (see below), so this evidence stays clean.
- **Fast start.** The first ~10 interactions move the score faster, so a wrong starting pick corrects itself within about the first in-game day.
- **Tuning defaults:** move about 0.15 of the gap per normal interaction, and about 0.3 during the first 10.

**Can go down.** The score can drift down. NPC behaviour and Patience follow the **current** step in both directions, with a buffer so they don't flicker at a boundary. The Newcomer Discount and Shift stakes **ratchet**: they move at the highest step reached and never move back.

**How NPCs adapt to the step.**
- The CEFR level goes into the NPC prompt to set vocabulary and grammar.
- Sentence length and how much the NPC says per turn.
- Speaking pace: "slowly and clearly" at A1–A2, natural speed from B2 up.
- At low steps the NPC offers choices up front ("hot or iced?"); at high steps the player has to volunteer the details.
- At A1–A2, the first time the player seems lost, the NPC rephrases more simply once, before any clarifying re-ask.
- NPCs **never** switch to the Native Language. Help covers that gap.

**Tables by step.**

| Step | Starting Patience | Newcomer Discount | Shift stake multiplier | Dock per failed customer |
|---|---|---|---|---|
| A1 | 4 | 50% | ×1.0 | none |
| A2 | 4 | 40% | ×1.1 | none |
| B1 | 3 | 25% | ×1.25 | 5% of base |
| B2 | 3 | 10% | ×1.4 | 10% of base |
| C1 | 2 | 0% | ×1.6 | 15% of base |
| C2 | 2 | 0% | ×1.8 | 20% of base |

- **Shift pay** = base × share of customers served successfully × Mood modifier × Job-skill raise × stake multiplier − the dock for each failed or abandoned customer. It never goes below 0.
- **Check:** going from A1 to B1 loses about 0.5 Shift a week of discount and gains about 1 Shift a week over 4 Shifts. That is slightly better than neutral, so progress is quietly rewarded.
- **Announcements:** the landlord announces each step down of the Newcomer Discount, as [Core loop and economy](01-core-loop-and-economy.md) requires.
- **Forgiveness**, the question left open by [Core loop and economy](01-core-loop-and-economy.md): NPCs get less forgiving through **Patience only**. Whether Help gets less generous stays with [Help economics](12-help-economics.md).

**Shift customer mix.** 60% of customers from the player's own band, 30% from the band below, 10% from the band above. A band a Job doesn't have falls back to the nearest one it does have: the cashier has no A customers, and the server has no I customers.

### Life Skills

**Five Life Skills:** Cooking, Fitness, Barista, Cashier and Server. Each has levels 0–5 and is **shown** to the player, for example as stars on a skills page.
- XP needed rises with each level.
- XP gain is multiplied by the Mood modifier.
- There is no decay.

**What raises them.** Player-led Goal Interactions and Small Talk never raise Life Skills. Shift work raises that Job's skill. This sharpens the earlier "conversations never raise Life Skills" rule.

| Skill | How it grows | What it does |
|---|---|---|
| Barista / Cashier / Server | XP for each customer served successfully. Failed or abandoned customers give none. | **+6% Shift pay per level** (+30% at 5), plus help with the **mechanics only**, never with understanding. Examples: the barista grid groups drinks and remembers the last size used; the cashier tray suggests coins once the amount is entered; the server pad offers quick-pick dietary notes. |
| Cooking | XP for each meal cooked at home, at most 3 a day. Level 5 takes about 3–4 in-game weeks of cooking most days. | Sets meal quality: at level 0 a home meal restores less Hunger than a bento; at level 5 it restores more and gives a small Mood lift. Lowers the risk of food poisoning from groceries that are going off. No recipe unlocks. |
| Fitness | One gym session a day (about 1 in-game hour) gives XP and a small Mood lift. | Lowers Illness chance (up to −40% at level 5) and slows the Health drain when Hunger or Thirst is at zero. **Gym membership costs about 0.5 Shift per in-game month**, a new cost line, paid when `register_member()` succeeds and then renewed. |
