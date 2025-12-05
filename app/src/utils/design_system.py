"""
Design System Constants
Matches the original React/Tailwind design system exactly
"""

# Brand Colors
PRIMARY_RED = "#FF3C3C"
CHARCOAL_BLACK = "#121212"
BONE_WHITE = "#F9F5EF"
MUTED_GRAY = "#4C4C4C"
ACCENT_YELLOW = "#FCDC58"

# Semantic Colors
BACKGROUND = CHARCOAL_BLACK
FOREGROUND = BONE_WHITE
PRIMARY = PRIMARY_RED
ACCENT = ACCENT_YELLOW

# UI Component Colors
BORDER_COLOR = "#2A2A2A"
INPUT_BG = "#1A1A1A"
CARD_BG = "#1A1A1A"
HOVER_BG = "#2A2A2A"

# Text Colors
TEXT_PRIMARY = BONE_WHITE
TEXT_SECONDARY = "#B0B0B0"
TEXT_MUTED = MUTED_GRAY
TEXT_ACCENT = ACCENT_YELLOW

# Status Colors
SUCCESS = "#10B981"
ERROR = "#EF4444"
WARNING = "#F59E0B"
INFO = "#3B82F6"

# Gradients
GRADIENT_PRIMARY = f"linear-gradient(135deg, {PRIMARY_RED} 0%, #C82E2E 100%)"

# Spacing (in pixels)
SPACING_XS = 4
SPACING_SM = 8
SPACING_MD = 16
SPACING_LG = 24
SPACING_XL = 32
SPACING_2XL = 48
SPACING_3XL = 64

# Border Radius
RADIUS_SM = 4
RADIUS_MD = 8
RADIUS_LG = 12
RADIUS_XL = 16
RADIUS_FULL = 9999

# Font Sizes
FONT_XS = 12
FONT_SM = 14
FONT_BASE = 16
FONT_LG = 18
FONT_XL = 20
FONT_2XL = 24
FONT_3XL = 30
FONT_4XL = 36
FONT_5XL = 48
FONT_6XL = 60

# Font Weights
FONT_NORMAL = "normal"
FONT_MEDIUM = "500"
FONT_SEMIBOLD = "600"
FONT_BOLD = "bold"

# Font Families
# Note: Flet uses system fonts or Google Fonts
# We'll approximate the original fonts
FONT_HEADING = "Space Grotesk"  # Primary heading font
FONT_BODY = "IBM Plex Sans"      # Body text font
FONT_SPRAY = "Permanent Marker"   # Decorative spray font
FONT_TYPEWRITER = "Special Elite" # Monospace/typewriter font

# Container Max Widths
CONTAINER_SM = 640
CONTAINER_MD = 768
CONTAINER_LG = 1024
CONTAINER_XL = 1280
CONTAINER_2XL = 1536

# Z-Index Layers
Z_DROPDOWN = 1000
Z_STICKY = 1020
Z_FIXED = 1030
Z_MODAL_BACKDROP = 1040
Z_MODAL = 1050
Z_POPOVER = 1060
Z_TOOLTIP = 1070

# Animation Durations (in milliseconds)
DURATION_FAST = 150
DURATION_NORMAL = 300
DURATION_SLOW = 500

# Breakpoints (for responsive design)
BREAKPOINT_SM = 640
BREAKPOINT_MD = 768
BREAKPOINT_LG = 1024
BREAKPOINT_XL = 1280
BREAKPOINT_2XL = 1536

# Shadow Definitions
SHADOW_SM = "0 1px 2px 0 rgba(0, 0, 0, 0.05)"
SHADOW_MD = "0 4px 6px -1px rgba(0, 0, 0, 0.1)"
SHADOW_LG = "0 10px 15px -3px rgba(0, 0, 0, 0.1)"
SHADOW_XL = "0 20px 25px -5px rgba(0, 0, 0, 0.1)"

# Common Component Styles
BUTTON_PRIMARY = {
    "bgcolor": PRIMARY_RED,
    "color": BONE_WHITE,
    "border_radius": RADIUS_MD,
    "padding": SPACING_MD,
}

BUTTON_SECONDARY = {
    "bgcolor": MUTED_GRAY,
    "color": BONE_WHITE,
    "border_radius": RADIUS_MD,
    "padding": SPACING_MD,
}

BUTTON_GHOST = {
    "bgcolor": "transparent",
    "color": BONE_WHITE,
    "border": f"1px solid {BORDER_COLOR}",
    "border_radius": RADIUS_MD,
    "padding": SPACING_MD,
}

CARD_STYLE = {
    "bgcolor": CARD_BG,
    "border": f"1px solid {BORDER_COLOR}",
    "border_radius": RADIUS_LG,
    "padding": SPACING_LG,
}

INPUT_STYLE = {
    "bgcolor": INPUT_BG,
    "color": TEXT_PRIMARY,
    "border": f"1px solid {BORDER_COLOR}",
    "border_radius": RADIUS_MD,
    "padding": SPACING_SM,
}
