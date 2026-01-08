# Second Watch Network: Enterprise Application Analysis & Cost Estimate

## Executive Summary

Second Watch Network is a **large-scale, enterprise-class full-stack application** combining a faith-driven streaming platform with professional film production management tools. The application represents approximately **385,700 lines of code** across backend and frontend, with sophisticated integrations including AWS Lambda, Cognito, S3, CloudFront CDN, Stripe payments, real-time WebSocket communication, and HLS video transcoding.

---

## 1. Codebase Metrics Overview

| Metric | Count |
|--------|-------|
| **Backend (Python/FastAPI)** | 140,850 lines |
| **Frontend (TypeScript/React)** | 244,863 lines |
| **Total Lines of Code** | **385,713 lines** |
| **API Modules** | 90 |
| **API Endpoints** | ~1,200+ |
| **Database Tables** | 155 |
| **Database Migrations** | 56 SQL files |
| **Frontend Pages** | 107 |
| **Frontend Components** | 472 |
| **Frontend Hooks** | 94 |
| **TypeScript Type Definitions** | 500+ |

---

## 2. Major Feature Systems

### 2.1 Backlot Production Management System
**Complexity: VERY HIGH | 40,603 backend lines | 134,627 frontend lines**

A comprehensive film production management platform comparable to industry tools like StudioBinder or Yamdu.

| Module | Endpoints | Complexity |
|--------|-----------|------------|
| Call Sheets & Scheduling | 70 | Very High |
| Budget System (multi-layer) | 35 | Very High |
| Clearances & Legal | 26 | Very High |
| Dailies & Media Management | 35 | Very High |
| Script Management & Breakdown | 27 | High |
| Casting & Crew Pipeline | 35 | High |
| Review & QC System | 25 | High |
| Invoices & Expenses | 30+ | High |
| Timecards & Labor | 25+ | High |
| Locations & Scouting | 9 | Medium |
| Tasks & Project Management | 11 | Medium |
| **Total Backlot** | **608** | **Very High** |

**Key Features:**
- 7 call sheet templates (Feature, Documentary, Commercial, Music Video, Medical, News, Live Events)
- PDF/Excel export for call sheets, budgets, scripts
- OCR receipt scanning with automatic categorization
- AI-powered script breakdown suggestions
- Video transcoding and dailies review workflow
- Multi-level approval workflows (invoices, timecards, clearances)
- Real-time hot set production tracking
- Desktop helper integration for local file ingestion

### 2.2 The Order Membership System
**Complexity: HIGH | ~3,000 backend lines | ~15,000 frontend lines**

A professional guild system for filmmakers with hierarchical governance.

| Component | Description |
|-----------|-------------|
| Membership Tiers | BASE ($50), STEWARD ($100), PATRON ($250+) |
| Governance | Lodges (cities), Craft Houses (departments), Fellowships |
| Job Board | Internal job posting with visibility controls |
| Booking Requests | External clients can request Order member services |
| Dues Processing | Stripe subscription integration |
| Professional Tracks | 16 craft specializations |

**Key Features:**
- Application and vetting workflow
- Lodge-based local chapters
- Craft House professional communities (Camera Guild, Post House, Audio Sanctum, etc.)
- Fellowship special interest groups
- Officer positions with governance hierarchy
- Portfolio and availability management

### 2.3 Creator Monetization & Revenue Sharing
**Complexity: VERY HIGH | ~5,000 backend lines**

A sophisticated creator-first revenue model with watch-time-based earnings.

| Component | Description |
|-----------|-------------|
| Creator Pool | 10% of net subscription revenue |
| Revenue Formula | `World Share = (World Watch Seconds / Platform Watch Seconds) × Creator Pool` |
| Payout Threshold | $25 minimum |
| Aggregation | 3-tier: Hourly → Daily → Monthly |
| Organization Support | Studios can own Worlds and receive payouts |

**Key Features:**
- Real-time watch time tracking
- Multi-tier aggregation for revenue calculation
- Automated payout generation with approval workflow
- Organization (studio) ownership of content
- Stripe Connect integration for creator payouts
- Comprehensive analytics dashboard

### 2.4 Video Streaming Infrastructure
**Complexity: VERY HIGH | ~8,000 backend lines | ~20,000 frontend lines**

Production-grade HLS streaming with adaptive bitrate and CDN delivery.

