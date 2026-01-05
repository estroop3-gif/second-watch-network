# Second Watch Network - API Surface Index

This document describes the major API groups exposed by the Second Watch Network backend.
All endpoints follow the `/api/v1/...` versioning pattern and use consistent conventions.

---

## Common Conventions

### Authentication
- **Bearer Token**: All authenticated endpoints require `Authorization: Bearer <jwt_token>`
- **Token Source**: AWS Cognito JWT tokens
- **Public Endpoints**: Marked with `(public)` - no auth required

### Pagination
All list endpoints support:
```json
{
  "limit": 20,
  "offset": 0
}
```
Response includes:
```json
{
  "items": [...],
  "total": 150,
  "limit": 20,
  "offset": 0
}
```

### Error Format
All errors follow:
```json
{
  "detail": "Human-readable error message",
  "error_code": "SPECIFIC_ERROR_CODE",
  "status_code": 400
}
```

Common error codes:
- `401 Unauthorized` - Missing or invalid token
- `403 Forbidden` - Insufficient permissions
- `404 Not Found` - Resource doesn't exist
- `422 Unprocessable Entity` - Validation error

---

## API Groups

### 1. Auth & Profiles

**Base**: `/api/v1/auth`, `/api/v1/profiles`, `/api/v1/users`

| Endpoint | Method | Auth | Description |
|----------|--------|------|-------------|
| `/auth/register` | POST | No | Create new account |
| `/auth/login` | POST | No | Authenticate and get tokens |
| `/auth/refresh` | POST | No | Refresh access token |
| `/auth/logout` | POST | Yes | Invalidate session |
| `/auth/me` | GET | Yes | Get current user info |
| `/profiles/{id}` | GET | Yes | Get public profile |
| `/profiles/me` | GET | Yes | Get own profile |
| `/profiles/me` | PUT | Yes | Update own profile |
| `/users/search` | GET | Yes | Search users |

**Notes**:
- Mobile/TV clients should store refresh tokens securely
- Profile includes avatar, bio, Order membership status

---

### 2. Worlds & Playback (VoD + Linear)

**Base**: `/api/v1/worlds`, `/api/v1/video`, `/api/v1/linear`

#### Worlds (Content Discovery)

| Endpoint | Method | Auth | Description |
|----------|--------|------|-------------|
| `/worlds` | GET | Optional | List/search Worlds |
| `/worlds/{slug}` | GET | Optional | Get World details |
| `/worlds/{id}/seasons` | GET | Optional | List seasons |
| `/worlds/{id}/episodes` | GET | Optional | List episodes |
| `/worlds/{id}/follow` | POST | Yes | Follow a World |
| `/worlds/{id}/unfollow` | DELETE | Yes | Unfollow a World |

#### Video Playback

| Endpoint | Method | Auth | Description |
|----------|--------|------|-------------|
| `/video/episodes/{id}/playback` | POST | Yes | Create playback session |
| `/video/playback/{session_id}` | GET | Yes | Get session info |
| `/video/playback/{session_id}/progress` | POST | Yes | Update watch progress |
| `/video/playback/{session_id}/complete` | POST | Yes | Mark episode complete |

#### Linear Channels

| Endpoint | Method | Auth | Description |
|----------|--------|------|-------------|
| `/linear/channels` | GET | Optional | List live channels |
| `/linear/channels/{slug}` | GET | Optional | Get channel + schedule |
| `/linear/channels/{id}/stream` | POST | Yes | Get live stream URL |
| `/linear/epg` | GET | Optional | Electronic program guide |

**Mobile/TV Notes**:
- Playback sessions return HLS URLs, ad markers, and access flags
- Always check `access.allowed` before attempting playback
- Linear streams require periodic heartbeat for viewer counting

---

### 3. Home Feed & Recommendations

**Base**: `/api/v1/recommendations`, `/api/v1/home`

| Endpoint | Method | Auth | Description |
|----------|--------|------|-------------|
| `/home` | GET | Optional | Unified home feed (mobile/TV optimized) |
| `/recommendations/home` | GET | Optional | Structured recommendation sections |
| `/recommendations/worlds/{id}/related` | GET | Optional | Related Worlds |
| `/recommendations/category/{cat}` | GET | Optional | Category-specific content |
| `/recommendations/sports` | GET | Optional | Sports & motorsports content |
| `/recommendations/trending` | GET | No | Trending Worlds |
| `/recommendations/for-you` | GET | Yes | Personalized feed |

