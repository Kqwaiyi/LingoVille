/// <reference lib="dom" />
import { expect, test, type Locator, type Page } from '@playwright/test';
import { titleMenu } from './title.ts';

const choice = (page: Page, endonym: string) => page.getByRole('radio', { name: new RegExp(`^${endonym}`) });
const next = (page: Page, name = 'Next') => page.getByRole('button', { name, exact: true });

/** The things in `container` that stick out of it sideways (or, with `vertical`, at all), or whose text runs out of its own box. */
function overflowing(container: Locator, { vertical = false } = {}) {
  return container.evaluate((root, vertical) => {
    const box = root.getBoundingClientRect();
    const problems: string[] = [];
    for (const element of root.querySelectorAll<HTMLElement>('*')) {
      const rect = element.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) continue;
      const outside =
        rect.left < box.left - 1 || rect.right > box.right + 1 || (vertical && (rect.top < box.top - 1 || rect.bottom > box.bottom + 1));
      const clipped = element.clientWidth > 0 && element.scrollWidth > element.clientWidth + 1;
      if (outside || clipped) problems.push(`<${element.tagName.toLowerCase()} class="${element.className}"> ${element.textContent?.trim().slice(0, 40)}`);
    }
    return problems;
  }, vertical);
}

/** The labels under the dock's rings, which may not run into each other. */
function overlappingRingLabels(dock: Locator) {
  return dock.evaluate((root) => {
    const rects = [...root.querySelectorAll('.ring-label')].map((label) => label.getBoundingClientRect());
    return rects.some((a, i) => rects.slice(i + 1).some((b) => a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom));
  });
}

test('New game opens on the Native Language screen, with English pre-selected for an English browser', async ({ page }) => {
  await page.goto('/');
  await titleMenu(page).getByRole('button', { name: 'New game' }).click();

  await expect(page.getByRole('heading', { name: 'Which language do you read best?' })).toBeVisible();
  await expect(choice(page, 'English')).toBeChecked();
  for (const endonym of ['日本語', '中文', 'Deutsch']) await expect(choice(page, endonym)).not.toBeChecked();
});

test.describe('in a browser that reads German first', () => {
  test.use({ locale: 'de-DE' });

  test('the title and the Native Language screen are already in German, with German pre-selected', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('navigation', { name: 'Titelmenü' }).getByRole('button', { name: 'Neues Spiel' }).click();

    await expect(page.getByRole('heading', { name: 'Welche Sprache liest du am besten?' })).toBeVisible();
    await expect(choice(page, 'Deutsch')).toBeChecked();
  });
});

test.describe('in a browser that reads none of the four', () => {
  test.use({ locale: 'fr-FR' });

  test('English is pre-selected', async ({ page }) => {
    await page.goto('/');
    await titleMenu(page).getByRole('button', { name: 'New game' }).click();

    await expect(choice(page, 'English')).toBeChecked();
  });
});

test('choosing a language switches the whole UI at once, and this browser keeps it', async ({ page }) => {
  await page.goto('/');
  await titleMenu(page).getByRole('button', { name: 'New game' }).click();

  await choice(page, '日本語').check();
  await expect(page.getByRole('heading', { name: 'いちばん読みやすい言語はどれですか？' })).toBeVisible();
  await choice(page, '中文').check();
  await expect(page.getByRole('heading', { name: '你读哪种语言最顺手？' })).toBeVisible();
  await choice(page, 'Deutsch').check();
  await expect(page.getByRole('heading', { name: 'Welche Sprache liest du am besten?' })).toBeVisible();
  await next(page, 'Weiter').click();

  const dock = page.getByRole('region', { name: 'Leiste' });
  await expect(dock.getByRole('meter', { name: 'Gesundheit' })).toBeVisible();
  await expect(dock.getByText('Tag 1 · Montag')).toBeVisible();

  await page.reload();
  await expect(page.getByRole('navigation', { name: 'Titelmenü' })).toBeVisible();
});

test('Esc on the Native Language screen goes back to the title screen', async ({ page }) => {
  await page.goto('/');
  await titleMenu(page).getByRole('button', { name: 'New game' }).click();
  await expect(choice(page, 'English')).toBeFocused();

  await page.keyboard.press('Escape');

  await expect(titleMenu(page)).toBeVisible();
  await expect(next(page)).toBeHidden();
});

test('German strings fit in the dock and the conversation column', async ({ page }) => {
  await page.goto('/?spawn=cafe');
  await titleMenu(page).getByRole('button', { name: 'New game' }).click();
  await choice(page, 'Deutsch').check();
  await next(page, 'Weiter').click();

  const dock = page.getByRole('region', { name: 'Leiste' });
  await expect(dock.getByText('Tag 1 · Montag')).toBeVisible();
  expect(await overflowing(dock, { vertical: true })).toEqual([]);
  expect(await overlappingRingLabels(dock)).toBe(false);

  await page.locator('canvas').click();
  await page.keyboard.down('KeyW');
  await expect(page.getByText('um zu sprechen — Barista')).toBeVisible({ timeout: 5_000 });
  await page.keyboard.up('KeyW');
  await page.keyboard.press('KeyE');

  const column = page.getByRole('complementary', { name: 'Gespräch' });
  await expect(column.getByRole('button', { name: /nochmal hören$/ })).toBeVisible();
  expect(await overflowing(column)).toEqual([]);
  expect(await overflowing(dock, { vertical: true })).toEqual([]);

  await column.getByRole('tab', { name: /Hilfe/ }).click();
  await expect(column.getByRole('tabpanel', { name: 'Hilfe' })).toBeVisible();
  expect(await overflowing(column)).toEqual([]);
  await column.getByRole('tab', { name: 'Chat' }).click();

  const field = column.getByRole('textbox', { name: 'Getippte Antwort' });
  // The barista reads the order back before the Player confirms it.
  for (const [line, answer] of [['ホットラテ ください', /ホットラテですね/], ['はい', /ありがとうございます/]] as const) {
    await page.keyboard.press('KeyT');
    await field.fill(line);
    await page.keyboard.press('Enter');
    await expect(column.getByRole('button', { name: answer })).toBeVisible();
  }
  const closingCard = column.getByRole('region', { name: 'Gespräch beendet' });
  await expect(closingCard).toBeVisible();
  expect(await overflowing(column)).toEqual([]);

  await closingCard.getByRole('button', { name: 'Rückblick ansehen' }).click();
  await expect(column.getByRole('article', { name: 'Tagebuchseite' })).toBeVisible();
  expect(await overflowing(column)).toEqual([]);
});
