import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['{src,server,evals,tooling}/**/*.test.{ts,tsx}'],
    environment: 'node',
  },
});
