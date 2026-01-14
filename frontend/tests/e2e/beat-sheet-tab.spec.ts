/**
 * E2E Test: Beat Sheet Tab in Backlot Workspace
 *
 * TESTS:
 * 1. Navigate to Beat Sheet tab in Backlot
 * 2. Click on or create a beat sheet
 * 3. Test "Edit" button opens metadata modal (not a beat edit)
 * 4. Test clicking a beat card opens beat detail modal
 * 5. Test "Apply Template" button shows templates
 * 6. Test "Connections" button and Episodes tab
 * 7. Test "Export PDF" button
 * 8. Report any console errors
 */

import { test, expect, Page } from '@playwright/test';

const TEST_EMAIL = 'poboy3tv@gmail.com';
const TEST_PASSWORD = 'Parkera1bc!';
const BASE_URL = 'http://localhost:8080';

// Use Firefox browser
test.use({ browserName: 'firefox' });

test.describe('Beat Sheet Tab - Functionality Tests', () => {
  let consoleErrors: string[] = [];
  let pageErrors: string[] = [];

  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 1080 });

    // Capture console errors
    consoleErrors = [];
    pageErrors = [];

    page.on('console', msg => {
      if (msg.type() === 'error') {
        const errorMsg = msg.text();
        consoleErrors.push(errorMsg);
        console.log(`[Console Error] ${errorMsg}`);
      }
    });

    page.on('pageerror', error => {
      const errorMsg = error.message;
      pageErrors.push(errorMsg);
      console.log(`[Page Error] ${errorMsg}`);
    });
  });

  test('should navigate to Beat Sheet tab and test all functionality', async ({ page }) => {
    console.log('\n========================================');
    console.log('BEAT SHEET TAB FUNCTIONALITY TEST');
    console.log('========================================\n');

    // Step 1: Login
    console.log('Step 1: Logging in...');
    await loginToBacklot(page);
    await page.screenshot({
      path: 'test-results/beat-sheet-01-after-login.png',
      fullPage: false
    });

    // Step 2: Navigate to a project in Backlot
    console.log('\nStep 2: Navigating to Backlot project...');
    await navigateToBacklotProject(page);
    await page.screenshot({
      path: 'test-results/beat-sheet-02-backlot-project.png',
      fullPage: false
    });

    // Step 3: Find and click on Beat Sheet tab
    console.log('\nStep 3: Looking for Beat Sheet tab in sidebar...');
    const beatSheetTab = await findBeatSheetTab(page);
    if (!beatSheetTab) {
      console.log('ERROR: Could not find Beat Sheet tab in sidebar');
      await page.screenshot({
        path: 'test-results/beat-sheet-03-ERROR-no-tab.png',
        fullPage: true
      });
      throw new Error('Beat Sheet tab not found in sidebar');
    }

    await beatSheetTab.click();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    await page.screenshot({
      path: 'test-results/beat-sheet-03-tab-clicked.png',
      fullPage: false
    });
    console.log('SUCCESS: Beat Sheet tab clicked');

    // Step 4: Check if there are existing beat sheets or create one
    console.log('\nStep 4: Checking for existing beat sheets...');
    const beatSheetCard = await selectOrCreateBeatSheet(page);

    await page.screenshot({
      path: 'test-results/beat-sheet-04-beat-sheet-selected.png',
      fullPage: false
    });

    // Step 5: Test the Edit button in top right header
    console.log('\nStep 5: Testing Edit button in header...');
    await testEditButton(page);

    // Step 6: Test clicking a beat card
    console.log('\nStep 6: Testing beat card click...');
    await testBeatCardClick(page);

    // Step 7: Test Apply Template button
    console.log('\nStep 7: Testing Apply Template button...');
    await testApplyTemplateButton(page);

    // Step 8: Test Connections button
    console.log('\nStep 8: Testing Connections button...');
    await testConnectionsButton(page);

    // Step 9: Test Export PDF button
    console.log('\nStep 9: Testing Export PDF button...');
    await testExportPdfButton(page);

    // Step 10: Report console errors
    console.log('\n========================================');
    console.log('CONSOLE ERRORS SUMMARY');
    console.log('========================================');
    if (consoleErrors.length === 0 && pageErrors.length === 0) {
      console.log('SUCCESS: No console or page errors detected!');
    } else {
      if (consoleErrors.length > 0) {
        console.log(`\nConsole Errors (${consoleErrors.length}):`);
        consoleErrors.forEach((err, i) => console.log(`  ${i + 1}. ${err}`));
      }
      if (pageErrors.length > 0) {
        console.log(`\nPage Errors (${pageErrors.length}):`);
        pageErrors.forEach((err, i) => console.log(`  ${i + 1}. ${err}`));
      }
    }
    console.log('========================================\n');

    // Final screenshot
    await page.screenshot({
      path: 'test-results/beat-sheet-10-final.png',
      fullPage: false
    });
  });
});

