"""
Script Parser Utility - Parse screenplay files (PDF, FDX, Fountain) with formatting

Supports:
- PDF files (with intelligent screenplay element detection)
- FDX files (Final Draft XML format)
- Fountain files (plain text screenplay format)
- Celtx exports (FDX compatible)
"""

import re
import io
from typing import List, Dict, Optional, Tuple
from dataclasses import dataclass, field, asdict
from enum import Enum


class ElementType(Enum):
    SCENE_HEADING = "scene_heading"
    ACTION = "action"
    CHARACTER = "character"
    DIALOGUE = "dialogue"
    PARENTHETICAL = "parenthetical"
    TRANSITION = "transition"
    SHOT = "shot"
    PAGE_BREAK = "page_break"
    BLANK = "blank"
    # Title page elements
    TITLE = "title"
    AUTHOR = "author"
    CONTACT = "contact"
    DRAFT_INFO = "draft_info"
    COPYRIGHT = "copyright"
    TITLE_PAGE_TEXT = "title_page_text"


@dataclass
class ScriptElement:
    type: ElementType
    content: str
    page_number: Optional[int] = None
    is_title_page: bool = False


@dataclass
class ParsedScene:
    scene_number: str
    slugline: str
    int_ext: Optional[str]
    time_of_day: Optional[str]
    location_hint: str
    page_start: Optional[int] = None
    sequence: int = 0


@dataclass
class TitlePageData:
    """Structured title page metadata for storage as JSON"""
    title: Optional[str] = None
    written_by: Optional[List[str]] = None
    based_on: Optional[str] = None
    contact: Optional[Dict[str, str]] = None  # name, company, address, phone, email
    draft_info: Optional[Dict[str, str]] = None  # date, revision
    copyright: Optional[str] = None
    additional_lines: Optional[List[str]] = None


@dataclass
class ParseResult:
    text_content: str
    page_count: int
    scenes: List[ParsedScene]
    elements: List[ScriptElement]
    title_page_data: Optional[TitlePageData] = None


# Patterns for detecting screenplay elements
# Matches: INT. LOCATION, EXT LOCATION, INT/EXT. LOCATION, I/E LOCATION
# Also handles scene numbers at start: "1 INT. LOCATION" or "1A EXT. LOCATION"
SCENE_HEADING_PATTERN = re.compile(
    r'^(\d+[A-Za-z]?\.?\s+)?(INT\.?|EXT\.?|INT\.?\s*/\s*EXT\.?|I\s*/\s*E\.?|INTERIOR\.?|EXTERIOR\.?)\s+.+',
    re.IGNORECASE
)

TRANSITION_PATTERNS = [
    r'^FADE IN:?$',
    r'^FADE OUT\.?$',
    r'^FADE TO:?$',
    r'^CUT TO:?$',
    r'^DISSOLVE TO:?$',
    r'^SMASH CUT TO:?$',
    r'^MATCH CUT TO:?$',
    r'^JUMP CUT TO:?$',
    r'^TIME CUT:?$',
    r'^IRIS IN:?$',
    r'^IRIS OUT:?$',
    r'^WIPE TO:?$',
    r'.+TO:$',  # Generic transition ending in TO:
    r'^THE END\.?$',
]
TRANSITION_PATTERN = re.compile('|'.join(TRANSITION_PATTERNS), re.IGNORECASE)

# Character name: ALL CAPS, possibly with (V.O.), (O.S.), (CONT'D)
CHARACTER_PATTERN = re.compile(
    r'^[A-Z][A-Z0-9\s\-\'\.]+(\s*\(V\.O\.\)|\s*\(O\.S\.\)|\s*\(O\.C\.\)|\s*\(CONT\'D\)|\s*\(CONTINUING\)|\'S VOICE)?$'
)

PARENTHETICAL_PATTERN = re.compile(r'^\(.+\)$')

# Time of day patterns
TIME_OF_DAY_PATTERNS = ['DAY', 'NIGHT', 'DAWN', 'DUSK', 'MORNING', 'EVENING', 'AFTERNOON',
                        'CONTINUOUS', 'LATER', 'MOMENTS LATER', 'SAME TIME']

# Title page detection patterns
AUTHOR_PATTERNS = [
    r'^written\s+by',
    r'^screenplay\s+by',
    r'^teleplay\s+by',
    r'^story\s+by',
    r'^based\s+on',
    r'^by\s*$',
]
AUTHOR_PATTERN = re.compile('|'.join(AUTHOR_PATTERNS), re.IGNORECASE)

DRAFT_PATTERNS = [
    r'draft',
    r'revision',
    r'version',
    r'\d{1,2}/\d{1,2}/\d{2,4}',  # Date patterns like 01/15/2024
    r'(january|february|march|april|may|june|july|august|september|october|november|december)\s+\d{1,2},?\s*\d{2,4}',
]
DRAFT_PATTERN = re.compile('|'.join(DRAFT_PATTERNS), re.IGNORECASE)

COPYRIGHT_PATTERN = re.compile(r'(©|copyright|\(c\))', re.IGNORECASE)

