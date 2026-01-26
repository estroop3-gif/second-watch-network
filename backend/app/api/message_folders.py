"""
Custom Message Folders API Routes
Allows users to create custom folders to organize DM conversations
"""
from fastapi import APIRouter, HTTPException
from typing import List, Optional, Any, Union
from pydantic import BaseModel
from datetime import datetime, timezone
from app.core.database import get_client, execute_query, execute_single
import logging

logger = logging.getLogger(__name__)
router = APIRouter()


def to_iso_string(value) -> str:
    """Convert a datetime or string to ISO format string."""
    if value is None:
        return ""
    if isinstance(value, str):
        return value
    if hasattr(value, 'isoformat'):
        return value.isoformat()
    return str(value)


# ============================================================================
# SCHEMAS
# ============================================================================

class FolderCreate(BaseModel):
    name: str
    color: Optional[str] = None  # Hex color e.g. "#FF3C3C"
    icon: Optional[str] = None   # Icon name e.g. "star", "work"
    position: Optional[int] = 0


class FolderUpdate(BaseModel):
    name: Optional[str] = None
    color: Optional[str] = None
    icon: Optional[str] = None
    position: Optional[int] = None


class Folder(BaseModel):
    id: str
    name: str
    color: Optional[str]
    icon: Optional[str]
    position: int
    unread_count: int
    conversation_count: int
    created_at: str
    updated_at: str


class FolderAssignment(BaseModel):
    folder_id: str
    conversation_partner_id: str


class RuleCondition(BaseModel):
    type: str  # 'sender', 'keyword', 'context'
    operator: str  # 'in', 'not_in', 'contains', 'not_contains', 'equals', 'not_equals'
    value: Union[str, List[str]]  # List of IDs, keywords, or single value


class RuleCreate(BaseModel):
    folder_id: str
    name: str
    conditions: List[dict]
    condition_logic: str = "AND"  # 'AND' or 'OR'
    priority: int = 0
    is_active: bool = True
    apply_to_existing: bool = False


class RuleUpdate(BaseModel):
    name: Optional[str] = None
    folder_id: Optional[str] = None
    conditions: Optional[List[dict]] = None
    condition_logic: Optional[str] = None
    priority: Optional[int] = None
    is_active: Optional[bool] = None


class Rule(BaseModel):
    id: str
    folder_id: str
    folder_name: str
    name: str
    conditions: List[dict]
    condition_logic: str
    priority: int
    is_active: bool
    created_at: str
    updated_at: str


# ============================================================================
# FOLDER CRUD
# ============================================================================

@router.get("/", response_model=List[Folder])
async def list_folders(user_id: str):
    """List user's custom folders with unread counts."""
    try:
        query = """
            SELECT
                f.id,
                f.name,
                f.color,
                f.icon,
                f.position,
                f.created_at,
                f.updated_at,
                COALESCE(v.unread_count, 0) as unread_count,
                COALESCE(v.conversation_count, 0) as conversation_count
            FROM user_message_folders f
            LEFT JOIN v_custom_folder_unread_counts v ON v.folder_id = f.id
            WHERE f.user_id = :user_id
            ORDER BY f.position ASC, f.created_at ASC
        """
        rows = execute_query(query, {"user_id": user_id})
        return [
            Folder(
                id=str(row["id"]),
                name=row["name"],
                color=row.get("color"),
                icon=row.get("icon"),
                position=row["position"],
                unread_count=row["unread_count"],
                conversation_count=row["conversation_count"],
                created_at=to_iso_string(row.get("created_at")),
                updated_at=to_iso_string(row.get("updated_at")),
            )
            for row in rows
        ]
    except Exception as e:
        logger.error(f"Error listing folders: {e}")
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/", response_model=Folder)
async def create_folder(folder: FolderCreate, user_id: str):
    """Create a new custom folder."""
    try:
        client = get_client()

        # Get max position for user's folders
        max_pos_query = """
            SELECT COALESCE(MAX(position), -1) + 1 as next_position
            FROM user_message_folders
            WHERE user_id = :user_id
        """
        pos_result = execute_single(max_pos_query, {"user_id": user_id})
        next_position = pos_result["next_position"] if pos_result else 0

        # Create folder
        response = client.table("user_message_folders").insert({
            "user_id": user_id,
            "name": folder.name,
            "color": folder.color,
            "icon": folder.icon,
            "position": folder.position if folder.position is not None else next_position,
        }).execute()

        new_folder = response.data[0]

        return Folder(
            id=str(new_folder["id"]),
            name=new_folder["name"],
            color=new_folder.get("color"),
            icon=new_folder.get("icon"),
            position=new_folder["position"],
            unread_count=0,
            conversation_count=0,
            created_at=new_folder["created_at"],
            updated_at=new_folder["updated_at"],
        )
    except Exception as e:
        logger.error(f"Error creating folder: {e}")
        if "unique" in str(e).lower():
            raise HTTPException(status_code=400, detail="A folder with this name already exists")
        raise HTTPException(status_code=400, detail=str(e))


