/**
 * Comprehensive E2E Test for Continuity Tab PDF Annotations
 *
 * Tests all PDF annotation features in the Continuity tab:
 * - Highlight tool (rectangle creation)
 * - Note tool (highlight + text)
 * - Pen/Draw tool
 * - Selection of drawings
 * - Undo/Redo (Ctrl+Z, Ctrl+Shift+Z)
 * - Deleting annotations
 * - Note tooltip display on hover
 */

import { test, expect, Page } from '@playwright/test';
import * as path from 'path';

const PRODUCTION_URL = 'https://www.secondwatchnetwork.com';
const TEST_TIMEOUT = 180000; // 3 minutes

// Helper to capture screenshots with context
async function captureScreenshot(
  page: Page,
  testInfo: any,
  name: string,
  description: string
) {
  const screenshotPath = path.join(testInfo.outputDir, `${name}.png`);
  await page.screenshot({ path: screenshotPath, fullPage: false });
  console.log(`\n📸 ${name}: ${description}`);
  return screenshotPath;
}

// Helper to navigate to the Continuity tab
async function navigateToContinuityTab(page: Page, testInfo: any) {
  console.log('\n========================================');
  console.log('NAVIGATING TO CONTINUITY TAB');
  console.log('========================================\n');

  // Step 1: Go to homepage
  console.log('Step 1: Navigate to homepage');
  await page.goto(PRODUCTION_URL);
  await page.waitForLoadState('networkidle');
  await captureScreenshot(page, testInfo, '01-homepage', 'Landing page loaded');

  // Step 2: Check if logged in
  console.log('\nStep 2: Check authentication status');
  const userMenuSelectors = [
    '[data-testid="user-menu"]',
    '[aria-label*="user menu" i]',
    'button:has-text("Profile")',
    'button:has-text("Account")',
    '[data-testid="user-avatar"]'
  ];

  let isLoggedIn = false;
  for (const selector of userMenuSelectors) {
    if (await page.locator(selector).first().isVisible().catch(() => false)) {
      isLoggedIn = true;
      console.log(`✓ User is logged in (detected via: ${selector})`);
      break;
    }
  }

  if (!isLoggedIn) {
    console.log('✗ User is NOT logged in');
    await captureScreenshot(page, testInfo, '02-not-logged-in', 'Not authenticated');

    const loginButton = page.locator('a[href*="login"], button:has-text("Login"), a:has-text("Login"), a:has-text("Sign In")').first();
    if (await loginButton.isVisible().catch(() => false)) {
      console.log('\nℹ️  Login button found but authentication required');
      console.log('Please log in manually before running this test');
    }

    throw new Error('User must be logged in to test Continuity tab annotations');
  }

  await captureScreenshot(page, testInfo, '02-logged-in', 'User authenticated');

  // Step 3: Navigate to Backlot
  console.log('\nStep 3: Navigate to Backlot section');
  const backlotLink = page.locator('a[href*="/backlot"]').first();
  await expect(backlotLink).toBeVisible({ timeout: 10000 });
  await backlotLink.click();
  await page.waitForLoadState('networkidle');
  await captureScreenshot(page, testInfo, '03-backlot', 'Backlot projects page');

  // Step 4: Open a project
  console.log('\nStep 4: Open a project with continuity data');
  const projectLink = page.locator('a[href*="/backlot/project/"], [data-testid="project-card"] a').first();

  if (!await projectLink.isVisible().catch(() => false)) {
    console.log('✗ No projects found');
    await captureScreenshot(page, testInfo, '04-no-projects', 'No projects available');
    throw new Error('No projects found - please create a project first');
  }

  await projectLink.click();
  await page.waitForLoadState('networkidle');
  await captureScreenshot(page, testInfo, '04-project-opened', 'Project workspace opened');

  // Step 5: Navigate to Script section
  console.log('\nStep 5: Navigate to Script section');
  const scriptLink = page.locator('a:has-text("Script"), button:has-text("Script")').first();

  if (!await scriptLink.isVisible().catch(() => false)) {
    console.log('✗ Script section not found');
    await captureScreenshot(page, testInfo, '05-no-script-section', 'Script section not available');
    throw new Error('Script section not found in project');
  }

  await scriptLink.click();
  await page.waitForLoadState('networkidle');
  await captureScreenshot(page, testInfo, '05-script-section', 'Script section opened');

  // Step 6: Click Continuity tab
  console.log('\nStep 6: Open Continuity tab');
  const continuityTab = page.locator('button[role="tab"]:has-text("Continuity"), [role="tab"]:has-text("Continuity")').first();

  if (!await continuityTab.isVisible().catch(() => false)) {
    console.log('✗ Continuity tab not found');
    await captureScreenshot(page, testInfo, '06-no-continuity-tab', 'Continuity tab not available');
    throw new Error('Continuity tab not found');
  }

  await continuityTab.click();
  await page.waitForTimeout(3000); // Wait for workspace to fully load
  await captureScreenshot(page, testInfo, '06-continuity-tab-opened', 'Continuity tab active');

  console.log('\n✓ Successfully navigated to Continuity tab');
  console.log('========================================\n');
}

