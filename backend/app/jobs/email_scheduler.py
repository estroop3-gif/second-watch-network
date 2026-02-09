"""
CRM Email Scheduler — Background jobs for scheduled sends, snooze, sequences, and campaign blasts.
Uses APScheduler with AsyncIOScheduler.
"""
import asyncio
import logging
from datetime import datetime, timedelta

from app.core.database import execute_query, execute_single, execute_insert
from app.core.config import settings

logger = logging.getLogger(__name__)


async def process_scheduled_emails():
    """Send emails that are due for delivery. Runs every 60 seconds."""
    try:
        import resend as resend_sdk
        resend_sdk.api_key = settings.RESEND_API_KEY

        due_messages = execute_query(
            """
            SELECT m.*, t.account_id, t.contact_id, t.contact_email,
                   a.email_address, a.display_name, a.signature_html, a.profile_id
            FROM crm_email_messages m
            JOIN crm_email_threads t ON t.id = m.thread_id
            JOIN crm_email_accounts a ON a.id = t.account_id
            WHERE m.status = 'scheduled'
                  AND m.scheduled_at IS NOT NULL
                  AND m.scheduled_at <= NOW()
            ORDER BY m.scheduled_at ASC
            LIMIT 20
            """,
            {},
        )

        for msg in due_messages:
            try:
                body_html = msg["body_html"] or ""

                # Skip tracking pixel for scheduled 1:1 sends to improve deliverability
                # Tracking pixels are only used for campaign/bulk sends

                reply_to = [msg["email_address"], f"reply+{msg['thread_id']}@theswn.com"]

                # Generate plain text fallback if not provided
                plain_text = msg.get("body_text") or ""
                if not plain_text:
                    import re
                    plain_text = re.sub(r'<br\s*/?>', '\n', body_html)
                    plain_text = re.sub(r'<[^>]+>', '', plain_text)
                    plain_text = plain_text.strip()

                # Check if recipient is an internal org member — skip Resend if so
                to_email = msg["to_addresses"][0] if msg.get("to_addresses") else None
                recipient_account = None
                if to_email:
                    recipient_account = execute_single(
                        "SELECT * FROM crm_email_accounts WHERE email_address = :email AND is_active = true",
                        {"email": to_email},
                    )

                if recipient_account:
                    # Internal delivery — skip Resend
                    from app.api.crm import _route_email_internally
                    execute_single(
                        "UPDATE crm_email_messages SET status = 'sent', scheduled_at = NULL WHERE id = :mid RETURNING id",
                        {"mid": msg["id"]},
                    )
                    execute_single(
                        "UPDATE crm_email_threads SET last_message_at = NOW() WHERE id = :tid RETURNING id",
                        {"tid": msg["thread_id"]},
                    )
                    sender_account = {
                        "id": msg["account_id"],
                        "email_address": msg["email_address"],
                        "display_name": msg["display_name"],
                        "profile_id": msg["profile_id"],
                    }
                    _route_email_internally(
                        sender_account=sender_account,
                        recipient_account=recipient_account,
                        subject=msg["subject"],
                        body_html=body_html,
                        body_text=plain_text or "",
                        to_addresses=msg["to_addresses"],
                        cc_addresses=msg.get("cc_addresses") or [],
                    )
                    logger.info(f"Delivered scheduled email {msg['id']} internally to {to_email}")
                    continue

                send_params = {
                    "from": f"{msg['display_name']} <{msg['email_address']}>",
                    "to": msg["to_addresses"],
                    "subject": msg["subject"],
                    "html": body_html,
                    "text": plain_text,
                    "reply_to": reply_to,
                }
                if msg.get("cc_addresses"):
                    send_params["cc"] = msg["cc_addresses"]

                result = resend_sdk.Emails.send(send_params)
                resend_id = result.get("id")

                execute_single(
                    "UPDATE crm_email_messages SET status = 'sent', resend_message_id = :rid, scheduled_at = NULL WHERE id = :mid RETURNING id",
                    {"rid": resend_id, "mid": msg["id"]},
                )

                execute_single(
                    "UPDATE crm_email_threads SET last_message_at = NOW() WHERE id = :tid RETURNING id",
                    {"tid": msg["thread_id"]},
                )

                logger.info(f"Sent scheduled email {msg['id']} to {msg['to_addresses']}")

            except Exception as e:
                logger.error(f"Failed to send scheduled email {msg['id']}: {e}")
                execute_single(
                    "UPDATE crm_email_messages SET status = 'failed' WHERE id = :mid RETURNING id",
                    {"mid": msg["id"]},
                )

    except Exception as e:
        logger.error(f"process_scheduled_emails error: {e}")


