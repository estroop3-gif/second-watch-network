"""
Gear House Labels API

Endpoints for generating barcodes, QR codes, and label sheets.
"""
from typing import Optional, List, Dict, Any
from io import BytesIO
import base64

from fastapi import APIRouter, HTTPException, Depends, Query, Response
from pydantic import BaseModel

from app.core.auth import get_current_user

from app.services import gear_service

router = APIRouter(prefix="/labels", tags=["Gear Labels"])


# ============================================================================
# SCHEMAS
# ============================================================================

class LabelBatchRequest(BaseModel):
    asset_ids: List[str]
    kit_ids: Optional[List[str]] = None
    label_type: str = "both"  # barcode, qr, both
    include_name: bool = True
    include_category: bool = True
    # New content fields
    include_internal_id: bool = True
    include_serial_number: bool = False
    include_manufacturer: bool = False
    include_model: bool = False
    include_purchase_date: bool = False
    include_logo: bool = False
    color_coding_enabled: bool = False
    # Extended options for batch printing
    label_size: str = "2x1"  # 2x1, 1.5x0.5, 3x2, custom
    print_mode: str = "sheet"  # sheet, roll
    printer_type: str = "generic"  # generic, zebra, dymo, brother
    sheet_rows: Optional[int] = 10
    sheet_columns: Optional[int] = 3
    custom_width_mm: Optional[float] = None
    custom_height_mm: Optional[float] = None


class PrintQueueSettings(BaseModel):
    """Optional settings to override template defaults when printing queue."""
    label_type: Optional[str] = None  # barcode, qr, both
    label_size: Optional[str] = None
    print_mode: Optional[str] = None
    printer_type: Optional[str] = None
    sheet_rows: Optional[int] = None
    sheet_columns: Optional[int] = None
    custom_width_mm: Optional[float] = None
    custom_height_mm: Optional[float] = None
    include_name: Optional[bool] = None
    include_category: Optional[bool] = None
    include_internal_id: Optional[bool] = None
    include_serial_number: Optional[bool] = None
    include_manufacturer: Optional[bool] = None
    include_model: Optional[bool] = None
    include_purchase_date: Optional[bool] = None
    include_logo: Optional[bool] = None
    color_coding_enabled: Optional[bool] = None


# Label size configurations
LABEL_SIZES = {
    "2x1": {
        "width": "2in",
        "height": "1in",
        "width_mm": 51,
        "height_mm": 25,
        "barcode_height": "40px",
        "qr_size": "60px",
        "font_size": "8pt",
        "name_font_size": "9pt",
        "id_font_size": "8pt",
        "category_font_size": "7pt",
    },
    "1.5x0.5": {
        "width": "1.5in",
        "height": "0.5in",
        "width_mm": 38,
        "height_mm": 13,
        "barcode_height": "25px",
        "qr_size": "35px",
        "font_size": "6pt",
        "name_font_size": "7pt",
        "id_font_size": "6pt",
        "category_font_size": "5pt",
    },
    "3x2": {
        "width": "3in",
        "height": "2in",
        "width_mm": 76,
        "height_mm": 51,
        "barcode_height": "60px",
        "qr_size": "100px",
        "font_size": "10pt",
        "name_font_size": "12pt",
        "id_font_size": "10pt",
        "category_font_size": "9pt",
    },
}


# ============================================================================
# HELPER FUNCTIONS
# ============================================================================

def get_profile_id(user: Dict[str, Any]) -> str:
    return user.get("id")


def require_org_access(org_id: str, user_id: str, roles: List[str] = None) -> None:
    if not gear_service.check_org_permission(org_id, user_id, roles):
        raise HTTPException(status_code=403, detail="Access denied to this organization")


def generate_barcode_svg(value: str, barcode_format: str = "CODE128") -> str:
    """Generate a barcode as SVG string."""
    try:
        import barcode
        from barcode.writer import SVGWriter

        # Map format names
        format_map = {
            "CODE128": "code128",
            "CODE39": "code39",
            "EAN13": "ean13",
            "EAN8": "ean8",
            "UPC": "upca"
        }

        bc_format = format_map.get(barcode_format, "code128")
        bc_class = barcode.get_barcode_class(bc_format)

        # Generate barcode
        bc = bc_class(value, writer=SVGWriter())

        # Write to buffer
        buffer = BytesIO()
        bc.write(buffer)
        buffer.seek(0)

        return buffer.getvalue().decode('utf-8')
    except ImportError:
        # Fallback: return placeholder SVG
        return f'''<svg xmlns="http://www.w3.org/2000/svg" width="200" height="80">
            <rect width="200" height="80" fill="white"/>
            <text x="100" y="40" text-anchor="middle" font-family="monospace" font-size="12">{value}</text>
            <text x="100" y="60" text-anchor="middle" font-family="sans-serif" font-size="8" fill="gray">Barcode: {value}</text>
        </svg>'''


def generate_qr_svg(value: str) -> str:
    """Generate a QR code as SVG string."""
    try:
        import qrcode
        from qrcode.image.svg import SvgPathImage

        qr = qrcode.QRCode(
            version=1,
            error_correction=qrcode.constants.ERROR_CORRECT_M,
            box_size=10,
            border=2
        )
        qr.add_data(value)
        qr.make(fit=True)

        img = qr.make_image(image_factory=SvgPathImage)

        buffer = BytesIO()
        img.save(buffer)
        buffer.seek(0)

        return buffer.getvalue().decode('utf-8')
    except ImportError:
        # Fallback: return placeholder SVG
        return f'''<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100">
            <rect width="100" height="100" fill="white"/>
            <rect x="10" y="10" width="80" height="80" fill="none" stroke="black" stroke-width="2"/>
            <text x="50" y="55" text-anchor="middle" font-family="sans-serif" font-size="8">QR: {value[:15]}...</text>
        </svg>'''


