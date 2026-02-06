import { test as setup, expect } from '@playwright/test';

/**
 * Multi-User Authentication Setup
 *
 * Logs in as each test role and saves auth state for use by test projects.
 * Depends on test-accounts.setup.ts having run first.
 */

interface AuthUser {
  label: string;
  email: string;
  passwordEnvVar: string;
  fallbackPassword?: string;
  storageStatePath: string;
}

const AUTH_USERS: AuthUser[] = [
  {
    label: 'owner',
    email: process.env.PLAYWRIGHT_TEST_EMAIL || 'estroop3@gmail.com',
    passwordEnvVar: 'PLAYWRIGHT_TEST_PASSWORD',
    fallbackPassword: 'Parkera1bc!',
    storageStatePath: 'playwright/.auth/owner.json',
  },
  {
    label: 'editor',
    email: 'swn-test-editor@secondwatch.tv',
    passwordEnvVar: 'PLAYWRIGHT_EDITOR_PASSWORD',
    storageStatePath: 'playwright/.auth/editor.json',
  },
  {
    label: 'viewer',
    email: 'swn-test-viewer@secondwatch.tv',
    passwordEnvVar: 'PLAYWRIGHT_VIEWER_PASSWORD',
    storageStatePath: 'playwright/.auth/viewer.json',
  },
];

async function loginUser(
  page: import('@playwright/test').Page,
  user: AuthUser
): Promise<void> {
  const password =
    process.env[user.passwordEnvVar] || user.fallbackPassword;
  if (!password) {
    throw new Error(
      `No password for ${user.label}: set ${user.passwordEnvVar} in .env.playwright`
    );
  }

  console.log(`Authenticating as ${user.label}: ${user.email}`);

  await page.goto('/login');
  await page.waitForSelector('input[type="email"], input[name="email"]', {
    timeout: 10000,
  });

  await page.fill('input[type="email"], input[name="email"]', user.email);
  await page.fill('input[type="password"], input[name="password"]', password);
  await page.click('button[type="submit"]');

  await page.waitForURL(/\/(dashboard|home|backlot|onboarding)/, {
    timeout: 15000,
  });
  await expect(page.locator('body')).not.toContainText('Sign In');

  await page.context().storageState({ path: user.storageStatePath });
  console.log(`Auth state saved for ${user.label}: ${user.storageStatePath}`);
}

for (const user of AUTH_USERS) {
  setup(`authenticate as ${user.label}`, async ({ page }) => {
    await loginUser(page, user);
  });
}