| Component | Technology |
|-----------|------------|
| Transcoding | FFmpeg-based HLS (5 quality tiers: 360p-4K) |
| CDN | CloudFront with RSA-signed URLs/cookies |
| Storage | S3 (raw masters, published HLS, thumbnails) |
| Player | HLS.js with quality selection, subtitles, resume |
| Protection | Signed cookies (4-hour sessions), DRM infrastructure ready |

**Quality Ladder:**
- 4K (2160p): 15,000 kbps
- 1080p: 5,000 kbps
- 720p: 2,500 kbps
- 480p: 1,000 kbps
- 360p: 600 kbps

**Key Features:**
- Multipart upload (100MB chunks) with presigned URLs
- Distributed transcoding worker queue with retry logic
- Sprite sheet generation for video scrubbing
- Multi-language subtitle support (VTT/SRT/TTML)
- Resume playback across devices
- Premium content access control

### 2.5 Linear Channels (Fast Channel/VOD)
**Complexity: HIGH | ~2,500 backend lines**

24/7 linear channel infrastructure using client-side VOD simulation.

| Component | Description |
|-----------|-------------|
| Blocks | Curated content sequences |
| Block Items | Episodes, slates, promos, ad placeholders |
| Scheduling | Time-zone aware with recurrence patterns |
| Playback | Client-side seek into VOD assets |

### 2.6 Admin Panel
**Complexity: HIGH | ~10,000 backend lines | ~25,000 frontend lines**

Comprehensive administration with 228 dedicated endpoints.

| Module | Endpoints | Function |
|--------|-----------|----------|
| Core Admin | 100+ | Dashboard, users, audit logging |
| Community Moderation | 72 | Forums, warnings, bans, reports |
| Content Management | 40 | Fast channels, playlists |
| Role Management | 22 | Custom roles, permissions |
| Backlot Admin | 22 | Production oversight |
| Storage Management | 15 | Quotas, usage tracking |
| User Admin | 15 | Cognito integration, deletion |
| Email Campaigns | 12 | Templates, bulk sending |

### 2.7 Permission & Role System
**Complexity: HIGH**

| Metric | Count |
|--------|-------|
| Distinct Permissions | 122 |
| Role Tiers | 9 (Superadmin → Free) |
| Custom Role Support | Yes |

### 2.8 Real-Time Features (WebSocket)
**Complexity: HIGH | ~400 backend lines**

Socket.IO implementation with:
- Direct messaging
- Channel-based chat
- Voice signaling (WebRTC)
- Push-to-talk
- Typing indicators
- Project update broadcasting

### 2.9 Additional Systems

| System | Endpoints | Complexity |
|--------|-----------|------------|
| Forum & Community | 50+ | Medium |
| Messaging & Notifications | 40+ | Medium |
| Filmmaker Profiles | 30+ | Medium |
| Submissions/Green Room | 25+ | Medium |
| Church Production Tools | 70+ | High |
| Live Events | 20+ | Medium |
| Recommendations | 15+ | Medium |
| Analytics | 20+ | Medium |

---

## 3. Technical Architecture

### 3.1 Backend Stack
- **Framework**: FastAPI (Python 3.12)
- **Database**: PostgreSQL (Supabase)
- **ORM**: SQLAlchemy + raw SQL
- **Authentication**: AWS Cognito
- **Storage**: AWS S3 (3 buckets)
- **CDN**: CloudFront with signed URLs
- **Payments**: Stripe (subscriptions, Connect)
- **Email**: AWS SES / Resend
- **AI**: Anthropic Claude API
- **PDF**: WeasyPrint, ReportLab
- **Video**: FFmpeg (HLS transcoding)
- **Real-time**: Socket.IO

### 3.2 Frontend Stack
- **Framework**: React 18 + TypeScript
- **Build**: Vite
- **UI Library**: shadcn/ui + Tailwind CSS
- **State**: TanStack React Query
- **Forms**: React Hook Form + Zod
- **Video**: HLS.js
- **Routing**: React Router

### 3.3 Infrastructure (AWS)
- Lambda (API)
- API Gateway
- Cognito (Auth)
- S3 (Storage)
- CloudFront (CDN)
- RDS PostgreSQL
- DynamoDB (WebSocket connections)
- SES (Email)
- EventBridge (Keep-warm scheduler)

---

## 4. Development Effort Estimation

### 4.1 By System (Developer-Days)

