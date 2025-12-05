# Second Watch Network - Full Stack Application

A comprehensive faith-driven filmmaking platform with web and desktop/mobile apps.

## Architecture

This project consists of three main components:

1. **Backend (FastAPI)** - Python REST API server
2. **Frontend (Next.js)** - Web application
3. **App (Flet/Python)** - Cross-platform desktop and mobile application

```
second-watch-network/
├── backend/          # FastAPI Python backend
├── frontend/         # Next.js web frontend
└── app/             # Flet Python desktop/mobile app
```

## Tech Stack

- **Backend**: FastAPI, Supabase, Python 3.11+
- **Frontend**: Next.js 14, React, TypeScript, Tailwind CSS, shadcn/ui
- **App**: Flet (Python), cross-platform (Windows, Mac, Linux, iOS, Android)
- **Database**: Supabase (PostgreSQL)
- **Deployment**: AWS (ECS/Fargate for backend, Vercel for frontend)

## Design System

All components share the same design system:
- **Primary Red**: #FF3C3C
- **Charcoal Black**: #121212
- **Bone White**: #F9F5EF
- **Muted Gray**: #4C4C4C
- **Accent Yellow**: #FCDC58

**Fonts**:
- Headings: Space Grotesk
- Body: IBM Plex Sans
- Decorative: Permanent Marker, Special Elite

## Quick Start

### 1. Backend (FastAPI)

```bash
cd backend

# Install dependencies
pip install -r requirements.txt

# Set up environment
cp .env.example .env
# Edit .env with your Supabase credentials

# Run backend
python -m app.main
# Or with uvicorn:
uvicorn app.main:app --reload --port 8000
```

Backend will run on http://localhost:8000

### 2. Frontend (Next.js)

```bash
cd frontend

# Install dependencies
npm install

# Set up environment
cp .env.example .env.local
# Edit .env.local with API URL and Supabase credentials

# Run development server
npm run dev
```

Frontend will run on http://localhost:3000

### 3. App (Flet Python)

```bash
cd app

# Install dependencies
pip install -r requirements.txt

# Run app
python main.py
```

App will launch as desktop application and web on http://localhost:3001

## API Documentation

Once the backend is running, visit:
- Swagger UI: http://localhost:8000/docs
- ReDoc: http://localhost:8000/redoc

## API Endpoints

### Authentication
- `POST /api/v1/auth/signup` - Register new user
- `POST /api/v1/auth/signin` - Sign in user
- `POST /api/v1/auth/signout` - Sign out user
- `GET /api/v1/auth/me` - Get current user

### Content
- `GET /api/v1/content/` - List all content
- `GET /api/v1/content/{id}` - Get content by ID
- `POST /api/v1/content/` - Create content
- `PUT /api/v1/content/{id}` - Update content
- `DELETE /api/v1/content/{id}` - Delete content

### Filmmakers
- `GET /api/v1/filmmakers/` - List filmmakers
- `GET /api/v1/filmmakers/{id}` - Get filmmaker profile
- `POST /api/v1/filmmakers/` - Create filmmaker profile
- `PUT /api/v1/filmmakers/{id}` - Update filmmaker profile

### Forum (The Backlot)
- `GET /api/v1/forum/` - List forum posts
- `POST /api/v1/forum/` - Create forum post

### Messages
- `GET /api/v1/messages/` - List messages
- `POST /api/v1/messages/` - Send message

## Features

- 🎬 Content streaming platform
- 👥 Filmmaker profiles and networking
- 💬 The Backlot (community forum)
- 📧 Direct messaging
- 📝 Content submission system
- 🔒 Secure authentication with Supabase
- 📱 Cross-platform (Web, iOS, Android, Windows, Mac, Linux)

## Development

### Running All Services Together

```bash
# Terminal 1 - Backend
cd backend && uvicorn app.main:app --reload --port 8000

# Terminal 2 - Frontend
cd frontend && npm run dev

# Terminal 3 - Flet App
cd app && python main.py
```

## Deployment

### Backend (AWS ECS/Fargate)
```bash
cd backend
docker build -t swn-backend .
# Push to ECR and deploy to ECS
```

### Frontend (Vercel)
```bash
cd frontend
vercel deploy
```

### App (Native Builds)
```bash
cd app

# iOS
flet build ios

# Android
flet build apk

# Windows
flet build windows

# macOS
flet build macos

# Linux
flet build linux
```

## Environment Variables

### Backend (.env)
- `SUPABASE_URL` - Your Supabase project URL
- `SUPABASE_KEY` - Supabase anon key
- `SUPABASE_SERVICE_KEY` - Supabase service role key
- `SECRET_KEY` - JWT secret key
- `AWS_*` - AWS credentials for deployment

### Frontend (.env.local)
- `NEXT_PUBLIC_API_URL` - Backend API URL (http://localhost:8000)
- `NEXT_PUBLIC_SUPABASE_URL` - Supabase URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Supabase anon key

### App (.env)
- `API_URL` - Backend API URL (http://localhost:8000)

## License

Proprietary - Second Watch Network

## Support

For issues and questions, contact the development team.