CONTACT_PATTERNS = [
    r'@[\w.-]+\.\w+',  # Email
    r'\(\d{3}\)\s*\d{3}[-.]?\d{4}',  # Phone (xxx) xxx-xxxx
    r'\d{3}[-.]?\d{3}[-.]?\d{4}',  # Phone xxx-xxx-xxxx
    r'agent:',
    r'manager:',
    r'represented\s+by',
]
CONTACT_PATTERN = re.compile('|'.join(CONTACT_PATTERNS), re.IGNORECASE)


def classify_title_page_element(line: str, line_index: int, total_title_lines: int) -> ElementType:
    """
    Classify a title page line into the appropriate element type.
    Uses position and content patterns to determine type.
    """
    stripped = line.strip()
    upper = stripped.upper()

    if not stripped:
        return ElementType.BLANK

    # Check for copyright
    if COPYRIGHT_PATTERN.search(stripped):
        return ElementType.COPYRIGHT

    # Check for author line
    if AUTHOR_PATTERN.match(stripped):
        return ElementType.AUTHOR

    # Check for contact info
    if CONTACT_PATTERN.search(stripped):
        return ElementType.CONTACT

    # Check for draft info
    if DRAFT_PATTERN.search(stripped):
        return ElementType.DRAFT_INFO

    # First non-blank line is the title (line_index == 0)
    if line_index == 0:
        return ElementType.TITLE

    # Lines 1-3 after "Written by" or "Screenplay by" are author names
    # This is handled in context during parsing via prev_type

    # Default to generic title page text (centered)
    return ElementType.TITLE_PAGE_TEXT


def detect_title_page(lines: List[str], page_numbers: Optional[List[int]] = None) -> Tuple[List[ScriptElement], int]:
    """
    Detect title page content before first scene heading.

    Args:
        lines: All lines from the script
        page_numbers: Optional page number for each line (for PDFs)

    Returns:
        Tuple of (title_page_elements, first_scene_line_index)
    """
    title_elements: List[ScriptElement] = []

    # Patterns that indicate we've moved past the title page into script body
    SCRIPT_BODY_PATTERNS = [
        re.compile(r'^MONTAGE', re.IGNORECASE),
        re.compile(r'^\(V\.O\.\)$', re.IGNORECASE),
        re.compile(r'^\(O\.S\.\)$', re.IGNORECASE),
        re.compile(r'^\(MORE\)$', re.IGNORECASE),
        re.compile(r"^\(CONT'D\)$", re.IGNORECASE),
        re.compile(r'^-\s'),  # Action list items like "- People on phones"
    ]

    # Find where title page ends
    title_page_end = 0
    first_page_num = page_numbers[0] if page_numbers else None

    for i, line in enumerate(lines):
        stripped = line.strip()
        page_num = page_numbers[i] if page_numbers and i < len(page_numbers) else None

        # If we have page numbers and moved to page 2+, title page is done
        # (title page is always page 0 or 1 in PDF, which is page 1 in script numbering)
        if page_num is not None and first_page_num is not None:
            if page_num > first_page_num:
                title_page_end = i
                break

        # Scene heading ends title page
        if SCENE_HEADING_PATTERN.match(stripped):
            title_page_end = i
            break

        # FADE IN: can be on title page but next content should be script
        if TRANSITION_PATTERN.match(stripped) and stripped.upper() == 'FADE IN:':
            title_page_end = i + 1
            break

        # Limit title page to reasonable size (30 lines max without page numbers)
        if page_num is None and i > 30:
            title_page_end = i
            break

        # Script body patterns end title page
        for pattern in SCRIPT_BODY_PATTERNS:
            if pattern.match(stripped):
                title_page_end = i
                break
        else:
            continue
        break

    # If nothing found, no title page
    if title_page_end == 0:
        return [], 0

    # Parse title page elements
    title_line_idx = 0
    prev_type = None
    for i in range(title_page_end):
        line = lines[i]
        stripped = line.strip()
        page_num = page_numbers[i] if page_numbers and i < len(page_numbers) else 0

        if not stripped:
            if prev_type != ElementType.BLANK:
                title_elements.append(ScriptElement(
                    type=ElementType.BLANK,
                    content='',
                    page_number=page_num,
                    is_title_page=True
                ))
                prev_type = ElementType.BLANK
            continue

        elem_type = classify_title_page_element(stripped, title_line_idx, title_page_end)

        # Special case: line after "written by" or author pattern is the author name
        if prev_type == ElementType.AUTHOR or (prev_type == ElementType.TITLE_PAGE_TEXT and
            len(title_elements) > 0 and AUTHOR_PATTERN.match(title_elements[-1].content)):
            # This is the author's name
            elem_type = ElementType.AUTHOR

        title_elements.append(ScriptElement(
            type=elem_type,
            content=stripped,
            page_number=page_num,
            is_title_page=True
        ))
        prev_type = elem_type
        title_line_idx += 1

    return title_elements, title_page_end


