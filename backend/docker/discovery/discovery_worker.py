"""
ECS Fargate discovery worker.
Reads DISCOVERY_RUN_ID from env, fetches profile config from DB,
searches for websites using configured source adapters,
scores and inserts discovered sites, optionally auto-starts scraping.
"""

import os
import sys
import json
import time
from datetime import datetime, timezone
from urllib.parse import urlparse

import logging

import psycopg2
import psycopg2.extras

from scoring import calculate_discovery_score
from sources import SOURCE_REGISTRY

# Configurable query delay (ms) between discovery API calls
DISCOVERY_QUERY_DELAY_S = int(os.environ.get("DISCOVERY_QUERY_DELAY_MS", "1000")) / 1000.0

# Default excluded domains — directories, social, aggregators that waste scraper time
DEFAULT_EXCLUDED_DOMAINS = {
    # Social media
    "facebook.com", "www.facebook.com", "m.facebook.com",
    "instagram.com", "www.instagram.com",
    "twitter.com", "x.com",
    "linkedin.com", "www.linkedin.com",
    "tiktok.com", "www.tiktok.com",
    "pinterest.com", "www.pinterest.com",
    "youtube.com", "www.youtube.com",
    # Directories & review sites
    "yelp.com", "m.yelp.com", "www.yelp.com",
    "bbb.org", "www.bbb.org",
    "glassdoor.com", "www.glassdoor.com",
    "indeed.com", "www.indeed.com",
    "thumbtack.com", "www.thumbtack.com",
    "clutch.co", "www.clutch.co",
    "bark.com", "www.bark.com",
    "angieslist.com", "www.angieslist.com",
    "trustpilot.com", "www.trustpilot.com",
    "g2.com", "www.g2.com",
    # Industry aggregators
    "productionhub.com", "www.productionhub.com",
    "mandy.com", "www.mandy.com",
    "staffmeup.com", "www.staffmeup.com",
    "productionbeast.com",
    "stage32.com", "www.stage32.com",
    # Reference / encyclopedias
    "en.wikipedia.org", "wikipedia.org",
    "imdb.com", "www.imdb.com",
    # Government
    "nyc.gov", "www.nyc.gov",
    "ny.gov", "ca.gov", "gov.uk",
    # General platforms
    "reddit.com", "www.reddit.com", "old.reddit.com",
    "medium.com",
    "wordpress.com",
    "blogspot.com",
    "tumblr.com",
    "quora.com", "www.quora.com",
    "craigslist.org",
    # Maps / listings
    "google.com", "maps.google.com",
    "mapquest.com",
    "yellowpages.com", "www.yellowpages.com",
    "whitepages.com",
    "manta.com", "www.manta.com",
    "dnb.com", "www.dnb.com",
    # News / media
    "nytimes.com", "forbes.com", "bloomberg.com",
    "variety.com", "deadline.com", "hollywoodreporter.com",
}

# Configure log level from env
LOG_LEVEL = os.environ.get("LOG_LEVEL", "INFO").upper()
logging.basicConfig(level=getattr(logging, LOG_LEVEL, logging.INFO))
logger = logging.getLogger("discovery_worker")


def get_db_connection():
    return psycopg2.connect(
        host=os.environ["DB_HOST"],
        dbname=os.environ["DB_NAME"],
        user=os.environ["DB_USER"],
        password=os.environ["DB_PASSWORD"],
        sslmode="require",
    )


def extract_domain(url: str) -> str:
    """Extract clean domain from URL."""
    try:
        parsed = urlparse(url)
        domain = parsed.netloc.lower()
        if domain.startswith("www."):
            domain = domain[4:]
        return domain
    except Exception:
        return ""


