import { expect, test, type Page } from '@playwright/test';
import { startNewGame } from './title.ts';

const placeLine = (page: Page) => page.getByRole('status', { name: 'Place' });

test('the place line above the dock shows the café, its hours and that it is open', async ({ page }) => {
  // `?spawn=cafe` puts the Character just inside the café door.
  await startNewGame(page, { path: '/?spawn=cafe&at=9', target: 'de' });
  await expect(placeLine(page)).toContainText('Café Stern · 08:00–18:00 · Closed: Sunday');
  await expect(placeLine(page)).toContainText('Open now');
});

test('a closed café can’t be entered, and its barista can’t be talked to', async ({ page }) => {
  // 07:00 in the de pack, and the café opens at 08:00: the Character is still at home as far as the game knows.
  await startNewGame(page, { path: '/?spawn=cafe', target: 'de' });
  await page.locator('canvas').click();
  await page.keyboard.down('KeyW');
  await page.waitForTimeout(1_500);
  await page.keyboard.up('KeyW');

  await expect(placeLine(page)).toHaveText('Home');
  await expect(page.getByText('to talk — barista')).toBeHidden();
});