def extract_title_page_metadata(elements: List[ScriptElement]) -> Optional[TitlePageData]:
    """
    Extract structured metadata from title page elements.

    Args:
        elements: List of ScriptElement objects (filters for is_title_page=True)

    Returns:
        TitlePageData with extracted fields, or None if no title page elements
    """
    title_page_elements = [e for e in elements if e.is_title_page and e.type != ElementType.BLANK]

    if not title_page_elements:
        return None

    data = TitlePageData()
    data.written_by = []
    data.additional_lines = []

    # Track if we've seen "written by" to identify author names
    seen_written_by = False

    for elem in title_page_elements:
        content = elem.content.strip()

        if elem.type == ElementType.TITLE:
            data.title = content
        elif elem.type == ElementType.AUTHOR:
            # Check if this is "Written by" header or an actual author name
            if AUTHOR_PATTERN.match(content):
                seen_written_by = True
                # Check if it contains "Based on"
                if 'based on' in content.lower():
                    data.based_on = content
            # Check if this looks like contact info (misclassified as author)
            elif CONTACT_PATTERN.search(content):
                if data.contact is None:
                    data.contact = {}
                if '@' in content and '.' in content:
                    data.contact['email'] = content
                elif re.search(r'\(\d{3}\)', content) or re.search(r'\d{3}[-.]?\d{3}[-.]?\d{4}', content):
                    data.contact['phone'] = content
                else:
                    existing = data.contact.get('address', '')
                    if existing:
                        data.contact['address'] = existing + '\n' + content
                    else:
                        data.contact['address'] = content
            # Check if this looks like a street address (ZIP code, state abbrev, street types)
            elif re.search(r'\d{5}(-\d{4})?$', content) or \
                 re.search(r'\b(st|street|ave|avenue|blvd|boulevard|rd|road|dr|drive|ln|lane|pkwy|parkway|ct|court|pl|place)\b', content, re.IGNORECASE) or \
                 re.search(r'\b(AL|AK|AZ|AR|CA|CO|CT|DE|FL|GA|HI|ID|IL|IN|IA|KS|KY|LA|ME|MD|MA|MI|MN|MS|MO|MT|NE|NV|NH|NJ|NM|NY|NC|ND|OH|OK|OR|PA|RI|SC|SD|TN|TX|UT|VT|VA|WA|WV|WI|WY)\b[,.\s]+\d{5}', content):
                if data.contact is None:
                    data.contact = {}
                existing = data.contact.get('address', '')
                if existing:
                    data.contact['address'] = existing + '\n' + content
                else:
                    data.contact['address'] = content
            else:
                # This is an author name
                data.written_by.append(content)
        elif elem.type == ElementType.COPYRIGHT:
            data.copyright = content
        elif elem.type == ElementType.DRAFT_INFO:
            if data.draft_info is None:
                data.draft_info = {}
            # Try to parse date vs revision
            if re.search(r'\d{1,2}/\d{1,2}/\d{2,4}', content) or \
               re.search(r'(january|february|march|april|may|june|july|august|september|october|november|december)', content, re.IGNORECASE):
                data.draft_info['date'] = content
            elif 'draft' in content.lower() or 'revision' in content.lower():
                data.draft_info['revision'] = content
            else:
                data.draft_info['date'] = content
        elif elem.type == ElementType.CONTACT:
            if data.contact is None:
                data.contact = {}
            # Try to categorize contact info
            if '@' in content and '.' in content:
                data.contact['email'] = content
            elif re.search(r'\(\d{3}\)', content) or re.search(r'\d{3}[-.]?\d{3}[-.]?\d{4}', content):
                data.contact['phone'] = content
            else:
                # Likely address or name
                existing = data.contact.get('address', '')
                if existing:
                    data.contact['address'] = existing + '\n' + content
                else:
                    data.contact['address'] = content
        elif elem.type == ElementType.TITLE_PAGE_TEXT:
            # Check for "Based on" pattern
            if content.lower().startswith('based on'):
                data.based_on = content
            else:
                data.additional_lines.append(content)

    # Clean up empty lists
    if not data.written_by:
        data.written_by = None
    if not data.additional_lines:
        data.additional_lines = None

    return data


def detect_element_type(line: str, prev_type: Optional[ElementType] = None) -> ElementType:
    """Detect the screenplay element type for a line of text"""
    stripped = line.strip()

    if not stripped:
        return ElementType.BLANK

    # Scene heading
    if SCENE_HEADING_PATTERN.match(stripped):
        return ElementType.SCENE_HEADING

    # Transition
    if TRANSITION_PATTERN.match(stripped):
        return ElementType.TRANSITION

    # Parenthetical (must follow character or dialogue)
    if PARENTHETICAL_PATTERN.match(stripped):
        if prev_type in [ElementType.CHARACTER, ElementType.DIALOGUE, ElementType.PARENTHETICAL]:
            return ElementType.PARENTHETICAL

    # Character name (ALL CAPS, reasonable length)
    if CHARACTER_PATTERN.match(stripped) and len(stripped) < 50:
        # Additional check: shouldn't be a short action line
        if not stripped.endswith('.') and not stripped.endswith('!') and not stripped.endswith('?'):
            return ElementType.CHARACTER

    # Dialogue (follows character or parenthetical)
    if prev_type in [ElementType.CHARACTER, ElementType.PARENTHETICAL]:
        return ElementType.DIALOGUE

    # Default to action
    return ElementType.ACTION


