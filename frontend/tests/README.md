# Continuity Tab Test Suite

Comprehensive testing suite for the Second Watch Network Backlot Continuity tab (ScriptyWorkspace).

## Overview

This test suite provides multiple levels of testing:

1. **Smoke Tests** - Quick verification of component integrity
2. **Automated E2E Tests** - 47 Playwright test cases
3. **Manual Test Plan** - 86 detailed test cases
4. **Test Report** - Comprehensive analysis and recommendations

## Quick Start

### Run Smoke Tests

```bash
cd /home/estro/second-watch-network/frontend
node tests/continuity-smoke-test.cjs
```

Expected output: ✅ All 12 checks passed

### Run Automated Tests (Playwright)

**Note**: Requires system dependencies. See installation below.

```bash
# Install Playwright browsers (if not already installed)
npx playwright install chromium

# Run all tests
npx playwright test

# Run with UI mode
npx playwright test --ui

# Run specific test file
npx playwright test tests/e2e/continuity-tab.spec.ts

# Generate HTML report
npx playwright show-report
```

### Run Manual Tests

1. Start the application:
   ```bash
   npm run dev
   ```

2. Open browser and navigate to:
   ```
   http://localhost:8080
   → Login
   → Backlot
   → Select a Project
   → Click "Script" in sidebar
   → Click "Continuity" tab
   ```

3. Follow the test plan:
   ```bash
   # Open the manual test plan
   cat tests/manual-continuity-test.md
   ```

4. Execute each test case and mark PASS/FAIL

## Test Files

| File | Purpose | Test Count |
|------|---------|------------|
| `continuity-smoke-test.cjs` | Component integrity checks | 12 |
| `e2e/continuity-tab.spec.ts` | Automated E2E tests | 47 |
| `manual-continuity-test.md` | Manual test plan | 86 |
| `CONTINUITY_TEST_REPORT.md` | Comprehensive test report | N/A |

## System Dependencies (Linux/WSL)

For Playwright to run Chromium, you need these system libraries:

```bash
sudo apt-get update
sudo apt-get install -y \
  libnspr4 \
  libnss3 \
  libatk1.0-0 \
  libatk-bridge2.0-0 \
  libcups2 \
  libdrm2 \
  libxkbcommon0 \
  libxcomposite1 \
  libxdamage1 \
  libxfixes3 \
  libxrandr2 \
  libgbm1 \
  libpango-1.0-0 \
  libcairo2 \
  libasound2
```

Or use the Playwright installer:

```bash
npx playwright install-deps chromium
```

## Test Coverage

### Features Tested

- ✅ ScriptyWorkspace layout and controls
- ✅ Script selector dropdown
- ✅ Production day selector
- ✅ Rolling/Stop button toggle
- ✅ Export dropdown (CSV, JSON, Daily Report)
- ✅ Fullscreen mode
- ✅ Scenes list (Left Panel)
- ✅ Script PDF viewer (Center Panel)
- ✅ Takes tab (Right Panel)
- ✅ Notes tab (Right Panel)
- ✅ Photos tab (Right Panel)
- ✅ Export functionality
- ✅ Error handling
- ✅ Accessibility

### Test Results

**Smoke Tests**: ✅ 12/12 Passed (100%)

**Automated E2E Tests**: ⚠️ Infrastructure ready, execution blocked on system dependencies

**Manual Tests**: 📋 Ready for execution

## Common Issues

### Issue: Chromium fails to start

**Error**: `libnspr4.so: cannot open shared object file`

**Solution**: Install system dependencies (see above)

---

### Issue: Tests timeout

**Cause**: Application not running or slow network

**Solution**:
1. Ensure app is running: `npm run dev`
2. Increase timeout in `playwright.config.ts`:
   ```ts
   timeout: 60000, // 60 seconds
   ```

---

### Issue: Navigation fails

**Cause**: Authentication required or project not found

**Solution**:
1. Update navigation helper in test file
2. Add authentication state
3. Create test fixtures with pre-configured projects

---

## Writing New Tests

### Adding a Playwright Test

```typescript
test('should do something', async ({ page }) => {
  // Navigate to Continuity tab
  await navigateToContinuityTab(page);

  // Perform actions
  await page.locator('button:has-text("New Take")').click();

  // Assert
  await expect(page.locator('input[placeholder*="Take"]')).toBeVisible();
});
```

### Adding a Manual Test Case

Follow this format:

```markdown
#### Test X.Y: Test Name
- **Expected**: What should happen
- **Steps**:
  1. Do this
  2. Do that
  3. Verify result
- **Status**: [ ] PASS [ ] FAIL [ ] BLOCKED
- **Notes**:
```

## Best Practices

1. **Use data-testid attributes** for stable selectors
2. **Test user behavior**, not implementation
3. **Keep tests independent** - each test should work alone
4. **Use page object models** for complex flows
5. **Document test purpose** - explain what and why

## Reporting Issues

When a test fails:

1. **Capture evidence**:
   - Screenshot
   - Video (Playwright auto-captures)
   - Console logs
   - Network logs

2. **Describe the issue**:
   - What you expected
   - What actually happened
   - Steps to reproduce

3. **Add to test report**:
   - Update `CONTINUITY_TEST_REPORT.md`
   - Add to "Issues Found" section
   - Include severity (Critical/High/Medium/Low)

## CI/CD Integration

### GitHub Actions Example

```yaml
name: Continuity Tab Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - name: Install dependencies
        run: npm ci
      - name: Install Playwright
        run: npx playwright install --with-deps chromium
      - name: Run tests
        run: npx playwright test
      - name: Upload test results
        if: always()
        uses: actions/upload-artifact@v3
        with:
          name: playwright-report
          path: playwright-report/
```

## Resources

- [Playwright Documentation](https://playwright.dev)
- [React Testing Best Practices](https://kentcdodds.com/blog/common-mistakes-with-react-testing-library)
- [WCAG 2.1 Guidelines](https://www.w3.org/WAI/WCAG21/quickref/)
- [shadcn/ui Components](https://ui.shadcn.com/)

## Support

For questions or issues:
1. Check the test report: `CONTINUITY_TEST_REPORT.md`
2. Review existing test cases
3. Consult the CLAUDE.md file for project-specific guidance

---

**Last Updated**: December 28, 2025
**Test Suite Version**: 1.0.0
**Playwright Version**: 1.49.1
