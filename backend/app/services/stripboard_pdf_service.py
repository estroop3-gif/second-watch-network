"""
Stripboard PDF Generation Service
Uses WeasyPrint to convert HTML to professional PDF reports
"""
from typing import List, Dict, Any, Optional
from datetime import datetime


# Status colors for PDF
STATUS_COLORS = {
    'PLANNED': '#6b7280',   # gray
    'SCHEDULED': '#3b82f6', # blue
    'SHOT': '#22c55e',      # green
    'DROPPED': '#ef4444',   # red
}

# Unit colors
UNIT_COLORS = {
    'A': '#FCDC58',  # accent yellow
    'B': '#a855f7',  # purple
    'OTHER': '#6b7280',  # gray
}


def generate_stripboard_pdf_html(
    project_title: str,
    stripboard_title: str,
    bank_strips: List[Dict[str, Any]],
    day_columns: List[Dict[str, Any]],
    date_range_start: str,
    date_range_end: str,
) -> str:
    """
    Generate Stripboard HTML for PDF conversion.
    Creates a professional production schedule report.
    """

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

    def format_duration(minutes: int) -> str:
        if not minutes:
            return "-"
        if minutes < 60:
            return f"{minutes}m"
        hours = minutes // 60
        mins = minutes % 60
        return f"{hours}h {mins}m" if mins else f"{hours}h"

    # Generate bank strips section
    bank_rows = ""
    for strip in bank_strips:
        scene_num = strip.get('scene_number') or ''
        slugline = strip.get('custom_title') or strip.get('slugline') or ''
        unit = strip.get('unit', 'A')
        status = strip.get('status', 'PLANNED')
        duration = format_duration(strip.get('estimated_duration_minutes'))
        notes = strip.get('notes') or ''

        status_color = STATUS_COLORS.get(status, '#6b7280')
        unit_color = UNIT_COLORS.get(unit, '#6b7280')

        bank_rows += f"""
            <tr>
                <td class="scene-number">{scene_num}</td>
                <td class="slugline">{slugline}</td>
                <td class="unit" style="background-color: {unit_color}; color: #000;">{unit}</td>
                <td class="status" style="background-color: {status_color}; color: white;">{status}</td>
                <td class="duration">{duration}</td>
                <td class="notes">{notes[:50]}{'...' if len(notes) > 50 else ''}</td>
            </tr>
        """

    # Generate day sections
    day_sections = ""
    for day_col in day_columns:
        day = day_col.get('day', {})
        strips = day_col.get('strips', [])

        day_num = f"Day {day.get('day_number', '')}" if day.get('day_number') else ""
        day_date = format_date(day.get('date', ''))
        day_weekday = get_day_of_week(day.get('date', ''))
        day_type = day.get('day_type', '').title()

        strip_rows = ""
        for strip in strips:
            scene_num = strip.get('scene_number') or ''
            slugline = strip.get('custom_title') or strip.get('slugline') or ''
            unit = strip.get('unit', 'A')
            status = strip.get('status', 'PLANNED')
            duration = format_duration(strip.get('estimated_duration_minutes'))
            notes = strip.get('notes') or ''

            status_color = STATUS_COLORS.get(status, '#6b7280')
            unit_color = UNIT_COLORS.get(unit, '#6b7280')

            strip_rows += f"""
                <tr>
                    <td class="scene-number">{scene_num}</td>
                    <td class="slugline">{slugline}</td>
                    <td class="unit" style="background-color: {unit_color}; color: #000;">{unit}</td>
                    <td class="status" style="background-color: {status_color}; color: white;">{status}</td>
                    <td class="duration">{duration}</td>
                    <td class="notes">{notes[:50]}{'...' if len(notes) > 50 else ''}</td>
                </tr>
            """

        if not strip_rows:
            strip_rows = '<tr><td colspan="6" class="empty-day">No strips scheduled</td></tr>'

        day_sections += f"""
            <div class="day-section">
                <div class="day-header">
                    <span class="day-info">{day_weekday} {day_date}</span>
                    <span class="day-number">{day_num}</span>
                    <span class="day-type">{day_type}</span>
                    <span class="strip-count">{len(strips)} strips</span>
                </div>
                <table class="strips-table">
                    <thead>
                        <tr>
                            <th class="scene-number">Scene</th>
                            <th class="slugline">Description</th>
                            <th class="unit">Unit</th>
                            <th class="status">Status</th>
                            <th class="duration">Duration</th>
                            <th class="notes">Notes</th>
                        </tr>
                    </thead>
                    <tbody>
                        {strip_rows}
                    </tbody>
                </table>
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
                size: letter portrait;
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
                margin-bottom: 20px;
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

            .section-title {{
                font-size: 11pt;
                font-weight: 600;
                color: #374151;
                margin: 20px 0 10px 0;
                padding-bottom: 5px;
                border-bottom: 1px solid #d1d5db;
            }}

            .strips-table {{
                width: 100%;
                border-collapse: collapse;
                margin-bottom: 15px;
                font-size: 8pt;
            }}

            .strips-table th,
            .strips-table td {{
                border: 1px solid #d1d5db;
                padding: 4px 6px;
                text-align: left;
                vertical-align: middle;
            }}

            .strips-table th {{
                background-color: #f3f4f6;
                font-weight: 600;
                font-size: 7pt;
                text-transform: uppercase;
            }}

            .scene-number {{
                width: 50px;
                text-align: center;
                font-weight: 600;
            }}

            .slugline {{
                min-width: 150px;
            }}

            .unit {{
                width: 40px;
                text-align: center;
                font-weight: bold;
            }}

            .status {{
                width: 70px;
                text-align: center;
                font-size: 7pt;
                font-weight: 600;
            }}

            .duration {{
                width: 50px;
                text-align: center;
            }}

            .notes {{
                font-size: 7pt;
                color: #6b7280;
            }}

            .empty-day {{
                text-align: center;
                color: #9ca3af;
                font-style: italic;
                padding: 10px !important;
            }}

            .day-section {{
                margin-bottom: 20px;
                page-break-inside: avoid;
            }}

            .day-header {{
                background-color: #1f2937;
                color: white;
                padding: 8px 12px;
                display: flex;
                justify-content: space-between;
                align-items: center;
                border-radius: 4px 4px 0 0;
            }}

            .day-info {{
                font-weight: 600;
            }}

            .day-number {{
                font-size: 10pt;
                font-weight: bold;
            }}

            .day-type {{
                background-color: rgba(255,255,255,0.2);
                padding: 2px 8px;
                border-radius: 3px;
                font-size: 8pt;
            }}

            .strip-count {{
                font-size: 8pt;
                color: #9ca3af;
            }}

            .bank-section {{
                margin-bottom: 25px;
            }}

            .legend {{
                margin-top: 20px;
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

            .legend-color {{
                display: inline-block;
                width: 14px;
                height: 14px;
                border-radius: 2px;
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
                <h1 class="project-title">{project_title}</h1>
                <p class="report-title">{stripboard_title} - Production Schedule</p>
            </div>
            <div class="header-right">
                <div class="date-range">{start_formatted} - {end_formatted}</div>
                <div class="generated-date">Generated {datetime.now().strftime("%B %d, %Y at %I:%M %p")}</div>
            </div>
        </div>

        {"" if not bank_strips else f'''
        <div class="bank-section">
            <div class="section-title">Unscheduled Strips ({len(bank_strips)})</div>
            <table class="strips-table">
                <thead>
                    <tr>
                        <th class="scene-number">Scene</th>
                        <th class="slugline">Description</th>
                        <th class="unit">Unit</th>
                        <th class="status">Status</th>
                        <th class="duration">Duration</th>
                        <th class="notes">Notes</th>
                    </tr>
                </thead>
                <tbody>
                    {bank_rows}
                </tbody>
            </table>
        </div>
        '''}

        <div class="section-title">Scheduled Days</div>
        {day_sections if day_sections else '<p style="color: #9ca3af; text-align: center;">No days in selected range</p>'}

        <div class="legend">
            <div class="legend-title">Status Legend</div>
            <div class="legend-items">
                <div class="legend-item">
                    <span class="legend-color" style="background-color: #6b7280;"></span>
                    <span class="legend-label">Planned</span>
                </div>
                <div class="legend-item">
                    <span class="legend-color" style="background-color: #3b82f6;"></span>
                    <span class="legend-label">Scheduled</span>
                </div>
                <div class="legend-item">
                    <span class="legend-color" style="background-color: #22c55e;"></span>
                    <span class="legend-label">Shot</span>
                </div>
                <div class="legend-item">
                    <span class="legend-color" style="background-color: #ef4444;"></span>
                    <span class="legend-label">Dropped</span>
                </div>
            </div>
        </div>

        <div class="footer">
            {stripboard_title} - {project_title} - Production Schedule
        </div>
    </body>
    </html>
    """

    return html


async def generate_stripboard_pdf(
    project_title: str,
    stripboard_title: str,
    bank_strips: List[Dict[str, Any]],
    day_columns: List[Dict[str, Any]],
    date_range_start: str,
    date_range_end: str,
) -> bytes:
    """
    Generate a PDF from Stripboard data.

    Args:
        project_title: Project name
        stripboard_title: Stripboard title
        bank_strips: List of unscheduled strips
        day_columns: List of day columns with strips
        date_range_start: Start date (YYYY-MM-DD)
        date_range_end: End date (YYYY-MM-DD)

    Returns:
        PDF as bytes
    """
    try:
        from weasyprint import HTML
    except ImportError:
        raise ImportError("WeasyPrint is required for PDF generation. Install with: pip install weasyprint")

    # Generate HTML
    html_content = generate_stripboard_pdf_html(
        project_title=project_title,
        stripboard_title=stripboard_title,
        bank_strips=bank_strips,
        day_columns=day_columns,
        date_range_start=date_range_start,
        date_range_end=date_range_end,
    )

    # Convert HTML to PDF
    html = HTML(string=html_content)
    pdf_bytes = html.write_pdf()

    return pdf_bytes
