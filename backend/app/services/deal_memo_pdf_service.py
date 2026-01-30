"""
PDF Generation Service for Deal Memos
Uses WeasyPrint to convert HTML templates to professional PDFs
Supports both Crew and Talent deal memo formats
"""
import io
import base64
from typing import List, Dict, Any, Optional
from datetime import datetime, date, time


def _to_string(value: Any) -> str:
    """Convert date/time/datetime objects to strings for PDF rendering."""
    if value is None:
        return ""
    if isinstance(value, datetime):
        return value.strftime("%Y-%m-%d %H:%M:%S")
    if isinstance(value, date):
        return value.strftime("%Y-%m-%d")
    if isinstance(value, time):
        return value.strftime("%H:%M")
    return str(value)


def _format_currency(value: Any) -> str:
    """Format a numeric value as currency."""
    if value is None:
        return ""
    try:
        amount = float(value)
        return f"${amount:,.2f}"
    except (ValueError, TypeError):
        return str(value)


def _get_production_company(project: dict) -> str:
    """Extract production company name from project settings."""
    settings = project.get("settings") or {}
    company = (
        settings.get("production_company")
        or project.get("production_company")
        or project.get("company_name")
        or ""
    )
    return _to_string(company)


def _build_deal_memo_css() -> str:
    """Return the shared CSS for deal memo PDFs."""
    return """
        @page {
            size: letter;
            margin: 0.5in;
        }

        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }

        body {
            font-family: Arial, Helvetica, sans-serif;
            font-size: 10px;
            line-height: 1.4;
            color: #000;
            background: #fff;
        }

        .header {
            text-align: center;
            border-bottom: 3px solid #000;
            padding-bottom: 10px;
            margin-bottom: 16px;
        }

        .header .project-title {
            font-size: 18px;
            font-weight: bold;
            text-transform: uppercase;
            letter-spacing: 1px;
        }

        .header .production-company {
            font-size: 12px;
            color: #333;
            margin-top: 2px;
        }

        .header .document-title {
            font-size: 14px;
            font-weight: bold;
            text-transform: uppercase;
            margin-top: 8px;
            letter-spacing: 2px;
        }

        .section {
            margin-bottom: 14px;
        }

        .section-header {
            font-size: 11px;
            font-weight: bold;
            text-transform: uppercase;
            background: #000;
            color: #fff;
            padding: 4px 8px;
            margin-bottom: 0;
        }

        .section-body {
            border: 1px solid #000;
            border-top: none;
            padding: 8px 10px;
        }

        table.terms-table {
            width: 100%;
            border-collapse: collapse;
            font-size: 10px;
        }

        table.terms-table td {
            padding: 4px 8px;
            vertical-align: top;
            border-bottom: 1px solid #ddd;
        }

        table.terms-table td.label {
            font-weight: bold;
            width: 200px;
            white-space: nowrap;
        }

        table.terms-table td.value {
            width: auto;
        }

        table.terms-table tr:last-child td {
            border-bottom: none;
        }

        .parties-grid {
            display: flex;
            gap: 20px;
        }

        .party-box {
            flex: 1;
            border: 1px solid #000;
            padding: 10px;
        }

        .party-label {
            font-size: 9px;
            text-transform: uppercase;
            color: #666;
            margin-bottom: 4px;
        }

        .party-name {
            font-size: 13px;
            font-weight: bold;
        }

        .notes-box {
            border: 1px solid #000;
            border-top: none;
            padding: 10px;
            min-height: 40px;
            font-size: 10px;
            white-space: pre-wrap;
        }

        .signature-section {
            margin-top: 24px;
            page-break-inside: avoid;
        }

        .signature-grid {
            display: flex;
            gap: 40px;
        }

        .signature-block {
            flex: 1;
            padding-top: 8px;
        }

        .signature-block .sig-label {
            font-size: 9px;
            text-transform: uppercase;
            color: #666;
            font-weight: bold;
            margin-bottom: 16px;
        }

        .signature-line {
            border-bottom: 1px solid #000;
            height: 40px;
            margin-bottom: 4px;
            position: relative;
        }

        .signature-line img.sig-image {
            max-height: 36px;
            max-width: 200px;
            position: absolute;
            bottom: 2px;
            left: 0;
        }

        .signature-field-label {
            font-size: 8px;
            color: #666;
            margin-bottom: 12px;
        }

        .name-line {
            border-bottom: 1px solid #000;
            height: 24px;
            margin-bottom: 4px;
            font-size: 11px;
            line-height: 24px;
        }

        .date-line {
            border-bottom: 1px solid #000;
            height: 24px;
            margin-bottom: 4px;
            font-size: 11px;
            line-height: 24px;
        }

        .footer {
            margin-top: 20px;
            padding-top: 8px;
            border-top: 1px solid #ccc;
            font-size: 8px;
            color: #999;
            text-align: center;
        }

        .usage-rights-table {
            width: 100%;
            border-collapse: collapse;
            font-size: 10px;
        }

        .usage-rights-table th {
            background: #e0e0e0;
            font-weight: bold;
            text-align: left;
            padding: 4px 8px;
            border: 1px solid #ccc;
            font-size: 9px;
            text-transform: uppercase;
        }

        .usage-rights-table td {
            padding: 4px 8px;
            border: 1px solid #ddd;
            vertical-align: top;
        }
    """


