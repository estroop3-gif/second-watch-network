# Gear Tab "Request Title" Field - Investigation Findings

## Summary
The "Request Title" field has been located in the Backlot workspace Gear tab marketplace rental request form.

## Field Location

### Component Files
The "Request Title" field appears in **TWO** locations in the codebase:

#### 1. MarketplaceBrowserSection.tsx
- **File**: `src/components/backlot/workspace/gear/MarketplaceBrowserSection.tsx`
- **Line**: 865
- **Code**:
```tsx
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

#### 2. MarketplaceRentalDialog.tsx
- **File**: `src/components/backlot/workspace/gear/MarketplaceRentalDialog.tsx`
- **Line**: 567
- **Code**:
```tsx
<div className="space-y-2">
  <Label htmlFor="title">Request Title *</Label>
  <Input
    id="title"
    placeholder="e.g., Camera Package for Episode 3"
    value={title}
    onChange={(e) => setTitle(e.target.value)}
  />
</div>
```

#### 3. WriteOffDialog.tsx (Incident Management)
- **File**: `src/components/gear/incidents/WriteOffDialog.tsx`
- **Line**: 172
- **Code**:
```tsx
<Label className="text-sm text-muted-gray">Request Title</Label>
```
- **Note**: This appears in the Purchase Request section of the write-off dialog

## Navigation Path

To see the "Request Title" field, a user must:

1. **Navigate to Backlot**
   - URL: `http://localhost:8080/backlot`

2. **Open a Project**
   - Click on a project card or navigate to a project workspace
   - URL pattern: `http://localhost:8080/backlot/project/{projectId}`

3. **Click on Gear Tab**
   - In the project workspace, find and click the "Gear" tab
   - This tab is part of the main workspace navigation tabs

4. **Access Marketplace/Rental Features**
   - Click "Browse Marketplace" button OR "Request Rental" button
   - This opens either:
     - `MarketplaceBrowserSection` - Embedded marketplace browser
     - `MarketplaceRentalDialog` - Direct rental request dialog

5. **View the Form**
   - The "Request Title" field appears at the top of the rental request form
   - It's a required field (marked with asterisk *)
   - Placeholder text suggests usage: "e.g., Camera Package for Main Unit"

## Component Hierarchy

```
BacklotWorkspace
  └─ GearView (src/components/backlot/workspace/GearView.tsx)
      ├─ MarketplaceBrowserSection
      │   └─ Request Form
      │       └─ "Request Title" input field
      │
      └─ MarketplaceRentalDialog
          └─ Request Form
              └─ "Request Title" input field
```

## Form Fields Context

The "Request Title" field is part of a larger rental request form that includes:

1. **Request Title** * (the field in question)
2. **Start Date** * (or Rental Start)
3. **End Date** * (or Rental End)
4. **Budget Integration** (toggle for auto-create line item)
5. **Budget Line Item** (optional link to budget)
6. **Notes** (optional additional information)

## Field Purpose

Based on the code context, the "Request Title" field is used to:
- Provide a descriptive name for the rental request
- Help users identify and track rental requests
- Link rental requests to budget line items
- Appears in the rental request workflow for production equipment

## Question: Should This Field Be There?

The field name "Request Title" might be questioned because:
- It could be seen as redundant if the gear items already have names
- The title might be auto-generated from the selected items
- It adds an extra step in the rental request workflow

However, it serves the purpose of:
- Allowing users to create custom descriptions for complex requests
- Grouping multiple items under a single request
- Providing context beyond individual item names
- Example: "Camera Package for Episode 3" bundles multiple related items

## Issue Context

If the issue is that this field **shouldn't be there**, possible reasons:
1. It's redundant with other fields
2. It should be auto-populated instead of requiring user input
3. It's causing UX confusion
4. It's breaking the rental request flow
5. It was added by mistake or for a feature that's no longer needed

## Recommended Actions

1. **Verify the requirement**: Confirm whether this field should exist
2. **Check related issues**: Look for bug reports or feature requests about this field
3. **Review UX flow**: Determine if the field adds value or creates friction
4. **Consider alternatives**:
   - Auto-generate title from selected items
   - Make it optional instead of required
   - Remove it if truly unnecessary
   - Rename it to be more clear (e.g., "Request Name" or "Description")

## Test Results

### Automated Test Challenges
The automated Playwright tests encountered challenges:
- Requires authentication (user must be logged in)
- Requires an existing project with Gear tab access
- Requires specific user permissions for the Backlot feature
- The navigation flow is multi-step and depends on application state

### Manual Verification Needed
To visually confirm and screenshot this field:
1. Log in to the application
2. Create or access a Backlot project
3. Navigate to the Gear tab
4. Click marketplace/rental features
5. Observe the "Request Title" field in the form

## Code References

### Component Imports
- Used by: `GearView.tsx` (lines 49-50)
- Hook used: `useCreateRentalRequest` from `@/hooks/gear/useGearMarketplace`

### State Management
```tsx
const [title, setTitle] = useState<string>('');
```

### Validation
- Field is marked as required with `*`
- No visible client-side validation code in the snippet
- Likely validated on form submission

## Files to Review

If modifications are needed:
1. `src/components/backlot/workspace/gear/MarketplaceBrowserSection.tsx` (line 865)
2. `src/components/backlot/workspace/gear/MarketplaceRentalDialog.tsx` (line 567)
3. `src/hooks/gear/useGearMarketplace.ts` (API hook for creating rental requests)
4. Backend API endpoint for rental request creation (likely in `/backend/app/api/`)

---

**Test Date**: 2026-01-13
**Tester**: Claude Code (Playwright QA Automation)
**Status**: Field Located ✓ | Visual Confirmation Pending
