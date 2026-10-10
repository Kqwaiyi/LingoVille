import { expect, type Page } from '@playwright/test';

export const titleMenu = (page: Page) => page.getByRole('navigation', { name: 'Title menu' });

/** Reloads the page and picks Continue on the title screen. */
export async function reloadAndContinue(page: Page) {
  await page.reload();
  await titleMenu(page).getByRole('button', { name: 'Continue' }).click();
  await expect(titleMenu(page)).toBeHidden();
}

/** Each language as its choice in setup is named: by its own name. */
const ENDONYMS = { ja: '日本語', zh: '中文', en: 'English', de: 'Deutsch' } as const;
export type Language = keyof typeof ENDONYMS;

/** A choice in setup by the language it names. */
export const languageChoice = (page: Page, language: Language) => page.getByRole('radio', { name: new RegExp(`^${ENDONYMS[language]}`) });

export type NewGame = {
  path?: string;
  /** The Native Language to choose, if not the one pre-selected (English in the smoke's browser). */
  native?: Language;
  target?: Language;
  /** Which self-description, from 0 (A1) to 3 (B2). */
  level?: number;
  name?: string;
  /** Which Appearance Preset, from 0. */
  look?: number;
  /** Tick Skip tutorial on the mic check, so the game starts without the First Morning. */
  skipTutorial?: boolean;
  /** Go through the title screen and setup instead of the `?newGame` shortcut, for a test about those screens. */
  throughScreens?: boolean;
};

/**
 * Starts a new game: by default Sam, learning Japanese from A1, in the first
 * Appearance Preset. Straight into the First Morning through the dev-only `?newGame`
 * shortcut, which takes only the Target Language. Answers it can't carry, or
 * `throughScreens`, go through the title screen and setup instead, by keyboard
 * and in whatever language the UI is in.
 */
export async function startNewGame(page: Page, { path = '/', throughScreens = false, ...answers }: NewGame = {}) {
  const { native, target = 'ja', level = 0, name = 'Sam', look = 0, skipTutorial = false } = answers;
  if (!throughScreens && (native ?? 'en') === 'en' && level === 0 && name === 'Sam' && look === 0 && !skipTutorial) {
    const url = new URL(path, 'http://localhost');
    url.searchParams.set('newGame', target);
    await page.goto(url.pathname + url.search);
    await expect(page.getByRole('region', { name: 'Dock' })).toBeVisible();
    return;
  }
  await page.goto(path);
  await titleMenu(page).getByRole('button', { name: 'New game' }).click();
  await goThroughSetup(page, answers);
}

/** From the Native Language screen, through the rest of setup to the First Morning, skipping the mic check if it shows. */
export async function goThroughSetup(
  page: Page,
  { native, target = 'ja', level = 0, name = 'Sam', look = 0, skipTutorial = false }: Omit<NewGame, 'path'> = {},
) {
  const choices = page.getByRole('radio');
  const nameField = page.getByRole('textbox');

  // Enter on a choice goes on to the next screen, and in the name field too.
  await (native ? languageChoice(page, native).check() : expect(choices.first()).toBeVisible());
  await page.keyboard.press('Enter');
  await expect(choices).toHaveCount(3);
  await languageChoice(page, target).check();
  await page.keyboard.press('Enter');
  await expect(nameField).toBeVisible();
  await choices.nth(level).check();
  await nameField.fill(name);
  await nameField.press('Enter');
  await expect(nameField).toBeHidden();
  await choices.nth(look).check();
  await page.keyboard.press('Enter');
  await expect(choices).toHaveCount(0);
  // The mic check, unless this browser has passed it: Skip has focus, so Enter skips it.
  const skipTutorialBox = page.getByRole('checkbox');
  if (!(await skipTutorialBox.isVisible())) return;
  if (skipTutorial) {
    await skipTutorialBox.check();
    // From the box, past Back, to Skip.
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');
  }
  await page.keyboard.press('Enter');
  await expect(skipTutorialBox).toBeHidden();
}