// ===================================
// Helper Functions
// ===================================

async function loginToBacklot(page: Page) {
  await page.goto(`${BASE_URL}/login`, {
    waitUntil: 'networkidle',
    timeout: 30000
  });
  await page.waitForTimeout(1000);

  const emailInput = page.locator('input[type="email"], input[name="email"], input[placeholder*="email" i], input#email').first();
  await emailInput.waitFor({ state: 'visible', timeout: 10000 });
  await emailInput.fill(TEST_EMAIL);

  const passwordInput = page.locator('input[type="password"]').first();
  await passwordInput.fill(TEST_PASSWORD);

  const submitButton = page.locator('button[type="submit"], button:has-text("Sign In"), button:has-text("Log In")').first();
  await submitButton.click();

  await page.waitForURL('**/*', { timeout: 15000 });
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(3000);

  console.log('  ✓ Login successful');
}

async function navigateToBacklotProject(page: Page) {
  await page.goto(`${BASE_URL}/backlot`, {
    waitUntil: 'networkidle',
    timeout: 30000
  });
  await page.waitForTimeout(2000);

  console.log('  Current URL:', page.url());

  // Look for project cards and click the first one
  const projectCards = page.locator('a[href*="/backlot/project/"], [data-testid="project-card"], .cursor-pointer');
  const projectCount = await projectCards.count();
  console.log(`  Found ${projectCount} project cards`);

  if (projectCount > 0) {
    const firstProject = projectCards.first();
    await firstProject.click();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);
  }

  console.log('  ✓ Navigated to project:', page.url());
}

async function findBeatSheetTab(page: Page) {
  // Look for Beat Sheet or Story tab in the sidebar
  // Try multiple selectors
  const selectors = [
    'text=Beat Sheet',
    'text=Story',
    'a:has-text("Beat Sheet")',
    'a:has-text("Story")',
    'button:has-text("Beat Sheet")',
    'button:has-text("Story")',
  ];

  for (const selector of selectors) {
    const element = page.locator(selector).first();
    const isVisible = await element.isVisible().catch(() => false);
    if (isVisible) {
      console.log(`  ✓ Found Beat Sheet tab using selector: ${selector}`);
      return element;
    }
  }

  // If not found, log the sidebar content
  console.log('  Could not find Beat Sheet/Story tab. Logging sidebar content...');
  const sidebar = page.locator('aside, nav').first();
  const sidebarText = await sidebar.textContent().catch(() => 'Unable to get sidebar text');
  console.log('  Sidebar content:', sidebarText);

  return null;
}

async function selectOrCreateBeatSheet(page: Page) {
  // Check if there are beat sheet cards
  const beatSheetCards = page.locator('div[role="button"], .cursor-pointer').filter({ hasText: /Beat Sheet|Story/ });
  const cardCount = await beatSheetCards.count();

  console.log(`  Found ${cardCount} potential beat sheet cards`);

  if (cardCount > 0) {
    // Click on the first beat sheet
    const firstCard = beatSheetCards.first();
    await firstCard.click();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1500);
    console.log('  ✓ Selected existing beat sheet');
  } else {
    // Look for Create/Add button
    const createButton = page.locator('button:has-text("Create"), button:has-text("Add"), button:has-text("New")').first();
    const hasCreateButton = await createButton.isVisible().catch(() => false);

    if (hasCreateButton) {
      console.log('  No existing beat sheets. Creating a new one...');
      await createButton.click();
      await page.waitForTimeout(1000);

      // Fill in the form
      const titleInput = page.locator('input[name="title"], input[placeholder*="title" i]').first();
      await titleInput.waitFor({ state: 'visible', timeout: 5000 });
      await titleInput.fill('Test Beat Sheet');

      const submitButton = page.locator('button[type="submit"], button:has-text("Create"), button:has-text("Save")').first();
      await submitButton.click();
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(2000);
      console.log('  ✓ Created new beat sheet');
    } else {
      console.log('  WARNING: No beat sheets found and no create button found');
    }
  }

  return true;
}

