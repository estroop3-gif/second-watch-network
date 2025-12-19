"""
AWS Lambda Handler for Second Watch Network API
Uses Mangum to adapt FastAPI for AWS Lambda + API Gateway
"""
import sys
import traceback
from mangum import Mangum
from app.main import app

# Create the Mangum adapter
mangum_handler = Mangum(app, lifespan="off")

def handler(event, context):
    """Lambda entry point with error logging"""
    try:
        path = event.get('rawPath', event.get('path', 'N/A'))
        method = event.get('requestContext', {}).get('http', {}).get('method', event.get('httpMethod', 'N/A'))
        print(f"[LAMBDA] Request: {method} {path}", flush=True)

        response = mangum_handler(event, context)

        status = response.get('statusCode', 'N/A')
        print(f"[LAMBDA] Response status: {status}", flush=True)

        if status == 500:
            print(f"[LAMBDA] 500 Response body: {response.get('body', '')[:500]}", flush=True)

        return response
    except Exception as e:
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
