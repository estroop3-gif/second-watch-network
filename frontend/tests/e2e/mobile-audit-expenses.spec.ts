import { test, expect } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PROJECT_ID = 'a0bcd9a7-9fca-485f-95bd-fc77dda71563';
const SCREENSHOT_DIR = path.join(__dirname, 'screenshots/mobile-audit');

test.use({
  storageState: path.join(__dirname, '../../playwright/.auth/user.json'),
});

test.setTimeout(120_000);

const VIEWPORTS = [
  { name: 'iPhone SE',      width: 375,  height: 667  },
  { name: 'iPhone 14 Pro',  width: 393,  height: 852  },
  { name: 'iPad Mini',      width: 768,  height: 1024 },
  { name: 'Desktop',        width: 1440, height: 900  },
];

test.describe('Mobile Audit - Expenses Tab', () => {
  test.describe.configure({ mode: 'serial' });

  for (const vp of VIEWPORTS) {
    test(`screenshot at ${vp.width}x${vp.height} (${vp.name})`, async ({ page }) => {
      fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
      await page.setViewportSize({ width: 1440, height: 900 });

      await page.goto(`/backlot/projects/${PROJECT_ID}?view=expenses`, { waitUntil: 'domcontentloaded' });
      await page.waitForLoadState('networkidle').catch(() => {});

      await Promise.race([
        page.locator('text=Expenses').first().waitFor({ timeout: 15000 }),
        page.locator('text=Receipts').first().waitFor({ timeout: 15000 }),
        page.locator('text=Mileage').first().waitFor({ timeout: 15000 }),
        page.locator('text=Per Diem').first().waitFor({ timeout: 15000 }),
      ]).catch(() => {
        console.log(`[${vp.name}] No expenses content found via URL, trying sidebar...`);
      });

      const hasContent = await page.locator('text=Expenses').first().isVisible().catch(() => false);
      if (!hasContent) {
        for (const sel of ['text=Expenses', 'a:has-text("Expenses")', 'button:has-text("Expenses")']) {
          const loc = page.locator(sel).first();
          if (await loc.isVisible().catch(() => false)) {
            await loc.click();
            await page.waitForTimeout(3000);
            break;
          }
        }
      }

      await page.waitForTimeout(3000);
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.waitForTimeout(2000);

      const overflowData = await page.evaluate(() => {
        const docScrollWidth = document.documentElement.scrollWidth;
        const docClientWidth = document.documentElement.clientWidth;
        const bodyScrollWidth = document.body.scrollWidth;
        const overflowingElements: { tag: string; id: string; classes: string; scrollWidth: number; clientWidth: number }[] = [];
        document.querySelectorAll('*').forEach(el => {
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
          docScrollWidth, docClientWidth, bodyScrollWidth,
          hasHorizontalOverflow: docScrollWidth > docClientWidth,
          overflowingElements: overflowingElements.slice(0, 20),
        };
      });

      console.log(`\n=== ${vp.name} (${vp.width}x${vp.height}) ===`);
      console.log(`  Document scrollWidth: ${overflowData.docScrollWidth}, clientWidth: ${overflowData.docClientWidth}`);
      console.log(`  Horizontal overflow: ${overflowData.hasHorizontalOverflow ? 'YES' : 'No'}`);
      if (overflowData.overflowingElements.length > 0) {
        console.log(`  Overflowing elements (${overflowData.overflowingElements.length}):`);
        for (const el of overflowData.overflowingElements) {
          const ident = el.id ? `#${el.id}` : el.classes ? `.${el.classes.split(' ')[0]}` : '';
          console.log(`    <${el.tag}${ident}> scrollW=${el.scrollWidth} clientW=${el.clientWidth} (+${el.scrollWidth - el.clientWidth}px)`);
        }
      }

      const screenshotPath = path.join(SCREENSHOT_DIR, `expenses-${vp.width}x${vp.height}.png`);
      await page.screenshot({ path: screenshotPath, fullPage: true });
      console.log(`  Screenshot: ${screenshotPath}`);
    });
  }
});
