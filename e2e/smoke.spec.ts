/// <reference lib="dom" />
import { expect, test, type Page } from './test.ts';
import { column, dock, GREETING, npcLine, typeLine } from './barista.ts';
import { refuseTheMic, reloadAndContinue, startNewGame, titleMenu } from './title.ts';
import { walkUntil } from './walk.ts';

test('the game page loads and reaches the gateway in mock mode', async ({ page }) => {
  await startNewGame(page);

  await expect(page.getByRole('status').filter({ hasText: 'Gateway' })).toHaveText('Gateway reachable (mock mode)');
});

const banner = (page: Page) => page.getByRole('region', { name: 'First Morning' });
const money = (page: Page) => dock(page).getByLabel('Money');
const journalEntries = (page: Page) => page.getByRole('dialog', { name: 'Journal' }).getByRole('navigation', { name: 'Journal entries' }).getByRole('button');
// What the gateway's canned Recap says in mock mode.
const RECAP_OUTCOME = 'You ordered a hot latte and paid. Nicely done!';

test('the first session: setup, the First Morning’s café order typed, its Recap in the Journal, and Continue', async ({ page }) => {
  // This browser has no mic, so the First Morning teaches the Typed Fallback. At the café door, to skip the walk there.
  await refuseTheMic(page);
  await startNewGame(page, { path: '/?spawn=cafe', throughScreens: true });

  // The First Morning is under way. Starting in the café's doorway counts as walking there, so it skips ahead to breakfast.
  await expect(banner(page)).toContainText('Order breakfast from the barista at the counter');
  await page.locator('canvas').click();
  await walkUntil(page, 'KeyW', 'to talk — barista');
  await page.keyboard.press('KeyE');
  await expect(npcLine(page, GREETING)).toBeVisible();
  await expect(banner(page)).toBeHidden();

  // The order, typed: the column says how, and the mic is off.
  await expect(column(page).getByRole('note')).toHaveText('Order breakfast: press T, type what you’d like and press Enter');
  await expect(column(page).getByText('🎤 off')).toBeVisible();
  await expect(column(page).getByRole('button', { name: 'Hold to talk (Space)' })).toBeHidden();
  await typeLine(page, 'ホットラテ ください');
  await expect(npcLine(page, 'ホットラテですね。450円です。よろしいですか？')).toBeVisible();
  // Nothing is served or charged before the Player confirms.
  await expect(money(page)).toHaveText('¥10,000');
  await typeLine(page, 'はい');
  const closingCard = column(page).getByRole('region', { name: 'Conversation over' });
  await expect(closingCard.getByText('Hot latte · −¥450 · Mood ↑')).toBeVisible();
  await expect(money(page)).toHaveText('¥9,550');

  // Its Recap, kept in the Journal.
  await closingCard.getByRole('button', { name: 'See Recap' }).click();
  const recap = column(page).getByRole('region', { name: 'Recap' });
  await expect(recap.getByText(RECAP_OUTCOME)).toBeVisible();
  await recap.getByRole('button', { name: 'Done' }).click();
  await expect(column(page)).toBeHidden();

  // The First Morning ends with what matters next.
  const morningCard = page.getByRole('region', { name: 'Your first morning is done!' });
  await expect(morningCard.getByText('You have ¥9,550')).toBeVisible();
  await expect(morningCard.getByText('Rent is due on day 7')).toBeVisible();
  await expect(morningCard.getByText(/^3 places are hiring: Café, Supermarket, and Restaurant./)).toBeVisible();
  await morningCard.getByRole('button', { name: 'Got it' }).click();
  await expect(morningCard).toBeHidden();

  await page.keyboard.press('KeyJ');
  await expect(journalEntries(page)).toHaveCount(1);
  await expect(page.getByRole('dialog', { name: 'Journal' }).getByText(RECAP_OUTCOME)).toBeVisible();
  await page.keyboard.press('Escape');

  // Continue lands where the session left off: the money, the Journal, the First Morning over, at the café.
  await reloadAndContinue(page);
  await expect(money(page)).toHaveText('¥9,550');
  await expect(banner(page)).toBeHidden();
  await expect(morningCard).toBeHidden();
  await page.keyboard.press('KeyJ');
  await expect(journalEntries(page)).toHaveCount(1);
  await page.keyboard.press('Escape');
  // Back at the café's entrance: a few steps forward reach the barista.
  await page.locator('canvas').click();
  await walkUntil(page, 'KeyW', 'to talk — barista');
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
