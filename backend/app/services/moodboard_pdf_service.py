"""
Moodboard PDF Generation Service
Uses WeasyPrint to convert HTML templates to professional PDFs
"""
import io
import base64
from typing import List, Dict, Any, Optional
from datetime import datetime
import httpx


def _fetch_image_as_base64(url: str) -> Optional[str]:
    """Fetch an image URL and convert to base64 for embedding in PDF."""
    try:
        with httpx.Client(timeout=10.0) as client:
            response = client.get(url)
            if response.status_code == 200:
                content_type = response.headers.get("content-type", "image/jpeg")
                b64 = base64.b64encode(response.content).decode("utf-8")
                return f"data:{content_type};base64,{b64}"
    except Exception:
        pass
    return None


def generate_moodboard_pdf_html(
    project_title: str,
    moodboard_title: str,
    moodboard_description: Optional[str],
    sections: List[Dict[str, Any]],
    unsorted_items: List[Dict[str, Any]],
    generated_at: str,
    embed_images: bool = True,
) -> str:
    """
    Generate HTML for moodboard PDF export.

    Args:
        project_title: Name of the project
        moodboard_title: Name of the moodboard
        moodboard_description: Optional description
        sections: List of sections with their items
        unsorted_items: Items not assigned to any section
        generated_at: Timestamp string
        embed_images: If True, fetch and embed images as base64 (slower but works offline)
    """

    def render_item(item: Dict[str, Any]) -> str:
        """Render a single moodboard item."""
        image_url = item.get("image_url", "")
        if embed_images and image_url:
            embedded = _fetch_image_as_base64(image_url)
            if embedded:
                image_url = embedded

        title_html = ""
        if item.get("title"):
            title_html = f'<p class="item-title">{item["title"]}</p>'

        category_html = ""
        if item.get("category"):
            title_html = f'<span class="item-category">{item["category"]}</span>'

        tags_html = ""
        tags = item.get("tags") or []
        if isinstance(tags, str):
            import json
            try:
                tags = json.loads(tags)
            except:
                tags = []
        if tags:
            tags_html = f'<p class="item-tags">{", ".join(tags)}</p>'

        notes_html = ""
        if item.get("notes"):
            notes_html = f'<p class="item-notes">{item["notes"]}</p>'

        rating_html = ""
        if item.get("rating"):
            stars = "★" * item["rating"] + "☆" * (5 - item["rating"])
            rating_html = f'<p class="item-rating">{stars}</p>'

        color_palette_html = ""
        palette = item.get("color_palette") or []
        if isinstance(palette, str):
            import json
            try:
                palette = json.loads(palette)
            except:
                palette = []
        if palette:
            swatches = "".join([f'<span class="color-swatch" style="background-color: {c};"></span>' for c in palette[:5]])
            color_palette_html = f'<div class="color-palette">{swatches}</div>'

        return f'''
        <div class="item">
            <div class="item-image-container">
                <img src="{image_url}" alt="{item.get('title', 'Reference')}" class="item-image" />
            </div>
            <div class="item-info">
                {category_html}
                {title_html}
                {tags_html}
                {notes_html}
                {rating_html}
                {color_palette_html}
            </div>
        </div>
        '''

    def render_section(section: Dict[str, Any], items: List[Dict[str, Any]]) -> str:
        """Render a section with its items."""
        if not items:
            return f'''
            <div class="section">
                <h2 class="section-title">{section.get("title", "Untitled")}</h2>
                <p class="empty-section">No items in this section</p>
            </div>
            '''

        items_html = "".join([render_item(item) for item in items])
        return f'''
        <div class="section">
            <h2 class="section-title">{section.get("title", "Untitled")}</h2>
            <div class="items-grid">
                {items_html}
            </div>
        </div>
        '''

    # Render unsorted items
    unsorted_html = ""
    if unsorted_items:
        unsorted_items_html = "".join([render_item(item) for item in unsorted_items])
        unsorted_html = f'''
        <div class="section">
            <h2 class="section-title">Unsorted</h2>
            <div class="items-grid">
                {unsorted_items_html}
            </div>
        </div>
        '''

    # Render sections
    sections_html = ""
    for section in sections:
        items = section.get("items", [])
        sections_html += render_section(section, items)

    description_html = ""
    if moodboard_description:
        description_html = f'<p class="description">{moodboard_description}</p>'

    html = f'''
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <title>{moodboard_title} - Moodboard</title>
        <style>
            @page {{
                size: letter landscape;
                margin: 0.5in;
            }}

            * {{
                box-sizing: border-box;
            }}

            body {{
                font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
                font-size: 10pt;
                line-height: 1.4;
                color: #1a1a1a;
                margin: 0;
                padding: 0;
            }}

            .header {{
                border-bottom: 2px solid #333;
                padding-bottom: 12px;
                margin-bottom: 20px;
            }}

            .header h1 {{
                font-size: 24pt;
                font-weight: bold;
                margin: 0 0 8px 0;
                color: #1a1a1a;
            }}

            .header-meta {{
                font-size: 10pt;
                color: #666;
            }}

            .description {{
                margin-top: 8px;
                color: #444;
                font-style: italic;
            }}

            .section {{
                margin-bottom: 24px;
                page-break-inside: avoid;
            }}

            .section-title {{
                font-size: 14pt;
                font-weight: 600;
                color: #333;
                border-bottom: 1px solid #ddd;
                padding-bottom: 6px;
                margin: 0 0 12px 0;
            }}

            .items-grid {{
                display: flex;
                flex-wrap: wrap;
                gap: 12px;
            }}

            .item {{
                width: calc(25% - 9px);
                border: 1px solid #ddd;
                border-radius: 4px;
                overflow: hidden;
                background: #fafafa;
                page-break-inside: avoid;
            }}

            .item-image-container {{
                width: 100%;
                aspect-ratio: 16/9;
                overflow: hidden;
                background: #eee;
            }}

            .item-image {{
                width: 100%;
                height: 100%;
                object-fit: cover;
            }}

            .item-info {{
                padding: 8px;
            }}

            .item-title {{
                font-weight: 600;
                font-size: 9pt;
                margin: 0 0 4px 0;
                color: #1a1a1a;
            }}

            .item-category {{
                display: inline-block;
                background: #333;
                color: white;
                font-size: 7pt;
                padding: 2px 6px;
                border-radius: 3px;
                margin-bottom: 4px;
            }}

            .item-tags {{
                font-size: 8pt;
                color: #666;
                margin: 0 0 4px 0;
            }}

            .item-notes {{
                font-size: 8pt;
                color: #555;
                margin: 0 0 4px 0;
            }}

            .item-rating {{
                font-size: 10pt;
                color: #f59e0b;
                margin: 0;
            }}

            .color-palette {{
                display: flex;
                gap: 3px;
                margin-top: 4px;
            }}

            .color-swatch {{
                width: 16px;
                height: 16px;
                border-radius: 2px;
                border: 1px solid #ccc;
            }}

            .empty-section {{
                color: #999;
                font-style: italic;
            }}

            .footer {{
                margin-top: 24px;
                padding-top: 12px;
                border-top: 1px solid #ddd;
                font-size: 8pt;
                color: #999;
                text-align: center;
            }}
        </style>
    </head>
    <body>
        <div class="header">
            <h1>{moodboard_title}</h1>
            <div class="header-meta">
                <span>{project_title}</span> | <span>Generated {generated_at}</span>
            </div>
            {description_html}
        </div>

        {unsorted_html}
        {sections_html}

        <div class="footer">
            Second Watch Network - Moodboard Export
        </div>
    </body>
    </html>
    '''

    return html