async def process_unsnoozed_threads():
    """Clear expired snoozes and optionally send WebSocket notifications. Runs every 60 seconds."""
    try:
        unsnoozed = execute_query(
            """
            UPDATE crm_email_threads
            SET snoozed_until = NULL
            WHERE snoozed_until IS NOT NULL AND snoozed_until <= NOW()
            RETURNING id, account_id
            """,
            {},
        )

        if unsnoozed:
            logger.info(f"Cleared snooze on {len(unsnoozed)} threads")

            # Best-effort WebSocket notifications
            for thread in unsnoozed:
                try:
                    account = execute_single(
                        "SELECT profile_id FROM crm_email_accounts WHERE id = :aid",
                        {"aid": thread["account_id"]},
                    )
                    if account:
                        import boto3
                        import json
                        dynamodb = boto3.resource("dynamodb", region_name="us-east-1")
                        table = dynamodb.Table("second-watch-websocket-connections")
                        resp = table.query(
                            IndexName="GSI1",
                            KeyConditionExpression="GSI1PK = :pk",
                            ExpressionAttributeValues={":pk": f"PROFILE#{account['profile_id']}"},
                        )
                        if resp.get("Items"):
                            apigw = boto3.client("apigatewaymanagementapi",
                                endpoint_url="https://j4f73g2zp0.execute-api.us-east-1.amazonaws.com/prod")
                            notification = json.dumps({
                                "action": "crm:email:unsnoozed",
                                "thread_id": thread["id"],
                            })
                            for item in resp["Items"]:
                                conn_id = item.get("SK", "").replace("CONN#", "")
                                if conn_id:
                                    try:
                                        apigw.post_to_connection(ConnectionId=conn_id, Data=notification.encode())
                                    except Exception:
                                        pass
                except Exception:
                    pass

    except Exception as e:
        logger.error(f"process_unsnoozed_threads error: {e}")


