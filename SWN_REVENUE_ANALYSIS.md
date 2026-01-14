# Second Watch Network: Revenue Path Analysis
## Target: $6,000 - $8,000/month to Move Back to LA

**Analysis Date:** January 2026
**Focus:** Backlot Production Management SaaS

---

## I. THE MATH: How to Hit $6-8K/Month

### Current Pricing (from BacklotUpgradePrompt.tsx)

| Plan | Price | Annual Equivalent |
|------|-------|-------------------|
| **Monthly** | $14.99/month | $179.88/year |
| **Yearly** | $149.99/year | $12.50/month effective |

### Customers Needed at Current Pricing

| Monthly Revenue | @ $14.99/mo | @ $12.50/mo (yearly) | Mix (70/30) |
|-----------------|-------------|----------------------|-------------|
| **$6,000** | 401 customers | 480 customers | 424 customers |
| **$7,000** | 467 customers | 560 customers | 495 customers |
| **$8,000** | 534 customers | 640 customers | 565 customers |

**Problem:** At $14.99/month, you need 400-535 customers. That's a lot of hustle.

---

### RECOMMENDED: Raise Prices to Match Market

**Competitor Pricing Analysis:**

| Tool | Cheapest Plan | Mid-Tier | Top Tier |
|------|---------------|----------|----------|
| StudioBinder | $42/mo | $85/mo | $340/mo |
| SetHero | $19/mo | Custom | Custom |
| Celtx | $7.50/mo | $20/mo | $60/mo |
| Filmustage | $19/mo | $59/mo | - |

**Your Current: $14.99/month** - You're underpricing by 3-6x vs StudioBinder.

### Recommended Pricing Structure

| Tier | Price | Target Customer | Revenue per Customer |
|------|-------|-----------------|---------------------|
| **Ministry** | $49/month | Church media teams | $49/mo |
| **Production** | $99/month | Indie productions | $99/mo |
| **Studio** | $249/month | Production companies | $249/mo |

### Customers Needed at NEW Pricing

| Monthly Revenue | @ $49/mo (Ministry) | @ $99/mo (Production) | @ $249/mo (Studio) |
|-----------------|---------------------|----------------------|-------------------|
| **$6,000** | 123 customers | 61 customers | 25 customers |
| **$7,000** | 143 customers | 71 customers | 29 customers |
| **$8,000** | 164 customers | 81 customers | 33 customers |

**At $99/month Production tier: 61-81 customers = $6-8K/month**

### Realistic Customer Mix Scenario

| Tier | Customers | Price | MRR |
|------|-----------|-------|-----|
| Ministry | 30 | $49 | $1,470 |
| Production | 40 | $99 | $3,960 |
| Studio | 10 | $249 | $2,490 |
| **TOTAL** | **80** | - | **$7,920** |

**80 customers at mixed tiers = ~$8K/month**

---

## II. MARKET ANALYSIS

### Target Segments

#### 1. Church Media Teams (Primary - Fastest Path)

**Market Size:**
- 350,000+ churches in the US
- ~50% have video production (175,000)
- Target: Churches producing weekly content
- Realistic addressable: 5,000-10,000 churches

**Current Tools They Pay For:**
| Tool | Price | What It Does |
|------|-------|--------------|
| ProPresenter | $399 + $99/yr | Presentation software |
| MediaShout | $599 one-time | Presentation software |
| Planning Center | $0-$200/mo | Volunteer scheduling |
| Tithe.ly | $119/mo | All-in-one church software |

**Your Angle:**
- Churches pay $119/mo for Tithe.ly (giving + planning)
- You offer PRODUCTION MANAGEMENT they don't have
- Weekly service = recurring production = needs call sheets, volunteer scheduling, equipment tracking
- **Price Point: $49/month** = easy budget approval for most churches

**Customer Acquisition:**
- Church film festivals (Samaritan, Red Letter Media)
- Christian media conferences
- Pastor/media director Facebook groups
- Direct outreach to megachurch media teams
- Referrals through your existing church connections

**Conversion Math:**
| Metric | Conservative | Moderate | Aggressive |
|--------|--------------|----------|------------|
| Churches contacted/month | 100 | 200 | 500 |
| Demo conversion | 10% | 15% | 20% |
| Demo to paid | 20% | 25% | 30% |
| New customers/month | 2 | 7.5 | 30 |

#### 2. Indie Film Productions

**Market Size:**
- 8,000+ indie films made annually in US
- Average crew size: 15-30 people
- Production period: 2-6 weeks
- Budget: $10K-$500K

**Current Tools:**
| Tool | Price | Limitation |
|------|-------|------------|
| StudioBinder | $85-$340/mo | Expensive for indie budgets |
| Google Sheets | Free | No structure, chaos |
| SetHero | $19/mo | Limited features |

**Your Angle:**
- StudioBinder is $85-340/mo - you're cheaper AND faith-aligned
- Indie productions are cost-conscious
- Many indie filmmakers are Christian but hate Hollywood tools
- **Price Point: $99/month** (less than half of StudioBinder Professional)

