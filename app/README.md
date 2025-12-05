# Second Watch Network - Python/Flet

A comprehensive filmmaking platform built with Flet (Python) for cross-platform deployment.

## Features

- 🎬 Content streaming platform
- 👥 Filmmaker community and networking
- 📝 Content submission system
- 🤝 Partnership management
- 👨‍💼 Admin dashboard
- 💬 Forum and messaging
- 📱 Cross-platform: Web, iOS, Android, Windows, Mac, Linux

## Tech Stack

- **Framework**: Flet (Python)
- **Backend**: Supabase
- **Deployment**: AWS (ECS/Fargate)
- **Languages**: Python 3.11+

## Installation

```bash
# Create virtual environment
python -m venv venv

# Activate virtual environment
# On Windows:
venv\Scripts\activate
# On macOS/Linux:
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Copy environment variables
cp .env.example .env
# Edit .env with your Supabase credentials

# Run the app
python main.py
```

## Development

```bash
# Run in development mode
python main.py

# Run tests
pytest

# Format code
black src/
```

## Deployment

### Web (AWS)
```bash
# Build Docker image
docker build -t swn-web .

# Deploy to AWS ECS
# See deployment/aws/README.md
```

### Native Apps
```bash
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

## Project Structure

```
second-watch-network-python/
├── src/
│   ├── pages/           # Page components
│   ├── components/      # Reusable UI components
│   ├── services/        # Business logic & API calls
│   ├── models/          # Data models
│   ├── utils/           # Utility functions
│   └── assets/          # Images, fonts, etc.
├── config/              # Configuration files
├── tests/               # Test files
├── main.py              # Application entry point
└── requirements.txt     # Python dependencies
```

## License

Proprietary - Second Watch Network
