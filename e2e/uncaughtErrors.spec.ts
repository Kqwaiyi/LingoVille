import { expect, test } from './test.ts';

// The guardrail in ./test.ts, proved: a page that throws fails its test, even when every step passes.
test('an uncaught error in the page fails the test', async ({ page }) => {
  test.fail();
  await page.setContent('<p>Ready</p>');
  await expect(page.getByText('Ready')).toBeVisible();
  const crashed = page.waitForEvent('pageerror');
  await page.evaluate(() => setTimeout(() => { throw new Error('the scene crashed'); }));
  await crashed;
});
