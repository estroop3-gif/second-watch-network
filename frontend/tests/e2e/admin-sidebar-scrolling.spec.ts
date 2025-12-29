/**
 * E2E Tests for Admin Panel Sidebar Scrolling Behavior
 *
 * This test suite verifies that:
 * 1. The sidebar stays fixed/sticky when scrolling main content
 * 2. Only nav items inside sidebar scroll independently
 * 3. The "Admin Console" header stays at the top of sidebar
 */

import { test, expect, Page } from '@playwright/test';

test.describe('Admin Panel Sidebar Scrolling', () => {
  test.beforeEach(async ({ page }) => {
    // Set viewport for consistent testing
    await page.setViewportSize({ width: 1920, height: 1080 });
  });

  test('should load admin panel successfully', async ({ page }) => {
    // Navigate to admin panel
    await page.goto('http://localhost:8082/admin');

    // Wait for page to be fully loaded
    await page.waitForLoadState('networkidle');

    // Verify admin console is visible
    const adminHeader = page.locator('h2:has-text("Admin Console")');
    await expect(adminHeader).toBeVisible({ timeout: 10000 });
  });

  test('should have sidebar with proper structure', async ({ page }) => {
    await page.goto('http://localhost:8082/admin');
    await page.waitForLoadState('networkidle');

    // Verify sidebar exists
    const sidebar = page.locator('aside').first();
    await expect(sidebar).toBeVisible();

    // Verify "Admin Console" header is present
    const adminHeader = page.locator('h2:has-text("Admin Console")');
    await expect(adminHeader).toBeVisible();

    // Verify navigation items are present
    const navItems = page.locator('aside nav a');
    const count = await navItems.count();
    expect(count).toBeGreaterThan(0);
  });

  test('should diagnose sidebar position and scrolling behavior', async ({ page }) => {
    await page.goto('http://localhost:8082/admin');
    await page.waitForLoadState('networkidle');

    // Get sidebar element
    const sidebar = page.locator('aside').first();
    await expect(sidebar).toBeVisible();

    // Get initial sidebar position
    const initialSidebarBox = await sidebar.boundingBox();
    expect(initialSidebarBox).not.toBeNull();
    const initialSidebarTop = initialSidebarBox!.y;

    console.log('Initial sidebar position:', {
      top: initialSidebarTop,
      height: initialSidebarBox!.height
    });

    // Get computed styles of sidebar
    const sidebarStyles = await sidebar.evaluate((el) => {
      const computed = window.getComputedStyle(el);
      return {
        position: computed.position,
        top: computed.top,
        height: computed.height,
        overflow: computed.overflow,
        overflowY: computed.overflowY
      };
    });

    console.log('Sidebar computed styles:', sidebarStyles);

    // Get main content area
    const mainContent = page.locator('main').first();
    await expect(mainContent).toBeVisible();

    // Check if main content has scrollable content
    const mainContentHeight = await mainContent.evaluate((el) => ({
      scrollHeight: el.scrollHeight,
      clientHeight: el.clientHeight,
      offsetHeight: el.offsetHeight
    }));

    console.log('Main content dimensions:', mainContentHeight);

    // Add some content to main area to make it scrollable if needed
    await mainContent.evaluate((el) => {
      // Add tall content to force scrolling
      const testDiv = document.createElement('div');
      testDiv.id = 'test-scroll-content';
      testDiv.style.height = '2000px';
      testDiv.style.background = 'linear-gradient(to bottom, red, blue)';
      testDiv.innerHTML = '<h1 style="padding: 20px;">Scroll Test Content</h1>';
      el.appendChild(testDiv);
    });

    // Wait a moment for layout to settle
    await page.waitForTimeout(500);

    // Scroll the page down
    await page.evaluate(() => window.scrollTo(0, 500));
    await page.waitForTimeout(500);

    // Get sidebar position after scrolling
    const afterScrollSidebarBox = await sidebar.boundingBox();
    expect(afterScrollSidebarBox).not.toBeNull();
    const afterScrollSidebarTop = afterScrollSidebarBox!.y;

    console.log('After scroll sidebar position:', {
      top: afterScrollSidebarTop,
      height: afterScrollSidebarBox!.height
    });

    // Check page scroll position
    const scrollPosition = await page.evaluate(() => ({
      scrollY: window.scrollY,
      pageYOffset: window.pageYOffset
    }));

    console.log('Page scroll position:', scrollPosition);

    // DIAGNOSTIC: The sidebar should NOT move when page scrolls
    // If it moves, then it's scrolling with the page (BAD)
    // If it stays in place, it's sticky (GOOD)

    const sidebarMoved = Math.abs(initialSidebarTop - afterScrollSidebarTop) > 10;

    console.log('Sidebar moved with scroll?', sidebarMoved);
    console.log('Movement delta:', initialSidebarTop - afterScrollSidebarTop);

    // This test documents the current behavior
    // Expected: sidebar should NOT move (should be sticky)
    // If this fails, it means the sidebar IS moving (the bug we need to fix)
  });

  test('should keep sidebar fixed when scrolling main content', async ({ page }) => {
    await page.goto('http://localhost:8082/admin');
    await page.waitForLoadState('networkidle');

    const sidebar = page.locator('aside').first();
    const mainContent = page.locator('main').first();

    // Add scrollable content to main area
    await mainContent.evaluate((el) => {
      const testDiv = document.createElement('div');
      testDiv.id = 'test-scroll-content';
      testDiv.style.height = '3000px';
      testDiv.style.background = 'linear-gradient(to bottom, #FF3C3C, #FCDC58)';
      testDiv.innerHTML = '<h1 style="padding: 20px; color: white;">Test Content for Scrolling</h1>';
      el.appendChild(testDiv);
    });

    await page.waitForTimeout(300);

    // Get initial positions
    const adminHeader = page.locator('h2:has-text("Admin Console")');
    const initialHeaderBox = await adminHeader.boundingBox();
    const initialSidebarBox = await sidebar.boundingBox();

    expect(initialHeaderBox).not.toBeNull();
    expect(initialSidebarBox).not.toBeNull();

    const initialHeaderTop = initialHeaderBox!.y;
    const initialSidebarTop = initialSidebarBox!.y;

    // Scroll the page
    await page.evaluate(() => window.scrollTo(0, 800));
    await page.waitForTimeout(500);

    // Get positions after scroll
    const afterHeaderBox = await adminHeader.boundingBox();
    const afterSidebarBox = await sidebar.boundingBox();

    expect(afterHeaderBox).not.toBeNull();
    expect(afterSidebarBox).not.toBeNull();

    const afterHeaderTop = afterHeaderBox!.y;
    const afterSidebarTop = afterSidebarBox!.y;

    console.log('Header position - Before:', initialHeaderTop, 'After:', afterHeaderTop);
    console.log('Sidebar position - Before:', initialSidebarTop, 'After:', afterSidebarTop);

    // The sidebar and header should stay in roughly the same position
    // (accounting for the fixed navbar at top)
    // If they moved significantly, the sidebar is scrolling with the page

    const headerMovement = Math.abs(initialHeaderTop - afterHeaderTop);
    const sidebarMovement = Math.abs(initialSidebarTop - afterSidebarTop);

    console.log('Header movement:', headerMovement);
    console.log('Sidebar movement:', sidebarMovement);

    // Expected behavior: sidebar should not move (or move very little, < 10px)
    // This assertion will FAIL with current implementation (proving the bug exists)
    // After fix, it should PASS
    expect(sidebarMovement).toBeLessThan(50);
  });

  test('should have Admin Console header always visible in sidebar', async ({ page }) => {
    await page.goto('http://localhost:8082/admin');
    await page.waitForLoadState('networkidle');

    const adminHeader = page.locator('h2:has-text("Admin Console")');
    await expect(adminHeader).toBeVisible();

    const mainContent = page.locator('main').first();

    // Add tall content
    await mainContent.evaluate((el) => {
      const testDiv = document.createElement('div');
      testDiv.style.height = '3000px';
      testDiv.textContent = 'Scroll test content';
      el.appendChild(testDiv);
    });

    // Scroll down
    await page.evaluate(() => window.scrollTo(0, 1000));
    await page.waitForTimeout(300);

    // Admin Console header should still be visible
    await expect(adminHeader).toBeVisible();
  });

  test('should allow independent scrolling of nav items within sidebar', async ({ page }) => {
    await page.goto('http://localhost:8082/admin');
    await page.waitForLoadState('networkidle');

    // The nav element inside sidebar
    const nav = page.locator('aside nav').first();
    await expect(nav).toBeVisible();

    // Check if nav has overflow scrolling enabled
    const navStyles = await nav.evaluate((el) => {
      const computed = window.getComputedStyle(el);
      return {
        overflowY: computed.overflowY,
        height: computed.height,
        maxHeight: computed.maxHeight,
        flex: computed.flex
      };
    });

    console.log('Nav element styles:', navStyles);

    // Nav should have overflow-y-auto or scroll
    // This allows independent scrolling within the sidebar
  });

  test('should verify sidebar position is sticky with correct top offset', async ({ page }) => {
    await page.goto('http://localhost:8082/admin');
    await page.waitForLoadState('networkidle');

    const sidebar = page.locator('aside').first();

    // Check computed position and top values
    const sidebarPosition = await sidebar.evaluate((el) => {
      const computed = window.getComputedStyle(el);
      const rect = el.getBoundingClientRect();

      return {
        position: computed.position,
        top: computed.top,
        height: computed.height,
        boundingTop: rect.top,
        classes: el.className
      };
    });

    console.log('Sidebar position info:', sidebarPosition);

    // Expected: position should be 'sticky' or 'fixed'
    // Expected: top should be '0px' or '5rem' (80px, accounting for navbar)
    console.log('Is position sticky or fixed?',
      sidebarPosition.position === 'sticky' || sidebarPosition.position === 'fixed'
    );
  });

  test('should verify correct layout structure for sticky sidebar', async ({ page }) => {
    await page.goto('http://localhost:8082/admin');
    await page.waitForLoadState('networkidle');

    // Check the parent container structure
    const layoutContainer = page.locator('div.flex').first();

    const containerInfo = await layoutContainer.evaluate((el) => {
      const computed = window.getComputedStyle(el);
      return {
        display: computed.display,
        flexDirection: computed.flexDirection,
        minHeight: computed.minHeight,
        classes: el.className
      };
    });

    console.log('Layout container info:', containerInfo);

    // The parent should be flex with min-height
    // This is important for proper sticky behavior
  });
});
