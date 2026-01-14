/**
 * Continuity Annotation Toolbar Exploration
 *
 * This test explores the Continuity tab PDF viewer on the production site
 * to identify what annotation/markup tools already exist.
 *
 * Goals:
 * 1. Navigate to a Backlot project's Continuity tab
 * 2. Take screenshots of the PDF viewer interface
 * 3. Document all toolbar buttons and controls
 * 4. Identify any existing annotation/markup features
 * 5. Test interactions with toolbar elements
 */

import { test, expect, Page } from '@playwright/test';
import * as path from 'path';

const PRODUCTION_URL = 'https://www.secondwatchnetwork.com';

// Helper to save detailed screenshots with descriptions
async function captureAnnotatedScreenshot(
  page: Page,
  testInfo: any,
  name: string,
  description: string
) {
  const screenshotPath = path.join(
    testInfo.outputDir,
    `${name}.png`
  );
  await page.screenshot({ path: screenshotPath, fullPage: false });
  console.log(`\n📸 ${name}: ${description}`);
  return screenshotPath;
}

// Helper to extract and log toolbar information
async function documentToolbarElements(page: Page, testInfo: any) {
  console.log('\n========================================');
  console.log('TOOLBAR ELEMENT ANALYSIS');
  console.log('========================================\n');

  // Look for various toolbar patterns
  const toolbarSelectors = [
    'div[class*="toolbar"]',
    'div[class*="controls"]',
    'div[class*="actions"]',
    'div[role="toolbar"]',
    '[data-testid*="toolbar"]',
    'header',
    '.scripty-workspace header',
  ];

  let toolbarFound = false;

  for (const selector of toolbarSelectors) {
    const toolbar = page.locator(selector).first();
    if (await toolbar.isVisible().catch(() => false)) {
      console.log(`✓ Found toolbar with selector: ${selector}`);
      toolbarFound = true;

      // Capture toolbar area
      await captureAnnotatedScreenshot(
        page,
        testInfo,
        `toolbar-${selector.replace(/[^a-z0-9]/gi, '-')}`,
        `Toolbar found using selector: ${selector}`
      );
      break;
    }
  }

  if (!toolbarFound) {
    console.log('⚠ No toolbar found with standard selectors');
  }

  // Look for all buttons in the interface
  console.log('\n--- Button Elements ---');
  const buttons = await page.locator('button').all();
  console.log(`Found ${buttons.length} button elements`);

  for (let i = 0; i < Math.min(buttons.length, 50); i++) {
    const button = buttons[i];
    const isVisible = await button.isVisible().catch(() => false);
    if (isVisible) {
      const text = await button.textContent().catch(() => '');
      const ariaLabel = await button.getAttribute('aria-label').catch(() => null);
      const title = await button.getAttribute('title').catch(() => null);
      const classes = await button.getAttribute('class').catch(() => null);

      console.log(`Button ${i + 1}:`);
      if (text?.trim()) console.log(`  Text: "${text.trim()}"`);
      if (ariaLabel) console.log(`  ARIA Label: "${ariaLabel}"`);
      if (title) console.log(`  Title: "${title}"`);
      if (classes) console.log(`  Classes: ${classes.substring(0, 100)}`);
      console.log('');
    }
  }

  // Look for icon elements that might indicate tools
  console.log('\n--- Icon Elements (SVG/Lucide) ---');
  const icons = await page.locator('svg').all();
  console.log(`Found ${icons.length} SVG icons`);

  // Look for specific annotation-related patterns
  console.log('\n--- Annotation-Related Patterns ---');
  const annotationPatterns = [
    { name: 'Highlight', selector: '[class*="highlight"], button:has-text("Highlight")' },
    { name: 'Note/Comment', selector: '[class*="note"], [class*="comment"], button:has-text("Note")' },
    { name: 'Draw/Pen', selector: '[class*="draw"], [class*="pen"], button:has-text("Draw")' },
    { name: 'Markup', selector: '[class*="markup"], button:has-text("Markup")' },
    { name: 'Annotation', selector: '[class*="annotation"], button:has-text("Annotate")' },
    { name: 'Text', selector: 'button:has-text("Text"), [title*="text"]' },
    { name: 'Eraser', selector: 'button:has-text("Erase"), [title*="erase"]' },
    { name: 'Color Picker', selector: 'input[type="color"], [class*="color-picker"]' },
  ];

  for (const pattern of annotationPatterns) {
    const element = page.locator(pattern.selector).first();
    const exists = await element.isVisible().catch(() => false);
    console.log(`${exists ? '✓' : '✗'} ${pattern.name}: ${exists ? 'FOUND' : 'Not found'}`);

    if (exists) {
      await captureAnnotatedScreenshot(
        page,
        testInfo,
        `annotation-tool-${pattern.name.toLowerCase().replace(/\s+/g, '-')}`,
        `Found annotation tool: ${pattern.name}`
      );
    }
  }
}