def generate_crew_deal_memo_html(
    deal_memo: dict,
    project: dict,
    user_profile: dict,
    signature_data: Optional[dict] = None,
) -> str:
    """
    Generate professional HTML for a Crew Deal Memo.

    Args:
        deal_memo: Deal memo data dict
        project: Project data dict
        user_profile: User profile data dict for the crew member
        signature_data: Optional dict with keys: image_base64, signer_name, signed_at

    Returns:
        HTML string ready for WeasyPrint conversion
    """
    project_title = _to_string(project.get("title", ""))
    production_company = _get_production_company(project)

    # Crew member name
    first_name = _to_string(user_profile.get("first_name", ""))
    last_name = _to_string(user_profile.get("last_name", ""))
    crew_member_name = f"{first_name} {last_name}".strip() or _to_string(
        user_profile.get("display_name", "")
    )

    # Position and department
    position_title = _to_string(deal_memo.get("position_title", ""))
    department = _to_string(deal_memo.get("department", ""))
    if not department:
        role = deal_memo.get("role") or {}
        if isinstance(role, dict):
            department = _to_string(role.get("department", ""))

    # Compensation
    rate_type = _to_string(deal_memo.get("rate_type", ""))
    rate_amount = _format_currency(deal_memo.get("rate_amount"))
    ot_multiplier = _to_string(deal_memo.get("ot_multiplier", ""))
    dt_multiplier = _to_string(deal_memo.get("dt_multiplier", ""))

    # Allowances
    kit_rental_rate = _format_currency(deal_memo.get("kit_rental_rate"))
    car_allowance = _format_currency(deal_memo.get("car_allowance"))
    phone_allowance = _format_currency(deal_memo.get("phone_allowance"))
    per_diem_rate = _format_currency(deal_memo.get("per_diem_rate"))

    # Dates
    start_date = _to_string(deal_memo.get("start_date", ""))
    end_date = _to_string(deal_memo.get("end_date", ""))

    # Additional terms
    additional_terms = deal_memo.get("additional_terms") or {}
    additional_terms_html = ""
    if additional_terms and isinstance(additional_terms, dict):
        rows = ""
        for key, val in additional_terms.items():
            label = key.replace("_", " ").title()
            rows += f"""
            <tr>
                <td class="label">{label}</td>
                <td class="value">{_to_string(val)}</td>
            </tr>
            """
        additional_terms_html = f"""
        <div class="section">
            <div class="section-header">Additional Terms</div>
            <div class="section-body">
                <table class="terms-table">
                    {rows}
                </table>
            </div>
        </div>
        """

    # Notes
    notes = _to_string(deal_memo.get("notes", ""))
    notes_html = ""
    if notes:
        notes_html = f"""
        <div class="section">
            <div class="section-header">Notes</div>
            <div class="notes-box">{notes}</div>
        </div>
        """

    # Signature blocks
    producer_sig_html = _build_signature_block_html(
        "Producer / Production Company",
        production_company,
        None,
    )
    crew_sig_html = _build_signature_block_html(
        "Crew Member",
        crew_member_name,
        signature_data,
    )

    # Allowances rows — only show rows that have values
    allowance_rows = ""
    if kit_rental_rate:
        allowance_rows += f'<tr><td class="label">Kit Rental</td><td class="value">{kit_rental_rate}</td></tr>'
    if car_allowance:
        allowance_rows += f'<tr><td class="label">Car Allowance</td><td class="value">{car_allowance}</td></tr>'
    if phone_allowance:
        allowance_rows += f'<tr><td class="label">Phone Allowance</td><td class="value">{phone_allowance}</td></tr>'
    if per_diem_rate:
        allowance_rows += f'<tr><td class="label">Per Diem</td><td class="value">{per_diem_rate}</td></tr>'

    allowances_html = ""
    if allowance_rows:
        allowances_html = f"""
        <div class="section">
            <div class="section-header">Allowances</div>
            <div class="section-body">
                <table class="terms-table">
                    {allowance_rows}
                </table>
            </div>
        </div>
        """

    css = _build_deal_memo_css()

    html = f"""
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>Deal Memo - {crew_member_name} - {project_title}</title>
    <style>
        {css}
    </style>
</head>
<body>
    <div class="header">
        <div class="project-title">{project_title}</div>
        {"<div class='production-company'>" + production_company + "</div>" if production_company else ""}
        <div class="document-title">Crew Deal Memo</div>
    </div>

    <div class="section">
        <div class="section-header">Parties</div>
        <div class="section-body">
            <div class="parties-grid">
                <div class="party-box">
                    <div class="party-label">Producer / Production Company</div>
                    <div class="party-name">{production_company or project_title}</div>
                </div>
                <div class="party-box">
                    <div class="party-label">Crew Member</div>
                    <div class="party-name">{crew_member_name}</div>
                </div>
            </div>
        </div>
    </div>

    <div class="section">
        <div class="section-header">Position / Department</div>
        <div class="section-body">
            <table class="terms-table">
                <tr>
                    <td class="label">Position Title</td>
                    <td class="value">{position_title}</td>
                </tr>
                <tr>
                    <td class="label">Department</td>
                    <td class="value">{department}</td>
                </tr>
            </table>
        </div>
    </div>

    <div class="section">
        <div class="section-header">Compensation</div>
        <div class="section-body">
            <table class="terms-table">
                <tr>
                    <td class="label">Rate Type</td>
                    <td class="value">{rate_type}</td>
                </tr>
                <tr>
                    <td class="label">Rate Amount</td>
                    <td class="value">{rate_amount}</td>
                </tr>
                <tr>
                    <td class="label">Overtime (OT) Multiplier</td>
                    <td class="value">{ot_multiplier}x</td>
                </tr>
                <tr>
                    <td class="label">Double Time (DT) Multiplier</td>
                    <td class="value">{dt_multiplier}x</td>
                </tr>
            </table>
        </div>
    </div>

    {allowances_html}

    <div class="section">
        <div class="section-header">Engagement Period</div>
        <div class="section-body">
            <table class="terms-table">
                <tr>
                    <td class="label">Start Date</td>
                    <td class="value">{start_date}</td>
                </tr>
                <tr>
                    <td class="label">End Date</td>
                    <td class="value">{end_date}</td>
                </tr>
            </table>
        </div>
    </div>

    {additional_terms_html}
    {notes_html}

    <div class="signature-section">
        <div class="signature-grid">
            {producer_sig_html}
            {crew_sig_html}
        </div>
    </div>

    <div class="footer">
        Generated by Second Watch Network &bull; {datetime.now().strftime("%B %d, %Y at %I:%M %p")}
    </div>
</body>
</html>
    """

    return html