**Customer Acquisition:**
- Film school partnerships
- Indie film festivals (Sundance, SXSW, faith-based)
- Facebook groups (Indie Filmmakers, No-Budget Filmmaking)
- YouTube filmmaker community
- Christian filmmaker networks

#### 3. Small Production Companies

**Market Size:**
- 15,000+ video production companies in US
- Average revenue: $250K-$2M/year
- 3-10 active projects at any time

**Current Tools:**
| Tool | Price | Why They'd Switch |
|------|-------|-------------------|
| StudioBinder | $229-$340/mo | Cost, corporate feel |
| Frame.io | $15-$35/user/mo | Just review, not production |
| Monday.com | $10-$20/user/mo | Generic, not film-specific |

**Your Angle:**
- All-in-one vs. stitching together 5 tools
- Faith-aligned for Christian production companies
- **Price Point: $249/month** (still cheaper than StudioBinder Agency)

---

## III. IMPLEMENTATION STATUS

### What's Built (Ready to Sell)

**Core Features (683 API endpoints):**

| Feature | Status | Value to Customer |
|---------|--------|-------------------|
| Call Sheets | Complete + PDF export | Professional shoot coordination |
| Budget Management | Complete + templates | Cost control and tracking |
| Production Scheduling | Complete + stripboard | Efficient shooting schedules |
| Script Management | Complete + sides | Organized script workflow |
| Dailies/Footage | Complete + streaming | Review takes efficiently |
| Casting & Roles | Complete | Find and book talent |
| Clearances | Complete + signing | Legal compliance |
| Timecards | Complete | Crew hour tracking |
| Invoices & Expenses | Complete + receipt OCR | Financial management |
| Task Management | Complete | Team coordination |
| Review/Feedback | Complete | Client approval workflow |
| Credits | Complete + public page | Professional credits display |

**Export Capabilities:**
- PDF: Call sheets, budgets, breakdowns, continuity, stripboard
- CSV: Receipts, stripboard, data exports
- Excel: Budget exports

**Collaboration:**
- Team member invites
- Role-based permissions
- Comments/notes throughout
- Shared project views

### What's Missing for Revenue

#### CRITICAL (Must Fix Before Launch)

| Gap | Current State | Fix Required | Effort |
|-----|---------------|--------------|--------|
| **Stripe Price IDs** | Empty in config | Create Stripe products, add price IDs | 1 hour |
| **Paywall Enforcement** | Dev mode = free | Wire BacklotUpgradePrompt to block access | 2-4 hours |
| **Pricing Page** | Shows $14.99 | Update to tiered pricing ($49/$99/$249) | 2 hours |
| **Subscription Portal** | API exists, UI partial | Wire up Stripe Portal | 2-4 hours |

**Total to enable payments: 8-12 hours of work**

#### IMPORTANT (First 30 Days)

| Gap | Why It Matters | Fix |
|-----|---------------|-----|
| Welcome emails | Onboard new customers | Connect email service |
| Trial period | Reduce friction | Add 14-day trial logic |
| Subscription upsells | Convert free trials | Add upgrade prompts |
| Customer qualification | Route to right tier | Add signup questions |

#### NICE-TO-HAVE (First 90 Days)

| Feature | Impact |
|---------|--------|
| Usage analytics | See what features customers use |
| Churn tracking | Understand cancellations |
| Referral program | Leverage happy customers |
| Church-specific templates | Faster onboarding |

---

## IV. BILLING INFRASTRUCTURE STATUS

### Already Built

```
Backend (billing.py):
- POST /checkout-session - Create Stripe checkout
- GET /backlot/access - Check subscription status
- POST /portal-session - Stripe billing portal
- POST /webhook - Handle subscription events

Frontend:
- BacklotUpgradePrompt.tsx - Upgrade UI with pricing cards
- SubscriptionSettings.tsx - Manage subscription
- api.createCheckoutSession() - API client method

Database:
- profiles.stripe_customer_id
- profiles.backlot_subscription_status
- profiles.backlot_subscription_period_end
- profiles.backlot_subscription_id
```

### What Needs Configuration

1. **Create Stripe Products:**
   - Backlot Ministry ($49/mo)
   - Backlot Production ($99/mo)
   - Backlot Studio ($249/mo)
   - (Optional) Annual versions with 2-month discount

2. **Set Environment Variables:**
   ```
   STRIPE_SECRET_KEY=sk_live_xxx
   STRIPE_PUBLISHABLE_KEY=pk_live_xxx
   STRIPE_WEBHOOK_SECRET=whsec_xxx
   STRIPE_BACKLOT_MONTHLY_PRICE_ID=price_xxx (Ministry)
   STRIPE_BACKLOT_YEARLY_PRICE_ID=price_xxx
   ```

3. **Deploy Webhook:**
   - Point Stripe webhook to `/api/v1/billing/webhook`
   - Enable: customer.subscription.created, updated, deleted

---

## V. 90-DAY REVENUE SPRINT

### Week 1-2: Enable Payments

