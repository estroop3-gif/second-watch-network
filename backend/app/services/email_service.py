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


class EmailService:
    """Email sending service with support for multiple providers"""

    @staticmethod
    async def send_email(
        to_emails: List[str],
        subject: str,
        html_content: str,
        text_content: Optional[str] = None,
        reply_to: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Send an email to one or more recipients

        Args:
            to_emails: List of recipient email addresses
            subject: Email subject line
            html_content: HTML body content
            text_content: Plain text body content (optional, derived from HTML if not provided)
            reply_to: Reply-to email address (optional)

        Returns:
            Dict with success status and details
        """
        provider = getattr(settings, 'EMAIL_PROVIDER', 'ses').lower()

        if provider == "ses" or provider == "aws":
            return await EmailService._send_via_ses(to_emails, subject, html_content, text_content, reply_to)
        elif provider == "resend":
            return await EmailService._send_via_resend(to_emails, subject, html_content, text_content, reply_to)
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
        reply_to: Optional[str] = None
    ) -> Dict[str, Any]:
        """Send email using AWS SES"""
        try:
            import boto3
            from botocore.exceptions import ClientError

            # Get AWS region from settings or environment
            aws_region = getattr(settings, 'AWS_REGION', None) or os.getenv('AWS_REGION', 'us-east-1')

            # Get email from address
            from_name = getattr(settings, 'EMAIL_FROM_NAME', 'Second Watch Network')
            from_address = getattr(settings, 'EMAIL_FROM_ADDRESS', None) or os.getenv('SES_FROM_EMAIL', 'noreply@secondwatchnetwork.com')

            # Create SES client
            ses_client = boto3.client(
                'ses',
                region_name=aws_region,
                aws_access_key_id=os.getenv('AWS_ACCESS_KEY_ID'),
                aws_secret_access_key=os.getenv('AWS_SECRET_ACCESS_KEY')
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

            return {
                "success": True,
                "provider": "ses",
                "message_id": response.get('MessageId'),
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
        reply_to: Optional[str] = None
    ) -> Dict[str, Any]:
        """Send email using Resend API"""
        if not settings.RESEND_API_KEY:
            print("Warning: RESEND_API_KEY not configured, logging email instead")
            return await EmailService._log_email(to_emails, subject, html_content)

        try:
            import resend
            resend.api_key = settings.RESEND_API_KEY

            params = {
                "from": f"{settings.EMAIL_FROM_NAME} <{settings.EMAIL_FROM_ADDRESS}>",
                "to": to_emails,
                "subject": subject,
                "html": html_content,
            }

            if text_content:
                params["text"] = text_content
            if reply_to:
                params["reply_to"] = reply_to

            result = resend.Emails.send(params)

            return {
                "success": True,
                "provider": "resend",
                "message_id": result.get("id"),
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
    Generate HTML email for a call sheet

    Returns formatted HTML string ready for email sending
    """
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
        <h3 style="color: #d4af37; margin-top: 24px; margin-bottom: 12px;">Schedule</h3>
        <table style="width: 100%; border-collapse: collapse; background-color: #1a1a1a;">
            <thead>
                <tr style="background-color: #2a2a2a;">
                    <th style="padding: 8px; text-align: left; color: #d4af37;">Time</th>
                    <th style="padding: 8px; text-align: left; color: #d4af37;">Activity</th>
                    <th style="padding: 8px; text-align: left; color: #d4af37;">Notes</th>
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
                <td style="padding: 8px; border-bottom: 1px solid #333; font-family: monospace; color: #d4af37;">{p.get('call_time', '')}</td>
                <td style="padding: 8px; border-bottom: 1px solid #333; color: #666;">{p.get('notes', '') or ''}</td>
            </tr>"""
            for p in people
        ])
        people_html = f"""
        <h3 style="color: #d4af37; margin-top: 24px; margin-bottom: 12px;">Crew & Talent</h3>
        <table style="width: 100%; border-collapse: collapse; background-color: #1a1a1a;">
            <thead>
                <tr style="background-color: #2a2a2a;">
                    <th style="padding: 8px; text-align: left; color: #d4af37;">Name</th>
                    <th style="padding: 8px; text-align: left; color: #d4af37;">Role</th>
                    <th style="padding: 8px; text-align: left; color: #d4af37;">Call Time</th>
                    <th style="padding: 8px; text-align: left; color: #d4af37;">Notes</th>
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
        additional_sections += f"""
        <div style="background-color: #2a2a2a; padding: 16px; border-radius: 8px; margin-top: 16px;">
            <h4 style="color: #d4af37; margin: 0 0 8px 0;">Special Instructions</h4>
            <p style="color: #a0a0a0; margin: 0; white-space: pre-wrap;">{special_instructions}</p>
        </div>
        """

    if weather_info:
        additional_sections += f"""
        <div style="background-color: #2a2a2a; padding: 16px; border-radius: 8px; margin-top: 16px;">
            <h4 style="color: #d4af37; margin: 0 0 8px 0;">Weather</h4>
            <p style="color: #a0a0a0; margin: 0;">{weather_info}</p>
        </div>
        """

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
    view_button = ""
    if view_url:
        view_button = f"""
        <div style="text-align: center; margin-top: 32px;">
            <a href="{view_url}" style="display: inline-block; background-color: #d4af37; color: #121212; padding: 12px 32px; text-decoration: none; border-radius: 8px; font-weight: bold;">
                View Full Call Sheet
            </a>
        </div>
        """

    html = f"""
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{call_sheet_title} - {project_title}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #121212; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
    <div style="max-width: 640px; margin: 0 auto; padding: 24px;">
        <!-- Header -->
        <div style="background: linear-gradient(135deg, #1a1a1a 0%, #2a2a2a 100%); padding: 24px; border-radius: 12px 12px 0 0; border-bottom: 2px solid #d4af37;">
            <h1 style="color: #d4af37; margin: 0 0 8px 0; font-size: 24px;">{call_sheet_title}</h1>
            <p style="color: #f5f0e1; margin: 0; font-size: 18px;">{project_title}</p>
        </div>

        <!-- Main Content -->
        <div style="background-color: #1a1a1a; padding: 24px; border-radius: 0 0 12px 12px;">
            {sender_section}

            <!-- Quick Info -->
            <div style="display: flex; flex-wrap: wrap; gap: 16px; margin-bottom: 24px;">
                <div style="flex: 1; min-width: 200px; background-color: #2a2a2a; padding: 16px; border-radius: 8px;">
                    <p style="color: #d4af37; margin: 0 0 4px 0; font-size: 12px; text-transform: uppercase;">Date</p>
                    <p style="color: #f5f0e1; margin: 0; font-size: 18px; font-weight: bold;">{call_date}</p>
                </div>
                <div style="flex: 1; min-width: 200px; background-color: #2a2a2a; padding: 16px; border-radius: 8px;">
                    <p style="color: #d4af37; margin: 0 0 4px 0; font-size: 12px; text-transform: uppercase;">General Call</p>
                    <p style="color: #f5f0e1; margin: 0; font-size: 18px; font-weight: bold;">{call_time or 'TBD'}</p>
                </div>
            </div>

            <!-- Location -->
            <div style="background-color: #2a2a2a; padding: 16px; border-radius: 8px; margin-bottom: 24px;">
                <p style="color: #d4af37; margin: 0 0 4px 0; font-size: 12px; text-transform: uppercase;">Location</p>
                <p style="color: #f5f0e1; margin: 0; font-size: 16px; font-weight: bold;">{location_name or 'TBD'}</p>
                {f'<p style="color: #a0a0a0; margin: 8px 0 0 0;">{location_address}</p>' if location_address else ''}
            </div>

            {schedule_html}
            {people_html}
            {additional_sections}
            {view_button}
        </div>

        <!-- Footer -->
        <div style="text-align: center; padding: 24px; color: #666;">
            <p style="margin: 0 0 8px 0;">Sent via <a href="{settings.FRONTEND_URL}" style="color: #d4af37; text-decoration: none;">Second Watch Network</a> Backlot</p>
            <p style="margin: 0; font-size: 12px;">Please contact the production team if you have any questions.</p>
        </div>
    </div>
</body>
</html>
    """

    return html


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
    expiration_section = ""
    if expiration_date:
        expiration_section = f"""
        <div style="background-color: #3a3a2a; padding: 12px; border-radius: 8px; margin-top: 16px; border-left: 4px solid #fbbf24;">
            <p style="color: #fbbf24; margin: 0; font-size: 14px;">
                <strong>Note:</strong> This document expires on {expiration_date}
            </p>
        </div>
        """

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

    html = f"""
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{clearance_title} - {project_title}</title>
</head>
<body style="margin: 0; padding: 0; background-color: #121212; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
    <div style="max-width: 600px; margin: 0 auto; padding: 24px;">
        <!-- Header -->
        <div style="background: linear-gradient(135deg, #1a1a1a 0%, #2a2a2a 100%); padding: 24px; border-radius: 12px 12px 0 0; border-bottom: 2px solid #d4af37;">
            <h1 style="color: #d4af37; margin: 0 0 8px 0; font-size: 24px;">{type_label}</h1>
            <p style="color: #f5f0e1; margin: 0; font-size: 18px;">{project_title}</p>
        </div>

        <!-- Main Content -->
        <div style="background-color: #1a1a1a; padding: 24px; border-radius: 0 0 12px 12px;">
            {sender_section}

            <p style="color: #f5f0e1; margin: 0 0 16px 0; font-size: 16px;">
                You have been sent a document to {action_text}:
            </p>

            <div style="background-color: #2a2a2a; padding: 20px; border-radius: 8px; margin-bottom: 24px;">
                <h2 style="color: #f5f0e1; margin: 0 0 8px 0; font-size: 20px;">
                    {clearance_title}
                </h2>
                <p style="color: #d4af37; margin: 0; font-size: 14px; text-transform: uppercase;">
                    {type_label}
                </p>
            </div>

            {expiration_section}

            <!-- CTA Button -->
            <div style="text-align: center; margin: 32px 0;">
                <a href="{view_url}" style="display: inline-block; background-color: #d4af37; color: #121212; padding: 14px 36px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 16px;">
                    {button_text}
                </a>
            </div>

            {signature_note}
            {attachment_note}
        </div>

        <!-- Footer -->
        <div style="text-align: center; padding: 24px; color: #666;">
            <p style="margin: 0 0 8px 0;">Sent via <span style="color: #d4af37;">Second Watch Network</span> Backlot</p>
            <p style="margin: 0; font-size: 12px;">If you have questions, please contact the production team.</p>
        </div>
    </div>
</body>
</html>
    """

    return html


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
    Generate HTML welcome email with temporary password.
    Uses the same dark theme as other emails for consistency.
    """
    html = f"""
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Welcome to Second Watch Network</title>
</head>
<body style="margin: 0; padding: 0; background-color: #121212; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
    <div style="max-width: 600px; margin: 0 auto; padding: 24px;">
        <!-- Header with Logo -->
        <div style="text-align: center; padding: 32px 24px; background: linear-gradient(135deg, #1a1a1a 0%, #2a2a2a 100%); border-radius: 12px 12px 0 0; border-bottom: 3px solid #d4af37;">
            <h1 style="color: #d4af37; margin: 0 0 8px 0; font-size: 28px; letter-spacing: 1px;">SECOND WATCH</h1>
            <p style="color: #f5f0e1; margin: 0; font-size: 14px; text-transform: uppercase; letter-spacing: 2px;">NETWORK</p>
        </div>

        <!-- Main Content -->
        <div style="background-color: #1a1a1a; padding: 32px 24px; border-radius: 0 0 12px 12px;">
            <!-- Welcome Message -->
            <h2 style="color: #f5f0e1; margin: 0 0 16px 0; font-size: 24px;">
                Welcome, {name}!
            </h2>

            <p style="color: #a0a0a0; margin: 0 0 24px 0; font-size: 16px; line-height: 1.6;">
                Your account has been created on Second Watch Network, the premier platform for faith-driven filmmakers.
                We're excited to have you join our community!
            </p>

            <!-- Credentials Box -->
            <div style="background-color: #2a2a2a; padding: 24px; border-radius: 8px; margin-bottom: 24px; border: 1px solid #d4af37;">
                <h3 style="color: #d4af37; margin: 0 0 16px 0; font-size: 16px; text-transform: uppercase; letter-spacing: 1px;">
                    Your Login Credentials
                </h3>

                <div style="margin-bottom: 12px;">
                    <p style="color: #666; margin: 0 0 4px 0; font-size: 12px; text-transform: uppercase;">Email</p>
                    <p style="color: #f5f0e1; margin: 0; font-size: 16px; font-family: monospace; background-color: #1a1a1a; padding: 8px 12px; border-radius: 4px;">
                        {email}
                    </p>
                </div>

                <div>
                    <p style="color: #666; margin: 0 0 4px 0; font-size: 12px; text-transform: uppercase;">Temporary Password</p>
                    <p style="color: #d4af37; margin: 0; font-size: 18px; font-family: monospace; font-weight: bold; background-color: #1a1a1a; padding: 8px 12px; border-radius: 4px; letter-spacing: 1px;">
                        {temp_password}
                    </p>
                </div>
            </div>

            <!-- Security Note -->
            <div style="background-color: #3a3a2a; padding: 16px; border-radius: 8px; margin-bottom: 24px; border-left: 4px solid #fbbf24;">
                <p style="color: #fbbf24; margin: 0; font-size: 14px;">
                    <strong>Important:</strong> You will be required to change your password when you first log in.
                </p>
            </div>

            <!-- CTA Button -->
            <div style="text-align: center; margin: 32px 0;">
                <a href="{login_url}" style="display: inline-block; background-color: #d4af37; color: #121212; padding: 16px 48px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 18px; letter-spacing: 0.5px;">
                    Log In Now
                </a>
            </div>

            <!-- What's Next -->
            <div style="border-top: 1px solid #333; padding-top: 24px; margin-top: 24px;">
                <h3 style="color: #d4af37; margin: 0 0 16px 0; font-size: 16px;">What You Can Do:</h3>
                <ul style="color: #a0a0a0; margin: 0; padding-left: 20px; line-height: 1.8;">
                    <li>Complete your filmmaker profile</li>
                    <li>Connect with other filmmakers</li>
                    <li>Access the Backlot production tools</li>
                    <li>Submit your projects for consideration</li>
                    <li>Join the community forums</li>
                </ul>
            </div>
        </div>

        <!-- Footer -->
        <div style="text-align: center; padding: 24px; color: #666;">
            <p style="margin: 0 0 8px 0;">
                <a href="https://www.secondwatchnetwork.com" style="color: #d4af37; text-decoration: none;">www.secondwatchnetwork.com</a>
            </p>
            <p style="margin: 0 0 16px 0; font-size: 12px;">
                If you did not request this account, please ignore this email.
            </p>
            <p style="margin: 0; font-size: 12px; color: #444;">
                Need help? Contact us at support@secondwatch.network
            </p>
        </div>
    </div>
</body>
</html>
    """
    return html


def generate_welcome_email_text(
    name: str,
    email: str,
    temp_password: str,
    login_url: str = "https://www.secondwatchnetwork.com/login"
) -> str:
    """Generate plain text version of welcome email"""
    lines = [
        "=" * 50,
        "WELCOME TO SECOND WATCH NETWORK",
        "=" * 50,
        "",
        f"Hello {name}!",
        "",
        "Your account has been created on Second Watch Network,",
        "the premier platform for faith-driven filmmakers.",
        "",
        "-" * 50,
        "YOUR LOGIN CREDENTIALS",
        "-" * 50,
        f"Email: {email}",
        f"Temporary Password: {temp_password}",
        "",
        "IMPORTANT: You will be required to change your password",
        "when you first log in.",
        "",
        f"Log in here: {login_url}",
        "",
        "-" * 50,
        "WHAT YOU CAN DO:",
        "-" * 50,
        "- Complete your filmmaker profile",
        "- Connect with other filmmakers",
        "- Access the Backlot production tools",
        "- Submit your projects for consideration",
        "- Join the community forums",
        "",
        "=" * 50,
        "www.secondwatchnetwork.com",
        "",
        "If you did not request this account, please ignore this email.",
        "Need help? Contact us at support@secondwatch.network",
        "=" * 50,
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
        text_content=text_content
    )
