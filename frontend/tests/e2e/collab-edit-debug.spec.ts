/**
 * Playwright E2E Test: Collab Edit Form Population Debugging
 *
 * Purpose: Debug why fields aren't being populated when editing a collab posting
 *
 * This test will:
 * 1. Navigate to a Backlot project's Casting & Crew tab
 * 2. Click "Edit" on a collab posting
 * 3. Capture all console logs (especially [CollabForm] and [SearchableCombobox])
 * 4. Capture the API response from /api/v1/community/collabs/by-project/{id}
 * 5. Check what values are shown in form fields
 * 6. Report findings to help diagnose the issue
 */

import { test, expect, Page } from '@playwright/test';

// Helper to extract console logs with specific prefixes
function setupConsoleCapture(page: Page) {
  const logs: Array<{ type: string; text: string; timestamp: number }> = [];

  page.on('console', (msg) => {
    const text = msg.text();
    const type = msg.type();

    // Capture all console logs, but highlight the important ones
    if (text.includes('[CollabForm]') || text.includes('[SearchableCombobox]')) {
      logs.push({
        type,
        text,
        timestamp: Date.now()
      });
      console.log(`[CAPTURED] ${type.toUpperCase()}: ${text}`);
    }
  });

  return logs;
}

// Helper to capture network requests
function setupNetworkCapture(page: Page) {
  const apiCalls: Array<{
    url: string;
    method: string;
    response: any;
    status: number;
  }> = [];

  page.on('response', async (response) => {
    const url = response.url();

    // Capture the specific API call we care about
    if (url.includes('/api/v1/community/collabs/by-project/')) {
      try {
        const responseBody = await response.json();
        apiCalls.push({
          url,
          method: response.request().method(),
          response: responseBody,
          status: response.status()
        });
        console.log(`[API CAPTURED] ${response.request().method()} ${url}`);
        console.log(`[API RESPONSE]`, JSON.stringify(responseBody, null, 2));
      } catch (e) {
        console.log(`[API ERROR] Failed to parse response from ${url}`);
      }
    }
  });

  return apiCalls;
}

