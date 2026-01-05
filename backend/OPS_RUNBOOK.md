# Second Watch Network Operations Runbook

This document provides operational procedures for managing the Second Watch Network platform.

## Table of Contents

1. [Health Monitoring](#health-monitoring)
2. [Incident Response](#incident-response)
3. [Rate Limiting](#rate-limiting)
4. [Feature Flags](#feature-flags)
5. [System Configuration](#system-configuration)
6. [Maintenance Windows](#maintenance-windows)
7. [Common Issues](#common-issues)
8. [Emergency Procedures](#emergency-procedures)

---

## Health Monitoring

### Overview

The platform monitors the following components:
- **Database**: PostgreSQL connectivity and query performance
- **S3 Storage**: Avatar and Backlot file bucket accessibility
- **Cognito**: Authentication service availability
- **External APIs**: Third-party service health

### Checking System Health

```bash
# Get current health status
curl -H "Authorization: Bearer $TOKEN" \
  https://api.secondwatchnetwork.com/api/v1/ops/health

# Run all health checks manually
curl -X POST -H "Authorization: Bearer $TOKEN" \
  https://api.secondwatchnetwork.com/api/v1/ops/health/check

# Run specific health check
curl -X POST -H "Authorization: Bearer $TOKEN" \
  https://api.secondwatchnetwork.com/api/v1/ops/health/check/database
```

### Health Status Meanings

| Status | Description | Action Required |
|--------|-------------|-----------------|
| `healthy` | All systems operational | None |
| `degraded` | System working but slow | Monitor, investigate if persists |
| `unhealthy` | System failing | Immediate investigation |
| `unknown` | No recent check data | Run health check |

### Response Time Thresholds

- Database: < 100ms normal, > 800ms degraded
- S3: < 500ms normal, > 2000ms degraded
- Cognito: < 300ms normal, > 1500ms degraded

---

## Incident Response

### Severity Levels

| Severity | Description | Response Time | Escalation |
|----------|-------------|---------------|------------|
| `critical` | Platform down, data loss risk | Immediate | All hands |
| `error` | Major feature broken | 15 minutes | On-call team |
| `warning` | Degraded performance | 1 hour | Primary on-call |
| `info` | Minor issue, no user impact | Next business day | Assignee |

### Creating an Incident

```bash
curl -X POST -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Database connection issues",
    "severity": "error",
    "description": "Intermittent connection failures to primary database",
    "impact": "Some users experiencing slow page loads"
  }' \
  https://api.secondwatchnetwork.com/api/v1/ops/incidents
```

### Incident Status Flow

```
investigating → identified → monitoring → resolved
```

### Updating an Incident

```bash
curl -X POST -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "status": "identified",
    "message": "Root cause identified: connection pool exhaustion due to leaked connections"
  }' \
  https://api.secondwatchnetwork.com/api/v1/ops/incidents/{incident_id}/update
```

### Post-Incident Actions

1. Update incident status to `resolved`
2. Document root cause in incident description
3. Create follow-up tasks for preventive measures
4. Schedule post-mortem if severity was `error` or `critical`
5. Update `postmortem_url` field with post-mortem document link

---

## Rate Limiting

### Default Rate Limits

| Rule | Scope | Limit | Window | Exempt Roles |
|------|-------|-------|--------|--------------|
| global_default | user | 1000 req | 60s | superadmin, admin |
| auth_endpoints | ip | 20 req | 60s | none |
| upload_limit | user | 100 req | 1 hour | superadmin, admin, filmmaker |
| api_heavy | user | 10 req | 60s | superadmin |

### Checking Rate Limit Violations

```bash
# Get violations from last 24 hours
curl -H "Authorization: Bearer $TOKEN" \
  "https://api.secondwatchnetwork.com/api/v1/ops/rate-limits/violations?hours=24"

# Get violations for specific user
curl -H "Authorization: Bearer $TOKEN" \
  "https://api.secondwatchnetwork.com/api/v1/ops/rate-limits/violations?identifier=user_123"
```

### Creating Rate Limit Override

To increase limits for a specific user (e.g., API integration partner):

```bash
curl -X POST -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "rule_id": "global_default_rule_id",
    "override_type": "user",
    "override_value": "user_id_here",
    "multiplier": 2.0,
    "reason": "API integration partner - increased limits"
  }' \
  https://api.secondwatchnetwork.com/api/v1/ops/rate-limits/overrides
```

To exempt a user entirely:

```bash
curl -X POST -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "rule_id": "global_default_rule_id",
    "override_type": "user",
    "override_value": "user_id_here",
    "exempt": true,
    "reason": "Internal service account"
  }' \
  https://api.secondwatchnetwork.com/api/v1/ops/rate-limits/overrides
```

---

## Feature Flags

### Overview

Feature flags control feature rollout and provide emergency killswitches.

### Flag Categories

| Category | Purpose | Examples |
|----------|---------|----------|
| `frontend` | UI features | New player, redesigned pages |
| `backend` | API features | New algorithms, integrations |
| `experiment` | A/B tests | UI variations, algorithm changes |
| `killswitch` | Emergency disable | Disable uploads, streaming |
| `rollout` | Gradual deployment | New features being tested |
| `beta` | Beta features | Features for beta testers |

### Flag Status Types

| Status | Behavior |
|--------|----------|
| `enabled` | Flag on for all users |
| `disabled` | Flag off for all users |
| `percentage` | Enabled for X% of users (deterministic by user ID) |
| `targeted` | Enabled only for specific users/roles/orgs |

### Managing Feature Flags

```bash
# List all flags
curl -H "Authorization: Bearer $TOKEN" \
  https://api.secondwatchnetwork.com/api/v1/ops/feature-flags

# Enable a flag
curl -X POST -H "Authorization: Bearer $TOKEN" \
  https://api.secondwatchnetwork.com/api/v1/ops/feature-flags/enable_new_player/enable

# Disable a flag (emergency)
curl -X POST -H "Authorization: Bearer $TOKEN" \
  https://api.secondwatchnetwork.com/api/v1/ops/feature-flags/killswitch_uploads/enable

# Set percentage rollout
curl -X POST -H "Authorization: Bearer $TOKEN" \
  "https://api.secondwatchnetwork.com/api/v1/ops/feature-flags/enable_live_streaming/percentage?percentage=50"

# Add user to targeted flag
curl -X POST -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"target_type": "user", "target_value": "user_id_here"}' \
  https://api.secondwatchnetwork.com/api/v1/ops/feature-flags/beta_watch_parties/targets
```

### Killswitch Flags

For emergency situations, the following killswitches are available:

| Flag Key | Effect |
|----------|--------|
| `killswitch_uploads` | Disable all file uploads |
| `killswitch_streaming` | Disable video streaming |
| `killswitch_payments` | Disable payment processing |
| `killswitch_messaging` | Disable direct messaging |

To activate a killswitch:

```bash
curl -X POST -H "Authorization: Bearer $TOKEN" \
  https://api.secondwatchnetwork.com/api/v1/ops/feature-flags/killswitch_uploads/enable
```

---

## System Configuration

### Key Configuration Values

| Key | Description | Default |
|-----|-------------|---------|
| `maintenance_mode` | Enable maintenance mode | `false` |
| `max_upload_size_mb` | Max file upload size | `500` |
| `default_video_quality` | Default transcoding quality | `"1080p"` |
| `enable_email_notifications` | Enable email notifications | `true` |
| `creator_pool_percentage` | Revenue share for creators | `0.10` |
| `min_payout_cents` | Minimum payout threshold | `2500` |

### Viewing Configuration

```bash
# List all configs
curl -H "Authorization: Bearer $TOKEN" \
  https://api.secondwatchnetwork.com/api/v1/ops/config

# Get specific config
curl -H "Authorization: Bearer $TOKEN" \
  https://api.secondwatchnetwork.com/api/v1/ops/config/max_upload_size_mb
```

### Updating Configuration

```bash
curl -X PUT -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "value": 1000,
    "reason": "Increased limit for large video files"
  }' \
  https://api.secondwatchnetwork.com/api/v1/ops/config/max_upload_size_mb
```

### Configuration Change History

```bash
curl -H "Authorization: Bearer $TOKEN" \
  https://api.secondwatchnetwork.com/api/v1/ops/config/max_upload_size_mb/history
```

---

## Maintenance Windows

### Scheduling Maintenance

```bash
curl -X POST -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Database maintenance",
    "description": "Upgrading PostgreSQL to version 15",
    "scheduled_start": "2024-02-15T02:00:00Z",
    "scheduled_end": "2024-02-15T04:00:00Z",
    "affected_services": ["database", "api"]
  }' \
  https://api.secondwatchnetwork.com/api/v1/ops/maintenance
```

### Checking Maintenance Status

```bash
# Public endpoint - no auth required
curl https://api.secondwatchnetwork.com/api/v1/ops/maintenance/status
```

Response:
```json
{
  "in_maintenance": true,
  "window": {
    "title": "Database maintenance",
    "scheduled_start": "2024-02-15T02:00:00Z",
    "scheduled_end": "2024-02-15T04:00:00Z"
  }
}
```

---

## Common Issues

### High Database Latency

**Symptoms**: Slow API responses, health check shows database as degraded

**Investigation**:
1. Check `GET /ops/slow-requests` for slow queries
2. Check database connection pool status
3. Review recent deployments for query changes

**Resolution**:
1. Kill long-running queries if safe
2. Scale up database instance if needed
3. Add missing indexes for slow queries

### Rate Limit Complaints

**Symptoms**: Users reporting 429 errors

**Investigation**:
1. Check `GET /ops/rate-limits/violations` for the user
2. Review their usage patterns
3. Determine if legitimate high usage

**Resolution**:
1. If legitimate: Create rate limit override
2. If abuse: Keep limits, consider blocking
3. If bug: Fix client-side retry logic

### Feature Flag Not Working

**Symptoms**: Feature enabled but users don't see it

**Investigation**:
1. Check flag status: `GET /ops/feature-flags/{key}`
2. Check targets if targeted: `GET /ops/feature-flags/{key}/targets`
3. Test evaluation: `GET /feature-flags/evaluate/{key}`

**Resolution**:
1. Verify flag status is correct
2. Check user is in target group
3. Check frontend is reading flag correctly
4. Clear frontend cache if needed

---

## Emergency Procedures

### Complete Platform Outage

1. **Acknowledge**: Create critical incident immediately
2. **Communicate**: Post to status page
3. **Triage**: Check health endpoints, AWS console
4. **Escalate**: Contact all on-call engineers
5. **Resolve**: Follow relevant runbook
6. **Document**: Update incident with all actions

### Database Failure

1. Enable maintenance mode:
   ```bash
   curl -X PUT -H "Authorization: Bearer $TOKEN" \
     -d '{"value": true}' \
     https://api.secondwatchnetwork.com/api/v1/ops/config/maintenance_mode
   ```

2. Check RDS console for failover status
3. If primary down, promote read replica
4. Update connection strings if needed
5. Disable maintenance mode after recovery

### Security Incident

1. **Isolate**: Disable affected features via killswitch
2. **Assess**: Determine scope of breach
3. **Contain**: Block malicious actors
4. **Notify**: Alert security team, legal if needed
5. **Recover**: Rotate affected credentials
6. **Document**: Full incident report

### Mass Upload Failure

1. Check S3 bucket status in AWS console
2. If S3 issue: Enable `killswitch_uploads`
3. Check IAM permissions haven't changed
4. Monitor CloudWatch for S3 errors
5. Disable killswitch after resolution

---

## Contacts

| Role | Contact |
|------|---------|
| Primary On-Call | Check PagerDuty |
| Platform Lead | @platform-lead |
| Database Admin | @dba-team |
| Security | @security-team |
| AWS Support | AWS Console → Support |

---

## API Reference

### Ops Dashboard

```
GET /api/v1/ops/dashboard
```

Returns comprehensive overview including:
- Health status of all checks
- Active alerts by severity
- Feature flag summary
- Rate limit violations (24h)
- Active incidents

### Quick Health Check

```
GET /api/v1/ops/health
```

Returns overall status and individual check results. Use this for monitoring integrations.

---

*Last updated: Phase 6C implementation*
