"""
Message Templates API Routes
System templates for quick message composition (applicant outreach, etc.)
"""
from fastapi import APIRouter, HTTPException
from typing import List, Optional
from pydantic import BaseModel
from app.core.database import get_client
import logging

logger = logging.getLogger(__name__)
router = APIRouter()


class SystemTemplate(BaseModel):
    id: str
    name: str
    slug: str
    category: str
    body: str
    variables: List[str]
    context_type: Optional[str]
    sort_order: int


@router.get("/system", response_model=List[SystemTemplate])
async def list_system_templates(
    category: Optional[str] = None,
    context_type: Optional[str] = None
):
    """
    List system-defined message templates.

    Args:
        category: Filter by category (e.g., 'applicant')
        context_type: Filter by context type (e.g., 'applicant')
    """
    try:
        client = get_client()

        query = client.table("message_templates_system").select(
            "id, name, slug, category, body, variables, context_type, sort_order"
        ).eq("is_active", True)

        if category:
            query = query.eq("category", category)

        if context_type:
            query = query.eq("context_type", context_type)

        response = query.order("sort_order").execute()

        templates = []
        for row in (response.data or []):
            # Parse variables JSON if it's a string
            variables = row.get("variables", [])
            if isinstance(variables, str):
                import json
                try:
                    variables = json.loads(variables)
                except:
                    variables = []

            templates.append({
                "id": str(row["id"]),
                "name": row["name"],
                "slug": row["slug"],
                "category": row["category"],
                "body": row["body"],
                "variables": variables or [],
                "context_type": row.get("context_type"),
                "sort_order": row.get("sort_order", 0)
            })

        return templates

    except Exception as e:
        logger.error(f"Error fetching system templates: {e}")
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/system/{slug}", response_model=SystemTemplate)
async def get_system_template(slug: str):
    """Get a specific system template by slug."""
    try:
        client = get_client()

        response = client.table("message_templates_system").select(
            "id, name, slug, category, body, variables, context_type, sort_order"
        ).eq("slug", slug).eq("is_active", True).single().execute()

        if not response.data:
            raise HTTPException(status_code=404, detail="Template not found")

        row = response.data
        variables = row.get("variables", [])
        if isinstance(variables, str):
            import json
            try:
                variables = json.loads(variables)
            except:
                variables = []

        return {
            "id": str(row["id"]),
            "name": row["name"],
            "slug": row["slug"],
            "category": row["category"],
            "body": row["body"],
            "variables": variables or [],
            "context_type": row.get("context_type"),
            "sort_order": row.get("sort_order", 0)
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching system template: {e}")
        raise HTTPException(status_code=400, detail=str(e))
