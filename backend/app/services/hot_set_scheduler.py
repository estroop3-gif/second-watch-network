"""
Hot Set Scheduler Service
Background service for Hot Set auto-start and notifications.

Features:
- Auto-start sessions at crew call time
- Send pre-crew call notifications to crew
- Check for sessions approaching crew call
"""

import logging
from datetime import datetime, timedelta, timezone
from typing import Dict, Any, Optional, List

from app.core.database import get_client, execute_query, execute_single
from app.services.email_service import EmailService

logger = logging.getLogger(__name__)


class HotSetSchedulerService:
    """Service for Hot Set auto-start and notifications."""

    @staticmethod
    async def check_and_auto_start_sessions() -> Dict[str, Any]:
        """
        Check for sessions that should be auto-started.

        This should run every minute (or on a schedule).

        Auto-starts sessions when:
        1. Session status is 'not_started'
        2. Session has not been auto-started yet
        3. Current time >= (crew_call_time - auto_start_minutes_before_call)
        4. Auto-start is enabled in project settings

        Returns:
            Dict with results: sessions checked, started, notifications sent
        """
        try:
            client = get_client()
            now = datetime.now(timezone.utc)

            # Find sessions that are candidates for auto-start
            # Join with production_days to get crew_call_time
            # Join with settings to check if auto-start is enabled
            candidates = execute_query("""
                SELECT
                    s.id as session_id,
                    s.project_id,
                    s.production_day_id,
                    s.status,
                    s.auto_started,
                    pd.general_call_time,
                    pd.date as day_date,
                    COALESCE(settings.auto_start_enabled, true) as auto_start_enabled,
                    COALESCE(settings.auto_start_minutes_before_call, 30) as auto_start_minutes,
                    COALESCE(settings.notifications_enabled, true) as notifications_enabled,
                    COALESCE(settings.notify_crew_on_auto_start, true) as notify_crew_on_auto_start
                FROM backlot_hot_set_sessions s
                JOIN backlot_production_days pd ON s.production_day_id = pd.id
                LEFT JOIN backlot_hot_set_settings settings ON s.project_id = settings.project_id
                WHERE s.status = 'not_started'
                  AND (s.auto_started IS NULL OR s.auto_started = false)
                  AND pd.general_call_time IS NOT NULL
                  AND pd.date IS NOT NULL
            """)

            if not candidates:
                logger.info("No sessions to check for auto-start")
                return {
                    "success": True,
                    "checked": 0,
                    "started": 0,
                    "notifications_sent": 0
                }

            started_count = 0
            notifications_sent = 0

            for session in candidates:
                # Skip if auto-start is disabled for this project
                if not session['auto_start_enabled']:
                    continue

                # Parse crew call time
                try:
                    day_date = session['day_date']
                    call_time = session['general_call_time']  # e.g., "06:00:00"

                    # Combine date and time
                    call_datetime_str = f"{day_date}T{call_time}"
                    crew_call_time = datetime.fromisoformat(call_datetime_str).replace(tzinfo=timezone.utc)

                    # Calculate auto-start time
                    auto_start_minutes = session['auto_start_minutes']
                    auto_start_time = crew_call_time - timedelta(minutes=auto_start_minutes)

                    # Check if it's time to auto-start
                    if now >= auto_start_time:
                        logger.info(f"Auto-starting session {session['session_id']} for crew call at {crew_call_time}")

                        # Auto-start the session
                        result = await HotSetSchedulerService.auto_start_session(
                            session['session_id'],
                            crew_call_time.isoformat()
                        )

                        if result['success']:
                            started_count += 1

                            # Send notifications if enabled
                            if session['notify_crew_on_auto_start'] and session['notifications_enabled']:
                                notification_result = await HotSetSchedulerService.send_auto_start_notification(
                                    session['session_id'],
                                    session['project_id'],
                                    crew_call_time
                                )
                                if notification_result['success']:
                                    notifications_sent += notification_result['recipients_count']

                except Exception as e:
                    logger.error(f"Error processing session {session['session_id']}: {e}")
                    continue

            return {
                "success": True,
                "checked": len(candidates),
                "started": started_count,
                "notifications_sent": notifications_sent
            }

        except Exception as e:
            logger.error(f"Failed to check and auto-start sessions: {e}")
            return {
                "success": False,
                "error": str(e)
            }

    @staticmethod
    async def auto_start_session(session_id: str, crew_call_time: str) -> Dict[str, Any]:
        """
        Auto-start a session.

        Args:
            session_id: Session ID
            crew_call_time: ISO timestamp of crew call time

        Returns:
            Dict with success status
        """
        try:
            client = get_client()
            now = datetime.now(timezone.utc).isoformat()

            # Update session to mark it as auto-started
            result = client.table("backlot_hot_set_sessions")\
                .update({
                    "status": "in_progress",
                    "auto_started": True,
                    "started_at": now,
                    "actual_call_time": crew_call_time,
                })\
                .eq("id", session_id)\
                .execute()

            if not result.data or len(result.data) == 0:
                raise Exception(f"Failed to update session {session_id}")

            logger.info(f"Successfully auto-started session {session_id}")
            return {
                "success": True,
                "session_id": session_id,
                "started_at": now
            }

        except Exception as e:
            logger.error(f"Failed to auto-start session {session_id}: {e}")
            return {
                "success": False,
                "session_id": session_id,
                "error": str(e)
            }

    @staticmethod
    async def send_auto_start_notification(
        session_id: str,
        project_id: str,
        crew_call_time: datetime
    ) -> Dict[str, Any]:
        """
        Send notification to crew when session is auto-started.

        Args:
            session_id: Session ID
            project_id: Project ID
            crew_call_time: Crew call time as datetime

        Returns:
            Dict with success status and recipients count
        """
        try:
            client = get_client()

            # Get crew for this session from call sheet
            session = execute_single("""
                SELECT s.*, pd.title as day_title, pd.day_number
                FROM backlot_hot_set_sessions s
                JOIN backlot_production_days pd ON s.production_day_id = pd.id
                WHERE s.id = :session_id
            """, {"session_id": session_id})

            if not session or not session.get('call_sheet_id'):
                logger.warning(f"No call sheet found for session {session_id}, skipping notification")
                return {
                    "success": True,
                    "recipients_count": 0,
                    "message": "No call sheet linked"
                }

            # Get crew from call sheet
            crew = execute_query("""
                SELECT DISTINCT p.user_id
                FROM backlot_call_sheet_people p
                WHERE p.call_sheet_id = :call_sheet_id
                  AND p.user_id IS NOT NULL
            """, {"call_sheet_id": session['call_sheet_id']})

            if not crew:
                logger.warning(f"No crew found for call sheet {session['call_sheet_id']}")
                return {
                    "success": True,
                    "recipients_count": 0,
                    "message": "No crew found"
                }

            recipient_ids = [str(c['user_id']) for c in crew]

            # Create notification record
            notification_data = {
                "session_id": session_id,
                "notification_type": "auto_start",
                "recipient_profile_ids": recipient_ids,
                "recipient_count": len(recipient_ids),
                "title": f"Hot Set: Day {session['day_number']} Starting",
                "message": f"The Hot Set session for {session['day_title'] or f'Day {session[\"day_number\"]}'} is now active. Crew call at {crew_call_time.strftime('%I:%M %p')}.",
                "delivery_method": "in_app",
                "metadata": {
                    "crew_call_time": crew_call_time.isoformat(),
                    "project_id": project_id
                }
            }

            client.table("backlot_hot_set_notifications")\
                .insert(notification_data)\
                .execute()

            logger.info(f"Sent auto-start notification to {len(recipient_ids)} crew members")

            return {
                "success": True,
                "recipients_count": len(recipient_ids)
            }

        except Exception as e:
            logger.error(f"Failed to send auto-start notification for session {session_id}: {e}")
            return {
                "success": False,
                "error": str(e),
                "recipients_count": 0
            }

    @staticmethod
    async def send_pre_crew_call_notifications() -> Dict[str, Any]:
        """
        Send notifications to crew before crew call.

        Checks for sessions where:
        1. Current time is within notification window (e.g., 30 minutes before call)
        2. Notification hasn't been sent yet
        3. Notifications are enabled

        Returns:
            Dict with results: sessions checked, notifications sent
        """
        try:
            client = get_client()
            now = datetime.now(timezone.utc)

            # Find sessions approaching crew call
            candidates = execute_query("""
                SELECT
                    s.id as session_id,
                    s.project_id,
                    s.production_day_id,
                    pd.general_call_time,
                    pd.date as day_date,
                    pd.title as day_title,
                    pd.day_number,
                    COALESCE(settings.notifications_enabled, true) as notifications_enabled,
                    COALESCE(settings.notify_minutes_before_call, 30) as notify_minutes_before
                FROM backlot_hot_set_sessions s
                JOIN backlot_production_days pd ON s.production_day_id = pd.id
                LEFT JOIN backlot_hot_set_settings settings ON s.project_id = settings.project_id
                WHERE s.status = 'not_started'
                  AND pd.general_call_time IS NOT NULL
                  AND pd.date IS NOT NULL
                  AND NOT EXISTS (
                      SELECT 1 FROM backlot_hot_set_notifications n
                      WHERE n.session_id = s.id
                        AND n.notification_type = 'pre_crew_call'
                  )
            """)

            if not candidates:
                return {
                    "success": True,
                    "checked": 0,
                    "sent": 0
                }

            sent_count = 0

            for session in candidates:
                if not session['notifications_enabled']:
                    continue

                try:
                    # Parse crew call time
                    day_date = session['day_date']
                    call_time = session['general_call_time']
                    call_datetime_str = f"{day_date}T{call_time}"
                    crew_call_time = datetime.fromisoformat(call_datetime_str).replace(tzinfo=timezone.utc)

                    # Calculate notification time
                    notify_minutes = session['notify_minutes_before']
                    notify_time = crew_call_time - timedelta(minutes=notify_minutes)

                    # Check if it's time to send notification (within 5 minute window)
                    time_until_notify = (notify_time - now).total_seconds() / 60

                    if -5 <= time_until_notify <= 5:  # Within 5 minutes of notify time
                        result = await HotSetSchedulerService.send_pre_crew_call_notification_for_session(
                            session['session_id'],
                            session['project_id'],
                            crew_call_time,
                            session['day_title'],
                            session['day_number']
                        )
                        if result['success']:
                            sent_count += 1

                except Exception as e:
                    logger.error(f"Error sending pre-crew call notification for session {session['session_id']}: {e}")
                    continue

            return {
                "success": True,
                "checked": len(candidates),
                "sent": sent_count
            }

        except Exception as e:
            logger.error(f"Failed to send pre-crew call notifications: {e}")
            return {
                "success": False,
                "error": str(e)
            }

    @staticmethod
    async def send_pre_crew_call_notification_for_session(
        session_id: str,
        project_id: str,
        crew_call_time: datetime,
        day_title: Optional[str],
        day_number: int
    ) -> Dict[str, Any]:
        """
        Send pre-crew call notification for a specific session.
        """
        try:
            client = get_client()

            # Get crew from call sheet
            session = execute_single("""
                SELECT call_sheet_id FROM backlot_hot_set_sessions
                WHERE id = :session_id
            """, {"session_id": session_id})

            if not session or not session.get('call_sheet_id'):
                return {
                    "success": True,
                    "recipients_count": 0,
                    "message": "No call sheet linked"
                }

            crew = execute_query("""
                SELECT DISTINCT p.user_id
                FROM backlot_call_sheet_people p
                WHERE p.call_sheet_id = :call_sheet_id
                  AND p.user_id IS NOT NULL
            """, {"call_sheet_id": session['call_sheet_id']})

            if not crew:
                return {
                    "success": True,
                    "recipients_count": 0,
                    "message": "No crew found"
                }

            recipient_ids = [str(c['user_id']) for c in crew]

            # Create notification
            notification_data = {
                "session_id": session_id,
                "notification_type": "pre_crew_call",
                "recipient_profile_ids": recipient_ids,
                "recipient_count": len(recipient_ids),
                "title": f"Crew Call Reminder: Day {day_number}",
                "message": f"Crew call for {day_title or f'Day {day_number}'} is at {crew_call_time.strftime('%I:%M %p')}. Please arrive on time and ready to work.",
                "delivery_method": "in_app",
                "metadata": {
                    "crew_call_time": crew_call_time.isoformat(),
                    "project_id": project_id
                }
            }

            client.table("backlot_hot_set_notifications")\
                .insert(notification_data)\
                .execute()

            logger.info(f"Sent pre-crew call notification to {len(recipient_ids)} crew members for session {session_id}")

            return {
                "success": True,
                "recipients_count": len(recipient_ids)
            }

        except Exception as e:
            logger.error(f"Failed to send pre-crew call notification: {e}")
            return {
                "success": False,
                "error": str(e),
                "recipients_count": 0
            }
