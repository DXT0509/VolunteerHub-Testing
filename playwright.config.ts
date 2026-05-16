import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  timeout: 30000,
  retries: 0,
  globalSetup: './tests/global-setup.ts',
  use: {
    baseURL: 'http://localhost:5173', // URL frontend của bạn
    headless: false,  // false = thấy trình duyệt chạy, dễ debug
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});