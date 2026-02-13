"""
CRM Notifications — broadcast notifications to all CRM-eligible users.
"""
from app.core.database import execute_query, get_db_session
from sqlalchemy import text


async def notify_crm_users(
    event_type: str,
    title: str,
    body: str | None = None,
    related_id: str | None = None,
    payload: dict | None = None,
    exclude_profile_id: str | None = None,
):
    """
    Insert a notification for every profile that has a CRM role flag set.
    Excludes the actor so they don't get notified of their own actions.

    Fire-and-forget: exceptions are swallowed so callers are never broken.
    """
    try:
        # Fetch all CRM-eligible profile IDs
        rows = execute_query(
            """
            SELECT id FROM profiles
            WHERE is_sales_rep = true
               OR is_sales_agent = true
               OR is_sales_admin = true
               OR is_admin = true
               OR is_superadmin = true
            """,
        )
        recipient_ids = [r["id"] for r in rows if r["id"] != exclude_profile_id]

        if not recipient_ids:
            return

        # Batch insert notifications
        import json

        with get_db_session() as db:
            for uid in recipient_ids:
                db.execute(
                    text(
                        """
                        INSERT INTO notifications (user_id, type, title, body, related_id, payload, is_read)
                        VALUES (:uid, :etype, :title, :body, :rid, :payload, false)
                        """
                    ),
                    {
                        "uid": uid,
                        "etype": event_type,
                        "title": title,
                        "body": body,
                        "rid": related_id,
                        "payload": json.dumps(payload) if payload else None,
                    },
                )
    except Exception as e:
        # Fire-and-forget — never break the caller
        print(f"[crm_notifications] Failed to send notifications: {e}")
