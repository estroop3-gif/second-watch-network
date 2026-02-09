"""
CRM Email Integration Helpers — shared activity/counting functions.
Used by crm.py, crm_admin.py, and email_scheduler.py.
"""
import logging
from app.core.database import execute_insert

logger = logging.getLogger(__name__)


def increment_email_interaction(rep_id: str, column: str):
    """Upsert into crm_interaction_counts for an email-related column."""
    allowed = {"emails", "campaign_emails", "emails_received"}
    if column not in allowed:
        return
    try:
        execute_insert(
            f"""
            INSERT INTO crm_interaction_counts (rep_id, count_date, {column})
            VALUES (:rep_id, CURRENT_DATE, 1)
            ON CONFLICT (rep_id, count_date)
            DO UPDATE SET {column} = crm_interaction_counts.{column} + 1,
                          updated_at = NOW()
            RETURNING *
            """,
            {"rep_id": rep_id},
        )
    except Exception as e:
        logger.error(f"increment_email_interaction error ({column}): {e}")


def create_email_activity(contact_id: str, rep_id: str, activity_type: str,
                          subject: str, description: str, deal_id=None):
    """Create a CRM activity record for an email event."""
    try:
        if deal_id:
            execute_insert(
                """
                INSERT INTO crm_activities
                    (contact_id, rep_id, activity_type, subject, description, activity_date, deal_id)
                VALUES (:cid, :rid, :atype, :subj, :desc, NOW(), :did)
                RETURNING id
                """,
                {
                    "cid": contact_id,
                    "rid": rep_id,
                    "atype": activity_type,
                    "subj": subject,
                    "desc": description,
                    "did": deal_id,
                },
            )
        else:
            execute_insert(
                """
                INSERT INTO crm_activities
                    (contact_id, rep_id, activity_type, subject, description, activity_date)
                VALUES (:cid, :rid, :atype, :subj, :desc, NOW())
                RETURNING id
                """,
                {
                    "cid": contact_id,
                    "rid": rep_id,
                    "atype": activity_type,
                    "subj": subject,
                    "desc": description,
                },
            )
    except Exception as e:
        logger.error(f"create_email_activity error: {e}")
