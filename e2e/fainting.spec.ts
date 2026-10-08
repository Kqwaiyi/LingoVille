import { expect, test, type Page } from './test.ts';
import { chat, column, dock, npcLine, typeLine } from './barista.ts';
import { startNewGame } from './title.ts';

// What the scripted fake nurse says in the ja pack (mock mode).
const NURSE_GREETING = 'あ、目が覚めましたね。気分はどうですか？';

const faintingScreen = (page: Page) => page.getByRole('alertdialog', { name: 'You fainted' });
const closingCard = (page: Page) => column(page).getByRole('region', { name: 'Conversation over' });
const tab = (page: Page, name: string) => column(page).getByRole('tab', { name });

/** A new game seconds from Fainting (dev only), left to run until the Character faints. */
async function faint(page: Page, { broke = false } = {}) {
  await startNewGame(page, { path: broke ? '/?faint=broke' : '/?faint' });
  await expect(faintingScreen(page)).toBeVisible({ timeout: 15_000 });
}

test('Health running out shows the Fainting screen, then the nurse speaks first in the ward', async ({ page }) => {
  await faint(page);

  await expect(faintingScreen(page).getByText('The hospital bill of ¥9,000 was paid.')).toBeVisible();
  // The rest of the day is lost: the Character wakes at 08:00 the next day.
  await expect(dock(page).getByText('Day 2 · Tuesday')).toBeVisible();
  await expect(dock(page).getByLabel('Time')).toHaveText('08:00');

  await faintingScreen(page).getByRole('button', { name: 'Wake up' }).click();

  await expect(faintingScreen(page)).toBeHidden();
  await expect(column(page)).toBeVisible();
  // No E: the nurse starts the conversation.
  await expect(npcLine(page, NURSE_GREETING)).toBeVisible();
  await expect(column(page).getByText('Nurse')).toBeVisible();
  await expect(column(page).getByText(/^みどり総合病院 · 08:0\d$/)).toBeVisible();
});

test('the nurse’s conversation works like any other: Help, the closing card and the Recap', async ({ page }) => {
  await faint(page);
  await faintingScreen(page).getByRole('button', { name: 'Wake up' }).click();
  await expect(npcLine(page, NURSE_GREETING)).toBeVisible();

  await page.keyboard.press('KeyH');
  await expect(tab(page, 'Help')).toHaveAttribute('aria-selected', 'true');
  await page.keyboard.press('KeyH');
  await expect(tab(page, 'Chat')).toHaveAttribute('aria-selected', 'true');

  await typeLine(page, '大丈夫です');
  await expect(closingCard(page)).toBeVisible();
  await closingCard(page).getByRole('button', { name: 'See Recap' }).click();
  const recap = column(page).getByRole('region', { name: 'Recap' });
  await expect(recap.getByRole('article', { name: 'Journal page' })).toBeVisible();
  await recap.getByRole('button', { name: 'Done' }).click();
  await expect(column(page)).toBeHidden();
});

test('Leave walks away from the nurse at no cost', async ({ page }) => {
  await faint(page);
  await faintingScreen(page).getByRole('button', { name: 'Wake up' }).click();
  await expect(npcLine(page, NURSE_GREETING)).toBeVisible();

  await column(page).getByRole('button', { name: 'Leave' }).click();

  await expect(column(page)).toBeHidden();
  await expect(chat(page)).toBeHidden();
});

test('a bill the Character can’t pay becomes hospital debt, shown next to the money', async ({ page }) => {
  await faint(page, { broke: true });

  await expect(faintingScreen(page).getByText('You couldn’t pay the hospital bill of ¥9,000, so you owe it.')).toBeVisible();
  await expect(dock(page).getByRole('list', { name: 'Debts' })).toHaveText('Hospital debt ¥9,000');
  await expect(dock(page).getByLabel('Money')).toHaveText('¥0');
});
