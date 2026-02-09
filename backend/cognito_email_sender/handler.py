"""
Cognito Custom Email Sender Lambda

Intercepts Cognito verification/password-reset events, decrypts the code
using AWS Encryption SDK + KMS, and sends SWN-branded emails via Resend.

Environment variables:
  - RESEND_API_KEY: Resend API key
  - KMS_KEY_ARN: KMS key ARN for decrypting Cognito codes
  - EMAIL_FROM_ADDRESS: From address (default: noreply@secondwatch.network)
  - EMAIL_FROM_NAME: From display name (default: Second Watch Network)
"""
import os
import json
import base64
import logging

import resend
import boto3
from aws_encryption_sdk import CommitmentPolicy, EncryptionSDKClient
from aws_encryption_sdk.key_providers.kms import KMSMasterKeyProvider

from templates import (
    build_verification_email,
    build_password_reset_email,
    build_generic_code_email,
)

logger = logging.getLogger()
logger.setLevel(logging.INFO)

# ---------- Configuration ----------

RESEND_API_KEY = os.environ.get("RESEND_API_KEY", "")
KMS_KEY_ARN = os.environ.get("KMS_KEY_ARN", "")
FROM_ADDRESS = os.environ.get("EMAIL_FROM_ADDRESS", "noreply@secondwatch.network")
FROM_NAME = os.environ.get("EMAIL_FROM_NAME", "Second Watch Network")

# Initialise Encryption SDK client (module-level for Lambda warm starts)
_enc_client = EncryptionSDKClient(commitment_policy=CommitmentPolicy.REQUIRE_ENCRYPT_ALLOW_DECRYPT)
_kms_provider = KMSMasterKeyProvider(key_ids=[KMS_KEY_ARN]) if KMS_KEY_ARN else None

# Trigger → template mapping
SIGNUP_TRIGGERS = {
    "CustomEmailSender_SignUp",
    "CustomEmailSender_ResendCode",
    "CustomEmailSender_VerifyUserAttribute",
}
FORGOT_TRIGGERS = {
    "CustomEmailSender_ForgotPassword",
}
SKIP_TRIGGERS = {
    "CustomEmailSender_AdminCreateUser",  # Handled via welcome email in cognito.py
}


def _decrypt_code(encrypted_code: str) -> str:
    """Decrypt the Cognito-encrypted verification code using KMS."""
    if not _kms_provider:
        raise RuntimeError("KMS_KEY_ARN not configured — cannot decrypt code")

    cipher_blob = base64.b64decode(encrypted_code)
    plaintext, _ = _enc_client.decrypt(source=cipher_blob, key_provider=_kms_provider)
    return plaintext.decode("utf-8")


def _get_user_name(request: dict) -> str:
    """Extract a display name from the Cognito event userAttributes."""
    attrs = request.get("userAttributes", {})
    given = attrs.get("given_name", "")
    family = attrs.get("family_name", "")
    name = f"{given} {family}".strip()
    if not name:
        name = attrs.get("name", "")
    if not name:
        name = attrs.get("email", "").split("@")[0]
    return name


def handler(event, context):
    """Lambda entry point for Cognito CustomEmailSender triggers."""
    trigger = event.get("triggerSource", "")
    logger.info("Cognito email trigger: %s", trigger)

    # Skip triggers we don't handle
    if trigger in SKIP_TRIGGERS:
        logger.info("Skipping trigger %s (handled elsewhere)", trigger)
        return event

    if not trigger.startswith("CustomEmailSender_"):
        logger.warning("Unexpected trigger source: %s", trigger)
        return event

    # Extract request data
    request = event.get("request", {})
    encrypted_code = request.get("code", "")
    if not encrypted_code:
        logger.error("No code in event request")
        return event

    # Decrypt the code
    try:
        code = _decrypt_code(encrypted_code)
    except Exception as e:
        logger.error("Failed to decrypt code: %s", e)
        return event

    # Get user info
    name = _get_user_name(request)

    # Select template
    if trigger in SIGNUP_TRIGGERS:
        subject, html = build_verification_email(name, code)
    elif trigger in FORGOT_TRIGGERS:
        subject, html = build_password_reset_email(name, code)
    else:
        subject, html = build_generic_code_email(name, code)

    # Get recipient email
    user_attrs = request.get("userAttributes", {})
    to_email = user_attrs.get("email", "")
    if not to_email:
        logger.error("No email in userAttributes")
        return event

    # Send via Resend
    try:
        resend.api_key = RESEND_API_KEY
        result = resend.Emails.send({
            "from": f"{FROM_NAME} <{FROM_ADDRESS}>",
            "to": [to_email],
            "subject": subject,
            "html": html,
        })
        logger.info("Email sent to %s via Resend (id=%s)", to_email, result.get("id"))
    except Exception as e:
        logger.error("Failed to send email via Resend: %s", e)

    return event
