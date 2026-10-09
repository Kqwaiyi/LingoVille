import { expect, test, type Page } from './test.ts';
import { column, dock, npcLine, typeLine } from './barista.ts';
import { startNewGame } from './title.ts';
import { walkUntil } from './walk.ts';

// What the scripted fake landlord says in the ja pack (mock mode), with a week's rent at the A1 Newcomer Discount owed.
const REMINDER = 'あ、ちょっといいですか。家賃がまだなんです。全部で¥6,000です。今払えますか？';
const ASK_TIME = 'どうしました？';

const closingCard = (page: Page) => column(page).getByRole('region', { name: 'Conversation over' });

/** A new game on day 7, the day rent first falls due, at 09:00 while the landlord is in the hallway. */
async function onRentDay(page: Page) {
  await startNewGame(page, { path: '/?day=7&at=9' });
}

/** Walks back from the tap towards the front door, past the landlord in the hallway, until they speak. */
async function walkOut(page: Page) {
  await page.locator('canvas').click();
  // The landlord holds the Character still once they come over, so a few steps more don't matter.
  await walkUntil(page, 'KeyS', npcLine(page, REMINDER), { timeout: 10_000 });
}

test('the landlord catches the Character on the way out when rent is due, and takes it', async ({ page }) => {
  await onRentDay(page);

  await walkOut(page);

  // No E: the landlord starts the conversation.
  await expect(column(page).getByText('Landlord')).toBeVisible();
  await typeLine(page, 'はい');
  await expect(closingCard(page)).toContainText('−¥6,000');
  await expect(dock(page).getByText('¥4,000')).toBeVisible();
});

test('asking the landlord for more time with F', async ({ page }) => {
  await onRentDay(page);
  await walkOut(page);
  await column(page).getByRole('button', { name: 'Leave' }).click();
  await expect(column(page)).toBeHidden();

  await page.keyboard.press('KeyF');
  await expect(npcLine(page, ASK_TIME)).toBeVisible();
  await typeLine(page, 'お願いします');
  await typeLine(page, 'はい');

  await expect(closingCard(page)).toContainText('Extra days to pay the rent: 3');
});

test('no Newcomer Discount figure is ever shown', async ({ page }) => {
  await onRentDay(page);
  await walkOut(page);

  await expect(page.getByText(/\d+\s?%/)).toHaveCount(0);
  await expect(page.getByText(/discount/i)).toHaveCount(0);
});
