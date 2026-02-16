"""
ECS Fargate scraper worker.
Reads JOB_ID from env, fetches source config from DB, scrapes pages,
inserts leads into crm_scraped_leads, and updates job status.
"""

import os
import sys
import json
import time
import re
from datetime import datetime, timezone
from urllib.parse import urljoin, urlparse
from urllib.robotparser import RobotFileParser

import psycopg2
import psycopg2.extras
import requests
from bs4 import BeautifulSoup

from scoring import calculate_match_score

USER_AGENT = "SWN-LeadFinder/1.0 (business directory research)"

# Free email domains to skip
FREE_DOMAINS = {"gmail.com", "yahoo.com", "hotmail.com", "outlook.com", "aol.com",
                "icloud.com", "mail.com", "protonmail.com", "zoho.com"}


def get_db_connection():
    return psycopg2.connect(
        host=os.environ["DB_HOST"],
        dbname=os.environ["DB_NAME"],
        user=os.environ["DB_USER"],
        password=os.environ["DB_PASSWORD"],
        sslmode="require",
    )


def check_robots_txt(base_url: str) -> bool:
    """Check if robots.txt allows our scraping."""
    try:
        parsed = urlparse(base_url)
        robots_url = f"{parsed.scheme}://{parsed.netloc}/robots.txt"
        rp = RobotFileParser()
        rp.set_url(robots_url)
        rp.read()
        return rp.can_fetch(USER_AGENT, base_url)
    except Exception:
        return True  # If we can't read robots.txt, proceed cautiously


def normalize_url(url: str) -> str:
    """Normalize a URL: add scheme if missing, strip trailing slash."""
    if not url:
        return url
    url = url.strip()
    if not url.startswith(("http://", "https://")):
        url = "https://" + url
    return url.rstrip("/")


def clean_email(email: str) -> str:
    """Clean email: strip mailto: prefix, whitespace."""
    if not email:
        return email
    email = email.strip()
    if email.startswith("mailto:"):
        email = email[7:]
    # Strip any query params (mailto:foo@bar.com?subject=...)
    if "?" in email:
        email = email.split("?")[0]
    return email.lower()


def is_free_email(email: str) -> bool:
    """Check if email uses a free/personal domain."""
    if not email or "@" not in email:
        return False
    domain = email.split("@")[1].lower()
    return domain in FREE_DOMAINS


def extract_field(item, selector: str) -> str:
    """Extract text or attribute from an element using a selector.
    Supports @attr suffix for attributes (e.g., 'a.link@href').
    """
    if not selector:
        return ""

    attr = None
    if "@" in selector:
        selector, attr = selector.rsplit("@", 1)

    el = item.select_one(selector)
    if not el:
        return ""

    if attr:
        return (el.get(attr) or "").strip()
    return el.get_text(strip=True)


def scrape_page(url: str, selectors: dict, rate_limit_ms: int, session: requests.Session) -> tuple:
    """Scrape a single page. Returns (leads_list, next_page_url)."""
    resp = session.get(url, timeout=30)
    resp.raise_for_status()

    soup = BeautifulSoup(resp.text, "html.parser")
    leads = []

    list_selector = selectors.get("list_item", "")
    if not list_selector:
        return leads, None

    items = soup.select(list_selector)
    page_text = soup.get_text(" ", strip=True)

    for item in items:
        lead = {
            "company_name": extract_field(item, selectors.get("company_name", "")),
            "website": normalize_url(extract_field(item, selectors.get("website", ""))),
            "email": clean_email(extract_field(item, selectors.get("email", ""))),
            "phone": extract_field(item, selectors.get("phone", "")),
            "address": extract_field(item, selectors.get("address", "")),
            "description": extract_field(item, selectors.get("description", "")),
        }

        # Skip leads without company name
        if not lead["company_name"]:
            continue

        # Skip free-email-only leads
        if lead["email"] and is_free_email(lead["email"]) and not lead["website"]:
            continue

        # Try to extract city/state/country from address
        address = lead.get("address", "")
        if address:
            parts = [p.strip() for p in address.split(",")]
            if len(parts) >= 3:
                lead["city"] = parts[-3]
                lead["state"] = parts[-2]
                lead["country"] = parts[-1]
            elif len(parts) == 2:
                lead["city"] = parts[0]
                lead["state"] = parts[1]

        # Calculate score
        score, breakdown = calculate_match_score(lead, page_text)
        lead["match_score"] = score
        lead["score_breakdown"] = breakdown
        lead["raw_data"] = {"source_url": url, "html_snippet": str(item)[:2000]}

        leads.append(lead)

    # Find next page URL
    next_url = None
    next_selector = selectors.get("pagination_next", "")
    pagination_param = selectors.get("pagination_param", "")

    if next_selector:
        next_url = extract_field(soup, next_selector)
        if next_url and not next_url.startswith("http"):
            next_url = urljoin(url, next_url)
    elif pagination_param:
        # Increment page parameter
        parsed = urlparse(url)
        params = dict(p.split("=") for p in parsed.query.split("&") if "=" in p) if parsed.query else {}
        current_page = int(params.get(pagination_param, "1"))
        params[pagination_param] = str(current_page + 1)
        query = "&".join(f"{k}={v}" for k, v in params.items())
        next_url = f"{parsed.scheme}://{parsed.netloc}{parsed.path}?{query}"

    return leads, next_url


