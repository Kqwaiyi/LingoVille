import { expect, test, type Page } from './test.ts';
import { PLACE_LINE } from '../src/sim/index.ts';
import { startNewGame } from './title.ts';
import { walkUntil } from './walk.ts';

const placeLine = (page: Page) => page.getByRole('status', { name: 'Place' });

test('the place line above the dock shows the café, its hours and that it is open', async ({ page }) => {
  // `?spawn=cafe` puts the Character just inside the café door.
  await startNewGame(page, { path: '/?spawn=cafe&at=9', target: 'de' });
  await expect(placeLine(page)).toContainText('Café Stern · 08:00–18:00 · Closed: Sunday');
  await expect(placeLine(page)).toContainText('Open now');
});

test('the place line fades away a few seconds after arriving, and shows again on arriving somewhere else', async ({ page }) => {
  await startNewGame(page, { path: '/?spawn=bookshop&at=10' });
  await expect(placeLine(page)).toContainText('Bookshop');
  await expect(placeLine(page)).toHaveCSS('opacity', '1');

  await expect(placeLine(page)).toHaveCSS('opacity', '0', { timeout: PLACE_LINE.shownMs + 5_000 });

  // Back out through the door, across the pavement and onto the Old Town platform.
  await page.locator('canvas').click();
  await walkUntil(page, 'KeyS', 'Tram stop');
  await expect(placeLine(page)).toHaveCSS('opacity', '1');
});

test('a closed café can’t be entered, and its barista can’t be talked to', async ({ page }) => {
  // 07:00 in the de pack, and the café opens at 08:00: the Character is still at home as far as the game knows.
  await startNewGame(page, { path: '/?spawn=cafe', target: 'de' });
  await page.locator('canvas').click();
  // Nothing shows to say the Character got no further, so this walk is timed: 1.5 real seconds at the walk speed takes
  // the Character from the door to the counter, past where an open café's barista would be in reach.
  await page.keyboard.down('KeyW');
  await page.waitForTimeout(1_500);
  await page.keyboard.up('KeyW');

  await expect(placeLine(page)).toHaveText('Home');
  await expect(page.getByText('to talk — barista')).toBeHidden();
});
