# Admin Forum Management - Test Execution Guide

## Overview

This guide provides instructions for running Playwright tests that verify the admin Forum Management panel is correctly connected to the NEW community forum system (Topics in `/filmmakers` page) and NOT the old "The Backlot" forum.

## What We're Testing

### Database Tables (NEW Community Forum)
- `community_topics` - Forum categories/topics
- `community_topic_threads` - Discussion threads
- `community_topic_replies` - Thread comments/replies
- `content_reports` - User-reported content

### Admin Panel Tabs
1. **Topics Tab** - Manages forum categories from `community_topics`
2. **Threads Tab** - Manages discussion threads from `community_topic_threads`
3. **Comments Tab** - Manages replies from `community_topic_replies`
4. **Reports Tab** - Manages content reports from `content_reports`

## Prerequisites

### Environment Setup

1. **Backend Server Running**
   ```bash
   cd /home/estro/second-watch-network/backend
   source venv/bin/activate
   uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
   ```

2. **Frontend Development Server Running**
   ```bash
   cd /home/estro/second-watch-network/frontend
   npm run dev
   ```

3. **Database with Test Data**
   - Ensure PostgreSQL database is running
   - Database should have sample data in `community_topics`, `community_topic_threads`, `community_topic_replies`, and `content_reports` tables

4. **Admin User Credentials**
   Set environment variables:
   ```bash
   export ADMIN_EMAIL="your-admin@example.com"
   export ADMIN_PASSWORD="your-admin-password"
   ```

### Install Playwright (if not already installed)

```bash
cd /home/estro/second-watch-network/frontend
npm install -D @playwright/test
npx playwright install
```

## Running the Tests

### Run All Admin Forum Management Tests

```bash
cd /home/estro/second-watch-network/frontend
npx playwright test tests/e2e/admin-forum-management.spec.ts
```

### Run Specific Test Suites

**Connection Verification Only:**
```bash
npx playwright test tests/e2e/admin-forum-management.spec.ts -g "Connection Verification"
```

**Topics Tab Only:**
```bash
npx playwright test tests/e2e/admin-forum-management.spec.ts -g "Topics Tab"
```

**Threads Tab Only:**
```bash
npx playwright test tests/e2e/admin-forum-management.spec.ts -g "Threads Tab"
```

**Comments Tab Only:**
```bash
npx playwright test tests/e2e/admin-forum-management.spec.ts -g "Comments Tab"
```

**Reports Tab Only:**
```bash
npx playwright test tests/e2e/admin-forum-management.spec.ts -g "Reports Tab"
```

**API Endpoint Verification:**
```bash
npx playwright test tests/e2e/admin-forum-management.spec.ts -g "API Endpoint Verification"
```

**CRUD Operations:**
```bash
npx playwright test tests/e2e/admin-forum-management.spec.ts -g "CRUD Operations"
```

### Run in UI Mode (Interactive)

```bash
npx playwright test tests/e2e/admin-forum-management.spec.ts --ui
```

### Run in Headed Mode (See Browser)

```bash
npx playwright test tests/e2e/admin-forum-management.spec.ts --headed
```

### Run with Debug Mode

```bash
npx playwright test tests/e2e/admin-forum-management.spec.ts --debug
```

## Test Coverage

### ✅ Connection Verification Tests

| Test | Description |
|------|-------------|
| Page Load | Verifies Forum Management page loads with correct title |
| Tab Presence | Confirms all four tabs (Topics, Threads, Comments, Reports) are visible |

### ✅ Topics Tab Tests

| Test | Description |
|------|-------------|
| Data Loading | Verifies topics load from `community_topics` table |
| Table Headers | Confirms correct columns: Icon, Name, Description, Threads, Status, Created At, Actions |
| Create Button | Verifies "Create Topic" button exists |
| Link Verification | **CRITICAL**: Ensures topics link to `/filmmakers` NOT `/the-backlot` |
| Thread Counts | Verifies thread count display from relationship with `community_topic_threads` |

### ✅ Threads Tab Tests

| Test | Description |
|------|-------------|
| Data Loading | Verifies threads load from `community_topic_threads` table |
| Table Headers | Confirms columns: Title, Topic, Author, Created, Pinned |
| Search & Filter | Verifies search input and topic filter dropdown |
| Topic Association | Confirms threads show their associated topic from `community_topics` |
| Pin Functionality | Verifies pin/unpin controls exist |
| Bulk Delete | Confirms checkbox selection for bulk operations |

### ✅ Comments Tab Tests

| Test | Description |
|------|-------------|
| Data Loading | Verifies replies load from `community_topic_replies` table |
| Table Headers | Confirms columns: Content, Thread, Author, Created, Actions |
| Search | Verifies search functionality |
| Thread Association | Confirms replies show their parent thread |
| Delete Actions | Verifies delete functionality exists |

### ✅ Reports Tab Tests

| Test | Description |
|------|-------------|
| Data Loading | Verifies reports load from `content_reports` table |
| Statistics Display | Confirms Pending, Resolved, Dismissed, Total stats cards |
| Filters | Verifies status and content type filter dropdowns |
| Content Type Display | Confirms report type (thread/reply) is shown |
| Badge Indicator | Checks for pending reports count badge on tab |

### ✅ Data Integration Tests

| Test | Description |
|------|-------------|
| Topics → Threads | Verifies relationship between `community_topics` and `community_topic_threads` |
| Threads → Comments | Verifies relationship between `community_topic_threads` and `community_topic_replies` |

### ✅ API Endpoint Tests

