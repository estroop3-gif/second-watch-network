# Green Room Feature - Implementation Guide

## Overview

The Green Room is Second Watch Network's **project development and voting arena** where filmmakers submit projects, community members vote with purchased tickets, and the most popular projects win.

**NOT** the live broadcast pre-roll room - this is the voting/incubator system.

## Core Features

### 1. Voting Cycles
- Time-based periods for project submission and voting
- Statuses: `upcoming`, `active`, `closed`
- Customizable ticket limits and pricing per cycle
- Admin-controlled lifecycle

### 2. Project Submissions
- Filmmakers submit projects into active/upcoming cycles
- Required fields: title, description
- Optional: category, video_url, image_url
- Admin approval required before projects appear in voting
- Statuses: `pending`, `approved`, `rejected`

### 3. Voting System
- **Ticket Purchase**: $10 per ticket (Stripe integration ready)
- **Ticket Limits**: Max 100 tickets per user per cycle (customizable)
- **Final Votes**: All votes are permanent (no changes allowed)
- **Efficient Counting**: Denormalized vote_count on Project model
- **Vote Allocation**: Users allocate tickets to projects they support

### 4. Permissions

| Action | Allowed Roles |
|--------|--------------|
| **View** | Everyone (public) |
| **Vote** | Premium, Filmmaker, Partner, Admin |
| **Submit Projects** | Filmmaker, Admin |
| **Manage Cycles** | Admin, Moderator |
| **Approve Projects** | Admin, Moderator |

## Backend Implementation

### Database Models

**Files Created:**
- `backend/app/models/greenroom.py`
- `backend/app/schemas/greenroom.py`
- `backend/app/api/greenroom.py`

**Models:**

```python
# Cycle - Voting period
class Cycle(SQLModel, table=True):
    id, name, description
    start_date, end_date
    max_tickets_per_user (default: 100)
    ticket_price (default: $10)
    status (upcoming|active|closed)

# Project - Submitted film project
class Project(SQLModel, table=True):
    id, cycle_id, filmmaker_id
    title, description, category
    video_url, image_url
    status (pending|approved|rejected)
    vote_count (denormalized)
    approved_by, approved_at

# VotingTicket - User's ticket purchase
class VotingTicket(SQLModel, table=True):
    id, user_id, cycle_id
    tickets_purchased, tickets_used
    stripe_payment_intent_id, stripe_session_id
    payment_status (pending|completed|failed|refunded)
    amount_paid

# Vote - Vote allocation
class Vote(SQLModel, table=True):
    id, user_id, project_id, cycle_id
    tickets_allocated
    created_at (final, no updates)
    # Constraint: unique(user_id, project_id)
```

### API Endpoints

**Minimal Change to Existing:**
- ✅ `backend/app/main.py` - Added greenroom router import and include

**Base URL:** `/api/v1/greenroom`

#### Public Endpoints (Everyone)

```
GET  /cycles                    # List all cycles
GET  /cycles/{id}               # Get cycle details
GET  /cycles/{id}/projects      # List projects in cycle
GET  /projects/{id}             # Get project details
GET  /cycles/{id}/results       # Get voting results
```

#### Authenticated User Endpoints

```
GET  /tickets/my-tickets        # Get user's tickets
POST /tickets/purchase          # Purchase tickets (Stripe)
POST /votes/cast                # Cast vote (final)
GET  /votes/my-votes            # Get user's votes
GET  /stats/my-stats            # Get user statistics
```

#### Filmmaker Endpoints

```
POST /projects/submit           # Submit project
GET  /projects/my-projects      # Get filmmaker's projects
PUT  /projects/{id}             # Update project (if pending)
DELETE /projects/{id}           # Delete project (if pending)
```

#### Admin/Moderator Endpoints

```
POST /cycles                    # Create cycle
PUT  /cycles/{id}               # Update cycle
DELETE /cycles/{id}             # Delete cycle
PUT  /projects/{id}/approve     # Approve/reject project
GET  /cycles/{id}/stats         # Get cycle statistics
```

### Stripe Integration (Ready)

The ticket purchase endpoint is configured to integrate with Stripe:

