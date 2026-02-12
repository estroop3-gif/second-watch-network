"""
AWS Cognito Authentication Module

Replaces Supabase Auth with Cognito for user authentication.
"""

import os
import hmac
import hashlib
import base64
from typing import Optional, Dict, Any
from datetime import datetime

import boto3
from botocore.exceptions import ClientError
import jwt
from jwt import PyJWKClient
from fastapi import HTTPException, Header, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

from app.core.config import settings


# Cognito Configuration
AWS_REGION = getattr(settings, 'AWS_REGION', None) or os.getenv('AWS_REGION', 'us-east-1')
COGNITO_USER_POOL_ID = os.getenv('COGNITO_USER_POOL_ID', 'us-east-1_AHpHN53Sf')
COGNITO_CLIENT_ID = os.getenv('COGNITO_CLIENT_ID', '3fu74m33djivmn0atrbmr4i6p7')
COGNITO_CLIENT_SECRET = os.getenv('COGNITO_CLIENT_SECRET', None)  # Optional

# Cognito endpoints
COGNITO_ISSUER = f"https://cognito-idp.{AWS_REGION}.amazonaws.com/{COGNITO_USER_POOL_ID}"
COGNITO_JWKS_URL = f"{COGNITO_ISSUER}/.well-known/jwks.json"

# Cognito client
cognito_client = boto3.client(
    'cognito-idp',
    region_name=AWS_REGION,
    aws_access_key_id=os.getenv('AWS_ACCESS_KEY_ID'),
    aws_secret_access_key=os.getenv('AWS_SECRET_ACCESS_KEY')
)

# JWT token verification
security = HTTPBearer(auto_error=False)

# JWKS client for token verification
try:
    jwks_client = PyJWKClient(COGNITO_JWKS_URL)
except Exception:
    jwks_client = None


def get_secret_hash(username: str) -> Optional[str]:
    """
    Generate secret hash for Cognito (required if client has a secret).
    """
    if not COGNITO_CLIENT_SECRET:
        return None

    message = username + COGNITO_CLIENT_ID
    dig = hmac.new(
        COGNITO_CLIENT_SECRET.encode('utf-8'),
        message.encode('utf-8'),
        hashlib.sha256
    ).digest()
    return base64.b64encode(dig).decode()


