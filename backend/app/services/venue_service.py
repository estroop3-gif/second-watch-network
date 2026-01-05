"""
Venue Service
Phase 2C: Service for managing venue partners and distribution deals.

This service handles:
- Venue partner CRUD operations
- Distribution deal management
- Screening tracking
- Revenue calculations for venue deals
"""

import logging
from datetime import datetime, date
from typing import Dict, Any, List, Optional
import re

from app.core.database import execute_query, execute_single, execute_insert, execute_update

logger = logging.getLogger(__name__)


class VenueService:
    """Service for venue partnership and distribution deal management."""

    # Deal status transitions
    DEAL_STATUS_TRANSITIONS = {
        'draft': ['proposed', 'cancelled'],
        'proposed': ['negotiating', 'cancelled'],
        'negotiating': ['pending_approval', 'cancelled'],
        'pending_approval': ['active', 'cancelled'],
        'active': ['completed', 'terminated'],
        'completed': [],
        'expired': [],
        'terminated': [],
        'cancelled': []
    }

    # =========================================================================
    # VENUE PARTNERS
    # =========================================================================

    @staticmethod
    async def create_venue_partner(
        name: str,
        venue_type: str,
        region: Optional[str] = None,
        created_by: Optional[str] = None,
        **kwargs
    ) -> Dict[str, Any]:
        """Create a new venue partner."""
        # Generate slug
        slug = re.sub(r'[^a-z0-9]+', '-', name.lower()).strip('-')

        # Check uniqueness
        existing = execute_single(
            "SELECT id FROM venue_partners WHERE slug = :slug",
            {"slug": slug}
        )
        if existing:
            # Append number to make unique
            count = execute_single(
                "SELECT COUNT(*) as c FROM venue_partners WHERE slug LIKE :pattern",
                {"pattern": f"{slug}%"}
            )
            slug = f"{slug}-{count['c'] + 1}"

        import json
        partner = execute_insert("""
            INSERT INTO venue_partners (
                name, slug, description, venue_type, region,
                territories, primary_contact_name, primary_contact_email,
                primary_contact_phone, booking_contact_name, booking_contact_email,
                website_url, logo_url, screening_capabilities,
                default_revenue_split_percent, status, created_by
            ) VALUES (
                :name, :slug, :description, :venue_type, :region,
                :territories, :primary_contact_name, :primary_contact_email,
                :primary_contact_phone, :booking_contact_name, :booking_contact_email,
                :website_url, :logo_url, :screening_capabilities,
                :default_revenue_split_percent, 'prospect', :created_by
            )
            RETURNING *
        """, {
            "name": name,
            "slug": slug,
            "description": kwargs.get('description'),
            "venue_type": venue_type,
            "region": region,
            "territories": json.dumps(kwargs.get('territories', [])),
            "primary_contact_name": kwargs.get('primary_contact_name'),
            "primary_contact_email": kwargs.get('primary_contact_email'),
            "primary_contact_phone": kwargs.get('primary_contact_phone'),
            "booking_contact_name": kwargs.get('booking_contact_name'),
            "booking_contact_email": kwargs.get('booking_contact_email'),
            "website_url": kwargs.get('website_url'),
            "logo_url": kwargs.get('logo_url'),
            "screening_capabilities": json.dumps(kwargs.get('screening_capabilities', {})),
            "default_revenue_split_percent": kwargs.get('default_revenue_split_percent'),
            "created_by": created_by
        })

        logger.info("venue_partner_created", partner_id=partner['id'], name=name)

        return dict(partner)

    @staticmethod
    async def update_venue_partner(
        partner_id: str,
        **updates
    ) -> Optional[Dict[str, Any]]:
        """Update a venue partner."""
        allowed_fields = [
            'name', 'description', 'logo_url', 'website_url', 'region',
            'territories', 'primary_contact_name', 'primary_contact_email',
            'primary_contact_phone', 'booking_contact_name', 'booking_contact_email',
            'screening_capabilities', 'default_revenue_split_percent',
            'minimum_guarantee_cents', 'typical_license_fee_cents'
        ]

        set_clauses = []
        params = {"partner_id": partner_id}

        import json
        for field in allowed_fields:
            if field in updates and updates[field] is not None:
                if field in ('territories', 'screening_capabilities'):
                    set_clauses.append(f"{field} = :{field}::jsonb")
                    params[field] = json.dumps(updates[field])
                else:
                    set_clauses.append(f"{field} = :{field}")
                    params[field] = updates[field]

        if not set_clauses:
            return None

        set_clauses.append("updated_at = NOW()")

        partner = execute_single(f"""
            UPDATE venue_partners
            SET {', '.join(set_clauses)}
            WHERE id = :partner_id
            RETURNING *
        """, params)

        return dict(partner) if partner else None

    @staticmethod
    async def update_partner_status(
        partner_id: str,
        status: str
    ) -> Optional[Dict[str, Any]]:
        """Update venue partner status."""
        valid_statuses = ['prospect', 'negotiating', 'active', 'paused', 'terminated']
        if status not in valid_statuses:
            return None

        extra_set = ""
        if status == 'active':
            extra_set = ", partnership_start_date = COALESCE(partnership_start_date, CURRENT_DATE)"

        partner = execute_single(f"""
            UPDATE venue_partners
            SET status = :status{extra_set}, updated_at = NOW()
            WHERE id = :partner_id
            RETURNING *
        """, {"partner_id": partner_id, "status": status})

        if partner:
            logger.info("venue_partner_status_updated", partner_id=partner_id, status=status)

        return dict(partner) if partner else None

    @staticmethod
    async def list_venue_partners(
        venue_type: Optional[str] = None,
        status: Optional[str] = None,
        region: Optional[str] = None,
        limit: int = 50,
        offset: int = 0
    ) -> List[Dict[str, Any]]:
        """List venue partners with optional filters."""
        conditions = ["1=1"]
        params = {"limit": limit, "offset": offset}

        if venue_type:
            conditions.append("venue_type = :venue_type")
            params["venue_type"] = venue_type

        if status:
            conditions.append("status = :status")
            params["status"] = status

        if region:
            conditions.append("region = :region")
            params["region"] = region

        partners = execute_query(f"""
            SELECT *
            FROM venue_partners
            WHERE {' AND '.join(conditions)}
            ORDER BY
                CASE status
                    WHEN 'active' THEN 1
                    WHEN 'negotiating' THEN 2
                    WHEN 'prospect' THEN 3
                    ELSE 4
                END,
                total_deals DESC,
                name
            LIMIT :limit OFFSET :offset
        """, params)

        return [dict(p) for p in partners]

    @staticmethod
    async def get_venue_partner(partner_id: str) -> Optional[Dict[str, Any]]:
        """Get venue partner details."""
        partner = execute_single("""
            SELECT *
            FROM venue_partners
            WHERE id = :partner_id
        """, {"partner_id": partner_id})

        return dict(partner) if partner else None

    @staticmethod
    async def get_venue_partner_by_slug(slug: str) -> Optional[Dict[str, Any]]:
        """Get venue partner by slug."""
        partner = execute_single("""
            SELECT *
            FROM venue_partners
            WHERE slug = :slug
        """, {"slug": slug})

        return dict(partner) if partner else None

    # =========================================================================
    # VENUE DEALS
    # =========================================================================

    @staticmethod
    async def create_venue_deal(
        world_id: str,
        venue_partner_id: str,
        deal_type: str,
        rights_type: str,
        start_date: date,
        created_by: Optional[str] = None,
        **kwargs
    ) -> Dict[str, Any]:
        """Create a new venue deal."""
        import json

        deal = execute_insert("""
            INSERT INTO venue_deals (
                world_id, venue_partner_id, deal_type, rights_type,
                start_date, end_date, license_fee_cents, minimum_guarantee_cents,
                revenue_split_percent, per_screening_fee_cents, max_screenings,
                territories, is_exclusive, exclusive_territory,
                delivery_format, technical_requirements, notes,
                status, created_by
            ) VALUES (
                :world_id, :venue_partner_id, :deal_type, :rights_type,
                :start_date, :end_date, :license_fee_cents, :minimum_guarantee_cents,
                :revenue_split_percent, :per_screening_fee_cents, :max_screenings,
                :territories, :is_exclusive, :exclusive_territory,
                :delivery_format, :technical_requirements, :notes,
                'draft', :created_by
            )
            RETURNING *
        """, {
            "world_id": world_id,
            "venue_partner_id": venue_partner_id,
            "deal_type": deal_type,
            "rights_type": rights_type,
            "start_date": start_date,
            "end_date": kwargs.get('end_date'),
            "license_fee_cents": kwargs.get('license_fee_cents'),
            "minimum_guarantee_cents": kwargs.get('minimum_guarantee_cents'),
            "revenue_split_percent": kwargs.get('revenue_split_percent'),
            "per_screening_fee_cents": kwargs.get('per_screening_fee_cents'),
            "max_screenings": kwargs.get('max_screenings'),
            "territories": json.dumps(kwargs.get('territories', ['WORLDWIDE'])),
            "is_exclusive": kwargs.get('is_exclusive', False),
            "exclusive_territory": kwargs.get('exclusive_territory'),
            "delivery_format": kwargs.get('delivery_format'),
            "technical_requirements": kwargs.get('technical_requirements'),
            "notes": kwargs.get('notes'),
            "created_by": created_by
        })

        logger.info("venue_deal_created", deal_id=deal['id'], world_id=world_id, venue_id=venue_partner_id)

        return dict(deal)

    @staticmethod
    async def update_deal_status(
        deal_id: str,
        new_status: str,
        approved_by: Optional[str] = None
    ) -> Optional[Dict[str, Any]]:
        """Update venue deal status with validation."""
        current = execute_single(
            "SELECT status FROM venue_deals WHERE id = :deal_id",
            {"deal_id": deal_id}
        )

        if not current:
            return None

        current_status = current['status']
        valid_transitions = VenueService.DEAL_STATUS_TRANSITIONS.get(current_status, [])

        if new_status not in valid_transitions and new_status != current_status:
            logger.warning(
                "invalid_deal_status_transition",
                deal_id=deal_id,
                current=current_status,
                attempted=new_status
            )
            return None

        extra_set = ""
        params = {"deal_id": deal_id, "status": new_status}

        if new_status == 'active' and approved_by:
            extra_set = ", approved_by = :approved_by, approved_at = NOW()"
            params["approved_by"] = approved_by

        deal = execute_single(f"""
            UPDATE venue_deals
            SET status = :status{extra_set}, updated_at = NOW()
            WHERE id = :deal_id
            RETURNING *
        """, params)

        if deal:
            logger.info("venue_deal_status_updated", deal_id=deal_id, status=new_status)

        return dict(deal) if deal else None

    @staticmethod
    async def get_venue_deal(deal_id: str) -> Optional[Dict[str, Any]]:
        """Get venue deal with partner and world info."""
        deal = execute_single("""
            SELECT
                vd.*,
                vp.name as venue_name,
                vp.venue_type,
                vp.region as venue_region,
                w.title as world_title,
                w.slug as world_slug
            FROM venue_deals vd
            JOIN venue_partners vp ON vd.venue_partner_id = vp.id
            JOIN worlds w ON vd.world_id = w.id
            WHERE vd.id = :deal_id
        """, {"deal_id": deal_id})

        return dict(deal) if deal else None

    @staticmethod
    async def list_deals_for_world(
        world_id: str,
        status: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        """Get all venue deals for a World."""
        conditions = ["vd.world_id = :world_id"]
        params = {"world_id": world_id}

        if status:
            conditions.append("vd.status = :status")
            params["status"] = status

        deals = execute_query(f"""
            SELECT
                vd.*,
                vp.name as venue_name,
                vp.venue_type,
                vp.region as venue_region
            FROM venue_deals vd
            JOIN venue_partners vp ON vd.venue_partner_id = vp.id
            WHERE {' AND '.join(conditions)}
            ORDER BY vd.start_date DESC
        """, params)

        return [dict(d) for d in deals]

    @staticmethod
    async def list_deals_for_venue(
        venue_partner_id: str,
        status: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        """Get all deals for a venue partner."""
        conditions = ["vd.venue_partner_id = :venue_partner_id"]
        params = {"venue_partner_id": venue_partner_id}

        if status:
            conditions.append("vd.status = :status")
            params["status"] = status

        deals = execute_query(f"""
            SELECT
                vd.*,
                w.title as world_title,
                w.slug as world_slug,
                w.cover_art_url as world_cover_art
            FROM venue_deals vd
            JOIN worlds w ON vd.world_id = w.id
            WHERE {' AND '.join(conditions)}
            ORDER BY vd.start_date DESC
        """, params)

        return [dict(d) for d in deals]

    @staticmethod
    async def get_active_deals_for_world(world_id: str) -> List[Dict[str, Any]]:
        """Get currently active venue deals for a World."""
        deals = execute_query("""
            SELECT
                vd.*,
                vp.name as venue_name,
                vp.venue_type
            FROM venue_deals vd
            JOIN venue_partners vp ON vd.venue_partner_id = vp.id
            WHERE vd.world_id = :world_id
              AND vd.status = 'active'
              AND vd.start_date <= CURRENT_DATE
              AND (vd.end_date IS NULL OR vd.end_date >= CURRENT_DATE)
        """, {"world_id": world_id})

        return [dict(d) for d in deals]

    @staticmethod
    async def get_worlds_for_venue(
        venue_partner_id: str,
        include_inactive: bool = False
    ) -> List[Dict[str, Any]]:
        """Get all Worlds available to a venue through active deals."""
        status_filter = "" if include_inactive else "AND vd.status = 'active'"

        worlds = execute_query(f"""
            SELECT
                w.id as world_id,
                w.title,
                w.slug,
                w.logline,
                w.cover_art_url,
                w.content_format,
                vd.id as deal_id,
                vd.deal_type,
                vd.rights_type,
                vd.start_date,
                vd.end_date,
                vd.status as deal_status
            FROM venue_deals vd
            JOIN worlds w ON vd.world_id = w.id
            WHERE vd.venue_partner_id = :venue_partner_id
              {status_filter}
              AND (vd.end_date IS NULL OR vd.end_date >= CURRENT_DATE)
            ORDER BY w.title
        """, {"venue_partner_id": venue_partner_id})

        return [dict(w) for w in worlds]

    # =========================================================================
    # SCREENINGS
    # =========================================================================

    @staticmethod
    async def create_screening(
        venue_deal_id: str,
        screening_date: date,
        screening_time: Optional[str] = None,
        **kwargs
    ) -> Dict[str, Any]:
        """Create a venue screening event."""
        # Get deal info
        deal = execute_single("""
            SELECT world_id, venue_partner_id
            FROM venue_deals
            WHERE id = :deal_id
        """, {"deal_id": venue_deal_id})

        if not deal:
            raise ValueError("Venue deal not found")

        import json
        screening = execute_insert("""
            INSERT INTO venue_screenings (
                venue_deal_id, world_id, venue_partner_id,
                screening_date, screening_time, timezone,
                location_name, location_address, capacity,
                ticket_price_cents, is_premiere, has_qa,
                qa_participants, special_guests, notes, status
            ) VALUES (
                :venue_deal_id, :world_id, :venue_partner_id,
                :screening_date, :screening_time, :timezone,
                :location_name, :location_address, :capacity,
                :ticket_price_cents, :is_premiere, :has_qa,
                :qa_participants, :special_guests, :notes, 'scheduled'
            )
            RETURNING *
        """, {
            "venue_deal_id": venue_deal_id,
            "world_id": deal['world_id'],
            "venue_partner_id": deal['venue_partner_id'],
            "screening_date": screening_date,
            "screening_time": screening_time,
            "timezone": kwargs.get('timezone', 'America/Los_Angeles'),
            "location_name": kwargs.get('location_name'),
            "location_address": json.dumps(kwargs.get('location_address')) if kwargs.get('location_address') else None,
            "capacity": kwargs.get('capacity'),
            "ticket_price_cents": kwargs.get('ticket_price_cents'),
            "is_premiere": kwargs.get('is_premiere', False),
            "has_qa": kwargs.get('has_qa', False),
            "qa_participants": kwargs.get('qa_participants'),
            "special_guests": kwargs.get('special_guests'),
            "notes": kwargs.get('notes')
        })

        # Update deal screening count
        execute_update("""
            UPDATE venue_deals
            SET total_screenings = total_screenings + 1
            WHERE id = :deal_id
        """, {"deal_id": venue_deal_id})

        logger.info("venue_screening_created", screening_id=screening['id'], deal_id=venue_deal_id)

        return dict(screening)

    @staticmethod
    async def report_screening(
        screening_id: str,
        tickets_sold: int,
        attendance: int,
        gross_revenue_cents: int,
        reported_by: Optional[str] = None
    ) -> Optional[Dict[str, Any]]:
        """Report screening attendance and revenue."""
        screening = execute_single("""
            UPDATE venue_screenings
            SET
                tickets_sold = :tickets_sold,
                attendance = :attendance,
                gross_revenue_cents = :gross_revenue_cents,
                status = 'completed',
                reported_at = NOW(),
                reported_by = :reported_by,
                updated_at = NOW()
            WHERE id = :screening_id
            RETURNING *, venue_deal_id
        """, {
            "screening_id": screening_id,
            "tickets_sold": tickets_sold,
            "attendance": attendance,
            "gross_revenue_cents": gross_revenue_cents,
            "reported_by": reported_by
        })

        if screening:
            # Update deal totals
            execute_update("""
                UPDATE venue_deals
                SET
                    total_attendance = total_attendance + :attendance,
                    gross_revenue_cents = gross_revenue_cents + :gross_revenue,
                    updated_at = NOW()
                WHERE id = :deal_id
            """, {
                "deal_id": screening['venue_deal_id'],
                "attendance": attendance,
                "gross_revenue": gross_revenue_cents
            })

            # Update venue partner totals
            execute_update("""
                UPDATE venue_partners
                SET
                    total_screenings = total_screenings + 1,
                    total_revenue_cents = total_revenue_cents + :gross_revenue,
                    updated_at = NOW()
                WHERE id = (SELECT venue_partner_id FROM venue_deals WHERE id = :deal_id)
            """, {
                "deal_id": screening['venue_deal_id'],
                "gross_revenue": gross_revenue_cents
            })

            logger.info("venue_screening_reported", screening_id=screening_id)

        return dict(screening) if screening else None

    @staticmethod
    async def list_screenings_for_deal(
        venue_deal_id: str,
        status: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        """Get all screenings for a venue deal."""
        conditions = ["venue_deal_id = :venue_deal_id"]
        params = {"venue_deal_id": venue_deal_id}

        if status:
            conditions.append("status = :status")
            params["status"] = status

        screenings = execute_query(f"""
            SELECT *
            FROM venue_screenings
            WHERE {' AND '.join(conditions)}
            ORDER BY screening_date DESC
        """, params)

        return [dict(s) for s in screenings]

    @staticmethod
    async def get_upcoming_screenings(
        world_id: Optional[str] = None,
        venue_partner_id: Optional[str] = None,
        days_ahead: int = 30
    ) -> List[Dict[str, Any]]:
        """Get upcoming screenings."""
        conditions = [
            "vs.screening_date >= CURRENT_DATE",
            "vs.screening_date <= CURRENT_DATE + :days::interval",
            "vs.status IN ('scheduled', 'confirmed')"
        ]
        params = {"days": f"{days_ahead} days"}

        if world_id:
            conditions.append("vs.world_id = :world_id")
            params["world_id"] = world_id

        if venue_partner_id:
            conditions.append("vs.venue_partner_id = :venue_partner_id")
            params["venue_partner_id"] = venue_partner_id

        screenings = execute_query(f"""
            SELECT
                vs.*,
                w.title as world_title,
                vp.name as venue_name,
                vp.venue_type
            FROM venue_screenings vs
            JOIN worlds w ON vs.world_id = w.id
            JOIN venue_partners vp ON vs.venue_partner_id = vp.id
            WHERE {' AND '.join(conditions)}
            ORDER BY vs.screening_date, vs.screening_time
        """, params)

        return [dict(s) for s in screenings]
