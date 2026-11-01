import { defineConfig, devices } from '@playwright/test';
import { API_URL, CLIENT_URL } from './__test__/testData.js';

export default defineConfig({
  testDir: './__test__',
  globalSetup: './__test__/globalSetup.js',
  globalTeardown: './__test__/globalTeardown.js',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  reporter: 'list',
  use: {
    baseURL: CLIENT_URL,
    trace: 'retain-on-failure',
  },
  projects: [
    {
      name: 'mobile',
      use: { ...devices['Desktop Chrome'], viewport: { width: 375, height: 667 }, isMobile: true, hasTouch: true },
    },
    {
      name: 'tablet',
      use: { ...devices['Desktop Chrome'], viewport: { width: 768, height: 1024 }, hasTouch: true },
    },
    {
      name: 'desktop',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 800 } },
    },
    {
      name: 'iphone-se',
      use: { ...devices['iPhone SE'] },
    },
    {
      name: 'iphone',
      use: { ...devices['iPhone 15'] },
    },
    {
      name: 'android',
      use: { ...devices['Pixel 7'] },
    },
    {
      name: 'ipad',
      use: { ...devices['iPad Mini'] },
    },
    {
      name: 'android-tablet',
      use: { ...devices['Galaxy Tab S9'] },
    },
    {
      name: 'desktop-firefox',
      use: { ...devices['Desktop Firefox'], viewport: { width: 1280, height: 800 } },
    },
    {
      name: 'desktop-safari',
      use: { ...devices['Desktop Safari'], viewport: { width: 1280, height: 800 } },
    },
  ],
  webServer: [
    {
      command: 'npm run start:test --prefix ../server',
      url: `${API_URL}/api/health`,
      reuseExistingServer: !process.env.CI,
    },
    {
      command: 'npx vite --port 5174 --strictPort',
      url: CLIENT_URL,
      env: { API_URL },
      reuseExistingServer: !process.env.CI,
    },
  ],
});
