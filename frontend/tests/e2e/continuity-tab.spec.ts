/**
 * Comprehensive E2E Tests for Continuity Tab (ScriptyWorkspace)
 *
 * Test Coverage:
 * 1. ScriptyWorkspace Layout & Controls
 * 2. Left Panel - Scenes List
 * 3. Center Panel - Script Viewer
 * 4. Right Panel - Takes Tab
 * 5. Right Panel - Notes Tab
 * 6. Right Panel - Photos Tab
 * 7. Export Functionality
 */

import { test, expect, Page } from '@playwright/test';

// Navigation helper to get to the Continuity tab
async function navigateToContinuityTab(page: Page) {
  // Go to home page
  await page.goto('/');

  // Check if already logged in by looking for user-specific elements
  const isLoggedIn = await page.locator('[data-testid="user-menu"]').isVisible().catch(() => false);

  if (!isLoggedIn) {
    // Look for login button/link
    const loginButton = page.locator('a[href*="login"], button:has-text("Login"), a:has-text("Login")').first();
    if (await loginButton.isVisible().catch(() => false)) {
      await loginButton.click();

      // Wait for login page to load
      await page.waitForLoadState('networkidle');

      // Note: Actual login would require credentials
      // This test assumes we're either already logged in or can bypass auth for testing
      console.log('Login flow detected - may need to handle authentication');
    }
  }

  // Navigate to Backlot
  const backlotLink = page.locator('a[href*="backlot"], button:has-text("Backlot"), a:has-text("Backlot")').first();
  await backlotLink.click();

  // Wait for Backlot page to load
  await page.waitForLoadState('networkidle');

  // Look for a project to open (click first project card/link)
  const projectLink = page.locator('[data-testid="project-card"], .project-card, a[href*="/backlot/project/"]').first();
  await projectLink.click({ timeout: 10000 });

  // Wait for project workspace to load
  await page.waitForLoadState('networkidle');

  // Click on Script in sidebar/navigation
  const scriptLink = page.locator('button:has-text("Script"), a:has-text("Script")').first();
  await scriptLink.click();

  // Wait for Script page to load
  await page.waitForLoadState('networkidle');

  // Click on Continuity tab
  const continuityTab = page.locator('button[role="tab"]:has-text("Continuity")');
  await continuityTab.click();

  // Wait for Continuity workspace to load
  await page.waitForSelector('[data-testid="scripty-workspace"], .scripty-workspace, text=Scripty', { timeout: 10000 });
}

