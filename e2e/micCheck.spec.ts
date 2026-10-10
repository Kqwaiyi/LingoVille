import { expect, test, type Page } from './test.ts';
import { languageChoice, refuseTheMic, titleMenu } from './title.ts';

const heading = (page: Page) => page.getByRole('heading', { name: 'Let’s check your mic' });
const button = (page: Page, name: string) => page.getByRole('button', { name, exact: true });
const status = (page: Page, text: string) => page.getByRole('status').filter({ hasText: text });

/** New game, through setup's other screens to the mic check. */
async function toTheMicCheck(page: Page) {
  await page.goto('/');
  await titleMenu(page).getByRole('button', { name: 'New game' }).click();
  await button(page, 'Next').click();
  await languageChoice(page, 'ja').check();
  await button(page, 'Next').click();
  await page.getByRole('radio').first().check();
  await page.getByRole('textbox').fill('Sam');
  await button(page, 'Next').click();
  await button(page, 'Next').click();
  await expect(heading(page)).toBeVisible();
}

// The order at the counter that follows, typed with nothing locked, is the first session's smoke (`smoke.spec.ts`).
test('a refused mic lands in the Typed Fallback', async ({ page }) => {
  await refuseTheMic(page);
  await toTheMicCheck(page);

  await expect(status(page, 'No mic to use, so you’ll type your replies instead.')).toBeVisible();
  await expect(page.getByRole('meter', { name: 'Mic level' })).toBeHidden();
  await button(page, 'Start').click();

  await expect(page.getByRole('region', { name: 'Dock' })).toBeVisible();
});

test('a browser that has passed the mic check skips it on its next New game', async ({ page }) => {
  await toTheMicCheck(page);
  await expect(status(page, 'Heard you! Your mic works.')).toBeVisible();
  await button(page, 'Start').click();

  await page.goto('/');
  await titleMenu(page).getByRole('button', { name: 'New game' }).click();
  await button(page, 'Next').click();
  await languageChoice(page, 'zh').check();
  await button(page, 'Next').click();
  await page.getByRole('radio').first().check();
  await page.getByRole('textbox').fill('Mika');
  await button(page, 'Next').click();

  // The appearance is now the last screen, with Skip tutorial.
  await expect(page.getByRole('checkbox', { name: 'Skip the tutorial' })).toBeVisible();
  await button(page, 'Start').click();
  await expect(heading(page)).toBeHidden();
  await expect(page.getByRole('region', { name: 'Dock' })).toBeVisible();
  // The mic is still the input mode.
  await expect(page.getByText('🎤 off')).toBeHidden();
});
