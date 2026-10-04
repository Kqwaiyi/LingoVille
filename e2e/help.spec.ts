import { expect, test, type Page } from '@playwright/test';
import { chat, column, GREETING, talkToTheBarista, typeLine } from './barista.ts';

// What the gateway answers in mock mode for the ja pack.
const HINT = 'ホットラテをください。';
const TRANSLATION = `Mock translation: ${GREETING}`;
// A new word in the gateway's canned Recap.
const NEW_WORD = 'いらっしゃいませ';

const help = (page: Page) => column(page).getByRole('tabpanel', { name: 'Help' });
const tab = (page: Page, name: string) => column(page).getByRole('tab', { name });

test('H opens Help with hints for this moment and the café phrasebook, and the conversation waits', async ({ page }) => {
  await talkToTheBarista(page);

  await page.keyboard.press('KeyH');
  await expect(tab(page, 'Help')).toHaveAttribute('aria-selected', 'true');
  await expect(help(page).getByText('The conversation waits while Help is open')).toBeVisible();
  const hints = help(page).getByRole('region', { name: 'Hints' });
  await expect(hints.getByText(HINT)).toBeVisible();
  await expect(hints.getByText('A hot latte, please.')).toBeVisible();
  await expect(help(page).getByRole('region', { name: 'Phrasebook for this place' }).getByText('The menu, please.')).toBeVisible();
  await expect(help(page).getByRole('region', { name: 'My phrasebook' })).toBeVisible();

  // 🔊 on a hint says it aloud.
  const said = page.waitForRequest((request) => request.url().endsWith('/api/tts'));
  await hints.getByRole('button', { name: `Hear “${HINT}” said` }).click();
  expect((await said).postDataJSON()).toEqual({ text: HINT, targetLanguage: 'ja' });

  await page.keyboard.press('KeyH');
  await expect(chat(page).getByText(GREETING)).toBeVisible();
});

test('Translate shows the Native Language line under an NPC line, and 🔊 Replay says it again', async ({ page }) => {
  await talkToTheBarista(page);

  await chat(page).getByRole('button', { name: 'Translate' }).click();
  await expect(chat(page).getByText(TRANSLATION)).toBeVisible();

  const said = page.waitForRequest((request) => request.url().endsWith('/api/tts'));
  await chat(page).getByRole('button', { name: `Replay “${GREETING}”` }).click();
  expect((await said).postDataJSON()).toEqual({ text: GREETING, targetLanguage: 'ja' });
});

test('a Recap where Help was used has no sticker, and + Phrasebook keeps a word for the Journal and Help', async ({ page }) => {
  await talkToTheBarista(page);
  await page.keyboard.press('KeyH');
  await expect(help(page).getByRole('region', { name: 'Hints' }).getByText(HINT)).toBeVisible();

  // Saying the hint goes back to the chat, and the order goes on from there.
  await typeLine(page, HINT);
  await expect(chat(page).getByText('ホットラテですね。450円です。よろしいですか？')).toBeVisible();
  await typeLine(page, 'はい');
  const closingCard = column(page).getByRole('region', { name: 'Conversation over' });
  await closingCard.getByRole('button', { name: 'See Recap' }).click();

  const entry = column(page).getByRole('region', { name: 'Recap' }).getByRole('article', { name: 'Journal page' });
  await expect(entry.getByRole('region', { name: 'New words' })).toBeVisible();
  await expect(entry.getByText('No Help needed')).toHaveCount(0);

  await entry.getByRole('button', { name: `Add “${NEW_WORD}” to my phrasebook` }).click();
  await expect(entry.getByText('✓ In my phrasebook')).toBeVisible();
  await column(page).getByRole('button', { name: 'Done' }).click();

  await page.keyboard.press('KeyJ');
  const journal = page.getByRole('dialog', { name: 'Journal' });
  await journal.getByRole('tab', { name: 'Phrasebook' }).click();
  await expect(journal.getByRole('region', { name: 'My phrasebook' }).getByText(NEW_WORD)).toBeVisible();
  await page.keyboard.press('Escape');

  // The kept word is in the Help tab of the next conversation too.
  await page.keyboard.press('KeyE');
  await expect(chat(page).getByText(GREETING)).toBeVisible();
  await page.keyboard.press('KeyH');
  await expect(help(page).getByRole('region', { name: 'My phrasebook' }).getByText('welcome (said by shop staff)')).toBeVisible();
});
