import { expect, test, type Page } from '@playwright/test';

const column = (page: Page) => page.getByRole('complementary', { name: 'Conversation' });
const chat = (page: Page) => column(page).getByRole('log', { name: 'Chat' });
const field = (page: Page) => column(page).getByRole('textbox', { name: 'Typed reply' });
const dock = (page: Page) => page.getByRole('region', { name: 'Dock' });

// What the scripted fake barista says in the ja pack (mock mode).
const GREETING = 'いらっしゃいませ！ご注文はお決まりですか？';
const FIRST_REPLY = 'はい、かしこまりました。ほかに何かありますか？';

/** Starts at the café door and walks up to the counter until the barista can be talked to. */
async function walkToTheBarista(page: Page) {
  await page.goto('/?spawn=cafe');
  await page.locator('canvas').click();
  await page.keyboard.down('KeyW');
  await expect(page.getByText('to talk — barista')).toBeVisible({ timeout: 5_000 });
  await page.keyboard.up('KeyW');
}

async function talkToTheBarista(page: Page) {
  await walkToTheBarista(page);
  await page.keyboard.press('KeyE');
  await expect(column(page)).toBeVisible();
  // The barista always speaks first.
  await expect(chat(page).getByText(GREETING)).toBeVisible();
}

test('pressing E near the barista opens the chat column, and the barista speaks first', async ({ page }) => {
  await talkToTheBarista(page);

  await expect(column(page).getByText('Barista', { exact: true })).toBeVisible();
  await expect(column(page).getByText(/ほしコーヒー · \d\d:\d\d/)).toBeVisible();
  await expect(column(page).getByRole('tab', { name: 'Chat', selected: true })).toBeVisible();
  await expect(column(page).getByRole('button', { name: /Leave/ })).toBeVisible();
  await expect(page.getByText('Press E to talk')).toBeHidden();
  // The scene and the dock stay on screen left of the column.
  await expect(page.locator('canvas')).toBeVisible();
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

  await page.keyboard.type('kohi kudasai');
  await expect(field(page)).toHaveValue('kohi kudasai');
  await page.keyboard.press('Enter');

  await expect(field(page)).toHaveValue('');
  await expect(chat(page).getByText('Heard as')).toBeVisible();
  await expect(chat(page).getByText('kohi kudasai')).toBeVisible();
  await expect(chat(page).getByText(FIRST_REPLY)).toBeVisible();
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
