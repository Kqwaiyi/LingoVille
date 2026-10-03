import { expect, test } from '@playwright/test';

test('the game page loads and reaches the gateway in mock mode', async ({ page }) => {
  await page.goto('/');

  await expect(page.getByRole('status')).toHaveText('Gateway reachable (mock mode)');
});
