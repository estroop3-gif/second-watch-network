"""
PDF Generation Service for Script Breakdown Sheets
Uses WeasyPrint to convert HTML templates to professional PDFs
"""
from typing import List, Dict, Any, Optional
from datetime import datetime


# Color mapping for breakdown types (matching standard industry colors)
BREAKDOWN_TYPE_COLORS = {
    "cast": "#FF0000",           # Red
    "background": "#00FF00",     # Green
    "stunt": "#FF6600",          # Orange
    "location": "#0066FF",       # Blue
    "prop": "#9933FF",           # Purple
    "set_dressing": "#996633",   # Brown
    "wardrobe": "#FF00FF",       # Magenta/Pink
    "makeup": "#FF66CC",         # Light Pink
    "sfx": "#00FFFF",            # Cyan
    "vfx": "#33CCFF",            # Light Blue
    "vehicle": "#FFFF00",        # Yellow
    "animal": "#99CC00",         # Lime
    "greenery": "#009933",       # Dark Green
    "special_equipment": "#666666",  # Gray
    "sound": "#CC6600",          # Amber
    "music": "#9900CC",          # Violet
    "other": "#999999"           # Light Gray
}

# Type display names
BREAKDOWN_TYPE_LABELS = {
    "cast": "CAST",
    "background": "BACKGROUND/EXTRAS",
    "stunt": "STUNTS",
    "location": "LOCATIONS",
    "prop": "PROPS",
    "set_dressing": "SET DRESSING",
    "wardrobe": "WARDROBE",
    "makeup": "MAKEUP/HAIR",
    "sfx": "SPECIAL EFFECTS",
    "vfx": "VISUAL EFFECTS",
    "vehicle": "VEHICLES",
    "animal": "ANIMALS",
    "greenery": "GREENERY",
    "special_equipment": "SPECIAL EQUIPMENT",
    "sound": "SOUND",
    "music": "MUSIC",
    "other": "OTHER"
}


