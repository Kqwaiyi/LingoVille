import { ESLint } from 'eslint';
import { describe, expect, it } from 'vitest';

// Proves the import boundaries by linting deliberate violations as if they
// lived in the repo. The imported files must exist for the resolver to see them.
const eslint = new ESLint();

async function boundaryErrors(filePath: string, code: string) {
  const [result] = await eslint.lintText(code, { filePath });
  return (result?.messages ?? []).filter((m) =>
    ['import/no-restricted-paths', 'no-restricted-imports'].includes(m.ruleId ?? ''),
  );
}

describe('import boundaries', () => {
  it.each(['src/sim/violation.ts', 'src/content/violation.ts', 'src/ai/violation.ts'])(
    '%s may not import ui, world or voice',
    async (filePath) => {
      const errors = await boundaryErrors(
        filePath,
        [
          "export { App } from '../ui/App.tsx';",
          "export * from '../world/index.ts';",
          "export * from '../voice/index.ts';",
        ].join('\n'),
      );
      expect(errors).toHaveLength(3);
    },
  );

  it('lets sim import its own modules', async () => {
    expect(await boundaryErrors('src/sim/fine.ts', "export { METER_MAX } from './tuning.ts';")).toEqual([]);
  });

  it('lets ui import sim', async () => {
    expect(await boundaryErrors('src/ui/fine.ts', "export { METER_MAX } from '../sim/index.ts';")).toEqual([]);
  });

  it('keeps sim free of React and Three', async () => {
    const errors = await boundaryErrors(
      'src/sim/violation.ts',
      "import 'react';\nimport 'three';",
    );
    expect(errors).toHaveLength(2);
  });

  it('keeps the gateway (and so the Gemini key) out of browser code', async () => {
    const errors = await boundaryErrors('src/ui/violation.ts', "export * from '../../server/config.ts';");
    expect(errors).toHaveLength(1);
  });

  it('keeps evals out of shipped code', async () => {
    const errors = await boundaryErrors('src/store/violation.ts', "export * from '../../evals/index.ts';");
    expect(errors).toHaveLength(1);
  });
});
