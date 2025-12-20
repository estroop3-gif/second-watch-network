"""
SWN Brand Styles - Consistent styling across the desktop app.
Matches the Second Watch Network website design.
"""

# Brand Colors
COLORS = {
    "charcoal-black": "#1a1a1a",
    "charcoal-dark": "#0d0d0d",
    "charcoal-light": "#262626",
    "bone-white": "#f5f5dc",
    "accent-yellow": "#fbbf24",
    "muted-gray": "#999999",
    "muted-gray-dark": "#666666",
    "border-gray": "#333333",
    "green": "#22c55e",
    "red": "#ef4444",
    "blue": "#3b82f6",
    "orange": "#f97316",
}

# Main Application Stylesheet
APP_STYLESHEET = f"""
/* ========================================
   SWN Dailies Helper - Brand Stylesheet
   ======================================== */

/* Main Window */
QMainWindow {{
    background-color: {COLORS['charcoal-black']};
}}

QWidget {{
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    font-size: 13px;
    color: {COLORS['bone-white']};
}}

/* Sidebar */
#sidebar {{
    background-color: {COLORS['charcoal-dark']};
    border-right: 1px solid {COLORS['border-gray']};
}}

#sidebar-title {{
    font-size: 20px;
    font-weight: bold;
    color: {COLORS['accent-yellow']};
    padding: 20px;
}}

#sidebar-subtitle {{
    font-size: 12px;
    color: {COLORS['muted-gray']};
    padding: 0 20px 20px 20px;
}}

/* Navigation Buttons */
#nav-button {{
    text-align: left;
    padding: 14px 20px;
    border: none;
    border-left: 3px solid transparent;
    background-color: transparent;
    color: {COLORS['muted-gray']};
    font-size: 14px;
    font-weight: 500;
}}

#nav-button:hover {{
    background-color: {COLORS['charcoal-light']};
    color: {COLORS['bone-white']};
}}

#nav-button[active="true"] {{
    background-color: {COLORS['charcoal-light']};
    color: {COLORS['accent-yellow']};
    border-left-color: {COLORS['accent-yellow']};
}}

/* Connection Status */
#connection-status {{
    font-size: 12px;
    padding: 15px 20px;
    border-top: 1px solid {COLORS['border-gray']};
}}

#connection-status[connected="true"] {{
    color: {COLORS['green']};
}}

#connection-status[connected="false"] {{
    color: {COLORS['muted-gray']};
}}

/* Status Bar */
QStatusBar {{
    background-color: {COLORS['charcoal-dark']};
    color: {COLORS['muted-gray-dark']};
    border-top: 1px solid {COLORS['border-gray']};
    padding: 5px 10px;
}}

/* Page Title */
#page-title {{
    font-size: 24px;
    font-weight: bold;
    color: {COLORS['bone-white']};
    margin-bottom: 5px;
}}

#page-subtitle {{
    font-size: 14px;
    color: {COLORS['muted-gray']};
}}

/* Cards / Panels */
#card {{
    background-color: {COLORS['charcoal-light']};
    border: 1px solid {COLORS['border-gray']};
    border-radius: 8px;
    padding: 20px;
}}

#card-title {{
    font-size: 16px;
    font-weight: bold;
    color: {COLORS['bone-white']};
    margin-bottom: 10px;
}}

/* Inputs */
QLineEdit {{
    background-color: {COLORS['charcoal-black']};
    border: 1px solid {COLORS['border-gray']};
    border-radius: 6px;
    padding: 10px 12px;
    color: {COLORS['bone-white']};
    font-size: 14px;
    selection-background-color: {COLORS['accent-yellow']};
    selection-color: {COLORS['charcoal-black']};
}}

QLineEdit:focus {{
    border-color: {COLORS['accent-yellow']};
}}

QLineEdit:disabled {{
    background-color: {COLORS['charcoal-light']};
    color: {COLORS['muted-gray']};
}}

QLineEdit::placeholder {{
    color: {COLORS['muted-gray-dark']};
}}

/* Combo Box */
QComboBox {{
    background-color: {COLORS['charcoal-black']};
    border: 1px solid {COLORS['border-gray']};
    border-radius: 6px;
    padding: 10px 12px;
    color: {COLORS['bone-white']};
    font-size: 14px;
    min-width: 150px;
}}

QComboBox:hover {{
    border-color: {COLORS['muted-gray']};
}}

QComboBox:focus {{
    border-color: {COLORS['accent-yellow']};
}}

QComboBox::drop-down {{
    border: none;
    width: 30px;
}}

QComboBox::down-arrow {{
    image: none;
    border-left: 5px solid transparent;
    border-right: 5px solid transparent;
    border-top: 6px solid {COLORS['muted-gray']};
    margin-right: 10px;
}}

QComboBox QAbstractItemView {{
    background-color: {COLORS['charcoal-light']};
    border: 1px solid {COLORS['border-gray']};
    selection-background-color: {COLORS['accent-yellow']};
    selection-color: {COLORS['charcoal-black']};
    outline: none;
}}

/* Buttons */
QPushButton {{
    background-color: {COLORS['border-gray']};
    border: none;
    border-radius: 6px;
    padding: 10px 20px;
    color: {COLORS['bone-white']};
    font-size: 14px;
    font-weight: 500;
}}

QPushButton:hover {{
    background-color: #404040;
}}

QPushButton:pressed {{
    background-color: {COLORS['charcoal-light']};
}}

QPushButton:disabled {{
    background-color: {COLORS['charcoal-light']};
    color: {COLORS['muted-gray-dark']};
}}

#primary-button {{
    background-color: {COLORS['accent-yellow']};
    color: {COLORS['charcoal-black']};
    font-weight: bold;
}}

#primary-button:hover {{
    background-color: {COLORS['bone-white']};
}}

#primary-button:pressed {{
    background-color: #e0d4b8;
}}

#primary-button:disabled {{
    background-color: {COLORS['muted-gray-dark']};
    color: {COLORS['charcoal-black']};
}}

#danger-button {{
    background-color: transparent;
    color: {COLORS['red']};
    border: 1px solid {COLORS['red']};
}}

#danger-button:hover {{
    background-color: {COLORS['red']};
    color: {COLORS['bone-white']};
}}

/* Checkbox */
QCheckBox {{
    color: {COLORS['bone-white']};
    spacing: 8px;
}}

QCheckBox::indicator {{
    width: 18px;
    height: 18px;
    border: 2px solid {COLORS['border-gray']};
    border-radius: 4px;
    background-color: {COLORS['charcoal-black']};
}}

QCheckBox::indicator:hover {{
    border-color: {COLORS['muted-gray']};
}}

QCheckBox::indicator:checked {{
    background-color: {COLORS['accent-yellow']};
    border-color: {COLORS['accent-yellow']};
}}

/* Progress Bar */
QProgressBar {{
    border: 1px solid {COLORS['border-gray']};
    border-radius: 6px;
    background-color: {COLORS['charcoal-black']};
    height: 24px;
    text-align: center;
    color: {COLORS['bone-white']};
}}

QProgressBar::chunk {{
    background-color: {COLORS['accent-yellow']};
    border-radius: 5px;
}}

/* List Widget */
QListWidget {{
    background-color: {COLORS['charcoal-black']};
    border: 1px solid {COLORS['border-gray']};
    border-radius: 6px;
    outline: none;
}}

QListWidget::item {{
    padding: 12px;
    border-bottom: 1px solid {COLORS['border-gray']};
}}

QListWidget::item:last-child {{
    border-bottom: none;
}}

QListWidget::item:hover {{
    background-color: {COLORS['charcoal-light']};
}}

QListWidget::item:selected {{
    background-color: {COLORS['accent-yellow']};
    color: {COLORS['charcoal-black']};
}}

/* Scroll Bar */
QScrollBar:vertical {{
    background-color: {COLORS['charcoal-black']};
    width: 12px;
    border-radius: 6px;
}}

QScrollBar::handle:vertical {{
    background-color: {COLORS['border-gray']};
    border-radius: 6px;
    min-height: 30px;
}}

QScrollBar::handle:vertical:hover {{
    background-color: {COLORS['muted-gray-dark']};
}}

QScrollBar::add-line:vertical,
QScrollBar::sub-line:vertical {{
    height: 0;
}}

/* Labels */
QLabel {{
    color: {COLORS['bone-white']};
}}

#label-muted {{
    color: {COLORS['muted-gray']};
}}

#label-small {{
    font-size: 12px;
    color: {COLORS['muted-gray']};
}}

/* Group Box */
QGroupBox {{
    font-size: 14px;
    font-weight: bold;
    color: {COLORS['bone-white']};
    border: 1px solid {COLORS['border-gray']};
    border-radius: 8px;
    margin-top: 12px;
    padding-top: 24px;
}}

QGroupBox::title {{
    subcontrol-origin: margin;
    left: 16px;
    padding: 0 8px;
}}

/* Spin Box */
QSpinBox {{
    background-color: {COLORS['charcoal-black']};
    border: 1px solid {COLORS['border-gray']};
    border-radius: 6px;
    padding: 8px 12px;
    color: {COLORS['bone-white']};
}}

QSpinBox:focus {{
    border-color: {COLORS['accent-yellow']};
}}

/* Tooltips */
QToolTip {{
    background-color: {COLORS['charcoal-light']};
    color: {COLORS['bone-white']};
    border: 1px solid {COLORS['border-gray']};
    padding: 8px;
    border-radius: 4px;
}}
"""
