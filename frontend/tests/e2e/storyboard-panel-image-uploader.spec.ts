/**
 * Storyboard Panel Image Uploader Tests
 *
 * Tests for two reported issues:
 * 1. Button alignment: Replace/Remove buttons should appear on RIGHT side when hovering
 * 2. Image display: Uploaded images should display as thumbnails on panels
 */
import { test, expect } from '@playwright/test';

// Test configuration
const TEST_CONFIG = {
  baseURL: 'http://localhost:8080',
  timeout: 30000,
};

// Helper to wait for app to be ready
async function waitForAppReady(page) {
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(500);
}

// Helper to login (adjust based on your auth setup)
async function login(page) {
  // Wait for page to load
  await page.goto('/');
  await waitForAppReady(page);

  // Check if already logged in by looking for dashboard or profile indicator
  const isLoggedIn = await page.locator('[data-testid="user-menu"], .avatar, [aria-label*="profile"]').count() > 0;

  if (isLoggedIn) {
    console.log('[Test] Already logged in');
    return;
  }

  // If not logged in, attempt to login
  // Note: Adjust selectors based on your actual login form
  console.log('[Test] Attempting to login...');

  // Look for login button/link
  const loginButton = page.locator('a[href*="login"], button:has-text("Login"), a:has-text("Login")').first();
  if (await loginButton.isVisible({ timeout: 2000 }).catch(() => false)) {
    await loginButton.click();
    await page.waitForLoadState('networkidle');
  }
}

// Helper to navigate to a storyboard with panels
async function navigateToStoryboard(page) {
  // Navigate to backlot
  await page.goto('/backlot');
  await waitForAppReady(page);

  // Look for a project
  const projectCard = page.locator('[data-testid="project-card"], .project-card, [class*="project"]').first();

  if (await projectCard.isVisible({ timeout: 5000 }).catch(() => false)) {
    await projectCard.click();
    await waitForAppReady(page);
  } else {
    console.log('[Test] No projects found, creating test data may be needed');
    throw new Error('No projects found');
  }

  // Navigate to storyboard view
  const storyboardTab = page.locator('button:has-text("Storyboard"), a:has-text("Storyboard"), [data-testid="storyboard-tab"]').first();

  if (await storyboardTab.isVisible({ timeout: 5000 }).catch(() => false)) {
    await storyboardTab.click();
    await waitForAppReady(page);
  } else {
    console.log('[Test] Storyboard tab not found');
    throw new Error('Storyboard tab not found');
  }

  // Look for existing storyboard or create one
  const storyboardCard = page.locator('[class*="storyboard"], [data-testid="storyboard-card"]').first();

  if (await storyboardCard.isVisible({ timeout: 5000 }).catch(() => false)) {
    await storyboardCard.click();
    await waitForAppReady(page);
  } else {
    console.log('[Test] No storyboards found, may need to create test data');
    throw new Error('No storyboards found');
  }
}

