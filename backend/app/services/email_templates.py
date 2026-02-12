"""
Shared Email Template Module for Second Watch Network

Provides unified branding for all auto-sent emails (welcome, notifications, etc.).
The Cognito Lambda (cognito_email_sender/templates.py) has its own copy since it's
deployed independently via SAM, but should stay visually aligned with these templates.

SYNC: cognito_email_sender/templates.py should match these brand constants and layout.
"""

# Brand constants
ACCENT_YELLOW = "#FCDC58"
BG_DARK = "#121212"
BG_CARD = "#1a1a1a"
BG_CARD_INNER = "#2a2a2a"
TEXT_LIGHT = "#F9F5EF"
TEXT_MUTED = "#a0a0a0"
LINK_URL = "https://www.secondwatchnetwork.com"


def base_template(headline: str, body_html: str, preheader: str = "") -> str:
    """
    Shared HTML email shell with SWN branding.

    Args:
        headline: Page title / headline text
        body_html: Inner HTML content for the email body
        preheader: Hidden preview text shown in email clients
    """
    preheader_html = ""
    if preheader:
        preheader_html = f"""
    <!-- Preheader text (hidden but used by email clients for preview) -->
    <div style="display: none; max-height: 0; overflow: hidden;">{preheader}</div>"""

    return f"""<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta name="x-apple-disable-message-reformatting">
    <meta name="format-detection" content="telephone=no, date=no, address=no, email=no">
    <title>{headline} - Second Watch Network</title>
    <!--[if mso]>
    <noscript>
        <xml>
            <o:OfficeDocumentSettings>
                <o:PixelsPerInch>96</o:PixelsPerInch>
            </o:OfficeDocumentSettings>
        </xml>
    </noscript>
    <![endif]-->
</head>
<body style="margin: 0; padding: 0; background-color: {BG_DARK}; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; -webkit-font-smoothing: antialiased; -moz-osx-font-smoothing: grayscale;">
    {preheader_html}
    <div style="max-width: 640px; margin: 0 auto; padding: 24px;">

        <!-- Header -->
        <div style="text-align: center; padding: 32px 24px; background: linear-gradient(135deg, {BG_CARD} 0%, #252525 50%, {BG_CARD} 100%); border-radius: 12px 12px 0 0; border-bottom: 3px solid {ACCENT_YELLOW}; position: relative;">
            <!-- Film strip accent -->
            <div style="height: 8px; background: repeating-linear-gradient(90deg, {ACCENT_YELLOW} 0px, {ACCENT_YELLOW} 20px, transparent 20px, transparent 30px); margin-bottom: 16px;"></div>
            <h1 style="color: {ACCENT_YELLOW}; margin: 0 0 4px 0; font-size: 28px; letter-spacing: 2px; font-weight: 700;">SECOND WATCH</h1>
            <p style="color: {TEXT_LIGHT}; margin: 0; font-size: 12px; text-transform: uppercase; letter-spacing: 3px;">NETWORK</p>
        </div>

        <!-- Content -->
        <div style="background-color: {BG_CARD}; padding: 32px 24px;">
            {body_html}
        </div>

        <!-- Footer -->
        <div style="background-color: #252525; padding: 24px; border-radius: 0 0 12px 12px;">
            <div style="text-align: center;">
                <p style="margin: 0 0 8px 0;">
                    <a href="{LINK_URL}" style="color: {ACCENT_YELLOW}; text-decoration: none; font-size: 14px;">www.secondwatchnetwork.com</a>
                </p>
                <p style="margin: 0; font-size: 12px; color: #666; line-height: 1.6;">
                    Second Watch Network &mdash; Purpose-Driven Filmmaking
                </p>
            </div>
        </div>
    </div>
</body>
</html>"""


def cta_button(text: str, url: str) -> str:
    """Generate a branded call-to-action button."""
    return f"""<div style="text-align: center; margin: 32px 0;">
    <a href="{url}" style="display: inline-block; background: linear-gradient(135deg, {ACCENT_YELLOW} 0%, #e5c94d 100%); color: {BG_DARK}; padding: 16px 48px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 16px; letter-spacing: 1px; box-shadow: 0 4px 12px rgba(252, 220, 88, 0.3);">
        {text}
    </a>
</div>"""


