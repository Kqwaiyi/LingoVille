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
 * within a frame's step of where it showed. A locator is waited on like any assertion, which can take a few frames
 * longer: use one only where a few more steps don't matter, such as an NPC who holds the Character still.
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
 * Waits, frame by frame, for `text` to show (or go), and lets go of `held` in the frame it does. Text matches as
 * `getByText` matches it: ignoring case, with runs of whitespace as one space.
 */
async function letGoWhen(page: Page, held: string[], text: string, gone: boolean, timeout: number) {
  const normalise = (s: string) => s.replace(/\s+/g, ' ').toLowerCase();
  try {
    await page.waitForFunction(
      ({ wanted, gone, held }) => {
        // As `normalise` does: this runs in the page, out of its reach.
        const shown = document.body.innerText.replace(/\s+/g, ' ').toLowerCase();
        if (shown.includes(wanted) === gone) return false;
        // The scene reads the walk keys from window events: a key let go here stops the Character this frame.
        for (const code of held) window.dispatchEvent(new KeyboardEvent('keyup', { code }));
        return true;
      },
      { wanted: normalise(text), gone, held },
      { polling: 'raf', timeout },
    );
  } catch (error) {
    throw new Error(`With ${held.join('+')} held for ${timeout}ms, “${text}” never ${gone ? 'went' : 'showed'}`, { cause: error });
  }
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
