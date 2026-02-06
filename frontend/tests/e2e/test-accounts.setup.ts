import { test as setup } from '@playwright/test';
import { execSync } from 'child_process';

/**
 * Test Account Setup
 *
 * Ensures Cognito test accounts exist for multi-role E2E testing.
 * Uses AWS CLI to create users if they don't already exist.
 */

const COGNITO_POOL_ID = 'us-east-1_AHpHN53Sf';
const REGION = 'us-east-1';

interface TestAccount {
  email: string;
  passwordEnvVar: string;
  name: string;
}

const TEST_ACCOUNTS: TestAccount[] = [
  {
    email: 'swn-test-editor@secondwatch.tv',
    passwordEnvVar: 'PLAYWRIGHT_EDITOR_PASSWORD',
    name: 'SWN Test Editor',
  },
  {
    email: 'swn-test-viewer@secondwatch.tv',
    passwordEnvVar: 'PLAYWRIGHT_VIEWER_PASSWORD',
    name: 'SWN Test Viewer',
  },
];

function userExists(email: string): boolean {
  try {
    execSync(
      `aws cognito-idp admin-get-user --user-pool-id ${COGNITO_POOL_ID} --username "${email}" --region ${REGION}`,
      { stdio: 'pipe' }
    );
    return true;
  } catch {
    return false;
  }
}

function createUser(account: TestAccount, password: string): void {
  const pw = password.trim();
  console.log(`Creating Cognito user: ${account.email}`);
  execSync(
    `aws cognito-idp admin-create-user ` +
      `--user-pool-id ${COGNITO_POOL_ID} ` +
      `--username "${account.email}" ` +
      `--user-attributes Name=email,Value="${account.email}" Name=email_verified,Value=true Name=name,Value="${account.name}" ` +
      `--message-action SUPPRESS ` +
      `--region ${REGION}`,
    { stdio: 'pipe' }
  );

  execSync(
    `aws cognito-idp admin-set-user-password ` +
      `--user-pool-id ${COGNITO_POOL_ID} ` +
      `--username "${account.email}" ` +
      `--password "${pw}" ` +
      `--permanent ` +
      `--region ${REGION}`,
    { stdio: 'pipe' }
  );

  console.log(`Created and set password for: ${account.email}`);
}

setup('ensure test accounts exist', async () => {
  for (const account of TEST_ACCOUNTS) {
    const password = process.env[account.passwordEnvVar]?.trim();
    if (!password) {
      console.log(
        `Skipping ${account.email}: ${account.passwordEnvVar} not set in environment`
      );
      continue;
    }

    if (userExists(account.email)) {
      console.log(`User already exists: ${account.email}`);
    } else {
      createUser(account, password);
    }
  }
});
