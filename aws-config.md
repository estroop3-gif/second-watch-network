# AWS Infrastructure Configuration

## Account Information
- **Account ID**: 517220555400
- **Region**: us-east-1
- **IAM User**: SecondWatchNetwork

## S3 Buckets
| Bucket | Purpose | Public |
|--------|---------|--------|
| swn-avatars-517220555400 | User profile pictures | Yes (read) |
| swn-backlot-517220555400 | Script files (PDF, FDX) | No |
| swn-backlot-files-517220555400 | Call sheets, PDFs | No |

## RDS PostgreSQL Database
- **Instance ID**: swn-database
- **Engine**: PostgreSQL 15.10
- **Instance Class**: db.t3.micro (free tier eligible)
- **Database Name**: secondwatchnetwork
- **Username**: swn_admin
- **Password**: <your-db-password>
- **Port**: 5432
- **Endpoint**: swn-database.c0vossgkunoa.us-east-1.rds.amazonaws.com

## Cognito User Pool
- **User Pool ID**: us-east-1_AHpHN53Sf
- **User Pool Client ID**: 3fu74m33djivmn0atrbmr4i6p7
- **Region**: us-east-1

## Security Groups
- **Database SG**: sg-0dae91d17e8134c68 (allows PostgreSQL 5432 from anywhere)

## VPC
- **Default VPC**: vpc-0d928f4a346e5e13f
- **DB Subnet Group**: swn-db-subnet-group

---

## Environment Variables for Backend

```env
# AWS Configuration
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=<your-access-key-id>
AWS_SECRET_ACCESS_KEY=<your-secret-access-key>

# S3 Buckets
AWS_S3_AVATARS_BUCKET=swn-avatars-517220555400
AWS_S3_BACKLOT_BUCKET=swn-backlot-517220555400
AWS_S3_BACKLOT_FILES_BUCKET=swn-backlot-files-517220555400

# RDS Database (update endpoint when ready)
DATABASE_URL=postgresql://swn_admin:<your-db-password>@swn-database.c0vossgkunoa.us-east-1.rds.amazonaws.com:5432/secondwatchnetwork

# Cognito
COGNITO_USER_POOL_ID=us-east-1_AHpHN53Sf
COGNITO_CLIENT_ID=3fu74m33djivmn0atrbmr4i6p7
COGNITO_REGION=us-east-1
```

## Environment Variables for Frontend

```env
# AWS Cognito
VITE_AWS_REGION=us-east-1
VITE_COGNITO_USER_POOL_ID=us-east-1_AHpHN53Sf
VITE_COGNITO_CLIENT_ID=3fu74m33djivmn0atrbmr4i6p7

# S3 (for direct uploads)
VITE_S3_AVATARS_BUCKET=swn-avatars-517220555400
VITE_S3_REGION=us-east-1
```

---

## Migration Checklist

- [x] S3 Buckets created
- [x] RDS PostgreSQL instance created (pending ready status)
- [x] Cognito User Pool created
- [x] Cognito User Pool Client created
- [ ] Update backend code to use AWS services
- [ ] Update frontend code to use AWS services
- [ ] Export Supabase database
- [ ] Import data to RDS
- [ ] Migrate files from Supabase Storage to S3
- [ ] Test authentication flow
- [ ] Deploy backend to ECS/EC2
- [ ] Deploy frontend to S3/CloudFront
