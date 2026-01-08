/**
 * Visual Inspection Test for Create Asset Modal
 *
 * This test creates a standalone HTML page to visually demonstrate
 * the modal containment issue without requiring authentication.
 */

import { test } from '@playwright/test';
import * as path from 'path';
import * as fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const SCREENSHOTS_DIR = path.join(__dirname, '../screenshots/gear-modal-visual');

function ensureScreenshotsDir() {
  if (!fs.existsSync(SCREENSHOTS_DIR)) {
    fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });
  }
}

// Create a standalone HTML page that reproduces the modal structure
const createTestHTML = () => `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Create Asset Modal - Containment Test</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <style>
    body {
      background: #1a1a1a;
      color: #f9f5ef;
      font-family: system-ui, -apple-system, sans-serif;
    }

    /* Dialog overlay */
    .dialog-overlay {
      position: fixed;
      inset: 0;
      z-index: 50;
      background-color: rgba(18, 18, 18, 0.8);
    }

    /* Dialog content - CURRENT IMPLEMENTATION */
    .dialog-content {
      position: fixed;
      left: 50%;
      top: 50%;
      z-index: 50;
      width: 100%;
      max-width: 36rem; /* sm:max-w-xl */
      max-height: 90vh;
      transform: translate(-50%, -50%);
      border: 2px solid #4c4c4c;
      background-color: #121212;
      padding: 1.5rem;
      overflow-y: auto; /* This is the issue */
    }

    /* Dialog content - FIXED IMPLEMENTATION */
    .dialog-content-fixed {
      position: fixed;
      left: 50%;
      top: 50%;
      z-index: 50;
      width: 100%;
      max-width: 36rem;
      max-height: 90vh;
      transform: translate(-50%, -50%);
      border: 2px solid #4c4c4c;
      background-color: #121212;
      padding: 1.5rem;
      display: flex;
      flex-direction: column;
    }

    .scroll-area {
      flex: 1;
      overflow-y: auto;
      padding-right: 1rem;
    }

    .inline-form {
      display: none;
      padding: 0.75rem;
      background: rgba(18, 18, 18, 0.3);
      border-radius: 0.5rem;
      margin-top: 0.5rem;
    }

    .inline-form.show {
      display: block;
    }

    input, textarea, select {
      width: 100%;
      background: rgba(76, 76, 76, 0.2);
      border: 1px solid #4c4c4c;
      color: #f9f5ef;
      padding: 0.5rem;
      border-radius: 0.375rem;
    }

    button {
      padding: 0.5rem 1rem;
      border-radius: 0.375rem;
      cursor: pointer;
      border: none;
    }

    .btn-primary {
      background: #FF3C3C;
      color: white;
    }

    .btn-secondary {
      background: transparent;
      border: 1px solid #4c4c4c;
      color: #f9f5ef;
    }

    .btn-ghost {
      background: transparent;
      color: #FCDC58;
      font-size: 0.75rem;
      padding: 0.25rem 0.5rem;
    }

    label {
      display: block;
      margin-bottom: 0.25rem;
      font-size: 0.875rem;
      color: #f9f5ef;
    }

    .field {
      margin-bottom: 1rem;
    }

    .grid-2 {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 1rem;
    }

    .grid-3 {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 1rem;
    }

    .section-divider {
      border-top: 1px solid rgba(76, 76, 76, 0.3);
      padding-top: 1rem;
      margin-top: 1rem;
    }

    .dialog-header {
      margin-bottom: 1rem;
    }

    .dialog-footer {
      display: flex;
      justify-content: flex-end;
      gap: 0.5rem;
      margin-top: 1rem;
    }

    h2 {
      font-size: 1.125rem;
      font-weight: 600;
      margin-bottom: 0.5rem;
    }

    .description {
      font-size: 0.875rem;
      color: #a0a0a0;
    }

    .location-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 0.5rem;
    }
  </style>
</head>
<body>
  <div style="padding: 2rem; text-align: center;">
    <h1 style="font-size: 2rem; margin-bottom: 1rem;">Create Asset Modal - Containment Test</h1>
    <p style="margin-bottom: 2rem; color: #a0a0a0;">
      Click the buttons below to see the difference between the current implementation and the fixed version.
    </p>
    <div style="display: flex; gap: 1rem; justify-content: center;">
      <button class="btn-primary" onclick="showBrokenModal()">Show BROKEN Modal (Current)</button>
      <button class="btn-primary" onclick="showFixedModal()">Show FIXED Modal</button>
    </div>
  </div>

  <!-- BROKEN MODAL -->
  <div id="broken-modal" style="display: none;">
    <div class="dialog-overlay"></div>
    <div class="dialog-content">
      <div class="dialog-header">
        <h2>Add New Asset</h2>
        <p class="description">Add a new piece of equipment to your inventory</p>
      </div>

      <form>
        <div class="field">
          <label>Asset Name *</label>
          <input type="text" placeholder="e.g., Canon C300 Mark III" />
        </div>

        <div class="grid-2">
          <div class="field">
            <label>Category</label>
            <select><option>Select category</option></select>
          </div>
          <div class="field">
            <label>Asset Type</label>
            <select><option>Serialized</option></select>
          </div>
        </div>

        <div class="grid-2">
          <div class="field">
            <label>Manufacturer</label>
            <input type="text" placeholder="e.g., Canon" />
          </div>
          <div class="field">
            <label>Model</label>
            <input type="text" placeholder="e.g., C300 Mark III" />
          </div>
        </div>

        <div class="field">
          <label>Manufacturer Serial Number</label>
          <input type="text" placeholder="From equipment label" />
          <p style="font-size: 0.75rem; color: #a0a0a0; margin-top: 0.25rem;">Internal ID will be auto-generated</p>
        </div>

        <div class="field">
          <div class="location-header">
            <label style="margin: 0;">Home Location</label>
            <button type="button" class="btn-ghost" onclick="toggleInlineForm('broken')">+ Add</button>
          </div>
          <select><option>Select location</option></select>
          <div id="broken-inline-form" class="inline-form">
            <input type="text" placeholder="Location name" style="margin-bottom: 0.5rem;" />
            <div style="display: flex; gap: 0.5rem;">
              <button type="button" class="btn-primary" style="font-size: 0.875rem;">Add</button>
              <button type="button" class="btn-secondary" style="font-size: 0.875rem;" onclick="toggleInlineForm('broken')">Cancel</button>
            </div>
          </div>
        </div>

        <div class="section-divider">
          <p style="font-size: 0.875rem; color: #a0a0a0; margin-bottom: 1rem;">Pricing & Value</p>
          <div class="grid-2">
            <div class="field">
              <label>Purchase Price</label>
              <input type="number" placeholder="0.00" />
            </div>
            <div class="field">
              <label>Replacement Cost</label>
              <input type="number" placeholder="0.00" />
            </div>
          </div>
        </div>

        <div class="section-divider">
          <p style="font-size: 0.875rem; color: #a0a0a0; margin-bottom: 1rem;">Rental Rates</p>
          <div class="grid-3">
            <div class="field">
              <label>Daily Rate</label>
              <input type="number" placeholder="0.00" />
            </div>
            <div class="field">
              <label>Weekly Rate</label>
              <input type="number" placeholder="0.00" />
            </div>
            <div class="field">
              <label>Monthly Rate</label>
              <input type="number" placeholder="0.00" />
            </div>
          </div>
        </div>

        <div class="field">
          <label>Description</label>
          <textarea rows="2" placeholder="Additional details about this asset"></textarea>
        </div>
      </form>

      <div class="dialog-footer">
        <button type="button" class="btn-secondary" onclick="hideBrokenModal()">Cancel</button>
        <button type="button" class="btn-primary">Add Asset</button>
      </div>
    </div>
  </div>

  <!-- FIXED MODAL -->
  <div id="fixed-modal" style="display: none;">
    <div class="dialog-overlay"></div>
    <div class="dialog-content-fixed">
      <div class="dialog-header">
        <h2>Add New Asset (FIXED)</h2>
        <p class="description">Notice how the content scrolls properly without overflow</p>
      </div>

      <div class="scroll-area">
        <form>
          <div class="field">
            <label>Asset Name *</label>
            <input type="text" placeholder="e.g., Canon C300 Mark III" />
          </div>

          <div class="grid-2">
            <div class="field">
              <label>Category</label>
              <select><option>Select category</option></select>
            </div>
            <div class="field">
              <label>Asset Type</label>
              <select><option>Serialized</option></select>
            </div>
          </div>

          <div class="grid-2">
            <div class="field">
              <label>Manufacturer</label>
              <input type="text" placeholder="e.g., Canon" />
            </div>
            <div class="field">
              <label>Model</label>
              <input type="text" placeholder="e.g., C300 Mark III" />
            </div>
          </div>

          <div class="field">
            <label>Manufacturer Serial Number</label>
            <input type="text" placeholder="From equipment label" />
            <p style="font-size: 0.75rem; color: #a0a0a0; margin-top: 0.25rem;">Internal ID will be auto-generated</p>
          </div>

          <div class="field">
            <div class="location-header">
              <label style="margin: 0;">Home Location</label>
              <button type="button" class="btn-ghost" onclick="toggleInlineForm('fixed')">+ Add</button>
            </div>
            <select><option>Select location</option></select>
            <div id="fixed-inline-form" class="inline-form">
              <input type="text" placeholder="Location name" style="margin-bottom: 0.5rem;" />
              <div style="display: flex; gap: 0.5rem;">
                <button type="button" class="btn-primary" style="font-size: 0.875rem;">Add</button>
                <button type="button" class="btn-secondary" style="font-size: 0.875rem;" onclick="toggleInlineForm('fixed')">Cancel</button>
              </div>
            </div>
          </div>

          <div class="section-divider">
            <p style="font-size: 0.875rem; color: #a0a0a0; margin-bottom: 1rem;">Pricing & Value</p>
            <div class="grid-2">
              <div class="field">
                <label>Purchase Price</label>
                <input type="number" placeholder="0.00" />
              </div>
              <div class="field">
                <label>Replacement Cost</label>
                <input type="number" placeholder="0.00" />
              </div>
            </div>
          </div>

          <div class="section-divider">
            <p style="font-size: 0.875rem; color: #a0a0a0; margin-bottom: 1rem;">Rental Rates</p>
            <div class="grid-3">
              <div class="field">
                <label>Daily Rate</label>
                <input type="number" placeholder="0.00" />
              </div>
              <div class="field">
                <label>Weekly Rate</label>
                <input type="number" placeholder="0.00" />
              </div>
              <div class="field">
                <label>Monthly Rate</label>
                <input type="number" placeholder="0.00" />
              </div>
            </div>
          </div>

          <div class="field">
            <label>Description</label>
            <textarea rows="2" placeholder="Additional details about this asset"></textarea>
          </div>
        </form>
      </div>

      <div class="dialog-footer">
        <button type="button" class="btn-secondary" onclick="hideFixedModal()">Cancel</button>
        <button type="button" class="btn-primary">Add Asset</button>
      </div>
    </div>
  </div>

  <script>
    function showBrokenModal() {
      document.getElementById('broken-modal').style.display = 'block';
    }

    function hideBrokenModal() {
      document.getElementById('broken-modal').style.display = 'none';
      document.getElementById('broken-inline-form').classList.remove('show');
    }

    function showFixedModal() {
      document.getElementById('fixed-modal').style.display = 'block';
    }

    function hideFixedModal() {
      document.getElementById('fixed-modal').style.display = 'none';
      document.getElementById('fixed-inline-form').classList.remove('show');
    }

    function toggleInlineForm(type) {
      const form = document.getElementById(type + '-inline-form');
      form.classList.toggle('show');
    }

    // Close on overlay click
    document.addEventListener('click', (e) => {
      if (e.target.classList.contains('dialog-overlay')) {
        hideBrokenModal();
        hideFixedModal();
      }
    });
  </script>
</body>
</html>
`;