- [ ] Create Stripe account (if not done)
- [ ] Create Backlot products (3 tiers)
- [ ] Add price IDs to Lambda environment
- [ ] Update BacklotUpgradePrompt with new pricing
- [ ] Test checkout flow end-to-end
- [ ] Test webhook subscription lifecycle
- [ ] Deploy

### Week 3-4: First 10 Customers

**Target: Church media teams you already know**

- [ ] List 20 churches with video production
- [ ] Personal outreach (email/call)
- [ ] Offer founding member rate (20% off first year)
- [ ] Get 10 paying customers
- [ ] Collect testimonials

### Week 5-8: Scale to 30 Customers

**Target: Church media networks**

- [ ] Post in Christian filmmaker Facebook groups
- [ ] Reach out to film school contacts
- [ ] Contact 3 church media conferences about sponsorship
- [ ] Create demo video for Backlot
- [ ] Get featured in 1 church tech blog/podcast
- [ ] Target: 20 more customers (30 total)

### Week 9-12: Hit $6K+

**Target: Mix of churches + indie productions**

- [ ] Launch on indie filmmaker communities
- [ ] Partner with 1 film festival
- [ ] Create case study from first customers
- [ ] Implement referral discount
- [ ] Target: 30 more customers (60 total)

### Revenue Projection

| Week | Cumulative Customers | Mix | Projected MRR |
|------|---------------------|-----|---------------|
| 2 | 3 | 3 Ministry | $147 |
| 4 | 10 | 7 Ministry, 3 Production | $640 |
| 6 | 20 | 12 Ministry, 8 Production | $1,380 |
| 8 | 35 | 20 Ministry, 12 Production, 3 Studio | $2,415 |
| 10 | 50 | 28 Ministry, 18 Production, 4 Studio | $3,414 |
| 12 | 70 | 35 Ministry, 28 Production, 7 Studio | $5,232 |

**Conservative: $5K MRR by week 12**
**With hustle: $6-8K MRR by week 12**

---

## VI. COMPETITIVE ADVANTAGES

### Why Backlot Beats StudioBinder

| Factor | Backlot | StudioBinder |
|--------|---------|--------------|
| **Price** | $49-$249/mo | $42-$340/mo |
| **Faith Alignment** | Built for faith-based creators | Secular corporate |
| **All-in-One** | Full production suite | Modular, incomplete |
| **Indie Focus** | Built by solo indie dev | Built by VC-backed corp |
| **Personal Touch** | Direct founder support | Corporate support queue |
| **Church Features** | Purpose-built integrations | None |

### Why Churches Choose Backlot

1. **Values Alignment** - Faith-first platform
2. **Volunteer Friendly** - Simple enough for part-time volunteers
3. **Weekly Rhythm** - Built for recurring productions
4. **Price** - $49/mo vs. $200+ for stitched solutions
5. **Equipment Tracking** - Gear House coming (they need this)

### Why Indie Films Choose Backlot

1. **Price** - 50% cheaper than StudioBinder
2. **Founder Story** - Solo dev building for indie creators
3. **Complete Suite** - Don't need 5 different tools
4. **Dailies/Review** - Built-in footage management
5. **Anti-Hollywood** - Aligned with indie rebellion

---

## VII. RISK ANALYSIS

### Risks to $6-8K Target

| Risk | Probability | Mitigation |
|------|-------------|------------|
| Slow church sales cycle | High | Start with personal network first |
| Indie films are seasonal | Medium | Balance with church customers (steady) |
| Competition raises funding | Low | You're already built; they need time |
| Feature gaps block sales | Low | 683 endpoints is comprehensive |
| Price resistance | Medium | Start with early adopter discounts |

### De-risking Strategy

1. **Churches first** - Steady monthly revenue, not seasonal
2. **Personal network** - First 10 customers from people you know
3. **Annual plans** - Lock in revenue, reduce churn
4. **Founder pricing** - 20% off for first 100 customers = testimonials

---

## VIII. BOTTOM LINE

### The Path to LA

| Milestone | Customers | MRR | Timeline |
|-----------|-----------|-----|----------|
| Payment system live | 0 | $0 | Week 1 |
| First 10 customers | 10 | $800 | Week 4 |
| Sustainable side income | 30 | $2,500 | Week 8 |
| Part-time livable | 50 | $4,200 | Week 12 |
| **Full-time LA viable** | **70-80** | **$6-8K** | **Week 16-20** |

### What You Need to Do

1. **This Week:** Configure Stripe, update pricing, deploy
2. **Next Week:** Call 20 churches you know, offer founding rate
3. **Month 1:** Get 10 paying customers, collect testimonials
4. **Month 2:** Scale outreach, 30 customers
5. **Month 3:** Hit $5K, validate path to $8K
6. **Month 4:** Move back to LA with $6-8K recurring

### The Product is Built

You have:
- 683 API endpoints
- 206 frontend components
- Complete production management suite
- Working Stripe infrastructure
- Professional-grade features

**The only thing between you and $8K/month is customers.**

Configure payments. Call churches. Ship it.

---

*"The money isn't for survival. It's for winning."*

— From your battle plan
