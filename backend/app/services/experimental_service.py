"""
Experimental Features Service
Phase 5C: VR/AR metadata and blockchain royalty scaffolding.

These are experimental/placeholder features for future expansion.
Provides scaffolding for:
- Immersive media metadata (VR/AR)
- AR companion content
- Blockchain royalty ledger
- Content NFTs
"""

from typing import Optional, List, Dict, Any
from datetime import datetime, date
import hashlib
import json

from app.core.database import execute_query, execute_single, execute_insert


class ImmersiveContentType:
    VR_180 = "vr_180"
    VR_360 = "vr_360"
    VR_INTERACTIVE = "vr_interactive"
    AR_OVERLAY = "ar_overlay"
    AR_COMPANION = "ar_companion"
    SPATIAL_VIDEO = "spatial_video"
    VOLUMETRIC = "volumetric"


class ExperimentalService:
    """Service for managing experimental features."""

    # ==========================================================================
    # VR/AR Metadata Management
    # ==========================================================================

    @staticmethod
    async def add_immersive_metadata(
        content_type: str,
        video_asset_id: Optional[str] = None,
        episode_id: Optional[str] = None,
        field_of_view_degrees: Optional[int] = None,
        stereo_mode: Optional[str] = None,
        projection_type: Optional[str] = None,
        resolution_width_per_eye: Optional[int] = None,
        resolution_height_per_eye: Optional[int] = None,
        has_spatial_audio: bool = False,
        spatial_audio_format: Optional[str] = None,
        audio_channel_count: Optional[int] = None,
        compatible_devices: Optional[List[str]] = None,
        is_experimental: bool = True
    ) -> Dict[str, Any]:
        """Add immersive media metadata to a video asset or episode."""

        if not video_asset_id and not episode_id:
            return {"success": False, "error": "Must provide video_asset_id or episode_id"}

        metadata = execute_insert("""
            INSERT INTO immersive_media_metadata (
                content_type, video_asset_id, episode_id,
                field_of_view_degrees, stereo_mode, projection_type,
                resolution_width_per_eye, resolution_height_per_eye,
                has_spatial_audio, spatial_audio_format, audio_channel_count,
                compatible_devices, is_experimental, is_active
            ) VALUES (
                :content_type::immersive_content_type, :video_asset_id, :episode_id,
                :field_of_view_degrees, :stereo_mode, :projection_type,
                :resolution_width_per_eye, :resolution_height_per_eye,
                :has_spatial_audio, :spatial_audio_format, :audio_channel_count,
                :compatible_devices::jsonb, :is_experimental, false
            )
            RETURNING *
        """, {
            "content_type": content_type,
            "video_asset_id": video_asset_id,
            "episode_id": episode_id,
            "field_of_view_degrees": field_of_view_degrees,
            "stereo_mode": stereo_mode,
            "projection_type": projection_type,
            "resolution_width_per_eye": resolution_width_per_eye,
            "resolution_height_per_eye": resolution_height_per_eye,
            "has_spatial_audio": has_spatial_audio,
            "spatial_audio_format": spatial_audio_format,
            "audio_channel_count": audio_channel_count,
            "compatible_devices": json.dumps(compatible_devices or []),
            "is_experimental": is_experimental
        })

        return {"success": True, "metadata": dict(metadata)}

    @staticmethod
    async def get_immersive_metadata(
        video_asset_id: Optional[str] = None,
        episode_id: Optional[str] = None
    ) -> Optional[Dict[str, Any]]:
        """Get immersive metadata for a video asset or episode."""
        if video_asset_id:
            metadata = execute_single("""
                SELECT * FROM immersive_media_metadata
                WHERE video_asset_id = :id AND is_active = true
            """, {"id": video_asset_id})
        elif episode_id:
            metadata = execute_single("""
                SELECT * FROM immersive_media_metadata
                WHERE episode_id = :id AND is_active = true
            """, {"id": episode_id})
        else:
            return None

        return dict(metadata) if metadata else None

    @staticmethod
    async def update_immersive_metadata(
        metadata_id: str,
        **kwargs
    ) -> Dict[str, Any]:
        """Update immersive metadata."""
        allowed_fields = [
            "field_of_view_degrees", "stereo_mode", "projection_type",
            "resolution_width_per_eye", "resolution_height_per_eye",
            "has_spatial_audio", "spatial_audio_format", "audio_channel_count",
            "interaction_zones", "ar_anchor_type", "ar_reference_image_url",
            "ar_scale_meters", "volumetric_format", "volumetric_mesh_url",
            "compatible_devices", "minimum_device_specs", "is_active"
        ]

        updates = {k: v for k, v in kwargs.items() if k in allowed_fields and v is not None}

        if not updates:
            return {"success": False, "error": "No valid updates provided"}

        set_clauses = ", ".join([f"{k} = :{k}" for k in updates.keys()])
        updates["metadata_id"] = metadata_id

        execute_query(f"""
            UPDATE immersive_media_metadata
            SET {set_clauses}, updated_at = NOW()
            WHERE id = :metadata_id
        """, updates)

        return {"success": True}

    # ==========================================================================
    # AR Companion Content
    # ==========================================================================

    @staticmethod
    async def add_ar_companion_content(
        episode_id: str,
        trigger_type: str,
        content_type: str,
        content_title: Optional[str] = None,
        content_description: Optional[str] = None,
        trigger_timestamp_ms: Optional[int] = None,
        scene_identifier: Optional[str] = None,
        model_url: Optional[str] = None,
        model_format: Optional[str] = None,
        model_scale: float = 1.0,
        card_image_url: Optional[str] = None,
        card_body_text: Optional[str] = None,
        card_link_url: Optional[str] = None,
        display_duration_seconds: int = 30,
        auto_dismiss: bool = True
    ) -> Dict[str, Any]:
        """Add AR companion content triggered during episode playback."""

        content = execute_insert("""
            INSERT INTO ar_companion_content (
                episode_id, trigger_type, trigger_timestamp_ms, scene_identifier,
                content_type, content_title, content_description,
                model_url, model_format, model_scale,
                card_image_url, card_body_text, card_link_url,
                display_duration_seconds, auto_dismiss
            ) VALUES (
                :episode_id, :trigger_type, :trigger_timestamp_ms, :scene_identifier,
                :content_type, :content_title, :content_description,
                :model_url, :model_format, :model_scale,
                :card_image_url, :card_body_text, :card_link_url,
                :display_duration_seconds, :auto_dismiss
            )
            RETURNING *
        """, {
            "episode_id": episode_id,
            "trigger_type": trigger_type,
            "trigger_timestamp_ms": trigger_timestamp_ms,
            "scene_identifier": scene_identifier,
            "content_type": content_type,
            "content_title": content_title,
            "content_description": content_description,
            "model_url": model_url,
            "model_format": model_format,
            "model_scale": model_scale,
            "card_image_url": card_image_url,
            "card_body_text": card_body_text,
            "card_link_url": card_link_url,
            "display_duration_seconds": display_duration_seconds,
            "auto_dismiss": auto_dismiss
        })

        return {"success": True, "content": dict(content)}

    @staticmethod
    async def get_ar_content_for_episode(episode_id: str) -> List[Dict[str, Any]]:
        """Get all AR companion content for an episode."""
        content = execute_query("""
            SELECT * FROM ar_companion_content
            WHERE episode_id = :episode_id AND is_active = true
            ORDER BY trigger_timestamp_ms NULLS LAST
        """, {"episode_id": episode_id})

        return [dict(c) for c in content]

    @staticmethod
    async def get_ar_content_at_timestamp(
        episode_id: str,
        timestamp_ms: int,
        tolerance_ms: int = 1000
    ) -> List[Dict[str, Any]]:
        """Get AR content triggered near a specific timestamp."""
        content = execute_query("""
            SELECT * FROM ar_companion_content
            WHERE episode_id = :episode_id
              AND is_active = true
              AND trigger_type = 'timestamp'
              AND trigger_timestamp_ms BETWEEN :start_ms AND :end_ms
            ORDER BY trigger_timestamp_ms
        """, {
            "episode_id": episode_id,
            "start_ms": timestamp_ms - tolerance_ms,
            "end_ms": timestamp_ms + tolerance_ms
        })

        return [dict(c) for c in content]

    # ==========================================================================
    # Blockchain Settings
    # ==========================================================================

    @staticmethod
    async def get_blockchain_settings(
        profile_id: Optional[str] = None,
        organization_id: Optional[str] = None
    ) -> Optional[Dict[str, Any]]:
        """Get blockchain settings for a creator or organization."""
        if profile_id:
            settings = execute_single("""
                SELECT * FROM creator_blockchain_settings
                WHERE profile_id = :id
            """, {"id": profile_id})
        elif organization_id:
            settings = execute_single("""
                SELECT * FROM creator_blockchain_settings
                WHERE organization_id = :id
            """, {"id": organization_id})
        else:
            return None

        return dict(settings) if settings else None

    @staticmethod
    async def enable_blockchain_tracking(
        profile_id: Optional[str] = None,
        organization_id: Optional[str] = None,
        wallet_address: Optional[str] = None,
        wallet_chain: str = "polygon",
        log_all_earnings: bool = True,
        log_distributions: bool = True,
        public_ledger_visibility: str = "anonymous"
    ) -> Dict[str, Any]:
        """Enable blockchain royalty tracking (opt-in)."""

        if not profile_id and not organization_id:
            return {"success": False, "error": "Must provide profile_id or organization_id"}

        # Check if settings already exist
        existing = await ExperimentalService.get_blockchain_settings(
            profile_id=profile_id,
            organization_id=organization_id
        )

        if existing:
            # Update existing
            execute_query("""
                UPDATE creator_blockchain_settings
                SET
                    is_enabled = true,
                    opted_in_at = NOW(),
                    opted_out_at = NULL,
                    wallet_address = COALESCE(:wallet_address, wallet_address),
                    wallet_chain = :wallet_chain,
                    log_all_earnings = :log_all_earnings,
                    log_distributions = :log_distributions,
                    public_ledger_visibility = :public_ledger_visibility,
                    updated_at = NOW()
                WHERE id = :id
            """, {
                "id": existing["id"],
                "wallet_address": wallet_address,
                "wallet_chain": wallet_chain,
                "log_all_earnings": log_all_earnings,
                "log_distributions": log_distributions,
                "public_ledger_visibility": public_ledger_visibility
            })
            return {"success": True, "message": "Blockchain tracking enabled"}

        # Create new settings
        settings = execute_insert("""
            INSERT INTO creator_blockchain_settings (
                profile_id, organization_id, is_enabled, opted_in_at,
                wallet_address, wallet_chain,
                log_all_earnings, log_distributions, public_ledger_visibility
            ) VALUES (
                :profile_id, :organization_id, true, NOW(),
                :wallet_address, :wallet_chain,
                :log_all_earnings, :log_distributions, :public_ledger_visibility
            )
            RETURNING *
        """, {
            "profile_id": profile_id,
            "organization_id": organization_id,
            "wallet_address": wallet_address,
            "wallet_chain": wallet_chain,
            "log_all_earnings": log_all_earnings,
            "log_distributions": log_distributions,
            "public_ledger_visibility": public_ledger_visibility
        })

        return {"success": True, "settings": dict(settings)}

    @staticmethod
    async def disable_blockchain_tracking(
        profile_id: Optional[str] = None,
        organization_id: Optional[str] = None
    ) -> Dict[str, Any]:
        """Disable blockchain royalty tracking (opt-out)."""
        if profile_id:
            execute_query("""
                UPDATE creator_blockchain_settings
                SET is_enabled = false, opted_out_at = NOW(), updated_at = NOW()
                WHERE profile_id = :id
            """, {"id": profile_id})
        elif organization_id:
            execute_query("""
                UPDATE creator_blockchain_settings
                SET is_enabled = false, opted_out_at = NOW(), updated_at = NOW()
                WHERE organization_id = :id
            """, {"id": organization_id})
        else:
            return {"success": False, "error": "Must provide profile_id or organization_id"}

        return {"success": True}

    @staticmethod
    async def verify_wallet(
        settings_id: str,
        wallet_address: str
    ) -> Dict[str, Any]:
        """Mark a wallet as verified (after signature verification)."""
        execute_query("""
            UPDATE creator_blockchain_settings
            SET
                wallet_address = :wallet_address,
                wallet_verified = true,
                wallet_verified_at = NOW(),
                updated_at = NOW()
            WHERE id = :id
        """, {"id": settings_id, "wallet_address": wallet_address})

        return {"success": True}

    # ==========================================================================
    # Blockchain Ledger
    # ==========================================================================

    @staticmethod
    async def create_ledger_entry(
        recipient_type: str,
        recipient_id: str,
        amount_cents: int,
        earning_type: str,
        world_id: Optional[str] = None,
        world_earning_id: Optional[str] = None,
        payout_id: Optional[str] = None,
        period_start: Optional[date] = None,
        period_end: Optional[date] = None
    ) -> Dict[str, Any]:
        """
        Create a blockchain ledger entry for a royalty payment.

        This is called when earnings are calculated/distributed.
        The actual blockchain transaction is handled asynchronously.
        """

        # Get wallet address from settings
        if recipient_type == "creator":
            settings = await ExperimentalService.get_blockchain_settings(profile_id=recipient_id)
        else:
            settings = await ExperimentalService.get_blockchain_settings(organization_id=recipient_id)

        if not settings or not settings.get("is_enabled"):
            return {"success": False, "error": "Blockchain tracking not enabled"}

        wallet_address = settings.get("wallet_address")

        # Calculate internal hash for verification
        internal_hash = ExperimentalService._calculate_ledger_hash(
            world_earning_id or "",
            amount_cents,
            earning_type,
            period_start,
            period_end
        )

        entry = execute_insert("""
            INSERT INTO blockchain_royalty_ledger (
                recipient_type, recipient_id, wallet_address,
                amount_cents, currency, earning_type,
                world_id, world_earning_id, payout_id,
                period_start, period_end, internal_hash,
                tx_status
            ) VALUES (
                :recipient_type, :recipient_id, :wallet_address,
                :amount_cents, 'USD', :earning_type,
                :world_id, :world_earning_id, :payout_id,
                :period_start, :period_end, :internal_hash,
                'pending'
            )
            RETURNING *
        """, {
            "recipient_type": recipient_type,
            "recipient_id": recipient_id,
            "wallet_address": wallet_address,
            "amount_cents": amount_cents,
            "earning_type": earning_type,
            "world_id": world_id,
            "world_earning_id": world_earning_id,
            "payout_id": payout_id,
            "period_start": period_start,
            "period_end": period_end,
            "internal_hash": internal_hash
        })

        return {"success": True, "entry": dict(entry)}

    @staticmethod
    async def update_transaction_status(
        entry_id: str,
        tx_status: str,
        tx_hash: Optional[str] = None,
        tx_chain: Optional[str] = None,
        tx_block_number: Optional[int] = None,
        tx_gas_used: Optional[int] = None,
        tx_error: Optional[str] = None,
        metadata_cid: Optional[str] = None
    ) -> Dict[str, Any]:
        """Update blockchain transaction status."""
        updates = {"tx_status": tx_status}

        if tx_hash:
            updates["tx_hash"] = tx_hash
        if tx_chain:
            updates["tx_chain"] = tx_chain
        if tx_block_number:
            updates["tx_block_number"] = tx_block_number
        if tx_gas_used:
            updates["tx_gas_used"] = tx_gas_used
        if tx_error:
            updates["tx_error"] = tx_error
        if metadata_cid:
            updates["metadata_cid"] = metadata_cid

        if tx_status == "submitted":
            updates["tx_submitted_at"] = datetime.utcnow()
        elif tx_status == "confirmed":
            updates["tx_confirmed_at"] = datetime.utcnow()

        set_clauses = ", ".join([f"{k} = :{k}" for k in updates.keys()])
        updates["entry_id"] = entry_id

        execute_query(f"""
            UPDATE blockchain_royalty_ledger
            SET {set_clauses}
            WHERE id = :entry_id
        """, updates)

        return {"success": True}

    @staticmethod
    async def get_ledger_entries(
        recipient_type: Optional[str] = None,
        recipient_id: Optional[str] = None,
        world_id: Optional[str] = None,
        status: Optional[str] = None,
        limit: int = 50,
        offset: int = 0
    ) -> List[Dict[str, Any]]:
        """Get blockchain ledger entries."""
        query = "SELECT * FROM blockchain_royalty_ledger WHERE 1=1"
        params = {"limit": limit, "offset": offset}

        if recipient_type and recipient_id:
            query += " AND recipient_type = :recipient_type AND recipient_id = :recipient_id"
            params["recipient_type"] = recipient_type
            params["recipient_id"] = recipient_id

        if world_id:
            query += " AND world_id = :world_id"
            params["world_id"] = world_id

        if status:
            query += " AND tx_status = :status::blockchain_tx_status"
            params["status"] = status

        query += " ORDER BY created_at DESC LIMIT :limit OFFSET :offset"

        entries = execute_query(query, params)
        return [dict(e) for e in entries]

    @staticmethod
    async def get_earnings_summary(
        recipient_type: str,
        recipient_id: str
    ) -> Dict[str, Any]:
        """Get blockchain earnings summary for a recipient."""
        summary = execute_single("""
            SELECT * FROM v_blockchain_earnings_summary
            WHERE recipient_type = :recipient_type AND recipient_id = :recipient_id
        """, {"recipient_type": recipient_type, "recipient_id": recipient_id})

        return dict(summary) if summary else {
            "total_entries": 0,
            "total_earnings_cents": 0,
            "confirmed_entries": 0,
            "confirmed_earnings_cents": 0
        }

    # ==========================================================================
    # Content NFTs (Placeholder)
    # ==========================================================================

    @staticmethod
    async def mint_content_nft(
        content_type: str,
        owner_profile_id: str,
        world_id: Optional[str] = None,
        episode_id: Optional[str] = None,
        metadata_uri: Optional[str] = None,
        image_uri: Optional[str] = None,
        royalty_percentage: float = 10.0
    ) -> Dict[str, Any]:
        """
        Create a content NFT record (placeholder for actual minting).

        In production, this would trigger actual blockchain minting.
        """

        # Get owner's wallet
        settings = await ExperimentalService.get_blockchain_settings(profile_id=owner_profile_id)

        if not settings or not settings.get("wallet_address"):
            return {"success": False, "error": "No wallet configured"}

        nft = execute_insert("""
            INSERT INTO content_nfts (
                content_type, world_id, episode_id,
                owner_profile_id, owner_wallet_address,
                metadata_uri, image_uri,
                royalty_percentage, royalty_recipient_address,
                chain
            ) VALUES (
                :content_type, :world_id, :episode_id,
                :owner_profile_id, :owner_wallet_address,
                :metadata_uri, :image_uri,
                :royalty_percentage, :royalty_recipient_address,
                :chain
            )
            RETURNING *
        """, {
            "content_type": content_type,
            "world_id": world_id,
            "episode_id": episode_id,
            "owner_profile_id": owner_profile_id,
            "owner_wallet_address": settings["wallet_address"],
            "metadata_uri": metadata_uri,
            "image_uri": image_uri,
            "royalty_percentage": royalty_percentage,
            "royalty_recipient_address": settings["wallet_address"],
            "chain": settings.get("wallet_chain", "polygon")
        })

        return {"success": True, "nft": dict(nft), "message": "NFT record created (minting pending)"}

    @staticmethod
    async def get_user_nfts(profile_id: str) -> List[Dict[str, Any]]:
        """Get NFTs owned by a user."""
        nfts = execute_query("""
            SELECT
                cn.*,
                w.title as world_title,
                e.title as episode_title
            FROM content_nfts cn
            LEFT JOIN worlds w ON cn.world_id = w.id
            LEFT JOIN episodes e ON cn.episode_id = e.id
            WHERE cn.owner_profile_id = :profile_id
            ORDER BY cn.created_at DESC
        """, {"profile_id": profile_id})

        return [dict(n) for n in nfts]

    # ==========================================================================
    # Helpers
    # ==========================================================================

    @staticmethod
    def _calculate_ledger_hash(
        earning_id: str,
        amount_cents: int,
        earning_type: str,
        period_start: Optional[date],
        period_end: Optional[date]
    ) -> str:
        """Calculate SHA256 hash for ledger entry verification."""
        data = f"{earning_id}|{amount_cents}|{earning_type}|{period_start}|{period_end}"
        return hashlib.sha256(data.encode()).hexdigest()