def generate_talent_deal_memo_html(
    deal_memo: dict,
    project: dict,
    user_profile: dict,
    signature_data: Optional[dict] = None,
) -> str:
    """
    Generate professional HTML for a Talent Deal Memo.

    Same structure as crew deal memo but adds:
    - Performer category section
    - Usage rights section
    - "Talent" label instead of "Crew Member"

    Args:
        deal_memo: Deal memo data dict
        project: Project data dict
        user_profile: User profile data dict for the talent
        signature_data: Optional dict with keys: image_base64, signer_name, signed_at

    Returns:
        HTML string ready for WeasyPrint conversion
    """
    project_title = _to_string(project.get("title", ""))
    production_company = _get_production_company(project)

    # Talent name
    first_name = _to_string(user_profile.get("first_name", ""))
    last_name = _to_string(user_profile.get("last_name", ""))
    talent_name = f"{first_name} {last_name}".strip() or _to_string(
        user_profile.get("display_name", "")
    )

    # Position and department
    position_title = _to_string(deal_memo.get("position_title", ""))
    department = _to_string(deal_memo.get("department", ""))
    if not department:
        role = deal_memo.get("role") or {}
        if isinstance(role, dict):
            department = _to_string(role.get("department", ""))

    # Performer category
    performer_category = _to_string(deal_memo.get("performer_category", ""))

    # Compensation
    rate_type = _to_string(deal_memo.get("rate_type", ""))
    rate_amount = _format_currency(deal_memo.get("rate_amount"))
    ot_multiplier = _to_string(deal_memo.get("ot_multiplier", ""))
    dt_multiplier = _to_string(deal_memo.get("dt_multiplier", ""))

    # Allowances
    kit_rental_rate = _format_currency(deal_memo.get("kit_rental_rate"))
    car_allowance = _format_currency(deal_memo.get("car_allowance"))
    phone_allowance = _format_currency(deal_memo.get("phone_allowance"))
    per_diem_rate = _format_currency(deal_memo.get("per_diem_rate"))

    # Dates
    start_date = _to_string(deal_memo.get("start_date", ""))
    end_date = _to_string(deal_memo.get("end_date", ""))

    # Usage rights (JSONB)
    usage_rights = deal_memo.get("usage_rights") or {}
    usage_rights_html = ""
    if usage_rights and isinstance(usage_rights, dict):
        media_types = usage_rights.get("media_types") or []
        territories = usage_rights.get("territories") or []
        duration = _to_string(usage_rights.get("duration", ""))
        exclusivity = _to_string(usage_rights.get("exclusivity", ""))
        additional_terms_usage = _to_string(usage_rights.get("additional_terms", ""))

        media_types_display = ", ".join(media_types) if isinstance(media_types, list) else _to_string(media_types)
        territories_display = ", ".join(territories) if isinstance(territories, list) else _to_string(territories)

        usage_rows = ""
        if media_types_display:
            usage_rows += f'<tr><td class="label">Media Types</td><td class="value">{media_types_display}</td></tr>'
        if territories_display:
            usage_rows += f'<tr><td class="label">Territories</td><td class="value">{territories_display}</td></tr>'
        if duration:
            usage_rows += f'<tr><td class="label">Duration</td><td class="value">{duration}</td></tr>'
        if exclusivity:
            usage_rows += f'<tr><td class="label">Exclusivity</td><td class="value">{exclusivity}</td></tr>'
        if additional_terms_usage:
            usage_rows += f'<tr><td class="label">Additional Terms</td><td class="value">{additional_terms_usage}</td></tr>'

        if usage_rows:
            usage_rights_html = f"""
            <div class="section">
                <div class="section-header">Usage Rights</div>
                <div class="section-body">
                    <table class="terms-table">
                        {usage_rows}
                    </table>
                </div>
            </div>
            """

    # Additional terms
    additional_terms = deal_memo.get("additional_terms") or {}
    additional_terms_html = ""
    if additional_terms and isinstance(additional_terms, dict):
        rows = ""
        for key, val in additional_terms.items():
            label = key.replace("_", " ").title()
            rows += f"""
            <tr>
                <td class="label">{label}</td>
                <td class="value">{_to_string(val)}</td>
            </tr>
            """
        additional_terms_html = f"""
        <div class="section">
            <div class="section-header">Additional Terms</div>
            <div class="section-body">
                <table class="terms-table">
                    {rows}
                </table>
            </div>
        </div>
        """

    # Notes
    notes = _to_string(deal_memo.get("notes", ""))
    notes_html = ""
    if notes:
        notes_html = f"""
        <div class="section">
            <div class="section-header">Notes</div>
            <div class="notes-box">{notes}</div>
        </div>
        """

    # Allowances rows
    allowance_rows = ""
    if kit_rental_rate:
        allowance_rows += f'<tr><td class="label">Kit Rental</td><td class="value">{kit_rental_rate}</td></tr>'
    if car_allowance:
        allowance_rows += f'<tr><td class="label">Car Allowance</td><td class="value">{car_allowance}</td></tr>'
    if phone_allowance:
        allowance_rows += f'<tr><td class="label">Phone Allowance</td><td class="value">{phone_allowance}</td></tr>'
    if per_diem_rate:
        allowance_rows += f'<tr><td class="label">Per Diem</td><td class="value">{per_diem_rate}</td></tr>'

    allowances_html = ""
    if allowance_rows:
        allowances_html = f"""
        <div class="section">
            <div class="section-header">Allowances</div>
            <div class="section-body">
                <table class="terms-table">
                    {allowance_rows}
                </table>
            </div>
        </div>
        """

    # Signature blocks
    producer_sig_html = _build_signature_block_html(
        "Producer / Production Company",
        production_company,
        None,
    )
    talent_sig_html = _build_signature_block_html(
        "Talent",
        talent_name,
        signature_data,
    )

    # Performer category section
    performer_category_html = ""
    if performer_category:
        performer_category_html = f"""
        <div class="section">
            <div class="section-header">Performer Category</div>
            <div class="section-body">
                <table class="terms-table">
                    <tr>
                        <td class="label">Category</td>
                        <td class="value">{performer_category}</td>
                    </tr>
                </table>
            </div>
        </div>
        """

    css = _build_deal_memo_css()

    html = f"""
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>Deal Memo - {talent_name} - {project_title}</title>
    <style>
        {css}
    </style>
</head>
<body>
    <div class="header">
        <div class="project-title">{project_title}</div>
        {"<div class='production-company'>" + production_company + "</div>" if production_company else ""}
        <div class="document-title">Talent Deal Memo</div>
    </div>

    <div class="section">
        <div class="section-header">Parties</div>
        <div class="section-body">
            <div class="parties-grid">
                <div class="party-box">
                    <div class="party-label">Producer / Production Company</div>
                    <div class="party-name">{production_company or project_title}</div>
                </div>
                <div class="party-box">
                    <div class="party-label">Talent</div>
                    <div class="party-name">{talent_name}</div>
                </div>
            </div>
        </div>
    </div>

    <div class="section">
        <div class="section-header">Position / Department</div>
        <div class="section-body">
            <table class="terms-table">
                <tr>
                    <td class="label">Position Title</td>
                    <td class="value">{position_title}</td>
                </tr>
                <tr>
                    <td class="label">Department</td>
                    <td class="value">{department}</td>
                </tr>
            </table>
        </div>
    </div>

    {performer_category_html}

    <div class="section">
        <div class="section-header">Compensation</div>
        <div class="section-body">
            <table class="terms-table">
                <tr>
                    <td class="label">Rate Type</td>
                    <td class="value">{rate_type}</td>
                </tr>
                <tr>
                    <td class="label">Rate Amount</td>
                    <td class="value">{rate_amount}</td>
                </tr>
                <tr>
                    <td class="label">Overtime (OT) Multiplier</td>
                    <td class="value">{ot_multiplier}x</td>
                </tr>
                <tr>
                    <td class="label">Double Time (DT) Multiplier</td>
                    <td class="value">{dt_multiplier}x</td>
                </tr>
            </table>
        </div>
    </div>

    {allowances_html}

    <div class="section">
        <div class="section-header">Engagement Period</div>
        <div class="section-body">
            <table class="terms-table">
                <tr>
                    <td class="label">Start Date</td>
                    <td class="value">{start_date}</td>
                </tr>
                <tr>
                    <td class="label">End Date</td>
                    <td class="value">{end_date}</td>
                </tr>
            </table>
        </div>
    </div>

    {usage_rights_html}
    {additional_terms_html}
    {notes_html}

    <div class="signature-section">
        <div class="signature-grid">
            {producer_sig_html}
            {talent_sig_html}
        </div>
    </div>

    <div class="footer">
        Generated by Second Watch Network &bull; {datetime.now().strftime("%B %d, %Y at %I:%M %p")}
    </div>
</body>
</html>
    """

    return html


