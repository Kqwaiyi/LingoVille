import { expect, test, type Page } from './test.ts';
import { column, dock, field, GREETING, npcLine, talkToTheBarista, typeLine, walkToTheBarista } from './barista.ts';

// Typed to the fake barista, this drops its connection (mock mode only).
const DROP = '#drop';
// What the fake barista says when a replacement session picks the conversation up again.
const RESUMED = '大変お待たせしました。ご注文をどうぞ。';

const mic = (page: Page) => column(page).getByRole('button', { name: 'Hold to talk (Space)' });
const money = (page: Page) => dock(page).getByLabel('Money');
const mood = (page: Page) => dock(page).getByRole('meter', { name: 'Mood' });

/** From now on the gateway can't mint a token. */
async function tokensFail(page: Page) {
  await page.route('**/api/token', (route) => route.fulfill({ status: 502, json: { error: 'token_unavailable' } }));
}

test('holding Space turns the mic red and listening, until it is released', async ({ page }) => {
  await talkToTheBarista(page);
  await expect(mic(page)).toHaveAttribute('aria-pressed', 'false');

  await page.keyboard.down('Space');
  await expect(mic(page)).toHaveAttribute('aria-pressed', 'true');
  await page.keyboard.up('Space');

  await expect(mic(page)).toHaveAttribute('aria-pressed', 'false');
});

test('Space types a space instead of listening while the typed field has focus', async ({ page }) => {
  await talkToTheBarista(page);
  await page.keyboard.press('KeyT');
  await expect(field(page)).toBeFocused();

  await page.keyboard.down('Space');
  await expect(field(page)).toHaveValue(' ');
  await expect(mic(page)).toHaveAttribute('aria-pressed', 'false');
  await page.keyboard.up('Space');
});

test('a dropped connection is retried, and the conversation carries on where it was', async ({ page }) => {
  await talkToTheBarista(page);

  await typeLine(page, DROP);

  await expect(npcLine(page, RESUMED)).toBeVisible();
  await expect(npcLine(page, GREETING)).toBeVisible();
  await typeLine(page, 'ラテ ください');
  await expect(npcLine(page, 'ホットラテですね。450円です。よろしいですか？')).toBeVisible();
});

test('a connection that drops and cannot come back is a network abandonment: a toast, and nothing changes', async ({ page }) => {
  await talkToTheBarista(page);
  await expect(money(page)).toHaveText('¥10,000');
  const moodBefore = await mood(page).getAttribute('aria-valuenow');
  await tokensFail(page);

  await typeLine(page, DROP);

  await expect(page.getByRole('status').filter({ hasText: 'The barista had to step away' })).toBeVisible();
  await expect(column(page)).toBeHidden();
  await expect(money(page)).toHaveText('¥10,000');
  await expect(mood(page)).toHaveAttribute('aria-valuenow', moodBefore!);
  await expect(page.getByRole('region', { name: 'Conversation over' })).toBeHidden();
  // The Character is still at the counter and can try again.
  await expect(page.getByText('to talk — barista')).toBeVisible();
});

test('with no token to be had, the voice service unavailable screen shows instead of a conversation', async ({ page }) => {
  await tokensFail(page);
  await walkToTheBarista(page);

  await page.keyboard.press('KeyE');

  const screen = page.getByRole('alertdialog', { name: 'Voice service unavailable: check the local server' });
  await expect(screen).toBeVisible();
  await expect(column(page)).toBeHidden();
  await expect(money(page)).toHaveText('¥10,000');

  await screen.getByRole('button', { name: 'Back to the game' }).click();
  await expect(screen).toBeHidden();
});
