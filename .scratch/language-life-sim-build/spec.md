# Spec: Language-learning life sim

Status: ready-for-agent
Map: [Language-learning life sim](../language-life-sim/map.md)

This spec puts the 16 resolved tickets on the map into one place. Each decision links back to the ticket it came from, and terms follow `CONTEXT.md`. Where two tickets disagree, the later ticket wins; [Further Notes](#further-notes) lists every such case, and the questions no ticket answered, which the dev decided before ticketing. Build tickets are in [issues/](issues/).

## Problem Statement

A Player who is learning Japanese, Chinese, English or German has few safe places to *use* the language. Textbooks and apps drill vocabulary, but they rarely make the Player speak to someone who needs to understand them, and they rarely make that understanding matter. Speaking to real people is exactly what feels hardest and most exposed. Getting it wrong in front of a stranger is embarrassing, and nothing builds up gradually from "I know some words" to "I can order lunch, see a doctor and hold down a job".

The Player wants a place where everyday life *only* works in the Target Language, where being understood has real but gentle consequences, where they never get stuck because help is always there, and where they find out afterwards what they could have said better without being corrected mid-sentence.

## Solution

A single-player, low-poly 3D, desktop-browser life sim that runs locally on the dev's machine. The Player keeps a Character alive and happy in a small, cozy town (Well-being: Health, Hunger, Thirst; and Mood). The town's NPCs respond only to the Target Language.

- **Speaking is the main control.** The Player walks up to an NPC, presses E, and talks by holding Space. The NPC is a live Gemini voice model that speaks only the Target Language, adapts to the Player's hidden Language Proficiency, and judges a Goal Interaction by what it actually understood. The Typed Fallback and free Help (hints, the phrasebook, hear-it-said, Translate) mean nobody gets stuck.
- **Daily life is the curriculum.** Ordering coffee, paying at the supermarket, describing symptoms to the doctor, paying rent and asking for work are all Goal Interactions with real effects on Well-being, Mood and money.
- **Jobs reverse the roles.** At a Shift the Player listens to Shift Customers and fills hidden orders, which is checked exactly against data. This is the only source of money.
- **Feedback comes after, never during.** Each conversation ends in a skippable Recap with up to three corrections and new words, saved to the Journal.
- **Gentle stakes that tighten slowly.** There is no death and no eviction. Running out of Well-being leads to Fainting and a hospital bill, and unpaid rent becomes debt. The Newcomer Discount and Shift stakes tighten as Language Proficiency rises.
- **Four Culture Packs** dress one shared town as Japan, China, Germany or the UK.
- **Saves stay in the browser.** There are 4 slots, autosave only, with nothing deleted automatically.

## User Stories

### Setup and onboarding

1. As a Player, I want the game to pre-select my Native Language from my browser's languages, so that I can start without hunting through menus.
2. As a Player whose browser language isn't one of the four, I want English pre-selected and easy to change, so that I can still pick a language I read.
3. As a Player, I want to choose a Target Language from the three that aren't my Native Language, so that I can't accidentally pick a language I already speak.
4. As a Player, I want each Target Language to tell me which Culture Pack comes with it (e.g. "English: set in a UK town"), so that I know where I'm going to live.
5. As a Player, I want to describe my level with one of four plain sentences in my Native Language, so that the town starts at about the right difficulty without a test.
6. As a Player, I want to give my Character a name on the self-assessment screen, so that NPCs can learn it when I tell them.
7. As a Player, I want to choose an Appearance Preset (build and face, hair style and colour, skin tone) once at setup, so that the Character feels like mine.
8. As a Player, I want a mic check with a live level meter that I can skip, so that I know Speaking will work before I need it.
9. As a Player who denies or has no microphone, I want the game to switch to the Typed Fallback with nothing locked, so that I can still play everything.
10. As a Player starting a second save on the same browser, I want my Native Language pre-filled and the mic check skipped if it already passed, so that setup is quick.
11. As a Player, I want a First Morning in the real town (drink water, walk to the café, order breakfast), so that I learn the controls by doing real things.
12. As a Player, I want my first café order to be a real Goal Interaction where Patience can't run out, so that my first try in the language can't end in failure.
13. As a Player in the First Morning, I want the Help tab to pulse after about 10 seconds of silence or my first not-understood turn, so that I find Help without being forced into it.
14. As a Player, I want First Morning prompts as a banner at the top with a direction arrow and a marker in the world, so that I always know where to go next.
15. As a Player, I want any equivalent action to complete a First Morning step (e.g. buying a drink at the supermarket), so that the tutorial never blocks me.
16. As a Player, I want to skip the First Morning from setup or the pause menu, so that I can skip what I already know.
17. As a Player, I want the First Morning to end with a card showing my money, "Rent is due on day 7" and a hint that three places are hiring, so that I know what matters next.
18. As a Player, I want one-time tooltips the first time a new system comes up (Shifts, Fainting, the Journal, open mic, the Typed Fallback), so that I learn things when they matter.
19. As a Player, I want tooltips I've already seen on this browser never to come back in another save, so that I'm not taught twice.
20. As a Player, I want to turn all tooltips off in Settings, so that experienced play is uncluttered.
21. As a Player, I want to change my Native Language at any time in Settings and have the UI switch immediately, so that I can fix a wrong pick.
22. As a Player, I want a clear "Voice service unavailable: check the local server" screen when no token can be minted, so that I know the problem isn't my mic.

### Moving around the town

23. As a Player, I want to walk the Character freely in third person around a town of 11 places, so that it feels like a place I live in.
24. As a Player, I want "Press E to talk — <role>" near an NPC I can talk to, so that I know who's available.
25. As a Player, I want a line above the dock showing the current place and its opening hours, so that I don't walk into a closed shop.
26. As a Player, I want lit windows to mean a place is open, so that I can read the town at a glance.
27. As a Player, I want to take the tram between 2–3 stops as fast travel (choose a stop, time passes, I arrive), so that crossing town doesn't eat real time.
28. As a Player, I want to point at a sign or menu within range and see its reading aid and a Translate option, so that the world itself teaches me words.
29. As a Player, I want a day–night cycle with morning, midday, golden-hour and night lighting, so that time passing is visible.
30. As a Player, I want each Culture Pack to swap signs, menus, food, money and small props, so that the town feels like Japan, China, Germany or the UK.
31. As a Player in the German pack, I want almost everything closed on Sunday, so that the culture is real and not just text.

### Well-being, Mood and time

32. As a Player, I want a dock at the bottom centre that always shows ring gauges for Health, Hunger, Thirst and Mood, the clock (time, day and weekday) and my money, so that I never have to open a menu to check on the Character.
33. As a Player, I want Hunger to empty over about one in-game day and Thirst over about half a day, so that eating 2–3 times and drinking 3–4 times a day keeps the Character fine.
34. As a Player, I want tap water at home to be free, so that Thirst is never a money trap.
35. As a Player, I want Health to fall only while Hunger or Thirst is at zero or during an Illness, so that neglect, not bad luck, is what hurts.
36. As a Player, I want a compressed day of about 24 real minutes (1 real minute = 1 game hour), so that a day fits in one sitting.
37. As a Player, I want the clock and decay to slow to ¼ speed during any conversation, so that taking my time to speak is never punished.
38. As a Player, I want time and Patience to stop while the Help tab is open, so that looking something up is free.
39. As a Player, I want the game to pause when I switch tabs, so that the Character doesn't starve while I'm away.
40. As a Player, I want to go to bed at home from 20:00 and wake at 07:00 with a small Mood boost, so that days have a rhythm.
41. As a Player, I want staying up past about 2am to drain Mood fast, so that late nights have a cost I can see coming.
42. As a Player, I want Mood to rise from understood conversations, Small Talk, Comfort Purchases and the bathhouse, and fall from failures, unmet needs and overwork, so that how I live shapes how the Character feels.
43. As a Player, I want low Mood to reduce Shift pay and Life Skill gain, so that looking after Mood matters.
44. As a Player, I want Fainting (waking in hospital at 8am the next day, losing the rest of the day, a bill of about 1.5 Shifts and a Mood hit) instead of death, so that mistakes set me back without ending the game.
45. As a Player who wakes from Fainting, I want the nurse to greet me, so that even the setback is a language moment.

### Goal Interactions

46. As a Player, I want the NPC always to speak first when I press E, so that I'm never facing silence.
47. As a Player, I want to hold Space to talk (push-to-talk), so that I control exactly when I'm heard.
48. As a Player, I want open mic with voice detection as a Settings option, so that I can talk hands-free if I prefer.
49. As a Player, I want holding Space while the NPC is talking to interrupt it, so that conversations feel natural.
50. As a Player, I want to switch to typing at any moment (T focuses the field, Enter sends), so that a word I can't pronounce doesn't block me.
51. As a Player, I want NPC replies spoken aloud at about one second's delay, with the line shown in the chat column, so that I practise listening and can still read.
52. As a Player, I want my own turns shown as "Heard as: …" bubbles, so that I can see what the NPC actually received.
53. As a Player, I want the NPC to read back what it understood ("one lemonade, ¥300?") before it acts, so that I can correct a misunderstanding before it costs me.
54. As a Player, I want the outcome to follow what the NPC understood (if it heard "lemonade", I get lemonade), so that clear speech is what pays off.
55. As a Player, I want payment taken automatically on success, and the NPC to tell me in the Target Language if I can't afford it, so that I can order something cheaper.
56. As a Player, I want the NPC to answer side questions from the facts it knows (menu, prices, directions), so that I can explore the conversation.
57. As a Player, I want clarifying re-asks ("large or small?") to cost nothing, so that partly understood speech gets repaired, not punished.
58. As a Player, I want only turns the NPC can't make sense of at all (gibberish, a whole sentence in my Native Language, an empty transcript) to cost Patience, so that the rules feel fair.
59. As a Player, I want loanwords and international words ("coffee" to a Japanese barista) to be understood, so that real-world learner tricks work.
60. As a Player, I want the NPC's face to show its Patience instead of a number, so that I read the situation like a real person would.
61. As a Player, I want a Goal Interaction to end once the goal is done and the NPC says goodbye, so that each one feels complete.
62. As a Player, I want walking away or pressing Esc outside a Shift to cost nothing, so that I can bail out of a conversation that's going badly.
63. As a Player, I want a failed Goal Interaction to cost no money and only a small Mood dip (smaller than the gain from success), so that trying is always worth it.
64. As a Player, I want a closing card showing the outcome and its effects (e.g. "Hot latte · −¥450 · Mood ↑") with Skip Recap and See Recap, so that I see what happened before I choose to reflect on it.
65. As a Player, I want 28 Goal Interactions across the town (cafe orders, paying, asking where something is, refunds, getting a table, seeing the doctor, the pharmacy, payment plans, rent, extensions, books, gifts, the bathhouse, the gym, registering my address, posting a parcel, directions, and being hired), so that there's always something new to try at my level.
66. As a Player, I want Goal Interactions tagged Beginner, Intermediate or Advanced, with NPCs adapting to my level anyway, so that hard tasks become possible as I improve.

### NPC adaptation

67. As a beginner, I want NPCs to speak slowly and clearly, in short sentences, offering choices up front ("hot or iced?"), so that I can follow.
68. As a beginner, I want the NPC to rephrase more simply once the first time I seem lost, so that I get one easier version before a re-ask.
69. As an advanced learner, I want NPCs to speak at natural speed and make me volunteer the details, so that the challenge keeps up with me.
70. As a Player, I want NPCs never to switch to my Native Language, so that the town stays immersive and Help covers the gap.
71. As a Player, I want NPC Patience to shrink as my Proficiency rises (4/4/3/3/2/2 from A1 to C2), so that NPCs expect more of a better speaker.

### Small Talk, Named NPCs and Familiarity

72. As a Player, I want to start Small Talk with any Named NPC who isn't busy, so that I can practise without a goal.
73. As a Player, I want Small Talk never to fail, and to lift Mood with each exchange that's understood, so that free conversation always feels good.
74. As a Player, I want the NPC to wrap up Small Talk after about 6–8 exchanges or when it's busy, so that conversations have a natural length.
75. As a Player, I want the Mood and Familiarity from Small Talk capped per NPC per day, so that the system can't be farmed and I'm nudged to talk to different people.
76. As a Player, I want park regulars to wave me over at most once a day, so that the park feels alive without nagging.
77. As a Player, I want about 15 Named NPCs with fixed personas (staff, park regulars, the landlord), so that the town has people, not roles.
78. As a Player, I want a Named NPC to learn my name only when I say it, and to use it from then on, so that introductions are a real language moment.
79. As a Player, I want NPCs to move from stranger to acquaintance to friend over about 1–2 in-game weeks of regular visits, so that relationships grow from talking.
80. As a Player, I want Familiarity never to fade, so that putting the game down doesn't cost me friendships.
81. As a Player, I want acquaintances to offer "the usual?" after I've ordered the same thing three times in a row, so that being a regular feels real.
82. As a Player, I want NPCs to follow up on what we talked about last time, so that they seem to remember me.
83. As a Player, I want a friend to have +1 Patience with me, so that friendship helps when I struggle.
84. As a Player, I want a friend to offer once to switch to a casual register (Sie→du, keigo→タメ口), so that I meet a real cultural milestone.
85. As a Player, I want to give a gift from my inventory in any conversation with a Named NPC, so that I can show I care.
86. As a Player, I want only one gift per NPC per week to count, and the NPC's favourite (found out by asking) to count most, so that gifting rewards attention, not money.
87. As a Player, I want Familiarity never to give discounts or unlock Help, so that the economy and learning stay fair.
88. As a Player, I want occasional "on the house" flavour from a friend (at most once a week), so that friendship feels warm.

### Help

89. As a Player, I want a Help tab in the conversation column (H toggles it) with hints for this moment: a full model sentence, its translation and 🔊, so that I can always find something to say.
90. As a Player, I want the place's phrasebook and my own saved words in the Help tab, so that I can browse useful phrases.
91. As a Player, I want hear-it-said on any hint, phrase, correction or new word, voiced by Gemini TTS, so that I can copy the pronunciation in every language.
92. As a Player, I want Translate under every NPC line, showing the Native Language line underneath, so that I'm never lost.
93. As a Player, I want Replay under every NPC line, so that I can hear it again.
94. As a Player, I want Help to cost no money or Mood and work the same at every level, so that I'm never punished for needing it.
95. As a Player, I want a turn I copied from a hint to count for less as evidence of my level, so that my hidden level reflects what I can really do.
96. As a Player, I want using Help never to lower my estimated level, so that Help is always safe to use.
97. As a Player, I want a "No Help needed" sticker on Recaps where I used no Help, and nothing at all when I did, so that I'm rewarded without being shamed.
98. As a Player in a Shift, I want translating a customer's order and then serving it correctly to pay normally minus half a failure's dock, so that translating always beats failing but understanding by ear pays more.

### Recap and Journal

99. As a Player, I want a Recap after each conversation with the outcome, up to 3 corrections (what I said, a more natural version with 🔊, and one line on why) and new words with reading aids, so that I learn from what just happened.
100. As a Player, I want no correction ever shown mid-conversation, so that I can focus on talking.
101. As a Player, I want the Recap to treat a likely mishearing as a pronunciation point (e.g. *yī bǎi* where *yī bēi* was meant), so that noisy transcripts become useful feedback.
102. As a Player, I want a loading state while the Recap is generated (about 6 s), started the moment the conversation ends, so that the wait feels short.
103. As a Player, I want to skip any Recap and still have it saved to my Journal, so that I'm never forced to reflect.
104. As a Player, I want "+ Phrasebook" on each new word to add it to my personal phrasebook, so that I can collect words I want to keep.
105. As a Player, I want Small Talk to get a lighter Recap, so that casual chats aren't turned into lessons.
106. As a Player, I want one combined Recap for the whole Shift, opened when the Shift ends, so that work isn't interrupted.
107. As a Player, I want the Recap to look like a lined Journal page in the chat column, so that I understand it becomes my Journal.
108. As a Player, I want J to open a full-screen Journal (an entry list on the left, newest first; the selected entry on the right), so that I can review what I've learned.
109. As a Player, I want Journal entries kept in the language they were written in, even if I later change my Native Language, so that history isn't rewritten.

### Jobs and Shifts

110. As a Player, I want to get each Job (barista, cashier, server) through a one-time hiring Goal Interaction in which I ask for work and give my name, so that even getting a job is language practice.
111. As a Player, I want all three Jobs open to me from day 1, with failed hiring retryable, so that money is always within reach.
112. As a Player, I want to press E at the staff door during opening hours to start a Shift, with no schedule, so that I choose when to work.
113. As a Player, I want at most one Shift a day, with 5–8 Shift Customers, so that work is a clear chunk of the day.
114. As a Player, I want Shift Customers to walk up and speak first with a hidden order, so that I practise listening.
115. As a Player, I want to ask a Shift Customer to repeat or clarify, so that I can work out what they want.
116. As a barista, I want to tap drinks on a menu grid (with modifier toggles and undo for harder customers), so that serving is quick and exact.
117. As a cashier, I want to scan items, toggle bag/card, fetch items from behind the counter and pick coins for change, so that the job feels real.
118. As a server, I want an order pad with dietary notes, so that I can serve tables of 2–3.
119. As a Player, I want success decided by an exact check of what I did against the hidden order, so that the result is fair and has nothing to do with the model.
120. As a Player, I want 60% of Shift Customers at my level, 30% below and 10% above, so that Shifts stretch me without overwhelming me.
121. As a Player, I want Shift pay of base × share served × Mood modifier × Job-skill raise × stake multiplier, minus a dock per failed or abandoned customer and never below 0, so that I can see how to earn more.
122. As a Player, I want my Job Life Skill (0–5 stars) to raise pay by 6% a level and make the mechanics easier (grouped grids, suggested coins, quick-pick notes) but never help me understand, so that skill helps without hiding the language.
123. As a Player, I want a Shift customer lost to a network drop to be replaced and not count against me, so that I'm never punished for a technical fault.
124. As a Player, I want a reloaded mid-Shift to end the Shift with pay for customers already served, so that I keep what I earned.

### Economy

125. As a Player, I want money to come only from Jobs, so that working in the language is how I support myself.
126. As a Player, I want a starting balance of about 1.7 Shifts (≈3 days of food plus one Comfort Purchase), so that the first days are calm.
127. As a Player, I want groceries cooked at home to be the cheapest food, so that cooking is worthwhile.
128. As a Player, I want my Cooking skill to decide how filling and pleasant home meals are, and to lower food poisoning risk, so that cooking every day pays off.
129. As a Player, I want rent of about 2 Shifts a week at full price, first due at the end of day 7, so that I need to work about 4 days in 7.
130. As a Player, I want a Newcomer Discount (50% at A1, down to 0% at C1) that the landlord announces as it steps down, so that rent rises in step with my ability to earn.
131. As a Player, I want the Newcomer Discount and Shift stakes to stay at the highest step I've reached, so that a bad week doesn't bounce my rent.
132. As a Player, I want unpaid rent to become debt (with a Mood penalty and a reminder from the landlord), never eviction, so that hard times are recoverable.
133. As a Player, I want to ask the landlord for more time in the Target Language, so that negotiating is a skill worth having.
134. As a Player, I want to arrange to pay a hospital bill in instalments, so that Fainting doesn't wipe me out.
135. As a Player, I want 5 Comfort Purchases (café cake or a special drink, a book or magazine, a bathhouse visit, a restaurant meal, flowers or a gift), so that I can spend on feeling good.
136. As a Player, I want gym membership (about 0.5 Shift for 30 days, renewed by asking the attendant) to unlock one gym session a day that builds Fitness and lifts Mood, so that I can invest in the Character's health.
137. As a Player, I want trams to be free, so that the only cost of travel is time.
138. As a Player, I want prices that look natural in each currency (¥, 元, €, £), so that each Culture Pack feels real.

### Illness and the clinic

139. As a Player, I want occasional random Illness (about once every 1–2 in-game weeks, more likely when Well-being is low, less likely with Fitness), so that the clinic matters.
140. As a Player, I want each of the 4 Illnesses (cold, flu, food poisoning, hay fever) to have its own symptoms, so that describing them precisely matters.
141. As a Player, I want to check in at reception, have the doctor call my name, describe my symptoms and get the right diagnosis only if I conveyed them, so that the visit is a real test.
142. As a Player, I want the wrong medicine not to cure me, so that a wrong diagnosis means going back, and precision is rewarded.
143. As a Player, I want a doctor's visit plus medicine to cost clearly less than Fainting, so that seeking help early is always the smart move.

### Language Proficiency (hidden)

144. As a Player, I want my level never shown as a number or step, so that I focus on talking, not grinding.
145. As a Player, I want my level to correct itself within about the first in-game day if I picked the wrong self-description, so that a bad guess doesn't ruin the start.
146. As a Player, I want my level to come from evidence in each Recap rather than XP, so that it tracks how I actually speak.
147. As a Player, I want very short conversations to count very little, so that "yes, the usual" doesn't move my level.
148. As a Player, I want NPCs to follow my current level in both directions, with a buffer so they don't flicker, so that the town matches me if I get rusty.

### Saves

149. As a Player, I want saving to be automatic (after each outcome, at sleep, through doors, on tab hide and every ~2 minutes), with a brief "Saved ✓" in the dock, so that I never lose progress or think about saving.
150. As a Player, I want 4 slots, each holding any Target Language, so that I can learn more than one language or keep separate lives.
151. As a Player, I want Continue on the title screen to load my most recent save, so that coming back is one click.
152. As a Player, I want slot cards showing the Character's name, Target Language, day, money and last played, so that I can tell saves apart.
153. As a Player, I want a reload never to dodge an Illness, because the RNG state is saved, so that the world is consistent.
154. As a Player, I want a conversation that's interrupted by closing the tab to cost nothing and simply not happen, so that crashes are never punished.
155. As a Player, I want a failed load to fall back to this morning's backup with a plain message, so that a bad save rarely loses more than a day.
156. As a Player, I want a save that can't load at all to offer Export raw and Delete, so that nothing is deleted without my consent.
157. As a Player, I want to export a save (with its Journal) as a JSON file and import it into an empty slot, so that I can back up or move my life.
158. As a Player, I want deleting a save to need the Character's name typed, so that I can't delete one by accident.
159. As a Player, I want the game to ask the browser to keep my data and tell me once if it refuses, so that I know to export a backup.

### Title screen and settings

160. As a Player, I want a title screen with a menu on the left (Continue, Load a save, New game, Import a save, Settings) over the live town, with my Character standing in the right third, so that the game greets me with my own life.
161. As a Player, I want the centre panel to follow the highlighted menu item and to navigate with ↑ ↓ Enter Esc, so that the menu feels like a console game.
162. As a Player, I want New game greyed out with "Delete a save to start a new one" when all 4 slots are full, so that I know why.
163. As a Player, I want volume sliders (Master, Music, Ambient, Voice, UI), the input mode, push-to-talk vs open mic, reading aids on/off, show romaji on/off and tooltips on/off kept per browser, so that my device settings follow me across saves.
164. As a Player, I want a Retry microphone button in Settings, so that I can switch to Speaking once my mic works.
165. As a Player, I want to hide reading aids (pinyin, furigana), so that I can push myself to read without them.
166. As a Player, I want a credits screen, so that CC-BY asset creators are credited.

### Reading aids and text

167. As a Chinese learner, I want pinyin with tone marks over every NPC line, accurate even for polyphonic characters, so that I can read along.
168. As a Japanese learner, I want furigana over kanji, and an optional romaji line I can turn on in Settings, so that I can read along.
169. As a Player, I want reading aids to appear immediately and quietly improve about a second later, so that I never wait to read.
170. As a Player, I want the Journal to keep the improved reading aids, so that what I review is accurate.

### Audio

171. As a Player, I want calm, culture-neutral music that changes with the time of day and indoors, so that the town feels cozy.
172. As a Player, I want ambient sound with a few local touches (crossing chimes, church bells, scooter horns) and no intelligible speech, so that the place feels real without confusing my ears.
173. As a Player, I want music to duck during conversations and mute while my mic is open, so that NPC speech is always clear and the game doesn't leak into my transcript.
174. As a Player, I want gentle UI sounds (a success chime, a soft failure tone, money in and out, a page turn, a subtle Patience-low cue), so that feedback is clear but never harsh.

### Developer (solo dev working with AI agents)

175. As the dev, I want one `npm run dev` to start Vite and the local Gemini gateway, so that running the game is one command.
176. As the dev, I want my Gemini key only in the gateway's `.env` and never in the browser, so that the key stays private even locally.
177. As the dev, I want a mock mode (`GEMINI_MOCK=1`) with a scripted fake NPC and canned Recaps, TTS and annotations, so that agents can build and test offline at no cost.
178. As the dev, I want all game rules in a pure `sim` module tested through its public functions, so that the economy and progression can be changed with confidence.
179. As the dev, I want content (interactions, Shift templates, Culture Packs, Illnesses, Comfort Purchases, places, personas) as Zod-typed data with a cross-reference check, so that a missing item in one pack fails a test, not a playtest.
180. As the dev, I want prompt builders to be pure functions with snapshot tests for each language × step, so that prompt changes are visible in review.
181. As the dev, I want model IDs, voices and endpoint versions in one gateway config, so that swapping models is a one-place change.
182. As the dev, I want import boundaries enforced by lint (`sim`, `content` and `ai` never import `world`, `ui` or `voice`), so that agents can't tangle the layers.
183. As the dev, I want an `AGENTS.md` per folder stating its rule and how to test it, so that agents follow conventions without being told.
184. As the dev, I want `npm run eval` to check real model quality against hard bars and rate bars, with a cost estimate and confirmation first, so that prompt and model changes don't quietly make the game worse.
185. As the dev, I want only a human to be able to update the eval baseline, so that an agent can't pass by lowering the bar.
186. As the dev, I want my own learner recordings used in evals but gitignored, so that the real voice path is tested without committing my voice.
187. As the dev, I want save migrations with a pre-migration backup and loud failures on unknown content ids, so that content edits never silently corrupt saves.
188. As the dev, I want per-turn token usage accumulated per conversation, so that I can watch API cost.

## Implementation Decisions

### Architecture and modules ([Technical architecture](../language-life-sim/issues/10-technical-architecture.md), [Web 3D stack](../language-life-sim/issues/04-web-3d-stack.md))

- **Stack:** Vite + React + strict TypeScript, a single-page app with no router. The 3D scene is React Three Fiber + drei + @react-three/rapier on **Three.js r186** (pin it, because r186 changed the shadow APIs), with Rapier's kinematic character controller. Babylon.js is the documented fallback only. State is in Zustand. Menus and overlays are React DOM over the canvas.
- **One npm package, with these modules:**
  - `sim`: pure TypeScript. State types, `tick`, economy, proficiency, Life Skills, Familiarity, Illness. It never imports React or Three.
  - `content`: Zod schemas and data (interactions, shift templates, culture packs ja/zh/en/de, illnesses, comforts, places, NPC personas, appearance tables).
  - `ai`: pure prompt builders and schemas (NPC session, Recap, annotate, annotate validator).
  - `voice`: `VoiceSession`, audio worklets and the TTS cache.
  - `world`: the R3F scene (town, character controller, NPCs, day–night, interaction triggers, sign textures).
  - `ui`: React DOM (HUD dock, conversation column, Help, Recap, Journal, setup, title, settings).
  - `i18n`: UI strings for each Native Language.
  - `store`: Zustand wiring between `sim` and world/UI, plus save/load and migrations.
  - `server`: the Gemini gateway.
  - `evals`: a top-level eval harness, outside the shipped app.
- **Boundaries:** `sim`, `content` and `ai` must not import `world`, `ui` or `voice`, enforced by ESLint `import/no-restricted-paths`. Each folder has a short `AGENTS.md` with its rule and how to test it. `evals/AGENTS.md` says only a human may change the baseline.
- **Positions** of NPCs and the Character live in the Rapier world. Only the Character's current place id is in sim state. ECS was ruled out.

### Sim interface (the primary test seam)

The `sim` module exposes pure functions over one state object. The exact names are up to the build; this is the shape agreed for the seam:

- `createSave(setup)` takes the Character's name, Target Language, Culture Pack, starting step from the self-assessment, Appearance Preset and RNG seed, and returns First Morning state: day 1, 07:00, at home, ~1.7 Shifts, Health full, Hunger ~60%, Thirst ~40%, Mood neutral, rent due at the end of day 7.
- `tick(state, dtGameMinutes)` covers Well-being decay, Health drain, Illness onset rolls, late-night Mood drain, expiry of inventory and rent falling due.
- Event functions: `applyInteractionOutcome` (success/failure/abandon, completion arguments, Help log, Recap evidence), `applyShiftCustomer`, `endShift`, `payRent`, `grantExtension`, `setPaymentPlan`, `sleep`, `faint`, `cook`, `drinkWater`, `gymSession`, `giveGift`, `learnName`, `revealFavourite`, `applyRecapEvidence`, `hire`.
- The store calls these functions and saves. The world and UI read state through selectors only.
- All randomness (Illness rolls, the Shift customer mix, Shift Customer looks and voices) comes from a seeded RNG whose state lives in the save.

### Time and clock ([Core loop](../language-life-sim/issues/01-core-loop-and-economy.md), [Anatomy](../language-life-sim/issues/02-anatomy-of-an-interaction.md), [Technical architecture](../language-life-sim/issues/10-technical-architecture.md))

- Game time advances in `useFrame` as real delta × time scale. The scale is **1** normally (1 real min = 1 game hour, so about 24 real min per day), **¼** in any conversation, and **0** while paused, while the Help tab is open, and while the tab is hidden. Real delta is capped at 250 ms.
- Sleep happens in the bed at home, which is usable from **20:00**. Sleeping always skips to **07:00** the next morning (going to bed late still wakes at 07:00) and gives a small Mood boost; decay pauses during sleep. There are no naps. After about 2am, Mood drains fast. There is no Energy meter.
- Places have opening hours (table below). A Culture Pack can override them. **Closing time only stops new conversations and new Shifts from starting:** a conversation or Shift already under way runs to its end.

### Well-being and Mood ([Core loop](../language-life-sim/issues/01-core-loop-and-economy.md))

- Well-being is Health, Hunger and Thirst. Hunger goes from full to empty in about 1 game day, and Thirst in about ½ day. Health falls only while Hunger or Thirst is at 0 (to nothing in about ½ day; Fitness slows this) or during an Illness. When Health reaches 0, the Character faints.
- **Fainting:** the Character wakes in hospital at 08:00 the next day, losing the rest of the current day. The bill is about 1.5 Shifts, and it can become debt. Mood takes a hit, and the nurse greets the Character.
- **Mood** is one meter. It goes up from successful conversations, Small Talk, Comfort Purchases, the bathhouse, the gym, sleep and good home meals (Cooking 5). It goes down from failures, unmet needs, overwork, debt and staying up late. A **Mood modifier** multiplies Shift pay and Life Skill XP.

### Economy ([Core loop](../language-life-sim/issues/01-core-loop-and-economy.md), [Town and content](../language-life-sim/issues/07-town-and-content-scope.md), [Proficiency](../language-life-sim/issues/08-life-skills-and-proficiency.md))

- This is an open-ended sandbox with no win state, promotions or unlocks. Money comes only from Jobs.
- **Every price is authored once as a ratio of one Shift's base pay**, converted by each pack's anchor and rounded to local price points:

  | Pack | 1 Shift | Starting balance |
  |---|---|---|
  | ja | ¥6,000 | ¥10,000 |
  | zh | 240元 | 400元 |
  | de | €60 | €100 |
  | en (UK) | £60 | £100 |

- **Ratio ladder:** groceries ~0.06 per meal; convenience bento ~0.12; café drink ~0.07; café food ~0.1; restaurant meal ~0.25 (a Comfort Purchase); Comfort Purchases 0.1–0.3; weekly rent 2.0 at full price; Fainting bill ~1.5; doctor + medicine well below 1.5; gym membership ~0.5 per month; tap water and trams free. Survival target ~0.5 per day; ~4 Shifts in 7 days covers survival plus rent.
- **Rent** is weekly and first due at the end of day 7. Unpaid rent becomes debt, with a Mood penalty and a landlord reminder. Extensions are negotiated (#17). There is no eviction.
- **Hospital bills** can become debt or a payment plan (#15). Debt carries forward.
- **Debt is repaid at the counter, never from Shift pay.** Rent debt is cleared by paying the landlord (#16). Hospital debt is paid at reception (#15 accepts payment in full as well as a plan); a payment plan's weekly instalments are taken automatically on rent day, and a missed instalment stays as debt.
- **Gym membership** lasts 30 in-game days and is never charged automatically. When it expires, gym sessions are refused until the Player renews by talking to the attendant (a short renewal path on #22). It never becomes debt.
- **Newcomer Discount and Shift stakes, by Proficiency Step** (both ratchet to the highest step reached):

  | Step | Starting Patience | Newcomer Discount | Stake multiplier | Dock per failed customer |
  |---|---|---|---|---|
  | A1 | 4 | 50% | ×1.0 | none |
  | A2 | 4 | 40% | ×1.1 | none |
  | B1 | 3 | 25% | ×1.25 | 5% of base |
  | B2 | 3 | 10% | ×1.4 | 10% of base |
  | C1 | 2 | 0% | ×1.6 | 15% of base |
  | C2 | 2 | 0% | ×1.8 | 20% of base |

- Each Newcomer Discount step-down is announced by the landlord in conversation, never as a number.

### Town and places ([Town and content](../language-life-sim/issues/07-town-and-content-scope.md))

| Place | Default hours | NPCs |
|---|---|---|
| Home (apartment block) | always; landlord 8:00–20:00 | landlord |
| Café | 7:00–19:00 | barista |
| Supermarket | 9:00–21:00 | cashier |
| Convenience store | 24h | clerk |
| Restaurant | 11:00–22:00, closed Mon | server |
| Clinic + hospital + pharmacy | 9:00–17:00, closed Sun; Fainting ward always | receptionist, doctor, nurse, pharmacist |
| Park | always | 3–4 regulars |
| Tram stops (2–3) | trams 6:00–1:00 | passers-by |
| Bookshop / gift shop | 10:00–20:00 | shopkeeper |
| Bathhouse / gym | 10:00–24:00 | attendant |
| Town office / post office | 9:00–17:00, weekdays | clerk |

- The de pack closes everything on Sunday except the bathhouse, the Fainting ward, the convenience store and the trams. The en pack is set in the UK, with no tipping.
- Each counter has one staff role and no shift changes. Trams are fast travel.
- **NPCs who start conversations themselves:** Shift Customers during a Shift; the landlord in the hallway when you leave home (rent due and unpaid, or a Newcomer Discount step-down); the doctor or nurse calling your name in the waiting room; the nurse when you wake from Fainting; park regulars waving you over at most once a day. No one else approaches the Character.

### Goal Interactions ([Anatomy](../language-life-sim/issues/02-anatomy-of-an-interaction.md), [Voice prototype](../language-life-sim/issues/06-voice-conversation-prototype.md), [Town and content](../language-life-sim/issues/07-town-and-content-scope.md), [Onboarding](../language-life-sim/issues/09-onboarding-and-native-language.md))

- **Authored as data** (`defineInteraction`): place, NPC id/role, **one** goal in plain words, facts the NPC knows (pulled from the Culture Pack), a completion function with typed arguments, a band (B/I/A), and the effect on success. One Zod schema generates both the Live tool declaration and the argument validator.
- **Flow:**
  1. The Player presses E, and the NPC greets first.
  2. The Player holds Space to talk (or uses open mic or the Typed Fallback; T focuses the field, Enter sends, and while the field has focus Space types a space rather than triggering push-to-talk).
  3. The NPC answers side questions from its facts. It must **read back** the result and get the Player's confirmation before calling the completion function.
  4. The sim validates the arguments and applies the outcome: payment is automatic, and if the Character can't afford it the NPC says so in the Target Language and the conversation continues.
  5. The NPC says goodbye and the session ends.
- **Patience:** a hidden count, starting from the step table (+1 for a friend). It goes down by one when the model calls `not_understood()`, or as a backstop when a transcript is empty or unreadable. **Clarifying re-asks are free.** It is frozen while the Help tab is open. At 0 the NPC ends the conversation politely as failed. It is shown only through the NPC's facial expression. In the First Morning café order it cannot run out.
- **Language rules:** loanwords and international words are understood. A full Native-Language sentence counts as not understood. NPCs never leave the Target Language.
- **Outcomes:** success applies the effect plus a small Mood boost. Failure has no effect and no charge, plus a smaller Mood dip. Abandonment (walking away or Esc) costs nothing outside a Shift. Conversations never raise Life Skills.
- **Catalogue: 28 Goal Interactions.**

  | # | Place | Goal | Completion fn | Band | Effect on success |
  |---|---|---|---|---|---|
  | 1 | Café | Order a drink | `serve_order(items[])` | B | Thirst ↑, −money |
  | 2 | Café | Drink + food with options | `serve_order` | I | Hunger/Thirst ↑ |
  | 3 | Café | Order avoiding an allergen | `serve_order` | A | as above |
  | 4 | Supermarket | Pay (bag? points card?) | `complete_purchase(bag, card)` | B | groceries |
  | 5 | Supermarket | Ask where an item is | `point_to(item)` | B | marker on item |
  | 6 | Supermarket | Return a faulty item | `refund(item, reason)` | A | money back |
  | 7 | Convenience | Counter snack / heat a bento | `serve_order` | B | Hunger ↑ |
  | 8 | Restaurant | Get a table | `seat_guest(party, seating)` | B | seated |
  | 9 | Restaurant | Order a meal | `serve_order` | I | Hunger ↑↑, Mood ↑ |
  | 10 | Restaurant | Recommendation within a dietary restriction | `serve_order` | A | as above |
  | 11 | Restaurant | Pay the bill | `settle_bill(method)` | B | −money |
  | 12 | Clinic | Check in at reception | `register_patient(reason)` | I | queued for doctor |
  | 13 | Clinic | Describe symptoms | `diagnose(illness)` | I | prescription |
  | 14 | Clinic | Get medicine | `dispense(medicine)` | B | cures if it matches the Illness |
  | 15 | Clinic | Settle the hospital bill, in full or in instalments | `set_payment_plan(weeks)` (0 = pay now) | A | debt paid or spread out |
  | 16 | Home | Pay rent | `accept_rent(amount)` | B | debt cleared |
  | 17 | Home | Ask for more time | `grant_extension(days)` | A | no Mood penalty for the extension |
  | 18 | Bookshop | Buy a book/magazine | `complete_purchase` | B | Comfort Purchase |
  | 19 | Bookshop | Buy a wrapped gift | `complete_purchase(wrap)` | I | gift item |
  | 20 | Bookshop | Recommendation by taste | `complete_purchase` | A | Comfort Purchase |
  | 21 | Bathhouse | Buy entry | `admit(options)` | B | Mood ↑↑ |
  | 22 | Bathhouse | Join or renew at the gym, ask about the rules | `register_member()` | I | 30 days' gym access, membership charged |
  | 23 | Town office | Register your address | `register_resident(fields)` | A | flavour only |
  | 24 | Post office | Send a parcel home | `ship(destination, speed)` | I | Mood ↑ |
  | 25 | Tram stop | Which tram goes to a place | `give_directions(stop)` | B | route marker |
  | 26–28 | Café / Supermarket / Restaurant | Hiring: ask for work, give your name, say when you can start | hire fn + name check | B | Job hired (retryable) |

- **Small Talk:** pressing E on any idle Named NPC (no queue, not mid-order) starts it. There is no goal or completion function and it cannot fail. The NPC wraps up after about 6–8 exchanges or when busy. Mood rises per understood exchange, under the per-NPC daily cap shared with Familiarity. If the Player states a goal, the NPC points them to the counter; it doesn't switch modes. Small Talk gets a lighter Recap.

### Jobs and Shifts ([Anatomy](../language-life-sim/issues/02-anatomy-of-an-interaction.md), [Town and content](../language-life-sim/issues/07-town-and-content-scope.md), [Proficiency](../language-life-sim/issues/08-life-skills-and-proficiency.md), [Help economics](../language-life-sim/issues/12-help-economics.md))

- There are three Jobs: barista (café), cashier (supermarket) and server (restaurant). Each is gained through its hiring Goal Interaction. After that, E at the staff door during opening hours starts a Shift. There's at most one Shift a day and no schedule.
- A Shift has **5–8 Shift Customers** (defined by count, not clock time). Each Shift Customer is anonymous, with a random Appearance Preset (pack-weighted) and voice, and no memory. The customer greets first, holds a hidden order and can be asked to repeat or clarify (Patience as usual). The Player fills the order through a Job action, and success is an **exact data check** with no model judgement.
- **Seven Shift customer templates:**

  | Job | Template | Band | Player action |
  |---|---|---|---|
  | Barista | Single drink | B | menu grid |
  | Barista | Drink + size + hot/iced + extra | I | grid + modifier toggles |
  | Barista | Changes mind halfway | A | undo/redo |
  | Cashier | Pays, bag/points or not | B | scan, toggle bag/card |
  | Cashier | Pays cash, item from behind the counter | I | fetch item, pick coins for change |
  | Server | Single dish + drink | B | order pad |
  | Server | Table of 2–3 with a dietary request | A | order pad with notes |

- **Mix:** 60% from the Player's own band, 30% from the band below, 10% from the band above. A band the Job lacks falls back to the nearest one it has. Bands map B = A1–A2, I = B1–B2, A = C1–C2, using the current step.
- **Pay** = base × share served successfully × Mood modifier × Job-skill raise (+6% per level) × stake multiplier − dock per failed or abandoned customer. It never goes below 0.
- **A tap-translated Shift Customer served correctly** pays the normal per-customer amount minus **half** the failure dock, and gives no listening evidence.
- **Network abandonment** replaces the customer, who doesn't count. Player abandonment counts as a failure.
- The Shift saves after every customer. A reload ends the Shift with pay for the customers already served.
- **One combined Shift Recap:** a single `/api/recap` call over the whole Shift's transcript when it ends, giving up to 3 corrections across all customers, new words, one Journal entry and one CEFR estimate.

### Language Proficiency ([Proficiency](../language-life-sim/issues/08-life-skills-and-proficiency.md), [Help economics](../language-life-sim/issues/12-help-economics.md))

- A hidden continuous score, sorted into six **Proficiency Steps** (A1–C2). There's one per save, and it is never shown.
- The starting step comes from the self-assessment: "Never studied it" → A1, "I know the basics" → A2, "I can hold simple conversations" → B1, "I'm comfortable" → B2. C1 and C2 can only be earned.
- **Update rule:** after each finished conversation, the Recap returns a CEFR estimate, and the score moves partway toward it, about **0.15 of the gap** normally and **0.3 during the first 10** interactions. How much an interaction counts depends on evidence: 1–2 player turns count very little, each `not_understood()` is evidence of a lower level, Shift results count as listening evidence, and Help-log turns are discounted. **Help only reduces weight and never lowers the estimate.**
- The current step (with a buffer at boundaries) drives NPC adaptation and Patience in both directions. The **highest step reached** drives the Newcomer Discount and Shift stakes, which ratchet.
- **NPC adaptation** by step: the CEFR level in the prompt sets vocabulary and grammar; sentence length and how much the NPC says per turn; "slowly and clearly" at A1–A2 and natural speed from B2 up; choices offered up front at low steps; one simpler rephrase at A1–A2 the first time the Player seems lost. NPCs never switch to the Native Language.

### Life Skills ([Proficiency](../language-life-sim/issues/08-life-skills-and-proficiency.md))

- Five Life Skills: **Cooking, Fitness, Barista, Cashier, Server**. Each has levels 0–5, shown as stars. XP needed rises per level, XP gain is multiplied by the Mood modifier, and there's no decay. Goal Interactions and Small Talk never raise Life Skills.
- **Job skills:** XP per customer served successfully. +6% pay per level. Help with the mechanics only (grouped grid and remembered size; coin suggestions; quick-pick dietary notes), never with understanding.
- **Cooking:** XP per home-cooked meal, at most 3 a day; level 5 takes about 3–4 in-game weeks. It sets how much Hunger a meal restores (at level 0, less than a bento; at level 5, more, plus a small Mood lift) and lowers food poisoning risk from groceries that are going off.
- **Fitness:** one gym session a day (about 1 game hour) with membership, giving XP and a small Mood lift. It lowers Illness chance (up to −40% at level 5) and slows the Health drain at zero Hunger or Thirst.

### Illness ([Core loop](../language-life-sim/issues/01-core-loop-and-economy.md), [Town and content](../language-life-sim/issues/07-town-and-content-scope.md))

- Random, about once every 1–2 in-game weeks, more likely at low Well-being, less likely with Fitness. Rolled from the saved RNG.
- It drains Health slowly and lowers Mood, and leads to Fainting if left untreated. Diagnosis (#13) is correct only if the symptoms were conveyed. The wrong medicine doesn't cure. The right medicine cures at once, **except flu**: the fever reducer stops the Health drain at once, but the flu clears only after the next sleep.

  | Illness | Symptoms | Medicine |
  |---|---|---|
  | Cold | cough, sore throat, runny nose | cold medicine |
  | Flu | fever, body aches, chills | fever reducer + rest |
  | Food poisoning | stomach ache, nausea (more likely from expired or cheap food) | stomach medicine |
  | Hay fever | sneezing, itchy eyes | antihistamine |

### Named NPCs, Familiarity and NPC Memory ([NPC identity and memory](../language-life-sim/issues/11-npc-identity-and-memory.md))

- About **15 Named NPCs**: every counter's staff, 3–4 park regulars and the landlord. Each has a stable NPC id and one persona (name, age, temperament, quirks, one favourite gift), localised per Culture Pack with a local name and dressing. Personas are Zod-typed content.
- **Familiarity:** hidden points read as three tiers (stranger → acquaintance → friend), never shown, and never decaying. Sources: understood Small Talk exchanges (most), gifts (a one-off bump, once per NPC per week, bigger for the favourite) and successful Goal Interactions with that NPC (a little). Gain shares a per-NPC daily cap with Small Talk Mood. Tune it so friend takes about 1–2 in-game weeks of regular visits.
- **Tier effects:** at acquaintance and above, greeting by name (once known), "the usual?" and following up on the last topic; more Small Talk Mood per tier; **friend +1 Patience**; at friend, a one-time offer to switch to a casual register (noted in the Recap); rare "on the house" flavour at most weekly. There are no discounts and no Help unlocks.
- **Session tools** for Named NPCs: `learn_name(name)`, which the sim checks against the setup name before setting `knowsName` (the hiring check uses the same comparison), and `reveal_favourite()`, which sets `favouriteKnown`.
- **NPC Memory record** (one per Named NPC in the save):

  | Field | Written by |
  |---|---|
  | `familiarity` points (tier derived) + daily cap counter | sim |
  | `timesMet` | sim |
  | `knowsName` | `learn_name`, checked by the sim |
  | `usualOrder` | sim: same interaction + same completion arguments 3 times in a row |
  | `lastTopic` (≤ ~20 English words, overwritten) | optional Recap schema field, after Small Talk or chat-heavy conversations |
  | `favouriteKnown` | `reveal_favourite` |
  | `lastGiftDay` | sim |
  | `registerOffered` | sim |

  Nothing else is free-form. With no record, the NPC treats the Character as a stranger.
- "The usual?" accepted counts as a normal success, with small level evidence because the Player said so little.

### Help ([Anatomy](../language-life-sim/issues/02-anatomy-of-an-interaction.md), [Help economics](../language-life-sim/issues/12-help-economics.md), [HUD and conversation UI](../language-life-sim/issues/15-hud-and-conversation-ui.md))

- Help is a **tab** in the conversation column (H toggles it). It shows "The conversation waits while Help is open", hints for this moment (a full model sentence, its Native Language translation and 🔊), then the place's phrasebook, then the Player's personal phrasebook. **Translate** and **🔊 Replay** sit under every NPC line.
- **Hints are generated** by `/api/hint` when the Help tab opens: 2–3 full model sentences with Native Language translations, built from the goal, the facts, the step and the transcript so far. Nothing is authored per interaction.
- **Translate** shows the Native Language translation that `/api/annotate` already returned for that line, so it is instant.
- **Phrasebooks:** each place has an authored phrasebook per Culture Pack (content). The **personal phrasebook** is a list in the save, filled by "+ Phrasebook" on Recap new words, and shown in the Help tab and in a Phrasebook view in the Journal.
- Help is free (no money, no Mood, no reduction in Small Talk Mood) and **the same at every step**.
- Each conversation records a **Help log**: the hints and phrasebook entries shown, and which NPC lines were translated, ordered relative to the turns. It goes to the Recap call. A player turn that closely repeats a hint shown just before it counts for **little**; a translated NPC line counts for **nothing** as listening evidence; turns with no Help count in full.
- In Shifts, hints for the Player's own lines are free. Translating a customer is handled as described under Jobs and Shifts.
- The only display is the **"No Help needed"** sticker when the Help log is empty.

### Recap and Journal ([Anatomy](../language-life-sim/issues/02-anatomy-of-an-interaction.md), [Help economics](../language-life-sim/issues/12-help-economics.md), [Save model](../language-life-sim/issues/13-save-model.md), [HUD](../language-life-sim/issues/15-hud-and-conversation-ui.md))

- The gateway's `/api/recap` call (`generateContent` + `responseSchema`, flash-class model, about 6 s) starts as soon as the conversation ends. **Input:** the transcript with PLAYER lines marked as possibly misheard, the Help log, the interaction, the step and the Native Language. **Output schema:** outcome line; `corrections[]` (≤ 3: said / more natural / one-line why, in the Native Language); `newWords[]` (base, reading, gloss); `cefrEstimate`; optional `lastTopic`. A likely mishearing is treated as a pronunciation point.
- **Order of events:** apply the outcome → autosave → closing card (outcome, effects, Skip Recap / See Recap) → Recap in the column as a lined Journal page (outcome; corrections with 🔊; new words with `<ruby>`, 🔊 and + Phrasebook; Done; "No Help needed" sticker top-right). Skipping shows "Recap saved to your Journal". Small Talk gets a lighter Recap. A Shift gets one combined Recap when it ends.
- **Journal:** an **append-only IndexedDB store keyed by slot**, separate from the save. Each entry has its own `schemaVersion`, Zod schema and migrations, and holds **rendered** text: the Recap, annotated lines with reading aids, the Help log, the "No Help needed" flag and the Native Language it was written in. There's no size cap. J opens it full-screen in two panes.

### Voice pipeline and Gemini gateway ([Gemini voice](../language-life-sim/issues/03-gemini-voice-capabilities.md), [Voice prototype](../language-life-sim/issues/06-voice-conversation-prototype.md), [Technical architecture](../language-life-sim/issues/10-technical-architecture.md))

- **Gateway:** a small Node app on one port. It reads the key from `.env` and holds no game state. Vite proxies `/api` to it, and one `npm run dev` starts both.
  - `POST /api/token`: a one-use ephemeral token (v1beta `auth_tokens`) plus the Live model ID.
  - `POST /api/recap`: as above.
  - `POST /api/tts`: hear-it-said via Gemini TTS.
  - `POST /api/annotate`: for every NPC line in every language, a Native Language `translation`; for zh and ja also `{base, reading}` segments (flash-lite + `responseSchema`).
  - `POST /api/hint`: 2–3 hint sentences with translations for the current moment (flash-lite + `responseSchema`).
  - Model IDs, voices per language and endpoint versions live **only** in the gateway config. Current choices: `gemini-3.8-live`, `gemini-3.8-flash` (Recap), `gemini-3.5-flash-lite` (annotate and hints), `gemini-3.8-flash-lite-tts`, and `gemini-3.8-pro` (eval judge only).
- **Live session:** one `gemini-3.8-live` session per conversation, connecting to the v1beta `BidiGenerateContentConstrained` endpoint with the token. Transcription is on both ways. Push-to-talk uses `activityStart`/`activityEnd` with automatic activity detection off; open mic uses automatic detection. The Target Language is set in the system instruction, since there's no language-code setting.
- **`VoiceSession` class** (the only code that touches the socket): `connect`, push-to-talk start/end, open mic, `sendText` (Typed Fallback), and events for input/output transcripts, tool calls, mic level and usage. It's ported from the prototype: an AudioWorklet downsamples the mic to 16 kHz PCM, and 24 kHz PCM plays through a scheduled AudioBufferSource queue. Token usage is accumulated per turn.
- **Connection failure:** retry once with a fresh token, seeding the transcript so far. If that fails, the conversation ends as a **network abandonment**: no Patience or Mood loss, no Recap, an "NPC had to step away" toast, and a replacement in Shifts. The "Voice service unavailable" screen appears only when no token can be minted.
- **Hear-it-said** clips are cached in IndexedDB by a hash of `(text, voice)`, in a store separate from saves and never exported.
- **Mock mode** (`GEMINI_MOCK=1`): the gateway returns canned Recaps, hints, TTS and annotations (with translations), and `VoiceSession` uses a scripted fake NPC that accepts typed input and fires completion functions on keywords.
- **Cost:** about $0.012 per conversation minute. Latency was measured at about 0.9 s median.

### NPC prompt assembly ([Technical architecture](../language-life-sim/issues/10-technical-architecture.md), [NPC identity and memory](../language-life-sim/issues/11-npc-identity-and-memory.md))

- `buildNpcSession(interaction, culturePack, proficiencyStep, npc, context)` returns `{systemInstruction, tools, voice}`. It's pure and snapshot-tested for each language × step.
- The system instruction is an **English meta-prompt** made of ordered pure blocks:
  1. role and persona
  2. **"You and this person"** (from NPC Memory: tier, how to address the Character and in which register, the usual, the last topic, whether the favourite has been told; a short default for strangers)
  3. language rules (Target Language only, loanwords OK, `not_understood` only for unintelligible turns, clarifying re-asks free)
  4. step adaptation
  5. facts from the Culture Pack
  6. the goal + read back then confirm then call the completion function, then end
  7. the situation (time of day)
- The Character's money is **never** in the prompt; the sim checks affordability. Tools are the interaction's completion function, `not_understood(reason)`, and for Named NPCs `learn_name` and `reveal_favourite`. Shift Customer sessions carry the hidden order as the customer's own goal.

### Reading aids ([Reading aids](../language-life-sim/issues/05-reading-aids.md), [Technical architecture](../language-life-sim/issues/10-technical-architecture.md), [AI quality evaluation](../language-life-sim/issues/14-ai-quality-evaluation.md), [HUD](../language-life-sim/issues/15-hud-and-conversation-ui.md))

- zh and ja only. An NPC line appears **immediately** with library readings (`pinyin-pro` for zh; `kuroshiro` for ja, with `wanakana` for romaji). In parallel the finished line goes to `/api/annotate`. The Gemini segments replace the library readings (about 1 s later) **only if all four checks pass**:
  1. the `base` segments concatenated equal the line exactly;
  2. readings are in the right script (zh: pinyin syllables with tone marks; ja: kana only);
  3. the length is plausible (zh: one syllable per hanzi; ja: kana-only segments read as themselves);
  4. zh only: the reading agrees with `pinyin-pro`, except on its known polyphonic characters.
- Rendering uses DOM `<ruby>` built with `textContent` **in the chat column** (not floating over the scene). Only a small "speaking…" indicator is anchored to the NPC. Reading aids can be hidden (a device setting). The Recap and Journal store the annotated version.
- **Japanese display:** furigana over kanji by default. A separate **Show romaji** device setting (off by default) adds a romaji line under each Japanese line, derived from the readings with `wanakana`. Hiding reading aids hides both.
- **World text:** signs and menus are canvas textures generated from Culture Pack strings. Pointing at one in range shows a tooltip with the reading aid and Translate, using authored glosses.

### Content model ([Technical architecture](../language-life-sim/issues/10-technical-architecture.md) and others)

- Zod-typed TypeScript content:
  - Goal Interactions and hiring interactions
  - Shift customer templates
  - Culture Packs (menus and goods with prices as Shift ratios, currency and rounding rules, customs, sign strings, opening-hour overrides, ambient one-shots, item glosses for the three other Native Languages, persona localisations, persona × pack → Appearance Preset table, Shift Customer appearance weights)
  - Illnesses, Comfort Purchases, places and hours, place phrasebooks (per place, per pack, with glosses), Named NPC personas, the Appearance Preset pool
- A Vitest check validates every schema and cross-reference: every item an interaction refers to exists in every pack, every persona has a localisation and appearance in every pack, every gloss exists in all three other Native Languages, and every price ratio converts.

### Save model ([Save model](../language-life-sim/issues/13-save-model.md))

- **4 slots**, each holding one Save in any Target Language. Continue loads the most recent. IndexedDB via `idb-keyval`.
- **Save object** (a few KB, `schemaVersion`, Zod-validated, ordered migrations):
  - *Meta*: `schemaVersion`, `slotId`, created/last-played, RNG state.
  - *Identity*: Character name, Target Language, Culture Pack id, Appearance Preset.
  - *Clock & place*: day, minute of day, place id.
  - *Character*: Health, Hunger, Thirst, Mood, money, current Illness (id + onset day).
  - *Obligations*: rent day, amount owed, debts (rent, hospital), payment plans.
  - *Progression*: Proficiency score, highest step reached, Newcomer Discount step, XP for 5 Life Skills, daily Cooking and gym counters.
  - *Possessions & status*: inventory (item id, quantity, expiry day), gym membership expiry, address registered, Jobs hired, Shift in progress (customers served, pay so far).
  - *Phrasebook*: the personal phrasebook (text, reading, gloss in the Native Language it was saved in, day added).
  - *Onboarding*: First Morning progress.
  - *People*: one NPC Memory record per Named NPC, plus the daily cap counters.
- **Content by id, never copied.** Migrations remap or drop renamed ids. An unknown id on load **fails loudly**.
- **Autosave triggers:** after each outcome (before the Recap), at sleep or a new day, at doors, on `visibilitychange`→hidden and `pagehide`, and every ~2 real minutes. "Saved ✓" appears briefly in the dock, silently. A conversation is never saved in progress. A Shift saves after each customer. On load, the Character spawns at the saved place's entrance, or in bed if at home.
- **Device settings** (one record per browser, outside saves): Native Language, volumes (Master, Music, Ambient, Voice, UI), input mode (mic or Typed Fallback), push-to-talk vs open mic, reading aids on/off, show romaji on/off, tooltips on/off, tooltips seen, mic check passed.
- **Backups:** a pre-migration backup, and one start-of-day backup per slot rotated at sleep. Load falls back from main → start-of-day ("Loaded this morning's save") → a "This save couldn't be loaded" card with Export raw and Delete. Nothing is deleted automatically.
- **Export:** one JSON per slot (`insomniacs-<name>-<lang>-day<N>.json`) with the save, its Journal and backup metadata. **Import** into an empty slot only, through the same Zod/migration path. **Delete** needs the Character's name typed and removes the save, its backups and its Journal. There's no reset.
- `navigator.storage.persist()` is called on the first write. If it's refused, a one-time dismissable callout appears.

### Onboarding ([Onboarding](../language-life-sim/issues/09-onboarding-and-native-language.md), [NPC identity](../language-life-sim/issues/11-npc-identity-and-memory.md), [Art and audio](../language-life-sim/issues/16-art-and-audio-direction.md))

- **Five setup screens**, all in the Native Language:
  1. Native Language (first `ja`/`zh`/`en`/`de` base tag in `navigator.languages`, otherwise English)
  2. Target Language (≠ Native, with its Culture Pack named)
  3. self-assessment + Character name
  4. Appearance Preset
  5. mic check (skippable, level meter, recommends headphones, Skip tutorial option)
- **The First Morning** follows the sequence in the user stories. Prompts don't block, any equivalent action completes a step, it can be skipped from the pause menu, and it ends with the closing card. Help is pointed to, never forced. Without a mic, it teaches the Typed Fallback. Open mic is never taught there.
- **Contextual one-time tooltips** cover Shifts, Fainting, the Journal (after the first Recap closes), open mic and the Typed Fallback. They fire even if the tutorial was skipped.
- The Gemini key is a developer setup step, not part of onboarding.

### UI and HUD ([HUD and conversation UI](../language-life-sim/issues/15-hud-and-conversation-ui.md))

- **World:** a bottom-centre dock with four ring gauges (Health, Hunger, Thirst, Mood with a face), the clock (time; "Day N · weekday"), money, and "Saved ✓" under the clock. A place and opening-hours line sits above the dock. The First Morning banner is at the top centre, with an arrow and distance plus a world marker. Tooltip cards sit above the dock with "Got it". "Press E to talk — <role>" appears near NPCs.
- **Conversation:** a chat column on the right (~40% of the screen, ≤ ~420 px). Its header shows the NPC name or role, the place and the time, with Chat | Help tabs and Leave (Esc). NPC lines are left bubbles with `<ruby>`, Translate and 🔊 Replay. Player lines are right bubbles headed "Heard as". The input bar has the mic button (held with Space; red with a live dot while listening) and the always-present typed field. With the mic off, the "🎤 off. Enable in Settings" chip appears, at most once a day. The dock shrinks and centres on the area left of the column. The 3D scene stays visible.
- **Closing card**, **Recap** and **Journal** as described above.
- **Title (T4):** a left menu (Continue · Load a save · New game · Import a save · Settings) over the live scene with a slow camera drift and a dark gradient on the left. The Character is in the right third, facing the camera, at the save's place. The centre panel follows the highlighted item, with one green primary button. Slot rows have Play and a ⋯ menu (Export, Delete). Key hints run along the bottom left, and the persist-refused callout sits bottom right.
- **Hotkeys:** E talk · Space push-to-talk · T typed field · Enter send · H Help · J Journal · Esc leave/back/pause.
- **Left to the build, reusing these patterns:** the Settings contents, the pause menu, the Job action UIs (grid, scanner/coin tray, order pad), the Fainting and hospital screens, the skills page (stars) and the credits screen. Check German string lengths in the dock and column.
- **No Patience or Language Proficiency anywhere on screen.**

### Art and audio ([Art and audio direction](../language-life-sim/issues/16-art-and-audio-direction.md), [Web 3D stack](../language-life-sim/issues/04-web-3d-stack.md))

- **Cozy pastel** low-poly: Kenney and Quaternius (CC0) assets recoloured to one shared ~24-colour palette, with flat shading and gentle distance fog. Four keyframed lighting presets (morning, midday, golden hour, night) are blended by sun angle and colour. Windows and street lights switch on at dusk, and a lit window means the place is open. No weather.
- **Characters:** one Quaternius base rig and animation library for the Character, Named NPCs and Shift Customers. The Appearance Preset pool covers ~4 body/face presets, hair style and colour, and skin tone. Named NPCs keep their build and role signifier in every pack; looks come from the persona × pack table. Shift Customers are randomised with pack weights.
- **Per-pack art** swaps props only (signs, menus, food and goods, money, small set dressing). Façades, roofs and layout are shared.
- **Music:** one culture-neutral calm acoustic/lo-fi soundtrack: 4 outdoor loops (one per lighting preset), a home loop, a counters loop and a title theme. **Ambient:** shared beds plus per-pack one-shots, never with intelligible speech.
- **Mix:** in a conversation, music ~20% and ambient ~40%, with TTS and hear-it-said at full volume. **While the mic is open**, music is muted and ambient ~10%.
- **UI sounds:** click, money in/out, a success chime, a gentle failure tone, a Journal page-turn, and a subtle Patience-low cue. Saved ✓ makes no sound.
- **Sourcing:** CC0 first. CC-BY is allowed with an in-game credits screen and `CREDITS.md`. AI-generated music is an acceptable fallback.

### UI localization ([Technical architecture](../language-life-sim/issues/10-technical-architecture.md))

- react-i18next with typed resources for each Native Language (ja, zh, en, de). Settings calls `changeLanguage()` to switch live. This covers UI strings only: NPC speech is generated, and item names and glosses live in the Culture Packs.

### AI quality evaluation ([AI quality evaluation](../language-life-sim/issues/14-ai-quality-evaluation.md))

- `npm run eval` lives in a top-level `evals/` folder that never ships. It imports the real `ai` builders and `content`.
- **Cases** are Zod-typed, by kind and language: NPC (interaction id, step, script of player turns tagged `clean`/`noisy`/`gibberish`, expected outcome), Recap (canned transcript + Help log + expected step) and annotate (line + gold readings). Start with about 6–10 NPC cases per language, more for zh and ja. Inputs are mostly `sendText` turns, using real garbled transcripts from the prototype, plus gitignored recordings of the dev with a committed manifest; missing audio is skipped.
- **Hard bars (zero failures):**
  - no NPC line outside the Target Language (loanwords OK)
  - no completion before a read-back and confirmation
  - completion arguments always match the read-back
  - Help discounting never lowers the CEFR estimate
  - every Recap matches its schema
  - exact `base` concatenation
- **Rate bars:**
  - `noisy` turns understood or repaired without Patience loss ≥ 90%
  - `gibberish` turns accepted ≤ 10%
  - CEFR estimate within ±1 step ≥ 85%
  - judge rates corrections correct ≥ 90%
  - step-appropriate speech ≥ 85%
  - annotate validation failures ≤ 15% (soft)
  - any rate dropping more than 5 points against `evals/baseline.json` fails the run
- The judge is `gemini-3.8-pro` with a fixed rubric, and a human spot-checks ~10% of its verdicts.
- **When it runs:** it is required before merging changes to the `ai` module or the gateway config. There's no schedule or CI. `--quick` runs a few cases per language. Each run prints an estimated cost and asks before continuing (target < $1 per run, ~$15 in total). Reports go to `evals/reports/<timestamp>.json`. Only a human may update the baseline.

## Testing Decisions

**What makes a good test here.** Test external behaviour through a module's public interface: state in → state out for `sim`, data in → validation result for `content`, inputs → prompt text or tool declarations for `ai`, stored bytes → loaded state or a clear failure for `store`, and what the Player sees for Playwright. Don't test private helpers, block-internal string fragments beyond the snapshot, React component internals or Three.js scene graphs. Tests must not call real Gemini; anything that does is an eval, not a test. Tuning constants should be imported from their single source in tests, not copied in, so that retuning doesn't break tests that check rules rather than numbers.

**Seams, as agreed with the dev:**

1. **`sim` public API (primary seam, Vitest).** Nearly all game rules are tested here: Well-being decay and Health drain; Fainting (wake time, bill, debt, Mood); the ¼-speed conversation clock as a `tick` caller contract; rent due, debt, extension, payment plans with instalments on rent day, and repayment only at the counter; the bed window (from 20:00) and waking at 07:00; closing time never ending a Shift in progress; gym membership expiry and renewal; Newcomer Discount and stakes ratcheting while NPC behaviour follows the current step; Shift pay (including docks, the half-dock for translated customers, network replacement, the never-below-0 floor and a mid-Shift reload); the Shift customer mix (seeded RNG); Proficiency updates (fast start, short-conversation weighting, `not_understood` evidence, Help only reducing weight); Life Skill XP and caps (Cooking 3 a day, one gym session a day, the Mood modifier); Illness onset (seeded, Well-being and Fitness modifiers) and cure only by matching medicine (flu clearing only after the next sleep); Familiarity tiers, the shared daily cap, no decay, gifts once a week, the favourite bonus, `usualOrder` after 3 identical orders, and `learn_name` checks; affordability checks on completion arguments; and First Morning starting state and the Patience floor.
2. **`content` validation (Vitest).** Every schema passes; cross-references hold in all four packs; glosses are complete; prices convert and round; every interaction's tool declaration and argument validator come from one schema.
3. **`ai` builders (Vitest).** Snapshot `buildNpcSession` for each language × step (and for stranger vs friend memory blocks), the Recap request builder (including the combined Shift Recap), the hint request builder and the annotate request builder. The **annotate validator's four rules** are tested as a table of passing and failing cases, using the known library misreadings (长得, 还钱, 一日中, この方) as fixtures.
4. **`store` load path (Vitest).** Zod validation, ordered migrations, the pre-migration backup, fallback to the start-of-day backup, unknown content ids failing loudly, export → import round trip into an empty slot, import rejecting a bad file, and Journal entries migrating independently.
5. **Playwright smoke in mock mode (top seam).** Setup (5 screens) → First Morning → café order via the Typed Fallback against the scripted fake NPC → closing card → Recap → Journal entry exists → reload → Continue lands in the same state. Add a mic-denied path and a network-abandonment path. No automated 3D visual tests.
6. **`npm run eval` (real models).** Covers model quality only, as described above. It is not part of the test suite.

**Prior art.** The repo has no application code yet. The throwaway prototypes on `prototype/voice-conversation` (VoiceSession, token flow, Recap prompt) and `prototype/hud-and-conversation-ui` (layout) are references for behaviour, not for test style. The test conventions start with this build and should be written into each folder's `AGENTS.md`.

## Out of Scope

- Multiplayer or other real players in the town.
- House building, decorating, furniture, wardrobe or clothes for sale; changing the Appearance Preset after setup.
- Accounts, cloud saves, public hosting or deployment, monetization, per-player API keys.
- Mobile and touch devices.
- Languages beyond Japanese, Chinese, English and German.
- A win state, promotions, unlock ladders or eviction.
- A recurring cast of Shift Customers; Familiarity-based discounts.
- Weather; per-Culture-Pack music; per-pack façades or layouts.
- A pronunciation score from the API (none exists); synthesized TTS audio as eval input.
- CI or scheduled evals.
- Automated 3D visual tests.

## Further Notes

### Superseded decisions (the later ticket wins)

These are earlier statements replaced by a later ticket. The spec above already follows the later one.

- Shift length "about 4 in-game hours" ([Core loop](../language-life-sim/issues/01-core-loop-and-economy.md)) → defined by **5–8 customers** ([Anatomy](../language-life-sim/issues/02-anatomy-of-an-interaction.md)).
- NPC text bubbles over the 3D scene via CSS2DRenderer (map Notes, [Reading aids](../language-life-sim/issues/05-reading-aids.md), [Technical architecture](../language-life-sim/issues/10-technical-architecture.md)) → **chat column** ([HUD](../language-life-sim/issues/15-hud-and-conversation-ui.md)).
- Help as a "side panel" ([Anatomy](../language-life-sim/issues/02-anatomy-of-an-interaction.md)) → **a tab in the chat column** ([HUD](../language-life-sim/issues/15-hud-and-conversation-ui.md)).
- First Morning prompt "pinned in a corner" ([Onboarding](../language-life-sim/issues/09-onboarding-and-native-language.md)) → **top-centre banner** ([HUD](../language-life-sim/issues/15-hud-and-conversation-ui.md)).
- Four setup screens ([Onboarding](../language-life-sim/issues/09-onboarding-and-native-language.md)) → **five**, with the name on the self-assessment screen ([NPC identity](../language-life-sim/issues/11-npc-identity-and-memory.md)) and a separate Appearance step ([Art and audio](../language-life-sim/issues/16-art-and-audio-direction.md)).
- Small Talk only in the park; gifts as a stub ([Town and content](../language-life-sim/issues/07-town-and-content-scope.md)) → **any idle Named NPC**, with real gift effects ([NPC identity](../language-life-sim/issues/11-npc-identity-and-memory.md)).
- "The save defaults to the Typed Fallback" ([Onboarding](../language-life-sim/issues/09-onboarding-and-native-language.md)) → the input mode is a **device setting**, outside saves ([Save model](../language-life-sim/issues/13-save-model.md)).
- A catalogue of 25 Goal Interactions (map, [Town and content](../language-life-sim/issues/07-town-and-content-scope.md)) → **28**, adding 3 hiring interactions ([Onboarding](../language-life-sim/issues/09-onboarding-and-native-language.md)). The map's Decisions line still says 25.
- kuroshiro as an on-demand fallback only ([Reading aids](../language-life-sim/issues/05-reading-aids.md)) → the **immediate** ja library reading ([Technical architecture](../language-life-sim/issues/10-technical-architecture.md)). This means its ~18 MB dictionary loads in every Japanese session; served from localhost that's acceptable, but it should be preloaded during setup or loading rather than on the first line.

### Small decisions made while assembling

- Opening the Help tab sets the clock scale to 0 as well as freezing Patience. This follows [Onboarding](../language-life-sim/issues/09-onboarding-and-native-language.md)'s prompt text, "time and Patience pause", which is stronger than [Anatomy](../language-life-sim/issues/02-anatomy-of-an-interaction.md)'s "Patience frozen".
- While the typed field has focus, Space types a space and doesn't trigger push-to-talk. Otherwise the Space and T hotkeys clash.
- The "daily Familiarity cap" in [Save model](../language-life-sim/issues/13-save-model.md) is read as the **per-NPC, per-day** cap from [NPC identity](../language-life-sim/issues/11-npc-identity-and-memory.md), stored as a counter on each NPC Memory record.
- At A1–A2 the failure dock is zero, so a tap-translated Shift Customer pays in full at those steps. That follows from [Help economics](../language-life-sim/issues/12-help-economics.md) plus the step table, and is intended to be gentle.

### Decisions made before ticketing

No ticket answered these. The dev decided them on 2026-10-03, before the build tickets were cut, and the sections above already follow them.

1. **Hints** come from a new `/api/hint` call, generated for the moment. Nothing is authored per interaction.
2. **Translate on NPC lines** is a `translation` field on `/api/annotate`, which now runs for every NPC line in all four languages.
3. **Phrasebooks:** the personal phrasebook is a list in the save, shown in the Help tab and the Journal. Place phrasebooks are authored content per place and pack.
4. **Mood numbers** (the scale, the size of each change, the overwork and debt penalties, the modifier curve) start as defaults in one tuning module and are adjusted in playtesting.
5. **Other tuning numbers** (the Life Skill XP curve, Familiarity thresholds, the Illness base rate, grocery expiry, Health drain during Illness) likewise start as defaults in the tuning module. Tests import them rather than copying them.
6. **Gym membership** lasts 30 days and is renewed by talking to the attendant. It is never charged automatically and never becomes debt.
7. **Flu "rest":** the fever reducer stops the Health drain, and the flu clears after the next sleep.
8. **Closing time** stops new conversations and Shifts from starting. Anything already under way finishes.
9. **Sleep:** the bed is usable from 20:00, and the Character always wakes at 07:00. No naps.
10. **Japanese reading aids:** furigana by default, plus a separate "Show romaji" setting, off by default.
11. **Shift Recaps:** one combined Recap per Shift.
12. **"Helping NPCs pays off in Mood and relationships"** ([Core loop](../language-life-sim/issues/01-core-loop-and-economy.md)) is dropped. Small Talk, gifts and regular visits cover relationships.
13. **Debt** is repaid at the counter (the landlord for rent, reception for hospital bills), never taken from Shift pay. Payment-plan instalments come out automatically on rent day.
