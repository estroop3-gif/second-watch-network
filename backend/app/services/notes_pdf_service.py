"""
Script Notes PDF Export Service

Generates professional PDF exports of script page notes with:
- Color-coded note types
- Author information
- Scene associations
- Resolved/unresolved status
- Grouped views by page, scene, type, or author
"""

from typing import List, Dict, Optional, Any
from datetime import datetime

# Note type colors matching the frontend
NOTE_TYPE_COLORS = {
    "general": "#6B7280",       # gray
    "direction": "#8B5CF6",     # purple
    "production": "#3B82F6",    # blue
    "character": "#EF4444",     # red
    "blocking": "#F97316",      # orange
    "camera": "#06B6D4",        # cyan
    "continuity": "#EAB308",    # yellow
    "sound": "#0EA5E9",         # sky
    "vfx": "#D946EF",           # fuchsia
    "prop": "#8B5CF6",          # violet
    "wardrobe": "#6366F1",      # indigo
    "makeup": "#EC4899",        # pink
    "location": "#F59E0B",      # amber
    "safety": "#F43F5E",        # rose
    "other": "#64748B",         # slate
}

NOTE_TYPE_LABELS = {
    "general": "General",
    "direction": "Director's Note",
    "production": "Production",
    "character": "Character",
    "blocking": "Blocking/Staging",
    "camera": "Camera/Shot",
    "continuity": "Continuity",
    "sound": "Sound/Audio",
    "vfx": "VFX",
    "prop": "Props",
    "wardrobe": "Wardrobe",
    "makeup": "Makeup/Hair",
    "location": "Location",
    "safety": "Safety",
    "other": "Other",
}


def generate_note_row_html(
    note: Dict[str, Any],
    scenes_by_id: Dict[str, Dict[str, Any]],
    authors_by_id: Dict[str, Dict[str, Any]],
    show_page: bool = True,
    show_scene: bool = True
) -> str:
    """Generate HTML for a single note row"""
    note_type = note.get("note_type", "general")
    type_color = NOTE_TYPE_COLORS.get(note_type, "#6B7280")
    type_label = NOTE_TYPE_LABELS.get(note_type, note_type.title())

    # Get author info
    author_id = note.get("author_user_id")
    author = authors_by_id.get(author_id, {})
    author_name = author.get("full_name") or "Unknown"

    # Get scene info
    scene_id = note.get("scene_id")
    scene = scenes_by_id.get(scene_id, {}) if scene_id else {}
    scene_number = scene.get("scene_number", "")

    # Format timestamp
    created_at = note.get("created_at", "")
    if created_at:
        try:
            dt = datetime.fromisoformat(created_at.replace("Z", "+00:00"))
            formatted_date = dt.strftime("%b %d, %Y %I:%M %p")
        except:
            formatted_date = created_at[:16] if len(created_at) > 16 else created_at
    else:
        formatted_date = ""

    # Resolved status
    resolved = note.get("resolved", False)
    resolved_class = "resolved" if resolved else ""
    resolved_badge = '<span class="resolved-badge">Resolved</span>' if resolved else ""

    # Build row HTML
    page_cell = f'<td class="page-cell">{note.get("page_number", "")}</td>' if show_page else ""
    scene_cell = f'<td class="scene-cell">{scene_number}</td>' if show_scene else ""

    return f'''
    <tr class="{resolved_class}">
        {page_cell}
        {scene_cell}
        <td class="type-cell">
            <span class="type-badge" style="background-color: {type_color}20; color: {type_color}; border: 1px solid {type_color}40;">
                {type_label}
            </span>
        </td>
        <td class="content-cell">
            <div class="note-text">{note.get("note_text", "")}</div>
            {resolved_badge}
        </td>
        <td class="author-cell">{author_name}</td>
        <td class="date-cell">{formatted_date}</td>
    </tr>
    '''


