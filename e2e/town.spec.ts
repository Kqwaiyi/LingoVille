import { expect, test, type Page } from '@playwright/test';
import { tramTripMinutes } from '../src/sim/index.ts';
import { dock } from './barista.ts';
import { startNewGame } from './title.ts';

const placeLine = (page: Page) => page.getByRole('status', { name: 'Place' });
const tramChoice = (page: Page) => page.getByRole('dialog', { name: 'Take the tram to…' });
const minutesOf = (time: string) => Number(time.slice(0, 2)) * 60 + Number(time.slice(3, 5));

test('takes the tram for free: time passes and the Character gets off at the chosen stop', async ({ page }) => {
  // `?spawn=tram-stop` puts the Character on the Old Town platform, the first stop on the line.
  await startNewGame(page, { path: '/?spawn=tram-stop&at=9' });
  const money = await dock(page).getByLabel('Money').textContent();
  await page.locator('canvas').click();
  await expect(page.getByText('to take the tram')).toBeVisible({ timeout: 5_000 });
  await expect(placeLine(page)).toContainText('Tram stop');

  await page.keyboard.press('KeyE');
  await expect(tramChoice(page)).toContainText('Old Town');
  await expect(tramChoice(page).getByRole('button', { name: /Town Centre/ })).toContainText(`${tramTripMinutes(1)} min · Free`);
  const before = minutesOf((await dock(page).getByLabel('Time').textContent())!);
  await tramChoice(page).getByRole('button', { name: /Market Street/ }).click();

  await expect(tramChoice(page)).toBeHidden();
  const after = minutesOf((await dock(page).getByLabel('Time').textContent())!);
  expect(after - before).toBeGreaterThanOrEqual(tramTripMinutes(2));
  await expect(dock(page).getByLabel('Money')).toHaveText(money!);
  await expect(placeLine(page)).toContainText('Tram stop');

  // From Market Street, the line runs back the other way.
  await page.locator('canvas').click();
  await page.keyboard.press('KeyE');
  await expect(tramChoice(page).getByRole('button', { name: /Old Town/ })).toBeVisible();
  await expect(tramChoice(page).getByRole('button', { name: /Market Street/ })).toBeHidden();
  await page.keyboard.press('Escape');
  await expect(tramChoice(page)).toBeHidden();
});

test('outside the trams’ hours, the stop says no tram is running', async ({ page }) => {
  await startNewGame(page, { path: '/?spawn=tram-stop&at=3' });
  await page.locator('canvas').click();
  await expect(page.getByText('No tram is running · Trams run 06:00–01:00')).toBeVisible({ timeout: 5_000 });
  await page.keyboard.press('KeyE');
  await expect(tramChoice(page)).toBeHidden();

  // No one waits for a tram at night, so nothing stands between the Character and that line, all along the platform.
  await page.keyboard.down('KeyD');
  await page.waitForTimeout(1_000);
  await page.keyboard.up('KeyD');
  await expect(page.getByText('No tram is running')).toBeVisible();
});

test('each place has its staff: Press E near the bookshop’s shopkeeper', async ({ page }) => {
  await startNewGame(page, { path: '/?spawn=bookshop&at=10' });
  await expect(placeLine(page)).toContainText('Bookshop');
  await page.locator('canvas').click();
  await page.keyboard.down('KeyW');
  await expect(page.getByText('to talk — shopkeeper')).toBeVisible({ timeout: 5_000 });
  await page.keyboard.up('KeyW');

  // The shopkeeper has nothing to talk about until a later ticket gives them a conversation.
  await page.keyboard.press('KeyE');
  await expect(page.getByText('The shopkeeper smiles and nods.')).toBeVisible();
});

test('the place line follows the Character walking out of a shop onto the tram platform', async ({ page }) => {
  await startNewGame(page, { path: '/?spawn=bookshop&at=10' });
  await expect(placeLine(page)).toContainText('Bookshop');
  await page.locator('canvas').click();
  // Back out through the door, across the pavement and onto the Old Town platform.
  await page.keyboard.down('KeyS');
  await expect(placeLine(page)).toContainText('Tram stop', { timeout: 5_000 });
  await page.keyboard.up('KeyS');
});