class CognitoAuth:
    """
    Cognito authentication service.
    """

    @staticmethod
    def sign_up(
        email: str,
        password: str,
        name: str = None,
        additional_attributes: dict = None
    ) -> Dict[str, Any]:
        """
        Register a new user with Cognito.
        """
        try:
            user_attributes = [
                {'Name': 'email', 'Value': email},
            ]
            if name:
                user_attributes.append({'Name': 'name', 'Value': name})

            if additional_attributes:
                for key, value in additional_attributes.items():
                    user_attributes.append({'Name': key, 'Value': str(value)})

            params = {
                'ClientId': COGNITO_CLIENT_ID,
                'Username': email,
                'Password': password,
                'UserAttributes': user_attributes,
            }

            secret_hash = get_secret_hash(email)
            if secret_hash:
                params['SecretHash'] = secret_hash

            response = cognito_client.sign_up(**params)

            return {
                'user': {
                    'id': response['UserSub'],
                    'email': email,
                    'confirmed': response.get('UserConfirmed', False),
                },
                'error': None
            }

        except ClientError as e:
            error_code = e.response['Error']['Code']
            error_message = e.response['Error']['Message']

            if error_code == 'UsernameExistsException':
                return {'user': None, 'error': {'message': 'User already exists'}}
            elif error_code == 'InvalidPasswordException':
                return {'user': None, 'error': {'message': error_message}}
            else:
                return {'user': None, 'error': {'message': error_message}}

    @staticmethod
    def confirm_sign_up(email: str, confirmation_code: str) -> Dict[str, Any]:
        """
        Confirm user registration with verification code.
        """
        try:
            params = {
                'ClientId': COGNITO_CLIENT_ID,
                'Username': email,
                'ConfirmationCode': confirmation_code,
            }

            secret_hash = get_secret_hash(email)
            if secret_hash:
                params['SecretHash'] = secret_hash

            cognito_client.confirm_sign_up(**params)

            return {'success': True, 'error': None}

        except ClientError as e:
            return {'success': False, 'error': {'message': e.response['Error']['Message']}}

    @staticmethod
    def resend_confirmation_code(email: str) -> Dict[str, Any]:
        """
        Resend email confirmation code.
        """
        try:
            params = {
                'ClientId': COGNITO_CLIENT_ID,
                'Username': email,
            }

            secret_hash = get_secret_hash(email)
            if secret_hash:
                params['SecretHash'] = secret_hash

            cognito_client.resend_confirmation_code(**params)

            return {'success': True, 'error': None}

        except ClientError as e:
            return {'success': False, 'error': {'message': e.response['Error']['Message']}}

    @staticmethod
    def sign_in(email: str, password: str) -> Dict[str, Any]:
        """
        Sign in a user and return tokens.
        May return a challenge if user needs to change password on first login.
        """
        try:
            params = {
                'AuthFlow': 'USER_PASSWORD_AUTH',
                'ClientId': COGNITO_CLIENT_ID,
                'AuthParameters': {
                    'USERNAME': email,
                    'PASSWORD': password,
                },
            }

            secret_hash = get_secret_hash(email)
            if secret_hash:
                params['AuthParameters']['SECRET_HASH'] = secret_hash

            response = cognito_client.initiate_auth(**params)

            # Check if this is a challenge (e.g., NEW_PASSWORD_REQUIRED)
            if response.get('ChallengeName') == 'NEW_PASSWORD_REQUIRED':
                return {
                    'session': None,
                    'user': None,
                    'challenge': {
                        'name': 'NEW_PASSWORD_REQUIRED',
                        'session': response.get('Session'),
                        'parameters': response.get('ChallengeParameters', {}),
                    },
                    'error': None
                }

            auth_result = response.get('AuthenticationResult', {})

            return {
                'session': {
                    'access_token': auth_result.get('AccessToken'),
                    'refresh_token': auth_result.get('RefreshToken'),
                    'id_token': auth_result.get('IdToken'),
                    'expires_in': auth_result.get('ExpiresIn'),
                    'token_type': auth_result.get('TokenType', 'Bearer'),
                },
                'user': CognitoAuth.get_user_from_token(auth_result.get('AccessToken')),
                'error': None
            }

        except ClientError as e:
            error_code = e.response['Error']['Code']
            error_message = e.response['Error']['Message']

            if error_code == 'NotAuthorizedException':
                # Cognito uses NotAuthorizedException for multiple cases
                msg_lower = error_message.lower()
                if 'password attempts exceeded' in msg_lower:
                    return {'session': None, 'user': None, 'error': {'code': 'too_many_attempts', 'message': 'Too many failed attempts. Please wait a few minutes and try again.'}}
                if 'user is disabled' in msg_lower or 'disabled' in msg_lower:
                    return {'session': None, 'user': None, 'error': {'code': 'user_disabled', 'message': 'This account has been disabled. Please contact support.'}}
                return {'session': None, 'user': None, 'error': {'code': 'invalid_credentials', 'message': 'Invalid email or password'}}
            elif error_code == 'UserNotConfirmedException':
                return {'session': None, 'user': None, 'error': {'code': 'email_not_confirmed', 'message': 'Please verify your email before signing in.'}}
            elif error_code == 'PasswordResetRequiredException':
                return {'session': None, 'user': None, 'error': {'code': 'password_reset_required', 'message': 'A password reset is required. Please use "Forgot password" to reset your password.'}}
            elif error_code == 'UserNotFoundException':
                return {'session': None, 'user': None, 'error': {'code': 'invalid_credentials', 'message': 'Invalid email or password'}}
            elif error_code == 'TooManyRequestsException':
                return {'session': None, 'user': None, 'error': {'code': 'too_many_requests', 'message': 'Too many requests. Please wait a moment and try again.'}}
            else:
                return {'session': None, 'user': None, 'error': {'code': 'unknown', 'message': error_message}}

    @staticmethod
    def respond_to_new_password_challenge(
        email: str,
        new_password: str,
        session: str
    ) -> Dict[str, Any]:
        """
        Respond to NEW_PASSWORD_REQUIRED challenge with new password.
        """
        try:
            params = {
                'ChallengeName': 'NEW_PASSWORD_REQUIRED',
                'ClientId': COGNITO_CLIENT_ID,
                'ChallengeResponses': {
                    'USERNAME': email,
                    'NEW_PASSWORD': new_password,
                },
                'Session': session,
            }

            secret_hash = get_secret_hash(email)
            if secret_hash:
                params['ChallengeResponses']['SECRET_HASH'] = secret_hash

            response = cognito_client.respond_to_auth_challenge(**params)

            auth_result = response.get('AuthenticationResult', {})

            return {
                'session': {
                    'access_token': auth_result.get('AccessToken'),
                    'refresh_token': auth_result.get('RefreshToken'),
                    'id_token': auth_result.get('IdToken'),
                    'expires_in': auth_result.get('ExpiresIn'),
                    'token_type': auth_result.get('TokenType', 'Bearer'),
                },
                'user': CognitoAuth.get_user_from_token(auth_result.get('AccessToken')),
                'error': None
            }

        except ClientError as e:
            error_code = e.response['Error']['Code']
            error_message = e.response['Error']['Message']

            if error_code == 'InvalidPasswordException':
                return {'session': None, 'user': None, 'error': {'message': error_message}}
            else:
                return {'session': None, 'user': None, 'error': {'message': error_message}}

    @staticmethod
    def sign_out(access_token: str) -> Dict[str, Any]:
        """
        Sign out a user (invalidate tokens).
        """
        try:
            cognito_client.global_sign_out(AccessToken=access_token)
            return {'success': True, 'error': None}
        except ClientError as e:
            return {'success': False, 'error': {'message': e.response['Error']['Message']}}

    @staticmethod
    def refresh_token(refresh_token: str, email: str = None) -> Dict[str, Any]:
        """
        Refresh access token using refresh token.
        """
        try:
            params = {
                'AuthFlow': 'REFRESH_TOKEN_AUTH',
                'ClientId': COGNITO_CLIENT_ID,
                'AuthParameters': {
                    'REFRESH_TOKEN': refresh_token,
                },
            }

            if email:
                secret_hash = get_secret_hash(email)
                if secret_hash:
                    params['AuthParameters']['SECRET_HASH'] = secret_hash

            response = cognito_client.initiate_auth(**params)
            auth_result = response.get('AuthenticationResult', {})

            return {
                'session': {
                    'access_token': auth_result.get('AccessToken'),
                    'id_token': auth_result.get('IdToken'),
                    'expires_in': auth_result.get('ExpiresIn'),
                    'token_type': auth_result.get('TokenType', 'Bearer'),
                },
                'error': None
            }

        except ClientError as e:
            return {'session': None, 'error': {'message': e.response['Error']['Message']}}

    @staticmethod
    def get_user_from_token(access_token: str) -> Optional[Dict[str, Any]]:
        """
        Get user info from access token.
        """
        try:
            response = cognito_client.get_user(AccessToken=access_token)

            user_attributes = {}
            for attr in response.get('UserAttributes', []):
                user_attributes[attr['Name']] = attr['Value']

            return {
                'id': user_attributes.get('sub'),
                'email': user_attributes.get('email'),
                'name': user_attributes.get('name'),
                'email_verified': user_attributes.get('email_verified') == 'true',
                'username': response.get('Username'),
            }

        except ClientError:
            return None

    @staticmethod
    def verify_token(token: str) -> Optional[Dict[str, Any]]:
        """
        Verify a JWT token and return the claims.
        """
        try:
            if not jwks_client:
                # Fallback: verify with Cognito directly
                print("[COGNITO] No JWKS client, falling back to direct verification")
                return CognitoAuth.get_user_from_token(token)

            signing_key = jwks_client.get_signing_key_from_jwt(token)

            # Access tokens don't have 'aud' claim, only 'client_id'
            # We need to verify without audience and manually check client_id
            claims = jwt.decode(
                token,
                signing_key.key,
                algorithms=['RS256'],
                issuer=COGNITO_ISSUER,
                options={"verify_aud": False}
            )

            # Verify client_id for access tokens
            if claims.get('client_id') != COGNITO_CLIENT_ID:
                print(f"[COGNITO] Client ID mismatch: {claims.get('client_id')} != {COGNITO_CLIENT_ID}")
                return None

            return {
                'id': claims.get('sub'),
                'email': claims.get('email'),
                'username': claims.get('cognito:username'),
                'token_use': claims.get('token_use'),
            }

        except jwt.ExpiredSignatureError:
            print("[COGNITO] Token expired")
            return None
        except jwt.InvalidTokenError as e:
            print(f"[COGNITO] Invalid token: {e}")
            return None
        except Exception as e:
            # Fallback to direct verification
            print(f"[COGNITO] Exception {type(e).__name__}: {e}, trying fallback")
            return CognitoAuth.get_user_from_token(token)

    @staticmethod
    def forgot_password(email: str) -> Dict[str, Any]:
        """
        Initiate forgot password flow.
        """
        try:
            params = {
                'ClientId': COGNITO_CLIENT_ID,
                'Username': email,
            }

            secret_hash = get_secret_hash(email)
            if secret_hash:
                params['SecretHash'] = secret_hash

            cognito_client.forgot_password(**params)

            return {'success': True, 'error': None}

        except ClientError as e:
            return {'success': False, 'error': {'message': e.response['Error']['Message']}}

    @staticmethod
    def confirm_forgot_password(
        email: str,
        confirmation_code: str,
        new_password: str
    ) -> Dict[str, Any]:
        """
        Confirm forgot password with code and set new password.
        """
        try:
            params = {
                'ClientId': COGNITO_CLIENT_ID,
                'Username': email,
                'ConfirmationCode': confirmation_code,
                'Password': new_password,
            }

            secret_hash = get_secret_hash(email)
            if secret_hash:
                params['SecretHash'] = secret_hash

            cognito_client.confirm_forgot_password(**params)

            return {'success': True, 'error': None}

        except ClientError as e:
            return {'success': False, 'error': {'message': e.response['Error']['Message']}}

    @staticmethod
    def change_password(
        access_token: str,
        old_password: str,
        new_password: str
    ) -> Dict[str, Any]:
        """
        Change user password.
        """
        try:
            cognito_client.change_password(
                PreviousPassword=old_password,
                ProposedPassword=new_password,
                AccessToken=access_token
            )

            return {'success': True, 'error': None}

        except ClientError as e:
            return {'success': False, 'error': {'message': e.response['Error']['Message']}}

    @staticmethod
    def update_user_attributes(
        access_token: str,
        attributes: Dict[str, str]
    ) -> Dict[str, Any]:
        """
        Update user attributes.
        """
        try:
            user_attributes = [
                {'Name': key, 'Value': value}
                for key, value in attributes.items()
            ]

            cognito_client.update_user_attributes(
                UserAttributes=user_attributes,
                AccessToken=access_token
            )

            return {'success': True, 'error': None}

        except ClientError as e:
            return {'success': False, 'error': {'message': e.response['Error']['Message']}}

    @staticmethod
    def delete_user(access_token: str) -> Dict[str, Any]:
        """
        Delete user account.
        """
        try:
            cognito_client.delete_user(AccessToken=access_token)
            return {'success': True, 'error': None}
        except ClientError as e:
            return {'success': False, 'error': {'message': e.response['Error']['Message']}}

    @staticmethod
    def admin_create_user(
        email: str,
        temporary_password: str = None,
        name: str = None
    ) -> Dict[str, Any]:
        """
        Admin: Create a user (requires admin credentials).
        """
        try:
            user_attributes = [
                {'Name': 'email', 'Value': email},
                {'Name': 'email_verified', 'Value': 'true'},
            ]
            if name:
                user_attributes.append({'Name': 'name', 'Value': name})

            params = {
                'UserPoolId': COGNITO_USER_POOL_ID,
                'Username': email,
                'UserAttributes': user_attributes,
                'MessageAction': 'SUPPRESS',  # Don't send Cognito's default email - we send our own
            }

            if temporary_password:
                params['TemporaryPassword'] = temporary_password

            response = cognito_client.admin_create_user(**params)

            return {
                'user': {
                    'id': next(
                        (attr['Value'] for attr in response['User']['Attributes'] if attr['Name'] == 'sub'),
                        None
                    ),
                    'email': email,
                    'status': response['User']['UserStatus'],
                },
                'error': None
            }

        except ClientError as e:
            return {'user': None, 'error': {'message': e.response['Error']['Message']}}

    @staticmethod
    def admin_get_user(email: str) -> Optional[Dict[str, Any]]:
        """
        Admin: Get user by email.
        """
        try:
            response = cognito_client.admin_get_user(
                UserPoolId=COGNITO_USER_POOL_ID,
                Username=email
            )

            user_attributes = {}
            for attr in response.get('UserAttributes', []):
                user_attributes[attr['Name']] = attr['Value']

            return {
                'id': user_attributes.get('sub'),
                'email': user_attributes.get('email'),
                'name': user_attributes.get('name'),
                'status': response.get('UserStatus'),
                'email_verified': user_attributes.get('email_verified') == 'true',
                'created_at': response.get('UserCreateDate'),
            }

        except ClientError:
            return None

    @staticmethod
    def admin_delete_user(email: str) -> Dict[str, Any]:
        """
        Admin: Delete a user from Cognito.
        """
        try:
            cognito_client.admin_delete_user(
                UserPoolId=COGNITO_USER_POOL_ID,
                Username=email
            )
            return {'success': True, 'error': None}
        except ClientError as e:
            return {'success': False, 'error': {'message': e.response['Error']['Message']}}

    @staticmethod
    def admin_reset_password(email: str) -> Dict[str, Any]:
        """
        Admin: Reset a user's password (sends reset email).
        """
        try:
            cognito_client.admin_reset_user_password(
                UserPoolId=COGNITO_USER_POOL_ID,
                Username=email
            )
            return {'success': True, 'error': None}
        except ClientError as e:
            return {'success': False, 'error': {'message': e.response['Error']['Message']}}


# FastAPI dependency for getting current user
async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    authorization: str = Header(None)
) -> Dict[str, Any]:
    """
    FastAPI dependency to get the current authenticated user.
    """
    token = None

    if credentials:
        token = credentials.credentials
    elif authorization:
        if authorization.startswith('Bearer '):
            token = authorization[7:]
        else:
            token = authorization

    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")

    user = CognitoAuth.verify_token(token)
    if not user:
        raise HTTPException(status_code=401, detail="Invalid or expired token")

    return user


async def get_optional_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    authorization: str = Header(None)
) -> Optional[Dict[str, Any]]:
    """
    FastAPI dependency to optionally get the current user (no error if not authenticated).
    """
    try:
        return await get_current_user(credentials, authorization)
    except HTTPException:
        return None


# Global auth instance
cognito_auth = CognitoAuth()
