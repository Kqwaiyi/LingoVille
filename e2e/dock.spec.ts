/// <reference lib="dom" />
import { expect, test, type Page } from './test.ts';
import { startNewGame } from './title.ts';

const dock = (page: Page) => page.getByRole('region', { name: 'Dock' });

async function hideTab(page: Page) {
  await page.evaluate(() => {
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' });
    document.dispatchEvent(new Event('visibilitychange'));
  });
}

test('the dock shows Well-being, Mood, the clock and money on the First Morning', async ({ page }) => {
  await startNewGame(page);

  for (const meter of ['Health', 'Hunger', 'Thirst', 'Mood']) {
    await expect(dock(page).getByRole('meter', { name: meter })).toBeVisible();
  }
  await expect(dock(page).getByRole('meter', { name: 'Health' })).toHaveAttribute('aria-valuenow', '100');
  await expect(dock(page).getByText('Day 1 · Monday')).toBeVisible();
  await expect(dock(page).getByLabel('Time')).toHaveText(/^07:0\d$/);
  await expect(dock(page).getByLabel('Money')).toHaveText(/^¥[\d,]+$/);
});

test('the clock runs at one game minute per real second and stops while the tab is hidden', async ({ page }) => {
  await startNewGame(page);
  const time = dock(page).getByLabel('Time');

  // The clock starts once the scene has booted, which is slow with parallel workers.
  await expect(time).not.toHaveText('07:00', { timeout: 15_000 });

  await hideTab(page);
  const frozen = await time.textContent();
  await page.waitForTimeout(2_500);
  await expect(time).toHaveText(frozen!);
});

test('walking to the tap at home and pressing E refills Thirst for free', async ({ page }) => {
  await startNewGame(page);
  const thirst = dock(page).getByRole('meter', { name: 'Thirst' });
  const money = dock(page).getByLabel('Money');
  await expect(thirst).toHaveAttribute('aria-valuenow', /^\d+$/);
  const moneyBefore = await money.textContent();

  // The Character starts facing the tap; walk forward until it is in reach.
  await page.locator('canvas').click();
  await page.keyboard.down('KeyW');
  await expect(page.getByText('to drink tap water')).toBeVisible({ timeout: 5_000 });
  await page.keyboard.up('KeyW');

  await page.keyboard.press('KeyE');
  await expect(thirst).toHaveAttribute('aria-valuenow', '100');
  await expect(money).toHaveText(moneyBefore!);
});

test('an ill Character shows how they feel above the dock, without naming the Illness', async ({ page }) => {
  await startNewGame(page, { path: '/?ill=flu' });

  const unwell = page.getByRole('status', { name: 'Feeling unwell' });
  await expect(unwell).toHaveText(/a fever, aches all over,? and chills/);
  await expect(unwell).not.toContainText(/flu/i);
});

test('a well Character shows no such line', async ({ page }) => {
  await startNewGame(page);
  await expect(dock(page)).toBeVisible();
  await expect(page.getByRole('status', { name: 'Feeling unwell' })).toHaveCount(0);
});
