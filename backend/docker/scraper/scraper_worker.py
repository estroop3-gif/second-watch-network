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


def extract_generic_data(soup, url: str, company_name: str = "") -> dict:
    """Extract emails, phones, meta info from a page using regex patterns."""
    text = soup.get_text(" ", strip=True)
    html = str(soup)

    # Extract emails
    email_pattern = r'[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}'
    emails = list(set(re.findall(email_pattern, text)))
    emails = [clean_email(e) for e in emails if not is_free_email(e)]

    # Extract phones (US format focus)
    phone_pattern = r'[\+]?1?[-.\s]?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}'
    phones = list(set(re.findall(phone_pattern, text)))

    # Extract meta description
    meta_desc = ""
    meta_tag = soup.find("meta", attrs={"name": "description"})
    if meta_tag:
        meta_desc = meta_tag.get("content", "")

    # Extract title
    title = ""
    title_tag = soup.find("title")
    if title_tag:
        title = title_tag.get_text(strip=True)

    # Extract address-like text
    address = ""
    address_patterns = [
        r'\d+\s+[\w\s]+(?:Street|St|Avenue|Ave|Road|Rd|Boulevard|Blvd|Drive|Dr|Lane|Ln|Way|Court|Ct)[\s,]+[\w\s]+,?\s*[A-Z]{2}\s*\d{5}',
    ]
    for pat in address_patterns:
        m = re.search(pat, text)
        if m:
            address = m.group(0).strip()
            break

    return {
        "emails": emails[:5],
        "phones": phones[:3],
        "description": meta_desc or title,
        "address": address,
        "title": title,
        "company_name": company_name or title.split(" - ")[0].split(" | ")[0].strip() if title else "",
    }


def merge_site_leads(page_data_list: list, site: dict) -> dict:
    """Merge data extracted from multiple pages of one site into a single lead."""
    all_emails = []
    all_phones = []
    descriptions = []
    address = ""
    company = site.get("company_name", "")

    for pd in page_data_list:
        all_emails.extend(pd.get("emails", []))
        all_phones.extend(pd.get("phones", []))
        if pd.get("description"):
            descriptions.append(pd["description"])
        if pd.get("address") and not address:
            address = pd["address"]
        if pd.get("company_name") and not company:
            company = pd["company_name"]

    # Deduplicate
    emails = list(dict.fromkeys(all_emails))
    phones = list(dict.fromkeys(all_phones))

    return {
        "company_name": company or site.get("domain", ""),
        "website": site.get("homepage_url", ""),
        "email": emails[0] if emails else None,
        "phone": phones[0] if phones else None,
        "address": address,
        "description": descriptions[0] if descriptions else None,
        "raw_data": {
            "domain": site.get("domain", ""),
            "all_emails": emails[:10],
            "all_phones": phones[:5],
            "pages_scraped": len(page_data_list),
            "source_type": site.get("source_type", ""),
        },
    }


