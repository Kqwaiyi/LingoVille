# LingoVille

A submission for the Devpost hackathon **Build With AI: Basics**.

<!-- Your own description of LingoVille goes here. -->

The planning docs (scope, PRD, spec and build checklist) and an app map of the code are in [`devpost/`](devpost/). They use the project's working title, Insomniacs.

## Run it locally

You need [Node.js](https://nodejs.org/) 22.12 or newer and a desktop browser. A microphone is optional, because you can type instead.

1. Install the dependencies:

   ```bash
   npm install
   ```

2. Copy `.env.example` to `.env`, then either:
   - set `GEMINI_API_KEY` to your [Gemini API key](https://aistudio.google.com/apikey) to talk to real AI characters, or
   - set `GEMINI_MOCK=1` to play with scripted characters, with no key and no cost.

3. Start the game:

   ```bash
   npm run dev
   ```

4. Open http://localhost:5173.

Walk with WASD, press E to talk to someone, and hold Space to speak, or press T to type.