def generate_notes_pdf_html(
    project_title: str,
    script_title: str,
    notes: List[Dict[str, Any]],
    scenes_by_id: Dict[str, Dict[str, Any]],
    authors_by_id: Dict[str, Dict[str, Any]],
    group_by: str = "page",  # page, scene, type, author
    filter_info: Optional[str] = None,
) -> str:
    """
    Generate HTML for notes PDF export.

    Args:
        project_title: Name of the project
        script_title: Name of the script
        notes: List of note dictionaries
        scenes_by_id: Dict mapping scene_id to scene data
        authors_by_id: Dict mapping user_id to profile data
        group_by: How to group notes (page, scene, type, author)
        filter_info: Optional filter description string

    Returns:
        HTML string ready for PDF rendering
    """

    # CSS styles
    css = '''
    <style>
        @page {
            size: letter portrait;
            margin: 0.75in 0.5in;
        }

        body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
            font-size: 10pt;
            line-height: 1.4;
            color: #1a1a1a;
        }

        .header {
            border-bottom: 2px solid #333;
            padding-bottom: 12px;
            margin-bottom: 20px;
        }

        .header h1 {
            font-size: 18pt;
            margin: 0 0 4px 0;
            color: #111;
        }

        .header .subtitle {
            font-size: 12pt;
            color: #666;
            margin: 0;
        }

        .header .filter-info {
            font-size: 9pt;
            color: #888;
            margin-top: 8px;
        }

        .summary {
            background: #f8f9fa;
            border: 1px solid #e9ecef;
            border-radius: 4px;
            padding: 12px 16px;
            margin-bottom: 20px;
            display: flex;
            gap: 24px;
            flex-wrap: wrap;
        }

        .summary-item {
            font-size: 9pt;
        }

        .summary-item .label {
            color: #666;
        }

        .summary-item .value {
            font-weight: 600;
            color: #333;
        }

        .group-header {
            background: #333;
            color: white;
            padding: 8px 12px;
            font-size: 11pt;
            font-weight: 600;
            margin-top: 16px;
            margin-bottom: 0;
            border-radius: 4px 4px 0 0;
        }

        .group-header:first-of-type {
            margin-top: 0;
        }

        table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 16px;
            font-size: 9pt;
        }

        table thead th {
            background: #f1f3f5;
            border: 1px solid #dee2e6;
            padding: 8px 10px;
            text-align: left;
            font-weight: 600;
            font-size: 8pt;
            text-transform: uppercase;
            color: #495057;
        }

        table tbody td {
            border: 1px solid #dee2e6;
            padding: 8px 10px;
            vertical-align: top;
        }

        .page-cell {
            width: 45px;
            text-align: center;
            font-weight: 600;
        }

        .scene-cell {
            width: 50px;
            text-align: center;
        }

        .type-cell {
            width: 100px;
        }

        .type-badge {
            display: inline-block;
            padding: 2px 8px;
            border-radius: 4px;
            font-size: 8pt;
            font-weight: 500;
        }

        .content-cell {
            min-width: 200px;
        }

        .note-text {
            white-space: pre-wrap;
            word-wrap: break-word;
        }

        .author-cell {
            width: 100px;
            color: #666;
        }

        .date-cell {
            width: 120px;
            color: #888;
            font-size: 8pt;
        }

        .resolved {
            background-color: #f0fdf4;
        }

        .resolved .note-text {
            color: #666;
        }

        .resolved-badge {
            display: inline-block;
            background: #22c55e;
            color: white;
            padding: 1px 6px;
            border-radius: 3px;
            font-size: 7pt;
            font-weight: 500;
            margin-top: 4px;
        }

        .footer {
            position: fixed;
            bottom: 0;
            left: 0;
            right: 0;
            text-align: center;
            font-size: 8pt;
            color: #888;
            padding: 10px 0;
            border-top: 1px solid #eee;
        }

        .page-break {
            page-break-before: always;
        }
    </style>
    '''

    # Header
    generated_date = datetime.utcnow().strftime("%B %d, %Y")
    filter_html = f'<div class="filter-info">Filters: {filter_info}</div>' if filter_info else ""

    header = f'''
    <div class="header">
        <h1>{project_title} - Script Notes</h1>
        <p class="subtitle">{script_title}</p>
        <p class="subtitle">Generated: {generated_date}</p>
        {filter_html}
    </div>
    '''

    # Summary stats
    total_notes = len(notes)
    unresolved_count = sum(1 for n in notes if not n.get("resolved", False))
    resolved_count = total_notes - unresolved_count
    unique_pages = len(set(n.get("page_number") for n in notes if n.get("page_number")))
    unique_authors = len(set(n.get("author_user_id") for n in notes if n.get("author_user_id")))

    summary = f'''
    <div class="summary">
        <div class="summary-item">
            <span class="label">Total Notes:</span>
            <span class="value">{total_notes}</span>
        </div>
        <div class="summary-item">
            <span class="label">Unresolved:</span>
            <span class="value">{unresolved_count}</span>
        </div>
        <div class="summary-item">
            <span class="label">Resolved:</span>
            <span class="value">{resolved_count}</span>
        </div>
        <div class="summary-item">
            <span class="label">Pages with Notes:</span>
            <span class="value">{unique_pages}</span>
        </div>
        <div class="summary-item">
            <span class="label">Contributors:</span>
            <span class="value">{unique_authors}</span>
        </div>
    </div>
    '''

    # Group notes
    grouped_notes = {}
    if group_by == "page":
        for note in notes:
            key = note.get("page_number", 0)
            if key not in grouped_notes:
                grouped_notes[key] = []
            grouped_notes[key].append(note)
        # Sort by page number
        grouped_notes = dict(sorted(grouped_notes.items()))
    elif group_by == "scene":
        for note in notes:
            scene_id = note.get("scene_id")
            scene = scenes_by_id.get(scene_id, {})
            key = scene.get("scene_number", "No Scene") if scene_id else "No Scene"
            if key not in grouped_notes:
                grouped_notes[key] = []
            grouped_notes[key].append(note)
    elif group_by == "type":
        for note in notes:
            key = note.get("note_type", "general")
            if key not in grouped_notes:
                grouped_notes[key] = []
            grouped_notes[key].append(note)
    elif group_by == "author":
        for note in notes:
            author_id = note.get("author_user_id")
            author = authors_by_id.get(author_id, {})
            key = author.get("full_name", "Unknown")
            if key not in grouped_notes:
                grouped_notes[key] = []
            grouped_notes[key].append(note)
    else:
        grouped_notes["All Notes"] = notes

    # Build table header based on grouping
    show_page = group_by != "page"
    show_scene = group_by != "scene"

    page_header = '<th>Page</th>' if show_page else ""
    scene_header = '<th>Scene</th>' if show_scene else ""

    table_header = f'''
    <thead>
        <tr>
            {page_header}
            {scene_header}
            <th>Type</th>
            <th>Note</th>
            <th>Author</th>
            <th>Date</th>
        </tr>
    </thead>
    '''

    # Build content
    content_parts = []
    for group_key, group_notes in grouped_notes.items():
        # Sort notes within group by page then created_at
        group_notes.sort(key=lambda n: (n.get("page_number", 0), n.get("created_at", "")))

        # Group header
        if group_by == "page":
            group_title = f"Page {group_key}"
        elif group_by == "type":
            group_title = NOTE_TYPE_LABELS.get(group_key, group_key.title())
        else:
            group_title = str(group_key)

        content_parts.append(f'<div class="group-header">{group_title} ({len(group_notes)} note{"s" if len(group_notes) != 1 else ""})</div>')

        # Notes table
        rows = []
        for note in group_notes:
            rows.append(generate_note_row_html(note, scenes_by_id, authors_by_id, show_page, show_scene))

        content_parts.append(f'''
        <table>
            {table_header}
            <tbody>
                {"".join(rows)}
            </tbody>
        </table>
        ''')

    content = "".join(content_parts)

    # Footer
    footer = '<div class="footer">Script Notes Export - Second Watch Network</div>'

    # Full HTML
    return f'''
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <title>{project_title} - Script Notes</title>
        {css}
    </head>
    <body>
        {header}
        {summary}
        {content}
        {footer}
    </body>
    </html>
    '''


def generate_notes_pdf(
    project_title: str,
    script_title: str,
    notes: List[Dict[str, Any]],
    scenes_by_id: Dict[str, Dict[str, Any]],
    authors_by_id: Dict[str, Dict[str, Any]],
    group_by: str = "page",
    filter_info: Optional[str] = None,
) -> bytes:
    """
    Generate PDF bytes for script notes export.

    Uses WeasyPrint to render HTML to PDF.
    """
    from weasyprint import HTML, CSS

    html_content = generate_notes_pdf_html(
        project_title=project_title,
        script_title=script_title,
        notes=notes,
        scenes_by_id=scenes_by_id,
        authors_by_id=authors_by_id,
        group_by=group_by,
        filter_info=filter_info,
    )

    pdf_bytes = HTML(string=html_content).write_pdf()
    return pdf_bytes
