/// <reference lib="dom" />
import { expect, test, type Locator, type Page } from '@playwright/test';
import { languageChoice, startNewGame, titleMenu } from './title.ts';

const heading = (page: Page, name: string) => page.getByRole('heading', { name });
const button = (page: Page, name: string) => page.getByRole('button', { name, exact: true });

/** The visible things in the setup panel that stick out of it, or whose text runs out of its own box. */
function overflowing(panel: Locator) {
  return panel.evaluate((root) => {
    const box = root.getBoundingClientRect();
    return [...root.querySelectorAll<HTMLElement>('*')]
      .filter((element) => {
        const rect = element.getBoundingClientRect();
        // A visually hidden legend is clipped on purpose.
        if (rect.width === 0 || rect.height === 0 || element.closest('.visually-hidden')) return false;
        return rect.left < box.left - 1 || rect.right > box.right + 1 || (element.clientWidth > 0 && element.scrollWidth > element.clientWidth + 1);
      })
      .map((element) => `<${element.tagName.toLowerCase()}> ${element.textContent?.trim().slice(0, 40)}`);
  });
}

test('through the setup screens into the town, as the Character the Player described', async ({ page }) => {
  await page.goto('/');
  await titleMenu(page).getByRole('button', { name: 'New game' }).click();
  await button(page, 'Next').click();

  // Screen 2: only the three languages that aren't English, each naming where its town is.
  await expect(heading(page, 'Which language do you want to learn?')).toBeVisible();
  await expect(page.getByRole('radio')).toHaveCount(3);
  await expect(page.getByRole('radio', { name: '日本語 Japanese: set in a Japanese town' })).toBeVisible();
  await expect(page.getByRole('radio', { name: '中文 Chinese: set in a Chinese town' })).toBeVisible();
  await expect(page.getByRole('radio', { name: 'Deutsch German: set in a German town' })).toBeVisible();
  await expect(button(page, 'Next')).toBeDisabled();
  await languageChoice(page, 'de').check();
  await button(page, 'Next').click();

  // Screen 3: a plain sentence for the Player's level, and the Character's name.
  await expect(heading(page, 'How much German do you know?')).toBeVisible();
  await expect(page.getByRole('radio')).toHaveCount(4);
  await expect(button(page, 'Next')).toBeDisabled();
  await page.getByRole('radio', { name: 'I can get by in most everyday situations.' }).check();
  await page.getByRole('textbox', { name: 'Your character’s name' }).fill('Mika');
  await button(page, 'Next').click();

  // Screen 4: an Appearance Preset, part by part, starting from the default look. The Character beside the panel wears it.
  await expect(heading(page, 'How does Mika look?')).toBeVisible();
  const part = (name: string) => page.getByRole('group', { name, exact: true });
  await expect(part('Build and face').getByRole('radio')).toHaveCount(4);
  await expect(part('Build and face').getByRole('radio', { name: 'Look 1' })).toBeChecked();
  await expect(part('Hair').getByRole('radio')).toHaveCount(6);
  await expect(part('Hair').getByRole('radio', { name: 'Short', exact: true })).toBeChecked();
  await expect(part('Hair colour').getByRole('radio', { name: 'Dark brown' })).toBeChecked();
  await expect(part('Skin tone').getByRole('radio')).toHaveCount(6);
  await expect(part('Skin tone').getByRole('radio', { name: 'Skin tone 3' })).toBeChecked();
  await page.getByRole('radio', { name: 'Look 3' }).check();
  await page.getByRole('radio', { name: 'Buns' }).check();
  await page.getByRole('radio', { name: 'Auburn' }).check();
  await page.getByRole('radio', { name: 'Skin tone 5' }).check();
  await expect(page.getByRole('radio', { name: 'Look 1' })).not.toBeChecked();
  await expect(page.getByRole('radio', { name: 'Skin tone 3' })).not.toBeChecked();
  await button(page, 'Next').click();

  // Screen 5: the mic check, with a live level, until it hears the smoke's fake mic beep.
  await expect(heading(page, 'Let’s check your mic')).toBeVisible();
  await expect(page.getByText('Headphones work best, so the mic doesn’t hear the game.')).toBeVisible();
  await expect(page.getByRole('meter', { name: 'Mic level' })).toBeVisible();
  await expect(page.getByRole('checkbox', { name: 'Skip the tutorial' })).not.toBeChecked();
  await expect(button(page, 'Skip')).toBeVisible();
  await expect(page.getByRole('status').filter({ hasText: 'Heard you! Your mic works.' })).toBeVisible();
  await button(page, 'Start').click();

  // In the German pack's town, with its money.
  const dock = page.getByRole('region', { name: 'Dock' });
  await expect(dock.getByText('Day 1 · Monday')).toBeVisible();
  await expect(dock.getByLabel('Money')).toHaveText('100 €');

  await page.reload();
  await expect(titleMenu(page)).toBeVisible();
  await expect(page.getByText('Mika · German')).toBeVisible();
});

test('Back and Esc step back through setup, keeping the answers', async ({ page }) => {
  await page.goto('/');
  await titleMenu(page).getByRole('button', { name: 'New game' }).click();
  await button(page, 'Next').click();
  await languageChoice(page, 'zh').check();
  await button(page, 'Next').click();
  await expect(heading(page, 'How much Chinese do you know?')).toBeVisible();

  await page.keyboard.press('Escape');
  await expect(languageChoice(page, 'zh')).toBeChecked();
  await button(page, 'Back').click();
  await expect(heading(page, 'Which language do you read best?')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(titleMenu(page)).toBeVisible();
});

test('a second New game on the same browser pre-fills the Native Language chosen for the first', async ({ page }) => {
  await startNewGame(page, { native: 'ja', target: 'zh' });

  await page.reload();
  await page.getByRole('navigation', { name: 'タイトルメニュー' }).getByRole('button', { name: 'ニューゲーム' }).click();

  await expect(heading(page, 'いちばん読みやすい言語はどれですか？')).toBeVisible();
  await expect(languageChoice(page, 'ja')).toBeChecked();
});

test('German fits every setup screen', async ({ page }) => {
  await page.goto('/');
  await titleMenu(page).getByRole('button', { name: 'New game' }).click();
  await languageChoice(page, 'de').check();
  const panel = page.locator('form', { has: page.getByRole('heading') });
  const weiter = button(page, 'Weiter');

  expect(await overflowing(panel)).toEqual([]);
  await weiter.click();
  await languageChoice(page, 'ja').check();
  expect(await overflowing(panel)).toEqual([]);
  await weiter.click();
  await page.getByRole('radio').last().check();
  await page.getByRole('textbox').fill('Maximilian-Alexander');
  expect(await overflowing(panel)).toEqual([]);
  await weiter.click();
  await expect(heading(page, 'Wie sieht Maximilian-Alexander aus?')).toBeVisible();
  expect(await overflowing(panel)).toEqual([]);
  await weiter.click();
  await expect(heading(page, 'Kurzer Mikrofontest')).toBeVisible();
  expect(await overflowing(panel)).toEqual([]);
});
