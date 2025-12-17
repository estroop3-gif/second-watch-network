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
from dataclasses import dataclass
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


@dataclass
class ScriptElement:
    type: ElementType
    content: str
    page_number: Optional[int] = None


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
class ParseResult:
    text_content: str
    page_count: int
    scenes: List[ParsedScene]
    elements: List[ScriptElement]


# Patterns for detecting screenplay elements
SCENE_HEADING_PATTERN = re.compile(
    r'^(INT\.?|EXT\.?|INT\.?/EXT\.?|I/E\.?)\s+.+',
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
    heading_upper = heading.upper().strip()

    int_ext = None
    time_of_day = None
    location = heading

    # Extract INT/EXT
    if heading_upper.startswith('INT.') or heading_upper.startswith('INT '):
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


def format_screenplay_text(elements: List[ScriptElement]) -> str:
    """Format parsed elements into properly formatted screenplay text"""
    lines = []

    for elem in elements:
        content = elem.content.strip()

        if elem.type == ElementType.BLANK:
            lines.append('')
        elif elem.type == ElementType.SCENE_HEADING:
            lines.append('')
            lines.append(content.upper())
            lines.append('')
        elif elem.type == ElementType.ACTION:
            lines.append(content)
        elif elem.type == ElementType.CHARACTER:
            lines.append('')
            lines.append(f"                    {content.upper()}")
        elif elem.type == ElementType.DIALOGUE:
            lines.append(f"          {content}")
        elif elem.type == ElementType.PARENTHETICAL:
            if not content.startswith('('):
                content = f"({content})"
            lines.append(f"               {content}")
        elif elem.type == ElementType.TRANSITION:
            lines.append('')
            lines.append(f"                                        {content.upper()}")
            lines.append('')
        elif elem.type == ElementType.PAGE_BREAK:
            lines.append('')
            lines.append('=' * 60)
            lines.append('')
        else:
            lines.append(content)

    return '\n'.join(lines)


def parse_pdf(content: bytes) -> ParseResult:
    """Parse a PDF screenplay file"""
    try:
        from pypdf import PdfReader
    except ImportError:
        try:
            from PyPDF2 import PdfReader
        except ImportError:
            raise ImportError("pypdf or PyPDF2 is required for PDF parsing")

    reader = PdfReader(io.BytesIO(content))
    page_count = len(reader.pages)

    elements: List[ScriptElement] = []
    scenes: List[ParsedScene] = []
    scene_count = 0
    prev_type: Optional[ElementType] = None

    for page_num, page in enumerate(reader.pages, 1):
        page_text = page.extract_text() or ""

        # Split into lines and process
        lines = page_text.split('\n')

        for line in lines:
            line = line.strip()

            # Skip empty lines but track them
            if not line:
                if prev_type != ElementType.BLANK:
                    elements.append(ScriptElement(
                        type=ElementType.BLANK,
                        content='',
                        page_number=page_num
                    ))
                    prev_type = ElementType.BLANK
                continue

            # Detect element type
            elem_type = detect_element_type(line, prev_type)

            elements.append(ScriptElement(
                type=elem_type,
                content=line,
                page_number=page_num
            ))

            # Track scenes
            if elem_type == ElementType.SCENE_HEADING:
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

    # Format the text content
    text_content = format_screenplay_text(elements)

    return ParseResult(
        text_content=text_content,
        page_count=page_count,
        scenes=scenes,
        elements=elements
    )


def parse_fdx(content: bytes) -> ParseResult:
    """Parse a Final Draft FDX file"""
    import xml.etree.ElementTree as ET

    root = ET.fromstring(content.decode('utf-8'))

    elements: List[ScriptElement] = []
    scenes: List[ParsedScene] = []
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

        # Track scenes
        if elem_type == ElementType.SCENE_HEADING:
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

    # Format text content
    formatted_text = format_screenplay_text(elements)

    return ParseResult(
        text_content=formatted_text,
        page_count=page_count,
        scenes=scenes,
        elements=elements
    )


def parse_fountain(content: str) -> ParseResult:
    """Parse a Fountain format screenplay"""
    lines = content.split('\n')

    elements: List[ScriptElement] = []
    scenes: List[ParsedScene] = []
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

        # Check for scene heading
        if elem_type == ElementType.SCENE_HEADING:
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

    # Format text content
    formatted_text = format_screenplay_text(elements)
    page_count = max(1, len(elements) // 55)

    return ParseResult(
        text_content=formatted_text,
        page_count=page_count,
        scenes=scenes,
        elements=elements
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
