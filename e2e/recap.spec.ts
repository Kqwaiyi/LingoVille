import { expect, test, type Page } from './test.ts';
import { column, npcLine, talkToTheBarista, typeLine } from './barista.ts';

// What the gateway's canned Recap says in mock mode.
const OUTCOME = 'You ordered a hot latte and paid. Nicely done!';

const closingCard = (page: Page) => column(page).getByRole('region', { name: 'Conversation over' });
const journal = (page: Page) => page.getByRole('dialog', { name: 'Journal' });

async function orderALatte(page: Page) {
  await talkToTheBarista(page);
  await typeLine(page, 'ホットラテ ください');
  await expect(npcLine(page, 'ホットラテですね。450円です。よろしいですか？')).toBeVisible();
  await typeLine(page, 'はい');
  await expect(closingCard(page)).toBeVisible();
}

// See Recap, Done, then J opening the Journal on it, is the first session's smoke (`smoke.spec.ts`).
test('See Recap shows a lined Journal page in the column', async ({ page }) => {
  await orderALatte(page);

  await closingCard(page).getByRole('button', { name: 'See Recap' }).click();
  const recap = column(page).getByRole('region', { name: 'Recap' });
  const entry = recap.getByRole('article', { name: 'Journal page' });
  await expect(entry.getByText(OUTCOME)).toBeVisible();
  await expect(entry.getByRole('region', { name: 'Corrections' }).getByText('ホットラテをください')).toBeVisible();
  await expect(entry.getByRole('region', { name: 'New words' }).getByText('いらっしゃいませ')).toBeVisible();
  await expect(entry.getByText('No Help needed')).toBeVisible();

  // 🔊 asks the gateway to say the phrase.
  const said = page.waitForRequest((request) => request.url().endsWith('/api/tts'));
  await entry.getByRole('button', { name: 'Hear “ホットラテをください” said' }).click();
  expect((await said).postDataJSON()).toEqual({ text: 'ホットラテをください', targetLanguage: 'ja' });

  await recap.getByRole('button', { name: 'Done' }).click();
  await expect(column(page)).toBeHidden();
});

test('Skip Recap says the Recap is saved, and it is in the Journal', async ({ page }) => {
  await orderALatte(page);
  await closingCard(page).getByRole('button', { name: 'Skip Recap' }).click();
  await expect(page.getByRole('status').getByText('Recap saved to your Journal')).toBeVisible();

  await page.keyboard.press('KeyJ');
  const entries = journal(page).getByRole('navigation', { name: 'Journal entries' }).getByRole('button');
  await expect(entries).toHaveCount(1);
  await expect(journal(page).getByText(OUTCOME)).toBeVisible();
});
