# Deploying Second Watch Network API to AWS Lambda

This guide walks you through deploying the FastAPI backend to AWS Lambda using AWS SAM.

## Prerequisites

1. **AWS CLI** configured with your credentials
   ```bash
   aws configure
   ```

2. **AWS SAM CLI** installed
   - macOS: `brew install aws-sam-cli`
   - Other: https://docs.aws.amazon.com/serverless-application-model/latest/developerguide/install-sam-cli.html

3. **Docker** installed and running (for building Lambda packages)

## Quick Deploy

```bash
cd backend

# First-time deployment (interactive setup)
chmod +x deploy.sh
./deploy.sh --guided

# Subsequent deployments
./deploy.sh
```

## Manual Deployment Steps

### 1. Build the Application

```bash
cd backend
sam build --use-container
```

### 2. Deploy (First Time)

```bash
sam deploy --guided
```

You'll be prompted for:
- **Stack Name**: `second-watch-network-api`
- **AWS Region**: `us-east-1`
- **DatabaseUrl**: Your PostgreSQL connection string
- **CognitoUserPoolId**: Your Cognito User Pool ID
- **CognitoClientId**: Your Cognito Client ID
- Other parameters...

### 3. Deploy (Subsequent)

```bash
sam deploy
```

## Environment Variables

The following parameters need to be set during deployment:

| Parameter | Description | Example |
|-----------|-------------|---------|
| DatabaseUrl | PostgreSQL connection string | `postgresql://user:pass@host:5432/db` |
| CognitoUserPoolId | Cognito User Pool ID | `us-east-1_AHpHN53Sf` |
| CognitoClientId | Cognito Client ID | `3fu74m33djivmn0atrbmr4i6p7` |
| CognitoRegion | Cognito region | `us-east-1` |
| S3AvatarsBucket | S3 bucket for avatars | `swn-avatars-517220555400` |
| S3BacklotBucket | S3 bucket for backlot | `swn-backlot-517220555400` |
| S3BacklotFilesBucket | S3 bucket for files | `swn-backlot-files-517220555400` |
| FrontendUrl | Frontend URL | `https://www.secondwatchnetwork.com` |
| StripeSecretKey | Stripe secret key | `sk_live_...` |
| AnthropicApiKey | Anthropic API key | `sk-ant-...` |
| ResendApiKey | Resend API key | `re_...` |

## After Deployment

1. **Get your API URL** from the deployment outputs:
   ```
   Outputs:
   ApiUrl: https://abc123.execute-api.us-east-1.amazonaws.com
   ```

2. **Update Vercel Environment Variables**:
   - Go to Vercel Dashboard → Your Project → Settings → Environment Variables
   - Set `VITE_API_URL` to your API URL (e.g., `https://abc123.execute-api.us-east-1.amazonaws.com`)
   - Redeploy your frontend

3. **Test the deployment**:
   ```bash
   curl https://your-api-url.execute-api.us-east-1.amazonaws.com/health
   ```

## Troubleshooting

### Cold Starts
Lambda functions have cold starts (~1-3 seconds on first request). Consider:
- Using Provisioned Concurrency for production
- Increasing memory allocation (faster CPU = faster cold starts)

### Timeout Issues
Default timeout is 30 seconds. For long-running operations, increase in `template.yaml`:
```yaml
Globals:
  Function:
    Timeout: 60
```

### View Logs
```bash
sam logs -n SecondWatchApi --stack-name second-watch-network-api --tail
```

### Delete Stack
```bash
sam delete --stack-name second-watch-network-api
```

## Custom Domain (Optional)

To use a custom domain like `api.secondwatchnetwork.com`:

1. Create an ACM certificate in us-east-1
2. Add to template.yaml:
   ```yaml
   ApiDomain:
     Type: AWS::ApiGatewayV2::DomainName
     Properties:
       DomainName: api.secondwatchnetwork.com
       DomainNameConfigurations:
         - CertificateArn: arn:aws:acm:us-east-1:xxx:certificate/xxx
           EndpointType: REGIONAL
   ```
3. Create Route53 record pointing to the API Gateway domain
