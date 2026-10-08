import { expect, test, type Page } from './test.ts';
import { dock } from './barista.ts';
import { reloadAndContinue, startNewGame } from './title.ts';

/** Starts a new game at home at `hour`, then reloads and continues it: a save made at home wakes up in bed. */
async function inBedAt(page: Page, hour: number) {
  await startNewGame(page, { path: `/?at=${hour}` });
  // A new game saves at once.
  await expect(dock(page).getByText('Saved ✓')).toBeVisible();
  await reloadAndContinue(page);
  // Without a step, the bed is in reach.
  await expect(page.getByText('to go to bed')).toBeVisible({ timeout: 10_000 });
  await page.locator('canvas').click();
}

test('the Mood gauge shows a face', async ({ page }) => {
  await startNewGame(page);
  // Neutral Mood on the First Morning.
  await expect(dock(page).getByRole('meter', { name: 'Mood' })).toContainText('😐');
});

test('back from a save at home the Character is in bed, and before 20:00 the bed says it is too early', async ({ page }) => {
  await inBedAt(page, 15);

  await page.keyboard.press('KeyE');

  await expect(page.getByText('It’s too early for bed. You can sleep from 20:00.')).toBeVisible();
  await expect(dock(page).getByText('Day 1 · Monday')).toBeVisible();
});

test('from 20:00 the bed wakes the Character at 07:00 the next morning, and the new day is saved', async ({ page }) => {
  await inBedAt(page, 21);

  await page.keyboard.press('KeyE');

  await expect(dock(page).getByText('Day 2 · Tuesday')).toBeVisible();
  await expect(dock(page).getByLabel('Time')).toHaveText(/^07:0\d$/);
  await expect(dock(page).getByText('Saved ✓')).toBeVisible();

  await reloadAndContinue(page);
  await expect(dock(page).getByText('Day 2 · Tuesday')).toBeVisible();
});
