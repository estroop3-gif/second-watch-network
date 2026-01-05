# Performance Diagnostics Guide

This document explains how to measure cold start latency and identify performance bottlenecks in Second Watch Network.

## Overview

The instrumentation captures:
- **Lambda cold start vs warm request timing**
- **API endpoint durations**
- **Frontend initial load timing**
- **Login flow timing**

## Instrumented Endpoints

### Key Backend Endpoints
| Endpoint | Purpose | Expected Cold | Expected Warm |
|----------|---------|---------------|---------------|
| `/health` | Basic health check | 2-5s | <100ms |
| `/api/v1/auth/me` | Validate token, get user | 2-5s | 200-500ms |
| `/api/v1/profiles/me` | Get user profile | 2-5s | 200-500ms |
| `/api/v1/auth/signin` | Cognito authentication | 2-5s | 300-600ms |

### Client Metrics Endpoints
| Endpoint | Purpose |
|----------|---------|
| `POST /api/v1/client-metrics/initial-load` | Frontend load timing |
| `POST /api/v1/client-metrics/login` | Login flow timing |

## How to Trigger a Cold Start Test

### Step 1: Force a Cold Start
Wait at least **10-15 minutes** without any traffic to allow Lambda containers to be recycled. Alternatively:
```bash
# Deploy a trivial change to force new containers
cd backend && sam deploy
```

### Step 2: Test from Mobile (Primary Use Case)
1. Clear browser cache and cookies
2. Navigate to `https://www.secondwatchnetwork.com`
3. Open browser DevTools > Console
4. Watch for `[PerfMetrics]` console logs
5. Attempt to log in

### Step 3: Test from CLI (for precise measurement)
```bash
# Cold start test - hit health endpoint
time curl -s -w "\n\nTotal: %{time_total}s\nTTFB: %{time_starttransfer}s\n" \
  https://vnvvoelid6.execute-api.us-east-1.amazonaws.com/health

# Wait 1 minute, then test warm
sleep 60

# Warm test
time curl -s -w "\n\nTotal: %{time_total}s\nTTFB: %{time_starttransfer}s\n" \
  https://vnvvoelid6.execute-api.us-east-1.amazonaws.com/health
```

## Reading CloudWatch Logs

### Lambda REPORT Lines
Look for REPORT lines which show Init Duration (only on cold starts):
```
REPORT RequestId: abc-123 Duration: 245.67 ms Billed Duration: 246 ms Memory Size: 512 MB Max Memory Used: 180 MB Init Duration: 3456.78 ms
```

- **Init Duration**: Time to load the Lambda container (cold start overhead)
- **Duration**: Time to execute the handler (your code)
- **Billed Duration**: What you pay for

### CloudWatch Logs Insights Queries

#### Find Cold Start Requests
```sql
fields @timestamp, @message
| filter event = "lambda_request_end" and cold_start = true
| sort @timestamp desc
| limit 100
```

#### Compare Cold vs Warm Durations
```sql
fields @timestamp, path, handler_duration_ms, cold_start
| filter event = "lambda_request_end"
| stats avg(handler_duration_ms) as avg_duration,
        count(*) as request_count
  by cold_start, path
| sort cold_start, path
```

#### Find Slow Requests (>2s)
```sql
fields @timestamp, path, handler_duration_ms, cold_start
| filter event = "lambda_request_end" and handler_duration_ms > 2000
| sort handler_duration_ms desc
| limit 50
```

#### Client Initial Load Metrics
```sql
fields @timestamp,
       js_bundle_loaded_ms,
       app_mounted_ms,
       auth_check_duration_ms,
       first_api_call_duration_ms,
       total_bootstrap_ms,
       auth_had_token,
       auth_token_valid
| filter event = "client_metrics_initial_load"
| sort @timestamp desc
| limit 50
```

#### Client Login Metrics
```sql
fields @timestamp,
       cognito_duration_ms,
       bootstrap_duration_ms,
       total_login_duration_ms,
       success,
       retry_count
| filter event = "client_metrics_login"
| sort @timestamp desc
| limit 50
```

