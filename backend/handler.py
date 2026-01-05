"""
AWS Lambda Handler for Second Watch Network API
Uses Mangum to adapt FastAPI for AWS Lambda + API Gateway

Performance instrumentation:
- Tracks cold start vs warm requests
- Logs Lambda request timing details
- Correlates with CloudWatch REPORT lines (Init Duration, Duration, Billed Duration)
"""
import json
import sys
import time
import traceback
from mangum import Mangum
from app.main import app
from app.core.logging import is_cold_start, get_process_age_ms

# Create the Mangum adapter
mangum_handler = Mangum(app, lifespan="off")

# Module load time - this happens during Lambda init phase
_module_load_time = time.time()


def handler(event, context):
    """
    Lambda entry point with performance instrumentation.

    Logs structured timing info that can be correlated with CloudWatch REPORT lines:
    - REPORT RequestId: xxx Duration: xxx ms Billed Duration: xxx ms Memory Size: xxx MB Max Memory Used: xxx MB Init Duration: xxx ms

    The Init Duration only appears on cold starts, so our cold_start flag helps correlate.
    """
    request_start = time.time()
    cold_start = is_cold_start()

    try:
        # Extract request info
        path = event.get('rawPath', event.get('path', 'N/A'))
        method = event.get('requestContext', {}).get('http', {}).get('method', event.get('httpMethod', 'N/A'))
        request_id = context.aws_request_id if context else 'local'

        # Calculate time from module load to request (approximates init overhead)
        time_since_module_load_ms = (request_start - _module_load_time) * 1000

        # Structured log for CloudWatch Logs Insights queries
        print(json.dumps({
            "event": "lambda_request_start",
            "request_id": request_id,
            "method": method,
            "path": path,
            "cold_start": cold_start,
            "process_age_ms": round(get_process_age_ms(), 2),
            "time_since_module_load_ms": round(time_since_module_load_ms, 2),
            "remaining_time_ms": context.get_remaining_time_in_millis() if context else None,
        }), flush=True)

        # Execute request
        response = mangum_handler(event, context)

        # Calculate request duration
        request_end = time.time()
        handler_duration_ms = (request_end - request_start) * 1000

        status = response.get('statusCode', 'N/A')

        # Structured completion log
        print(json.dumps({
            "event": "lambda_request_end",
            "request_id": request_id,
            "method": method,
            "path": path,
            "status_code": status,
            "cold_start": cold_start,
            "handler_duration_ms": round(handler_duration_ms, 2),
            "process_age_ms": round(get_process_age_ms(), 2),
        }), flush=True)

        if status == 500:
            print(f"[LAMBDA] 500 Response body: {response.get('body', '')[:500]}", flush=True)

        return response
    except Exception as e:
        request_end = time.time()
        handler_duration_ms = (request_end - request_start) * 1000

        print(json.dumps({
            "event": "lambda_request_error",
            "request_id": context.aws_request_id if context else 'local',
            "cold_start": cold_start,
            "handler_duration_ms": round(handler_duration_ms, 2),
            "error": str(e),
            "error_type": type(e).__name__,
        }), flush=True)

        print(f"[LAMBDA ERROR] {str(e)}", file=sys.stderr, flush=True)
        print(traceback.format_exc(), file=sys.stderr, flush=True)

        return {
            "statusCode": 500,
            "headers": {
                "Content-Type": "application/json",
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Credentials": "true",
            },
            "body": f'{{"detail": "Internal server error: {str(e)}"}}'
        }
