#!/bin/bash

# Production Performance Verification Script
# Tests Second Watch Network production site performance and caching

PRODUCTION_URL="https://www.secondwatchnetwork.com"
API_URL="https://vnvvoelid6.execute-api.us-east-1.amazonaws.com"

echo "=================================="
echo "Production Performance Tests"
echo "=================================="
echo ""

# Test 1: Homepage Load Time
echo "1. Testing homepage load performance..."
START_TIME=$(date +%s%3N)
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" -L "$PRODUCTION_URL")
END_TIME=$(date +%s%3N)
LOAD_TIME=$((END_TIME - START_TIME))

if [ "$HTTP_CODE" = "200" ]; then
    echo "   ✓ Homepage returned 200 OK"
    echo "   ✓ Load time: ${LOAD_TIME}ms"
else
    echo "   ✗ Homepage returned HTTP $HTTP_CODE"
fi
echo ""

# Test 2: Check index.html cache headers
echo "2. Checking index.html cache headers..."
HEADERS=$(curl -sI "$PRODUCTION_URL" | grep -i "cache-control")
echo "   Cache-Control: $HEADERS"

if echo "$HEADERS" | grep -iq "no-cache\|no-store\|must-revalidate"; then
    echo "   ✓ index.html has appropriate no-cache headers"
else
    echo "   ⚠ index.html may be cached aggressively"
fi
echo ""

# Test 3: Check JS asset cache headers
echo "3. Checking JS asset cache headers..."
# Fetch the page and extract a JS file URL
JS_URL=$(curl -sL "$PRODUCTION_URL" | grep -oP 'src="(/assets/[^"]*\.js)"' | head -1 | sed 's/src="//;s/"$//')

if [ -n "$JS_URL" ]; then
    FULL_JS_URL="$PRODUCTION_URL$JS_URL"
    echo "   Testing: $FULL_JS_URL"

    JS_HEADERS=$(curl -sI "$FULL_JS_URL" | grep -i "cache-control")
    echo "   Cache-Control: $JS_HEADERS"

    if echo "$JS_HEADERS" | grep -q "max-age=31536000\|immutable"; then
        echo "   ✓ JS assets have long-lived cache headers"
    else
        echo "   ⚠ JS assets may not have optimal caching"
    fi
else
    echo "   ⚠ Could not extract JS URL from homepage"
fi
echo ""

# Test 4: Health Check
echo "4. Testing health check endpoint..."
HEALTH_RESPONSE=$(curl -s "$API_URL/health")
echo "   Response: $HEALTH_RESPONSE"

if echo "$HEALTH_RESPONSE" | grep -q '"status":"healthy"'; then
    echo "   ✓ Health check returned healthy status"
else
    echo "   ✗ Health check did not return healthy status"
fi

if echo "$HEALTH_RESPONSE" | grep -q '"cold_start":false'; then
    echo "   ✓ Lambda is warm (cold_start: false)"
elif echo "$HEALTH_RESPONSE" | grep -q '"cold_start":true'; then
    echo "   ⚠ Lambda had a cold start"
else
    echo "   ⚠ Could not determine cold start status"
fi
echo ""

# Test 5: Health Check Response Time (3 iterations)
echo "5. Testing health check response times..."
for i in 1 2 3; do
    START=$(date +%s%3N)
    curl -s "$API_URL/health" > /dev/null
    END=$(date +%s%3N)
    TIME=$((END - START))
    echo "   Request $i: ${TIME}ms"
    sleep 1
done
echo ""

# Test 6: Check Content-Type headers
echo "6. Checking content-type headers..."
CONTENT_TYPE=$(curl -sI "$PRODUCTION_URL" | grep -i "content-type")
echo "   $CONTENT_TYPE"
echo ""

# Test 7: Check CloudFront headers
echo "7. Checking CloudFront headers..."
CF_HEADERS=$(curl -sI "$PRODUCTION_URL" | grep -i "x-cache\|via\|x-amz-cf")
if [ -n "$CF_HEADERS" ]; then
    echo "$CF_HEADERS" | while read -r line; do
        echo "   $line"
    done
    echo "   ✓ CloudFront headers detected"
else
    echo "   ⚠ No CloudFront headers detected"
fi
echo ""

# Test 8: Check HTTPS redirect
echo "8. Testing HTTPS redirect..."
HTTP_REDIRECT=$(curl -sI "http://www.secondwatchnetwork.com" | grep -i "location")
if echo "$HTTP_REDIRECT" | grep -q "https://"; then
    echo "   ✓ HTTP redirects to HTTPS"
else
    echo "   ⚠ HTTP may not redirect to HTTPS"
fi
echo ""

# Test 9: Check response size
echo "9. Checking response sizes..."
HTML_SIZE=$(curl -sL "$PRODUCTION_URL" | wc -c)
echo "   HTML size: $((HTML_SIZE / 1024))KB"

if [ $HTML_SIZE -lt 1000000 ]; then
    echo "   ✓ HTML size is reasonable"
else
    echo "   ⚠ HTML size may be too large"
fi
echo ""

# Test 10: DNS resolution time
echo "10. Testing DNS resolution..."
DNS_TIME=$(curl -w "@-" -o /dev/null -s "$PRODUCTION_URL" <<'EOF'
DNS lookup: %{time_namelookup}s\n
TCP connect: %{time_connect}s\n
TLS handshake: %{time_appconnect}s\n
Time to first byte: %{time_starttransfer}s\n
Total time: %{time_total}s\n
EOF
)
echo "$DNS_TIME" | while read -r line; do
    echo "   $line"
done
echo ""

echo "=================================="
echo "Performance Tests Complete"
echo "=================================="
