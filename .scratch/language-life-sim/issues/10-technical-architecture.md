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

The [Town and content scope](07-town-and-content-scope.md) ticket fixes the following:
- One 3D town layout plus four **Culture Pack** data sets (menus/goods, currency, customs, signs, opening-hour overrides), chosen by Target Language.
- Prices are authored as ratios of one Shift's pay. Each pack converts them with its anchor (¥6,000 / 240元 / €60 / £60) and rounds to local price points.
- The interaction catalogue is 25 player-led Goal Interactions plus 7 Shift customer templates, each authored as data with a typed completion function.