def _build_signature_block_html(
    label: str,
    name: str,
    signature_data: Optional[dict],
) -> str:
    """
    Build the HTML for a single signature block.

    Args:
        label: The role label (e.g. "Producer / Production Company", "Crew Member", "Talent")
        name: The name to display on the name line
        signature_data: Optional dict with keys: image_base64, signer_name, signed_at

    Returns:
        HTML string for the signature block
    """
    sig_image_html = ""
    signed_date_value = ""

    if signature_data:
        image_b64 = signature_data.get("image_base64", "")
        if image_b64:
            # Ensure proper data URI prefix
            if not image_b64.startswith("data:"):
                image_b64 = f"data:image/png;base64,{image_b64}"
            sig_image_html = f'<img class="sig-image" src="{image_b64}" alt="Signature">'
        signed_name = signature_data.get("signer_name", "")
        if signed_name:
            name = signed_name
        signed_date_value = _to_string(signature_data.get("signed_at", ""))

    return f"""
    <div class="signature-block">
        <div class="sig-label">{label}</div>
        <div class="signature-line">{sig_image_html}</div>
        <div class="signature-field-label">Signature</div>
        <div class="name-line">{name}</div>
        <div class="signature-field-label">Print Name</div>
        <div class="date-line">{signed_date_value}</div>
        <div class="signature-field-label">Date</div>
    </div>
    """


