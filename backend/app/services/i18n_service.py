"""
Internationalization (i18n) Service
Phase 4C: Localization support for Worlds and Episodes.

This service provides:
- Localized content retrieval with fallback
- Translation management
- User language preferences
- Region availability checking
"""

import logging
from datetime import datetime
from typing import Dict, Any, List, Optional

from app.core.database import execute_query, execute_single, execute_insert, execute_update

logger = logging.getLogger(__name__)


# Supported languages (matches database enum)
SUPPORTED_LANGUAGES = [
    'en',      # English (default)
    'es',      # Spanish
    'pt',      # Portuguese
    'fr',      # French
    'de',      # German
    'it',      # Italian
    'zh',      # Chinese (Simplified)
    'zh_tw',   # Chinese (Traditional)
    'ja',      # Japanese
    'ko',      # Korean
    'ar',      # Arabic
    'ru',      # Russian
    'hi',      # Hindi
    'tl',      # Tagalog/Filipino
]

# Default fallback language
DEFAULT_LANGUAGE = 'en'


class I18nService:
    """Service for internationalization and localization."""

    @staticmethod
    async def get_localized_world(
        world_id: str,
        language: str = DEFAULT_LANGUAGE
    ) -> Dict[str, Any]:
        """
        Get World with localized content.

        Falls back to default language if translation not available.
        """
        if language not in SUPPORTED_LANGUAGES:
            language = DEFAULT_LANGUAGE

        # Use the database function for consistency
        result = execute_single("""
            SELECT * FROM get_localized_world(:world_id, :language::supported_language)
        """, {"world_id": world_id, "language": language})

        if not result:
            # Fallback to raw world data
            world = execute_single("""
                SELECT id, title, logline, description
                FROM worlds WHERE id = :world_id
            """, {"world_id": world_id})

            if not world:
                return {"error": "World not found"}

            return {
                "world_id": str(world["id"]),
                "title": world["title"],
                "logline": world.get("logline"),
                "description": world.get("description"),
                "language": DEFAULT_LANGUAGE,
                "is_translated": False
            }

        return {
            "world_id": str(result["world_id"]),
            "title": result["title"],
            "logline": result.get("logline"),
            "description": result.get("description"),
            "language": result.get("language", DEFAULT_LANGUAGE),
            "is_translated": result.get("is_translated", False)
        }

    @staticmethod
    async def get_localized_episode(
        episode_id: str,
        language: str = DEFAULT_LANGUAGE
    ) -> Dict[str, Any]:
        """
        Get Episode with localized content.

        Falls back to default language if translation not available.
        """
        if language not in SUPPORTED_LANGUAGES:
            language = DEFAULT_LANGUAGE

        # Try to get translation
        translation = execute_single("""
            SELECT
                et.title as translated_title,
                et.description as translated_description,
                et.has_subtitles,
                et.subtitle_url,
                et.has_dubbing,
                et.dub_audio_url,
                et.language,
                et.is_machine_translated
            FROM episode_translations et
            WHERE et.episode_id = :episode_id AND et.language = :language::supported_language
        """, {"episode_id": episode_id, "language": language})

        # Get base episode
        episode = execute_single("""
            SELECT id, title, description, world_id, season_number, episode_number
            FROM episodes WHERE id = :episode_id
        """, {"episode_id": episode_id})

        if not episode:
            return {"error": "Episode not found"}

        if translation:
            return {
                "episode_id": str(episode["id"]),
                "world_id": str(episode["world_id"]),
                "season_number": episode.get("season_number"),
                "episode_number": episode.get("episode_number"),
                "title": translation["translated_title"] or episode["title"],
                "description": translation.get("translated_description") or episode.get("description"),
                "language": language,
                "is_translated": True,
                "is_machine_translated": translation.get("is_machine_translated", False),
                "has_subtitles": translation.get("has_subtitles", False),
                "subtitle_url": translation.get("subtitle_url"),
                "has_dubbing": translation.get("has_dubbing", False),
                "dub_audio_url": translation.get("dub_audio_url")
            }

        return {
            "episode_id": str(episode["id"]),
            "world_id": str(episode["world_id"]),
            "season_number": episode.get("season_number"),
            "episode_number": episode.get("episode_number"),
            "title": episode["title"],
            "description": episode.get("description"),
            "language": DEFAULT_LANGUAGE,
            "is_translated": False,
            "is_machine_translated": False,
            "has_subtitles": False,
            "subtitle_url": None,
            "has_dubbing": False,
            "dub_audio_url": None
        }

    @staticmethod
    async def get_world_translations(world_id: str) -> List[Dict[str, Any]]:
        """Get all translations for a World."""
        translations = execute_query("""
            SELECT
                id, language, title, logline, description,
                is_machine_translated, verified, verified_at,
                created_at, updated_at
            FROM world_translations
            WHERE world_id = :world_id
            ORDER BY language
        """, {"world_id": world_id})

        return [dict(t) for t in translations]

    @staticmethod
    async def get_episode_translations(episode_id: str) -> List[Dict[str, Any]]:
        """Get all translations for an Episode."""
        translations = execute_query("""
            SELECT
                id, language, title, description,
                has_subtitles, subtitle_url, has_dubbing, dub_audio_url,
                is_machine_translated, verified,
                created_at, updated_at
            FROM episode_translations
            WHERE episode_id = :episode_id
            ORDER BY language
        """, {"episode_id": episode_id})

        return [dict(t) for t in translations]

    @staticmethod
    async def upsert_world_translation(
        world_id: str,
        language: str,
        title: str,
        logline: Optional[str] = None,
        description: Optional[str] = None,
        is_machine_translated: bool = False,
        translator_id: Optional[str] = None
    ) -> Dict[str, Any]:
        """Create or update a World translation."""
        if language not in SUPPORTED_LANGUAGES:
            return {"error": f"Unsupported language: {language}"}

        # Check if translation exists
        existing = execute_single("""
            SELECT id FROM world_translations
            WHERE world_id = :world_id AND language = :language::supported_language
        """, {"world_id": world_id, "language": language})

        if existing:
            # Update existing
            execute_update("""
                UPDATE world_translations
                SET title = :title,
                    logline = :logline,
                    description = :description,
                    is_machine_translated = :is_machine,
                    translator_id = COALESCE(:translator_id, translator_id),
                    verified = false,
                    updated_at = NOW()
                WHERE world_id = :world_id AND language = :language::supported_language
            """, {
                "world_id": world_id,
                "language": language,
                "title": title,
                "logline": logline,
                "description": description,
                "is_machine": is_machine_translated,
                "translator_id": translator_id
            })

            logger.info("world_translation_updated",
                       world_id=world_id, language=language)

            return {"success": True, "action": "updated", "language": language}

        # Create new
        execute_insert("""
            INSERT INTO world_translations (
                world_id, language, title, logline, description,
                is_machine_translated, translator_id
            ) VALUES (
                :world_id, :language::supported_language, :title, :logline, :description,
                :is_machine, :translator_id
            )
        """, {
            "world_id": world_id,
            "language": language,
            "title": title,
            "logline": logline,
            "description": description,
            "is_machine": is_machine_translated,
            "translator_id": translator_id
        })

        logger.info("world_translation_created",
                   world_id=world_id, language=language)

        return {"success": True, "action": "created", "language": language}

    @staticmethod
    async def upsert_episode_translation(
        episode_id: str,
        language: str,
        title: str,
        description: Optional[str] = None,
        has_subtitles: bool = False,
        subtitle_url: Optional[str] = None,
        has_dubbing: bool = False,
        dub_audio_url: Optional[str] = None,
        is_machine_translated: bool = False,
        translator_id: Optional[str] = None
    ) -> Dict[str, Any]:
        """Create or update an Episode translation."""
        if language not in SUPPORTED_LANGUAGES:
            return {"error": f"Unsupported language: {language}"}

        # Check if translation exists
        existing = execute_single("""
            SELECT id FROM episode_translations
            WHERE episode_id = :episode_id AND language = :language::supported_language
        """, {"episode_id": episode_id, "language": language})

        if existing:
            # Update existing
            execute_update("""
                UPDATE episode_translations
                SET title = :title,
                    description = :description,
                    has_subtitles = :has_subtitles,
                    subtitle_url = :subtitle_url,
                    has_dubbing = :has_dubbing,
                    dub_audio_url = :dub_audio_url,
                    is_machine_translated = :is_machine,
                    translator_id = COALESCE(:translator_id, translator_id),
                    verified = false,
                    updated_at = NOW()
                WHERE episode_id = :episode_id AND language = :language::supported_language
            """, {
                "episode_id": episode_id,
                "language": language,
                "title": title,
                "description": description,
                "has_subtitles": has_subtitles,
                "subtitle_url": subtitle_url,
                "has_dubbing": has_dubbing,
                "dub_audio_url": dub_audio_url,
                "is_machine": is_machine_translated,
                "translator_id": translator_id
            })

            return {"success": True, "action": "updated", "language": language}

        # Create new
        execute_insert("""
            INSERT INTO episode_translations (
                episode_id, language, title, description,
                has_subtitles, subtitle_url, has_dubbing, dub_audio_url,
                is_machine_translated, translator_id
            ) VALUES (
                :episode_id, :language::supported_language, :title, :description,
                :has_subtitles, :subtitle_url, :has_dubbing, :dub_audio_url,
                :is_machine, :translator_id
            )
        """, {
            "episode_id": episode_id,
            "language": language,
            "title": title,
            "description": description,
            "has_subtitles": has_subtitles,
            "subtitle_url": subtitle_url,
            "has_dubbing": has_dubbing,
            "dub_audio_url": dub_audio_url,
            "is_machine": is_machine_translated,
            "translator_id": translator_id
        })

        return {"success": True, "action": "created", "language": language}

    @staticmethod
    async def verify_translation(
        translation_type: str,  # 'world' or 'episode'
        translation_id: str,
        verifier_id: str
    ) -> Dict[str, Any]:
        """Mark a translation as verified."""
        if translation_type == 'world':
            execute_update("""
                UPDATE world_translations
                SET verified = true,
                    verified_by = :verifier_id,
                    verified_at = NOW()
                WHERE id = :translation_id
            """, {"translation_id": translation_id, "verifier_id": verifier_id})
        elif translation_type == 'episode':
            execute_update("""
                UPDATE episode_translations
                SET verified = true,
                    updated_at = NOW()
                WHERE id = :translation_id
            """, {"translation_id": translation_id})
        else:
            return {"error": "Invalid translation type"}

        return {"success": True}

    @staticmethod
    async def delete_translation(
        translation_type: str,  # 'world' or 'episode'
        translation_id: str
    ) -> Dict[str, Any]:
        """Delete a translation."""
        if translation_type == 'world':
            execute_update("""
                DELETE FROM world_translations WHERE id = :translation_id
            """, {"translation_id": translation_id})
        elif translation_type == 'episode':
            execute_update("""
                DELETE FROM episode_translations WHERE id = :translation_id
            """, {"translation_id": translation_id})
        else:
            return {"error": "Invalid translation type"}

        return {"success": True}

    # =========================================================================
    # User Preferences
    # =========================================================================

    @staticmethod
    async def get_user_language_preferences(user_id: str) -> Dict[str, Any]:
        """Get user's language preferences."""
        profile = execute_single("""
            SELECT preferred_language, secondary_languages, region, detected_region
            FROM profiles WHERE id = :user_id
        """, {"user_id": user_id})

        if not profile:
            return {
                "preferred_language": DEFAULT_LANGUAGE,
                "secondary_languages": [],
                "region": "US",
                "detected_region": None
            }

        return {
            "preferred_language": profile.get("preferred_language") or DEFAULT_LANGUAGE,
            "secondary_languages": profile.get("secondary_languages") or [],
            "region": profile.get("region") or "US",
            "detected_region": profile.get("detected_region")
        }

    @staticmethod
    async def update_user_language_preferences(
        user_id: str,
        preferred_language: Optional[str] = None,
        secondary_languages: Optional[List[str]] = None,
        region: Optional[str] = None
    ) -> Dict[str, Any]:
        """Update user's language preferences."""
        updates = []
        params = {"user_id": user_id}

        if preferred_language is not None:
            if preferred_language not in SUPPORTED_LANGUAGES:
                return {"error": f"Unsupported language: {preferred_language}"}
            updates.append("preferred_language = :preferred_language::supported_language")
            params["preferred_language"] = preferred_language

        if secondary_languages is not None:
            # Validate all languages
            invalid = [l for l in secondary_languages if l not in SUPPORTED_LANGUAGES]
            if invalid:
                return {"error": f"Unsupported languages: {', '.join(invalid)}"}
            updates.append("secondary_languages = :secondary_languages::supported_language[]")
            params["secondary_languages"] = secondary_languages

        if region is not None:
            updates.append("region = :region")
            params["region"] = region

        if not updates:
            return {"success": True, "message": "No updates provided"}

        execute_update(f"""
            UPDATE profiles
            SET {', '.join(updates)}, updated_at = NOW()
            WHERE id = :user_id
        """, params)

        return {"success": True}

    # =========================================================================
    # Region Availability
    # =========================================================================

    @staticmethod
    async def check_world_availability(
        world_id: str,
        region: str
    ) -> Dict[str, Any]:
        """Check if a World is available in a specific region."""
        # Use the database function
        result = execute_single("""
            SELECT is_world_available_in_region(:world_id, :region) as available
        """, {"world_id": world_id, "region": region})

        if result is None:
            return {"available": False, "reason": "World not found"}

        return {"available": result["available"]}

    @staticmethod
    async def get_world_regions(world_id: str) -> Dict[str, Any]:
        """Get region configuration for a World."""
        world = execute_single("""
            SELECT
                available_regions,
                restricted_regions,
                default_region,
                region_notes
            FROM worlds WHERE id = :world_id
        """, {"world_id": world_id})

        if not world:
            return {"error": "World not found"}

        # Get release windows
        releases = execute_query("""
            SELECT region, release_date, release_time, timezone,
                   available_from, available_until, status
            FROM world_region_releases
            WHERE world_id = :world_id
            ORDER BY region
        """, {"world_id": world_id})

        return {
            "world_id": world_id,
            "available_regions": world.get("available_regions") or [],
            "restricted_regions": world.get("restricted_regions") or [],
            "default_region": world.get("default_region") or "US",
            "region_notes": world.get("region_notes"),
            "release_windows": [dict(r) for r in releases]
        }

    @staticmethod
    async def update_world_regions(
        world_id: str,
        available_regions: Optional[List[str]] = None,
        restricted_regions: Optional[List[str]] = None,
        default_region: Optional[str] = None,
        region_notes: Optional[str] = None
    ) -> Dict[str, Any]:
        """Update region configuration for a World."""
        updates = []
        params = {"world_id": world_id}

        if available_regions is not None:
            updates.append("available_regions = :available_regions")
            params["available_regions"] = available_regions

        if restricted_regions is not None:
            updates.append("restricted_regions = :restricted_regions")
            params["restricted_regions"] = restricted_regions

        if default_region is not None:
            updates.append("default_region = :default_region")
            params["default_region"] = default_region

        if region_notes is not None:
            updates.append("region_notes = :region_notes")
            params["region_notes"] = region_notes

        if not updates:
            return {"success": True, "message": "No updates provided"}

        execute_update(f"""
            UPDATE worlds
            SET {', '.join(updates)}, updated_at = NOW()
            WHERE id = :world_id
        """, params)

        return {"success": True}

    @staticmethod
    async def set_region_release(
        world_id: str,
        region: str,
        release_date: Optional[str] = None,
        release_time: Optional[str] = None,
        timezone: str = "UTC",
        available_from: Optional[datetime] = None,
        available_until: Optional[datetime] = None,
        status: str = "scheduled"
    ) -> Dict[str, Any]:
        """Set or update a region-specific release window."""
        # Check if exists
        existing = execute_single("""
            SELECT id FROM world_region_releases
            WHERE world_id = :world_id AND region = :region
        """, {"world_id": world_id, "region": region})

        if existing:
            execute_update("""
                UPDATE world_region_releases
                SET release_date = :release_date,
                    release_time = :release_time,
                    timezone = :timezone,
                    available_from = :available_from,
                    available_until = :available_until,
                    status = :status,
                    updated_at = NOW()
                WHERE world_id = :world_id AND region = :region
            """, {
                "world_id": world_id,
                "region": region,
                "release_date": release_date,
                "release_time": release_time,
                "timezone": timezone,
                "available_from": available_from,
                "available_until": available_until,
                "status": status
            })
            return {"success": True, "action": "updated"}

        execute_insert("""
            INSERT INTO world_region_releases (
                world_id, region, release_date, release_time,
                timezone, available_from, available_until, status
            ) VALUES (
                :world_id, :region, :release_date, :release_time,
                :timezone, :available_from, :available_until, :status
            )
        """, {
            "world_id": world_id,
            "region": region,
            "release_date": release_date,
            "release_time": release_time,
            "timezone": timezone,
            "available_from": available_from,
            "available_until": available_until,
            "status": status
        })

        return {"success": True, "action": "created"}

    # =========================================================================
    # Utility Functions
    # =========================================================================

    @staticmethod
    def get_supported_languages() -> List[Dict[str, str]]:
        """Get list of supported languages with labels."""
        language_labels = {
            'en': 'English',
            'es': 'Espa\u00f1ol',
            'pt': 'Portugu\u00eas',
            'fr': 'Fran\u00e7ais',
            'de': 'Deutsch',
            'it': 'Italiano',
            'zh': '\u4e2d\u6587 (Simplified)',
            'zh_tw': '\u4e2d\u6587 (Traditional)',
            'ja': '\u65e5\u672c\u8a9e',
            'ko': '\ud55c\uad6d\uc5b4',
            'ar': '\u0627\u0644\u0639\u0631\u0628\u064a\u0629',
            'ru': '\u0420\u0443\u0441\u0441\u043a\u0438\u0439',
            'hi': '\u0939\u093f\u0928\u094d\u0926\u0940',
            'tl': 'Tagalog',
        }

        return [
            {"code": lang, "label": language_labels.get(lang, lang)}
            for lang in SUPPORTED_LANGUAGES
        ]

    @staticmethod
    async def get_available_translations(
        content_type: str,
        content_id: str
    ) -> List[str]:
        """Get list of available translation languages for content."""
        if content_type == 'world':
            results = execute_query("""
                SELECT DISTINCT language FROM world_translations
                WHERE world_id = :content_id
                ORDER BY language
            """, {"content_id": content_id})
        elif content_type == 'episode':
            results = execute_query("""
                SELECT DISTINCT language FROM episode_translations
                WHERE episode_id = :content_id
                ORDER BY language
            """, {"content_id": content_id})
        else:
            return []

        return [r["language"] for r in results]
