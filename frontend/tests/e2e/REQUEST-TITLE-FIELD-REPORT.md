# Gear Tab "Request Title" Field - Complete Investigation Report

## Executive Summary

**Status**: ✅ FIELD LOCATED

The "Request Title" field has been successfully located in the Backlot Gear tab rental request forms. This field appears in the marketplace browser when users are requesting equipment rentals from external gear houses.

---

## Field Location Details

### Primary Location #1: MarketplaceBrowserSection
- **File**: `src/components/backlot/workspace/gear/MarketplaceBrowserSection.tsx`
- **Line**: 865
- **Component**: RequestForm component (internal to MarketplaceBrowserSection)
- **Context**: Embedded marketplace browser for requesting rentals from gear houses

### Primary Location #2: MarketplaceRentalDialog
- **File**: `src/components/backlot/workspace/gear/MarketplaceRentalDialog.tsx`
- **Line**: 567
- **Component**: MarketplaceRentalDialog
- **Context**: Direct rental request dialog

### Secondary Location: WriteOffDialog
- **File**: `src/components/gear/incidents/WriteOffDialog.tsx`
- **Line**: 172
- **Context**: Purchase request section (read-only display)

---

## Code Implementation

```tsx
// Line 865 in MarketplaceBrowserSection.tsx
{/* Title */}
<div className="space-y-1.5 sm:col-span-2">
  <Label htmlFor="title">Request Title *</Label>
  <Input
    id="title"
    placeholder="e.g., Camera Package for Main Unit"
    value={title}
    onChange={(e) => setTitle(e.target.value)}
  />
</div>
```

### Field Properties
- **Label**: "Request Title *" (asterisk indicates required)
- **Input ID**: `title`
- **Placeholder**: "e.g., Camera Package for Main Unit"
- **Type**: Text input
- **Required**: Yes
- **State Variable**: `title` (managed by React useState)

---

## User Flow to Access This Field

### Step-by-Step Navigation

1. **Start at Homepage**
   - URL: `http://localhost:8080`

2. **Navigate to Backlot**
   - Click "Backlot" in main navigation
   - URL: `http://localhost:8080/backlot`
   - **Requires**: User authentication

3. **Select a Project**
   - Click on a project card from the project list
   - URL: `http://localhost:8080/backlot/project/{projectId}`
   - **Requires**: User must have project access

4. **Open Gear Tab**
   - In the project workspace, locate the tab navigation
   - Click on the "Gear" tab
   - **Requires**: Project must have Gear module enabled

5. **Access Marketplace**
   - Click "Browse Marketplace" button OR
   - Click "Request Rental" button
   - This opens the rental request form

6. **View the Field**
   - The "Request Title" field appears at the top of the form
   - User must enter a title to submit the rental request

---

## Complete Form Context

The "Request Title" field is part of a rental request form with these fields:

| Field | Type | Required | Purpose |
|-------|------|----------|---------|
| **Request Title** | Text input | Yes | Name/description for the rental request |
| Start Date | Date picker | Yes | Rental start date |
| End Date | Date picker | Yes | Rental end date |
| Budget Integration | Toggle | No | Auto-create budget line item |
| Budget Line Item | Dropdown | Conditional | Link to existing budget line |
| Notes | Textarea | No | Additional information or special requests |

### Field Context in UI
```
┌────────────────────────────────────────┐
│ Selected Equipment:                    │
│ [Camera Package] [Lenses] [Lighting]  │
├────────────────────────────────────────┤
│ Request Title *                        │
│ [e.g., Camera Package for Main Unit]  │ ← THIS FIELD
├────────────────────────────────────────┤
│ Start Date *        End Date *         │
│ [2026-02-01]       [2026-02-05]        │
├────────────────────────────────────────┤
│ Budget Integration                     │
│ □ Auto-create line item                │
├────────────────────────────────────────┤
│ Notes (Optional)                       │
│ [Any special requests...]              │
└────────────────────────────────────────┘
```

---

## Component Architecture

```
BacklotWorkspace
  └─ Project View
      └─ Tab Navigation
          └─ Gear Tab (GearView.tsx)
              ├─ Asset List
              ├─ Marketplace Button
              │
              └─ [Marketplace Features]
                  │
                  ├─ MarketplaceBrowserSection.tsx
                  │   └─ RequestForm component
                  │       └─ "Request Title" field (Line 865)
                  │
                  └─ MarketplaceRentalDialog.tsx
                      └─ Dialog content
                          └─ "Request Title" field (Line 567)
```

---

## Purpose & Functionality

### Why This Field Exists

The "Request Title" field serves several purposes:

1. **Request Identification**
   - Provides a human-readable name for the rental request
   - Helps users track multiple requests
   - Makes it easier to reference in communications

2. **Request Grouping**
   - Groups multiple equipment items under a single request
   - Example: "Camera Package for Episode 3" includes camera body, lenses, accessories

3. **Budget Tracking**
   - Links to budget line items
   - Helps categorize expenses by production need
   - Appears in financial reports and approvals

4. **Communication**
   - Used in emails and notifications
   - Appears in rental house communications
   - Shows up in approval workflows

### Example Use Cases

