import { test as base, expect } from '@playwright/test';

export { expect, type Locator, type Page } from '@playwright/test';

/**
 * Playwright's `test`, failing any test whose page throws an uncaught error. A crash in the 3D scene otherwise shows
 * only as some later step timing out; this names it.
 */
export const test = base.extend<{ uncaughtErrors: void }>({
  uncaughtErrors: [
    async ({ page }, use) => {
      const errors: string[] = [];
      page.on('pageerror', (error) => errors.push(error.stack ?? error.message));
      await use();
      expect(errors, 'uncaught errors in the page').toEqual([]);
    },
    { auto: true },
  ],
});
