# HUD and conversation UI

Type: prototype
Status: open
Map: [Language-learning life sim](../map.md)

## Question

How is the screen laid out, both in the world and in a conversation? Make a rough, clickable DOM-over-canvas mock-up (no real 3D or Gemini needed) and react to it. Pin down the placement and behaviour of:
- **World HUD**: Well-being (Health, Hunger, Thirst), Mood, clock and day, money, the current place's opening hours, the pinned First Morning prompt with its direction marker, the one-time tooltips, and the brief "Saved ✓" mark.
- **Conversation**: NPC text bubbles with `<ruby>` reading aids over the 3D scene, tap-to-translate, the push-to-talk / open-mic state and the "🎤 off. Enable in Settings" chip, the Typed Fallback input, the Help side panel (hints, phrasebook, hear-it-said), and the closing card when a Goal Interaction ends.
- **Recap** (skippable, up to 3 corrections, new words, the "No Help needed" mark) and the **Journal**.
- **Title screen**: Continue, the 4-slot list, slot cards (Character name, Target Language, in-game day, money, last played) with their menu (export, delete with the name typed to confirm), the "This save couldn't be loaded" card, and the Settings tooltip shown when `storage.persist()` is refused.

All UI text is in the Native Language. Patience is never shown, and neither is Language Proficiency.

Decided elsewhere: [Anatomy of an interaction](02-anatomy-of-an-interaction.md), [Reading aids for Chinese and Japanese](05-reading-aids.md), [Onboarding and Native Language selection](09-onboarding-and-native-language.md), [Help economics](12-help-economics.md), [Save model](13-save-model.md).
