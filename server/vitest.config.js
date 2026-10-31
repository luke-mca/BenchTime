import { defineConfig } from 'vitest/config';

//Config for a mock database that vitest can use. 
export default defineConfig({
  test: {
    environment: 'node',
    include: ['__tests__/**/*.test.js'],
    env: {
      NODE_ENV: 'test',
      DATABASE_URL: 'postgres://test:test@localhost:5432/benchtime_test',
      ACCESS_TOKEN_SECRET: 'test-access-secret',
      REFRESH_TOKEN_SECRET: 'test-refresh-secret',
      CLIENT_ORIGIN: 'http://localhost:5173',
    },
    //Run with `npm run test:coverage`.
    coverage: {
      provider: 'v8',
      include: ['src/**/*.js'],
      exclude: ['src/server.js'],
      reporter: ['text', 'html'],
    },
  },
});
