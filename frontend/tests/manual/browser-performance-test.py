#!/usr/bin/env python3
"""
Browser Performance Test for Second Watch Network Production Site
Uses requests library to simulate browser behavior and test performance
"""

import requests
import time
import json
from typing import Dict, List
import re

PRODUCTION_URL = "https://www.secondwatchnetwork.com"
API_URL = "https://vnvvoelid6.execute-api.us-east-1.amazonaws.com"

def print_header(text: str):
    print("\n" + "=" * 60)
    print(text)
    print("=" * 60)

def print_test(text: str):
    print(f"\n{text}")

def test_initial_load():
    """Test 1: Initial Load Performance"""
    print_test("TEST 1: Initial Load Performance")

    session = requests.Session()
    start = time.time()
    response = session.get(PRODUCTION_URL, timeout=10)
    load_time = (time.time() - start) * 1000

    print(f"  Status Code: {response.status_code}")
    print(f"  Load Time: {load_time:.0f}ms")
    print(f"  Response Size: {len(response.content) / 1024:.1f}KB")

    # Check headers
    print(f"\n  Response Headers:")
    for header in ['cache-control', 'content-type', 'x-cache', 'via']:
        if header in response.headers:
            print(f"    {header}: {response.headers[header]}")

    # Check for React root element
    if '<div id="root"' in response.text:
        print("  ✓ React root element found in HTML")
    else:
        print("  ✗ React root element not found")

    assert response.status_code == 200, "Homepage should return 200"
    assert load_time < 3000, f"Page should load in <3s, got {load_time:.0f}ms"

    return session, response

def test_js_assets_caching(session: requests.Session, html: requests.Response):
    """Test 2: JS Assets Caching"""
    print_test("TEST 2: JS Assets Caching")

    # Extract JS file URLs from HTML
    js_files = re.findall(r'<script[^>]*src="([^"]*\.js)"', html.text)

    if not js_files:
        print("  ✗ No JS files found in HTML")
        return

    print(f"  Found {len(js_files)} JS files")

    # Test first few JS files (just headers, not content due to brotli issues)
    for js_file in js_files[:3]:
        if not js_file.startswith('http'):
            js_url = PRODUCTION_URL + js_file
        else:
            js_url = js_file

        print(f"\n  Testing: {js_file}")

        try:
            # Use HEAD request to avoid brotli decompression issues
            response = session.head(js_url, timeout=10)
            print(f"    Status: {response.status_code}")

            cache_control = response.headers.get('cache-control', '')
            print(f"    Cache-Control: {cache_control}")

            content_encoding = response.headers.get('content-encoding', '')
            if content_encoding:
                print(f"    Content-Encoding: {content_encoding}")

            # Verify long-lived cache
            if 'max-age=31536000' in cache_control or 'immutable' in cache_control:
                print("    ✓ Has long-lived cache headers")
            else:
                print("    ✗ Missing long-lived cache headers")
        except Exception as e:
            print(f"    ✗ Error testing asset: {e}")

def test_index_html_caching(session: requests.Session):
    """Test 3: Index.html Caching"""
    print_test("TEST 3: Index.html Caching")

    response = session.get(PRODUCTION_URL, timeout=10)
    cache_control = response.headers.get('cache-control', '')

    print(f"  Cache-Control: {cache_control}")

    # Check for no-cache directives
    no_cache = any(directive in cache_control.lower() for directive in
                   ['no-cache', 'no-store', 'must-revalidate'])

    if no_cache:
        print("  ✓ index.html has appropriate no-cache headers")
    else:
        print("  ✗ index.html may be cached too aggressively")

    assert no_cache, "index.html should have no-cache directives"

def test_cache_reload(session: requests.Session, html: requests.Response):
    """Test 4: Cache Behavior on Reload"""
    print_test("TEST 4: Cache Behavior on Reload")

    # Extract a JS file
    js_files = re.findall(r'<script[^>]*src="([^"]*\.js)"', html.text)

    if not js_files:
        print("  ✗ No JS files to test")
        return

    js_url = PRODUCTION_URL + js_files[0] if not js_files[0].startswith('http') else js_files[0]

    print(f"  Testing asset: {js_files[0]}")

    try:
        # First request (use HEAD to avoid brotli issues)
        print("\n  First request:")
        start = time.time()
        response1 = session.head(js_url, timeout=10)
        time1 = (time.time() - start) * 1000
        print(f"    Time: {time1:.0f}ms")
        print(f"    X-Cache: {response1.headers.get('x-cache', 'N/A')}")

        # Second request (should be faster/cached)
        print("\n  Second request:")
        start = time.time()
        response2 = session.head(js_url, timeout=10)
        time2 = (time.time() - start) * 1000
        print(f"    Time: {time2:.0f}ms")
        print(f"    X-Cache: {response2.headers.get('x-cache', 'N/A')}")

        if time2 < time1:
            print(f"  ✓ Second request faster ({time2:.0f}ms vs {time1:.0f}ms)")
        else:
            print(f"  Note: Second request time similar or slower")
    except Exception as e:
        print(f"  ✗ Error testing cache reload: {e}")