def code_box(code: str) -> str:
    """Large monospace code display box with click-to-select."""
    return f"""<div style="text-align: center; margin: 24px 0;">
    <div style="display: inline-block; background-color: {BG_CARD_INNER}; border: 2px solid {ACCENT_YELLOW}; border-radius: 8px; padding: 20px 40px;">
        <p style="color: #888; margin: 0 0 8px 0; font-size: 12px; text-transform: uppercase;">Your Code</p>
        <p style="color: {ACCENT_YELLOW}; margin: 0; font-size: 32px; font-family: monospace; font-weight: bold; letter-spacing: 6px; -webkit-user-select: all; -moz-user-select: all; user-select: all; cursor: pointer;">{code}</p>
    </div>
</div>"""


def info_card(title: str, content: str, accent_color: str = ACCENT_YELLOW) -> str:
    """A bordered info card with accent left border."""
    return f"""<div style="background: linear-gradient(135deg, #252525 0%, #1f1f1f 100%); padding: 20px; border-radius: 8px; margin-bottom: 24px; border-left: 4px solid {accent_color};">
    <h3 style="color: {accent_color}; margin: 0 0 12px 0; font-size: 16px; text-transform: uppercase; letter-spacing: 1px;">{title}</h3>
    <p style="color: {TEXT_MUTED}; margin: 0; font-size: 15px; line-height: 1.7;">
        {content}
    </p>
</div>"""


def security_notice(text: str) -> str:
    """Security notice callout with warning styling."""
    return f"""<div style="background-color: #3a3a2a; padding: 16px; border-radius: 8px; margin-bottom: 24px; border-left: 4px solid #fbbf24;">
    <p style="color: #fbbf24; margin: 0; font-size: 14px;">
        <strong>Security Notice:</strong> {text}
    </p>
</div>"""


def build_instant_notification_email(
    account_email: str,
    from_address: str,
    subject: str,
    preview: str,
    thread_url: str,
) -> str:
    """
    Build an instant email notification for new inbound CRM email.

    Args:
        account_email: The work email that received the message
        from_address: Who sent the email
        subject: Subject of the received email
        preview: Preview text of the email body
        thread_url: Link to the thread in CRM
    """
    body = f"""
<h2 style="color: {TEXT_LIGHT}; margin: 0 0 16px 0; font-size: 22px;">New Email Received</h2>
<p style="color: {TEXT_MUTED}; margin: 0 0 24px 0; font-size: 15px; line-height: 1.6;">
    Your work inbox <strong style="color: {TEXT_LIGHT};">{account_email}</strong> has received a new message.
</p>

<div style="background-color: {BG_CARD_INNER}; padding: 20px; border-radius: 8px; margin-bottom: 24px; border-left: 4px solid {ACCENT_YELLOW};">
    <p style="color: #888; margin: 0 0 4px 0; font-size: 12px; text-transform: uppercase;">From</p>
    <p style="color: {TEXT_LIGHT}; margin: 0 0 16px 0; font-size: 15px;">{from_address}</p>

    <p style="color: #888; margin: 0 0 4px 0; font-size: 12px; text-transform: uppercase;">Subject</p>
    <p style="color: {TEXT_LIGHT}; margin: 0 0 16px 0; font-size: 15px;">{subject}</p>

    <p style="color: #888; margin: 0 0 4px 0; font-size: 12px; text-transform: uppercase;">Preview</p>
    <p style="color: {TEXT_MUTED}; margin: 0; font-size: 14px; line-height: 1.5;">{preview[:300]}{"..." if len(preview) > 300 else ""}</p>
</div>

{cta_button("View in CRM", thread_url)}

<p style="color: #666; margin: 0; font-size: 12px; text-align: center;">
    You're receiving this because instant notifications are enabled for {account_email}.
</p>"""

    return base_template(
        "New Email Received",
        body,
        preheader=f"New email from {from_address}: {subject}"
    )