```python
@router.post("/tickets/purchase")
async def purchase_tickets(...):
    # Creates VotingTicket record with:
    # - stripe_session_id
    # - stripe_payment_intent_id
    # - payment_status: "pending"

    # Returns checkout URL for user to complete payment

    # Webhook handler needed to update status to "completed"
```

**TODO:**
1. Add Stripe webhook endpoint
2. Handle `checkout.session.completed` event
3. Update VotingTicket.payment_status to "completed"
4. Enable ticket usage after successful payment

### Vote Counting Efficiency

**Denormalized Design** (for performance):
- `Project.vote_count` stores total votes
- Updated atomically when vote is cast
- No need to count votes on every query

**Vote Finality:**
- Unique constraint: `(user_id, project_id, cycle_id)`
- No UPDATE operation on Vote table
- Database enforces one vote per user per project

## Frontend Implementation

### Pages to Create

**Minimal Changes to Existing:**
- Add "Green Room" navigation link

**New Pages:**

```
src/app/(main)/greenroom/
├── page.tsx                    # Green Room home
├── cycles/
│   └── [id]/
│       └── page.tsx            # Cycle detail & voting
├── projects/
│   └── [id]/
│       └── page.tsx            # Project detail
└── submit/
    └── page.tsx                # Project submission form
```

### Components to Create

```
src/components/greenroom/
├── CycleCard.tsx               # Cycle preview card
├── ProjectCard.tsx             # Project card with vote button
├── VoteButton.tsx              # Vote allocation interface
├── TicketPurchase.tsx          # Ticket purchase flow
├── ProjectSubmissionForm.tsx   # Filmmaker submission form
├── VotingStats.tsx             # User's voting statistics
└── CycleResults.tsx            # Results visualization
```

### API Client

```typescript
// src/lib/api/greenroom.ts

class GreenRoomAPI {
  // Cycles
  listCycles(status?: CycleStatus)
  getCycle(id: number)

  // Projects
  listProjects(cycleId: number, options?)
  getProject(id: number)
  submitProject(data: ProjectSubmit)

  // Voting
  purchaseTickets(cycleId: number, count: number)
  castVote(projectId: number, ticketCount: number)
  getMyVotes(cycleId?: number)
  getMyTickets()

  // Admin
  createCycle(data: CycleCreate)
  approveProject(id: number, status: "approved" | "rejected")
}
```

## Control Room (Flet) Implementation

### Views to Create

**Minimal Changes:**
- Add "Green Room" section to main navigation

**New Views:**

```
control-room/views/
└── greenroom_view.py           # Green Room management

control-room/components/greenroom/
├── cycle_manager.py            # Create/edit cycles
├── project_approval.py         # Approve/reject projects
└── stats_dashboard.py          # Cycle statistics
```

### Features

1. **Cycle Management**
   - Create new cycles (name, dates, settings)
   - Update existing cycles
   - View cycle statistics

2. **Project Approval**
   - List pending projects
   - View project details
   - Approve/reject with one click

3. **Statistics Dashboard**
   - Revenue tracking
   - Vote counts
   - Project submissions
   - User engagement metrics

## Database Migrations

**TODO: Create migrations for:**

