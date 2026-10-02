# Technical architecture

Type: grilling
Status: open
Blocked by: 03, 04, 06
Map: [Language-learning life sim](../map.md)

## Question

What is the system architecture? Decide: the 3D framework and app framework; whether a small local backend holds the Gemini key or the browser calls Gemini directly; the voice pipeline end to end; how NPC prompts are assembled from interaction definitions, Language Proficiency and Target Language; how game state is modelled and saved to browser storage; how UI localization is done for the four Native Languages; and the project/repo layout an AI coding agent will work in.

The [Voice conversation prototype](06-voice-conversation-prototype.md) ticket fixes the following (prototype on branch `prototype/voice-conversation`):
- The voice pipeline is one `gemini-3.8-live` session per conversation, which the playtest kept. The browser connects to the v1beta `BidiGenerateContentConstrained` endpoint with a one-use ephemeral token from a local Node server (`POST /v1beta/auth_tokens`).
- Push-to-talk uses `realtimeInput.activityStart`/`activityEnd` with automatic activity detection turned off. Open mic uses the default automatic detection. Transcription is on in both directions.
- The game ends a Goal Interaction after the completion function succeeds and the NPC finishes speaking.
- Hear-it-said (Recap and Help) uses Gemini TTS through the local server, not browser `speechSynthesis`.
- The Recap is a `generateContent` call with `responseSchema` (`gemini-3.8-flash`, about 6 s), started as soon as the conversation ends.

The [Life Skills and Language Proficiency models](08-life-skills-and-proficiency.md) ticket fixes the following:
- The NPC prompt takes the current CEFR Proficiency Step (vocabulary, sentence length, pace, choices up front, one simpler rephrase at A1–A2). Starting Patience comes from the step.
- The Recap `responseSchema` must also return an estimated CEFR level for the player's speech in that conversation, which feeds a weighted moving average.
- The state includes the hidden Proficiency score, the highest step reached, and XP for five Life Skills.

The [Onboarding and Native Language selection](09-onboarding-and-native-language.md) ticket fixes the following:
- The default Native Language comes from `navigator.languages` (first `ja`/`zh`/`en`/`de` base tag, falling back to English). It can be changed at runtime in Settings, so UI localization must allow switching languages live.
- The mic permission is requested on a setup screen with a level meter. If it is denied, the save uses the Typed Fallback, and Settings can retry the permission.
- The game needs a "Voice service unavailable" screen for when the local server can't get a token.

The [Town and content scope](07-town-and-content-scope.md) ticket fixes the following:
- One 3D town layout plus four **Culture Pack** data sets (menus/goods, currency, customs, signs, opening-hour overrides), chosen by Target Language.
- Prices are authored as ratios of one Shift's pay. Each pack converts them with its anchor (¥6,000 / 240元 / €60 / £60) and rounds to local price points.
- The interaction catalogue is 25 player-led Goal Interactions plus 7 Shift customer templates, each authored as data with a typed completion function.