def parse_scene_heading(heading: str) -> Tuple[Optional[str], Optional[str], str]:
    """Parse a scene heading to extract INT/EXT, time of day, and location"""
    # First strip any scene number prefix like "1 " or "1A " or "42. "
    heading = re.sub(r'^\d+[A-Za-z]?\.?\s+', '', heading.strip())
    heading_upper = heading.upper().strip()

    int_ext = None
    time_of_day = None
    location = heading

    # Extract INT/EXT (handle various formats)
    # INTERIOR/EXTERIOR (full words)
    if heading_upper.startswith('INTERIOR'):
        int_ext = 'INT'
        location = re.sub(r'^INTERIOR\.?\s*', '', heading, flags=re.IGNORECASE).strip()
    elif heading_upper.startswith('EXTERIOR'):
        int_ext = 'EXT'
        location = re.sub(r'^EXTERIOR\.?\s*', '', heading, flags=re.IGNORECASE).strip()
    # INT/EXT variations
    elif heading_upper.startswith('INT.') or heading_upper.startswith('INT '):
        int_ext = 'INT'
        location = heading[4:].strip()
    elif heading_upper.startswith('EXT.') or heading_upper.startswith('EXT '):
        int_ext = 'EXT'
        location = heading[4:].strip()
    elif heading_upper.startswith('INT./EXT.') or heading_upper.startswith('INT/EXT'):
        int_ext = 'INT/EXT'
        start_idx = 9 if heading_upper.startswith('INT./EXT.') else 7
        location = heading[start_idx:].strip()
    elif heading_upper.startswith('I/E.') or heading_upper.startswith('I/E '):
        int_ext = 'INT/EXT'
        location = heading[4:].strip()

    # Extract time of day
    location_upper = location.upper()
    for tod in TIME_OF_DAY_PATTERNS:
        # Check for " - DAY" or "- DAY" or " DAY" at end
        patterns = [f' - {tod}', f'- {tod}', f' {tod}']
        for pattern in patterns:
            if location_upper.endswith(pattern):
                time_of_day = tod
                location = location[:-len(pattern)].strip()
                break
        if time_of_day:
            break

    # Clean up location
    location = location.strip(' -')

    return int_ext, time_of_day, location


def strip_scene_number(text: str) -> str:
    """Strip scene numbers from scene headings.

    Scene numbers appear as: "1   INT. LOCATION" or "1A  EXT. LOCATION"
    Returns just the scene heading without the number.
    """
    # Pattern: optional scene number (digits, possibly with letter) followed by spaces
    cleaned = re.sub(r'^\d+[A-Za-z]?\s+', '', text)
    return cleaned


def format_screenplay_text(elements: List[ScriptElement]) -> str:
    """Format parsed elements into properly formatted screenplay text.

    Note: Title page elements (is_title_page=True) are excluded from output.
    They are stored separately in title_page_data JSON field.
    """
    lines = []
    prev_was_blank = False

    for elem in elements:
        # Skip title page elements - they're stored separately in title_page_data
        if elem.is_title_page:
            continue

        content = elem.content.strip()

        # Skip consecutive blank lines
        if elem.type == ElementType.BLANK:
            if not prev_was_blank:
                lines.append('')
                prev_was_blank = True
            continue

        prev_was_blank = False

        if elem.type == ElementType.SCENE_HEADING:
            # Strip scene numbers from scene headings
            content = strip_scene_number(content)
            if lines and lines[-1] != '':
                lines.append('')
            lines.append(content.upper())
            lines.append('')
        elif elem.type == ElementType.ACTION:
            lines.append(content)
        elif elem.type == ElementType.CHARACTER:
            if lines and lines[-1] != '':
                lines.append('')
            lines.append(f"                    {content.upper()}")
        elif elem.type == ElementType.DIALOGUE:
            lines.append(f"          {content}")
        elif elem.type == ElementType.PARENTHETICAL:
            if not content.startswith('('):
                content = f"({content})"
            lines.append(f"               {content}")
        elif elem.type == ElementType.TRANSITION:
            if lines and lines[-1] != '':
                lines.append('')
            lines.append(f"                                        {content.upper()}")
            lines.append('')
        elif elem.type == ElementType.PAGE_BREAK:
            # Skip page breaks - we don't need them in the editor
            continue
        # Title page elements - centered formatting
        elif elem.type == ElementType.TITLE:
            lines.append(f"                    {content.upper()}")
        elif elem.type == ElementType.AUTHOR:
            lines.append(f"                    {content}")
        elif elem.type == ElementType.DRAFT_INFO:
            lines.append(f"                    {content}")
        elif elem.type == ElementType.COPYRIGHT:
            lines.append(f"                    {content}")
        elif elem.type == ElementType.CONTACT:
            lines.append(content)  # Contact usually left-aligned at bottom
        elif elem.type == ElementType.TITLE_PAGE_TEXT:
            lines.append(f"                    {content}")
        else:
            lines.append(content)

    # Clean up: remove leading/trailing blank lines and collapse multiple blanks
    result = '\n'.join(lines)
    # Collapse 3+ newlines into 2
    result = re.sub(r'\n{3,}', '\n\n', result)
    return result.strip()


# =============================================================================
# PDFTOTEXT EXTRACTION (Better layout preservation)
# =============================================================================

