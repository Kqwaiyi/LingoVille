# Life Skills and Language Proficiency models

Type: grilling
Status: open
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
