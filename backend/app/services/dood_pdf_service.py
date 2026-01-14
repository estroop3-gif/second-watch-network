"""
Day Out of Days PDF Generation Service
Uses WeasyPrint to convert HTML to professional PDF reports
"""
import io
from typing import List, Dict, Any, Optional
from datetime import datetime, date


# DOOD code colors for PDF
DOOD_CODE_COLORS = {
    'W': '#22c55e',  # green - Work
    'H': '#eab308',  # yellow - Hold
    'T': '#3b82f6',  # blue - Travel
    'R': '#a855f7',  # purple - Rehearsal
    'F': '#ec4899',  # pink - Fitting
    'S': '#f97316',  # orange - Tech Scout
    'P': '#14b8a6',  # teal - Pickup
    'O': '#9ca3af',  # gray - Off
    'D': '#ef4444',  # red - Drop
}

DOOD_CODE_LABELS = {
    'W': 'Work',
    'H': 'Hold',
    'T': 'Travel',
    'R': 'Rehearsal',
    'F': 'Fitting',
    'S': 'Tech Scout',
    'P': 'Pickup',
    'O': 'Off',
    'D': 'Drop',
}


def generate_dood_pdf_html(
    project_title: str,
    days: List[Dict[str, Any]],
    subjects: List[Dict[str, Any]],
    assignments: List[Dict[str, Any]],
    date_range_start: str,
    date_range_end: str,
    logo_base64: Optional[str] = None,
) -> str:
    """
    Generate Day Out of Days HTML for PDF conversion.
    Creates a professional grid-based report.
    """

    # Build assignment lookup map
    assignment_map = {}
    for a in assignments:
        key = f"{a['subject_id']}:{a['day_id']}"
        assignment_map[key] = a

    # Calculate totals per subject
    def get_subject_totals(subject_id: str):
        subj_assignments = [a for a in assignments if a['subject_id'] == subject_id]
        return {
            'work': len([a for a in subj_assignments if a.get('code') == 'W']),
            'hold': len([a for a in subj_assignments if a.get('code') == 'H']),
            'total': len(subj_assignments),
        }

    # Format date for display
    def format_date(date_str: str) -> str:
        try:
            d = datetime.strptime(date_str, "%Y-%m-%d")
            return d.strftime("%b %d")
        except:
            return date_str

    def get_day_of_week(date_str: str) -> str:
        try:
            d = datetime.strptime(date_str, "%Y-%m-%d")
            return d.strftime("%a")
        except:
            return ""

    # Logo HTML
    logo_html = ""
    if logo_base64:
        logo_html = f'<img src="data:image/png;base64,{logo_base64}" alt="Logo" style="max-height: 50px; max-width: 150px;">'

    # Generate day headers
    day_headers = ""
    for day in days:
        day_num = f"D{day.get('day_number', '')}" if day.get('day_number') else ""
        day_headers += f"""
            <th class="day-header">
                <div class="day-weekday">{get_day_of_week(day.get('date', ''))}</div>
                <div class="day-date">{format_date(day.get('date', ''))}</div>
                <div class="day-number">{day_num}</div>
            </th>
        """

    # Generate subject rows
    subject_rows = ""
    for subject in subjects:
        totals = get_subject_totals(subject['id'])

        # Type badge color
        type_colors = {
            'CAST': '#3b82f6',
            'BACKGROUND': '#a855f7',
            'CREW': '#22c55e',
            'OTHER': '#6b7280',
        }
        type_color = type_colors.get(subject.get('subject_type', 'OTHER'), '#6b7280')
        type_letter = subject.get('subject_type', 'O')[0]

        # Day cells
        day_cells = ""
        for day in days:
            key = f"{subject['id']}:{day['id']}"
            assignment = assignment_map.get(key)
            code = assignment.get('code', '') if assignment else ''

            if code:
                color = DOOD_CODE_COLORS.get(code, '#6b7280')
                day_cells += f'<td class="day-cell" style="background-color: {color}; color: white; font-weight: bold;">{code}</td>'
            else:
                day_cells += '<td class="day-cell"></td>'

        dept_text = f'<div class="subject-dept">{subject.get("department", "")}</div>' if subject.get("department") else ""

        subject_rows += f"""
            <tr>
                <td class="subject-name">
                    <div class="subject-display-name">{subject.get('display_name', '')}</div>
                    {dept_text}
                </td>
                <td class="type-cell">
                    <span class="type-badge" style="background-color: {type_color};">{type_letter}</span>
                </td>
                <td class="total-cell work-total">{totals['work'] or '-'}</td>
                <td class="total-cell hold-total">{totals['hold'] or '-'}</td>
                <td class="total-cell">{totals['total'] or '-'}</td>
                {day_cells}
            </tr>
        """

    # Generate legend
    legend_items = ""
    for code, label in DOOD_CODE_LABELS.items():
        color = DOOD_CODE_COLORS[code]
        legend_items += f"""
            <div class="legend-item">
                <span class="legend-code" style="background-color: {color};">{code}</span>
                <span class="legend-label">{label}</span>
            </div>
        """

    # Generate date range display
    try:
        start_formatted = datetime.strptime(date_range_start, "%Y-%m-%d").strftime("%B %d, %Y")
        end_formatted = datetime.strptime(date_range_end, "%Y-%m-%d").strftime("%B %d, %Y")
    except:
        start_formatted = date_range_start
        end_formatted = date_range_end

    html = f"""
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="UTF-8">
        <style>
            @page {{
                size: landscape;
                margin: 0.5in;
            }}

            * {{
                box-sizing: border-box;
            }}

            body {{
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                font-size: 9pt;
                color: #1f2937;
                margin: 0;
                padding: 0;
            }}

            .header {{
                display: flex;
                justify-content: space-between;
                align-items: center;
                margin-bottom: 15px;
                padding-bottom: 10px;
                border-bottom: 2px solid #1f2937;
            }}

            .header-left {{
                flex: 1;
            }}

            .header-right {{
                text-align: right;
            }}

            .project-title {{
                font-size: 16pt;
                font-weight: bold;
                margin: 0;
            }}

            .report-title {{
                font-size: 12pt;
                color: #6b7280;
                margin: 2px 0 0 0;
            }}

            .date-range {{
                font-size: 10pt;
                color: #6b7280;
            }}

            .generated-date {{
                font-size: 8pt;
                color: #9ca3af;
            }}

            table {{
                width: 100%;
                border-collapse: collapse;
                margin-bottom: 15px;
            }}

            th, td {{
                border: 1px solid #d1d5db;
                padding: 4px 6px;
                text-align: center;
                vertical-align: middle;
            }}

            th {{
                background-color: #f3f4f6;
                font-weight: 600;
            }}

            .subject-name {{
                text-align: left;
                min-width: 120px;
                white-space: nowrap;
            }}

            .subject-display-name {{
                font-weight: 500;
            }}

            .subject-dept {{
                font-size: 8pt;
                color: #6b7280;
            }}

            .type-cell {{
                width: 30px;
            }}

            .type-badge {{
                display: inline-block;
                width: 18px;
                height: 18px;
                line-height: 18px;
                border-radius: 3px;
                color: white;
                font-size: 8pt;
                font-weight: bold;
            }}

            .total-cell {{
                width: 35px;
                font-size: 9pt;
            }}

            .work-total {{
                color: #16a34a;
            }}

            .hold-total {{
                color: #ca8a04;
            }}

            .day-header {{
                min-width: 45px;
                padding: 3px;
            }}

            .day-weekday {{
                font-size: 7pt;
                color: #6b7280;
            }}

            .day-date {{
                font-size: 8pt;
                font-weight: 600;
            }}

            .day-number {{
                font-size: 7pt;
                color: #6b7280;
            }}

            .day-cell {{
                width: 30px;
                height: 24px;
                font-size: 10pt;
            }}

            .legend {{
                margin-top: 15px;
                padding-top: 10px;
                border-top: 1px solid #d1d5db;
            }}

            .legend-title {{
                font-size: 9pt;
                font-weight: 600;
                color: #6b7280;
                margin-bottom: 8px;
            }}

            .legend-items {{
                display: flex;
                flex-wrap: wrap;
                gap: 15px;
            }}

            .legend-item {{
                display: flex;
                align-items: center;
                gap: 5px;
            }}

            .legend-code {{
                display: inline-block;
                width: 18px;
                height: 18px;
                line-height: 18px;
                text-align: center;
                border-radius: 3px;
                color: white;
                font-size: 9pt;
                font-weight: bold;
            }}

            .legend-label {{
                font-size: 8pt;
                color: #6b7280;
            }}

            .footer {{
                margin-top: 20px;
                padding-top: 10px;
                border-top: 1px solid #d1d5db;
                font-size: 8pt;
                color: #9ca3af;
                text-align: center;
            }}
        </style>
    </head>
    <body>
        <div class="header">
            <div class="header-left">
                {logo_html}
                <h1 class="project-title">{project_title}</h1>
                <p class="report-title">Day Out of Days Report</p>
            </div>
            <div class="header-right">
                <div class="date-range">{start_formatted} - {end_formatted}</div>
                <div class="generated-date">Generated {datetime.now().strftime("%B %d, %Y at %I:%M %p")}</div>
            </div>
        </div>

        <table>
            <thead>
                <tr>
                    <th class="subject-name">Subject</th>
                    <th class="type-cell">Type</th>
                    <th class="total-cell">W</th>
                    <th class="total-cell">H</th>
                    <th class="total-cell">Total</th>
                    {day_headers}
                </tr>
            </thead>
            <tbody>
                {subject_rows}
            </tbody>
        </table>

        <div class="legend">
            <div class="legend-title">Code Legend</div>
            <div class="legend-items">
                {legend_items}
            </div>
        </div>

        <div class="footer">
            Day Out of Days Report - {project_title} - Page 1
        </div>
    </body>
    </html>
    """

    return html