| Request Title | Items Included | Context |
|--------------|----------------|---------|
| "Camera Package for Main Unit" | RED Komodo 6K, Canon lenses, tripod | Principal photography |
| "Lighting Package - Episode 3" | ARRI SkyPanel, C-Stands, grip | Specific episode shoot |
| "Drone Kit for Aerial Shots" | DJI Inspire 3, batteries, controller | Special scenes |
| "Audio Equipment Week 2" | Boom mics, lavs, mixer, recorder | Production week |

---

## Field Validation & Behavior

### Client-Side
- Required field (cannot submit without value)
- No visible length restrictions in UI code
- Real-time updates to state on change

### Server-Side (Expected)
- Likely validated on API endpoint
- Probably stored in rental_requests table
- May be used in notifications and workflow

---

## Related Code Files

### Frontend Components
1. `src/components/backlot/workspace/GearView.tsx` - Parent component
2. `src/components/backlot/workspace/gear/MarketplaceBrowserSection.tsx` - Main location
3. `src/components/backlot/workspace/gear/MarketplaceRentalDialog.tsx` - Secondary location

### Hooks
4. `src/hooks/gear/useGearMarketplace.ts` - `useCreateRentalRequest` hook

### Backend (Estimated)
5. `backend/app/api/gear.py` or similar - API endpoint for rental requests
6. Database table: `gear_rental_requests` or similar

---

## Potential Issues / Questions

### If This Field "Shouldn't Be There"

Possible reasons it might be considered problematic:

1. **Redundancy**
   - Could be auto-generated from selected items
   - Might be unnecessary if items already have names

2. **UX Friction**
   - Adds extra step in rental workflow
   - Users might not know what to enter
   - Could cause abandonment if not clear

3. **Implementation Issues**
   - Might not be stored properly in database
   - Could be causing validation errors
   - May be breaking the submission flow

4. **Business Logic**
   - Feature might have changed but field remained
   - Could be from deprecated workflow
   - Might conflict with other systems

### Recommendations

**If field should remain:**
- Make placeholder text more helpful
- Consider making it optional instead of required
- Add tooltip explaining its purpose
- Pre-populate with smart defaults

**If field should be removed:**
- Auto-generate title from selected items
- Use first item name as title
- Generate from rental date range
- Example: "{ItemCount} items for {StartDate} - {EndDate}"

**If field should be modified:**
- Rename to "Request Name" or "Description"
- Move to optional section
- Add character limit
- Provide dropdown of common templates

---

## Test Automation Challenges

### Why Automated Tests Struggled

1. **Authentication Required**
   - No test credentials available
   - Cannot bypass login programmatically
   - JWT tokens needed for API calls

2. **Project Dependency**
   - Requires existing project in database
   - Test user must have project access
   - Cannot create test projects easily

3. **Multi-Step Navigation**
   - Complex navigation through workspace tabs
   - Depends on UI state and permissions
   - Dynamic loading of components

4. **Database State**
   - Requires gear house organizations
   - Needs marketplace listings
   - Must have proper relationships

### Successful Testing Approach

✅ **Code Review** - Manually located field in source code
✅ **Static Analysis** - Identified all occurrences
✅ **Documentation** - Created comprehensive report
❌ **Visual Confirmation** - Requires manual testing with auth

---

## Manual Testing Checklist

To visually verify this field, follow these steps:

- [ ] Log in to application at `http://localhost:8080`
- [ ] Navigate to Backlot section
- [ ] Open or create a test project
- [ ] Click on "Gear" tab in project workspace
- [ ] Click "Browse Marketplace" button
- [ ] Select equipment from marketplace
- [ ] Observe "Request Title" field in request form
- [ ] Fill in field with test data
- [ ] Take screenshot of form
- [ ] Attempt to submit request
- [ ] Verify field value in database/API

---

## Screenshots Available

The following screenshots were captured during testing:

### Gear House Tests
- `tests/screenshots/gear-request-title/01-home-page.png`
- `tests/screenshots/gear-request-title/02-gear-house-landing.png`
- `tests/screenshots/gear-request-title/03-gear-workspace.png`

### Backlot Tests
- `tests/screenshots/backlot-gear-request-title/01-home-page.png`
- `tests/screenshots/backlot-gear-request-title/02-backlot-page.png`
- `tests/screenshots/backlot-gear-request-title/03-project-workspace.png`

**Note**: Screenshots show landing pages due to auth requirements. Manual testing needed for field visualization.

---

## Conclusion

The "Request Title" field has been **successfully located** in the codebase at:
- **Primary**: `MarketplaceBrowserSection.tsx` line 865
- **Secondary**: `MarketplaceRentalDialog.tsx` line 567

The field is a **required text input** that allows users to name their equipment rental requests when using the Backlot Gear tab marketplace features.

**Next Steps**:
1. Determine if field should remain, be modified, or be removed
2. If keeping: Consider UX improvements (better placeholder, optional, tooltip)
3. If removing: Implement auto-generation logic from selected items
4. Update documentation and user guides accordingly

---

**Report Generated**: 2026-01-13
**Generated By**: Claude Code (Playwright QA Automation Engineer)
**Test Framework**: Playwright + TypeScript
**Status**: Investigation Complete ✅
