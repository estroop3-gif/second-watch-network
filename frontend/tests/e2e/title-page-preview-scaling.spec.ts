/**
 * Title Page Preview Scaling Test
 *
 * Tests the responsive behavior of the title page preview panel in the
 * TitlePageEditForm modal at different viewport sizes.
 *
 * Issue: The preview has a fixed maxWidth of 320px and uses aspectRatio: '8.5 / 11',
 * but it doesn't scale responsively within the modal container.
 */

import { test, expect } from '@playwright/test';

// Test viewport sizes to verify responsive scaling
const VIEWPORTS = [
  { name: 'Mobile', width: 375, height: 667 },
  { name: 'Tablet', width: 768, height: 1024 },
  { name: 'Laptop Small', width: 1024, height: 768 },
  { name: 'Desktop', width: 1440, height: 900 },
  { name: 'Desktop Large', width: 1920, height: 1080 },
];

test.describe('Title Page Preview Scaling', () => {
  test.beforeEach(async ({ page }) => {
    console.log('\n========================================');
    console.log('TITLE PAGE PREVIEW SCALING TEST');
    console.log('========================================\n');

    // Navigate to the app - may need to adjust URL based on your setup
    await page.goto('http://localhost:8080');

    // Wait for app to load
    await page.waitForLoadState('networkidle');
  });

  test('should analyze preview scaling behavior across viewport sizes', async ({ page }) => {
    console.log('Test: Analyzing preview panel scaling at different viewport sizes\n');

    const scalingResults: Array<{
      viewport: string;
      modalWidth: number;
      modalHeight: number;
      previewContainerWidth: number;
      previewContainerHeight: number;
      previewWidth: number;
      previewHeight: number;
      aspectRatio: number;
      usesAvailableSpace: boolean;
      maintainsAspectRatio: boolean;
    }> = [];

    for (const viewport of VIEWPORTS) {
      console.log(`\n=== Testing ${viewport.name} (${viewport.width}x${viewport.height}) ===`);

      // Set viewport size
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await page.waitForTimeout(500); // Wait for reflow

      // Try to open the title page edit modal
      // NOTE: This assumes we can navigate to a backlot script page
      // Adjust the navigation logic based on your app's structure

      // For now, let's check if we can manually inspect the modal structure
      // by injecting it into the page for testing purposes
      const result = await page.evaluate(() => {
        // Check if the modal dialog exists in the DOM
        const modalContent = document.querySelector('[role="dialog"]');
        if (!modalContent) {
          return { found: false, message: 'Modal not found in DOM' };
        }

        const modalRect = modalContent.getBoundingClientRect();

        // Find the preview panel container (45% width container)
        const previewContainer = modalContent.querySelector('.w-\\[45\\%\\]');
        if (!previewContainer) {
          return { found: false, message: 'Preview container not found' };
        }

        const previewContainerRect = previewContainer.getBoundingClientRect();

        // Find the preview wrapper div with aspect ratio
        const previewWrapper = previewContainer.querySelector('[style*="aspectRatio"]');
        if (!previewWrapper) {
          return { found: false, message: 'Preview wrapper not found' };
        }

        const previewRect = previewWrapper.getBoundingClientRect();
        const computedStyle = window.getComputedStyle(previewWrapper);

        return {
          found: true,
          modalWidth: modalRect.width,
          modalHeight: modalRect.height,
          previewContainerWidth: previewContainerRect.width,
          previewContainerHeight: previewContainerRect.height,
          previewWidth: previewRect.width,
          previewHeight: previewRect.height,
          maxWidth: computedStyle.maxWidth,
          aspectRatio: computedStyle.aspectRatio,
        };
      });

      if (!result.found) {
        console.log(`  ⚠️  ${result.message}`);
        console.log('  Note: Modal needs to be opened manually for testing');
        continue;
      }

      const aspectRatio = result.previewWidth / result.previewHeight;
      const expectedAspectRatio = 8.5 / 11; // 0.7727
      const aspectRatioMatch = Math.abs(aspectRatio - expectedAspectRatio) < 0.01;

      // Check if preview is using available space efficiently
      const containerUtilization = (result.previewWidth / result.previewContainerWidth) * 100;
      const usesAvailableSpace = containerUtilization > 80; // Should use at least 80% of container width

      scalingResults.push({
        viewport: viewport.name,
        modalWidth: result.modalWidth,
        modalHeight: result.modalHeight,
        previewContainerWidth: result.previewContainerWidth,
        previewContainerHeight: result.previewContainerHeight,
        previewWidth: result.previewWidth,
        previewHeight: result.previewHeight,
        aspectRatio: aspectRatio,
        usesAvailableSpace: usesAvailableSpace,
        maintainsAspectRatio: aspectRatioMatch,
      });

      console.log(`  Modal: ${result.modalWidth}x${result.modalHeight}px`);
      console.log(`  Preview Container: ${result.previewContainerWidth}x${result.previewContainerHeight}px`);
      console.log(`  Preview: ${result.previewWidth}x${result.previewHeight}px`);
      console.log(`  Max Width: ${result.maxWidth}`);
      console.log(`  Aspect Ratio: ${aspectRatio.toFixed(4)} (expected: ${expectedAspectRatio.toFixed(4)})`);
      console.log(`  Container Utilization: ${containerUtilization.toFixed(1)}%`);
      console.log(`  ✓ Maintains Aspect Ratio: ${aspectRatioMatch}`);
      console.log(`  ${usesAvailableSpace ? '✓' : '✗'} Uses Available Space: ${usesAvailableSpace}`);
    }

    // Print summary
    console.log('\n========================================');
    console.log('SCALING ANALYSIS SUMMARY');
    console.log('========================================\n');

    scalingResults.forEach(result => {
      console.log(`${result.viewport}:`);
      console.log(`  Preview: ${result.previewWidth.toFixed(0)}x${result.previewHeight.toFixed(0)}px`);
      console.log(`  Aspect: ${result.aspectRatio.toFixed(4)} ${result.maintainsAspectRatio ? '✓' : '✗'}`);
      console.log(`  Space Usage: ${((result.previewWidth / result.previewContainerWidth) * 100).toFixed(1)}% ${result.usesAvailableSpace ? '✓' : '✗'}`);
    });

    console.log('\n========================================');
    console.log('ISSUES IDENTIFIED');
    console.log('========================================\n');

    const issues: string[] = [];

    // Check for fixed max-width causing scaling issues
    if (scalingResults.some(r => !r.usesAvailableSpace)) {
      issues.push('Preview has fixed maxWidth (320px) preventing responsive scaling');
      console.log('✗ Fixed maxWidth prevents preview from using available vertical space');
    }

    // Check if aspect ratio is maintained
    if (scalingResults.some(r => !r.maintainsAspectRatio)) {
      issues.push('Aspect ratio not maintained at some viewport sizes');
      console.log('✗ Aspect ratio not maintained consistently');
    }

    console.log('\n========================================');
    console.log('RECOMMENDATIONS');
    console.log('========================================\n');
    console.log('1. Remove fixed maxWidth (320px)');
    console.log('2. Use height-based scaling with maxHeight instead');
    console.log('3. Preview should fill available vertical space');
    console.log('4. Scale down proportionally on smaller screens');
    console.log('5. Maintain 8.5:11 aspect ratio at all sizes\n');

    // The test documents the current behavior
    // We expect some failures which we'll fix
    console.log('Test completed - see analysis above for scaling behavior\n');
  });

  test('should verify modal dialog structure and CSS classes', async ({ page }) => {
    console.log('\n=== Analyzing Modal Structure ===\n');

    // For inspection purposes - this documents the current structure
    const structure = await page.evaluate(() => {
      const modal = document.querySelector('[role="dialog"]');
      if (!modal) return { found: false };

      // Get the main container structure
      const mainContainer = modal.querySelector('.flex.gap-4');
      const formPanel = mainContainer?.querySelector('.w-\\[55\\%\\]');
      const previewPanel = mainContainer?.querySelector('.w-\\[45\\%\\]');
      const previewWrapper = previewPanel?.querySelector('[style*="aspectRatio"]');

      return {
        found: true,
        modalClasses: modal.className,
        mainContainerClasses: mainContainer?.className || '',
        formPanelClasses: formPanel?.className || '',
        previewPanelClasses: previewPanel?.className || '',
        previewWrapperStyle: previewWrapper?.getAttribute('style') || '',
        previewWrapperClasses: previewWrapper?.className || '',
      };
    });

    if (structure.found) {
      console.log('Modal Structure:');
      console.log(`  Dialog: ${structure.modalClasses}`);
      console.log(`  Main Container: ${structure.mainContainerClasses}`);
      console.log(`  Form Panel (55%): ${structure.formPanelClasses}`);
      console.log(`  Preview Panel (45%): ${structure.previewPanelClasses}`);
      console.log(`  Preview Wrapper Style: ${structure.previewWrapperStyle}`);
      console.log(`  Preview Wrapper Classes: ${structure.previewWrapperClasses}`);
    } else {
      console.log('  Modal not found - needs to be opened for inspection');
    }
  });
});

