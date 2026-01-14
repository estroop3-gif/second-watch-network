"""
Deep link URL generation for expense and budget items
Provides utilities to create navigation URLs for linking between different views
"""
from typing import Optional


# Tab mapping from source types to expense tab IDs
SOURCE_TYPE_TO_TAB = {
    'mileage': 'mileage',
    'kit_rental': 'kit-rentals',
    'per_diem': 'per-diem',
    'receipt': 'receipts',
    'purchase_order': 'purchase-orders',
    'invoice_line_item': 'summary',
}


def generate_expense_deep_link(
    project_id: str,
    source_type: str,
    source_id: str,
    base_url: str = ""
) -> str:
    """
    Generate a deep link URL to navigate directly to an expense item

    URL Format: /backlot/projects/{project_id}?view=expenses&tab={tab}&item={source_id}

    Args:
        project_id: The project ID
        source_type: Type of expense (mileage, kit_rental, per_diem, receipt, purchase_order)
        source_id: ID of the specific expense item
        base_url: Optional base URL prefix (e.g., https://app.secondwatch.network)

    Returns:
        Full URL string for the expense item
    """
    tab = SOURCE_TYPE_TO_TAB.get(source_type, 'receipts')
    return f"{base_url}/backlot/projects/{project_id}?view=expenses&tab={tab}&item={source_id}"


def generate_budget_actual_deep_link(
    project_id: str,
    budget_actual_id: str,
    base_url: str = ""
) -> str:
    """
    Generate deep link to budget actual detail in the Budget view

    Args:
        project_id: The project ID
        budget_actual_id: ID of the budget actual
        base_url: Optional base URL prefix

    Returns:
        Full URL string for the budget actual
    """
    return f"{base_url}/backlot/projects/{project_id}?view=budget&actual={budget_actual_id}"


def generate_gear_asset_deep_link(
    organization_id: str,
    asset_id: str,
    base_url: str = ""
) -> str:
    """
    Generate deep link to Gear House asset

    Args:
        organization_id: The gear house organization ID
        asset_id: ID of the gear asset
        base_url: Optional base URL prefix

    Returns:
        Full URL string for the gear asset
    """
    return f"{base_url}/gear/{organization_id}/assets/{asset_id}"


def generate_gear_kit_deep_link(
    organization_id: str,
    kit_instance_id: str,
    base_url: str = ""
) -> str:
    """
    Generate deep link to Gear House kit instance

    Args:
        organization_id: The gear house organization ID
        kit_instance_id: ID of the kit instance
        base_url: Optional base URL prefix

    Returns:
        Full URL string for the gear kit
    """
    return f"{base_url}/gear/{organization_id}/kits/{kit_instance_id}"


def get_source_display_info(source_type: str) -> dict:
    """
    Get display information for a source type

    Returns:
        Dict with label, icon name, and color class
    """
    info_map = {
        'mileage': {
            'label': 'Mileage',
            'icon': 'Car',
            'color': 'blue'
        },
        'kit_rental': {
            'label': 'Kit Rental',
            'icon': 'Package',
            'color': 'purple'
        },
        'per_diem': {
            'label': 'Per Diem',
            'icon': 'Utensils',
            'color': 'green'
        },
        'receipt': {
            'label': 'Receipt',
            'icon': 'Receipt',
            'color': 'yellow'
        },
        'purchase_order': {
            'label': 'Purchase Order',
            'icon': 'FileCheck',
            'color': 'orange'
        },
        'invoice_line_item': {
            'label': 'Invoice Line Item',
            'icon': 'FileText',
            'color': 'pink'
        },
        'manual': {
            'label': 'Manual Entry',
            'icon': 'Edit',
            'color': 'gray'
        }
    }
    return info_map.get(source_type, info_map['manual'])
