/**
 * Collab Edit Form Population Test
 *
 * Tests and debugs the issue where collab form fields aren't being populated when editing.
 *
 * This test uses the existing Playwright auth setup.
 *
 * Run with:
 *   npx playwright test tests/e2e/collab-edit-form.spec.ts --headed
 *
 * Prerequisites:
 *   - Set PLAYWRIGHT_TEST_EMAIL and PLAYWRIGHT_TEST_PASSWORD in environment
 *   - Or run auth.setup.ts first to create auth state
 *   - Backend running on http://localhost:8000
 *   - Frontend running on http://localhost:8080
 *   - At least one Backlot project with a collab posting
 */

import { test, expect, Page } from '@playwright/test';

interface CollabData {
  title: string;
  type: string;
  network_id?: string | null;
  network?: {
    id: string;
    name: string;
    slug: string;
    logo_url?: string;
    category?: string;
  } | null;
  company_id?: string | null;
  company_data?: {
    id: string;
    name: string;
    logo_url?: string;
    is_verified?: boolean;
  } | null;
  cast_position_type_id?: string | null;
  cast_position_type?: {
    id: string;
    name: string;
    slug: string;
  } | null;
  requires_reel?: boolean;
  requires_headshot?: boolean;
  requires_self_tape?: boolean;
  tape_instructions?: string;
  tape_format_preferences?: string;
}

interface CapturedData {
  consoleLogs: Array<{ type: string; text: string; timestamp: number }>;
  apiResponse: CollabData | null;
  formState: {
    position?: string;
    network?: string;
    company?: string;
    requires_reel?: boolean;
    requires_headshot?: boolean;
    requires_self_tape?: boolean;
    tape_instructions?: string;
    tape_format_preferences?: string;
  };
}

async function setupCapture(page: Page): Promise<CapturedData> {
  const data: CapturedData = {
    consoleLogs: [],
    apiResponse: null,
    formState: {}
  };

  // Capture console logs
  page.on('console', (msg) => {
    const text = msg.text();
    const type = msg.type();

    if (text.includes('[CollabForm]') || text.includes('[SearchableCombobox]')) {
      data.consoleLogs.push({ type, text, timestamp: Date.now() });
    }
  });

  // Capture API response
  page.on('response', async (response) => {
    const url = response.url();

    if (url.includes('/api/v1/community/collabs/by-project/')) {
      try {
        const body = await response.json();
        if (Array.isArray(body) && body.length > 0) {
          data.apiResponse = body[0]; // Store first collab
        }
      } catch (e) {
        console.log('[TEST] Failed to parse API response');
      }
    }
  });

  return data;
}

async function captureFormState(page: Page): Promise<CapturedData['formState']> {
  const formState: CapturedData['formState'] = {};

  // Wait for form to render
  await page.waitForTimeout(1000);

  // Capture all combobox values
  const comboboxes = await page.locator('button[role="combobox"]').all();

  for (let i = 0; i < comboboxes.length; i++) {
    const text = await comboboxes[i].textContent();

    // Try to determine which field based on nearby labels
    const parent = comboboxes[i].locator('..');
    const parentText = await parent.textContent();

    if (parentText?.toLowerCase().includes('position')) {
      formState.position = text?.trim();
    } else if (parentText?.toLowerCase().includes('network')) {
      formState.network = text?.trim();
    } else if (parentText?.toLowerCase().includes('company')) {
      formState.company = text?.trim();
    }
  }

  // Capture switch states (cast requirements)
  try {
    const switches = await page.locator('button[role="switch"]').all();

    for (const sw of switches) {
      const state = await sw.getAttribute('data-state');
      const label = await sw.locator('..').textContent();

      if (label?.toLowerCase().includes('reel') && !label.toLowerCase().includes('tape')) {
        formState.requires_reel = state === 'checked';
      } else if (label?.toLowerCase().includes('headshot')) {
        formState.requires_headshot = state === 'checked';
      } else if (label?.toLowerCase().includes('tape')) {
        formState.requires_self_tape = state === 'checked';
      }
    }
  } catch (e) {
    // Not a cast posting
  }

  // Capture text fields
  try {
    const tapeInstructions = page.locator('textarea#tape_instructions');
    if (await tapeInstructions.isVisible()) {
      formState.tape_instructions = await tapeInstructions.inputValue();
    }
  } catch (e) {}

  try {
    const tapeFormat = page.locator('input#tape_format_preferences');
    if (await tapeFormat.isVisible()) {
      formState.tape_format_preferences = await tapeFormat.inputValue();
    }
  } catch (e) {}

  return formState;
}