def generate_label_html(
    asset: dict,
    label_type: str,
    include_name: bool,
    include_category: bool,
    label_size: str = "2x1",
    custom_width_mm: float = None,
    custom_height_mm: float = None,
    include_internal_id: bool = True,
    include_serial_number: bool = False,
    include_manufacturer: bool = False,
    include_model: bool = False,
    include_purchase_date: bool = False,
    include_logo: bool = False,
    color_coding_enabled: bool = False
) -> str:
    """Generate HTML for a single asset label with configurable size and content fields."""
    # Get size configuration
    if label_size == "custom" and custom_width_mm and custom_height_mm:
        size_config = {
            "width": f"{custom_width_mm}mm",
            "height": f"{custom_height_mm}mm",
            "barcode_height": f"{min(custom_height_mm * 0.4, 40)}px",
            "qr_size": f"{min(custom_height_mm * 0.7, 60)}px",
            "font_size": "8pt",
            "name_font_size": "9pt",
            "id_font_size": "8pt",
            "category_font_size": "7pt",
        }
    else:
        size_config = LABEL_SIZES.get(label_size, LABEL_SIZES["2x1"])

    barcode_svg = ""
    qr_svg = ""

    if label_type in ["barcode", "both"] and asset.get("barcode"):
        barcode_svg = generate_barcode_svg(asset["barcode"])

    if label_type in ["qr", "both"] and asset.get("qr_code"):
        qr_svg = generate_qr_svg(asset["qr_code"])

    # Color coding border style
    border_style = "border: 1px dashed #ccc;"
    if color_coding_enabled and asset.get("category_color"):
        border_style = f"border: 3px solid {asset.get('category_color')};"

    # Start label HTML with configurable dimensions
    html = f'''
    <div class="label" style="width: {size_config['width']}; height: {size_config['height']}; padding: 4px; {border_style} display: inline-block; margin: 2px; font-family: sans-serif; font-size: {size_config['font_size']}; page-break-inside: avoid; box-sizing: border-box; overflow: hidden;">
    '''

    # Logo at top (if enabled and available)
    if include_logo and asset.get("org_logo_url"):
        html += f'<div style="text-align: center; margin-bottom: 2px;"><img src="{asset.get("org_logo_url")}" style="max-height: 15px; max-width: 50px;" /></div>'

    # Code display area (barcode and/or QR)
    if barcode_svg or qr_svg:
        html += '<div style="display: flex; justify-content: space-between; align-items: flex-start;">'

        if barcode_svg:
            html += f'<div style="flex: 1; max-height: {size_config["barcode_height"]}; overflow: hidden;">{barcode_svg}</div>'

        if qr_svg:
            html += f'<div style="width: {size_config["qr_size"]}; height: {size_config["qr_size"]}; flex-shrink: 0;">{qr_svg}</div>'

        html += '</div>'

    # Asset name
    if include_name:
        max_chars = 30 if label_size != "1.5x0.5" else 20
        name = asset.get("name", "")[:max_chars]
        html += f'<div style="font-weight: bold; font-size: {size_config["name_font_size"]}; margin-top: 2px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">{name}</div>'

    # Internal ID
    if include_internal_id and asset.get("internal_id"):
        html += f'<div style="font-family: monospace; font-size: {size_config["id_font_size"]};">{asset.get("internal_id", "")}</div>'

    # Category
    if include_category and asset.get("category_name"):
        html += f'<div style="color: #666; font-size: {size_config["category_font_size"]};">{asset.get("category_name", "")}</div>'

    # Serial Number
    if include_serial_number and asset.get("serial_number"):
        html += f'<div style="font-size: {size_config["category_font_size"]}; color: #444;">S/N: {asset.get("serial_number")}</div>'

    # Manufacturer and Model (on same line if both)
    mfg_model_parts = []
    if include_manufacturer and asset.get("manufacturer"):
        mfg_model_parts.append(asset.get("manufacturer"))
    if include_model and asset.get("model"):
        mfg_model_parts.append(asset.get("model"))
    if mfg_model_parts:
        html += f'<div style="font-size: {size_config["category_font_size"]}; color: #444;">{" - ".join(mfg_model_parts)}</div>'

    # Purchase Date
    if include_purchase_date and asset.get("purchase_date"):
        purchase_date = asset.get("purchase_date")
        if isinstance(purchase_date, str):
            # Format as short date
            try:
                from datetime import datetime
                dt = datetime.fromisoformat(purchase_date.replace('Z', '+00:00'))
                purchase_date = dt.strftime("%m/%d/%Y")
            except:
                pass
        html += f'<div style="font-size: {size_config["category_font_size"]}; color: #888;">Purchased: {purchase_date}</div>'

    html += '</div>'

    return html


# ============================================================================
# ZPL GENERATION (Zebra Printer Language)
# ============================================================================

# ZPL label sizes in dots at 203 DPI (standard resolution)
ZPL_LABEL_SIZES = {
    "2x1": {"width": 406, "height": 203},      # 2" x 1"
    "1.5x0.5": {"width": 305, "height": 102},  # 1.5" x 0.5"
    "3x2": {"width": 609, "height": 406},      # 3" x 2"
}


def generate_barcode_zpl(value: str, barcode_format: str = "CODE128", x: int = 20, y: int = 10) -> str:
    """Generate ZPL command for a barcode.

    Args:
        value: The barcode value to encode
        barcode_format: Barcode type (CODE128, CODE39, EAN13, EAN8)
        x: X position in dots
        y: Y position in dots
    """
    # ZPL barcode commands by format
    format_map = {
        "CODE128": ("BC", "N,80,Y,N,N"),  # ^BCo,h,f,g,e,m
        "CODE39": ("B3", "N,,Y,N"),       # ^B3o,e,h,f,g
        "EAN13": ("BE", "80,Y,N"),        # ^BEo,h,f,g
        "EAN8": ("B8", "80,Y,N"),         # ^B8o,h,f,g
    }

    cmd, params = format_map.get(barcode_format, format_map["CODE128"])
    return f"^FO{x},{y}^{cmd}{params}^FD{value}^FS"


def generate_qr_zpl(value: str, x: int = 20, y: int = 10, magnification: int = 4) -> str:
    """Generate ZPL command for a QR code.

    Args:
        value: The QR code value to encode
        x: X position in dots
        y: Y position in dots
        magnification: Size multiplier (1-10)
    """
    # ^BQN,2,{magnification}^FDMA,{data}^FS
    return f"^FO{x},{y}^BQN,2,{magnification}^FDMA,{value}^FS"


def generate_label_zpl(
    asset: dict,
    label_type: str,
    include_name: bool,
    include_category: bool,
    label_size: str = "2x1",
    custom_width_mm: float = None,
    custom_height_mm: float = None,
    barcode_format: str = "CODE128"
) -> str:
    """Generate ZPL commands for a single asset label.

    Returns complete ZPL for one label including ^XA (start) and ^XZ (end).
    """
    # Get label dimensions
    if label_size == "custom" and custom_width_mm and custom_height_mm:
        # Convert mm to dots at 203 DPI (8 dots per mm)
        width = int(custom_width_mm * 8)
        height = int(custom_height_mm * 8)
    else:
        size = ZPL_LABEL_SIZES.get(label_size, ZPL_LABEL_SIZES["2x1"])
        width = size["width"]
        height = size["height"]

    # Start ZPL label
    zpl = f"^XA\n"
    zpl += f"^PW{width}\n"  # Print width
    zpl += f"^LL{height}\n"  # Label length

    y_pos = 10
    qr_width = 80 if label_size == "2x1" else (60 if label_size == "1.5x0.5" else 120)

    # Barcode (left side)
    if label_type in ["barcode", "both"] and asset.get("barcode"):
        barcode_height = 60 if label_size == "3x2" else (40 if label_size == "2x1" else 25)
        zpl += f"^FO20,{y_pos}^BCN,{barcode_height},Y,N,N^FD{asset['barcode']}^FS\n"
        y_pos += barcode_height + 15

    # QR code (right side)
    if label_type in ["qr", "both"] and asset.get("qr_code"):
        qr_x = width - qr_width - 10
        qr_mag = 4 if label_size == "2x1" else (3 if label_size == "1.5x0.5" else 5)
        zpl += f"^FO{qr_x},10^BQN,2,{qr_mag}^FDMA,{asset['qr_code']}^FS\n"

    # Asset name
    if include_name and asset.get("name"):
        name = asset["name"][:25]  # Truncate for label
        font_size = 28 if label_size == "3x2" else (22 if label_size == "2x1" else 16)
        zpl += f"^FO20,{y_pos}^A0N,{font_size},{font_size}^FD{name}^FS\n"
        y_pos += font_size + 4

    # Internal ID (always shown)
    id_font_size = 24 if label_size == "3x2" else (20 if label_size == "2x1" else 14)
    zpl += f"^FO20,{y_pos}^A0N,{id_font_size},{id_font_size}^FD{asset.get('internal_id', '')}^FS\n"
    y_pos += id_font_size + 4

    # Category
    if include_category and asset.get("category_name"):
        cat_font_size = 20 if label_size == "3x2" else (16 if label_size == "2x1" else 12)
        zpl += f"^FO20,{y_pos}^A0N,{cat_font_size},{cat_font_size}^FD{asset.get('category_name', '')}^FS\n"

    # End label
    zpl += "^XZ\n"

    return zpl


