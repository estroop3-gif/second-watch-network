# How to Run Production Performance Tests

This document explains how to run the comprehensive performance tests for the Second Watch Network production site.

## Quick Start

```bash
cd /home/estro/second-watch-network/frontend
```

## Test Suites

### 1. Playwright Health Check Tests (Recommended)

Run the API health check tests without requiring a browser:

```bash
npx playwright test tests/e2e/production-performance.spec.ts --grep "Health Check" --reporter=list
```

**What it tests:**
- Health endpoint returns healthy status
- Response times are fast (<1000ms)
- Cold start mitigation is working
- Lambda stays warm

**Expected output:**
```
✓ should return healthy status from health endpoint
✓ should have fast health check response time
✓ should verify cold start mitigation is working
```

### 2. Shell Script Tests (Fast & Simple)

Run comprehensive HTTP-based tests:

```bash
./tests/manual/production-verification.sh
```

Or with full path:
```bash
/home/estro/second-watch-network/frontend/tests/manual/production-verification.sh
```

**What it tests:**
- Homepage load performance
- Cache headers (index.html and JS assets)
- Health check endpoint
- CloudFront distribution
- HTTPS redirect
- Response sizes
- DNS resolution timing

**Expected output:**
```
✓ Homepage returned 200 OK
✓ Load time: 227ms
✓ index.html has appropriate no-cache headers
✓ JS assets have long-lived cache headers
✓ Health check returned healthy status
✓ Lambda is warm (cold_start: false)
```

### 3. Python Performance Tests (Detailed)

Run detailed HTTP performance analysis:

```bash
python3 tests/manual/browser-performance-test.py
```

Or with full path:
```bash
cd /home/estro/second-watch-network/frontend
python3 /home/estro/second-watch-network/frontend/tests/manual/browser-performance-test.py
```

**What it tests:**
- Initial load performance
- JS assets caching
- Index.html caching
- Cache reload behavior
- Health check endpoint
- Login page responsiveness
- CloudFront distribution
- Overall performance metrics

**Expected output:**
```
TEST 1: Initial Load Performance
  Status Code: 200
  Load Time: 275ms
  ✓ React root element found in HTML

TEST 5: Health Check Endpoint
  Status: healthy
  Cold Start: False
  ✓ No cold starts after warmup

All Tests Completed Successfully ✓
```

### 4. Full Playwright Test Suite (Requires Browser)

Run all Playwright tests including browser-based tests:

```bash
npx playwright test tests/e2e/production-performance.spec.ts --reporter=list
```

**Note:** This requires Chromium dependencies which may not be available in WSL2. Use tests 1-3 above for comprehensive coverage without browser dependencies.

## Viewing Test Reports

### Quick Summary
```bash
cat tests/PERFORMANCE_TEST_SUMMARY.md
```

### Visual Report
```bash
cat tests/PERFORMANCE_VISUAL_REPORT.txt
```

### Full Detailed Report
```bash
cat tests/PRODUCTION_PERFORMANCE_REPORT.md
```

Or open in an editor:
```bash
code tests/PRODUCTION_PERFORMANCE_REPORT.md
```

## Common Test Commands

### Run only health check tests
```bash
npx playwright test --grep "Health Check"
```

### Run with verbose output
```bash
npx playwright test tests/e2e/production-performance.spec.ts --reporter=list
```

### Run a specific test
```bash
npx playwright test tests/e2e/production-performance.spec.ts:378
```

## Understanding Test Results

### Success Indicators

✅ **All tests should show:**
- Homepage load time: <3000ms (typically <300ms)
- Health check response: <1000ms (typically <200ms)
- Cold start: `false` on all requests
- JS assets: `cache-control: public, max-age=31536000, immutable`
- HTML: `cache-control: no-cache, no-store, must-revalidate`
- CloudFront: `X-Cache: Hit from cloudfront`

### Performance Targets

| Metric | Target | Excellent | Good | Needs Improvement |
|--------|--------|-----------|------|-------------------|
| Homepage Load | <3000ms | <300ms | <1000ms | >3000ms |
| Cached Load | - | <100ms | <500ms | >1000ms |
| Health Check | <1000ms | <200ms | <500ms | >1000ms |
| Cold Start Rate | 0% | 0% | <5% | >10% |

### What to Look For

**Good Signs:**
- `cold_start: false` in health check responses
- Process age increasing between requests
- CloudFront cache hits
- Fast load times (<300ms)
- Brotli compression enabled (`content-encoding: br`)

**Warning Signs:**
- `cold_start: true` in consecutive requests
- Health check response times >500ms
- Missing cache headers on assets
- Load times >1000ms
- CloudFront misses

## Troubleshooting

### Test fails with "browser dependencies missing"

**Solution:** Use the shell script or Python tests instead:
```bash
./tests/manual/production-verification.sh
python3 tests/manual/browser-performance-test.py
```

### Health check shows `cold_start: true`

**This is normal for:**
- First request after Lambda has been idle
- Lambda was recently deployed
- AWS scaled down the Lambda instance

**Run the test again** - subsequent requests should show `cold_start: false`.

### Slow load times (>1000ms)

**Possible causes:**
- Network latency
- CloudFront cache miss
- Geographic distance from edge location
- Lambda cold start

**Solutions:**
- Run test multiple times
- Check CloudFront cache status
- Verify Lambda warm-up strategies

### "Permission denied" error on shell script

**Solution:** Make the script executable:
```bash
chmod +x tests/manual/production-verification.sh
```

## Scheduling Regular Tests

### Cron Job Example

Run tests every hour:
```bash
0 * * * * cd /home/estro/second-watch-network/frontend && python3 tests/manual/browser-performance-test.py >> /var/log/swn-perf-tests.log 2>&1
```

### CI/CD Integration

Add to GitHub Actions workflow:
```yaml
- name: Run Performance Tests
  run: |
    cd frontend
    npx playwright test tests/e2e/production-performance.spec.ts --grep "Health Check"
    python3 tests/manual/browser-performance-test.py
```

## Test Files Reference

| File | Purpose | Runtime |
|------|---------|---------|
| `tests/e2e/production-performance.spec.ts` | Playwright test suite | 10-30s |
| `tests/manual/production-verification.sh` | Shell script tests | 5-10s |
| `tests/manual/browser-performance-test.py` | Python performance tests | 10-20s |
| `tests/PRODUCTION_PERFORMANCE_REPORT.md` | Detailed test report | - |
| `tests/PERFORMANCE_TEST_SUMMARY.md` | Quick summary | - |
| `tests/PERFORMANCE_VISUAL_REPORT.txt` | Visual test results | - |

## Getting Help

If tests are failing or performance is degraded:

1. Check the health endpoint manually:
   ```bash
   curl https://vnvvoelid6.execute-api.us-east-1.amazonaws.com/health
   ```

2. Check the homepage:
   ```bash
   curl -I https://www.secondwatchnetwork.com
   ```

3. Review CloudFront logs in AWS Console

4. Check Lambda metrics in CloudWatch

5. Review the detailed test report:
   ```bash
   cat tests/PRODUCTION_PERFORMANCE_REPORT.md
   ```

## Last Test Results

**Date:** January 5, 2026
**Overall Grade:** A+
**Status:** All systems optimal

See `PRODUCTION_PERFORMANCE_REPORT.md` for full details.
