import { expect, test, type Page } from './test.ts';
import { column, npcLine, typeLine, walkToTheBarista } from './barista.ts';

// What the scripted fake barista says in the ja pack (mock mode) when asked for work. The Character is named Sam at setup.
const ASK_NAME = 'あ、アルバイトですね！お名前は？';
const NAME_AGAIN = 'すみません、お名前をもう一度ゆっくりお願いします。';

const closingCard = (page: Page) => column(page).getByRole('region', { name: 'Conversation over' });

test('asking the barista for work with F: a misheard name is asked again, and then the Character is hired', async ({ page }) => {
  await walkToTheBarista(page);
  await expect(page.getByText('to ask for work')).toBeVisible();

  await page.keyboard.press('KeyF');
  await typeLine(page, '仕事はありますか？');
  await expect(npcLine(page, ASK_NAME)).toBeVisible();
  // The fake barista writes down サム, which isn't the setup spelling Sam, so the sim says it's the wrong name.
  // (The real NPC is told to write a foreign name in Latin letters.)
  await typeLine(page, 'サムです');
  await typeLine(page, '明日から');
  await typeLine(page, 'はい');
  await expect(npcLine(page, NAME_AGAIN)).toBeVisible();
  await typeLine(page, 'Sam');
  await typeLine(page, 'はい');

  await expect(closingCard(page)).toContainText('You got the job: Barista');
  await closingCard(page).getByRole('button', { name: 'Skip Recap' }).click();
  await expect(page.getByText('to talk — barista')).toBeVisible();
  await expect(page.getByText('to ask for work')).toBeHidden();
});