**Home Feed Sections** (returned by `/home`):
1. `continue_watching` - Incomplete episodes with progress
2. `because_you_watched` - Similar to recently completed
3. `from_your_lodges` - Lodge-featured content (Order members)
4. `trending_now` - High recent watch time
5. `top_category` - Top in user's preferred category
6. `new_releases` - Recent premieres
7. `sports_highlights` - Live/upcoming sports
8. `hidden_gems` - High quality, lower viewership

---

### 4. Community (Threads & Replies)

**Base**: `/api/v1/threads`, `/api/v1/community`

| Endpoint | Method | Auth | Description |
|----------|--------|------|-------------|
| `/threads` | GET | Yes | List threads (scoped) |
| `/threads` | POST | Yes | Create thread |
| `/threads/{id}` | GET | Yes | Get thread with replies |
| `/threads/{id}` | PUT | Yes | Update thread |
| `/threads/{id}` | DELETE | Yes | Delete thread |
| `/threads/{id}/replies` | GET | Yes | List replies |
| `/threads/{id}/replies` | POST | Yes | Add reply |
| `/threads/{id}/pin` | POST | Yes | Pin thread (mod) |
| `/threads/{id}/lock` | POST | Yes | Lock thread (mod) |
| `/replies/{id}/like` | POST | Yes | Like reply |
| `/threads/{id}/report` | POST | Yes | Report thread |
| `/replies/{id}/report` | POST | Yes | Report reply |

**Scoping**:
- Threads are scoped to: `world`, `lodge`, or `craft_house`
- Query param: `?scope_type=world&scope_id={world_id}`

---

### 5. Creator Dashboards & Earnings

**Base**: `/api/v1/creator`, `/api/v1/organizations`

| Endpoint | Method | Auth | Description |
|----------|--------|------|-------------|
| `/creator/dashboard` | GET | Yes | Creator overview stats |
| `/creator/worlds` | GET | Yes | Creator's Worlds list |
| `/creator/worlds/{id}/analytics` | GET | Yes | Per-World analytics |
| `/creator/payouts` | GET | Yes | Payout history |
| `/creator/payouts/{id}` | GET | Yes | Payout details |
| `/organizations` | GET | Yes | User's organizations |
| `/organizations` | POST | Yes | Create organization |
| `/organizations/{id}` | GET | Yes | Org details |
| `/organizations/{id}/members` | GET | Yes | Org members |
| `/organizations/{id}/earnings` | GET | Yes | Org earnings |

**Earnings Model**:
- 10% of net subscription revenue → creator pool
- Split by watch share (world_watch / total_watch)
- Monthly calculation, $25 minimum payout threshold

---

### 6. Order & Lodges

**Base**: `/api/v1/order`, `/api/v1/lodges`

#### Order Membership

| Endpoint | Method | Auth | Description |
|----------|--------|------|-------------|
| `/order/status` | GET | Yes | Membership status |
| `/order/join` | POST | Yes | Request membership |
| `/order/profile` | GET | Yes | Order member profile |
| `/order/craft-houses` | GET | Yes | List craft houses |
| `/order/jobs` | GET | Yes | Available jobs |

#### Lodges

| Endpoint | Method | Auth | Description |
|----------|--------|------|-------------|
| `/lodges/{id}/metrics` | GET | Yes | Lodge metrics |
| `/lodges/rankings` | GET | Yes | Lodge rankings by tier |
| `/lodges/{id}/shelf` | GET | Optional | Featured Worlds |
| `/lodges/{id}/proposals` | GET | Yes | Block proposals |
| `/lodges/{id}/proposals` | POST | Yes | Submit proposal |
| `/lodges/{id}/channel` | GET | Yes | Lodge channel info |

**Lodge Tiers**:
- `emerging` - New lodges, limited privileges
- `active` - Can propose blocks, VOD shelf
- `flagship` - Full programming capabilities

---

### 7. Backlot (Production Management)

**Base**: `/api/v1/backlot`

