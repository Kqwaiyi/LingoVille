# Anatomy of an interaction

Type: grilling
Status: resolved
Map: [Language-learning life sim](../map.md)

## Question

What is the exact shape of one goal-driven NPC interaction, start to finish? Pin down: how an interaction is triggered (walk up + key? NPC initiates?); how its goal and the facts the NPC holds (menu, prices, directions) are defined; turn-taking (push-to-talk vs open mic); how NPC patience works and what ends an interaction as success, failure or abandonment; what each outcome does to Well-being, Mood, money, Life Skills and Language Proficiency; how free small talk differs from a goal interaction; and what the post-conversation recap contains.

## Answer

Resolved by grilling on 2026-10-03. Terms are defined in `GLOSSARY.md`: Goal Interaction, Small Talk, Patience, Recap, Journal.

**Trigger.** The player starts most conversations by walking up to an NPC and pressing **E**. The NPC always speaks first, so the player never faces silence. Some roles start conversations themselves: Job customers walking up to the counter, the landlord's rent reminder, and the doctor calling you in.

**Turn-taking.** Push-to-talk by default: hold **Space** to talk. Open mic with automatic voice detection is an option in settings. Holding Space while the NPC is talking interrupts it. The Typed Fallback uses the same turn flow, with Enter to send, and the player can switch to it at any point in a conversation.

**Definition.** Each Goal Interaction is authored as data:
- the NPC's role and persona;
- **one** goal in plain words;
- the facts the NPC knows (menu, prices, stock, directions);
- a completion function with typed arguments (e.g. `serve_order(items[])`);
- the Language Proficiency range it suits.

The NPC answers side questions from its facts, but only the goal is judged.

**Success follows what the NPC understood.** The NPC must read the result back (e.g. "one lemonade, that's ¥300?") before it calls the completion function. The player can correct it at that point. Once the function is called, its arguments decide what happens: if the NPC heard "lemonade", the Character gets a lemonade. Payment is taken automatically. If the Character can't afford it, the NPC says so in the Target Language and the conversation continues (order something cheaper, or leave).

**Patience.** A hidden count of how many more turns the NPC will tolerate not understanding. It goes down by one when:
- the NPC model calls `not_understood()`; or
- as a backstop, the player's transcript comes back empty or can't be read.

It starts higher at lower Language Proficiency, and the exact values belong to [Life Skills and Language Proficiency models](08-life-skills-and-proficiency.md). It is shown only through the NPC's facial expression, and it is frozen while Help is open. When it reaches zero, the NPC politely ends the conversation and the interaction fails. Slowness never costs Patience; only failing to get through does.

**Native Language from the player.** NPCs understand loanwords and international words (saying "coffee" to a Japanese barista works, because it is コーヒー). A full sentence in the Native Language costs Patience like any other turn the NPC doesn't understand.

**Abandonment.** Walking away or pressing Esc costs nothing outside a Shift: no Mood loss and no goal. During a Shift, an abandoned customer counts as a failed interaction for pay.

**Outcome effects.**
- *Success:* the goal's effect happens (item, service, diagnosis), plus a small Mood boost.
- *Failure:* no effect and no charge, plus a smaller Mood dip, so trying pays off on average.
- *Language Proficiency:* every finished interaction, whatever the outcome, sends signals from the Recap evaluation. How much they count belongs to the progression ticket.
- *Life Skills:* conversations never raise them.

**Small Talk.** No goal and no completion function, and it cannot fail. It ends when either side leaves; the NPC wraps up after about 6–8 exchanges or when it is busy. Mood rises with each exchange that is understood, capped per NPC per in-game day so one NPC can't be farmed. It gets a lighter Recap.

**Shift interactions (roles reversed).** At a Job the NPC customer has the goal: a hidden order taken from data. The player listens, can ask the customer to repeat or clarify (each costing Patience as usual), then **does something** in the world, such as picking the item from a menu grid at the counter. Success is an exact check of what the player did against the hidden order, with no model judgement involved. This trains listening comprehension. The action for each Job belongs to [Town and content scope](07-town-and-content-scope.md).

**Clock.** During any conversation the game clock and Well-being decay slow to **¼ speed**. A Shift is defined by its **customer count (5–8)**, not by clock time. This replaces the "about 4 in-game hours" framing from [Core loop and economy](01-core-loop-and-economy.md).

**Help in a conversation.** A side panel, with Patience frozen while it is open. It holds:
- contextual hints generated from the goal and facts (e.g. "try asking for the menu");
- phrasebook entries tagged for the place;
- hear-it-said on any hint or phrase.

Tap-to-translate works on NPC bubbles. Whether Help costs anything stays in the "Help economics" ticket.

**Recap.** Shown after every Goal Interaction and skippable. It has up to three parts:
1. the outcome in one line;
2. up to **3 corrections**, each showing what the player said next to a more natural version that can be played aloud (never a full red-pen pass);
3. new words the NPC used, each with a one-click add to the phrasebook.

Corrections are never shown in the middle of a conversation. During a Shift, Recaps queue until the Shift ends. Every Recap is saved to the **Journal**. The Recap is produced by a `generateContent` call on the transcript after the conversation, as recommended by [Gemini voice capabilities](03-gemini-voice-capabilities.md).
