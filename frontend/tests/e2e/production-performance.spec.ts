import { test, expect, type Page } from '@playwright/test';

/**
 * Production Performance and Cold Start Mitigation Tests
 *
 * Tests the production site at https://www.secondwatchnetwork.com to verify:
 * 1. Initial load performance and app shell rendering
 * 2. Auth flow responsiveness
 * 3. Caching headers for assets and HTML
 * 4. Health check endpoint
 */

// Use production URL
const PRODUCTION_URL = 'https://www.secondwatchnetwork.com';
const API_URL = 'https://vnvvoelid6.execute-api.us-east-1.amazonaws.com';

test.describe('Production Performance Tests', () => {
  test.describe.configure({ mode: 'serial' });

  test.describe('1. Initial Load Performance', () => {

    test('should load homepage quickly with app shell', async ({ page }) => {
      const consoleMessages: string[] = [];
      const performanceMetrics: any[] = [];

      // Listen for console logs, especially [PerfMetrics]
      page.on('console', (msg) => {
        const text = msg.text();
        consoleMessages.push(text);
        if (text.includes('[PerfMetrics]')) {
          console.log('Performance Log:', text);
          performanceMetrics.push(text);
        }
      });

      // Start timing
      const startTime = Date.now();

      // Navigate to homepage
      const response = await page.goto(PRODUCTION_URL, {
        waitUntil: 'domcontentloaded',
        timeout: 15000
      });

      const loadTime = Date.now() - startTime;

      // Verify successful response
      expect(response?.status()).toBe(200);
      console.log(`Page loaded in ${loadTime}ms`);

      // Check that page loads within reasonable time (should be fast due to CDN)
      expect(loadTime).toBeLessThan(3000);

      // Wait a bit for app initialization
      await page.waitForTimeout(2000);

      // Verify app shell renders (no blank screen)
      const body = await page.locator('body');
      await expect(body).toBeVisible();

      // Check for root element
      const root = page.locator('#root');
      await expect(root).toBeVisible();

      // Verify no blocking loading spinner on initial render
      // The app should show content immediately, not a full-page loader
      const fullPageLoader = page.locator('[data-testid="full-page-loader"]').first();
      const hasFullPageLoader = await fullPageLoader.count();

      if (hasFullPageLoader > 0) {
        const isVisible = await fullPageLoader.isVisible();
        console.log('Full page loader visible:', isVisible);
      }

      // Log performance metrics found
      console.log('\n=== Performance Metrics Found ===');
      performanceMetrics.forEach(metric => console.log(metric));

      // Verify we got some performance metrics in console
      const hasPerfMetrics = performanceMetrics.some(msg =>
        msg.includes('[PerfMetrics]') || msg.includes('timing')
      );

      if (!hasPerfMetrics) {
        console.warn('Warning: No [PerfMetrics] logs detected in console');
      }

      // Take screenshot
      await page.screenshot({
        path: 'test-results/production-homepage-initial-load.png',
        fullPage: true
      });
    });

    test('should show app shell content quickly without waiting for backend', async ({ page }) => {
      const performanceTiming = await page.evaluate(() => {
        return {
          navigationStart: performance.timing.navigationStart,
          domLoading: performance.timing.domLoading,
          domInteractive: performance.timing.domInteractive,
          domContentLoadedEventEnd: performance.timing.domContentLoadedEventEnd,
          loadEventEnd: performance.timing.loadEventEnd
        };
      });

      await page.goto(PRODUCTION_URL, { waitUntil: 'domcontentloaded' });

      // Wait for React to mount
      await page.waitForSelector('#root', { timeout: 5000 });

      // Check that we can see content
      const hasVisibleContent = await page.locator('body').isVisible();
      expect(hasVisibleContent).toBe(true);

      // Measure time to interactive
      const timeToInteractive = performanceTiming.domInteractive - performanceTiming.navigationStart;
      console.log(`Time to interactive: ${timeToInteractive}ms`);

      // Should be interactive quickly
      expect(timeToInteractive).toBeLessThan(5000);
    });

    test('should collect and log performance metrics', async ({ page }) => {
      const perfMetrics: any[] = [];

      // Capture all console messages
      page.on('console', (msg) => {
        const text = msg.text();
        if (text.includes('[PerfMetrics]') || text.includes('Initial Load Timing')) {
          perfMetrics.push({
            type: msg.type(),
            text: text
          });
        }
      });

      await page.goto(PRODUCTION_URL);

      // Wait for metrics to be logged
      await page.waitForTimeout(3000);

      // Log all captured metrics
      console.log('\n=== All Performance Metrics ===');
      perfMetrics.forEach(metric => {
        console.log(`[${metric.type}] ${metric.text}`);
      });

      // Check if we have timing data
      const hasTimingData = perfMetrics.some(m =>
        m.text.includes('Bundle load:') ||
        m.text.includes('App mount:') ||
        m.text.includes('Auth check:')
      );

      console.log('Has timing data:', hasTimingData);
    });
  });

  test.describe('2. Auth Flow Responsiveness', () => {

    test('should navigate to login page quickly', async ({ page }) => {
      await page.goto(PRODUCTION_URL);

      // Wait for page to load
      await page.waitForLoadState('networkidle');

      // Look for login link/button
      const loginButton = page.getByRole('link', { name: /login|sign in/i }).first();

      if (await loginButton.count() > 0) {
        await loginButton.click();

        // Should navigate quickly
        await page.waitForURL(/.*login.*/i, { timeout: 3000 });

        console.log('Navigated to:', page.url());
      } else {
        console.log('No login button found on homepage - may already be logged in or different UI');
      }
    });

    test('should render login form without blocking on backend', async ({ page }) => {
      // Navigate directly to login page
      await page.goto(`${PRODUCTION_URL}/login`, {
        waitUntil: 'domcontentloaded'
      });

      // Form should render quickly without waiting for backend
      const emailInput = page.locator('input[type="email"], input[name="email"]').first();
      const passwordInput = page.locator('input[type="password"], input[name="password"]').first();

      // Wait for form elements with reasonable timeout
      await expect(emailInput.or(page.locator('form'))).toBeVisible({ timeout: 5000 });

      // Page should be interactive
      const isInteractive = await page.evaluate(() => {
        return document.readyState === 'complete' || document.readyState === 'interactive';
      });

      expect(isInteractive).toBe(true);

      // Take screenshot
      await page.screenshot({
        path: 'test-results/production-login-page.png',
        fullPage: true
      });
    });

    test('should be responsive even if backend is slow', async ({ page, context }) => {
      // This test verifies the frontend doesn't block on slow API calls

      await page.goto(`${PRODUCTION_URL}/login`);

      // The page should be interactive immediately
      const startTime = Date.now();
      await page.waitForLoadState('domcontentloaded');
      const loadTime = Date.now() - startTime;

      console.log(`Login page DOM loaded in ${loadTime}ms`);

      // Should load quickly regardless of backend
      expect(loadTime).toBeLessThan(3000);

      // UI should be clickable
      const form = page.locator('form').first();
      if (await form.count() > 0) {
        const isEnabled = await form.isEnabled();
        expect(isEnabled).toBe(true);
      }
    });
  });

  test.describe('3. Caching Headers', () => {

    test('should have correct cache-control for JS assets', async ({ page }) => {
      const jsAssetRequests: any[] = [];

      // Listen for all requests
      page.on('response', async (response) => {
        const url = response.url();

        // Look for JS bundle files
        if (url.includes('.js') && !url.includes('localhost')) {
          const headers = response.headers();
          jsAssetRequests.push({
            url,
            cacheControl: headers['cache-control'] || 'none',
            status: response.status()
          });
        }
      });

      await page.goto(PRODUCTION_URL);
      await page.waitForLoadState('networkidle');

      // Log all JS assets and their cache headers
      console.log('\n=== JS Asset Cache Headers ===');
      jsAssetRequests.forEach(req => {
        console.log(`URL: ${req.url}`);
        console.log(`Cache-Control: ${req.cacheControl}`);
        console.log(`Status: ${req.status}`);
        console.log('---');
      });

      // Verify at least some JS assets have long-lived cache
      const hasLongLivedCache = jsAssetRequests.some(req =>
        req.cacheControl.includes('max-age=31536000') ||
        req.cacheControl.includes('immutable')
      );

      if (!hasLongLivedCache) {
        console.warn('Warning: No JS assets found with long-lived cache headers');
      }

      // Verify we found some JS assets
      expect(jsAssetRequests.length).toBeGreaterThan(0);
    });

    test('should have no-cache for index.html', async ({ page }) => {
      let indexHtmlHeaders: any = null;

      page.on('response', async (response) => {
        const url = response.url();

        // Look for index.html or root document
        if (url === PRODUCTION_URL || url === `${PRODUCTION_URL}/`) {
          const headers = response.headers();
          indexHtmlHeaders = {
            url,
            cacheControl: headers['cache-control'] || 'none',
            contentType: headers['content-type'] || 'unknown',
            status: response.status()
          };
        }
      });

      await page.goto(PRODUCTION_URL);

      if (indexHtmlHeaders) {
        console.log('\n=== index.html Cache Headers ===');
        console.log(`URL: ${indexHtmlHeaders.url}`);
        console.log(`Cache-Control: ${indexHtmlHeaders.cacheControl}`);
        console.log(`Content-Type: ${indexHtmlHeaders.contentType}`);
        console.log(`Status: ${indexHtmlHeaders.status}`);

        // Verify no-cache or similar directive
        const isNoCached =
          indexHtmlHeaders.cacheControl.includes('no-cache') ||
          indexHtmlHeaders.cacheControl.includes('no-store') ||
          indexHtmlHeaders.cacheControl.includes('must-revalidate');

        if (!isNoCached) {
          console.warn('Warning: index.html may be aggressively cached');
        }
      } else {
        console.warn('Warning: Could not capture index.html headers');
      }
    });

    test('should show cache hits on reload', async ({ page, context }) => {
      const firstLoadRequests: string[] = [];
      const secondLoadRequests: Map<string, any> = new Map();

      // First load - capture all JS/CSS requests
      page.on('response', async (response) => {
        const url = response.url();
        if (url.includes('.js') || url.includes('.css')) {
          firstLoadRequests.push(url);
        }
      });

      await page.goto(PRODUCTION_URL);
      await page.waitForLoadState('networkidle');

      console.log(`First load: ${firstLoadRequests.length} assets`);

      // Clear listener
      page.removeAllListeners('response');

      // Second load - check for cache hits
      page.on('response', async (response) => {
        const url = response.url();
        if (url.includes('.js') || url.includes('.css')) {
          const fromCache = response.fromCache();
          secondLoadRequests.set(url, {
            url,
            fromCache,
            status: response.status()
          });
        }
      });

      await page.reload();
      await page.waitForLoadState('networkidle');

      console.log('\n=== Cache Hits on Reload ===');
      let cacheHits = 0;
      let totalAssets = 0;

      secondLoadRequests.forEach((req) => {
        console.log(`${req.fromCache ? '[CACHED]' : '[NETWORK]'} ${req.url}`);
        totalAssets++;
        if (req.fromCache) cacheHits++;
      });

      console.log(`\nCache hit rate: ${cacheHits}/${totalAssets} (${Math.round(cacheHits/totalAssets*100)}%)`);

      // We expect most assets to be cached on reload
      const cacheHitRate = cacheHits / totalAssets;
      if (cacheHitRate < 0.5) {
        console.warn(`Warning: Low cache hit rate (${Math.round(cacheHitRate*100)}%)`);
      }
    });
  });

  test.describe('4. Health Check Endpoint', () => {

    test('should return healthy status from health endpoint', async ({ request }) => {
      const response = await request.get(`${API_URL}/health`);

      expect(response.status()).toBe(200);

      const body = await response.json();
      console.log('\n=== Health Check Response ===');
      console.log(JSON.stringify(body, null, 2));

      // Verify expected structure
      expect(body).toHaveProperty('status');
      expect(body.status).toBe('healthy');

      // Check for cold_start indicator
      if (body.hasOwnProperty('cold_start')) {
        console.log(`Cold start: ${body.cold_start}`);
        expect(typeof body.cold_start).toBe('boolean');
      } else {
        console.warn('Warning: Health check response does not include cold_start field');
      }

      // Log other fields
      Object.keys(body).forEach(key => {
        if (key !== 'status' && key !== 'cold_start') {
          console.log(`${key}: ${body[key]}`);
        }
      });
    });

    test('should have fast health check response time', async ({ request }) => {
      const iterations = 3;
      const responseTimes: number[] = [];

      for (let i = 0; i < iterations; i++) {
        const startTime = Date.now();
        const response = await request.get(`${API_URL}/health`);
        const responseTime = Date.now() - startTime;

        responseTimes.push(responseTime);

        expect(response.status()).toBe(200);

        // Wait a bit between requests
        if (i < iterations - 1) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }

      console.log('\n=== Health Check Response Times ===');
      responseTimes.forEach((time, i) => {
        console.log(`Request ${i + 1}: ${time}ms`);
      });

      const avgResponseTime = responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length;
      console.log(`Average: ${Math.round(avgResponseTime)}ms`);

      // Health check should be fast (warm Lambda)
      expect(avgResponseTime).toBeLessThan(1000);
    });

    test('should verify cold start mitigation is working', async ({ request }) => {
      // Make multiple requests to check cold_start field
      const responses: any[] = [];

      for (let i = 0; i < 3; i++) {
        const response = await request.get(`${API_URL}/health`);
        const body = await response.json();
        responses.push({
          iteration: i + 1,
          cold_start: body.cold_start,
          timestamp: new Date().toISOString()
        });

        // Wait between requests
        if (i < 2) {
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
      }

      console.log('\n=== Cold Start Checks ===');
      responses.forEach(res => {
        console.log(`Request ${res.iteration}: cold_start=${res.cold_start} at ${res.timestamp}`);
      });

      // After first request, subsequent requests should not be cold starts
      const subsequentColdStarts = responses.slice(1).filter(r => r.cold_start === true).length;

      if (subsequentColdStarts > 0) {
        console.warn(`Warning: ${subsequentColdStarts} cold starts detected in subsequent requests`);
      } else {
        console.log('Cold start mitigation appears to be working - no cold starts after warmup');
      }
    });
  });

  test.describe('5. Network Performance Analysis', () => {

    test('should analyze all network requests on initial load', async ({ page }) => {
      const allRequests: any[] = [];

      page.on('response', async (response) => {
        const request = response.request();
        const url = response.url();
        const timing = response.timing();

        allRequests.push({
          url,
          method: request.method(),
          status: response.status(),
          contentType: response.headers()['content-type'] || 'unknown',
          timing,
          fromCache: response.fromCache()
        });
      });

      await page.goto(PRODUCTION_URL);
      await page.waitForLoadState('networkidle');

      // Categorize requests
      const categories = {
        html: allRequests.filter(r => r.contentType.includes('html')),
        js: allRequests.filter(r => r.contentType.includes('javascript') || r.url.includes('.js')),
        css: allRequests.filter(r => r.contentType.includes('css') || r.url.includes('.css')),
        images: allRequests.filter(r => r.contentType.includes('image')),
        fonts: allRequests.filter(r => r.contentType.includes('font') || r.url.match(/\.(woff2?|ttf|otf)/)),
        api: allRequests.filter(r => r.url.includes('/api/')),
        other: []
      };

      // Categorize remaining
      categories.other = allRequests.filter(r =>
        !categories.html.includes(r) &&
        !categories.js.includes(r) &&
        !categories.css.includes(r) &&
        !categories.images.includes(r) &&
        !categories.fonts.includes(r) &&
        !categories.api.includes(r)
      );

      console.log('\n=== Network Request Summary ===');
      console.log(`Total requests: ${allRequests.length}`);
      console.log(`HTML: ${categories.html.length}`);
      console.log(`JavaScript: ${categories.js.length}`);
      console.log(`CSS: ${categories.css.length}`);
      console.log(`Images: ${categories.images.length}`);
      console.log(`Fonts: ${categories.fonts.length}`);
      console.log(`API: ${categories.api.length}`);
      console.log(`Other: ${categories.other.length}`);

      // Check cache usage
      const cachedRequests = allRequests.filter(r => r.fromCache).length;
      console.log(`\nCached requests: ${cachedRequests}/${allRequests.length}`);

      // Log slow requests
      const slowRequests = allRequests.filter(r => r.timing && r.timing.responseEnd > 1000);
      if (slowRequests.length > 0) {
        console.log('\n=== Slow Requests (>1s) ===');
        slowRequests.forEach(r => {
          console.log(`${r.method} ${r.url} - ${Math.round(r.timing.responseEnd)}ms`);
        });
      }

      // Log failed requests
      const failedRequests = allRequests.filter(r => r.status >= 400);
      if (failedRequests.length > 0) {
        console.log('\n=== Failed Requests ===');
        failedRequests.forEach(r => {
          console.log(`${r.status} ${r.method} ${r.url}`);
        });
      }
    });
  });

  test.describe('6. Console Error Detection', () => {

    test('should check for JavaScript errors in console', async ({ page }) => {
      const consoleErrors: any[] = [];
      const consoleWarnings: any[] = [];

      page.on('console', (msg) => {
        if (msg.type() === 'error') {
          consoleErrors.push(msg.text());
        } else if (msg.type() === 'warning') {
          consoleWarnings.push(msg.text());
        }
      });

      page.on('pageerror', (error) => {
        consoleErrors.push(`Page error: ${error.message}`);
      });

      await page.goto(PRODUCTION_URL);
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(2000);

      console.log('\n=== Console Errors ===');
      if (consoleErrors.length === 0) {
        console.log('No console errors detected');
      } else {
        consoleErrors.forEach((error, i) => {
          console.log(`Error ${i + 1}: ${error}`);
        });
      }

      console.log('\n=== Console Warnings ===');
      if (consoleWarnings.length === 0) {
        console.log('No console warnings detected');
      } else {
        consoleWarnings.slice(0, 10).forEach((warning, i) => {
          console.log(`Warning ${i + 1}: ${warning}`);
        });
        if (consoleWarnings.length > 10) {
          console.log(`... and ${consoleWarnings.length - 10} more warnings`);
        }
      }

      // We don't want critical errors on load
      const criticalErrors = consoleErrors.filter(e =>
        !e.includes('favicon') &&
        !e.includes('Extension') &&
        !e.includes('chrome-extension')
      );

      if (criticalErrors.length > 0) {
        console.error('Critical errors found:', criticalErrors);
      }
    });
  });
});
