import { defineConfig } from 'vitest/config';

//Config for the integration tests. These use the real database from .env.test, not mocks.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['__integration__/**/*.test.js'],
    //Every test clears the same database, so test files cannot run at the same time.
    fileParallelism: false,
  },
});
