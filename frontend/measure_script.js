const { chromium } = require('playwright');
const fs = require('fs');

(async () => {
  // Load auth data
  const authData = JSON.parse(fs.readFileSync('./playwright/.auth/user.json', 'utf-8'));
  
  const browser = await chromium.launch({ headless: false });
  const context = await browser.createContext({
    storageState: authData
  });
  
  const page = await context.newPage();
  
  // Set viewport
  await page.setViewportSize({ width: 1920, height: 1080 });
  
  try {
    console.log('Navigating to backlot...');
    await page.goto('http://localhost:8080/backlot', { waitUntil: 'networkidle' });
    
    console.log('Waiting for projects to load...');
    await page.waitForSelector('[data-testid="project-card"], a[href*="/backlot/project"]', { timeout: 5000 });
    
    // Find EIDCOM project
    console.log('Looking for EIDCOM project...');
    const projectLinks = await page.locator('a[href*="/backlot/project"]').all();
    
    let eidcomFound = false;
    for (let link of projectLinks) {
      const text = await link.textContent();
      if (text && text.includes('EIDCOM')) {
        console.log('Found EIDCOM project, clicking...');
        await link.click();
        eidcomFound = true;
        break;
      }
    }
    
    if (!eidcomFound) {
      // Try alternative selector
      console.log('Trying alternative selector for EIDCOM...');
      const cards = await page.locator('[data-testid="project-card"]').all();
      for (let card of cards) {
        const text = await card.textContent();
        if (text && text.includes('EIDCOM')) {
          await card.click();
          eidcomFound = true;
          break;
        }
      }
    }
    
    if (!eidcomFound) {
      throw new Error('EIDCOM project not found');
    }
    
    console.log('Waiting for project page to load...');
    await page.waitForLoadState('networkidle');
    
    // Click on Script tab
    console.log('Looking for Script tab...');
    const scriptTab = await page.locator('[role="tab"]', { hasText: /Script/ }).first();
    if (await scriptTab.isVisible()) {
      await scriptTab.click();
      console.log('Script tab clicked');
      await page.waitForLoadState('networkidle');
    } else {
      console.log('Script tab not found as role=tab, searching by text...');
      const scriptLink = page.locator('text=Script').first();
      if (await scriptLink.isVisible()) {
        await scriptLink.click();
        await page.waitForLoadState('networkidle');
      }
    }
    
    // Wait a bit for content to load
    await page.waitForTimeout(2000);
    
    // Take screenshot
    console.log('Taking screenshot...');
    await page.screenshot({ path: './script_page.png', fullPage: false });
    
    // Measure page dimensions
    console.log('Measuring dimensions...');
    
    const measurements = await page.evaluate(() => {
      const measurements = {};
      
      // Look for script text viewer or page container
      const viewers = document.querySelectorAll('[class*="ScriptTextViewer"], [class*="script-viewer"], .prose, [role="document"], main');
      
      let pageContainer = null;
      
      // Find the main page content
      for (let viewer of viewers) {
        const rect = viewer.getBoundingClientRect();
        if (rect.height > 300 && rect.width > 300) {
          pageContainer = viewer;
          break;
        }
      }
      
      // Look for individual page divs
      if (!pageContainer) {
        pageContainer = document.querySelector('main') || document.querySelector('[role="main"]');
      }
      
      if (pageContainer) {
        const rect = pageContainer.getBoundingClientRect();
        measurements.containerHeight = rect.height;
        measurements.containerWidth = rect.width;
        measurements.containerTop = rect.top;
        measurements.containerLeft = rect.left;
        
        // Count lines of text
        const text = pageContainer.textContent || '';
        const lines = text.split('\n');
        measurements.totalTextLines = lines.length;
        
        // Find the actual page element (usually white background)
        const pages = pageContainer.querySelectorAll('[class*="page"], .bg-white, [style*="white"]');
        if (pages.length > 0) {
          const firstPage = pages[0];
          const pageRect = firstPage.getBoundingClientRect();
          measurements.pageHeight = pageRect.height;
          measurements.pageWidth = pageRect.width;
          
          // Count visible lines on first page
          const pageText = firstPage.textContent || '';
          const pageLines = pageText.split('\n').filter(l => l.trim());
          measurements.visibleLines = pageLines.length;
        }
      }
      
      // Also try to find by looking for large text containers
      const allDivs = document.querySelectorAll('div');
      let largestContainer = null;
      let maxArea = 0;
      
      for (let div of allDivs) {
        const rect = div.getBoundingClientRect();
        const area = rect.width * rect.height;
        if (area > maxArea && area > 100000 && rect.height > 400) {
          maxArea = area;
          largestContainer = div;
        }
      }
      
      if (largestContainer && !measurements.containerHeight) {
        const rect = largestContainer.getBoundingClientRect();
        measurements.largestContainerHeight = rect.height;
        measurements.largestContainerWidth = rect.width;
      }
      
      return measurements;
    });
    
    console.log('\n=== MEASUREMENTS ===');
    console.log(JSON.stringify(measurements, null, 2));
    
    // Get more detailed info about visible content
    const detailedInfo = await page.evaluate(() => {
      const info = {};
      
      // Look for text content
      const textElements = document.querySelectorAll('p, span, div');
      let totalVisibleText = 0;
      
      for (let el of textElements) {
        if (el.offsetHeight > 0 && el.offsetWidth > 0) {
          totalVisibleText += (el.textContent || '').length;
        }
      }
      
      info.totalVisibleCharacters = totalVisibleText;
      
      // Try to find line height
      const textEl = document.querySelector('p, span');
      if (textEl) {
        const style = window.getComputedStyle(textEl);
        info.lineHeight = style.lineHeight;
        info.fontSize = style.fontSize;
        info.fontFamily = style.fontFamily;
      }
      
      return info;
    });
    
    console.log('\n=== TEXT INFO ===');
    console.log(JSON.stringify(detailedInfo, null, 2));
    
    console.log('\nScreenshot saved to script_page.png');
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await context.close();
    await browser.close();
  }
})();
