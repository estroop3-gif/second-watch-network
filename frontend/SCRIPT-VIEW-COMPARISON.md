# Script Editor View Comparison Instructions

## Purpose
Compare the Script Editor's PAGE VIEW formatting with the View tab's Text viewer formatting.

## Issue
We need to examine and compare:
- **Edit Tab → PAGE VIEW**: The script editor's page view formatting
- **View Tab → Text View**: The read-only text viewer formatting

Specifically looking at:
- Font size and line height
- Page layout (margins, width)
- Element positioning (scene headings, character names, dialogue)
- Overall visual appearance

## Method 1: Interactive Script (Recommended)

Run this script when you're ready to capture screenshots:

```bash
cd /home/estro/second-watch-network/frontend
node capture-script-views.js
```

**Steps:**
1. The script will open a browser window
2. Manually log in and navigate to a script with content
3. Go to Edit tab → PAGE VIEW
4. Press ENTER in the terminal to capture the first screenshot
5. Go to View tab → Text view
6. Press ENTER in the terminal to capture the second screenshot

**Output:**
- `screenshots/FINAL-page-view-editor.png`
- `screenshots/FINAL-text-viewer.png`

## Method 2: Playwright Test

Alternatively, run the interactive Playwright test:

```bash
npx playwright test tests/e2e/interactive-script-comparison.spec.ts --headed --project=chromium
```

Then use this command in another terminal when ready to signal:

```bash
# After navigating to PAGE VIEW:
touch /home/estro/second-watch-network/frontend/screenshots/ready-signal.txt

# After navigating to Text view:
touch /home/estro/second-watch-network/frontend/screenshots/ready-signal.txt
```

## Manual Navigation Steps

### Capture PAGE VIEW:
1. Log in to http://localhost:8080
2. Navigate to Backlot workspace
3. Open a script that has content
4. Click on the **Edit** tab (or **Editor** tab)
5. Click the **Page** button to switch to PAGE VIEW mode (NOT Inline view)
6. Ensure script content is visible on screen
7. Signal ready (trigger screenshot)

### Capture TEXT VIEW:
1. Click on the **View** tab
2. Click the **Text** button to switch to Text view
3. Ensure text viewer content is visible
4. Signal ready (trigger screenshot)

## What to Look For

After capturing both screenshots, compare:

1. **Font Rendering**
   - Font family differences
   - Font size (px/pt)
   - Line height/spacing
   - Font weight

2. **Page Layout**
   - Page width (inches vs pixels)
   - Left margin
   - Right margin
   - Top/bottom padding

3. **Element Formatting**
   - **Scene Headings**: Position, indentation, capitalization
   - **Character Names**: Horizontal position, indentation
   - **Dialogue**: Left margin, right margin, width
   - **Parentheticals**: Indentation
   - **Action**: Formatting and spacing
   - **Transitions**: Position (usually right-aligned)

4. **Visual Appearance**
   - Background color
   - Text color
   - Page shadows/borders
   - Overall professional appearance

## Expected Behavior

Both views should render screenplay elements according to industry-standard formatting:
- Scene headings: Left-aligned, all caps, 1.5" from left
- Character names: 3.7" from left edge
- Dialogue: 2.5" from left, 2.5" from right
- Parentheticals: 3.1" from left
- Transitions: Right-aligned, all caps

## Files Created

Test files:
- `/home/estro/second-watch-network/frontend/tests/e2e/inspect-script-views.spec.ts`
- `/home/estro/second-watch-network/frontend/tests/e2e/manual-script-view-comparison.spec.ts`
- `/home/estro/second-watch-network/frontend/tests/e2e/interactive-script-comparison.spec.ts`

Capture script:
- `/home/estro/second-watch-network/frontend/capture-script-views.js`

Screenshot directory:
- `/home/estro/second-watch-network/frontend/screenshots/`
