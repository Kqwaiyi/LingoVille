/// <reference lib="dom" />
import { expect, type Locator, type Page } from '@playwright/test';

type Until = {
  /** Walk until it stops showing instead. */
  gone?: boolean;
  timeout?: number;
};

/**
 * Walks with `keys` held until `until` shows (or, with `gone`, stops showing), then lets go. A walk ends where its
 * prompt appears, however fast or slow the scene runs, never after a fixed time.
 *
 * Text is looked for on the page every frame, and the keys are let go in that same frame, so the Character stops
 * within a frame's step of where it showed. The walk returns once it has stayed so for a few frames, walking on if it
 * flickers. A locator is waited on like any assertion, which can take a few frames longer: use one only where a few
 * more steps don't matter, such as an NPC who holds the Character still.
 */
export async function walkUntil(page: Page, keys: string | readonly string[], until: string | Locator, { gone = false, timeout = 5_000 }: Until = {}) {
  const held = typeof keys === 'string' ? [keys] : [...keys];
  for (const key of held) await page.keyboard.down(key);
  try {
    if (typeof until !== 'string') await (gone ? expect(until).toBeHidden({ timeout }) : expect(until).toBeVisible({ timeout }));
    else await letGoWhen(page, held, until, gone, timeout);
  } finally {
    for (const key of [...held].reverse()) await page.keyboard.up(key);
  }
}

/**
 * How many frames `text` must stay as wanted once the keys are let go, for a walk to end. A flicker shows the frame
 * after letting go (every one logged while fixing this did); 5 leaves room for a frame the page draws late.
 */
const SETTLE_FRAMES = 5;

type WalkOutcome = 'settled' | 'never' | 'flickering';

/**
 * Waits, frame by frame, for `text` to show (or go), and lets go of `held` in the frame it does. Text matches as
 * `getByText` matches it: ignoring case, with runs of whitespace as one space.
 *
 * A prompt can flicker: it follows where the Character is asked to go, and a frame with no physics step drops that,
 * so the Character stops a step short and the prompt goes again (or, walking away, comes back). So the walk ends only
 * once `text` has stayed as wanted for a few frames, and if it flickers the keys are held again.
 */
async function letGoWhen(page: Page, held: string[], text: string, gone: boolean, timeout: number) {
  const normalise = (s: string) => s.replace(/\s+/g, ' ').toLowerCase();
  const outcome = await page.evaluate(
    ({ wanted, gone, held, timeout, settleFrames }) =>
      new Promise<WalkOutcome>((resolve) => {
        // The scene reads the walk keys from window events: a key let go here stops the Character this frame.
        const sendHeld = (type: 'keydown' | 'keyup') => held.forEach((code) => window.dispatchEvent(new KeyboardEvent(type, { code })));
        // Frames since the keys were let go, with `text` as wanted all along; 0 while walking.
        let framesSettled = 0;
        let seen = false;
        let done = false;
        const end = (outcome: WalkOutcome) => {
          done = true;
          clearTimeout(timer);
          resolve(outcome);
        };
        // On a timer, not checked each frame, so the walk still fails on time if frames stall.
        const timer = setTimeout(() => end(seen ? 'flickering' : 'never'), timeout);
        const frame = () => {
          if (done) return;
          // As `normalise` does: this runs in the page, out of its reach.
          const wantedNow = document.body.innerText.replace(/\s+/g, ' ').toLowerCase().includes(wanted) !== gone;
          if (wantedNow && framesSettled === 0) sendHeld('keyup');
          if (!wantedNow && framesSettled > 0) sendHeld('keydown');
          framesSettled = wantedNow ? framesSettled + 1 : 0;
          seen ||= wantedNow;
          if (framesSettled > settleFrames) end('settled');
          else requestAnimationFrame(frame);
        };
        frame();
      }),
    { wanted: normalise(text), gone, held, timeout, settleFrames: SETTLE_FRAMES },
  );
  const walked = `With ${held.join('+')} held for ${timeout}ms, “${text}”`;
  if (outcome === 'never') throw new Error(`${walked} never ${gone ? 'went' : 'showed'}`);
  if (outcome === 'flickering') throw new Error(`${walked} ${gone ? 'went' : 'showed'} but kept flickering`);
}

/**
 * On a tram platform, a step aside from the middle of it, where the stop's pole stands: off its edge (`prompt`, which
 * shows anywhere on the platform, goes) and back on (it comes back). Walking along the platform then passes the pole
 * rather than walking into it.
 */
export async function stepAsideOnThePlatform(page: Page, prompt: string) {
  // From where it shows: a new game can start before the scene has put the Character on the platform.
  await expect(page.getByText(prompt)).toBeVisible();
  await walkUntil(page, 'KeyS', prompt, { gone: true });
  await walkUntil(page, 'KeyW', prompt);
}