def extract_pdf_with_pdftotext(content: bytes) -> Tuple[str, int]:
    """Extract PDF text using pdftotext with layout preservation.

    pdftotext (from poppler-utils) preserves indentation/spacing better than pypdf.
    This allows more accurate screenplay element detection based on layout.

    Returns: (text_content, page_count)
    Raises: FileNotFoundError if pdftotext not installed
    """
    import subprocess
    import tempfile
    import os

    with tempfile.NamedTemporaryFile(suffix='.pdf', delete=False) as tmp:
        tmp.write(content)
        tmp_path = tmp.name

    try:
        # Get page count using pdfinfo
        result = subprocess.run(
            ['pdfinfo', tmp_path],
            capture_output=True, text=True, timeout=30
        )
        page_count = 1
        for line in result.stdout.split('\n'):
            if line.startswith('Pages:'):
                page_count = int(line.split(':')[1].strip())
                break

        # Extract text with layout preservation
        result = subprocess.run(
            ['pdftotext', '-layout', '-enc', 'UTF-8', tmp_path, '-'],
            capture_output=True, text=True, timeout=60
        )

        if result.returncode != 0:
            raise subprocess.SubprocessError(f"pdftotext failed: {result.stderr}")

        return result.stdout, page_count
    finally:
        os.unlink(tmp_path)


def strip_page_number(line: str) -> str:
    """Strip page numbers from the right side of a line.

    pdftotext preserves page numbers at the right margin. These typically appear as:
    - Standalone numbers at the far right after whitespace
    - Numbers after scene text with lots of trailing space
    """
    # Remove trailing page numbers - number at end after 2+ spaces
    # More aggressive: 2+ spaces followed by 1-3 digits at end
    cleaned = re.sub(r'\s{2,}\d{1,3}\s*$', '', line)
    return cleaned


def strip_scene_number_from_line(line: str) -> str:
    """Strip scene numbers from the beginning of any line.

    Scene numbers appear at the start: "1 TEXT" or "1A TEXT" or "42  TEXT" or "1\tTEXT"
    """
    # Strip leading scene numbers (digits, optionally with letter, followed by 1+ whitespace)
    # Also handle scene numbers followed by a period and space like "1. INT."
    cleaned = re.sub(r'^\s*\d+[A-Za-z]?\.?\s+', '', line)
    return cleaned


def is_standalone_page_number(line: str) -> bool:
    """Check if a line is just a standalone page number.

    Page numbers appear as:
    - Just a number: "2" or "  2  " or "42"
    - Number with period: "2." or "42."
    - Number with dash continuation: "2-" or "(CONTINUED)"
    """
    stripped = line.strip()
    if not stripped:
        return False

    # Just a number (1-3 digits)
    if re.match(r'^\d{1,3}$', stripped):
        return True

    # Number with period
    if re.match(r'^\d{1,3}\.$', stripped):
        return True

    # Number with dash (page continuation)
    if re.match(r'^\d{1,3}-$', stripped):
        return True

    # (CONTINUED) or CONTINUED markers
    if stripped.upper() in ['(CONTINUED)', 'CONTINUED', '(MORE)', 'MORE']:
        return True

    return False


def detect_element_from_indent(line: str, prev_type: Optional[ElementType] = None) -> ElementType:
    """Detect screenplay element type from indentation (layout-aware).

    When pdftotext is used with -layout, indentation is preserved.
    Standard screenplay margins (in characters, can vary by PDF):
    - Scene heading: 0-10 indent (left-aligned)
    - Action: 0-10 indent
    - Character: 20-50 indent (centered) - wider range to accommodate variations
    - Dialogue: 10-25 indent
    - Parenthetical: 15-35 indent
    - Transition: 45+ indent (right-aligned)
    """
    # First strip any page numbers from the right side
    line = strip_page_number(line)
    # Strip scene numbers from the left side (for left-aligned lines)
    line = strip_scene_number_from_line(line)

    stripped = line.lstrip()
    if not stripped:
        return ElementType.BLANK

    indent = len(line) - len(stripped)
    text = stripped.strip()

    if not text:
        return ElementType.BLANK

    # Right-aligned (transition) - 45+ chars indent
    if indent >= 45:
        return ElementType.TRANSITION

    # Centered (character name) - 20-50 chars indent, ALL CAPS
    # Character names are uppercase, may have extensions like (V.O.), (O.S.), (CONT'D)
    if 20 <= indent <= 50:
        # Remove parenthetical extensions for the uppercase check
        name_part = re.sub(r'\s*\([^)]+\)\s*$', '', text)
        # Also remove any remaining trailing numbers (scene/page refs)
        name_part = re.sub(r'\s+\d+\s*$', '', name_part).strip()
        if name_part and name_part.isupper() and 1 < len(name_part) < 40:
            return ElementType.CHARACTER

    # Parenthetical - 15-35 chars indent, starts with (
    if 15 <= indent <= 40 and text.startswith('('):
        return ElementType.PARENTHETICAL

    # Dialogue - 10-25 chars indent (after character or parenthetical)
    if 10 <= indent <= 30:
        if prev_type in [ElementType.CHARACTER, ElementType.PARENTHETICAL, ElementType.DIALOGUE]:
            return ElementType.DIALOGUE

    # Left-aligned (scene heading or action) - 0-10 chars indent
    if indent < 12:
        # Scene heading patterns
        if SCENE_HEADING_PATTERN.match(text):
            return ElementType.SCENE_HEADING
        # Transition at left margin
        if any(trans in text.upper() for trans in ['FADE IN', 'FADE OUT', 'THE END']):
            return ElementType.TRANSITION
        return ElementType.ACTION

    # Fallback: Check patterns regardless of indent for edge cases
    if SCENE_HEADING_PATTERN.match(text):
        return ElementType.SCENE_HEADING

    # Check if it looks like a character name (ALL CAPS, reasonable length)
    name_part = re.sub(r'\s*\([^)]+\)\s*$', '', text)
    name_part = re.sub(r'\s+\d+\s*$', '', name_part).strip()
    if name_part and name_part.isupper() and 1 < len(name_part) < 40:
        # Additional check: no lowercase letters, not a scene heading
        if not any(c.islower() for c in name_part) and not SCENE_HEADING_PATTERN.match(text):
            return ElementType.CHARACTER

    # Default to action for ambiguous cases
    return ElementType.ACTION


