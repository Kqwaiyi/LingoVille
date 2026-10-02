# AI quality evaluation

Type: grilling
Status: open
Map: [Language-learning life sim](../map.md)

## Question

How do we check that the real models behave well before trusting them, and keep checking as prompts and models change? Decide:
- what is measured: NPCs staying in the Target Language, speaking at the Proficiency Step, judging intent fairly (including noisy learner transcripts), calling the completion function only after a read-back, the Recap's corrections and CEFR estimates, and the accuracy of reading aids
- how it's run: a scripted eval harness over typed or recorded turns in the four languages, LLM-as-judge, human spot checks, or a mix
- the pass bars, and when evals run (before changing a model or prompt, or on a schedule)
- the API cost budget for running evals

The [Technical architecture](10-technical-architecture.md) ticket fixes the following:
- Prompts are pure builders with snapshot tests, and model IDs live only in `server/config.ts`.
- Mock mode (`GEMINI_MOCK=1`) covers functional end-to-end tests, so this ticket is only about the quality of real model output.
- Reading aids are library-first, then replaced by Gemini `/api/annotate` output when it passes validation. Validation rules are in scope here.

From the [Voice conversation prototype](06-voice-conversation-prototype.md): live transcription of learner Mandarin is noisy (小杯 came back as "小贝" or "tape", 一杯 as "100"), yet the NPC understood. From the [Reading aids](05-reading-aids.md) research: both libraries misread common words.
