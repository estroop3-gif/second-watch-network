"""
Backlot Trial Auto-Provisioning Service

Orchestrates the full flow of creating a working Backlot trial account:
Cognito user -> profile -> filmmaker_profiles -> storage -> org -> member -> usage -> CRM contact + activity -> welcome email
"""
import secrets
import string
from datetime import datetime, timedelta
from typing import Dict, Any, Optional

from app.core.database import execute_single, execute_insert, execute_query, get_client
from app.core.logging import get_logger

logger = get_logger(__name__)

TRIAL_DURATION_DAYS = 14
EXTENSION_DURATION_DAYS = 30


def generate_temp_password(length: int = 16) -> str:
    """Generate a secure temporary password meeting Cognito requirements."""
    alphabet = string.ascii_letters + string.digits + "!@#$%^&*"
    password = [
        secrets.choice(string.ascii_lowercase),
        secrets.choice(string.ascii_uppercase),
        secrets.choice(string.digits),
        secrets.choice("!@#$%^&*"),
    ]
    password.extend(secrets.choice(alphabet) for _ in range(length - 4))
    secrets.SystemRandom().shuffle(password)
    return "".join(password)


def generate_slug(name: str) -> str:
    """Generate a URL-safe slug from a name."""
    import re
    slug = re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")
    return slug or "org"


