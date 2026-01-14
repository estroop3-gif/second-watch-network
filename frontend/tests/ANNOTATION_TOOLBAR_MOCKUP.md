# Annotation Toolbar UI Mockup
## Visual Design for Continuity Tab Annotation Features

**Date**: January 10, 2026
**Purpose**: Visual reference for implementing annotation UI

---

## Proposed Toolbar Layout

### Main Annotation Toolbar (Top of PDF Viewer)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  ANNOTATION TOOLS                                                           │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  [🖊 Highlight]  [📌 Note]  [✏️ Pen]  [─ Line]  [→ Arrow]                 │
│                                                                             │
│  [□ Rectangle]  [○ Circle]  [T Text]  [🗑 Eraser]                         │
│                                                                             │
├─────────────────────────────────────────────────────────────────────────────┤
│  Color: [■ Picker]  Stroke: [1px ▾]  Opacity: [●━━━━━━○ 80%]            │
├─────────────────────────────────────────────────────────────────────────────┤
│  [↶ Undo]  [↷ Redo]  [Clear All]            [× Close Toolbar]             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Detailed Button Specifications

### Row 1: Primary Tools

#### Highlight Tool
```
┌──────────────┐
│  🖊          │
│  Highlight   │
└──────────────┘
```
- **Icon**: Highlighter marker
- **Action**: Click and drag to create rectangular highlight
- **Options**: Color, opacity
- **Keyboard**: H

#### Note Tool
```
┌──────────────┐
│  📌          │
│  Note        │
└──────────────┘
```
- **Icon**: Push pin
- **Action**: Click to place note pin, opens dialog
- **Options**: Category, critical flag
- **Keyboard**: N

#### Pen Tool
```
┌──────────────┐
│  ✏️          │
│  Pen         │
└──────────────┘
```
- **Icon**: Pencil
- **Action**: Click and drag to draw freehand
- **Options**: Color, stroke width, opacity
- **Keyboard**: P

#### Line Tool
```
┌──────────────┐
│  ─          │
│  Line        │
└──────────────┘
```
- **Icon**: Horizontal line
- **Action**: Click start point, click end point
- **Options**: Color, stroke width, opacity
- **Keyboard**: L

#### Arrow Tool
```
┌──────────────┐
│  →          │
│  Arrow       │
└──────────────┘
```
- **Icon**: Right arrow
- **Action**: Click start point, click end point
- **Options**: Color, stroke width, opacity
- **Keyboard**: A

### Row 2: Shape and Text Tools

#### Rectangle Tool
```
┌──────────────┐
│  □          │
│  Rectangle   │
└──────────────┘
```
- **Icon**: Empty square
- **Action**: Click and drag to create rectangle
- **Options**: Color (stroke/fill), stroke width, opacity
- **Keyboard**: R

#### Circle Tool
```
┌──────────────┐
│  ○          │
│  Circle      │
└──────────────┘
```
- **Icon**: Empty circle
- **Action**: Click and drag to create ellipse
- **Options**: Color (stroke/fill), stroke width, opacity
- **Keyboard**: C

#### Text Tool
```
┌──────────────┐
│  T          │
│  Text        │
└──────────────┘
```
- **Icon**: Letter T
- **Action**: Click to place text, opens input
- **Options**: Color, font size
- **Keyboard**: T

#### Eraser Tool
```
┌──────────────┐
│  🗑          │
│  Eraser      │
└──────────────┘
```
- **Icon**: Trash can
- **Action**: Click annotation to delete
- **Options**: None
- **Keyboard**: E

---

## Style Controls (Row 3)

### Color Picker
```
┌──────────────────────┐
│ Color: [■]           │
│        └─────────┐   │
│        │ ■ ■ ■ ■ │   │  ← Preset colors
│        │ ■ ■ ■ ■ │   │
│        │ [Custom]│   │  ← Full picker
│        └─────────┘   │
└──────────────────────┘
```
**Preset Colors**:
- Red: #FF3C3C (Primary red)
- Yellow: #FCDC58 (Accent yellow)
- Green: #00FF00
- Blue: #0000FF
- Orange: #FFA500
- Purple: #800080
- Black: #000000
- White: #FFFFFF

### Stroke Width Selector
```
┌──────────────────┐
│ Stroke: [2px ▾] │
│         ├──────┤ │
│         │ 1px  │ │
│         │ 2px ✓│ │
│         │ 3px  │ │
│         │ 5px  │ │
│         │ 8px  │ │
│         └──────┘ │
└──────────────────┘
```

### Opacity Slider
```
┌─────────────────────────────┐
│ Opacity: [●━━━━━━○] 80%    │
│          0%      50%   100% │
└─────────────────────────────┘
```
- Drag slider to adjust
- Shows percentage
- Live preview on cursor

---

## Action Buttons (Row 4)

