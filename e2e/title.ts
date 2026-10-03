import { expect, type Page } from '@playwright/test';

export const titleMenu = (page: Page) => page.getByRole('navigation', { name: 'Title menu' });

/** Loads the page and picks New game on the title screen: the First Morning, from the dev setup. */
export async function startNewGame(page: Page, path = '/') {
  await page.goto(path);
  await titleMenu(page).getByRole('button', { name: 'New game' }).click();
  await expect(titleMenu(page)).toBeHidden();
}
