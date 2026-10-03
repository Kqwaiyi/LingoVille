import js from '@eslint/js';
import importPlugin from 'eslint-plugin-import';
import globals from 'globals';
import tseslint from 'typescript-eslint';

const sim = './src/sim';
const pureModules = [sim, './src/content', './src/ai'];
const presentationModules = ['./src/world', './src/ui', './src/voice'];

export default tseslint.config(
  { ignores: ['dist', 'node_modules', 'test-results', 'playwright-report'] },
  js.configs.recommended,
  tseslint.configs.recommended,
  {
    files: ['**/*.{ts,tsx}'],
    plugins: { import: importPlugin },
    languageOptions: { globals: { ...globals.browser, ...globals.node } },
    settings: {
      'import/resolver': { typescript: { project: 'tsconfig.json' } },
    },
    rules: {
      'import/no-restricted-paths': [
        'error',
        {
          zones: [
            {
              target: pureModules,
              from: presentationModules,
              message: 'sim, content and ai are pure: they must not import world, ui or voice.',
            },
            {
              target: './src',
              from: './server',
              message: 'Browser code must not import the gateway. Talk to it over /api.',
            },
            {
              target: ['./src', './server'],
              from: './evals',
              message: 'evals never ships: app and gateway code must not import it.',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['src/sim/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['react', 'react-dom', 'react/*', 'react-dom/*', 'three', 'three/*', '@react-three/*'],
              message: 'sim is pure TypeScript: no React or Three.',
            },
          ],
        },
      ],
    },
  },
);
