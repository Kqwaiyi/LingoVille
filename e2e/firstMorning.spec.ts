import { expect, test, type Page } from './test.ts';
import { reloadAndContinue, startNewGame } from './title.ts';
import { walkUntil } from './walk.ts';

const banner = (page: Page) => page.getByRole('region', { name: 'First Morning' });
const pauseMenu = (page: Page) => page.getByRole('dialog', { name: 'Paused' });

test('the First Morning banner leads to the tap and then the café, and carries on after Continue', async ({ page }) => {
  await startNewGame(page);

  // At the top, with how far the tap is: the Character starts facing it, a few steps away.
  await expect(banner(page)).toContainText("You're thirsty. Walk to the sink (W A S D) and drink some water");
  await expect(banner(page).getByText(/^\d+ m$/)).toBeVisible();

  await page.locator('canvas').click();
  await walkUntil(page, 'KeyW', 'to drink tap water');
  await page.keyboard.press('KeyE');
  await expect(banner(page)).toContainText('Get breakfast at the café');
  // The café is down the street, further than the tap was.
  await expect(banner(page).getByText(/^\d\d+ m$/)).toBeVisible();

  // Drinking saved the step: Continue picks it up there.
  await reloadAndContinue(page);
  await expect(banner(page)).toContainText('Get breakfast at the café');
});

test('Skip tutorial in the pause menu ends the First Morning for good', async ({ page }) => {
  await startNewGame(page);
  await expect(banner(page)).toBeVisible();

  await page.keyboard.press('Escape');
  await expect(banner(page)).toBeHidden();
  await pauseMenu(page).getByRole('button', { name: 'Skip the tutorial' }).click();
  await expect(pauseMenu(page)).toBeHidden();
  await expect(banner(page)).toBeHidden();

  // Nothing to skip any more.
  await page.keyboard.press('Escape');
  await expect(pauseMenu(page).getByRole('button', { name: 'Resume' })).toBeVisible();
  await expect(pauseMenu(page).getByRole('button', { name: 'Skip the tutorial' })).toHaveCount(0);

  await reloadAndContinue(page);
  await expect(page.getByRole('region', { name: 'Dock' })).toBeVisible();
  await expect(banner(page)).toBeHidden();
});

test('Skip the tutorial at setup starts the game with no First Morning', async ({ page }) => {
  await startNewGame(page, { skipTutorial: true });

  await expect(page.getByRole('region', { name: 'Dock' })).toBeVisible();
  await expect(banner(page)).toBeHidden();
});