### Undo/Redo
```
┌─────────┐  ┌─────────┐
│ ↶ Undo │  │ ↷ Redo │
└─────────┘  └─────────┘
```
- Undo: Ctrl+Z / Cmd+Z
- Redo: Ctrl+Shift+Z / Cmd+Shift+Z

### Clear All
```
┌──────────────┐
│ Clear All    │  ← With confirmation
└──────────────┘
```
- Clears all annotations on current page
- Shows confirmation dialog

### Close Toolbar
```
┌──────────────┐
│ × Close      │
└──────────────┘
```
- Hides annotation toolbar
- Annotations remain visible
- Can reopen from main toolbar

---

## Active State Indicators

### Selected Tool
```
┌──────────────┐
│  ✏️          │  ← Blue border
│  Pen         │  ← Blue background
└──────────────┘  ← Active state
    ▲
    └─ Visual indicator
```

### Hover State
```
┌──────────────┐
│  ✏️          │  ← Lighter background
│  Pen         │  ← Tooltip appears
└──────────────┘
```

### Disabled State
```
┌──────────────┐
│  ↶          │  ← Gray color
│  Undo        │  ← Can't click
└──────────────┘  ← No undo history
```

---

## Note Dialog Design

When clicking Note tool and placing pin:

```
┌─────────────────────────────────────────┐
│  Add Note                           [×] │
├─────────────────────────────────────────┤
│                                         │
│  Note Text:                             │
│  ┌─────────────────────────────────┐   │
│  │ Enter your note here...         │   │
│  │                                 │   │
│  │                                 │   │
│  └─────────────────────────────────┘   │
│                                         │
│  Category: [General ▾]                  │
│                                         │
│  ☐ Mark as Critical                     │
│                                         │
│          [Cancel]  [Save Note]          │
└─────────────────────────────────────────┘
```

**Note Categories**:
- General
- Continuity Issue
- Props
- Wardrobe
- Hair/Makeup
- Performance
- Technical

---

## Annotation Display on PDF

### Highlight Display
```
PDF Page Content
┌─────────────────────────────────────┐
│ INT. COFFEE SHOP - DAY              │
│                                     │
│ Jane enters, looking tired.         │
│ ┌─────────────────────┐             │
│ │She orders a coffee. │  ← Yellow  │
│ └─────────────────────┘     box    │
│                                     │
└─────────────────────────────────────┘
```

### Note Pin Display
```
PDF Page Content
┌─────────────────────────────────────┐
│ INT. COFFEE SHOP - DAY              │
│                           📌 ← Pin  │
│ Jane enters, looking tired.         │
│                           │         │
│ She orders a coffee.      │         │
│                    ┌──────▼──────┐  │
│                    │ Continuity: │  │
│                    │ Coffee cup  │  │
│                    │ should be   │  │
│                    │ half full   │  │
│                    └─────────────┘  │
└─────────────────────────────────────┘
```

### Drawing Display
```
PDF Page Content
┌─────────────────────────────────────┐
│ INT. COFFEE SHOP - DAY              │
│        ╱                            │
│       ╱   ← Hand-drawn              │
│      ╱       arrow                  │
│ Jane enters, looking tired.         │
│ ┌───────────────┐                   │
│ │She sits down. │  ← Rectangle     │
│ └───────────────┘                   │
└─────────────────────────────────────┘
```

---

## Annotation List Panel (Right Side)

### Panel Layout
```
┌──────────────────────────────┐
│  Annotations for Page 5      │
├──────────────────────────────┤
│  [All ▾] [🖊] [📌] [✏️]     │  ← Filters
├──────────────────────────────┤
│                              │
│  🖊 Highlight (Yellow)       │
│  "She orders a coffee"       │
│  By John Doe · 2 hrs ago     │
│  [Edit] [Delete]             │
├──────────────────────────────┤
│  📌 Note - Continuity Issue  │
│  "Coffee cup should be..."   │
│  By Jane Smith · 1 hr ago    │
│  [Edit] [Delete]             │
├──────────────────────────────┤
│  ✏️ Drawing (Arrow)          │
│  By John Doe · 30 min ago    │
│  [Edit] [Delete]             │
├──────────────────────────────┤
│                              │
└──────────────────────────────┘
```

---

## Responsive Behavior

### Full Width (Desktop)
```
┌────────────────────────────────────────────────────────┐
│  [Highlight] [Note] [Pen] [Line] [Arrow] [Rect] [Etc] │
│  Color: [■]  Stroke: [2px]  Opacity: [━━━○]          │
└────────────────────────────────────────────────────────┘
```

### Collapsed (Tablet)
```
┌────────────────────────────────────────┐
│  [More ▾]                              │
│  └────────────────┐                    │
│    │[Highlight]  │                     │
│    │[Note]       │                     │
│    │[Pen]        │                     │
│    │[Line]       │                     │
│    │...          │                     │
│    └─────────────┘                     │
│  Color: [■]  Stroke: [2px]             │
└────────────────────────────────────────┘
```

