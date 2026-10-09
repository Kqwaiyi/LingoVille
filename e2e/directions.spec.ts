import { expect, test, type Page } from './test.ts';
import { column, npcLine, typeLine } from './barista.ts';
import { startNewGame } from './title.ts';
import { stepAsideOnThePlatform, walkUntil } from './walk.ts';

const closingCard = (page: Page) => column(page).getByRole('region', { name: 'Conversation over' });
const tramChoice = (page: Page) => page.getByRole('dialog', { name: 'Take the tram to…' });

test('asks a passer-by which tram goes to the supermarket, and the stop is marked on the tram map', async ({ page }) => {
  // `?spawn=tram-stop` puts the Character on the Old Town platform, west of the passer-by waiting there.
  await startNewGame(page, { path: '/?spawn=tram-stop&at=9' });
  await page.locator('canvas').click();
  // A step aside first, so the Character walks past the stop's pole, which stands between them and the passer-by.
  await stepAsideOnThePlatform(page, 'to take the tram');
  await walkUntil(page, 'KeyD', 'to ask the way — passer-by');
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
  await walkUntil(page, 'KeyA', 'to take the tram');
  await page.keyboard.press('KeyE');
  await expect(tramChoice(page).getByRole('button', { name: /Market Street/ })).toContainText('Get off here');
  await expect(tramChoice(page).getByRole('button', { name: /Town Centre/ })).not.toContainText('Get off here');
});