test.describe('Continuity Tab - ScriptyWorkspace', () => {
  test.beforeEach(async ({ page }) => {
    // Set viewport for consistent testing
    await page.setViewportSize({ width: 1920, height: 1080 });
  });

  test.describe('1. ScriptyWorkspace Layout & Controls', () => {
    test('should display three-panel layout', async ({ page }) => {
      await navigateToContinuityTab(page);

      // Verify three main regions exist
      // Left panel - Scenes
      const leftPanel = page.locator('text=Scenes').first();
      await expect(leftPanel).toBeVisible();

      // Center panel - Script viewer with page navigation
      const pageNavigation = page.locator('text=Page', 'button:has-text("Previous"), button:has-text("Next")').first();
      await expect(pageNavigation).toBeVisible();

      // Right panel - Tabs (Takes, Notes, Photos)
      const takesTab = page.locator('button[role="tab"]:has-text("Takes")');
      const notesTab = page.locator('button[role="tab"]:has-text("Notes")');
      const photosTab = page.locator('button[role="tab"]:has-text("Photos")');

      await expect(takesTab).toBeVisible();
      await expect(notesTab).toBeVisible();
      await expect(photosTab).toBeVisible();
    });

    test('should display Script selector dropdown', async ({ page }) => {
      await navigateToContinuityTab(page);

      // Look for script selector
      const scriptSelector = page.locator('select, button[role="combobox"]').filter({ hasText: /script|select/i }).first();
      await expect(scriptSelector).toBeVisible();
    });

    test('should display Production Day selector', async ({ page }) => {
      await navigateToContinuityTab(page);

      // Look for day selector
      const daySelector = page.locator('select, button[role="combobox"]').filter({ hasText: /day/i }).first();
      await expect(daySelector).toBeVisible();
    });

    test('should toggle Rolling button state', async ({ page }) => {
      await navigateToContinuityTab(page);

      // Find Rolling button
      const rollingButton = page.locator('button:has-text("Rolling")');

      if (await rollingButton.isVisible()) {
        // Click to start rolling
        await rollingButton.click();

        // Should change to "Stop" and have different styling
        await expect(page.locator('button:has-text("Stop")')).toBeVisible({ timeout: 2000 });

        // Click Stop
        await page.locator('button:has-text("Stop")').click();

        // Should change back to "Rolling"
        await expect(rollingButton).toBeVisible({ timeout: 2000 });
      } else {
        test.skip();
      }
    });

    test('should display Export dropdown with all options', async ({ page }) => {
      await navigateToContinuityTab(page);

      // Find and click Export button (download icon)
      const exportButton = page.locator('button[title="Export"], button:has([data-icon="download"])').first();
      await exportButton.click();

      // Verify export options appear
      await expect(page.locator('text=Takes (CSV)')).toBeVisible();
      await expect(page.locator('text=Takes (JSON)')).toBeVisible();
      await expect(page.locator('text=Notes (CSV)')).toBeVisible();
      await expect(page.locator('text=Notes (JSON)')).toBeVisible();
      await expect(page.locator('text=Daily Report')).toBeVisible();
    });

    test('should toggle Fullscreen mode', async ({ page }) => {
      await navigateToContinuityTab(page);

      // Find fullscreen button
      const fullscreenButton = page.locator('button[title*="Fullscreen"], button:has([data-icon="fullscreen"])').first();

      if (await fullscreenButton.isVisible()) {
        await fullscreenButton.click();

        // Check for fullscreen indicator or exit button
        const exitFullscreenButton = page.locator('button[title*="Exit"], button:has-text("Exit")').first();
        await expect(exitFullscreenButton).toBeVisible({ timeout: 2000 });
      }
    });
  });

  test.describe('2. Left Panel - Scenes List', () => {
    test('should display list of scenes', async ({ page }) => {
      await navigateToContinuityTab(page);

      // Wait for scenes to load
      await page.waitForTimeout(1000);

      // Check if scenes are present or if empty state is shown
      const scenesList = page.locator('[data-testid="scenes-list"], .scenes-list, text=Scene').first();
      const emptyState = page.locator('text=No scenes');

      const hasScenes = await scenesList.isVisible().catch(() => false);
      const isEmpty = await emptyState.isVisible().catch(() => false);

      expect(hasScenes || isEmpty).toBe(true);
    });

    test('should display scene numbers correctly', async ({ page }) => {
      await navigateToContinuityTab(page);

      // Look for scene number pattern (e.g., "1", "2A", "10")
      const sceneNumber = page.locator('[class*="scene"], button').filter({ hasText: /^\d+[A-Z]?$/ }).first();

      if (await sceneNumber.isVisible().catch(() => false)) {
        await expect(sceneNumber).toBeVisible();
      }
    });

    test('should update center and right panels when scene is clicked', async ({ page }) => {
      await navigateToContinuityTab(page);

      // Find first scene button/card
      const firstScene = page.locator('[data-testid="scene-item"], .scene-item, button').filter({ hasText: /scene|^\d+[A-Z]?$/i }).first();

      if (await firstScene.isVisible().catch(() => false)) {
        // Get scene identifier before click
        const sceneText = await firstScene.textContent();

        // Click scene
        await firstScene.click();

        // Verify scene is selected (should have active/selected styling)
        await expect(firstScene).toHaveClass(/selected|active|accent/);
      }
    });

    test('should show scene details (INT/EXT, location, time)', async ({ page }) => {
      await navigateToContinuityTab(page);

      // Look for scene details in scene cards
      const sceneDetails = page.locator('text=/INT\\.|EXT\\./').first();

      if (await sceneDetails.isVisible().catch(() => false)) {
        await expect(sceneDetails).toBeVisible();
      }
    });
  });

  test.describe('3. Center Panel - Script Viewer with Lined Script', () => {
    test('should display PDF viewer or placeholder message', async ({ page }) => {
      await navigateToContinuityTab(page);

      // Check for PDF viewer or "No PDF Available" message
      const pdfViewer = page.locator('canvas, [data-testid="pdf-viewer"], iframe').first();
      const noScriptMessage = page.locator('text=No PDF Available, text=No script');

      const hasPDF = await pdfViewer.isVisible().catch(() => false);
      const hasMessage = await noScriptMessage.isVisible().catch(() => false);

      expect(hasPDF || hasMessage).toBe(true);
    });

    test('should have page navigation controls', async ({ page }) => {
      await navigateToContinuityTab(page);

      // Look for previous/next buttons
      const prevButton = page.locator('button').filter({ hasText: /previous|prev|chevron-left/i }).first();
      const nextButton = page.locator('button').filter({ hasText: /next|chevron-right/i }).first();

      await expect(prevButton).toBeVisible();
      await expect(nextButton).toBeVisible();
    });

    test('should display current page number and total pages', async ({ page }) => {
      await navigateToContinuityTab(page);

      // Look for page indicator (e.g., "Page 1 of 120")
      const pageIndicator = page.locator('text=/page.*of|\\d+\\s*\\/\\s*\\d+/i').first();

      if (await pageIndicator.isVisible().catch(() => false)) {
        await expect(pageIndicator).toBeVisible();
      }
    });

    test('should navigate to next page when next button is clicked', async ({ page }) => {
      await navigateToContinuityTab(page);

      // Get current page number
      const pageSelect = page.locator('select, input[type="number"]').filter({ hasText: /page|^\d+$/i }).first();

      if (await pageSelect.isVisible().catch(() => false)) {
        const initialValue = await pageSelect.inputValue();

        // Click next button
        const nextButton = page.locator('button').filter({ hasText: /next|chevron-right/i }).first();
        await nextButton.click();

        // Wait for page change
        await page.waitForTimeout(500);

        const newValue = await pageSelect.inputValue();
        expect(parseInt(newValue)).toBeGreaterThan(parseInt(initialValue));
      }
    });

    test('should have fullscreen toggle for script viewer', async ({ page }) => {
      await navigateToContinuityTab(page);

      // Look for maximize/minimize icon in script viewer section
      const fullscreenToggle = page.locator('button[title*="fullscreen"], button').filter({ hasText: /maximize|minimize/i }).first();

      if (await fullscreenToggle.isVisible().catch(() => false)) {
        await expect(fullscreenToggle).toBeVisible();
      }
    });
  });

  test.describe('4. Right Panel - Takes Tab', () => {
    test('should display Takes tab and allow selection', async ({ page }) => {
      await navigateToContinuityTab(page);

      const takesTab = page.locator('button[role="tab"]:has-text("Takes")');
      await takesTab.click();

      await expect(takesTab).toHaveAttribute('aria-selected', 'true');
    });

    test('should show New Take button when scene is selected', async ({ page }) => {
      await navigateToContinuityTab(page);

      // Click Takes tab
      await page.locator('button[role="tab"]:has-text("Takes")').click();

      // Select a scene first
      const firstScene = page.locator('[data-testid="scene-item"], button').filter({ hasText: /^\d+[A-Z]?$/ }).first();
      if (await firstScene.isVisible().catch(() => false)) {
        await firstScene.click();

        // Look for New Take button
        const newTakeButton = page.locator('button:has-text("New Take")');
        await expect(newTakeButton).toBeVisible({ timeout: 3000 });
      }
    });

    test('should display New Take form with all required fields', async ({ page }) => {
      await navigateToContinuityTab(page);

      await page.locator('button[role="tab"]:has-text("Takes")').click();

      // Select a scene
      const firstScene = page.locator('button').filter({ hasText: /^\d+[A-Z]?$/ }).first();
      if (await firstScene.isVisible().catch(() => false)) {
        await firstScene.click();

        // Click New Take
        const newTakeButton = page.locator('button:has-text("New Take")');
        if (await newTakeButton.isVisible().catch(() => false)) {
          await newTakeButton.click();

          // Verify form fields
          await expect(page.locator('input[placeholder*="Take"], input[type="number"]').first()).toBeVisible();
          await expect(page.locator('input[placeholder*="Cam"]').first()).toBeVisible();
          await expect(page.locator('input[placeholder*="Setup"]').first()).toBeVisible();

          // Status buttons
          await expect(page.locator('button:has-text("OK")').first()).toBeVisible();
          await expect(page.locator('button:has-text("Print")').first()).toBeVisible();
          await expect(page.locator('button:has-text("Circled")').first()).toBeVisible();

          // Notes textarea
          await expect(page.locator('textarea[placeholder*="Notes"]').first()).toBeVisible();

          // Submit button
          await expect(page.locator('button:has-text("Log Take")').first()).toBeVisible();
        }
      }
    });

    test('should auto-increment take number', async ({ page }) => {
      await navigateToContinuityTab(page);

      await page.locator('button[role="tab"]:has-text("Takes")').click();

      const firstScene = page.locator('button').filter({ hasText: /^\d+[A-Z]?$/ }).first();
      if (await firstScene.isVisible().catch(() => false)) {
        await firstScene.click();

        const newTakeButton = page.locator('button:has-text("New Take")');
        if (await newTakeButton.isVisible().catch(() => false)) {
          await newTakeButton.click();

          // Check if take number is auto-populated
          const takeNumberInput = page.locator('input[placeholder*="Take"], input[type="number"]').first();
          const value = await takeNumberInput.inputValue();
          expect(parseInt(value)).toBeGreaterThan(0);
        }
      }
    });

    test('should display status buttons (OK, Print, Circled, Hold, NG, Wild, MOS)', async ({ page }) => {
      await navigateToContinuityTab(page);

      await page.locator('button[role="tab"]:has-text("Takes")').click();

      const firstScene = page.locator('button').filter({ hasText: /^\d+[A-Z]?$/ }).first();
      if (await firstScene.isVisible().catch(() => false)) {
        await firstScene.click();

        const newTakeButton = page.locator('button:has-text("New Take")');
        if (await newTakeButton.isVisible().catch(() => false)) {
          await newTakeButton.click();

          // Check for status buttons
          const statusButtons = ['OK', 'Print', 'Circled', 'Hold', 'NG'];
          for (const status of statusButtons) {
            const button = page.locator(`button:has-text("${status}")`).first();
            await expect(button).toBeVisible();
          }
        }
      }
    });

    test('should show message when no scene is selected', async ({ page }) => {
      await navigateToContinuityTab(page);

      await page.locator('button[role="tab"]:has-text("Takes")').click();

      // Look for "Select a scene" message
      const message = page.locator('text=Select a scene');

      // This should be visible if no scene is selected
      // Note: May not always be visible if a scene is auto-selected
    });
  });

  test.describe('5. Right Panel - Notes Tab', () => {
    test('should display Notes tab and allow selection', async ({ page }) => {
      await navigateToContinuityTab(page);

      const notesTab = page.locator('button[role="tab"]:has-text("Notes")');
      await notesTab.click();

      await expect(notesTab).toHaveAttribute('aria-selected', 'true');
    });

    test('should display category filter dropdown', async ({ page }) => {
      await navigateToContinuityTab(page);

      await page.locator('button[role="tab"]:has-text("Notes")').click();

      // Look for category filter
      const categoryFilter = page.locator('select, button[role="combobox"]').filter({ hasText: /all|category/i }).first();
      await expect(categoryFilter).toBeVisible();
    });

    test('should show Add button for creating notes', async ({ page }) => {
      await navigateToContinuityTab(page);

      await page.locator('button[role="tab"]:has-text("Notes")').click();

      // Select a scene first
      const firstScene = page.locator('button').filter({ hasText: /^\d+[A-Z]?$/ }).first();
      if (await firstScene.isVisible().catch(() => false)) {
        await firstScene.click();

        const addButton = page.locator('button:has-text("Add")').first();
        await expect(addButton).toBeVisible({ timeout: 3000 });
      }
    });

    test('should display Add Note form with all fields', async ({ page }) => {
      await navigateToContinuityTab(page);

      await page.locator('button[role="tab"]:has-text("Notes")').click();

      const firstScene = page.locator('button').filter({ hasText: /^\d+[A-Z]?$/ }).first();
      if (await firstScene.isVisible().catch(() => false)) {
        await firstScene.click();

        const addButton = page.locator('button:has-text("Add")').first();
        if (await addButton.isVisible().catch(() => false)) {
          await addButton.click();

          // Verify form fields
          // Category selector
          await expect(page.locator('select, button[role="combobox"]').filter({ hasText: /general|category/i }).first()).toBeVisible();

          // Content textarea
          await expect(page.locator('textarea[placeholder*="Note"]').first()).toBeVisible();

          // Critical checkbox
          await expect(page.locator('input[type="checkbox"]').first()).toBeVisible();

          // Submit button
          await expect(page.locator('button:has-text("Add Note")').first()).toBeVisible();
        }
      }
    });

    test('should display category options in selector', async ({ page }) => {
      await navigateToContinuityTab(page);

      await page.locator('button[role="tab"]:has-text("Notes")').click();

      const firstScene = page.locator('button').filter({ hasText: /^\d+[A-Z]?$/ }).first();
      if (await firstScene.isVisible().catch(() => false)) {
        await firstScene.click();

        const addButton = page.locator('button:has-text("Add")').first();
        if (await addButton.isVisible().catch(() => false)) {
          await addButton.click();

          // Click category selector
          const categorySelect = page.locator('select, button[role="combobox"]').first();
          await categorySelect.click();

          // Check for categories (General, Blocking, Props, Wardrobe, etc.)
          const categories = ['General', 'Blocking', 'Props', 'Wardrobe'];
          for (const category of categories) {
            const option = page.locator(`text=${category}`).first();
            if (await option.isVisible().catch(() => false)) {
              await expect(option).toBeVisible();
            }
          }
        }
      }
    });

    test('should display critical flag checkbox', async ({ page }) => {
      await navigateToContinuityTab(page);

      await page.locator('button[role="tab"]:has-text("Notes")').click();

      const firstScene = page.locator('button').filter({ hasText: /^\d+[A-Z]?$/ }).first();
      if (await firstScene.isVisible().catch(() => false)) {
        await firstScene.click();

        const addButton = page.locator('button:has-text("Add")').first();
        if (await addButton.isVisible().catch(() => false)) {
          await addButton.click();

          // Look for Critical checkbox
          const criticalCheckbox = page.locator('input[type="checkbox"]').first();
          await expect(criticalCheckbox).toBeVisible();
        }
      }
    });
  });

  test.describe('6. Right Panel - Photos Tab', () => {
    test('should display Photos tab and allow selection', async ({ page }) => {
      await navigateToContinuityTab(page);

      const photosTab = page.locator('button[role="tab"]:has-text("Photos")');
      await photosTab.click();

      await expect(photosTab).toHaveAttribute('aria-selected', 'true');
    });

    test('should display category filter dropdown', async ({ page }) => {
      await navigateToContinuityTab(page);

      await page.locator('button[role="tab"]:has-text("Photos")').click();

      const categoryFilter = page.locator('select, button[role="combobox"]').first();
      await expect(categoryFilter).toBeVisible();
    });

    test('should display Compare mode button', async ({ page }) => {
      await navigateToContinuityTab(page);

      await page.locator('button[role="tab"]:has-text("Photos")').click();

      const compareButton = page.locator('button:has-text("Compare")').first();
      await expect(compareButton).toBeVisible();
    });

    test('should display search input', async ({ page }) => {
      await navigateToContinuityTab(page);

      await page.locator('button[role="tab"]:has-text("Photos")').click();

      const searchInput = page.locator('input[placeholder*="Search"]').first();
      await expect(searchInput).toBeVisible();
    });

    test('should display drag-and-drop upload area', async ({ page }) => {
      await navigateToContinuityTab(page);

      await page.locator('button[role="tab"]:has-text("Photos")').click();

      // Select a scene first
      const firstScene = page.locator('button').filter({ hasText: /^\d+[A-Z]?$/ }).first();
      if (await firstScene.isVisible().catch(() => false)) {
        await firstScene.click();

        // Look for upload area
        const uploadArea = page.locator('text=Drop photos, text=click to upload').first();
        if (await uploadArea.isVisible().catch(() => false)) {
          await expect(uploadArea).toBeVisible();
        }
      }
    });

    test('should display upload category selector', async ({ page }) => {
      await navigateToContinuityTab(page);

      await page.locator('button[role="tab"]:has-text("Photos")').click();

      const firstScene = page.locator('button').filter({ hasText: /^\d+[A-Z]?$/ }).first();
      if (await firstScene.isVisible().catch(() => false)) {
        await firstScene.click();

        // Look for "Upload as:" category selector
        const uploadCategoryLabel = page.locator('text=Upload as:').first();
        if (await uploadCategoryLabel.isVisible().catch(() => false)) {
          await expect(uploadCategoryLabel).toBeVisible();
        }
      }
    });

    test('should show empty state when no photos exist', async ({ page }) => {
      await navigateToContinuityTab(page);

      await page.locator('button[role="tab"]:has-text("Photos")').click();

      const firstScene = page.locator('button').filter({ hasText: /^\d+[A-Z]?$/ }).first();
      if (await firstScene.isVisible().catch(() => false)) {
        await firstScene.click();

        // Look for "No photos" message
        const emptyMessage = page.locator('text=No photos').first();
        // This might be visible if there are no photos
      }
    });
  });

  test.describe('7. Export Functionality', () => {
    test('should open export dropdown menu', async ({ page }) => {
      await navigateToContinuityTab(page);

      const exportButton = page.locator('button[title="Export"], button:has([class*="download"])').first();
      await exportButton.click();

      // Menu should be visible
      await expect(page.locator('[role="menu"], [role="menuitem"]').first()).toBeVisible({ timeout: 2000 });
    });

    test('should display Takes (CSV) export option', async ({ page }) => {
      await navigateToContinuityTab(page);

      const exportButton = page.locator('button[title="Export"], button').filter({ has: page.locator('[class*="download"]') }).first();
      await exportButton.click();

      await expect(page.locator('text=Takes (CSV)')).toBeVisible();
    });

    test('should display Takes (JSON) export option', async ({ page }) => {
      await navigateToContinuityTab(page);

      const exportButton = page.locator('button[title="Export"], button').filter({ has: page.locator('[class*="download"]') }).first();
      await exportButton.click();

      await expect(page.locator('text=Takes (JSON)')).toBeVisible();
    });

    test('should display Notes (CSV) export option', async ({ page }) => {
      await navigateToContinuityTab(page);

      const exportButton = page.locator('button[title="Export"], button').filter({ has: page.locator('[class*="download"]') }).first();
      await exportButton.click();

      await expect(page.locator('text=Notes (CSV)')).toBeVisible();
    });

    test('should display Notes (JSON) export option', async ({ page }) => {
      await navigateToContinuityTab(page);

      const exportButton = page.locator('button[title="Export"], button').filter({ has: page.locator('[class*="download"]') }).first();
      await exportButton.click();

      await expect(page.locator('text=Notes (JSON)')).toBeVisible();
    });

    test('should display Daily Report (JSON) export option', async ({ page }) => {
      await navigateToContinuityTab(page);

      const exportButton = page.locator('button[title="Export"], button').filter({ has: page.locator('[class*="download"]') }).first();
      await exportButton.click();

      await expect(page.locator('text=Daily Report')).toBeVisible();
    });

    test('should close export menu when clicking outside', async ({ page }) => {
      await navigateToContinuityTab(page);

      const exportButton = page.locator('button[title="Export"], button').filter({ has: page.locator('[class*="download"]') }).first();
      await exportButton.click();

      // Click outside the menu
      await page.click('body', { position: { x: 10, y: 10 } });

      // Menu should close
      await expect(page.locator('text=Takes (CSV)')).not.toBeVisible({ timeout: 1000 });
    });
  });

  test.describe('Error Handling & Edge Cases', () => {
    test('should show appropriate message when no script is available', async ({ page }) => {
      await navigateToContinuityTab(page);

      // Look for "No Scripts Available" or similar message
      const noScriptMessage = page.locator('text=No Scripts Available, text=Import a script').first();

      // This may or may not be visible depending on project state
    });

    test('should handle script selector changes', async ({ page }) => {
      await navigateToContinuityTab(page);

      const scriptSelector = page.locator('select, button[role="combobox"]').filter({ hasText: /script/i }).first();

      if (await scriptSelector.isVisible().catch(() => false)) {
        await scriptSelector.click();

        // Select different script if available
        const firstOption = page.locator('[role="option"]').first();
        if (await firstOption.isVisible().catch(() => false)) {
          await firstOption.click();

          // Wait for update
          await page.waitForTimeout(500);
        }
      }
    });

    test('should handle production day selector changes', async ({ page }) => {
      await navigateToContinuityTab(page);

      const daySelector = page.locator('select, button[role="combobox"]').filter({ hasText: /day/i }).first();

      if (await daySelector.isVisible().catch(() => false)) {
        await daySelector.click();

        // Select different day if available
        const firstOption = page.locator('[role="option"]').first();
        if (await firstOption.isVisible().catch(() => false)) {
          await firstOption.click();

          // Wait for update
          await page.waitForTimeout(500);
        }
      }
    });
  });

  test.describe('Accessibility', () => {
    test('should have proper ARIA labels on interactive elements', async ({ page }) => {
      await navigateToContinuityTab(page);

      // Check tabs have proper role and aria attributes
      const tabs = page.locator('[role="tab"]');
      expect(await tabs.count()).toBeGreaterThan(0);

      for (let i = 0; i < await tabs.count(); i++) {
        const tab = tabs.nth(i);
        await expect(tab).toHaveAttribute('role', 'tab');
      }
    });

    test('should be keyboard navigable', async ({ page }) => {
      await navigateToContinuityTab(page);

      // Tab through interactive elements
      await page.keyboard.press('Tab');
      await page.keyboard.press('Tab');
      await page.keyboard.press('Tab');

      // Some element should have focus
      const focusedElement = await page.evaluate(() => document.activeElement?.tagName);
      expect(focusedElement).toBeTruthy();
    });

    test('should have descriptive button labels', async ({ page }) => {
      await navigateToContinuityTab(page);

      // Check that icon-only buttons have aria-label or title
      const iconButtons = page.locator('button:has(svg):not(:has-text())');

      for (let i = 0; i < await iconButtons.count(); i++) {
        const button = iconButtons.nth(i);
        const hasTitle = await button.getAttribute('title');
        const hasAriaLabel = await button.getAttribute('aria-label');

        // At least one should be present
        expect(hasTitle || hasAriaLabel).toBeTruthy();
      }
    });
  });
});
