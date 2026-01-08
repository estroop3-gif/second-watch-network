# Quick Fix Guide: Create Asset Modal Containment Issue

## File to Edit
`/home/estro/second-watch-network/frontend/src/components/gear/workspace/AssetsView.tsx`

## Change 1: Update DialogContent (Line 539)

### BEFORE:
```tsx
<DialogContent className="sm:max-w-xl max-h-[90vh] overflow-y-auto">
```

### AFTER:
```tsx
<DialogContent className="sm:max-w-xl max-h-[90vh] flex flex-col">
```

**Changes:**
- Remove: `overflow-y-auto`
- Add: `flex flex-col`

---

## Change 2: Wrap Form in ScrollArea (Line 545)

### BEFORE:
```tsx
  <DialogHeader>
    <DialogTitle>Add New Asset</DialogTitle>
    <DialogDescription>Add a new piece of equipment to your inventory</DialogDescription>
  </DialogHeader>

  <form onSubmit={handleSubmit} className="space-y-4">
```

### AFTER:
```tsx
  <DialogHeader>
    <DialogTitle>Add New Asset</DialogTitle>
    <DialogDescription>Add a new piece of equipment to your inventory</DialogDescription>
  </DialogHeader>

  <ScrollArea className="flex-1 pr-4">
    <form onSubmit={handleSubmit} className="space-y-4">
```

**Changes:**
- Add: `<ScrollArea className="flex-1 pr-4">` before `<form>`

---

## Change 3: Close ScrollArea (Line 810)

### BEFORE:
```tsx
        </div>
      </form>

      <DialogFooter>
```

### AFTER:
```tsx
        </div>
      </form>
    </ScrollArea>

    <DialogFooter>
```

**Changes:**
- Add: `</ScrollArea>` after `</form>` and before `<DialogFooter>`

---

## Complete Code Block (Lines 537-824)

Here's the complete updated CreateAssetModal component for reference:

```tsx
return (
  <Dialog open={isOpen} onOpenChange={onClose}>
    <DialogContent className="sm:max-w-xl max-h-[90vh] flex flex-col">
      <DialogHeader>
        <DialogTitle>Add New Asset</DialogTitle>
        <DialogDescription>Add a new piece of equipment to your inventory</DialogDescription>
      </DialogHeader>

      <ScrollArea className="flex-1 pr-4">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            {/* ... all existing form fields ... */}
          </div>

          {/* Pricing Section */}
          <div className="border-t border-muted-gray/30 pt-4 mt-4">
            {/* ... existing pricing fields ... */}
          </div>

          {/* Rental Rates Section */}
          <div className="border-t border-muted-gray/30 pt-4">
            {/* ... existing rental rate fields ... */}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Additional details about this asset"
                rows={2}
              />
            </div>
          </div>

          {error && <p className="text-sm text-red-500">{error}</p>}
        </form>
      </ScrollArea>

      <DialogFooter>
        <Button type="button" variant="outline" onClick={onClose}>
          Cancel
        </Button>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
          Add Asset
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
);
```

---

## Notes

1. **ScrollArea is already imported** - No need to add imports
2. **Pattern is already used** - Same fix used in AssetDetailModal (line 891)
3. **Three line change** - Only 3 locations need modification
4. **No prop changes** - External API remains the same

---

## Verification

After making the changes:

1. Open the Gear House page
2. Click "Add Asset"
3. Click "+ Add" next to "Home Location"
4. Verify:
   - Modal stays within viewport
   - Form content scrolls
   - Footer buttons always visible
   - No content cut off

---

## Why This Works

- `flex flex-col` creates a vertical flex container
- `ScrollArea` with `flex-1` takes all available space between header and footer
- `max-h-[90vh]` on DialogContent constrains total height
- `pr-4` prevents scrollbar from overlapping content
- Header and footer remain fixed, only form content scrolls
