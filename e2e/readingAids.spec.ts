import { expect, test, type Page } from './test.ts';
import { chat, GREETING, npcLine, talkToTheBarista, typeLine } from './barista.ts';
import { titleMenu } from './title.ts';

/** The chat bubble of a finished NPC line, with its reading aid. */
const bubbleSaying = (page: Page, text: string) =>
  chat(page)
    .locator('.bubble-npc')
    .filter({ has: page.getByRole('button', { name: `Replay “${text}”`, exact: true }) });

// The barista's greeting, which the mock gateway gives a reading that passes the checks.
const greetingBubble = (page: Page) => bubbleSaying(page, GREETING);

type Settings = Partial<Record<'Reading aids' | 'Show romaji', boolean>>;

const openSettings = async (page: Page) => {
  await page.goto('/');
  await titleMenu(page).getByRole('button', { name: 'Settings' }).click();
};

/**
 * Sets reading aids settings on the title screen, and checks they are kept for this browser after a reload. The
 * setting is written in the background, and a reload straight away (while the title scene is still loading) can beat
 * it, so the whole round is tried again until the setting is kept.
 */
async function keepSettings(page: Page, settings: Settings) {
  await expect(async () => {
    await openSettings(page);
    for (const [name, on] of Object.entries(settings)) await page.getByRole('checkbox', { name }).setChecked(on);
    await openSettings(page);
    for (const [name, on] of Object.entries(settings)) await expect(page.getByRole('checkbox', { name })).toBeChecked({ checked: on, timeout: 1_000 });
  }).toPass({ timeout: 15_000 });
}

test('furigana sit over the kanji of an NPC line, and only over the kanji', async ({ page }) => {
  await talkToTheBarista(page);

  const rubies = greetingBubble(page).locator('ruby');
  await expect(rubies).toHaveCount(2);
  await expect(rubies.nth(0).locator('rt')).toHaveText('ちゅうもん');
  await expect(rubies.nth(1).locator('rt')).toHaveText('き');
  await expect(greetingBubble(page).locator('.romaji-line')).toHaveCount(0);
});

test('a line whose model reading fails the checks keeps kuromoji’s furigana', async ({ page }) => {
  const warnings: string[] = [];
  page.on('console', (message) => void (message.type() === 'warning' && warnings.push(message.text())));
  await talkToTheBarista(page);

  await typeLine(page, 'ホットラテをください');
  const readBack = 'ホットラテですね。450円です。よろしいですか？';
  await expect(npcLine(page, readBack)).toBeVisible();

  await expect(bubbleSaying(page, readBack).locator('ruby')).toHaveCount(1);
  await expect(bubbleSaying(page, readBack).locator('ruby rt')).toHaveText('えん');
  await expect.poll(() => warnings.some((warning) => warning.includes('failed a check'))).toBe(true);
});

test('Show romaji adds a romaji line under each Japanese line', async ({ page }) => {
  await keepSettings(page, { 'Show romaji': true });
  await talkToTheBarista(page);

  await expect(greetingBubble(page).locator('.romaji-line')).toHaveText('irasshaimase! gochuumon wa okimari desuka?');
});

test('hiding reading aids hides furigana and romaji alike, and Show romaji can’t be turned on', async ({ page }) => {
  await keepSettings(page, { 'Show romaji': true });
  await page.getByRole('checkbox', { name: 'Reading aids' }).uncheck();
  await expect(page.getByRole('checkbox', { name: 'Show romaji' })).toBeDisabled();
  await expect(page.getByRole('checkbox', { name: 'Show romaji' })).not.toBeChecked();
  await openSettings(page);
  await expect(page.getByRole('checkbox', { name: 'Reading aids' })).not.toBeChecked();
  await talkToTheBarista(page);

  await expect(greetingBubble(page)).toContainText(GREETING);
  await expect(greetingBubble(page).locator('ruby')).toHaveCount(0);
  await expect(greetingBubble(page).locator('.romaji-line')).toHaveCount(0);
});
