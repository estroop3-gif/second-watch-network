"""
PDF Generation Service for Call Sheets
Uses WeasyPrint to convert HTML templates to professional PDFs
"""
import io
import base64
from typing import List, Dict, Any, Optional
from datetime import datetime, date, time
import httpx


def _to_string(value: Any) -> str:
    """Convert date/time/datetime objects to strings for PDF rendering."""
    if value is None:
        return ""
    if isinstance(value, datetime):
        return value.strftime("%Y-%m-%d %H:%M:%S")
    if isinstance(value, date):
        return value.strftime("%Y-%m-%d")
    if isinstance(value, time):
        return value.strftime("%H:%M")
    return str(value)


def generate_call_sheet_pdf_html(
    project_title: str,
    call_sheet_title: str,
    call_sheet_number: Optional[int],
    template_type: str,
    call_date: str,
    shoot_day: Optional[int],
    total_shoot_days: Optional[int],
    general_call_time: str,
    crew_call_time: Optional[str],
    first_shot_time: Optional[str],
    wrap_time: Optional[str],
    breakfast_time: Optional[str] = None,
    lunch_time: Optional[str] = None,
    dinner_time: Optional[str] = None,
    locations: List[Dict[str, Any]] = None,
    scenes: List[Dict[str, Any]] = None,
    cast: List[Dict[str, Any]] = None,
    crew: List[Dict[str, Any]] = None,
    schedule_blocks: List[Dict[str, Any]] = None,
    weather_info: Optional[str] = None,
    sunrise_time: Optional[str] = None,
    sunset_time: Optional[str] = None,
    special_instructions: Optional[str] = None,
    safety_notes: Optional[str] = None,
    hospital_name: Optional[str] = None,
    hospital_address: Optional[str] = None,
    hospital_phone: Optional[str] = None,
    set_medic: Optional[str] = None,
    fire_safety_officer: Optional[str] = None,
    key_contacts: Dict[str, Any] = None,
    custom_contacts: List[Dict[str, Any]] = None,
    department_notes: Dict[str, str] = None,
    general_notes: Optional[str] = None,
    advance_schedule: Optional[str] = None,
    production_company: Optional[str] = None,
    production_title: Optional[str] = None,
    production_office_phone: Optional[str] = None,
    production_email: Optional[str] = None,
    fallback_location_name: Optional[str] = None,
    fallback_location_address: Optional[str] = None,
    fallback_parking_notes: Optional[str] = None,
    fallback_basecamp: Optional[str] = None,
    logo_url: Optional[str] = None,
    logo_base64: Optional[str] = None,
) -> str:
    """
    Generate professional call sheet HTML for PDF conversion
    Uses industry-standard layout similar to Movie Magic Scheduling
    """

    # Template type display name
    template_labels = {
        "feature": "Feature Film",
        "documentary": "Documentary",
        "commercial": "Commercial",
        "music_video": "Music Video",
    }
    template_label = template_labels.get(template_type, template_type.replace("_", " ").title())

    # Logo section
    logo_html = ""
    if logo_base64:
        logo_html = f'<img src="data:image/png;base64,{logo_base64}" alt="Logo" style="max-height: 60px; max-width: 200px;">'
    elif logo_url:
        logo_html = f'<img src="{logo_url}" alt="Logo" style="max-height: 60px; max-width: 200px;">'

    # Header info
    shoot_day_text = ""
    if shoot_day:
        shoot_day_text = f"Day {shoot_day}"
        if total_shoot_days:
            shoot_day_text += f" of {total_shoot_days}"
    call_sheet_num = f"#{call_sheet_number}" if call_sheet_number else ""

    # Production info
    production_info_html = ""
    if production_company or production_title:
        prod_parts = []
        if production_company:
            prod_parts.append(production_company)
        if production_title and production_title != project_title:
            prod_parts.append(production_title)
        if prod_parts:
            production_info_html = f'<div class="production-info">{" • ".join(prod_parts)}</div>'

    # Locations HTML
    locations_html = ""
    for i, loc in enumerate(locations or []):
        loc_num = loc.get("location_number", i + 1)
        parking = loc.get('parking_info') or loc.get('parking_instructions') or ''
        basecamp = loc.get('basecamp_location') or loc.get('basecamp') or ''
        call_time = loc.get('call_time') or ''
        notes = loc.get('notes') or ''

        locations_html += f"""
        <div class="location-box">
            <div class="location-header">Location {loc_num}{f' - Call: {call_time}' if call_time else ''}</div>
            <div class="location-name">{loc.get('name', '')}</div>
            <div class="location-address">{loc.get('address', '')}</div>
            {f'<div class="location-parking"><strong>Parking:</strong> {parking}</div>' if parking else ''}
            {f'<div class="location-basecamp"><strong>Basecamp:</strong> {basecamp}</div>' if basecamp else ''}
            {f'<div class="location-notes">{notes}</div>' if notes else ''}
        </div>
        """

    # Default single location if no locations array - use fallback fields from call sheet
    if not locations_html and fallback_location_name:
        locations_html = f"""
        <div class="location-box">
            <div class="location-header">Location</div>
            <div class="location-name">{fallback_location_name}</div>
            {f'<div class="location-address">{fallback_location_address}</div>' if fallback_location_address else ''}
            {f'<div class="location-parking"><strong>Parking:</strong> {fallback_parking_notes}</div>' if fallback_parking_notes else ''}
            {f'<div class="location-basecamp"><strong>Basecamp:</strong> {fallback_basecamp}</div>' if fallback_basecamp else ''}
        </div>
        """

    # Scenes/Segments table
    scenes_html = ""
    if scenes:
        scene_rows = ""
        for scene in scenes:
            scene_rows += f"""
            <tr>
                <td class="scene-number">{scene.get('scene_number', '')}</td>
                <td class="scene-set">{scene.get('set_name', '')}</td>
                <td class="scene-description">{scene.get('description', '')}</td>
                <td class="scene-pages">{scene.get('page_count', '')}</td>
                <td class="scene-dn">{scene.get('day_night', '')}</td>
                <td class="scene-cast">{scene.get('cast_ids', '')}</td>
            </tr>
            """
        scenes_html = f"""
        <div class="section">
            <div class="section-header">Scenes / Segments</div>
            <table class="scenes-table">
                <thead>
                    <tr>
                        <th style="width: 60px;">Scene</th>
                        <th style="width: 120px;">Set</th>
                        <th>Description</th>
                        <th style="width: 50px;">Pages</th>
                        <th style="width: 40px;">D/N</th>
                        <th style="width: 80px;">Cast</th>
                    </tr>
                </thead>
                <tbody>
                    {scene_rows}
                </tbody>
            </table>
        </div>
        """

    # Cast table
    cast_html = ""
    if cast:
        cast_rows = ""
        for person in cast:
            # Get call time and format it
            call_time = person.get('call_time', '')
            if hasattr(call_time, 'strftime'):
                call_time = call_time.strftime('%H:%M')
            makeup_time = person.get('makeup_time', '')
            if hasattr(makeup_time, 'strftime'):
                makeup_time = makeup_time.strftime('%H:%M')

            cast_rows += f"""
            <tr>
                <td class="cast-id">{person.get('cast_number', '') or person.get('cast_id', '')}</td>
                <td class="cast-name">{person.get('name', '')}</td>
                <td class="cast-character">{person.get('character_name', '') or person.get('role', '')}</td>
                <td class="cast-call">{call_time}</td>
                <td class="cast-mu">{makeup_time}</td>
                <td class="cast-contact">{person.get('phone', '') or person.get('email', '')}</td>
                <td class="cast-notes">{person.get('notes', '') or person.get('wardrobe_notes', '')}</td>
            </tr>
            """
        cast_html = f"""
        <div class="section">
            <div class="section-header">Cast</div>
            <table class="cast-table">
                <thead>
                    <tr>
                        <th style="width: 30px;">#</th>
                        <th style="width: 120px;">Name</th>
                        <th style="width: 100px;">Character</th>
                        <th style="width: 60px;">Call</th>
                        <th style="width: 60px;">M/U</th>
                        <th style="width: 100px;">Contact</th>
                        <th>Notes</th>
                    </tr>
                </thead>
                <tbody>
                    {cast_rows}
                </tbody>
            </table>
        </div>
        """

    # Crew by department
    crew_html = ""
    if crew:
        departments: Dict[str, List] = {}
        for person in crew:
            dept = person.get('department', 'Other') or 'Other'
            if dept not in departments:
                departments[dept] = []
            departments[dept].append(person)

        dept_sections = ""
        for dept, members in departments.items():
            dept_rows = ""
            for person in members:
                # Format call time
                call_time = person.get('call_time', '')
                if hasattr(call_time, 'strftime'):
                    call_time = call_time.strftime('%H:%M')
                # Get contact info
                contact = person.get('phone', '') or person.get('email', '')

                dept_rows += f"""
                <tr>
                    <td class="crew-name">{person.get('name', '')}</td>
                    <td class="crew-role">{person.get('role', '')}</td>
                    <td class="crew-call">{call_time}</td>
                    <td class="crew-contact">{contact}</td>
                    <td class="crew-notes">{person.get('notes', '')}</td>
                </tr>
                """
            dept_sections += f"""
            <div class="department-section">
                <div class="department-header">{dept}</div>
                <table class="crew-table">
                    <thead>
                        <tr>
                            <th style="width: 120px;">Name</th>
                            <th style="width: 100px;">Role</th>
                            <th style="width: 60px;">Call</th>
                            <th style="width: 100px;">Contact</th>
                            <th>Notes</th>
                        </tr>
                    </thead>
                    <tbody>
                        {dept_rows}
                    </tbody>
                </table>
            </div>
            """

        crew_html = f"""
        <div class="section">
            <div class="section-header">Crew</div>
            {dept_sections}
        </div>
        """

    # Schedule blocks
    schedule_html = ""
    if schedule_blocks:
        schedule_rows = ""
        for block in schedule_blocks:
            schedule_rows += f"""
            <tr>
                <td class="schedule-time">{block.get('time', '')}</td>
                <td class="schedule-activity">{block.get('activity', '')}</td>
                <td class="schedule-notes">{block.get('notes', '')}</td>
            </tr>
            """
        schedule_html = f"""
        <div class="section">
            <div class="section-header">Schedule</div>
            <table class="schedule-table">
                <thead>
                    <tr>
                        <th style="width: 80px;">Time</th>
                        <th style="width: 200px;">Activity</th>
                        <th>Notes</th>
                    </tr>
                </thead>
                <tbody>
                    {schedule_rows}
                </tbody>
            </table>
        </div>
        """

    # Key contacts section
    contacts_html = ""
    contact_items = ""

    # Production office info
    if production_office_phone or production_email:
        office_info = ""
        if production_office_phone:
            office_info += production_office_phone
        if production_email:
            office_info += f" | {production_email}" if office_info else production_email
        contact_items += f'<div class="contact-item"><span class="contact-title">Production Office:</span> {office_info}</div>'

    # Key contacts from structured data
    if key_contacts:
        if key_contacts.get("producer", {}).get("name"):
            p = key_contacts["producer"]
            contact_items += f'<div class="contact-item"><span class="contact-title">Producer:</span> {p.get("name")} {p.get("phone", "")}</div>'
        if key_contacts.get("upm", {}).get("name"):
            p = key_contacts["upm"]
            contact_items += f'<div class="contact-item"><span class="contact-title">UPM:</span> {p.get("name")} {p.get("phone", "")}</div>'
        if key_contacts.get("first_ad", {}).get("name"):
            p = key_contacts["first_ad"]
            contact_items += f'<div class="contact-item"><span class="contact-title">1st AD:</span> {p.get("name")} {p.get("phone", "")}</div>'
        if key_contacts.get("director", {}).get("name"):
            p = key_contacts["director"]
            contact_items += f'<div class="contact-item"><span class="contact-title">Director:</span> {p.get("name")} {p.get("phone", "")}</div>'

    # Custom contacts
    if custom_contacts:
        for cc in custom_contacts:
            cc_phone = f" {cc.get('phone', '')}" if cc.get('phone') else ""
            cc_email = f" | {cc.get('email', '')}" if cc.get('email') else ""
            contact_items += f'<div class="contact-item"><span class="contact-title">{cc.get("title", "")}:</span> {cc.get("name", "")}{cc_phone}{cc_email}</div>'

    if contact_items:
        contacts_html = f"""
        <div class="contacts-box">
            <div class="section-header">Key Contacts</div>
            {contact_items}
        </div>
        """

    # Department notes
    dept_notes_html = ""
    if department_notes:
        notes_items = ""
        dept_labels = {
            "camera": "Camera",
            "sound": "Sound",
            "grip_electric": "G&E",
            "art": "Art Department",
            "wardrobe": "Wardrobe",
            "makeup": "Makeup/Hair",
            "stunts": "Stunts",
            "vfx": "VFX",
            "production": "Production",
            "locations": "Locations",
            "transportation": "Transportation",
            "catering": "Catering",
        }
        for key, note in department_notes.items():
            if note and note.strip():
                label = dept_labels.get(key, key.replace("_", " ").title())
                notes_items += f"""
                <div class="dept-note">
                    <div class="dept-note-header">{label}</div>
                    <div class="dept-note-content">{note}</div>
                </div>
                """
        if notes_items:
            dept_notes_html = f"""
            <div class="section">
                <div class="section-header">Department Notes</div>
                <div class="dept-notes-grid">
                    {notes_items}
                </div>
            </div>
            """

    # Safety section
    safety_html = ""
    if safety_notes or hospital_name or set_medic or fire_safety_officer:
        safety_content = ""
        if safety_notes:
            safety_content += f'<div class="safety-notes">{safety_notes}</div>'

        # Safety personnel
        safety_personnel = []
        if set_medic:
            safety_personnel.append(f"<strong>Set Medic:</strong> {set_medic}")
        if fire_safety_officer:
            safety_personnel.append(f"<strong>Fire Safety:</strong> {fire_safety_officer}")
        if safety_personnel:
            safety_content += f'<div class="safety-personnel">{" &bull; ".join(safety_personnel)}</div>'

        if hospital_name:
            hospital_parts = [f"<strong>Nearest Hospital:</strong> {hospital_name}"]
            if hospital_address:
                hospital_parts.append(hospital_address)
            if hospital_phone:
                hospital_parts.append(hospital_phone)
            safety_content += f'<div class="hospital-info">{" | ".join(hospital_parts)}</div>'

        safety_html = f"""
        <div class="section safety-section">
            <div class="section-header">Safety Information</div>
            {safety_content}
        </div>
        """

    # Special instructions
    instructions_html = ""
    if special_instructions:
        instructions_html = f"""
        <div class="section">
            <div class="section-header">Special Instructions</div>
            <div class="special-instructions">{special_instructions}</div>
        </div>
        """

    # General notes
    general_notes_html = ""
    if general_notes:
        general_notes_html = f"""
        <div class="section">
            <div class="section-header">General Notes</div>
            <div class="general-notes">{general_notes}</div>
        </div>
        """

    # Advance schedule / Tomorrow
    advance_html = ""
    if advance_schedule:
        advance_html = f"""
        <div class="section advance-section">
            <div class="section-header">Tomorrow / Advance Schedule</div>
            <div class="advance-content">{advance_schedule}</div>
        </div>
        """

    # Meal times section
    meal_times_html = ""
    meal_items = []
    if breakfast_time:
        meal_items.append(f"<span><strong>Breakfast:</strong> {breakfast_time}</span>")
    if lunch_time:
        meal_items.append(f"<span><strong>Lunch:</strong> {lunch_time}</span>")
    if dinner_time:
        meal_items.append(f"<span><strong>2nd Meal:</strong> {dinner_time}</span>")
    if meal_items:
        meal_times_html = f"""
        <div class="meal-times-box">
            {" &bull; ".join(meal_items)}
        </div>
        """

    # Weather info
    weather_html = ""
    if weather_info or sunrise_time or sunset_time:
        weather_content = weather_info or ""
        if sunrise_time or sunset_time:
            times = []
            if sunrise_time:
                times.append(f"Sunrise: {sunrise_time}")
            if sunset_time:
                times.append(f"Sunset: {sunset_time}")
            weather_content += f" ({', '.join(times)})"
        weather_html = f"""
        <div class="weather-box">
            <span class="weather-label">Weather:</span> {weather_content}
        </div>
        """

    html = f"""
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>{call_sheet_title} - {project_title}</title>
    <style>
        @page {{
            size: letter;
            margin: 0.5in 0.5in 0.75in 0.5in;
            @bottom-center {{
                content: "Page " counter(page) " of " counter(pages);
                font-size: 9px;
                color: #666;
            }}
        }}

        * {{
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }}

        body {{
            font-family: Arial, Helvetica, sans-serif;
            font-size: 10px;
            line-height: 1.3;
            color: #000;
            background: #fff;
        }}

        .header {{
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            border-bottom: 3px solid #000;
            padding-bottom: 8px;
            margin-bottom: 12px;
        }}

        .header-left {{
            flex: 1;
        }}

        .header-right {{
            text-align: right;
        }}

        .logo {{
            margin-bottom: 4px;
        }}

        .project-title {{
            font-size: 18px;
            font-weight: bold;
            text-transform: uppercase;
            letter-spacing: 1px;
        }}

        .call-sheet-title {{
            font-size: 14px;
            font-weight: bold;
            color: #333;
        }}

        .call-sheet-num {{
            font-size: 24px;
            font-weight: bold;
        }}

        .shoot-day {{
            font-size: 12px;
            color: #666;
        }}

        .template-type {{
            font-size: 10px;
            color: #666;
            text-transform: uppercase;
        }}

        .quick-info {{
            display: flex;
            gap: 16px;
            margin-bottom: 12px;
            padding: 8px;
            background: #f5f5f5;
            border: 1px solid #ddd;
        }}

        .info-box {{
            flex: 1;
            text-align: center;
            padding: 4px 8px;
            border-right: 1px solid #ddd;
        }}

        .info-box:last-child {{
            border-right: none;
        }}

        .info-label {{
            font-size: 8px;
            text-transform: uppercase;
            color: #666;
            margin-bottom: 2px;
        }}

        .info-value {{
            font-size: 14px;
            font-weight: bold;
        }}

        .locations-row {{
            display: flex;
            gap: 12px;
            margin-bottom: 12px;
        }}

        .location-box {{
            flex: 1;
            padding: 8px;
            border: 1px solid #333;
            background: #fafafa;
        }}

        .location-header {{
            font-size: 9px;
            text-transform: uppercase;
            color: #666;
            margin-bottom: 2px;
        }}

        .location-name {{
            font-size: 12px;
            font-weight: bold;
            margin-bottom: 2px;
        }}

        .location-address {{
            font-size: 10px;
            color: #333;
        }}

        .location-parking, .location-notes, .location-basecamp {{
            font-size: 9px;
            color: #666;
            margin-top: 4px;
        }}

        .weather-box {{
            padding: 6px 8px;
            background: #e3f2fd;
            border: 1px solid #bbdefb;
            margin-bottom: 12px;
            font-size: 10px;
        }}

        .weather-label {{
            font-weight: bold;
        }}

        .section {{
            margin-bottom: 14px;
            page-break-inside: avoid;
        }}

        .section-header {{
            font-size: 11px;
            font-weight: bold;
            text-transform: uppercase;
            background: #333;
            color: #fff;
            padding: 4px 8px;
            margin-bottom: 0;
        }}

        table {{
            width: 100%;
            border-collapse: collapse;
            font-size: 9px;
        }}

        th {{
            background: #e0e0e0;
            font-weight: bold;
            text-align: left;
            padding: 4px 6px;
            border: 1px solid #ccc;
        }}

        td {{
            padding: 3px 6px;
            border: 1px solid #ddd;
            vertical-align: top;
        }}

        .scenes-table tr:nth-child(even) {{
            background: #fafafa;
        }}

        .scene-number {{
            font-weight: bold;
            text-align: center;
        }}

        .cast-table tr:nth-child(even) {{
            background: #fafafa;
        }}

        .cast-id {{
            font-weight: bold;
            text-align: center;
        }}

        .cast-call, .cast-pickup, .cast-mu, .cast-set {{
            text-align: center;
            font-family: 'Courier New', monospace;
        }}

        .department-section {{
            margin-bottom: 8px;
        }}

        .department-header {{
            font-size: 10px;
            font-weight: bold;
            background: #e8e8e8;
            padding: 3px 8px;
            border: 1px solid #ccc;
            border-bottom: none;
        }}

        .crew-table {{
            margin-bottom: 0;
        }}

        .crew-call {{
            font-family: 'Courier New', monospace;
            text-align: center;
            width: 70px;
        }}

        .crew-contact, .cast-contact {{
            font-size: 8px;
            color: #666;
        }}

        .schedule-time {{
            font-family: 'Courier New', monospace;
            font-weight: bold;
        }}

        .contacts-box {{
            padding: 8px;
            background: #f9f9f9;
            border: 1px solid #ddd;
            margin-bottom: 12px;
        }}

        .contact-item {{
            font-size: 10px;
            margin-bottom: 3px;
        }}

        .contact-title {{
            font-weight: bold;
        }}

        .dept-notes-grid {{
            display: flex;
            flex-wrap: wrap;
            gap: 8px;
        }}

        .dept-note {{
            flex: 1 1 45%;
            padding: 6px;
            background: #fafafa;
            border: 1px solid #ddd;
        }}

        .dept-note-header {{
            font-size: 9px;
            font-weight: bold;
            text-transform: uppercase;
            color: #666;
            margin-bottom: 2px;
        }}

        .dept-note-content {{
            font-size: 9px;
            white-space: pre-wrap;
        }}

        .safety-section {{
            border: 2px solid #c00;
            background: #fff5f5;
        }}

        .safety-section .section-header {{
            background: #c00;
        }}

        .safety-notes, .hospital-info {{
            padding: 6px 8px;
            font-size: 10px;
        }}

        .hospital-info {{
            margin-top: 6px;
            padding-top: 6px;
            border-top: 1px solid #fcc;
        }}

        .special-instructions {{
            padding: 8px;
            font-size: 10px;
            white-space: pre-wrap;
            background: #fffde7;
            border: 1px solid #fff9c4;
        }}

        .general-notes {{
            padding: 8px;
            font-size: 10px;
            white-space: pre-wrap;
            background: #f5f5f5;
            border: 1px solid #ddd;
        }}

        .advance-section {{
            border: 2px solid #1976d2;
            background: #e3f2fd;
        }}

        .advance-section .section-header {{
            background: #1976d2;
        }}

        .advance-content {{
            padding: 8px;
            font-size: 10px;
            white-space: pre-wrap;
        }}

        .meal-times-box {{
            padding: 6px 8px;
            background: #fff3e0;
            border: 1px solid #ffe0b2;
            margin-bottom: 12px;
            font-size: 10px;
            display: flex;
            gap: 16px;
            flex-wrap: wrap;
        }}

        .safety-personnel {{
            padding: 6px 8px;
            font-size: 10px;
            border-bottom: 1px solid #fcc;
        }}

        .production-info {{
            font-size: 9px;
            color: #666;
            margin-top: 2px;
        }}

        .footer {{
            margin-top: 20px;
            padding-top: 8px;
            border-top: 1px solid #ddd;
            font-size: 8px;
            color: #999;
            text-align: center;
        }}
    </style>
</head>
<body>
    <div class="header">
        <div class="header-left">
            <div class="logo">{logo_html}</div>
            <div class="project-title">{project_title}</div>
            <div class="call-sheet-title">{call_sheet_title}</div>
            {production_info_html}
            <div class="template-type">{template_label}</div>
        </div>
        <div class="header-right">
            <div class="call-sheet-num">{call_sheet_num}</div>
            <div class="shoot-day">{shoot_day_text}</div>
            <div style="font-size: 12px; font-weight: bold; margin-top: 8px;">{call_date}</div>
        </div>
    </div>

    <div class="quick-info">
        <div class="info-box">
            <div class="info-label">General Call</div>
            <div class="info-value">{general_call_time or 'TBD'}</div>
        </div>
        <div class="info-box">
            <div class="info-label">Crew Call</div>
            <div class="info-value">{crew_call_time or general_call_time or 'TBD'}</div>
        </div>
        <div class="info-box">
            <div class="info-label">First Shot</div>
            <div class="info-value">{first_shot_time or 'TBD'}</div>
        </div>
        <div class="info-box">
            <div class="info-label">Est. Wrap</div>
            <div class="info-value">{wrap_time or 'TBD'}</div>
        </div>
    </div>

    <div class="locations-row">
        {locations_html}
    </div>

    {weather_html}
    {meal_times_html}
    {contacts_html}
    {scenes_html}
    {cast_html}
    {crew_html}
    {schedule_html}
    {dept_notes_html}
    {instructions_html}
    {general_notes_html}
    {safety_html}
    {advance_html}

    <div class="footer">
        Generated by Second Watch Network Backlot &bull; {datetime.now().strftime("%B %d, %Y at %I:%M %p")}
    </div>
</body>
</html>
    """

    return html


