import { expect, test, type Page } from '@playwright/test';
import { column, dock, npcLine, typeLine, walkToTheBarista } from './barista.ts';

const money = (page: Page) => dock(page).getByLabel('Money');
const closingCard = (page: Page) => column(page).getByRole('region', { name: 'Conversation over' });
const signTooltip = (page: Page) => page.getByRole('complementary', { name: 'Sign' });

// What the scripted fake barista says in each pack (mock mode), and what a latte costs there.
const PACKS = [
  {
    pack: 'zh',
    greeting: '欢迎光临！您想喝点什么？',
    order: '我要拿铁',
    readBack: '一杯热拿铁，18元。对吗？',
    yes: '好',
    served: '好的，这是您的饮料。欢迎下次光临！',
    before: '400元',
    card: 'Hot latte · −18元 · Mood ↑',
    after: '382元',
  },
  {
    pack: 'en',
    greeting: 'Hiya! What can I get you?',
    order: 'A latte, please',
    readBack: "One latte, that's £4.50. Is that right?",
    yes: 'yes',
    served: 'Lovely, here you go. Have a nice day!',
    before: '£100',
    // The en pack has no English glosses: an English speaker reads the menu as it is.
    card: 'Latte · −£4.50 · Mood ↑',
    after: '£95.50',
  },
  {
    pack: 'de',
    greeting: 'Hallo! Was darf’s sein?',
    order: 'Einen Latte, bitte',
    readBack: 'Einmal Latte macchiato für 4,50 €, richtig?',
    yes: 'ja',
    served: 'Bitte schön! Einen schönen Tag noch!',
    before: '100 €',
    card: 'Latte macchiato · −4,50 € · Mood ↑',
    after: '95,50 €',
  },
];

for (const p of PACKS) {
  test(`the café works in the ${p.pack} pack: local menu, local prices, local money`, async ({ page }) => {
    await walkToTheBarista(page, p.pack);
    await expect(money(page)).toHaveText(p.before);
    await page.keyboard.press('KeyE');
    await expect(npcLine(page, p.greeting)).toBeVisible();

    await typeLine(page, p.order);
    await expect(npcLine(page, p.readBack)).toBeVisible();
    await typeLine(page, p.yes);
    await expect(npcLine(page, p.served)).toBeVisible();

    await expect(closingCard(page).getByText(p.card)).toBeVisible();
    await expect(money(page)).toHaveText(p.after);
  });
}

/** Sweeps the pointer across the scene, right of centre first where the menu board hangs, until a sign's tooltip shows. */
async function pointAtASign(page: Page) {
  const box = (await page.locator('canvas').boundingBox())!;
  for (const fy of [0.35, 0.3, 0.4, 0.25, 0.45, 0.2, 0.5]) {
    for (const fx of [0.6, 0.65, 0.7, 0.55, 0.75, 0.5, 0.8, 0.45, 0.4]) {
      await page.mouse.move(box.x + box.width * fx, box.y + box.height * fy);
      try {
        await expect(signTooltip(page)).toBeVisible({ timeout: 150 });
        return;
      } catch {
        // Nothing here; try the next spot.
      }
    }
  }
  throw new Error('No sign found under the pointer');
}

test('pointing at a sign shows its pinyin, and Translate shows what it means', async ({ page }) => {
  await walkToTheBarista(page, 'zh');
  await pointAtASign(page);

  await expect(signTooltip(page).locator('ruby rt').first()).toBeVisible();
  await expect(signTooltip(page).locator('.sign-gloss')).toHaveCount(0);

  await signTooltip(page).getByRole('button', { name: 'Translate' }).click();
  await expect(signTooltip(page).locator('.sign-gloss').first()).toBeVisible();
  await expect(signTooltip(page).getByRole('button', { name: 'Translate' })).toBeHidden();
});
