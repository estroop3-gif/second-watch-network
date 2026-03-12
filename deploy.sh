#!/usr/bin/env bash
# Full deploy: backend (SAM) + frontend (S3 + CloudFront)
set -e

FRONTEND_BUCKET="swn-frontend-517220555400"
CF_DISTRIBUTION="EJRGRTMJFSXN2"
API_URL="https://vnvvoelid6.execute-api.us-east-1.amazonaws.com"

echo "=== Building frontend ==="
cd frontend
VITE_API_URL=$API_URL npm run build

echo "=== Syncing assets to S3 (long-cache for hashed files) ==="
aws s3 sync dist/assets/ s3://$FRONTEND_BUCKET/assets/ \
  --cache-control "public, max-age=31536000, immutable" \
  --delete

echo "=== Uploading index.html (no-cache) ==="
aws s3 cp dist/index.html s3://$FRONTEND_BUCKET/index.html \
  --content-type "text/html" \
  --cache-control "no-cache, no-store, must-revalidate" \
  --metadata-directive REPLACE

echo "=== Syncing remaining files ==="
aws s3 sync dist/ s3://$FRONTEND_BUCKET/ \
  --exclude "assets/*" \
  --exclude "index.html" \
  --delete

echo "=== Invalidating CloudFront (index.html only) ==="
aws cloudfront create-invalidation \
  --distribution-id $CF_DISTRIBUTION \
  --paths "/index.html" \
  --query 'Invalidation.Id' --output text

echo "=== Building + deploying backend ==="
cd ../backend
source venv/bin/activate
sam build
sam deploy --no-confirm-changeset

echo "=== Deploy complete ==="
