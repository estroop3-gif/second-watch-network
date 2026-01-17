/**
 * Automated Collab Edit Form Population Test
 *
 * This version attempts to automate login if credentials are provided via environment variables:
 * TEST_EMAIL and TEST_PASSWORD
 *
 * Run with:
 * TEST_EMAIL="your@email.com" TEST_PASSWORD="yourpassword" npx playwright test tests/e2e/collab-edit-automated.spec.ts --headed
 */

import { test, expect, Page } from '@playwright/test';

interface CapturedData {
  consoleLogs: Array<{ type: string; text: string; timestamp: number }>;
  apiCalls: Array<{ url: string; method: string; response: any; status: number }>;
  formFields: any;
}

async function captureEditFormData(page: Page, projectId?: string): Promise<CapturedData> {
  const data: CapturedData = {
    consoleLogs: [],
    apiCalls: [],
    formFields: {}
  };

  // Setup console capture
  page.on('console', (msg) => {
    const text = msg.text();
    const type = msg.type();

    if (text.includes('[CollabForm]') || text.includes('[SearchableCombobox]')) {
      data.consoleLogs.push({ type, text, timestamp: Date.now() });
      console.log(`[CAPTURED] ${type.toUpperCase()}: ${text}`);
    }
  });

  // Setup network capture
  page.on('response', async (response) => {
    const url = response.url();

    if (url.includes('/api/v1/community/collabs/by-project/')) {
      try {
        const responseBody = await response.json();
        data.apiCalls.push({
          url,
          method: response.request().method(),
          response: responseBody,
          status: response.status()
        });
        console.log(`[API] ${response.request().method()} ${url} - Status: ${response.status()}`);
      } catch (e) {
        console.log(`[API ERROR] Failed to parse response from ${url}`);
      }
    }
  });

  return data;
}

async function attemptLogin(page: Page): Promise<boolean> {
  const email = process.env.TEST_EMAIL;
  const password = process.env.TEST_PASSWORD;

  if (!email || !password) {
    console.log('⚠️  TEST_EMAIL and TEST_PASSWORD not set, skipping automated login');
    return false;
  }

  try {
    await page.goto('http://localhost:8080/login');
    await page.waitForSelector('input[type="email"], input[name="email"]', { timeout: 5000 });

    await page.fill('input[type="email"], input[name="email"]', email);
    await page.fill('input[type="password"], input[name="password"]', password);

    const loginButton = page.locator('button[type="submit"]').first();
    await loginButton.click();

    // Wait for redirect away from login
    await page.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 10000 });

    console.log('✓ Automated login successful');
    return true;
  } catch (e) {
    console.log('⚠️  Automated login failed:', e);
    return false;
  }
}

async function analyzeFormState(page: Page): Promise<any> {
  const formData: any = {};

  // Wait for form to be visible
  await page.waitForTimeout(1000);

  // All combobox buttons
  const comboboxes = page.locator('button[role="combobox"]');
  const comboboxCount = await comboboxes.count();

  console.log(`\nFound ${comboboxCount} combobox fields`);

  for (let i = 0; i < comboboxCount; i++) {
    const text = await comboboxes.nth(i).textContent();
    console.log(`  Combobox ${i + 1}: "${text?.trim()}"`);

    // Try to identify which field this is
    const parentText = await comboboxes.nth(i).locator('..').textContent();

    if (parentText?.toLowerCase().includes('position')) {
      formData.position = text?.trim();
    } else if (parentText?.toLowerCase().includes('network')) {
      formData.network = text?.trim();
    } else if (parentText?.toLowerCase().includes('company')) {
      formData.company = text?.trim();
    }
  }

  // Check for cast requirements (switches)
  try {
    const switches = page.locator('button[role="switch"]');
    const switchCount = await switches.count();

    for (let i = 0; i < switchCount; i++) {
      const switchEl = switches.nth(i);
      const state = await switchEl.getAttribute('data-state');
      const label = await switchEl.locator('..').textContent();

      if (label?.toLowerCase().includes('reel')) {
        formData.requires_reel = state === 'checked';
      } else if (label?.toLowerCase().includes('headshot')) {
        formData.requires_headshot = state === 'checked';
      } else if (label?.toLowerCase().includes('tape')) {
        formData.requires_self_tape = state === 'checked';
      }
    }
  } catch (e) {
    // Not a cast posting
  }

  // Check text fields
  try {
    const tapeInstructions = page.locator('textarea#tape_instructions, textarea[placeholder*="scene"]');
    if (await tapeInstructions.isVisible()) {
      formData.tape_instructions = await tapeInstructions.inputValue();
    }
  } catch (e) {}

  try {
    const tapeFormat = page.locator('input#tape_format_preferences, input[placeholder*="1080p"]');
    if (await tapeFormat.isVisible()) {
      formData.tape_format_preferences = await tapeFormat.inputValue();
    }
  } catch (e) {}

  return formData;
}

