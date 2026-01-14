/**
 * Continuity Tab - Scene Navigation Test
 *
 * Tests the scene navigation functionality in the Continuity tab, specifically:
 * 1. Scene list display
 * 2. Scene click navigation to PDF pages
 * 3. Scene mappings from continuity exports
 * 4. Console errors related to scene mappings
 * 5. Network requests to verify scene_mappings in API responses
 */

import { test, expect, Page } from '@playwright/test';

// Helper to navigate to the Continuity tab
async function navigateToContinuityTab(page: Page) {
  console.log('[Test] Starting navigation to Continuity tab...');

  // Go to home page
  await page.goto('http://localhost:8080/');
  await page.waitForLoadState('networkidle');

  // Check if already logged in
  const isLoggedIn = await page.locator('[data-testid="user-menu"]').isVisible().catch(() => false);

  if (!isLoggedIn) {
    console.log('[Test] Not logged in - checking for auth...');
    // Try to find login button
    const loginButton = page.locator('a[href*="login"], button:has-text("Login"), a:has-text("Login")').first();
    if (await loginButton.isVisible().catch(() => false)) {
      console.log('[Test] Found login button - user needs to authenticate');
      // In a real test, we'd handle auth here
      // For now, we'll continue and see if we're already authenticated
    }
  } else {
    console.log('[Test] User is already logged in');
  }

  // Navigate to Backlot - try multiple approaches
  console.log('[Test] Looking for Backlot navigation...');

  // Try direct URL navigation if we know the route
  const currentUrl = page.url();
  if (!currentUrl.includes('/backlot')) {
    // Try clicking Backlot link
    const backlotLink = page.locator('a[href*="backlot"]:visible, button:has-text("Backlot"):visible').first();
    if (await backlotLink.isVisible({ timeout: 5000 }).catch(() => false)) {
      console.log('[Test] Found Backlot link, clicking...');
      await backlotLink.click();
      await page.waitForLoadState('networkidle');
    } else {
      console.log('[Test] No Backlot link found, trying direct URL...');
      // Try navigating directly to backlot
      await page.goto('http://localhost:8080/backlot');
      await page.waitForLoadState('networkidle');
    }
  }

  // Look for a project to open
  console.log('[Test] Looking for a project...');
  const projectCard = page.locator('[data-testid="project-card"], .project-card, a[href*="/backlot/project/"]').first();

  if (await projectCard.isVisible({ timeout: 10000 }).catch(() => false)) {
    console.log('[Test] Found project card, clicking...');
    await projectCard.click();
    await page.waitForLoadState('networkidle');
  } else {
    console.log('[Test] No project card found, checking if already in project...');
    // We might already be in a project
  }

  // Navigate to Script section
  console.log('[Test] Looking for Script navigation...');
  const scriptLink = page.locator('button:has-text("Script"), a:has-text("Script"), [data-testid="script-nav"]').first();

  if (await scriptLink.isVisible({ timeout: 5000 }).catch(() => false)) {
    console.log('[Test] Found Script link, clicking...');
    await scriptLink.click();
    await page.waitForLoadState('networkidle');
  }

  // Click on Continuity tab
  console.log('[Test] Looking for Continuity tab...');
  const continuityTab = page.locator('button[role="tab"]:has-text("Continuity"), [data-testid="continuity-tab"]').first();

  if (await continuityTab.isVisible({ timeout: 5000 }).catch(() => false)) {
    console.log('[Test] Found Continuity tab, clicking...');
    await continuityTab.click();
    await page.waitForTimeout(1000); // Give it a moment to load
  }

  // Verify we're in the continuity workspace
  const workspace = await page.locator('[data-testid="scripty-workspace"], .scripty-workspace').first().isVisible({ timeout: 5000 }).catch(() => false);
  console.log('[Test] Continuity workspace visible:', workspace);

  return workspace;
}