def run_discovery(run_id: str):
    """Main discovery execution loop."""
    conn = get_db_connection()
    conn.autocommit = True
    cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

    try:
        # Fetch run
        cur.execute("SELECT * FROM crm_discovery_runs WHERE id = %s", (run_id,))
        run = cur.fetchone()
        if not run:
            print(f"Discovery run {run_id} not found")
            sys.exit(1)

        profile = run["profile_snapshot"]
        if isinstance(profile, str):
            profile = json.loads(profile)

        # Update status to running
        cur.execute("""
            UPDATE crm_discovery_runs SET status = 'running', started_at = NOW()
            WHERE id = %s
        """, (run_id,))

        search_keywords = profile.get("search_keywords", [])
        locations = profile.get("locations", [""])
        source_types = profile.get("source_types", ["google_search"])
        max_results = profile.get("max_results_per_query", 100)
        radius_miles = profile.get("search_radius_miles", 50)
        must_have_website = profile.get("must_have_website", True)
        excluded_domains = DEFAULT_EXCLUDED_DOMAINS | set(d.lower() for d in profile.get("excluded_domains", []))
        min_discovery_score = profile.get("min_discovery_score", 0)

        # Load domains from all previous runs to avoid duplicates
        cur.execute("SELECT DISTINCT domain FROM crm_discovery_sites WHERE run_id != %s", (run_id,))
        existing_domains = set(row["domain"] for row in cur.fetchall())
        logger.info(f"Loaded {len(existing_domains)} existing domains to skip")

        source_stats = {}
        total_found = 0
        skipped_existing = 0

        for source_type in source_types:
            adapter_class = SOURCE_REGISTRY.get(source_type)
            if not adapter_class:
                print(f"Unknown source type: {source_type}")
                continue

            adapter = adapter_class()
            type_stats = {"queries": 0, "results": 0, "inserted": 0, "filtered": 0}

            for keyword in search_keywords:
                for location in (locations or [""]):
                    type_stats["queries"] += 1

                    try:
                        results = adapter.search(
                            query=keyword,
                            location=location,
                            max_results=max_results,
                            radius_miles=radius_miles,
                        )
                        type_stats["results"] += len(results)

                        for result in results:
                            url = result.get("url", "")
                            if not url:
                                if must_have_website:
                                    type_stats["filtered"] += 1
                                    continue

                            domain = extract_domain(url)
                            if not domain:
                                type_stats["filtered"] += 1
                                continue

                            if domain in excluded_domains:
                                type_stats["filtered"] += 1
                                continue

                            if domain in existing_domains:
                                skipped_existing += 1
                                type_stats["filtered"] += 1
                                continue

                            # Score the site
                            score, breakdown = calculate_discovery_score(result, profile)
                            if score < min_discovery_score:
                                type_stats["filtered"] += 1
                                continue

                            # Insert or update (higher score wins)
                            try:
                                cur.execute("""
                                    INSERT INTO crm_discovery_sites (
                                        run_id, domain, homepage_url, company_name,
                                        source_type, raw_metadata, snippet, location,
                                        match_score, score_breakdown
                                    ) VALUES (
                                        %s, %s, %s, %s,
                                        %s, %s::jsonb, %s, %s,
                                        %s, %s::jsonb
                                    )
                                    ON CONFLICT (run_id, domain) DO UPDATE
                                    SET match_score = GREATEST(crm_discovery_sites.match_score, EXCLUDED.match_score),
                                        score_breakdown = CASE
                                            WHEN EXCLUDED.match_score > crm_discovery_sites.match_score
                                            THEN EXCLUDED.score_breakdown
                                            ELSE crm_discovery_sites.score_breakdown
                                        END,
                                        snippet = COALESCE(NULLIF(EXCLUDED.snippet, ''), crm_discovery_sites.snippet),
                                        company_name = COALESCE(NULLIF(EXCLUDED.company_name, ''), crm_discovery_sites.company_name)
                                """, (
                                    run_id, domain, url, result.get("name", ""),
                                    source_type, json.dumps(result.get("raw", {})),
                                    result.get("snippet", ""), result.get("location", ""),
                                    score, json.dumps(breakdown),
                                ))
                                type_stats["inserted"] += 1
                                total_found += 1
                            except Exception as e:
                                print(f"Error inserting site {domain}: {e}")

                    except Exception as e:
                        print(f"Error searching {source_type} for '{keyword}' in '{location}': {e}")

                    # Configurable delay between queries
                    time.sleep(DISCOVERY_QUERY_DELAY_S)

            source_stats[source_type] = type_stats

        # Get actual site count
        cur.execute("SELECT COUNT(*) as cnt FROM crm_discovery_sites WHERE run_id = %s", (run_id,))
        actual_count = cur.fetchone()["cnt"]

        # Update run with final stats
        cur.execute("""
            UPDATE crm_discovery_runs
            SET status = 'completed',
                finished_at = NOW(),
                source_stats = %s::jsonb,
                sites_found_count = %s
            WHERE id = %s
        """, (json.dumps(source_stats), actual_count, run_id))

        print(f"Discovery run {run_id} completed: {actual_count} new sites found, {skipped_existing} duplicates skipped")
        print(f"Source stats: {json.dumps(source_stats)}")

        # Auto-start scraping if configured
        auto_start = profile.get("auto_start_scraping", False)
        scrape_profile_id = profile.get("default_scrape_profile_id")

        if auto_start and scrape_profile_id:
            _auto_start_scraping(cur, run_id, scrape_profile_id, min_discovery_score)

    except Exception as e:
        print(f"Discovery run {run_id} failed: {e}")
        try:
            cur.execute("""
                UPDATE crm_discovery_runs
                SET status = 'failed', finished_at = NOW(), error_message = %s
                WHERE id = %s
            """, (str(e)[:1000], run_id))
        except Exception:
            pass
        raise
    finally:
        cur.close()
        conn.close()


