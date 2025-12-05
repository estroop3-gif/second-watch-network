#!/usr/bin/env python3
"""
Authentication API Test Script
Tests all authentication endpoints to verify they're working correctly.
"""
import requests
import json
import sys
from datetime import datetime

# Configuration
BASE_URL = "http://localhost:8000/api/v1"
TEST_EMAIL = f"testuser{datetime.now().strftime('%Y%m%d%H%M%S')}@gmail.com"
TEST_PASSWORD = "TestPassword123!"
TEST_FULL_NAME = "Test User"

# Colors for output
GREEN = '\033[92m'
RED = '\033[91m'
YELLOW = '\033[93m'
BLUE = '\033[94m'
RESET = '\033[0m'

def print_success(message):
    print(f"{GREEN}✓ {message}{RESET}")

def print_error(message):
    print(f"{RED}✗ {message}{RESET}")

def print_info(message):
    print(f"{BLUE}ℹ {message}{RESET}")

def print_warning(message):
    print(f"{YELLOW}⚠ {message}{RESET}")

def test_health_check():
    """Test if the backend is running"""
    print_info("Testing backend health check...")
    try:
        response = requests.get("http://localhost:8000/")
        if response.status_code == 200:
            data = response.json()
            print_success(f"Backend is running: {data['app']} v{data['version']}")
            return True
        else:
            print_error(f"Backend returned status code: {response.status_code}")
            return False
    except requests.exceptions.ConnectionError:
        print_error("Cannot connect to backend at http://localhost:8000")
        print_warning("Make sure the backend is running with: cd backend && python3 -m uvicorn app.main:app --reload --port 8000")
        return False
    except Exception as e:
        print_error(f"Health check failed: {str(e)}")
        return False

def test_signup():
    """Test user signup"""
    print_info(f"Testing signup with email: {TEST_EMAIL}")
    try:
        response = requests.post(
            f"{BASE_URL}/auth/signup",
            json={
                "email": TEST_EMAIL,
                "password": TEST_PASSWORD,
                "full_name": TEST_FULL_NAME
            }
        )

        if response.status_code == 200:
            data = response.json()
            if "access_token" in data and "user" in data:
                print_success(f"Signup successful! Token received: {data['access_token'][:20]}...")
                print_success(f"User created: {data['user'].get('email', 'N/A')}")
                return data["access_token"], data["user"]
            else:
                print_error("Signup response missing required fields")
                print_warning(f"Response: {json.dumps(data, indent=2)}")
                return None, None
        else:
            print_error(f"Signup failed with status {response.status_code}")
            print_warning(f"Response: {response.text}")
            return None, None
    except Exception as e:
        print_error(f"Signup request failed: {str(e)}")
        return None, None

def test_get_current_user(token):
    """Test getting current user with token"""
    print_info("Testing /auth/me endpoint...")
    try:
        response = requests.get(
            f"{BASE_URL}/auth/me",
            headers={"Authorization": f"Bearer {token}"}
        )

        if response.status_code == 200:
            data = response.json()
            print_success(f"Retrieved user info: {data.get('email', 'N/A')}")
            return True
        else:
            print_error(f"Get current user failed with status {response.status_code}")
            print_warning(f"Response: {response.text}")
            return False
    except Exception as e:
        print_error(f"Get current user request failed: {str(e)}")
        return False

def test_signin():
    """Test user signin"""
    print_info(f"Testing signin with email: {TEST_EMAIL}")
    try:
        response = requests.post(
            f"{BASE_URL}/auth/signin",
            json={
                "email": TEST_EMAIL,
                "password": TEST_PASSWORD
            }
        )

        if response.status_code == 200:
            data = response.json()
            if "access_token" in data:
                print_success(f"Signin successful! Token received: {data['access_token'][:20]}...")
                return data["access_token"]
            else:
                print_error("Signin response missing access_token")
                return None
        else:
            print_error(f"Signin failed with status {response.status_code}")
            print_warning(f"Response: {response.text}")
            return None
    except Exception as e:
        print_error(f"Signin request failed: {str(e)}")
        return None

