"""
API Client for FastAPI Backend
"""
import httpx
from typing import Optional, Dict, Any


class APIClient:
    def __init__(self, base_url: str = "http://localhost:8000"):
        self.base_url = base_url
        self.client = httpx.Client(base_url=base_url)
        self.access_token: Optional[str] = None

    def set_token(self, token: str):
        """Set authentication token"""
        self.access_token = token
        self.client.headers.update({"Authorization": f"Bearer {token}"})

    def _request(self, method: str, endpoint: str, **kwargs) -> Dict[Any, Any]:
        """Make HTTP request"""
        response = self.client.request(method, endpoint, **kwargs)
        response.raise_for_status()
        return response.json()

    # Auth endpoints
    def sign_up(self, email: str, password: str, full_name: Optional[str] = None):
        """Sign up a new user"""
        return self._request("POST", "/api/v1/auth/signup", json={
            "email": email,
            "password": password,
            "full_name": full_name
        })

    def sign_in(self, email: str, password: str):
        """Sign in user"""
        response = self._request("POST", "/api/v1/auth/signin", json={
            "email": email,
            "password": password
        })
        if response.get("access_token"):
            self.set_token(response["access_token"])
        return response

    def sign_out(self):
        """Sign out user"""
        result = self._request("POST", "/api/v1/auth/signout")
        self.access_token = None
        self.client.headers.pop("Authorization", None)
        return result

    def get_current_user(self):
        """Get current user"""
        return self._request("GET", "/api/v1/auth/me")

    # Content endpoints
    def list_content(self, skip: int = 0, limit: int = 20, content_type: Optional[str] = None):
        """List content"""
        params = {"skip": skip, "limit": limit}
        if content_type:
            params["content_type"] = content_type
        return self._request("GET", "/api/v1/content/", params=params)

    def get_content(self, content_id: str):
        """Get content by ID"""
        return self._request("GET", f"/api/v1/content/{content_id}")

    # Filmmakers endpoints
    def list_filmmakers(self, skip: int = 0, limit: int = 20, specialty: Optional[str] = None):
        """List filmmakers"""
        params = {"skip": skip, "limit": limit}
        if specialty:
            params["specialty"] = specialty
        return self._request("GET", "/api/v1/filmmakers/", params=params)

    def get_filmmaker(self, filmmaker_id: str):
        """Get filmmaker by ID"""
        return self._request("GET", f"/api/v1/filmmakers/{filmmaker_id}")

    # Forum endpoints
    def list_forum_posts(self, skip: int = 0, limit: int = 20):
        """List forum posts"""
        return self._request("GET", "/api/v1/forum/", params={"skip": skip, "limit": limit})

    def create_forum_post(self, title: str, content: str, category: Optional[str] = None):
        """Create forum post"""
        return self._request("POST", "/api/v1/forum/", json={
            "title": title,
            "content": content,
            "category": category
        })

    # Messages endpoints
    def list_messages(self, user_id: str):
        """List messages for user"""
        return self._request("GET", "/api/v1/messages/", params={"user_id": user_id})

    def send_message(self, recipient_id: str, content: str):
        """Send message"""
        return self._request("POST", "/api/v1/messages/", json={
            "recipient_id": recipient_id,
            "content": content
        })
