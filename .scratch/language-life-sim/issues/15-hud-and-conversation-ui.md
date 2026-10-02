# HUD and conversation UI

Type: prototype
Status: resolved
Map: [Language-learning life sim](../map.md)

## Question

How is the screen laid out, both in the world and in a conversation? Make a rough, clickable DOM-over-canvas mock-up (no real 3D or Gemini needed) and react to it. Pin down the placement and behaviour of:
- **World HUD**: Well-being (Health, Hunger, Thirst), Mood, clock and day, money, the current place's opening hours, the pinned First Morning prompt with its direction marker, the one-time tooltips, and the brief "Saved ✓" mark.
- **Conversation**: NPC text bubbles with `<ruby>` reading aids over the 3D scene, tap-to-translate, the push-to-talk / open-mic state and the "🎤 off. Enable in Settings" chip, the Typed Fallback input, the Help side panel (hints, phrasebook, hear-it-said), and the closing card when a Goal Interaction ends.
- **Recap** (skippable, up to 3 corrections, new words, the "No Help needed" mark) and the **Journal**.
- **Title screen**: Continue, the 4-slot list, slot cards (Character name, Target Language, in-game day, money, last played) with their menu (export, delete with the name typed to confirm), the "This save couldn't be loaded" card, and the Settings tooltip shown when `storage.persist()` is refused.

All UI text is in the Native Language. Patience is never shown, and neither is Language Proficiency.

Decided elsewhere: [Anatomy of an interaction](02-anatomy-of-an-interaction.md), [Reading aids for Chinese and Japanese](05-reading-aids.md), [Onboarding and Native Language selection](09-onboarding-and-native-language.md), [Help economics](12-help-economics.md), [Save model](13-save-model.md).

## Answer

Resolved on 2026-10-03 by reacting to a clickable prototype: four HUD variants (A Classic corners, B Cinematic dock, C Quiet phone, and D, the pick) and four title screens (T1–T4). The prototype is on branch `prototype/hud-and-conversation-ui` (commit 3792a62), at `prototypes/hud-and-conversation-ui/index.html`. Open the file directly; no build is needed. Variant D is the chosen HUD and T4 is the chosen title screen.

**The pick: B's world HUD, C's conversation and Recap, and the T4 title screen.**

**World HUD (from B).**
- **One dock**, bottom centre, always visible: four ring gauges (Health, Hunger, Thirst, and Mood with a face icon), then the clock (time large, "Day N · weekday" under it), then money. The meters never hide.
- **"Saved ✓"** appears briefly under the clock, inside the dock.
- **Place and opening hours**: one line just above the dock (e.g. "Hinata Street — Café Hinata: open until 20:00").
- **First Morning prompt**: a pill banner at the top centre with a direction arrow and the distance, plus a marker floating over the destination in the 3D world.
- **One-time tooltips**: a card just above the dock, pointing at what it explains, with a "Got it" button.
- **Interaction prompt**: "Press E to talk — <role>" near the NPC.

**Conversation (from C).**
- **A chat column** on the right, about 40% of the screen and at most ~420 px wide. Its header shows the NPC (name or role), the place and the time, with **Chat | Help** tabs and **Leave (Esc)**.
- **NPC lines** are left-hand bubbles with `<ruby>` reading aids. Under each one: **Translate** (tap-to-translate, which shows the Native Language line underneath and goes into the Help log) and **🔊 Replay**.
- **Player lines** are right-hand bubbles labelled "Heard as", showing the transcript so the player can see what the NPC received.
- **The input bar** sits at the bottom of the column. The mic button is held down with Space and turns red with a live dot while listening. Next to it, the Typed Fallback field (Enter sends, T focuses it) is always there. With the mic off, the mic button is replaced by the "🎤 off. Enable in Settings" chip.
- **Help is a tab** in the same column, replacing the chat while it's open. It shows "The conversation waits while Help is open", then the hints for this moment (a full model sentence, its Native Language translation and 🔊), then the phrasebook for this place. **H** toggles it. In the First Morning the Help tab pulses after ~10 s of silence.
- **The 3D scene** stays visible to the left. The NPC only gets a small "speaking…" indicator over its head, never the text.
- **The dock stays on screen**, shrunk and centred on the space left of the column. So Well-being, Mood, the clock and money stay visible while talking.
- **Closing card**: when a Goal Interaction ends, a card appears in the middle of the scene with the outcome, its effects (e.g. "Hot latte · −¥450 · Mood ↑"), **Skip Recap** and **See Recap**. Skipping shows "Recap saved to your Journal".

