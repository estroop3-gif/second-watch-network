"""
SWN-branded HTML email templates for Cognito custom email sender.
Matches the dark theme from email_service.py:
  - Background: #121212 (charcoal black)
  - Accent: #FCDC58 (yellow)
  - Text: #F9F5EF (bone white)
"""

ACCENT_YELLOW = "#FCDC58"
BG_DARK = "#121212"
BG_CARD = "#1a1a1a"
BG_CARD_INNER = "#2a2a2a"
TEXT_LIGHT = "#F9F5EF"
TEXT_MUTED = "#a0a0a0"


def _base_template(headline: str, body_html: str) -> str:
    """Shared email shell matching existing SWN email templates."""
    return f"""<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta name="x-apple-disable-message-reformatting">
    <title>{headline} - Second Watch Network</title>
</head>
<body style="margin: 0; padding: 0; background-color: {BG_DARK}; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; -webkit-font-smoothing: antialiased;">
    <div style="max-width: 600px; margin: 0 auto; padding: 24px;">
        <!-- Header -->
        <div style="text-align: center; padding: 32px 24px; background: linear-gradient(135deg, {BG_CARD} 0%, #252525 50%, {BG_CARD} 100%); border-radius: 12px 12px 0 0; border-bottom: 3px solid {ACCENT_YELLOW};">
            <div style="position: relative; top: 0; left: 0; right: 0; height: 8px; background: repeating-linear-gradient(90deg, {ACCENT_YELLOW} 0px, {ACCENT_YELLOW} 20px, transparent 20px, transparent 30px); margin-bottom: 16px;"></div>
            <h1 style="color: {ACCENT_YELLOW}; margin: 0 0 4px 0; font-size: 28px; letter-spacing: 2px; font-weight: 700;">SECOND WATCH</h1>
            <p style="color: {TEXT_LIGHT}; margin: 0; font-size: 12px; text-transform: uppercase; letter-spacing: 3px;">NETWORK</p>
        </div>

        <!-- Content -->
        <div style="background-color: {BG_CARD}; padding: 32px 24px; border-radius: 0 0 12px 12px;">
            {body_html}
        </div>

        <!-- Footer -->
        <div style="text-align: center; padding: 24px; color: #666;">
            <p style="margin: 0 0 8px 0;">
                <a href="https://www.secondwatchnetwork.com" style="color: {ACCENT_YELLOW}; text-decoration: none; font-size: 14px;">www.secondwatchnetwork.com</a>
            </p>
            <p style="margin: 0; font-size: 12px; line-height: 1.6;">
                Second Watch Network &mdash; Purpose-Driven Filmmaking
            </p>
        </div>
    </div>
</body>
</html>"""


def _code_box(code: str) -> str:
    """Large monospace code display box with click-to-select."""
    return f"""<div style="text-align: center; margin: 24px 0;">
    <div style="display: inline-block; background-color: {BG_CARD_INNER}; border: 2px solid {ACCENT_YELLOW}; border-radius: 8px; padding: 20px 40px;">
        <p style="color: #888; margin: 0 0 8px 0; font-size: 12px; text-transform: uppercase;">Your Code</p>
        <p style="color: {ACCENT_YELLOW}; margin: 0; font-size: 32px; font-family: monospace; font-weight: bold; letter-spacing: 6px; -webkit-user-select: all; -moz-user-select: all; user-select: all; cursor: pointer;">{code}</p>
    </div>
</div>"""


def build_verification_email(name: str, code: str) -> tuple[str, str]:
    """Verification code email for signup / resend code."""
    body = f"""
<h2 style="color: {TEXT_LIGHT}; margin: 0 0 16px 0; font-size: 22px;">Verify Your Email</h2>
<p style="color: {TEXT_MUTED}; margin: 0 0 8px 0; font-size: 15px; line-height: 1.6;">
    Hi{' ' + name if name else ''},
</p>
<p style="color: {TEXT_MUTED}; margin: 0 0 24px 0; font-size: 15px; line-height: 1.6;">
    Welcome to Second Watch Network! Use the code below to verify your email address and complete your registration.
</p>
{_code_box(code)}
<p style="color: #666; margin: 24px 0 0 0; font-size: 13px;">
    This code expires in 24 hours. If you didn't create an account, you can safely ignore this email.
</p>"""

    subject = "Verify Your Email — Second Watch Network"
    return subject, _base_template("Verify Your Email", body)


def build_password_reset_email(name: str, code: str) -> tuple[str, str]:
    """Password reset code email."""
    body = f"""
<h2 style="color: {TEXT_LIGHT}; margin: 0 0 16px 0; font-size: 22px;">Reset Your Password</h2>
<p style="color: {TEXT_MUTED}; margin: 0 0 8px 0; font-size: 15px; line-height: 1.6;">
    Hi{' ' + name if name else ''},
</p>
<p style="color: {TEXT_MUTED}; margin: 0 0 24px 0; font-size: 15px; line-height: 1.6;">
    We received a request to reset your password. Use the code below to proceed.
</p>
{_code_box(code)}
<div style="background-color: #3a3a2a; padding: 12px; border-radius: 8px; margin-top: 16px; border-left: 4px solid #fbbf24;">
    <p style="color: #fbbf24; margin: 0; font-size: 13px;">
        <strong>Security Notice:</strong> If you did not request a password reset, please ignore this email. Your password will remain unchanged.
    </p>
</div>"""

    subject = "Password Reset — Second Watch Network"
    return subject, _base_template("Reset Your Password", body)


def build_generic_code_email(name: str, code: str) -> tuple[str, str]:
    """Fallback template for any other Cognito code email."""
    body = f"""
<h2 style="color: {TEXT_LIGHT}; margin: 0 0 16px 0; font-size: 22px;">Your Verification Code</h2>
<p style="color: {TEXT_MUTED}; margin: 0 0 8px 0; font-size: 15px; line-height: 1.6;">
    Hi{' ' + name if name else ''},
</p>
<p style="color: {TEXT_MUTED}; margin: 0 0 24px 0; font-size: 15px; line-height: 1.6;">
    Here is your verification code for Second Watch Network:
</p>
{_code_box(code)}
<p style="color: #666; margin: 24px 0 0 0; font-size: 13px;">
    If you didn't request this code, you can safely ignore this email.
</p>"""

    subject = "Your Code — Second Watch Network"
    return subject, _base_template("Verification Code", body)