def build_digest_notification_email(
    account_email: str,
    messages: list,
    crm_url: str,
) -> str:
    """
    Build a digest notification email summarizing unread CRM emails.

    Args:
        account_email: The work email that received messages
        messages: List of dicts with keys: from_address, subject, preview_text, created_at
        crm_url: Link to the CRM email inbox
    """
    count = len(messages)
    rows_html = ""
    for msg in messages[:20]:  # Cap at 20 messages in digest
        rows_html += f"""
        <tr>
            <td style="padding: 12px; border-bottom: 1px solid #333; color: {TEXT_LIGHT}; font-size: 14px;">{msg.get('from_address', 'Unknown')}</td>
            <td style="padding: 12px; border-bottom: 1px solid #333; color: {TEXT_MUTED}; font-size: 14px;">{msg.get('subject', '(no subject)')}</td>
        </tr>"""

    overflow = ""
    if count > 20:
        overflow = f'<p style="color: {TEXT_MUTED}; margin: 16px 0 0 0; font-size: 13px; text-align: center;">...and {count - 20} more messages</p>'

    body = f"""
<h2 style="color: {TEXT_LIGHT}; margin: 0 0 16px 0; font-size: 22px;">Email Digest</h2>
<p style="color: {TEXT_MUTED}; margin: 0 0 24px 0; font-size: 15px; line-height: 1.6;">
    You have <strong style="color: {ACCENT_YELLOW};">{count}</strong> new message{"s" if count != 1 else ""} in <strong style="color: {TEXT_LIGHT};">{account_email}</strong>.
</p>

<table style="width: 100%; border-collapse: collapse; background-color: {BG_CARD_INNER}; border-radius: 8px; overflow: hidden;">
    <thead>
        <tr>
            <th style="padding: 12px; text-align: left; color: {ACCENT_YELLOW}; font-size: 12px; text-transform: uppercase; border-bottom: 2px solid {ACCENT_YELLOW};">From</th>
            <th style="padding: 12px; text-align: left; color: {ACCENT_YELLOW}; font-size: 12px; text-transform: uppercase; border-bottom: 2px solid {ACCENT_YELLOW};">Subject</th>
        </tr>
    </thead>
    <tbody>
        {rows_html}
    </tbody>
</table>
{overflow}

{cta_button("Open CRM Inbox", crm_url)}

<p style="color: #666; margin: 0; font-size: 12px; text-align: center;">
    You're receiving this digest because digest notifications are enabled for {account_email}.
</p>"""

    return base_template(
        "Email Digest",
        body,
        preheader=f"{count} new message{'s' if count != 1 else ''} in {account_email}"
    )


def build_notification_confirmation_email(
    account_email: str,
    notification_email: str,
    mode: str,
    crm_url: str,
) -> str:
    """
    Build a confirmation email sent to the user's personal email
    when they enable CRM email notifications.

    Args:
        account_email: The CRM work email being monitored
        notification_email: The personal email receiving notifications
        mode: "instant" or "digest"
        crm_url: Link to CRM email settings
    """
    mode_label = "Instant" if mode == "instant" else "Hourly Digest"
    mode_desc = (
        "You'll receive an email immediately whenever a new message arrives."
        if mode == "instant"
        else "You'll receive a summary of new messages on an hourly or daily schedule."
    )

    body = f"""
<h2 style="color: {TEXT_LIGHT}; margin: 0 0 16px 0; font-size: 22px;">Notifications Enabled</h2>
<p style="color: {TEXT_MUTED}; margin: 0 0 24px 0; font-size: 15px; line-height: 1.6;">
    Email notifications have been set up for your CRM inbox. Here's a summary of your settings:
</p>

{info_card("Work Email", f'<span style="color: {TEXT_LIGHT};">{account_email}</span>')}
{info_card("Notification Email", f'<span style="color: {TEXT_LIGHT};">{notification_email}</span>')}
{info_card("Mode", f'<span style="color: {TEXT_LIGHT};">{mode_label}</span><br><span style="color: {TEXT_MUTED}; font-size: 13px;">{mode_desc}</span>')}

{cta_button("Open CRM Email", crm_url)}

<p style="color: #666; margin: 0; font-size: 12px; text-align: center;">
    You can change these settings anytime in your CRM email settings.
</p>"""

    return base_template(
        "Notifications Enabled",
        body,
        preheader=f"CRM notifications enabled for {account_email}"
    )
