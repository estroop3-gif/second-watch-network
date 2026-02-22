"""
CRM Email Scheduler — Background jobs for scheduled sends, snooze, sequences, and campaign blasts.
Uses APScheduler with AsyncIOScheduler.
"""
import asyncio
import logging
import random
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
                    plain_text = re.sub(r'</p>\s*<p[^>]*>', '\n\n', body_html)
                    plain_text = re.sub(r'<br\s*/?>', '\n', plain_text)
                    plain_text = re.sub(r'</(div|h[1-6]|li|tr)>', '\n', plain_text)
                    plain_text = re.sub(r'<[^>]+>', '', plain_text)
                    plain_text = plain_text.strip()

                # Split recipients into internal vs external
                from app.api.crm import _route_email_internally
                internal_recipients = []
                external_recipients = []
                for to_addr in (msg.get("to_addresses") or []):
                    acct = execute_single(
                        "SELECT * FROM crm_email_accounts WHERE email_address = :email AND is_active = true",
                        {"email": to_addr},
                    )
                    if acct:
                        internal_recipients.append((to_addr, acct))
                    else:
                        external_recipients.append(to_addr)

                sender_account = {
                    "id": msg["account_id"],
                    "email_address": msg["email_address"],
                    "display_name": msg["display_name"],
                    "profile_id": msg["profile_id"],
                }

                # Route to internal recipients
                for to_addr, recipient_account in internal_recipients:
                    _route_email_internally(
                        sender_account=sender_account,
                        recipient_account=recipient_account,
                        subject=msg["subject"],
                        body_html=body_html,
                        body_text=plain_text or "",
                        to_addresses=msg.get("to_addresses") or [],
                        cc_addresses=msg.get("cc_addresses") or [],
                    )

                if not external_recipients:
                    # All internal — skip Resend
                    execute_single(
                        "UPDATE crm_email_messages SET status = 'sent', scheduled_at = NULL WHERE id = :mid RETURNING id",
                        {"mid": msg["id"]},
                    )
                    execute_single(
                        "UPDATE crm_email_threads SET last_message_at = NOW() WHERE id = :tid RETURNING id",
                        {"tid": msg["thread_id"]},
                    )
                    logger.info(f"Delivered scheduled email {msg['id']} internally to {[a for a, _ in internal_recipients]}")
                    continue

                from app.api.crm import add_email_inline_styles
                send_params = {
                    "from": f"{msg['display_name']} <{msg['email_address']}>",
                    "to": external_recipients,
                    "subject": msg["subject"],
                    "html": add_email_inline_styles(body_html),
                    "text": plain_text,
                    "reply_to": reply_to,
                }
                if msg.get("cc_addresses"):
                    send_params["cc"] = msg["cc_addresses"]
                if msg.get("bcc_addresses"):
                    send_params["bcc"] = msg["bcc_addresses"]

                # Fetch and attach files for scheduled sends
                sched_attachments = execute_query(
                    "SELECT * FROM crm_email_attachments WHERE message_id = :mid",
                    {"mid": msg["id"]},
                )
                if sched_attachments:
                    import boto3
                    s3 = boto3.client("s3", region_name="us-east-1")
                    resend_atts = []
                    for att in sched_attachments:
                        try:
                            bucket = att.get("s3_bucket") or settings.AWS_S3_BACKLOT_FILES_BUCKET
                            s3_obj = s3.get_object(Bucket=bucket, Key=att["s3_key"])
                            resend_atts.append({
                                "filename": att["filename"],
                                "content": s3_obj["Body"].read(),
                            })
                        except Exception as e:
                            logger.warning(f"Failed to fetch attachment {att['id']} for scheduled email: {e}")
                    if resend_atts:
                        send_params["attachments"] = resend_atts

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
                                endpoint_url="https://df3xkisme7.execute-api.us-east-1.amazonaws.com/prod")
                            notification = json.dumps({
                                "event": "crm:email:unsnoozed",
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
                from app.api.crm import add_email_inline_styles
                send_params = {
                    "from": f"{enrollment['rep_name']} <{enrollment['rep_email']}>",
                    "to": [enrollment["contact_email"]],
                    "subject": subject,
                    "html": add_email_inline_styles(body_html),
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
                        from app.api.crm import add_email_inline_styles as _style
                        send_params = {
                            "from": f"{sender['display_name']} <{sender['email_address']}>",
                            "to": [send["contact_email"]],
                            "subject": subject,
                            "html": _style(body_html),
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


async def process_notification_digests():
    """
    Process queued email notification digests.
    Runs every 900 seconds (15 minutes). Checks accounts with digest mode enabled,
    groups unsent queue items, sends digest email, and marks items as sent.
    """
    try:
        from app.core.database import execute_query, execute_single
        from app.services.email_templates import build_digest_notification_email
        from app.services.email_service import EmailService
        from datetime import datetime, timedelta

        # Find accounts with unsent digest items
        accounts = execute_query(
            """
            SELECT DISTINCT a.id, a.email_address, a.notification_email,
                   a.notification_digest_interval, a.last_digest_sent_at
            FROM crm_email_accounts a
            JOIN crm_email_notification_queue q ON q.account_id = a.id AND q.sent_at IS NULL
            WHERE a.notification_mode = 'digest'
              AND a.notification_email IS NOT NULL
              AND a.is_active = true
            """,
            {},
        )

        for account in accounts:
            try:
                # Check if enough time has elapsed since last digest
                interval = account.get("notification_digest_interval", "hourly")
                last_sent = account.get("last_digest_sent_at")

                if last_sent:
                    threshold = timedelta(hours=1) if interval == "hourly" else timedelta(hours=24)
                    if isinstance(last_sent, str):
                        last_sent = datetime.fromisoformat(last_sent.replace("Z", "+00:00"))
                    if datetime.utcnow().replace(tzinfo=last_sent.tzinfo) - last_sent < threshold:
                        continue

                # Get unsent messages for this account
                messages = execute_query(
                    """
                    SELECT from_address, subject, preview_text, created_at
                    FROM crm_email_notification_queue
                    WHERE account_id = :aid AND sent_at IS NULL
                    ORDER BY created_at
                    """,
                    {"aid": account["id"]},
                )

                if not messages:
                    continue

                # Build and send digest
                crm_url = "https://www.secondwatchnetwork.com/crm/email"
                html = build_digest_notification_email(
                    account_email=account["email_address"],
                    messages=messages,
                    crm_url=crm_url,
                )
                count = len(messages)
                await EmailService.send_email(
                    to_emails=[account["notification_email"]],
                    subject=f"{count} new email{'s' if count != 1 else ''} in {account['email_address']}",
                    html_content=html,
                    email_type="crm_digest",
                    source_service="crm",
                    source_action="digest_notification",
                )

                # Mark queue items as sent
                execute_query(
                    "UPDATE crm_email_notification_queue SET sent_at = NOW() WHERE account_id = :aid AND sent_at IS NULL",
                    {"aid": account["id"]},
                )

                # Update last digest sent timestamp
                execute_query(
                    "UPDATE crm_email_accounts SET last_digest_sent_at = NOW() WHERE id = :aid",
                    {"aid": account["id"]},
                )

                logger.info(f"Sent digest with {count} messages for {account['email_address']}")

            except Exception as e:
                logger.error(f"Digest for account {account['id']}: {e}")

    except Exception as e:
        logger.error(f"process_notification_digests error: {e}")


# ---------------------------------------------------------------------------
# Internal Email Warmup — realistic conversations between @theswn.com accounts
# ---------------------------------------------------------------------------

WARMUP_CONVERSATIONS = [
    {"subject": "Quick question about the rollout", "body": "Hey, do you have a few minutes to chat about the timeline for the new rollout? I want to make sure we're aligned before the end of the week."},
    {"subject": "Following up on yesterday's call", "body": "Just wanted to follow up on what we discussed yesterday. Let me know if you need anything else from my end."},
    {"subject": "Meeting notes from today", "body": "Here are the key takeaways from today's meeting. Let me know if I missed anything or if you have questions."},
    {"subject": "Thoughts on the new campaign strategy?", "body": "I've been thinking about the approach we discussed for Q2. Do you think we should prioritize the digital push or keep the focus on partnerships?"},
    {"subject": "Updated project timeline", "body": "I just updated the project timeline based on our last conversation. Take a look when you get a chance and let me know if the dates work for your team."},
    {"subject": "Client feedback summary", "body": "Got some great feedback from the client call this morning. They're really excited about the direction we're heading. I'll put together a summary doc by EOD."},
    {"subject": "Quick favor", "body": "Hey, could you send me the latest version of the deck? I want to review it before our presentation tomorrow. Thanks!"},
    {"subject": "Team lunch next week?", "body": "Thinking about organizing a team lunch next week to celebrate hitting our milestone. Any day work better for you?"},
    {"subject": "FYI - schedule change", "body": "Heads up — the weekly sync got moved to Thursday at 2pm this week. Same agenda, just different day. Let me know if that conflicts with anything."},
    {"subject": "Resource allocation for next sprint", "body": "Can we carve out some time to talk about resource allocation for the next sprint? I want to make sure we're not overcommitting on deliverables."},
    {"subject": "Great job on the presentation", "body": "Just wanted to say great job on the presentation today. The client seemed really impressed with the data you pulled together."},
    {"subject": "Budget review reminder", "body": "Quick reminder that the budget review is coming up next Friday. Let me know if you need any numbers from my side before then."},
    {"subject": "New tool recommendation", "body": "I came across a tool that might help streamline our workflow. Want to hop on a quick call so I can walk you through it?"},
    {"subject": "Content calendar update", "body": "I made some changes to the content calendar based on what we talked about. Take a look and let me know if you want to adjust anything."},
    {"subject": "Check-in on the onboarding process", "body": "How's the new onboarding flow coming along? I know you were working on simplifying a few steps. Happy to help test it out."},
]

WARMUP_REPLIES = [
    "Sounds good, let's touch base later today.",
    "Got it — I'll take a look and get back to you by end of day.",
    "Thanks for the heads up! I'll adjust my schedule accordingly.",
    "Great idea. Let me pull some data together and we can discuss.",
    "Appreciate the update. I think we're on the right track.",
    "Sure thing, I'll send that over shortly.",
    "Works for me. Let's plan on it.",
    "Good call — I was thinking the same thing. Let's sync up tomorrow.",
    "Thanks! I'll review and share my thoughts.",
    "Absolutely. I'll block some time on my calendar.",
]

MAX_DAILY_WARMUP = 10


async def process_internal_warmup():
    """
    Generate realistic internal email conversations between @theswn.com accounts.
    Runs every 2 hours. Sends 1 email per run (new thread or reply to existing).
    All messages stay internal (database-only via _route_email_internally).
    """
    try:
        # Guard: check daily count
        today_count = execute_single(
            """
            SELECT COUNT(*) as cnt FROM crm_email_messages
            WHERE source_type = 'warmup'
              AND created_at >= CURRENT_DATE
            """,
            {},
        )
        if today_count and today_count["cnt"] >= MAX_DAILY_WARMUP:
            logger.info(f"Internal warmup: daily limit reached ({today_count['cnt']}/{MAX_DAILY_WARMUP})")
            return

        # Get all active email accounts
        accounts = execute_query(
            "SELECT * FROM crm_email_accounts WHERE is_active = true ORDER BY created_at",
            {},
        )
        if len(accounts) < 2:
            logger.info("Internal warmup: need at least 2 active accounts, skipping")
            return

        # 50% chance: reply to an existing warmup thread instead of starting new
        if random.random() < 0.5:
            # Find a warmup thread that we can reply to
            recent_warmup_thread = execute_single(
                """
                SELECT t.id as thread_id, t.account_id, t.contact_email, t.subject,
                       m.from_address, m.to_addresses
                FROM crm_email_threads t
                JOIN crm_email_messages m ON m.thread_id = t.id
                WHERE m.source_type = 'warmup'
                  AND m.created_at >= CURRENT_DATE - INTERVAL '3 days'
                ORDER BY RANDOM()
                LIMIT 1
                """,
                {},
            )

            if recent_warmup_thread:
                # The thread owner is the recipient of the original — they should reply
                thread_owner_account = None
                for acc in accounts:
                    if acc["id"] == recent_warmup_thread["account_id"]:
                        thread_owner_account = acc
                        break

                if thread_owner_account:
                    # Find the other account to be the recipient of the reply
                    other_account = None
                    for acc in accounts:
                        if acc["email_address"] == recent_warmup_thread["contact_email"]:
                            other_account = acc
                            break

                    if other_account:
                        reply_body = random.choice(WARMUP_REPLIES)
                        reply_html = f"<p>{reply_body}</p>"
                        subject = recent_warmup_thread["subject"]

                        # Create outbound message on sender's (thread owner's) thread
                        execute_single(
                            """
                            INSERT INTO crm_email_messages
                                (thread_id, direction, from_address, to_addresses,
                                 subject, body_html, body_text, status, source_type)
                            VALUES (:tid, 'outbound', :from_addr, :to_addrs,
                                    :subj, :html, :text, 'sent', 'warmup')
                            RETURNING id
                            """,
                            {
                                "tid": recent_warmup_thread["thread_id"],
                                "from_addr": thread_owner_account["email_address"],
                                "to_addrs": [other_account["email_address"]],
                                "subj": subject,
                                "html": reply_html,
                                "text": reply_body,
                            },
                        )

                        execute_single(
                            "UPDATE crm_email_threads SET last_message_at = NOW() WHERE id = :tid RETURNING id",
                            {"tid": recent_warmup_thread["thread_id"]},
                        )

                        # Route to the other account's inbox
                        from app.api.crm import _route_email_internally
                        _route_email_internally(
                            sender_account=thread_owner_account,
                            recipient_account=other_account,
                            subject=subject,
                            body_html=reply_html,
                            body_text=reply_body,
                            to_addresses=[other_account["email_address"]],
                            cc_addresses=[],
                        )

                        logger.info(f"Internal warmup: reply sent from {thread_owner_account['email_address']} to {other_account['email_address']} on thread {recent_warmup_thread['thread_id']}")
                        return

        # New conversation: pick random sender → recipient
        sender = random.choice(accounts)
        recipient = random.choice([a for a in accounts if a["id"] != sender["id"]])

        conversation = random.choice(WARMUP_CONVERSATIONS)
        subject = conversation["subject"]
        body_text = conversation["body"]
        body_html = f"<p>{body_text}</p>"

        # Create sender's outbound thread
        sender_thread = execute_single(
            """
            INSERT INTO crm_email_threads (account_id, contact_email, subject)
            VALUES (:aid, :email, :subj) RETURNING *
            """,
            {
                "aid": sender["id"],
                "email": recipient["email_address"],
                "subj": subject,
            },
        )

        # Create outbound message on sender's thread
        execute_single(
            """
            INSERT INTO crm_email_messages
                (thread_id, direction, from_address, to_addresses,
                 subject, body_html, body_text, status, source_type)
            VALUES (:tid, 'outbound', :from_addr, :to_addrs,
                    :subj, :html, :text, 'sent', 'warmup')
            RETURNING id
            """,
            {
                "tid": sender_thread["id"],
                "from_addr": sender["email_address"],
                "to_addrs": [recipient["email_address"]],
                "subj": subject,
                "html": body_html,
                "text": body_text,
            },
        )

        execute_single(
            "UPDATE crm_email_threads SET last_message_at = NOW() WHERE id = :tid RETURNING id",
            {"tid": sender_thread["id"]},
        )

        # Route to recipient's inbox (internal only — no Resend API calls)
        from app.api.crm import _route_email_internally
        _route_email_internally(
            sender_account=sender,
            recipient_account=recipient,
            subject=subject,
            body_html=body_html,
            body_text=body_text,
            to_addresses=[recipient["email_address"]],
            cc_addresses=[],
        )

        logger.info(f"Internal warmup: new email from {sender['email_address']} to {recipient['email_address']} — \"{subject}\"")

    except Exception as e:
        logger.error(f"process_internal_warmup error: {e}")


async def poll_resend_inbound():
    """
    Fallback polling job: fetches recent inbound emails from Resend API and
    backfills any that were missed by the webhook (e.g. dropped webhooks).
    Uses resend_received_id for dedup — safe to run even when webhooks work fine.
    Runs every 120 seconds.
    """
    try:
        import httpx
        from app.api.crm import _deliver_inbound_to_account, _clean_email_address

        if not settings.RESEND_API_KEY:
            return

        # Fetch the 50 most recent inbound emails from Resend
        resp = httpx.get(
            "https://api.resend.com/emails/receiving?limit=50",
            headers={"Authorization": f"Bearer {settings.RESEND_API_KEY}"},
            timeout=15,
        )
        if resp.status_code != 200:
            logger.warning(f"poll_resend_inbound: Resend API returned {resp.status_code}")
            return

        emails = resp.json().get("data", [])
        if not emails:
            return

        backfilled = 0
        for email_entry in emails:
            resend_id = email_entry.get("id")
            if not resend_id:
                continue

            to_addresses = list(email_entry.get("to", []))
            from_address = email_entry.get("from", "")
            subject = email_entry.get("subject", "")

            # Fetch full email detail once (content, headers, attachments)
            html_body = ""
            text_body = ""
            cc_addresses = []
            attachments_list = []
            try:
                detail_resp = httpx.get(
                    f"https://api.resend.com/emails/receiving/{resend_id}",
                    headers={"Authorization": f"Bearer {settings.RESEND_API_KEY}"},
                    timeout=10,
                )
                if detail_resp.status_code == 200:
                    detail = detail_resp.json()
                    html_body = detail.get("html") or ""
                    text_body = detail.get("text") or ""
                    cc_addresses = detail.get("cc") or []
                    if not from_address:
                        from_address = detail.get("from", "")
                    if not subject:
                        subject = detail.get("subject", "")
                    # Merge full TO list from email headers (Resend splits per-recipient)
                    email_headers = detail.get("headers") or {}
                    header_to = email_headers.get("to", "")
                    if header_to:
                        parsed = [a.strip() for a in header_to.split(",") if a.strip()]
                        existing_addrs = {_clean_email_address(a) for a in to_addresses}
                        for addr in parsed:
                            clean = _clean_email_address(addr)
                            if clean and clean not in existing_addrs:
                                to_addresses.append(addr)
                                existing_addrs.add(clean)
                    header_cc = email_headers.get("cc", "")
                    if header_cc and not cc_addresses:
                        cc_addresses = [a.strip() for a in header_cc.split(",") if a.strip()]
            except Exception as e:
                logger.warning(f"poll_resend_inbound: failed to fetch email detail {resend_id}: {e}")

            try:
                att_resp = httpx.get(
                    f"https://api.resend.com/emails/receiving/{resend_id}/attachments",
                    headers={"Authorization": f"Bearer {settings.RESEND_API_KEY}"},
                    timeout=10,
                )
                if att_resp.status_code == 200:
                    attachments_list = att_resp.json().get("data", [])
            except Exception as e:
                logger.warning(f"poll_resend_inbound: failed to fetch attachments for {resend_id}: {e}")

            # For each TO address, check if we have a matching CRM account
            for addr in to_addresses:
                clean = _clean_email_address(addr)
                if not clean or "reply+" in clean:
                    continue

                acct = execute_single(
                    "SELECT * FROM crm_email_accounts WHERE LOWER(email_address) = :email AND is_active = true LIMIT 1",
                    {"email": clean},
                )
                if not acct:
                    continue

                # Dedup: check if already delivered
                existing = execute_single(
                    """SELECT m.id FROM crm_email_messages m
                       JOIN crm_email_threads t ON t.id = m.thread_id
                       WHERE m.resend_received_id = :rid AND t.account_id = :aid LIMIT 1""",
                    {"rid": resend_id, "aid": acct["id"]},
                )
                if existing:
                    continue

                logger.info(f"poll_resend_inbound: backfilling missed email {resend_id} for {clean}")

                # Check for reply+ thread routing
                import re
                reply_thread_id = None
                all_addrs = to_addresses + cc_addresses
                for a in all_addrs:
                    match = re.search(r"reply\+([a-f0-9-]+)@", a)
                    if match:
                        reply_thread_id = match.group(1)
                        break

                msg = _deliver_inbound_to_account(
                    account=acct,
                    from_address=from_address,
                    subject=subject,
                    html_body=html_body,
                    text_body=text_body,
                    to_addresses=to_addresses,
                    cc_addresses=cc_addresses,
                    thread_id_override=reply_thread_id,
                    attachments=attachments_list,
                    resend_received_id=resend_id,
                )
                if msg:
                    backfilled += 1

        if backfilled:
            logger.info(f"poll_resend_inbound: backfilled {backfilled} missed emails")

    except Exception as e:
        logger.error(f"poll_resend_inbound error: {e}")


async def process_recurring_goals():
    """Auto-create next period goals for expired recurring goals. Runs daily."""
    try:
        import calendar
        from datetime import date, timedelta

        expired = execute_query(
            """
            SELECT * FROM crm_sales_goals
            WHERE is_recurring = true AND period_end < CURRENT_DATE
            """,
            {},
        )
        if not expired:
            return

        for goal in expired:
            old_end = date.fromisoformat(str(goal["period_end"]))
            new_start = old_end + timedelta(days=1)
            period_type = goal["period_type"]

            if period_type == "daily":
                new_end = new_start
            elif period_type == "weekly":
                new_end = new_start + timedelta(days=6)
            elif period_type == "monthly":
                last_day = calendar.monthrange(new_start.year, new_start.month)[1]
                new_end = new_start.replace(day=last_day)
            elif period_type == "quarterly":
                q_month = ((new_start.month - 1) // 3) * 3 + 1
                q_end_month = q_month + 2
                q_end_day = calendar.monthrange(new_start.year, q_end_month)[1]
                new_end = new_start.replace(month=q_end_month, day=q_end_day)
            else:
                new_end = new_start + timedelta(days=6)

            # Create next period goal
            insert_data = {
                "goal_type": goal["goal_type"],
                "period_type": period_type,
                "period_start": new_start.isoformat(),
                "period_end": new_end.isoformat(),
                "target_value": goal["target_value"],
                "actual_value": 0,
                "is_recurring": True,
                "set_by": goal["set_by"],
            }
            if goal.get("rep_id"):
                insert_data["rep_id"] = goal["rep_id"]

            columns = ", ".join(insert_data.keys())
            placeholders = ", ".join(f":{k}" for k in insert_data.keys())
            execute_insert(
                f"INSERT INTO crm_sales_goals ({columns}) VALUES ({placeholders}) RETURNING id",
                insert_data,
            )

            # Mark old goal as no longer recurring
            execute_single(
                "UPDATE crm_sales_goals SET is_recurring = false, updated_at = NOW() WHERE id = :id RETURNING id",
                {"id": goal["id"]},
            )

            logger.info(f"Recurring goal: created next {period_type} goal for rep {goal.get('rep_id', 'team')} ({goal['goal_type']})")

        logger.info(f"process_recurring_goals: processed {len(expired)} expired recurring goals")

    except Exception as e:
        logger.error(f"process_recurring_goals error: {e}")


async def process_trial_expirations():
    """Expire Backlot trials that have passed their end date. Runs daily."""
    try:
        from app.core.database import execute_query, execute_single, execute_insert

        # Find active/extended trials that have expired
        expired_trials = execute_query(
            """
            SELECT t.id, t.provisioned_org_id, t.converted_contact_id, t.provisioned_profile_id,
                   t.status, t.trial_ends_at, t.extension_ends_at
            FROM backlot_trial_requests t
            WHERE t.status IN ('active', 'extended')
              AND COALESCE(t.extension_ends_at, t.trial_ends_at) < NOW()
            """,
            {},
        )

        if not expired_trials:
            return

        for trial in expired_trials:
            try:
                # Update trial status to expired
                execute_single(
                    "UPDATE backlot_trial_requests SET status = 'expired', updated_at = NOW() WHERE id = :id RETURNING id",
                    {"id": trial["id"]},
                )

                # Update org billing status to expired
                if trial.get("provisioned_org_id"):
                    execute_single(
                        "UPDATE organizations SET backlot_billing_status = 'expired' WHERE id = :oid RETURNING id",
                        {"oid": trial["provisioned_org_id"]},
                    )

                # Create CRM activity
                if trial.get("converted_contact_id") and trial.get("provisioned_profile_id"):
                    try:
                        execute_insert(
                            """
                            INSERT INTO crm_activities (contact_id, activity_type, subject, details, created_by)
                            VALUES (:cid, 'note', 'Backlot trial expired', 'Follow up to discuss subscription options.', :uid)
                            RETURNING id
                            """,
                            {
                                "cid": trial["converted_contact_id"],
                                "uid": trial["provisioned_profile_id"],
                            },
                        )
                    except Exception:
                        pass

                logger.info(f"process_trial_expirations: expired trial {trial['id']}")
            except Exception as e:
                logger.error(f"process_trial_expirations: error expiring trial {trial['id']}: {e}")

        logger.info(f"process_trial_expirations: processed {len(expired_trials)} expired trials")

    except Exception as e:
        logger.error(f"process_trial_expirations error: {e}")


async def process_billing_grace_periods():
    """
    Daily job: Check for subscriptions that have exceeded the 7-day grace period.
    Logs billing events for grace_period_expired.
    """
    try:
        from datetime import datetime, timedelta

        grace_cutoff = datetime.utcnow() - timedelta(days=7)

        expired_configs = execute_query("""
            SELECT sc.id, sc.organization_id, sc.status, sc.past_due_since
            FROM backlot_subscription_configs sc
            WHERE sc.status = 'past_due'
              AND sc.past_due_since IS NOT NULL
              AND sc.past_due_since < :cutoff
        """, {"cutoff": grace_cutoff})

        for config in expired_configs:
            org_id = str(config["organization_id"])
            try:
                # Log the event
                execute_insert("""
                    INSERT INTO backlot_billing_events
                        (organization_id, subscription_config_id, event_type, old_status, new_status, metadata)
                    VALUES (:org_id, :cid, 'grace_period_expired', 'past_due', 'past_due', '{}')
                    RETURNING id
                """, {"org_id": org_id, "cid": str(config["id"])})

                logger.info(f"process_billing_grace_periods: grace expired for org {org_id}")
            except Exception as e:
                logger.error(f"process_billing_grace_periods: error for org {org_id}: {e}")

        if expired_configs:
            logger.info(f"process_billing_grace_periods: processed {len(expired_configs)} expired grace periods")

    except Exception as e:
        logger.error(f"process_billing_grace_periods error: {e}")


async def process_billing_reminders():
    """
    Daily job: Send escalating email reminders for past-due subscriptions.
    Day 1: Payment failed notification (already sent by webhook handler)
    Day 3: Reminder email
    Day 5: Final warning email
    """
    try:
        from datetime import datetime, timedelta

        now = datetime.utcnow()

        past_due_configs = execute_query("""
            SELECT sc.id, sc.organization_id, sc.past_due_since
            FROM backlot_subscription_configs sc
            WHERE sc.status = 'past_due'
              AND sc.past_due_since IS NOT NULL
        """)

        for config in past_due_configs:
            org_id = str(config["organization_id"])
            past_due_since = config["past_due_since"]

            if not hasattr(past_due_since, "timestamp"):
                continue

            days_elapsed = (now - past_due_since).days

            # Send reminders on day 3 and day 5
            if days_elapsed in (3, 5):
                try:
                    from app.services.email_service import send_payment_reminder_email
                    await send_payment_reminder_email(org_id, days_elapsed)
                    logger.info(f"process_billing_reminders: sent day-{days_elapsed} reminder for org {org_id}")
                except Exception as e:
                    logger.error(f"process_billing_reminders: error sending reminder for org {org_id}: {e}")

    except Exception as e:
        logger.error(f"process_billing_reminders error: {e}")


def start_email_scheduler():
    """Initialize and start the APScheduler for email jobs."""
    try:
        from apscheduler.schedulers.asyncio import AsyncIOScheduler

        scheduler = AsyncIOScheduler()
        scheduler.add_job(process_scheduled_emails, "interval", seconds=60, id="scheduled_emails")
        scheduler.add_job(process_unsnoozed_threads, "interval", seconds=60, id="unsnoozed_threads")
        scheduler.add_job(process_sequence_sends, "interval", seconds=300, id="sequence_sends")
        scheduler.add_job(process_campaign_sends, "interval", seconds=120, id="campaign_sends")
        scheduler.add_job(process_notification_digests, "interval", seconds=900, id="notification_digests")
        scheduler.add_job(poll_resend_inbound, "interval", seconds=120, id="poll_resend_inbound")
        scheduler.add_job(process_recurring_goals, "interval", seconds=86400, id="recurring_goals")
        scheduler.add_job(process_trial_expirations, "interval", seconds=86400, id="trial_expirations")
        scheduler.add_job(process_billing_grace_periods, "interval", seconds=86400, id="billing_grace_periods")
        scheduler.add_job(process_billing_reminders, "interval", seconds=86400, id="billing_reminders")
        scheduler.start()
        logger.info("Email scheduler started with 10 jobs")
        return scheduler
    except ImportError:
        logger.warning("APScheduler not installed — email scheduler disabled. Install with: pip install apscheduler")
        return None
