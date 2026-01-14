import { test, expect } from '@playwright/test';

const SCREENSHOTS_DIR = '/home/estro/second-watch-network/frontend/screenshots';

test('Compare Script Editor PAGE VIEW vs View tab text viewer', async ({ page }) => {
  console.log('\n=== Starting Script View Comparison Test ===\n');

  // Navigate to the app
  console.log('Step 1: Navigating to http://localhost:8080');
  await page.goto('http://localhost:8080', { waitUntil: 'networkidle' });

  // Check authentication
  const loginFormVisible = await page.locator('input[type="email"], input[name="email"]').isVisible()
    .catch(() => false);

  if (loginFormVisible) {
    console.log('⚠ Login required - test cannot proceed without authentication');
    await page.screenshot({ path: `${SCREENSHOTS_DIR}/00-login-required.png`, fullPage: true });
    console.log('Please ensure you are logged in before running this test.');
    return;
  }

  console.log('✓ Already authenticated');

  // Navigate to backlot to find projects
  console.log('\nStep 2: Navigating to /backlot');
  await page.goto('http://localhost:8080/backlot', {
    waitUntil: 'networkidle',
    timeout: 30000
  });
  await page.waitForTimeout(2000);

  await page.screenshot({ path: `${SCREENSHOTS_DIR}/01-backlot-home.png`, fullPage: true });
  console.log('✓ Screenshot saved: 01-backlot-home.png');

  // Find project links
  console.log('\nStep 3: Looking for projects...');
  const projectLinks = page.locator('a[href*="/backlot/projects/"]');
  const projectCount = await projectLinks.count();

  console.log(`Found ${projectCount} project links`);

  if (projectCount === 0) {
    console.log('⚠ No projects found. Please create a project with a script first.');
    return;
  }

  // Get the first project URL
  const firstProjectHref = await projectLinks.first().getAttribute('href');
  console.log(`✓ Found project: ${firstProjectHref}`);

  // Navigate to the project's script page
  const scriptUrl = `${firstProjectHref}/scripts`.replace('//', '/');
  console.log(`\nStep 4: Navigating to: ${scriptUrl}`);
  await page.goto(`http://localhost:8080${scriptUrl}`, {
    waitUntil: 'networkidle',
    timeout: 30000
  });
  await page.waitForTimeout(2000);

  await page.screenshot({ path: `${SCREENSHOTS_DIR}/02-script-page.png`, fullPage: true });
  console.log('✓ Screenshot saved: 02-script-page.png');

  // Navigate to Edit tab (or Editor tab)
  console.log('\nStep 5: Looking for Edit/Editor tab...');
  const editorTab = page.locator('button:has-text("Editor")').or(
    page.locator('[role="tab"]:has-text("Editor")')
  ).or(page.locator('button:has-text("Edit")'));

  const editorTabVisible = await editorTab.isVisible().catch(() => false);

  if (!editorTabVisible) {
    console.log('⚠ Editor tab not found - may need to import a script first');
    await page.screenshot({ path: `${SCREENSHOTS_DIR}/03-no-editor-tab.png`, fullPage: true });
    return;
  }

  console.log('✓ Editor tab found, clicking it');
  await editorTab.click();
  await page.waitForTimeout(1500);

  // Switch to PAGE VIEW
  console.log('\nStep 6: Switching to Page View...');
  const pageViewButton = page.locator('button:has-text("Page")');

  const pageViewExists = await pageViewButton.isVisible().catch(() => false);
  if (pageViewExists) {
    await pageViewButton.click();
    await page.waitForTimeout(1000);
    console.log('✓ Switched to Page View');
  } else {
    console.log('⚠ Page View button not found - may already be in page view');
  }

  // Take screenshot of PAGE VIEW in Editor
  await page.screenshot({
    path: `${SCREENSHOTS_DIR}/03-editor-page-view.png`,
    fullPage: true
  });
  console.log('✓ Screenshot saved: 03-editor-page-view.png');

  // Navigate to View tab
  console.log('\nStep 7: Looking for View tab...');
  const viewTab = page.locator('button:has-text("View")').or(
    page.locator('[role="tab"]:has-text("View")')
  );

  const viewTabVisible = await viewTab.isVisible().catch(() => false);

  if (!viewTabVisible) {
    console.log('⚠ View tab not found');
    await page.screenshot({ path: `${SCREENSHOTS_DIR}/04-no-view-tab.png`, fullPage: true });
    return;
  }

  console.log('✓ View tab found, clicking it');
  await viewTab.click();
  await page.waitForTimeout(1500);

  // Switch to Text view
  console.log('\nStep 8: Switching to Text view...');
  const textViewButton = page.locator('button:has-text("Text")');

  const textViewExists = await textViewButton.isVisible().catch(() => false);
  if (textViewExists) {
    await textViewButton.click();
    await page.waitForTimeout(1000);
    console.log('✓ Switched to Text view');
  } else {
    console.log('⚠ Text view button not found - checking available buttons');
  }

  // Take screenshot of Text viewer
  await page.screenshot({
    path: `${SCREENSHOTS_DIR}/04-view-tab-text.png`,
    fullPage: true
  });
  console.log('✓ Screenshot saved: 04-view-tab-text.png');

  console.log('\n=== Test Complete ===');
  console.log('Screenshots saved:');
  console.log('  - 03-editor-page-view.png: Script Editor in PAGE VIEW mode');
  console.log('  - 04-view-tab-text.png: View tab in Text mode');
  console.log('\nNow comparing the two views...\n');

  // Keep browser open briefly for any final observation
  await page.waitForTimeout(3000);
});