# ============================================================================
# LABEL ENDPOINTS
# ============================================================================

@router.get("/asset/{asset_id}/barcode")
async def get_asset_barcode(
    asset_id: str,
    format: str = Query("svg", enum=["svg", "png"]),
    user=Depends(get_current_user)
):
    """Get barcode for an asset."""
    profile_id = get_profile_id(user)

    asset = gear_service.get_asset(asset_id)
    if not asset:
        raise HTTPException(status_code=404, detail="Asset not found")

    require_org_access(asset["organization_id"], profile_id)

    if not asset.get("barcode"):
        raise HTTPException(status_code=404, detail="Asset has no barcode")

    # Get org settings for barcode format
    org = gear_service.get_organization(asset["organization_id"])
    barcode_format = org.get("barcode_format", "CODE128") if org else "CODE128"

    svg = generate_barcode_svg(asset["barcode"], barcode_format)

    if format == "svg":
        return Response(content=svg, media_type="image/svg+xml")
    else:
        # For PNG, we'd need additional libraries (Pillow, cairosvg)
        # For now, return SVG with a note
        return Response(content=svg, media_type="image/svg+xml")


@router.get("/asset/{asset_id}/qr")
async def get_asset_qr(
    asset_id: str,
    format: str = Query("svg", enum=["svg", "png"]),
    user=Depends(get_current_user)
):
    """Get QR code for an asset."""
    profile_id = get_profile_id(user)

    asset = gear_service.get_asset(asset_id)
    if not asset:
        raise HTTPException(status_code=404, detail="Asset not found")

    require_org_access(asset["organization_id"], profile_id)

    qr_value = asset.get("qr_code") or f"GH:{asset.get('internal_id')}"
    svg = generate_qr_svg(qr_value)

    return Response(content=svg, media_type="image/svg+xml")


@router.get("/asset/{asset_id}/label")
async def get_asset_label(
    asset_id: str,
    label_type: str = Query("both", enum=["barcode", "qr", "both"]),
    include_name: bool = Query(True),
    include_category: bool = Query(True),
    user=Depends(get_current_user)
):
    """Get printable label HTML for an asset."""
    profile_id = get_profile_id(user)

    asset = gear_service.get_asset(asset_id)
    if not asset:
        raise HTTPException(status_code=404, detail="Asset not found")

    require_org_access(asset["organization_id"], profile_id)

    html = f'''
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <title>Label - {asset.get("internal_id")}</title>
        <style>
            @media print {{
                body {{ margin: 0; }}
                .label {{ border: none !important; }}
            }}
        </style>
    </head>
    <body>
        {generate_label_html(asset, label_type, include_name, include_category)}
    </body>
    </html>
    '''

    return Response(content=html, media_type="text/html")


@router.post("/{org_id}/batch")
async def generate_label_batch(
    org_id: str,
    data: LabelBatchRequest,
    user=Depends(get_current_user)
):
    """Generate a batch of labels as a printable HTML page.

    Supports two print modes:
    - sheet: Grid layout for sheet printers (configurable rows/columns)
    - roll: Continuous layout for thermal/roll printers
    """
    profile_id = get_profile_id(user)
    require_org_access(org_id, profile_id, ["owner", "admin", "manager"])

    # Get all assets
    assets = []
    for asset_id in data.asset_ids:
        asset = gear_service.get_asset(asset_id)
        if asset and asset.get("organization_id") == org_id:
            assets.append(asset)

    if not assets:
        raise HTTPException(status_code=404, detail="No valid assets found")

    # Get size configuration
    if data.label_size == "custom" and data.custom_width_mm and data.custom_height_mm:
        label_width = f"{data.custom_width_mm}mm"
        label_height = f"{data.custom_height_mm}mm"
    else:
        size_config = LABEL_SIZES.get(data.label_size, LABEL_SIZES["2x1"])
        label_width = size_config["width"]
        label_height = size_config["height"]

    # Generate labels HTML
    labels_html = ""
    for asset in assets:
        labels_html += generate_label_html(
            asset,
            data.label_type,
            data.include_name,
            data.include_category,
            data.label_size,
            data.custom_width_mm,
            data.custom_height_mm,
            include_internal_id=data.include_internal_id,
            include_serial_number=data.include_serial_number,
            include_manufacturer=data.include_manufacturer,
            include_model=data.include_model,
            include_purchase_date=data.include_purchase_date,
            include_logo=data.include_logo,
            color_coding_enabled=data.color_coding_enabled
        )

    # Build CSS based on print mode
    if data.print_mode == "roll":
        # Roll mode: continuous printing for thermal printers
        css = f'''
            @page {{
                size: {label_width} {label_height};
                margin: 0;
            }}
            body {{
                margin: 0;
                padding: 0;
            }}
            .label-container {{
                display: block;
            }}
            .label {{
                display: block !important;
                margin: 0 !important;
                page-break-after: always;
                border: none !important;
            }}
            .label:last-child {{
                page-break-after: auto;
            }}
            @media print {{
                .label {{ border: none !important; }}
            }}
        '''
    else:
        # Sheet mode: grid layout for sheet printers
        columns = data.sheet_columns or 3
        css = f'''
            @page {{
                size: letter;
                margin: 0.5in;
            }}
            body {{
                margin: 0;
                padding: 0;
            }}
            .label-container {{
                display: grid;
                grid-template-columns: repeat({columns}, {label_width});
                gap: 0.1in;
                justify-content: start;
            }}
            .label {{
                margin: 0 !important;
            }}
            @media print {{
                .label {{ border: none !important; }}
            }}
        '''

    html = f'''
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <title>Label Batch - {len(assets)} Labels</title>
        <style>
            {css}
        </style>
    </head>
    <body>
        <div class="label-container">
            {labels_html}
        </div>
    </body>
    </html>
    '''

    return Response(content=html, media_type="text/html")


@router.post("/{org_id}/batch/zpl")
async def generate_label_batch_zpl(
    org_id: str,
    data: LabelBatchRequest,
    user=Depends(get_current_user)
):
    """Generate a batch of labels in ZPL format for Zebra printers.

    Returns raw ZPL commands that can be sent directly to a Zebra printer
    or copied to Zebra printer software.
    """
    profile_id = get_profile_id(user)
    require_org_access(org_id, profile_id, ["owner", "admin", "manager"])

    # Get organization settings for barcode format
    org = gear_service.get_organization(org_id)
    barcode_format = org.get("barcode_format", "CODE128") if org else "CODE128"

    # Get all assets
    assets = []
    for asset_id in data.asset_ids:
        asset = gear_service.get_asset(asset_id)
        if asset and asset.get("organization_id") == org_id:
            assets.append(asset)

    if not assets:
        raise HTTPException(status_code=404, detail="No valid assets found")

    # Generate ZPL for all labels
    zpl_output = ""
    for asset in assets:
        zpl_output += generate_label_zpl(
            asset,
            data.label_type,
            data.include_name,
            data.include_category,
            data.label_size,
            data.custom_width_mm,
            data.custom_height_mm,
            barcode_format
        )

    return Response(
        content=zpl_output,
        media_type="text/plain",
        headers={"Content-Disposition": f"attachment; filename=labels_{len(assets)}.zpl"}
    )