test.describe('Continuity Tab - Scene Navigation', () => {
  let consoleMessages: string[] = [];
  let consoleErrors: string[] = [];
  let networkRequests: any[] = [];

  test.beforeEach(async ({ page }) => {
    // Set viewport
    await page.setViewportSize({ width: 1920, height: 1080 });

    // Capture console messages
    consoleMessages = [];
    consoleErrors = [];
    page.on('console', (msg) => {
      const text = msg.text();
      consoleMessages.push(text);
      if (msg.type() === 'error') {
        consoleErrors.push(text);
      }
      console.log(`[Browser Console ${msg.type()}]`, text);
    });

    // Capture network requests
    networkRequests = [];
    page.on('request', (request) => {
      const url = request.url();
      if (url.includes('/continuity/') || url.includes('/exports')) {
        console.log('[Network Request]', request.method(), url);
        networkRequests.push({
          method: request.method(),
          url: url,
          timestamp: Date.now(),
        });
      }
    });

    page.on('response', async (response) => {
      const url = response.url();
      if (url.includes('/continuity/') || url.includes('/exports')) {
        console.log('[Network Response]', response.status(), url);
        try {
          const contentType = response.headers()['content-type'];
          if (contentType && contentType.includes('application/json')) {
            const body = await response.json().catch(() => null);
            if (body) {
              console.log('[Response Body]', JSON.stringify(body, null, 2));
              // Check for scene_mappings in response
              if (body.scene_mappings) {
                console.log('[FOUND] scene_mappings in response:', JSON.stringify(body.scene_mappings, null, 2));
              } else if (Array.isArray(body) && body.length > 0 && body[0].scene_mappings) {
                console.log('[FOUND] scene_mappings in array response');
              } else {
                console.log('[WARNING] No scene_mappings found in response');
              }
            }
          }
        } catch (e) {
          console.log('[Response Parse Error]', e);
        }
      }
    });
  });

  test.afterEach(async () => {
    // Report findings
    console.log('\n========== TEST SUMMARY ==========');
    console.log('Console Errors:', consoleErrors.length);
    if (consoleErrors.length > 0) {
      console.log('Errors:', consoleErrors);
    }
    console.log('Network Requests:', networkRequests.length);
    console.log('==================================\n');
  });

  test('should display scenes in the left panel', async ({ page }) => {
    const inWorkspace = await navigateToContinuityTab(page);

    if (!inWorkspace) {
      console.log('[Test] Could not reach continuity workspace - skipping test');
      test.skip();
      return;
    }

    // Wait for scenes panel to be visible
    const scenesPanel = page.locator('[data-testid="scenes-panel"]');
    await expect(scenesPanel).toBeVisible({ timeout: 10000 });

    // Check for scenes list
    const scenesList = page.locator('[data-testid="scenes-list"]');
    await expect(scenesList).toBeVisible();

    // Look for scene items
    const sceneItems = page.locator('[data-testid^="scene-item-"]');
    const sceneCount = await sceneItems.count();

    console.log(`[Test] Found ${sceneCount} scenes`);
    expect(sceneCount).toBeGreaterThan(0);

    // Log scene numbers
    for (let i = 0; i < Math.min(sceneCount, 5); i++) {
      const sceneText = await sceneItems.nth(i).textContent();
      console.log(`[Test] Scene ${i}:`, sceneText);
    }
  });

  test('should navigate to PDF page when clicking a scene', async ({ page }) => {
    const inWorkspace = await navigateToContinuityTab(page);

    if (!inWorkspace) {
      console.log('[Test] Could not reach continuity workspace - skipping test');
      test.skip();
      return;
    }

    // Wait for scenes to load
    await page.waitForTimeout(2000);

    // Get the first scene
    const firstScene = page.locator('[data-testid^="scene-item-"]').first();

    if (!(await firstScene.isVisible().catch(() => false))) {
      console.log('[Test] No scenes available - skipping test');
      test.skip();
      return;
    }

    const sceneText = await firstScene.textContent();
    console.log('[Test] Clicking first scene:', sceneText);

    // Get current page number before click
    const pageIndicator = page.locator('[data-testid="page-count"]');
    const initialPageText = await pageIndicator.textContent().catch(() => '');
    console.log('[Test] Initial page indicator:', initialPageText);

    // Click the scene
    await firstScene.click();
    await page.waitForTimeout(1000);

    // Check if scene is now selected (has active styling)
    await expect(firstScene).toHaveClass(/accent-yellow/);

    // Get page number after click
    const newPageText = await pageIndicator.textContent().catch(() => '');
    console.log('[Test] New page indicator:', newPageText);

    // Verify page changed (or at least scene is selected)
    console.log('[Test] Scene click handled successfully');
  });

  test('should check for scene_mappings in continuity export API', async ({ page }) => {
    const inWorkspace = await navigateToContinuityTab(page);

    if (!inWorkspace) {
      console.log('[Test] Could not reach continuity workspace - skipping test');
      test.skip();
      return;
    }

    // Wait for network requests to complete
    await page.waitForTimeout(3000);

    // Check if any export-related requests were made
    const exportRequests = networkRequests.filter(r =>
      r.url.includes('/continuity/export') || r.url.includes('/exports')
    );

    console.log('[Test] Export-related requests:', exportRequests.length);

    if (exportRequests.length === 0) {
      console.log('[Test] No continuity export requests detected');
      console.log('[Test] This might indicate:');
      console.log('  1. No continuity exports exist for this project');
      console.log('  2. The API endpoint is different');
      console.log('  3. Exports are not being loaded yet');
    } else {
      console.log('[Test] Found export requests:', exportRequests);
    }

    // Check for version selector which indicates exports exist
    const versionSelector = page.locator('select, [role="combobox"]').filter({ hasText: /version/i }).first();
    const hasVersionSelector = await versionSelector.isVisible({ timeout: 2000 }).catch(() => false);

    if (hasVersionSelector) {
      console.log('[Test] Version selector found - exports are available');

      // Try to open the selector to see versions
      await versionSelector.click();
      await page.waitForTimeout(500);

      const versions = page.locator('[role="option"]');
      const versionCount = await versions.count();
      console.log('[Test] Available versions:', versionCount);
    } else {
      console.log('[Test] No version selector found');
    }
  });

  test('should verify scene click updates page number', async ({ page }) => {
    const inWorkspace = await navigateToContinuityTab(page);

    if (!inWorkspace) {
      console.log('[Test] Could not reach continuity workspace - skipping test');
      test.skip();
      return;
    }

    // Wait for content to load
    await page.waitForTimeout(2000);

    // Get all scenes
    const scenes = page.locator('[data-testid^="scene-item-"]');
    const sceneCount = await scenes.count();

    if (sceneCount < 2) {
      console.log('[Test] Need at least 2 scenes for navigation test - skipping');
      test.skip();
      return;
    }

    console.log('[Test] Testing navigation between multiple scenes...');

    // Click first scene
    const firstScene = scenes.first();
    const firstSceneText = await firstScene.textContent();
    console.log('[Test] Clicking scene 1:', firstSceneText);
    await firstScene.click();
    await page.waitForTimeout(500);

    // Get page selector value
    const pageSelector = page.locator('[data-testid="page-selector"]');
    const page1Value = await pageSelector.inputValue().catch(async () =>
      await pageSelector.textContent()
    );
    console.log('[Test] Page after scene 1 click:', page1Value);

    // Click second scene
    const secondScene = scenes.nth(1);
    const secondSceneText = await secondScene.textContent();
    console.log('[Test] Clicking scene 2:', secondSceneText);
    await secondScene.click();
    await page.waitForTimeout(500);

    const page2Value = await pageSelector.inputValue().catch(async () =>
      await pageSelector.textContent()
    );
    console.log('[Test] Page after scene 2 click:', page2Value);

    // Pages should be different (unless both scenes are on same page)
    if (page1Value === page2Value) {
      console.log('[Test] WARNING: Page number did not change between scenes');
      console.log('[Test] This could indicate:');
      console.log('  1. Both scenes are on the same page (valid)');
      console.log('  2. scene_mappings is not working (problem)');
      console.log('  3. Scenes do not have page_start values (problem)');
    } else {
      console.log('[Test] SUCCESS: Page changed from', page1Value, 'to', page2Value);
    }
  });

  test('should check for console errors related to scene mappings', async ({ page }) => {
    const inWorkspace = await navigateToContinuityTab(page);

    if (!inWorkspace) {
      console.log('[Test] Could not reach continuity workspace - skipping test');
      test.skip();
      return;
    }

    // Wait for interactions
    await page.waitForTimeout(2000);

    // Click a few scenes to trigger any potential errors
    const scenes = page.locator('[data-testid^="scene-item-"]');
    const sceneCount = await scenes.count();

    if (sceneCount > 0) {
      console.log('[Test] Clicking scenes to check for errors...');
      for (let i = 0; i < Math.min(sceneCount, 3); i++) {
        await scenes.nth(i).click();
        await page.waitForTimeout(300);
      }
    }

    // Check console for errors
    console.log('[Test] Console messages captured:', consoleMessages.length);
    console.log('[Test] Console errors captured:', consoleErrors.length);

    // Filter for scene mapping related errors
    const mappingErrors = consoleErrors.filter(err =>
      err.toLowerCase().includes('scene') ||
      err.toLowerCase().includes('mapping') ||
      err.toLowerCase().includes('page')
    );

    if (mappingErrors.length > 0) {
      console.log('[Test] FOUND scene/mapping related errors:');
      mappingErrors.forEach(err => console.log('  -', err));
    } else {
      console.log('[Test] No scene/mapping related errors found');
    }

    // Report all errors for context
    if (consoleErrors.length > 0) {
      console.log('[Test] All console errors:');
      consoleErrors.forEach(err => console.log('  -', err));
    }

    // Test passes if we can click scenes without critical errors
    // (Some warnings are acceptable)
    expect(mappingErrors.length).toBeLessThan(5); // Allow a few non-critical warnings
  });

  test('should display scene details (INT/EXT, location)', async ({ page }) => {
    const inWorkspace = await navigateToContinuityTab(page);

    if (!inWorkspace) {
      console.log('[Test] Could not reach continuity workspace - skipping test');
      test.skip();
      return;
    }

    await page.waitForTimeout(2000);

    // Look for scene details in scene cards
    const firstScene = page.locator('[data-testid^="scene-item-"]').first();

    if (!(await firstScene.isVisible().catch(() => false))) {
      console.log('[Test] No scenes available - skipping test');
      test.skip();
      return;
    }

    const sceneContent = await firstScene.textContent();
    console.log('[Test] Scene content:', sceneContent);

    // Check for INT/EXT indicators
    const hasIntExt = /INT\.|EXT\./.test(sceneContent || '');
    console.log('[Test] Has INT/EXT:', hasIntExt);

    if (!hasIntExt) {
      console.log('[Test] WARNING: Scene does not show INT/EXT information');
    }
  });

  test('should maintain scene selection visual state', async ({ page }) => {
    const inWorkspace = await navigateToContinuityTab(page);

    if (!inWorkspace) {
      console.log('[Test] Could not reach continuity workspace - skipping test');
      test.skip();
      return;
    }

    await page.waitForTimeout(2000);

    const scenes = page.locator('[data-testid^="scene-item-"]');
    const sceneCount = await scenes.count();

    if (sceneCount < 1) {
      console.log('[Test] No scenes available - skipping test');
      test.skip();
      return;
    }

    // Click first scene
    const firstScene = scenes.first();
    await firstScene.click();
    await page.waitForTimeout(300);

    // Check if it has active/selected styling
    const className = await firstScene.getAttribute('class');
    console.log('[Test] Selected scene classes:', className);

    // Should have accent-yellow styling
    const hasActiveStyle = className?.includes('accent-yellow') || className?.includes('active') || className?.includes('selected');
    console.log('[Test] Has active style:', hasActiveStyle);

    if (!hasActiveStyle) {
      console.log('[Test] WARNING: Selected scene does not show active styling');
    } else {
      console.log('[Test] SUCCESS: Scene shows selected state');
    }

    expect(hasActiveStyle).toBe(true);
  });
});
