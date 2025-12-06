"""
OCR Service for Receipt Processing
Uses the existing AI service (Claude/OpenAI) with vision capabilities to extract receipt data
"""
import base64
import httpx
import re
from typing import Optional, Dict, Any
from datetime import datetime
from app.core.config import settings


class ReceiptOCRResult:
    """Result from OCR processing"""
    def __init__(
        self,
        vendor_name: Optional[str] = None,
        amount: Optional[float] = None,
        tax_amount: Optional[float] = None,
        purchase_date: Optional[str] = None,
        line_items: Optional[list] = None,
        confidence: float = 0.0,
        raw_text: str = "",
        success: bool = False,
        error: Optional[str] = None
    ):
        self.vendor_name = vendor_name
        self.amount = amount
        self.tax_amount = tax_amount
        self.purchase_date = purchase_date
        self.line_items = line_items or []
        self.confidence = confidence
        self.raw_text = raw_text
        self.success = success
        self.error = error

    def to_dict(self) -> Dict[str, Any]:
        return {
            "vendor_name": self.vendor_name,
            "amount": self.amount,
            "tax_amount": self.tax_amount,
            "purchase_date": self.purchase_date,
            "line_items": self.line_items,
            "confidence": self.confidence,
            "raw_text": self.raw_text,
            "success": self.success,
            "error": self.error
        }


async def download_file(url: str) -> bytes:
    """Download file from URL"""
    async with httpx.AsyncClient() as client:
        response = await client.get(url, timeout=30.0)
        response.raise_for_status()
        return response.content


def get_media_type(file_type: str) -> str:
    """Get media type string for API calls"""
    type_map = {
        "image/jpeg": "image/jpeg",
        "image/jpg": "image/jpeg",
        "image/png": "image/png",
        "image/webp": "image/webp",
        "image/gif": "image/gif",
        "application/pdf": "application/pdf",
    }
    return type_map.get(file_type, "image/jpeg")


async def process_receipt_with_claude(
    image_data: bytes,
    file_type: str = "image/jpeg"
) -> ReceiptOCRResult:
    """Process receipt using Claude's vision capabilities"""
    if not settings.ANTHROPIC_API_KEY:
        return ReceiptOCRResult(
            success=False,
            error="Anthropic API key not configured"
        )

    try:
        import anthropic

        client = anthropic.Anthropic(api_key=settings.ANTHROPIC_API_KEY)

        # Encode image to base64
        image_base64 = base64.standard_b64encode(image_data).decode("utf-8")

        # Create the vision request
        message = client.messages.create(
            model="claude-sonnet-4-20250514",
            max_tokens=1024,
            messages=[
                {
                    "role": "user",
                    "content": [
                        {
                            "type": "image",
                            "source": {
                                "type": "base64",
                                "media_type": get_media_type(file_type),
                                "data": image_base64,
                            },
                        },
                        {
                            "type": "text",
                            "text": """Analyze this receipt image and extract the following information in JSON format:
{
    "vendor_name": "Store or business name",
    "amount": 0.00,  // Total amount as a number
    "tax_amount": 0.00,  // Tax amount if visible, as a number
    "purchase_date": "YYYY-MM-DD",  // Date in ISO format if visible
    "line_items": [  // List of items if visible
        {"description": "Item name", "amount": 0.00}
    ],
    "raw_text": "Full text visible on receipt",
    "confidence": 0.85  // Your confidence in the extraction (0-1)
}

If any field cannot be determined, use null. For amounts, extract only the numeric value.
Return ONLY the JSON object, no other text."""
                        }
                    ],
                }
            ],
        )

        # Parse the response
        response_text = message.content[0].text.strip()

        # Try to extract JSON from the response
        try:
            # Remove markdown code blocks if present
            if response_text.startswith("```"):
                response_text = re.sub(r"```json?\n?", "", response_text)
                response_text = re.sub(r"\n?```$", "", response_text)

            import json
            data = json.loads(response_text)

            return ReceiptOCRResult(
                vendor_name=data.get("vendor_name"),
                amount=float(data["amount"]) if data.get("amount") else None,
                tax_amount=float(data["tax_amount"]) if data.get("tax_amount") else None,
                purchase_date=data.get("purchase_date"),
                line_items=data.get("line_items", []),
                confidence=float(data.get("confidence", 0.7)),
                raw_text=data.get("raw_text", ""),
                success=True
            )
        except json.JSONDecodeError:
            # If JSON parsing fails, return raw text
            return ReceiptOCRResult(
                raw_text=response_text,
                confidence=0.3,
                success=True,
                error="Could not parse structured data, raw text extracted"
            )

    except Exception as e:
        return ReceiptOCRResult(
            success=False,
            error=str(e)
        )


