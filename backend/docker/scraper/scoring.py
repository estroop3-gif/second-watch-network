"""
Lead scoring for scraped B2B contacts.
Returns a score (0-100) and breakdown dict.
"""


FREE_DOMAINS = {"gmail.com", "yahoo.com", "hotmail.com", "outlook.com", "aol.com",
                "icloud.com", "mail.com", "protonmail.com", "zoho.com"}

KEYWORDS = {
    "high": ["film production", "tv production", "post production", "production company",
             "dailies", "scheduling", "call sheet", "faith-based", "christian film"],
    "medium": ["production", "filmmaker", "studio", "broadcast", "media company",
               "video production", "content creation"],
    "low": ["entertainment", "creative agency", "media", "digital content"]
}

COUNTRY_SCORES = {"US": 20, "CA": 18, "UK": 18, "GB": 18, "AU": 15}


def calculate_match_score(lead: dict, page_text: str = "", scoring_rules: dict = None) -> tuple:
    """Returns (score 0-100, breakdown dict).

    If scoring_rules is provided, uses custom keyword tiers and weights.
    Expected format: {"keywords": {"high": [...], "medium": [...], "low": [...]},
                      "weights": {"keywords": 35, "domain": 20, ...}}
    """
    breakdown = {}
    rules = scoring_rules or {}
    custom_keywords = rules.get("keywords", {})
    weights = rules.get("weights", {})

    # Keywords in description/page text (0-35 points)
    max_kw = weights.get("keywords", 35)
    text = ((lead.get("description") or "") + " " + (page_text or "")).lower()
    kw_high = custom_keywords.get("high", KEYWORDS["high"])
    kw_med = custom_keywords.get("medium", KEYWORDS["medium"])
    kw_low = custom_keywords.get("low", KEYWORDS["low"])

    kw_score = 0
    if any(k in text for k in kw_high):
        kw_score = max_kw
    elif any(k in text for k in kw_med):
        kw_score = int(max_kw * 0.57)
    elif any(k in text for k in kw_low):
        kw_score = int(max_kw * 0.28)
    breakdown["keywords"] = kw_score

    # Business domain (0-20 points)
    max_domain = weights.get("domain", 20)
    email = (lead.get("email") or "").lower()
    if email and "@" in email:
        domain = email.split("@")[1]
        breakdown["domain"] = 0 if domain in FREE_DOMAINS else max_domain
    else:
        breakdown["domain"] = int(max_domain * 0.25)

    # Has website (0-15 points)
    max_website = weights.get("website", 15)
    breakdown["website"] = max_website if lead.get("website") else 0

    # Country priority (0-20 points)
    max_country = weights.get("country", 20)
    country = (lead.get("country") or "").upper()
    breakdown["country"] = COUNTRY_SCORES.get(country, int(max_country * 0.25))

    # Has phone (0-10 points)
    max_phone = weights.get("phone", 10)
    breakdown["phone"] = max_phone if lead.get("phone") else 0

    total = sum(breakdown.values())
    return min(total, 100), breakdown