async def process_sequence_sends():
    """Process due sequence enrollment steps. Runs every 300 seconds."""
    try:
        import resend as resend_sdk
        resend_sdk.api_key = settings.RESEND_API_KEY

        due_enrollments = execute_query(
            """
            SELECT e.*, c.email as contact_email, c.first_name, c.last_name, c.company,
                   c.do_not_email,
                   a.email_address as rep_email, a.display_name as rep_name, a.signature_html,
                   a.profile_id as rep_profile_id
            FROM crm_email_sequence_enrollments e
            JOIN crm_contacts c ON c.id = e.contact_id
            JOIN crm_email_accounts a ON a.id = e.account_id
            WHERE e.status = 'active'
                  AND e.next_send_at IS NOT NULL
                  AND e.next_send_at <= NOW()
            ORDER BY e.next_send_at ASC
            LIMIT 20
            """,
            {},
        )

        for enrollment in due_enrollments:
            try:
                if enrollment.get("do_not_email"):
                    execute_single(
                        "UPDATE crm_email_sequence_enrollments SET status = 'unsubscribed', completed_at = NOW() WHERE id = :eid RETURNING id",
                        {"eid": enrollment["id"]},
                    )
                    continue

                # Get the current step
                step = execute_single(
                    "SELECT * FROM crm_email_sequence_steps WHERE sequence_id = :sid AND step_number = :step",
                    {"sid": enrollment["sequence_id"], "step": enrollment["current_step"]},
                )
                if not step:
                    execute_single(
                        "UPDATE crm_email_sequence_enrollments SET status = 'completed', completed_at = NOW() WHERE id = :eid RETURNING id",
                        {"eid": enrollment["id"]},
                    )
                    continue

                # Interpolate variables
                vars_map = {
                    "first_name": enrollment.get("first_name", ""),
                    "last_name": enrollment.get("last_name", ""),
                    "company": enrollment.get("company", ""),
                    "email": enrollment.get("contact_email", ""),
                }
                subject = step["subject"]
                body_html = step["body_html"]
                for key, val in vars_map.items():
                    subject = subject.replace(f"{{{{{key}}}}}", val or "")
                    body_html = body_html.replace(f"{{{{{key}}}}}", val or "")

                # Append signature
                if enrollment.get("signature_html"):
                    body_html += f'<br><br><div style="color: #888; border-top: 1px solid #333; padding-top: 12px; margin-top: 12px;">{enrollment["signature_html"]}</div>'

                # Create/find thread
                existing_thread = execute_single(
                    "SELECT id FROM crm_email_threads WHERE account_id = :aid AND contact_id = :cid AND subject = :subj ORDER BY created_at DESC LIMIT 1",
                    {"aid": enrollment["account_id"], "cid": enrollment["contact_id"], "subj": subject},
                )

                if existing_thread:
                    thread_id = existing_thread["id"]
                else:
                    new_thread = execute_single(
                        """
                        INSERT INTO crm_email_threads (account_id, contact_id, contact_email, subject)
                        VALUES (:aid, :cid, :email, :subj) RETURNING *
                        """,
                        {"aid": enrollment["account_id"], "cid": enrollment["contact_id"],
                         "email": enrollment["contact_email"], "subj": subject},
                    )
                    thread_id = new_thread["id"]

                reply_to = [enrollment["rep_email"], f"reply+{thread_id}@theswn.com"]

                # Send
                send_params = {
                    "from": f"{enrollment['rep_name']} <{enrollment['rep_email']}>",
                    "to": [enrollment["contact_email"]],
                    "subject": subject,
                    "html": body_html,
                    "reply_to": reply_to,
                }

                result = resend_sdk.Emails.send(send_params)
                resend_id = result.get("id")

                # Store message with source attribution
                execute_single(
                    """
                    INSERT INTO crm_email_messages
                        (thread_id, direction, from_address, to_addresses, subject, body_html, resend_message_id, status, source_type, source_id)
                    VALUES (:tid, 'outbound', :from_addr, :to_addrs, :subj, :html, :resend_id, 'sent', 'sequence', :seq_id)
                    RETURNING id
                    """,
                    {"tid": thread_id, "from_addr": enrollment["rep_email"],
                     "to_addrs": [enrollment["contact_email"]], "subj": subject,
                     "html": body_html, "resend_id": resend_id,
                     "seq_id": enrollment["sequence_id"]},
                )

                execute_single(
                    "UPDATE crm_email_threads SET last_message_at = NOW() WHERE id = :tid RETURNING id",
                    {"tid": thread_id},
                )

                # Auto-increment interaction counter + create activity
                from app.api.crm_email_helpers import increment_email_interaction, create_email_activity
                increment_email_interaction(enrollment["rep_profile_id"], "emails")
                create_email_activity(
                    contact_id=enrollment["contact_id"],
                    rep_id=enrollment["rep_profile_id"],
                    activity_type="email_sequence",
                    subject=f"Sequence email: {subject}",
                    description=f"Sent sequence step {enrollment['current_step']} to {enrollment['contact_email']}",
                )

                # Advance to next step
                next_step_number = enrollment["current_step"] + 1
                next_step = execute_single(
                    "SELECT delay_days FROM crm_email_sequence_steps WHERE sequence_id = :sid AND step_number = :step",
                    {"sid": enrollment["sequence_id"], "step": next_step_number},
                )

                if next_step:
                    next_send = datetime.utcnow() + timedelta(days=next_step["delay_days"])
                    execute_single(
                        "UPDATE crm_email_sequence_enrollments SET current_step = :step, next_send_at = :next WHERE id = :eid RETURNING id",
                        {"step": next_step_number, "next": next_send, "eid": enrollment["id"]},
                    )
                else:
                    execute_single(
                        "UPDATE crm_email_sequence_enrollments SET status = 'completed', completed_at = NOW(), next_send_at = NULL WHERE id = :eid RETURNING id",
                        {"eid": enrollment["id"]},
                    )

                logger.info(f"Sent sequence step {enrollment['current_step']} for enrollment {enrollment['id']}")

            except Exception as e:
                logger.error(f"Failed sequence send for enrollment {enrollment['id']}: {e}")
                execute_single(
                    "UPDATE crm_email_sequence_enrollments SET status = 'error' WHERE id = :eid RETURNING id",
                    {"eid": enrollment["id"]},
                )

    except Exception as e:
        logger.error(f"process_sequence_sends error: {e}")


