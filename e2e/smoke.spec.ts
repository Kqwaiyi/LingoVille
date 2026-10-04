import { expect, test } from '@playwright/test';
import { startNewGame } from './title.ts';

test('the game page loads and reaches the gateway in mock mode', async ({ page }) => {
  await startNewGame(page);

  await expect(page.getByRole('status').filter({ hasText: 'Gateway' })).toHaveText('Gateway reachable (mock mode)');
});
