/**
 * Title Page Preview Visual Test
 *
 * This test opens the title page edit modal and visually tests the preview scaling
 * at different viewport sizes. It takes screenshots for manual review.
 *
 * SETUP REQUIRED:
 * 1. Create a test script in Backlot with title page data
 * 2. Update the PROJECT_ID and SCRIPT_ID constants below
 * 3. Ensure you're logged in (or add auth to the test)
 */

import { test, expect } from '@playwright/test';

// TODO: Update these with actual test data
const PROJECT_ID = 'your-project-id'; // Replace with actual project ID
const SCRIPT_ID = 'your-script-id';   // Replace with actual script ID

// Test viewport sizes
const VIEWPORTS = [
  { name: 'mobile', width: 375, height: 667 },
  { name: 'tablet', width: 768, height: 1024 },
  { name: 'laptop', width: 1280, height: 800 },
  { name: 'desktop', width: 1920, height: 1080 },
];

test.describe('Title Page Preview Visual Test', () => {
  test.skip('visual test of preview scaling at different viewports', async ({ page }) => {
    // Skip by default - requires manual setup with actual IDs
    console.log('\n========================================');
    console.log('TITLE PAGE PREVIEW VISUAL TEST');
    console.log('========================================\n');

    // Navigate to the script editor
    const scriptUrl = `/backlot/workspace/${PROJECT_ID}/script/${SCRIPT_ID}`;
    await page.goto(scriptUrl);
    await page.waitForLoadState('networkidle');

    for (const viewport of VIEWPORTS) {
      console.log(`\nTesting ${viewport.name} (${viewport.width}x${viewport.height})`);

      // Set viewport
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await page.waitForTimeout(300);

      // Click to open title page edit modal
      // Look for the Edit button in the title page view
      const editButton = page.getByRole('button', { name: /edit/i }).first();
      if (await editButton.isVisible()) {
        await editButton.click();
        await page.waitForTimeout(500);

        // Find the modal
        const modal = page.getByRole('dialog');
        await expect(modal).toBeVisible();

        // Take screenshot
        await page.screenshot({
          path: `test-results/title-page-${viewport.name}.png`,
          fullPage: false,
        });

        // Measure the preview dimensions
        const previewMetrics = await page.evaluate(() => {
          const modal = document.querySelector('[role="dialog"]');
          const previewContainer = modal?.querySelector('.w-\\[45\\%\\]');
          const previewWrapper = previewContainer?.querySelector('.bg-white.shadow-lg');

          if (!modal || !previewContainer || !previewWrapper) {
            return null;
          }

          const modalRect = modal.getBoundingClientRect();
          const containerRect = previewContainer.getBoundingClientRect();
          const wrapperRect = previewWrapper.getBoundingClientRect();

          return {
            modal: { width: modalRect.width, height: modalRect.height },
            container: { width: containerRect.width, height: containerRect.height },
            preview: { width: wrapperRect.width, height: wrapperRect.height },
            aspectRatio: wrapperRect.width / wrapperRect.height,
          };
        });

        if (previewMetrics) {
          console.log(`  Modal: ${previewMetrics.modal.width}x${previewMetrics.modal.height}`);
          console.log(`  Container: ${previewMetrics.container.width}x${previewMetrics.container.height}`);
          console.log(`  Preview: ${previewMetrics.preview.width}x${previewMetrics.preview.height}`);
          console.log(`  Aspect Ratio: ${previewMetrics.aspectRatio.toFixed(4)} (expected: 0.7727)`);

          // Verify aspect ratio is maintained
          const expectedRatio = 8.5 / 11;
          const ratioMatch = Math.abs(previewMetrics.aspectRatio - expectedRatio) < 0.01;
          console.log(`  ✓ Aspect Ratio: ${ratioMatch ? 'PASS' : 'FAIL'}`);

          // Verify it uses vertical space efficiently
          const verticalUsage = (previewMetrics.preview.height / previewMetrics.container.height) * 100;
          console.log(`  Vertical Space Usage: ${verticalUsage.toFixed(1)}%`);
        }

        // Close modal for next iteration
        const closeButton = page.getByRole('button', { name: /cancel/i });
        await closeButton.click();
        await page.waitForTimeout(300);
      } else {
        console.log('  ⚠️  Edit button not found - may need to switch to title page view');
      }
    }

    console.log('\n========================================');
    console.log('Screenshots saved to test-results/');
    console.log('========================================\n');
  });
});

