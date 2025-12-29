"""
Screenplay PDF Generation Service
Generates industry-standard formatted screenplay PDFs from text content
with revision color coding (white, blue, pink, yellow, green, etc.)
"""
import io
import re
from typing import Optional, List, Tuple
from enum import Enum


# Industry-standard revision colors with their RGB values
REVISION_COLORS = {
    "white": "#FFFFFF",
    "blue": "#B3D9FF",      # Light blue
    "pink": "#FFB3D9",      # Light pink
    "yellow": "#FFFFB3",    # Light yellow
    "green": "#B3FFB3",     # Light green
    "goldenrod": "#FFD700", # Goldenrod
    "buff": "#F5DEB3",      # Buff/wheat
    "salmon": "#FFA07A",    # Light salmon
    "cherry": "#FFB6C1",    # Light pink/cherry
    "tan": "#D2B48C",       # Tan
    "gray": "#D3D3D3",      # Light gray
    "ivory": "#FFFFF0",     # Ivory
}

# Color sequence for revisions
COLOR_SEQUENCE = ["white", "blue", "pink", "yellow", "green", "goldenrod",
                  "buff", "salmon", "cherry", "tan", "gray", "ivory"]


class ElementType(Enum):
    SCENE_HEADING = "scene_heading"
    ACTION = "action"
    CHARACTER = "character"
    DIALOGUE = "dialogue"
    PARENTHETICAL = "parenthetical"
    TRANSITION = "transition"
    PAGE_BREAK = "page_break"
    BLANK = "blank"


# Patterns for detecting screenplay elements
SCENE_HEADING_PATTERN = re.compile(
    r'^(INT\.?|EXT\.?|INT\.?/EXT\.?|I/E\.?)\s+.+',
    re.IGNORECASE
)

TRANSITION_PATTERNS = [
    r'^FADE IN:?$', r'^FADE OUT\.?$', r'^FADE TO:?$', r'^CUT TO:?$',
    r'^DISSOLVE TO:?$', r'^SMASH CUT TO:?$', r'^MATCH CUT TO:?$',
    r'^THE END\.?$', r'.+TO:$',
]
TRANSITION_PATTERN = re.compile('|'.join(TRANSITION_PATTERNS), re.IGNORECASE)

CHARACTER_PATTERN = re.compile(
    r'^[A-Z][A-Z0-9\s\-\'\.]+(\s*\(V\.O\.\)|\s*\(O\.S\.\)|\s*\(CONT\'D\))?$'
)

PARENTHETICAL_PATTERN = re.compile(r'^\(.+\)$')


def detect_element_type(line: str, prev_type: Optional[ElementType] = None) -> ElementType:
    """Detect the screenplay element type for a line of text"""
    stripped = line.strip()

    if not stripped:
        return ElementType.BLANK

    if SCENE_HEADING_PATTERN.match(stripped):
        return ElementType.SCENE_HEADING

    if TRANSITION_PATTERN.match(stripped):
        return ElementType.TRANSITION

    if PARENTHETICAL_PATTERN.match(stripped):
        if prev_type in [ElementType.CHARACTER, ElementType.DIALOGUE, ElementType.PARENTHETICAL]:
            return ElementType.PARENTHETICAL

    if CHARACTER_PATTERN.match(stripped) and len(stripped) < 50:
        if not stripped.endswith('.') and not stripped.endswith('!') and not stripped.endswith('?'):
            return ElementType.CHARACTER

    if prev_type in [ElementType.CHARACTER, ElementType.PARENTHETICAL]:
        return ElementType.DIALOGUE

    return ElementType.ACTION


def parse_screenplay_elements(text_content: str) -> List[Tuple[ElementType, str]]:
    """Parse screenplay text into typed elements"""
    lines = text_content.split('\n')
    elements = []
    prev_type = None

    for line in lines:
        elem_type = detect_element_type(line, prev_type)
        elements.append((elem_type, line))
        if elem_type != ElementType.BLANK:
            prev_type = elem_type

    return elements