@router.post("/{org_id}/generate-codes")
async def generate_codes_for_assets(
    org_id: str,
    asset_ids: List[str],
    user=Depends(get_current_user)
):
    """Generate/regenerate barcode and QR codes for specified assets."""
    profile_id = get_profile_id(user)
    require_org_access(org_id, profile_id, ["owner", "admin", "manager"])

    from app.core.database import execute_update

    updated = []
    for asset_id in asset_ids:
        asset = gear_service.get_asset(asset_id)
        if asset and asset.get("organization_id") == org_id:
            internal_id = asset.get("internal_id")

            # Generate codes
            barcode = internal_id
            qr_code = f"GH:{internal_id}"

            execute_update(
                """
                UPDATE gear_assets
                SET barcode = :barcode, qr_code = :qr, primary_scan_code = :barcode
                WHERE id = :asset_id
                """,
                {"asset_id": asset_id, "barcode": barcode, "qr": qr_code}
            )

            updated.append({
                "asset_id": asset_id,
                "internal_id": internal_id,
                "barcode": barcode,
                "qr_code": qr_code
            })

    return {"updated": updated, "count": len(updated)}


# ============================================================================
# KIT LABELS
# ============================================================================

@router.get("/kit/{kit_id}/label")
async def get_kit_label(
    kit_id: str,
    include_contents: bool = Query(False),
    user=Depends(get_current_user)
):
    """Get printable label for a kit."""
    profile_id = get_profile_id(user)

    kit = gear_service.get_kit_instance(kit_id)
    if not kit:
        raise HTTPException(status_code=404, detail="Kit not found")

    require_org_access(kit["organization_id"], profile_id)

    qr_value = f"GHKIT:{kit.get('internal_id')}"
    qr_svg = generate_qr_svg(qr_value)

    contents_list = ""
    if include_contents and kit.get("contents"):
        items = [c.get("asset_name", "Unknown") for c in kit.get("contents", []) if c.get("is_present")]
        contents_list = "<ul style='font-size: 6pt; margin: 2px 0; padding-left: 12px;'>"
        for item in items[:10]:  # Limit to 10 items
            contents_list += f"<li>{item}</li>"
        if len(items) > 10:
            contents_list += f"<li>... +{len(items) - 10} more</li>"
        contents_list += "</ul>"

    html = f'''
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <title>Kit Label - {kit.get("internal_id")}</title>
    </head>
    <body style="font-family: sans-serif; font-size: 10pt;">
        <div style="width: 3in; padding: 8px; border: 1px dashed #ccc;">
            <div style="display: flex; justify-content: space-between;">
                <div>
                    <div style="font-weight: bold; font-size: 12pt;">{kit.get("name")}</div>
                    <div style="font-family: monospace;">{kit.get("internal_id")}</div>
                    {f'<div style="color: #666;">{kit.get("template_name")}</div>' if kit.get("template_name") else ''}
                </div>
                <div style="width: 80px; height: 80px;">{qr_svg}</div>
            </div>
            {contents_list}
        </div>
    </body>
    </html>
    '''

    return Response(content=html, media_type="text/html")


# ============================================================================
# LABEL TEMPLATES
# ============================================================================

class LabelTemplateCreate(BaseModel):
    name: str
    description: Optional[str] = None
    is_default: bool = False
    label_size: str = "2x1"
    print_mode: str = "sheet"
    printer_type: str = "generic"
    code_type: str = "both"
    sheet_rows: int = 10
    sheet_columns: int = 3
    custom_width_mm: Optional[float] = None
    custom_height_mm: Optional[float] = None
    include_name: bool = True
    include_category: bool = True
    include_internal_id: bool = True
    include_serial_number: bool = False
    include_manufacturer: bool = False
    include_model: bool = False
    include_purchase_date: bool = False
    include_logo: bool = False
    custom_logo_url: Optional[str] = None
    color_coding_enabled: bool = False
    kit_include_contents: bool = False
    kit_contents_max_items: int = 5
    is_org_template: bool = False  # If true, creates org-level template


class LabelTemplateUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    is_default: Optional[bool] = None
    label_size: Optional[str] = None
    print_mode: Optional[str] = None
    printer_type: Optional[str] = None
    code_type: Optional[str] = None
    sheet_rows: Optional[int] = None
    sheet_columns: Optional[int] = None
    custom_width_mm: Optional[float] = None
    custom_height_mm: Optional[float] = None
    include_name: Optional[bool] = None
    include_category: Optional[bool] = None
    include_internal_id: Optional[bool] = None
    include_serial_number: Optional[bool] = None
    include_manufacturer: Optional[bool] = None
    include_model: Optional[bool] = None
    include_purchase_date: Optional[bool] = None
    include_logo: Optional[bool] = None
    custom_logo_url: Optional[str] = None
    color_coding_enabled: Optional[bool] = None
    kit_include_contents: Optional[bool] = None
    kit_contents_max_items: Optional[int] = None


@router.get("/{org_id}/templates")
async def list_label_templates(
    org_id: str,
    include_org_templates: bool = Query(True),
    user=Depends(get_current_user)
):
    """List label templates for a user and optionally org-level templates."""
    from app.core.database import execute_query

    profile_id = get_profile_id(user)
    require_org_access(org_id, profile_id)

    # Get user templates + optionally org templates
    if include_org_templates:
        templates = execute_query(
            """
            SELECT * FROM gear_label_templates
            WHERE organization_id = :org_id
            AND (user_id = :user_id OR user_id IS NULL)
            ORDER BY user_id NULLS LAST, is_default DESC, name
            """,
            {"org_id": org_id, "user_id": profile_id}
        )
    else:
        templates = execute_query(
            """
            SELECT * FROM gear_label_templates
            WHERE organization_id = :org_id AND user_id = :user_id
            ORDER BY is_default DESC, name
            """,
            {"org_id": org_id, "user_id": profile_id}
        )

    return {"templates": templates or []}


@router.post("/{org_id}/templates")
async def create_label_template(
    org_id: str,
    data: LabelTemplateCreate,
    user=Depends(get_current_user)
):
    """Create a new label template."""
    from app.core.database import execute_insert, execute_update

    profile_id = get_profile_id(user)

    # Org templates require admin/manager role
    if data.is_org_template:
        require_org_access(org_id, profile_id, ["owner", "admin", "manager"])
    else:
        require_org_access(org_id, profile_id)

    # If setting as default, unset other defaults
    if data.is_default:
        if data.is_org_template:
            execute_update(
                """
                UPDATE gear_label_templates
                SET is_default = FALSE
                WHERE organization_id = :org_id AND user_id IS NULL AND is_default = TRUE
                """,
                {"org_id": org_id}
            )
        else:
            execute_update(
                """
                UPDATE gear_label_templates
                SET is_default = FALSE
                WHERE organization_id = :org_id AND user_id = :user_id AND is_default = TRUE
                """,
                {"org_id": org_id, "user_id": profile_id}
            )

    template = execute_insert(
        """
        INSERT INTO gear_label_templates (
            organization_id, user_id, name, description, is_default,
            label_size, print_mode, printer_type, code_type,
            sheet_rows, sheet_columns, custom_width_mm, custom_height_mm,
            include_name, include_category, include_internal_id,
            include_serial_number, include_manufacturer, include_model,
            include_purchase_date, include_logo, custom_logo_url,
            color_coding_enabled, kit_include_contents, kit_contents_max_items
        ) VALUES (
            :org_id, :user_id, :name, :description, :is_default,
            :label_size, :print_mode, :printer_type, :code_type,
            :sheet_rows, :sheet_columns, :custom_width_mm, :custom_height_mm,
            :include_name, :include_category, :include_internal_id,
            :include_serial_number, :include_manufacturer, :include_model,
            :include_purchase_date, :include_logo, :custom_logo_url,
            :color_coding_enabled, :kit_include_contents, :kit_contents_max_items
        ) RETURNING *
        """,
        {
            "org_id": org_id,
            "user_id": None if data.is_org_template else profile_id,
            "name": data.name,
            "description": data.description,
            "is_default": data.is_default,
            "label_size": data.label_size,
            "print_mode": data.print_mode,
            "printer_type": data.printer_type,
            "code_type": data.code_type,
            "sheet_rows": data.sheet_rows,
            "sheet_columns": data.sheet_columns,
            "custom_width_mm": data.custom_width_mm,
            "custom_height_mm": data.custom_height_mm,
            "include_name": data.include_name,
            "include_category": data.include_category,
            "include_internal_id": data.include_internal_id,
            "include_serial_number": data.include_serial_number,
            "include_manufacturer": data.include_manufacturer,
            "include_model": data.include_model,
            "include_purchase_date": data.include_purchase_date,
            "include_logo": data.include_logo,
            "custom_logo_url": data.custom_logo_url,
            "color_coding_enabled": data.color_coding_enabled,
            "kit_include_contents": data.kit_include_contents,
            "kit_contents_max_items": data.kit_contents_max_items
        }
    )

    return {"template": template}