async def generate_dood_pdf(
    project_title: str,
    days: List[Dict[str, Any]],
    subjects: List[Dict[str, Any]],
    assignments: List[Dict[str, Any]],
    date_range_start: str,
    date_range_end: str,
    logo_url: Optional[str] = None,
) -> bytes:
    """
    Generate a PDF from DOOD data.

    Args:
        project_title: Project name
        days: List of production days
        subjects: List of DOOD subjects
        assignments: List of subject-day assignments
        date_range_start: Start date (YYYY-MM-DD)
        date_range_end: End date (YYYY-MM-DD)
        logo_url: Optional URL to project logo

    Returns:
        PDF as bytes
    """
    try:
        from weasyprint import HTML
    except ImportError:
        raise ImportError("WeasyPrint is required for PDF generation. Install with: pip install weasyprint")

    # Fetch logo and convert to base64 if provided
    logo_base64 = None
    if logo_url:
        try:
            import httpx
            import base64
            async with httpx.AsyncClient() as client:
                response = await client.get(logo_url, timeout=10.0)
                if response.status_code == 200:
                    logo_base64 = base64.b64encode(response.content).decode('utf-8')
        except Exception as e:
            print(f"Warning: Could not fetch logo: {e}")

    # Generate HTML
    html_content = generate_dood_pdf_html(
        project_title=project_title,
        days=days,
        subjects=subjects,
        assignments=assignments,
        date_range_start=date_range_start,
        date_range_end=date_range_end,
        logo_base64=logo_base64,
    )

    # Convert HTML to PDF
    html = HTML(string=html_content)
    pdf_bytes = html.write_pdf()

    return pdf_bytes
