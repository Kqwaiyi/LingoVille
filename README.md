# LingoVille

A submission for the Devpost hackathon **Build With AI: Basics**.

**Demo video:** https://streamable.com/e9sems

LingoVille is a 3D life sim in the browser for learning a language by using it. You live in a small town where people only understand the language you're learning, so ordering a coffee, working a shift or paying the rent means saying it out loud and being understood.

It's for people who have studied a language for a while but freeze when they actually have to speak it.

- **Speak to get things done.** Walk up to someone, press E and talk, or type. They answer aloud, act only on what they understood, and read your order back before serving it. Turns they can't follow wear out their patience, which shows on their face.
- **Get unstuck.** The Help tab suggests sentences you could say next and says them aloud for you. Every line can be translated, and Japanese and Chinese lines show their readings.
- **Learn from each conversation.** Each one ends with a short Recap of up to three corrections and some new words, kept in your Journal.
- **Live a day.** Get a job as a barista, cashier or server, and work shifts serving customers who order out loud. Keep Hunger, Thirst and Mood up, see the doctor when you're ill, go to the gym, and pay the landlord each week.
- **Four languages.** Learn Japanese, Chinese, English or German, with the game in any of the other three. Each language has its own town, with its own signs, menus, food and money.

The characters talk through Google's Gemini Live, by way of a small local server that keeps the API key out of the browser. A mock mode with scripted characters lets you play without a key.

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
