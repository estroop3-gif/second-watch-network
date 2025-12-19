#!/bin/bash
# Deploy Second Watch Network API to AWS Lambda
# Requires: AWS SAM CLI, Docker

set -e

echo "=== Second Watch Network API - Lambda Deployment ==="

# Check for AWS SAM CLI
if ! command -v sam &> /dev/null; then
    echo "Error: AWS SAM CLI is not installed."
    echo "Install it: https://docs.aws.amazon.com/serverless-application-model/latest/developerguide/install-sam-cli.html"
    exit 1
fi

# Check for Docker
if ! command -v docker &> /dev/null; then
    echo "Error: Docker is not installed (required for building Lambda packages)"
    exit 1
fi

# Build the application
echo ""
echo "Building Lambda package..."
sam build --use-container

# Deploy
echo ""
echo "Deploying to AWS..."
if [ "$1" == "--guided" ]; then
    sam deploy --guided
else
    sam deploy
fi

echo ""
echo "=== Deployment Complete ==="
echo "Check the Outputs section above for your API URL"
echo ""
echo "Next steps:"
echo "1. Copy the API URL from the outputs"
echo "2. Set VITE_API_URL in Vercel environment variables"
echo "3. Redeploy your frontend on Vercel"
