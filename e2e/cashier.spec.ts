import { expect, test, type Page } from './test.ts';
import { chat, column, typeLine } from './barista.ts';
import { startNewGame } from './title.ts';
import { walkUntil } from './walk.ts';

// What the scripted fake Shift Customer at the till says in the ja pack (mock mode).
const WANTS_A_BAG = '袋をお願いします。';
const HAS_A_POINTS_CARD = 'ポイントカードあります。';
const FROM_BEHIND = /あと、(.+?)をひとつください。/;
const PAYS_CASH = /(¥[\d,]+)でお願いします。/;
// The ja pack's coins and notes, largest first.
const YEN = [10000, 5000, 1000, 500, 100, 50, 10, 5, 1];

const closingCard = (page: Page) => column(page).getByRole('region', { name: 'Conversation over' });
const till = (page: Page) => column(page).getByRole('region', { name: 'Till' });
const lastNpcLine = (page: Page) => chat(page).getByRole('button', { name: /^Replay “/ }).last();
const yen = (text: string) => Number(text.replace(/[¥,]/g, ''));

/** A new game (Japanese, from B1) inside the supermarket's door at 10:00, hired as a cashier (F at the cashier, as Sam), then at the staff door. */
async function hiredAtTheStaffDoor(page: Page) {
  // From B1, most customers come from the cashier's I template: cash, and something from behind the counter.
  await startNewGame(page, { path: '/?spawn=supermarket&at=10', level: 2 });
  await page.locator('canvas').click();
  await walkUntil(page, 'KeyA', 'to ask for work');
  await page.keyboard.press('KeyF');
  for (const line of ['仕事はありますか？', 'Sam', '明日から', 'はい']) await typeLine(page, line);
  await expect(closingCard(page)).toContainText('You got the job: Cashier');
  await closingCard(page).getByRole('button', { name: 'Skip Recap' }).click();
  await walkUntil(page, 'KeyA', 'to start a shift — Cashier');
}

/** What the customer at the till said they want, read from their line. */
async function whatTheyWant(page: Page) {
  await expect(lastNpcLine(page)).toBeVisible();
  const said = (await lastNpcLine(page).getAttribute('aria-label')) ?? '';
  return {
    bag: said.includes(WANTS_A_BAG),
    pointsCard: said.includes(HAS_A_POINTS_CARD),
    fromBehind: said.match(FROM_BEHIND)?.[1] ?? null,
    cash: said.match(PAYS_CASH)?.[1] ?? null,
  };
}

/** Scans everything on the counter, fetches what they asked for, sets the toggles and counts out their change. */
async function checkOut(page: Page, wants: Awaited<ReturnType<typeof whatTheyWant>>, { bagWrong = false } = {}) {
  const counter = till(page).getByRole('group', { name: 'On the counter' });
  for (const item of await counter.getByRole('button').all()) {
    const times = Number((await item.textContent())!.match(/×(\d+)$/)![1]);
    for (let i = 0; i < times; i++) await item.click();
  }
  if (wants.fromBehind) await till(page).getByRole('group', { name: 'Behind the counter' }).getByRole('button', { name: new RegExp(`^${wants.fromBehind}`) }).click();
  if (wants.bag !== bagWrong) await till(page).getByRole('button', { name: 'Bag', exact: true }).click();
  if (wants.pointsCard) await till(page).getByRole('button', { name: 'Points card' }).click();
  if (wants.cash) {
    await till(page).getByRole('textbox', { name: 'Cash handed over' }).fill(String(yen(wants.cash)));
    let due = yen((await till(page).getByText(/^Change due: /).textContent())!.replace('Change due: ', ''));
    const coins = till(page).getByRole('group', { name: 'Coins and notes' });
    for (const coin of YEN) {
      for (; due >= coin; due -= coin) await coins.getByRole('button', { name: `¥${coin.toLocaleString('en')}`, exact: true }).click();
    }
  }
  await till(page).getByRole('button', { name: 'Finish sale' }).click();
}

test('a cashier Shift: hired at the supermarket, scanning, bag and points card, fetching and change, paid with one Recap', async ({ page }) => {
  test.setTimeout(150_000);
  await hiredAtTheStaffDoor(page);
  await page.keyboard.press('KeyE');
  await expect(column(page)).toContainText(/Customer 1 of \d+/);
  const count = Number((await column(page).textContent())!.match(/Customer 1 of (\d+)/)![1]);

  for (let customer = 1; customer <= count; customer++) {
    await expect(column(page)).toContainText(`Customer ${customer} of ${count}`);
    // The first customer's bag is got wrong; everyone else's sale is right.
    await checkOut(page, await whatTheyWant(page), { bagWrong: customer === 1 });
    if (customer < count) await expect(column(page)).toContainText(`Customer ${customer + 1} of ${count}`, { timeout: 10_000 });
  }

  const shiftEnd = page.getByRole('dialog', { name: /Shift over/ });
  await expect(shiftEnd).toBeVisible({ timeout: 10_000 });
  await expect(shiftEnd).toContainText(`Customers served right: ${count - 1} of ${count}`);
  await expect(shiftEnd).toContainText('Pay: ¥');
  await expect(shiftEnd.getByRole('region', { name: 'Recap' })).toContainText('Shift — Cashier', { timeout: 10_000 });
});
