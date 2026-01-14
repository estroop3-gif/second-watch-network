const { chromium } = require('playwright');
const path = require('path');

(async () => {
  console.log('Opening browser - please log in and navigate to Scripts > Scenes tab');
  console.log('You have 90 seconds...\n');

  const userDataDir = path.join(__dirname, '.playwright-session');
  const context = await chromium.launchPersistentContext(userDataDir, {
    headless: false,
    viewport: { width: 1600, height: 1000 }
  });

  const page = context.pages()[0] || await context.newPage();
  await page.goto('http://localhost:8080');

  // Wait for login
  for (let i = 90; i > 0; i -= 15) {
    console.log(`${i} seconds...`);
    await page.waitForTimeout(15000);
  }

  console.log('\n=== ANALYZING SCENES ===\n');

  // Get all scene elements from the page
  const sceneData = await page.evaluate(() => {
    const scenes = [];

    // Look for scene rows/cards in various possible selectors
    const selectors = [
      '[data-scene]',
      '.scene-row',
      '.scene-item',
      'tr[data-scene-id]',
      '[class*="scene"]',
      'table tbody tr',
    ];

    for (const selector of selectors) {
      const elements = document.querySelectorAll(selector);
      if (elements.length > 0) {
        console.log(`Found ${elements.length} elements with selector: ${selector}`);
      }
    }

    // Get all table rows that might be scenes
    document.querySelectorAll('table tbody tr').forEach((row, idx) => {
      const cells = row.querySelectorAll('td');
      if (cells.length >= 2) {
        const text = Array.from(cells).map(c => c.innerText.trim().substring(0, 50)).join(' | ');
        scenes.push({
          index: idx,
          text: text,
          rowId: row.getAttribute('data-scene-id') || row.id || 'unknown'
        });
      }
    });

    // Also check for any cards/divs that might contain scene info
    document.querySelectorAll('[class*="scene"]').forEach((el, idx) => {
      if (el.tagName !== 'TR' && el.tagName !== 'TD') {
        const text = el.innerText.substring(0, 100).replace(/\n/g, ' | ');
        if (text.includes('INT.') || text.includes('EXT.')) {
          scenes.push({
            index: idx,
            text: text,
            type: 'card'
          });
        }
      }
    });

    return scenes;
  });

  console.log(`Found ${sceneData.length} scene elements:\n`);

  // Group by scene text to find duplicates
  const byText = {};
  sceneData.forEach(scene => {
    // Extract scene heading from text
    const match = scene.text.match(/(INT\.|EXT\.).{0,60}/i);
    const key = match ? match[0].toUpperCase() : scene.text.substring(0, 40);
    if (!byText[key]) byText[key] = [];
    byText[key].push(scene);
  });

  // Show duplicates
  let dupeCount = 0;
  Object.entries(byText).forEach(([key, scenes]) => {
    if (scenes.length > 1) {
      dupeCount++;
      console.log(`\n⚠️  DUPLICATE (${scenes.length}x): ${key}`);
      scenes.forEach((s, i) => {
        console.log(`   [${i}] ${s.text.substring(0, 60)}...`);
      });
    }
  });

  if (dupeCount === 0) {
    console.log('No duplicates found in UI');
  } else {
    console.log(`\n${dupeCount} duplicate scene groups found`);
  }

  // Take screenshot
  await page.screenshot({ path: 'SCENES-DEBUG.png', fullPage: true });
  console.log('\nSaved SCENES-DEBUG.png');

  // Check database directly via API if possible
  const currentUrl = page.url();
  console.log('\nCurrent URL:', currentUrl);

  console.log('\nBrowser staying open for 60 seconds...');
  await page.waitForTimeout(60000);

  await context.close();
})();