test.describe('Collab Edit Form - Automated Debug', () => {
  let capturedData: CapturedData;

  test.beforeAll(async () => {
    console.log('\n' + '='.repeat(80));
    console.log('COLLAB EDIT FORM POPULATION DEBUG TEST');
    console.log('='.repeat(80) + '\n');
  });

  test('debug collab edit form population', async ({ page }) => {
    // Setup capture
    capturedData = await captureEditFormData(page);

    // Try automated login
    const loginSuccess = await attemptLogin(page);

    if (!loginSuccess) {
      console.log('\n⚠️  MANUAL LOGIN REQUIRED');
      console.log('Please login manually in the browser window...\n');

      await page.goto('http://localhost:8080/login');
      await page.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 120000 });
      console.log('✓ Manual login completed');
    }

    // Navigate to Backlot
    console.log('\n--- Navigating to Backlot Projects ---');
    await page.goto('http://localhost:8080/backlot');
    await page.waitForLoadState('networkidle');

    // Find first project
    const projectLink = page.locator('a[href*="/backlot/projects/"]').first();
    await expect(projectLink).toBeVisible({ timeout: 10000 });

    const projectUrl = await projectLink.getAttribute('href');
    const projectId = projectUrl?.split('/').pop() || '';
    console.log(`Found project: ${projectId}`);

    await projectLink.click();
    await page.waitForLoadState('networkidle');

    // Navigate to Casting & Crew tab
    console.log('\n--- Opening Casting & Crew Tab ---');
    const castingTab = page.getByRole('tab', { name: /casting.*crew/i });
    if (await castingTab.isVisible()) {
      await castingTab.click();
      await page.waitForTimeout(1000);
    }

    // Wait for API call to complete
    await page.waitForTimeout(2000);

    // Find a collab card
    console.log('\n--- Looking for Collab Postings ---');

    // Try multiple selectors
    const collabCard = page.locator('[class*="Card"], .card').filter({
      has: page.locator('text=/Globe|Community|Collab/i')
    }).first();

    const hasCollabs = await collabCard.isVisible({ timeout: 5000 }).catch(() => false);

    if (!hasCollabs) {
      console.log('\n⚠️  NO COLLAB POSTINGS FOUND');
      await page.screenshot({ path: 'tests/screenshots/no-collabs.png', fullPage: true });

      test.skip();
      return;
    }

    // Click the dropdown menu (three dots)
    console.log('\n--- Opening Edit Menu ---');
    const menuTrigger = collabCard.locator('button[aria-haspopup="menu"]').first();
    await menuTrigger.click();
    await page.waitForTimeout(300);

    // Click Edit
    const editOption = page.getByRole('menuitem', { name: /edit/i });
    await editOption.click();

    console.log('✓ Edit dialog opened');

    // Wait for form to initialize
    await page.waitForTimeout(2000);

    // Analyze form state
    console.log('\n--- Analyzing Form State ---');
    capturedData.formFields = await analyzeFormState(page);

    // Take screenshot
    await page.screenshot({
      path: 'tests/screenshots/collab-edit-form.png',
      fullPage: true
    });

    console.log('✓ Screenshot saved');

    // Output results
    console.log('\n' + '='.repeat(80));
    console.log('DEBUG RESULTS');
    console.log('='.repeat(80) + '\n');

    console.log('--- Console Logs ---');
    if (capturedData.consoleLogs.length > 0) {
      capturedData.consoleLogs.forEach((log, i) => {
        console.log(`${i + 1}. [${log.type}] ${log.text}`);
      });
    } else {
      console.log('❌ No [CollabForm] or [SearchableCombobox] logs captured');
    }

    console.log('\n--- API Response ---');
    if (capturedData.apiCalls.length > 0) {
      capturedData.apiCalls.forEach((call, i) => {
        console.log(`\n${i + 1}. ${call.method} ${call.url} (${call.status})`);

        if (Array.isArray(call.response) && call.response.length > 0) {
          const collab = call.response[0];
          console.log('\nFirst collab in response:');
          console.log(`  Title: ${collab.title}`);
          console.log(`  Type: ${collab.type}`);
          console.log(`  Has network object: ${!!collab.network}`);
          console.log(`  Has company_data object: ${!!collab.company_data}`);
          console.log(`  Has cast_position_type object: ${!!collab.cast_position_type}`);

          if (collab.network) {
            console.log(`  Network: ${collab.network.name} (id: ${collab.network.id})`);
          } else if (collab.network_id) {
            console.log(`  ❌ Only network_id present: ${collab.network_id}`);
          }

          if (collab.company_data) {
            console.log(`  Company: ${collab.company_data.name} (id: ${collab.company_data.id})`);
          } else if (collab.company_id) {
            console.log(`  ❌ Only company_id present: ${collab.company_id}`);
          }

          if (collab.cast_position_type) {
            console.log(`  Cast Position: ${collab.cast_position_type.name} (id: ${collab.cast_position_type.id})`);
          } else if (collab.cast_position_type_id) {
            console.log(`  ❌ Only cast_position_type_id present: ${collab.cast_position_type_id}`);
          }

          console.log(`\n  Cast Requirements:`);
          console.log(`    requires_reel: ${collab.requires_reel}`);
          console.log(`    requires_headshot: ${collab.requires_headshot}`);
          console.log(`    requires_self_tape: ${collab.requires_self_tape}`);
          console.log(`    tape_instructions: "${collab.tape_instructions || ''}"`);
          console.log(`    tape_format_preferences: "${collab.tape_format_preferences || ''}"`);
        }
      });
    } else {
      console.log('❌ No API calls captured');
    }

    console.log('\n--- Form Field Values ---');
    console.log(JSON.stringify(capturedData.formFields, null, 2));

    console.log('\n--- Diagnosis ---');
    const diagnosis: string[] = [];

    if (capturedData.apiCalls.length === 0) {
      diagnosis.push('❌ API call not captured - check network timing');
    } else {
      const collab = capturedData.apiCalls[0]?.response?.[0];
      if (collab) {
        if (!collab.network && collab.network_id) {
          diagnosis.push('❌ ISSUE: API returns network_id but not network object');
        }
        if (!collab.company_data && collab.company_id) {
          diagnosis.push('❌ ISSUE: API returns company_id but not company_data object');
        }
        if (collab.type === 'looking_for_cast' && !collab.cast_position_type && collab.cast_position_type_id) {
          diagnosis.push('❌ ISSUE: API returns cast_position_type_id but not cast_position_type object');
        }
      }
    }

    if (capturedData.formFields.position?.includes('Select')) {
      diagnosis.push('❌ Position field not populated');
    }
    if (capturedData.formFields.network?.includes('Select')) {
      diagnosis.push('❌ Network field not populated');
    }
    if (capturedData.formFields.company?.includes('Select')) {
      diagnosis.push('❌ Company field not populated');
    }

    if (diagnosis.length > 0) {
      console.log(diagnosis.join('\n'));
    } else {
      console.log('✓ No obvious issues detected');
    }

    console.log('\n' + '='.repeat(80) + '\n');

    // Keep browser open for inspection
    await page.waitForTimeout(10000);
  });
});
