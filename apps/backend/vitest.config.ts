import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    passWithNoTests: true,
    setupFiles: ['./src/__tests__/setup.ts'],
    // Integration tests share a single test DB — run in a single worker so
    // beforeEach resets cannot race against each other across test files.
    pool: 'forks',
    poolOptions: {
      forks: {
        singleFork: true,
      },
    },
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      exclude: ['src/index.ts', 'src/__tests__/**', '**/node_modules/**', '**/dist/**'],
    },
  },
});