@router.get("/templates/{template_id}")
async def get_label_template(
    template_id: str,
    user=Depends(get_current_user)
):
    """Get a specific label template."""
    from app.core.database import execute_single

    profile_id = get_profile_id(user)

    template = execute_single(
        "SELECT * FROM gear_label_templates WHERE id = :id",
        {"id": template_id}
    )

    if not template:
        raise HTTPException(status_code=404, detail="Template not found")

    require_org_access(template["organization_id"], profile_id)

    return {"template": template}


@router.put("/templates/{template_id}")
async def update_label_template(
    template_id: str,
    data: LabelTemplateUpdate,
    user=Depends(get_current_user)
):
    """Update a label template."""
    from app.core.database import execute_single, execute_update

    profile_id = get_profile_id(user)

    template = execute_single(
        "SELECT * FROM gear_label_templates WHERE id = :id",
        {"id": template_id}
    )

    if not template:
        raise HTTPException(status_code=404, detail="Template not found")

    # Check access - user can edit their own, admins can edit org templates
    if template["user_id"] is None:
        # Org template - requires admin
        require_org_access(template["organization_id"], profile_id, ["owner", "admin", "manager"])
    elif template["user_id"] != profile_id:
        raise HTTPException(status_code=403, detail="Cannot edit another user's template")
    else:
        require_org_access(template["organization_id"], profile_id)

    # Build update fields
    update_data = data.model_dump(exclude_unset=True)
    if not update_data:
        return {"template": template}

    # If setting as default, unset other defaults
    if update_data.get("is_default"):
        if template["user_id"] is None:
            execute_update(
                """
                UPDATE gear_label_templates
                SET is_default = FALSE
                WHERE organization_id = :org_id AND user_id IS NULL AND is_default = TRUE AND id != :template_id
                """,
                {"org_id": template["organization_id"], "template_id": template_id}
            )
        else:
            execute_update(
                """
                UPDATE gear_label_templates
                SET is_default = FALSE
                WHERE organization_id = :org_id AND user_id = :user_id AND is_default = TRUE AND id != :template_id
                """,
                {"org_id": template["organization_id"], "user_id": template["user_id"], "template_id": template_id}
            )

    # Build SET clause
    set_parts = [f"{k} = :{k}" for k in update_data.keys()]
    set_parts.append("updated_at = NOW()")
    update_data["id"] = template_id

    updated = execute_single(
        f"""
        UPDATE gear_label_templates
        SET {', '.join(set_parts)}
        WHERE id = :id
        RETURNING *
        """,
        update_data
    )

    return {"template": updated}


@router.delete("/templates/{template_id}")
async def delete_label_template(
    template_id: str,
    user=Depends(get_current_user)
):
    """Delete a label template."""
    from app.core.database import execute_single, execute_update

    profile_id = get_profile_id(user)

    template = execute_single(
        "SELECT * FROM gear_label_templates WHERE id = :id",
        {"id": template_id}
    )

    if not template:
        raise HTTPException(status_code=404, detail="Template not found")

    # Check access
    if template["user_id"] is None:
        require_org_access(template["organization_id"], profile_id, ["owner", "admin", "manager"])
    elif template["user_id"] != profile_id:
        raise HTTPException(status_code=403, detail="Cannot delete another user's template")
    else:
        require_org_access(template["organization_id"], profile_id)

    execute_update(
        "DELETE FROM gear_label_templates WHERE id = :id",
        {"id": template_id}
    )

    return {"success": True}


# ============================================================================
# PRINT QUEUE
# ============================================================================

class PrintQueueAdd(BaseModel):
    asset_ids: Optional[List[str]] = None
    kit_ids: Optional[List[str]] = None
    quantity: int = 1
    template_id: Optional[str] = None
    include_kit_contents: bool = False


class PrintQueueUpdate(BaseModel):
    quantity: Optional[int] = None
    template_id: Optional[str] = None
    include_kit_contents: Optional[bool] = None


@router.get("/{org_id}/queue")
async def get_print_queue(
    org_id: str,
    user=Depends(get_current_user)
):
    """Get user's print queue with item details."""
    from app.core.database import execute_query

    profile_id = get_profile_id(user)
    require_org_access(org_id, profile_id)

    # Get queue items with asset/kit details
    queue_items = execute_query(
        """
        SELECT
            q.*,
            a.name as asset_name,
            a.internal_id as asset_internal_id,
            a.barcode as asset_barcode,
            a.qr_code as asset_qr_code,
            a.category_id as asset_category_id,
            c.name as asset_category_name,
            k.name as kit_name,
            k.internal_id as kit_internal_id,
            k.barcode as kit_barcode,
            k.qr_code as kit_qr_code,
            t.name as template_name
        FROM gear_print_queue q
        LEFT JOIN gear_assets a ON q.asset_id = a.id
        LEFT JOIN gear_categories c ON a.category_id = c.id
        LEFT JOIN gear_kit_instances k ON q.kit_id = k.id
        LEFT JOIN gear_label_templates t ON q.template_id = t.id
        WHERE q.organization_id = :org_id AND q.user_id = :user_id
        ORDER BY q.added_at DESC
        """,
        {"org_id": org_id, "user_id": profile_id}
    )

    return {"queue": queue_items or [], "count": len(queue_items or [])}


@router.post("/{org_id}/queue")
async def add_to_print_queue(
    org_id: str,
    data: PrintQueueAdd,
    user=Depends(get_current_user)
):
    """Add assets or kits to print queue."""
    from app.core.database import execute_insert, execute_query

    profile_id = get_profile_id(user)
    require_org_access(org_id, profile_id)

    added = []

    # Add assets
    if data.asset_ids:
        for asset_id in data.asset_ids:
            asset = gear_service.get_asset(asset_id)
            if asset and asset.get("organization_id") == org_id:
                try:
                    item = execute_insert(
                        """
                        INSERT INTO gear_print_queue (
                            organization_id, user_id, asset_id, quantity, template_id
                        ) VALUES (
                            :org_id, :user_id, :asset_id, :quantity, :template_id
                        )
                        ON CONFLICT (user_id, asset_id) DO UPDATE
                        SET quantity = gear_print_queue.quantity + :quantity
                        RETURNING *
                        """,
                        {
                            "org_id": org_id,
                            "user_id": profile_id,
                            "asset_id": asset_id,
                            "quantity": data.quantity,
                            "template_id": data.template_id
                        }
                    )
                    added.append({"type": "asset", "id": asset_id, "name": asset.get("name")})
                except Exception as e:
                    pass  # Skip if already in queue (constraint error)

    # Add kits
    if data.kit_ids:
        for kit_id in data.kit_ids:
            kit = gear_service.get_kit_instance(kit_id)
            if kit and kit.get("organization_id") == org_id:
                try:
                    item = execute_insert(
                        """
                        INSERT INTO gear_print_queue (
                            organization_id, user_id, kit_id, quantity, template_id, include_kit_contents
                        ) VALUES (
                            :org_id, :user_id, :kit_id, :quantity, :template_id, :include_kit_contents
                        )
                        ON CONFLICT (user_id, kit_id) DO UPDATE
                        SET quantity = gear_print_queue.quantity + :quantity,
                            include_kit_contents = :include_kit_contents
                        RETURNING *
                        """,
                        {
                            "org_id": org_id,
                            "user_id": profile_id,
                            "kit_id": kit_id,
                            "quantity": data.quantity,
                            "template_id": data.template_id,
                            "include_kit_contents": data.include_kit_contents
                        }
                    )
                    added.append({"type": "kit", "id": kit_id, "name": kit.get("name")})
                except Exception as e:
                    pass

    return {"added": added, "count": len(added)}


