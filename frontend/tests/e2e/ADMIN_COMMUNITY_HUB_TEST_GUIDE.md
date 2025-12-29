# Admin Community Hub - Manual Test Guide

## Overview
This guide provides comprehensive manual testing instructions for the Admin Community Hub page at `/admin/community`.

**Test Page**: http://localhost:8080/admin/community

**Credentials**:
- Email: eric@secondwatchnetwork.com
- Password: MyHeroIsMG1!

---

## Automated Test Suite

The automated Playwright test suite is available at:
- **Test File**: `/home/estro/second-watch-network/frontend/tests/e2e/admin-community-hub.spec.ts`
- **Runner Script**: `/home/estro/second-watch-network/frontend/tests/e2e/RUN_COMMUNITY_HUB_TESTS.sh`

### Running Automated Tests

```bash
# From frontend directory
cd /home/estro/second-watch-network/frontend

# Run all tests (headless)
./tests/e2e/RUN_COMMUNITY_HUB_TESTS.sh

# Run with visible browser
./tests/e2e/RUN_COMMUNITY_HUB_TESTS.sh --headed

# Run in interactive UI mode
./tests/e2e/RUN_COMMUNITY_HUB_TESTS.sh --ui

# Run in debug mode with Playwright Inspector
./tests/e2e/RUN_COMMUNITY_HUB_TESTS.sh --debug
```

**Note**: If you encounter browser dependency issues (libnspr4.so), install Playwright system dependencies:
```bash
sudo npx playwright install-deps chromium
```

---

## Manual Testing Checklist

### 1. Page Loading & Navigation

#### Test 1.1: Navigate to Community Hub
- [ ] Login with admin credentials
- [ ] Navigate to `/admin/community`
- [ ] **Expected**: Page loads successfully without errors
- [ ] **Expected**: URL shows `/admin/community`

#### Test 1.2: Verify Header
- [ ] Check for "Community Hub" header text
- [ ] **Expected**: Header displays "Community Hub" with proper styling
- [ ] **Expected**: "Hub" word has cyan-500 color accent (cyan/teal color)
- [ ] **Expected**: Header uses fun, handwritten font style (font-spray class)

### 2. Quick Stats Cards

#### Test 2.1: Verify All Stats Cards Present
- [ ] Check for Members stat card
- [ ] Check for Collabs stat card
- [ ] Check for Reports stat card
- [ ] Check for Mutes stat card
- [ ] **Expected**: All 4 stat cards are visible
- [ ] **Expected**: Stats show numeric values (may be 0 if no data)

#### Test 2.2: Verify Stats Styling
- [ ] Check stats card background color
- [ ] **Expected**: Dark gray background (bg-gray-900)
- [ ] **Expected**: Cyan-500 colored numbers
- [ ] **Expected**: Muted gray labels

#### Test 2.3: Verify Stats Accuracy
- [ ] Note the Members count
- [ ] Navigate to Members tab and verify count matches
- [ ] Repeat for other stats
- [ ] **Expected**: Stats accurately reflect current data

### 3. Tab Navigation

#### Test 3.1: Verify All Tabs Exist
- [ ] Check for "Members" tab
- [ ] Check for "Collabs" tab
- [ ] Check for "Moderation" tab
- [ ] Check for "Settings" tab
- [ ] **Expected**: All 4 tabs are visible with icons

#### Test 3.2: Test Members Tab
- [ ] Click on "Members" tab
- [ ] **Expected**: Tab becomes active (cyan-600 background)
- [ ] **Expected**: Members content loads
- [ ] **Expected**: Users icon visible
- [ ] **Expected**: Tab has proper aria-selected="true" attribute

#### Test 3.3: Test Collabs Tab
- [ ] Click on "Collabs" tab
- [ ] **Expected**: Tab becomes active
- [ ] **Expected**: Collabs content loads
- [ ] **Expected**: Handshake icon visible

#### Test 3.4: Test Moderation Tab
- [ ] Click on "Moderation" tab
- [ ] **Expected**: Tab becomes active
- [ ] **Expected**: Moderation content loads
- [ ] **Expected**: Shield icon visible

#### Test 3.5: Test Settings Tab
- [ ] Click on "Settings" tab
- [ ] **Expected**: Tab becomes active
- [ ] **Expected**: Settings content loads
- [ ] **Expected**: Settings icon visible

