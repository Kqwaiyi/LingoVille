---
doc: prd
status: approved
---

# Insomniacs — Product Requirements

A low-poly 3D life sim in the browser where you learn a language by living in a town whose NPCs only respond when you speak their language. It's for someone with a long drills-app streak who freezes when they actually have to speak.
Source: `scope.md > Who It's For`, `scope.md > The Unique Kernel`.

## The Core Journey
Source: `scope.md > The Core Loop`, `scope.md > What "Working" Looks Like`.

1. The player opens the game and lands on the **Title Screen**: a menu on the left over the live town.
2. They choose New game and go through **Setup**: Native Language, Target Language, About you (name and starting level), Appearance, and a skippable mic check.
3. The **First Morning** begins in town. A banner in their Native Language guides them to the café.
4. At the café they press E, the barista greets them first, and they hold Space to **speak** their order in the Target Language.
5. If the barista can't make sense of a turn, it asks again. The player opens **Help**, uses a hint, and tries again.
6. The barista reads back what it understood, the player confirms, and the order is served and paid for.
7. A closing card shows the outcome, then the **Recap** shows up to three corrections.
8. The player gets the barista Job and works a **Shift**: customers order out loud, the player makes the drinks, and the pay at the end depends on how many were right.
9. Day to day, the player keeps **Well-being and Mood** up, pays **rent**, uses the **gym**, and goes to the **clinic** when ill. Every step of it is a spoken conversation.

## Screens and Layout
- **Title Screen:** a menu on the left (Continue once a save exists, Load, New game, Import, Settings) over the live 3D town, with a centre panel that follows the highlighted item.
- **Setup:** one panel per step, with Back and Next.
- **Town:** third-person view of the Character, with a dock at the bottom showing Well-being and Mood gauges, the clock and money. "Press E to talk" appears near someone you can talk to. During the First Morning, its prompts sit in a banner at the top.
- **Conversation column:** a chat column on the right, with Chat and Help tabs, Translate and Replay on every NPC line, and the mic button and a typed field at the bottom. The Recap replaces the chat in this column once a conversation ends.
- **Shift panel:** the barista's drinks menu for filling a customer's order.

## Look and Feel
Source: `scope.md > Inspiration & Identity`.
- A free-roaming town in the spirit of Bloxburg, in cozy pastel low-poly.
- Every character is Clawd, told apart by hats, glasses and neckwear.
- Lit windows show which places are open, and the lighting follows the time of day.

## Features and Behavior

### Setup and First Morning
- The Native Language is pre-selected from the browser, with English as the fallback. The Target Language is one of the other three, and each shows the country its town is set in.
- The player names their Character, picks a starting level from plain sentences, and chooses a hat, glasses, neckwear and a colour.
- A mic check with a live level meter can be skipped. Without a microphone, the game switches to typing.
- The First Morning ends at the café with a real order that can't fail.
  - [ ] A new game reaches the town after the five setup screens, with the UI in the chosen Native Language.
  - [ ] During the First Morning, the banner always shows where to go next.
  - [ ] The first café order completes even after several turns the barista can't understand.

### Speaking to NPCs
Source: `scope.md > The Unique Kernel`.
- The NPC speaks first and replies aloud in the Target Language only. Each reply also appears as a line in the chat column, and the player's own turn shows as "Heard as: …".
- The outcome follows what the NPC understood. It reads the order back before acting.
- Clarifying re-asks are free. Only turns it can't make sense of at all use up its Patience, which shows on its face.
- A failed conversation costs no money and only a small Mood dip. Walking away costs nothing.
  - [ ] Ordering a drink out loud gets a read-back of that drink and price, then the drink, with the money taken.
  - [ ] Gibberish or a whole sentence in the Native Language makes the NPC look more strained. Once Patience runs out, the conversation ends as failed.

### Help
- The Help tab gives a model sentence for this moment, its translation and a way to hear it said, plus the place's phrasebook.
- Help never costs money or Mood.
  - [ ] Opening Help mid-conversation shows a hint the player can speak or copy, and hear aloud.
  - [ ] A Recap with no Help used shows a "No Help needed" sticker.

### Recap and Journal
- After each conversation, a closing card shows the result and its effects. The Recap then gives up to three corrections (what they said, a more natural version, and why) and new words. It can be skipped, and every Recap is saved to the Journal.
  - [ ] After a café order, the Recap shows at least one correction or new word and appears in the Journal.

