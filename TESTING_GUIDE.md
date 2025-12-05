# Authentication Testing Guide

## System Status

### Running Services
- **Frontend**: http://localhost:8080 (Vite + React)
- **Backend**: http://localhost:8000 (FastAPI)
- **Flet App**: http://localhost:3001 (Python Desktop App)

### Configuration Status
✅ Frontend API client configured
✅ Backend CORS enabled for localhost:8080
✅ Supabase credentials synced between frontend/backend
✅ AuthContext updated with FastAPI integration
✅ Login/Signup forms updated

## Authentication Flow

### How It Works

1. **User submits login/signup form** (Frontend)
2. **Request sent to FastAPI** (`POST /api/v1/auth/signin` or `/signup`)
3. **FastAPI proxies to Supabase** (Validates credentials)
4. **Supabase returns JWT token** (Access token)
5. **Frontend stores token** (localStorage)
6. **Frontend sets Authorization header** (`Bearer <token>`)
7. **Protected routes validated** (Backend checks token with Supabase)

### API Endpoints

#### Sign Up
```bash
POST http://localhost:8000/api/v1/auth/signup
Content-Type: application/json

{
  "email": "test@example.com",
  "password": "Password123!",
  "full_name": "Test User"
}

Response:
{
  "access_token": "eyJ...",
  "token_type": "bearer",
  "user": {
    "id": "uuid",
    "email": "test@example.com",
    ...
  }
}
```

#### Sign In
```bash
POST http://localhost:8000/api/v1/auth/signin
Content-Type: application/json

{
  "email": "test@example.com",
  "password": "Password123!"
}

Response:
{
  "access_token": "eyJ...",
  "token_type": "bearer",
  "user": {
    "id": "uuid",
    "email": "test@example.com",
    ...
  }
}
```

#### Get Current User
```bash
GET http://localhost:8000/api/v1/auth/me
Authorization: Bearer eyJ...

Response:
{
  "id": "uuid",
  "email": "test@example.com",
  ...
}
```

#### Sign Out
```bash
POST http://localhost:8000/api/v1/auth/signout
Authorization: Bearer eyJ...

Response:
{
  "message": "Successfully signed out"
}
```

## Manual Testing Steps

### 1. Test Sign Up (New User)

1. Open browser to `http://localhost:8080`
2. Navigate to Sign Up page
3. Fill in the form:
   - Email: `testuser@example.com`
   - Password: `TestPass123!`
   - Confirm Password: `TestPass123!`
   - Full Name: `Test User`
4. Click "Sign Up"
5. **Expected Result**:
   - Success message appears
   - Redirected to dashboard
   - User session active

6. **Verify in DevTools**:
   - Open Application tab → Local Storage
   - Check for `access_token` key
   - Value should be a JWT token (eyJ...)

### 2. Test Sign In (Existing User)

1. If logged in, sign out first
2. Navigate to Login page
3. Enter credentials:
   - Email: `testuser@example.com`
   - Password: `TestPass123!`
4. Click "Sign In"
5. **Expected Result**:
   - Success redirect to dashboard
   - Session restored

### 3. Test Token Persistence

1. While logged in, refresh the page (F5)
2. **Expected Result**:
   - User remains logged in
   - No redirect to login page
   - Dashboard loads successfully

### 4. Test Sign Out

1. Click user menu (top right)
2. Click "Logout"
3. **Expected Result**:
   - Redirected to landing page
   - localStorage cleared (check DevTools)
   - Accessing /dashboard redirects to login

### 5. Test Protected Routes

1. While logged out, try to access:
   - `http://localhost:8080/dashboard`
   - `http://localhost:8080/account`
2. **Expected Result**:
   - Redirected to login page
   - returnTo parameter preserved

## API Testing with curl

### Test Backend Directly

