"""
Order Admin Page for Control Room
Manages Order applications, members, lodges, and jobs
"""
import flet as ft
from src.utils.design_system import *
from typing import Callable, Optional
import httpx
import os

# API configuration
API_BASE_URL = os.getenv("API_BASE_URL", "http://localhost:8000/api/v1")


def create_order_admin_view(page: ft.Page, on_back: Callable):
    """Create the Order Admin view for the Control Room"""

    # State
    current_tab = ft.Ref[str]()
    current_tab.current = "applications"

    applications_data = []
    members_data = []
    lodges_data = []
    jobs_data = []
    stats_data = {}

    # Data containers for dynamic content
    applications_container = ft.Ref[ft.Column]()
    members_container = ft.Ref[ft.Column]()
    lodges_container = ft.Ref[ft.Column]()
    jobs_container = ft.Ref[ft.Column]()
    stats_container = ft.Ref[ft.Column]()
    tab_content = ft.Ref[ft.Container]()

    # API Helpers
    async def fetch_data(endpoint: str):
        """Fetch data from API"""
        try:
            async with httpx.AsyncClient() as client:
                response = await client.get(f"{API_BASE_URL}/{endpoint}")
                if response.status_code == 200:
                    return response.json()
        except Exception as e:
            print(f"API Error: {e}")
        return None

    async def post_data(endpoint: str, data: dict):
        """Post data to API"""
        try:
            async with httpx.AsyncClient() as client:
                response = await client.post(f"{API_BASE_URL}/{endpoint}", json=data)
                if response.status_code in [200, 201]:
                    return response.json()
        except Exception as e:
            print(f"API Error: {e}")
        return None

    # Stats Card Component
    def stats_card(title: str, value: str, icon: str = "📊"):
        return ft.Container(
            content=ft.Column(
                controls=[
                    ft.Text(icon, size=FONT_3XL),
                    ft.Text(
                        value,
                        size=FONT_3XL,
                        weight=FONT_BOLD,
                        color=BONE_WHITE,
                    ),
                    ft.Text(
                        title,
                        size=FONT_SM,
                        color=TEXT_SECONDARY,
                    ),
                ],
                horizontal_alignment=ft.CrossAxisAlignment.CENTER,
                spacing=SPACING_SM,
            ),
            bgcolor=CARD_BG,
            border=ft.border.all(1, BORDER_COLOR),
            border_radius=RADIUS_LG,
            padding=SPACING_LG,
            expand=True,
        )

    # Status Badge Component
    def status_badge(status: str):
        colors = {
            "pending": (WARNING, CHARCOAL_BLACK),
            "approved": (SUCCESS, BONE_WHITE),
            "rejected": (ERROR, BONE_WHITE),
            "active": (SUCCESS, BONE_WHITE),
            "probationary": (WARNING, CHARCOAL_BLACK),
            "suspended": (ERROR, BONE_WHITE),
            "forming": (INFO, BONE_WHITE),
            "inactive": (MUTED_GRAY, BONE_WHITE),
        }
        bg, fg = colors.get(status.lower(), (MUTED_GRAY, BONE_WHITE))
        return ft.Container(
            content=ft.Text(
                status.upper(),
                size=FONT_XS,
                weight=FONT_BOLD,
                color=fg,
            ),
            bgcolor=bg,
            border_radius=RADIUS_SM,
            padding=ft.padding.symmetric(horizontal=SPACING_SM, vertical=SPACING_XS),
        )

    # Application Row Component
    def application_row(app: dict):
        return ft.Container(
            content=ft.Row(
                controls=[
                    ft.Column(
                        controls=[
                            ft.Text(
                                app.get("user_name", "Unknown User"),
                                size=FONT_BASE,
                                weight=FONT_SEMIBOLD,
                                color=BONE_WHITE,
                            ),
                            ft.Text(
                                app.get("primary_track", "Unknown Track"),
                                size=FONT_SM,
                                color=TEXT_SECONDARY,
                            ),
                            ft.Text(
                                f"{app.get('city', '')}, {app.get('region', '')}",
                                size=FONT_SM,
                                color=TEXT_MUTED,
                            ),
                        ],
                        spacing=SPACING_XS,
                        expand=True,
                    ),
                    status_badge(app.get("status", "pending")),
                    ft.Row(
                        controls=[
                            ft.IconButton(
                                icon=ft.icons.CHECK_CIRCLE,
                                icon_color=SUCCESS,
                                tooltip="Approve",
                                on_click=lambda e, a=app: handle_approve(a),
                            ),
                            ft.IconButton(
                                icon=ft.icons.CANCEL,
                                icon_color=ERROR,
                                tooltip="Reject",
                                on_click=lambda e, a=app: handle_reject(a),
                            ),
                            ft.IconButton(
                                icon=ft.icons.VISIBILITY,
                                icon_color=INFO,
                                tooltip="View Details",
                                on_click=lambda e, a=app: show_application_details(a),
                            ),
                        ],
                        spacing=SPACING_XS,
                    ),
                ],
                alignment=ft.MainAxisAlignment.SPACE_BETWEEN,
            ),
            bgcolor=CARD_BG,
            border=ft.border.all(1, BORDER_COLOR),
            border_radius=RADIUS_MD,
            padding=SPACING_MD,
        )

    # Member Row Component
    def member_row(member: dict):
        return ft.Container(
            content=ft.Row(
                controls=[
                    ft.Column(
                        controls=[
                            ft.Text(
                                member.get("user_name", "Unknown"),
                                size=FONT_BASE,
                                weight=FONT_SEMIBOLD,
                                color=BONE_WHITE,
                            ),
                            ft.Text(
                                member.get("primary_track", "Unknown"),
                                size=FONT_SM,
                                color=TEXT_SECONDARY,
                            ),
                            ft.Text(
                                member.get("lodge_name", "No Lodge"),
                                size=FONT_SM,
                                color=TEXT_MUTED,
                            ),
                        ],
                        spacing=SPACING_XS,
                        expand=True,
                    ),
                    status_badge(member.get("status", "active")),
                    ft.Row(
                        controls=[
                            ft.IconButton(
                                icon=ft.icons.EDIT,
                                icon_color=INFO,
                                tooltip="Edit Member",
                            ),
                            ft.IconButton(
                                icon=ft.icons.BLOCK,
                                icon_color=ERROR,
                                tooltip="Suspend Member",
                            ),
                        ],
                        spacing=SPACING_XS,
                    ),
                ],
                alignment=ft.MainAxisAlignment.SPACE_BETWEEN,
            ),
            bgcolor=CARD_BG,
            border=ft.border.all(1, BORDER_COLOR),
            border_radius=RADIUS_MD,
            padding=SPACING_MD,
        )

    # Lodge Row Component
    def lodge_row(lodge: dict):
        return ft.Container(
            content=ft.Row(
                controls=[
                    ft.Column(
                        controls=[
                            ft.Text(
                                lodge.get("name", "Unknown Lodge"),
                                size=FONT_BASE,
                                weight=FONT_SEMIBOLD,
                                color=BONE_WHITE,
                            ),
                            ft.Text(
                                f"{lodge.get('city', '')}, {lodge.get('region', '')}",
                                size=FONT_SM,
                                color=TEXT_SECONDARY,
                            ),
                            ft.Text(
                                f"{lodge.get('member_count', 0)} members",
                                size=FONT_SM,
                                color=TEXT_MUTED,
                            ),
                        ],
                        spacing=SPACING_XS,
                        expand=True,
                    ),
                    status_badge(lodge.get("status", "active")),
                    ft.Row(
                        controls=[
                            ft.IconButton(
                                icon=ft.icons.EDIT,
                                icon_color=INFO,
                                tooltip="Edit Lodge",
                            ),
                            ft.IconButton(
                                icon=ft.icons.DELETE,
                                icon_color=ERROR,
                                tooltip="Delete Lodge",
                            ),
                        ],
                        spacing=SPACING_XS,
                    ),
                ],
                alignment=ft.MainAxisAlignment.SPACE_BETWEEN,
            ),
            bgcolor=CARD_BG,
            border=ft.border.all(1, BORDER_COLOR),
            border_radius=RADIUS_MD,
            padding=SPACING_MD,
        )

    # Job Row Component
    def job_row(job: dict):
        return ft.Container(
            content=ft.Row(
                controls=[
                    ft.Column(
                        controls=[
                            ft.Text(
                                job.get("title", "Unknown Job"),
                                size=FONT_BASE,
                                weight=FONT_SEMIBOLD,
                                color=BONE_WHITE,
                            ),
                            ft.Text(
                                job.get("organization_name", "No Organization"),
                                size=FONT_SM,
                                color=TEXT_SECONDARY,
                            ),
                            ft.Text(
                                f"{job.get('application_count', 0)} applications",
                                size=FONT_SM,
                                color=TEXT_MUTED,
                            ),
                        ],
                        spacing=SPACING_XS,
                        expand=True,
                    ),
                    ft.Text(
                        job.get("visibility", "public").upper(),
                        size=FONT_XS,
                        color=TEXT_MUTED,
                    ),
                    ft.Row(
                        controls=[
                            ft.IconButton(
                                icon=ft.icons.EDIT,
                                icon_color=INFO,
                                tooltip="Edit Job",
                            ),
                            ft.IconButton(
                                icon=ft.icons.DELETE,
                                icon_color=ERROR,
                                tooltip="Delete Job",
                            ),
                        ],
                        spacing=SPACING_XS,
                    ),
                ],
                alignment=ft.MainAxisAlignment.SPACE_BETWEEN,
            ),
            bgcolor=CARD_BG,
            border=ft.border.all(1, BORDER_COLOR),
            border_radius=RADIUS_MD,
            padding=SPACING_MD,
        )

    # Event Handlers
    def handle_approve(app: dict):
        """Handle application approval"""
        page.dialog = ft.AlertDialog(
            title=ft.Text("Approve Application"),
            content=ft.Text(f"Are you sure you want to approve {app.get('user_name', 'this user')}?"),
            actions=[
                ft.TextButton("Cancel", on_click=lambda e: close_dialog()),
                ft.ElevatedButton(
                    "Approve",
                    bgcolor=SUCCESS,
                    color=BONE_WHITE,
                    on_click=lambda e: confirm_approve(app),
                ),
            ],
        )
        page.dialog.open = True
        page.update()

    def handle_reject(app: dict):
        """Handle application rejection"""
        rejection_reason = ft.TextField(
            label="Rejection Reason",
            multiline=True,
            min_lines=3,
            bgcolor=INPUT_BG,
            border_color=BORDER_COLOR,
        )

        page.dialog = ft.AlertDialog(
            title=ft.Text("Reject Application"),
            content=ft.Column(
                controls=[
                    ft.Text(f"Rejecting application from {app.get('user_name', 'this user')}"),
                    rejection_reason,
                ],
                tight=True,
            ),
            actions=[
                ft.TextButton("Cancel", on_click=lambda e: close_dialog()),
                ft.ElevatedButton(
                    "Reject",
                    bgcolor=ERROR,
                    color=BONE_WHITE,
                    on_click=lambda e: confirm_reject(app, rejection_reason.value),
                ),
            ],
        )
        page.dialog.open = True
        page.update()

    def show_application_details(app: dict):
        """Show application details modal"""
        page.dialog = ft.AlertDialog(
            title=ft.Text(f"Application: {app.get('user_name', 'Unknown')}"),
            content=ft.Column(
                controls=[
                    ft.Text(f"Track: {app.get('primary_track', 'Unknown')}", size=FONT_SM),
                    ft.Text(f"Location: {app.get('city', '')}, {app.get('region', '')}", size=FONT_SM),
                    ft.Text(f"Experience: {app.get('years_experience', 'N/A')} years", size=FONT_SM),
                    ft.Text(f"Current Role: {app.get('current_role', 'N/A')}", size=FONT_SM),
                    ft.Divider(),
                    ft.Text("Statement:", weight=FONT_BOLD, size=FONT_SM),
                    ft.Text(app.get("statement", "No statement provided"), size=FONT_SM),
                    ft.Divider(),
                    ft.Text("Portfolio:", weight=FONT_BOLD, size=FONT_SM),
                    ft.Text(app.get("portfolio_links", "No links provided"), size=FONT_SM),
                ],
                scroll=ft.ScrollMode.AUTO,
                width=400,
                height=300,
            ),
            actions=[
                ft.TextButton("Close", on_click=lambda e: close_dialog()),
            ],
        )
        page.dialog.open = True
        page.update()

    def close_dialog():
        """Close the current dialog"""
        page.dialog.open = False
        page.update()

    def confirm_approve(app: dict):
        """Confirm and process approval"""
        # TODO: Call API to approve application
        close_dialog()
        page.snack_bar = ft.SnackBar(
            content=ft.Text(f"Application approved for {app.get('user_name', 'user')}"),
            bgcolor=SUCCESS,
        )
        page.snack_bar.open = True
        page.update()

    def confirm_reject(app: dict, reason: str):
        """Confirm and process rejection"""
        # TODO: Call API to reject application
        close_dialog()
        page.snack_bar = ft.SnackBar(
            content=ft.Text(f"Application rejected for {app.get('user_name', 'user')}"),
            bgcolor=ERROR,
        )
        page.snack_bar.open = True
        page.update()

    # Tab switching
    def switch_tab(tab_name: str):
        current_tab.current = tab_name
        update_tab_content()
        page.update()

    def update_tab_content():
        """Update the tab content based on current tab"""
        if current_tab.current == "applications":
            content = applications_content()
        elif current_tab.current == "members":
            content = members_content()
        elif current_tab.current == "lodges":
            content = lodges_content()
        elif current_tab.current == "jobs":
            content = jobs_content()
        else:
            content = stats_content()

        tab_content.current.content = content

    # Tab Contents
    def applications_content():
        # Sample data (would be fetched from API)
        sample_apps = [
            {"id": 1, "user_name": "John Smith", "primary_track": "cinematography", "city": "Atlanta", "region": "GA", "status": "pending", "years_experience": 5, "statement": "I have been working in film for 5 years..."},
            {"id": 2, "user_name": "Jane Doe", "primary_track": "directing", "city": "Los Angeles", "region": "CA", "status": "pending", "years_experience": 8, "statement": "Passionate about faith-driven content..."},
            {"id": 3, "user_name": "Mike Johnson", "primary_track": "editing", "city": "Nashville", "region": "TN", "status": "approved", "years_experience": 3},
        ]

        return ft.Column(
            controls=[
                ft.Row(
                    controls=[
                        ft.Text("Pending Applications", size=FONT_XL, weight=FONT_BOLD, color=BONE_WHITE),
                        ft.ElevatedButton(
                            "Refresh",
                            icon=ft.icons.REFRESH,
                            bgcolor=MUTED_GRAY,
                            color=BONE_WHITE,
                        ),
                    ],
                    alignment=ft.MainAxisAlignment.SPACE_BETWEEN,
                ),
                ft.Container(height=SPACING_MD),
                *[application_row(app) for app in sample_apps],
            ],
            spacing=SPACING_MD,
        )

    def members_content():
        sample_members = [
            {"id": 1, "user_name": "Sarah Wilson", "primary_track": "producing", "lodge_name": "Atlanta Lodge", "status": "active"},
            {"id": 2, "user_name": "Tom Brown", "primary_track": "sound", "lodge_name": "Nashville Lodge", "status": "probationary"},
            {"id": 3, "user_name": "Emily Davis", "primary_track": "writing", "lodge_name": None, "status": "active"},
        ]

        return ft.Column(
            controls=[
                ft.Row(
                    controls=[
                        ft.Text("Order Members", size=FONT_XL, weight=FONT_BOLD, color=BONE_WHITE),
                        ft.TextField(
                            hint_text="Search members...",
                            bgcolor=INPUT_BG,
                            border_color=BORDER_COLOR,
                            width=250,
                        ),
                    ],
                    alignment=ft.MainAxisAlignment.SPACE_BETWEEN,
                ),
                ft.Container(height=SPACING_MD),
                *[member_row(m) for m in sample_members],
            ],
            spacing=SPACING_MD,
        )

    def lodges_content():
        sample_lodges = [
            {"id": 1, "name": "Atlanta Lodge", "city": "Atlanta", "region": "GA", "member_count": 15, "status": "active"},
            {"id": 2, "name": "Nashville Lodge", "city": "Nashville", "region": "TN", "member_count": 8, "status": "active"},
            {"id": 3, "name": "Los Angeles Lodge", "city": "Los Angeles", "region": "CA", "member_count": 3, "status": "forming"},
        ]

        return ft.Column(
            controls=[
                ft.Row(
                    controls=[
                        ft.Text("Lodges", size=FONT_XL, weight=FONT_BOLD, color=BONE_WHITE),
                        ft.ElevatedButton(
                            "Create Lodge",
                            icon=ft.icons.ADD,
                            bgcolor=PRIMARY_RED,
                            color=BONE_WHITE,
                        ),
                    ],
                    alignment=ft.MainAxisAlignment.SPACE_BETWEEN,
                ),
                ft.Container(height=SPACING_MD),
                *[lodge_row(l) for l in sample_lodges],
            ],
            spacing=SPACING_MD,
        )

    def jobs_content():
        sample_jobs = [
            {"id": 1, "title": "DP for Documentary", "organization_name": "Faith Films", "application_count": 5, "visibility": "order_only"},
            {"id": 2, "title": "Editor Needed", "organization_name": "Kingdom Studios", "application_count": 12, "visibility": "order_priority"},
            {"id": 3, "title": "Sound Mixer", "organization_name": "Second Watch Productions", "application_count": 3, "visibility": "public"},
        ]

        return ft.Column(
            controls=[
                ft.Row(
                    controls=[
                        ft.Text("Order Jobs", size=FONT_XL, weight=FONT_BOLD, color=BONE_WHITE),
                        ft.ElevatedButton(
                            "Create Job",
                            icon=ft.icons.ADD,
                            bgcolor=PRIMARY_RED,
                            color=BONE_WHITE,
                        ),
                    ],
                    alignment=ft.MainAxisAlignment.SPACE_BETWEEN,
                ),
                ft.Container(height=SPACING_MD),
                *[job_row(j) for j in sample_jobs],
            ],
            spacing=SPACING_MD,
        )

    def stats_content():
        return ft.Column(
            controls=[
                ft.Text("Order Statistics", size=FONT_XL, weight=FONT_BOLD, color=BONE_WHITE),
                ft.Container(height=SPACING_MD),
                ft.Row(
                    controls=[
                        stats_card("Total Members", "47", "👥"),
                        stats_card("Active Lodges", "5", "🏛️"),
                        stats_card("Pending Apps", "3", "📝"),
                        stats_card("Active Jobs", "8", "💼"),
                    ],
                    spacing=SPACING_MD,
                ),
                ft.Container(height=SPACING_XL),
                ft.Row(
                    controls=[
                        stats_card("This Month", "+12", "📈"),
                        stats_card("Dues Revenue", "$2,350", "💰"),
                        stats_card("Job Placements", "6", "🎯"),
                        stats_card("Booking Requests", "14", "📅"),
                    ],
                    spacing=SPACING_MD,
                ),
            ],
            spacing=SPACING_MD,
        )

    # Tab Button Component
    def tab_button(label: str, tab_id: str, icon: str):
        is_active = current_tab.current == tab_id
        return ft.Container(
            content=ft.Row(
                controls=[
                    ft.Text(icon, size=FONT_LG),
                    ft.Text(
                        label,
                        size=FONT_SM,
                        weight=FONT_SEMIBOLD if is_active else FONT_NORMAL,
                        color=BONE_WHITE if is_active else TEXT_SECONDARY,
                    ),
                ],
                spacing=SPACING_SM,
            ),
            bgcolor=PRIMARY_RED if is_active else "transparent",
            border_radius=RADIUS_MD,
            padding=ft.padding.symmetric(horizontal=SPACING_MD, vertical=SPACING_SM),
            on_click=lambda e: switch_tab(tab_id),
        )

    # Build the view
    view = ft.View(
        "/order-admin",
        controls=[
            # Header
            ft.Container(
                content=ft.Row(
                    controls=[
                        ft.Row(
                            controls=[
                                ft.IconButton(
                                    icon=ft.icons.ARROW_BACK,
                                    icon_color=BONE_WHITE,
                                    on_click=lambda e: on_back(),
                                ),
                                ft.Text(
                                    "Order Administration",
                                    size=FONT_2XL,
                                    weight=FONT_BOLD,
                                    color=BONE_WHITE,
                                ),
                            ],
                            spacing=SPACING_MD,
                        ),
                        ft.Row(
                            controls=[
                                tab_button("Stats", "stats", "📊"),
                                tab_button("Applications", "applications", "📝"),
                                tab_button("Members", "members", "👥"),
                                tab_button("Lodges", "lodges", "🏛️"),
                                tab_button("Jobs", "jobs", "💼"),
                            ],
                            spacing=SPACING_SM,
                        ),
                    ],
                    alignment=ft.MainAxisAlignment.SPACE_BETWEEN,
                ),
                bgcolor=CHARCOAL_BLACK,
                padding=SPACING_LG,
                border=ft.border.only(bottom=ft.BorderSide(1, BORDER_COLOR)),
            ),

            # Main Content
            ft.Container(
                ref=tab_content,
                content=applications_content(),
                padding=SPACING_XL,
                expand=True,
            ),
        ],
        scroll=ft.ScrollMode.AUTO,
        bgcolor=BACKGROUND,
    )

    return view