| System | Backend | Frontend | Total Days |
|--------|---------|----------|------------|
| Backlot Production | 200-300 | 400-600 | **600-900** |
| Order Membership | 40-60 | 80-120 | **120-180** |
| Creator Monetization | 60-80 | 40-60 | **100-140** |
| Video Streaming | 100-150 | 80-120 | **180-270** |
| Linear Channels | 30-40 | 40-60 | **70-100** |
| Admin Panel | 80-120 | 100-150 | **180-270** |
| Auth & Permissions | 40-60 | 30-40 | **70-100** |
| Real-time/WebSocket | 30-40 | 40-60 | **70-100** |
| Community/Forum | 40-60 | 60-80 | **100-140** |
| Messaging | 30-40 | 40-60 | **70-100** |
| Profiles & Onboarding | 30-40 | 50-70 | **80-110** |
| Church Tools | 40-60 | 60-80 | **100-140** |
| Database Design | 60-80 | - | **60-80** |
| DevOps/Infrastructure | 40-60 | - | **40-60** |
| Testing & QA | 100-150 | 100-150 | **200-300** |
| **TOTAL** | **920-1,340** | **1,120-1,650** | **2,040-2,990** |

### 4.2 Summary Estimates

| Scenario | Developer-Days | Calendar Months (3-person team) |
|----------|----------------|--------------------------------|
| **Optimistic** | 2,040 | 28 months |
| **Realistic** | 2,500 | 35 months |
| **Conservative** | 2,990 | 42 months |

---

## 5. Personnel Requirements

### 5.1 Minimum Viable Team (24-36 months)

| Role | Count | Responsibilities |
|------|-------|------------------|
| **Tech Lead/Architect** | 1 | Architecture, code review, AWS |
| **Senior Backend Developer** | 2 | FastAPI, PostgreSQL, integrations |
| **Senior Frontend Developer** | 2 | React, TypeScript, video player |
| **Full-Stack Developer** | 1 | Feature development |
| **DevOps Engineer** | 0.5 | AWS, CI/CD, monitoring |
| **UI/UX Designer** | 1 | Design system, 107 pages |
| **QA Engineer** | 1 | Testing, automation |
| **Product Manager** | 1 | Requirements, prioritization |
| **TOTAL** | **~9-10** | |

### 5.2 Accelerated Team (18-24 months)

| Role | Count |
|------|-------|
| Tech Lead/Architect | 1 |
| Senior Backend Developer | 3 |
| Senior Frontend Developer | 3 |
| Full-Stack Developer | 2 |
| Video/Streaming Specialist | 1 |
| DevOps Engineer | 1 |
| UI/UX Designer | 2 |
| QA Engineer | 2 |
| Product Manager | 1 |
| **TOTAL** | **~16** |

---

## 6. Cost Estimation

### 6.1 Development Costs (US Market Rates)

| Role | Annual Salary | Loaded Cost (1.3x) |
|------|---------------|-------------------|
| Tech Lead | $180,000 | $234,000 |
| Senior Developer | $160,000 | $208,000 |
| Full-Stack Developer | $140,000 | $182,000 |
| DevOps Engineer | $150,000 | $195,000 |
| UI/UX Designer | $120,000 | $156,000 |
| QA Engineer | $110,000 | $143,000 |
| Product Manager | $140,000 | $182,000 |

### 6.2 Total Development Cost

**Minimum Team (9-10 people, 30 months):**

| Category | Cost |
|----------|------|
| Personnel (30 months) | $3,750,000 - $4,500,000 |
| AWS Infrastructure (dev/staging) | $50,000 - $100,000 |
| Third-party Services | $30,000 - $50,000 |
| Design Assets/Tools | $20,000 - $40,000 |
| **TOTAL** | **$3,850,000 - $4,690,000** |

**Accelerated Team (16 people, 21 months):**

| Category | Cost |
|----------|------|
| Personnel (21 months) | $4,200,000 - $5,000,000 |
| AWS Infrastructure | $75,000 - $125,000 |
| Third-party Services | $40,000 - $60,000 |
| Design Assets/Tools | $30,000 - $50,000 |
| **TOTAL** | **$4,345,000 - $5,235,000** |

### 6.3 Offshore/Hybrid Model (40-50% reduction)

| Scenario | Cost Range |
|----------|------------|
| Minimum Team | $1,900,000 - $2,800,000 |
| Accelerated Team | $2,200,000 - $3,100,000 |

---

## 7. Key Value Drivers

### 7.1 Unique Differentiators

1. **Integrated Production-to-Distribution Pipeline**: Unlike competitors that offer either production tools OR streaming, SWN provides end-to-end workflow from script breakdown to audience delivery.

2. **Creator-First Revenue Model**: The 10% creator pool with transparent watch-time-based distribution is a significant competitive advantage.

