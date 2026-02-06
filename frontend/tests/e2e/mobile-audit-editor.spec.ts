/**
 * Mobile Audit: Script Editor Tab Screenshots
 *
 * Takes full-page screenshots of the Editor tab at multiple
 * mobile viewport sizes to audit responsive layout issues.
 * Also measures horizontal overflow for each viewport.
 */

import { test, expect } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Eidcom project
const PROJECT_ID = 'a0bcd9a7-9fca-485f-95bd-fc77dda71563';

const SCREENSHOT_DIR = path.join(__dirname, 'screenshots/mobile-audit');

// Use stored auth state directly so we can run without the setup project
test.use({
  storageState: path.join(__dirname, '../../playwright/.auth/user.json'),
});

// Increase timeout for navigation-heavy tests
test.setTimeout(120_000);

const VIEWPORTS = [
  { name: 'iPhone SE',      width: 375,  height: 667  },
  { name: 'iPhone 14 Pro',  width: 393,  height: 852  },
  { name: 'iPad Mini',      width: 768,  height: 1024 },
  { name: 'Desktop',        width: 1440, height: 900  },
];

test.describe('Mobile Audit - Editor Tab', () => {
  // Run serially to reduce load on the dev server
  test.describe.configure({ mode: 'serial' });

  for (const vp of VIEWPORTS) {
    test(`editor screenshot at ${vp.width}x${vp.height} (${vp.name})`, async ({ page }) => {
      // Ensure screenshot directory exists
      fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });

      // Start at desktop size for navigation, then resize
      await page.setViewportSize({ width: 1440, height: 900 });

      // Navigate to the backlot project workspace with script view
      await page.goto(`/backlot/projects/${PROJECT_ID}?view=script`, { waitUntil: 'domcontentloaded' });

      // Wait for the script view to fully load
      console.log(`[${vp.name}] Waiting for script view to load...`);

      // First wait for network to settle
      await page.waitForLoadState('networkidle').catch(() => {
        console.log(`[${vp.name}] networkidle timed out, continuing...`);
      });

      // Wait for script-related UI elements to appear
      await Promise.race([
        page.locator('text=Script & Breakdown').first().waitFor({ timeout: 20000 }),
        page.locator('[role="tablist"]').first().waitFor({ timeout: 20000 }),
        page.locator('canvas').first().waitFor({ timeout: 20000 }),
        page.locator('embed[type="application/pdf"]').first().waitFor({ timeout: 20000 }),
        page.locator('.react-pdf__Page').first().waitFor({ timeout: 20000 }),
      ]).catch(() => {
        console.log(`[${vp.name}] No specific script element found, continuing...`);
      });

      // Give an extra moment for rendering to complete
      await page.waitForTimeout(3000);

      console.log(`[${vp.name}] Script view loaded, clicking Editor tab...`);

      // Click the "Editor" tab to switch to the editor view
      // Try multiple selectors for the Editor tab
      const editorTabClicked = await Promise.race([
        page.locator('button:has-text("Editor")').first().click().then(() => true),
        page.locator('[role="tab"]:has-text("Editor")').first().click().then(() => true),
        page.locator('text=Editor').first().click().then(() => true),
      ]).catch(() => {
        console.log(`[${vp.name}] Could not find Editor tab with text, trying other approaches...`);
        return false;
      });

      if (!editorTabClicked) {
        // Log available tabs for debugging
        const tabs = await page.locator('[role="tab"]').allTextContents();
        console.log(`[${vp.name}] Available tabs: ${JSON.stringify(tabs)}`);

        const buttons = await page.locator('button').allTextContents();
        const editorButtons = buttons.filter(t => t.toLowerCase().includes('editor'));
        console.log(`[${vp.name}] Buttons containing "editor": ${JSON.stringify(editorButtons)}`);

        // Try clicking any tab-like element with "editor" text
        await page.locator('*:has-text("Editor")').last().click().catch(() => {
          console.log(`[${vp.name}] Failed to click any Editor element`);
        });
      }

      // Wait for editor content to load
      console.log(`[${vp.name}] Waiting for editor content to load...`);
      await page.waitForTimeout(3000);

      // Wait for editor-specific elements
      await Promise.race([
        page.locator('[contenteditable]').first().waitFor({ timeout: 15000 }),
        page.locator('.ProseMirror').first().waitFor({ timeout: 15000 }),
        page.locator('.tiptap').first().waitFor({ timeout: 15000 }),
        page.locator('[class*="editor"]').first().waitFor({ timeout: 15000 }),
        page.locator('[class*="Editor"]').first().waitFor({ timeout: 15000 }),
        page.locator('textarea').first().waitFor({ timeout: 15000 }),
      ]).catch(() => {
        console.log(`[${vp.name}] No specific editor element found, continuing with screenshot...`);
      });

      // Extra wait for editor rendering
      await page.waitForTimeout(2000);

      console.log(`[${vp.name}] Editor loaded, resizing to ${vp.width}x${vp.height}...`);

      // Now resize to the target viewport
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.waitForTimeout(2000);

      // Measure overflow
      const overflowData = await page.evaluate(() => {
        const docScrollWidth = document.documentElement.scrollWidth;
        const docClientWidth = document.documentElement.clientWidth;
        const bodyScrollWidth = document.body.scrollWidth;

        const overflowingElements: { tag: string; id: string; classes: string; scrollWidth: number; clientWidth: number }[] = [];
        const allElements = document.querySelectorAll('*');
        allElements.forEach(el => {
          if (el.scrollWidth > el.clientWidth + 2) {
            overflowingElements.push({
              tag: el.tagName.toLowerCase(),
              id: el.id || '',
              classes: el.className?.toString().slice(0, 100) || '',
              scrollWidth: el.scrollWidth,
              clientWidth: el.clientWidth,
            });
          }
        });

        return {
          docScrollWidth,
          docClientWidth,
          bodyScrollWidth,
          hasHorizontalOverflow: docScrollWidth > docClientWidth,
          overflowingElements: overflowingElements.slice(0, 20),
        };
      });

      console.log(`\n=== ${vp.name} (${vp.width}x${vp.height}) - Editor Tab ===`);
      console.log(`  Document scrollWidth: ${overflowData.docScrollWidth}, clientWidth: ${overflowData.docClientWidth}`);
      console.log(`  Body scrollWidth: ${overflowData.bodyScrollWidth}`);
      console.log(`  Horizontal overflow: ${overflowData.hasHorizontalOverflow ? 'YES' : 'No'}`);

      if (overflowData.overflowingElements.length > 0) {
        console.log(`  Elements with scrollWidth > clientWidth (${overflowData.overflowingElements.length}):`);
        for (const el of overflowData.overflowingElements) {
          const ident = el.id ? `#${el.id}` : el.classes ? `.${el.classes.split(' ')[0]}` : '';
          console.log(`    <${el.tag}${ident}> scrollWidth=${el.scrollWidth} clientWidth=${el.clientWidth} (+${el.scrollWidth - el.clientWidth}px)`);
        }
      } else {
        console.log('  No elements with horizontal overflow.');
      }

      // Take full-page screenshot
      const screenshotPath = path.join(SCREENSHOT_DIR, `editor-${vp.width}x${vp.height}.png`);
      await page.screenshot({
        path: screenshotPath,
        fullPage: true,
      });

      console.log(`  Screenshot saved: ${screenshotPath}`);
    });
  }
});
