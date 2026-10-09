import { expect, test, type Page } from './test.ts';
import { chat, column, typeLine, walkToTheBarista } from './barista.ts';
import { walkUntil } from './walk.ts';

// Typed to the scripted fake NPC (mock mode), this drops its connection.
const MOCK_DROP = '#drop';

// The ja pack's café drinks, as the scripted fake Shift Customer (mock mode) orders them.
const DRINKS = ['ホットラテ', 'ブレンドコーヒー', '紅茶'] as const;

const closingCard = (page: Page) => column(page).getByRole('region', { name: 'Conversation over' });
const menu = (page: Page) => column(page).getByRole('region', { name: 'Menu' });
const lastNpcLine = (page: Page) => chat(page).getByRole('button', { name: /^Replay “/ }).last();

/** Asks the barista for work with F and is hired as Sam, the setup name. */
async function getHired(page: Page) {
  await walkToTheBarista(page);
  await page.keyboard.press('KeyF');
  await typeLine(page, '仕事はありますか？');
  await typeLine(page, 'Sam');
  await typeLine(page, '明日から');
  await typeLine(page, 'はい');
  await expect(closingCard(page)).toContainText('You got the job: Barista');
  await closingCard(page).getByRole('button', { name: 'Skip Recap' }).click();
}

/** Goes to the staff door, in the west wall level with the counter, and starts a Shift with E. Returns how many customers it has. */
async function startAShift(page: Page) {
  await walkUntil(page, 'KeyA', 'to start a shift — Barista');
  await page.keyboard.press('KeyE');
  await expect(column(page)).toContainText(/Customer 1 of \d+/);
  return Number((await column(page).textContent())!.match(/Customer 1 of (\d+)/)![1]);
}

/**
 * What the customer at the counter has just ordered, read from their last line: the drink, and how it's made if
 * they said (the scripted fake says a drink made to order as "紅茶 (Lサイズ, アイス, レモン)").
 */
async function orderedDrink(page: Page) {
  await expect(lastNpcLine(page)).toBeVisible();
  const said = (await lastNpcLine(page).getAttribute('aria-label')) ?? '';
  const drink = DRINKS.find((name) => said.includes(name));
  if (!drink) throw new Error(`No drink in the customer's line: ${said}`);
  const made = said.match(new RegExp(`${drink} \\((.+?)\\)`))?.[1]!.split(', ') ?? [];
  return { drink, made };
}

/** Sets the modifier toggles to make the drink as it was ordered, and taps it onto the tray. */
async function tapOrder(page: Page, { drink, made }: { drink: string; made: string[] }) {
  // The toggles start at a medium hot drink with nothing added: pressing each option the customer said sets it.
  for (const option of made) await menu(page).getByRole('button', { name: new RegExp(`^${option} \\(`) }).click();
  await menu(page).getByRole('button', { name: new RegExp(`^${drink}`) }).click();
}

test('a Shift at the café: E at the staff door, customers order a drink each, and the Shift pays with one Recap', async ({ page }) => {
  test.setTimeout(120_000);
  await getHired(page);
  const count = await startAShift(page);

  // Asking the first customer to say it again: they repeat their order.
  const first = await orderedDrink(page);
  await typeLine(page, 'もう一度お願いします');
  await expect(chat(page).getByRole('button', { name: /^Replay “/ })).toHaveCount(2);
  expect(await orderedDrink(page)).toEqual(first);

  for (let customer = 1; customer <= count; customer++) {
    await expect(column(page)).toContainText(`Customer ${customer} of ${count}`);
    const order = await orderedDrink(page);
    const wrongDrink = DRINKS.find((name) => name !== order.drink)!;
    if (customer === 1) {
      // The first customer gets the wrong drink; everyone else gets theirs.
      await menu(page).getByRole('button', { name: new RegExp(`^${wrongDrink}`) }).click();
    } else {
      // A wrong tap is undone, and redone and undone again, before the right drink goes on the tray.
      await menu(page).getByRole('button', { name: new RegExp(`^${wrongDrink}`) }).click();
      await menu(page).getByRole('button', { name: 'Undo' }).click();
      await expect(menu(page).getByRole('status', { name: 'Tray' })).toContainText('Tap what they ordered');
      await menu(page).getByRole('button', { name: 'Redo' }).click();
      await expect(menu(page).getByRole('status', { name: 'Tray' })).toContainText(wrongDrink);
      await menu(page).getByRole('button', { name: 'Undo' }).click();
      await tapOrder(page, order);
    }
    await menu(page).getByRole('button', { name: 'Serve' }).click();
    if (customer < count) await expect(column(page)).toContainText(`Customer ${customer + 1} of ${count}`, { timeout: 10_000 });
  }

  const shiftEnd = page.getByRole('dialog', { name: /Shift over/ });
  await expect(shiftEnd).toBeVisible({ timeout: 10_000 });
  await expect(shiftEnd).toContainText(`Customers served right: ${count - 1} of ${count}`);
  await expect(shiftEnd).toContainText('Pay: ¥');
  await expect(column(page)).toBeHidden();
  // One combined Recap for the whole Shift opens with the pay, as a Journal page.
  const recap = shiftEnd.getByRole('region', { name: 'Recap' });
  await expect(recap.getByRole('article', { name: 'Journal page' })).toBeVisible({ timeout: 10_000 });
  await expect(recap).toContainText('Shift — Barista');

  await shiftEnd.getByRole('button', { name: 'Done', exact: true }).click();
  await expect(shiftEnd).toBeHidden();

  // It's kept in the Journal as one entry.
  await page.keyboard.press('KeyJ');
  await expect(page.getByText(/Shift — Barista/).first()).toBeVisible();
});

test('a Shift Customer lost to the network steps away and is replaced, and doesn’t count', async ({ page }) => {
  test.setTimeout(90_000);
  await getHired(page);
  const count = await startAShift(page);
  const first = await orderedDrink(page);

  // The first drop is retried with a fresh session: the same customer says their order again.
  await typeLine(page, MOCK_DROP);
  await expect(chat(page).getByRole('button', { name: new RegExp(`^Replay “${first.drink}`) })).toBeVisible({ timeout: 10_000 });
  // The second can't be recovered: they step away, and a new customer walks up in their place.
  await typeLine(page, MOCK_DROP);

  await expect(page.getByRole('status').filter({ hasText: 'The customer had to step away' })).toBeVisible({ timeout: 10_000 });
  await expect(column(page)).toContainText(`Customer 1 of ${count}`);
  await expect(chat(page).getByRole('button', { name: /^Replay “/ })).toHaveCount(1);
  await orderedDrink(page);
});