def run_job(job_id: str):
    """Main job execution loop."""
    conn = get_db_connection()
    conn.autocommit = True
    cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

    try:
        # Fetch job and source
        cur.execute("""
            SELECT j.*, s.base_url, s.selectors, s.max_pages, s.rate_limit_ms, s.name as source_name
            FROM crm_scrape_jobs j
            JOIN crm_scrape_sources s ON s.id = j.source_id
            WHERE j.id = %s
        """, (job_id,))
        job = cur.fetchone()

        if not job:
            print(f"Job {job_id} not found")
            sys.exit(1)

        # Update status to running
        cur.execute("""
            UPDATE crm_scrape_jobs SET status = 'running', started_at = NOW()
            WHERE id = %s
        """, (job_id,))

        selectors = job["selectors"] if isinstance(job["selectors"], dict) else json.loads(job["selectors"])
        filters = job["filters"] if isinstance(job["filters"], dict) else json.loads(job["filters"] or "{}")
        max_pages = filters.get("max_pages", job["max_pages"]) or 10
        rate_limit_ms = job["rate_limit_ms"] or 2000
        base_url = job["base_url"]

        # Check robots.txt
        if not check_robots_txt(base_url):
            cur.execute("""
                UPDATE crm_scrape_jobs
                SET status = 'failed', finished_at = NOW(), error_message = 'Blocked by robots.txt'
                WHERE id = %s
            """, (job_id,))
            print(f"Blocked by robots.txt for {base_url}")
            return

        session = requests.Session()
        session.headers.update({"User-Agent": USER_AGENT})

        stats = {"pages_scraped": 0, "leads_found": 0, "duplicates_skipped": 0, "errors": 0}
        current_url = base_url

        for page_num in range(max_pages):
            if not current_url:
                break

            try:
                print(f"Scraping page {page_num + 1}: {current_url}")
                leads, next_url = scrape_page(current_url, selectors, rate_limit_ms, session)
                stats["pages_scraped"] += 1

                for lead in leads:
                    try:
                        cur.execute("""
                            INSERT INTO crm_scraped_leads (
                                job_id, company_name, website, email, phone,
                                address, city, state, country, description,
                                match_score, score_breakdown, raw_data
                            ) VALUES (
                                %s, %s, %s, %s, %s,
                                %s, %s, %s, %s, %s,
                                %s, %s::jsonb, %s::jsonb
                            )
                            ON CONFLICT (job_id, website) WHERE website IS NOT NULL
                            DO NOTHING
                        """, (
                            job_id,
                            lead.get("company_name"),
                            lead.get("website"),
                            lead.get("email"),
                            lead.get("phone"),
                            lead.get("address"),
                            lead.get("city"),
                            lead.get("state"),
                            lead.get("country"),
                            lead.get("description"),
                            lead.get("match_score", 0),
                            json.dumps(lead.get("score_breakdown", {})),
                            json.dumps(lead.get("raw_data", {})),
                        ))
                        if cur.rowcount > 0:
                            stats["leads_found"] += 1
                        else:
                            stats["duplicates_skipped"] += 1
                    except Exception as e:
                        print(f"Error inserting lead: {e}")
                        stats["errors"] += 1

                # Update stats incrementally
                cur.execute("""
                    UPDATE crm_scrape_jobs SET stats = %s::jsonb WHERE id = %s
                """, (json.dumps(stats), job_id))

                current_url = next_url

                # Rate limit between pages
                if page_num < max_pages - 1 and current_url:
                    time.sleep(rate_limit_ms / 1000.0)

            except Exception as e:
                print(f"Error scraping page {current_url}: {e}")
                stats["errors"] += 1
                break

        # Complete
        cur.execute("""
            UPDATE crm_scrape_jobs
            SET status = 'completed', finished_at = NOW(), stats = %s::jsonb
            WHERE id = %s
        """, (json.dumps(stats), job_id))
        print(f"Job {job_id} completed: {stats}")

    except Exception as e:
        print(f"Job {job_id} failed: {e}")
        try:
            cur.execute("""
                UPDATE crm_scrape_jobs
                SET status = 'failed', finished_at = NOW(), error_message = %s
                WHERE id = %s
            """, (str(e)[:1000], job_id))
        except Exception:
            pass
        raise
    finally:
        cur.close()
        conn.close()


if __name__ == "__main__":
    job_id = os.environ.get("JOB_ID")
    if not job_id:
        print("JOB_ID environment variable not set")
        sys.exit(1)

    print(f"Starting scraper worker for job {job_id}")
    run_job(job_id)