### Barista Job and Shifts
- The player gets the Job by asking for work in the Target Language.
- A Shift is started at the staff door during opening hours, at most once a day, and has 5–8 customers.
- Each customer speaks first with a hidden order. The player can ask them to repeat, then fills the order from the drinks menu.
- Each order is checked exactly against what the customer wanted. Pay depends on how many were right and on Mood.
  - [ ] A Shift ends with a pay amount that goes up when more orders are filled correctly.
  - [ ] A customer lost to a network drop is replaced and doesn't count against the player.

### Well-being, Mood and Fainting
- Health, Hunger, Thirst and Mood show in the dock. Hunger and Thirst run down over the day, and Health falls while either is empty or during an Illness.
- When Well-being runs out, the Character faints and wakes in hospital the next morning to a nurse and a hospital bill.
  - [ ] Letting Hunger reach zero makes Health fall, and the Character eventually wakes in the ward owing a bill.

### Gym
- The player joins the gym by asking the attendant. Membership lasts 30 days and is renewed the same way.
- One session a day builds Fitness and lifts Mood.
  - [ ] After joining, a gym session raises Fitness and Mood. A second session the same day is refused.
  - [ ] Without a membership, the gym can't be used.

### Illness and the Clinic
- Illness comes now and then: a cold, flu, food poisoning or hay fever, each with its own symptoms. It's more likely when Well-being is low and less likely with good Fitness.
- At the clinic the player checks in at reception, describes their symptoms to the doctor, and gets the right diagnosis only if they got the symptoms across. The pharmacy sells the medicine, and the wrong medicine doesn't cure.
- A hospital bill can be settled in instalments.
  - [ ] Describing the symptoms correctly leads to a diagnosis and medicine that ends the Illness.
  - [ ] The wrong medicine leaves the Illness in place.

### Rent and Debt
- Rent is due weekly, first at the end of day 7, and is paid by talking to the landlord.
- A Newcomer Discount lowers rent at first, and shrinks as the player's language improves. The landlord announces each step.
- Unpaid rent becomes debt, with a Mood penalty and a reminder from the landlord. There's no eviction, and the player can ask for more time.
  - [ ] Paying rent to the landlord takes the money and clears what's due.
  - [ ] Missing rent shows debt and brings a reminder, and the game carries on.

### Four Languages
- Japanese, Chinese, English and German can each be the Native or the Target Language, with Target and Native always different.
- The UI is in the Native Language and can be changed in Settings.
- Each Target Language comes with its own town setting (Japan, China, the UK or Germany), which swaps signs, menus, food, money and props.
  - [ ] Each of the four Target Languages loads its own town setting and NPCs who speak only that language.
  - [ ] Switching the Native Language in Settings changes the UI at once.

## States and Boundaries
- **First use:** setup, then the First Morning, which can be skipped from setup or the pause menu.
- **No microphone:** the game switches to typing, and nothing is locked.
- **Voice service unavailable:** a clear screen says to check the local server, so it isn't mistaken for a mic problem.
- **Not understood:** the NPC re-asks or uses up Patience. Running out ends the conversation as failed, at no money cost.
- **Can't afford it:** the NPC says so in the Target Language.
- **Well-being runs out:** Fainting, a hospital bill and a lost day. There's no death.
- **Unpaid rent:** debt, never eviction.
- **Coming back:** the game autosaves, and the Title Screen offers Continue.

## Product Decisions
- The player is someone with a drills-app streak who freezes when speaking (from 2-scope).
- The demo shows all three moments: the café order, recovering with a Help hint, and a barista Shift (from 2-scope).
- The Title Screen, Setup and First Morning all come before the first conversation. The learner chose to keep all three.
- The proof of concept includes the gym, illness and the clinic, the four languages, and rent and debt. The learner chose this in 2-scope.
- The learner approved the behaviour and checks for those areas as written here.
- The cashier and server Jobs were added during the build, on the barista's Shift loop: the supermarket till and the restaurant's order pad. The learner chose this in 5-build.

## What We're Building
Everything under **Features and Behavior** and **States and Boundaries** above, inside `scope.md > The POC Boundary`.

## Deferred From the POC
- **Gifts and Familiarity:** not part of the proof of concept, because the demo doesn't need them.

## Possible Later Enhancements
None named.

## Non-Goals
- Multiplayer, house building, accounts and cloud saves, mobile, and languages beyond the four. These were out of scope from the start, and the game runs locally on the developer's own Gemini key.

## Open Questions
- Every character is Clawd, the Claude Code mascot. Using it in a public repo and demo video may need permission. This can wait until `6-ship`.
