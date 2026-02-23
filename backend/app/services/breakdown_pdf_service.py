"""
PDF Generation Service for Script Breakdown Sheets
Uses fpdf2 (pure Python) for reliable PDF generation on Lambda
"""
from typing import List, Dict, Any, Optional
from datetime import datetime
from fpdf import FPDF


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

TYPES_IN_ORDER = [
    "cast", "background", "stunt", "wardrobe", "makeup",
    "prop", "set_dressing", "vehicle", "animal", "greenery",
    "sfx", "vfx", "special_equipment", "sound", "music", "location", "other"
]


def _hex_to_rgb(hex_color: str) -> tuple:
    """Convert hex color string to RGB tuple."""
    hex_color = hex_color.lstrip("#")
    return tuple(int(hex_color[i:i+2], 16) for i in (0, 2, 4))


def _text_color_for_bg(hex_color: str) -> tuple:
    """Return black or white text depending on background brightness."""
    r, g, b = _hex_to_rgb(hex_color)
    luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255
    return (0, 0, 0) if luminance > 0.5 else (255, 255, 255)


def format_page_length(page_length: float) -> str:
    """Convert decimal page length to industry standard fraction format."""
    if not page_length:
        return ""
    whole = int(page_length)
    fraction = page_length - whole
    fractions_map = {
        0.125: "1/8", 0.25: "2/8", 0.375: "3/8", 0.5: "4/8",
        0.625: "5/8", 0.75: "6/8", 0.875: "7/8",
    }
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


