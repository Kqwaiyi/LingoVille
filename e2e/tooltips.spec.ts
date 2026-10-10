import { expect, test, type Page } from './test.ts';
import { column, dock, npcLine, talkToTheBarista, typeLine } from './barista.ts';
import { startNewGame, titleMenu } from './title.ts';

const tooltip = (page: Page, name: string) => page.getByRole('status', { name });
const closingCard = (page: Page) => column(page).getByRole('region', { name: 'Conversation over' });

/** Changes a device setting on the title screen's Settings, and waits until another load of the page reads it back. */
async function setOnTheTitle(page: Page, change: (page: Page) => Promise<void>, check: (page: Page) => Promise<void>) {
  const openSettings = async () => {
    await page.goto('/');
    await titleMenu(page).getByRole('button', { name: 'Settings' }).click();
  };
  await expect(async () => {
    await openSettings();
    await change(page);
    await openSettings();
    await check(page);
  }).toPass({ timeout: 15_000 });
}

const typeMyReplies = (page: Page) =>
  setOnTheTitle(
    page,
    (p) => p.getByRole('radio', { name: 'Type my replies' }).check(),
    (p) => expect(p.getByRole('radio', { name: 'Type my replies' })).toBeChecked({ timeout: 1_000 }),
  );

test('the first conversation typed explains the Typed Fallback above the dock, and it never comes back in another save', async ({ page }) => {
  await typeMyReplies(page);
  await talkToTheBarista(page);

  const card = tooltip(page, 'Typing your replies');
  await expect(card).toBeVisible();
  // Above the dock.
  const cardBox = (await card.boundingBox())!;
  const dockBox = (await dock(page).boundingBox())!;
  expect(cardBox.y + cardBox.height).toBeLessThan(dockBox.y);

  await card.getByRole('button', { name: 'Got it' }).click();
  await expect(card).toBeHidden();

  // Another tab, and a new save in it.
  const again = await page.context().newPage();
  await talkToTheBarista(again);
  await expect(column(again).getByText('🎤 off')).toBeVisible();
  await expect(tooltip(again, 'Typing your replies')).toBeHidden();
});

test('the Journal is explained once the first Recap closes', async ({ page }) => {
  await talkToTheBarista(page);
  await typeLine(page, 'ホットラテ ください');
  await expect(npcLine(page, 'ホットラテですね。450円です。よろしいですか？')).toBeVisible();
  await typeLine(page, 'はい');
  await expect(closingCard(page)).toBeVisible();
  await expect(tooltip(page, 'Your Journal')).toBeHidden();

  await closingCard(page).getByRole('button', { name: 'Skip Recap' }).click();

  const card = tooltip(page, 'Your Journal');
  await expect(card).toBeVisible();
  await expect(card).toContainText('Press J');
  await card.getByRole('button', { name: 'Got it' }).click();
  await expect(card).toBeHidden();
});

test('Fainting is explained once the Character wakes in the ward', async ({ page }) => {
  await startNewGame(page, { path: '/?faint' });
  const faintingScreen = page.getByRole('alertdialog', { name: 'You fainted' });
  await expect(faintingScreen).toBeVisible({ timeout: 15_000 });
  await expect(tooltip(page, 'Fainting')).toBeHidden();

  await faintingScreen.getByRole('button', { name: 'Wake up' }).click();

  await expect(tooltip(page, 'Fainting')).toBeVisible();
});

test('with tooltips turned off in Settings, none show', async ({ page }) => {
  await setOnTheTitle(
    page,
    (p) => p.getByRole('checkbox', { name: /Tooltips/ }).uncheck(),
    (p) => expect(p.getByRole('checkbox', { name: /Tooltips/ })).not.toBeChecked({ timeout: 1_000 }),
  );
  await typeMyReplies(page);

  await talkToTheBarista(page);

  await expect(column(page).getByText('🎤 off. Enable in Settings')).toBeVisible();
  await expect(tooltip(page, 'Typing your replies')).toBeHidden();
});