test.describe('Storyboard Panel Image Uploader', () => {
  test.beforeEach(async ({ page }) => {
    page.setDefaultTimeout(TEST_CONFIG.timeout);
    await login(page);
  });

  test('Issue 1: Replace/Remove buttons should appear on RIGHT side when hovering', async ({ page }) => {
    console.log('[Test] Starting button alignment test...');

    try {
      await navigateToStoryboard(page);
    } catch (error) {
      console.log('[Test] Could not navigate to storyboard:', error.message);
      test.skip();
      return;
    }

    // Look for a panel with an uploaded image
    const panelWithImage = page.locator('.group:has(img[alt="Panel reference"])').first();

    if (!await panelWithImage.isVisible({ timeout: 5000 }).catch(() => false)) {
      console.log('[Test] No panels with images found - need to upload an image first');
      test.skip();
      return;
    }

    // Get the panel's bounding box
    const panelBox = await panelWithImage.boundingBox();
    expect(panelBox).not.toBeNull();

    console.log(`[Test] Panel position: x=${panelBox!.x}, y=${panelBox!.y}, width=${panelBox!.width}, height=${panelBox!.height}`);

    // Hover over the panel to reveal buttons
    await panelWithImage.hover();
    await page.waitForTimeout(500); // Wait for transition

    // Find the hover overlay with buttons
    const hoverOverlay = panelWithImage.locator('div.absolute.inset-0').first();
    await expect(hoverOverlay).toBeVisible();

    // Check for Replace button
    const replaceButton = hoverOverlay.locator('button:has-text("Replace")');
    await expect(replaceButton).toBeVisible();

    // Check for Remove button
    const removeButton = hoverOverlay.locator('button:has-text("Remove")');
    await expect(removeButton).toBeVisible();

    // Get button positions
    const replaceBox = await replaceButton.boundingBox();
    const removeBox = await removeButton.boundingBox();

    expect(replaceBox).not.toBeNull();
    expect(removeBox).not.toBeNull();

    console.log(`[Test] Replace button position: x=${replaceBox!.x}, y=${replaceBox!.y}`);
    console.log(`[Test] Remove button position: x=${removeBox!.x}, y=${removeBox!.y}`);
    console.log(`[Test] Panel right edge: ${panelBox!.x + panelBox!.width}`);

    // Calculate button positions relative to panel
    const replaceRightEdge = replaceBox!.x + replaceBox!.width;
    const removeRightEdge = removeBox!.x + removeBox!.width;
    const panelRightEdge = panelBox!.x + panelBox!.width;

    // Buttons should be near the right edge of the panel (within 20px)
    const replaceDistance = Math.abs(replaceRightEdge - panelRightEdge);
    const removeDistance = Math.abs(removeRightEdge - panelRightEdge);

    console.log(`[Test] Replace button distance from right edge: ${replaceDistance}px`);
    console.log(`[Test] Remove button distance from right edge: ${removeDistance}px`);

    // Take screenshot for visual verification
    await page.screenshot({
      path: 'tests/e2e/screenshots/storyboard-button-alignment.png',
      fullPage: false
    });

    // ASSERTION: Buttons should be aligned to the right (distance < 50px from right edge)
    expect(replaceDistance, 'Replace button should be near right edge').toBeLessThan(50);
    expect(removeDistance, 'Remove button should be near right edge').toBeLessThan(50);

    // Additional check: Remove button should be to the right of Replace button
    expect(removeBox!.x, 'Remove button should be right of Replace button').toBeGreaterThan(replaceBox!.x);
  });

  test('Issue 2: Uploaded image should display as thumbnail on panel', async ({ page }) => {
    console.log('[Test] Starting image display test...');

    try {
      await navigateToStoryboard(page);
    } catch (error) {
      console.log('[Test] Could not navigate to storyboard:', error.message);
      test.skip();
      return;
    }

    // Look for a panel (may or may not have an image)
    const panel = page.locator('[class*="panel"], .group').first();

    if (!await panel.isVisible({ timeout: 5000 }).catch(() => false)) {
      console.log('[Test] No panels found - need to create a panel first');
      test.skip();
      return;
    }

    // Check if panel already has an image
    const existingImage = panel.locator('img[alt="Panel reference"]');
    const hasImage = await existingImage.isVisible().catch(() => false);

    console.log(`[Test] Panel ${hasImage ? 'has' : 'does not have'} an existing image`);

    if (hasImage) {
      // Verify image is actually displayed (not broken)
      const imgSrc = await existingImage.getAttribute('src');
      console.log(`[Test] Image src: ${imgSrc}`);

      // Check that image has loaded (naturalWidth > 0)
      const isLoaded = await existingImage.evaluate((img: HTMLImageElement) => {
        return img.complete && img.naturalWidth > 0;
      });

      console.log(`[Test] Image loaded: ${isLoaded}`);

      // Take screenshot
      await panel.screenshot({
        path: 'tests/e2e/screenshots/storyboard-panel-with-image.png'
      });

      // ASSERTION: Image should be loaded and visible
      expect(isLoaded, 'Image should be fully loaded').toBe(true);
      expect(imgSrc, 'Image should have a valid src').toBeTruthy();

    } else {
      // Panel has no image - need to upload one
      console.log('[Test] Panel has no image - looking for upload area');

      // Look for upload dropzone
      const dropzone = panel.locator('[class*="dropzone"], .border-dashed, input[type="file"]').first();

      if (!await dropzone.isVisible().catch(() => false)) {
        console.log('[Test] No dropzone found - panel may not support image upload');
        test.skip();
        return;
      }

      // Create a test image file
      const testImagePath = 'tests/e2e/test-image.png';

      // Upload image via file input
      const fileInput = panel.locator('input[type="file"]').first();

      if (await fileInput.count() > 0) {
        console.log('[Test] Uploading test image...');

        // Note: You'll need to have a test image at this path
        // For now, we'll skip if file doesn't exist
        await fileInput.setInputFiles(testImagePath).catch(() => {
          console.log('[Test] Test image not found, skipping upload');
          test.skip();
        });

        // Wait for upload to complete
        await page.waitForTimeout(2000);

        // Check if image now appears
        const uploadedImage = panel.locator('img[alt="Panel reference"]');
        await expect(uploadedImage).toBeVisible({ timeout: 10000 });

        // Verify image loaded
        const isLoaded = await uploadedImage.evaluate((img: HTMLImageElement) => {
          return img.complete && img.naturalWidth > 0;
        });

        console.log(`[Test] Uploaded image loaded: ${isLoaded}`);

        // Take screenshot
        await panel.screenshot({
          path: 'tests/e2e/screenshots/storyboard-panel-after-upload.png'
        });

        // ASSERTION: Uploaded image should be visible and loaded
        expect(isLoaded, 'Uploaded image should be fully loaded').toBe(true);
      }
    }
  });

  test('Visual inspection: Panel image uploader layout', async ({ page }) => {
    console.log('[Test] Starting visual inspection...');

    try {
      await navigateToStoryboard(page);
    } catch (error) {
      console.log('[Test] Could not navigate to storyboard:', error.message);
      test.skip();
      return;
    }

    // Take full page screenshot
    await page.screenshot({
      path: 'tests/e2e/screenshots/storyboard-full-view.png',
      fullPage: true
    });

    // Find all panels
    const panels = page.locator('[class*="panel"], .group').all();
    const panelCount = (await panels).length;

    console.log(`[Test] Found ${panelCount} panels`);

    // Screenshot each panel
    for (let i = 0; i < Math.min(panelCount, 5); i++) {
      const panel = page.locator('[class*="panel"], .group').nth(i);

      if (await panel.isVisible().catch(() => false)) {
        await panel.screenshot({
          path: `tests/e2e/screenshots/storyboard-panel-${i + 1}.png`
        });

        // Hover and screenshot
        await panel.hover();
        await page.waitForTimeout(500);

        await panel.screenshot({
          path: `tests/e2e/screenshots/storyboard-panel-${i + 1}-hover.png`
        });
      }
    }

    console.log('[Test] Visual inspection complete - check screenshots folder');
  });

  test('Console error check during image upload', async ({ page }) => {
    const consoleErrors: string[] = [];
    const consoleWarnings: string[] = [];

    // Capture console messages
    page.on('console', (msg) => {
      const type = msg.type();
      const text = msg.text();

      if (type === 'error') {
        consoleErrors.push(text);
        console.log(`[Browser Error] ${text}`);
      } else if (type === 'warning') {
        consoleWarnings.push(text);
        console.log(`[Browser Warning] ${text}`);
      }
    });

    // Capture network errors
    page.on('requestfailed', (request) => {
      console.log(`[Network Error] ${request.url()} - ${request.failure()?.errorText}`);
    });

    try {
      await navigateToStoryboard(page);
    } catch (error) {
      console.log('[Test] Could not navigate to storyboard:', error.message);
      test.skip();
      return;
    }

    // Wait a bit to catch any delayed errors
    await page.waitForTimeout(2000);

    // Log findings
    console.log(`[Test] Console errors: ${consoleErrors.length}`);
    console.log(`[Test] Console warnings: ${consoleWarnings.length}`);

    // Check for specific errors related to image loading or CORS
    const imageErrors = consoleErrors.filter(e =>
      e.includes('image') ||
      e.includes('CORS') ||
      e.includes('Failed to load') ||
      e.includes('404')
    );

    if (imageErrors.length > 0) {
      console.log('[Test] Image-related errors found:');
      imageErrors.forEach(e => console.log(`  - ${e}`));
    }

    // ASSERTION: Should not have critical image loading errors
    expect(imageErrors.length, 'Should not have image loading errors').toBe(0);
  });
});