def parse_pdf_with_layout(text_content: str, page_count: int) -> ParseResult:
    """Parse PDF text that was extracted with layout preservation (pdftotext -layout).

    Uses indentation-based element detection for more accurate parsing.
    """
    all_lines = text_content.split('\n')

    # Build raw lines list for title page detection (stripped versions)
    stripped_lines = [line.strip() for line in all_lines]

    # Detect title page - use page breaks (form feed) or first scene heading
    # pdftotext uses form feed (\f) for page breaks
    pages = text_content.split('\f')
    page_line_map = []
    line_idx = 0
    for page_num, page_text in enumerate(pages, 1):
        page_lines = page_text.split('\n')
        for _ in page_lines:
            page_line_map.append(page_num)
            line_idx += 1

    # Re-split without form feeds for processing
    all_lines = text_content.replace('\f', '\n').split('\n')

    # Adjust page map if needed
    if len(page_line_map) < len(all_lines):
        page_line_map.extend([page_count] * (len(all_lines) - len(page_line_map)))

    # Detect title page content
    stripped_for_detection = [line.strip() for line in all_lines]
    title_elements, script_start_idx = detect_title_page(stripped_for_detection, page_line_map[:len(stripped_for_detection)])

    # Parse script body with layout-aware detection
    elements: List[ScriptElement] = list(title_elements)
    scenes: List[ParsedScene] = []
    seen_sluglines: set = set()  # Track unique scenes by slugline
    scene_count = 0
    prev_type: Optional[ElementType] = title_elements[-1].type if title_elements else None

    for i in range(script_start_idx, len(all_lines)):
        line = all_lines[i]
        page_num = page_line_map[i] if i < len(page_line_map) else page_count

        # Skip empty lines but track them
        if not line.strip():
            if prev_type != ElementType.BLANK:
                elements.append(ScriptElement(
                    type=ElementType.BLANK,
                    content='',
                    page_number=page_num,
                    is_title_page=False
                ))
                prev_type = ElementType.BLANK
            continue

        # Skip standalone page numbers (lines that are just a number)
        if is_standalone_page_number(line):
            continue

        # Clean the line: strip page numbers from right, scene numbers from left
        cleaned_line = strip_page_number(line)
        cleaned_line = strip_scene_number_from_line(cleaned_line)
        cleaned_content = cleaned_line.strip()

        # Skip if cleaning left us with nothing or just a page number
        if not cleaned_content or is_standalone_page_number(cleaned_content):
            continue

        # Use layout-aware detection (uses cleaned line internally)
        elem_type = detect_element_from_indent(line, prev_type)

        elements.append(ScriptElement(
            type=elem_type,
            content=cleaned_content,  # Store cleaned content without scene/page numbers
            page_number=page_num,
            is_title_page=False
        ))

        # Track scenes - deduplicate by slugline (same heading = same scene)
        if elem_type == ElementType.SCENE_HEADING:
            slugline_key = cleaned_content.upper().strip()
            if slugline_key not in seen_sluglines:
                seen_sluglines.add(slugline_key)
                scene_count += 1
                int_ext, time_of_day, location = parse_scene_heading(cleaned_content)
                scenes.append(ParsedScene(
                    scene_number=str(scene_count),
                    slugline=cleaned_content,
                    int_ext=int_ext,
                    time_of_day=time_of_day,
                    location_hint=location,
                    page_start=page_num,
                    sequence=scene_count
                ))

        prev_type = elem_type

    # Extract title page metadata
    title_page_data = extract_title_page_metadata(title_elements)

    # Format the text content (excluding title page)
    text_content = format_screenplay_text(elements)

    return ParseResult(
        text_content=text_content,
        page_count=page_count,
        scenes=scenes,
        elements=elements,
        title_page_data=title_page_data
    )