| Test | Description |
|------|-------------|
| Correct Endpoints | Verifies calls to `/api/v1/admin/community/*` endpoints |
| NO Old Forum Calls | **CRITICAL**: Ensures NO calls to `/the-backlot` or old forum endpoints |

### ✅ Error Handling Tests

| Test | Description |
|------|-------------|
| Empty States | Verifies graceful handling when no data exists |
| Loading States | Confirms proper loading indicators |

### ✅ CRUD Operations Tests

| Test | Description |
|------|-------------|
| Create Topic Dialog | Verifies topic creation form opens |
| Form Fields | Confirms all required fields present in forms |
| Delete Operations | Verifies delete functionality for threads/comments |
| Pin Operations | Confirms pin/unpin functionality for threads |

## Expected Results

### ✅ All Tests Should Pass

If all tests pass, it confirms:

1. ✅ Admin Forum Management is connected to the **NEW** community forum (`community_topics`, `community_topic_threads`, `community_topic_replies`)
2. ✅ Topics link to `/filmmakers` community page (NOT `/the-backlot`)
3. ✅ All four tabs load correct data from the right tables
4. ✅ API endpoints are calling `/api/v1/admin/community/*` (NEW forum APIs)
5. ✅ NO calls to old Backlot forum endpoints
6. ✅ All CRUD operations work correctly

### ❌ Critical Failures to Watch For

1. **Topics linking to `/the-backlot`** - Indicates still connected to old forum
2. **API calls to `/the-backlot` or `/backlot/forum`** - Wrong endpoints being used
3. **Missing table data** - Database tables not populated or wrong tables queried
4. **404 errors on API calls** - Endpoint routing issues

## Troubleshooting

### Test Fails: "Topics link to /the-backlot"

**Problem**: Admin panel still linking to old forum
**Fix**: Check `/home/estro/second-watch-network/frontend/src/pages/admin/ForumManagement.tsx` line 263 - should link to `/filmmakers?tab=topics`

### Test Fails: "API calls to /the-backlot"

**Problem**: Wrong API endpoints being called
**Fix**: Check frontend components are using correct API methods from `/home/estro/second-watch-network/frontend/src/lib/api.ts`

### Test Fails: "listReportsAdmin is not a function"

**Problem**: API method name mismatch
**Fix**: Verify `/home/estro/second-watch-network/frontend/src/lib/api.ts` has `listReportsAdmin()` alias or update `ReportsAdminTab.tsx` to use `listContentReportsAdmin()`

### Test Fails: Login Issues

**Problem**: Admin credentials not set or incorrect
**Fix**: Verify environment variables are set:
```bash
echo $ADMIN_EMAIL
echo $ADMIN_PASSWORD
```

### Test Fails: Database Empty

**Problem**: No test data in database
**Fix**: Populate database with sample community forum data

## Test Report Generation

### Generate HTML Report

```bash
npx playwright test tests/e2e/admin-forum-management.spec.ts --reporter=html
npx playwright show-report
```

### Generate JSON Report

```bash
npx playwright test tests/e2e/admin-forum-management.spec.ts --reporter=json > test-results.json
```

## CI/CD Integration

Add to GitHub Actions workflow:

```yaml
- name: Run Admin Forum Management Tests
  run: |
    cd frontend
    npx playwright test tests/e2e/admin-forum-management.spec.ts
  env:
    ADMIN_EMAIL: ${{ secrets.ADMIN_EMAIL }}
    ADMIN_PASSWORD: ${{ secrets.ADMIN_PASSWORD }}
    BASE_URL: http://localhost:8080
```

## Manual Verification Checklist

After automated tests pass, manually verify:

- [ ] Navigate to `/admin/forum-management`
- [ ] Click through all four tabs (Topics, Threads, Comments, Reports)
- [ ] Verify Topics tab shows community topics
- [ ] Click a topic name - should navigate to `/filmmakers?tab=topics` (NOT `/the-backlot`)
- [ ] Verify Threads tab shows threads with topic associations
- [ ] Verify Comments tab shows replies with thread associations
- [ ] Verify Reports tab shows content reports with stats
- [ ] Create a new topic - should appear in Topics tab
- [ ] Pin/unpin a thread - should update in Threads tab
- [ ] Delete a comment - should remove from Comments tab
- [ ] Resolve a report - should update stats in Reports tab

## Test Maintenance

### When to Update Tests

- **New forum features added** - Add corresponding test cases
- **Database schema changes** - Update table/column expectations
- **UI changes** - Update selectors if component structure changes
- **API endpoint changes** - Update endpoint verification tests

### Regular Test Reviews

- Run tests weekly to catch regressions
- Review test failures immediately
- Update test data as needed
- Keep environment variables current

## Support

For issues or questions about these tests:

1. Check test output for detailed error messages
2. Review Playwright trace files in `test-results/`
3. Run tests in debug mode to step through failures
4. Verify backend and frontend servers are running
5. Confirm database connectivity and test data

## Files Modified

This testing suite validates fixes made to:

1. `/home/estro/second-watch-network/frontend/src/lib/api.ts`
   - Added `listReportsAdmin()` alias method

2. `/home/estro/second-watch-network/frontend/src/pages/admin/ForumManagement.tsx`
   - Fixed topic links from `/the-backlot` to `/filmmakers?tab=topics`

## Success Criteria

✅ **All tests pass** = Admin Forum Management correctly connected to NEW community forum
❌ **Any test fails** = Investigation needed - may indicate connection to wrong forum system
