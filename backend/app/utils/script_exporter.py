"""
Script format exporters for Final Draft (FDX), Fountain, and Celtx formats.
"""

import xml.etree.ElementTree as ET
from xml.dom import minidom
from typing import Optional, List, Dict, Any
from datetime import datetime
import re

# Element type mappings to Final Draft types
ELEMENT_TO_FD_TYPE = {
    'scene_heading': 'Scene Heading',
    'action': 'Action',
    'character': 'Character',
    'dialogue': 'Dialogue',
    'parenthetical': 'Parenthetical',
    'transition': 'Transition',
    'shot': 'Shot',
    'general': 'General',
    'text': 'Action',  # Default unknown text to Action
}

# Fountain formatting
FOUNTAIN_SCENE_PREFIXES = ['INT.', 'EXT.', 'INT/EXT.', 'INT./EXT.', 'I/E.']


def parse_script_text(text_content: str) -> List[Dict[str, Any]]:
    """
    Parse script text content into structured elements.
    Returns a list of elements with type, content, and metadata.
    """
    elements = []
    lines = text_content.split('\n')

    i = 0
    while i < len(lines):
        line = lines[i].strip()

        # Skip empty lines
        if not line:
            i += 1
            continue

        # Detect scene heading
        if any(line.upper().startswith(prefix) for prefix in FOUNTAIN_SCENE_PREFIXES):
            elements.append({
                'type': 'scene_heading',
                'content': line,
            })
            i += 1
            continue

        # Detect transition (ends with TO: or is FADE IN/OUT)
        if (line.upper().endswith('TO:') or
            line.upper() in ['FADE IN:', 'FADE OUT.', 'CUT TO BLACK.', 'FADE TO BLACK.']):
            elements.append({
                'type': 'transition',
                'content': line,
            })
            i += 1
            continue

        # Detect character (all caps, potentially with extension)
        # Character names are typically all caps and may have (V.O.), (O.S.), (CONT'D)
        if (line.isupper() or
            (re.match(r'^[A-Z][A-Z\s\'\-\.]+(\s*\([A-Z\.\']+\))?\s*$', line) and len(line) < 50)):
            # This might be a character name - check if next line is dialogue or parenthetical
            if i + 1 < len(lines):
                next_line = lines[i + 1].strip()
                # Next line is parenthetical
                if next_line.startswith('(') and next_line.endswith(')'):
                    elements.append({
                        'type': 'character',
                        'content': line,
                    })
                    elements.append({
                        'type': 'parenthetical',
                        'content': next_line,
                    })
                    i += 2
                    # Collect dialogue that follows
                    dialogue_lines = []
                    while i < len(lines) and lines[i].strip():
                        next_stripped = lines[i].strip()
                        # Check if this is a parenthetical interruption
                        if next_stripped.startswith('(') and next_stripped.endswith(')'):
                            if dialogue_lines:
                                elements.append({
                                    'type': 'dialogue',
                                    'content': ' '.join(dialogue_lines),
                                })
                                dialogue_lines = []
                            elements.append({
                                'type': 'parenthetical',
                                'content': next_stripped,
                            })
                        elif next_stripped.isupper() and len(next_stripped) < 50:
                            # Likely a new character
                            break
                        elif any(next_stripped.upper().startswith(p) for p in FOUNTAIN_SCENE_PREFIXES):
                            # New scene
                            break
                        else:
                            dialogue_lines.append(next_stripped)
                        i += 1
                    if dialogue_lines:
                        elements.append({
                            'type': 'dialogue',
                            'content': ' '.join(dialogue_lines),
                        })
                    continue
                # Next line looks like dialogue (not all caps, not starting with scene prefix)
                elif (next_line and
                      not next_line.isupper() and
                      not any(next_line.upper().startswith(p) for p in FOUNTAIN_SCENE_PREFIXES)):
                    elements.append({
                        'type': 'character',
                        'content': line,
                    })
                    i += 1
                    # Collect dialogue
                    dialogue_lines = []
                    while i < len(lines) and lines[i].strip():
                        next_stripped = lines[i].strip()
                        if next_stripped.startswith('(') and next_stripped.endswith(')'):
                            if dialogue_lines:
                                elements.append({
                                    'type': 'dialogue',
                                    'content': ' '.join(dialogue_lines),
                                })
                                dialogue_lines = []
                            elements.append({
                                'type': 'parenthetical',
                                'content': next_stripped,
                            })
                        elif next_stripped.isupper() and len(next_stripped) < 50:
                            break
                        elif any(next_stripped.upper().startswith(p) for p in FOUNTAIN_SCENE_PREFIXES):
                            break
                        else:
                            dialogue_lines.append(next_stripped)
                        i += 1
                    if dialogue_lines:
                        elements.append({
                            'type': 'dialogue',
                            'content': ' '.join(dialogue_lines),
                        })
                    continue

        # Default to action
        elements.append({
            'type': 'action',
            'content': line,
        })
        i += 1

    return elements


