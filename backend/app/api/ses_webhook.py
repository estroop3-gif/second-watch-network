"""
AWS SES Webhook Endpoint
Receives and processes email events from AWS SES via SNS
Handles: Send, Delivery, Bounce, Complaint, Open, Click events
"""
from fastapi import APIRouter, HTTPException, Request
from datetime import datetime
import json
import httpx
from app.core.database import get_client

router = APIRouter()


async def confirm_sns_subscription(subscribe_url: str):
    """Confirm SNS subscription by visiting the provided URL"""
    try:
        async with httpx.AsyncClient() as client:
            await client.get(subscribe_url)
        print(f"SNS subscription confirmed")
    except Exception as e:
        print(f"Failed to confirm SNS subscription: {e}")


def parse_ses_event(message: dict) -> dict:
    """Parse SES event notification and extract relevant data"""
    event_type = message.get("eventType") or message.get("notificationType", "").lower()
    mail = message.get("mail", {})

    # Base data from mail object
    data = {
        "message_id": mail.get("messageId"),
        "sender_email": mail.get("source"),
        "recipient_email": mail.get("destination", [""])[0] if mail.get("destination") else None,
        "subject": mail.get("commonHeaders", {}).get("subject"),
        "ses_source_ip": mail.get("sourceIp"),
        "ses_sending_account_id": mail.get("sendingAccountId"),
        "raw_event_data": message,
    }

    # Extract tags if present
    tags = mail.get("tags", {})
    if tags.get("ses:configuration-set"):
        data["ses_configuration_set"] = tags["ses:configuration-set"][0]
    if tags.get("email_type"):
        data["email_type"] = tags["email_type"][0]
    if tags.get("source_service"):
        data["source_service"] = tags["source_service"][0]
    if tags.get("source_action"):
        data["source_action"] = tags["source_action"][0]
    if tags.get("source_user_id"):
        data["source_user_id"] = tags["source_user_id"][0]

    return data, event_type


def handle_send_event(message: dict, base_data: dict) -> dict:
    """Process Send event"""
    send = message.get("send", {})
    return {
        **base_data,
        "status": "sent",
        "sent_at": send.get("timestamp") or datetime.utcnow().isoformat(),
    }


def handle_delivery_event(message: dict, base_data: dict) -> dict:
    """Process Delivery event"""
    delivery = message.get("delivery", {})
    return {
        **base_data,
        "status": "delivered",
        "delivered_at": delivery.get("timestamp") or datetime.utcnow().isoformat(),
    }


def handle_bounce_event(message: dict, base_data: dict) -> dict:
    """Process Bounce event"""
    bounce = message.get("bounce", {})
    recipients = bounce.get("bouncedRecipients", [{}])
    diagnostic = recipients[0].get("diagnosticCode") if recipients else None

    return {
        **base_data,
        "status": "bounced",
        "bounce_type": bounce.get("bounceType"),
        "bounce_subtype": bounce.get("bounceSubType"),
        "bounce_diagnostic": diagnostic,
        "bounced_at": bounce.get("timestamp") or datetime.utcnow().isoformat(),
    }


def handle_complaint_event(message: dict, base_data: dict) -> dict:
    """Process Complaint event"""
    complaint = message.get("complaint", {})

    return {
        **base_data,
        "status": "complained",
        "complaint_feedback_type": complaint.get("complaintFeedbackType"),
        "complaint_sub_type": complaint.get("complaintSubType"),
        "complained_at": complaint.get("timestamp") or datetime.utcnow().isoformat(),
    }


def handle_reject_event(message: dict, base_data: dict) -> dict:
    """Process Reject event"""
    reject = message.get("reject", {})
    return {
        **base_data,
        "status": "rejected",
        "bounce_diagnostic": reject.get("reason"),
        "rejected_at": datetime.utcnow().isoformat(),
    }


def handle_open_event(message: dict, base_data: dict) -> dict:
    """Process Open event - updates existing record"""
    open_data = message.get("open", {})

    return {
        "message_id": base_data["message_id"],
        "user_agent": open_data.get("userAgent"),
        "ip_address": open_data.get("ipAddress"),
        "last_opened_at": open_data.get("timestamp") or datetime.utcnow().isoformat(),
    }


def handle_click_event(message: dict, base_data: dict) -> dict:
    """Process Click event - updates existing record"""
    click_data = message.get("click", {})

    return {
        "message_id": base_data["message_id"],
        "user_agent": click_data.get("userAgent"),
        "ip_address": click_data.get("ipAddress"),
        "clicked_link": click_data.get("link"),
        "last_clicked_at": click_data.get("timestamp") or datetime.utcnow().isoformat(),
    }


