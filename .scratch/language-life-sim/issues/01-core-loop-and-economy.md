# Core loop and economy

Type: grilling
Status: resolved
Map: [Language-learning life sim](../map.md)

## Question

What does a typical in-game day look like, and what economy drives it? Pin down: Well-being decay rates relative to the ~24-minute day; what money is spent on (food, drink, rent/bills, hospital bills, transit?) and earned from (Jobs only? small talk rewards?); starting money; how Mood and Life Skills feed back into earnings; and what the player's long-term goal is, if any, beyond "stay alive and get better at the language" (promotions? unlocking areas? a win state?).

## Answer

Resolved by grilling on 2026-10-03. Prices are given as **ratios of one Shift's pay**. Absolute prices belong to [Town and content scope](07-town-and-content-scope.md).

**Tone.** Cozy at first, tighter later. The language is the main challenge from the start, and the economy only starts to bite as Language Proficiency rises.

**Long-term goal.** An open-ended sandbox: no win state, no promotions, no unlock ladder. The player's progress is their own improvement in the language.

**A day.**
- Sleep happens at home and skips to morning, with a small Mood boost. Staying up past about 2am drains Mood fast. There is no Energy meter, so Well-being stays Health, Hunger and Thirst.
- Hunger goes from full to empty in about one in-game day, so the Character eats 2–3 times a day. Thirst empties in about half a day, so the Character drinks 3–4 times. Sleep pauses decay.
- Health falls only while Hunger or Thirst is at zero (draining to nothing in about half a day) or during an Illness. When Health reaches zero, the Character faints.
- A Shift lasts about 4 in-game hours (around 4 real minutes) with 5–8 customer interactions. At most one Shift a day, and the player chooses which days to work.

**Illness.** Random, about once every 1–2 in-game weeks, and more likely when Well-being is low. It drains Health slowly and lowers Mood, and leads to Fainting if left untreated. There are 3–5 kinds, each with its own symptoms. The doctor diagnoses correctly only when the player conveys the symptoms. Treatment is a doctor's visit fee plus medicine from the pharmacy counter, which together cost noticeably less than a Fainting bill.

**Money in.** Jobs only. Shift pay = base wage × share of interactions that succeeded × Mood modifier. A relevant Life Skill earns a raise (for example, Cooking at the restaurant). Helping NPCs pays off in Mood and relationships, never cash. Starting balance covers about 3 days of food and drink plus one comfort purchase.

**Money out.** Food and drink, weekly rent, comfort purchases (which lift Mood), the doctor and medicine, and hospital bills. Transit is free because it already costs time.

**Budget targets.**
- Daily survival costs about 0.5 Shift.
- Weekly rent at full price costs about 2 Shifts.
- Comfort purchases cost about 0.1–0.3 Shift each.
- In steady state, working about 4 of 7 days covers survival and rent. Working 5–6 days builds savings, but overwork costs Mood.

**Tightening by Language Proficiency.**
- **Newcomer Discount:** rent starts at 50% off, and the discount phases out as Proficiency rises. Since better Proficiency also raises Shift pay, the net effect is roughly neutral.
- **Higher stakes at work:** at higher Proficiency, Jobs pay more per successful interaction but dock pay for failed ones.
- Each step of the tightening is announced in a conversation (for example, with the landlord), never shown as a number.
- NPC forgiveness and Help generosity changing with Proficiency is deferred to [Anatomy of an interaction](02-anatomy-of-an-interaction.md) and [Life Skills and Language Proficiency models](08-life-skills-and-proficiency.md).

**Rent.** First due at the end of week 1. Unpaid rent becomes debt that carries forward, with a Mood penalty and a reminder conversation with the landlord, who can be negotiated with for more time. There is no eviction.

**Fainting.** The Character wakes in hospital at 8am the next day, losing the rest of the current day. The bill is about 1.5 Shifts and can go into debt the same way rent does. Mood takes a hit.