### Mobile (Vertical)
```
┌─────────────────┐
│  Tools [≡]     │  ← Hamburger menu
│  ┌──────────┐  │
│  │[🖊] [📌]│  │  ← Icon-only
│  │[✏️] [─] │  │
│  │[→] [□] │  │
│  └──────────┘  │
│  [■] [2px] [O] │  ← Compact controls
└─────────────────┘
```

---

## Color Scheme (Matches SWN Brand)

### Toolbar Background
- Background: `#1A1A1A` (Darker than charcoal-black)
- Border: `#2A2A2A`

### Button Colors
- Default: `#3A3A3A`
- Hover: `#4A4A4A`
- Active: `#FF3C3C` (Primary red)
- Text: `#F9F5EF` (Bone white)

### Annotation Colors (Default Palette)
- Red: `#FF3C3C`
- Yellow: `#FCDC58`
- Green: `#00C853`
- Blue: `#2196F3`
- Purple: `#9C27B0`
- Orange: `#FF9800`

---

## Implementation Notes

### Required Libraries

```json
{
  "react-color": "^2.19.3",      // Color picker
  "konva": "^9.2.0",             // Canvas manipulation
  "react-konva": "^18.2.10",     // React wrapper for Konva
  "framer-motion": "^12.23.12"   // Already installed - animations
}
```

### Component Structure

```
src/components/backlot/workspace/scripty/
├── annotations/
│   ├── AnnotationToolbar.tsx         ← Main toolbar
│   ├── PDFAnnotationLayer.tsx        ← Canvas overlay
│   ├── AnnotationNoteDialog.tsx      ← Note popup
│   ├── AnnotationListPanel.tsx       ← Sidebar list
│   ├── tools/
│   │   ├── HighlightTool.tsx        ← Tool-specific components
│   │   ├── NoteTool.tsx
│   │   ├── PenTool.tsx
│   │   ├── LineTool.tsx
│   │   ├── ArrowTool.tsx
│   │   ├── RectangleTool.tsx
│   │   ├── CircleTool.tsx
│   │   └── TextTool.tsx
│   └── utils/
│       ├── coordinates.ts            ← Coordinate transforms
│       ├── drawing.ts                ← Drawing utilities
│       └── colors.ts                 ← Color constants
```

---

## Integration with ScriptyWorkspace

### Modified Layout

```
ScriptyWorkspace.tsx
└── Layout
    ├── Header (existing controls)
    ├── AnnotationToolbar.tsx (NEW - toggleable)
    └── Content Area
        ├── Left: Scenes Panel
        ├── Center: LinedScriptOverlay
        │   ├── PDF Iframe (existing)
        │   └── PDFAnnotationLayer (NEW - overlay)
        └── Right: Tabs + AnnotationListPanel (NEW)
```

### State Management

```typescript
// Add to ScriptyWorkspace state:
const [annotationMode, setAnnotationMode] = useState<
  'view' | 'highlight' | 'note' | 'draw'
>('view');
const [selectedTool, setSelectedTool] = useState<DrawingToolType | null>(null);
const [toolColor, setToolColor] = useState('#FF3C3C');
const [strokeWidth, setStrokeWidth] = useState(2);
const [opacity, setOpacity] = useState(0.8);
```

---

## Accessibility Considerations

### Keyboard Shortcuts
- `H` - Activate Highlight tool
- `N` - Activate Note tool
- `P` - Activate Pen tool
- `L` - Activate Line tool
- `A` - Activate Arrow tool
- `R` - Activate Rectangle tool
- `C` - Activate Circle tool
- `T` - Activate Text tool
- `E` - Activate Eraser tool
- `Escape` - Deselect tool
- `Ctrl+Z` / `Cmd+Z` - Undo
- `Ctrl+Shift+Z` / `Cmd+Shift+Z` - Redo
- `Delete` - Delete selected annotation

### ARIA Labels
- All buttons have descriptive `aria-label` attributes
- Toolbar has `role="toolbar"`
- Tool groups have `role="group"`
- Active tool has `aria-pressed="true"`

### Screen Reader Support
- Announce tool selection
- Announce annotation creation
- Provide text alternatives for visual annotations

---

## Performance Considerations

### Optimization Strategies
1. **Lazy render**: Only render annotations for current page
2. **Debounce**: Delay save during drawing
3. **Virtual list**: For annotation list panel
4. **Canvas caching**: Cache rendered annotations
5. **Throttle mouse events**: Limit drawing update frequency

### Expected Performance
- Load time: < 500ms for annotations on page
- Drawing lag: < 16ms (60 FPS)
- Save operation: < 200ms
- Page switch: < 300ms with annotations

---

**Mockup Created By**: Claude Code QA Engineer
**For Implementation By**: Frontend development team
**Status**: Ready for development sprint planning