#### Test 3.6: Test Tab Switching
- [ ] Click Members tab
- [ ] Click Collabs tab
- [ ] Click back to Members tab
- [ ] Click Moderation tab
- [ ] Click Settings tab
- [ ] Click back to Members tab
- [ ] **Expected**: Tabs switch smoothly without errors
- [ ] **Expected**: Content updates correctly for each tab
- [ ] **Expected**: Only one tab is active at a time

### 4. Members Tab Functionality

#### Test 4.1: Verify Members Table/List
- [ ] Click Members tab
- [ ] Wait for content to load
- [ ] **Expected**: Table or list of members displays
- [ ] **Expected**: Member data shows (or empty state if no members)

#### Test 4.2: Test Search Functionality
- [ ] Look for search input field
- [ ] Type a search term
- [ ] **Expected**: Search input works
- [ ] **Expected**: Results filter based on search (if implemented)
- [ ] Clear search
- [ ] **Expected**: Full list returns

#### Test 4.3: Test Filter Options
- [ ] Look for filter button/dropdown
- [ ] Click filter button
- [ ] **Expected**: Filter options appear
- [ ] Select a filter
- [ ] **Expected**: Members list filters accordingly

#### Test 4.4: Test Feature/Unfeature Actions
- [ ] Find a member row
- [ ] Look for "Feature" or "Unfeature" button
- [ ] Click action button
- [ ] **Expected**: Action completes successfully
- [ ] **Expected**: UI updates to reflect change
- [ ] **Expected**: Confirmation or feedback provided

#### Test 4.5: Test Member Details
- [ ] Click on a member (if clickable)
- [ ] **Expected**: Member details load
- [ ] Or: Hover over member
- [ ] **Expected**: Additional info appears

### 5. Collabs Tab Functionality

#### Test 5.1: Verify Collabs List
- [ ] Click Collabs tab
- [ ] Wait for content to load
- [ ] **Expected**: List of collaborations displays
- [ ] **Expected**: Shows active collaborations
- [ ] **Expected**: Displays collab details (participants, status, etc.)

#### Test 5.2: Test Collab Management
- [ ] Look for management actions (view, edit, etc.)
- [ ] Click on a collab action
- [ ] **Expected**: Action performs as intended
- [ ] **Expected**: No errors occur

### 6. Moderation Tab Functionality

#### Test 6.1: Verify Moderation Content
- [ ] Click Moderation tab
- [ ] Wait for content to load
- [ ] **Expected**: Moderation interface displays

