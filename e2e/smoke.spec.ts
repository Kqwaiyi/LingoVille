/// <reference lib="dom" />
import { expect, test, type Page } from './test.ts';
import { dock } from './barista.ts';
import { startNewGame, titleMenu } from './title.ts';
import { walkUntil } from './walk.ts';

test('the game page loads and reaches the gateway in mock mode', async ({ page }) => {
  await startNewGame(page);

  await expect(page.getByRole('status').filter({ hasText: 'Gateway' })).toHaveText('Gateway reachable (mock mode)');
});

type Watched = Window & { offeredTitleOrSetup?: boolean };

/**
 * Loads `path`, noting from the page's first frame whether the title menu's New game or setup's Next ever shows, and
 * walks up to the barista. Answers whether either showed.
 */
async function toTheBaristaWatchingForSetup(page: Page, path: string) {
  await page.addInitScript(() => {
    const w = window as Watched;
    w.offeredTitleOrSetup = false;
    new MutationObserver(() => {
      w.offeredTitleOrSetup ||= [...document.querySelectorAll('button')].some((b) => ['New game', 'Next'].includes(b.textContent?.trim() ?? ''));
    }).observe(document, { childList: true, subtree: true });
  });
  await page.goto(path);
  await expect(dock(page)).toBeVisible();
  await page.locator('canvas').click();
  await walkUntil(page, 'KeyW', 'to talk — barista');
  return page.evaluate(() => (window as Watched).offeredTitleOrSetup);
}

test('?newGame starts a ready-made game at the place and hour asked, with no title screen or setup', async ({ page }) => {
  expect(await toTheBaristaWatchingForSetup(page, '/?newGame&spawn=cafe&at=9')).toBe(false);
  await expect(dock(page).getByLabel('Time')).toHaveText(/^09:0\d$/);
  await expect(dock(page).getByLabel('Money')).toHaveText(/^¥[\d,]+$/);

  // The shortcut came off the URL: a reload offers the title screen, with the new game to Continue.
  await page.reload();
  await expect(titleMenu(page).getByRole('button', { name: 'Continue' })).toBeVisible();
});

test('?newGame=de starts the game learning German, in the German town', async ({ page }) => {
  expect(await toTheBaristaWatchingForSetup(page, '/?newGame=de&spawn=cafe&at=9')).toBe(false);
  await expect(dock(page).getByLabel('Money')).toHaveText('100 €');
});