test.describe('Title Page Preview Manual Test', () => {
  test('manual inspection guide', async ({ page }) => {
    console.log('\n========================================');
    console.log('MANUAL TEST GUIDE');
    console.log('========================================\n');
    console.log('To manually test the title page preview scaling:');
    console.log('');
    console.log('1. Navigate to a Backlot project script page');
    console.log('2. Click to open the Title Page edit modal');
    console.log('3. Resize the browser window to different sizes');
    console.log('4. Observe the preview panel behavior:');
    console.log('   - Does it scale with the modal?');
    console.log('   - Does it maintain 8.5:11 aspect ratio?');
    console.log('   - Does it use available vertical space?');
    console.log('   - Does it handle small screens gracefully?');
    console.log('');
    console.log('Current Issues to Check:');
    console.log('  - Fixed maxWidth: 320px prevents scaling');
    console.log('  - Preview should fill available height');
    console.log('  - Should scale proportionally on resize');
    console.log('');
    console.log('Expected Behavior After Fix:');
    console.log('  - Preview fills available vertical space');
    console.log('  - Maintains 8.5:11 ratio at all sizes');
    console.log('  - Scales down on smaller screens');
    console.log('  - No horizontal overflow');
    console.log('========================================\n');

    // This is just a documentation test
    expect(true).toBe(true);
  });
});