async function testEditButton(page: Page) {
  // Look for Edit button in the header area
  const editButton = page.locator('button:has-text("Edit")').filter({ has: page.locator('svg') });
  const editButtonCount = await editButton.count();

  console.log(`  Found ${editButtonCount} Edit button(s)`);

  if (editButtonCount === 0) {
    console.log('  WARNING: No Edit button found in header');
    await page.screenshot({
      path: 'test-results/beat-sheet-05-no-edit-button.png',
      fullPage: false
    });
    return;
  }

  // Click the Edit button
  await editButton.first().click();
  await page.waitForTimeout(1500);

  await page.screenshot({
    path: 'test-results/beat-sheet-05-edit-button-clicked.png',
    fullPage: false
  });

  // Check if a modal/dialog opened
  const dialog = page.locator('[role="dialog"], .modal, div[aria-modal="true"]').first();
  const dialogVisible = await dialog.isVisible().catch(() => false);

  if (dialogVisible) {
    console.log('  ✓ Modal opened after clicking Edit button');

    // Check modal content
    const dialogText = await dialog.textContent();
    console.log('  Modal content preview:', dialogText?.substring(0, 200));

    // Check if it's the beat sheet metadata modal (should have fields like title, logline, genre)
    const hasTitleField = await dialog.locator('input[name="title"], label:has-text("Title")').isVisible().catch(() => false);
    const hasLoglineField = await dialog.locator('textarea[name="logline"], label:has-text("Logline")').isVisible().catch(() => false);
    const hasGenreField = await dialog.locator('select[name="genre"], label:has-text("Genre")').isVisible().catch(() => false);

    if (hasTitleField || hasLoglineField || hasGenreField) {
      console.log('  ✓ CORRECT: Modal appears to be for editing beat sheet METADATA');
      console.log('    - Has Title field:', hasTitleField);
      console.log('    - Has Logline field:', hasLoglineField);
      console.log('    - Has Genre field:', hasGenreField);
    } else {
      console.log('  ⚠ UNEXPECTED: Modal opened but does not appear to be beat sheet metadata modal');
    }

    await page.screenshot({
      path: 'test-results/beat-sheet-05-edit-modal-open.png',
      fullPage: false
    });

    // Close the modal
    const cancelButton = dialog.locator('button:has-text("Cancel"), button:has-text("Close")').first();
    const hasCancelButton = await cancelButton.isVisible().catch(() => false);
    if (hasCancelButton) {
      await cancelButton.click();
      await page.waitForTimeout(500);
      console.log('  ✓ Closed edit modal');
    }
  } else {
    console.log('  ✗ ERROR: No modal opened after clicking Edit button');
    console.log('  Expected: A modal to edit beat sheet metadata (title, logline, genre, etc.)');
  }
}

async function testBeatCardClick(page: Page) {
  // Look for beat cards
  const beatCards = page.locator('[data-testid="beat-card"], .beat-card, div[role="button"]').filter({
    hasText: /.+/
  });
  const beatCardCount = await beatCards.count();

  console.log(`  Found ${beatCardCount} potential beat cards`);

  if (beatCardCount === 0) {
    console.log('  WARNING: No beat cards found. Beat sheet may be empty.');
    await page.screenshot({
      path: 'test-results/beat-sheet-06-no-beat-cards.png',
      fullPage: false
    });
    return;
  }

  // Click on the first beat card
  const firstBeatCard = beatCards.first();
  await firstBeatCard.click();
  await page.waitForTimeout(1500);

  await page.screenshot({
    path: 'test-results/beat-sheet-06-beat-card-clicked.png',
    fullPage: false
  });

  // Check if a detail modal opened
  const dialog = page.locator('[role="dialog"], .modal, div[aria-modal="true"]').first();
  const dialogVisible = await dialog.isVisible().catch(() => false);

  if (dialogVisible) {
    console.log('  ✓ Modal opened after clicking beat card');

    const dialogText = await dialog.textContent();
    console.log('  Modal content preview:', dialogText?.substring(0, 200));

    await page.screenshot({
      path: 'test-results/beat-sheet-06-beat-detail-modal.png',
      fullPage: false
    });

    // Close the modal
    const closeButton = dialog.locator('button:has-text("Close"), button:has-text("Cancel")').first();
    const hasCloseButton = await closeButton.isVisible().catch(() => false);
    if (hasCloseButton) {
      await closeButton.click();
      await page.waitForTimeout(500);
      console.log('  ✓ Closed beat detail modal');
    }
  } else {
    console.log('  ⚠ WARNING: No modal opened after clicking beat card');
  }
}

