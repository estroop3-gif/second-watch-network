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


def calculate_match_score(lead: dict, page_text: str = "") -> tuple:
    """Returns (score 0-100, breakdown dict)."""
    breakdown = {}

    # Keywords in description/page text (0-35 points)
    text = (lead.get("description", "") + " " + page_text).lower()
    kw_score = 0
    if any(k in text for k in KEYWORDS["high"]):
        kw_score = 35
    elif any(k in text for k in KEYWORDS["medium"]):
        kw_score = 20
    elif any(k in text for k in KEYWORDS["low"]):
        kw_score = 10
    breakdown["keywords"] = kw_score

    # Business domain (0-20 points)
    email = (lead.get("email") or "").lower()
    if email and "@" in email:
        domain = email.split("@")[1]
        breakdown["domain"] = 0 if domain in FREE_DOMAINS else 20
    else:
        breakdown["domain"] = 5  # no email = neutral

    # Has website (0-15 points)
    breakdown["website"] = 15 if lead.get("website") else 0

    # Country priority (0-20 points)
    country = (lead.get("country") or "").upper()
    breakdown["country"] = COUNTRY_SCORES.get(country, 5)

    # Has phone (0-10 points)
    breakdown["phone"] = 10 if lead.get("phone") else 0

    total = sum(breakdown.values())
    return min(total, 100), breakdown
