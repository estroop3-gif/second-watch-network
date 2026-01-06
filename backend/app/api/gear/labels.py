"""
Gear House Labels API

Endpoints for generating barcodes, QR codes, and label sheets.
"""
from typing import Optional, List
from io import BytesIO
import base64

from fastapi import APIRouter, HTTPException, Header, Query, Response
from pydantic import BaseModel

from app.core.auth import get_current_user_from_token
from app.api.users import get_profile_id_from_cognito_id
from app.services import gear_service

router = APIRouter(prefix="/labels", tags=["Gear Labels"])


# ============================================================================
# SCHEMAS
# ============================================================================

class LabelBatchRequest(BaseModel):
    asset_ids: List[str]
    label_type: str = "both"  # barcode, qr, both
    include_name: bool = True
    include_category: bool = True


# ============================================================================
# HELPER FUNCTIONS
# ============================================================================

async def get_current_profile_id(authorization: str = Header(None)) -> str:
    if not authorization:
        raise HTTPException(status_code=401, detail="Authorization required")
    user = await get_current_user_from_token(authorization)
    profile_id = get_profile_id_from_cognito_id(user["sub"])
    return profile_id or user["sub"]


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


def generate_label_html(asset: dict, label_type: str, include_name: bool, include_category: bool) -> str:
    """Generate HTML for a single asset label."""
    barcode_svg = ""
    qr_svg = ""

    if label_type in ["barcode", "both"] and asset.get("barcode"):
        barcode_svg = generate_barcode_svg(asset["barcode"])

    if label_type in ["qr", "both"] and asset.get("qr_code"):
        qr_svg = generate_qr_svg(asset["qr_code"])

    html = f'''
    <div class="label" style="width: 2in; height: 1in; padding: 4px; border: 1px dashed #ccc; display: inline-block; margin: 2px; font-family: sans-serif; font-size: 8pt; page-break-inside: avoid;">
        <div style="display: flex; justify-content: space-between; align-items: flex-start;">
    '''

    if barcode_svg:
        html += f'<div style="flex: 1;">{barcode_svg}</div>'

    if qr_svg:
        html += f'<div style="width: 60px; height: 60px;">{qr_svg}</div>'

    html += '</div>'

    if include_name:
        name = asset.get("name", "")[:30]
        html += f'<div style="font-weight: bold; margin-top: 2px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">{name}</div>'

    html += f'<div style="font-family: monospace;">{asset.get("internal_id", "")}</div>'

    if include_category and asset.get("category_name"):
        html += f'<div style="color: #666; font-size: 7pt;">{asset.get("category_name", "")}</div>'

    html += '</div>'

    return html


# ============================================================================
# LABEL ENDPOINTS
# ============================================================================

@router.get("/asset/{asset_id}/barcode")
async def get_asset_barcode(
    asset_id: str,
    format: str = Query("svg", enum=["svg", "png"]),
    authorization: str = Header(None)
):
    """Get barcode for an asset."""
    profile_id = await get_current_profile_id(authorization)

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
    authorization: str = Header(None)
):
    """Get QR code for an asset."""
    profile_id = await get_current_profile_id(authorization)

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
    authorization: str = Header(None)
):
    """Get printable label HTML for an asset."""
    profile_id = await get_current_profile_id(authorization)

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
    authorization: str = Header(None)
):
    """Generate a batch of labels as a printable PDF-ready HTML page."""
    profile_id = await get_current_profile_id(authorization)
    require_org_access(org_id, profile_id, ["owner", "admin", "manager"])

    # Get all assets
    assets = []
    for asset_id in data.asset_ids:
        asset = gear_service.get_asset(asset_id)
        if asset and asset.get("organization_id") == org_id:
            assets.append(asset)

    if not assets:
        raise HTTPException(status_code=404, detail="No valid assets found")

    # Generate labels HTML
    labels_html = ""
    for asset in assets:
        labels_html += generate_label_html(
            asset,
            data.label_type,
            data.include_name,
            data.include_category
        )

    html = f'''
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <title>Label Batch - {len(assets)} Labels</title>
        <style>
            @page {{
                size: letter;
                margin: 0.5in;
            }}
            body {{
                margin: 0;
                padding: 0;
            }}
            .label-container {{
                display: flex;
                flex-wrap: wrap;
                justify-content: flex-start;
            }}
            @media print {{
                .label {{ border: none !important; }}
            }}
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


@router.post("/{org_id}/generate-codes")
async def generate_codes_for_assets(
    org_id: str,
    asset_ids: List[str],
    authorization: str = Header(None)
):
    """Generate/regenerate barcode and QR codes for specified assets."""
    profile_id = await get_current_profile_id(authorization)
    require_org_access(org_id, profile_id, ["owner", "admin", "manager"])

    from app.core.database import execute_query

    updated = []
    for asset_id in asset_ids:
        asset = gear_service.get_asset(asset_id)
        if asset and asset.get("organization_id") == org_id:
            internal_id = asset.get("internal_id")

            # Generate codes
            barcode = internal_id
            qr_code = f"GH:{internal_id}"

            execute_query(
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
    authorization: str = Header(None)
):
    """Get printable label for a kit."""
    profile_id = await get_current_profile_id(authorization)

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
