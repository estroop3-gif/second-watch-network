"""
Beat Sheet PDF Export Service

Generates professional PDF exports of beat sheets with:
- Full page per beat layout
- Beat header with title, act, page range
- Emotional tone badge
- Primary character highlight
- Content description
- Character arcs for each beat
- Linked scenes
- Notes section
"""

from typing import List, Dict, Optional, Any
from datetime import datetime


# Emotional tone colors
TONE_COLORS = {
    "establishing": "#6B7280",   # gray
    "introducing": "#3B82F6",    # blue
    "hopeful": "#22C55E",        # green
    "tense": "#EF4444",          # red
    "exciting": "#F97316",       # orange
    "devastating": "#DC2626",    # dark red
    "triumphant": "#8B5CF6",     # purple
    "contemplative": "#6366F1",  # indigo
    "comedic": "#FBBF24",        # amber
    "romantic": "#EC4899",       # pink
    "mysterious": "#7C3AED",     # violet
    "uncertain": "#9CA3AF",      # gray
    "surprising": "#F59E0B",     # yellow
    "determined": "#059669",     # emerald
    "warm": "#FB923C",           # orange light
    "pivotal": "#8B5CF6",        # purple
    "despairing": "#1F2937",     # dark gray
    "resolved": "#10B981",       # teal
}

# Act colors
ACT_COLORS = {
    "ACT 1": "#3B82F6",   # blue
    "ACT 2": "#F97316",   # orange
    "ACT 3": "#8B5CF6",   # purple
}

CHARACTER_ROLE_LABELS = {
    "protagonist": "Protagonist",
    "antagonist": "Antagonist",
    "supporting": "Supporting",
    "minor": "Minor",
}


def generate_beat_page_html(
    beat: Dict[str, Any],
    beat_number: int,
    total_beats: int,
    characters_by_id: Dict[str, Dict[str, Any]],
    character_arcs: List[Dict[str, Any]],
    linked_scenes: List[Dict[str, Any]],
) -> str:
    """Generate HTML for a single beat page"""

    # Beat info
    title = beat.get("title", "Untitled Beat")
    act_marker = beat.get("act_marker", "")
    page_start = beat.get("page_start")
    page_end = beat.get("page_end")
    emotional_tone = beat.get("emotional_tone", "")
    content = beat.get("content", "")
    notes = beat.get("notes", "")
    primary_character_id = beat.get("primary_character_id")

    # Get primary character
    primary_character = characters_by_id.get(primary_character_id) if primary_character_id else None
    primary_char_name = primary_character.get("name", "") if primary_character else ""
    primary_char_role = primary_character.get("role", "") if primary_character else ""
    primary_char_role_label = CHARACTER_ROLE_LABELS.get(primary_char_role, primary_char_role.title()) if primary_char_role else ""

    # Page range display
    page_range = ""
    if page_start and page_end:
        if page_start == page_end:
            page_range = f"Page {page_start}"
        else:
            page_range = f"Pages {page_start}-{page_end}"
    elif page_start:
        page_range = f"Page {page_start}+"

    # Emotional tone badge
    tone_color = TONE_COLORS.get(emotional_tone, "#6B7280")
    tone_html = f'''
        <span class="tone-badge" style="background-color: {tone_color}20; color: {tone_color}; border: 1px solid {tone_color}40;">
            {emotional_tone.title() if emotional_tone else "—"}
        </span>
    ''' if emotional_tone else ""

    # Act color
    act_color = ACT_COLORS.get(act_marker, "#6B7280")

    # Primary character section
    primary_char_html = ""
    if primary_char_name:
        primary_char_html = f'''
        <div class="info-item">
            <span class="info-label">Primary Character:</span>
            <span class="info-value">{primary_char_name} {f"({primary_char_role_label})" if primary_char_role_label else ""}</span>
        </div>
        '''

    # Character arcs section
    arcs_html = ""
    if character_arcs:
        arcs_list = ""
        for arc in character_arcs:
            char_id = arc.get("character_id")
            char = characters_by_id.get(char_id, {})
            char_name = char.get("name", "Unknown")
            arc_desc = arc.get("description", "")
            arcs_list += f'<li><strong>{char_name}:</strong> {arc_desc}</li>'
        arcs_html = f'''
        <div class="section">
            <h3 class="section-title">Character Arcs</h3>
            <ul class="arc-list">{arcs_list}</ul>
        </div>
        '''

    # Linked scenes section
    scenes_html = ""
    if linked_scenes:
        scenes_list = ""
        for link in linked_scenes:
            scene = link.get("scene") or {}
            scene_num = scene.get("scene_number", "?")
            int_ext = scene.get("int_ext", "")
            location = scene.get("location", "Unknown")
            time_of_day = scene.get("time_of_day", "")
            relationship = link.get("relationship", "")
            scenes_list += f'''
            <li>
                <span class="scene-number">Scene {scene_num}</span> -
                {int_ext}. {location} - {time_of_day}
                {f'<span class="scene-relationship">({relationship})</span>' if relationship else ""}
            </li>
            '''
        scenes_html = f'''
        <div class="section">
            <h3 class="section-title">Linked Scenes</h3>
            <ul class="scene-list">{scenes_list}</ul>
        </div>
        '''

    # Content section
    content_html = ""
    if content:
        content_html = f'''
        <div class="section">
            <h3 class="section-title">Description</h3>
            <div class="content-text">{content}</div>
        </div>
        '''

    # Notes section
    notes_html = ""
    if notes:
        notes_html = f'''
        <div class="section notes-section">
            <h3 class="section-title">Notes</h3>
            <div class="notes-text">{notes}</div>
        </div>
        '''

    return f'''
    <div class="beat-page">
        <div class="beat-header">
            <div class="beat-number">BEAT #{beat_number}</div>
            <h2 class="beat-title">{title}</h2>
            <div class="beat-act" style="color: {act_color};">{act_marker}</div>
        </div>

        <div class="info-bar">
            <div class="info-item">
                <span class="info-label">Pages:</span>
                <span class="info-value">{page_range or "—"}</span>
            </div>
            <div class="info-item">
                <span class="info-label">Tone:</span>
                {tone_html or '<span class="info-value">—</span>'}
            </div>
            {primary_char_html}
        </div>

        {content_html}
        {arcs_html}
        {scenes_html}
        {notes_html}

        <div class="page-footer">
            <span>Beat {beat_number} of {total_beats}</span>
        </div>
    </div>
    '''