test.describe('Collab Edit Form Population Debugging', () => {
  test.beforeEach(async ({ page }) => {
    // Start at the frontend homepage
    await page.goto('http://localhost:8080');
  });

  test('should capture debug data when editing a collab posting', async ({ page }) => {
    // Setup console and network capture
    const consoleLogs = setupConsoleCapture(page);
    const apiCalls = setupNetworkCapture(page);

    // Step 1: Navigate to login page (assuming we need to authenticate)
    console.log('\n=== Step 1: Navigating to Login ===');
    await page.goto('http://localhost:8080/login');

    // Wait for login form to be visible
    await page.waitForSelector('input[type="email"], input[name="email"]', { timeout: 10000 });

    console.log('\n⚠️  MANUAL STEP REQUIRED: Please login to the application');
    console.log('The test will wait for you to complete the login process...\n');

    // Wait for successful login (redirect to dashboard or profile page)
    // This assumes login redirects away from /login
    await page.waitForURL((url) => !url.pathname.includes('/login'), {
      timeout: 120000 // 2 minutes for manual login
    });

    console.log('✓ Login completed');

    // Step 2: Navigate to Backlot projects list
    console.log('\n=== Step 2: Navigating to Backlot Projects ===');
    await page.goto('http://localhost:8080/backlot');
    await page.waitForLoadState('networkidle');

    // Wait for projects to load
    await page.waitForSelector('[data-testid="project-card"], .project-card, a[href*="/backlot/projects/"]', {
      timeout: 10000
    });

    console.log('✓ Backlot projects page loaded');

    // Step 3: Click on the first project
    console.log('\n=== Step 3: Opening First Project ===');
    const firstProjectLink = page.locator('a[href*="/backlot/projects/"]').first();
    const projectUrl = await firstProjectLink.getAttribute('href');
    console.log(`Found project URL: ${projectUrl}`);

    await firstProjectLink.click();
    await page.waitForLoadState('networkidle');

    console.log('✓ Project opened');

    // Step 4: Navigate to Casting & Crew tab
    console.log('\n=== Step 4: Opening Casting & Crew Tab ===');

    // Look for the tab trigger
    const castingCrewTab = page.locator('button, [role="tab"]').filter({
      hasText: /Casting & Crew/i
    }).first();

    if (await castingCrewTab.isVisible()) {
      await castingCrewTab.click();
      await page.waitForTimeout(1000); // Wait for tab content to load
      console.log('✓ Casting & Crew tab opened');
    } else {
      console.log('⚠️  Could not find Casting & Crew tab, might already be on the page');
    }

    // Step 5: Wait for collab postings to load
    console.log('\n=== Step 5: Waiting for Collab Postings ===');
    await page.waitForTimeout(2000); // Give time for API call

    // Check if there are any collab cards
    const collabCards = page.locator('[class*="CollabCard"], .collab-card, [data-testid="collab-card"]');
    const collabCount = await collabCards.count();

    console.log(`Found ${collabCount} collab card(s)`);

    if (collabCount === 0) {
      console.log('\n⚠️  NO COLLAB POSTINGS FOUND');
      console.log('Please ensure there is at least one collab posting on this project.');
      console.log('You may need to create one first using the "Post Role" button.\n');

      // Capture what's on the page for debugging
      const pageContent = await page.content();
      console.log('Page HTML (first 1000 chars):', pageContent.substring(0, 1000));

      // Take a screenshot for debugging
      await page.screenshot({ path: 'tests/screenshots/no-collabs-found.png', fullPage: true });
      console.log('Screenshot saved to: tests/screenshots/no-collabs-found.png');

      return; // Exit early
    }

    // Step 6: Find and click Edit button on first collab
    console.log('\n=== Step 6: Opening Edit Dialog ===');

    // Look for the three-dot menu or Edit button
    const moreButton = page.locator('button').filter({
      hasText: /MoreVertical|︙|⋮/
    }).first();

    // Try to find dropdown menu trigger
    const dropdownTrigger = page.locator('[role="button"]').filter({
      has: page.locator('svg')
    }).first();

    // Click the dropdown menu
    await dropdownTrigger.click();
    await page.waitForTimeout(500);

    // Click Edit option
    const editButton = page.locator('[role="menuitem"], button').filter({
      hasText: /Edit/i
    }).first();

    await editButton.click();

    console.log('✓ Edit button clicked');

    // Wait for the CollabForm dialog to appear
    await page.waitForTimeout(1500); // Give time for form to initialize and logs to appear

    // Step 7: Capture form field values
    console.log('\n=== Step 7: Capturing Form Field Values ===');

    const formData: any = {};

    // Position/Role dropdown
    try {
      const positionButton = page.locator('button[role="combobox"]').filter({
        has: page.locator('text=/Position|Role/i')
      }).first();

      if (await positionButton.isVisible()) {
        formData.position = await positionButton.textContent();
        console.log(`Position field value: "${formData.position?.trim()}"`);
      }
    } catch (e) {
      console.log('Could not capture position field');
    }

    // Network dropdown
    try {
      const networkFields = page.locator('button[role="combobox"]');
      const networkCount = await networkFields.count();

      for (let i = 0; i < networkCount; i++) {
        const text = await networkFields.nth(i).textContent();
        if (text?.includes('Network') || text?.includes('Distributor')) {
          formData.network = text;
          console.log(`Network field value: "${formData.network?.trim()}"`);
          break;
        }
      }
    } catch (e) {
      console.log('Could not capture network field');
    }

    // Production Company dropdown
    try {
      const companyFields = page.locator('button[role="combobox"]');
      const companyCount = await companyFields.count();

      for (let i = 0; i < companyCount; i++) {
        const text = await companyFields.nth(i).textContent();
        if (text?.includes('Company') || text?.includes('Production')) {
          formData.company = text;
          console.log(`Company field value: "${formData.company?.trim()}"`);
          break;
        }
      }
    } catch (e) {
      console.log('Could not capture company field');
    }

    // Cast requirement toggles (if it's a cast posting)
    try {
      const requiresReel = page.locator('button[role="switch"]').filter({
        has: page.locator('text=/Demo Reel|Reel/i')
      });

      if (await requiresReel.isVisible()) {
        formData.requires_reel = await requiresReel.getAttribute('data-state') === 'checked';
        console.log(`Requires Reel: ${formData.requires_reel}`);
      }

      const requiresHeadshot = page.locator('button[role="switch"]').filter({
        has: page.locator('text=/Headshot/i')
      });

      if (await requiresHeadshot.isVisible()) {
        formData.requires_headshot = await requiresHeadshot.getAttribute('data-state') === 'checked';
        console.log(`Requires Headshot: ${formData.requires_headshot}`);
      }

      const requiresSelfTape = page.locator('button[role="switch"]').filter({
        has: page.locator('text=/Self-Tape|Self Tape/i')
      });

      if (await requiresSelfTape.isVisible()) {
        formData.requires_self_tape = await requiresSelfTape.getAttribute('data-state') === 'checked';
        console.log(`Requires Self-Tape: ${formData.requires_self_tape}`);
      }
    } catch (e) {
      console.log('Could not capture cast requirement toggles (might not be a cast posting)');
    }

    // Tape instructions
    try {
      const tapeInstructions = page.locator('textarea#tape_instructions, textarea[name="tape_instructions"]');

      if (await tapeInstructions.isVisible()) {
        formData.tape_instructions = await tapeInstructions.inputValue();
        console.log(`Tape Instructions: "${formData.tape_instructions}"`);
      }
    } catch (e) {
      console.log('Could not capture tape instructions');
    }

    // Tape format preferences
    try {
      const tapeFormat = page.locator('input#tape_format_preferences, input[name="tape_format_preferences"]');

      if (await tapeFormat.isVisible()) {
        formData.tape_format_preferences = await tapeFormat.inputValue();
        console.log(`Tape Format Preferences: "${formData.tape_format_preferences}"`);
      }
    } catch (e) {
      console.log('Could not capture tape format preferences');
    }

    // Step 8: Take a screenshot
    console.log('\n=== Step 8: Taking Screenshot ===');
    await page.screenshot({
      path: 'tests/screenshots/collab-edit-form.png',
      fullPage: true
    });
    console.log('Screenshot saved to: tests/screenshots/collab-edit-form.png');

    // Step 9: Output captured data
    console.log('\n=== CAPTURED DATA SUMMARY ===\n');

    console.log('--- Console Logs with [CollabForm] or [SearchableCombobox] ---');
    if (consoleLogs.length > 0) {
      consoleLogs.forEach((log, index) => {
        console.log(`${index + 1}. [${log.type}] ${log.text}`);
      });
    } else {
      console.log('⚠️  No console logs captured with [CollabForm] or [SearchableCombobox] prefix');
    }

    console.log('\n--- API Calls to /api/v1/community/collabs/by-project ---');
    if (apiCalls.length > 0) {
      apiCalls.forEach((call, index) => {
        console.log(`\n${index + 1}. ${call.method} ${call.url}`);
        console.log(`   Status: ${call.status}`);
        console.log(`   Response:`, JSON.stringify(call.response, null, 2));

        // Check if response includes the critical fields
        if (Array.isArray(call.response) && call.response.length > 0) {
          const firstCollab = call.response[0];
          console.log('\n   ✓ Checking first collab in response:');
          console.log(`      - Has network object: ${!!firstCollab.network}`);
          console.log(`      - Has company_data object: ${!!firstCollab.company_data}`);
          console.log(`      - Has cast_position_type object: ${!!firstCollab.cast_position_type}`);
          console.log(`      - network_id: ${firstCollab.network_id || 'null'}`);
          console.log(`      - company_id: ${firstCollab.company_id || 'null'}`);
          console.log(`      - cast_position_type_id: ${firstCollab.cast_position_type_id || 'null'}`);

          if (firstCollab.network) {
            console.log(`      - network.name: ${firstCollab.network.name}`);
            console.log(`      - network.id: ${firstCollab.network.id}`);
          }

          if (firstCollab.company_data) {
            console.log(`      - company_data.name: ${firstCollab.company_data.name}`);
            console.log(`      - company_data.id: ${firstCollab.company_data.id}`);
          }

          if (firstCollab.cast_position_type) {
            console.log(`      - cast_position_type.name: ${firstCollab.cast_position_type.name}`);
            console.log(`      - cast_position_type.id: ${firstCollab.cast_position_type.id}`);
          }
        }
      });
    } else {
      console.log('⚠️  No API calls captured');
    }

    console.log('\n--- Form Field Values ---');
    console.log(JSON.stringify(formData, null, 2));

    console.log('\n=== END OF DEBUG DATA ===\n');

    // Keep the browser open for manual inspection
    console.log('Keeping browser open for 30 seconds for manual inspection...');
    await page.waitForTimeout(30000);
  });
});
