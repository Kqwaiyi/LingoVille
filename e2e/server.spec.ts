import { expect, test, type Page } from './test.ts';
import { chat, column, typeLine } from './barista.ts';
import { startNewGame } from './title.ts';
import { walkUntil } from './walk.ts';

// What the scripted fake table says in the ja pack (mock mode): each diner's dish and drink, and any dietary need.
const DINER = /(?:私|友達|もう一人の友達)は(.+?)と(.+?)を(?:、(.+?)で)?お願いします。/g;

const closingCard = (page: Page) => column(page).getByRole('region', { name: 'Conversation over' });
const orderPad = (page: Page) => column(page).getByRole('region', { name: 'Order pad' });
const lastNpcLine = (page: Page) => chat(page).getByRole('button', { name: /^Replay “/ }).last();

/**
 * A new game (Japanese, from B1) inside the restaurant's door at 12:00 on day 3, a Wednesday, hired as a server
 * (F at the server, as Sam), then at the staff door.
 */
async function hiredAtTheStaffDoor(page: Page) {
  await startNewGame(page, { path: '/?spawn=restaurant&at=12&day=3', level: 2 });
  await page.locator('canvas').click();
  await walkUntil(page, 'KeyD', 'to ask for work');
  await page.keyboard.press('KeyF');
  for (const line of ['仕事はありますか？', 'Sam', '明日から', 'はい']) await typeLine(page, line);
  await expect(closingCard(page)).toContainText('You got the job: Server');
  await closingCard(page).getByRole('button', { name: 'Skip Recap' }).click();
  await walkUntil(page, 'KeyA', 'to start a shift — Server');
}

/** What each diner at the table said they want, read from the customer's line. */
async function whatTheTableWants(page: Page) {
  await expect(lastNpcLine(page)).toBeVisible();
  const said = (await lastNpcLine(page).getAttribute('aria-label')) ?? '';
  return [...said.matchAll(DINER)].map(([, dish, drink, note]) => ({ dish: dish!, drink: drink!, note: note ?? null }));
}

/** Writes each diner on the order pad, with their need noted, and sends it: with `dishWrong`, the first diner gets another dish. */
async function takeTheOrder(page: Page, diners: Awaited<ReturnType<typeof whatTheTableWants>>, { dishWrong = false } = {}) {
  const pad = orderPad(page);
  for (const [i, { dish, drink, note }] of diners.entries()) {
    if (i > 0) await pad.getByRole('button', { name: '+ Diner' }).click();
    const dishes = pad.getByRole('group', { name: 'Dishes' });
    const dishButton = dishWrong && i === 0 ? dishes.getByRole('button').filter({ hasNotText: dish }).first() : dishes.getByRole('button', { name: new RegExp(`^${dish} `) });
    await dishButton.click();
    await pad.getByRole('group', { name: 'Drinks' }).getByRole('button', { name: new RegExp(`^${drink} `) }).click();
    if (note) {
      const notes = pad.getByRole('combobox', { name: 'Dietary note' });
      await notes.selectOption((await notes.locator('option', { hasText: note }).getAttribute('value'))!);
    }
  }
  await pad.getByRole('button', { name: 'Send order' }).click();
}

test('a server Shift: hired at the restaurant, every diner on the order pad with their dietary note, paid with one Recap', async ({ page }) => {
  test.setTimeout(150_000);
  await hiredAtTheStaffDoor(page);
  await page.keyboard.press('KeyE');
  await expect(column(page)).toContainText(/Customer 1 of \d+/);
  const count = Number((await column(page).textContent())!.match(/Customer 1 of (\d+)/)![1]);

  for (let customer = 1; customer <= count; customer++) {
    await expect(column(page)).toContainText(`Customer ${customer} of ${count}`);
    const diners = await whatTheTableWants(page);
    expect(diners.length).toBeGreaterThan(0);
    // The first table's dish is got wrong; everyone else's order is right.
    await takeTheOrder(page, diners, { dishWrong: customer === 1 });
    if (customer < count) await expect(column(page)).toContainText(`Customer ${customer + 1} of ${count}`, { timeout: 10_000 });
  }

  const shiftEnd = page.getByRole('dialog', { name: /Shift over/ });
  await expect(shiftEnd).toBeVisible({ timeout: 10_000 });
  await expect(shiftEnd).toContainText(`Customers served right: ${count - 1} of ${count}`);
  await expect(shiftEnd).toContainText('Pay: ¥');
  await expect(shiftEnd.getByRole('region', { name: 'Recap' })).toContainText('Shift — Server', { timeout: 10_000 });
});