def export_to_fdx(
    script_title: str,
    text_content: str,
    highlights: Optional[List[Dict[str, Any]]] = None,
    notes: Optional[List[Dict[str, Any]]] = None,
    include_highlights: bool = False,
    include_notes: bool = False
) -> str:
    """
    Export script to Final Draft XML (FDX) format.

    Args:
        script_title: Title of the script
        text_content: Raw text content of the script
        highlights: List of highlight objects with text ranges
        notes: List of note objects
        include_highlights: Whether to include highlights as ScriptNotes
        include_notes: Whether to include notes as ScriptNotes

    Returns:
        FDX XML string
    """
    # Create root FinalDraft element
    root = ET.Element('FinalDraft')
    root.set('DocumentType', 'Script')
    root.set('Version', '3')

    # Add content
    content = ET.SubElement(root, 'Content')

    # Parse script into elements
    elements = parse_script_text(text_content)

    # Track character position for highlight matching
    char_offset = 0

    for elem in elements:
        para = ET.SubElement(content, 'Paragraph')
        para.set('Type', ELEMENT_TO_FD_TYPE.get(elem['type'], 'Action'))

        text = ET.SubElement(para, 'Text')
        text.text = elem['content']

        # Add highlights as ScriptNotes if requested
        if include_highlights and highlights:
            elem_start = char_offset
            elem_end = char_offset + len(elem['content'])

            for hl in highlights:
                hl_start = hl.get('start_offset', 0)
                hl_end = hl.get('end_offset', 0)

                # Check if highlight overlaps with this element
                if hl_start < elem_end and hl_end > elem_start:
                    note = ET.SubElement(para, 'ScriptNote')
                    note.set('Color', hl.get('color', 'Yellow'))
                    note.set('Type', 'Highlight')
                    note.text = hl.get('highlighted_text', '')

        char_offset = elem_end + 1  # +1 for newline

    # Add document-level notes if requested
    if include_notes and notes:
        script_notes = ET.SubElement(root, 'ScriptNotes')
        for note in notes:
            sn = ET.SubElement(script_notes, 'ScriptNote')
            sn.set('Page', str(note.get('page_number', 1)))
            sn_text = ET.SubElement(sn, 'Paragraph')
            sn_text_content = ET.SubElement(sn_text, 'Text')
            sn_text_content.text = note.get('content', '')

    # Add title page
    title_page = ET.SubElement(root, 'TitlePage')
    title_elem = ET.SubElement(title_page, 'Content')
    title_para = ET.SubElement(title_elem, 'Paragraph')
    title_para.set('Type', 'Title')
    title_text = ET.SubElement(title_para, 'Text')
    title_text.text = script_title

    # Pretty print the XML
    xml_str = ET.tostring(root, encoding='unicode')
    dom = minidom.parseString(xml_str)
    return dom.toprettyxml(indent='  ')