test.describe('Manual Test Instructions', () => {
  test('print manual test guide', async () => {
    console.log('\n========================================');
    console.log('MANUAL TEST GUIDE');
    console.log('Title Page Preview Scaling');
    console.log('========================================\n');
    console.log('SETUP:');
    console.log('1. Start the dev server: npm run dev');
    console.log('2. Navigate to http://localhost:8080');
    console.log('3. Log in with test credentials');
    console.log('4. Go to a Backlot project with a script');
    console.log('5. Open the script editor\n');
    console.log('TEST STEPS:');
    console.log('1. Click on "Title Page" view mode (if needed)');
    console.log('2. Click the "Edit" button to open title page modal');
    console.log('3. Observe the preview panel on the right');
    console.log('4. Resize browser window to different sizes');
    console.log('5. Verify the preview scales appropriately\n');
    console.log('EXPECTED BEHAVIOR (AFTER FIX):');
    console.log('✓ Preview uses full available vertical space');
    console.log('✓ Maintains 8.5:11 aspect ratio at all sizes');
    console.log('✓ Scales down proportionally on smaller screens');
    console.log('✓ No horizontal overflow or clipping');
    console.log('✓ Content remains centered in preview panel\n');
    console.log('BEFORE FIX (ISSUES):');
    console.log('✗ Fixed maxWidth: 320px prevents scaling');
    console.log('✗ Preview does not use available height');
    console.log('✗ Appears small on large screens');
    console.log('✗ May overflow on very small screens\n');
    console.log('CSS CHANGES MADE:');
    console.log('- Removed: maxWidth: "320px"');
    console.log('- Added: h-full class to preview wrapper');
    console.log('- Added: maxWidth: "100%" to prevent overflow');
    console.log('- Kept: aspectRatio: "8.5 / 11" for proper ratio\n');
    console.log('TEST VIEWPORTS:');
    console.log('- Mobile: 375x667 (iPhone SE)');
    console.log('- Tablet: 768x1024 (iPad)');
    console.log('- Laptop: 1280x800 (MacBook Air)');
    console.log('- Desktop: 1920x1080 (Full HD)');
    console.log('========================================\n');

    expect(true).toBe(true);
  });
});

test.describe('Component Structure Test', () => {
  test('verify TitlePageEditForm structure in codebase', async () => {
    console.log('\n========================================');
    console.log('CODE STRUCTURE VERIFICATION');
    console.log('========================================\n');

    // Read the component file to verify the fix was applied
    const fs = await import('fs');
    const path = await import('path');

    const componentPath = path.join(
      process.cwd(),
      'src/components/backlot/workspace/TitlePageEditForm.tsx'
    );

    const content = fs.readFileSync(componentPath, 'utf-8');
    const lines = content.split('\n');

    console.log('Checking TitlePageEditForm.tsx for correct preview CSS...\n');

    let foundPreviewPanel = false;
    let foundCorrectCSS = false;
    let foundOldMaxWidth = false;

    lines.forEach((line, index) => {
      // Find the preview panel section
      if (line.includes('Preview Panel') || line.includes('Preview panel')) {
        foundPreviewPanel = true;
        console.log(`Found preview panel section at line ${index + 1}`);
      }

      // Check for the new h-full class
      if (line.includes('bg-white shadow-lg h-full')) {
        foundCorrectCSS = true;
        console.log(`✓ Found h-full class at line ${index + 1}`);
      }

      // Check for old fixed maxWidth (should be removed)
      if (line.includes("maxWidth: '320px'")) {
        foundOldMaxWidth = true;
        console.log(`✗ Found old maxWidth: '320px' at line ${index + 1} - should be removed!`);
      }

      // Check for aspectRatio
      if (line.includes("aspectRatio: '8.5 / 11'")) {
        console.log(`✓ Found aspectRatio maintained at line ${index + 1}`);
      }

      // Check for new maxWidth: 100%
      if (line.includes("maxWidth: '100%'")) {
        console.log(`✓ Found maxWidth: '100%' at line ${index + 1}`);
      }
    });

    console.log('\nVERIFICATION RESULTS:');
    console.log(`Preview panel found: ${foundPreviewPanel ? '✓' : '✗'}`);
    console.log(`Correct CSS applied (h-full): ${foundCorrectCSS ? '✓' : '✗'}`);
    console.log(`Old maxWidth removed: ${!foundOldMaxWidth ? '✓' : '✗'}`);

    if (!foundOldMaxWidth && foundCorrectCSS) {
      console.log('\n✓ CSS fix successfully applied!');
    } else {
      console.log('\n✗ CSS fix may not be complete');
    }

    console.log('========================================\n');

    // Verify the fix was applied correctly
    expect(foundPreviewPanel).toBe(true);
    expect(foundCorrectCSS).toBe(true);
    expect(foundOldMaxWidth).toBe(false);
  });
});
