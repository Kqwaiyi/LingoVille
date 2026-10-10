import { expect, test, type Page } from './test.ts';
import { column, dock, talkToTheBarista } from './barista.ts';
import { startNewGame, titleMenu } from './title.ts';

const pauseMenu = (page: Page, name = 'Paused') => page.getByRole('dialog', { name });

async function openTitleSettings(page: Page) {
  await page.goto('/');
  await titleMenu(page).getByRole('button', { name: 'Settings' }).click();
  await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible();
}

/** From now on the browser refuses the mic until `window.micBack` is set, as if the Player had said no and later fixed it. */
async function refuseTheMicForNow(page: Page) {
  await page.addInitScript(() => {
    const open = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
    navigator.mediaDevices.getUserMedia = (constraints) =>
      (window as { micBack?: boolean }).micBack ? open(constraints) : Promise.reject(new DOMException('Permission denied', 'NotAllowedError'));
  });
}

test('Esc opens the pause menu, and the clock stands still until Resume', async ({ page }) => {
  await startNewGame(page);
  const time = dock(page).getByLabel('Time');
  // The clock starts once the scene has booted, which is slow with parallel workers.
  await expect(time).not.toHaveText('07:00', { timeout: 15_000 });

  await page.keyboard.press('Escape');
  await expect(pauseMenu(page).getByRole('button', { name: 'Resume' })).toBeFocused();
  await expect(pauseMenu(page).getByRole('button', { name: 'Settings' })).toBeVisible();
  const frozen = await time.textContent();
  // Real time passing: 2.5 real seconds would move a running clock on.
  await page.waitForTimeout(2_500);
  await expect(time).toHaveText(frozen!);

  await pauseMenu(page).getByRole('button', { name: 'Resume' }).click();
  await expect(pauseMenu(page)).toBeHidden();
  await expect(time).not.toHaveText(frozen!);
});

test('Settings in the pause menu switch the UI to another Native Language at once, and open the credits', async ({ page }) => {
  await startNewGame(page);
  await page.keyboard.press('Escape');
  await pauseMenu(page).getByRole('button', { name: 'Settings' }).click();

  await pauseMenu(page).getByRole('combobox', { name: /Your language/ }).selectOption('de');
  await expect(pauseMenu(page, 'Pause').getByRole('heading', { name: 'Einstellungen' })).toBeVisible();
  await expect(page.getByText('Tag 1 · Montag')).toBeVisible();
  // Not the language this save is learning.
  await expect(pauseMenu(page, 'Pause').getByRole('option', { name: '日本語' })).toHaveAttribute('disabled');

  await pauseMenu(page, 'Pause').getByRole('button', { name: 'Mitwirkende' }).click();
  await expect(pauseMenu(page, 'Pause').getByText('Noch nichts unter CC BY.')).toBeVisible();
  await expect(pauseMenu(page, 'Pause').getByRole('link', { name: 'Building Kit' })).toHaveAttribute('href', 'https://kenney.nl/assets/building-kit');

  // Esc steps back to Settings, then to the menu, then resumes.
  await page.keyboard.press('Escape');
  await expect(pauseMenu(page, 'Pause').getByRole('heading', { name: 'Einstellungen' })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(pauseMenu(page, 'Pause').getByRole('button', { name: 'Weiterspielen' })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(pauseMenu(page, 'Pause')).toBeHidden();
});

test('Esc in a conversation leaves it, and doesn’t pause', async ({ page }) => {
  await talkToTheBarista(page);

  await page.keyboard.press('Escape');

  await expect(column(page)).toBeHidden();
  await expect(pauseMenu(page)).toBeHidden();
});

test('every device setting is kept for this browser', async ({ page }) => {
  await openTitleSettings(page);
  await page.getByRole('slider', { name: 'Music' }).fill('25');
  await page.getByRole('radio', { name: 'Type my replies' }).check();
  await page.getByRole('radio', { name: /Open mic/ }).check();
  await page.getByRole('checkbox', { name: /Tooltips/ }).uncheck();

  // Another tab of the same browser, which reads them as it opens. The settings are written in the background, so it
  // opens again until the last of them is written; a reload of this tab could stop that write.
  const again = await page.context().newPage();
  await expect(async () => {
    await openTitleSettings(again);
    await expect(again.getByRole('slider', { name: 'Music' })).toHaveValue('25', { timeout: 1_000 });
    await expect(again.getByRole('radio', { name: 'Type my replies' })).toBeChecked({ timeout: 1_000 });
    await expect(again.getByRole('radio', { name: /Open mic/ })).toBeChecked({ timeout: 1_000 });
    await expect(again.getByRole('checkbox', { name: /Tooltips/ })).not.toBeChecked({ timeout: 1_000 });
  }).toPass({ timeout: 15_000 });
});

test('Retry microphone switches from the Typed Fallback back to Speaking once the mic works', async ({ page }) => {
  await refuseTheMicForNow(page);
  await openTitleSettings(page);
  await page.getByRole('radio', { name: 'Type my replies' }).check();

  await page.getByRole('button', { name: 'Retry microphone' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Still no mic' })).toBeVisible();
  await expect(page.getByRole('radio', { name: 'Type my replies' })).toBeChecked();

  await page.evaluate(() => ((window as { micBack?: boolean }).micBack = true));
  await page.getByRole('button', { name: 'Retry microphone' }).click();
  await expect(page.getByRole('radio', { name: 'Speak with the mic' })).toBeChecked();
  await expect(page.getByRole('button', { name: 'Retry microphone' })).toBeHidden();
});

test('in the Typed Fallback, the day’s first conversation says the mic can be turned on in Settings', async ({ page }) => {
  await expect(async () => {
    await openTitleSettings(page);
    await page.getByRole('radio', { name: 'Type my replies' }).check();
    await openTitleSettings(page);
    await expect(page.getByRole('radio', { name: 'Type my replies' })).toBeChecked({ timeout: 1_000 });
  }).toPass({ timeout: 15_000 });

  await talkToTheBarista(page);

  await expect(column(page).getByText('🎤 off. Enable in Settings')).toBeVisible();
  await expect(column(page).getByRole('button', { name: 'Hold to talk (Space)' })).toBeHidden();
});