function analyzeData(data: CapturedData): string[] {
  const issues: string[] = [];

  // Check API response
  if (!data.apiResponse) {
    issues.push('No API response captured');
    return issues;
  }

  const collab = data.apiResponse;

  // Check for missing nested objects
  if (collab.network_id && !collab.network) {
    issues.push(`API missing 'network' object (only has network_id: ${collab.network_id})`);
  }

  if (collab.company_id && !collab.company_data) {
    issues.push(`API missing 'company_data' object (only has company_id: ${collab.company_id})`);
  }

  if (collab.type === 'looking_for_cast' && collab.cast_position_type_id && !collab.cast_position_type) {
    issues.push(`API missing 'cast_position_type' object (only has cast_position_type_id: ${collab.cast_position_type_id})`);
  }

  // Check form state
  if (data.formState.position?.includes('Select')) {
    issues.push('Position field not populated (shows "Select...")');
  }

  if (data.formState.network?.includes('Select')) {
    issues.push('Network field not populated (shows "Select...")');
  }

  if (data.formState.company?.includes('Select')) {
    issues.push('Company field not populated (shows "Select...")');
  }

  // Check cast requirements (if applicable)
  if (collab.type === 'looking_for_cast') {
    if (collab.requires_reel !== data.formState.requires_reel) {
      issues.push(`requires_reel mismatch: API=${collab.requires_reel}, Form=${data.formState.requires_reel}`);
    }

    if (collab.requires_headshot !== data.formState.requires_headshot) {
      issues.push(`requires_headshot mismatch: API=${collab.requires_headshot}, Form=${data.formState.requires_headshot}`);
    }

    if (collab.requires_self_tape !== data.formState.requires_self_tape) {
      issues.push(`requires_self_tape mismatch: API=${collab.requires_self_tape}, Form=${data.formState.requires_self_tape}`);
    }

    if (collab.tape_instructions && collab.tape_instructions !== data.formState.tape_instructions) {
      issues.push(`tape_instructions not populated (API has "${collab.tape_instructions?.substring(0, 30)}...")`);
    }

    if (collab.tape_format_preferences && collab.tape_format_preferences !== data.formState.tape_format_preferences) {
      issues.push(`tape_format_preferences not populated (API has "${collab.tape_format_preferences}")`);
    }
  }

  return issues;
}

function printReport(data: CapturedData) {
  console.log('\n' + '='.repeat(80));
  console.log('COLLAB EDIT FORM DEBUG REPORT');
  console.log('='.repeat(80) + '\n');

  console.log('--- Console Logs ---');
  if (data.consoleLogs.length > 0) {
    data.consoleLogs.forEach((log, i) => {
      console.log(`${i + 1}. [${log.type.toUpperCase()}] ${log.text}`);
    });
  } else {
    console.log('No [CollabForm] or [SearchableCombobox] logs captured');
  }

  console.log('\n--- API Response ---');
  if (data.apiResponse) {
    console.log(`Title: ${data.apiResponse.title}`);
    console.log(`Type: ${data.apiResponse.type}`);

    console.log('\nRelated Objects:');
    console.log(`  network_id: ${data.apiResponse.network_id || 'null'}`);
    console.log(`  network object: ${data.apiResponse.network ? 'PRESENT' : 'MISSING'}`);
    if (data.apiResponse.network) {
      console.log(`    - name: ${data.apiResponse.network.name}`);
      console.log(`    - id: ${data.apiResponse.network.id}`);
    }

    console.log(`  company_id: ${data.apiResponse.company_id || 'null'}`);
    console.log(`  company_data object: ${data.apiResponse.company_data ? 'PRESENT' : 'MISSING'}`);
    if (data.apiResponse.company_data) {
      console.log(`    - name: ${data.apiResponse.company_data.name}`);
      console.log(`    - id: ${data.apiResponse.company_data.id}`);
    }

    if (data.apiResponse.type === 'looking_for_cast') {
      console.log(`  cast_position_type_id: ${data.apiResponse.cast_position_type_id || 'null'}`);
      console.log(`  cast_position_type object: ${data.apiResponse.cast_position_type ? 'PRESENT' : 'MISSING'}`);
      if (data.apiResponse.cast_position_type) {
        console.log(`    - name: ${data.apiResponse.cast_position_type.name}`);
        console.log(`    - id: ${data.apiResponse.cast_position_type.id}`);
      }

      console.log('\nCast Requirements:');
      console.log(`  requires_reel: ${data.apiResponse.requires_reel}`);
      console.log(`  requires_headshot: ${data.apiResponse.requires_headshot}`);
      console.log(`  requires_self_tape: ${data.apiResponse.requires_self_tape}`);
      console.log(`  tape_instructions: "${data.apiResponse.tape_instructions || ''}"`);
      console.log(`  tape_format_preferences: "${data.apiResponse.tape_format_preferences || ''}"`);
    }
  } else {
    console.log('No API response captured');
  }

  console.log('\n--- Form Field State ---');
  console.log(JSON.stringify(data.formState, null, 2));

  console.log('\n--- Issues Detected ---');
  const issues = analyzeData(data);
  if (issues.length > 0) {
    issues.forEach((issue, i) => {
      console.log(`${i + 1}. ${issue}`);
    });
  } else {
    console.log('No issues detected - form appears to be working correctly!');
  }

  console.log('\n' + '='.repeat(80) + '\n');
}

