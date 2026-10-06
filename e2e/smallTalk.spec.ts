import { expect, test } from '@playwright/test';
import { chat, column, npcLine, typeLine, walkToTheBarista } from './barista.ts';

// What the scripted fake says in Small Talk in the ja pack (mock mode).
const CHAT_GREETING = 'こんにちは！今日はいい天気ですね。';

test('T chats with the barista: the chat never fails, and ends with a closing card and a lighter Recap', async ({ page }) => {
  await walkToTheBarista(page);
  await expect(page.getByText('Press T to chat')).toBeVisible();

  await page.keyboard.press('KeyT');
  await expect(column(page)).toBeVisible();
  await expect(npcLine(page, CHAT_GREETING)).toBeVisible();

  // The barista wraps up after 6–8 exchanges.
  const closingCard = column(page).getByRole('region', { name: 'Conversation over' });
  for (let i = 0; i < 8 && !(await closingCard.isVisible()); i++) {
    const npcLines = chat(page).getByRole('button', { name: /^Replay/ });
    const said = await npcLines.count();
    await typeLine(page, 'いい天気ですね');
    await expect(async () => expect(await npcLines.count()).toBeGreaterThan(said)).toPass();
  }
  await expect(closingCard.getByRole('heading', { name: 'Nice chat!' })).toBeVisible({ timeout: 5_000 });

  await closingCard.getByRole('button', { name: 'See Recap' }).click();
  await expect(column(page).getByRole('region', { name: 'Recap' })).toBeVisible();
});
