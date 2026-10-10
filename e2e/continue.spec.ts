import { expect, test, type Page } from './test.ts';
import { column, dock, npcLine, talkToTheBarista, typeLine } from './barista.ts';
import { reloadAndContinue, startNewGame, titleMenu } from './title.ts';

const money = (page: Page) => dock(page).getByLabel('Money');

test('a browser with no saves is offered only New game', async ({ page }) => {
  await page.goto('/');

  await expect(titleMenu(page).getByRole('button', { name: 'New game' })).toBeEnabled();
  await expect(titleMenu(page).getByRole('button', { name: 'Continue' })).toHaveCount(0);
});

test('the game saves itself, with a brief "Saved ✓" under the clock', async ({ page }) => {
  await startNewGame(page, { throughScreens: true });

  await expect(dock(page).getByText('Saved ✓')).toBeVisible();
  await expect(dock(page).getByText('Saved ✓')).toBeHidden({ timeout: 5_000 });
});

// Order a drink, reload, Continue: the money and the place are as they were. That's the first session's smoke (`smoke.spec.ts`).

test('a reload mid-conversation comes back as if the conversation never happened', async ({ page }) => {
  await talkToTheBarista(page);
  await typeLine(page, 'ホットラテ ください');
  await expect(npcLine(page, 'ホットラテですね。450円です。よろしいですか？')).toBeVisible();

  await reloadAndContinue(page);

  await expect(column(page)).toBeHidden();
  await expect(money(page)).toHaveText('¥10,000');
});