test.describe('Collab Edit Form Population', () => {
  let capturedData: CapturedData;

  test('should populate form fields when editing a collab', async ({ page }) => {
    // Setup capture
    capturedData = await setupCapture(page);

    // Navigate to Backlot projects
    await page.goto('/backlot');
    await page.waitForLoadState('networkidle');

    // Find and click first project
    const projectLink = page.locator('a[href*="/backlot/projects/"]').first();
    await expect(projectLink).toBeVisible({ timeout: 10000 });

    await projectLink.click();
    await page.waitForLoadState('networkidle');

    // Navigate to Casting & Crew tab
    const castingTab = page.getByRole('tab', { name: /casting.*crew/i });
    if (await castingTab.isVisible({ timeout: 5000 })) {
      await castingTab.click();
      await page.waitForTimeout(1000);
    }

    // Wait for collabs to load
    await page.waitForTimeout(2000);

    // Check if there are any collab cards
    const hasCollabs = await page.locator('text=/Globe|Community|Collab/i').first().isVisible({ timeout: 5000 }).catch(() => false);

    if (!hasCollabs) {
      console.log('\nNo collab postings found on this project.');
      console.log('Please create a collab posting first and re-run the test.\n');
      test.skip();
      return;
    }

    // Find and click Edit button
    const menuTrigger = page.locator('button[aria-haspopup="menu"]').first();
    await menuTrigger.click();
    await page.waitForTimeout(300);

    const editOption = page.getByRole('menuitem', { name: /edit/i });
    await editOption.click();

    // Wait for form to initialize and logs to be generated
    await page.waitForTimeout(2000);

    // Capture form state
    capturedData.formState = await captureFormState(page);

    // Take screenshot
    await page.screenshot({
      path: 'tests/screenshots/collab-edit-form.png',
      fullPage: true
    });

    // Print report
    printReport(capturedData);

    // Analyze issues
    const issues = analyzeData(capturedData);

    // Test assertions
    if (capturedData.apiResponse) {
      // Check that API includes nested objects when IDs are present
      if (capturedData.apiResponse.network_id) {
        expect(capturedData.apiResponse.network, 'API should include network object when network_id is present').toBeTruthy();
      }

      if (capturedData.apiResponse.company_id) {
        expect(capturedData.apiResponse.company_data, 'API should include company_data object when company_id is present').toBeTruthy();
      }

      if (capturedData.apiResponse.type === 'looking_for_cast' && capturedData.apiResponse.cast_position_type_id) {
        expect(capturedData.apiResponse.cast_position_type, 'API should include cast_position_type object when cast_position_type_id is present').toBeTruthy();
      }
    }

    // Check that form fields are populated (not showing "Select...")
    expect(capturedData.formState.position, 'Position field should be populated').not.toContain('Select');

    if (capturedData.apiResponse?.network_id) {
      expect(capturedData.formState.network, 'Network field should be populated').not.toContain('Select');
    }

    if (capturedData.apiResponse?.company_id) {
      expect(capturedData.formState.company, 'Company field should be populated').not.toContain('Select');
    }

    // If there are issues, provide helpful error message
    if (issues.length > 0) {
      console.log('\n=== FAILED ===');
      console.log('Issues detected:');
      issues.forEach((issue, i) => console.log(`  ${i + 1}. ${issue}`));
      console.log('\nSee COLLAB-EDIT-DEBUG-SUMMARY.md for detailed explanation and fix.\n');
    }
  });
});
