import { expect, test } from './test.ts';
import { chat, column, dock, field, npcLine, talkToTheBarista } from './barista.ts';

// The fake barista reads back an order it recognises, even typed in romaji with a loanword.
const READ_BACK = 'ホットラテですね。450円です。よろしいですか？';

test('pressing E near the barista opens the chat column, and the barista speaks first', async ({ page }) => {
  await talkToTheBarista(page);

  // The barista goes by their local name in the ja pack, with the role beside it.
  await expect(column(page).getByText('佐藤', { exact: true })).toBeVisible();
  await expect(column(page).getByText('Barista', { exact: true })).toBeVisible();
  await expect(column(page).getByText(/ほしコーヒー · \d\d:\d\d/)).toBeVisible();
  await expect(column(page).getByRole('tab', { name: 'Chat', selected: true })).toBeVisible();
  await expect(column(page).getByRole('button', { name: /Leave/ })).toBeVisible();
  await expect(page.getByText('Press E to talk')).toBeHidden();
  // The barista's own face, in a little view of its own in the header.
  await expect(column(page).getByRole('img', { name: 'The barista looks relaxed' }).locator('canvas')).toBeVisible();
  // The scene and the dock stay on screen left of the column.
  await expect(page.locator('canvas').first()).toBeVisible();
  await expect(dock(page)).toBeVisible();
  const dockBox = (await dock(page).boundingBox())!;
  const columnBox = (await column(page).boundingBox())!;
  expect(dockBox.x + dockBox.width).toBeLessThanOrEqual(columnBox.x);
});

test('T focuses the typed field, Space types a space, and Enter sends a line the barista answers', async ({ page }) => {
  await talkToTheBarista(page);

  await page.keyboard.press('KeyT');
  await expect(field(page)).toBeFocused();
  await expect(field(page)).toHaveValue('');

  await page.keyboard.type('latte kudasai');
  await expect(field(page)).toHaveValue('latte kudasai');
  await page.keyboard.press('Enter');

  await expect(field(page)).toHaveValue('');
  await expect(chat(page).getByText('Heard as')).toBeVisible();
  await expect(chat(page).getByText('latte kudasai')).toBeVisible();
  await expect(npcLine(page, READ_BACK)).toBeVisible();
  // Typing never walked the Character away from the counter.
  await expect(column(page)).toBeVisible();
});

test('Esc leaves the conversation at no cost', async ({ page }) => {
  await talkToTheBarista(page);
  const money = await dock(page).getByLabel('Money').textContent();

  await page.keyboard.press('KeyT');
  await page.keyboard.type('hello');
  await page.keyboard.press('Escape');

  await expect(column(page)).toBeHidden();
  await expect(dock(page).getByLabel('Money')).toHaveText(money!);
  await expect(page.getByText('to talk — barista')).toBeVisible();
});

test('walking away from the counter ends the conversation', async ({ page }) => {
  await talkToTheBarista(page);

  await page.keyboard.down('KeyS');
  await expect(column(page)).toBeHidden({ timeout: 5_000 });
  await page.keyboard.up('KeyS');
});