def generate_section_pdf_html(
    project_title: str,
    moodboard_title: str,
    section_title: str,
    items: List[Dict[str, Any]],
    generated_at: str,
    embed_images: bool = True,
) -> str:
    """
    Generate HTML for a single section PDF export.
    """
    # Reuse the moodboard HTML generator with just one section
    section = {"title": section_title, "items": items}
    return generate_moodboard_pdf_html(
        project_title=project_title,
        moodboard_title=f"{moodboard_title} - {section_title}",
        moodboard_description=None,
        sections=[section],
        unsorted_items=[],
        generated_at=generated_at,
        embed_images=embed_images,
    )


def generate_moodboard_pdf(
    project_title: str,
    moodboard_title: str,
    moodboard_description: Optional[str],
    sections: List[Dict[str, Any]],
    unsorted_items: List[Dict[str, Any]],
    embed_images: bool = True,
) -> bytes:
    """
    Generate a PDF for the moodboard.

    Returns:
        PDF bytes
    """
    try:
        from weasyprint import HTML
    except ImportError:
        raise ImportError("WeasyPrint is required for PDF generation. Install with: pip install weasyprint")

    generated_at = datetime.now().strftime("%B %d, %Y")

    html_content = generate_moodboard_pdf_html(
        project_title=project_title,
        moodboard_title=moodboard_title,
        moodboard_description=moodboard_description,
        sections=sections,
        unsorted_items=unsorted_items,
        generated_at=generated_at,
        embed_images=embed_images,
    )

    pdf_buffer = io.BytesIO()
    HTML(string=html_content).write_pdf(pdf_buffer)
    pdf_buffer.seek(0)

    return pdf_buffer.read()


def generate_section_pdf(
    project_title: str,
    moodboard_title: str,
    section_title: str,
    items: List[Dict[str, Any]],
    embed_images: bool = True,
) -> bytes:
    """
    Generate a PDF for a single moodboard section.

    Returns:
        PDF bytes
    """
    try:
        from weasyprint import HTML
    except ImportError:
        raise ImportError("WeasyPrint is required for PDF generation. Install with: pip install weasyprint")

    generated_at = datetime.now().strftime("%B %d, %Y")

    html_content = generate_section_pdf_html(
        project_title=project_title,
        moodboard_title=moodboard_title,
        section_title=section_title,
        items=items,
        generated_at=generated_at,
        embed_images=embed_images,
    )

    pdf_buffer = io.BytesIO()
    HTML(string=html_content).write_pdf(pdf_buffer)
    pdf_buffer.seek(0)

    return pdf_buffer.read()