## Frontend Console Logs

The frontend logs timing summaries to the browser console:

### Initial Load Summary
```
[PerfMetrics] Initial Load Summary: {
  bundleLoaded: "45ms",
  appMounted: "120ms",
  authCheckDuration: "2450ms",
  firstApiCall: "/api/v1/auth/me (2300ms)",
  hadToken: true,
  tokenValid: true
}
```

### Login Summary
```
[PerfMetrics] Login Summary: {
  cognitoDuration: "1200ms",
  bootstrapDuration: "450ms",
  totalDuration: "1650ms",
  success: true,
  retryCount: 0
}
```

## Key Metrics to Compare

### Cold Start Run
| Metric | Location | Expected |
|--------|----------|----------|
| Lambda Init Duration | CloudWatch REPORT | 2-5s |
| First request duration | CloudWatch logs | 2-5s total |
| Frontend first API call | Console/CloudWatch | 2-5s |
| Total bootstrap time | Console | 3-7s |

### Warm Run
| Metric | Location | Expected |
|--------|----------|----------|
| Lambda Init Duration | N/A (warm) | 0 |
| Request duration | CloudWatch logs | 100-500ms |
| Frontend first API call | Console/CloudWatch | 200-500ms |
| Total bootstrap time | Console | 500ms-1s |

## Structured Log Fields

### Backend Request Logs
```json
{
  "event": "request_end",
  "method": "GET",
  "path": "/api/v1/auth/me",
  "status_code": 200,
  "duration_ms": 245.67,
  "cold_start": true,
  "process_age_ms": 3456.78,
  "context": {
    "request_id": "abc-123",
    "user_id": "user-456"
  }
}
```

### Lambda Handler Logs
```json
{
  "event": "lambda_request_start",
  "request_id": "abc-123",
  "method": "GET",
  "path": "/api/v1/auth/me",
  "cold_start": true,
  "process_age_ms": 100.5,
  "time_since_module_load_ms": 50.2,
  "remaining_time_ms": 29000
}
```

### Client Metrics Logs
```json
{
  "event": "client_metrics_initial_load",
  "js_bundle_loaded_ms": 45,
  "app_mounted_ms": 120,
  "auth_check_duration_ms": 2450,
  "first_api_call_duration_ms": 2300,
  "total_bootstrap_ms": 2500,
  "auth_had_token": true,
  "auth_token_valid": true,
  "nav_ttfb_ms": 85,
  "nav_dom_interactive_ms": 450,
  "viewport": "375x812",
  "connection_type": "4g"
}
```

## Diagnosing Common Issues

### "Loading platform" hangs on first visit
1. Check Lambda cold start time in CloudWatch REPORT
2. Look for `cold_start: true` in request logs
3. Compare `handler_duration_ms` between cold and warm

### First login shows "loading failed"
1. Check client-metrics logs for `first_api_call_status`
2. Look for timeout errors in CloudWatch
3. Check `retry_count` in login metrics

### Refresh loads instantly but first load slow
This confirms a cold start issue:
1. First load hits cold Lambda (2-5s)
2. Refresh hits warm Lambda (<500ms)

### Mobile slower than desktop
Check `connection_type` in client metrics:
- `4g` / `3g` / `2g` - Network latency
- Check `nav_ttfb_ms` for server response time
- Check viewport size for render performance

## Files Modified

### Backend
- `backend/app/core/logging.py` - Cold start detection (`is_cold_start()`, `mark_warm()`)
- `backend/app/main.py` - Request middleware with cold start tracking
- `backend/handler.py` - Lambda handler with structured timing logs
- `backend/app/api/client_metrics.py` - New endpoint for client metrics

### Frontend
- `frontend/src/lib/performanceMetrics.ts` - Performance metrics service
- `frontend/src/App.tsx` - App mount tracking
- `frontend/src/context/AuthContext.tsx` - Auth check timing
- `frontend/src/components/forms/LoginForm.tsx` - Login flow timing