def generate_breakdown_sheet_html(
    project_title: str,
    scene: Dict[str, Any],
    breakdown_items: List[Dict[str, Any]],
    script_title: Optional[str] = None,
    generated_date: Optional[str] = None,
    include_notes: bool = True,
) -> str:
    """
    Generate a single scene breakdown sheet HTML for PDF conversion
    Uses industry-standard layout with color-coded categories
    """
    # Group items by type
    items_by_type = {}
    for item in breakdown_items:
        item_type = item.get("type", "other")
        if item_type not in items_by_type:
            items_by_type[item_type] = []
        items_by_type[item_type].append(item)

    # Generate type sections HTML (2-column layout)
    type_sections_html = ""
    types_in_order = [
        "cast", "background", "stunt", "wardrobe", "makeup",
        "prop", "set_dressing", "vehicle", "animal", "greenery",
        "sfx", "vfx", "special_equipment", "sound", "music", "location", "other"
    ]

    # Filter to only types that have items
    active_types = [t for t in types_in_order if t in items_by_type]

    for item_type in active_types:
        items = items_by_type.get(item_type, [])
        if not items:
            continue

        color = BREAKDOWN_TYPE_COLORS.get(item_type, "#999999")
        label = BREAKDOWN_TYPE_LABELS.get(item_type, item_type.upper())

        items_html = ""
        for item in items:
            qty = item.get("quantity", 1)
            qty_str = f" ({qty})" if qty and qty > 1 else ""
            notes_str = f" - {item.get('notes')}" if include_notes and item.get("notes") else ""
            items_html += f'<div class="breakdown-item">{item.get("label", "")}{qty_str}{notes_str}</div>'

        type_sections_html += f"""
        <div class="type-section">
            <div class="type-header" style="background-color: {color}; color: white;">
                {label}
            </div>
            <div class="type-items">
                {items_html}
            </div>
        </div>
        """

    # Scene info
    scene_number = scene.get("scene_number", "")
    slugline = scene.get("slugline", "")
    int_ext = scene.get("int_ext", "")
    day_night = scene.get("day_night", "")
    page_length = scene.get("page_length", 0)
    description = scene.get("description", "")

    # Format page length as standard fraction
    page_length_str = format_page_length(page_length) if page_length else ""

    # Generated date
    if not generated_date:
        generated_date = datetime.now().strftime("%B %d, %Y")

    html = f"""
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="UTF-8">
        <title>Breakdown Sheet - Scene {scene_number}</title>
        <style>
            @page {{
                size: letter;
                margin: 0.5in;
            }}

            * {{
                box-sizing: border-box;
                font-family: 'Helvetica Neue', Arial, sans-serif;
            }}

            body {{
                margin: 0;
                padding: 0;
                font-size: 10pt;
                line-height: 1.4;
                color: #1a1a1a;
            }}

            .header {{
                border: 2px solid #333;
                margin-bottom: 12px;
            }}

            .header-top {{
                display: flex;
                justify-content: space-between;
                align-items: center;
                padding: 8px 12px;
                background: #f5f5f5;
                border-bottom: 1px solid #333;
            }}

            .project-title {{
                font-size: 14pt;
                font-weight: bold;
            }}

            .scene-number {{
                font-size: 24pt;
                font-weight: bold;
                padding: 4px 16px;
                border: 2px solid #333;
                background: white;
            }}

            .header-details {{
                display: grid;
                grid-template-columns: 1fr auto auto auto;
                gap: 12px;
                padding: 8px 12px;
                background: white;
            }}

            .slugline {{
                font-size: 12pt;
                font-weight: bold;
            }}

            .detail-box {{
                text-align: center;
                padding: 4px 12px;
                border: 1px solid #999;
                background: #fafafa;
            }}

            .detail-label {{
                font-size: 7pt;
                text-transform: uppercase;
                color: #666;
            }}

            .detail-value {{
                font-size: 11pt;
                font-weight: bold;
            }}

            .description {{
                padding: 8px 12px;
                background: #fffef0;
                border-top: 1px solid #999;
                font-style: italic;
            }}

            .breakdown-grid {{
                display: grid;
                grid-template-columns: 1fr 1fr;
                gap: 8px;
            }}

            .type-section {{
                border: 1px solid #ccc;
                margin-bottom: 8px;
                break-inside: avoid;
            }}

            .type-header {{
                padding: 4px 8px;
                font-weight: bold;
                font-size: 9pt;
                text-transform: uppercase;
                letter-spacing: 0.5px;
            }}

            .type-items {{
                padding: 6px 8px;
                background: white;
                min-height: 24px;
            }}

            .breakdown-item {{
                padding: 2px 0;
                font-size: 9pt;
            }}

            .footer {{
                margin-top: 20px;
                padding-top: 8px;
                border-top: 1px solid #ccc;
                font-size: 8pt;
                color: #666;
                display: flex;
                justify-content: space-between;
            }}

            .page-info {{
                text-align: center;
                margin-top: 8px;
                font-size: 8pt;
                color: #999;
            }}
        </style>
    </head>
    <body>
        <div class="header">
            <div class="header-top">
                <div class="project-title">{project_title}</div>
                <div class="scene-number">{scene_number}</div>
            </div>
            <div class="header-details">
                <div class="slugline">{slugline}</div>
                <div class="detail-box">
                    <div class="detail-label">INT/EXT</div>
                    <div class="detail-value">{int_ext or "-"}</div>
                </div>
                <div class="detail-box">
                    <div class="detail-label">Day/Night</div>
                    <div class="detail-value">{day_night or "-"}</div>
                </div>
                <div class="detail-box">
                    <div class="detail-label">Pages</div>
                    <div class="detail-value">{page_length_str or "-"}</div>
                </div>
            </div>
            {f'<div class="description">{description}</div>' if description else ''}
        </div>

        <div class="breakdown-grid">
            {type_sections_html}
        </div>

        <div class="footer">
            <div>Script: {script_title or project_title}</div>
            <div>Generated: {generated_date}</div>
        </div>
    </body>
    </html>
    """

    return html


