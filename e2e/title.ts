import { expect, type Page } from '@playwright/test';

export const titleMenu = (page: Page) => page.getByRole('navigation', { name: 'Title menu' });

/**
 * Loads the page, picks New game on the title screen and goes on from the
 * Native Language screen with the language it pre-selects (English in the
 * smoke's browser): the First Morning, from the dev setup.
 */
export async function startNewGame(page: Page, path = '/') {
  await page.goto(path);
  await titleMenu(page).getByRole('button', { name: 'New game' }).click();
  const next = page.getByRole('button', { name: 'Next' });
  await next.click();
  await expect(next).toBeHidden();
}