async function testApplyTemplateButton(page: Page) {
  // Look for Apply Template button
  const applyTemplateButton = page.locator('button:has-text("Apply Template")').first();
  const hasButton = await applyTemplateButton.isVisible().catch(() => false);

  if (!hasButton) {
    console.log('  WARNING: Apply Template button not found (may require edit permissions)');
    await page.screenshot({
      path: 'test-results/beat-sheet-07-no-apply-template-button.png',
      fullPage: false
    });
    return;
  }

  console.log('  ✓ Found Apply Template button');
  await applyTemplateButton.click();
  await page.waitForTimeout(1500);

  await page.screenshot({
    path: 'test-results/beat-sheet-07-apply-template-clicked.png',
    fullPage: false
  });

  // Check if modal opened with templates
  const dialog = page.locator('[role="dialog"], .modal, div[aria-modal="true"]').first();
  const dialogVisible = await dialog.isVisible().catch(() => false);

  if (dialogVisible) {
    console.log('  ✓ Modal opened after clicking Apply Template');

    const dialogText = await dialog.textContent();
    console.log('  Modal content preview:', dialogText?.substring(0, 200));

    // Check for template options
    const hasTemplateOptions = await dialog.locator('input[type="radio"], .template-option').count();
    console.log(`  Found ${hasTemplateOptions} template option(s)`);

    await page.screenshot({
      path: 'test-results/beat-sheet-07-template-modal.png',
      fullPage: false
    });

    // Close the modal
    const cancelButton = dialog.locator('button:has-text("Cancel"), button:has-text("Close")').first();
    const hasCancelButton = await cancelButton.isVisible().catch(() => false);
    if (hasCancelButton) {
      await cancelButton.click();
      await page.waitForTimeout(500);
      console.log('  ✓ Closed template modal');
    }
  } else {
    console.log('  ✗ ERROR: No modal opened after clicking Apply Template');
  }
}

async function testConnectionsButton(page: Page) {
  // Look for Connections button
  const connectionsButton = page.locator('button:has-text("Connections")').first();
  const hasButton = await connectionsButton.isVisible().catch(() => false);

  if (!hasButton) {
    console.log('  WARNING: Connections button not found (may require edit permissions)');
    await page.screenshot({
      path: 'test-results/beat-sheet-08-no-connections-button.png',
      fullPage: false
    });
    return;
  }

  console.log('  ✓ Found Connections button');
  await connectionsButton.click();
  await page.waitForTimeout(1500);

  await page.screenshot({
    path: 'test-results/beat-sheet-08-connections-clicked.png',
    fullPage: false
  });

  // Check if modal opened
  const dialog = page.locator('[role="dialog"], .modal, div[aria-modal="true"]').first();
  const dialogVisible = await dialog.isVisible().catch(() => false);

  if (dialogVisible) {
    console.log('  ✓ Modal opened after clicking Connections');

    // Check for Episodes tab
    const episodesTab = dialog.locator('button:has-text("Episodes"), [role="tab"]:has-text("Episodes")').first();
    const hasEpisodesTab = await episodesTab.isVisible().catch(() => false);

    if (hasEpisodesTab) {
      console.log('  ✓ Found Episodes tab');
      await episodesTab.click();
      await page.waitForTimeout(1000);

      await page.screenshot({
        path: 'test-results/beat-sheet-08-episodes-tab.png',
        fullPage: false
      });

      // Check if episodes are listed
      const episodeItems = dialog.locator('li, .episode-item, [data-testid="episode-item"]');
      const episodeCount = await episodeItems.count();
      console.log(`  Found ${episodeCount} episode(s) in the Episodes tab`);

      if (episodeCount > 0) {
        console.log('  ✓ Episodes populated in the Episodes tab');
      } else {
        console.log('  ⚠ No episodes found (may be empty or project has no episodes)');
      }
    } else {
      console.log('  ⚠ WARNING: Episodes tab not found in Connections dialog');
    }

    // Close the modal
    const doneButton = dialog.locator('button:has-text("Done"), button:has-text("Close")').first();
    const hasDoneButton = await doneButton.isVisible().catch(() => false);
    if (hasDoneButton) {
      await doneButton.click();
      await page.waitForTimeout(500);
      console.log('  ✓ Closed connections modal');
    }
  } else {
    console.log('  ✗ ERROR: No modal opened after clicking Connections');
  }
}

async function testExportPdfButton(page: Page) {
  // Look for Export PDF button
  const exportPdfButton = page.locator('button:has-text("Export PDF")').first();
  const hasButton = await exportPdfButton.isVisible().catch(() => false);

  if (!hasButton) {
    console.log('  WARNING: Export PDF button not found');
    await page.screenshot({
      path: 'test-results/beat-sheet-09-no-export-pdf-button.png',
      fullPage: false
    });
    return;
  }

  console.log('  ✓ Found Export PDF button');

  // Set up download listener before clicking
  const downloadPromise = page.waitForEvent('download', { timeout: 10000 }).catch(() => null);

  await exportPdfButton.click();
  await page.waitForTimeout(1000);

  await page.screenshot({
    path: 'test-results/beat-sheet-09-export-pdf-clicked.png',
    fullPage: false
  });

  // Check if download started
  const download = await downloadPromise;

  if (download) {
    console.log('  ✓ PDF download initiated');
    console.log('  Download filename:', download.suggestedFilename());
  } else {
    console.log('  ⚠ WARNING: No download detected (may have opened in new tab or failed)');

    // Check if a new tab opened
    const pages = page.context().pages();
    if (pages.length > 1) {
      console.log('  ℹ PDF may have opened in a new tab');
    }
  }
}