def test_invalid_signin():
    """Test signin with invalid credentials"""
    print_info("Testing signin with invalid credentials...")
    try:
        response = requests.post(
            f"{BASE_URL}/auth/signin",
            json={
                "email": TEST_EMAIL,
                "password": "WrongPassword123!"
            }
        )

        if response.status_code == 401:
            print_success("Correctly rejected invalid credentials")
            return True
        else:
            print_error(f"Expected 401, got {response.status_code}")
            return False
    except Exception as e:
        print_error(f"Invalid signin test failed: {str(e)}")
        return False

def test_me_without_token():
    """Test /me endpoint without token"""
    print_info("Testing /auth/me without token...")
    try:
        response = requests.get(f"{BASE_URL}/auth/me")

        if response.status_code == 403 or response.status_code == 401:
            print_success("Correctly rejected request without token")
            return True
        else:
            print_error(f"Expected 401/403, got {response.status_code}")
            return False
    except Exception as e:
        print_error(f"Test without token failed: {str(e)}")
        return False

def test_signout(token):
    """Test user signout"""
    print_info("Testing signout...")
    try:
        response = requests.post(
            f"{BASE_URL}/auth/signout",
            headers={"Authorization": f"Bearer {token}"}
        )

        if response.status_code == 200:
            data = response.json()
            print_success(f"Signout successful: {data.get('message', 'OK')}")
            return True
        else:
            print_error(f"Signout failed with status {response.status_code}")
            return False
    except Exception as e:
        print_error(f"Signout request failed: {str(e)}")
        return False

def main():
    """Run all authentication tests"""
    print("\n" + "="*60)
    print(f"{BLUE}Second Watch Network - Authentication Test Suite{RESET}")
    print("="*60 + "\n")

    results = {
        "total": 0,
        "passed": 0,
        "failed": 0
    }

    # Test 1: Health Check
    results["total"] += 1
    if test_health_check():
        results["passed"] += 1
    else:
        results["failed"] += 1
        print_error("Backend is not running. Exiting tests.")
        sys.exit(1)

    print("\n" + "-"*60 + "\n")

    # Test 2: Signup
    results["total"] += 1
    token, user = test_signup()
    if token:
        results["passed"] += 1
    else:
        results["failed"] += 1
        print_error("Cannot continue tests without successful signup")
        sys.exit(1)

    print("\n" + "-"*60 + "\n")

    # Test 3: Get Current User
    results["total"] += 1
    if test_get_current_user(token):
        results["passed"] += 1
    else:
        results["failed"] += 1

    print("\n" + "-"*60 + "\n")

    # Test 4: Get User Without Token
    results["total"] += 1
    if test_me_without_token():
        results["passed"] += 1
    else:
        results["failed"] += 1

    print("\n" + "-"*60 + "\n")

    # Test 5: Signin
    results["total"] += 1
    new_token = test_signin()
    if new_token:
        results["passed"] += 1
    else:
        results["failed"] += 1

    print("\n" + "-"*60 + "\n")

    # Test 6: Invalid Signin
    results["total"] += 1
    if test_invalid_signin():
        results["passed"] += 1
    else:
        results["failed"] += 1

    print("\n" + "-"*60 + "\n")

    # Test 7: Signout
    results["total"] += 1
    if test_signout(new_token or token):
        results["passed"] += 1
    else:
        results["failed"] += 1

    # Print Summary
    print("\n" + "="*60)
    print(f"{BLUE}Test Summary{RESET}")
    print("="*60)
    print(f"Total Tests: {results['total']}")
    print(f"{GREEN}Passed: {results['passed']}{RESET}")
    print(f"{RED}Failed: {results['failed']}{RESET}")

    if results['failed'] == 0:
        print(f"\n{GREEN}All tests passed! ✓{RESET}\n")
        sys.exit(0)
    else:
        print(f"\n{RED}Some tests failed. Check the output above for details.{RESET}\n")
        sys.exit(1)

if __name__ == "__main__":
    main()
