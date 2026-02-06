Run Playwright E2E tests for a specific Backlot workspace tab.

Usage: /test-tab <tab-name>
Example: /test-tab team-access

Steps:
1. Ensure dev server is running (npm run dev)
2. Source .env.playwright for test credentials
3. Run: npm run test:e2e -- tests/e2e/{tab-name}-*.spec.ts --reporter=list
4. If tests fail, read the HTML report and fix issues
5. Re-run until all pass