async def provision_backlot_trial(trial_request_id: str) -> Dict[str, Any]:
    """
    Provision a full Backlot trial account from a trial request.

    Steps:
    1. Verify trial request is pending, set to provisioning
    2. Create or find Cognito user
    3. Create profile
    4. Create filmmaker_profiles entry
    5. Init user_storage_usage
    6. Create organization with trial tier
    7. Add owner membership
    8. Init organization_usage
    9. Create CRM contact (warm lead)
    10. Create CRM activity
    11. Send welcome email
    12. Update trial request to active

    On failure after Cognito creation: store error, revert to pending.
    """
    # 1. Fetch and lock trial request
    trial = execute_single(
        "SELECT * FROM backlot_trial_requests WHERE id = :id",
        {"id": trial_request_id},
    )
    if not trial:
        return {"success": False, "error": "Trial request not found"}

    if trial["status"] not in ("pending",):
        return {"success": False, "error": f"Trial is already {trial['status']}"}

    # Set to provisioning
    execute_single(
        "UPDATE backlot_trial_requests SET status = 'provisioning', updated_at = NOW() WHERE id = :id RETURNING id",
        {"id": trial_request_id},
    )

    cognito_user_id = None
    temp_password = None
    existing_user = False

    try:
        from app.core.cognito import CognitoAuth

        email = trial["email"].strip().lower()
        full_name = f"{trial['first_name']} {trial['last_name']}"

        # 2. Check for existing Cognito user
        existing_cognito = CognitoAuth.admin_get_user(email)
        if existing_cognito and existing_cognito.get("id"):
            cognito_user_id = existing_cognito["id"]
            existing_user = True
            logger.info(f"trial_provision: existing Cognito user found for {email}")
        else:
            # Create new Cognito user
            temp_password = generate_temp_password()
            cognito_result = CognitoAuth.admin_create_user(
                email=email,
                name=full_name,
                temporary_password=temp_password,
            )
            if cognito_result.get("error"):
                raise Exception(f"Cognito creation failed: {cognito_result['error']['message']}")

            cognito_user = cognito_result.get("user", {})
            cognito_user_id = cognito_user.get("id") or cognito_user.get("Username")
            if not cognito_user_id:
                raise Exception("Cognito user created but no ID returned")

            logger.info(f"trial_provision: created Cognito user for {email}")

        # 3. Check for existing profile, create if needed
        client = get_client()
        existing_profile = execute_single(
            "SELECT id FROM profiles WHERE email = :email OR id::text = :cid",
            {"email": email, "cid": str(cognito_user_id)},
        )

        profile_id = None
        if existing_profile:
            profile_id = existing_profile["id"]
            # Ensure filmmaker flag is set
            execute_single(
                "UPDATE profiles SET is_filmmaker = true, cognito_user_id = :cid, updated_at = NOW() WHERE id = :id RETURNING id",
                {"id": profile_id, "cid": str(cognito_user_id)},
            )
            existing_user = True
            logger.info(f"trial_provision: existing profile found {profile_id}")
        else:
            # Create profile
            profile_data = {
                "id": cognito_user_id,
                "cognito_user_id": cognito_user_id,
                "email": email,
                "display_name": full_name,
                "full_name": full_name,
                "is_filmmaker": True,
                "created_by_admin": True,
                "created_at": datetime.utcnow().isoformat(),
                "updated_at": datetime.utcnow().isoformat(),
            }
            if temp_password:
                profile_data["temp_password"] = temp_password
                profile_data["temp_password_set_at"] = datetime.utcnow().isoformat()

            profile_result = client.table("profiles").insert(profile_data).execute()
            if not profile_result.data:
                raise Exception("Failed to create profile")

            profile_id = profile_result.data[0]["id"]
            logger.info(f"trial_provision: created profile {profile_id}")

        # 4. Create filmmaker_profiles entry if needed
        existing_fp = execute_single(
            "SELECT user_id FROM filmmaker_profiles WHERE user_id = :uid",
            {"uid": str(profile_id)},
        )
        if not existing_fp:
            try:
                execute_insert(
                    """INSERT INTO filmmaker_profiles (user_id, bio, skills, accepting_work)
                       VALUES (:uid, '', '{}', false) RETURNING user_id""",
                    {"uid": str(profile_id)},
                )
            except Exception as e:
                logger.warning(f"trial_provision: filmmaker_profiles insert (non-fatal): {e}")

        # 5. Init user_storage_usage if needed
        existing_storage = execute_single(
            "SELECT user_id FROM user_storage_usage WHERE user_id = :uid",
            {"uid": str(profile_id)},
        )
        if not existing_storage:
            client.table("user_storage_usage").insert({
                "user_id": str(profile_id),
                "total_bytes_used": 0,
                "backlot_files_bytes": 0,
                "backlot_media_bytes": 0,
                "avatar_bytes": 0,
                "created_at": datetime.utcnow().isoformat(),
                "last_updated": datetime.utcnow().isoformat(),
            }).execute()

        # 6. Create organization with trial settings
        trial_ends_at = datetime.utcnow() + timedelta(days=TRIAL_DURATION_DAYS)

        # Look up trial tier
        trial_tier = execute_single(
            "SELECT id FROM organization_tiers WHERE name = 'Trial' LIMIT 1",
            {},
        )
        tier_id = trial_tier["id"] if trial_tier else None

        org_name = trial.get("company_name") or f"{trial['first_name']}'s Studio"
        slug = generate_slug(org_name)

        # Ensure slug uniqueness
        existing_slug = execute_single(
            "SELECT id FROM organizations WHERE slug = :slug", {"slug": slug}
        )
        if existing_slug:
            slug = f"{slug}-{secrets.token_hex(3)}"

        org = execute_insert(
            """
            INSERT INTO organizations (
                name, slug, created_by, status,
                backlot_enabled, backlot_billing_status,
                trial_ends_at, trial_source, tier_id
            ) VALUES (
                :name, :slug, :created_by, 'active',
                true, 'trial',
                :trial_ends_at, 'backlot_trial', :tier_id
            ) RETURNING *
            """,
            {
                "name": org_name,
                "slug": slug,
                "created_by": str(profile_id),
                "trial_ends_at": trial_ends_at.isoformat(),
                "tier_id": tier_id,
            },
        )
        if not org:
            raise Exception("Failed to create organization")

        org_id = org["id"]
        logger.info(f"trial_provision: created org {org_id} ({org_name})")

        # 7. Add owner membership
        execute_insert(
            """
            INSERT INTO organization_members (
                organization_id, user_id, role, status, can_create_projects, joined_at
            ) VALUES (
                :org_id, :uid, 'owner', 'active', true, NOW()
            ) RETURNING id
            """,
            {"org_id": org_id, "uid": str(profile_id)},
        )

        # 8. Init organization_usage
        existing_usage = execute_single(
            "SELECT organization_id FROM organization_usage WHERE organization_id = :oid",
            {"oid": org_id},
        )
        if not existing_usage:
            try:
                execute_insert(
                    """INSERT INTO organization_usage (
                        organization_id, current_owner_seats, current_collaborative_seats,
                        current_active_projects, current_active_storage_bytes,
                        current_archive_storage_bytes, current_month_bandwidth_bytes
                    ) VALUES (:oid, 1, 0, 0, 0, 0, 0) RETURNING organization_id""",
                    {"oid": org_id},
                )
            except Exception as e:
                logger.warning(f"trial_provision: org_usage insert (non-fatal): {e}")

        # 9. Create CRM contact (warm lead)
        converted_contact_id = None
        try:
            # Check if CRM contact already exists for this email
            existing_contact = execute_single(
                "SELECT id FROM crm_contacts WHERE LOWER(email) = LOWER(:email)",
                {"email": email},
            )
            if existing_contact:
                converted_contact_id = existing_contact["id"]
            else:
                # Resolve company
                company_id = None
                company_name = trial.get("company_name")
                if company_name and company_name.strip():
                    existing_company = execute_single(
                        "SELECT id FROM crm_companies WHERE LOWER(name) = LOWER(:name)",
                        {"name": company_name.strip()},
                    )
                    if existing_company:
                        company_id = existing_company["id"]
                    else:
                        try:
                            new_company = execute_insert(
                                """INSERT INTO crm_companies (name, created_by) VALUES (:name, :uid)
                                   ON CONFLICT DO NOTHING RETURNING id""",
                                {"name": company_name.strip(), "uid": str(profile_id)},
                            )
                            if new_company:
                                company_id = new_company["id"]
                        except Exception:
                            pass

                contact = execute_insert(
                    """
                    INSERT INTO crm_contacts (
                        first_name, last_name, email, phone,
                        temperature, source, visibility, tags,
                        job_title, company_id, company_name,
                        created_by, assigned_rep_id
                    ) VALUES (
                        :first_name, :last_name, :email, :phone,
                        'warm', 'backlot_trial', 'team',
                        ARRAY['Backlot Trial']::text[],
                        :job_title, :company_id, :company_name,
                        :created_by, :assigned_rep_id
                    ) RETURNING id
                    """,
                    {
                        "first_name": trial["first_name"],
                        "last_name": trial["last_name"],
                        "email": email,
                        "phone": trial["phone"],
                        "job_title": trial.get("job_title"),
                        "company_id": company_id,
                        "company_name": company_name,
                        "created_by": str(profile_id),
                        "assigned_rep_id": trial.get("referred_by_rep_id"),
                    },
                )
                converted_contact_id = contact["id"] if contact else None
        except Exception as e:
            logger.warning(f"trial_provision: CRM contact creation (non-fatal): {e}")

        # 10. Create CRM activity
        if converted_contact_id:
            try:
                details_parts = []
                if trial.get("company_name"):
                    details_parts.append(f"Company: {trial['company_name']}")
                if trial.get("job_title"):
                    details_parts.append(f"Title: {trial['job_title']}")
                if trial.get("company_size"):
                    details_parts.append(f"Size: {trial['company_size']}")
                if trial.get("use_case"):
                    details_parts.append(f"Use case: {trial['use_case']}")
                details = "; ".join(details_parts) if details_parts else None

                execute_insert(
                    """
                    INSERT INTO crm_activities (
                        contact_id, activity_type, subject, details, created_by
                    ) VALUES (
                        :contact_id, 'note', :subject, :details, :created_by
                    ) RETURNING id
                    """,
                    {
                        "contact_id": converted_contact_id,
                        "subject": "Started 14-day Backlot trial",
                        "details": details,
                        "created_by": str(profile_id),
                    },
                )
            except Exception as e:
                logger.warning(f"trial_provision: CRM activity creation (non-fatal): {e}")

        # 11. Send welcome email
        try:
            if temp_password and not existing_user:
                from app.services.email_service import send_backlot_trial_welcome_email
                await send_backlot_trial_welcome_email(
                    email=email,
                    name=trial["first_name"],
                    temp_password=temp_password,
                    trial_ends_at=trial_ends_at,
                    org_name=org_name,
                )
            else:
                # Existing user — send trial activation email (no temp password)
                from app.services.email_service import send_backlot_trial_existing_user_email
                await send_backlot_trial_existing_user_email(
                    email=email,
                    name=trial["first_name"],
                    trial_ends_at=trial_ends_at,
                    org_name=org_name,
                )
        except Exception as e:
            logger.warning(f"trial_provision: welcome email (non-fatal): {e}")

        # 12. Update trial request to active
        execute_single(
            """
            UPDATE backlot_trial_requests SET
                status = 'active',
                provisioned_at = NOW(),
                provisioned_profile_id = :profile_id,
                provisioned_org_id = :org_id,
                trial_ends_at = :trial_ends_at,
                converted_contact_id = :contact_id,
                provisioning_error = NULL,
                updated_at = NOW()
            WHERE id = :id RETURNING id
            """,
            {
                "id": trial_request_id,
                "profile_id": str(profile_id),
                "org_id": org_id,
                "trial_ends_at": trial_ends_at.isoformat(),
                "contact_id": converted_contact_id,
            },
        )

        logger.info(
            f"trial_provision: SUCCESS for {email} — profile={profile_id}, org={org_id}, "
            f"contact={converted_contact_id}, existing_user={existing_user}"
        )

        return {
            "success": True,
            "profile_id": str(profile_id),
            "org_id": str(org_id),
            "contact_id": str(converted_contact_id) if converted_contact_id else None,
            "temp_password": temp_password,
            "existing_user": existing_user,
            "trial_ends_at": trial_ends_at.isoformat(),
        }

    except Exception as e:
        error_msg = str(e)
        logger.error(f"trial_provision: FAILED for {trial['email']}: {error_msg}")

        # Revert to pending so admin can retry
        execute_single(
            """
            UPDATE backlot_trial_requests SET
                status = 'pending',
                provisioning_error = :error,
                updated_at = NOW()
            WHERE id = :id RETURNING id
            """,
            {"id": trial_request_id, "error": error_msg},
        )

        return {"success": False, "error": error_msg}
