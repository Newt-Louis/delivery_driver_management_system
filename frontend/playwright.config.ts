import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/visual',
  timeout: 30_000,
  expect: { timeout: 8_000 },
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? 'http://127.0.0.1:5173',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'desktop', use: { viewport: { width: 1440, height: 1000 } } },
    { name: 'tablet', use: { viewport: { width: 1024, height: 900 } } },
    { name: 'mobile', use: { viewport: { width: 390, height: 844 }, isMobile: true } },
  ],
});