def _render_scene_page(
    pdf: FPDF,
    project_title: str,
    scene: Dict[str, Any],
    breakdown_items: List[Dict[str, Any]],
    include_notes: bool = True,
):
    """Render a single scene breakdown page onto the FPDF instance."""
    page_w = pdf.w - pdf.l_margin - pdf.r_margin

    scene_number = str(scene.get("scene_number", ""))
    slugline = scene.get("slugline", "") or ""
    int_ext = scene.get("int_ext", "") or "-"
    day_night = scene.get("day_night", scene.get("time_of_day", "")) or "-"
    page_length = scene.get("page_length", 0)
    page_length_str = format_page_length(page_length) if page_length else "-"
    description = scene.get("description", "") or ""

    # --- Header box ---
    pdf.set_draw_color(51, 51, 51)
    pdf.set_line_width(0.5)

    # Header top row: project title + scene number
    header_y = pdf.get_y()
    pdf.set_fill_color(245, 245, 245)
    pdf.rect(pdf.l_margin, header_y, page_w, 10, "DF")

    pdf.set_xy(pdf.l_margin + 2, header_y + 1)
    pdf.set_font("Helvetica", "B", 11)
    pdf.set_text_color(26, 26, 26)
    pdf.cell(page_w - 30, 8, project_title, new_x="LMARGIN")

    # Scene number box (right side)
    sn_w = max(pdf.get_string_width(scene_number) + 10, 18)
    pdf.set_xy(pdf.l_margin + page_w - sn_w - 2, header_y + 1)
    pdf.set_fill_color(255, 255, 255)
    pdf.set_line_width(0.4)
    pdf.cell(sn_w, 8, scene_number, border=1, align="C", fill=True)

    # Separator line
    pdf.set_line_width(0.2)
    sep_y = header_y + 10
    pdf.line(pdf.l_margin, sep_y, pdf.l_margin + page_w, sep_y)

    # Details row: slugline | INT/EXT | D/N | Pages
    detail_h = 10
    pdf.set_fill_color(255, 255, 255)
    pdf.rect(pdf.l_margin, sep_y, page_w, detail_h, "DF")

    detail_box_w = 22
    slug_w = page_w - (detail_box_w * 3) - 6

    pdf.set_xy(pdf.l_margin + 2, sep_y + 1)
    pdf.set_font("Helvetica", "B", 9)
    pdf.cell(slug_w, 8, slugline[:80])

    # Detail boxes
    boxes = [("INT/EXT", int_ext), ("D/N", day_night), ("PAGES", page_length_str)]
    bx = pdf.l_margin + slug_w + 4
    for label, value in boxes:
        pdf.set_fill_color(250, 250, 250)
        pdf.rect(bx, sep_y + 1, detail_box_w, 8, "DF")
        pdf.set_xy(bx, sep_y + 1)
        pdf.set_font("Helvetica", "", 5)
        pdf.set_text_color(102, 102, 102)
        pdf.cell(detail_box_w, 3, label, align="C")
        pdf.set_xy(bx, sep_y + 4)
        pdf.set_font("Helvetica", "B", 7)
        pdf.set_text_color(26, 26, 26)
        pdf.cell(detail_box_w, 4, str(value), align="C")
        bx += detail_box_w + 1

    cur_y = sep_y + detail_h

    # Description (if any)
    if description:
        pdf.set_fill_color(255, 254, 240)
        pdf.set_xy(pdf.l_margin, cur_y)
        pdf.set_font("Helvetica", "I", 8)
        pdf.set_text_color(26, 26, 26)
        pdf.set_line_width(0.2)
        pdf.line(pdf.l_margin, cur_y, pdf.l_margin + page_w, cur_y)
        pdf.rect(pdf.l_margin, cur_y, page_w, 8, "DF")
        pdf.set_xy(pdf.l_margin + 2, cur_y + 1)
        pdf.cell(page_w - 4, 6, description[:120])
        cur_y += 8

    # Outer border for header
    pdf.set_line_width(0.5)
    pdf.rect(pdf.l_margin, header_y, page_w, cur_y - header_y)

    pdf.set_y(cur_y + 4)

    # --- Breakdown items by type (2-column layout) ---
    items_by_type = {}
    for item in breakdown_items:
        t = item.get("type", "other")
        if t not in items_by_type:
            items_by_type[t] = []
        items_by_type[t].append(item)

    active_types = [t for t in TYPES_IN_ORDER if t in items_by_type]

    col_w = (page_w - 4) / 2
    col_x = [pdf.l_margin, pdf.l_margin + col_w + 4]
    col_y = [pdf.get_y(), pdf.get_y()]

    for i, item_type in enumerate(active_types):
        items = items_by_type[item_type]
        color_hex = BREAKDOWN_TYPE_COLORS.get(item_type, "#999999")
        label = BREAKDOWN_TYPE_LABELS.get(item_type, item_type.upper())
        bg_rgb = _hex_to_rgb(color_hex)
        txt_rgb = _text_color_for_bg(color_hex)

        # Pick shortest column
        col = 0 if col_y[0] <= col_y[1] else 1

        # Calculate block height
        header_h = 6
        item_h = 4.5
        block_h = header_h + (len(items) * item_h) + 2

        # Page break if needed
        if col_y[col] + block_h > pdf.h - pdf.b_margin - 10:
            pdf.add_page()
            col_y = [pdf.get_y(), pdf.get_y()]
            col = 0

        x = col_x[col]
        y = col_y[col]

        # Type header
        pdf.set_fill_color(*bg_rgb)
        pdf.set_draw_color(204, 204, 204)
        pdf.set_line_width(0.2)
        pdf.rect(x, y, col_w, header_h, "DF")
        pdf.set_xy(x + 2, y + 1)
        pdf.set_font("Helvetica", "B", 7)
        pdf.set_text_color(*txt_rgb)
        pdf.cell(col_w - 4, 4, label)

        # Items
        iy = y + header_h
        pdf.set_fill_color(255, 255, 255)
        items_block_h = len(items) * item_h + 2
        pdf.rect(x, iy, col_w, items_block_h, "DF")

        pdf.set_font("Helvetica", "", 7)
        pdf.set_text_color(26, 26, 26)
        for item in items:
            qty = item.get("quantity", 1)
            qty_str = f" ({qty})" if qty and qty > 1 else ""
            notes_str = f" - {item.get('notes')}" if include_notes and item.get("notes") else ""
            text = f"{item.get('label', '')}{qty_str}{notes_str}"
            pdf.set_xy(x + 2, iy + 1)
            pdf.cell(col_w - 4, 3.5, text[:80])
            iy += item_h

        col_y[col] = iy + items_block_h - (len(items) * item_h) + 2


def generate_breakdown_pdf(
    project_title: str,
    scene: Dict[str, Any],
    breakdown_items: List[Dict[str, Any]],
    script_title: Optional[str] = None,
    include_notes: bool = True,
) -> bytes:
    """Generate a single scene breakdown PDF using fpdf2."""
    pdf = FPDF(orientation="P", unit="mm", format="Letter")
    pdf.set_auto_page_break(auto=True, margin=15)
    pdf.add_page()

    _render_scene_page(pdf, project_title, scene, breakdown_items, include_notes)

    # Footer
    pdf.set_y(-20)
    pdf.set_font("Helvetica", "", 6)
    pdf.set_text_color(102, 102, 102)
    pdf.set_draw_color(204, 204, 204)
    pdf.set_line_width(0.2)
    page_w = pdf.w - pdf.l_margin - pdf.r_margin
    pdf.line(pdf.l_margin, pdf.get_y(), pdf.l_margin + page_w, pdf.get_y())
    pdf.ln(2)
    pdf.cell(page_w / 2, 4, f"Script: {script_title or project_title}")
    pdf.cell(page_w / 2, 4, f"Generated: {datetime.now().strftime('%B %d, %Y')}", align="R")

    return pdf.output()


