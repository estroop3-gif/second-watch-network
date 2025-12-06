"""
Email Service for Second Watch Network
Supports Resend, SendGrid, and SMTP providers
"""
import smtplib
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
        provider = settings.EMAIL_PROVIDER.lower()

        if provider == "resend":
            return await EmailService._send_via_resend(to_emails, subject, html_content, text_content, reply_to)
        elif provider == "sendgrid":
            return await EmailService._send_via_sendgrid(to_emails, subject, html_content, text_content, reply_to)
        elif provider == "smtp":
            return await EmailService._send_via_smtp(to_emails, subject, html_content, text_content, reply_to)
        else:
            # Fallback: log only (for development)
            return await EmailService._log_email(to_emails, subject, html_content)

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