async def generate_call_sheet_pdf(
    call_sheet: Dict[str, Any],
    project: Dict[str, Any],
    scenes: List[Dict[str, Any]],
    people: List[Dict[str, Any]],
    locations: List[Dict[str, Any]],
    logo_url: Optional[str] = None,
) -> bytes:
    """
    Generate a PDF from call sheet data

    Args:
        call_sheet: Call sheet data dict
        project: Project data dict
        scenes: List of scene breakdown items
        people: List of cast/crew people
        locations: List of locations
        logo_url: Optional URL to header logo

    Returns:
        PDF as bytes
    """
    try:
        from weasyprint import HTML, CSS
    except ImportError:
        raise ImportError("WeasyPrint is required for PDF generation. Install with: pip install weasyprint")

    # Fetch logo and convert to base64 if provided
    logo_base64 = None
    if logo_url:
        try:
            async with httpx.AsyncClient() as client:
                response = await client.get(logo_url, timeout=10.0)
                if response.status_code == 200:
                    logo_base64 = base64.b64encode(response.content).decode('utf-8')
        except Exception as e:
            print(f"Warning: Could not fetch logo: {e}")

    # Format the date - handle both date objects and strings
    call_date_val = call_sheet.get("date", "")
    try:
        if isinstance(call_date_val, date):
            call_date_formatted = call_date_val.strftime("%A, %B %d, %Y")
        elif isinstance(call_date_val, str) and call_date_val:
            call_date_obj = datetime.strptime(call_date_val, "%Y-%m-%d")
            call_date_formatted = call_date_obj.strftime("%A, %B %d, %Y")
        else:
            call_date_formatted = str(call_date_val) if call_date_val else ""
    except Exception:
        call_date_formatted = str(call_date_val) if call_date_val else ""

    # Separate cast and crew
    cast = [p for p in people if p.get("person_type") == "cast" or p.get("character_name") or p.get("is_cast")]
    crew = [p for p in people if p.get("person_type") == "crew" or (not p.get("character_name") and not p.get("is_cast") and p.get("department"))]

    # If no separation, put all in crew for now
    if not cast and not crew:
        crew = people

    # Build key_contacts from individual fields
    key_contacts = call_sheet.get("key_contacts") or {}
    if not key_contacts:
        key_contacts = {}
        if call_sheet.get("director_name"):
            key_contacts["director"] = {
                "name": call_sheet.get("director_name"),
                "phone": call_sheet.get("director_phone", "")
            }
        if call_sheet.get("producer_name"):
            key_contacts["producer"] = {
                "name": call_sheet.get("producer_name"),
                "phone": call_sheet.get("producer_phone", "")
            }
        if call_sheet.get("upm_name"):
            key_contacts["upm"] = {
                "name": call_sheet.get("upm_name"),
                "phone": call_sheet.get("upm_phone", "")
            }
        if call_sheet.get("first_ad_name"):
            key_contacts["first_ad"] = {
                "name": call_sheet.get("first_ad_name"),
                "phone": call_sheet.get("first_ad_phone", "")
            }

    # Build department_notes from individual fields
    department_notes = call_sheet.get("department_notes") or {}
    if not department_notes:
        department_notes = {}
        if call_sheet.get("camera_notes"):
            department_notes["camera"] = call_sheet.get("camera_notes")
        if call_sheet.get("sound_notes"):
            department_notes["sound"] = call_sheet.get("sound_notes")
        if call_sheet.get("grip_electric_notes"):
            department_notes["grip_electric"] = call_sheet.get("grip_electric_notes")
        if call_sheet.get("art_notes"):
            department_notes["art"] = call_sheet.get("art_notes")
        if call_sheet.get("wardrobe_notes"):
            department_notes["wardrobe"] = call_sheet.get("wardrobe_notes")
        if call_sheet.get("makeup_hair_notes"):
            department_notes["makeup"] = call_sheet.get("makeup_hair_notes")
        if call_sheet.get("stunts_notes"):
            department_notes["stunts"] = call_sheet.get("stunts_notes")
        if call_sheet.get("vfx_notes"):
            department_notes["vfx"] = call_sheet.get("vfx_notes")
        if call_sheet.get("transport_notes"):
            department_notes["transportation"] = call_sheet.get("transport_notes")
        if call_sheet.get("catering_notes"):
            department_notes["catering"] = call_sheet.get("catering_notes")

    # Get weather info - check both fields
    weather_info = call_sheet.get("weather_forecast") or call_sheet.get("weather_info") or ""

    # Get hospital name - check both fields
    hospital_name = call_sheet.get("nearest_hospital") or call_sheet.get("hospital_name") or ""

    # Generate HTML - convert all time fields to strings
    html_content = generate_call_sheet_pdf_html(
        project_title=str(project.get("title", "")),
        call_sheet_title=str(call_sheet.get("title", "Call Sheet")),
        call_sheet_number=call_sheet.get("call_sheet_number"),
        template_type=str(call_sheet.get("template_type", "feature")),
        call_date=call_date_formatted,
        shoot_day=call_sheet.get("shoot_day_number") or call_sheet.get("shoot_day"),
        total_shoot_days=call_sheet.get("total_shoot_days"),
        general_call_time=_to_string(call_sheet.get("general_call_time")),
        crew_call_time=_to_string(call_sheet.get("crew_call_time")),
        first_shot_time=_to_string(call_sheet.get("first_shot_time")),
        wrap_time=_to_string(call_sheet.get("estimated_wrap_time")),
        breakfast_time=_to_string(call_sheet.get("breakfast_time")),
        lunch_time=_to_string(call_sheet.get("lunch_time")),
        dinner_time=_to_string(call_sheet.get("dinner_time")),
        locations=locations,
        scenes=scenes,
        cast=cast,
        crew=crew,
        schedule_blocks=call_sheet.get("schedule_blocks", []),
        weather_info=_to_string(weather_info),
        sunrise_time=_to_string(call_sheet.get("sunrise_time")),
        sunset_time=_to_string(call_sheet.get("sunset_time")),
        special_instructions=_to_string(call_sheet.get("special_instructions")),
        safety_notes=_to_string(call_sheet.get("safety_notes")),
        hospital_name=_to_string(hospital_name),
        hospital_address=_to_string(call_sheet.get("hospital_address")),
        hospital_phone=_to_string(call_sheet.get("hospital_phone")),
        set_medic=_to_string(call_sheet.get("set_medic")),
        fire_safety_officer=_to_string(call_sheet.get("fire_safety_officer")),
        key_contacts=key_contacts,
        custom_contacts=call_sheet.get("custom_contacts", []),
        department_notes=department_notes,
        general_notes=_to_string(call_sheet.get("general_notes")),
        advance_schedule=_to_string(call_sheet.get("advance_schedule")),
        production_company=_to_string(call_sheet.get("production_company")),
        production_title=_to_string(call_sheet.get("production_title")),
        production_office_phone=_to_string(call_sheet.get("production_office_phone")),
        production_email=_to_string(call_sheet.get("production_email")),
        fallback_location_name=_to_string(call_sheet.get("location_name")),
        fallback_location_address=_to_string(call_sheet.get("location_address")),
        fallback_parking_notes=_to_string(call_sheet.get("parking_notes") or call_sheet.get("parking_instructions")),
        fallback_basecamp=_to_string(call_sheet.get("basecamp_location")),
        logo_url=logo_url,
        logo_base64=logo_base64,
    )

    # Convert HTML to PDF
    html = HTML(string=html_content)
    pdf_bytes = html.write_pdf()

    return pdf_bytes