**Recap (from C).** The Recap replaces the chat in the same column, styled as a lined Journal page, so it reads as the Journal entry it becomes.
- From the top: the outcome line, then up to 3 corrections (what you said, the more natural version with 🔊, and one line on why), then new words (with `<ruby>`, 🔊 and **+ Phrasebook**), then **Done**.
- **"No Help needed"** is a sticker in the page's top-right corner, shown only when no Help was used. Nothing is shown otherwise.
- Shift Recaps queue and open in the same column when the Shift ends (not prototyped).

**Journal.** **J** opens a full-screen view with two panes. On the left is the entry list, newest first: outcome, title, the "No Help needed" mark, and day, time and place. On the right is the selected entry: its corrections with 🔊, new words, and what was said. This was prototyped as a single design and accepted as it is.

**Title screen (T4, a menu over the live scene, after an FC 25-style reference).**
- **Menu on the left**: the logo, then **Continue · Load a save · New game · Import a save · Settings** as plain text. The highlighted item is bold and white. ↑ ↓ moves the highlight, Enter confirms and Esc goes back.
- **The background is the live 3D scene**: a slow camera drift and a dark gradient on the left so the menu stays readable. The Character stands in the right third, facing the camera, at the place where the Continue save was left (on Load a save, at the selected save's place).
- **The centre panel follows the highlighted item**, with one green primary button:
  - *Continue*: "Sam · Japanese", "Day 12 at Café Hinata", the money and when it was last played, and a **Continue** button.
  - *Load a save*: the 4 slots as dark see-through rows over the scene. Each has Play and a ⋯ menu (Export, or Delete, which asks you to type the Character's name). A failed save shows as "⚠ This save couldn't be loaded" with **Export raw** and **Delete**. An empty slot reads "New game or Import".
  - *New game*: "Start a new life", then the setup screens. With all 4 slots full it is greyed out with "Delete a save to start a new one".
  - *Import a save* and *Settings*: a headline, a one-line description and the button.
- **Key hints** run along the bottom left (↑↓ Select · Enter Confirm · Esc Back).
- **The `storage.persist()` refusal** shows as a dismissable callout in the bottom-right corner.

**Unchanged rules.** All UI text is in the Native Language. Patience and Language Proficiency never appear anywhere on screen.

**Amends earlier decisions.** NPC text no longer floats over the 3D scene. It lives in the chat column, and only a "speaking" indicator is anchored to the NPC. This replaces "NPCs reply with TTS + text bubble" (map Notes) and the DOM `<ruby>` bubbles placed by CSS2DRenderer in [Reading aids for Chinese and Japanese](05-reading-aids.md). The `<ruby>` rendering itself is unchanged; only where it is shown has moved.

**Left to the build (not decided here, nothing more to decide).** The Settings screen's contents (the device settings listed in [Save model](13-save-model.md)), the pause menu, the Shift counter's item grid, and the Fainting and hospital screens. These reuse the patterns above: the dock, column-style panels and a centred card. Check German string lengths in the dock and column during the build.

**Downstream.**
- [Art and audio direction](16-art-and-audio-direction.md): the title screen shows the Character close up, facing the camera, so its appearance is on screen every session. UI sounds (Help tab, Translate, the closing card) belong there.
- [Final assembly](17-final-assembly.md): fold the layout above into the game design doc, and the amendment into the reading-aids section of the technical spec.
