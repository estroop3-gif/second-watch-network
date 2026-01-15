"""
Project API service for fetching project data from SWN backend.
Used by the Upload tab to populate destination settings.
"""
import logging
from typing import Dict, List, Any, Optional
import httpx

from src.services.config import ConfigManager

logger = logging.getLogger("swn-helper")


class ProjectAPIService:
    """Service for fetching project-related data from the API."""

    API_BASE = "https://vnvvoelid6.execute-api.us-east-1.amazonaws.com"
    TIMEOUT = 30.0

    def __init__(self, config: ConfigManager):
        self.config = config

    def _get_headers(self) -> Dict[str, str]:
        """Get headers with API key."""
        api_key = self.config.get_api_key()
        return {
            "X-API-Key": api_key or "",
            "Content-Type": "application/json",
        }

    def get_production_days(self, project_id: str) -> List[Dict[str, Any]]:
        """
        Get production days (schedule) for a project.
        Returns list of production days with id, day_number, date, title, etc.
        """
        try:
            url = f"{self.API_BASE}/api/v1/backlot/desktop-keys/projects/{project_id}/production-days"
            with httpx.Client(timeout=self.TIMEOUT) as client:
                response = client.get(url, headers=self._get_headers())
                response.raise_for_status()
                data = response.json()
                return data.get("production_days", [])
        except Exception as e:
            logger.error(f"Error fetching production days: {e}")
            return []

    def get_dailies_days(self, project_id: str) -> List[Dict[str, Any]]:
        """
        Get dailies days for a project.
        Returns list of existing dailies days with their production day info.
        """
        try:
            url = f"{self.API_BASE}/api/v1/backlot/desktop-keys/projects/{project_id}/dailies/days"
            with httpx.Client(timeout=self.TIMEOUT) as client:
                response = client.get(url, headers=self._get_headers())
                response.raise_for_status()
                data = response.json()
                return data if isinstance(data, list) else data.get("days", [])
        except Exception as e:
            logger.error(f"Error fetching dailies days: {e}")
            return []

    def create_dailies_day(
        self,
        project_id: str,
        production_day_id: str,
        label: str = None
    ) -> Optional[Dict[str, Any]]:
        """
        Create a new dailies day folder for a production day.
        Returns the created dailies day or None on failure.
        """
        try:
            url = f"{self.API_BASE}/api/v1/backlot/desktop-keys/projects/{project_id}/dailies/days"
            payload = {
                "production_day_id": production_day_id,
            }
            if label:
                payload["label"] = label

            with httpx.Client(timeout=self.TIMEOUT) as client:
                response = client.post(url, headers=self._get_headers(), json=payload)
                response.raise_for_status()
                return response.json()
        except Exception as e:
            logger.error(f"Error creating dailies day: {e}")
            return None

    def get_review_folders(self, project_id: str) -> List[Dict[str, Any]]:
        """
        Get review folders for a project.
        Returns list of folders with id, name, sort_order, etc.
        """
        try:
            url = f"{self.API_BASE}/api/v1/backlot/desktop-keys/projects/{project_id}/review/folders"
            with httpx.Client(timeout=self.TIMEOUT) as client:
                response = client.get(url, headers=self._get_headers())
                response.raise_for_status()
                data = response.json()
                return data.get("folders", [])
        except Exception as e:
            logger.error(f"Error fetching review folders: {e}")
            return []

    def get_asset_folders(self, project_id: str) -> List[Dict[str, Any]]:
        """
        Get asset folders for a project.
        Returns list of folders with id, name, sort_order, etc.
        """
        try:
            url = f"{self.API_BASE}/api/v1/backlot/desktop-keys/projects/{project_id}/assets/folders"
            with httpx.Client(timeout=self.TIMEOUT) as client:
                response = client.get(url, headers=self._get_headers())
                response.raise_for_status()
                data = response.json()
                return data.get("folders", [])
        except Exception as e:
            logger.error(f"Error fetching asset folders: {e}")
            return []

    def create_asset_folder(
        self,
        project_id: str,
        name: str,
        folder_type: str = None
    ) -> Optional[Dict[str, Any]]:
        """
        Create a new asset folder for a project.
        Returns the created folder or None on failure.
        """
        try:
            url = f"{self.API_BASE}/api/v1/backlot/desktop-keys/projects/{project_id}/assets/folders"
            payload = {"name": name}
            if folder_type:
                payload["folder_type"] = folder_type

            with httpx.Client(timeout=self.TIMEOUT) as client:
                response = client.post(url, headers=self._get_headers(), json=payload)

                # Log full response for debugging on errors
                if response.status_code != 200:
                    logger.error(f"API error {response.status_code}: {response.text}")

                response.raise_for_status()
                data = response.json()
                return data.get("folder")
        except httpx.HTTPStatusError as e:
            # Log the actual error message from the server
            error_detail = "Unknown error"
            try:
                error_detail = e.response.json().get("detail", e.response.text)
            except Exception:
                error_detail = e.response.text
            logger.error(f"Error creating asset folder: {error_detail}")
            return None
        except Exception as e:
            logger.error(f"Error creating asset folder: {e}")
            return None
