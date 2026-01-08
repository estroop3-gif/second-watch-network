# Gear House Asset Modal Inspection Test

## Overview
This Playwright test navigates to the Gear House section and inspects the asset detail/edit modal to verify the presence and functionality of the serial number field.

## Test File
`/home/estro/second-watch-network/frontend/tests/e2e/gear-asset-modal.spec.ts`

## What This Test Does

1. **Navigation**: Navigates to http://localhost:8080
2. **Authentication**: Checks if user is logged in and attempts login if needed
3. **Gear House Access**: Navigates to the Gear House section (/gear)
4. **Organization Selection**: Selects an organization if needed
5. **Asset Selection**: Clicks on an existing asset (or creates one if none exist)
6. **View Mode Inspection**: Opens asset detail modal in VIEW mode
7. **Screenshot Capture**: Takes screenshot of VIEW mode
8. **Edit Mode Activation**: Clicks "Edit Asset" button
9. **Edit Mode Inspection**: Captures EDIT mode state
10. **Field Analysis**: Inspects all form fields, specifically looking for serial number field

## Screenshots Generated

All screenshots are saved to: `/home/estro/second-watch-network/frontend/tests/screenshots/`

- `01-gear-house-page.png` - Initial Gear House page
- `02-gear-workspace-or-list.png` - Organization list or workspace
- `03-assets-list.png` - Assets list view
- `04-asset-modal-view-mode.png` - Asset detail modal in VIEW mode
- `05-asset-modal-edit-mode.png` - Asset detail modal in EDIT mode

## Running the Test

### Prerequisites
1. Backend server must be running on port 8000
2. Frontend dev server must be running on port 8080

```bash
# Terminal 1 - Start backend
cd /home/estro/second-watch-network/backend
source venv/bin/activate
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

# Terminal 2 - Start frontend
cd /home/estro/second-watch-network/frontend
npm run dev
```

### Run the Test

```bash
cd /home/estro/second-watch-network/frontend

# Run in headed mode (visible browser)
npx playwright test tests/e2e/gear-asset-modal.spec.ts --headed --project=chromium

# Run in headless mode
npx playwright test tests/e2e/gear-asset-modal.spec.ts --project=chromium

# Run with UI mode (interactive)
npx playwright test tests/e2e/gear-asset-modal.spec.ts --ui

# Debug mode (step through)
npx playwright test tests/e2e/gear-asset-modal.spec.ts --debug
```

## Expected Output

The test will output detailed information including:

- Navigation steps
- Authentication status
- Screenshot locations
- Serial number field presence in VIEW mode
- Serial number field presence in EDIT mode
- Complete list of all form fields in EDIT mode

### Example Console Output:
```
Step 1: Checking authentication...
Already logged in
Step 2: Navigating to Gear House...
Step 3: Looking for organizations...
Step 4: Looking for existing assets...
Step 5: Opening asset detail modal...
Step 6: Capturing asset detail modal in VIEW mode...
Screenshot saved: 04-asset-modal-view-mode.png
Step 7: Checking for serial number in VIEW mode...
Serial Number label visible in VIEW mode: true
Step 8: Entering EDIT mode...
Step 9: Capturing asset modal in EDIT mode...
Screenshot saved: 05-asset-modal-edit-mode.png
Step 10: Inspecting serial number field in EDIT mode...
✓ Serial number input FOUND via selector: input[id="edit-serial"]
  Current value: ""
  Editable: true
Step 11: Listing all form fields in EDIT mode...

========================================
INSPECTION SUMMARY
========================================
✓ Successfully navigated to Gear House
✓ Opened asset detail modal
✓ Viewed asset in VIEW mode
✓ Entered EDIT mode

Serial Number Field Status:
  - Present in VIEW mode: YES
  - Present in EDIT mode: YES
  - Total form fields in EDIT mode: 12

Screenshots saved to: /home/estro/second-watch-network/frontend/tests/screenshots/
========================================
```

## Test Configuration

The test is configured with:
- Base URL: http://localhost:8080
- Timeout: 60 seconds
- Browser: Chromium (can also run on Firefox)
- Screenshots: Saved on all steps
- Video: Retained on failure

## Troubleshooting

### Test fails at login
- Update login credentials in the test file
- Or ensure you're already logged in before running the test

### Cannot find Gear House
- Verify the route exists in App.tsx: `/gear`
- Check user permissions to access Gear House

### Cannot find assets
- Create at least one asset manually first
- Or let the test create a test asset (it will attempt this)

### Modal doesn't open
- Check that assets are clickable
- Verify modal component is properly rendered
- Check browser console for JavaScript errors

## Code Review Findings

Based on the source code inspection:

### File: `/home/estro/second-watch-network/frontend/src/components/gear/workspace/AssetsView.tsx`

#### Serial Number in CREATE Form (lines 587-595)
```typescript
<div>
  <Label htmlFor="serial">Serial Number</Label>
  <Input
    id="serial"
    value={serialNumber}
    onChange={(e) => setSerialNumber(e.target.value)}
    placeholder="e.g., ABC123456"
  />
</div>
```

#### Serial Number in VIEW Mode (line 969)
```typescript
<DetailItem label="Serial Number" value={asset.serial_number} mono />
```

#### Serial Number in EDIT Mode (NOT PRESENT)
The edit form (lines 821-961) includes these fields:
- Name
- Manufacturer
- Model
- Description
- Notes
- Purchase Price
- Replacement Cost
- Daily Rate
- Weekly Rate
- Monthly Rate

**ISSUE IDENTIFIED**: The serial number field is **NOT included in the edit form**, even though:
1. It exists in the CREATE form
2. It's displayed in VIEW mode
3. The GearAsset type includes it
4. The editForm state doesn't initialize it

This appears to be an oversight in the implementation.

## Recommendations

1. **Add Serial Number to Edit Form**: Include a serial number input field in the edit form between lines 847-848:
```typescript
<div>
  <Label htmlFor="edit-serial-number">Serial Number</Label>
  <Input
    id="edit-serial-number"
    value={editForm.serial_number || ''}
    onChange={(e) => setEditForm({ ...editForm, serial_number: e.target.value })}
  />
</div>
```

2. **Initialize Serial Number in Edit State**: Add `serial_number` to the `editForm` initialization on line 760:
```typescript
setEditForm({
  name: asset.name,
  manufacturer: asset.manufacturer,
  model: asset.model,
  serial_number: asset.serial_number, // ADD THIS
  description: asset.description,
  notes: asset.notes,
  // ... rest
});
```