async def process_receipt_with_openai(
    image_data: bytes,
    file_type: str = "image/jpeg"
) -> ReceiptOCRResult:
    """Process receipt using OpenAI's vision capabilities (GPT-4 Vision)"""
    if not settings.OPENAI_API_KEY:
        return ReceiptOCRResult(
            success=False,
            error="OpenAI API key not configured"
        )

    try:
        from openai import OpenAI

        client = OpenAI(api_key=settings.OPENAI_API_KEY)

        # Encode image to base64
        image_base64 = base64.standard_b64encode(image_data).decode("utf-8")

        response = client.chat.completions.create(
            model="gpt-4o",
            messages=[
                {
                    "role": "user",
                    "content": [
                        {
                            "type": "text",
                            "text": """Analyze this receipt image and extract the following information in JSON format:
{
    "vendor_name": "Store or business name",
    "amount": 0.00,
    "tax_amount": 0.00,
    "purchase_date": "YYYY-MM-DD",
    "line_items": [
        {"description": "Item name", "amount": 0.00}
    ],
    "raw_text": "Full text visible on receipt",
    "confidence": 0.85
}

If any field cannot be determined, use null. For amounts, extract only the numeric value.
Return ONLY the JSON object, no other text."""
                        },
                        {
                            "type": "image_url",
                            "image_url": {
                                "url": f"data:{get_media_type(file_type)};base64,{image_base64}"
                            }
                        }
                    ],
                }
            ],
            max_tokens=1024,
        )

        response_text = response.choices[0].message.content.strip()

        try:
            # Remove markdown code blocks if present
            if response_text.startswith("```"):
                response_text = re.sub(r"```json?\n?", "", response_text)
                response_text = re.sub(r"\n?```$", "", response_text)

            import json
            data = json.loads(response_text)

            return ReceiptOCRResult(
                vendor_name=data.get("vendor_name"),
                amount=float(data["amount"]) if data.get("amount") else None,
                tax_amount=float(data["tax_amount"]) if data.get("tax_amount") else None,
                purchase_date=data.get("purchase_date"),
                line_items=data.get("line_items", []),
                confidence=float(data.get("confidence", 0.7)),
                raw_text=data.get("raw_text", ""),
                success=True
            )
        except json.JSONDecodeError:
            return ReceiptOCRResult(
                raw_text=response_text,
                confidence=0.3,
                success=True,
                error="Could not parse structured data, raw text extracted"
            )

    except Exception as e:
        return ReceiptOCRResult(
            success=False,
            error=str(e)
        )


async def process_receipt(
    file_url: str,
    file_type: str = "image/jpeg"
) -> ReceiptOCRResult:
    """
    Process a receipt image/PDF and extract data using available AI vision APIs.

    Args:
        file_url: URL of the receipt file
        file_type: MIME type of the file

    Returns:
        ReceiptOCRResult with extracted data
    """
    try:
        # Download the file
        image_data = await download_file(file_url)

        # Try Claude first (better at structured extraction)
        if settings.ANTHROPIC_API_KEY:
            result = await process_receipt_with_claude(image_data, file_type)
            if result.success:
                return result

        # Fall back to OpenAI
        if settings.OPENAI_API_KEY:
            result = await process_receipt_with_openai(image_data, file_type)
            if result.success:
                return result

        return ReceiptOCRResult(
            success=False,
            error="No AI vision API available. Configure ANTHROPIC_API_KEY or OPENAI_API_KEY."
        )

    except Exception as e:
        return ReceiptOCRResult(
            success=False,
            error=f"Failed to process receipt: {str(e)}"
        )


async def process_receipt_from_bytes(
    file_data: bytes,
    file_type: str = "image/jpeg"
) -> ReceiptOCRResult:
    """
    Process a receipt from raw bytes (for direct upload).

    Args:
        file_data: Raw file bytes
        file_type: MIME type of the file

    Returns:
        ReceiptOCRResult with extracted data
    """
    try:
        # Try Claude first
        if settings.ANTHROPIC_API_KEY:
            result = await process_receipt_with_claude(file_data, file_type)
            if result.success:
                return result

        # Fall back to OpenAI
        if settings.OPENAI_API_KEY:
            result = await process_receipt_with_openai(file_data, file_type)
            if result.success:
                return result

        return ReceiptOCRResult(
            success=False,
            error="No AI vision API available. Configure ANTHROPIC_API_KEY or OPENAI_API_KEY."
        )

    except Exception as e:
        return ReceiptOCRResult(
            success=False,
            error=f"Failed to process receipt: {str(e)}"
        )
