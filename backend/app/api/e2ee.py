"""
End-to-End Encryption API Routes
Implements Signal Protocol-style key management for E2EE direct messages
"""
from fastapi import APIRouter, HTTPException
from typing import List, Optional
from pydantic import BaseModel
from datetime import datetime, timezone
from app.core.database import get_client
import logging

logger = logging.getLogger(__name__)
router = APIRouter()


# ============================================================================
# SCHEMAS
# ============================================================================

class IdentityKeyUpload(BaseModel):
    """Upload identity key and registration ID"""
    public_key: str  # Base64 encoded public identity key
    registration_id: int  # Random 32-bit integer


class SignedPreKeyUpload(BaseModel):
    """Upload signed prekey"""
    key_id: int
    public_key: str  # Base64 encoded
    signature: str  # Base64 encoded signature


class OneTimePreKeyUpload(BaseModel):
    """Upload one-time prekey"""
    key_id: int
    public_key: str  # Base64 encoded


class PreKeyBundleUpload(BaseModel):
    """Full key bundle upload for registration"""
    identity_key: IdentityKeyUpload
    signed_prekey: SignedPreKeyUpload
    one_time_prekeys: List[OneTimePreKeyUpload]


class PreKeyBundle(BaseModel):
    """Key bundle returned for initiating a session"""
    user_id: str
    registration_id: int
    identity_key: str
    signed_prekey_id: int
    signed_prekey: str
    signed_prekey_signature: str
    one_time_prekey_id: Optional[int] = None
    one_time_prekey: Optional[str] = None


class KeyBackupUpload(BaseModel):
    """Encrypted key backup for recovery"""
    encrypted_data: str  # AES-256-GCM encrypted private keys
    salt: str  # PBKDF2 salt (base64)
    iv: str  # AES-GCM IV (base64)


class KeyBackup(BaseModel):
    """Key backup retrieval"""
    encrypted_data: str
    salt: str
    iv: str
    version: int


# ============================================================================
# KEY REGISTRATION
# ============================================================================

@router.post("/keys/register")
async def register_key_bundle(bundle: PreKeyBundleUpload, user_id: str):
    """
    Register a user's E2EE key bundle.
    Called when user first sets up E2EE or rotates their identity.
    """
    try:
        client = get_client()

        # Upsert identity key
        client.table("e2ee_identity_keys").upsert({
            "user_id": user_id,
            "public_key": bundle.identity_key.public_key,
            "registration_id": bundle.identity_key.registration_id,
            "created_at": datetime.now(timezone.utc).isoformat()
        }, on_conflict="user_id").execute()

        # Deactivate old signed prekeys
        client.table("e2ee_signed_prekeys").update({
            "is_active": False
        }).eq("user_id", user_id).execute()

        # Insert new signed prekey
        client.table("e2ee_signed_prekeys").insert({
            "user_id": user_id,
            "key_id": bundle.signed_prekey.key_id,
            "public_key": bundle.signed_prekey.public_key,
            "signature": bundle.signed_prekey.signature,
            "is_active": True
        }).execute()

        # Insert one-time prekeys
        if bundle.one_time_prekeys:
            prekeys_data = [{
                "user_id": user_id,
                "key_id": pk.key_id,
                "public_key": pk.public_key,
                "is_used": False
            } for pk in bundle.one_time_prekeys]
            client.table("e2ee_one_time_prekeys").insert(prekeys_data).execute()

        return {"status": "ok", "message": "Key bundle registered"}

    except Exception as e:
        logger.error(f"Error registering key bundle: {e}")
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/keys/prekeys")
async def upload_prekeys(prekeys: List[OneTimePreKeyUpload], user_id: str):
    """
    Upload additional one-time prekeys.
    Called when the server runs low on available prekeys.
    """
    try:
        client = get_client()

        prekeys_data = [{
            "user_id": user_id,
            "key_id": pk.key_id,
            "public_key": pk.public_key,
            "is_used": False
        } for pk in prekeys]

        client.table("e2ee_one_time_prekeys").insert(prekeys_data).execute()

        return {"status": "ok", "count": len(prekeys)}

    except Exception as e:
        logger.error(f"Error uploading prekeys: {e}")
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/keys/prekey-count")
async def get_prekey_count(user_id: str):
    """Get count of available one-time prekeys for a user."""
    try:
        client = get_client()

        response = client.table("e2ee_one_time_prekeys").select(
            "id", count="exact"
        ).eq("user_id", user_id).eq("is_used", False).execute()

        return {"count": response.count or 0}

    except Exception as e:
        logger.error(f"Error getting prekey count: {e}")
        raise HTTPException(status_code=400, detail=str(e))


# ============================================================================
# KEY RETRIEVAL FOR SESSION ESTABLISHMENT
# ============================================================================