def run_discovery_based_job(cur, job: dict, job_id: str):
    """Run a discovery-sourced scrape job — scrapes sites from crm_discovery_sites."""
    profile_snapshot = job.get("profile_snapshot", {})
    if isinstance(profile_snapshot, str):
        profile_snapshot = json.loads(profile_snapshot)

    max_pages_per_site = profile_snapshot.get("max_pages_per_site", 5)
    paths_to_visit = profile_snapshot.get("paths_to_visit", ["/about", "/contact", "/team"])
    delay_ms = profile_snapshot.get("delay_ms", 2000)
    respect_robots = profile_snapshot.get("respect_robots_txt", True)
    user_agent = profile_snapshot.get("user_agent", USER_AGENT)
    min_match_score = profile_snapshot.get("min_match_score", 0)
    require_email = profile_snapshot.get("require_email", False)
    require_phone = profile_snapshot.get("require_phone", False)
    scoring_rules = profile_snapshot.get("scoring_rules", {})
    excluded_domains = set(d.lower() for d in profile_snapshot.get("excluded_domains", []))

    # Fetch selected sites for this job
    cur.execute("""
        SELECT * FROM crm_discovery_sites
        WHERE scrape_job_id = %s
        ORDER BY match_score DESC
    """, (job_id,))
    sites = cur.fetchall()

    if not sites:
        print(f"No sites found for job {job_id}")
        return

    session = requests.Session()
    session.headers.update({"User-Agent": user_agent})

    stats = {"sites_total": len(sites), "sites_scraped": 0, "leads_found": 0,
             "leads_filtered": 0, "errors": 0, "pages_scraped": 0}

    for site in sites:
        domain = site.get("domain", "")
        homepage = site.get("homepage_url", "")

        if domain.lower() in excluded_domains:
            continue

        if not homepage:
            homepage = f"https://{domain}"

        # Check robots.txt
        if respect_robots and not check_robots_txt(homepage):
            print(f"Blocked by robots.txt: {domain}")
            stats["errors"] += 1
            continue

        page_data_list = []
        urls_to_visit = [homepage]

        # Add configured paths
        for path in paths_to_visit[:max_pages_per_site - 1]:
            if path.startswith("/"):
                urls_to_visit.append(f"https://{domain}{path}")
            else:
                urls_to_visit.append(f"https://{domain}/{path}")

        urls_to_visit = urls_to_visit[:max_pages_per_site]
        visited = set()

        for url in urls_to_visit:
            if url in visited:
                continue
            visited.add(url)

            try:
                resp = session.get(url, timeout=15, allow_redirects=True)
                if resp.status_code != 200:
                    continue

                soup = BeautifulSoup(resp.text, "html.parser")
                page_data = extract_generic_data(soup, url, site.get("company_name", ""))
                page_data_list.append(page_data)
                stats["pages_scraped"] += 1

            except Exception as e:
                print(f"Error scraping {url}: {e}")
                stats["errors"] += 1

            # Rate limit
            time.sleep(delay_ms / 1000.0)

        if not page_data_list:
            stats["errors"] += 1
            continue

        # Merge multi-page data into single lead
        lead = merge_site_leads(page_data_list, dict(site))

        # Calculate score
        page_text = " ".join(pd.get("description", "") for pd in page_data_list)
        score, breakdown = calculate_match_score(lead, page_text, scoring_rules or None)
        lead["match_score"] = score
        lead["score_breakdown"] = breakdown

        # Apply quality filters
        if score < min_match_score:
            stats["leads_filtered"] += 1
            continue
        if require_email and not lead.get("email"):
            stats["leads_filtered"] += 1
            continue
        if require_phone and not lead.get("phone"):
            stats["leads_filtered"] += 1
            continue

        # Insert lead
        try:
            cur.execute("""
                INSERT INTO crm_scraped_leads (
                    job_id, company_name, website, email, phone,
                    address, description,
                    match_score, score_breakdown, raw_data
                ) VALUES (
                    %s, %s, %s, %s, %s,
                    %s, %s,
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
                lead.get("description"),
                lead.get("match_score", 0),
                json.dumps(lead.get("score_breakdown", {})),
                json.dumps(lead.get("raw_data", {})),
            ))
            if cur.rowcount > 0:
                stats["leads_found"] += 1
        except Exception as e:
            print(f"Error inserting lead for {domain}: {e}")
            stats["errors"] += 1

        stats["sites_scraped"] += 1

        # Update progress
        cur.execute("""
            UPDATE crm_scrape_jobs SET stats = %s::jsonb, sites_scraped = %s WHERE id = %s
        """, (json.dumps(stats), stats["sites_scraped"], job_id))

    return stats


def run_job(job_id: str):
    """Main job execution loop."""
    conn = get_db_connection()
    conn.autocommit = True
    cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

    try:
        # Fetch job — LEFT JOIN since source_id is now nullable
        cur.execute("""
            SELECT j.*, s.base_url, s.selectors, s.max_pages, s.rate_limit_ms, s.name as source_name
            FROM crm_scrape_jobs j
            LEFT JOIN crm_scrape_sources s ON s.id = j.source_id
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

        # Mode 2: Discovery-based job
        if job.get("discovery_run_id") and not job.get("source_id"):
            print(f"Running discovery-based job {job_id}")
            stats = run_discovery_based_job(cur, job, job_id)
            cur.execute("""
                UPDATE crm_scrape_jobs
                SET status = 'completed', finished_at = NOW(), stats = %s::jsonb
                WHERE id = %s
            """, (json.dumps(stats or {}), job_id))
            print(f"Discovery job {job_id} completed: {stats}")
            return

        # Mode 1: Legacy source-based job
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
