import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

const OUTPUT_DIR = '/home/estro/second-watch-network/backend/test-output';
const PROJECT_ID = 'd837dec7-f17a-4f1c-b808-dc668ebec699';
const SCRIPT_ID = '559b11ad-8b7e-499e-9290-5ecc3d1ad240';

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
  const page = await context.newPage();

  try {
    // Navigate to the project workspace
    const projectUrl = `http://localhost:8080/backlot/projects/${PROJECT_ID}`;
    console.log(`Navigating to project workspace: ${projectUrl}`);

    await page.goto(projectUrl, { waitUntil: 'networkidle', timeout: 30000 });
    console.log('Project workspace loaded');

    await page.waitForTimeout(3000);
    await page.screenshot({ path: path.join(OUTPUT_DIR, '01-project-workspace.png'), fullPage: true });
    console.log('Screenshot 1: Project workspace');

    // Look for Script tab/button
    const scriptTabSelectors = [
      'button:has-text("Script")',
      'a:has-text("Script")',
      '[role="tab"]:has-text("Script")',
      'div:has-text("Script")',
      '[data-tab="script"]'
    ];

    console.log('\nLooking for Script tab...');
    let scriptTabFound = false;
    for (const selector of scriptTabSelectors) {
      const element = page.locator(selector).first();
      if (await element.isVisible({ timeout: 2000 }).catch(() => false)) {
        console.log(`Found script tab with selector: ${selector}`);
        await element.click();
        await page.waitForTimeout(3000);
        scriptTabFound = true;
        break;
      }
    }

    if (!scriptTabFound) {
      console.log('Script tab not found, trying to find any clickable element with "script" text');
      const anyScript = page.getByText(/script/i).first();
      if (await anyScript.isVisible({ timeout: 2000 }).catch(() => false)) {
        await anyScript.click();
        await page.waitForTimeout(3000);
        scriptTabFound = true;
      }
    }

    await page.screenshot({ path: path.join(OUTPUT_DIR, '02-after-script-tab-click.png'), fullPage: true });
    console.log('Screenshot 2: After clicking script tab');

    // Wait for script content to load
    await page.waitForTimeout(5000);

    // Get the full text content of the page
    const scriptContent = await page.evaluate(() => {
      return document.body.textContent || '';
    });

    console.log(`\nPage text content length: ${scriptContent.length} characters`);

    // Find all instances of ADRIAN
    const adrianMatches = [];
    let index = scriptContent.indexOf('ADRIAN');
    while (index !== -1) {
      const contextStart = Math.max(0, index - 50);
      const contextEnd = Math.min(scriptContent.length, index + 50);
      const context = scriptContent.substring(contextStart, contextEnd);
      adrianMatches.push({
        offset: index,
        context: context.replace(/\n/g, ' ').replace(/\s+/g, ' ')
      });
      index = scriptContent.indexOf('ADRIAN', index + 1);
    }

    console.log(`\nFound ${adrianMatches.length} instances of "ADRIAN" in page text:`);
    adrianMatches.forEach((match, i) => {
      console.log(`\n${i + 1}. Offset ${match.offset}: "${match.context}"`);
      if (match.offset === 2747) {
        console.log('   *** THIS IS THE HIGHLIGHTED ONE (offset 2747) ***');
      }
    });

    // Check what's at character offset 2747
    if (scriptContent.length > 2747) {
      const highlightedText = scriptContent.substring(2747, 2753);
      const contextStart = Math.max(0, 2747 - 100);
      const contextEnd = Math.min(scriptContent.length, 2753 + 100);
      const context = scriptContent.substring(contextStart, contextEnd);

      console.log(`\n\nText at offset 2747-2753: "${highlightedText}"`);
      console.log(`Context: "${context.replace(/\n/g, ' ').replace(/\s+/g, ' ')}"`);
    }

    // Look for any element containing ADRIAN with highlight styling
    console.log(`\n\nLooking for highlighted ADRIAN elements in the UI...`);

    // Try to find all elements that contain "ADRIAN"
    const adrianElements = await page.locator('text=ADRIAN').all();
    console.log(`Found ${adrianElements.length} elements containing "ADRIAN"`);

    for (let i = 0; i < adrianElements.length; i++) {
      const element = adrianElements[i];
      const text = await element.textContent();
      const bgColor = await element.evaluate(el => {
        // Check this element and all parents for background color
        let current = el;
        while (current && current !== document.body) {
          const style = window.getComputedStyle(current);
          const bg = style.backgroundColor;
          if (bg && bg !== 'rgba(0, 0, 0, 0)' && bg !== 'transparent') {
            return bg;
          }
          current = current.parentElement;
        }
        return 'none';
      });

      console.log(`\nADRIAN element ${i + 1}:`);
      console.log(`  Text: "${text.trim().substring(0, 100)}"`);
      console.log(`  Background color: ${bgColor}`);

      // Get position
      const box = await element.boundingBox();
      if (box) {
        console.log(`  Position: y=${box.y.toFixed(0)}`);

        // If this element has a background color (is highlighted), take a screenshot
        if (bgColor !== 'none') {
          await element.scrollIntoViewIfNeeded();
          await page.waitForTimeout(500);
          await page.screenshot({
            path: path.join(OUTPUT_DIR, `03-highlighted-adrian-${i+1}.png`),
            fullPage: false
          });
          console.log(`  Screenshot saved: 03-highlighted-adrian-${i+1}.png`);
        }
      }
    }

    // Take full page screenshot
    await page.screenshot({ path: path.join(OUTPUT_DIR, '04-script-full-page.png'), fullPage: true });
    console.log('\nScreenshot 4: Full page');

    // Save HTML
    const html = await page.content();
    fs.writeFileSync(path.join(OUTPUT_DIR, 'script-page.html'), html);
    console.log('Saved HTML to script-page.html');

    console.log('\nCurrent URL:', page.url());

  } catch (error) {
    console.error('Error during investigation:', error);
    await page.screenshot({ path: path.join(OUTPUT_DIR, 'error-state.png'), fullPage: true });
  } finally {
    await browser.close();
    console.log('\nInvestigation complete!');
  }
})();
