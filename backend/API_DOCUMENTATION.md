# Second Watch Network - API Documentation

## Base URL
```
http://localhost:8000
```

## API Version
All endpoints are prefixed with `/api/v1`

## Interactive Documentation
- **Swagger UI**: http://localhost:8000/docs
- **ReDoc**: http://localhost:8000/redoc

---

## Authentication

### Sign Up
```http
POST /api/v1/auth/signup
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "securepassword",
  "full_name": "John Doe"
}
```

### Sign In
```http
POST /api/v1/auth/signin
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "securepassword"
}
```

### Sign Out
```http
POST /api/v1/auth/signout
```

### Get Current User
```http
GET /api/v1/auth/me
Authorization: Bearer {token}
```

---

## Profiles

### Get Profile
```http
GET /api/v1/profiles/{user_id}
```

### Get Profile by Username
```http
GET /api/v1/profiles/username/{username}
```

### Update Profile
```http
PUT /api/v1/profiles/{user_id}
Content-Type: application/json

{
  "full_name": "John Doe",
  "username": "johndoe",
  "bio": "Filmmaker and content creator",
  "avatar_url": "https://example.com/avatar.jpg"
}
```

### Get Filmmaker Profile
```http
GET /api/v1/profiles/filmmaker/{user_id}
```

### Create Filmmaker Profile
```http
POST /api/v1/profiles/filmmaker
Content-Type: application/json

{
  "user_id": "user-id",
  "bio": "Experienced cinematographer",
  "skills": ["Cinematography", "Color Grading"],
  "experience_level": "Professional",
  "department": "Camera",
  "portfolio_url": "https://portfolio.com",
  "reel_url": "https://vimeo.com/reel",
  "location": "Los Angeles, CA",
  "accepting_work": true
}
```

### Update Filmmaker Profile
```http
PUT /api/v1/profiles/filmmaker/{user_id}
Content-Type: application/json

{
  "bio": "Updated bio",
  "accepting_work": false
}
```

### List Filmmaker Profiles
```http
GET /api/v1/profiles/filmmaker/list?skip=0&limit=20&department=Camera&accepting_work=true
```

---

## Submissions

### Create Submission
```http
POST /api/v1/submissions/?user_id={user_id}
Content-Type: application/json

{
  "project_title": "My Film Project",
  "project_type": "Short Film",
  "logline": "A story about...",
  "description": "Full description",
  "youtube_link": "https://youtube.com/watch?v=..."
}
```

### Get Submission
```http
GET /api/v1/submissions/{submission_id}
```

### List Submissions
```http
GET /api/v1/submissions/?skip=0&limit=20&status=pending&user_id={user_id}
```

**Status values**: pending, in_review, considered, approved, rejected

### Update Submission
```http
PUT /api/v1/submissions/{submission_id}
Content-Type: application/json

{
  "status": "approved",
  "admin_notes": "Great submission!"
}
```

### Delete Submission
```http
DELETE /api/v1/submissions/{submission_id}
```

---

## Forum (The Backlot)

### List Forum Posts
```http
GET /api/v1/forum/?skip=0&limit=20
```

### Create Forum Post
```http
POST /api/v1/forum/
Content-Type: application/json

{
  "title": "Discussion Topic",
  "content": "Post content here",
  "category": "General"
}
```

---

## Messages

### List Messages
```http
GET /api/v1/messages/?user_id={user_id}
```

### Send Message
```http
POST /api/v1/messages/
Content-Type: application/json

{
  "recipient_id": "recipient-user-id",
  "content": "Message content"
}
```

---

## Notifications

### List Notifications
```http
GET /api/v1/notifications/?user_id={user_id}&skip=0&limit=50&status=unread&type=message
```

**Status values**: unread, read  
**Type values**: message, connection_request, connection_accepted, submission_update

### Get Notification Counts
```http
GET /api/v1/notifications/counts?user_id={user_id}
```

**Response**:
```json
{
  "total": 10,
  "messages": 5,
  "connection_requests": 3,
  "submission_updates": 2
}
```

### Mark Notifications as Read
```http
POST /api/v1/notifications/mark-read
Content-Type: application/json

["notification-id-1", "notification-id-2"]
```

### Create Notification
```http
POST /api/v1/notifications/
Content-Type: application/json

{
  "user_id": "user-id",
  "title": "New Message",
  "body": "You have a new message from...",
  "type": "message",
  "related_id": "message-id"
}
```

---

## Connections

### Send Connection Request
```http
POST /api/v1/connections/?requester_id={user_id}
Content-Type: application/json

{
  "recipient_id": "recipient-user-id",
  "message": "I'd like to connect with you"
}
```

### List Connections
```http
GET /api/v1/connections/?user_id={user_id}&status=accepted&skip=0&limit=50
```

**Status values**: pending, accepted, denied

### Update Connection (Accept/Deny)
```http
PUT /api/v1/connections/{connection_id}
Content-Type: application/json

{
  "status": "accepted"
}
```

---

## Content

### List Content
```http
GET /api/v1/content/?skip=0&limit=20&content_type=video
```

### Get Content
```http
GET /api/v1/content/{content_id}
```

### Create Content
```http
POST /api/v1/content/
Content-Type: application/json

{
  "title": "Content Title",
  "description": "Description",
  "content_type": "video",
  "url": "https://...",
  "creator_id": "user-id"
}
```

### Update Content
```http
PUT /api/v1/content/{content_id}
Content-Type: application/json

{
  "status": "published"
}
```

### Delete Content
```http
DELETE /api/v1/content/{content_id}
```

---

## Error Responses

All endpoints return standard HTTP status codes:

- `200 OK` - Success
- `201 Created` - Resource created
- `400 Bad Request` - Invalid request
- `401 Unauthorized` - Authentication required
- `404 Not Found` - Resource not found
- `500 Internal Server Error` - Server error

Error response format:
```json
{
  "detail": "Error message here"
}
```

---

## Rate Limiting

*To be implemented*

---

## Webhooks

*To be implemented*

---

## Database Tables Required

The API expects the following Supabase tables:

- `profiles` - User profiles
- `filmmaker_profiles` - Filmmaker-specific data
- `submissions` - Content submissions
- `forum_threads` - Forum discussion threads
- `forum_replies` - Forum replies
- `forum_categories` - Forum categories
- `messages` - Direct messages
- `conversations` - Message conversations
- `notifications` - User notifications
- `connections` - Connection requests
- `availability` - Filmmaker availability
- `content` - Content/originals

See `DATABASE_SCHEMA.md` for detailed table structures.