def test_health_check():
    """Test 5: Health Check Endpoint"""
    print_test("TEST 5: Health Check Endpoint")

    # Test health check multiple times
    times = []
    responses = []

    for i in range(3):
        start = time.time()
        response = requests.get(f"{API_URL}/health", timeout=10)
        elapsed = (time.time() - start) * 1000
        times.append(elapsed)

        if response.status_code == 200:
            data = response.json()
            responses.append(data)
            print(f"\n  Request {i+1}:")
            print(f"    Time: {elapsed:.0f}ms")
            print(f"    Status: {data.get('status')}")
            print(f"    Cold Start: {data.get('cold_start')}")
            print(f"    Process Age: {data.get('process_age_ms', 0) / 1000:.1f}s")
        else:
            print(f"\n  Request {i+1}: Failed with status {response.status_code}")

        if i < 2:
            time.sleep(1)

    # Calculate average
    avg_time = sum(times) / len(times)
    print(f"\n  Average Response Time: {avg_time:.0f}ms")

    # Check cold starts
    cold_starts = [r.get('cold_start', True) for r in responses]
    if any(cold_starts[1:]):  # Check subsequent requests
        print("  ⚠ Cold starts detected in subsequent requests")
    else:
        print("  ✓ No cold starts after warmup")

    assert all(r.get('status') == 'healthy' for r in responses), "All health checks should be healthy"
    assert avg_time < 1000, f"Health check should be <1s, got {avg_time:.0f}ms"

def test_login_page():
    """Test 6: Login Page Responsiveness"""
    print_test("TEST 6: Login Page Responsiveness")

    session = requests.Session()
    start = time.time()
    response = session.get(f"{PRODUCTION_URL}/login", timeout=10)
    load_time = (time.time() - start) * 1000

    print(f"  Status Code: {response.status_code}")
    print(f"  Load Time: {load_time:.0f}ms")
    print(f"  Response Size: {len(response.content) / 1024:.1f}KB")

    # Check if page renders quickly
    if load_time < 3000:
        print("  ✓ Login page loads quickly")
    else:
        print(f"  ✗ Login page load time may be slow ({load_time:.0f}ms)")

    # Check cache headers
    cache_control = response.headers.get('cache-control', '')
    print(f"  Cache-Control: {cache_control}")

def test_cloudfront_distribution():
    """Test 7: CloudFront Distribution"""
    print_test("TEST 7: CloudFront Distribution")

    response = requests.get(PRODUCTION_URL, timeout=10)

    cf_headers = {
        'X-Cache': response.headers.get('x-cache'),
        'Via': response.headers.get('via'),
        'X-Amz-Cf-Pop': response.headers.get('x-amz-cf-pop'),
        'X-Amz-Cf-Id': response.headers.get('x-amz-cf-id')
    }

    for header, value in cf_headers.items():
        if value:
            print(f"  {header}: {value}")

    if any(cf_headers.values()):
        print("\n  ✓ CloudFront headers detected")
    else:
        print("\n  ✗ No CloudFront headers found")

def test_performance_metrics():
    """Test 8: Overall Performance Metrics"""
    print_test("TEST 8: Overall Performance Metrics")

    session = requests.Session()

    # Test multiple page loads
    load_times = []
    for i in range(3):
        start = time.time()
        response = session.get(PRODUCTION_URL, timeout=10)
        elapsed = (time.time() - start) * 1000
        load_times.append(elapsed)
        print(f"  Load {i+1}: {elapsed:.0f}ms")
        time.sleep(0.5)

    avg_load = sum(load_times) / len(load_times)
    print(f"\n  Average Load Time: {avg_load:.0f}ms")
    print(f"  Min Load Time: {min(load_times):.0f}ms")
    print(f"  Max Load Time: {max(load_times):.0f}ms")

    if avg_load < 500:
        print("  ✓ Excellent load performance")
    elif avg_load < 1000:
        print("  ✓ Good load performance")
    elif avg_load < 2000:
        print("  ⚠ Acceptable load performance")
    else:
        print("  ✗ Slow load performance")

def main():
    print_header("Second Watch Network Production Performance Tests")

    try:
        # Run all tests
        session, html = test_initial_load()
        test_js_assets_caching(session, html)
        test_index_html_caching(session)
        test_cache_reload(session, html)
        test_health_check()
        test_login_page()
        test_cloudfront_distribution()
        test_performance_metrics()

        print_header("All Tests Completed Successfully ✓")

    except AssertionError as e:
        print(f"\n✗ Test Failed: {e}")
        return 1
    except Exception as e:
        print(f"\n✗ Error: {e}")
        import traceback
        traceback.print_exc()
        return 1

    return 0

if __name__ == "__main__":
    exit(main())