@router.put("/{org_id}/queue/{item_id}")
async def update_queue_item(
    org_id: str,
    item_id: str,
    data: PrintQueueUpdate,
    user=Depends(get_current_user)
):
    """Update a queue item's settings."""
    from app.core.database import execute_single, execute_update

    profile_id = get_profile_id(user)
    require_org_access(org_id, profile_id)

    # Verify ownership
    item = execute_single(
        "SELECT * FROM gear_print_queue WHERE id = :id AND user_id = :user_id",
        {"id": item_id, "user_id": profile_id}
    )

    if not item:
        raise HTTPException(status_code=404, detail="Queue item not found")

    update_data = data.model_dump(exclude_unset=True)
    if not update_data:
        return {"item": item}

    set_parts = [f"{k} = :{k}" for k in update_data.keys()]
    update_data["id"] = item_id

    updated = execute_single(
        f"""
        UPDATE gear_print_queue
        SET {', '.join(set_parts)}
        WHERE id = :id
        RETURNING *
        """,
        update_data
    )

    return {"item": updated}


@router.delete("/{org_id}/queue/{item_id}")
async def remove_from_queue(
    org_id: str,
    item_id: str,
    user=Depends(get_current_user)
):
    """Remove an item from the print queue."""
    from app.core.database import execute_update

    profile_id = get_profile_id(user)
    require_org_access(org_id, profile_id)

    execute_update(
        "DELETE FROM gear_print_queue WHERE id = :id AND user_id = :user_id",
        {"id": item_id, "user_id": profile_id}
    )

    return {"success": True}


@router.delete("/{org_id}/queue")
async def clear_print_queue(
    org_id: str,
    user=Depends(get_current_user)
):
    """Clear entire print queue for user."""
    from app.core.database import execute_update

    profile_id = get_profile_id(user)
    require_org_access(org_id, profile_id)

    execute_update(
        "DELETE FROM gear_print_queue WHERE organization_id = :org_id AND user_id = :user_id",
        {"org_id": org_id, "user_id": profile_id}
    )

    return {"success": True}