@router.post("/ses/webhook")
async def ses_webhook(request: Request):
    """
    Receive and process SES email events from AWS SNS.

    Handles:
    - SNS Subscription Confirmation
    - Send events (email sent)
    - Delivery events (email delivered)
    - Bounce events (email bounced)
    - Complaint events (spam complaint)
    - Reject events (email rejected)
    - Open events (email opened)
    - Click events (link clicked)
    """
    try:
        body = await request.body()
        payload = json.loads(body)

        # Handle SNS subscription confirmation
        message_type = request.headers.get("x-amz-sns-message-type", "")

        if message_type == "SubscriptionConfirmation":
            subscribe_url = payload.get("SubscribeURL")
            if subscribe_url:
                await confirm_sns_subscription(subscribe_url)
            return {"status": "subscription_confirmed"}

        if message_type == "UnsubscribeConfirmation":
            return {"status": "unsubscribe_confirmed"}

        # Parse the actual SES event
        if message_type == "Notification":
            message = json.loads(payload.get("Message", "{}"))
        else:
            # Direct SES event (not via SNS)
            message = payload

        if not message:
            return {"status": "empty_message"}

        client = get_client()
        base_data, event_type = parse_ses_event(message)

        if not base_data.get("message_id"):
            return {"status": "no_message_id"}

        # Process based on event type
        event_type_lower = event_type.lower() if event_type else ""

        if event_type_lower in ["send", "sent"]:
            data = handle_send_event(message, base_data)
            # Insert new record
            client.table("email_logs").insert(data).execute()

        elif event_type_lower in ["delivery", "delivered"]:
            data = handle_delivery_event(message, base_data)
            # Upsert - update if exists, insert if not
            client.table("email_logs").upsert(
                data,
                on_conflict="message_id"
            ).execute()

        elif event_type_lower in ["bounce", "bounced"]:
            data = handle_bounce_event(message, base_data)
            client.table("email_logs").upsert(
                data,
                on_conflict="message_id"
            ).execute()

        elif event_type_lower in ["complaint", "complained"]:
            data = handle_complaint_event(message, base_data)
            client.table("email_logs").upsert(
                data,
                on_conflict="message_id"
            ).execute()

        elif event_type_lower in ["reject", "rejected"]:
            data = handle_reject_event(message, base_data)
            client.table("email_logs").upsert(
                data,
                on_conflict="message_id"
            ).execute()

        elif event_type_lower in ["open", "opened"]:
            open_data = handle_open_event(message, base_data)
            message_id = open_data.pop("message_id")

            # Update existing record with open tracking
            existing = client.table("email_logs").select("id, open_count, first_opened_at").eq("message_id", message_id).single().execute()

            if existing.data:
                update = {
                    "open_count": (existing.data.get("open_count") or 0) + 1,
                    "last_opened_at": open_data["last_opened_at"],
                    "user_agent": open_data.get("user_agent"),
                    "ip_address": open_data.get("ip_address"),
                    "status": "opened",
                }
                if not existing.data.get("first_opened_at"):
                    update["first_opened_at"] = open_data["last_opened_at"]

                client.table("email_logs").update(update).eq("id", existing.data["id"]).execute()

        elif event_type_lower in ["click", "clicked"]:
            click_data = handle_click_event(message, base_data)
            message_id = click_data.pop("message_id")
            clicked_link = click_data.pop("clicked_link", None)

            # Update existing record with click tracking
            existing = client.table("email_logs").select("id, click_count, first_clicked_at, clicked_links").eq("message_id", message_id).single().execute()

            if existing.data:
                clicked_links = existing.data.get("clicked_links") or []
                if clicked_link:
                    clicked_links.append({
                        "link": clicked_link,
                        "timestamp": click_data["last_clicked_at"],
                    })

                update = {
                    "click_count": (existing.data.get("click_count") or 0) + 1,
                    "last_clicked_at": click_data["last_clicked_at"],
                    "clicked_links": clicked_links,
                    "user_agent": click_data.get("user_agent"),
                    "ip_address": click_data.get("ip_address"),
                    "status": "clicked",
                }
                if not existing.data.get("first_clicked_at"):
                    update["first_clicked_at"] = click_data["last_clicked_at"]

                client.table("email_logs").update(update).eq("id", existing.data["id"]).execute()

        elif event_type_lower == "rendering failure":
            data = {
                **base_data,
                "status": "rendering_failure",
            }
            client.table("email_logs").upsert(
                data,
                on_conflict="message_id"
            ).execute()

        return {"status": "processed", "event_type": event_type}

    except json.JSONDecodeError:
        raise HTTPException(status_code=400, detail="Invalid JSON payload")
    except Exception as e:
        print(f"SES webhook error: {e}")
        # Return 200 to prevent SNS retries for transient errors
        return {"status": "error", "message": str(e)}


@router.get("/ses/health")
async def ses_webhook_health():
    """Health check for SES webhook endpoint"""
    return {"status": "healthy", "service": "ses_webhook"}
