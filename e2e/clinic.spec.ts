import { expect, test, type Page } from '@playwright/test';
import { column, npcLine, typeLine } from './barista.ts';
import { startNewGame } from './title.ts';

const closingCard = (page: Page) => column(page).getByRole('region', { name: 'Conversation over' });

/** Skips the Recap from the closing card, and the column closes. */
async function skipRecap(page: Page) {
  await closingCard(page).getByRole('button', { name: 'Skip Recap' }).click();
  await expect(column(page)).toBeHidden();
}

/** A new game (learning Japanese) with a cold, inside the clinic door at 10:00 on a Monday, walked to reception. */
async function atReception(page: Page) {
  await startNewGame(page, { path: '/?spawn=clinic&at=10&ill=cold' });
  await page.locator('canvas').click();
  // Reception is to the west of the door, past the waiting room's bench.
  await page.keyboard.down('KeyS');
  await page.keyboard.down('KeyA');
  await expect(page.getByText('to talk — receptionist')).toBeVisible({ timeout: 5_000 });
  await page.keyboard.up('KeyA');
  await page.keyboard.up('KeyS');
}

test('checks in at reception, and the doctor calls the Character in and diagnoses what they describe', async ({ page }) => {
  await atReception(page);
  await page.keyboard.press('KeyE');
  await expect(npcLine(page, 'こんにちは。今日はどうされましたか？')).toBeVisible();
  await typeLine(page, '咳が出て、喉が痛いです');
  await expect(npcLine(page, '診察ですね。受付しますね。よろしいですか？')).toBeVisible();
  await typeLine(page, 'はい');
  await expect(closingCard(page)).toBeVisible();
  await skipRecap(page);

  // The doctor calls the Character's name once they have waited: a quarter of an hour, or 15 real seconds.
  await expect(npcLine(page, 'どうぞ、お入りください。今日はどうしましたか？')).toBeVisible({ timeout: 30_000 });
  await typeLine(page, '咳が出て、喉が痛いです');
  await expect(npcLine(page, '風邪ですね。お薬を出しておきます。わかりましたか？')).toBeVisible();
  await typeLine(page, 'はい');

  await expect(closingCard(page)).toBeVisible();
  await expect(npcLine(page, 'お大事に。お薬は薬局で受け取ってください。')).toBeVisible();
});