test.describe('Continuity Annotation Toolbar Exploration', () => {
  test.setTimeout(120000); // 2 minutes for thorough exploration

  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 1080 });
  });

  test('explore continuity tab and document annotation tools', async ({ page }, testInfo) => {
    console.log('\n🔍 Starting Continuity Tab Exploration');
    console.log('Target: Production site - Second Watch Network');
    console.log('URL:', PRODUCTION_URL);

    // Step 1: Navigate to home page
    console.log('\n📍 Step 1: Navigate to home page');
    await page.goto(PRODUCTION_URL);
    await page.waitForLoadState('networkidle');
    await captureAnnotatedScreenshot(page, testInfo, '01-homepage', 'Landing page');

    // Step 2: Check authentication status
    console.log('\n📍 Step 2: Check authentication status');
    const userMenu = page.locator('[data-testid="user-menu"], [aria-label*="user menu"], button:has-text("Profile")').first();
    const isLoggedIn = await userMenu.isVisible().catch(() => false);

    console.log(`Authentication status: ${isLoggedIn ? 'LOGGED IN' : 'NOT LOGGED IN'}`);

    if (!isLoggedIn) {
      console.log('\n⚠ User not logged in. Checking for login options...');
      await captureAnnotatedScreenshot(page, testInfo, '02-not-logged-in', 'User not authenticated');

      // Look for login button
      const loginButton = page.locator('a[href*="login"], button:has-text("Login"), a:has-text("Login"), a:has-text("Sign In")').first();
      if (await loginButton.isVisible().catch(() => false)) {
        console.log('Found login button, but skipping login for this exploration');
        console.log('NOTE: Full exploration requires authenticated session');
      }

      // Skip rest of test if not logged in
      test.skip();
      return;
    }

    // Step 3: Navigate to Backlot
    console.log('\n📍 Step 3: Navigate to Backlot');
    const backlotLink = page.locator('a[href*="/backlot"]').first();
    await expect(backlotLink).toBeVisible({ timeout: 10000 });
    await backlotLink.click();
    await page.waitForLoadState('networkidle');
    await captureAnnotatedScreenshot(page, testInfo, '03-backlot-page', 'Backlot projects list');

    // Step 4: Open first available project
    console.log('\n📍 Step 4: Open a Backlot project');
    const projectLinks = page.locator('a[href*="/backlot/project/"], [data-testid="project-card"] a, .project-card a').all();
    const projects = await projectLinks;

    if (projects.length === 0) {
      console.log('⚠ No projects found');
      await captureAnnotatedScreenshot(page, testInfo, '04-no-projects', 'No projects available');
      test.skip();
      return;
    }

    console.log(`Found ${projects.length} projects`);
    await projects[0].click();
    await page.waitForLoadState('networkidle');
    await captureAnnotatedScreenshot(page, testInfo, '04-project-workspace', 'Project workspace overview');

    // Step 5: Navigate to Script section
    console.log('\n📍 Step 5: Navigate to Script section');
    const scriptLink = page.locator('a:has-text("Script"), button:has-text("Script")').first();

    if (!await scriptLink.isVisible().catch(() => false)) {
      console.log('⚠ Script link not found in sidebar');
      await captureAnnotatedScreenshot(page, testInfo, '05-script-not-found', 'Script section not available');
      test.skip();
      return;
    }

    await scriptLink.click();
    await page.waitForLoadState('networkidle');
    await captureAnnotatedScreenshot(page, testInfo, '05-script-page', 'Script section');

    // Step 6: Click Continuity tab
    console.log('\n📍 Step 6: Open Continuity tab');
    const continuityTab = page.locator('button[role="tab"]:has-text("Continuity"), [role="tab"]:has-text("Continuity")').first();

    if (!await continuityTab.isVisible().catch(() => false)) {
      console.log('⚠ Continuity tab not found');
      await captureAnnotatedScreenshot(page, testInfo, '06-continuity-tab-not-found', 'Continuity tab not available');
      test.skip();
      return;
    }

    await continuityTab.click();
    await page.waitForTimeout(2000); // Wait for content to load
    await captureAnnotatedScreenshot(page, testInfo, '06-continuity-tab', 'Continuity tab opened');

    // Step 7: Wait for workspace to load
    console.log('\n📍 Step 7: Wait for Continuity workspace to load');
    await page.waitForTimeout(3000);
    await captureAnnotatedScreenshot(page, testInfo, '07-workspace-loaded', 'Continuity workspace fully loaded');

    // Step 8: Document the entire layout
    console.log('\n📍 Step 8: Document workspace layout');
    await documentToolbarElements(page, testInfo);

    // Step 9: Capture PDF viewer area
    console.log('\n📍 Step 9: Examine PDF viewer');
    const pdfViewerSelectors = [
      'iframe[title*="PDF"]',
      'iframe[src*=".pdf"]',
      '[data-testid="pdf-iframe"]',
      '[data-testid="lined-script-overlay"]',
      'iframe',
    ];

    let pdfViewerFound = false;
    for (const selector of pdfViewerSelectors) {
      const viewer = page.locator(selector).first();
      if (await viewer.isVisible().catch(() => false)) {
        console.log(`✓ Found PDF viewer: ${selector}`);
        pdfViewerFound = true;

        const boundingBox = await viewer.boundingBox();
        if (boundingBox) {
          console.log(`  Dimensions: ${boundingBox.width}x${boundingBox.height}`);
          console.log(`  Position: (${boundingBox.x}, ${boundingBox.y})`);
        }

        await captureAnnotatedScreenshot(
          page,
          testInfo,
          '09-pdf-viewer',
          'PDF viewer area identified'
        );
        break;
      }
    }

    if (!pdfViewerFound) {
      console.log('⚠ PDF viewer not found with standard selectors');
    }

    // Step 10: Look for panels (left, center, right)
    console.log('\n📍 Step 10: Identify workspace panels');

    // Left panel - Scenes list
    const scenesPanel = page.locator('text=Scenes, [data-testid*="scenes"]').first();
    if (await scenesPanel.isVisible().catch(() => false)) {
      console.log('✓ Found left panel: Scenes list');
      await captureAnnotatedScreenshot(page, testInfo, '10-left-panel-scenes', 'Left panel - Scenes list');
    }

    // Right panel - Takes/Notes/Photos tabs
    const rightPanelTabs = ['Takes', 'Notes', 'Photos'];
    console.log('\nRight panel tabs:');
    for (const tabName of rightPanelTabs) {
      const tab = page.locator(`button[role="tab"]:has-text("${tabName}")`).first();
      const exists = await tab.isVisible().catch(() => false);
      console.log(`  ${exists ? '✓' : '✗'} ${tabName} tab: ${exists ? 'Found' : 'Not found'}`);
    }

    await captureAnnotatedScreenshot(page, testInfo, '10-right-panel', 'Right panel with tabs');

    // Step 11: Take full page screenshot
    console.log('\n📍 Step 11: Capture full workspace');
    await page.screenshot({
      path: path.join(testInfo.outputDir, '11-full-workspace.png'),
      fullPage: true,
    });
    console.log('✓ Full page screenshot captured');

    // Step 12: Test toolbar interactions
    console.log('\n📍 Step 12: Test toolbar button interactions');

    // Try clicking export button if it exists
    const exportButton = page.locator('button:has-text("Export"), button[title*="Export"]').first();
    if (await exportButton.isVisible().catch(() => false)) {
      console.log('Testing Export button...');
      await exportButton.click();
      await page.waitForTimeout(1000);
      await captureAnnotatedScreenshot(page, testInfo, '12-export-menu', 'Export menu opened');

      // Close menu by clicking elsewhere
      await page.keyboard.press('Escape');
      await page.waitForTimeout(500);
    }

    // Step 13: Document page navigation controls
    console.log('\n📍 Step 13: Document page navigation');
    const navButtons = [
      { name: 'Previous', selector: 'button:has-text("Previous"), button[aria-label*="previous"]' },
      { name: 'Next', selector: 'button:has-text("Next"), button[aria-label*="next"]' },
      { name: 'Page selector', selector: 'select, [role="combobox"]' },
    ];

    for (const nav of navButtons) {
      const element = page.locator(nav.selector).first();
      const exists = await element.isVisible().catch(() => false);
      console.log(`${exists ? '✓' : '✗'} ${nav.name}: ${exists ? 'Found' : 'Not found'}`);
    }

    // Final summary
    console.log('\n========================================');
    console.log('EXPLORATION COMPLETE');
    console.log('========================================');
    console.log('\nScreenshots saved to:', testInfo.outputDir);
    console.log('\nPlease review the screenshots to identify:');
    console.log('  1. All toolbar buttons and their purposes');
    console.log('  2. Any annotation/markup tools');
    console.log('  3. Drawing or highlighting capabilities');
    console.log('  4. Color pickers or style options');
    console.log('  5. Text annotation features');
    console.log('========================================\n');
  });

  test('document PDF viewer iframe contents', async ({ page }, testInfo) => {
    console.log('\n🔍 Exploring PDF Viewer Iframe Contents');

    // Navigate to continuity tab first (reuse navigation from previous test)
    await page.goto(PRODUCTION_URL);
    await page.waitForLoadState('networkidle');

    const userMenu = page.locator('[data-testid="user-menu"]').first();
    const isLoggedIn = await userMenu.isVisible().catch(() => false);

    if (!isLoggedIn) {
      console.log('⚠ Not logged in, skipping iframe exploration');
      test.skip();
      return;
    }

    // Quick navigation to continuity tab (assuming previous test passed)
    const backlotLink = page.locator('a[href*="/backlot"]').first();
    await backlotLink.click({ timeout: 10000 });
    await page.waitForLoadState('networkidle');

    const firstProject = page.locator('a[href*="/backlot/project/"]').first();
    await firstProject.click({ timeout: 10000 });
    await page.waitForLoadState('networkidle');

    const scriptLink = page.locator('a:has-text("Script")').first();
    await scriptLink.click({ timeout: 10000 });
    await page.waitForLoadState('networkidle');

    const continuityTab = page.locator('button[role="tab"]:has-text("Continuity")').first();
    await continuityTab.click({ timeout: 10000 });
    await page.waitForTimeout(3000);

    // Find iframe
    console.log('\n📍 Locating PDF iframe');
    const iframe = page.frameLocator('iframe').first();

    try {
      // Check if we can access iframe contents
      console.log('Attempting to access iframe contents...');

      // Look for PDF.js controls (if using PDF.js)
      const pdfToolbar = iframe.locator('#toolbarContainer, .pdfViewer, #viewer').first();
      const hasToolbar = await pdfToolbar.isVisible().catch(() => false);

      if (hasToolbar) {
        console.log('✓ PDF.js viewer detected');
        await captureAnnotatedScreenshot(page, testInfo, 'iframe-pdfjs-viewer', 'PDF.js viewer toolbar');

        // Document PDF.js buttons
        console.log('\nPDF.js Toolbar Buttons:');
        const pdfButtons = await iframe.locator('button').all();
        for (const btn of pdfButtons.slice(0, 20)) {
          const title = await btn.getAttribute('title').catch(() => null);
          if (title) console.log(`  - ${title}`);
        }
      } else {
        console.log('⚠ Using native browser PDF viewer (limited inspection)');
      }
    } catch (error) {
      console.log('⚠ Cannot access iframe contents (cross-origin restriction)');
      console.log('  This is expected for native browser PDF viewers');
    }

    await captureAnnotatedScreenshot(page, testInfo, 'iframe-final', 'Final iframe view');
  });
});