| Endpoint | Method | Auth | Description |
|----------|--------|------|-------------|
| `/backlot/projects` | GET | Yes | User's projects |
| `/backlot/projects` | POST | Yes | Create project |
| `/backlot/projects/{id}` | GET | Yes | Project details |
| `/backlot/projects/{id}/days` | GET | Yes | Production days |
| `/backlot/projects/{id}/cast` | GET | Yes | Cast members |
| `/backlot/projects/{id}/crew` | GET | Yes | Crew members |
| `/backlot/projects/{id}/scenes` | GET | Yes | Script scenes |
| `/backlot/projects/{id}/dailies` | GET | Yes | Dailies footage |
| `/backlot/projects/{id}/dailies` | POST | Yes | Upload dailies |
| `/backlot/timecards` | GET | Yes | Time tracking |
| `/backlot/invoices` | GET | Yes | Invoice management |

**Dailies Helper Integration**:
- Bulk upload: `POST /backlot/projects/{id}/dailies/bulk`
- Job status: `GET /backlot/dailies/{id}/jobs`
- Problem assets: `GET /backlot/projects/{id}/dailies/issues`

---

### 8. Live Events

**Base**: `/api/v1/events`

| Endpoint | Method | Auth | Description |
|----------|--------|------|-------------|
| `/events` | GET | Optional | List events |
| `/events/{id}` | GET | Optional | Event details |
| `/events/{id}/stream` | POST | Yes | Get stream access |
| `/events/upcoming` | GET | Optional | Upcoming events |
| `/events/live` | GET | Optional | Currently live |

---

### 9. Festivals & Venues

**Base**: `/api/v1/festivals`, `/api/v1/venues`

| Endpoint | Method | Auth | Description |
|----------|--------|------|-------------|
| `/festivals` | GET | Optional | List festivals |
| `/festivals/{id}` | GET | Optional | Festival details |
| `/festivals/{id}/submissions` | GET | Yes | Submission status |
| `/festivals/{id}/submit` | POST | Yes | Submit World |
| `/venues` | GET | Optional | Distribution venues |
| `/venues/{id}` | GET | Optional | Venue details |
| `/venues/{id}/availability` | GET | Yes | Booking availability |

---

### 10. Admin APIs

**Base**: `/api/v1/admin/*`

All admin endpoints require appropriate role permissions:
- `SUPERADMIN` - Full access
- `ADMIN` - User/content management
- `MODERATOR` - Community moderation only

| Group | Base | Description |
|-------|------|-------------|
| Users | `/admin/users` | User management |
| Content | `/admin/content` | Content review/approval |
| Community | `/admin/community` | Moderation tools |
| Backlot | `/admin/backlot` | Production oversight |
| Roles | `/admin/roles` | Permission management |

---

## Mobile/TV Client Guidelines

### Session Management
1. Store refresh token securely (Keychain/Keystore)
2. Access tokens expire in 1 hour - refresh proactively
3. Include device info in all playback requests

### Home Feed
- Use `/api/v1/home` for efficient single-call home screen
- Cache sections locally, refresh on app foreground
- Respect `cache_ttl_seconds` in response

### Playback
1. Create session: `POST /video/episodes/{id}/playback`
2. Response includes:
   - `hls_url` - Primary stream URL
   - `hls_url_backup` - Fallback URL
   - `access.allowed` - Boolean access check
   - `access.reason` - Why access denied (if applicable)
   - `ad_breaks` - Array of ad insertion points (free content)
   - `resume_position_seconds` - Where to start
3. Report progress every 15 seconds
4. Call complete when >90% watched

### Offline Support
- Check `episode.allow_download` before offering download
- Downloads expire after `download_expiry_hours`
- Re-validate license on playback

### Error Handling
- Retry on 5xx errors with exponential backoff
- On 401, attempt token refresh before failing
- On 403, show appropriate upgrade/access message

---

## Rate Limits

| Endpoint Group | Limit | Window |
|----------------|-------|--------|
| Auth | 10 | 1 min |
| Playback creation | 30 | 1 min |
| Progress updates | 60 | 1 min |
| Search | 30 | 1 min |
| General | 100 | 1 min |

Rate limit headers included in responses:
- `X-RateLimit-Limit`
- `X-RateLimit-Remaining`
- `X-RateLimit-Reset`

---

## Changelog

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | Phase 4A | Initial API surface documentation |