def generate_beat_sheet_pdf_html(
    project_title: str,
    beat_sheet_title: str,
    beat_sheet: Dict[str, Any],
    beats: List[Dict[str, Any]],
    characters: List[Dict[str, Any]],
    character_arcs_by_beat: Dict[str, List[Dict[str, Any]]],
    scene_links_by_beat: Dict[str, List[Dict[str, Any]]],
) -> str:
    """
    Generate HTML for beat sheet PDF export.

    Args:
        project_title: Name of the project
        beat_sheet_title: Title of the beat sheet
        beat_sheet: Beat sheet metadata (genre, tone, structure_type, etc.)
        beats: List of beat dictionaries
        characters: List of character dictionaries
        character_arcs_by_beat: Dict mapping beat_id to list of character arcs
        scene_links_by_beat: Dict mapping beat_id to list of scene links

    Returns:
        HTML string ready for PDF rendering
    """

    # Build character lookup
    characters_by_id = {c["id"]: c for c in characters}

    # Metadata
    genre = beat_sheet.get("genre", "")
    tone = beat_sheet.get("tone", "")
    structure_type = beat_sheet.get("structure_type", "")
    logline = beat_sheet.get("logline", "")
    themes = beat_sheet.get("themes", [])

    structure_labels = {
        "three-act": "Three-Act Structure",
        "five-act": "Five-Act Structure",
        "hero-journey": "Hero's Journey",
        "save-the-cat": "Save the Cat",
        "custom": "Custom",
    }
    structure_label = structure_labels.get(structure_type, structure_type.title() if structure_type else "")

    # CSS styles
    css = '''
    <style>
        @page {
            size: letter portrait;
            margin: 0.75in;
        }

        body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
            font-size: 11pt;
            line-height: 1.5;
            color: #1a1a1a;
        }

        /* Cover Page */
        .cover-page {
            page-break-after: always;
            text-align: center;
            padding-top: 2in;
        }

        .cover-title {
            font-size: 28pt;
            font-weight: bold;
            color: #1a1a1a;
            margin-bottom: 10px;
        }

        .cover-subtitle {
            font-size: 16pt;
            color: #666;
            margin-bottom: 40px;
        }

        .cover-meta {
            font-size: 11pt;
            color: #888;
            margin-bottom: 5px;
        }

        .cover-logline {
            font-size: 12pt;
            font-style: italic;
            color: #444;
            max-width: 500px;
            margin: 30px auto;
            padding: 15px;
            background: #f5f5f5;
            border-left: 4px solid #8B5CF6;
        }

        .cover-themes {
            margin-top: 20px;
        }

        .theme-badge {
            display: inline-block;
            padding: 4px 12px;
            background: #e5e7eb;
            border-radius: 12px;
            font-size: 10pt;
            margin: 2px;
        }

        .cover-stats {
            margin-top: 40px;
            font-size: 12pt;
            color: #666;
        }

        /* Beat Pages */
        .beat-page {
            page-break-after: always;
            min-height: 100%;
            position: relative;
        }

        .beat-header {
            text-align: center;
            margin-bottom: 30px;
            padding-bottom: 20px;
            border-bottom: 2px solid #e5e7eb;
        }

        .beat-number {
            font-size: 10pt;
            color: #888;
            letter-spacing: 2px;
            margin-bottom: 5px;
        }

        .beat-title {
            font-size: 24pt;
            font-weight: bold;
            color: #1a1a1a;
            margin: 10px 0;
        }

        .beat-act {
            font-size: 12pt;
            font-weight: 600;
            letter-spacing: 1px;
        }

        .info-bar {
            display: flex;
            justify-content: center;
            gap: 40px;
            margin-bottom: 30px;
            padding: 15px;
            background: #f9fafb;
            border-radius: 8px;
        }

        .info-item {
            text-align: center;
        }

        .info-label {
            display: block;
            font-size: 9pt;
            color: #888;
            text-transform: uppercase;
            letter-spacing: 1px;
            margin-bottom: 4px;
        }

        .info-value {
            font-size: 11pt;
            color: #1a1a1a;
            font-weight: 500;
        }

        .tone-badge {
            display: inline-block;
            padding: 3px 10px;
            border-radius: 4px;
            font-size: 10pt;
            font-weight: 500;
        }

        .section {
            margin-bottom: 25px;
        }

        .section-title {
            font-size: 11pt;
            font-weight: 600;
            color: #4a5568;
            text-transform: uppercase;
            letter-spacing: 1px;
            margin-bottom: 10px;
            padding-bottom: 5px;
            border-bottom: 1px solid #e5e7eb;
        }

        .content-text {
            font-size: 11pt;
            line-height: 1.7;
            color: #374151;
            white-space: pre-wrap;
        }

        .arc-list, .scene-list {
            list-style: none;
            padding: 0;
            margin: 0;
        }

        .arc-list li, .scene-list li {
            padding: 8px 0;
            border-bottom: 1px solid #f3f4f6;
            font-size: 10pt;
        }

        .arc-list li:last-child, .scene-list li:last-child {
            border-bottom: none;
        }

        .scene-number {
            font-weight: 600;
            color: #3B82F6;
        }

        .scene-relationship {
            color: #888;
            font-style: italic;
            margin-left: 5px;
        }

        .notes-section {
            background: #fffbeb;
            padding: 15px;
            border-radius: 8px;
            border-left: 4px solid #fbbf24;
        }

        .notes-section .section-title {
            border-bottom-color: #fcd34d;
        }

        .notes-text {
            font-size: 10pt;
            color: #78350f;
            white-space: pre-wrap;
        }

        .page-footer {
            position: absolute;
            bottom: 0;
            left: 0;
            right: 0;
            text-align: center;
            font-size: 9pt;
            color: #888;
            padding-top: 10px;
            border-top: 1px solid #e5e7eb;
        }

        /* Generated timestamp */
        .generated-info {
            position: fixed;
            bottom: 0.5in;
            right: 0.5in;
            font-size: 8pt;
            color: #aaa;
        }
    </style>
    '''

    # Cover page
    generated_date = datetime.utcnow().strftime("%B %d, %Y")

    meta_items = []
    if genre:
        meta_items.append(f"Genre: {genre}")
    if tone:
        meta_items.append(f"Tone: {tone}")
    if structure_label:
        meta_items.append(f"Structure: {structure_label}")

    themes_html = ""
    if themes:
        theme_badges = "".join(f'<span class="theme-badge">{t}</span>' for t in themes)
        themes_html = f'<div class="cover-themes">{theme_badges}</div>'

    logline_html = f'<div class="cover-logline">{logline}</div>' if logline else ""

    # Count beats by act
    act_counts = {}
    for beat in beats:
        act = beat.get("act_marker", "No Act")
        act_counts[act] = act_counts.get(act, 0) + 1

    act_summary = " | ".join(f"{act}: {count} beats" for act, count in sorted(act_counts.items()))

    cover = f'''
    <div class="cover-page">
        <div class="cover-subtitle">{project_title}</div>
        <div class="cover-title">{beat_sheet_title}</div>
        <div class="cover-subtitle">BEAT SHEET</div>

        <div class="cover-meta">{" | ".join(meta_items)}</div>

        {logline_html}
        {themes_html}

        <div class="cover-stats">
            <p>{len(beats)} Beats | {len(characters)} Characters</p>
            <p style="font-size: 10pt; color: #aaa;">{act_summary}</p>
        </div>

        <div style="margin-top: 60px;">
            <p class="cover-meta">Generated: {generated_date}</p>
        </div>
    </div>
    '''

    # Generate beat pages
    beat_pages = ""
    for idx, beat in enumerate(beats, 1):
        beat_id = beat.get("id")
        arcs = character_arcs_by_beat.get(beat_id, [])
        scenes = scene_links_by_beat.get(beat_id, [])

        beat_pages += generate_beat_page_html(
            beat=beat,
            beat_number=idx,
            total_beats=len(beats),
            characters_by_id=characters_by_id,
            character_arcs=arcs,
            linked_scenes=scenes,
        )

    # Complete HTML
    html = f'''
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="UTF-8">
        <title>{beat_sheet_title} - Beat Sheet</title>
        {css}
    </head>
    <body>
        {cover}
        {beat_pages}
    </body>
    </html>
    '''

    return html
