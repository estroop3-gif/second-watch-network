import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright Configuration for Second Watch Network
 * Testing the Backlot workspace and other features
 */
export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [
    ['html', { outputFolder: 'playwright-report' }],
    ['json', { outputFile: 'test-results/results.json' }],
    ['list']
  ],
  timeout: 60000,
  use: {
    baseURL: 'http://localhost:8080',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },

  projects: [
    // Setup project — create Cognito test accounts if needed
    {
      name: 'setup-accounts',
      testMatch: /test-accounts\.setup\.ts/,
    },
    // Setup project — authenticate all test users
    {
      name: 'setup-auth',
      testMatch: /multi-auth\.setup\.ts/,
      dependencies: ['setup-accounts'],
    },
    // Legacy single-user setup (kept for existing tests)
    {
      name: 'setup',
      testMatch: /auth\.setup\.ts/,
    },
    // Main test projects - depend on setup for auth
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        storageState: 'playwright/.auth/user.json',
      },
      dependencies: ['setup'],
    },
    // Multi-role tests using owner auth — serial to avoid backend overload
    {
      name: 'chromium-owner',
      fullyParallel: false,
      use: {
        ...devices['Desktop Chrome'],
        storageState: 'playwright/.auth/owner.json',
      },
      testMatch: /team-access-(?!visibility).*\.spec\.ts/,
      dependencies: ['setup-auth'],
    },
    // Visibility tests run per-role (handled inside spec via fixtures)
    {
      name: 'chromium-multi-role',
      fullyParallel: false,
      use: {
        ...devices['Desktop Chrome'],
      },
      testMatch: /team-access-visibility\.spec\.ts/,
      dependencies: ['setup-auth'],
    },
    {
      name: 'chromium-no-auth',
      use: { ...devices['Desktop Chrome'] },
      testMatch: /.*no-auth.*\.spec\.ts/,
    },
    {
      name: 'firefox',
      use: {
        ...devices['Desktop Firefox'],
        storageState: 'playwright/.auth/user.json',
      },
      dependencies: ['setup'],
    },
  ],

  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:8080',
    reuseExistingServer: !process.env.CI,
    timeout: 120000,
  },
});
