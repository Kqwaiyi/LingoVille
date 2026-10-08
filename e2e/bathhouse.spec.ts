import { expect, test, type Page } from './test.ts';
import { column, dock, npcLine, typeLine } from './barista.ts';
import { startNewGame } from './title.ts';

const closingCard = (page: Page) => column(page).getByRole('region', { name: 'Conversation over' });

/** A new game (learning Japanese) inside the bathhouse door at 10:00, walked back to the attendant's desk. */
async function atTheAttendant(page: Page) {
  await startNewGame(page, { path: '/?spawn=bathhouse&at=10' });
  await page.locator('canvas').click();
  // The door faces the street, so the desk is behind the Character as they come in.
  await page.keyboard.down('KeyS');
  await expect(page.getByText('to talk — attendant')).toBeVisible({ timeout: 5_000 });
  await page.keyboard.up('KeyS');
  await expect(page.getByText('to ask about the gym')).toBeVisible();
  await expect(page.getByText('Press T to chat')).toBeVisible();
}

/** Walks west from the desk to the running machine beside the door. */
async function toTheGym(page: Page) {
  await page.keyboard.down('KeyA');
  await expect(page.getByText('to work out')).toBeVisible({ timeout: 5_000 });
  await page.keyboard.up('KeyA');
}

test('buys a bath on E: a Comfort Purchase that lifts Mood', async ({ page }) => {
  await atTheAttendant(page);
  await page.keyboard.press('KeyE');
  await expect(npcLine(page, 'いらっしゃいませ。お風呂ですか？')).toBeVisible();
  await typeLine(page, 'お風呂に入りたいです');
  await expect(npcLine(page, 'タオルはお使いになりますか？')).toBeVisible();
  await typeLine(page, 'はい');
  await expect(npcLine(page, '入浴券、600円、タオルありですね。よろしいですか？')).toBeVisible();
  await typeLine(page, 'はい');

  await expect(closingCard(page).getByText('Bath entry ticket · −¥600 · Mood ↑')).toBeVisible();
  await expect(dock(page).getByLabel('Money')).toHaveText('¥9,400');
});

test('the gym turns away a Character who is not a member', async ({ page }) => {
  await atTheAttendant(page);
  await toTheGym(page);

  await page.keyboard.press('KeyE');

  await expect(page.getByText('The gym is for members.', { exact: false })).toBeVisible();
});

test('joins the gym on F, then works out once that day', async ({ page }) => {
  await atTheAttendant(page);
  await page.keyboard.press('KeyF');
  await expect(npcLine(page, 'いらっしゃいませ。ジムのご案内ですか？')).toBeVisible();
  await typeLine(page, 'ジムに入会したいです');
  await expect(npcLine(page, 'ジムの会員は3000円です。ジムは一日一回ご利用いただけます。よろしいですか？')).toBeVisible();
  await typeLine(page, 'はい');
  await expect(closingCard(page).getByText('Gym membership · −¥3,000 · Mood ↑')).toBeVisible();
  await closingCard(page).getByRole('button', { name: 'Skip Recap' }).click();
  await expect(column(page)).toBeHidden();
  await expect(page.getByText('to ask about the gym')).toBeHidden();

  await toTheGym(page);
  await page.keyboard.press('KeyE');
  await page.keyboard.press('KeyE');

  await expect(page.getByText('You’ve already worked out today.', { exact: false })).toBeVisible();
});