def export_to_fountain(
    script_title: str,
    text_content: str,
    highlights: Optional[List[Dict[str, Any]]] = None,
    notes: Optional[List[Dict[str, Any]]] = None,
    include_highlights: bool = False,
    include_notes: bool = False
) -> str:
    """
    Export script to Fountain plain text format.

    Fountain is a plain-text screenplay format that uses simple markup.
    See: https://fountain.io/syntax

    Args:
        script_title: Title of the script
        text_content: Raw text content of the script
        highlights: List of highlight objects
        notes: List of note objects
        include_highlights: Whether to include highlights as [[notes]]
        include_notes: Whether to include notes as [[notes]]

    Returns:
        Fountain-formatted text string
    """
    output_lines = []

    # Title page
    output_lines.append(f'Title: {script_title}')
    output_lines.append(f'Date: {datetime.now().strftime("%Y-%m-%d")}')
    output_lines.append('')
    output_lines.append('===')  # Page break after title
    output_lines.append('')

    # Parse script into elements
    elements = parse_script_text(text_content)

    # Track character position for highlight/note matching
    char_offset = 0

    for elem in elements:
        elem_type = elem['type']
        content = elem['content']
        elem_start = char_offset
        elem_end = char_offset + len(content)

        # Add any highlights as inline notes
        highlight_notes = []
        if include_highlights and highlights:
            for hl in highlights:
                hl_start = hl.get('start_offset', 0)
                hl_end = hl.get('end_offset', 0)
                if hl_start < elem_end and hl_end > elem_start:
                    hl_text = hl.get('highlighted_text', '')
                    hl_color = hl.get('color', 'yellow')
                    highlight_notes.append(f'[[{hl_color.upper()}: {hl_text}]]')

        # Format based on element type
        if elem_type == 'scene_heading':
            output_lines.append('')
            # Scene headings are automatically detected in Fountain
            # but we can force with '.' prefix if needed
            if not any(content.upper().startswith(p) for p in FOUNTAIN_SCENE_PREFIXES):
                output_lines.append(f'.{content}')
            else:
                output_lines.append(content.upper())
            if highlight_notes:
                output_lines.extend(highlight_notes)

        elif elem_type == 'action':
            output_lines.append('')
            output_lines.append(content)
            if highlight_notes:
                output_lines.extend(highlight_notes)

        elif elem_type == 'character':
            output_lines.append('')
            # Character names should be uppercase in Fountain
            output_lines.append(content.upper())

        elif elem_type == 'dialogue':
            # Dialogue follows character name, indented in rendered output
            output_lines.append(content)
            if highlight_notes:
                output_lines.extend(highlight_notes)

        elif elem_type == 'parenthetical':
            # Parentheticals are wrapped in parentheses
            if not content.startswith('('):
                content = f'({content})'
            if not content.endswith(')'):
                content = f'{content})'
            output_lines.append(content)

        elif elem_type == 'transition':
            output_lines.append('')
            # Transitions are right-aligned, forced with '>'
            if content.upper().endswith('TO:'):
                output_lines.append(f'> {content.upper()}')
            else:
                output_lines.append(content.upper())

        char_offset = elem_end + 1

    # Add document notes at the end if requested
    if include_notes and notes:
        output_lines.append('')
        output_lines.append('===')  # Page break
        output_lines.append('')
        output_lines.append('/* SCRIPT NOTES')
        for note in notes:
            page = note.get('page_number', '?')
            content = note.get('content', '')
            output_lines.append(f'Page {page}: {content}')
        output_lines.append('*/')

    return '\n'.join(output_lines)