3. **Professional Guild System (The Order)**: A unique community-building mechanism that creates loyalty and network effects.

4. **Comprehensive Backlot**: 608 endpoints covering every aspect of film production - comparable to $50K+/year enterprise tools.

5. **Linear + VOD Hybrid**: Fast channel capability alongside traditional on-demand, maximizing content discovery.

### 7.2 Technical Moats

- **HLS Transcoding Pipeline**: Full adaptive streaming infrastructure
- **CloudFront Signed Delivery**: Content protection without full DRM cost
- **Real-time Collaboration**: WebSocket with voice for production teams
- **AI Integration**: Script breakdown, budget suggestions, copilot features
- **Multi-tenant Architecture**: Organizations, lodges, craft houses

---

## 8. Comparison to Market Alternatives

| Platform | Annual Cost | Comparable Features |
|----------|-------------|---------------------|
| StudioBinder | $4,200/project | Call sheets, scheduling only |
| Yamdu | $12,000/year | Production management |
| Frame.io | $15,000/year | Review/collaboration only |
| Vimeo OTT | $10,000/year | Streaming only |
| Patreon | 8-12% revenue | Creator monetization only |
| **Building equivalent** | **$4-5M one-time** | **All features integrated** |

---

## 9. Conclusions

### 9.1 Assessment

Second Watch Network represents a **substantial enterprise software investment** equivalent to:
- **2,500+ developer-days** of effort
- **385,700+ lines of production code**
- **$4-5 million** in development costs (US rates)
- **2.5-3 years** of continuous development

### 9.2 Key Complexity Factors

1. **Backlot Production System**: Single largest component (40K+ lines backend), would take 12-18 months alone
2. **Video Streaming**: Requires specialized expertise in HLS, FFmpeg, CDN architecture
3. **Financial Systems**: Revenue sharing, payouts, Stripe integration require careful audit trail design
4. **Permission System**: 122 permissions across 9 roles with custom role support
5. **Database Complexity**: 155 tables with complex relationships and cascading operations

### 9.3 Recommendation

To duplicate this application from scratch would require:

| Approach | Timeline | Budget | Team Size |
|----------|----------|--------|-----------|
| **Enterprise Quality** | 30-36 months | $4.5-5.5M | 10-12 |
| **MVP + Iteration** | 18-24 months | $2.5-3.5M | 8-10 |
| **Offshore Hybrid** | 24-30 months | $2.0-3.0M | 12-15 |

The application's value proposition lies in its **integration of production tools with distribution infrastructure** - a combination that would require significant domain expertise in both film production workflows and streaming technology to replicate effectively.

---

## Appendix: Feature Inventory

### Backend API Modules (90 total)
```
auth.py, profiles.py, users.py, content.py, filmmakers.py,
messages.py, forum.py, notifications.py, connections.py,
submissions.py, availability.py, credits.py, community.py,
greenroom.py, order.py, admin.py, admin_community.py,
admin_content.py, admin_backlot.py, admin_profiles.py,
admin_roles.py, admin_storage.py, admin_users.py, admin_emails.py,
backlot.py, scene_view.py, day_view.py, person_view.py,
timecards.py, project_access.py, cast_crew.py, camera_continuity.py,
continuity.py, utilities.py, hot_set.py, invoices.py, expenses.py,
camera_log.py, worlds.py, consumer_video.py, shorts.py,
live_events.py, linear.py, recommendations.py, dashboard_settings.py,
themes.py, billing.py, organizations.py, creator_earnings.py,
ads.py, partners.py, applications_templates.py, cover_letter_templates.py,
resumes.py, networks.py, productions.py, companies.py,
community_threads.py, career.py, lodges.py, festivals.py,
venues.py, moderation.py, world_onboarding.py, i18n.py,
distribution.py, analytics.py, watch_parties.py, live_production.py,
order_governance.py, financing.py, ops.py, geocoding.py,
client_metrics.py, church_services.py, church_people.py,
church_content.py, church_gear.py, church_licenses.py,
church_rooms.py, church_planning.py, church_volunteering.py,
+ additional specialized modules
```

### Database Tables (155 total)
Major categories:
- Backlot Production: 60+ tables
- Streaming Platform: 12 tables
- Community & Forum: 15 tables
- User Management: 8 tables
- The Order/Guild: 12 tables
- Monetization: 8 tables
- Church/Community: 30+ tables
- Admin & Moderation: 8 tables
- Linear/Fast Channel: 12 tables

---

*Analysis generated: January 2026*
*Codebase version: Current master branch*