def _auto_start_scraping(cur, run_id: str, scrape_profile_id: str, min_score: int):
    """Auto-create a scrape job from qualifying discovery sites."""
    try:
        # Fetch scrape profile for snapshot
        cur.execute("SELECT * FROM crm_scrape_profiles WHERE id = %s", (scrape_profile_id,))
        sp = cur.fetchone()
        if not sp:
            print(f"Scrape profile {scrape_profile_id} not found, skipping auto-start")
            return

        sp_snapshot = {k: v for k, v in dict(sp).items()
                       if k not in ("created_at", "updated_at", "created_by")}
        for k, v in sp_snapshot.items():
            if hasattr(v, 'isoformat'):
                sp_snapshot[k] = v.isoformat()

        # Count qualifying sites
        cur.execute("""
            SELECT COUNT(*) as cnt FROM crm_discovery_sites
            WHERE run_id = %s AND match_score >= %s
        """, (run_id, min_score))
        count = cur.fetchone()["cnt"]

        if count == 0:
            print(f"No sites above min_score {min_score}, skipping auto-start")
            return

        # Get the run's created_by
        cur.execute("SELECT created_by FROM crm_discovery_runs WHERE id = %s", (run_id,))
        run_row = cur.fetchone()

        # Create scrape job
        cur.execute("""
            INSERT INTO crm_scrape_jobs (
                discovery_run_id, scrape_profile_id, created_by, filters,
                total_sites, profile_snapshot
            ) VALUES (%s, %s, %s, '{}'::jsonb, %s, %s::jsonb)
            RETURNING id
        """, (run_id, scrape_profile_id, run_row["created_by"], count,
              json.dumps(sp_snapshot, default=str)))
        job = cur.fetchone()
        job_id = job["id"]

        # Mark qualifying sites as selected
        cur.execute("""
            UPDATE crm_discovery_sites
            SET is_selected_for_scraping = true, scrape_job_id = %s
            WHERE run_id = %s AND match_score >= %s
        """, (job_id, run_id, min_score))

        # Update run stats
        cur.execute("""
            UPDATE crm_discovery_runs SET sites_selected_count = %s WHERE id = %s
        """, (count, run_id))

        # Trigger ECS scraper
        try:
            import boto3
            ecs_client = boto3.client('ecs', region_name='us-east-1')
            response = ecs_client.run_task(
                cluster='swn-scraper-cluster',
                taskDefinition='swn-scraper-task',
                launchType='FARGATE',
                capacityProviderStrategy=[{'capacityProvider': 'FARGATE_SPOT', 'weight': 1}],
                networkConfiguration={
                    'awsvpcConfiguration': {
                        'subnets': ['subnet-097d1d86c1bc18b3b', 'subnet-013241dd6ffc1e819'],
                        'securityGroups': ['sg-01b01424383262ebd'],
                        'assignPublicIp': 'ENABLED'
                    }
                },
                overrides={
                    'containerOverrides': [{
                        'name': 'scraper-worker',
                        'environment': [
                            {'name': 'JOB_ID', 'value': str(job_id)},
                        ]
                    }]
                },
                count=1
            )
            if response.get('tasks'):
                arn = response['tasks'][0]['taskArn']
                cur.execute(
                    "UPDATE crm_scrape_jobs SET ecs_task_arn = %s WHERE id = %s",
                    (arn, job_id),
                )
                print(f"Auto-started scrape job {job_id}, ECS task: {arn}")
        except Exception as e:
            print(f"Failed to auto-start ECS scraper: {e}")

        print(f"Auto-start: created scrape job {job_id} with {count} sites")

    except Exception as e:
        print(f"Auto-start scraping failed: {e}")


if __name__ == "__main__":
    run_id = os.environ.get("DISCOVERY_RUN_ID")
    if not run_id:
        print("DISCOVERY_RUN_ID environment variable not set")
        sys.exit(1)

    print(f"Starting discovery worker for run {run_id}")
    run_discovery(run_id)
