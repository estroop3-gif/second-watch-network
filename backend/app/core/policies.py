"""
Safety Policies and Thresholds
Phase 4B: Configurable safety rules for content and user moderation.

These policies are intentionally gentle at launch - primarily logging
and soft gates rather than aggressive automation.
"""

from enum import Enum
from typing import Dict, Any


# =============================================================================
# Trust Score Thresholds
# =============================================================================

class TrustScoreThresholds:
    """Trust score boundaries for user actions."""

    # Starting score for new users
    INITIAL_SCORE = 100

    # Score below which content gets extra review priority
    ENHANCED_REVIEW_THRESHOLD = 70

    # Score below which user cannot create new Worlds
    WORLD_CREATION_THRESHOLD = 50

    # Score below which user gets auto-held for moderation
    AUTO_HOLD_THRESHOLD = 30

    # Score adjustments for actions
    ADJUSTMENTS = {
        "warning_received": -5,
        "mute_received": -15,
        "suspension_received": -25,
        "confirmed_violation": -10,
        "flag_dismissed": +2,  # Dismissed flags help restore trust
        "successful_review": +5,  # Content passes review
        "longtime_good_standing": +1,  # Monthly bonus for clean record
    }


# =============================================================================
# Content Moderation Thresholds
# =============================================================================

class ContentModerationThresholds:
    """Thresholds for automatic content actions."""

    # Number of serious flags before auto-hold
    SERIOUS_FLAGS_FOR_AUTO_HOLD = 3

    # Number of any flags before review priority bump
    FLAGS_FOR_PRIORITY_BUMP = 5

    # Time window for flag counting (hours)
    FLAG_COUNTING_WINDOW_HOURS = 24

    # Severity weights for flag scoring
    FLAG_SEVERITY_WEIGHTS = {
        "low": 1,
        "medium": 2,
        "high": 5,
        "critical": 10,
    }

    # Weighted flag score for auto-hold
    WEIGHTED_SCORE_FOR_AUTO_HOLD = 15


# =============================================================================
# User Moderation Thresholds
# =============================================================================

class UserModerationThresholds:
    """Thresholds for automatic user actions."""

    # Warnings before auto-mute consideration
    WARNINGS_BEFORE_AUTO_MUTE = 3

    # Mutes before auto-suspension consideration
    MUTES_BEFORE_AUTO_SUSPENSION = 2

    # Time window for counting (days)
    VIOLATION_COUNTING_WINDOW_DAYS = 30

    # Confirmed violations for auto-suspension
    VIOLATIONS_FOR_AUTO_SUSPENSION = 5

    # Default mute durations (hours)
    DEFAULT_MUTE_DURATIONS = {
        "first": 24,       # 1 day
        "second": 72,      # 3 days
        "third": 168,      # 1 week
        "fourth_plus": 720,  # 30 days
    }


# =============================================================================
# Recommendation Filtering Policies
# =============================================================================

class RecommendationFilterPolicy:
    """
    Policies for filtering content from recommendations.

    Note: These are soft gates that deprioritize rather than hide.
    Content is still accessible via direct links.
    """

    # Deprioritize Worlds with pending review tasks
    DEPRIORITIZE_PENDING_REVIEW = True

    # Score penalty for content under review (applied to recommendation score)
    PENDING_REVIEW_SCORE_PENALTY = 0.5  # 50% of normal score

    # Deprioritize Worlds with unresolved serious flags
    DEPRIORITIZE_FLAGGED_CONTENT = True

    # Score penalty for flagged content
    FLAGGED_CONTENT_SCORE_PENALTY = 0.7  # 70% of normal score

    # Completely hide from recommendations if...
    HIDE_IF_CRITICAL_FLAGS_COUNT = 2  # 2+ critical flags

    # Creator with trust score below this gets content deprioritized
    CREATOR_TRUST_THRESHOLD_FOR_DEPRIORITIZE = 50


# =============================================================================
# Content Categories and Guidelines
# =============================================================================

class ContentGuidelines:
    """
    Content policy categories aligned with Second Watch's faith-driven ethos.

    These define the categories used when flagging content.
    """

    # Flag reason categories
    TECHNICAL_ISSUES = [
        "audio_quality",
        "video_quality",
        "buffering_issues",
        "missing_subtitles",
        "sync_issues",
    ]

    CONTENT_POLICY_VIOLATIONS = [
        "inappropriate_language",
        "violence_excessive",
        "sexual_content",
        "hate_speech",
        "discrimination",
        "misinformation",
        "blasphemy",  # Faith-specific
    ]

    RIGHTS_CONCERNS = [
        "copyright_claim",
        "trademark_violation",
        "music_licensing",
        "footage_rights",
        "actor_consent",
    ]

    METADATA_ISSUES = [
        "incorrect_title",
        "wrong_description",
        "misleading_thumbnail",
        "wrong_genre",
        "incorrect_credits",
    ]

    SAFETY_CONCERNS = [
        "dangerous_activities",
        "self_harm",
        "exploitation",
        "doxxing",
        "illegal_content",
    ]


