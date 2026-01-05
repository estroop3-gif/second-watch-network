"""
Internationalization (i18n) API
Phase 4C: Localization endpoints for content and user preferences.

Provides:
- Localized content retrieval
- Translation management
- User language preferences
- Region availability
"""

from typing import Optional, List
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field

from app.core.auth import get_current_user
from app.core.database import execute_single
from app.services.i18n_service import I18nService, SUPPORTED_LANGUAGES, DEFAULT_LANGUAGE

router = APIRouter()


# =============================================================================
# Request/Response Models
# =============================================================================

class LocalizedWorldResponse(BaseModel):
    """Localized World content."""
    world_id: str
    title: str
    logline: Optional[str]
    description: Optional[str]
    language: str
    is_translated: bool


class LocalizedEpisodeResponse(BaseModel):
    """Localized Episode content."""
    episode_id: str
    world_id: str
    season_number: Optional[int]
    episode_number: Optional[int]
    title: str
    description: Optional[str]
    language: str
    is_translated: bool
    is_machine_translated: bool
    has_subtitles: bool
    subtitle_url: Optional[str]
    has_dubbing: bool
    dub_audio_url: Optional[str]


class WorldTranslationRequest(BaseModel):
    """Request to create/update World translation."""
    language: str = Field(..., description="Language code")
    title: str = Field(..., description="Translated title")
    logline: Optional[str] = Field(None, description="Translated logline")
    description: Optional[str] = Field(None, description="Translated description")
    is_machine_translated: bool = Field(False, description="Was this machine translated?")


class EpisodeTranslationRequest(BaseModel):
    """Request to create/update Episode translation."""
    language: str = Field(..., description="Language code")
    title: str = Field(..., description="Translated title")
    description: Optional[str] = Field(None, description="Translated description")
    has_subtitles: bool = Field(False)
    subtitle_url: Optional[str] = None
    has_dubbing: bool = Field(False)
    dub_audio_url: Optional[str] = None
    is_machine_translated: bool = Field(False)


class TranslationResponse(BaseModel):
    """Translation record."""
    id: str
    language: str
    title: str
    logline: Optional[str] = None
    description: Optional[str] = None
    is_machine_translated: bool
    verified: bool
    created_at: datetime
    updated_at: datetime
    # Episode-specific
    has_subtitles: Optional[bool] = None
    subtitle_url: Optional[str] = None
    has_dubbing: Optional[bool] = None
    dub_audio_url: Optional[str] = None


class UserLanguagePreferencesRequest(BaseModel):
    """Request to update user language preferences."""
    preferred_language: Optional[str] = None
    secondary_languages: Optional[List[str]] = None
    region: Optional[str] = None


class UserLanguagePreferencesResponse(BaseModel):
    """User language preferences."""
    preferred_language: str
    secondary_languages: List[str]
    region: str
    detected_region: Optional[str]


class WorldRegionConfigRequest(BaseModel):
    """Request to update World region configuration."""
    available_regions: Optional[List[str]] = None
    restricted_regions: Optional[List[str]] = None
    default_region: Optional[str] = None
    region_notes: Optional[str] = None


class RegionReleaseRequest(BaseModel):
    """Request to set region-specific release."""
    release_date: Optional[str] = None
    release_time: Optional[str] = None
    timezone: str = "UTC"
    available_from: Optional[datetime] = None
    available_until: Optional[datetime] = None
    status: str = "scheduled"


class LanguageInfo(BaseModel):
    """Language information."""
    code: str
    label: str


# =============================================================================
# Localized Content Endpoints
# =============================================================================

@router.get("/worlds/{world_id}/localized", response_model=LocalizedWorldResponse)
async def get_localized_world(
    world_id: str,
    lang: str = Query(DEFAULT_LANGUAGE, description="Language code")
):
    """
    Get World with localized content.

    Falls back to English if translation not available.
    No authentication required for public Worlds.
    """
    result = await I18nService.get_localized_world(world_id, lang)

    if "error" in result:
        raise HTTPException(status_code=404, detail=result["error"])

    return result


