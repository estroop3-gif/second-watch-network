"""
Discovery scoring for found websites.
Scores sites based on keyword relevance, location match, and metadata signals.
Returns a score (0-100) and breakdown dict.
"""

DEFAULT_KEYWORDS = {
    "high": ["film production", "tv production", "post production", "production company",
             "dailies", "scheduling", "call sheet", "faith-based", "christian film"],
    "medium": ["production", "filmmaker", "studio", "broadcast", "media company",
               "video production", "content creation"],
    "low": ["entertainment", "creative agency", "media", "digital content"]
}


def calculate_discovery_score(site: dict, profile_config: dict = None) -> tuple:
    """Score a discovered site. Returns (score 0-100, breakdown dict)."""
    breakdown = {}
    config = profile_config or {}

    keywords = config.get("keywords", [])
    required_keywords = config.get("required_keywords", [])
    excluded_keywords = config.get("excluded_keywords", [])

    text = " ".join([
        site.get("name", ""),
        site.get("snippet", ""),
        site.get("url", ""),
    ]).lower()

    # Check excluded keywords — auto-reject
    if excluded_keywords:
        for kw in excluded_keywords:
            if kw.lower() in text:
                return 0, {"excluded_keyword_match": kw}

    # Check required keywords — must match at least one
    if required_keywords:
        matched = any(kw.lower() in text for kw in required_keywords)
        if not matched:
            return 0, {"missing_required_keyword": True}

    # Custom keyword scoring (0-40 points)
    kw_score = 0
    if keywords:
        matches = sum(1 for kw in keywords if kw.lower() in text)
        if matches > 0:
            kw_score = min(40, matches * 15)
    else:
        # Use default keyword tiers
        if any(k in text for k in DEFAULT_KEYWORDS["high"]):
            kw_score = 40
        elif any(k in text for k in DEFAULT_KEYWORDS["medium"]):
            kw_score = 25
        elif any(k in text for k in DEFAULT_KEYWORDS["low"]):
            kw_score = 10
    breakdown["keywords"] = kw_score

    # Has website URL (0-20 points)
    breakdown["has_url"] = 20 if site.get("url") else 0

    # Name quality — longer names tend to be more specific (0-15 points)
    name = site.get("name", "")
    if len(name) > 20:
        breakdown["name_quality"] = 15
    elif len(name) > 10:
        breakdown["name_quality"] = 10
    elif name:
        breakdown["name_quality"] = 5
    else:
        breakdown["name_quality"] = 0

    # Has snippet/description (0-10 points)
    breakdown["has_snippet"] = 10 if site.get("snippet") else 0

    # Location match (0-15 points)
    location = site.get("location", "")
    if location:
        breakdown["location"] = 15
    else:
        breakdown["location"] = 0

    total = sum(breakdown.values())
    return min(total, 100), breakdown
