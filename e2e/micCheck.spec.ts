import { expect, test, type Page } from './test.ts';
import { column, field, GREETING, npcLine, typeLine } from './barista.ts';
import { languageChoice, titleMenu } from './title.ts';
import { walkUntil } from './walk.ts';

const heading = (page: Page) => page.getByRole('heading', { name: 'Let’s check your mic' });
const button = (page: Page, name: string) => page.getByRole('button', { name, exact: true });
const status = (page: Page, text: string) => page.getByRole('status').filter({ hasText: text });

/** From now on the browser refuses the mic, as if the Player had said no. */
async function refuseTheMic(page: Page) {
  await page.addInitScript(() => {
    navigator.mediaDevices.getUserMedia = () => Promise.reject(new DOMException('Permission denied', 'NotAllowedError'));
  });
}

/** New game, through setup's other screens to the mic check, at the café door. */
async function toTheMicCheck(page: Page) {
  await page.goto('/?spawn=cafe');
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

test('a refused mic lands in the Typed Fallback, with nothing locked', async ({ page }) => {
  await refuseTheMic(page);
  await toTheMicCheck(page);

  await expect(status(page, 'No mic to use, so you’ll type your replies instead.')).toBeVisible();
  await expect(page.getByRole('meter', { name: 'Mic level' })).toBeHidden();
  await button(page, 'Start').click();

  // At the counter, the mic is off and the order goes through typed.
  await page.locator('canvas').click();
  await walkUntil(page, 'KeyW', 'to talk — barista');
  await page.keyboard.press('KeyE');
  await expect(npcLine(page, GREETING)).toBeVisible();
  await expect(column(page).getByText('🎤 off')).toBeVisible();
  await expect(column(page).getByRole('button', { name: 'Hold to talk (Space)' })).toBeHidden();

  await typeLine(page, 'ホットラテ ください');
  await expect(npcLine(page, 'ホットラテですね。450円です。よろしいですか？')).toBeVisible();
  await typeLine(page, 'はい');
  await expect(column(page).getByRole('region', { name: 'Conversation over' })).toBeVisible();
  await expect(field(page)).toBeHidden();
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