```bash
# 1. Sign up new user
curl -X POST http://localhost:8000/api/v1/auth/signup \
  -H "Content-Type: application/json" \
  -d '{
    "email": "apitest@example.com",
    "password": "TestPass123!",
    "full_name": "API Test User"
  }'

# Save the access_token from response

# 2. Test /me endpoint
curl -X GET http://localhost:8000/api/v1/auth/me \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"

# 3. Sign in
curl -X POST http://localhost:8000/api/v1/auth/signin \
  -H "Content-Type: application/json" \
  -d '{
    "email": "apitest@example.com",
    "password": "TestPass123!"
  }'

# 4. Sign out
curl -X POST http://localhost:8000/api/v1/auth/signout \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"
```

## Common Issues & Solutions

### Issue: CORS Error
**Symptom**: Browser console shows "blocked by CORS policy"
**Solution**:
- Verify backend CORS includes `http://localhost:8080`
- Check backend logs for CORS configuration
- Backend should auto-reload after config changes

### Issue: 401 Unauthorized on /me endpoint
**Symptom**: Request to /api/v1/auth/me returns 401
**Solution**:
- Verify token is being sent in Authorization header
- Check token format: `Bearer <token>`
- Ensure Supabase credentials are configured in backend .env
- Check backend logs for detailed error

### Issue: Token not persisting
**Symptom**: User logged out after page refresh
**Solution**:
- Check localStorage in browser DevTools
- Verify AuthContext is checking for token on mount
- Check browser console for errors

### Issue: Supabase connection error
**Symptom**: Backend returns "Could not connect to Supabase"
**Solution**:
- Verify SUPABASE_URL in backend/.env
- Verify SUPABASE_KEY in backend/.env
- Check backend logs for connection errors
- Test Supabase directly from frontend

## Testing Checklist

### Backend API Tests
- [ ] POST /api/v1/auth/signup - Creates new user
- [ ] POST /api/v1/auth/signup - Rejects duplicate email
- [ ] POST /api/v1/auth/signin - Accepts valid credentials
- [ ] POST /api/v1/auth/signin - Rejects invalid credentials
- [ ] GET /api/v1/auth/me - Returns user with valid token
- [ ] GET /api/v1/auth/me - Returns 401 without token
- [ ] POST /api/v1/auth/signout - Clears session

### Frontend Tests
- [ ] Sign up form validation works
- [ ] Sign up creates account and logs in
- [ ] Login form validation works
- [ ] Login with valid credentials succeeds
- [ ] Login with invalid credentials shows error
- [ ] Token stored in localStorage
- [ ] Token sent with API requests
- [ ] Page refresh preserves login
- [ ] Logout clears token and redirects
- [ ] Protected routes require authentication

### Integration Tests
- [ ] Frontend → Backend → Supabase flow works
- [ ] Token validation works across services
- [ ] Error messages display correctly
- [ ] Rate limiting works (10 attempts/minute)
- [ ] Session expires after timeout

## Debug Mode

### Enable Detailed Logging

**Frontend** (src/lib/api.ts):
```typescript
// Add console.log in API client
async signIn(email: string, password: string) {
  console.log('[API] Sign in request:', { email });
  const response = await this.fetch('/auth/signin', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
  console.log('[API] Sign in response:', response);
  return response;
}
```

**Backend** (app/api/auth.py):
```python
# Add logging
import logging
logger = logging.getLogger(__name__)

@router.post("/signin")
async def sign_in(request: SignInRequest):
    logger.info(f"Sign in attempt for: {request.email}")
    # ... rest of code
```

### Check Logs

**Frontend**: Browser DevTools → Console
**Backend**: Terminal where uvicorn is running
**Network**: DevTools → Network tab → Filter by "auth"

## Next Steps

Once authentication is working:

1. ✅ **Profile Management**: Test GET/UPDATE /api/v1/profiles endpoints
2. ✅ **Submissions**: Test content submission flow
3. ✅ **Messages**: Test conversation/messaging system
4. ✅ **Forum**: Test thread creation and replies
5. ✅ **Admin**: Test admin dashboard endpoints

## Support

If you encounter issues:

1. Check browser console for errors
2. Check backend terminal for errors
3. Verify all services are running
4. Review this testing guide
5. Check FRONTEND_BACKEND_INTEGRATION.md for architecture details