@router.post("/{org_id}/queue/print")
async def print_queue(
    org_id: str,
    settings: Optional[PrintQueueSettings] = None,
    template_id: Optional[str] = Query(None),
    output_format: str = Query("html", enum=["html", "zpl"]),
    auto_generate_codes: bool = Query(True),
    user=Depends(get_current_user)
):
    """Print all items in queue and record in history.

    Accepts optional PrintQueueSettings in request body to override template defaults.
    """
    from app.core.database import execute_query, execute_insert, execute_update

    profile_id = get_profile_id(user)
    require_org_access(org_id, profile_id, ["owner", "admin", "manager"])

    # Get queue items with details
    queue_items = execute_query(
        """
        SELECT
            q.*,
            a.id as asset_id,
            a.name as asset_name,
            a.internal_id as asset_internal_id,
            a.barcode as asset_barcode,
            a.qr_code as asset_qr_code,
            a.category_id as asset_category_id,
            a.make as asset_make,
            a.model as asset_model,
            a.manufacturer_serial as asset_serial,
            a.purchase_date as asset_purchase_date,
            c.name as asset_category_name,
            c.color as category_color,
            k.id as kit_id,
            k.name as kit_name,
            k.internal_id as kit_internal_id,
            k.barcode as kit_barcode,
            k.qr_code as kit_qr_code
        FROM gear_print_queue q
        LEFT JOIN gear_assets a ON q.asset_id = a.id
        LEFT JOIN gear_categories c ON a.category_id = c.id
        LEFT JOIN gear_kit_instances k ON q.kit_id = k.id
        WHERE q.organization_id = :org_id AND q.user_id = :user_id
        ORDER BY q.added_at
        """,
        {"org_id": org_id, "user_id": profile_id}
    )

    if not queue_items:
        raise HTTPException(status_code=400, detail="Print queue is empty")

    # Get template settings
    template = None
    if template_id:
        from app.core.database import execute_single
        template = execute_single(
            "SELECT * FROM gear_label_templates WHERE id = :id",
            {"id": template_id}
        )

    # Default settings (template -> then override with request settings if provided)
    def get_setting(key, default, template_key=None):
        """Get setting: use request override, then template, then default."""
        template_key = template_key or key
        if settings and getattr(settings, key, None) is not None:
            return getattr(settings, key)
        if template:
            return template.get(template_key, default)
        return default

    label_type = get_setting("label_type", "both", "code_type")
    include_name = get_setting("include_name", True)
    include_category = get_setting("include_category", True)
    include_internal_id = get_setting("include_internal_id", True)
    include_serial_number = get_setting("include_serial_number", False)
    include_manufacturer = get_setting("include_manufacturer", False)
    include_model = get_setting("include_model", False)
    include_purchase_date = get_setting("include_purchase_date", False)
    include_logo = get_setting("include_logo", False)
    color_coding_enabled = get_setting("color_coding_enabled", False)
    label_size = get_setting("label_size", "2x1")
    print_mode = get_setting("print_mode", "sheet")
    printer_type = get_setting("printer_type", "generic")
    sheet_rows = get_setting("sheet_rows", 10)
    sheet_columns = get_setting("sheet_columns", 3)
    custom_width_mm = get_setting("custom_width_mm", None)
    custom_height_mm = get_setting("custom_height_mm", None)

    # Auto-generate codes for items without them
    codes_generated = []
    if auto_generate_codes:
        for item in queue_items:
            if item.get("asset_id") and not item.get("asset_barcode"):
                internal_id = item.get("asset_internal_id")
                barcode = internal_id
                qr_code = f"GH:{internal_id}"
                execute_update(
                    """
                    UPDATE gear_assets
                    SET barcode = :barcode, qr_code = :qr, primary_scan_code = :barcode
                    WHERE id = :asset_id
                    """,
                    {"asset_id": item["asset_id"], "barcode": barcode, "qr": qr_code}
                )
                item["asset_barcode"] = barcode
                item["asset_qr_code"] = qr_code
                codes_generated.append({"id": item["asset_id"], "barcode": barcode, "qr_code": qr_code})

            if item.get("kit_id") and not item.get("kit_barcode"):
                internal_id = item.get("kit_internal_id")
                barcode = internal_id
                qr_code = f"GHKIT:{internal_id}"
                execute_update(
                    """
                    UPDATE gear_kit_instances
                    SET barcode = :barcode, qr_code = :qr, primary_scan_code = :barcode
                    WHERE id = :kit_id
                    """,
                    {"kit_id": item["kit_id"], "barcode": barcode, "qr": qr_code}
                )
                item["kit_barcode"] = barcode
                item["kit_qr_code"] = qr_code
                codes_generated.append({"id": item["kit_id"], "barcode": barcode, "qr_code": qr_code})

    # Build printable items
    printable_items = []
    for item in queue_items:
        for _ in range(item.get("quantity", 1)):
            if item.get("asset_id"):
                printable_items.append({
                    "type": "asset",
                    "name": item.get("asset_name"),
                    "internal_id": item.get("asset_internal_id"),
                    "barcode": item.get("asset_barcode"),
                    "qr_code": item.get("asset_qr_code"),
                    "category_name": item.get("asset_category_name"),
                    "category_color": item.get("category_color"),
                    "manufacturer": item.get("asset_make"),
                    "model": item.get("asset_model"),
                    "serial_number": item.get("asset_serial"),
                    "purchase_date": str(item.get("asset_purchase_date")) if item.get("asset_purchase_date") else None
                })
            elif item.get("kit_id"):
                printable_items.append({
                    "type": "kit",
                    "name": item.get("kit_name"),
                    "internal_id": item.get("kit_internal_id"),
                    "barcode": item.get("kit_barcode"),
                    "qr_code": item.get("kit_qr_code"),
                    "include_contents": item.get("include_kit_contents", False)
                })

    # Record print history
    for item in queue_items:
        execute_insert(
            """
            INSERT INTO gear_label_print_history (
                organization_id, user_id, asset_id, kit_id,
                item_name, item_internal_id, item_type, item_category,
                template_id, template_name, label_size, print_mode, printer_type, code_type,
                quantity, included_kit_contents,
                barcode_generated, qr_code_generated
            ) VALUES (
                :org_id, :user_id, :asset_id, :kit_id,
                :item_name, :item_internal_id, :item_type, :item_category,
                :template_id, :template_name, :label_size, :print_mode, :printer_type, :code_type,
                :quantity, :included_kit_contents,
                :barcode_generated, :qr_code_generated
            )
            """,
            {
                "org_id": org_id,
                "user_id": profile_id,
                "asset_id": item.get("asset_id"),
                "kit_id": item.get("kit_id"),
                "item_name": item.get("asset_name") or item.get("kit_name"),
                "item_internal_id": item.get("asset_internal_id") or item.get("kit_internal_id"),
                "item_type": "asset" if item.get("asset_id") else "kit",
                "item_category": item.get("asset_category_name"),
                "template_id": template_id,
                "template_name": template.get("name") if template else None,
                "label_size": label_size,
                "print_mode": print_mode,
                "printer_type": printer_type,
                "code_type": label_type,
                "quantity": item.get("quantity", 1),
                "included_kit_contents": item.get("include_kit_contents", False),
                "barcode_generated": next((c["barcode"] for c in codes_generated if c["id"] == (item.get("asset_id") or item.get("kit_id"))), None),
                "qr_code_generated": next((c["qr_code"] for c in codes_generated if c["id"] == (item.get("asset_id") or item.get("kit_id"))), None)
            }
        )

    # Clear the queue
    execute_update(
        "DELETE FROM gear_print_queue WHERE organization_id = :org_id AND user_id = :user_id",
        {"org_id": org_id, "user_id": profile_id}
    )

    # Generate output
    if output_format == "zpl":
        org = gear_service.get_organization(org_id)
        barcode_format = org.get("barcode_format", "CODE128") if org else "CODE128"

        zpl_output = ""
        for item in printable_items:
            zpl_output += generate_label_zpl(
                item,
                label_type,
                include_name,
                include_category,
                label_size,
                barcode_format=barcode_format
            )

        return Response(
            content=zpl_output,
            media_type="text/plain",
            headers={"Content-Disposition": f"attachment; filename=queue_labels_{len(printable_items)}.zpl"}
        )
    else:
        # Generate HTML
        labels_html = ""
        for item in printable_items:
            labels_html += generate_label_html(
                item,
                label_type,
                include_name,
                include_category,
                label_size,
                custom_width_mm,
                custom_height_mm,
                include_internal_id=include_internal_id,
                include_serial_number=include_serial_number,
                include_manufacturer=include_manufacturer,
                include_model=include_model,
                include_purchase_date=include_purchase_date,
                include_logo=include_logo,
                color_coding_enabled=color_coding_enabled
            )

        # Build page CSS
        size_config = LABEL_SIZES.get(label_size, LABEL_SIZES["2x1"])
        label_width = size_config["width"]
        label_height = size_config["height"]

        if print_mode == "roll":
            css = f'''
                @page {{ size: {label_width} {label_height}; margin: 0; }}
                body {{ margin: 0; padding: 0; }}
                .label-container {{ display: block; }}
                .label {{ display: block !important; margin: 0 !important; page-break-after: always; border: none !important; }}
                .label:last-child {{ page-break-after: auto; }}
                @media print {{ .label {{ border: none !important; }} }}
            '''
        else:
            css = f'''
                @page {{ size: letter; margin: 0.5in; }}
                body {{ margin: 0; padding: 0; }}
                .label-container {{ display: grid; grid-template-columns: repeat(3, {label_width}); gap: 0.1in; justify-content: start; }}
                .label {{ margin: 0 !important; }}
                @media print {{ .label {{ border: none !important; }} }}
            '''

        html = f'''
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="utf-8">
            <title>Queue Print - {len(printable_items)} Labels</title>
            <style>{css}</style>
        </head>
        <body>
            <div class="label-container">{labels_html}</div>
        </body>
        </html>
        '''

        return Response(content=html, media_type="text/html")


# ============================================================================
# PRINT HISTORY
# ============================================================================

@router.get("/{org_id}/history")
async def get_print_history(
    org_id: str,
    limit: int = Query(50, le=200),
    offset: int = Query(0),
    item_type: Optional[str] = Query(None, enum=["asset", "kit"]),
    user_id: Optional[str] = Query(None),
    user=Depends(get_current_user)
):
    """Get label print history with optional filters."""
    from app.core.database import execute_query

    profile_id = get_profile_id(user)
    require_org_access(org_id, profile_id)

    # Build query with filters
    where_parts = ["h.organization_id = :org_id"]
    params = {"org_id": org_id, "limit": limit, "offset": offset}

    if item_type:
        where_parts.append("h.item_type = :item_type")
        params["item_type"] = item_type

    if user_id:
        where_parts.append("h.user_id = :filter_user_id")
        params["filter_user_id"] = user_id

    history = execute_query(
        f"""
        SELECT
            h.*,
            p.display_name as printed_by_name,
            p.avatar_url as printed_by_avatar
        FROM gear_label_print_history h
        LEFT JOIN profiles p ON h.user_id = p.id
        WHERE {' AND '.join(where_parts)}
        ORDER BY h.printed_at DESC
        LIMIT :limit OFFSET :offset
        """,
        params
    )

    # Get total count
    count_result = execute_query(
        f"""
        SELECT COUNT(*) as total
        FROM gear_label_print_history h
        WHERE {' AND '.join(where_parts)}
        """,
        params
    )
    total = count_result[0]["total"] if count_result else 0

    return {
        "history": history or [],
        "total": total,
        "limit": limit,
        "offset": offset
    }


