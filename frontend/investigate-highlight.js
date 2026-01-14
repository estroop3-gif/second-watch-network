const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const OUTPUT_DIR = '/home/estro/second-watch-network/backend/test-output';

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    console.log('Navigating to http://localhost:8080...');
    await page.goto('http://localhost:8080');
    await page.waitForLoadState('networkidle');

    await page.screenshot({ path: path.join(OUTPUT_DIR, '01-initial-page.png'), fullPage: true });
    console.log('Screenshot 1: Initial page');

    // Try to find Backlot link
    const backlotLink = page.locator('text=Backlot').or(page.locator('[href*="backlot"]')).first();
    const backlotVisible = await backlotLink.isVisible({ timeout: 5000 }).catch(() => false);

    if (backlotVisible) {
      console.log('Clicking Backlot link...');
      await backlotLink.click();
      await page.waitForLoadState('networkidle');
      await page.screenshot({ path: path.join(OUTPUT_DIR, '02-backlot-section.png'), fullPage: true });
      console.log('Screenshot 2: Backlot section');
    } else {
      console.log('Backlot link not found, checking page content...');
      const pageText = await page.textContent('body');
      console.log('Page text preview:', pageText.substring(0, 500));
    }

    // Wait a bit
    await page.waitForTimeout(2000);

    // Look for project links
    const projectSelectors = [
      '[href*="project"]',
      '[href*="script"]',
      '.project-card',
      '.project-item',
      'a:has-text("Project")',
      'button:has-text("Project")'
    ];

    let projectFound = false;
    for (const selector of projectSelectors) {
      const elements = page.locator(selector);
      const count = await elements.count();
      if (count > 0) {
        console.log(`Found ${count} elements with selector: ${selector}`);
        await elements.first().click();
        await page.waitForLoadState('networkidle');
        projectFound = true;
        break;
      }
    }

    if (projectFound) {
      await page.screenshot({ path: path.join(OUTPUT_DIR, '03-project-opened.png'), fullPage: true });
      console.log('Screenshot 3: Project opened');

      // Look for script viewer
      await page.waitForTimeout(1000);
      const scriptLink = page.locator('text=Script').or(page.locator('[href*="script"]')).first();
      const scriptVisible = await scriptLink.isVisible({ timeout: 5000 }).catch(() => false);

      if (scriptVisible) {
        console.log('Clicking script link...');
        await scriptLink.click();
        await page.waitForLoadState('networkidle');
        await page.screenshot({ path: path.join(OUTPUT_DIR, '04-script-viewer.png'), fullPage: true });
        console.log('Screenshot 4: Script viewer');
      }
    }

    // Wait for content to render
    await page.waitForTimeout(2000);

    // Look for highlights
    const highlightSelectors = ['.highlight', '[data-highlight]', 'mark', '.highlighted', '[class*="highlight"]'];
    let totalHighlights = 0;

    for (const selector of highlightSelectors) {
      const count = await page.locator(selector).count();
      if (count > 0) {
        console.log(`Found ${count} elements with selector: ${selector}`);
        totalHighlights += count;
      }
    }

    console.log(`Total potential highlights: ${totalHighlights}`);

    // Search for ADRIAN text
    const bodyText = await page.textContent('body');
    const adrianMatches = bodyText.match(/ADRIAN/gi);
    console.log(`Found ${adrianMatches ? adrianMatches.length : 0} instances of "ADRIAN" in page text`);

    // Get all text nodes containing ADRIAN
    const adrianElements = await page.$$('text=ADRIAN');
    console.log(`Found ${adrianElements.length} elements containing "ADRIAN"`);

    // Take final screenshot
    await page.screenshot({ path: path.join(OUTPUT_DIR, '05-final-state.png'), fullPage: true });
    console.log('Screenshot 5: Final state');

    // Save HTML
    const html = await page.content();
    fs.writeFileSync(path.join(OUTPUT_DIR, 'page-content.html'), html);
    console.log('Saved HTML to page-content.html');

    // Get current URL
    const currentUrl = page.url();
    console.log('Current URL:', currentUrl);

  } catch (error) {
    console.error('Error during investigation:', error);
    await page.screenshot({ path: path.join(OUTPUT_DIR, 'error-state.png'), fullPage: true });
  } finally {
    await browser.close();
    console.log('Investigation complete!');
  }
})();