def generate_project_breakdown_pdf_html(
    project_title: str,
    scenes_with_breakdown: List[Dict[str, Any]],
    summary_stats: Dict[str, Any],
    script_title: Optional[str] = None,
    generated_date: Optional[str] = None,
    filter_info: Optional[str] = None,
    include_notes: bool = True,
) -> str:
    """
    Generate a multi-page breakdown summary PDF
    Includes cover page with stats and individual scene breakdown pages
    """
    if not generated_date:
        generated_date = datetime.now().strftime("%B %d, %Y")

    # Build stats section
    total_items = summary_stats.get("total_items", 0)
    by_type = summary_stats.get("by_type", {})
    scenes_count = summary_stats.get("total_scenes", 0)
    scenes_with_items = summary_stats.get("scenes_with_breakdown", 0)

    type_stats_html = ""
    for item_type, count in sorted(by_type.items(), key=lambda x: -x[1]):
        color = BREAKDOWN_TYPE_COLORS.get(item_type, "#999999")
        label = BREAKDOWN_TYPE_LABELS.get(item_type, item_type.upper())
        type_stats_html += f"""
        <tr>
            <td><span class="type-dot" style="background-color: {color};"></span> {label}</td>
            <td class="count">{count}</td>
        </tr>
        """

    # Build scene breakdown pages
    scene_pages_html = ""
    for scene_data in scenes_with_breakdown:
        scene = scene_data.get("scene", {})
        items = scene_data.get("items", [])

        if not items:
            continue

        scene_page = generate_scene_section_html(
            project_title=project_title,
            scene=scene,
            breakdown_items=items,
            script_title=script_title,
            include_notes=include_notes,
        )
        scene_pages_html += f'<div class="page-break">{scene_page}</div>'

    html = f"""
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="UTF-8">
        <title>Script Breakdown - {project_title}</title>
        <style>
            @page {{
                size: letter;
                margin: 0.5in;
            }}

            * {{
                box-sizing: border-box;
                font-family: 'Helvetica Neue', Arial, sans-serif;
            }}

            body {{
                margin: 0;
                padding: 0;
                font-size: 10pt;
                line-height: 1.4;
                color: #1a1a1a;
            }}

            .cover-page {{
                text-align: center;
                padding-top: 2in;
            }}

            .cover-title {{
                font-size: 28pt;
                font-weight: bold;
                margin-bottom: 8px;
            }}

            .cover-subtitle {{
                font-size: 18pt;
                color: #666;
                margin-bottom: 40px;
            }}

            .cover-info {{
                font-size: 12pt;
                margin: 8px 0;
            }}

            .stats-section {{
                margin-top: 60px;
                text-align: left;
                max-width: 400px;
                margin-left: auto;
                margin-right: auto;
            }}

            .stats-header {{
                font-size: 14pt;
                font-weight: bold;
                border-bottom: 2px solid #333;
                padding-bottom: 8px;
                margin-bottom: 16px;
            }}

            .stats-table {{
                width: 100%;
                border-collapse: collapse;
            }}

            .stats-table td {{
                padding: 4px 8px;
                border-bottom: 1px solid #eee;
            }}

            .stats-table .count {{
                text-align: right;
                font-weight: bold;
            }}

            .type-dot {{
                display: inline-block;
                width: 12px;
                height: 12px;
                border-radius: 2px;
                margin-right: 8px;
                vertical-align: middle;
            }}

            .page-break {{
                page-break-before: always;
            }}

            /* Scene section styles (shared) */
            .scene-header {{
                border: 2px solid #333;
                margin-bottom: 12px;
            }}

            .scene-header-top {{
                display: flex;
                justify-content: space-between;
                align-items: center;
                padding: 6px 10px;
                background: #f5f5f5;
                border-bottom: 1px solid #333;
            }}

            .scene-project-title {{
                font-size: 11pt;
                font-weight: bold;
            }}

            .scene-number-box {{
                font-size: 18pt;
                font-weight: bold;
                padding: 2px 12px;
                border: 2px solid #333;
                background: white;
            }}

            .scene-header-details {{
                display: grid;
                grid-template-columns: 1fr auto auto auto;
                gap: 10px;
                padding: 6px 10px;
                background: white;
            }}

            .scene-slugline {{
                font-size: 10pt;
                font-weight: bold;
            }}

            .scene-detail-box {{
                text-align: center;
                padding: 2px 10px;
                border: 1px solid #999;
                background: #fafafa;
            }}

            .scene-detail-label {{
                font-size: 6pt;
                text-transform: uppercase;
                color: #666;
            }}

            .scene-detail-value {{
                font-size: 9pt;
                font-weight: bold;
            }}

            .breakdown-grid {{
                display: grid;
                grid-template-columns: 1fr 1fr;
                gap: 6px;
            }}

            .type-section {{
                border: 1px solid #ccc;
                margin-bottom: 6px;
                break-inside: avoid;
            }}

            .type-header {{
                padding: 3px 6px;
                font-weight: bold;
                font-size: 8pt;
                text-transform: uppercase;
                letter-spacing: 0.5px;
                color: white;
            }}

            .type-items {{
                padding: 4px 6px;
                background: white;
                min-height: 20px;
            }}

            .breakdown-item {{
                padding: 1px 0;
                font-size: 8pt;
            }}

            .footer-line {{
                margin-top: 12px;
                padding-top: 6px;
                border-top: 1px solid #ccc;
                font-size: 7pt;
                color: #666;
                display: flex;
                justify-content: space-between;
            }}
        </style>
    </head>
    <body>
        <!-- Cover Page -->
        <div class="cover-page">
            <div class="cover-title">{project_title}</div>
            <div class="cover-subtitle">Script Breakdown</div>
            <div class="cover-info">Generated: {generated_date}</div>
            {f'<div class="cover-info">{filter_info}</div>' if filter_info else ''}
            <div class="cover-info">{scenes_with_items} of {scenes_count} scenes with breakdown items</div>
            <div class="cover-info">{total_items} total elements</div>

            <div class="stats-section">
                <div class="stats-header">Elements by Type</div>
                <table class="stats-table">
                    {type_stats_html}
                </table>
            </div>
        </div>

        <!-- Individual Scene Pages -->
        {scene_pages_html}
    </body>
    </html>
    """

    return html