def generate_project_breakdown_pdf(
    project_title: str,
    scenes_with_breakdown: List[Dict[str, Any]],
    summary_stats: Dict[str, Any],
    script_title: Optional[str] = None,
    filter_info: Optional[str] = None,
    include_notes: bool = True,
) -> bytes:
    """Generate a multi-page project breakdown PDF using fpdf2."""
    pdf = FPDF(orientation="P", unit="mm", format="Letter")
    pdf.set_auto_page_break(auto=True, margin=15)

    generated_date = datetime.now().strftime("%B %d, %Y")
    total_items = summary_stats.get("total_items", 0)
    by_type = summary_stats.get("by_type", {})
    scenes_count = summary_stats.get("total_scenes", 0)
    scenes_with_items = summary_stats.get("scenes_with_breakdown", 0)

    # --- Cover Page ---
    pdf.add_page()
    page_w = pdf.w - pdf.l_margin - pdf.r_margin

    pdf.ln(40)
    pdf.set_font("Helvetica", "B", 24)
    pdf.set_text_color(26, 26, 26)
    pdf.cell(page_w, 12, project_title, align="C", new_x="LMARGIN", new_y="NEXT")
    pdf.ln(2)
    pdf.set_font("Helvetica", "", 16)
    pdf.set_text_color(102, 102, 102)
    pdf.cell(page_w, 10, "Script Breakdown", align="C", new_x="LMARGIN", new_y="NEXT")
    pdf.ln(6)
    pdf.set_font("Helvetica", "", 10)
    pdf.cell(page_w, 6, f"Generated: {generated_date}", align="C", new_x="LMARGIN", new_y="NEXT")
    if filter_info:
        pdf.cell(page_w, 6, filter_info, align="C", new_x="LMARGIN", new_y="NEXT")
    pdf.cell(page_w, 6, f"{scenes_with_items} of {scenes_count} scenes with breakdown items", align="C", new_x="LMARGIN", new_y="NEXT")
    pdf.cell(page_w, 6, f"{total_items} total elements", align="C", new_x="LMARGIN", new_y="NEXT")

    # Stats table
    pdf.ln(10)
    table_w = 100
    table_x = pdf.l_margin + (page_w - table_w) / 2
    pdf.set_x(table_x)
    pdf.set_font("Helvetica", "B", 11)
    pdf.set_text_color(26, 26, 26)
    pdf.cell(table_w, 8, "Elements by Type", new_x="LMARGIN", new_y="NEXT")
    pdf.set_x(table_x)
    pdf.set_draw_color(51, 51, 51)
    pdf.set_line_width(0.4)
    pdf.line(table_x, pdf.get_y(), table_x + table_w, pdf.get_y())
    pdf.ln(3)

    for item_type, count in sorted(by_type.items(), key=lambda x: -x[1]):
        color_hex = BREAKDOWN_TYPE_COLORS.get(item_type, "#999999")
        label = BREAKDOWN_TYPE_LABELS.get(item_type, item_type.upper())
        bg_rgb = _hex_to_rgb(color_hex)

        y = pdf.get_y()
        pdf.set_fill_color(*bg_rgb)
        pdf.rect(table_x, y + 1, 4, 4, "F")
        pdf.set_xy(table_x + 7, y)
        pdf.set_font("Helvetica", "", 9)
        pdf.set_text_color(26, 26, 26)
        pdf.cell(table_w - 25, 6, label)
        pdf.set_font("Helvetica", "B", 9)
        pdf.cell(18, 6, str(count), align="R", new_x="LMARGIN", new_y="NEXT")

        pdf.set_x(table_x)
        pdf.set_draw_color(238, 238, 238)
        pdf.set_line_width(0.1)
        pdf.line(table_x, pdf.get_y(), table_x + table_w, pdf.get_y())

    # --- Scene pages ---
    for scene_data in scenes_with_breakdown:
        scene = scene_data.get("scene", {})
        items = scene_data.get("items", [])
        if not items:
            continue
        pdf.add_page()
        _render_scene_page(pdf, project_title, scene, items, include_notes)

    return pdf.output()
