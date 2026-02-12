"""
Email Service for Second Watch Network
Supports AWS SES, Resend, SendGrid, and SMTP providers
"""
import smtplib
import os
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from typing import List, Optional, Dict, Any
from datetime import datetime
from app.core.config import settings


async def log_email_to_database(
    message_id: str,
    sender_email: str,
    sender_name: Optional[str],
    recipient_email: str,
    subject: str,
    email_type: Optional[str] = None,
    source_service: str = "app",
    source_action: Optional[str] = None,
    source_user_id: Optional[str] = None,
    source_reference_id: Optional[str] = None,
) -> None:
    """Log a sent email to the email_logs table for tracking"""
    try:
        from app.core.database import get_client
        client = get_client()

        client.table("email_logs").insert({
            "message_id": message_id,
            "sender_email": sender_email,
            "sender_name": sender_name,
            "recipient_email": recipient_email,
            "subject": subject,
            "email_type": email_type,
            "status": "sent",
            "source_service": source_service,
            "source_action": source_action,
            "source_user_id": source_user_id,
            "source_reference_id": source_reference_id,
            "sent_at": datetime.utcnow().isoformat(),
        }).execute()
    except Exception as e:
        print(f"Warning: Failed to log email to database: {e}")


class EmailService:
    """Email sending service with support for multiple providers"""

    @staticmethod
    async def send_email(
        to_emails: List[str],
        subject: str,
        html_content: str,
        text_content: Optional[str] = None,
        reply_to: Optional[str] = None,
        email_type: Optional[str] = None,
        source_service: str = "app",
        source_action: Optional[str] = None,
        source_user_id: Optional[str] = None,
        source_reference_id: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Send an email to one or more recipients

        Args:
            to_emails: List of recipient email addresses
            subject: Email subject line
            html_content: HTML body content
            text_content: Plain text body content (optional, derived from HTML if not provided)
            reply_to: Reply-to email address (optional)
            email_type: Type of email for tracking (e.g., 'welcome', 'call_sheet', 'clearance')
            source_service: Service that triggered the email (e.g., 'app', 'backlot', 'admin')
            source_action: Action that triggered the email (e.g., 'user_creation', 'call_sheet_send')
            source_user_id: ID of user who triggered the email (if applicable)
            source_reference_id: Reference to related entity (project_id, etc.)

        Returns:
            Dict with success status and details
        """
        provider = getattr(settings, 'EMAIL_PROVIDER', 'ses').lower()

        # Create logging context to pass to provider functions
        log_context = {
            "email_type": email_type,
            "source_service": source_service,
            "source_action": source_action,
            "source_user_id": source_user_id,
            "source_reference_id": source_reference_id,
        }

        if provider == "ses" or provider == "aws":
            return await EmailService._send_via_ses(to_emails, subject, html_content, text_content, reply_to, log_context)
        elif provider == "resend":
            return await EmailService._send_via_resend(to_emails, subject, html_content, text_content, reply_to, log_context)
        elif provider == "sendgrid":
            return await EmailService._send_via_sendgrid(to_emails, subject, html_content, text_content, reply_to)
        elif provider == "smtp":
            return await EmailService._send_via_smtp(to_emails, subject, html_content, text_content, reply_to)
        else:
            # Fallback: log only (for development)
            return await EmailService._log_email(to_emails, subject, html_content)

    @staticmethod
    async def _send_via_ses(
        to_emails: List[str],
        subject: str,
        html_content: str,
        text_content: Optional[str] = None,
        reply_to: Optional[str] = None,
        log_context: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """Send email using AWS SES"""
        try:
            import boto3
            from botocore.exceptions import ClientError

            # Get AWS region from settings or environment
            aws_region = getattr(settings, 'AWS_REGION', None) or os.getenv('AWS_REGION', 'us-east-1')

            # Get email from address
            from_name = getattr(settings, 'EMAIL_FROM_NAME', 'Second Watch Network')
            from_address = getattr(settings, 'EMAIL_FROM_ADDRESS', None) or os.getenv('SES_FROM_EMAIL', 'noreply@theswn.com')

            # Create SES client — use default credential chain for Lambda compatibility
            ses_client = boto3.client(
                'ses',
                region_name=aws_region,
            )

            # Build email message
            message = {
                'Subject': {
                    'Data': subject,
                    'Charset': 'UTF-8'
                },
                'Body': {
                    'Html': {
                        'Data': html_content,
                        'Charset': 'UTF-8'
                    }
                }
            }

            # Add plain text version if provided
            if text_content:
                message['Body']['Text'] = {
                    'Data': text_content,
                    'Charset': 'UTF-8'
                }

            # Build destination
            destination = {
                'ToAddresses': to_emails
            }

            # Send email
            send_params = {
                'Source': f"{from_name} <{from_address}>",
                'Destination': destination,
                'Message': message
            }

            # Add reply-to if specified
            if reply_to:
                send_params['ReplyToAddresses'] = [reply_to]

            response = ses_client.send_email(**send_params)
            message_id = response.get('MessageId')

            # Log email to database for each recipient
            if log_context and message_id:
                for recipient in to_emails:
                    await log_email_to_database(
                        message_id=message_id,
                        sender_email=from_address,
                        sender_name=from_name,
                        recipient_email=recipient,
                        subject=subject,
                        email_type=log_context.get("email_type"),
                        source_service=log_context.get("source_service", "app"),
                        source_action=log_context.get("source_action"),
                        source_user_id=log_context.get("source_user_id"),
                        source_reference_id=log_context.get("source_reference_id"),
                    )

            return {
                "success": True,
                "provider": "ses",
                "message_id": message_id,
                "recipients": len(to_emails)
            }

        except ClientError as e:
            error_code = e.response['Error']['Code']
            error_message = e.response['Error']['Message']
            print(f"AWS SES error ({error_code}): {error_message}")

            # If email is not verified in sandbox mode, log helpful message
            if error_code == 'MessageRejected' and 'not verified' in error_message.lower():
                print(f"Note: In SES sandbox mode, both sender and recipient emails must be verified.")
                print(f"Verify email addresses at: https://console.aws.amazon.com/ses/home?region={aws_region}#/verified-identities")

            return {
                "success": False,
                "provider": "ses",
                "error": f"{error_code}: {error_message}"
            }
        except Exception as e:
            print(f"AWS SES error: {e}")
            return {
                "success": False,
                "provider": "ses",
                "error": str(e)
            }

    @staticmethod
    async def _send_via_resend(
        to_emails: List[str],
        subject: str,
        html_content: str,
        text_content: Optional[str] = None,
        reply_to: Optional[str] = None,
        log_context: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """Send email using Resend API"""
        if not settings.RESEND_API_KEY:
            print("Warning: RESEND_API_KEY not configured, logging email instead")
            return await EmailService._log_email(to_emails, subject, html_content)

        try:
            import resend
            resend.api_key = settings.RESEND_API_KEY

            from_address = settings.EMAIL_FROM_ADDRESS
            from_name = settings.EMAIL_FROM_NAME

            params = {
                "from": f"{from_name} <{from_address}>",
                "to": to_emails,
                "subject": subject,
                "html": html_content,
            }

            if text_content:
                params["text"] = text_content
            if reply_to:
                params["reply_to"] = reply_to

            result = resend.Emails.send(params)
            message_id = result.get("id")

            # Log email to database for each recipient
            if log_context and message_id:
                for recipient in to_emails:
                    await log_email_to_database(
                        message_id=message_id,
                        sender_email=from_address,
                        sender_name=from_name,
                        recipient_email=recipient,
                        subject=subject,
                        email_type=log_context.get("email_type"),
                        source_service=log_context.get("source_service", "app"),
                        source_action=log_context.get("source_action"),
                        source_user_id=log_context.get("source_user_id"),
                        source_reference_id=log_context.get("source_reference_id"),
                    )

            return {
                "success": True,
                "provider": "resend",
                "message_id": message_id,
                "recipients": len(to_emails)
            }
        except ImportError:
            print("Warning: resend package not installed, logging email instead")
            return await EmailService._log_email(to_emails, subject, html_content)
        except Exception as e:
            print(f"Resend error: {e}")
            return {
                "success": False,
                "provider": "resend",
                "error": str(e)
            }

    @staticmethod
    async def _send_via_sendgrid(
        to_emails: List[str],
        subject: str,
        html_content: str,
        text_content: Optional[str] = None,
        reply_to: Optional[str] = None
    ) -> Dict[str, Any]:
        """Send email using SendGrid API"""
        if not settings.SENDGRID_API_KEY:
            print("Warning: SENDGRID_API_KEY not configured, logging email instead")
            return await EmailService._log_email(to_emails, subject, html_content)

        try:
            from sendgrid import SendGridAPIClient
            from sendgrid.helpers.mail import Mail, Email, To, Content, ReplyTo

            message = Mail(
                from_email=Email(settings.EMAIL_FROM_ADDRESS, settings.EMAIL_FROM_NAME),
                to_emails=[To(email) for email in to_emails],
                subject=subject,
                html_content=Content("text/html", html_content)
            )

            if text_content:
                message.add_content(Content("text/plain", text_content))
            if reply_to:
                message.reply_to = ReplyTo(reply_to)

            sg = SendGridAPIClient(settings.SENDGRID_API_KEY)
            response = sg.send(message)

            return {
                "success": response.status_code in [200, 201, 202],
                "provider": "sendgrid",
                "status_code": response.status_code,
                "recipients": len(to_emails)
            }
        except ImportError:
            print("Warning: sendgrid package not installed, logging email instead")
            return await EmailService._log_email(to_emails, subject, html_content)
        except Exception as e:
            print(f"SendGrid error: {e}")
            return {
                "success": False,
                "provider": "sendgrid",
                "error": str(e)
            }

    @staticmethod
    async def _send_via_smtp(
        to_emails: List[str],
        subject: str,
        html_content: str,
        text_content: Optional[str] = None,
        reply_to: Optional[str] = None
    ) -> Dict[str, Any]:
        """Send email using SMTP"""
        if not settings.SMTP_HOST:
            print("Warning: SMTP_HOST not configured, logging email instead")
            return await EmailService._log_email(to_emails, subject, html_content)

        try:
            msg = MIMEMultipart("alternative")
            msg["Subject"] = subject
            msg["From"] = f"{settings.EMAIL_FROM_NAME} <{settings.EMAIL_FROM_ADDRESS}>"
            msg["To"] = ", ".join(to_emails)

            if reply_to:
                msg["Reply-To"] = reply_to

            if text_content:
                msg.attach(MIMEText(text_content, "plain"))
            msg.attach(MIMEText(html_content, "html"))

            with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT) as server:
                server.starttls()
                if settings.SMTP_USER and settings.SMTP_PASSWORD:
                    server.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
                server.sendmail(settings.EMAIL_FROM_ADDRESS, to_emails, msg.as_string())

            return {
                "success": True,
                "provider": "smtp",
                "recipients": len(to_emails)
            }
        except Exception as e:
            print(f"SMTP error: {e}")
            return {
                "success": False,
                "provider": "smtp",
                "error": str(e)
            }

    @staticmethod
    async def _log_email(
        to_emails: List[str],
        subject: str,
        html_content: str
    ) -> Dict[str, Any]:
        """Log email for development (no actual sending)"""
        print(f"\n{'='*60}")
        print(f"EMAIL LOG (not sent - development mode)")
        print(f"{'='*60}")
        print(f"To: {', '.join(to_emails)}")
        print(f"Subject: {subject}")
        print(f"Content Preview: {html_content[:200]}...")
        print(f"{'='*60}\n")

        return {
            "success": True,
            "provider": "log",
            "recipients": len(to_emails),
            "note": "Email logged but not sent (development mode)"
        }


def generate_call_sheet_email_html(
    project_title: str,
    call_sheet_title: str,
    call_date: str,
    call_time: str,
    location_name: str,
    location_address: str,
    schedule_blocks: List[Dict[str, str]],
    people: List[Dict[str, Any]],
    special_instructions: Optional[str] = None,
    weather_info: Optional[str] = None,
    safety_notes: Optional[str] = None,
    hospital_name: Optional[str] = None,
    hospital_address: Optional[str] = None,
    hospital_phone: Optional[str] = None,
    sender_name: str = "",
    sender_message: Optional[str] = None,
    view_url: Optional[str] = None
) -> str:
    """
    Generate HTML email for a call sheet using shared base_template branding.
    """
    from app.services.email_templates import base_template, cta_button, info_card

    # Format schedule blocks
    schedule_html = ""
    if schedule_blocks:
        schedule_rows = "\n".join([
            f"""<tr>
                <td style="padding: 8px; border-bottom: 1px solid #333; font-family: monospace; color: #f5f0e1;">{block.get('time', '')}</td>
                <td style="padding: 8px; border-bottom: 1px solid #333; color: #a0a0a0;">{block.get('activity', '')}</td>
                <td style="padding: 8px; border-bottom: 1px solid #333; color: #666;">{block.get('notes', '')}</td>
            </tr>"""
            for block in schedule_blocks
        ])
        schedule_html = f"""
        <h3 style="color: #FCDC58; margin-top: 24px; margin-bottom: 12px;">Schedule</h3>
        <table style="width: 100%; border-collapse: collapse; background-color: #1a1a1a;">
            <thead>
                <tr style="background-color: #2a2a2a;">
                    <th style="padding: 8px; text-align: left; color: #FCDC58;">Time</th>
                    <th style="padding: 8px; text-align: left; color: #FCDC58;">Activity</th>
                    <th style="padding: 8px; text-align: left; color: #FCDC58;">Notes</th>
                </tr>
            </thead>
            <tbody>
                {schedule_rows}
            </tbody>
        </table>
        """

    # Format people/crew
    people_html = ""
    if people:
        people_rows = "\n".join([
            f"""<tr>
                <td style="padding: 8px; border-bottom: 1px solid #333; color: #f5f0e1;">{p.get('name', '')}</td>
                <td style="padding: 8px; border-bottom: 1px solid #333; color: #a0a0a0;">{p.get('role', '') or p.get('department', '')}</td>
                <td style="padding: 8px; border-bottom: 1px solid #333; font-family: monospace; color: #FCDC58;">{p.get('call_time', '')}</td>
                <td style="padding: 8px; border-bottom: 1px solid #333; color: #666;">{p.get('notes', '') or ''}</td>
            </tr>"""
            for p in people
        ])
        people_html = f"""
        <h3 style="color: #FCDC58; margin-top: 24px; margin-bottom: 12px;">Crew & Talent</h3>
        <table style="width: 100%; border-collapse: collapse; background-color: #1a1a1a;">
            <thead>
                <tr style="background-color: #2a2a2a;">
                    <th style="padding: 8px; text-align: left; color: #FCDC58;">Name</th>
                    <th style="padding: 8px; text-align: left; color: #FCDC58;">Role</th>
                    <th style="padding: 8px; text-align: left; color: #FCDC58;">Call Time</th>
                    <th style="padding: 8px; text-align: left; color: #FCDC58;">Notes</th>
                </tr>
            </thead>
            <tbody>
                {people_rows}
            </tbody>
        </table>
        """

    # Additional info sections
    additional_sections = ""

    if special_instructions:
        additional_sections += info_card("Special Instructions", f'<span style="white-space: pre-wrap;">{special_instructions}</span>')

    if weather_info:
        additional_sections += info_card("Weather", weather_info)

    if safety_notes or hospital_name:
        safety_content = ""
        if safety_notes:
            safety_content += f"<p style='color: #a0a0a0; margin: 0 0 8px 0;'>{safety_notes}</p>"
        if hospital_name:
            safety_content += f"""
            <p style="color: #a0a0a0; margin: 8px 0 0 0;">
                <strong>Nearest Hospital:</strong> {hospital_name}<br>
                {hospital_address or ''}<br>
                {hospital_phone or ''}
            </p>
            """
        additional_sections += f"""
        <div style="background-color: #3a2a2a; padding: 16px; border-radius: 8px; margin-top: 16px; border-left: 4px solid #ff6b6b;">
            <h4 style="color: #ff6b6b; margin: 0 0 8px 0;">Safety Information</h4>
            {safety_content}
        </div>
        """

    # Sender message
    sender_section = ""
    if sender_message:
        sender_section = f"""
        <div style="background-color: #2a3a2a; padding: 16px; border-radius: 8px; margin-bottom: 24px; border-left: 4px solid #4ade80;">
            <p style="color: #4ade80; margin: 0 0 4px 0; font-weight: bold;">Message from {sender_name or 'the producer'}:</p>
            <p style="color: #a0a0a0; margin: 0;">{sender_message}</p>
        </div>
        """

    # View button
    view_button = cta_button("View Full Call Sheet", view_url) if view_url else ""

    # Build inner body
    body_html = f"""
<h2 style="color: #F9F5EF; margin: 0 0 8px 0; font-size: 24px;">{call_sheet_title}</h2>
<p style="color: #a0a0a0; margin: 0 0 24px 0; font-size: 18px;">{project_title}</p>

{sender_section}

<!-- Quick Info -->
<table style="width: 100%; border-collapse: separate; border-spacing: 12px 0; margin-bottom: 24px;">
    <tr>
        <td style="width: 50%; background-color: #2a2a2a; padding: 16px; border-radius: 8px;">
            <p style="color: #FCDC58; margin: 0 0 4px 0; font-size: 12px; text-transform: uppercase;">Date</p>
            <p style="color: #f5f0e1; margin: 0; font-size: 18px; font-weight: bold;">{call_date}</p>
        </td>
        <td style="width: 50%; background-color: #2a2a2a; padding: 16px; border-radius: 8px;">
            <p style="color: #FCDC58; margin: 0 0 4px 0; font-size: 12px; text-transform: uppercase;">General Call</p>
            <p style="color: #f5f0e1; margin: 0; font-size: 18px; font-weight: bold;">{call_time or 'TBD'}</p>
        </td>
    </tr>
</table>

<!-- Location -->
<div style="background-color: #2a2a2a; padding: 16px; border-radius: 8px; margin-bottom: 24px;">
    <p style="color: #FCDC58; margin: 0 0 4px 0; font-size: 12px; text-transform: uppercase;">Location</p>
    <p style="color: #f5f0e1; margin: 0; font-size: 16px; font-weight: bold;">{location_name or 'TBD'}</p>
    {f'<p style="color: #a0a0a0; margin: 8px 0 0 0;">{location_address}</p>' if location_address else ''}
</div>

{schedule_html}
{people_html}
{additional_sections}
{view_button}

<p style="color: #666; margin: 24px 0 0 0; font-size: 12px; text-align: center;">
    Please contact the production team if you have any questions.
</p>
    """

    return base_template(
        f"Call Sheet: {call_sheet_title}",
        body_html,
        preheader=f"Call sheet for {project_title} — {call_date} at {call_time or 'TBD'}"
    )


def generate_call_sheet_text(
    project_title: str,
    call_sheet_title: str,
    call_date: str,
    call_time: str,
    location_name: str,
    location_address: str,
    schedule_blocks: List[Dict[str, str]],
    people: List[Dict[str, Any]],
    special_instructions: Optional[str] = None,
    sender_message: Optional[str] = None
) -> str:
    """Generate plain text version of call sheet email"""
    lines = [
        f"{'='*50}",
        f"{call_sheet_title}",
        f"{project_title}",
        f"{'='*50}",
        "",
    ]

    if sender_message:
        lines.extend([
            f"Message from the producer:",
            f"{sender_message}",
            "",
        ])

    lines.extend([
        f"Date: {call_date}",
        f"General Call: {call_time or 'TBD'}",
        f"Location: {location_name or 'TBD'}",
    ])

    if location_address:
        lines.append(f"Address: {location_address}")

    if schedule_blocks:
        lines.extend(["", "SCHEDULE:", "-"*30])
        for block in schedule_blocks:
            lines.append(f"  {block.get('time', '')} - {block.get('activity', '')}")

    if people:
        lines.extend(["", "CREW & TALENT:", "-"*30])
        for p in people:
            lines.append(f"  {p.get('name', '')} ({p.get('role', '')}) - Call: {p.get('call_time', '')}")

    if special_instructions:
        lines.extend(["", "SPECIAL INSTRUCTIONS:", special_instructions])

    lines.extend([
        "",
        f"{'='*50}",
        "Sent via Second Watch Network Backlot",
        f"{'='*50}",
    ])

    return "\n".join(lines)


# =============================================================================
# CLEARANCE DOCUMENT EMAIL TEMPLATES
# =============================================================================

CLEARANCE_TYPE_LABELS = {
    'talent_release': 'Talent Release',
    'appearance_release': 'Appearance Release',
    'location_release': 'Location Release',
    'music_license': 'Music License',
    'stock_license': 'Stock License',
    'nda': 'NDA',
    'other_contract': 'Contract',
}


def generate_clearance_email_html(
    project_title: str,
    clearance_title: str,
    clearance_type: str,
    sender_name: str,
    view_url: str,
    sender_message: Optional[str] = None,
    requires_signature: bool = False,
    expiration_date: Optional[str] = None,
    has_attachment: bool = False
) -> str:
    """
    Generate HTML email for clearance document distribution.
    Uses the same dark theme as call sheet emails for consistency.
    """
    from app.services.email_templates import base_template, cta_button, info_card, security_notice

    type_label = CLEARANCE_TYPE_LABELS.get(clearance_type, 'Document')

    # Action text based on whether signature is required
    action_text = "review and sign" if requires_signature else "review"
    button_text = "Review & Sign Document" if requires_signature else "View Document"

    # Sender message section
    sender_section = ""
    if sender_message:
        sender_section = f"""
        <div style="background-color: #2a3a2a; padding: 16px; border-radius: 8px; margin-bottom: 24px; border-left: 4px solid #4ade80;">
            <p style="color: #4ade80; margin: 0 0 4px 0; font-weight: bold;">Message from {sender_name}:</p>
            <p style="color: #a0a0a0; margin: 0; white-space: pre-wrap;">{sender_message}</p>
        </div>
        """

    # Expiration warning
    expiration_section = security_notice(f"This document expires on {expiration_date}") if expiration_date else ""

    # Signature note
    signature_note = ""
    if requires_signature:
        signature_note = """
        <p style="color: #a0a0a0; margin: 16px 0; font-size: 14px;">
            Your signature is required on this document. You can sign directly in your browser
            using the link above.
        </p>
        """

    # Attachment note
    attachment_note = ""
    if has_attachment:
        attachment_note = """
        <p style="color: #a0a0a0; margin: 16px 0; font-size: 14px; text-align: center;">
            The document is also attached to this email for your records.
        </p>
        """

    body_html = f"""
<h2 style="color: #F9F5EF; margin: 0 0 16px 0; font-size: 22px;">{type_label}</h2>
<p style="color: #a0a0a0; margin: 0 0 24px 0; font-size: 16px;">{project_title}</p>

{sender_section}

<p style="color: #f5f0e1; margin: 0 0 16px 0; font-size: 16px;">
    You have been sent a document to {action_text}:
</p>

{info_card(clearance_title, f'<span style="color: #FCDC58; font-size: 14px; text-transform: uppercase; font-weight: bold;">{type_label}</span>')}

{expiration_section}

{cta_button(button_text, view_url)}

{signature_note}
{attachment_note}

<p style="color: #666; margin: 0; font-size: 12px; text-align: center;">
    If you have questions, please contact the production team.
</p>
    """

    return base_template(
        f"Clearance: {clearance_title}",
        body_html,
        preheader=f"{type_label} for {project_title} — please {action_text}"
    )


def generate_clearance_email_text(
    project_title: str,
    clearance_title: str,
    clearance_type: str,
    sender_name: str,
    view_url: str,
    sender_message: Optional[str] = None,
    requires_signature: bool = False,
    expiration_date: Optional[str] = None,
    has_attachment: bool = False
) -> str:
    """Generate plain text version of clearance email"""
    type_label = CLEARANCE_TYPE_LABELS.get(clearance_type, 'Document')
    action_text = "review and sign" if requires_signature else "review"

    lines = [
        f"{'='*50}",
        f"{type_label}",
        f"{project_title}",
        f"{'='*50}",
        "",
    ]

    if sender_message:
        lines.extend([
            f"Message from {sender_name}:",
            f"{sender_message}",
            "",
        ])

    lines.extend([
        f"You have been sent a document to {action_text}.",
        "",
        f"Document: {clearance_title}",
        f"Type: {type_label}",
        "",
    ])

    if expiration_date:
        lines.append(f"Expires: {expiration_date}")
        lines.append("")

    lines.extend([
        f"View/Sign: {view_url}",
        "",
    ])

    if requires_signature:
        lines.extend([
            "Your signature is required on this document.",
            "You can sign directly in your browser using the link above.",
            "",
        ])

    if has_attachment:
        lines.extend([
            "The document is also attached to this email for your records.",
            "",
        ])

    lines.extend([
        f"{'='*50}",
        "Sent via Second Watch Network Backlot",
        f"{'='*50}",
    ])

    return "\n".join(lines)


# =============================================================================
# WELCOME EMAIL TEMPLATES
# =============================================================================

def generate_welcome_email_html(
    name: str,
    email: str,
    temp_password: str,
    login_url: str = "https://www.secondwatchnetwork.com/login"
) -> str:
    """
    Generate HTML welcome email with temporary password using shared base_template branding.
    """
    from app.services.email_templates import (
        base_template, cta_button, info_card, code_box, security_notice,
        ACCENT_YELLOW, TEXT_LIGHT, TEXT_MUTED,
    )

    body_html = f"""
<h2 style="color: {TEXT_LIGHT}; margin: 0 0 4px 0; font-size: 26px;">Welcome, {name}!</h2>
<p style="color: {ACCENT_YELLOW}; margin: 0 0 24px 0; font-size: 18px; font-style: italic;">"Welcome to the Watch"</p>

{info_card(
    "What is Second Watch Network?",
    f'Second Watch Network is the <strong style="color: {TEXT_LIGHT};">premier platform for purpose-driven filmmakers</strong>. '
    "We're a community of creators, producers, and industry professionals united by a shared mission: "
    "to create meaningful cinema that inspires and uplifts. From development to distribution, "
    "we provide the tools, connections, and resources you need to bring your vision to life."
)}

<!-- Credentials Box -->
<div style="background-color: #2a2a2a; padding: 24px; border-radius: 8px; margin-bottom: 24px; border: 2px solid {ACCENT_YELLOW};">
    <h3 style="color: {ACCENT_YELLOW}; margin: 0 0 16px 0; font-size: 16px; text-transform: uppercase; letter-spacing: 1px;">
        Your Login Credentials
    </h3>

    <div style="margin-bottom: 16px;">
        <p style="color: #888; margin: 0 0 4px 0; font-size: 12px; text-transform: uppercase;">Email</p>
        <p style="color: {TEXT_LIGHT}; margin: 0; font-size: 16px; font-family: monospace; background-color: #1a1a1a; padding: 10px 14px; border-radius: 4px;">
            {email}
        </p>
    </div>

    <div>
        <p style="color: #888; margin: 0 0 4px 0; font-size: 12px; text-transform: uppercase;">Temporary Password <span style="font-size: 10px; font-weight: normal; color: #666;">(click to select)</span></p>
        <p style="color: {ACCENT_YELLOW}; margin: 0; font-size: 20px; font-family: monospace; font-weight: bold; background-color: #1a1a1a; padding: 10px 14px; border-radius: 4px; letter-spacing: 2px; -webkit-user-select: all; -moz-user-select: all; -ms-user-select: all; user-select: all; cursor: pointer;">{temp_password}</p>
    </div>
</div>

{security_notice("You will be required to change your password when you first log in. Keep your credentials secure and do not share them.")}

{cta_button("LOG IN NOW", login_url)}

<!-- Feature Highlights -->
<div style="border-top: 1px solid #333; padding-top: 32px; margin-top: 32px;">
    <h3 style="color: {ACCENT_YELLOW}; margin: 0 0 24px 0; font-size: 18px; text-transform: uppercase; letter-spacing: 1px; text-align: center;">Explore the Platform</h3>

    <table style="width: 100%; border-collapse: separate; border-spacing: 12px;">
        <tr>
            <td style="width: 50%; vertical-align: top; background-color: #252525; padding: 20px; border-radius: 8px; border-top: 3px solid #4ade80;">
                <h4 style="color: #4ade80; margin: 0 0 8px 0; font-size: 16px;">The Green Room</h4>
                <p style="color: {TEXT_MUTED}; margin: 0; font-size: 13px; line-height: 1.5;">
                    Develop your projects from concept to greenlight. Pitch ideas, find collaborators, and compete for funding and distribution opportunities.
                </p>
            </td>
            <td style="width: 50%; vertical-align: top; background-color: #252525; padding: 20px; border-radius: 8px; border-top: 3px solid #60a5fa;">
                <h4 style="color: #60a5fa; margin: 0 0 8px 0; font-size: 16px;">The Backlot</h4>
                <p style="color: {TEXT_MUTED}; margin: 0; font-size: 13px; line-height: 1.5;">
                    Professional production management tools. Handle call sheets, clearances, budgets, casting, and crew coordination all in one place.
                </p>
            </td>
        </tr>
        <tr>
            <td style="width: 50%; vertical-align: top; background-color: #252525; padding: 20px; border-radius: 8px; border-top: 3px solid {ACCENT_YELLOW};">
                <h4 style="color: {ACCENT_YELLOW}; margin: 0 0 8px 0; font-size: 16px;">The Order</h4>
                <p style="color: {TEXT_MUTED}; margin: 0; font-size: 13px; line-height: 1.5;">
                    Join our professional guild. Connect with Craft Houses for your specialty, find mentorship, and build your career network.
                </p>
            </td>
            <td style="width: 50%; vertical-align: top; background-color: #252525; padding: 20px; border-radius: 8px; border-top: 3px solid #f472b6;">
                <h4 style="color: #f472b6; margin: 0 0 8px 0; font-size: 16px;">Community</h4>
                <p style="color: {TEXT_MUTED}; margin: 0; font-size: 13px; line-height: 1.5;">
                    Engage with fellow filmmakers. Share knowledge, discuss craft, find collaborators, and be part of something bigger than yourself.
                </p>
            </td>
        </tr>
    </table>
</div>

<!-- Community Guidelines -->
<div style="border-top: 1px solid #333; padding-top: 32px; margin-top: 32px;">
    <h3 style="color: {ACCENT_YELLOW}; margin: 0 0 16px 0; font-size: 16px; text-transform: uppercase; letter-spacing: 1px;">Community Guidelines</h3>
    <div style="background-color: #252525; padding: 20px; border-radius: 8px;">
        <ul style="color: {TEXT_MUTED}; margin: 0; padding-left: 20px; line-height: 1.8; font-size: 14px;">
            <li><strong style="color: #f5f0e1;">Respect & Integrity:</strong> Treat all members with dignity. We're a professional community.</li>
            <li><strong style="color: #f5f0e1;">Purpose-Driven:</strong> We create content with meaning and intention. Stories that matter.</li>
            <li><strong style="color: #f5f0e1;">Collaboration:</strong> Share knowledge generously. We rise by lifting others.</li>
            <li><strong style="color: #f5f0e1;">Excellence:</strong> Pursue the highest standards in your craft and conduct.</li>
        </ul>
        <p style="color: #666; margin: 16px 0 0 0; font-size: 12px;">
            <a href="https://www.secondwatchnetwork.com/guidelines" style="color: {ACCENT_YELLOW}; text-decoration: none;">Read our full Community Guidelines &rarr;</a>
        </p>
    </div>
</div>

<!-- Quick Start Guide -->
<div style="border-top: 1px solid #333; padding-top: 32px; margin-top: 32px;">
    <h3 style="color: {ACCENT_YELLOW}; margin: 0 0 16px 0; font-size: 16px; text-transform: uppercase; letter-spacing: 1px;">Quick Start Guide</h3>
    <table style="width: 100%;">
        <tr>
            <td style="padding: 8px 0; vertical-align: top; width: 30px;">
                <span style="display: inline-block; width: 24px; height: 24px; background-color: {ACCENT_YELLOW}; color: #121212; border-radius: 50%; text-align: center; line-height: 24px; font-weight: bold; font-size: 12px;">1</span>
            </td>
            <td style="padding: 8px 0; color: {TEXT_MUTED}; font-size: 14px;">Go to <a href="{login_url}" style="color: {ACCENT_YELLOW}; text-decoration: none;">secondwatchnetwork.com/login</a> and enter your email and temporary password above</td>
        </tr>
        <tr>
            <td style="padding: 8px 0; vertical-align: top;">
                <span style="display: inline-block; width: 24px; height: 24px; background-color: {ACCENT_YELLOW}; color: #121212; border-radius: 50%; text-align: center; line-height: 24px; font-weight: bold; font-size: 12px;">2</span>
            </td>
            <td style="padding: 8px 0; color: {TEXT_MUTED}; font-size: 14px;">You'll be prompted to set a new password &mdash; choose something secure</td>
        </tr>
        <tr>
            <td style="padding: 8px 0; vertical-align: top;">
                <span style="display: inline-block; width: 24px; height: 24px; background-color: {ACCENT_YELLOW}; color: #121212; border-radius: 50%; text-align: center; line-height: 24px; font-weight: bold; font-size: 12px;">3</span>
            </td>
            <td style="padding: 8px 0; color: {TEXT_MUTED}; font-size: 14px;">Complete your profile with bio, skills, and experience</td>
        </tr>
        <tr>
            <td style="padding: 8px 0; vertical-align: top;">
                <span style="display: inline-block; width: 24px; height: 24px; background-color: {ACCENT_YELLOW}; color: #121212; border-radius: 50%; text-align: center; line-height: 24px; font-weight: bold; font-size: 12px;">4</span>
            </td>
            <td style="padding: 8px 0; color: {TEXT_MUTED}; font-size: 14px;">Explore the platform and connect with other filmmakers</td>
        </tr>
    </table>
</div>

<!-- Need Help -->
<div style="border-top: 1px solid #333; padding-top: 24px; margin-top: 32px;">
    <h3 style="color: #f5f0e1; margin: 0 0 12px 0; font-size: 14px; text-transform: uppercase; letter-spacing: 1px;">Need Help?</h3>
    <p style="color: {TEXT_MUTED}; margin: 0 0 8px 0; font-size: 14px;">
        Our team is here to support you on your filmmaking journey.
    </p>
    <p style="margin: 0;">
        <a href="mailto:support@theswn.com" style="color: {ACCENT_YELLOW}; text-decoration: none; font-size: 14px;">support@theswn.com</a>
    </p>
</div>

<p style="margin: 24px 0 0 0; font-size: 11px; color: #444; text-align: center;">
    If you did not request this account, please ignore this email.<br>
    This email was sent to {email}
</p>
    """

    return base_template(
        "Welcome to Second Watch Network",
        body_html,
        preheader="Your Second Watch Network account is ready. Log in to explore professional filmmaking tools and connect with our community."
    )


def generate_welcome_email_text(
    name: str,
    email: str,
    temp_password: str,
    login_url: str = "https://www.secondwatchnetwork.com/login"
) -> str:
    """Generate plain text version of welcome email with full onboarding content"""
    lines = [
        "=" * 60,
        "       SECOND WATCH NETWORK",
        "       \"Welcome to the Watch\"",
        "=" * 60,
        "",
        f"Welcome, {name}!",
        "",
        "-" * 60,
        "WHAT IS SECOND WATCH NETWORK?",
        "-" * 60,
        "",
        "Second Watch Network is the premier platform for purpose-driven",
        "filmmakers. We're a community of creators, producers, and industry",
        "professionals united by a shared mission: to create meaningful",
        "cinema that inspires and uplifts.",
        "",
        "From development to distribution, we provide the tools,",
        "connections, and resources you need to bring your vision to life.",
        "",
        "=" * 60,
        "YOUR LOGIN CREDENTIALS",
        "=" * 60,
        "",
        f"Email:              {email}",
        f"Temporary Password: {temp_password}",
        "",
        "*** SECURITY NOTICE ***",
        "You will be required to change your password when you first",
        "log in. Keep your credentials secure and do not share them.",
        "",
        f"Log in here: {login_url}",
        "",
        "-" * 60,
        "EXPLORE THE PLATFORM",
        "-" * 60,
        "",
        "THE GREEN ROOM",
        "  Develop your projects from concept to greenlight. Pitch ideas,",
        "  find collaborators, and compete for funding opportunities.",
        "",
        "THE BACKLOT",
        "  Professional production management tools. Handle call sheets,",
        "  clearances, budgets, casting, and crew coordination.",
        "",
        "THE ORDER",
        "  Join our professional guild. Connect with Craft Houses for",
        "  your specialty, find mentorship, and build your network.",
        "",
        "COMMUNITY",
        "  Engage with fellow filmmakers. Share knowledge, discuss craft,",
        "  and be part of something bigger than yourself.",
        "",
        "-" * 60,
        "COMMUNITY GUIDELINES",
        "-" * 60,
        "",
        "* RESPECT & INTEGRITY: Treat all members with dignity.",
        "* PURPOSE-DRIVEN: We create content with meaning. Stories that matter.",
        "* COLLABORATION: Share knowledge generously. We rise by lifting others.",
        "* EXCELLENCE: Pursue the highest standards in craft and conduct.",
        "",
        "Full guidelines: https://www.secondwatchnetwork.com/guidelines",
        "",
        "-" * 60,
        "QUICK START GUIDE",
        "-" * 60,
        "",
        f"1. Go to {login_url} and enter your email and temporary password above",
        "2. You'll be prompted to set a new password - choose something secure",
        "3. Complete your profile with bio, skills, and experience",
        "4. Explore the platform and connect with other filmmakers",
        "",
        "-" * 60,
        "NEED HELP?",
        "-" * 60,
        "",
        "Our team is here to support you on your filmmaking journey.",
        "Contact us: support@theswn.com",
        "",
        "=" * 60,
        "www.secondwatchnetwork.com",
        "Second Watch Network - Purpose-Driven Filmmaking",
        "Building the future of cinema, together.",
        "",
        "If you did not request this account, please ignore this email.",
        f"This email was sent to {email}",
        "=" * 60,
    ]
    return "\n".join(lines)


async def send_welcome_email(
    email: str,
    name: str,
    temp_password: str
) -> Dict[str, Any]:
    """
    Send welcome email with temporary password to new user.

    Args:
        email: User's email address
        name: User's display name
        temp_password: Temporary password to include in email

    Returns:
        Dict with success status and details
    """
    html_content = generate_welcome_email_html(
        name=name,
        email=email,
        temp_password=temp_password,
        login_url="https://www.secondwatchnetwork.com/login"
    )

    text_content = generate_welcome_email_text(
        name=name,
        email=email,
        temp_password=temp_password,
        login_url="https://www.secondwatchnetwork.com/login"
    )

    return await EmailService.send_email(
        to_emails=[email],
        subject="Welcome to Second Watch Network - Your Account is Ready",
        html_content=html_content,
        text_content=text_content,
        email_type="welcome",
        source_service="admin",
        source_action="user_creation"
    )


# =============================================================================
# SUBMISSION STATUS CHANGE EMAIL TEMPLATES
# =============================================================================

STATUS_MESSAGES = {
    "pending": {
        "subject": "Submission Received",
        "headline": "We've Received Your Submission",
        "message": "Thank you for submitting your project to Second Watch Network. Your submission is now in our queue and will be reviewed by our team.",
        "color": "#fbbf24"  # Yellow
    },
    "in review": {
        "subject": "Submission Under Review",
        "headline": "Your Submission is Being Reviewed",
        "message": "Good news! Your submission has been picked up by our review team. We're taking a closer look at your project and will be in touch soon with our decision.",
        "color": "#60a5fa"  # Blue
    },
    "considered": {
        "subject": "Submission Being Considered",
        "headline": "We're Considering Your Project",
        "message": "Your submission has made it to the consideration stage. This means our team is actively discussing your project for potential inclusion in our programming.",
        "color": "#a78bfa"  # Purple
    },
    "approved": {
        "subject": "Congratulations! Submission Approved",
        "headline": "Your Submission Has Been Approved!",
        "message": "Congratulations! We're excited to let you know that your submission has been approved for Second Watch Network. We'll be reaching out soon with next steps for getting your content featured.",
        "color": "#4ade80"  # Green
    },
    "rejected": {
        "subject": "Submission Update",
        "headline": "Update on Your Submission",
        "message": "Thank you for sharing your project with us. After careful review, we've decided not to move forward with this submission at this time. We encourage you to continue creating and submit again in the future.",
        "color": "#f87171"  # Red
    },
    "archived": {
        "subject": "Submission Archived",
        "headline": "Your Submission Has Been Archived",
        "message": "Your submission has been archived. If you believe this was done in error, please reach out to our team.",
        "color": "#9ca3af"  # Gray
    }
}


def generate_submission_status_email_html(
    project_title: str,
    new_status: str,
    submitter_name: str,
    view_url: Optional[str] = None,
    admin_message: Optional[str] = None
) -> str:
    """
    Generate HTML email for submission status changes using shared base_template branding.
    """
    from app.services.email_templates import base_template, cta_button, info_card, TEXT_LIGHT, TEXT_MUTED

    status_info = STATUS_MESSAGES.get(new_status, STATUS_MESSAGES["pending"])

    # Admin message section
    admin_section = ""
    if admin_message:
        admin_section = f"""
        <div style="background-color: #2a3a2a; padding: 16px; border-radius: 8px; margin: 24px 0; border-left: 4px solid #4ade80;">
            <p style="color: #4ade80; margin: 0 0 4px 0; font-weight: bold;">Message from our team:</p>
            <p style="color: {TEXT_MUTED}; margin: 0; white-space: pre-wrap;">{admin_message}</p>
        </div>
        """

    # View button
    view_button = cta_button("View Your Submission", view_url) if view_url else ""

    body_html = f"""
<p style="color: {TEXT_MUTED}; margin: 0 0 8px 0; font-size: 14px;">Hi {submitter_name},</p>

<h2 style="color: {status_info['color']}; margin: 16px 0; font-size: 24px;">
    {status_info['headline']}
</h2>

{info_card(
    project_title,
    f'<span style="color: {status_info["color"]}; font-size: 14px; text-transform: uppercase; font-weight: bold;">Status: {new_status.title()}</span>',
    accent_color=status_info['color']
)}

<p style="color: {TEXT_MUTED}; margin: 0; font-size: 15px; line-height: 1.7;">
    {status_info['message']}
</p>

{admin_section}
{view_button}

<p style="color: #666; margin: 24px 0 0 0; font-size: 14px;">
    You can view all your submissions and check their status in your dashboard.
</p>
    """

    return base_template(
        status_info['subject'],
        body_html,
        preheader=f"{status_info['headline']} — {project_title}"
    )


def generate_submission_status_email_text(
    project_title: str,
    new_status: str,
    submitter_name: str,
    view_url: Optional[str] = None,
    admin_message: Optional[str] = None
) -> str:
    """Generate plain text version of submission status email"""
    status_info = STATUS_MESSAGES.get(new_status, STATUS_MESSAGES["pending"])

    lines = [
        "=" * 50,
        "SECOND WATCH NETWORK",
        "=" * 50,
        "",
        f"Hi {submitter_name},",
        "",
        status_info['headline'],
        "",
        f"Project: {project_title}",
        f"Status: {new_status.title()}",
        "",
        status_info['message'],
        ""
    ]

    if admin_message:
        lines.extend([
            "-" * 50,
            "Message from our team:",
            admin_message,
            ""
        ])

    if view_url:
        lines.extend([
            f"View your submission: {view_url}",
            ""
        ])

    lines.extend([
        "You can view all your submissions in your dashboard.",
        "",
        "=" * 50,
        "www.secondwatchnetwork.com",
        "Second Watch Network - Purpose-Driven Filmmaking",
        "=" * 50
    ])

    return "\n".join(lines)


async def send_submission_status_email(
    email: str,
    name: str,
    project_title: str,
    new_status: str,
    submission_id: Optional[str] = None,
    admin_message: Optional[str] = None
) -> Dict[str, Any]:
    """
    Send email notification when a submission status changes.

    Args:
        email: Recipient's email address
        name: Recipient's name
        project_title: Title of the submitted project
        new_status: New status of the submission
        submission_id: Optional submission ID for view URL
        admin_message: Optional message from admin

    Returns:
        Dict with success status and details
    """
    status_info = STATUS_MESSAGES.get(new_status, STATUS_MESSAGES["pending"])

    view_url = None
    if submission_id:
        view_url = f"https://www.secondwatchnetwork.com/my-submissions"

    html_content = generate_submission_status_email_html(
        project_title=project_title,
        new_status=new_status,
        submitter_name=name,
        view_url=view_url,
        admin_message=admin_message
    )

    text_content = generate_submission_status_email_text(
        project_title=project_title,
        new_status=new_status,
        submitter_name=name,
        view_url=view_url,
        admin_message=admin_message
    )

    return await EmailService.send_email(
        to_emails=[email],
        subject=f"{status_info['subject']} - {project_title}",
        html_content=html_content,
        text_content=text_content,
        email_type="submission_status",
        source_service="submissions",
        source_action="status_change",
        source_reference_id=submission_id
    )
