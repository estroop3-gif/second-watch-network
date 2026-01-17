/**
 * Script Editor Visual Bug Investigation
 *
 * This test navigates to the Backlot script editor and investigates the reported issues:
 * 1. Weird wrapping on the "View Script" tab
 * 2. Text overlapping each other
 * 3. Formatting is messed up in the first dialogue box for "Elias"
 *
 * The test will:
 * - Navigate to a project with a script
 * - Switch between Edit/View modes
 * - Take screenshots to document the issues
 * - Inspect the DOM structure and CSS
 * - Measure element positioning to identify overlap
 */
import { test, expect } from '@playwright/test';

// Test configuration
const TEST_USER = {
  email: 'claude@secondwatchnetwork.com',
  password: 'TestPassword123!'
};

const SCREENSHOT_DIR = '/tmp/script-editor-bugs/';

test.describe('Script Editor Visual Bug Investigation', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate directly to login page
    await page.goto('http://localhost:8080/login');
    await page.waitForLoadState('networkidle');

    // Login
    await page.waitForSelector('input[type="email"]', { timeout: 10000 });
    await page.fill('input[type="email"]', TEST_USER.email);
    await page.fill('input[type="password"]', TEST_USER.password);
    await page.click('button[type="submit"]');
    await page.waitForLoadState('networkidle');

    // Wait for dashboard to load
    await page.waitForTimeout(2000);
  });

  test('investigate script editor rendering issues', async ({ page }) => {
    console.log('\n=== STEP 1: Navigate to Backlot ===');
    const backlotLink = page.locator('a:has-text("Backlot"), button:has-text("Backlot")').first();
    await backlotLink.click();
    await page.waitForLoadState('networkidle');
    await page.screenshot({ path: `${SCREENSHOT_DIR}01-backlot-projects.png` });

    console.log('\n=== STEP 2: Open a Project ===');
    // Find and click first project
    const projectCard = page.locator('[data-testid="project-card"], .project-card, a[href*="project"]').first();
    await projectCard.waitFor({ state: 'visible', timeout: 10000 });
    await projectCard.click();
    await page.waitForLoadState('networkidle');
    await page.screenshot({ path: `${SCREENSHOT_DIR}02-project-workspace.png` });

    console.log('\n=== STEP 3: Navigate to Script Tab ===');
    // Click Script tab/button
    const scriptTab = page.locator('text=Script, a:has-text("Script"), button:has-text("Script")').first();
    await scriptTab.click();
    await page.waitForLoadState('networkidle');
    await page.screenshot({ path: `${SCREENSHOT_DIR}03-script-tab-initial.png` });

    console.log('\n=== STEP 4: Examine View Mode ===');
    // Check if we're in View or Edit mode
    const viewButton = page.locator('button:has-text("View")');
    const editButton = page.locator('button:has-text("Edit")');

    const isViewButtonVisible = await viewButton.isVisible().catch(() => false);
    const isEditButtonVisible = await editButton.isVisible().catch(() => false);

    console.log('View button visible:', isViewButtonVisible);
    console.log('Edit button visible:', isEditButtonVisible);

    // Switch to View mode if we're not already there
    if (isViewButtonVisible) {
      console.log('Clicking View button to enter View mode...');
      await viewButton.click();
      await page.waitForTimeout(1000);
      await page.screenshot({ path: `${SCREENSHOT_DIR}04-view-mode.png`, fullPage: true });
    }

    console.log('\n=== STEP 5: Inspect Script Elements ===');
    // Find script elements
    const scriptElements = page.locator('div.relative.cursor-text');
    const elementCount = await scriptElements.count();
    console.log(`Found ${elementCount} script elements`);

    // Take a full-page screenshot to see all content
    await page.screenshot({ path: `${SCREENSHOT_DIR}05-full-script-view.png`, fullPage: true });

    // Examine the first few elements (especially looking for "Elias" dialogue)
    for (let i = 0; i < Math.min(10, elementCount); i++) {
      const element = scriptElements.nth(i);
      const text = await element.textContent();
      const boundingBox = await element.boundingBox();

      console.log(`\nElement ${i}:`);
      console.log(`  Text: ${text?.substring(0, 50)}...`);
      console.log(`  Position: x=${boundingBox?.x}, y=${boundingBox?.y}`);
      console.log(`  Size: w=${boundingBox?.width}, h=${boundingBox?.height}`);

      // Check for "Elias" specifically
      if (text?.includes('ELIAS') || text?.includes('Elias')) {
        console.log('  ⚠️ FOUND ELIAS ELEMENT - Taking detailed screenshot');
        await element.screenshot({ path: `${SCREENSHOT_DIR}06-elias-element-${i}.png` });

        // Get computed styles
        const styles = await element.evaluate((el) => {
          const computed = window.getComputedStyle(el);
          return {
            marginLeft: computed.marginLeft,
            width: computed.width,
            fontSize: computed.fontSize,
            lineHeight: computed.lineHeight,
            whiteSpace: computed.whiteSpace,
            wordWrap: computed.wordWrap,
            overflow: computed.overflow,
            position: computed.position,
            display: computed.display,
          };
        });
        console.log('  Computed styles:', styles);
      }
    }

    console.log('\n=== STEP 6: Check for Overlapping Elements ===');
    // Get all element positions and check for overlaps
    const positions = await scriptElements.evaluateAll((elements) => {
      return elements.map((el, index) => {
        const rect = el.getBoundingClientRect();
        const text = el.textContent?.substring(0, 30) || '';
        return {
          index,
          text,
          top: rect.top,
          left: rect.left,
          right: rect.right,
          bottom: rect.bottom,
          width: rect.width,
          height: rect.height,
        };
      });
    });

    // Check for overlaps
    let overlapsFound = 0;
    for (let i = 0; i < positions.length - 1; i++) {
      const current = positions[i];
      const next = positions[i + 1];

      // Check if elements overlap vertically
      if (current.bottom > next.top) {
        overlapsFound++;
        console.log(`\n⚠️ OVERLAP DETECTED between elements ${i} and ${i + 1}:`);
        console.log(`  Element ${i}: "${current.text}" - bottom: ${current.bottom}`);
        console.log(`  Element ${i + 1}: "${next.text}" - top: ${next.top}`);
        console.log(`  Overlap amount: ${current.bottom - next.top}px`);
      }
    }

    console.log(`\nTotal overlaps found: ${overlapsFound}`);

    console.log('\n=== STEP 7: Examine Page Structure ===');
    // Get the page container structure
    const pageStructure = await page.evaluate(() => {
      const scriptPage = document.querySelector('.bg-white.shadow-lg');
      if (!scriptPage) return null;

      const computed = window.getComputedStyle(scriptPage);
      return {
        width: computed.width,
        height: computed.height,
        padding: {
          top: computed.paddingTop,
          left: computed.paddingLeft,
          right: computed.paddingRight,
          bottom: computed.paddingBottom,
        },
        overflow: computed.overflow,
        position: computed.position,
      };
    });

    console.log('Page container structure:', pageStructure);

    console.log('\n=== STEP 8: Test Edit Mode ===');
    // Switch to Edit mode to see if issues persist
    const startEditButton = page.locator('button:has-text("Edit")').first();
    const canEdit = await startEditButton.isVisible().catch(() => false);

    if (canEdit) {
      console.log('Switching to Edit mode...');
      await startEditButton.click();
      await page.waitForTimeout(1000);
      await page.screenshot({ path: `${SCREENSHOT_DIR}08-edit-mode.png`, fullPage: true });

      // Click on the first element to activate editing
      const firstElement = scriptElements.first();
      await firstElement.click();
      await page.waitForTimeout(500);
      await page.screenshot({ path: `${SCREENSHOT_DIR}09-editing-element.png` });

      // Check if textarea appears
      const textarea = page.locator('textarea').first();
      const textareaVisible = await textarea.isVisible().catch(() => false);
      console.log('Textarea visible in edit mode:', textareaVisible);

      if (textareaVisible) {
        const textareaStyles = await textarea.evaluate((el) => {
          const computed = window.getComputedStyle(el);
          return {
            width: computed.width,
            fontSize: computed.fontSize,
            lineHeight: computed.lineHeight,
            whiteSpace: computed.whiteSpace,
            wordWrap: computed.wordWrap,
            overflow: computed.overflow,
            height: computed.height,
            minHeight: computed.minHeight,
          };
        });
        console.log('Textarea styles:', textareaStyles);
      }
    }

    console.log('\n=== STEP 9: Zoom Level Test ===');
    // Test different zoom levels to see if wrapping/overlap changes
    const zoomOutButton = page.locator('button:has([class*="ZoomOut"])');
    const zoomInButton = page.locator('button:has([class*="ZoomIn"])');

    if (await zoomOutButton.isVisible().catch(() => false)) {
      console.log('Testing zoom out...');
      await zoomOutButton.click();
      await page.waitForTimeout(500);
      await page.screenshot({ path: `${SCREENSHOT_DIR}10-zoomed-out.png`, fullPage: true });

      console.log('Testing zoom in...');
      await zoomInButton.click();
      await zoomInButton.click();
      await page.waitForTimeout(500);
      await page.screenshot({ path: `${SCREENSHOT_DIR}11-zoomed-in.png`, fullPage: true });
    }

    console.log('\n=== STEP 10: CSS Analysis ===');
    // Extract all relevant CSS for script elements
    const cssAnalysis = await page.evaluate(() => {
      const elements = document.querySelectorAll('.relative.cursor-text');
      if (elements.length === 0) return null;

      const firstElement = elements[0];
      const computed = window.getComputedStyle(firstElement);

      return {
        elementCount: elements.length,
        parentPadding: window.getComputedStyle(firstElement.parentElement!).padding,
        elementStyles: {
          marginLeft: computed.marginLeft,
          marginBottom: computed.marginBottom,
          width: computed.width,
          fontSize: computed.fontSize,
          lineHeight: computed.lineHeight,
          fontFamily: computed.fontFamily,
          textAlign: computed.textAlign,
          whiteSpace: computed.whiteSpace,
          wordBreak: computed.wordBreak,
          overflowWrap: computed.overflowWrap,
          minHeight: computed.minHeight,
        },
      };
    });

    console.log('\nCSS Analysis:', JSON.stringify(cssAnalysis, null, 2));

    console.log('\n=== Test Complete ===');
    console.log(`Screenshots saved to: ${SCREENSHOT_DIR}`);
  });

  test('measure text wrapping behavior', async ({ page }) => {
    console.log('\n=== Text Wrapping Measurement Test ===');

    // Navigate to script editor
    await page.locator('a:has-text("Backlot"), button:has-text("Backlot")').first().click();
    await page.waitForLoadState('networkidle');

    const projectCard = page.locator('[data-testid="project-card"], .project-card, a[href*="project"]').first();
    await projectCard.waitFor({ state: 'visible', timeout: 10000 });
    await projectCard.click();
    await page.waitForLoadState('networkidle');

    await page.locator('text=Script').first().click();
    await page.waitForLoadState('networkidle');

    // Find long dialogue lines (most likely to show wrapping issues)
    const wrappingAnalysis = await page.evaluate(() => {
      const elements = Array.from(document.querySelectorAll('.relative.cursor-text'));

      return elements.map((el, index) => {
        const text = el.textContent || '';
        const rect = el.getBoundingClientRect();
        const computed = window.getComputedStyle(el);
        const span = el.querySelector('span');
        const spanRect = span?.getBoundingClientRect();

        return {
          index,
          textLength: text.length,
          textPreview: text.substring(0, 40),
          containerWidth: rect.width,
          containerHeight: rect.height,
          contentHeight: spanRect?.height || 0,
          isOverflowing: spanRect ? spanRect.height > rect.height : false,
          fontSize: computed.fontSize,
          lineHeight: computed.lineHeight,
          expectedLines: spanRect && computed.lineHeight ?
            Math.ceil(spanRect.height / parseFloat(computed.lineHeight)) : 0,
        };
      }).filter(item => item.textLength > 50); // Focus on longer text
    });

    console.log('\nWrapping Analysis (long text only):');
    wrappingAnalysis.forEach((item, i) => {
      console.log(`\nElement ${item.index}:`);
      console.log(`  Text: "${item.textPreview}..."`);
      console.log(`  Container: ${item.containerWidth}w x ${item.containerHeight}h`);
      console.log(`  Content height: ${item.contentHeight}`);
      console.log(`  Expected lines: ${item.expectedLines}`);
      console.log(`  Overflowing: ${item.isOverflowing ? '⚠️ YES' : 'No'}`);
    });

    await page.screenshot({ path: `${SCREENSHOT_DIR}12-wrapping-test.png`, fullPage: true });
  });
});
