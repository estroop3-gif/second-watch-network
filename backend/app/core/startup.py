"""
Application Startup Tasks
Handles initialization tasks like superadmin setup.
"""
import logging
from app.core.config import settings
from app.core.supabase import get_supabase_admin_client

logger = logging.getLogger(__name__)


async def initialize_superadmin():
    """
    Initialize the superadmin user on application startup.

    If SUPERADMIN_EMAIL is configured and the user exists in the database,
    sets their is_superadmin flag to True.

    This ensures the main admin always has full access even after database resets.
    """
    superadmin_email = settings.SUPERADMIN_EMAIL

    if not superadmin_email:
        logger.info("SUPERADMIN_EMAIL not configured, skipping superadmin initialization")
        return

    try:
        supabase = get_supabase_admin_client()

        # Check if user exists
        response = supabase.table("profiles").select("id, email, is_superadmin").eq("email", superadmin_email).execute()

        if not response.data:
            logger.warning(f"Superadmin user with email {superadmin_email} not found in database")
            return

        user_data = response.data[0]
        user_id = user_data["id"]

        # Check if already superadmin
        if user_data.get("is_superadmin"):
            logger.info(f"Superadmin {superadmin_email} already has superadmin privileges")
            return

        # Grant superadmin privileges
        update_response = supabase.table("profiles").update({
            "is_superadmin": True,
            "is_admin": True,  # Superadmins should also have admin flag
        }).eq("id", user_id).execute()

        if update_response.data:
            logger.info(f"Successfully granted superadmin privileges to {superadmin_email}")
        else:
            logger.error(f"Failed to grant superadmin privileges to {superadmin_email}")

    except Exception as e:
        logger.error(f"Error initializing superadmin: {str(e)}")


async def on_startup():
    """
    Run all startup tasks.
    Call this from main.py during application startup.
    """
    logger.info("Running startup tasks...")

    # Initialize superadmin
    await initialize_superadmin()

    logger.info("Startup tasks completed")