# =============================================================================
# Review Prioritization
# =============================================================================

class ReviewPrioritization:
    """Policies for review queue prioritization."""

    # Base priorities (1 = highest, 10 = lowest)
    BASE_PRIORITIES = {
        "world": 5,
        "episode": 6,
        "companion_item": 7,
        "short": 6,
        "live_event": 3,  # Time-sensitive
    }

    # Priority adjustments
    ADJUSTMENTS = {
        "has_critical_flag": -3,  # Bump up (lower number = higher priority)
        "has_high_flags": -2,
        "creator_low_trust": -1,
        "resubmission": -1,  # Resubmissions get slight priority
        "near_premiere_date": -2,  # Time-sensitive
        "longtime_creator": +1,  # Slight deprioritize for trusted creators
    }

    # Due date defaults (hours from submission)
    DEFAULT_DUE_HOURS = {
        "world": 72,  # 3 days
        "episode": 48,  # 2 days
        "companion_item": 96,  # 4 days
        "short": 24,  # 1 day
        "live_event": 12,  # Half day
    }


# =============================================================================
# Helper Functions
# =============================================================================

def calculate_flag_weight_score(flags: list) -> int:
    """Calculate weighted score from a list of flags."""
    score = 0
    for flag in flags:
        severity = flag.get("severity", "medium")
        score += ContentModerationThresholds.FLAG_SEVERITY_WEIGHTS.get(severity, 2)
    return score


def should_auto_hold_content(flags: list) -> bool:
    """Determine if content should be auto-held based on flags."""
    # Count serious flags
    serious_count = sum(
        1 for f in flags
        if f.get("severity") in ("high", "critical")
    )

    if serious_count >= ContentModerationThresholds.SERIOUS_FLAGS_FOR_AUTO_HOLD:
        return True

    # Check weighted score
    if calculate_flag_weight_score(flags) >= ContentModerationThresholds.WEIGHTED_SCORE_FOR_AUTO_HOLD:
        return True

    return False


def get_mute_duration_hours(previous_mute_count: int) -> int:
    """Get appropriate mute duration based on history."""
    durations = UserModerationThresholds.DEFAULT_MUTE_DURATIONS

    if previous_mute_count == 0:
        return durations["first"]
    elif previous_mute_count == 1:
        return durations["second"]
    elif previous_mute_count == 2:
        return durations["third"]
    else:
        return durations["fourth_plus"]


def calculate_review_priority(
    content_type: str,
    has_critical_flag: bool = False,
    has_high_flags: bool = False,
    creator_low_trust: bool = False,
    is_resubmission: bool = False,
    near_premiere: bool = False,
    longtime_creator: bool = False
) -> int:
    """Calculate review priority (1-10, lower = higher priority)."""
    base = ReviewPrioritization.BASE_PRIORITIES.get(content_type, 5)
    adj = ReviewPrioritization.ADJUSTMENTS

    priority = base

    if has_critical_flag:
        priority += adj["has_critical_flag"]
    if has_high_flags:
        priority += adj["has_high_flags"]
    if creator_low_trust:
        priority += adj["creator_low_trust"]
    if is_resubmission:
        priority += adj["resubmission"]
    if near_premiere:
        priority += adj["near_premiere_date"]
    if longtime_creator:
        priority += adj["longtime_creator"]

    # Clamp to valid range
    return max(1, min(10, priority))


def get_recommendation_score_multiplier(
    has_pending_review: bool = False,
    has_flags: bool = False,
    critical_flag_count: int = 0,
    creator_trust_score: int = 100
) -> float:
    """
    Get score multiplier for recommendations.

    Returns 0 if content should be hidden, otherwise a multiplier 0-1.
    """
    policy = RecommendationFilterPolicy

    # Hard hide conditions
    if critical_flag_count >= policy.HIDE_IF_CRITICAL_FLAGS_COUNT:
        return 0.0

    multiplier = 1.0

    if has_pending_review and policy.DEPRIORITIZE_PENDING_REVIEW:
        multiplier *= policy.PENDING_REVIEW_SCORE_PENALTY

    if has_flags and policy.DEPRIORITIZE_FLAGGED_CONTENT:
        multiplier *= policy.FLAGGED_CONTENT_SCORE_PENALTY

    if creator_trust_score < policy.CREATOR_TRUST_THRESHOLD_FOR_DEPRIORITIZE:
        # Scale penalty based on how low trust is
        trust_penalty = creator_trust_score / policy.CREATOR_TRUST_THRESHOLD_FOR_DEPRIORITIZE
        multiplier *= trust_penalty

    return multiplier