def generate_screenplay_html(
    text_content: str,
    title: str = "Untitled",
    version: str = "v1",
    color_code: str = "white",
    revision_date: Optional[str] = None,
) -> str:
    """
    Generate HTML for screenplay with proper formatting.

    Industry-standard screenplay format:
    - US Letter (8.5" x 11")
    - Courier 12pt font
    - 1.5" left margin, 1" right margin
    - Scene headings flush left, ALL CAPS
    - Character names centered, ALL CAPS
    - Dialogue centered, narrower width
    - Action flush left, full width
    - Transitions right-aligned
    """

    bg_color = REVISION_COLORS.get(color_code, "#FFFFFF")
    color_label = color_code.upper() if color_code != "white" else ""

    # Parse elements
    elements = parse_screenplay_elements(text_content)

    # Generate body HTML
    body_lines = []
    for elem_type, content in elements:
        stripped = content.strip()
        if not stripped:
            body_lines.append('<div class="blank">&nbsp;</div>')
            continue

        if elem_type == ElementType.SCENE_HEADING:
            body_lines.append(f'<div class="scene-heading">{stripped}</div>')
        elif elem_type == ElementType.CHARACTER:
            body_lines.append(f'<div class="character">{stripped}</div>')
        elif elem_type == ElementType.PARENTHETICAL:
            body_lines.append(f'<div class="parenthetical">{stripped}</div>')
        elif elem_type == ElementType.DIALOGUE:
            body_lines.append(f'<div class="dialogue">{stripped}</div>')
        elif elem_type == ElementType.TRANSITION:
            body_lines.append(f'<div class="transition">{stripped}</div>')
        else:  # ACTION
            body_lines.append(f'<div class="action">{stripped}</div>')

    body_content = '\n'.join(body_lines)

    # Revision header
    revision_header = ""
    if color_label:
        revision_header = f"""
        <div class="revision-header">
            <span class="revision-color" style="background-color: {bg_color};">{color_label} REVISION</span>
            {f'<span class="revision-date">{revision_date}</span>' if revision_date else ''}
        </div>
        """

    html = f"""<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>{title} - {version}</title>
    <style>
        @page {{
            size: 8.5in 11in;
            margin: 1in 1in 1in 1.5in;
            background-color: {bg_color};
            @bottom-center {{
                content: counter(page);
                font-family: 'Courier New', Courier, monospace;
                font-size: 12pt;
            }}
        }}

        body {{
            font-family: 'Courier New', Courier, monospace;
            font-size: 12pt;
            line-height: 1;
            background-color: {bg_color};
            margin: 0;
            padding: 0;
        }}

        .title-page {{
            page-break-after: always;
            text-align: center;
            padding-top: 3in;
        }}

        .title-page h1 {{
            font-size: 24pt;
            text-transform: uppercase;
            margin-bottom: 0.5in;
        }}

        .title-page .by {{
            margin: 0.5in 0;
        }}

        .revision-header {{
            text-align: right;
            margin-bottom: 0.25in;
            font-size: 10pt;
        }}

        .revision-color {{
            padding: 2px 8px;
            border: 1px solid #000;
            font-weight: bold;
        }}

        .revision-date {{
            margin-left: 0.25in;
        }}

        .scene-heading {{
            text-transform: uppercase;
            font-weight: bold;
            margin-top: 1em;
            margin-bottom: 0.5em;
        }}

        .action {{
            margin: 0.5em 0;
        }}

        .character {{
            text-transform: uppercase;
            margin-left: 2.2in;
            margin-top: 1em;
            margin-bottom: 0;
        }}

        .parenthetical {{
            margin-left: 1.6in;
            margin-right: 2in;
            margin-top: 0;
            margin-bottom: 0;
        }}

        .dialogue {{
            margin-left: 1in;
            margin-right: 1.5in;
            margin-top: 0;
            margin-bottom: 0;
        }}

        .transition {{
            text-align: right;
            text-transform: uppercase;
            margin: 1em 0;
        }}

        .blank {{
            height: 1em;
        }}
    </style>
</head>
<body>
    <div class="title-page">
        <h1>{title}</h1>
        <div class="by">by</div>
        <div class="author">[Author]</div>
        <div style="margin-top: 2in;">
            <div>{version}</div>
            {f'<div style="margin-top: 0.25in;">{color_label} REVISION</div>' if color_label else ''}
            {f'<div>{revision_date}</div>' if revision_date else ''}
        </div>
    </div>

    {revision_header}

    {body_content}
</body>
</html>
"""
    return html


def generate_screenplay_pdf(
    text_content: str,
    title: str = "Untitled",
    version: str = "v1",
    color_code: str = "white",
    revision_date: Optional[str] = None,
) -> bytes:
    """
    Generate a properly formatted screenplay PDF from text content.

    Args:
        text_content: The screenplay text (plain text or Fountain format)
        title: Script title for title page
        version: Version label (e.g., "v1", "v2")
        color_code: Revision color (white, blue, pink, yellow, green, etc.)
        revision_date: Date string for revision header

    Returns:
        PDF bytes
    """
    from weasyprint import HTML, CSS

    html_content = generate_screenplay_html(
        text_content=text_content,
        title=title,
        version=version,
        color_code=color_code,
        revision_date=revision_date,
    )

    # Generate PDF
    pdf_bytes = HTML(string=html_content).write_pdf()

    return pdf_bytes


def get_next_revision_color(current_color: Optional[str]) -> str:
    """Get the next color in the revision sequence"""
    if not current_color or current_color not in COLOR_SEQUENCE:
        return "blue"  # First revision after white

    current_idx = COLOR_SEQUENCE.index(current_color)
    next_idx = (current_idx + 1) % len(COLOR_SEQUENCE)
    return COLOR_SEQUENCE[next_idx]
