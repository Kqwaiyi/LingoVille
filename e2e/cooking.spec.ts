import { expect, test } from '@playwright/test';
import { dock } from './barista.ts';
import { startNewGame } from './title.ts';

test('the skills page shows all five Life Skills as stars, starting at none', async ({ page }) => {
  await startNewGame(page);

  await dock(page).getByRole('button', { name: 'Skills' }).click();

  const skills = page.getByRole('region', { name: 'Skills' });
  for (const skill of ['Cooking', 'Fitness', 'Barista', 'Cashier', 'Server']) {
    await expect(skills.getByRole('listitem').filter({ hasText: skill })).toContainText('☆☆☆☆☆');
  }
  await expect(skills.getByRole('img', { name: 'Level 0 of 5' })).toHaveCount(5);
});

test('the stove at home says there is nothing to cook without groceries', async ({ page }) => {
  await startNewGame(page);

  // The Character starts facing the tap; the stove is along the same wall, ahead and to the right.
  await page.locator('canvas').click();
  await page.keyboard.down('KeyW');
  await page.keyboard.down('KeyD');
  await expect(page.getByText('to cook a meal')).toBeVisible({ timeout: 5_000 });
  await page.keyboard.up('KeyD');
  await page.keyboard.up('KeyW');

  await page.keyboard.press('KeyE');
  await expect(page.getByText('Nothing to cook.', { exact: false })).toBeVisible();
});