def export_to_celtx(
    script_title: str,
    text_content: str,
    highlights: Optional[List[Dict[str, Any]]] = None,
    notes: Optional[List[Dict[str, Any]]] = None,
    include_highlights: bool = False,
    include_notes: bool = False
) -> str:
    """
    Export script to Celtx XML format.

    Celtx uses an XML-based format similar to FDX but with different structure.
    This generates a simplified Celtx-compatible format.

    Args:
        script_title: Title of the script
        text_content: Raw text content of the script
        highlights: List of highlight objects
        notes: List of note objects
        include_highlights: Whether to include highlights
        include_notes: Whether to include notes

    Returns:
        Celtx XML string
    """
    # Celtx element type mappings
    ELEMENT_TO_CELTX = {
        'scene_heading': 'sceneheading',
        'action': 'action',
        'character': 'character',
        'dialogue': 'dialog',
        'parenthetical': 'parenthetical',
        'transition': 'transition',
        'shot': 'shot',
        'general': 'action',
    }

    # Create root element
    root = ET.Element('celtx')
    root.set('version', '2.0')

    # Project info
    project = ET.SubElement(root, 'project')
    project.set('title', script_title)
    project.set('created', datetime.now().isoformat())

    # Script content
    script = ET.SubElement(root, 'script')
    script.set('type', 'screenplay')

    # Parse script into elements
    elements = parse_script_text(text_content)

    # Track character position for highlight matching
    char_offset = 0
    current_scene = None

    for elem in elements:
        elem_type = elem['type']
        content = elem['content']

        # Create scene container for scene headings
        if elem_type == 'scene_heading':
            current_scene = ET.SubElement(script, 'scene')
            heading = ET.SubElement(current_scene, 'sceneheading')
            heading.text = content
        else:
            # Add elements to current scene or script root
            parent = current_scene if current_scene is not None else script
            element = ET.SubElement(parent, ELEMENT_TO_CELTX.get(elem_type, 'action'))
            element.text = content

            # Add highlight annotations if requested
            if include_highlights and highlights:
                elem_start = char_offset
                elem_end = char_offset + len(content)

                for hl in highlights:
                    hl_start = hl.get('start_offset', 0)
                    hl_end = hl.get('end_offset', 0)

                    if hl_start < elem_end and hl_end > elem_start:
                        annotation = ET.SubElement(element, 'annotation')
                        annotation.set('type', 'highlight')
                        annotation.set('color', hl.get('color', 'yellow'))
                        annotation.text = hl.get('highlighted_text', '')

        char_offset += len(content) + 1

    # Add notes if requested
    if include_notes and notes:
        notes_elem = ET.SubElement(root, 'notes')
        for note in notes:
            note_elem = ET.SubElement(notes_elem, 'note')
            note_elem.set('page', str(note.get('page_number', 1)))
            note_elem.text = note.get('content', '')

    # Pretty print the XML
    xml_str = ET.tostring(root, encoding='unicode')
    dom = minidom.parseString(xml_str)
    return dom.toprettyxml(indent='  ')


# Export function mapping
EXPORTERS = {
    'fdx': export_to_fdx,
    'fountain': export_to_fountain,
    'celtx': export_to_celtx,
}


def export_script(
    format: str,
    script_title: str,
    text_content: str,
    highlights: Optional[List[Dict[str, Any]]] = None,
    notes: Optional[List[Dict[str, Any]]] = None,
    include_highlights: bool = False,
    include_notes: bool = False
) -> str:
    """
    Export script to the specified format.

    Args:
        format: Export format ('fdx', 'fountain', 'celtx')
        script_title: Title of the script
        text_content: Raw text content of the script
        highlights: List of highlight objects
        notes: List of note objects
        include_highlights: Whether to include highlights
        include_notes: Whether to include notes

    Returns:
        Exported content as string

    Raises:
        ValueError: If format is not supported
    """
    exporter = EXPORTERS.get(format.lower())
    if not exporter:
        raise ValueError(f"Unsupported export format: {format}. Supported: {list(EXPORTERS.keys())}")

    return exporter(
        script_title=script_title,
        text_content=text_content,
        highlights=highlights,
        notes=notes,
        include_highlights=include_highlights,
        include_notes=include_notes,
    )


def get_content_type(format: str) -> str:
    """Get the MIME content type for the export format."""
    content_types = {
        'fdx': 'application/xml',
        'fountain': 'text/plain',
        'celtx': 'application/xml',
    }
    return content_types.get(format.lower(), 'application/octet-stream')


def get_file_extension(format: str) -> str:
    """Get the file extension for the export format."""
    extensions = {
        'fdx': '.fdx',
        'fountain': '.fountain',
        'celtx': '.celtx',
    }
    return extensions.get(format.lower(), '.txt')