#### Test 6.2: Test Reports Sub-Tab
- [ ] Look for "Reports" sub-tab or section
- [ ] Click Reports (if it's a sub-tab)
- [ ] **Expected**: Reports queue displays
- [ ] **Expected**: Shows pending reports (or empty state)
- [ ] **Expected**: Reports include: reported content, reporter, reason, date

#### Test 6.3: Test Active Restrictions Sub-Tab
- [ ] Look for "Active Restrictions", "Mutes", or "Bans" sub-tab
- [ ] Click on sub-tab
- [ ] **Expected**: Active restrictions list displays
- [ ] **Expected**: Shows muted/banned users (or empty state)
- [ ] **Expected**: Shows restriction details (user, reason, duration, date)

#### Test 6.4: Test Sub-Tab Switching
- [ ] Switch between Reports and Active Restrictions
- [ ] **Expected**: Sub-tabs switch correctly
- [ ] **Expected**: Content updates appropriately
- [ ] **Expected**: Active sub-tab is visually indicated

#### Test 6.5: Test Report Actions
- [ ] In Reports section, find a pending report
- [ ] Look for action buttons (Approve, Reject, Investigate)
- [ ] Click an action
- [ ] **Expected**: Action processes successfully
- [ ] **Expected**: Report status updates
- [ ] **Expected**: User receives feedback

#### Test 6.6: Test Restriction Management
- [ ] In Active Restrictions, find a restriction
- [ ] Look for action buttons (Remove, Extend, etc.)
- [ ] Click an action
- [ ] **Expected**: Action processes successfully
- [ ] **Expected**: Restriction updates or removes

### 7. Settings Tab Functionality

#### Test 7.1: Verify Settings Content
- [ ] Click Settings tab
- [ ] Wait for content to load
- [ ] **Expected**: Settings interface displays

#### Test 7.2: Verify Privacy Defaults Section
- [ ] Look for "Privacy" or "Privacy Defaults" section
- [ ] **Expected**: Privacy settings are visible
- [ ] **Expected**: Section is clearly labeled

#### Test 7.3: Verify Visibility Options
- [ ] Check for visibility option controls
- [ ] **Expected**: Options like Public/Private/Friends visible
- [ ] **Expected**: Could be radio buttons, checkboxes, or select dropdown
- [ ] **Expected**: Current settings are indicated

#### Test 7.4: Test Visibility Controls
- [ ] Select a different visibility option
- [ ] **Expected**: Control responds to interaction
- [ ] **Expected**: Selection updates visually

#### Test 7.5: Test Settings Save
- [ ] Change a setting
- [ ] Look for "Save" button
- [ ] Click Save
- [ ] **Expected**: Settings save successfully
- [ ] **Expected**: Confirmation message appears
- [ ] Reload page
- [ ] **Expected**: Settings persist

### 8. Accessibility Testing

#### Test 8.1: Keyboard Navigation
- [ ] Use Tab key to navigate through tabs
- [ ] **Expected**: Tabs are keyboard-focusable
- [ ] Press Enter/Space on a tab
- [ ] **Expected**: Tab activates
- [ ] Use Arrow keys (if supported)
- [ ] **Expected**: Arrow keys navigate between tabs

#### Test 8.2: Screen Reader Support
- [ ] Check tab roles (role="tab")
- [ ] Check for aria-selected attributes
- [ ] Check for aria-labels on icons
- [ ] **Expected**: Proper ARIA attributes present
- [ ] **Expected**: Screen reader can announce tabs correctly

#### Test 8.3: Focus Management
- [ ] Click a tab
- [ ] **Expected**: Focus moves to tab content
- [ ] Tab through content
- [ ] **Expected**: Focus order is logical

#### Test 8.4: Heading Hierarchy
- [ ] Check heading structure
- [ ] **Expected**: Page has one h1 (Community Hub)
- [ ] **Expected**: Section headings use appropriate levels (h2, h3)
- [ ] **Expected**: Headings are in logical order

### 9. Responsive Design

#### Test 9.1: Desktop View (1920x1080)
- [ ] View page at full desktop resolution
- [ ] **Expected**: All content displays properly
- [ ] **Expected**: Stats cards align horizontally
- [ ] **Expected**: Tab labels show full text

#### Test 9.2: Tablet View (768px)
- [ ] Resize browser to tablet size
- [ ] **Expected**: Layout adjusts appropriately
- [ ] **Expected**: Stats cards may stack or resize
- [ ] **Expected**: Tab labels may hide on small screens (icons only)

#### Test 9.3: Mobile View (375px)
- [ ] Resize to mobile size
- [ ] **Expected**: Layout stacks vertically
- [ ] **Expected**: All functionality remains accessible
- [ ] **Expected**: Tabs show icons only (text hidden with sm:inline)

### 10. Error Handling

#### Test 10.1: Invalid Tab Navigation
- [ ] Manually navigate to `/admin/community?tab=invalid`
- [ ] **Expected**: Page loads without crashing
- [ ] **Expected**: Defaults to first tab or shows error

#### Test 10.2: Network Failures
- [ ] Disable network (or block API)
- [ ] Reload page
- [ ] **Expected**: Loading states show appropriately
- [ ] **Expected**: Error messages display if data fails to load
- [ ] **Expected**: Page doesn't crash

#### Test 10.3: Empty States
- [ ] View tabs with no data
- [ ] **Expected**: Empty states display (e.g., "No members found")
- [ ] **Expected**: No broken layouts
- [ ] **Expected**: Helpful messages shown

### 11. Performance

#### Test 11.1: Initial Load Time
- [ ] Clear cache
- [ ] Navigate to /admin/community
- [ ] **Expected**: Page loads within 3 seconds
- [ ] **Expected**: No excessive loading spinners

#### Test 11.2: Tab Switching Performance
- [ ] Switch between all tabs rapidly
- [ ] **Expected**: Tabs switch quickly (<500ms)
- [ ] **Expected**: No lag or freezing

#### Test 11.3: Large Data Sets
- [ ] View tab with many items (e.g., 100+ members)
- [ ] **Expected**: Page remains responsive
- [ ] **Expected**: Scrolling is smooth
- [ ] **Expected**: Pagination or virtual scrolling if needed

### 12. Integration

#### Test 12.1: Stats Accuracy
- [ ] Note stat counts
- [ ] Perform an action (e.g., feature a member)
- [ ] **Expected**: Stats update to reflect change
- [ ] Or: Reload page
- [ ] **Expected**: Stats show current values

#### Test 12.2: Cross-Tab Consistency
- [ ] Note data in one tab
- [ ] Switch to another tab
- [ ] Return to first tab
- [ ] **Expected**: Data remains consistent
- [ ] **Expected**: Changes persist

---

## Common Issues & Troubleshooting

### Issue: Page doesn't load
- **Check**: Is frontend server running? (`npm run dev`)
- **Check**: Is backend API running?
- **Check**: Are you logged in with admin account?
- **Check**: Browser console for errors

### Issue: Tabs don't switch
- **Check**: Browser console for JavaScript errors
- **Check**: Network tab for failed API requests
- **Try**: Hard refresh (Ctrl+Shift+R)

### Issue: Data doesn't load
- **Check**: Backend API is running and accessible
- **Check**: Network tab for 401 (unauthorized) or 500 errors
- **Check**: Admin user has correct permissions

### Issue: Styling looks wrong
- **Check**: Tailwind CSS is compiling properly
- **Check**: No conflicting CSS
- **Try**: Clear cache and reload

---

## Test Results Template

```
## Test Run: [Date]
**Tester**: [Name]
**Browser**: [Chrome/Firefox/Safari] [Version]
**Screen Size**: [Resolution]

### Results Summary
- Total Tests: [X]
- Passed: [X]
- Failed: [X]
- Skipped: [X]

### Failed Tests
1. [Test Name]
   - **Issue**: [Description]
   - **Steps to Reproduce**: [Steps]
   - **Expected**: [Expected behavior]
   - **Actual**: [Actual behavior]
   - **Screenshot**: [Link or path]

### Notes
[Additional observations or comments]
```

---

## Automated Test Coverage

The Playwright test suite (`admin-community-hub.spec.ts`) includes:

### Test Suites:
1. **Page Loading** (3 tests)
   - Navigation verification
   - Header styling
   - Cyan-500 accent color

2. **Quick Stats Cards** (5 tests)
   - All cards display
   - Individual card verification (Members, Collabs, Reports, Mutes)

3. **Tab Navigation** (6 tests)
   - All tabs exist and are visible
   - Each tab is clickable and activates
   - Tab switching workflow

4. **Members Tab** (4 tests)
   - Data table loading
   - Search functionality
   - Filter options
   - Feature/unfeature actions

5. **Moderation Tab** (6 tests)
   - Tab content display
   - Reports sub-tab
   - Active Restrictions sub-tab
   - Reports queue data
   - Active mutes/bans section
   - Sub-tab switching

6. **Settings Tab** (5 tests)
   - Tab content display
   - Privacy defaults section
   - Visibility options display
   - Form controls presence
   - Interaction with settings

7. **Accessibility** (3 tests)
   - Keyboard navigation
   - ARIA labels
   - Heading hierarchy

8. **Error States** (2 tests)
   - Invalid tab handling
   - Loading states

9. **Full User Flow** (1 test)
   - Complete navigation workflow
   - End-to-end verification

**Total: 35 automated tests**

---

## Next Steps

1. **Run Automated Tests**: Execute the Playwright test suite to verify all functionality
2. **Manual Testing**: Perform manual tests for visual verification and UX
3. **Document Issues**: Record any bugs or improvements needed
4. **Regression Testing**: Re-run tests after any code changes

---

## Contact

For questions or issues with the test suite:
- Check test file: `/home/estro/second-watch-network/frontend/tests/e2e/admin-community-hub.spec.ts`
- Review test runner: `/home/estro/second-watch-network/frontend/tests/e2e/RUN_COMMUNITY_HUB_TESTS.sh`