async def generate_deal_memo_pdf(
    deal_memo: dict,
    project: dict,
    user_profile: dict,
) -> bytes:
    """
    Generate a PDF from deal memo data.

    Checks deal_memo template_type to determine crew vs talent format.

    Args:
        deal_memo: Deal memo data dict
        project: Project data dict
        user_profile: User profile data dict

    Returns:
        PDF as bytes
    """
    try:
        from weasyprint import HTML
    except ImportError:
        raise ImportError(
            "WeasyPrint is required for PDF generation. Install with: pip install weasyprint"
        )

    template_type = deal_memo.get("template_type", "crew")

    if template_type == "talent":
        html_content = generate_talent_deal_memo_html(deal_memo, project, user_profile)
    else:
        html_content = generate_crew_deal_memo_html(deal_memo, project, user_profile)

    html = HTML(string=html_content)
    pdf_bytes = html.write_pdf()

    return pdf_bytes


async def generate_signed_deal_memo_pdf(
    deal_memo: dict,
    project: dict,
    user_profile: dict,
    signature_image_base64: str,
    signer_name: str,
    signed_at: str,
) -> bytes:
    """
    Generate a signed deal memo PDF by re-rendering the HTML with
    the signature image embedded in the appropriate signature block.

    Args:
        deal_memo: Deal memo data dict
        project: Project data dict
        user_profile: User profile data dict
        signature_image_base64: Base64-encoded signature image (PNG)
        signer_name: Name of the signer
        signed_at: Timestamp string of when it was signed

    Returns:
        PDF as bytes with signature embedded
    """
    try:
        from weasyprint import HTML
    except ImportError:
        raise ImportError(
            "WeasyPrint is required for PDF generation. Install with: pip install weasyprint"
        )

    signature_data = {
        "image_base64": signature_image_base64,
        "signer_name": signer_name,
        "signed_at": signed_at,
    }

    template_type = deal_memo.get("template_type", "crew")

    if template_type == "talent":
        html_content = generate_talent_deal_memo_html(
            deal_memo, project, user_profile, signature_data=signature_data
        )
    else:
        html_content = generate_crew_deal_memo_html(
            deal_memo, project, user_profile, signature_data=signature_data
        )

    html = HTML(string=html_content)
    pdf_bytes = html.write_pdf()

    return pdf_bytes