test.describe('Create Asset Modal - Visual Comparison', () => {
  test.beforeEach(() => {
    ensureScreenshotsDir();
  });

  test('should demonstrate modal containment issue and fix', async ({ page }) => {
    // Create and serve the test HTML
    const html = createTestHTML();
    await page.setContent(html);
    await page.setViewportSize({ width: 1280, height: 800 });

    console.log('\n========================================');
    console.log('VISUAL COMPARISON TEST');
    console.log('========================================\n');

    // Initial page
    await page.screenshot({
      path: path.join(SCREENSHOTS_DIR, '01-landing-page.png'),
      fullPage: false,
    });
    console.log('Screenshot: 01-landing-page.png');

    // Test BROKEN modal
    console.log('\nTesting BROKEN modal (current implementation)...');
    await page.click('button:has-text("Show BROKEN Modal")');
    await page.waitForTimeout(500);

    await page.screenshot({
      path: path.join(SCREENSHOTS_DIR, '02-broken-modal-initial.png'),
      fullPage: false,
    });
    console.log('Screenshot: 02-broken-modal-initial.png');

    // Expand inline form
    await page.click('#broken-modal button:has-text("+ Add")');
    await page.waitForTimeout(300);

    await page.screenshot({
      path: path.join(SCREENSHOTS_DIR, '03-broken-modal-expanded.png'),
      fullPage: false,
    });
    console.log('Screenshot: 03-broken-modal-expanded.png');

    // Measure broken modal
    const brokenModal = page.locator('#broken-modal .dialog-content');
    const brokenBox = await brokenModal.boundingBox();
    console.log('\nBroken Modal Dimensions:');
    console.log(`  Width: ${brokenBox?.width}px`);
    console.log(`  Height: ${brokenBox?.height}px`);
    console.log(`  Bottom: ${brokenBox ? brokenBox.y + brokenBox.height : 0}px`);
    console.log(`  Viewport height: 800px`);

    const brokenOverflow = brokenBox ? (brokenBox.y + brokenBox.height) - 800 : 0;
    if (brokenOverflow > 0) {
      console.log(`  OVERFLOW: ${brokenOverflow}px extends beyond viewport!`);
    }

    // Close broken modal
    await page.click('.dialog-overlay');
    await page.waitForTimeout(300);

    // Test FIXED modal
    console.log('\nTesting FIXED modal (with ScrollArea)...');
    await page.click('button:has-text("Show FIXED Modal")');
    await page.waitForTimeout(500);

    await page.screenshot({
      path: path.join(SCREENSHOTS_DIR, '04-fixed-modal-initial.png'),
      fullPage: false,
    });
    console.log('Screenshot: 04-fixed-modal-initial.png');

    // Expand inline form
    await page.click('#fixed-modal button:has-text("+ Add")');
    await page.waitForTimeout(300);

    await page.screenshot({
      path: path.join(SCREENSHOTS_DIR, '05-fixed-modal-expanded.png'),
      fullPage: false,
    });
    console.log('Screenshot: 05-fixed-modal-expanded.png');

    // Measure fixed modal
    const fixedModal = page.locator('#fixed-modal .dialog-content-fixed');
    const fixedBox = await fixedModal.boundingBox();
    console.log('\nFixed Modal Dimensions:');
    console.log(`  Width: ${fixedBox?.width}px`);
    console.log(`  Height: ${fixedBox?.height}px`);
    console.log(`  Bottom: ${fixedBox ? fixedBox.y + fixedBox.height : 0}px`);
    console.log(`  Viewport height: 800px`);

    const fixedOverflow = fixedBox ? (fixedBox.y + fixedBox.height) - 800 : 0;
    if (fixedOverflow > 0) {
      console.log(`  OVERFLOW: ${fixedOverflow}px extends beyond viewport!`);
    } else {
      console.log(`  ✓ No overflow - properly contained!`);
    }

    // Scroll test in fixed modal
    await page.evaluate(() => {
      const scrollArea = document.querySelector('#fixed-modal .scroll-area');
      if (scrollArea) {
        scrollArea.scrollTop = scrollArea.scrollHeight;
      }
    });
    await page.waitForTimeout(300);

    await page.screenshot({
      path: path.join(SCREENSHOTS_DIR, '06-fixed-modal-scrolled.png'),
      fullPage: false,
    });
    console.log('Screenshot: 06-fixed-modal-scrolled.png');

    console.log('\n========================================');
    console.log('COMPARISON COMPLETE');
    console.log('========================================');
    console.log(`\nScreenshots saved to: ${SCREENSHOTS_DIR}\n`);
  });
});
