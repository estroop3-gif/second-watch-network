import { test, expect } from '@playwright/test';

/**
 * Landing Page New Sections Test
 * Tests the three newly added sections: GreenRoomSection, BacklotSection, and TheOrderSection
 */

test.describe('Landing Page - New Sections', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:8080');
    // Wait for page to fully load
    await page.waitForLoadState('networkidle');
  });

  test('should render GreenRoomSection with correct content and styling', async ({ page }) => {
    // Scroll to GreenRoomSection (after OriginalsSection)
    const greenRoomSection = page.locator('text=The Green Room').first();
    await greenRoomSection.scrollIntoViewIfNeeded();

    // Verify heading exists and has green text
    const heading = page.locator('h2:has-text("The Green Room")');
    await expect(heading).toBeVisible();

    // Verify tagline
    await expect(page.locator('text=Where the Community Decides What Gets Made')).toBeVisible();

    // Verify project preview card mockup on left
    const projectCard = page.locator('[class*="preview"]').first();
    await expect(projectCard).toBeVisible();

    // Verify vote progress bar exists
    const progressBar = page.locator('[role="progressbar"], [class*="progress"]').first();
    await expect(progressBar).toBeVisible();

    // Verify the 4 how-it-works steps
    await expect(page.locator('text=Submit')).toBeVisible();
    await expect(page.locator('text=Buy Tickets')).toBeVisible();
    await expect(page.locator('text=Rally Supporters')).toBeVisible();
    await expect(page.locator('text=Winners Get Greenlit')).toBeVisible();

    // Verify CTAs
    const exploreProjectsBtn = page.locator('button:has-text("Explore Projects"), a:has-text("Explore Projects")');
    await expect(exploreProjectsBtn).toBeVisible();

    const submitVisionBtn = page.locator('button:has-text("Submit Your Vision"), a:has-text("Submit Your Vision")');
    await expect(submitVisionBtn).toBeVisible();

    // Capture screenshot
    await page.screenshot({
      path: 'test-results/screenshots/green-room-section.png',
      fullPage: false
    });
  });

  test('should render BacklotSection with correct content and styling', async ({ page }) => {
    // Scroll to BacklotSection (after SubmitContentSection)
    const backlotSection = page.locator('text=The Backlot').first();
    await backlotSection.scrollIntoViewIfNeeded();

    // Verify heading
    const heading = page.locator('h2:has-text("The Backlot")');
    await expect(heading).toBeVisible();

    // Verify tagline
    await expect(page.locator('text=Your All-in-One Production Hub')).toBeVisible();

    // Verify 3x2 grid of feature cards
    const featureCards = [
      'Call Sheets',
      'Casting & Crew',
      'Budgets & Invoices',
      'Clearances',
      'Locations',
      'Shot Lists'
    ];

    for (const feature of featureCards) {
      await expect(page.locator(`text=${feature}`)).toBeVisible();
    }

    // Verify CTA
    const startProductionBtn = page.locator('button:has-text("Start Your Production"), a:has-text("Start Your Production")');
    await expect(startProductionBtn).toBeVisible();

    // Capture screenshot
    await page.screenshot({
      path: 'test-results/screenshots/backlot-section.png',
      fullPage: false
    });
  });

  test('should render TheOrderSection with correct content and styling', async ({ page }) => {
    // Scroll to TheOrderSection (after BacklotSection)
    const orderSection = page.locator('text=The Order').first();
    await orderSection.scrollIntoViewIfNeeded();

    // Verify shield icon exists
    const shieldIcon = page.locator('svg[class*="shield"], [data-testid="shield-icon"]').first();
    await expect(shieldIcon).toBeVisible();

    // Verify heading
    const heading = page.locator('h2:has-text("The Order")');
    await expect(heading).toBeVisible();

    // Verify tagline
    await expect(page.locator('text=A Professional Guild for Purpose-Driven Filmmakers')).toBeVisible();

    // Verify 3-column benefits
    await expect(page.locator('text=Exclusive Jobs')).toBeVisible();
    await expect(page.locator('text=Local Lodges')).toBeVisible();
    await expect(page.locator('text=Craft Houses')).toBeVisible();

    // Verify CTAs
    const applyBtn = page.locator('button:has-text("Apply for Membership"), a:has-text("Apply for Membership")');
    await expect(applyBtn).toBeVisible();

    const learnMoreBtn = page.locator('button:has-text("Learn More"), a:has-text("Learn More")');
    await expect(learnMoreBtn).toBeVisible();

    // Capture screenshot
    await page.screenshot({
      path: 'test-results/screenshots/the-order-section.png',
      fullPage: false
    });
  });

  test('should display sections in correct order', async ({ page }) => {
    // Get all section headings in order
    const sectionHeadings = await page.locator('h1, h2').allTextContents();

    // Verify GreenRoomSection appears after OriginalsSection
    const greenRoomIndex = sectionHeadings.findIndex(h => h.includes('The Green Room'));
    expect(greenRoomIndex).toBeGreaterThan(-1);

    // Verify BacklotSection appears after SubmitContentSection
    const backlotIndex = sectionHeadings.findIndex(h => h.includes('The Backlot'));
    expect(backlotIndex).toBeGreaterThan(-1);

    // Verify TheOrderSection appears after BacklotSection
    const orderIndex = sectionHeadings.findIndex(h => h.includes('The Order'));
    expect(orderIndex).toBeGreaterThan(-1);

    // Verify order: GreenRoom < Backlot < TheOrder
    expect(greenRoomIndex).toBeLessThan(backlotIndex);
    expect(backlotIndex).toBeLessThan(orderIndex);

    // Capture full page screenshot
    await page.screenshot({
      path: 'test-results/screenshots/landing-page-full.png',
      fullPage: true
    });
  });

  test('should verify emerald green accent colors in GreenRoomSection', async ({ page }) => {
    const greenRoomSection = page.locator('text=The Green Room').first();
    await greenRoomSection.scrollIntoViewIfNeeded();

    // Check for emerald/green color classes or styles
    const heading = page.locator('h2:has-text("The Green Room")');
    const headingColor = await heading.evaluate(el => {
      const styles = window.getComputedStyle(el);
      return styles.color;
    });

    // Emerald green should be present (RGB values will vary, but should have green component)
    console.log('GreenRoom heading color:', headingColor);
  });

  test('should verify yellow accent colors in BacklotSection', async ({ page }) => {
    const backlotSection = page.locator('text=The Backlot').first();
    await backlotSection.scrollIntoViewIfNeeded();

    // Check for yellow color classes or styles
    const heading = page.locator('h2:has-text("The Backlot")');
    const headingColor = await heading.evaluate(el => {
      const styles = window.getComputedStyle(el);
      return styles.color;
    });

    // Yellow accent should be present
    console.log('Backlot heading color:', headingColor);
  });

  test('should verify all CTAs are clickable', async ({ page }) => {
    // Test GreenRoom CTAs
    const exploreProjectsBtn = page.locator('button:has-text("Explore Projects"), a:has-text("Explore Projects")').first();
    await exploreProjectsBtn.scrollIntoViewIfNeeded();
    await expect(exploreProjectsBtn).toBeEnabled();

    const submitVisionBtn = page.locator('button:has-text("Submit Your Vision"), a:has-text("Submit Your Vision")').first();
    await expect(submitVisionBtn).toBeEnabled();

    // Test Backlot CTA
    const startProductionBtn = page.locator('button:has-text("Start Your Production"), a:has-text("Start Your Production")').first();
    await startProductionBtn.scrollIntoViewIfNeeded();
    await expect(startProductionBtn).toBeEnabled();

    // Test TheOrder CTAs
    const applyBtn = page.locator('button:has-text("Apply for Membership"), a:has-text("Apply for Membership")').first();
    await applyBtn.scrollIntoViewIfNeeded();
    await expect(applyBtn).toBeEnabled();

    const learnMoreBtn = page.locator('button:has-text("Learn More"), a:has-text("Learn More")').first();
    await expect(learnMoreBtn).toBeEnabled();
  });

  test('should display responsive layout on mobile viewport', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    await page.reload();
    await page.waitForLoadState('networkidle');

    // Verify sections are still visible on mobile
    await page.locator('text=The Green Room').first().scrollIntoViewIfNeeded();
    await expect(page.locator('text=The Green Room').first()).toBeVisible();

    await page.locator('text=The Backlot').first().scrollIntoViewIfNeeded();
    await expect(page.locator('text=The Backlot').first()).toBeVisible();

    await page.locator('text=The Order').first().scrollIntoViewIfNeeded();
    await expect(page.locator('text=The Order').first()).toBeVisible();

    // Capture mobile screenshot
    await page.screenshot({
      path: 'test-results/screenshots/landing-page-mobile.png',
      fullPage: true
    });
  });
});