@router.put("/{folder_id}", response_model=Folder)
async def update_folder(folder_id: str, folder: FolderUpdate, user_id: str):
    """Update a custom folder."""
    try:
        client = get_client()

        # Verify ownership
        existing = client.table("user_message_folders").select("id").eq(
            "id", folder_id
        ).eq("user_id", user_id).execute()

        if not existing.data:
            raise HTTPException(status_code=404, detail="Folder not found")

        # Build update data
        update_data = {}
        if folder.name is not None:
            update_data["name"] = folder.name
        if folder.color is not None:
            update_data["color"] = folder.color
        if folder.icon is not None:
            update_data["icon"] = folder.icon
        if folder.position is not None:
            update_data["position"] = folder.position

        if not update_data:
            raise HTTPException(status_code=400, detail="No fields to update")

        response = client.table("user_message_folders").update(
            update_data
        ).eq("id", folder_id).execute()

        updated = response.data[0]

        # Get counts from view
        counts_query = """
            SELECT COALESCE(unread_count, 0) as unread_count,
                   COALESCE(conversation_count, 0) as conversation_count
            FROM v_custom_folder_unread_counts
            WHERE folder_id = :folder_id
        """
        counts = execute_single(counts_query, {"folder_id": folder_id})

        return Folder(
            id=str(updated["id"]),
            name=updated["name"],
            color=updated.get("color"),
            icon=updated.get("icon"),
            position=updated["position"],
            unread_count=counts["unread_count"] if counts else 0,
            conversation_count=counts["conversation_count"] if counts else 0,
            created_at=updated["created_at"],
            updated_at=updated["updated_at"],
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating folder: {e}")
        if "unique" in str(e).lower():
            raise HTTPException(status_code=400, detail="A folder with this name already exists")
        raise HTTPException(status_code=400, detail=str(e))


@router.delete("/{folder_id}")
async def delete_folder(folder_id: str, user_id: str):
    """Delete a custom folder. Conversations are moved back to default inbox."""
    try:
        client = get_client()

        # Verify ownership
        existing = client.table("user_message_folders").select("id").eq(
            "id", folder_id
        ).eq("user_id", user_id).execute()

        if not existing.data:
            raise HTTPException(status_code=404, detail="Folder not found")

        # Delete folder (assignments and rules cascade)
        client.table("user_message_folders").delete().eq("id", folder_id).execute()

        return {"status": "deleted"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting folder: {e}")
        raise HTTPException(status_code=400, detail=str(e))


# ============================================================================
# FOLDER CONVERSATIONS
# ============================================================================

@router.get("/{folder_id}/conversations")
async def list_folder_conversations(folder_id: str, user_id: str):
    """List conversations in a folder."""
    try:
        query = """
            WITH folder_partners AS (
                SELECT a.conversation_partner_id as partner_id
                FROM user_message_folder_assignments a
                WHERE a.folder_id = :folder_id AND a.user_id = :user_id
            ),
            last_messages AS (
                SELECT DISTINCT ON (
                    CASE WHEN dm.sender_id = :user_id THEN dm.recipient_id ELSE dm.sender_id END
                )
                    CASE WHEN dm.sender_id = :user_id THEN dm.recipient_id ELSE dm.sender_id END as partner_id,
                    dm.id as message_id,
                    dm.content as last_message,
                    dm.created_at as last_message_at,
                    dm.read_at
                FROM backlot_direct_messages dm
                WHERE (dm.sender_id = :user_id OR dm.recipient_id = :user_id)
                  AND CASE WHEN dm.sender_id = :user_id THEN dm.recipient_id ELSE dm.sender_id END IN (
                      SELECT partner_id FROM folder_partners
                  )
                ORDER BY
                    CASE WHEN dm.sender_id = :user_id THEN dm.recipient_id ELSE dm.sender_id END,
                    dm.created_at DESC
            ),
            unread_counts AS (
                SELECT
                    dm.sender_id as partner_id,
                    COUNT(*) as unread_count
                FROM backlot_direct_messages dm
                WHERE dm.recipient_id = :user_id
                  AND dm.read_at IS NULL
                  AND dm.sender_id IN (SELECT partner_id FROM folder_partners)
                GROUP BY dm.sender_id
            )
            SELECT
                lm.partner_id as id,
                p.username,
                p.full_name,
                p.avatar_url,
                lm.last_message,
                lm.last_message_at,
                COALESCE(uc.unread_count, 0) as unread_count
            FROM last_messages lm
            JOIN profiles p ON p.id = lm.partner_id
            LEFT JOIN unread_counts uc ON uc.partner_id = lm.partner_id
            ORDER BY lm.last_message_at DESC
        """
        rows = execute_query(query, {"folder_id": folder_id, "user_id": user_id})

        return [
            {
                "id": str(row["id"]),
                "type": "dm",
                "folder": f"custom:{folder_id}",
                "other_participant": {
                    "id": str(row["id"]),
                    "username": row.get("username"),
                    "full_name": row.get("full_name"),
                    "avatar_url": row.get("avatar_url"),
                },
                "last_message": row.get("last_message"),
                "last_message_at": to_iso_string(row.get("last_message_at")) or None,
                "unread_count": row.get("unread_count", 0),
            }
            for row in rows
        ]
    except Exception as e:
        logger.error(f"Error listing folder conversations: {e}")
        raise HTTPException(status_code=400, detail=str(e))


# ============================================================================
# CONVERSATION ASSIGNMENT
# ============================================================================

@router.post("/assign")
async def assign_conversation(assignment: FolderAssignment, user_id: str):
    """Move a conversation to a folder."""
    try:
        client = get_client()

        # Verify folder ownership
        folder_check = client.table("user_message_folders").select("id").eq(
            "id", assignment.folder_id
        ).eq("user_id", user_id).execute()

        if not folder_check.data:
            raise HTTPException(status_code=404, detail="Folder not found")

        # Upsert assignment (one folder per conversation)
        client.table("user_message_folder_assignments").upsert({
            "user_id": user_id,
            "folder_id": assignment.folder_id,
            "conversation_partner_id": assignment.conversation_partner_id,
            "assigned_by": "manual",
            "assigned_at": datetime.now(timezone.utc).isoformat(),
        }, on_conflict="user_id,conversation_partner_id").execute()

        return {"status": "assigned", "folder_id": assignment.folder_id}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error assigning conversation: {e}")
        raise HTTPException(status_code=400, detail=str(e))


@router.delete("/assign/{partner_id}")
async def unassign_conversation(partner_id: str, user_id: str):
    """Remove a conversation from its custom folder (back to default inbox)."""
    try:
        client = get_client()

        client.table("user_message_folder_assignments").delete().eq(
            "user_id", user_id
        ).eq("conversation_partner_id", partner_id).execute()

        return {"status": "unassigned"}
    except Exception as e:
        logger.error(f"Error unassigning conversation: {e}")
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/assignment/{partner_id}")
async def get_conversation_assignment(partner_id: str, user_id: str):
    """Get which folder a conversation is assigned to, if any."""
    try:
        query = """
            SELECT a.folder_id, f.name as folder_name, f.color, f.icon
            FROM user_message_folder_assignments a
            JOIN user_message_folders f ON f.id = a.folder_id
            WHERE a.user_id = :user_id
              AND a.conversation_partner_id = :partner_id
        """
        result = execute_single(query, {"user_id": user_id, "partner_id": partner_id})

        if result:
            return {
                "folder_id": str(result["folder_id"]),
                "folder_name": result["folder_name"],
                "color": result.get("color"),
                "icon": result.get("icon"),
            }
        return None
    except Exception as e:
        logger.error(f"Error getting assignment: {e}")
        raise HTTPException(status_code=400, detail=str(e))


# ============================================================================
# FOLDER RULES
# ============================================================================

@router.get("/rules/", response_model=List[Rule])
async def list_rules(user_id: str):
    """List user's folder rules."""
    try:
        query = """
            SELECT
                r.id,
                r.folder_id,
                f.name as folder_name,
                r.name,
                r.conditions,
                r.condition_logic,
                r.priority,
                r.is_active,
                r.created_at,
                r.updated_at
            FROM user_message_folder_rules r
            JOIN user_message_folders f ON f.id = r.folder_id
            WHERE r.user_id = :user_id
            ORDER BY r.priority DESC, r.created_at ASC
        """
        rows = execute_query(query, {"user_id": user_id})

        return [
            Rule(
                id=str(row["id"]),
                folder_id=str(row["folder_id"]),
                folder_name=row["folder_name"],
                name=row["name"],
                conditions=row.get("conditions", []),
                condition_logic=row.get("condition_logic", "AND"),
                priority=row.get("priority", 0),
                is_active=row.get("is_active", True),
                created_at=to_iso_string(row.get("created_at")),
                updated_at=to_iso_string(row.get("updated_at")),
            )
            for row in rows
        ]
    except Exception as e:
        logger.error(f"Error listing rules: {e}")
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/rules/", response_model=Rule)
async def create_rule(rule: RuleCreate, user_id: str):
    """Create a new folder rule."""
    try:
        client = get_client()

        # Verify folder ownership
        folder_check = client.table("user_message_folders").select("id, name").eq(
            "id", rule.folder_id
        ).eq("user_id", user_id).execute()

        if not folder_check.data:
            raise HTTPException(status_code=404, detail="Folder not found")

        folder_name = folder_check.data[0]["name"]

        # Create rule
        import json
        response = client.table("user_message_folder_rules").insert({
            "user_id": user_id,
            "folder_id": rule.folder_id,
            "name": rule.name,
            "conditions": json.dumps(rule.conditions),
            "condition_logic": rule.condition_logic,
            "priority": rule.priority,
            "is_active": rule.is_active,
        }).execute()

        new_rule = response.data[0]

        # Apply to existing conversations if requested
        if rule.apply_to_existing:
            await apply_rule_to_existing(new_rule["id"], user_id)

        return Rule(
            id=str(new_rule["id"]),
            folder_id=str(new_rule["folder_id"]),
            folder_name=folder_name,
            name=new_rule["name"],
            conditions=new_rule.get("conditions", []),
            condition_logic=new_rule.get("condition_logic", "AND"),
            priority=new_rule.get("priority", 0),
            is_active=new_rule.get("is_active", True),
            created_at=new_rule["created_at"],
            updated_at=new_rule["updated_at"],
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error creating rule: {e}")
        raise HTTPException(status_code=400, detail=str(e))


@router.put("/rules/{rule_id}", response_model=Rule)
async def update_rule(rule_id: str, rule: RuleUpdate, user_id: str):
    """Update a folder rule."""
    try:
        client = get_client()

        # Verify ownership
        existing = client.table("user_message_folder_rules").select(
            "id, folder_id"
        ).eq("id", rule_id).eq("user_id", user_id).execute()

        if not existing.data:
            raise HTTPException(status_code=404, detail="Rule not found")

        # Build update data
        update_data = {}
        if rule.name is not None:
            update_data["name"] = rule.name
        if rule.folder_id is not None:
            # Verify new folder ownership
            folder_check = client.table("user_message_folders").select("id").eq(
                "id", rule.folder_id
            ).eq("user_id", user_id).execute()
            if not folder_check.data:
                raise HTTPException(status_code=404, detail="Target folder not found")
            update_data["folder_id"] = rule.folder_id
        if rule.conditions is not None:
            import json
            update_data["conditions"] = json.dumps(rule.conditions)
        if rule.condition_logic is not None:
            update_data["condition_logic"] = rule.condition_logic
        if rule.priority is not None:
            update_data["priority"] = rule.priority
        if rule.is_active is not None:
            update_data["is_active"] = rule.is_active

        if not update_data:
            raise HTTPException(status_code=400, detail="No fields to update")

        response = client.table("user_message_folder_rules").update(
            update_data
        ).eq("id", rule_id).execute()

        updated = response.data[0]

        # Get folder name
        folder_resp = client.table("user_message_folders").select("name").eq(
            "id", updated["folder_id"]
        ).single().execute()

        return Rule(
            id=str(updated["id"]),
            folder_id=str(updated["folder_id"]),
            folder_name=folder_resp.data["name"] if folder_resp.data else "",
            name=updated["name"],
            conditions=updated.get("conditions", []),
            condition_logic=updated.get("condition_logic", "AND"),
            priority=updated.get("priority", 0),
            is_active=updated.get("is_active", True),
            created_at=updated["created_at"],
            updated_at=updated["updated_at"],
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating rule: {e}")
        raise HTTPException(status_code=400, detail=str(e))


@router.delete("/rules/{rule_id}")
async def delete_rule(rule_id: str, user_id: str):
    """Delete a folder rule."""
    try:
        client = get_client()

        # Verify ownership
        existing = client.table("user_message_folder_rules").select("id").eq(
            "id", rule_id
        ).eq("user_id", user_id).execute()

        if not existing.data:
            raise HTTPException(status_code=404, detail="Rule not found")

        # Delete rule
        client.table("user_message_folder_rules").delete().eq("id", rule_id).execute()

        return {"status": "deleted"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting rule: {e}")
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/rules/{rule_id}/apply")
async def apply_rule(rule_id: str, user_id: str):
    """Apply a rule to existing conversations."""
    try:
        result = await apply_rule_to_existing(rule_id, user_id)
        return result
    except Exception as e:
        logger.error(f"Error applying rule: {e}")
        raise HTTPException(status_code=400, detail=str(e))


async def apply_rule_to_existing(rule_id: str, user_id: str):
    """Helper to apply a rule to existing conversations."""
    client = get_client()

    # Get the rule
    rule_resp = client.table("user_message_folder_rules").select("*").eq(
        "id", rule_id
    ).eq("user_id", user_id).single().execute()

    if not rule_resp.data:
        raise HTTPException(status_code=404, detail="Rule not found")

    rule = rule_resp.data

    # Get all conversation partners for this user
    partners_query = """
        SELECT DISTINCT
            CASE WHEN sender_id = :user_id THEN recipient_id ELSE sender_id END as partner_id
        FROM backlot_direct_messages
        WHERE sender_id = :user_id OR recipient_id = :user_id
    """
    partners = execute_query(partners_query, {"user_id": user_id})

    # Evaluate rule against each conversation
    assigned_count = 0
    for partner in partners:
        partner_id = str(partner["partner_id"])

        # Use the database function to evaluate
        eval_query = """
            SELECT evaluate_folder_rules(:user_id, :partner_id, NULL, NULL) as folder_id
        """
        result = execute_single(eval_query, {"user_id": user_id, "partner_id": partner_id})

        if result and result.get("folder_id") == rule["folder_id"]:
            # Assign to folder if not already assigned elsewhere
            try:
                client.table("user_message_folder_assignments").upsert({
                    "user_id": user_id,
                    "folder_id": rule["folder_id"],
                    "conversation_partner_id": partner_id,
                    "assigned_by": "rule",
                    "rule_id": rule_id,
                    "assigned_at": datetime.now(timezone.utc).isoformat(),
                }, on_conflict="user_id,conversation_partner_id").execute()
                assigned_count += 1
            except Exception:
                pass  # Skip if assignment fails

    return {"status": "applied", "conversations_assigned": assigned_count}


# ============================================================================
# RULE EVALUATION HELPER (for use by messages.py)
# ============================================================================

async def evaluate_and_assign_folder(user_id: str, partner_id: str, message_content: str = None, context_type: str = None):
    """
    Evaluate folder rules for a new message and auto-assign if a rule matches.
    Called by messages.py when a new message is sent.
    """
    try:
        # Use the database function
        eval_query = """
            SELECT evaluate_folder_rules(:user_id, :partner_id, :message_content, :context_type) as folder_id
        """
        result = execute_single(eval_query, {
            "user_id": user_id,
            "partner_id": partner_id,
            "message_content": message_content,
            "context_type": context_type,
        })

        if result and result.get("folder_id"):
            folder_id = str(result["folder_id"])

            # Get the matching rule for attribution
            rule_query = """
                SELECT r.id as rule_id
                FROM user_message_folder_rules r
                WHERE r.user_id = :user_id
                  AND r.folder_id = :folder_id
                  AND r.is_active = true
                ORDER BY r.priority DESC
                LIMIT 1
            """
            rule_result = execute_single(rule_query, {"user_id": user_id, "folder_id": folder_id})

            # Assign conversation to folder
            client = get_client()
            client.table("user_message_folder_assignments").upsert({
                "user_id": user_id,
                "folder_id": folder_id,
                "conversation_partner_id": partner_id,
                "assigned_by": "rule",
                "rule_id": rule_result["rule_id"] if rule_result else None,
                "assigned_at": datetime.now(timezone.utc).isoformat(),
            }, on_conflict="user_id,conversation_partner_id").execute()

            return folder_id

        return None
    except Exception as e:
        logger.warning(f"Error evaluating folder rules: {e}")
        return None