@router.get("/keys/bundle/{target_user_id}", response_model=PreKeyBundle)
async def get_prekey_bundle(target_user_id: str, user_id: str):
    """
    Get a user's prekey bundle for establishing an E2EE session.
    Consumes one one-time prekey if available.
    """
    try:
        client = get_client()

        # Get identity key
        identity_response = client.table("e2ee_identity_keys").select(
            "public_key, registration_id"
        ).eq("user_id", target_user_id).single().execute()

        if not identity_response.data:
            raise HTTPException(
                status_code=404,
                detail="User has not registered E2EE keys"
            )

        # Get active signed prekey
        signed_response = client.table("e2ee_signed_prekeys").select(
            "key_id, public_key, signature"
        ).eq("user_id", target_user_id).eq("is_active", True).single().execute()

        if not signed_response.data:
            raise HTTPException(
                status_code=404,
                detail="User has no active signed prekey"
            )

        # Try to get an unused one-time prekey
        one_time_prekey = None
        one_time_response = client.table("e2ee_one_time_prekeys").select(
            "id, key_id, public_key"
        ).eq("user_id", target_user_id).eq("is_used", False).limit(1).execute()

        if one_time_response.data:
            otpk = one_time_response.data[0]
            one_time_prekey = {
                "id": otpk["key_id"],
                "public_key": otpk["public_key"]
            }
            # Mark the prekey as used
            client.table("e2ee_one_time_prekeys").update({
                "is_used": True,
                "used_at": datetime.now(timezone.utc).isoformat()
            }).eq("id", otpk["id"]).execute()

        # Record session establishment
        client.table("e2ee_sessions").upsert({
            "user_id": user_id,
            "peer_id": target_user_id,
            "is_established": True,
            "last_activity_at": datetime.now(timezone.utc).isoformat()
        }, on_conflict="user_id,peer_id").execute()

        return PreKeyBundle(
            user_id=target_user_id,
            registration_id=identity_response.data["registration_id"],
            identity_key=identity_response.data["public_key"],
            signed_prekey_id=signed_response.data["key_id"],
            signed_prekey=signed_response.data["public_key"],
            signed_prekey_signature=signed_response.data["signature"],
            one_time_prekey_id=one_time_prekey["id"] if one_time_prekey else None,
            one_time_prekey=one_time_prekey["public_key"] if one_time_prekey else None
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting prekey bundle: {e}")
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/keys/has-keys/{target_user_id}")
async def check_user_has_keys(target_user_id: str):
    """Check if a user has registered E2EE keys."""
    try:
        client = get_client()

        response = client.table("e2ee_identity_keys").select(
            "id"
        ).eq("user_id", target_user_id).execute()

        return {"has_keys": len(response.data or []) > 0}

    except Exception as e:
        logger.error(f"Error checking keys: {e}")
        raise HTTPException(status_code=400, detail=str(e))


# ============================================================================
# KEY BACKUP AND RECOVERY
# ============================================================================

@router.post("/keys/backup")
async def upload_key_backup(backup: KeyBackupUpload, user_id: str):
    """
    Upload encrypted key backup for PIN-based recovery.
    The backup is encrypted client-side with a key derived from the user's PIN.
    """
    try:
        client = get_client()

        client.table("e2ee_key_backups").upsert({
            "user_id": user_id,
            "encrypted_data": backup.encrypted_data,
            "salt": backup.salt,
            "iv": backup.iv,
            "version": 1,
            "updated_at": datetime.now(timezone.utc).isoformat()
        }, on_conflict="user_id").execute()

        return {"status": "ok", "message": "Key backup stored"}

    except Exception as e:
        logger.error(f"Error uploading key backup: {e}")
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/keys/backup", response_model=KeyBackup)
async def get_key_backup(user_id: str):
    """
    Retrieve encrypted key backup for PIN-based recovery.
    User will decrypt client-side with their PIN.
    """
    try:
        client = get_client()

        response = client.table("e2ee_key_backups").select(
            "encrypted_data, salt, iv, version"
        ).eq("user_id", user_id).single().execute()

        if not response.data:
            raise HTTPException(status_code=404, detail="No backup found")

        return KeyBackup(**response.data)

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting key backup: {e}")
        raise HTTPException(status_code=400, detail=str(e))


@router.delete("/keys/backup")
async def delete_key_backup(user_id: str):
    """Delete the user's key backup (e.g., when resetting encryption)."""
    try:
        client = get_client()

        client.table("e2ee_key_backups").delete().eq("user_id", user_id).execute()

        return {"status": "ok", "message": "Backup deleted"}

    except Exception as e:
        logger.error(f"Error deleting key backup: {e}")
        raise HTTPException(status_code=400, detail=str(e))


# ============================================================================
# SESSION STATUS
# ============================================================================

@router.get("/sessions/{peer_id}")
async def get_session_status(peer_id: str, user_id: str):
    """Check if an E2EE session exists with a peer."""
    try:
        client = get_client()

        response = client.table("e2ee_sessions").select(
            "is_established, last_activity_at"
        ).eq("user_id", user_id).eq("peer_id", peer_id).execute()

        if response.data:
            return {
                "has_session": response.data[0]["is_established"],
                "last_activity": response.data[0]["last_activity_at"]
            }

        return {"has_session": False, "last_activity": None}

    except Exception as e:
        logger.error(f"Error getting session status: {e}")
        raise HTTPException(status_code=400, detail=str(e))
