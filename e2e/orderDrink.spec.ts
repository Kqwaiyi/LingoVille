import { expect, test, type Page } from './test.ts';
import { PROFICIENCY_STEP_TABLE } from '../src/sim/index.ts';
import { column, dock, npcLine, talkToTheBarista, typeLine } from './barista.ts';

const closingCard = (page: Page) => column(page).getByRole('region', { name: 'Conversation over' });
const money = (page: Page) => dock(page).getByLabel('Money');

// Ordering a drink typed (read-back, confirm, closing card, the money drop) is the first session's smoke (`smoke.spec.ts`).

test('gibberish wears out the barista’s Patience, shown only on their face, until they end it with no charge', async ({ page }) => {
  // Past the First Morning, whose café order can't fail.
  await talkToTheBarista(page, { skipTutorial: true });
  const face = column(page).getByRole('img', { name: /^The barista looks/ });
  await expect(face).toHaveAccessibleName('The barista looks relaxed');

  await typeLine(page, 'asdf');
  await expect(npcLine(page, 'すみません、よくわかりませんでした。')).toHaveCount(1);
  await expect(face).not.toHaveAccessibleName('The barista looks relaxed');

  // The dev save starts at A1.
  const { startingPatience } = PROFICIENCY_STEP_TABLE.A1;
  for (let turn = 2; turn < startingPatience; turn++) {
    await typeLine(page, 'asdf');
    await expect(npcLine(page, 'すみません、よくわかりませんでした。')).toHaveCount(turn);
  }
  await typeLine(page, 'asdf');
  await expect(npcLine(page, '申し訳ございません…。またのお越しをお待ちしております。')).toBeVisible();

  await expect(closingCard(page).getByText('No charge · Mood ↓')).toBeVisible();
  await expect(money(page)).toHaveText('¥10,000');
  // Patience is never shown as a number.
  await expect(column(page).getByText(/patience/i)).toHaveCount(0);

  await page.keyboard.press('Escape');
  await expect(column(page)).toBeHidden();
});