// Helper to identify the PDF viewer and annotation canvas
async function identifyPDFViewer(page: Page, testInfo: any) {
  console.log('Identifying PDF viewer and annotation canvas...');

  const viewerSelectors = [
    'iframe[title*="PDF" i]',
    'iframe[src*=".pdf"]',
    '[data-testid="pdf-viewer"]',
    '[data-testid="pdf-iframe"]',
    '[data-testid="lined-script-overlay"]',
    'canvas',
    'iframe'
  ];

  for (const selector of viewerSelectors) {
    const viewer = page.locator(selector).first();
    if (await viewer.isVisible().catch(() => false)) {
      console.log(`✓ Found PDF viewer: ${selector}`);
      const boundingBox = await viewer.boundingBox();
      if (boundingBox) {
        console.log(`  Position: (${boundingBox.x}, ${boundingBox.y})`);
        console.log(`  Size: ${boundingBox.width}x${boundingBox.height}`);
      }
      await captureScreenshot(page, testInfo, 'pdf-viewer-identified', 'PDF viewer identified');
      return { selector, element: viewer };
    }
  }

  console.log('⚠️  PDF viewer not found with standard selectors');
  return null;
}

// Helper to find annotation toolbar
async function findAnnotationToolbar(page: Page, testInfo: any) {
  console.log('\nSearching for annotation toolbar...');

  const toolbarPatterns = [
    { name: 'Toolbar container', selector: '[data-testid*="toolbar"], [class*="toolbar"]' },
    { name: 'Annotation controls', selector: '[data-testid*="annotation"], [class*="annotation"]' },
    { name: 'Drawing tools', selector: '[data-testid*="drawing"], [class*="drawing"]' },
  ];

  for (const pattern of toolbarPatterns) {
    const toolbar = page.locator(pattern.selector).first();
    if (await toolbar.isVisible().catch(() => false)) {
      console.log(`✓ Found: ${pattern.name}`);
      await captureScreenshot(page, testInfo, `toolbar-${pattern.name.replace(/\s+/g, '-')}`, pattern.name);
      return toolbar;
    }
  }

  console.log('⚠️  Annotation toolbar not found - checking all buttons');

  // Document all visible buttons
  const buttons = await page.locator('button').all();
  console.log(`\nFound ${buttons.length} buttons total`);

  const visibleButtons = [];
  for (let i = 0; i < buttons.length; i++) {
    const button = buttons[i];
    if (await button.isVisible().catch(() => false)) {
      const text = await button.textContent().catch(() => '');
      const title = await button.getAttribute('title').catch(() => null);
      const ariaLabel = await button.getAttribute('aria-label').catch(() => null);

      visibleButtons.push({
        index: i,
        text: text?.trim(),
        title,
        ariaLabel
      });
    }
  }

  console.log(`\nVisible buttons (${visibleButtons.length}):`);
  visibleButtons.forEach(btn => {
    if (btn.text || btn.title || btn.ariaLabel) {
      console.log(`  [${btn.index}] Text: "${btn.text}" | Title: "${btn.title}" | ARIA: "${btn.ariaLabel}"`);
    }
  });

  return null;
}

