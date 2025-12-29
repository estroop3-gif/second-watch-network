#!/bin/bash

###############################################################################
# Admin Community Hub Test Runner
#
# This script runs Playwright E2E tests for the Admin Community Hub page.
# It tests all functionality including:
# - Page navigation and header styling
# - Quick stats cards
# - All 4 tabs (Members, Collabs, Moderation, Settings)
# - Sub-tab navigation
# - Data loading and display
#
# Usage:
#   ./RUN_COMMUNITY_HUB_TESTS.sh [options]
#
# Options:
#   --headed        Run tests in headed mode (visible browser)
#   --debug         Run tests in debug mode with Playwright Inspector
#   --ui            Run tests in UI mode for interactive testing
#   --update-snapshots  Update visual snapshots
#
# Environment Variables:
#   ADMIN_EMAIL     Admin login email (default: eric@secondwatchnetwork.com)
#   ADMIN_PASSWORD  Admin login password (default: MyHeroIsMG1!)
#   BASE_URL        Application base URL (default: http://localhost:8080)
#
# Examples:
#   ./RUN_COMMUNITY_HUB_TESTS.sh                    # Run all tests headless
#   ./RUN_COMMUNITY_HUB_TESTS.sh --headed           # Run with visible browser
#   ./RUN_COMMUNITY_HUB_TESTS.sh --ui               # Run in interactive UI mode
#   ./RUN_COMMUNITY_HUB_TESTS.sh --debug            # Run with Playwright Inspector
###############################################################################

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

echo -e "${CYAN}================================================${NC}"
echo -e "${CYAN}  Admin Community Hub E2E Test Runner${NC}"
echo -e "${CYAN}================================================${NC}"
echo ""

# Change to project root
cd "$PROJECT_ROOT"

# Check if Playwright is installed
if ! npx playwright --version &> /dev/null; then
    echo -e "${RED}Error: Playwright is not installed${NC}"
    echo -e "${YELLOW}Installing Playwright...${NC}"
    npm install --save-dev @playwright/test
    npx playwright install chromium
fi

# Set default environment variables
export ADMIN_EMAIL="${ADMIN_EMAIL:-eric@secondwatchnetwork.com}"
export ADMIN_PASSWORD="${ADMIN_PASSWORD:-MyHeroIsMG1!}"
export BASE_URL="${BASE_URL:-http://localhost:8080}"

echo -e "${BLUE}Configuration:${NC}"
echo -e "  Admin Email: ${GREEN}${ADMIN_EMAIL}${NC}"
echo -e "  Base URL: ${GREEN}${BASE_URL}${NC}"
echo ""

# Parse command line arguments
PLAYWRIGHT_ARGS=""
MODE="default"

for arg in "$@"; do
    case $arg in
        --headed)
            PLAYWRIGHT_ARGS="$PLAYWRIGHT_ARGS --headed"
            MODE="headed"
            shift
            ;;
        --debug)
            PLAYWRIGHT_ARGS="$PLAYWRIGHT_ARGS --debug"
            MODE="debug"
            shift
            ;;
        --ui)
            MODE="ui"
            shift
            ;;
        --update-snapshots)
            PLAYWRIGHT_ARGS="$PLAYWRIGHT_ARGS --update-snapshots"
            shift
            ;;
        *)
            # Unknown option
            ;;
    esac
done

# Create test-results directory if it doesn't exist
mkdir -p test-results

echo -e "${YELLOW}Starting tests...${NC}"
echo ""

# Run tests based on mode
if [ "$MODE" = "ui" ]; then
    echo -e "${CYAN}Running in UI mode (interactive)${NC}"
    npx playwright test tests/e2e/admin-community-hub.spec.ts --ui
elif [ "$MODE" = "debug" ]; then
    echo -e "${CYAN}Running in debug mode with Playwright Inspector${NC}"
    npx playwright test tests/e2e/admin-community-hub.spec.ts --debug
else
    echo -e "${CYAN}Running tests in ${MODE} mode${NC}"
    npx playwright test tests/e2e/admin-community-hub.spec.ts $PLAYWRIGHT_ARGS
fi

EXIT_CODE=$?

echo ""
echo -e "${CYAN}================================================${NC}"

if [ $EXIT_CODE -eq 0 ]; then
    echo -e "${GREEN}✓ All tests passed!${NC}"
    echo ""
    echo -e "${BLUE}Test Report:${NC}"
    echo -e "  HTML Report: ${GREEN}playwright-report/index.html${NC}"
    echo -e "  JSON Results: ${GREEN}test-results/results.json${NC}"
    echo -e "  Screenshots: ${GREEN}test-results/${NC}"
    echo ""
    echo -e "${YELLOW}View the HTML report with:${NC}"
    echo -e "  npx playwright show-report"
else
    echo -e "${RED}✗ Some tests failed${NC}"
    echo ""
    echo -e "${YELLOW}Check the following for details:${NC}"
    echo -e "  HTML Report: ${BLUE}playwright-report/index.html${NC}"
    echo -e "  Screenshots: ${BLUE}test-results/${NC}"
    echo ""
    echo -e "${YELLOW}View the HTML report with:${NC}"
    echo -e "  npx playwright show-report"
    echo ""
    echo -e "${YELLOW}Re-run failed tests with:${NC}"
    echo -e "  npx playwright test tests/e2e/admin-community-hub.spec.ts --last-failed"
fi

echo -e "${CYAN}================================================${NC}"

exit $EXIT_CODE
