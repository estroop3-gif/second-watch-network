#!/bin/bash
# Quick script to run Admin Forum Management tests
# Usage: ./RUN_ADMIN_FORUM_TESTS.sh

set -e

echo "========================================="
echo "Admin Forum Management - Playwright Tests"
echo "========================================="
echo ""

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    echo "Error: Must be run from frontend directory"
    echo "Usage: cd /home/estro/second-watch-network/frontend && ./tests/e2e/RUN_ADMIN_FORUM_TESTS.sh"
    exit 1
fi

# Check environment variables
if [ -z "$ADMIN_EMAIL" ] || [ -z "$ADMIN_PASSWORD" ]; then
    echo "Warning: Admin credentials not set"
    echo "Please set environment variables:"
    echo "  export ADMIN_EMAIL=\"your-admin@example.com\""
    echo "  export ADMIN_PASSWORD=\"your-admin-password\""
    echo ""
    read -p "Continue anyway? (y/N) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi

# Check if servers are running
echo "Checking if backend server is running on port 8000..."
if ! curl -s http://localhost:8000/health > /dev/null; then
    echo "Error: Backend server not running on port 8000"
    echo "Please start backend: cd backend && uvicorn app.main:app --reload"
    exit 1
fi

echo "Checking if frontend server is running on port 8080..."
if ! curl -s http://localhost:8080 > /dev/null; then
    echo "Error: Frontend server not running on port 8080"
    echo "Please start frontend: npm run dev"
    exit 1
fi

echo ""
echo "Servers are running. Starting tests..."
echo ""

# Run the tests
npx playwright test tests/e2e/admin-forum-management.spec.ts "$@"

# Check exit code
if [ $? -eq 0 ]; then
    echo ""
    echo "========================================="
    echo "✅ All tests passed!"
    echo "Admin Forum Management is correctly"
    echo "connected to the NEW community forum."
    echo "========================================="
else
    echo ""
    echo "========================================="
    echo "❌ Some tests failed!"
    echo "Check the output above for details."
    echo "See ADMIN_FORUM_TEST_GUIDE.md for help."
    echo "========================================="
    exit 1
fi