def parse_pdf(content: bytes) -> ParseResult:
    """Parse a PDF screenplay file.

    Tries pdftotext first (better layout preservation), falls back to pypdf.
    """
    # Ensure content is bytes
    if not isinstance(content, bytes):
        raise ValueError(f"Expected bytes, got {type(content)}")

    print(f"parse_pdf: content is {type(content)}, length={len(content)}")

    # Try pdftotext first (better layout preservation)
    try:
        print("parse_pdf: Trying pdftotext extraction...")
        text_content, page_count = extract_pdf_with_pdftotext(content)
        if text_content.strip():
            # Count pages in extracted text by form feed characters
            extracted_pages = text_content.count('\f') + 1
            print(f"parse_pdf: pdftotext succeeded, pdfinfo reports {page_count} pages, extracted {extracted_pages} pages (via form feeds), {len(text_content)} chars")
            result = parse_pdf_with_layout(text_content, page_count)
            print(f"parse_pdf: After parsing: {len(result.text_content)} chars, {len(result.scenes)} scenes")
            return result
    except FileNotFoundError:
        print("parse_pdf: pdftotext not installed, falling back to pypdf")
    except Exception as e:
        import traceback
        print(f"parse_pdf: pdftotext failed ({e}), falling back to pypdf")
        print(f"parse_pdf: Traceback: {traceback.format_exc()}")

    # Fallback to pypdf
    try:
        from pypdf import PdfReader
        print("parse_pdf: Using pypdf library")
    except ImportError:
        try:
            from PyPDF2 import PdfReader
            print("parse_pdf: Using PyPDF2 library")
        except ImportError:
            raise ImportError("pypdf or PyPDF2 is required for PDF parsing")

    # Create BytesIO wrapper
    pdf_bytes = io.BytesIO(content)
    print(f"parse_pdf: Using pypdf, BytesIO created, readable={pdf_bytes.readable()}")

    reader = PdfReader(pdf_bytes)
    page_count = len(reader.pages)
    print(f"parse_pdf: pypdf detected {page_count} pages")

    # First pass: collect all lines with their page numbers
    all_lines: List[str] = []
    line_page_numbers: List[int] = []
    total_chars_extracted = 0

    for page_num, page in enumerate(reader.pages, 1):
        page_text = page.extract_text() or ""
        total_chars_extracted += len(page_text)
        lines = page_text.split('\n')
        print(f"parse_pdf: Page {page_num}/{page_count}: {len(page_text)} chars, {len(lines)} lines")
        for line in lines:
            all_lines.append(line)
            line_page_numbers.append(page_num)

    print(f"parse_pdf: Total extracted from pypdf: {total_chars_extracted} chars, {len(all_lines)} lines")

    # Detect title page content
    title_elements, script_start_idx = detect_title_page(all_lines, line_page_numbers)

    # Second pass: parse the script body (after title page)
    elements: List[ScriptElement] = list(title_elements)  # Start with title page elements
    scenes: List[ParsedScene] = []
    seen_sluglines: set = set()  # Track unique scenes by slugline
    scene_count = 0
    prev_type: Optional[ElementType] = title_elements[-1].type if title_elements else None

    for i in range(script_start_idx, len(all_lines)):
        line = all_lines[i].strip()
        page_num = line_page_numbers[i]

        # Skip empty lines but track them
        if not line:
            if prev_type != ElementType.BLANK:
                elements.append(ScriptElement(
                    type=ElementType.BLANK,
                    content='',
                    page_number=page_num,
                    is_title_page=False
                ))
                prev_type = ElementType.BLANK
            continue

        # Detect element type
        elem_type = detect_element_type(line, prev_type)

        elements.append(ScriptElement(
            type=elem_type,
            content=line,
            page_number=page_num,
            is_title_page=False
        ))

        # Track scenes - deduplicate by slugline
        if elem_type == ElementType.SCENE_HEADING:
            slugline_key = line.upper().strip()
            if slugline_key not in seen_sluglines:
                seen_sluglines.add(slugline_key)
                scene_count += 1
                int_ext, time_of_day, location = parse_scene_heading(line)
                scenes.append(ParsedScene(
                    scene_number=str(scene_count),
                    slugline=line,
                    int_ext=int_ext,
                    time_of_day=time_of_day,
                    location_hint=location,
                    page_start=page_num,
                    sequence=scene_count
                ))

        prev_type = elem_type

    # Extract title page metadata
    title_page_data = extract_title_page_metadata(elements)

    # Format the text content
    text_content = format_screenplay_text(elements)

    print(f"parse_pdf (pypdf): Final output: {len(text_content)} chars, {len(scenes)} scenes, {len(elements)} elements")

    return ParseResult(
        text_content=text_content,
        page_count=page_count,
        scenes=scenes,
        elements=elements,
        title_page_data=title_page_data
    )


