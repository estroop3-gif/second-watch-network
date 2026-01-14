import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright Configuration for Production Site Testing
 * Tests against https://www.secondwatchnetwork.com
 */
export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false, // Run sequentially for production
  forbidOnly: true,
  retries: 2, // Retry failed tests
  workers: 1, // Single worker for production testing
  timeout: 90000, // 90 seconds per test
  expect: {
    timeout: 15000, // 15 seconds for assertions
  },
  reporter: [
    ['html', { outputFolder: 'playwright-report-production' }],
    ['json', { outputFile: 'test-results/production-results.json' }],
    ['list'],
  ],
  use: {
    // Production URL - no baseURL since we're testing external site
    actionTimeout: 15000,
    navigationTimeout: 30000,
    trace: 'on', // Always collect traces for production
    screenshot: 'on', // Always take screenshots
    video: 'on', // Always record video
    viewport: { width: 1280, height: 720 },
    // User agent to identify our tests
    userAgent: 'Mozilla/5.0 (Playwright Test Bot)',
  },

  projects: [
    // Chromium has dependency issues in this environment
    // {
    //   name: 'chromium',
    //   use: {
    //     ...devices['Desktop Chrome'],
    //     // Grant camera permissions by default
    //     permissions: ['camera'],
    //   },
    // },
    {
      name: 'firefox',
      use: {
        ...devices['Desktop Firefox'],
        // Note: Firefox doesn't support 'camera' permission in Playwright
        // Only chromium-based browsers support: 'camera', 'microphone', etc.
      },
    },
  ],

  // No webServer for production testing
});
