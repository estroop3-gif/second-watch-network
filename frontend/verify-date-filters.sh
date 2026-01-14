#!/bin/bash

# Gear Marketplace Date Filters - Verification Script
# This script checks if the date filter code is present and correctly implemented

echo "======================================================================"
echo "  Gear Marketplace Date Filters - Code Verification"
echo "======================================================================"
echo ""

FRONTEND_DIR="/home/estro/second-watch-network/frontend"
MARKETPLACE_VIEW="$FRONTEND_DIR/src/components/gear/marketplace/MarketplaceView.tsx"
DRAWER_VIEW="$FRONTEND_DIR/src/components/gear/marketplace/GearHouseDrawer.tsx"

echo "Checking files..."
echo ""

# Check if files exist
if [ ! -f "$MARKETPLACE_VIEW" ]; then
    echo "❌ ERROR: MarketplaceView.tsx not found"
    exit 1
fi

if [ ! -f "$DRAWER_VIEW" ]; then
    echo "❌ ERROR: GearHouseDrawer.tsx not found"
    exit 1
fi

echo "✓ Files found"
echo ""

# Check MarketplaceView.tsx for date filter code
echo "======================================================================"
echo "1. Checking MarketplaceView.tsx"
echo "======================================================================"
echo ""

echo "Checking for date range state..."
if grep -q "const \[dateRange, setDateRange\] = useState" "$MARKETPLACE_VIEW"; then
    echo "✅ Date range state found"
else
    echo "❌ Date range state NOT found"
fi

echo ""
echo "Checking for date input fields..."
if grep -q 'type="date"' "$MARKETPLACE_VIEW"; then
    echo "✅ Date input fields found"
    DATE_INPUT_COUNT=$(grep -c 'type="date"' "$MARKETPLACE_VIEW")
    echo "   Found $DATE_INPUT_COUNT date input(s)"
else
    echo "❌ Date input fields NOT found"
fi

echo ""
echo "Checking for conditional rendering (browseMode === 'rentals')..."
if grep -q "browseMode === 'rentals'" "$MARKETPLACE_VIEW"; then
    echo "✅ Conditional rendering found"
else
    echo "❌ Conditional rendering NOT found"
fi

echo ""
echo "Checking for clear button..."
if grep -q '<X className="h-4 w-4" />' "$MARKETPLACE_VIEW" || grep -q 'onClick={() => setDateRange({})}' "$MARKETPLACE_VIEW"; then
    echo "✅ Clear button found"
else
    echo "❌ Clear button NOT found"
fi

echo ""
echo "Checking for API integration..."
if grep -q 'available_from: dateRange.available_from' "$MARKETPLACE_VIEW" && \
   grep -q 'available_to: dateRange.available_to' "$MARKETPLACE_VIEW"; then
    echo "✅ API integration found"
else
    echo "❌ API integration NOT found"
fi

echo ""
echo "======================================================================"
echo "2. Checking GearHouseDrawer.tsx"
echo "======================================================================"
echo ""

echo "Checking for date range state..."
if grep -q "const \[dateRange, setDateRange\] = useState" "$DRAWER_VIEW"; then
    echo "✅ Date range state found"
else
    echo "❌ Date range state NOT found"
fi

echo ""
echo "Checking for date input fields..."
if grep -q 'type="date"' "$DRAWER_VIEW"; then
    echo "✅ Date input fields found"
    DATE_INPUT_COUNT=$(grep -c 'type="date"' "$DRAWER_VIEW")
    echo "   Found $DATE_INPUT_COUNT date input(s)"
else
    echo "❌ Date input fields NOT found"
fi

echo ""
echo "Checking for placeholder text..."
if grep -q 'placeholder="Available from"' "$DRAWER_VIEW" && \
   grep -q 'placeholder="Available to"' "$DRAWER_VIEW"; then
    echo "✅ Placeholder text found"
else
    echo "❌ Placeholder text NOT found"
fi

echo ""
echo "Checking for API integration..."
if grep -q 'available_from: dateRange.available_from' "$DRAWER_VIEW" && \
   grep -q 'available_to: dateRange.available_to' "$DRAWER_VIEW"; then
    echo "✅ API integration found"
else
    echo "❌ API integration NOT found"
fi

echo ""
echo "======================================================================"
echo "3. Checking Frontend Server"
echo "======================================================================"
echo ""

# Check if frontend is running
if curl -s http://localhost:8080 > /dev/null; then
    echo "✅ Frontend server is running on http://localhost:8080"
else
    echo "⚠️  Frontend server is NOT running"
    echo "   Start it with: cd $FRONTEND_DIR && npm run dev"
fi

echo ""
echo "======================================================================"
echo "4. Test Files Created"
echo "======================================================================"
echo ""

TEST_FILES=(
    "tests/e2e/gear-marketplace-date-filters.spec.ts"
    "tests/e2e/gear-marketplace-date-filters-manual.spec.ts"
    "inspect-date-filters.html"
    "MARKETPLACE_DATE_FILTERS_DIAGNOSIS.md"
    "TESTING_SUMMARY.md"
)

for file in "${TEST_FILES[@]}"; do
    if [ -f "$FRONTEND_DIR/$file" ]; then
        echo "✅ $file"
    else
        echo "❌ $file NOT found"
    fi
done

echo ""
echo "======================================================================"
echo "Summary"
echo "======================================================================"
echo ""

# Count checks
MARKETPLACE_CHECKS=5
DRAWER_CHECKS=4

echo "Code Implementation Status:"
echo "  MarketplaceView.tsx: Checking $MARKETPLACE_CHECKS key features"
echo "  GearHouseDrawer.tsx: Checking $DRAWER_CHECKS key features"
echo ""

echo "Next Steps:"
echo "  1. Ensure frontend server is running:"
echo "     cd $FRONTEND_DIR && npm run dev"
echo ""
echo "  2. Open the inspection guide in a browser:"
echo "     firefox $FRONTEND_DIR/inspect-date-filters.html"
echo ""
echo "  3. OR run the manual test with Playwright:"
echo "     cd $FRONTEND_DIR"
echo "     npx playwright test tests/e2e/gear-marketplace-date-filters-manual.spec.ts --headed"
echo ""
echo "  4. Review the complete testing summary:"
echo "     cat $FRONTEND_DIR/TESTING_SUMMARY.md"
echo ""
echo "======================================================================"
echo ""