def parse_fdx(content: bytes) -> ParseResult:
    """Parse a Final Draft FDX file"""
    import xml.etree.ElementTree as ET

    root = ET.fromstring(content.decode('utf-8'))

    elements: List[ScriptElement] = []
    scenes: List[ParsedScene] = []
    seen_sluglines: set = set()  # Track unique scenes by slugline
    scene_count = 0
    page_count = 1

    # FDX element type mapping
    fdx_type_map = {
        'Scene Heading': ElementType.SCENE_HEADING,
        'Action': ElementType.ACTION,
        'Character': ElementType.CHARACTER,
        'Dialogue': ElementType.DIALOGUE,
        'Parenthetical': ElementType.PARENTHETICAL,
        'Transition': ElementType.TRANSITION,
        'Shot': ElementType.SHOT,
        'General': ElementType.ACTION,
    }

    # Find all paragraphs
    for para in root.iter('Paragraph'):
        para_type = para.get('Type', 'Action')

        # Extract text content
        text_parts = []
        for text_elem in para.findall('.//Text'):
            if text_elem.text:
                text_parts.append(text_elem.text)
        text_content = ''.join(text_parts).strip()

        if not text_content:
            elements.append(ScriptElement(
                type=ElementType.BLANK,
                content=''
            ))
            continue

        # Map to our element type
        elem_type = fdx_type_map.get(para_type, ElementType.ACTION)

        elements.append(ScriptElement(
            type=elem_type,
            content=text_content
        ))

        # Track scenes - deduplicate by slugline
        if elem_type == ElementType.SCENE_HEADING:
            slugline_key = text_content.upper().strip()
            if slugline_key not in seen_sluglines:
                seen_sluglines.add(slugline_key)
                scene_count += 1
                int_ext, time_of_day, location = parse_scene_heading(text_content)
                scenes.append(ParsedScene(
                    scene_number=str(scene_count),
                    slugline=text_content,
                    int_ext=int_ext,
                    time_of_day=time_of_day,
                    location_hint=location,
                    sequence=scene_count
                ))

    # Estimate page count (roughly 55 elements per page)
    page_count = max(1, len(elements) // 55)

    # Extract title page metadata
    title_page_data = extract_title_page_metadata(elements)

    # Format text content
    formatted_text = format_screenplay_text(elements)

    return ParseResult(
        text_content=formatted_text,
        page_count=page_count,
        scenes=scenes,
        elements=elements,
        title_page_data=title_page_data
    )


def parse_fountain(content: str) -> ParseResult:
    """Parse a Fountain format screenplay"""
    lines = content.split('\n')

    elements: List[ScriptElement] = []
    scenes: List[ParsedScene] = []
    seen_sluglines: set = set()  # Track unique scenes by slugline
    scene_count = 0
    prev_type: Optional[ElementType] = None

    i = 0
    while i < len(lines):
        line = lines[i]
        stripped = line.strip()

        # Empty line
        if not stripped:
            if prev_type != ElementType.BLANK:
                elements.append(ScriptElement(type=ElementType.BLANK, content=''))
                prev_type = ElementType.BLANK
            i += 1
            continue

        # Forced scene heading (starts with .)
        if stripped.startswith('.') and len(stripped) > 1:
            text = stripped[1:].strip()
            elements.append(ScriptElement(type=ElementType.SCENE_HEADING, content=text))
            # Deduplicate by slugline
            slugline_key = text.upper().strip()
            if slugline_key not in seen_sluglines:
                seen_sluglines.add(slugline_key)
                scene_count += 1
                int_ext, time_of_day, location = parse_scene_heading(text)
                scenes.append(ParsedScene(
                    scene_number=str(scene_count),
                    slugline=text,
                    int_ext=int_ext,
                    time_of_day=time_of_day,
                    location_hint=location,
                    sequence=scene_count
                ))
            prev_type = ElementType.SCENE_HEADING
            i += 1
            continue

        # Forced transition (starts with >)
        if stripped.startswith('>') and not stripped.endswith('<'):
            text = stripped[1:].strip()
            elements.append(ScriptElement(type=ElementType.TRANSITION, content=text))
            prev_type = ElementType.TRANSITION
            i += 1
            continue

        # Forced character (starts with @)
        if stripped.startswith('@'):
            text = stripped[1:].strip()
            elements.append(ScriptElement(type=ElementType.CHARACTER, content=text))
            prev_type = ElementType.CHARACTER
            i += 1
            continue

        # Detect element type normally
        elem_type = detect_element_type(stripped, prev_type)

        # Check for scene heading - deduplicate by slugline
        if elem_type == ElementType.SCENE_HEADING:
            slugline_key = stripped.upper().strip()
            if slugline_key not in seen_sluglines:
                seen_sluglines.add(slugline_key)
                scene_count += 1
                int_ext, time_of_day, location = parse_scene_heading(stripped)
                scenes.append(ParsedScene(
                    scene_number=str(scene_count),
                    slugline=stripped,
                    int_ext=int_ext,
                    time_of_day=time_of_day,
                    location_hint=location,
                    sequence=scene_count
                ))

        elements.append(ScriptElement(type=elem_type, content=stripped))
        prev_type = elem_type
        i += 1

    # Extract title page metadata
    title_page_data = extract_title_page_metadata(elements)

    # Format text content
    formatted_text = format_screenplay_text(elements)
    page_count = max(1, len(elements) // 55)

    return ParseResult(
        text_content=formatted_text,
        page_count=page_count,
        scenes=scenes,
        elements=elements,
        title_page_data=title_page_data
    )


def parse_script_file(content: bytes, file_type: str) -> ParseResult:
    """
    Parse a script file based on its type

    Args:
        content: Raw file content as bytes
        file_type: File extension (pdf, fdx, txt, fountain)

    Returns:
        ParseResult with formatted text, page count, and scenes
    """
    file_type = file_type.lower()

    if file_type == 'pdf':
        return parse_pdf(content)
    elif file_type == 'fdx':
        return parse_fdx(content)
    elif file_type in ['txt', 'fountain']:
        text = content.decode('utf-8')
        return parse_fountain(text)
    else:
        raise ValueError(f"Unsupported file type: {file_type}")
