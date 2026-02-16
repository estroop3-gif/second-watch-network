#!/bin/bash
# Deploy scraper container to ECS
# Run this from AWS CloudShell or a machine with Docker installed

set -e

REGION="us-east-1"
ACCOUNT_ID="517220555400"
ECR_REPO="swn-scraper"
IMAGE_TAG="latest"
CLUSTER_NAME="swn-scraper-cluster"
TASK_FAMILY="swn-scraper-task"

echo "=== Deploying Scraper Service ==="

# Login to ECR
echo "Logging into ECR..."
aws ecr get-login-password --region $REGION | docker login --username AWS --password-stdin $ACCOUNT_ID.dkr.ecr.$REGION.amazonaws.com

# Build Docker image
echo "Building Docker image..."
docker build -t $ECR_REPO:$IMAGE_TAG .

# Tag and push
echo "Pushing to ECR..."
docker tag $ECR_REPO:$IMAGE_TAG $ACCOUNT_ID.dkr.ecr.$REGION.amazonaws.com/$ECR_REPO:$IMAGE_TAG
docker push $ACCOUNT_ID.dkr.ecr.$REGION.amazonaws.com/$ECR_REPO:$IMAGE_TAG

echo "Image pushed: $ACCOUNT_ID.dkr.ecr.$REGION.amazonaws.com/$ECR_REPO:$IMAGE_TAG"

# Create ECS cluster if it doesn't exist
echo "Creating ECS cluster..."
aws ecs create-cluster --cluster-name $CLUSTER_NAME --region $REGION 2>/dev/null || echo "Cluster already exists"

# Create log group
echo "Creating log group..."
aws logs create-log-group --log-group-name /ecs/swn-scraper --region $REGION 2>/dev/null || echo "Log group already exists"

# Register task definition
echo "Registering task definition..."
aws ecs register-task-definition \
    --family $TASK_FAMILY \
    --region $REGION \
    --requires-compatibilities FARGATE \
    --network-mode awsvpc \
    --cpu "256" \
    --memory "512" \
    --execution-role-arn "arn:aws:iam::$ACCOUNT_ID:role/ecsTaskExecutionRole" \
    --task-role-arn "arn:aws:iam::$ACCOUNT_ID:role/ecsTaskExecutionRole" \
    --container-definitions '[
        {
            "name": "scraper-worker",
            "image": "'$ACCOUNT_ID'.dkr.ecr.'$REGION'.amazonaws.com/'$ECR_REPO':'$IMAGE_TAG'",
            "essential": true,
            "environment": [
                {"name": "DB_HOST", "value": "swn-database.c0vossgkunoa.us-east-1.rds.amazonaws.com"},
                {"name": "DB_NAME", "value": "secondwatchnetwork"},
                {"name": "DB_USER", "value": "swn_admin"},
                {"name": "DB_PASSWORD", "value": "I6YvLh4FIUj2Wp40XeJ0mJVP"}
            ],
            "logConfiguration": {
                "logDriver": "awslogs",
                "options": {
                    "awslogs-group": "/ecs/swn-scraper",
                    "awslogs-region": "'$REGION'",
                    "awslogs-stream-prefix": "ecs",
                    "awslogs-create-group": "true"
                }
            }
        }
    ]'

echo "=== Deployment Complete ==="
echo ""
echo "To run a scraping job manually:"
echo "  aws ecs run-task --cluster $CLUSTER_NAME --task-definition $TASK_FAMILY --launch-type FARGATE --network-configuration 'awsvpcConfiguration={subnets=[subnet-097d1d86c1bc18b3b,subnet-013241dd6ffc1e819],securityGroups=[sg-01b01424383262ebd],assignPublicIp=ENABLED}' --overrides '{\"containerOverrides\":[{\"name\":\"scraper-worker\",\"environment\":[{\"name\":\"JOB_ID\",\"value\":\"YOUR_JOB_ID\"}]}]}'"