@router.get("/episodes/{episode_id}/localized", response_model=LocalizedEpisodeResponse)
async def get_localized_episode(
    episode_id: str,
    lang: str = Query(DEFAULT_LANGUAGE, description="Language code")
):
    """
    Get Episode with localized content.

    Includes subtitle and dubbing availability.
    Falls back to English if translation not available.
    """
    result = await I18nService.get_localized_episode(episode_id, lang)

    if "error" in result:
        raise HTTPException(status_code=404, detail=result["error"])

    return result


@router.get("/languages", response_model=List[LanguageInfo])
async def get_supported_languages():
    """Get list of supported languages with labels."""
    return I18nService.get_supported_languages()


@router.get("/worlds/{world_id}/translations/available")
async def get_world_available_translations(world_id: str):
    """Get list of available translation languages for a World."""
    languages = await I18nService.get_available_translations("world", world_id)
    return {"world_id": world_id, "languages": languages}


@router.get("/episodes/{episode_id}/translations/available")
async def get_episode_available_translations(episode_id: str):
    """Get list of available translation languages for an Episode."""
    languages = await I18nService.get_available_translations("episode", episode_id)
    return {"episode_id": episode_id, "languages": languages}


# =============================================================================
# Translation Management Endpoints
# =============================================================================

@router.get("/worlds/{world_id}/translations")
async def get_world_translations(
    world_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Get all translations for a World."""
    translations = await I18nService.get_world_translations(world_id)
    return {"world_id": world_id, "translations": translations}


@router.post("/worlds/{world_id}/translations")
async def create_world_translation(
    world_id: str,
    request: WorldTranslationRequest,
    current_user: dict = Depends(get_current_user)
):
    """
    Create or update a World translation.

    Requires ownership or translator role.
    """
    from app.api.users import get_profile_id_from_cognito_id
    profile_id = await get_profile_id_from_cognito_id(current_user["sub"])

    # Verify ownership (basic check)
    world = execute_single("""
        SELECT creator_id FROM worlds WHERE id = :world_id
    """, {"world_id": world_id})

    if not world:
        raise HTTPException(status_code=404, detail="World not found")

    result = await I18nService.upsert_world_translation(
        world_id=world_id,
        language=request.language,
        title=request.title,
        logline=request.logline,
        description=request.description,
        is_machine_translated=request.is_machine_translated,
        translator_id=profile_id
    )

    if "error" in result:
        raise HTTPException(status_code=400, detail=result["error"])

    return result


@router.get("/episodes/{episode_id}/translations")
async def get_episode_translations(
    episode_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Get all translations for an Episode."""
    translations = await I18nService.get_episode_translations(episode_id)
    return {"episode_id": episode_id, "translations": translations}


@router.post("/episodes/{episode_id}/translations")
async def create_episode_translation(
    episode_id: str,
    request: EpisodeTranslationRequest,
    current_user: dict = Depends(get_current_user)
):
    """
    Create or update an Episode translation.

    Requires ownership or translator role.
    """
    from app.api.users import get_profile_id_from_cognito_id
    profile_id = await get_profile_id_from_cognito_id(current_user["sub"])

    # Verify episode exists
    episode = execute_single("""
        SELECT id FROM episodes WHERE id = :episode_id
    """, {"episode_id": episode_id})

    if not episode:
        raise HTTPException(status_code=404, detail="Episode not found")

    result = await I18nService.upsert_episode_translation(
        episode_id=episode_id,
        language=request.language,
        title=request.title,
        description=request.description,
        has_subtitles=request.has_subtitles,
        subtitle_url=request.subtitle_url,
        has_dubbing=request.has_dubbing,
        dub_audio_url=request.dub_audio_url,
        is_machine_translated=request.is_machine_translated,
        translator_id=profile_id
    )

    if "error" in result:
        raise HTTPException(status_code=400, detail=result["error"])

    return result


@router.post("/translations/{translation_type}/{translation_id}/verify")
async def verify_translation(
    translation_type: str,
    translation_id: str,
    current_user: dict = Depends(get_current_user)
):
    """
    Mark a translation as verified.

    Requires admin or translator role.
    """
    from app.api.users import get_profile_id_from_cognito_id
    profile_id = await get_profile_id_from_cognito_id(current_user["sub"])

    if translation_type not in ("world", "episode"):
        raise HTTPException(status_code=400, detail="Invalid translation type")

    result = await I18nService.verify_translation(
        translation_type=translation_type,
        translation_id=translation_id,
        verifier_id=profile_id
    )

    if "error" in result:
        raise HTTPException(status_code=400, detail=result["error"])

    return result


@router.delete("/translations/{translation_type}/{translation_id}")
async def delete_translation(
    translation_type: str,
    translation_id: str,
    current_user: dict = Depends(get_current_user)
):
    """
    Delete a translation.

    Requires ownership or admin role.
    """
    if translation_type not in ("world", "episode"):
        raise HTTPException(status_code=400, detail="Invalid translation type")

    result = await I18nService.delete_translation(
        translation_type=translation_type,
        translation_id=translation_id
    )

    if "error" in result:
        raise HTTPException(status_code=400, detail=result["error"])

    return result


# =============================================================================
# User Language Preferences
# =============================================================================

@router.get("/me/language-preferences", response_model=UserLanguagePreferencesResponse)
async def get_my_language_preferences(
    current_user: dict = Depends(get_current_user)
):
    """Get current user's language preferences."""
    from app.api.users import get_profile_id_from_cognito_id
    profile_id = await get_profile_id_from_cognito_id(current_user["sub"])

    return await I18nService.get_user_language_preferences(profile_id)


@router.put("/me/language-preferences")
async def update_my_language_preferences(
    request: UserLanguagePreferencesRequest,
    current_user: dict = Depends(get_current_user)
):
    """Update current user's language preferences."""
    from app.api.users import get_profile_id_from_cognito_id
    profile_id = await get_profile_id_from_cognito_id(current_user["sub"])

    result = await I18nService.update_user_language_preferences(
        user_id=profile_id,
        preferred_language=request.preferred_language,
        secondary_languages=request.secondary_languages,
        region=request.region
    )

    if "error" in result:
        raise HTTPException(status_code=400, detail=result["error"])

    return result


# =============================================================================
# Region Availability
# =============================================================================

@router.get("/worlds/{world_id}/availability/{region}")
async def check_world_availability(
    world_id: str,
    region: str
):
    """
    Check if a World is available in a specific region.

    No authentication required.
    """
    result = await I18nService.check_world_availability(world_id, region)
    return result


@router.get("/worlds/{world_id}/regions")
async def get_world_region_config(
    world_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Get region configuration for a World."""
    result = await I18nService.get_world_regions(world_id)

    if "error" in result:
        raise HTTPException(status_code=404, detail=result["error"])

    return result


@router.put("/worlds/{world_id}/regions")
async def update_world_region_config(
    world_id: str,
    request: WorldRegionConfigRequest,
    current_user: dict = Depends(get_current_user)
):
    """
    Update region configuration for a World.

    Requires ownership.
    """
    # Verify ownership
    from app.api.users import get_profile_id_from_cognito_id
    profile_id = await get_profile_id_from_cognito_id(current_user["sub"])

    world = execute_single("""
        SELECT creator_id FROM worlds WHERE id = :world_id
    """, {"world_id": world_id})

    if not world:
        raise HTTPException(status_code=404, detail="World not found")

    if str(world["creator_id"]) != profile_id:
        raise HTTPException(status_code=403, detail="Not authorized")

    result = await I18nService.update_world_regions(
        world_id=world_id,
        available_regions=request.available_regions,
        restricted_regions=request.restricted_regions,
        default_region=request.default_region,
        region_notes=request.region_notes
    )

    return result


@router.put("/worlds/{world_id}/regions/{region}/release")
async def set_region_release(
    world_id: str,
    region: str,
    request: RegionReleaseRequest,
    current_user: dict = Depends(get_current_user)
):
    """
    Set or update a region-specific release window.

    Requires ownership.
    """
    # Verify ownership
    from app.api.users import get_profile_id_from_cognito_id
    profile_id = await get_profile_id_from_cognito_id(current_user["sub"])

    world = execute_single("""
        SELECT creator_id FROM worlds WHERE id = :world_id
    """, {"world_id": world_id})

    if not world:
        raise HTTPException(status_code=404, detail="World not found")

    if str(world["creator_id"]) != profile_id:
        raise HTTPException(status_code=403, detail="Not authorized")

    result = await I18nService.set_region_release(
        world_id=world_id,
        region=region,
        release_date=request.release_date,
        release_time=request.release_time,
        timezone=request.timezone,
        available_from=request.available_from,
        available_until=request.available_until,
        status=request.status
    )

    return result