def generate_scene_section_html(
    project_title: str,
    scene: Dict[str, Any],
    breakdown_items: List[Dict[str, Any]],
    script_title: Optional[str] = None,
    include_notes: bool = True,
) -> str:
    """Generate HTML for a single scene section (used in multi-page PDF)"""
    # Group items by type
    items_by_type = {}
    for item in breakdown_items:
        item_type = item.get("type", "other")
        if item_type not in items_by_type:
            items_by_type[item_type] = []
        items_by_type[item_type].append(item)

    # Generate type sections HTML
    type_sections_html = ""
    types_in_order = [
        "cast", "background", "stunt", "wardrobe", "makeup",
        "prop", "set_dressing", "vehicle", "animal", "greenery",
        "sfx", "vfx", "special_equipment", "sound", "music", "location", "other"
    ]

    active_types = [t for t in types_in_order if t in items_by_type]

    for item_type in active_types:
        items = items_by_type.get(item_type, [])
        if not items:
            continue

        color = BREAKDOWN_TYPE_COLORS.get(item_type, "#999999")
        label = BREAKDOWN_TYPE_LABELS.get(item_type, item_type.upper())

        items_html = ""
        for item in items:
            qty = item.get("quantity", 1)
            qty_str = f" ({qty})" if qty and qty > 1 else ""
            notes_str = f" - {item.get('notes')}" if include_notes and item.get("notes") else ""
            items_html += f'<div class="breakdown-item">{item.get("label", "")}{qty_str}{notes_str}</div>'

        type_sections_html += f"""
        <div class="type-section">
            <div class="type-header" style="background-color: {color};">
                {label}
            </div>
            <div class="type-items">
                {items_html}
            </div>
        </div>
        """

    scene_number = scene.get("scene_number", "")
    slugline = scene.get("slugline", "")
    int_ext = scene.get("int_ext", "")
    day_night = scene.get("day_night", "")
    page_length = scene.get("page_length", 0)

    page_length_str = format_page_length(page_length) if page_length else ""

    return f"""
    <div class="scene-header">
        <div class="scene-header-top">
            <div class="scene-project-title">{project_title}</div>
            <div class="scene-number-box">{scene_number}</div>
        </div>
        <div class="scene-header-details">
            <div class="scene-slugline">{slugline}</div>
            <div class="scene-detail-box">
                <div class="scene-detail-label">INT/EXT</div>
                <div class="scene-detail-value">{int_ext or "-"}</div>
            </div>
            <div class="scene-detail-box">
                <div class="scene-detail-label">D/N</div>
                <div class="scene-detail-value">{day_night or "-"}</div>
            </div>
            <div class="scene-detail-box">
                <div class="scene-detail-label">Pages</div>
                <div class="scene-detail-value">{page_length_str or "-"}</div>
            </div>
        </div>
    </div>

    <div class="breakdown-grid">
        {type_sections_html}
    </div>
    """