async def process_campaign_sends():
    """Process campaign email blasts with sender rotation. Runs every 120 seconds."""
    try:
        import resend as resend_sdk
        resend_sdk.api_key = settings.RESEND_API_KEY

        # Step 1: Promote scheduled campaigns whose time has come
        execute_query(
            """
            UPDATE crm_email_campaigns
            SET status = 'sending', updated_at = NOW()
            WHERE status = 'scheduled'
                  AND scheduled_at IS NOT NULL
                  AND scheduled_at <= NOW()
            RETURNING id
            """,
            {},
        )

        # Step 2: Fetch all campaigns in 'sending' status
        sending_campaigns = execute_query(
            """
            SELECT c.*, p.full_name as created_by_name
            FROM crm_email_campaigns c
            LEFT JOIN profiles p ON p.id = c.created_by
            WHERE c.status = 'sending'
            ORDER BY c.updated_at ASC
            """,
            {},
        )

        for campaign in sending_campaigns:
            try:
                campaign_id = campaign["id"]
                batch_size = campaign.get("batch_size") or 10
                send_delay = campaign.get("send_delay_seconds") or 5

                # Step 3a: Check if targeting has been run (any sends exist)
                existing_sends = execute_single(
                    "SELECT COUNT(*) as cnt FROM crm_email_sends WHERE campaign_id = :cid",
                    {"cid": campaign_id},
                )

                if existing_sends["cnt"] == 0:
                    # Run initial targeting — find matching contacts
                    conditions = ["c.do_not_email IS NOT TRUE", "c.email IS NOT NULL"]
                    params = {"cid": campaign_id}

                    if campaign.get("target_temperature") and len(campaign["target_temperature"]) > 0:
                        conditions.append("c.temperature = ANY(:temps)")
                        params["temps"] = campaign["target_temperature"]

                    if campaign.get("target_tags") and len(campaign["target_tags"]) > 0:
                        conditions.append("c.tags && :tags")
                        params["tags"] = campaign["target_tags"]

                    where_clause = " AND ".join(conditions)
                    contacts = execute_query(
                        f"""
                        SELECT c.id, c.email, c.first_name, c.last_name, c.company
                        FROM crm_contacts c
                        WHERE {where_clause}
                        ORDER BY c.created_at ASC
                        """,
                        params,
                    )

                    if not contacts:
                        # No matching contacts — mark as sent immediately
                        execute_single(
                            "UPDATE crm_email_campaigns SET status = 'sent', updated_at = NOW() WHERE id = :cid RETURNING id",
                            {"cid": campaign_id},
                        )
                        logger.info(f"Campaign {campaign_id}: no matching contacts, marked as sent")
                        continue

                    # Batch insert pending sends
                    for contact in contacts:
                        execute_insert(
                            """
                            INSERT INTO crm_email_sends (campaign_id, contact_id, status)
                            VALUES (:cid, :contact_id, 'pending')
                            RETURNING id
                            """,
                            {"cid": campaign_id, "contact_id": contact["id"]},
                        )

                    logger.info(f"Campaign {campaign_id}: targeted {len(contacts)} contacts")

                # Step 3b: Process pending sends in batches
                pending_sends = execute_query(
                    """
                    SELECT s.id as send_id, s.contact_id,
                           c.email as contact_email, c.first_name, c.last_name, c.company
                    FROM crm_email_sends s
                    JOIN crm_contacts c ON c.id = s.contact_id
                    WHERE s.campaign_id = :cid AND s.status = 'pending'
                    ORDER BY s.created_at ASC
                    LIMIT :batch_size
                    """,
                    {"cid": campaign_id, "batch_size": batch_size},
                )

                if not pending_sends:
                    # All sends processed — mark campaign as sent
                    execute_single(
                        "UPDATE crm_email_campaigns SET status = 'sent', updated_at = NOW() WHERE id = :cid RETURNING id",
                        {"cid": campaign_id},
                    )
                    logger.info(f"Campaign {campaign_id}: all sends complete, marked as sent")
                    continue

                for send in pending_sends:
                    try:
                        # Round-robin sender: pick the account with lowest send_count
                        sender = execute_single(
                            """
                            SELECT cs.id as cs_id, cs.account_id, cs.send_count,
                                   a.email_address, a.display_name, a.signature_html, a.profile_id
                            FROM crm_campaign_senders cs
                            JOIN crm_email_accounts a ON a.id = cs.account_id
                            WHERE cs.campaign_id = :cid AND a.is_active = true
                            ORDER BY cs.send_count ASC, cs.created_at ASC
                            LIMIT 1
                            """,
                            {"cid": campaign_id},
                        )

                        if not sender:
                            logger.error(f"Campaign {campaign_id}: no active sender accounts assigned")
                            execute_single(
                                "UPDATE crm_email_sends SET status = 'failed' WHERE id = :sid RETURNING id",
                                {"sid": send["send_id"]},
                            )
                            continue

                        # Interpolate template variables
                        vars_map = {
                            "first_name": send.get("first_name") or "",
                            "last_name": send.get("last_name") or "",
                            "company": send.get("company") or "",
                            "email": send.get("contact_email") or "",
                        }
                        subject = campaign["subject_template"]
                        body_html = campaign.get("html_template") or ""
                        for key, val in vars_map.items():
                            subject = subject.replace(f"{{{{{key}}}}}", val)
                            body_html = body_html.replace(f"{{{{{key}}}}}", val)

                        # Append signature if sender has one
                        if sender.get("signature_html"):
                            body_html += f'<br><br><div style="color: #888; border-top: 1px solid #333; padding-top: 12px; margin-top: 12px;">{sender["signature_html"]}</div>'

                        # Append tracking pixel
                        tracking_pixel = f'<img src="https://vnvvoelid6.execute-api.us-east-1.amazonaws.com/api/v1/crm/email/track/{send["send_id"]}/open.png" width="1" height="1" style="display:none" alt="" />'
                        body_html += tracking_pixel

                        # Send via Resend
                        send_params = {
                            "from": f"{sender['display_name']} <{sender['email_address']}>",
                            "to": [send["contact_email"]],
                            "subject": subject,
                            "html": body_html,
                        }
                        if campaign.get("text_template"):
                            text_body = campaign["text_template"]
                            for key, val in vars_map.items():
                                text_body = text_body.replace(f"{{{{{key}}}}}", val)
                            send_params["text"] = text_body

                        result = resend_sdk.Emails.send(send_params)
                        resend_id = result.get("id")

                        # Update send record
                        execute_single(
                            """
                            UPDATE crm_email_sends
                            SET status = 'sent', sent_at = NOW(), sender_account_id = :account_id,
                                resend_message_id = :resend_id
                            WHERE id = :sid RETURNING id
                            """,
                            {"account_id": sender["account_id"], "resend_id": resend_id, "sid": send["send_id"]},
                        )

                        # Increment sender's send count for rotation balancing
                        execute_single(
                            "UPDATE crm_campaign_senders SET send_count = send_count + 1 WHERE id = :cs_id RETURNING id",
                            {"cs_id": sender["cs_id"]},
                        )

                        # Auto-increment interaction counter + create activity
                        from app.api.crm_email_helpers import increment_email_interaction, create_email_activity
                        increment_email_interaction(sender["profile_id"], "campaign_emails")
                        create_email_activity(
                            contact_id=send["contact_id"],
                            rep_id=sender["profile_id"],
                            activity_type="email_campaign",
                            subject=f"Campaign: {subject}",
                            description=f"Campaign email sent to {send['contact_email']}",
                        )

                        logger.info(f"Campaign {campaign_id}: sent to {send['contact_email']} via {sender['email_address']}")

                        # Rate limiting delay between sends
                        if send_delay > 0:
                            await asyncio.sleep(send_delay)

                    except Exception as e:
                        logger.error(f"Campaign {campaign_id}: failed send {send['send_id']}: {e}")
                        execute_single(
                            "UPDATE crm_email_sends SET status = 'failed' WHERE id = :sid RETURNING id",
                            {"sid": send["send_id"]},
                        )

            except Exception as e:
                logger.error(f"Campaign {campaign['id']}: processing error: {e}")

    except Exception as e:
        logger.error(f"process_campaign_sends error: {e}")


def start_email_scheduler():
    """Initialize and start the APScheduler for email jobs."""
    try:
        from apscheduler.schedulers.asyncio import AsyncIOScheduler

        scheduler = AsyncIOScheduler()
        scheduler.add_job(process_scheduled_emails, "interval", seconds=60, id="scheduled_emails")
        scheduler.add_job(process_unsnoozed_threads, "interval", seconds=60, id="unsnoozed_threads")
        scheduler.add_job(process_sequence_sends, "interval", seconds=300, id="sequence_sends")
        scheduler.add_job(process_campaign_sends, "interval", seconds=120, id="campaign_sends")
        scheduler.start()
        logger.info("Email scheduler started with 4 jobs")
        return scheduler
    except ImportError:
        logger.warning("APScheduler not installed — email scheduler disabled. Install with: pip install apscheduler")
        return None
