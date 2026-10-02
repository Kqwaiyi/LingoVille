# Art and audio direction

Type: grilling
Status: resolved
Map: [Language-learning life sim](../map.md)

## Question

What do the game and its town look and sound like? Decide:
- the low-poly style reference (palette, lighting mood across the day–night cycle, level of detail) within the Kenney / Quaternius CC0 assets and the shared Quaternius character rig from [Web 3D stack for a low-poly life sim](04-web-3d-stack.md)
- whether the Character's appearance can be customised (only a name is decided so far), and if so, how much
- how each of the ~15 Named NPCs looks in each Culture Pack (one rig, with local clothing and hair?)
- how much the 3D art changes per Culture Pack: signs and food models only, or building façades too
- music and SFX: whether there's music (per place? per Culture Pack?), ambient town sound, UI sounds, and how audio sits under NPC TTS so speech always stays clear

## Answer

### Look

- **Style:** **cozy pastel** low-poly. All Kenney / Quaternius assets are recoloured to one shared palette of about 24 colours, with flat shading and gentle distance fog. This also hides mismatches between the two packs.
- **Day–night lighting:** four keyframed presets (**morning, midday, golden hour, night**), blended continuously by sun angle and colour. Window and street lights switch on at dusk, and a lit window means the place is open. No weather.
- **Character appearance:** light customisation **at setup only**. The player picks an **Appearance Preset**: body/face preset (~4), hair style and colour, and skin tone, all on the shared Quaternius rig. It can't be changed later, and there's no wardrobe or clothes for sale. This **amends [Onboarding and Native Language selection](09-onboarding-and-native-language.md)**: an appearance step follows the name field.
- **Named NPCs:** each persona keeps the **same build and role signifier** in every Culture Pack (the barista's apron, the landlord's cardigan, the park regular's dog). Skin tone, hair and casual clothing are authored **per Culture Pack** from the same Appearance Preset pool, as a data table: persona × pack → preset.
- **Shift Customers:** assembled at random from the Appearance Preset pool, with weights per Culture Pack.
- **Per-Culture-Pack 3D art:** **swappable props only**: signs, menus, food and goods models, money, and small set dressing (vending machine vs. kiosk, post box, bins). Façades, roofs and layout are shared, in line with [Town and content scope](07-town-and-content-scope.md).
- **World text:** signs and menus are **canvas textures generated from Culture Pack strings**, with no hand-painted or baked-in text (this replaces Kenney's English text). Pointing at a sign within range shows a small tooltip with the reading aid and **Translate**, reusing the pipeline from [Reading aids for Chinese and Japanese](05-reading-aids.md) and Tap-to-translate.

### Sound

- **Music:** one shared, **culture-neutral** calm acoustic/lo-fi soundtrack, with no per-pack variants. Outdoors there's one loop per lighting preset (4), indoors a home loop and a counters loop (café/restaurant/shop), plus a title theme.
- **Ambient:** shared beds (birds, distant traffic, the park, an interior hum) plus a few **per-pack one-shots**: a crossing chime and train jingle in Japan, a bicycle bell and church bells in Germany, a bus and pedestrian-crossing beep in the UK, scooter horns in China. **No ambient sound contains intelligible speech.**
- **Mix:**
  - In a conversation, music ducks to about 20% and ambient to about 40%, while NPC TTS and hear-it-said play at full volume.
  - **While the mic is open** (push-to-talk held, or open mic), music is muted and ambient drops to about 10%, so the game doesn't leak into the transcript. The mic check recommends headphones.
  - Volume sliders (**Master, Music, Ambient, Voice, UI**) are device settings, outside the Save, as in [Save model](13-save-model.md).
- **UI sounds:** a minimal set: button click, money gained and spent, a success chime and a *gentle* failure tone for each Goal Interaction outcome, a Journal page-turn when the Recap opens, and a subtle Patience-low cue (never a buzzer). **Saved ✓ makes no sound.**
- **Sourcing:** CC0 first (Kenney audio, CC0 sounds from Freesound and OpenGameArt). CC-BY is allowed when it's listed on an in-game credits screen and in `CREDITS.md`. If CC0 loops don't fit the four lighting moods, AI-generated music (e.g. via the dev's Gemini key) is an acceptable fallback, since the game runs locally only.

### Glossary

Added **Appearance Preset** to `CONTEXT.md`.