def format_page_length(page_length: float) -> str:
    """Convert decimal page length to industry standard fraction format"""
    if not page_length:
        return ""

    whole = int(page_length)
    fraction = page_length - whole

    # Common fractions in scripts
    fractions_map = {
        0.125: "1/8",
        0.25: "2/8",
        0.375: "3/8",
        0.5: "4/8",
        0.625: "5/8",
        0.75: "6/8",
        0.875: "7/8",
    }

    # Find closest fraction
    closest_frac = ""
    min_diff = float("inf")
    for frac_val, frac_str in fractions_map.items():
        diff = abs(fraction - frac_val)
        if diff < min_diff:
            min_diff = diff
            closest_frac = frac_str

    if whole == 0:
        return closest_frac if closest_frac else "0"
    elif closest_frac and min_diff < 0.05:
        return f"{whole} {closest_frac}"
    else:
        return str(whole)


def generate_breakdown_pdf(
    project_title: str,
    scene: Dict[str, Any],
    breakdown_items: List[Dict[str, Any]],
    script_title: Optional[str] = None,
    include_notes: bool = True,
) -> bytes:
    """Generate a single scene breakdown PDF"""
    try:
        from weasyprint import HTML
    except ImportError:
        raise ImportError("WeasyPrint is required for PDF generation. Install with: pip install weasyprint")

    html_content = generate_breakdown_sheet_html(
        project_title=project_title,
        scene=scene,
        breakdown_items=breakdown_items,
        script_title=script_title,
        include_notes=include_notes,
    )

    html = HTML(string=html_content)
    return html.write_pdf()


def generate_project_breakdown_pdf(
    project_title: str,
    scenes_with_breakdown: List[Dict[str, Any]],
    summary_stats: Dict[str, Any],
    script_title: Optional[str] = None,
    filter_info: Optional[str] = None,
    include_notes: bool = True,
) -> bytes:
    """Generate a multi-page project breakdown PDF"""
    try:
        from weasyprint import HTML
    except ImportError:
        raise ImportError("WeasyPrint is required for PDF generation. Install with: pip install weasyprint")

    html_content = generate_project_breakdown_pdf_html(
        project_title=project_title,
        scenes_with_breakdown=scenes_with_breakdown,
        summary_stats=summary_stats,
        script_title=script_title,
        filter_info=filter_info,
        include_notes=include_notes,
    )

    html = HTML(string=html_content)
    return html.write_pdf()
