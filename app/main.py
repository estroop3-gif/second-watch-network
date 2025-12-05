"""
Second Watch Network - Main Application Entry Point
"""
import flet as ft
from src.utils.design_system import *

def main(page: ft.Page):
    # Page Configuration
    page.title = "Second Watch Network"
    page.theme_mode = ft.ThemeMode.DARK
    page.bgcolor = BACKGROUND
    page.padding = 0
    page.scroll = ft.ScrollMode.AUTO

    # Custom Theme
    page.theme = ft.Theme(
        color_scheme=ft.ColorScheme(
            primary=PRIMARY_RED,
            on_primary=BONE_WHITE,
            secondary=MUTED_GRAY,
            on_secondary=BONE_WHITE,
            background=CHARCOAL_BLACK,
            on_background=BONE_WHITE,
            surface=CARD_BG,
            on_surface=BONE_WHITE,
        ),
        font_family=FONT_BODY,
    )

    # Navigation State
    current_route = ft.Ref[str]()
    current_route.current = "/"

    def route_change(e):
        """Handle route changes"""
        page.views.clear()

        # Home/Landing Page
        if page.route == "/" or page.route == "/landing":
            page.views.append(landing_view())

        # Login Page
        elif page.route == "/login":
            page.views.append(login_view())

        # Signup Page
        elif page.route == "/signup":
            page.views.append(signup_view())

        # Dashboard
        elif page.route == "/dashboard":
            page.views.append(dashboard_view())

        # 404 Not Found
        else:
            page.views.append(not_found_view())

        page.update()

    def view_pop(e):
        """Handle back button"""
        page.views.pop()
        top_view = page.views[-1]
        page.go(top_view.route)

    # Landing Page View
    def landing_view():
        return ft.View(
            "/landing",
            controls=[
                # Header
                ft.Container(
                    content=ft.Row(
                        controls=[
                            ft.Text(
                                "SECOND WATCH NETWORK",
                                size=FONT_2XL,
                                weight=FONT_BOLD,
                                color=BONE_WHITE,
                            ),
                            ft.Row(
                                controls=[
                                    ft.TextButton(
                                        "Home",
                                        style=ft.ButtonStyle(
                                            color=BONE_WHITE,
                                        ),
                                        on_click=lambda _: page.go("/landing"),
                                    ),
                                    ft.TextButton(
                                        "Originals",
                                        style=ft.ButtonStyle(
                                            color=BONE_WHITE,
                                        ),
                                    ),
                                    ft.TextButton(
                                        "Submit",
                                        style=ft.ButtonStyle(
                                            color=BONE_WHITE,
                                        ),
                                    ),
                                    ft.ElevatedButton(
                                        "Login",
                                        bgcolor=PRIMARY_RED,
                                        color=BONE_WHITE,
                                        on_click=lambda _: page.go("/login"),
                                    ),
                                    ft.OutlinedButton(
                                        "Sign Up",
                                        style=ft.ButtonStyle(
                                            color=BONE_WHITE,
                                        ),
                                        on_click=lambda _: page.go("/signup"),
                                    ),
                                ],
                                spacing=SPACING_MD,
                            ),
                        ],
                        alignment=ft.MainAxisAlignment.SPACE_BETWEEN,
                    ),
                    bgcolor=CHARCOAL_BLACK,
                    padding=SPACING_LG,
                    border=ft.border.only(bottom=ft.BorderSide(1, BORDER_COLOR)),
                ),

                # Hero Section
                ft.Container(
                    content=ft.Column(
                        controls=[
                            ft.Text(
                                "FAITH-DRIVEN FILMMAKING",
                                size=FONT_6XL,
                                weight=FONT_BOLD,
                                color=BONE_WHITE,
                                text_align=ft.TextAlign.CENTER,
                            ),
                            ft.Text(
                                "FOR THE KINGDOM",
                                size=FONT_6XL,
                                weight=FONT_BOLD,
                                color=PRIMARY_RED,
                                text_align=ft.TextAlign.CENTER,
                            ),
                            ft.Container(height=SPACING_LG),
                            ft.Text(
                                "A platform connecting Christian filmmakers, content creators, and audiences worldwide",
                                size=FONT_LG,
                                color=TEXT_SECONDARY,
                                text_align=ft.TextAlign.CENTER,
                                width=800,
                            ),
                            ft.Container(height=SPACING_XL),
                            ft.Row(
                                controls=[
                                    ft.ElevatedButton(
                                        "Watch Now",
                                        bgcolor=PRIMARY_RED,
                                        color=BONE_WHITE,
                                        height=50,
                                        width=200,
                                        style=ft.ButtonStyle(
                                            shape=ft.RoundedRectangleBorder(radius=RADIUS_MD),
                                        ),
                                    ),
                                    ft.OutlinedButton(
                                        "Submit Content",
                                        height=50,
                                        width=200,
                                        style=ft.ButtonStyle(
                                            color=BONE_WHITE,
                                            shape=ft.RoundedRectangleBorder(radius=RADIUS_MD),
                                        ),
                                    ),
                                ],
                                alignment=ft.MainAxisAlignment.CENTER,
                                spacing=SPACING_LG,
                            ),
                        ],
                        horizontal_alignment=ft.CrossAxisAlignment.CENTER,
                        spacing=SPACING_SM,
                    ),
                    padding=ft.padding.symmetric(vertical=100, horizontal=SPACING_XL),
                    alignment=ft.alignment.center,
                ),

                # Features Section
                ft.Container(
                    content=ft.Column(
                        controls=[
                            ft.Text(
                                "What We Offer",
                                size=FONT_4XL,
                                weight=FONT_BOLD,
                                color=BONE_WHITE,
                                text_align=ft.TextAlign.CENTER,
                            ),
                            ft.Container(height=SPACING_XL),
                            ft.Row(
                                controls=[
                                    feature_card("🎬", "Original Shows", "Watch faith-driven original content"),
                                    feature_card("👥", "Community", "Connect with filmmakers worldwide"),
                                    feature_card("📝", "Submit Content", "Share your creative work"),
                                ],
                                alignment=ft.MainAxisAlignment.CENTER,
                                spacing=SPACING_LG,
                            ),
                        ],
                        horizontal_alignment=ft.CrossAxisAlignment.CENTER,
                    ),
                    padding=SPACING_3XL,
                    bgcolor="#0A0A0A",
                ),

                # Footer
                ft.Container(
                    content=ft.Text(
                        "© 2024 Second Watch Network. All rights reserved.",
                        size=FONT_SM,
                        color=TEXT_MUTED,
                        text_align=ft.TextAlign.CENTER,
                    ),
                    padding=SPACING_XL,
                    alignment=ft.alignment.center,
                ),
            ],
            scroll=ft.ScrollMode.AUTO,
            bgcolor=BACKGROUND,
        )

    def feature_card(icon, title, description):
        """Create a feature card component"""
        return ft.Container(
            content=ft.Column(
                controls=[
                    ft.Text(icon, size=FONT_5XL, text_align=ft.TextAlign.CENTER),
                    ft.Text(
                        title,
                        size=FONT_XL,
                        weight=FONT_BOLD,
                        color=BONE_WHITE,
                        text_align=ft.TextAlign.CENTER,
                    ),
                    ft.Text(
                        description,
                        size=FONT_BASE,
                        color=TEXT_SECONDARY,
                        text_align=ft.TextAlign.CENTER,
                    ),
                ],
                horizontal_alignment=ft.CrossAxisAlignment.CENTER,
                spacing=SPACING_MD,
            ),
            bgcolor=CARD_BG,
            border=ft.border.all(1, BORDER_COLOR),
            border_radius=RADIUS_LG,
            padding=SPACING_XL,
            width=300,
        )

    # Login Page View
    def login_view():
        return ft.View(
            "/login",
            controls=[
                ft.Container(
                    content=ft.Column(
                        controls=[
                            ft.Text(
                                "Welcome Back",
                                size=FONT_4XL,
                                weight=FONT_BOLD,
                                color=BONE_WHITE,
                            ),
                            ft.Container(height=SPACING_LG),
                            ft.TextField(
                                label="Email",
                                bgcolor=INPUT_BG,
                                border_color=BORDER_COLOR,
                                color=TEXT_PRIMARY,
                            ),
                            ft.TextField(
                                label="Password",
                                password=True,
                                can_reveal_password=True,
                                bgcolor=INPUT_BG,
                                border_color=BORDER_COLOR,
                                color=TEXT_PRIMARY,
                            ),
                            ft.Container(height=SPACING_LG),
                            ft.ElevatedButton(
                                "Login",
                                bgcolor=PRIMARY_RED,
                                color=BONE_WHITE,
                                width=300,
                                height=45,
                                on_click=lambda _: page.go("/dashboard"),
                            ),
                            ft.TextButton(
                                "Don't have an account? Sign up",
                                on_click=lambda _: page.go("/signup"),
                            ),
                        ],
                        horizontal_alignment=ft.CrossAxisAlignment.CENTER,
                        spacing=SPACING_MD,
                    ),
                    padding=SPACING_3XL,
                    alignment=ft.alignment.center,
                    expand=True,
                ),
            ],
            bgcolor=BACKGROUND,
        )

    # Signup Page View
    def signup_view():
        return ft.View(
            "/signup",
            controls=[
                ft.Container(
                    content=ft.Column(
                        controls=[
                            ft.Text(
                                "Create Account",
                                size=FONT_4XL,
                                weight=FONT_BOLD,
                                color=BONE_WHITE,
                            ),
                            ft.Container(height=SPACING_LG),
                            ft.TextField(
                                label="Email",
                                bgcolor=INPUT_BG,
                                border_color=BORDER_COLOR,
                                color=TEXT_PRIMARY,
                            ),
                            ft.TextField(
                                label="Password",
                                password=True,
                                can_reveal_password=True,
                                bgcolor=INPUT_BG,
                                border_color=BORDER_COLOR,
                                color=TEXT_PRIMARY,
                            ),
                            ft.TextField(
                                label="Confirm Password",
                                password=True,
                                can_reveal_password=True,
                                bgcolor=INPUT_BG,
                                border_color=BORDER_COLOR,
                                color=TEXT_PRIMARY,
                            ),
                            ft.Container(height=SPACING_LG),
                            ft.ElevatedButton(
                                "Sign Up",
                                bgcolor=PRIMARY_RED,
                                color=BONE_WHITE,
                                width=300,
                                height=45,
                            ),
                            ft.TextButton(
                                "Already have an account? Login",
                                on_click=lambda _: page.go("/login"),
                            ),
                        ],
                        horizontal_alignment=ft.CrossAxisAlignment.CENTER,
                        spacing=SPACING_MD,
                    ),
                    padding=SPACING_3XL,
                    alignment=ft.alignment.center,
                    expand=True,
                ),
            ],
            bgcolor=BACKGROUND,
        )

    # Dashboard View
    def dashboard_view():
        return ft.View(
            "/dashboard",
            controls=[
                ft.Container(
                    content=ft.Column(
                        controls=[
                            ft.Text(
                                "Dashboard",
                                size=FONT_4XL,
                                weight=FONT_BOLD,
                                color=BONE_WHITE,
                            ),
                            ft.Text(
                                "Welcome to Second Watch Network",
                                size=FONT_LG,
                                color=TEXT_SECONDARY,
                            ),
                            ft.Container(height=SPACING_XL),
                            ft.ElevatedButton(
                                "Logout",
                                bgcolor=MUTED_GRAY,
                                color=BONE_WHITE,
                                on_click=lambda _: page.go("/landing"),
                            ),
                        ],
                        horizontal_alignment=ft.CrossAxisAlignment.CENTER,
                    ),
                    padding=SPACING_3XL,
                ),
            ],
            bgcolor=BACKGROUND,
        )

    # Not Found View
    def not_found_view():
        return ft.View(
            "/404",
            controls=[
                ft.Container(
                    content=ft.Column(
                        controls=[
                            ft.Text(
                                "404",
                                size=FONT_6XL,
                                weight=FONT_BOLD,
                                color=PRIMARY_RED,
                            ),
                            ft.Text(
                                "Page Not Found",
                                size=FONT_2XL,
                                color=BONE_WHITE,
                            ),
                            ft.Container(height=SPACING_LG),
                            ft.ElevatedButton(
                                "Go Home",
                                bgcolor=PRIMARY_RED,
                                color=BONE_WHITE,
                                on_click=lambda _: page.go("/landing"),
                            ),
                        ],
                        horizontal_alignment=ft.CrossAxisAlignment.CENTER,
                    ),
                    padding=SPACING_3XL,
                    alignment=ft.alignment.center,
                    expand=True,
                ),
            ],
            bgcolor=BACKGROUND,
        )

    # Set up routing
    page.on_route_change = route_change
    page.on_view_pop = view_pop

    # Navigate to initial route
    page.go("/landing")

if __name__ == "__main__":
    # Run the app on port 3001
    ft.app(target=main, view=ft.AppView.WEB_BROWSER, port=3001)
