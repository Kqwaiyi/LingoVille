import { expect, test, type Page } from './test.ts';
import { PROFICIENCY_STEP_TABLE } from '../src/sim/index.ts';
import { column, field, npcLine, talkToTheBarista, typeLine } from './barista.ts';
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

test('the First Morning café order can’t fail, and points to Help without opening it', async ({ page }) => {
  await talkToTheBarista(page);
  const nudge = column(page).getByText('Stuck? Try Help');
  const helpTab = column(page).getByRole('tab', { name: 'Help' });
  // With a mic, the order is spoken: hold Space.
  await expect(column(page).getByRole('note')).toHaveText('Order breakfast: hold Space, say what you’d like, then let go');
  await expect(nudge).toBeHidden();

  // More turns the barista can't make sense of than they'd put up with anywhere else (the dev save is at A1).
  const turns = PROFICIENCY_STEP_TABLE.A1.startingPatience + 1;
  for (let turn = 1; turn <= turns; turn++) {
    await typeLine(page, 'asdf');
    await expect(npcLine(page, 'すみません、よくわかりませんでした。')).toHaveCount(turn);
  }
  // The barista hasn't given up: the order goes on.
  await expect(column(page).getByRole('region', { name: 'Conversation over' })).toHaveCount(0);
  await expect(field(page)).toBeEditable();
  await expect(nudge).toBeVisible();
  await expect(helpTab).toHaveAttribute('aria-selected', 'false');

  // Once found, Help stops pointing. (The typed field has focus, so H would type: the Player clicks the tab.)
  await helpTab.click();
  await expect(helpTab).toHaveAttribute('aria-selected', 'true');
  await expect(nudge).toBeHidden();
  await column(page).getByRole('tab', { name: 'Chat' }).click();
  await expect(nudge).toBeHidden();
});
