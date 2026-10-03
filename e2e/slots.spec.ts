import { expect, test, type Page } from '@playwright/test';
import { dock } from './barista.ts';
import { startNewGame, titleMenu } from './title.ts';

const panel = (page: Page, name: string) => page.getByRole('region', { name });
const slotRow = (page: Page, slot: number) => panel(page, 'Load a save').getByRole('listitem').nth(slot - 1);

/** Starts a new game and waits for it to be saved, then reloads to the title screen. */
async function newGameSavedThenReload(page: Page) {
  await startNewGame(page);
  await expect(dock(page).getByText('Saved ✓')).toBeVisible();
  await page.reload();
}

async function openLoadASave(page: Page) {
  await titleMenu(page).getByRole('button', { name: 'Load a save' }).click();
  await expect(panel(page, 'Load a save')).toBeVisible();
}

/** Exports slot 1 and returns where the file was saved. */
async function exportSlotOne(page: Page) {
  await slotRow(page, 1).getByRole('button', { name: 'More for slot 1' }).click();
  const download = page.waitForEvent('download');
  await slotRow(page, 1).getByRole('menuitem', { name: 'Export' }).click();
  return download;
}

/** Writes stored bytes straight into the browser's saves, as damage would. */
async function plantSave(page: Page, key: string, value: unknown) {
  await page.evaluate(
    ([key, value]) =>
      new Promise<void>((resolve, reject) => {
        const open = indexedDB.open('insomniacs-saves');
        open.onsuccess = () => {
          const tx = open.result.transaction('saves', 'readwrite');
          tx.objectStore('saves').put(value, key as string);
          tx.oncomplete = () => resolve();
          tx.onerror = () => reject(tx.error);
        };
      }),
    [key, value] as const,
  );
}

test('Load a save shows a card per slot, and a save can be exported, deleted by name, and imported back', async ({ page }) => {
  await newGameSavedThenReload(page);
  await openLoadASave(page);
  await expect(slotRow(page, 1)).toContainText('Sam · Japanese');
  await expect(slotRow(page, 1)).toContainText('Day 1 at home');
  await expect(slotRow(page, 1)).toContainText('¥10,200');
  await expect(slotRow(page, 2)).toContainText('Empty · New game or Import');

  const download = await exportSlotOne(page);
  expect(download.suggestedFilename()).toBe('insomniacs-Sam-ja-day1.json');
  const file = await download.path();

  await slotRow(page, 1).getByRole('button', { name: 'More for slot 1' }).click();
  await slotRow(page, 1).getByRole('menuitem', { name: 'Delete' }).click();
  const confirm = page.getByRole('alertdialog', { name: 'Delete Sam’s save?' });
  await confirm.getByRole('textbox').fill('Someone');
  await expect(confirm.getByRole('button', { name: 'Delete' })).toBeDisabled();
  await confirm.getByRole('textbox').fill('Sam');
  await confirm.getByRole('button', { name: 'Delete' }).click();
  await expect(slotRow(page, 1)).toContainText('Empty · New game or Import');
  await expect(titleMenu(page).getByRole('button', { name: 'Continue' })).toHaveCount(0);

  await page.getByLabel('Save file to import').setInputFiles(file);
  await expect(page.getByText('Imported into slot 1.')).toBeVisible();
  await titleMenu(page).getByRole('button', { name: 'Continue' }).click();
  await expect(titleMenu(page)).toBeHidden();
  await expect(dock(page).getByLabel('Money')).toHaveText('¥10,200');
});

test('a bad file is refused with a plain message', async ({ page }) => {
  await page.goto('/');
  await titleMenu(page).getByRole('button', { name: 'Import a save' }).hover();

  await page.getByLabel('Save file to import').setInputFiles({ name: 'notes.json', mimeType: 'application/json', buffer: Buffer.from('{"hello":1}') });

  await expect(page.getByText('That file isn’t an Insomniacs save.')).toBeVisible();
});

test('with all 4 slots full, New game is greyed out', async ({ page }) => {
  await newGameSavedThenReload(page);
  await openLoadASave(page);
  const file = await (await exportSlotOne(page)).path();
  for (const slot of [2, 3, 4]) {
    await page.getByLabel('Save file to import').setInputFiles(file);
    await expect(page.getByText(`Imported into slot ${slot}.`)).toBeVisible();
  }

  await expect(titleMenu(page).getByRole('button', { name: 'New game' })).toBeDisabled();
  await expect(titleMenu(page).getByText('Delete a save to start a new one')).toBeVisible();
});

test('a damaged save falls back to this morning’s, and then to Export raw and Delete', async ({ page }) => {
  await newGameSavedThenReload(page);
  await plantSave(page, 'slot-1', { schemaVersion: 2, lastPlayedAt: new Date().toISOString(), game: { garbled: true } });
  await page.reload();

  await expect(panel(page, 'Continue')).toContainText('Loads this morning’s save');
  await titleMenu(page).getByRole('button', { name: 'Continue' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Loaded this morning’s save' })).toBeVisible();

  await plantSave(page, 'slot-1', 'garbled');
  await plantSave(page, 'slot-1/start-of-day', 'garbled');
  await page.reload();
  await expect(panel(page, 'Continue')).toContainText('This save couldn’t be loaded');
  const download = page.waitForEvent('download');
  await panel(page, 'Continue').getByRole('button', { name: 'Export raw' }).click();
  expect((await download).suggestedFilename()).toBe('insomniacs-slot-1-raw.json');
  await expect(panel(page, 'Continue').getByRole('button', { name: 'Delete' })).toBeVisible();
});

test('when the browser won’t keep saves, a callout says so until it is dismissed', async ({ page }) => {
  await page.addInitScript(() => {
    navigator.storage.persist = async () => false;
    navigator.storage.persisted = async () => false;
  });
  const callout = page.getByRole('complementary', { name: 'Keeping your saves' });

  await startNewGame(page);
  await expect(callout).toBeVisible();

  // Back on the title screen after a reload, it still shows until it is dismissed.
  await page.reload();
  await expect(callout).toBeVisible();
  await callout.getByRole('button', { name: 'Got it' }).click();
  await expect(callout).toBeHidden();

  await page.reload();
  await expect(titleMenu(page).getByRole('button', { name: 'Continue' })).toBeVisible();
  await expect(callout).toBeHidden();
});