test.describe('Continuity Tab - PDF Annotation Tests', () => {
  test.setTimeout(TEST_TIMEOUT);

  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 1080 });
  });

  test('Test 1: Navigate to Continuity tab and identify annotation tools', async ({ page }, testInfo) => {
    console.log('\n🔍 TEST 1: Navigation and Tool Identification');
    console.log('========================================\n');

    // Navigate to Continuity tab
    await navigateToContinuityTab(page, testInfo);

    // Identify PDF viewer
    const pdfViewer = await identifyPDFViewer(page, testInfo);
    expect(pdfViewer).toBeTruthy();

    // Find annotation toolbar
    await findAnnotationToolbar(page, testInfo);

    // Take full page screenshot
    await page.screenshot({
      path: path.join(testInfo.outputDir, 'full-workspace-overview.png'),
      fullPage: true
    });
    console.log('\n✓ Full workspace screenshot captured');

    // Document all annotation-related elements
    console.log('\nSearching for annotation tool buttons...');
    const annotationTools = [
      { name: 'Highlight', patterns: ['highlight', 'rectangle', 'rect', 'box'] },
      { name: 'Note', patterns: ['note', 'comment', 'text', 'annotation'] },
      { name: 'Draw/Pen', patterns: ['draw', 'pen', 'pencil', 'brush', 'freehand'] },
      { name: 'Select', patterns: ['select', 'pointer', 'cursor', 'move'] },
      { name: 'Delete', patterns: ['delete', 'remove', 'trash', 'erase'] },
      { name: 'Undo', patterns: ['undo', 'back'] },
      { name: 'Redo', patterns: ['redo', 'forward'] },
    ];

    for (const tool of annotationTools) {
      console.log(`\nSearching for ${tool.name} tool...`);
      let found = false;

      for (const pattern of tool.patterns) {
        const selectors = [
          `button:has-text("${pattern}")`,
          `button[title*="${pattern}" i]`,
          `button[aria-label*="${pattern}" i]`,
          `[data-testid*="${pattern}"]`,
          `[class*="${pattern}"]`,
        ];

        for (const selector of selectors) {
          const element = page.locator(selector).first();
          if (await element.isVisible().catch(() => false)) {
            console.log(`  ✓ Found via: ${selector}`);
            await captureScreenshot(page, testInfo, `tool-${tool.name.toLowerCase().replace(/\//g, '-')}`, `${tool.name} tool button`);
            found = true;
            break;
          }
        }
        if (found) break;
      }

      if (!found) {
        console.log(`  ✗ ${tool.name} tool not found`);
      }
    }
  });

  test('Test 2: Test Highlight tool (drag to create rectangle)', async ({ page }, testInfo) => {
    console.log('\n🎨 TEST 2: Highlight Tool - Rectangle Creation');
    console.log('========================================\n');

    await navigateToContinuityTab(page, testInfo);
    await page.waitForTimeout(2000);

    console.log('Step 1: Find and click Highlight tool button');

    const highlightSelectors = [
      'button:has-text("Highlight")',
      'button[title*="highlight" i]',
      'button[aria-label*="highlight" i]',
      '[data-testid*="highlight"]',
      'button:has-text("Rectangle")',
      'button[title*="rectangle" i]',
    ];

    let highlightButton = null;
    for (const selector of highlightSelectors) {
      const btn = page.locator(selector).first();
      if (await btn.isVisible().catch(() => false)) {
        highlightButton = btn;
        console.log(`✓ Found Highlight button: ${selector}`);
        break;
      }
    }

    if (!highlightButton) {
      console.log('⚠️  Highlight button not found - capturing current state');
      await captureScreenshot(page, testInfo, 'highlight-button-not-found', 'Highlight button search failed');
      test.skip();
      return;
    }

    await highlightButton.click();
    await page.waitForTimeout(500);
    await captureScreenshot(page, testInfo, 'highlight-tool-activated', 'Highlight tool selected');

    console.log('\nStep 2: Drag to create a highlight rectangle on PDF');

    // Find the PDF canvas/viewer area
    const pdfCanvas = page.locator('canvas, iframe, [data-testid*="pdf"]').first();
    const canvasBox = await pdfCanvas.boundingBox();

    if (!canvasBox) {
      console.log('✗ Cannot locate PDF canvas for drawing');
      test.skip();
      return;
    }

    // Calculate drag coordinates (center of visible area)
    const startX = canvasBox.x + canvasBox.width * 0.3;
    const startY = canvasBox.y + canvasBox.height * 0.3;
    const endX = startX + 200;
    const endY = startY + 100;

    console.log(`Drawing rectangle from (${startX}, ${startY}) to (${endX}, ${endY})`);

    // Perform drag operation
    await page.mouse.move(startX, startY);
    await page.mouse.down();
    await page.mouse.move(endX, endY, { steps: 10 });
    await page.mouse.up();
    await page.waitForTimeout(1000);

    await captureScreenshot(page, testInfo, 'highlight-rectangle-created', 'Rectangle highlight drawn');
    console.log('✓ Highlight rectangle creation attempted');
  });

  test('Test 3: Test Note tool (highlight + text)', async ({ page }, testInfo) => {
    console.log('\n📝 TEST 3: Note Tool - Highlight with Text');
    console.log('========================================\n');

    await navigateToContinuityTab(page, testInfo);
    await page.waitForTimeout(2000);

    console.log('Step 1: Find and click Note tool button');

    const noteSelectors = [
      'button:has-text("Note")',
      'button[title*="note" i]',
      'button[aria-label*="note" i]',
      '[data-testid*="note"]',
      'button:has-text("Comment")',
      'button[title*="comment" i]',
    ];

    let noteButton = null;
    for (const selector of noteSelectors) {
      const btn = page.locator(selector).first();
      if (await btn.isVisible().catch(() => false)) {
        noteButton = btn;
        console.log(`✓ Found Note button: ${selector}`);
        break;
      }
    }

    if (!noteButton) {
      console.log('⚠️  Note button not found');
      await captureScreenshot(page, testInfo, 'note-button-not-found', 'Note button search failed');
      test.skip();
      return;
    }

    await noteButton.click();
    await page.waitForTimeout(500);
    await captureScreenshot(page, testInfo, 'note-tool-activated', 'Note tool selected');

    console.log('\nStep 2: Drag to create a highlight area');

    const pdfCanvas = page.locator('canvas, iframe, [data-testid*="pdf"]').first();
    const canvasBox = await pdfCanvas.boundingBox();

    if (!canvasBox) {
      console.log('✗ Cannot locate PDF canvas');
      test.skip();
      return;
    }

    const startX = canvasBox.x + canvasBox.width * 0.4;
    const startY = canvasBox.y + canvasBox.height * 0.4;
    const endX = startX + 150;
    const endY = startY + 80;

    await page.mouse.move(startX, startY);
    await page.mouse.down();
    await page.mouse.move(endX, endY, { steps: 10 });
    await page.mouse.up();
    await page.waitForTimeout(1000);

    await captureScreenshot(page, testInfo, 'note-highlight-created', 'Note highlight area created');

    console.log('\nStep 3: Look for text input dialog/field to add note text');

    const textInputSelectors = [
      'textarea',
      'input[type="text"]',
      '[contenteditable="true"]',
      '[data-testid*="note-text"]',
      '[placeholder*="note" i]',
      '[placeholder*="comment" i]',
    ];

    let textInput = null;
    for (const selector of textInputSelectors) {
      const input = page.locator(selector).last(); // Use last() to get most recently added
      if (await input.isVisible().catch(() => false)) {
        textInput = input;
        console.log(`✓ Found text input: ${selector}`);
        break;
      }
    }

    if (textInput) {
      const testNoteText = 'This is a test annotation note';
      await textInput.fill(testNoteText);
      await page.waitForTimeout(500);
      await captureScreenshot(page, testInfo, 'note-text-entered', 'Note text entered');

      // Look for Save/Submit button
      const saveButton = page.locator('button:has-text("Save"), button:has-text("OK"), button:has-text("Add")').first();
      if (await saveButton.isVisible().catch(() => false)) {
        await saveButton.click();
        await page.waitForTimeout(500);
        await captureScreenshot(page, testInfo, 'note-saved', 'Note saved');
        console.log('✓ Note text saved');
      }
    } else {
      console.log('⚠️  Text input not found - note may use different interaction pattern');
      await captureScreenshot(page, testInfo, 'note-text-input-not-found', 'No text input detected');
    }
  });

  test('Test 4: Test Pen/Draw tool', async ({ page }, testInfo) => {
    console.log('\n✏️  TEST 4: Pen/Draw Tool - Freehand Drawing');
    console.log('========================================\n');

    await navigateToContinuityTab(page, testInfo);
    await page.waitForTimeout(2000);

    console.log('Step 1: Find and click Pen/Draw tool button');

    const drawSelectors = [
      'button:has-text("Draw")',
      'button:has-text("Pen")',
      'button[title*="draw" i]',
      'button[title*="pen" i]',
      'button[aria-label*="draw" i]',
      'button[aria-label*="pen" i]',
      '[data-testid*="draw"]',
      '[data-testid*="pen"]',
      'button:has-text("Pencil")',
      'button:has-text("Brush")',
    ];

    let drawButton = null;
    for (const selector of drawSelectors) {
      const btn = page.locator(selector).first();
      if (await btn.isVisible().catch(() => false)) {
        drawButton = btn;
        console.log(`✓ Found Draw button: ${selector}`);
        break;
      }
    }

    if (!drawButton) {
      console.log('⚠️  Draw button not found');
      await captureScreenshot(page, testInfo, 'draw-button-not-found', 'Draw button search failed');
      test.skip();
      return;
    }

    await drawButton.click();
    await page.waitForTimeout(500);
    await captureScreenshot(page, testInfo, 'draw-tool-activated', 'Draw tool selected');

    console.log('\nStep 2: Draw a freehand path on PDF');

    const pdfCanvas = page.locator('canvas, iframe, [data-testid*="pdf"]').first();
    const canvasBox = await pdfCanvas.boundingBox();

    if (!canvasBox) {
      console.log('✗ Cannot locate PDF canvas');
      test.skip();
      return;
    }

    // Draw a simple curve
    const baseX = canvasBox.x + canvasBox.width * 0.5;
    const baseY = canvasBox.y + canvasBox.height * 0.5;

    console.log('Drawing freehand curve...');
    await page.mouse.move(baseX, baseY);
    await page.mouse.down();

    // Draw a wavy line
    for (let i = 0; i <= 100; i += 5) {
      const x = baseX + i;
      const y = baseY + Math.sin(i * 0.1) * 20;
      await page.mouse.move(x, y);
    }

    await page.mouse.up();
    await page.waitForTimeout(1000);

    await captureScreenshot(page, testInfo, 'draw-freehand-created', 'Freehand drawing created');
    console.log('✓ Freehand drawing attempted');
  });

  test('Test 5: Test selecting drawings', async ({ page }, testInfo) => {
    console.log('\n👆 TEST 5: Select Tool - Selecting Annotations');
    console.log('========================================\n');

    await navigateToContinuityTab(page, testInfo);
    await page.waitForTimeout(2000);

    console.log('Step 1: Create an annotation first (using highlight tool)');

    // Create a test annotation
    const highlightButton = page.locator('button:has-text("Highlight"), button[title*="highlight" i]').first();
    if (await highlightButton.isVisible().catch(() => false)) {
      await highlightButton.click();
      await page.waitForTimeout(500);

      const pdfCanvas = page.locator('canvas, iframe, [data-testid*="pdf"]').first();
      const canvasBox = await pdfCanvas.boundingBox();

      if (canvasBox) {
        const x = canvasBox.x + canvasBox.width * 0.35;
        const y = canvasBox.y + canvasBox.height * 0.35;

        await page.mouse.move(x, y);
        await page.mouse.down();
        await page.mouse.move(x + 100, y + 60, { steps: 5 });
        await page.mouse.up();
        await page.waitForTimeout(1000);

        await captureScreenshot(page, testInfo, 'select-test-annotation-created', 'Test annotation for selection');
      }
    }

    console.log('\nStep 2: Find and click Select tool');

    const selectSelectors = [
      'button:has-text("Select")',
      'button[title*="select" i]',
      'button[aria-label*="select" i]',
      '[data-testid*="select"]',
      'button:has-text("Pointer")',
      'button:has-text("Cursor")',
    ];

    let selectButton = null;
    for (const selector of selectSelectors) {
      const btn = page.locator(selector).first();
      if (await btn.isVisible().catch(() => false)) {
        selectButton = btn;
        console.log(`✓ Found Select button: ${selector}`);
        break;
      }
    }

    if (!selectButton) {
      console.log('⚠️  Select button not found');
      await captureScreenshot(page, testInfo, 'select-button-not-found', 'Select button search failed');
      test.skip();
      return;
    }

    await selectButton.click();
    await page.waitForTimeout(500);
    await captureScreenshot(page, testInfo, 'select-tool-activated', 'Select tool activated');

    console.log('\nStep 3: Click on the created annotation to select it');

    const pdfCanvas = page.locator('canvas, iframe, [data-testid*="pdf"]').first();
    const canvasBox = await pdfCanvas.boundingBox();

    if (canvasBox) {
      const clickX = canvasBox.x + canvasBox.width * 0.35 + 50; // Center of rectangle
      const clickY = canvasBox.y + canvasBox.height * 0.35 + 30;

      await page.mouse.click(clickX, clickY);
      await page.waitForTimeout(1000);

      await captureScreenshot(page, testInfo, 'annotation-selected', 'Annotation selected (should show handles/highlight)');
      console.log('✓ Clicked on annotation to select it');
    }
  });

  test('Test 6: Test Undo/Redo with keyboard shortcuts', async ({ page }, testInfo) => {
    console.log('\n⏮️  TEST 6: Undo/Redo - Keyboard Shortcuts');
    console.log('========================================\n');

    await navigateToContinuityTab(page, testInfo);
    await page.waitForTimeout(2000);

    console.log('Step 1: Create an annotation to undo');

    const highlightButton = page.locator('button:has-text("Highlight"), button[title*="highlight" i]').first();
    if (await highlightButton.isVisible().catch(() => false)) {
      await highlightButton.click();
      await page.waitForTimeout(500);

      const pdfCanvas = page.locator('canvas, iframe, [data-testid*="pdf"]').first();
      const canvasBox = await pdfCanvas.boundingBox();

      if (canvasBox) {
        const x = canvasBox.x + canvasBox.width * 0.3;
        const y = canvasBox.y + canvasBox.height * 0.3;

        await page.mouse.move(x, y);
        await page.mouse.down();
        await page.mouse.move(x + 120, y + 70, { steps: 5 });
        await page.mouse.up();
        await page.waitForTimeout(1000);

        await captureScreenshot(page, testInfo, 'undo-annotation-created', 'Annotation created for undo test');
      }
    }

    console.log('\nStep 2: Test Undo (Ctrl+Z)');
    await page.keyboard.press('Control+z');
    await page.waitForTimeout(1000);
    await captureScreenshot(page, testInfo, 'after-undo', 'After Ctrl+Z (annotation should be removed)');
    console.log('✓ Pressed Ctrl+Z');

    console.log('\nStep 3: Test Redo (Ctrl+Shift+Z)');
    await page.keyboard.press('Control+Shift+z');
    await page.waitForTimeout(1000);
    await captureScreenshot(page, testInfo, 'after-redo', 'After Ctrl+Shift+Z (annotation should return)');
    console.log('✓ Pressed Ctrl+Shift+Z');

    console.log('\nStep 4: Create another annotation and undo again');
    if (await highlightButton.isVisible().catch(() => false)) {
      await highlightButton.click();
      await page.waitForTimeout(500);

      const pdfCanvas = page.locator('canvas, iframe, [data-testid*="pdf"]').first();
      const canvasBox = await pdfCanvas.boundingBox();

      if (canvasBox) {
        const x = canvasBox.x + canvasBox.width * 0.5;
        const y = canvasBox.y + canvasBox.height * 0.5;

        await page.mouse.move(x, y);
        await page.mouse.down();
        await page.mouse.move(x + 100, y + 60, { steps: 5 });
        await page.mouse.up();
        await page.waitForTimeout(1000);

        await captureScreenshot(page, testInfo, 'second-annotation-created', 'Second annotation created');

        await page.keyboard.press('Control+z');
        await page.waitForTimeout(1000);
        await captureScreenshot(page, testInfo, 'second-undo', 'Second annotation undone');
        console.log('✓ Second undo test completed');
      }
    }
  });

  test('Test 7: Test deleting selected annotations', async ({ page }, testInfo) => {
    console.log('\n🗑️  TEST 7: Delete Selected Annotations');
    console.log('========================================\n');

    await navigateToContinuityTab(page, testInfo);
    await page.waitForTimeout(2000);

    console.log('Step 1: Create an annotation to delete');

    const highlightButton = page.locator('button:has-text("Highlight"), button[title*="highlight" i]').first();
    if (await highlightButton.isVisible().catch(() => false)) {
      await highlightButton.click();
      await page.waitForTimeout(500);

      const pdfCanvas = page.locator('canvas, iframe, [data-testid*="pdf"]').first();
      const canvasBox = await pdfCanvas.boundingBox();

      if (canvasBox) {
        const x = canvasBox.x + canvasBox.width * 0.4;
        const y = canvasBox.y + canvasBox.height * 0.4;

        await page.mouse.move(x, y);
        await page.mouse.down();
        await page.mouse.move(x + 100, y + 60, { steps: 5 });
        await page.mouse.up();
        await page.waitForTimeout(1000);

        await captureScreenshot(page, testInfo, 'delete-annotation-created', 'Annotation created for deletion');
      }
    }

    console.log('\nStep 2: Select the annotation');

    const selectButton = page.locator('button:has-text("Select"), button[title*="select" i]').first();
    if (await selectButton.isVisible().catch(() => false)) {
      await selectButton.click();
      await page.waitForTimeout(500);

      const pdfCanvas = page.locator('canvas, iframe, [data-testid*="pdf"]').first();
      const canvasBox = await pdfCanvas.boundingBox();

      if (canvasBox) {
        const clickX = canvasBox.x + canvasBox.width * 0.4 + 50;
        const clickY = canvasBox.y + canvasBox.height * 0.4 + 30;

        await page.mouse.click(clickX, clickY);
        await page.waitForTimeout(1000);
        await captureScreenshot(page, testInfo, 'annotation-selected-for-delete', 'Annotation selected');
      }
    }

    console.log('\nStep 3: Try multiple delete methods');

    // Method 1: Delete key
    console.log('  Trying Delete key...');
    await page.keyboard.press('Delete');
    await page.waitForTimeout(1000);
    await captureScreenshot(page, testInfo, 'after-delete-key', 'After pressing Delete key');

    // Method 2: Backspace key
    console.log('  Trying Backspace key...');
    await page.keyboard.press('Backspace');
    await page.waitForTimeout(1000);
    await captureScreenshot(page, testInfo, 'after-backspace-key', 'After pressing Backspace key');

    // Method 3: Delete button in toolbar
    console.log('  Looking for Delete button...');
    const deleteButtonSelectors = [
      'button:has-text("Delete")',
      'button[title*="delete" i]',
      'button[aria-label*="delete" i]',
      '[data-testid*="delete"]',
      'button:has-text("Remove")',
      'button[title*="remove" i]',
    ];

    for (const selector of deleteButtonSelectors) {
      const btn = page.locator(selector).first();
      if (await btn.isVisible().catch(() => false)) {
        console.log(`  ✓ Found Delete button: ${selector}`);
        await btn.click();
        await page.waitForTimeout(1000);
        await captureScreenshot(page, testInfo, 'after-delete-button', 'After clicking Delete button');
        break;
      }
    }

    console.log('✓ Delete test completed');
  });

  test('Test 8: Test note tooltip on hover', async ({ page }, testInfo) => {
    console.log('\n💬 TEST 8: Note Tooltip on Hover');
    console.log('========================================\n');

    await navigateToContinuityTab(page, testInfo);
    await page.waitForTimeout(2000);

    console.log('Step 1: Create a note annotation with text');

    const noteButton = page.locator('button:has-text("Note"), button[title*="note" i]').first();
    if (await noteButton.isVisible().catch(() => false)) {
      await noteButton.click();
      await page.waitForTimeout(500);

      const pdfCanvas = page.locator('canvas, iframe, [data-testid*="pdf"]').first();
      const canvasBox = await pdfCanvas.boundingBox();

      if (canvasBox) {
        const x = canvasBox.x + canvasBox.width * 0.45;
        const y = canvasBox.y + canvasBox.height * 0.45;

        // Create the note highlight
        await page.mouse.move(x, y);
        await page.mouse.down();
        await page.mouse.move(x + 120, y + 70, { steps: 5 });
        await page.mouse.up();
        await page.waitForTimeout(1000);

        await captureScreenshot(page, testInfo, 'tooltip-note-created', 'Note highlight created');

        // Add text to the note
        const textInput = page.locator('textarea, input[type="text"], [contenteditable="true"]').last();
        if (await textInput.isVisible().catch(() => false)) {
          const noteText = 'Hover over me to see this tooltip!';
          await textInput.fill(noteText);
          await page.waitForTimeout(500);

          const saveButton = page.locator('button:has-text("Save"), button:has-text("OK"), button:has-text("Add")').first();
          if (await saveButton.isVisible().catch(() => false)) {
            await saveButton.click();
            await page.waitForTimeout(1000);
            await captureScreenshot(page, testInfo, 'tooltip-note-saved', 'Note saved with text');
          }
        }
      }
    }

    console.log('\nStep 2: Hover over the note to trigger tooltip');

    const pdfCanvas = page.locator('canvas, iframe, [data-testid*="pdf"]').first();
    const canvasBox = await pdfCanvas.boundingBox();

    if (canvasBox) {
      const hoverX = canvasBox.x + canvasBox.width * 0.45 + 60; // Center of note
      const hoverY = canvasBox.y + canvasBox.height * 0.45 + 35;

      console.log(`Hovering at (${hoverX}, ${hoverY})`);
      await page.mouse.move(hoverX, hoverY);
      await page.waitForTimeout(2000); // Wait for tooltip to appear

      await captureScreenshot(page, testInfo, 'tooltip-displayed', 'Hovering over note (tooltip should appear)');
      console.log('✓ Hovered over note annotation');

      // Check for tooltip elements
      const tooltipSelectors = [
        '[role="tooltip"]',
        '[data-testid*="tooltip"]',
        '[class*="tooltip"]',
        '.popover',
        '[data-state="open"]',
      ];

      for (const selector of tooltipSelectors) {
        const tooltip = page.locator(selector).last();
        if (await tooltip.isVisible().catch(() => false)) {
          console.log(`✓ Found visible tooltip: ${selector}`);
          const tooltipText = await tooltip.textContent();
          console.log(`  Tooltip content: "${tooltipText}"`);
          await captureScreenshot(page, testInfo, 'tooltip-found', 'Tooltip element detected');
          break;
        }
      }
    }

    console.log('\nStep 3: Move mouse away to hide tooltip');
    await page.mouse.move(100, 100);
    await page.waitForTimeout(1000);
    await captureScreenshot(page, testInfo, 'tooltip-hidden', 'Mouse moved away (tooltip should hide)');
    console.log('✓ Tooltip test completed');
  });

  test('Test 9: Full workflow test - Create, Select, Undo, Delete', async ({ page }, testInfo) => {
    console.log('\n🔄 TEST 9: Complete Workflow Integration');
    console.log('========================================\n');

    await navigateToContinuityTab(page, testInfo);
    await page.waitForTimeout(2000);

    console.log('Workflow Step 1: Create multiple annotations');

    // Create first highlight
    const highlightButton = page.locator('button:has-text("Highlight"), button[title*="highlight" i]').first();
    if (await highlightButton.isVisible().catch(() => false)) {
      await highlightButton.click();
      await page.waitForTimeout(500);

      const pdfCanvas = page.locator('canvas, iframe, [data-testid*="pdf"]').first();
      const canvasBox = await pdfCanvas.boundingBox();

      if (canvasBox) {
        // First annotation
        let x = canvasBox.x + canvasBox.width * 0.25;
        let y = canvasBox.y + canvasBox.height * 0.25;
        await page.mouse.move(x, y);
        await page.mouse.down();
        await page.mouse.move(x + 100, y + 60, { steps: 5 });
        await page.mouse.up();
        await page.waitForTimeout(1000);
        await captureScreenshot(page, testInfo, 'workflow-annotation-1', 'First annotation created');

        // Second annotation
        x = canvasBox.x + canvasBox.width * 0.5;
        y = canvasBox.y + canvasBox.height * 0.5;
        await page.mouse.move(x, y);
        await page.mouse.down();
        await page.mouse.move(x + 100, y + 60, { steps: 5 });
        await page.mouse.up();
        await page.waitForTimeout(1000);
        await captureScreenshot(page, testInfo, 'workflow-annotation-2', 'Second annotation created');

        // Third annotation
        x = canvasBox.x + canvasBox.width * 0.35;
        y = canvasBox.y + canvasBox.height * 0.6;
        await page.mouse.move(x, y);
        await page.mouse.down();
        await page.mouse.move(x + 100, y + 60, { steps: 5 });
        await page.mouse.up();
        await page.waitForTimeout(1000);
        await captureScreenshot(page, testInfo, 'workflow-annotations-all', 'All three annotations created');
      }
    }

    console.log('\nWorkflow Step 2: Undo last annotation');
    await page.keyboard.press('Control+z');
    await page.waitForTimeout(1000);
    await captureScreenshot(page, testInfo, 'workflow-after-undo', 'After undo (should have 2 annotations)');

    console.log('\nWorkflow Step 3: Redo to bring it back');
    await page.keyboard.press('Control+Shift+z');
    await page.waitForTimeout(1000);
    await captureScreenshot(page, testInfo, 'workflow-after-redo', 'After redo (should have 3 annotations again)');

    console.log('\nWorkflow Step 4: Select and delete one annotation');
    const selectButton = page.locator('button:has-text("Select"), button[title*="select" i]').first();
    if (await selectButton.isVisible().catch(() => false)) {
      await selectButton.click();
      await page.waitForTimeout(500);

      const pdfCanvas = page.locator('canvas, iframe, [data-testid*="pdf"]').first();
      const canvasBox = await pdfCanvas.boundingBox();

      if (canvasBox) {
        const clickX = canvasBox.x + canvasBox.width * 0.5 + 50;
        const clickY = canvasBox.y + canvasBox.height * 0.5 + 30;
        await page.mouse.click(clickX, clickY);
        await page.waitForTimeout(1000);
        await captureScreenshot(page, testInfo, 'workflow-annotation-selected', 'Middle annotation selected');

        await page.keyboard.press('Delete');
        await page.waitForTimeout(1000);
        await captureScreenshot(page, testInfo, 'workflow-annotation-deleted', 'After delete (should have 2 annotations)');
      }
    }

    console.log('\nWorkflow Step 5: Take final screenshot');
    await page.screenshot({
      path: path.join(testInfo.outputDir, 'workflow-final-state.png'),
      fullPage: true
    });

    console.log('\n✅ Complete workflow test finished');
    console.log('========================================\n');
  });
});
