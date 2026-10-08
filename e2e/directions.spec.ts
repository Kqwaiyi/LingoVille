import { expect, test, type Page } from './test.ts';
import { column, npcLine, typeLine } from './barista.ts';
import { startNewGame } from './title.ts';

const closingCard = (page: Page) => column(page).getByRole('region', { name: 'Conversation over' });
const tramChoice = (page: Page) => page.getByRole('dialog', { name: 'Take the tram to…' });

test('asks a passer-by which tram goes to the supermarket, and the stop is marked on the tram map', async ({ page }) => {
  // `?spawn=tram-stop` puts the Character on the Old Town platform, west of the passer-by waiting there.
  await startNewGame(page, { path: '/?spawn=tram-stop&at=9' });
  await page.locator('canvas').click();
  // A small step to the side first, so the Character slides round the stop's pole and walks into the passer-by rather
  // than past them. A longer step can take it off the platform, where no one at the stop is in reach.
  await page.keyboard.down('KeyS');
  await page.waitForTimeout(50);
  await page.keyboard.up('KeyS');
  await page.keyboard.down('KeyD');
  await expect(page.getByText('to ask the way — passer-by')).toBeVisible({ timeout: 5_000 });
  await page.keyboard.up('KeyD');
  await expect(page.getByText('Press T to chat')).toBeHidden();

  await page.keyboard.press('KeyE');
  await expect(npcLine(page, 'はい？どうしましたか？')).toBeVisible();
  await typeLine(page, 'スーパーに行きたいです');
  await expect(npcLine(page, '市場通りで降りてください。わかりましたか？')).toBeVisible();
  await typeLine(page, 'はい');

  await expect(closingCard(page).getByText('Get off at Market Street: marked on the tram map · Mood ↑')).toBeVisible();
  await closingCard(page).getByRole('button', { name: 'Skip Recap' }).click();
  await expect(column(page)).toBeHidden();

  // Back along the platform to the pole, out of the passer-by's reach.
  await page.keyboard.down('KeyA');
  await expect(page.getByText('to take the tram')).toBeVisible({ timeout: 5_000 });
  await page.keyboard.up('KeyA');
  await page.keyboard.press('KeyE');
  await expect(tramChoice(page).getByRole('button', { name: /Market Street/ })).toContainText('Get off here');
  await expect(tramChoice(page).getByRole('button', { name: /Town Centre/ })).not.toContainText('Get off here');
});