```sql
-- Create Green Room tables
CREATE TABLE greenroom_cycles (
    id SERIAL PRIMARY KEY,
    name VARCHAR(200) NOT NULL,
    description TEXT,
    start_date TIMESTAMP NOT NULL,
    end_date TIMESTAMP NOT NULL,
    max_tickets_per_user INTEGER DEFAULT 100,
    ticket_price DECIMAL(10,2) DEFAULT 10.0,
    status VARCHAR(20) DEFAULT 'upcoming',
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE greenroom_projects (
    id SERIAL PRIMARY KEY,
    cycle_id INTEGER REFERENCES greenroom_cycles(id),
    filmmaker_id VARCHAR(255) NOT NULL,
    title VARCHAR(200) NOT NULL,
    description TEXT NOT NULL,
    category VARCHAR(100),
    video_url TEXT,
    image_url TEXT,
    status VARCHAR(20) DEFAULT 'pending',
    vote_count INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    approved_at TIMESTAMP,
    approved_by VARCHAR(255)
);

CREATE TABLE greenroom_voting_tickets (
    id SERIAL PRIMARY KEY,
    user_id VARCHAR(255) NOT NULL,
    cycle_id INTEGER REFERENCES greenroom_cycles(id),
    tickets_purchased INTEGER DEFAULT 0,
    tickets_used INTEGER DEFAULT 0,
    stripe_payment_intent_id VARCHAR(255),
    stripe_session_id VARCHAR(255),
    payment_status VARCHAR(20) DEFAULT 'pending',
    amount_paid DECIMAL(10,2) DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE greenroom_votes (
    id SERIAL PRIMARY KEY,
    user_id VARCHAR(255) NOT NULL,
    project_id INTEGER REFERENCES greenroom_projects(id),
    cycle_id INTEGER REFERENCES greenroom_cycles(id),
    tickets_allocated INTEGER NOT NULL CHECK (tickets_allocated > 0),
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(user_id, project_id, cycle_id)
);

-- Indexes for performance
CREATE INDEX idx_cycles_status ON greenroom_cycles(status);
CREATE INDEX idx_cycles_dates ON greenroom_cycles(start_date, end_date);
CREATE INDEX idx_projects_cycle ON greenroom_projects(cycle_id);
CREATE INDEX idx_projects_filmmaker ON greenroom_projects(filmmaker_id);
CREATE INDEX idx_projects_status ON greenroom_projects(status);
CREATE INDEX idx_projects_votes ON greenroom_projects(vote_count DESC);
CREATE INDEX idx_tickets_user_cycle ON greenroom_voting_tickets(user_id, cycle_id);
CREATE INDEX idx_votes_user ON greenroom_votes(user_id);
CREATE INDEX idx_votes_project ON greenroom_votes(project_id);
CREATE INDEX idx_votes_cycle ON greenroom_votes(cycle_id);
```

## Testing Checklist

### Backend API
- [ ] Create cycle (admin)
- [ ] List public cycles
- [ ] Submit project (filmmaker)
- [ ] Approve project (admin)
- [ ] Purchase tickets (Stripe test mode)
- [ ] Cast vote
- [ ] Verify vote is final (cannot change)
- [ ] Check ticket limits enforced
- [ ] Verify role permissions
- [ ] Get cycle results

### Frontend
- [ ] View Green Room home page
- [ ] Browse active cycles
- [ ] View cycle projects
- [ ] Purchase tickets
- [ ] Cast votes
- [ ] Submit project (filmmaker)
- [ ] View my votes/tickets
- [ ] Responsive design works

### Control Room
- [ ] Create/edit cycles
- [ ] Approve/reject projects
- [ ] View statistics
- [ ] Monitor revenue

## Next Steps

1. **Complete Frontend** (in progress)
   - Green Room pages
   - Components
   - API client
   - Navigation link

2. **Add Database Migrations**
   - Create migration files
   - Test in development
   - Document rollback procedures

3. **Stripe Integration**
   - Set up Stripe account
   - Configure webhook endpoint
   - Test payment flow
   - Add refund handling

4. **Control Room Views**
   - Cycle management UI
   - Project approval interface
   - Statistics dashboard

5. **Additional Features**
   - Email notifications (project approved, voting opens, etc.)
   - Social sharing for projects
   - Winner announcements
   - Project categories/filtering
   - Advanced statistics

## Security Considerations

✅ **Implemented:**
- Role-based access control
- Vote finality (database constraint)
- Ticket limit enforcement
- Admin-only cycle management

🔒 **TODO:**
- Rate limiting on ticket purchase
- Fraud detection for voting patterns
- Payment verification webhooks
- Admin action logging
- Input sanitization for project submissions

## Performance Optimizations

✅ **Implemented:**
- Denormalized vote counts
- Database indexes on key fields
- Pagination on list endpoints

💡 **Future:**
- Caching for cycle lists
- Read replicas for public views
- Background jobs for statistics calculation
- CDN for project media

---

**Status**: ✅ Backend Complete | 🚧 Frontend In Progress | ⏳ Control Room Pending

**Version**: 1.0.0
**Last Updated**: December 5, 2025