@router.get("/{org_id}/history/stats")
async def get_print_history_stats(
    org_id: str,
    user=Depends(get_current_user)
):
    """Get print history analytics/statistics."""
    from app.core.database import execute_query, execute_single

    profile_id = get_profile_id(user)
    require_org_access(org_id, profile_id)

    # Total prints
    totals = execute_single(
        """
        SELECT
            COUNT(*) as total_prints,
            SUM(quantity) as total_labels,
            COUNT(DISTINCT asset_id) as unique_assets,
            COUNT(DISTINCT kit_id) as unique_kits
        FROM gear_label_print_history
        WHERE organization_id = :org_id
        """,
        {"org_id": org_id}
    )

    # This month's prints
    this_month = execute_single(
        """
        SELECT
            COUNT(*) as prints,
            COALESCE(SUM(quantity), 0) as labels
        FROM gear_label_print_history
        WHERE organization_id = :org_id
        AND printed_at >= date_trunc('month', CURRENT_DATE)
        """,
        {"org_id": org_id}
    )

    # Most printed assets
    most_printed_assets = execute_query(
        """
        SELECT
            asset_id as id,
            item_name as name,
            item_internal_id as internal_id,
            COUNT(*) as print_count,
            SUM(quantity) as label_count
        FROM gear_label_print_history
        WHERE organization_id = :org_id AND asset_id IS NOT NULL
        GROUP BY asset_id, item_name, item_internal_id
        ORDER BY label_count DESC
        LIMIT 10
        """,
        {"org_id": org_id}
    )

    # Most printed kits
    most_printed_kits = execute_query(
        """
        SELECT
            kit_id as id,
            item_name as name,
            item_internal_id as internal_id,
            COUNT(*) as print_count,
            SUM(quantity) as label_count
        FROM gear_label_print_history
        WHERE organization_id = :org_id AND kit_id IS NOT NULL
        GROUP BY kit_id, item_name, item_internal_id
        ORDER BY label_count DESC
        LIMIT 10
        """,
        {"org_id": org_id}
    )

    # Prints by user
    by_user = execute_query(
        """
        SELECT
            h.user_id,
            p.display_name as name,
            COUNT(*) as print_count,
            SUM(h.quantity) as label_count
        FROM gear_label_print_history h
        LEFT JOIN profiles p ON h.user_id = p.id
        WHERE h.organization_id = :org_id
        GROUP BY h.user_id, p.display_name
        ORDER BY label_count DESC
        LIMIT 10
        """,
        {"org_id": org_id}
    )

    # Prints by day (last 30 days)
    by_day = execute_query(
        """
        SELECT
            DATE(printed_at) as date,
            COUNT(*) as print_count,
            SUM(quantity) as label_count
        FROM gear_label_print_history
        WHERE organization_id = :org_id
        AND printed_at >= CURRENT_DATE - INTERVAL '30 days'
        GROUP BY DATE(printed_at)
        ORDER BY date DESC
        """,
        {"org_id": org_id}
    )

    return {
        "total_prints": totals.get("total_prints", 0) if totals else 0,
        "total_labels": totals.get("total_labels", 0) if totals else 0,
        "unique_assets_printed": totals.get("unique_assets", 0) if totals else 0,
        "unique_kits_printed": totals.get("unique_kits", 0) if totals else 0,
        "this_month": {
            "prints": this_month.get("prints", 0) if this_month else 0,
            "labels": this_month.get("labels", 0) if this_month else 0
        },
        "most_printed_assets": most_printed_assets or [],
        "most_printed_kits": most_printed_kits or [],
        "prints_by_user": by_user or [],
        "prints_by_day": [
            {"date": str(d["date"]), "print_count": d["print_count"], "label_count": d["label_count"]}
            for d in (by_day or [])
        ]
    }


@router.post("/{org_id}/history/{history_id}/reprint")
async def reprint_from_history(
    org_id: str,
    history_id: str,
    output_format: str = Query("html", enum=["html", "zpl"]),
    user=Depends(get_current_user)
):
    """Reprint labels from a history entry."""
    from app.core.database import execute_single, execute_insert

    profile_id = get_profile_id(user)
    require_org_access(org_id, profile_id, ["owner", "admin", "manager"])

    # Get history entry
    history = execute_single(
        """
        SELECT h.*, a.barcode as current_barcode, a.qr_code as current_qr,
               k.barcode as kit_barcode, k.qr_code as kit_qr
        FROM gear_label_print_history h
        LEFT JOIN gear_assets a ON h.asset_id = a.id
        LEFT JOIN gear_kit_instances k ON h.kit_id = k.id
        WHERE h.id = :id AND h.organization_id = :org_id
        """,
        {"id": history_id, "org_id": org_id}
    )

    if not history:
        raise HTTPException(status_code=404, detail="History entry not found")

    # Build item for label generation
    item = {
        "name": history["item_name"],
        "internal_id": history["item_internal_id"],
        "barcode": history.get("current_barcode") or history.get("kit_barcode") or history.get("barcode_generated"),
        "qr_code": history.get("current_qr") or history.get("kit_qr") or history.get("qr_code_generated"),
        "category_name": history.get("item_category")
    }

    # Record the reprint
    execute_insert(
        """
        INSERT INTO gear_label_print_history (
            organization_id, user_id, asset_id, kit_id,
            item_name, item_internal_id, item_type, item_category,
            template_id, template_name, label_size, print_mode, printer_type, code_type,
            quantity, included_kit_contents
        ) VALUES (
            :org_id, :user_id, :asset_id, :kit_id,
            :item_name, :item_internal_id, :item_type, :item_category,
            :template_id, :template_name, :label_size, :print_mode, :printer_type, :code_type,
            :quantity, :included_kit_contents
        )
        """,
        {
            "org_id": org_id,
            "user_id": profile_id,
            "asset_id": history.get("asset_id"),
            "kit_id": history.get("kit_id"),
            "item_name": history["item_name"],
            "item_internal_id": history.get("item_internal_id"),
            "item_type": history["item_type"],
            "item_category": history.get("item_category"),
            "template_id": history.get("template_id"),
            "template_name": history.get("template_name"),
            "label_size": history["label_size"],
            "print_mode": history["print_mode"],
            "printer_type": history["printer_type"],
            "code_type": history["code_type"],
            "quantity": history["quantity"],
            "included_kit_contents": history.get("included_kit_contents", False)
        }
    )

    # Generate labels
    labels_output = []
    for _ in range(history["quantity"]):
        labels_output.append(item)

    if output_format == "zpl":
        org = gear_service.get_organization(org_id)
        barcode_format = org.get("barcode_format", "CODE128") if org else "CODE128"

        zpl_output = ""
        for item_data in labels_output:
            zpl_output += generate_label_zpl(
                item_data,
                history["code_type"],
                True,
                True,
                history["label_size"],
                barcode_format=barcode_format
            )

        return Response(
            content=zpl_output,
            media_type="text/plain",
            headers={"Content-Disposition": f"attachment; filename=reprint_{history['item_internal_id']}.zpl"}
        )
    else:
        labels_html = ""
        for item_data in labels_output:
            labels_html += generate_label_html(
                item_data,
                history["code_type"],
                history.get("include_name", True),
                history.get("include_category", True),
                history["label_size"],
                include_internal_id=history.get("include_internal_id", True),
                include_serial_number=history.get("include_serial_number", False),
                include_manufacturer=history.get("include_manufacturer", False),
                include_model=history.get("include_model", False),
                include_purchase_date=history.get("include_purchase_date", False),
                include_logo=history.get("include_logo", False),
                color_coding_enabled=history.get("color_coding_enabled", False)
            )

        html = f'''
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="utf-8">
            <title>Reprint - {history['item_name']}</title>
            <style>
                @page {{ size: letter; margin: 0.5in; }}
                body {{ margin: 0; padding: 0; }}
                .label-container {{ display: flex; flex-wrap: wrap; gap: 0.1in; }}
                @media print {{ .label {{ border: none !important; }} }}
            </style>
        </head>
        <body>
            <div class="label-container">{labels_html}</div>
        </body>
        </html>
        '''

        return Response(content=html, media_type="text/html")
