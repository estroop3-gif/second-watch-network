"""
Budget Template Registry - Department Bundles for Professional Film/TV Budgets

This module provides industry-standard budget categories and department bundles
that can be selectively added to budgets. Templates are building blocks, NOT
auto-filled spreadsheets.

Key design principles:
1. NO auto-populating giant templates
2. Users explicitly choose what to seed
3. Department bundles are small, meaningful sets of common line items
4. Templates serve as a menu, not auto-fill
"""
from typing import List, Dict, Optional
from pydantic import BaseModel
from enum import Enum


class BudgetProjectType(str, Enum):
    """Project type templates available"""
    FEATURE = "feature"
    EPISODIC = "episodic"
    DOCUMENTARY = "documentary"
    MUSIC_VIDEO = "music_video"
    COMMERCIAL = "commercial"
    SHORT = "short"
    CUSTOM = "custom"


class CategoryType(str, Enum):
    """Top Sheet grouping types"""
    ABOVE_THE_LINE = "above_the_line"
    PRODUCTION = "production"
    POST = "post"
    OTHER = "other"


class BudgetPhase(str, Enum):
    """Production phases"""
    DEVELOPMENT = "development"
    PREP = "prep"
    PRODUCTION = "production"
    WRAP = "wrap"
    POST = "post"
    DELIVERY = "delivery"


class CalcMode(str, Enum):
    """Calculation modes for line items"""
    FLAT = "flat"
    RATE_X_DAYS = "rate_x_days"
    RATE_X_WEEKS = "rate_x_weeks"
    RATE_X_UNITS = "rate_x_units"
    RATE_X_EPISODES = "rate_x_episodes"
    RATE_X_HOURS = "rate_x_hours"


# =============================================================================
# TEMPLATE LINE ITEM DEFINITION
# =============================================================================

class TemplateLineItem(BaseModel):
    """A single line item template"""
    account_code: str
    description: str
    calc_mode: CalcMode = CalcMode.FLAT
    default_units: str = ""
    department: Optional[str] = None
    phase: Optional[BudgetPhase] = None
    is_essential: bool = False  # True = included in core essentials bundle


class TemplateCategory(BaseModel):
    """A budget category template"""
    name: str
    code: str
    account_code_prefix: str
    category_type: CategoryType
    sort_order: int
    color: str = "#6b7280"
    line_items: List[TemplateLineItem] = []


class DepartmentBundle(BaseModel):
    """A department bundle - a small set of common line items"""
    id: str
    name: str
    description: str
    category_type: CategoryType
    icon: str = ""  # Lucide icon name
    categories: List[TemplateCategory]


# =============================================================================
# DEPARTMENT BUNDLE DEFINITIONS
# Each bundle provides a small, meaningful set of starting lines
# =============================================================================

# --- ABOVE THE LINE BUNDLES ---

ATL_STORY_RIGHTS_BUNDLE = DepartmentBundle(
    id="atl_story_rights",
    name="Story Rights & Development",
    description="Writer fees, story rights, and development costs",
    category_type=CategoryType.ABOVE_THE_LINE,
    icon="FileText",
    categories=[
        TemplateCategory(
            name="Story Rights & Development",
            code="100",
            account_code_prefix="100",
            category_type=CategoryType.ABOVE_THE_LINE,
            sort_order=1,
            color="#ef4444",
            line_items=[
                TemplateLineItem(account_code="100-01", description="Story Rights/Option", calc_mode=CalcMode.FLAT, is_essential=True),
                TemplateLineItem(account_code="100-02", description="Screenplay Purchase", calc_mode=CalcMode.FLAT),
                TemplateLineItem(account_code="100-03", description="Writer - First Draft", calc_mode=CalcMode.FLAT, is_essential=True),
                TemplateLineItem(account_code="100-04", description="Writer - Revisions", calc_mode=CalcMode.FLAT),
                TemplateLineItem(account_code="100-05", description="Script Consultant", calc_mode=CalcMode.FLAT),
            ]
        )
    ]
)

ATL_PRODUCER_BUNDLE = DepartmentBundle(
    id="atl_producer",
    name="Producers",
    description="Producer fees and associate producers",
    category_type=CategoryType.ABOVE_THE_LINE,
    icon="Users",
    categories=[
        TemplateCategory(
            name="Producers",
            code="110",
            account_code_prefix="110",
            category_type=CategoryType.ABOVE_THE_LINE,
            sort_order=2,
            color="#f97316",
            line_items=[
                TemplateLineItem(account_code="110-01", description="Executive Producer", calc_mode=CalcMode.FLAT, is_essential=True),
                TemplateLineItem(account_code="110-02", description="Producer", calc_mode=CalcMode.FLAT, is_essential=True),
                TemplateLineItem(account_code="110-03", description="Co-Producer", calc_mode=CalcMode.FLAT),
                TemplateLineItem(account_code="110-04", description="Associate Producer", calc_mode=CalcMode.FLAT),
                TemplateLineItem(account_code="110-05", description="Line Producer", calc_mode=CalcMode.RATE_X_WEEKS, is_essential=True),
            ]
        )
    ]
)

ATL_DIRECTOR_BUNDLE = DepartmentBundle(
    id="atl_director",
    name="Director",
    description="Director fees and prep/post",
    category_type=CategoryType.ABOVE_THE_LINE,
    icon="Clapperboard",
    categories=[
        TemplateCategory(
            name="Director",
            code="120",
            account_code_prefix="120",
            category_type=CategoryType.ABOVE_THE_LINE,
            sort_order=3,
            color="#eab308",
            line_items=[
                TemplateLineItem(account_code="120-01", description="Director - Prep", calc_mode=CalcMode.RATE_X_WEEKS, phase=BudgetPhase.PREP, is_essential=True),
                TemplateLineItem(account_code="120-02", description="Director - Shoot", calc_mode=CalcMode.RATE_X_DAYS, phase=BudgetPhase.PRODUCTION, is_essential=True),
                TemplateLineItem(account_code="120-03", description="Director - Post", calc_mode=CalcMode.RATE_X_WEEKS, phase=BudgetPhase.POST),
                TemplateLineItem(account_code="120-04", description="Second Unit Director", calc_mode=CalcMode.RATE_X_DAYS),
            ]
        )
    ]
)

ATL_CAST_BUNDLE = DepartmentBundle(
    id="atl_cast",
    name="Cast / Talent",
    description="Principal cast and day players",
    category_type=CategoryType.ABOVE_THE_LINE,
    icon="Star",
    categories=[
        TemplateCategory(
            name="Cast",
            code="130",
            account_code_prefix="130",
            category_type=CategoryType.ABOVE_THE_LINE,
            sort_order=4,
            color="#84cc16",
            line_items=[
                TemplateLineItem(account_code="130-01", description="Lead #1", calc_mode=CalcMode.FLAT, is_essential=True),
                TemplateLineItem(account_code="130-02", description="Lead #2", calc_mode=CalcMode.FLAT),
                TemplateLineItem(account_code="130-03", description="Supporting Cast", calc_mode=CalcMode.RATE_X_DAYS),
                TemplateLineItem(account_code="130-04", description="Day Players", calc_mode=CalcMode.RATE_X_DAYS, is_essential=True),
                TemplateLineItem(account_code="130-05", description="Casting Director", calc_mode=CalcMode.FLAT, is_essential=True),
                TemplateLineItem(account_code="130-06", description="Casting Sessions", calc_mode=CalcMode.FLAT),
            ]
        )
    ]
)

# --- PRODUCTION (BTL) BUNDLES ---

PRODUCTION_STAFF_BUNDLE = DepartmentBundle(
    id="prod_staff",
    name="Production Staff",
    description="UPM, ADs, coordinators, and PAs",
    category_type=CategoryType.PRODUCTION,
    icon="ClipboardList",
    categories=[
        TemplateCategory(
            name="Production Staff",
            code="200",
            account_code_prefix="200",
            category_type=CategoryType.PRODUCTION,
            sort_order=10,
            color="#22c55e",
            line_items=[
                TemplateLineItem(account_code="200-01", description="Unit Production Manager", calc_mode=CalcMode.RATE_X_WEEKS, department="Production", is_essential=True),
                TemplateLineItem(account_code="200-02", description="First AD - Prep", calc_mode=CalcMode.RATE_X_WEEKS, department="Production", phase=BudgetPhase.PREP, is_essential=True),
                TemplateLineItem(account_code="200-03", description="First AD - Shoot", calc_mode=CalcMode.RATE_X_DAYS, department="Production", phase=BudgetPhase.PRODUCTION, is_essential=True),
                TemplateLineItem(account_code="200-04", description="Second AD", calc_mode=CalcMode.RATE_X_DAYS, department="Production"),
                TemplateLineItem(account_code="200-05", description="Production Coordinator", calc_mode=CalcMode.RATE_X_WEEKS, department="Production", is_essential=True),
                TemplateLineItem(account_code="200-06", description="APOC", calc_mode=CalcMode.RATE_X_WEEKS, department="Production"),
                TemplateLineItem(account_code="200-07", description="Production Secretary", calc_mode=CalcMode.RATE_X_WEEKS, department="Production"),
                TemplateLineItem(account_code="200-08", description="Set PA", calc_mode=CalcMode.RATE_X_DAYS, department="Production", is_essential=True),
                TemplateLineItem(account_code="200-09", description="Office PA", calc_mode=CalcMode.RATE_X_WEEKS, department="Production"),
            ]
        )
    ]
)

CAMERA_BUNDLE = DepartmentBundle(
    id="camera",
    name="Camera Department",
    description="DP, operators, ACs, and camera equipment",
    category_type=CategoryType.PRODUCTION,
    icon="Camera",
    categories=[
        TemplateCategory(
            name="Camera",
            code="210",
            account_code_prefix="210",
            category_type=CategoryType.PRODUCTION,
            sort_order=11,
            color="#14b8a6",
            line_items=[
                TemplateLineItem(account_code="210-01", description="Director of Photography - Prep", calc_mode=CalcMode.RATE_X_DAYS, department="Camera", phase=BudgetPhase.PREP, is_essential=True),
                TemplateLineItem(account_code="210-02", description="Director of Photography - Shoot", calc_mode=CalcMode.RATE_X_DAYS, department="Camera", phase=BudgetPhase.PRODUCTION, is_essential=True),
                TemplateLineItem(account_code="210-03", description="Camera Operator", calc_mode=CalcMode.RATE_X_DAYS, department="Camera"),
                TemplateLineItem(account_code="210-04", description="1st AC", calc_mode=CalcMode.RATE_X_DAYS, department="Camera", is_essential=True),
                TemplateLineItem(account_code="210-05", description="2nd AC", calc_mode=CalcMode.RATE_X_DAYS, department="Camera"),
                TemplateLineItem(account_code="210-06", description="DIT", calc_mode=CalcMode.RATE_X_DAYS, department="Camera"),
                TemplateLineItem(account_code="210-07", description="Camera Package Rental", calc_mode=CalcMode.RATE_X_DAYS, department="Camera", is_essential=True),
                TemplateLineItem(account_code="210-08", description="Lenses Rental", calc_mode=CalcMode.RATE_X_DAYS, department="Camera"),
                TemplateLineItem(account_code="210-09", description="Camera Expendables", calc_mode=CalcMode.FLAT, department="Camera"),
            ]
        )
    ]
)

GRIP_ELECTRIC_BUNDLE = DepartmentBundle(
    id="grip_electric",
    name="Grip & Electric",
    description="Gaffer, key grip, best boys, and G&E package",
    category_type=CategoryType.PRODUCTION,
    icon="Lightbulb",
    categories=[
        TemplateCategory(
            name="Grip & Electric",
            code="220",
            account_code_prefix="220",
            category_type=CategoryType.PRODUCTION,
            sort_order=12,
            color="#0ea5e9",
            line_items=[
                TemplateLineItem(account_code="220-01", description="Gaffer", calc_mode=CalcMode.RATE_X_DAYS, department="G&E", is_essential=True),
                TemplateLineItem(account_code="220-02", description="Best Boy Electric", calc_mode=CalcMode.RATE_X_DAYS, department="G&E"),
                TemplateLineItem(account_code="220-03", description="Electrician", calc_mode=CalcMode.RATE_X_DAYS, department="G&E"),
                TemplateLineItem(account_code="220-04", description="Key Grip", calc_mode=CalcMode.RATE_X_DAYS, department="G&E", is_essential=True),
                TemplateLineItem(account_code="220-05", description="Best Boy Grip", calc_mode=CalcMode.RATE_X_DAYS, department="G&E"),
                TemplateLineItem(account_code="220-06", description="Dolly Grip", calc_mode=CalcMode.RATE_X_DAYS, department="G&E"),
                TemplateLineItem(account_code="220-07", description="Grip", calc_mode=CalcMode.RATE_X_DAYS, department="G&E"),
                TemplateLineItem(account_code="220-08", description="Lighting Package Rental", calc_mode=CalcMode.RATE_X_DAYS, department="G&E", is_essential=True),
                TemplateLineItem(account_code="220-09", description="Grip Package Rental", calc_mode=CalcMode.RATE_X_DAYS, department="G&E", is_essential=True),
                TemplateLineItem(account_code="220-10", description="Generator", calc_mode=CalcMode.RATE_X_DAYS, department="G&E"),
                TemplateLineItem(account_code="220-11", description="G&E Expendables", calc_mode=CalcMode.FLAT, department="G&E"),
            ]
        )
    ]
)

SOUND_BUNDLE = DepartmentBundle(
    id="sound",
    name="Sound Department",
    description="Production sound mixer, boom operator, and equipment",
    category_type=CategoryType.PRODUCTION,
    icon="Mic",
    categories=[
        TemplateCategory(
            name="Sound",
            code="230",
            account_code_prefix="230",
            category_type=CategoryType.PRODUCTION,
            sort_order=13,
            color="#6366f1",
            line_items=[
                TemplateLineItem(account_code="230-01", description="Production Sound Mixer", calc_mode=CalcMode.RATE_X_DAYS, department="Sound", is_essential=True),
                TemplateLineItem(account_code="230-02", description="Boom Operator", calc_mode=CalcMode.RATE_X_DAYS, department="Sound"),
                TemplateLineItem(account_code="230-03", description="Sound Utility", calc_mode=CalcMode.RATE_X_DAYS, department="Sound"),
                TemplateLineItem(account_code="230-04", description="Sound Package Rental", calc_mode=CalcMode.RATE_X_DAYS, department="Sound", is_essential=True),
                TemplateLineItem(account_code="230-05", description="Wireless Lavs", calc_mode=CalcMode.RATE_X_DAYS, department="Sound"),
                TemplateLineItem(account_code="230-06", description="Sound Expendables", calc_mode=CalcMode.FLAT, department="Sound"),
            ]
        )
    ]
)

ART_DEPARTMENT_BUNDLE = DepartmentBundle(
    id="art_dept",
    name="Art Department",
    description="Production designer, art director, set decoration",
    category_type=CategoryType.PRODUCTION,
    icon="Palette",
    categories=[
        TemplateCategory(
            name="Art Department",
            code="240",
            account_code_prefix="240",
            category_type=CategoryType.PRODUCTION,
            sort_order=14,
            color="#a855f7",
            line_items=[
                TemplateLineItem(account_code="240-01", description="Production Designer", calc_mode=CalcMode.RATE_X_WEEKS, department="Art", is_essential=True),
                TemplateLineItem(account_code="240-02", description="Art Director", calc_mode=CalcMode.RATE_X_WEEKS, department="Art"),
                TemplateLineItem(account_code="240-03", description="Set Decorator", calc_mode=CalcMode.RATE_X_WEEKS, department="Art"),
                TemplateLineItem(account_code="240-04", description="Leadman", calc_mode=CalcMode.RATE_X_DAYS, department="Art"),
                TemplateLineItem(account_code="240-05", description="Set Dresser", calc_mode=CalcMode.RATE_X_DAYS, department="Art"),
                TemplateLineItem(account_code="240-06", description="Props Master", calc_mode=CalcMode.RATE_X_DAYS, department="Art"),
                TemplateLineItem(account_code="240-07", description="Art Department Rentals", calc_mode=CalcMode.FLAT, department="Art"),
                TemplateLineItem(account_code="240-08", description="Set Dressing Purchases", calc_mode=CalcMode.FLAT, department="Art", is_essential=True),
                TemplateLineItem(account_code="240-09", description="Props Purchases", calc_mode=CalcMode.FLAT, department="Art"),
            ]
        )
    ]
)

WARDROBE_BUNDLE = DepartmentBundle(
    id="wardrobe",
    name="Wardrobe",
    description="Costume designer and wardrobe purchases/rentals",
    category_type=CategoryType.PRODUCTION,
    icon="Shirt",
    categories=[
        TemplateCategory(
            name="Wardrobe",
            code="250",
            account_code_prefix="250",
            category_type=CategoryType.PRODUCTION,
            sort_order=15,
            color="#ec4899",
            line_items=[
                TemplateLineItem(account_code="250-01", description="Costume Designer", calc_mode=CalcMode.RATE_X_WEEKS, department="Wardrobe", is_essential=True),
                TemplateLineItem(account_code="250-02", description="Costume Supervisor", calc_mode=CalcMode.RATE_X_DAYS, department="Wardrobe"),
                TemplateLineItem(account_code="250-03", description="Set Costumer", calc_mode=CalcMode.RATE_X_DAYS, department="Wardrobe"),
                TemplateLineItem(account_code="250-04", description="Wardrobe Purchases", calc_mode=CalcMode.FLAT, department="Wardrobe", is_essential=True),
                TemplateLineItem(account_code="250-05", description="Wardrobe Rentals", calc_mode=CalcMode.FLAT, department="Wardrobe"),
                TemplateLineItem(account_code="250-06", description="Cleaning & Alterations", calc_mode=CalcMode.FLAT, department="Wardrobe"),
            ]
        )
    ]
)

HAIR_MAKEUP_BUNDLE = DepartmentBundle(
    id="hair_makeup",
    name="Hair & Makeup",
    description="Hair and makeup artists and supplies",
    category_type=CategoryType.PRODUCTION,
    icon="Sparkles",
    categories=[
        TemplateCategory(
            name="Hair & Makeup",
            code="260",
            account_code_prefix="260",
            category_type=CategoryType.PRODUCTION,
            sort_order=16,
            color="#f43f5e",
            line_items=[
                TemplateLineItem(account_code="260-01", description="Key Makeup Artist", calc_mode=CalcMode.RATE_X_DAYS, department="HMU", is_essential=True),
                TemplateLineItem(account_code="260-02", description="Additional Makeup Artist", calc_mode=CalcMode.RATE_X_DAYS, department="HMU"),
                TemplateLineItem(account_code="260-03", description="Key Hair Stylist", calc_mode=CalcMode.RATE_X_DAYS, department="HMU", is_essential=True),
                TemplateLineItem(account_code="260-04", description="Additional Hair Stylist", calc_mode=CalcMode.RATE_X_DAYS, department="HMU"),
                TemplateLineItem(account_code="260-05", description="HMU Supplies", calc_mode=CalcMode.FLAT, department="HMU", is_essential=True),
                TemplateLineItem(account_code="260-06", description="Wigs & Prosthetics", calc_mode=CalcMode.FLAT, department="HMU"),
            ]
        )
    ]
)

LOCATIONS_BUNDLE = DepartmentBundle(
    id="locations",
    name="Locations",
    description="Location manager, scouts, fees, and permits",
    category_type=CategoryType.PRODUCTION,
    icon="MapPin",
    categories=[
        TemplateCategory(
            name="Locations",
            code="270",
            account_code_prefix="270",
            category_type=CategoryType.PRODUCTION,
            sort_order=17,
            color="#f59e0b",
            line_items=[
                TemplateLineItem(account_code="270-01", description="Location Manager", calc_mode=CalcMode.RATE_X_WEEKS, department="Locations", is_essential=True),
                TemplateLineItem(account_code="270-02", description="Location Scout", calc_mode=CalcMode.RATE_X_DAYS, department="Locations"),
                TemplateLineItem(account_code="270-03", description="Location Fees", calc_mode=CalcMode.FLAT, department="Locations", is_essential=True),
                TemplateLineItem(account_code="270-04", description="Permits", calc_mode=CalcMode.FLAT, department="Locations", is_essential=True),
                TemplateLineItem(account_code="270-05", description="Police/Fire/Security", calc_mode=CalcMode.RATE_X_DAYS, department="Locations"),
                TemplateLineItem(account_code="270-06", description="Location Site Rentals", calc_mode=CalcMode.FLAT, department="Locations"),
                TemplateLineItem(account_code="270-07", description="Parking", calc_mode=CalcMode.FLAT, department="Locations"),
            ]
        )
    ]
)

TRANSPORTATION_BUNDLE = DepartmentBundle(
    id="transportation",
    name="Transportation",
    description="Transportation captain, drivers, and vehicles",
    category_type=CategoryType.PRODUCTION,
    icon="Truck",
    categories=[
        TemplateCategory(
            name="Transportation",
            code="280",
            account_code_prefix="280",
            category_type=CategoryType.PRODUCTION,
            sort_order=18,
            color="#64748b",
            line_items=[
                TemplateLineItem(account_code="280-01", description="Transportation Captain", calc_mode=CalcMode.RATE_X_DAYS, department="Transportation"),
                TemplateLineItem(account_code="280-02", description="Drivers", calc_mode=CalcMode.RATE_X_DAYS, department="Transportation"),
                TemplateLineItem(account_code="280-03", description="Production Van", calc_mode=CalcMode.RATE_X_DAYS, department="Transportation", is_essential=True),
                TemplateLineItem(account_code="280-04", description="Cube Truck", calc_mode=CalcMode.RATE_X_DAYS, department="Transportation"),
                TemplateLineItem(account_code="280-05", description="Honeywagon", calc_mode=CalcMode.RATE_X_DAYS, department="Transportation"),
                TemplateLineItem(account_code="280-06", description="Cast Trailers", calc_mode=CalcMode.RATE_X_DAYS, department="Transportation"),
                TemplateLineItem(account_code="280-07", description="Fuel", calc_mode=CalcMode.FLAT, department="Transportation", is_essential=True),
                TemplateLineItem(account_code="280-08", description="Mileage", calc_mode=CalcMode.FLAT, department="Transportation"),
            ]
        )
    ]
)

CATERING_BUNDLE = DepartmentBundle(
    id="catering",
    name="Catering & Craft Services",
    description="Meals and craft services",
    category_type=CategoryType.PRODUCTION,
    icon="UtensilsCrossed",
    categories=[
        TemplateCategory(
            name="Catering & Craft",
            code="290",
            account_code_prefix="290",
            category_type=CategoryType.PRODUCTION,
            sort_order=19,
            color="#10b981",
            line_items=[
                TemplateLineItem(account_code="290-01", description="Catering", calc_mode=CalcMode.RATE_X_DAYS, department="Catering", is_essential=True),
                TemplateLineItem(account_code="290-02", description="Craft Services", calc_mode=CalcMode.RATE_X_DAYS, department="Catering", is_essential=True),
                TemplateLineItem(account_code="290-03", description="Second Meal", calc_mode=CalcMode.RATE_X_DAYS, department="Catering"),
                TemplateLineItem(account_code="290-04", description="Craft Purchases", calc_mode=CalcMode.FLAT, department="Catering"),
            ]
        )
    ]
)

# --- POST-PRODUCTION BUNDLES ---

POST_EDITORIAL_BUNDLE = DepartmentBundle(
    id="post_editorial",
    name="Editorial",
    description="Editor, assistant editor, and editing systems",
    category_type=CategoryType.POST,
    icon="Film",
    categories=[
        TemplateCategory(
            name="Editorial",
            code="300",
            account_code_prefix="300",
            category_type=CategoryType.POST,
            sort_order=30,
            color="#8b5cf6",
            line_items=[
                TemplateLineItem(account_code="300-01", description="Editor", calc_mode=CalcMode.RATE_X_WEEKS, department="Post", phase=BudgetPhase.POST, is_essential=True),
                TemplateLineItem(account_code="300-02", description="Assistant Editor", calc_mode=CalcMode.RATE_X_WEEKS, department="Post", phase=BudgetPhase.POST),
                TemplateLineItem(account_code="300-03", description="Editing System Rental", calc_mode=CalcMode.RATE_X_WEEKS, department="Post", phase=BudgetPhase.POST, is_essential=True),
                TemplateLineItem(account_code="300-04", description="Hard Drives/Storage", calc_mode=CalcMode.FLAT, department="Post", phase=BudgetPhase.POST, is_essential=True),
                TemplateLineItem(account_code="300-05", description="Post Supervisor", calc_mode=CalcMode.RATE_X_WEEKS, department="Post", phase=BudgetPhase.POST),
            ]
        )
    ]
)

POST_SOUND_BUNDLE = DepartmentBundle(
    id="post_sound",
    name="Post Sound",
    description="Sound design, ADR, Foley, and mix",
    category_type=CategoryType.POST,
    icon="Music",
    categories=[
        TemplateCategory(
            name="Post Sound",
            code="310",
            account_code_prefix="310",
            category_type=CategoryType.POST,
            sort_order=31,
            color="#3b82f6",
            line_items=[
                TemplateLineItem(account_code="310-01", description="Sound Designer/Supervising Sound Editor", calc_mode=CalcMode.FLAT, department="Post Sound", phase=BudgetPhase.POST, is_essential=True),
                TemplateLineItem(account_code="310-02", description="Dialogue Editor", calc_mode=CalcMode.FLAT, department="Post Sound", phase=BudgetPhase.POST),
                TemplateLineItem(account_code="310-03", description="ADR Recording", calc_mode=CalcMode.FLAT, department="Post Sound", phase=BudgetPhase.POST),
                TemplateLineItem(account_code="310-04", description="Foley", calc_mode=CalcMode.FLAT, department="Post Sound", phase=BudgetPhase.POST),
                TemplateLineItem(account_code="310-05", description="Sound Mix", calc_mode=CalcMode.RATE_X_DAYS, department="Post Sound", phase=BudgetPhase.POST, is_essential=True),
            ]
        )
    ]
)

POST_MUSIC_BUNDLE = DepartmentBundle(
    id="post_music",
    name="Music",
    description="Composer, score, and music licensing",
    category_type=CategoryType.POST,
    icon="Headphones",
    categories=[
        TemplateCategory(
            name="Music",
            code="320",
            account_code_prefix="320",
            category_type=CategoryType.POST,
            sort_order=32,
            color="#06b6d4",
            line_items=[
                TemplateLineItem(account_code="320-01", description="Composer", calc_mode=CalcMode.FLAT, department="Music", phase=BudgetPhase.POST, is_essential=True),
                TemplateLineItem(account_code="320-02", description="Score Recording", calc_mode=CalcMode.FLAT, department="Music", phase=BudgetPhase.POST),
                TemplateLineItem(account_code="320-03", description="Music Licensing", calc_mode=CalcMode.FLAT, department="Music", phase=BudgetPhase.POST),
                TemplateLineItem(account_code="320-04", description="Music Supervisor", calc_mode=CalcMode.FLAT, department="Music", phase=BudgetPhase.POST),
            ]
        )
    ]
)

POST_VFX_BUNDLE = DepartmentBundle(
    id="post_vfx",
    name="Visual Effects",
    description="VFX supervisor and effects work",
    category_type=CategoryType.POST,
    icon="Wand2",
    categories=[
        TemplateCategory(
            name="Visual Effects",
            code="330",
            account_code_prefix="330",
            category_type=CategoryType.POST,
            sort_order=33,
            color="#d946ef",
            line_items=[
                TemplateLineItem(account_code="330-01", description="VFX Supervisor", calc_mode=CalcMode.RATE_X_WEEKS, department="VFX", phase=BudgetPhase.POST),
                TemplateLineItem(account_code="330-02", description="VFX - Simple Shots", calc_mode=CalcMode.RATE_X_UNITS, department="VFX", phase=BudgetPhase.POST),
                TemplateLineItem(account_code="330-03", description="VFX - Complex Shots", calc_mode=CalcMode.RATE_X_UNITS, department="VFX", phase=BudgetPhase.POST),
                TemplateLineItem(account_code="330-04", description="VFX Package (Allow)", calc_mode=CalcMode.FLAT, department="VFX", phase=BudgetPhase.POST, is_essential=True),
            ]
        )
    ]
)

POST_COLOR_BUNDLE = DepartmentBundle(
    id="post_color",
    name="Color & Finish",
    description="Color correction and finishing",
    category_type=CategoryType.POST,
    icon="Droplet",
    categories=[
        TemplateCategory(
            name="Color & Finish",
            code="340",
            account_code_prefix="340",
            category_type=CategoryType.POST,
            sort_order=34,
            color="#f97316",
            line_items=[
                TemplateLineItem(account_code="340-01", description="Colorist", calc_mode=CalcMode.RATE_X_DAYS, department="Post", phase=BudgetPhase.POST, is_essential=True),
                TemplateLineItem(account_code="340-02", description="Color Suite", calc_mode=CalcMode.RATE_X_DAYS, department="Post", phase=BudgetPhase.POST, is_essential=True),
                TemplateLineItem(account_code="340-03", description="Conform/Online", calc_mode=CalcMode.RATE_X_DAYS, department="Post", phase=BudgetPhase.POST),
                TemplateLineItem(account_code="340-04", description="Deliverables", calc_mode=CalcMode.FLAT, department="Post", phase=BudgetPhase.DELIVERY, is_essential=True),
            ]
        )
    ]
)

# --- OTHER / OVERHEAD BUNDLES ---

INSURANCE_BUNDLE = DepartmentBundle(
    id="insurance",
    name="Insurance",
    description="Production insurance and E&O",
    category_type=CategoryType.OTHER,
    icon="Shield",
    categories=[
        TemplateCategory(
            name="Insurance",
            code="400",
            account_code_prefix="400",
            category_type=CategoryType.OTHER,
            sort_order=40,
            color="#64748b",
            line_items=[
                TemplateLineItem(account_code="400-01", description="Production Insurance", calc_mode=CalcMode.FLAT, is_essential=True),
                TemplateLineItem(account_code="400-02", description="E&O Insurance", calc_mode=CalcMode.FLAT),
                TemplateLineItem(account_code="400-03", description="Cast Insurance", calc_mode=CalcMode.FLAT),
                TemplateLineItem(account_code="400-04", description="Workers Comp", calc_mode=CalcMode.FLAT, is_essential=True),
            ]
        )
    ]
)

LEGAL_ACCOUNTING_BUNDLE = DepartmentBundle(
    id="legal_accounting",
    name="Legal & Accounting",
    description="Legal fees and production accounting",
    category_type=CategoryType.OTHER,
    icon="Scale",
    categories=[
        TemplateCategory(
            name="Legal & Accounting",
            code="410",
            account_code_prefix="410",
            category_type=CategoryType.OTHER,
            sort_order=41,
            color="#71717a",
            line_items=[
                TemplateLineItem(account_code="410-01", description="Legal Fees", calc_mode=CalcMode.FLAT),
                TemplateLineItem(account_code="410-02", description="Production Accountant", calc_mode=CalcMode.RATE_X_WEEKS, is_essential=True),
                TemplateLineItem(account_code="410-03", description="Payroll Service Fees", calc_mode=CalcMode.FLAT, is_essential=True),
                TemplateLineItem(account_code="410-04", description="Audit", calc_mode=CalcMode.FLAT),
            ]
        )
    ]
)

OFFICE_BUNDLE = DepartmentBundle(
    id="office",
    name="Production Office",
    description="Office rental, equipment, and supplies",
    category_type=CategoryType.OTHER,
    icon="Building2",
    categories=[
        TemplateCategory(
            name="Production Office",
            code="420",
            account_code_prefix="420",
            category_type=CategoryType.OTHER,
            sort_order=42,
            color="#94a3b8",
            line_items=[
                TemplateLineItem(account_code="420-01", description="Office Rental", calc_mode=CalcMode.RATE_X_WEEKS),
                TemplateLineItem(account_code="420-02", description="Office Equipment", calc_mode=CalcMode.FLAT),
                TemplateLineItem(account_code="420-03", description="Office Supplies", calc_mode=CalcMode.FLAT, is_essential=True),
                TemplateLineItem(account_code="420-04", description="Computer/IT", calc_mode=CalcMode.FLAT),
                TemplateLineItem(account_code="420-05", description="Phones/Internet", calc_mode=CalcMode.RATE_X_WEEKS),
                TemplateLineItem(account_code="420-06", description="Copying/Printing", calc_mode=CalcMode.FLAT),
            ]
        )
    ]
)

PUBLICITY_BUNDLE = DepartmentBundle(
    id="publicity",
    name="Publicity & Marketing",
    description="Stills photography, EPK, and marketing materials",
    category_type=CategoryType.OTHER,
    icon="Megaphone",
    categories=[
        TemplateCategory(
            name="Publicity",
            code="430",
            account_code_prefix="430",
            category_type=CategoryType.OTHER,
            sort_order=43,
            color="#f472b6",
            line_items=[
                TemplateLineItem(account_code="430-01", description="Still Photographer", calc_mode=CalcMode.RATE_X_DAYS),
                TemplateLineItem(account_code="430-02", description="EPK/BTS", calc_mode=CalcMode.FLAT),
                TemplateLineItem(account_code="430-03", description="Poster/Key Art", calc_mode=CalcMode.FLAT),
                TemplateLineItem(account_code="430-04", description="Press Kit", calc_mode=CalcMode.FLAT),
                TemplateLineItem(account_code="430-05", description="Festival Submissions", calc_mode=CalcMode.FLAT),
            ]
        )
    ]
)


# =============================================================================
# BUNDLE REGISTRY BY PROJECT TYPE
# =============================================================================

# All available bundles
ALL_BUNDLES: List[DepartmentBundle] = [
    # Above the Line
    ATL_STORY_RIGHTS_BUNDLE,
    ATL_PRODUCER_BUNDLE,
    ATL_DIRECTOR_BUNDLE,
    ATL_CAST_BUNDLE,
    # Production
    PRODUCTION_STAFF_BUNDLE,
    CAMERA_BUNDLE,
    GRIP_ELECTRIC_BUNDLE,
    SOUND_BUNDLE,
    ART_DEPARTMENT_BUNDLE,
    WARDROBE_BUNDLE,
    HAIR_MAKEUP_BUNDLE,
    LOCATIONS_BUNDLE,
    TRANSPORTATION_BUNDLE,
    CATERING_BUNDLE,
    # Post
    POST_EDITORIAL_BUNDLE,
    POST_SOUND_BUNDLE,
    POST_MUSIC_BUNDLE,
    POST_VFX_BUNDLE,
    POST_COLOR_BUNDLE,
    # Other
    INSURANCE_BUNDLE,
    LEGAL_ACCOUNTING_BUNDLE,
    OFFICE_BUNDLE,
    PUBLICITY_BUNDLE,
]

# Bundles recommended by project type
RECOMMENDED_BUNDLES: Dict[BudgetProjectType, List[str]] = {
    BudgetProjectType.FEATURE: [
        "atl_story_rights", "atl_producer", "atl_director", "atl_cast",
        "prod_staff", "camera", "grip_electric", "sound", "art_dept",
        "wardrobe", "hair_makeup", "locations", "transportation", "catering",
        "post_editorial", "post_sound", "post_music", "post_color",
        "insurance", "legal_accounting", "office"
    ],
    BudgetProjectType.EPISODIC: [
        "atl_producer", "atl_director", "atl_cast",
        "prod_staff", "camera", "grip_electric", "sound", "art_dept",
        "wardrobe", "hair_makeup", "locations", "catering",
        "post_editorial", "post_sound", "post_music", "post_color",
        "insurance", "legal_accounting"
    ],
    BudgetProjectType.DOCUMENTARY: [
        "atl_producer", "atl_director",
        "prod_staff", "camera", "sound", "locations",
        "post_editorial", "post_sound", "post_music",
        "insurance", "legal_accounting"
    ],
    BudgetProjectType.MUSIC_VIDEO: [
        "atl_director",
        "prod_staff", "camera", "grip_electric", "art_dept",
        "wardrobe", "hair_makeup", "locations", "catering",
        "post_editorial", "post_color",
        "insurance"
    ],
    BudgetProjectType.COMMERCIAL: [
        "atl_director",
        "prod_staff", "camera", "grip_electric", "sound",
        "art_dept", "wardrobe", "hair_makeup", "locations", "catering",
        "post_editorial", "post_sound", "post_color", "post_vfx",
        "insurance", "legal_accounting"
    ],
    BudgetProjectType.SHORT: [
        "atl_director", "atl_cast",
        "prod_staff", "camera", "grip_electric", "sound",
        "wardrobe", "hair_makeup", "locations", "catering",
        "post_editorial", "post_sound", "post_color",
        "insurance"
    ],
    BudgetProjectType.CUSTOM: []
}

# Core essentials (minimal budget) - only includes items marked is_essential=True
CORE_ESSENTIALS_BUNDLES = ["prod_staff", "camera", "sound", "catering", "post_editorial", "insurance"]


# =============================================================================
# TEMPLATE SERVICE FUNCTIONS
# =============================================================================

def get_all_bundles() -> List[DepartmentBundle]:
    """Get all available department bundles"""
    return ALL_BUNDLES


def get_bundle_by_id(bundle_id: str) -> Optional[DepartmentBundle]:
    """Get a specific bundle by ID"""
    for bundle in ALL_BUNDLES:
        if bundle.id == bundle_id:
            return bundle
    return None


def get_bundles_by_category_type(category_type: CategoryType) -> List[DepartmentBundle]:
    """Get all bundles for a specific category type"""
    return [b for b in ALL_BUNDLES if b.category_type == category_type]


def get_recommended_bundles(project_type: BudgetProjectType) -> List[DepartmentBundle]:
    """Get recommended bundles for a project type"""
    bundle_ids = RECOMMENDED_BUNDLES.get(project_type, [])
    return [b for b in ALL_BUNDLES if b.id in bundle_ids]


def get_core_essentials_bundles() -> List[DepartmentBundle]:
    """Get minimal core essentials bundles"""
    return [b for b in ALL_BUNDLES if b.id in CORE_ESSENTIALS_BUNDLES]


def get_high_level_categories(project_type: BudgetProjectType) -> List[TemplateCategory]:
    """
    Get just the high-level categories (no line items) for a project type.
    This is for the "categories only" seeding option.
    """
    bundles = get_recommended_bundles(project_type)
    categories = []
    for bundle in bundles:
        for cat in bundle.categories:
            # Create category without line items
            categories.append(TemplateCategory(
                name=cat.name,
                code=cat.code,
                account_code_prefix=cat.account_code_prefix,
                category_type=cat.category_type,
                sort_order=cat.sort_order,
                color=cat.color,
                line_items=[]  # No line items
            ))
    return categories


def filter_essential_items(bundle: DepartmentBundle) -> DepartmentBundle:
    """
    Filter a bundle to only include essential line items.
    Used when user selects "include essentials only".
    """
    filtered_categories = []
    for cat in bundle.categories:
        essential_items = [item for item in cat.line_items if item.is_essential]
        if essential_items:  # Only include category if it has essential items
            filtered_categories.append(TemplateCategory(
                name=cat.name,
                code=cat.code,
                account_code_prefix=cat.account_code_prefix,
                category_type=cat.category_type,
                sort_order=cat.sort_order,
                color=cat.color,
                line_items=essential_items
            ))

    return DepartmentBundle(
        id=bundle.id,
        name=bundle.name,
        description=bundle.description,
        category_type=bundle.category_type,
        icon=bundle.icon,
        categories=filtered_categories
    )


def get_categories_from_bundles(bundle_ids: List[str], essentials_only: bool = False) -> List[TemplateCategory]:
    """
    Get all categories from selected bundles.
    If essentials_only is True, only include essential line items.
    """
    categories = []
    seen_codes = set()

    for bundle_id in bundle_ids:
        bundle = get_bundle_by_id(bundle_id)
        if not bundle:
            continue

        if essentials_only:
            bundle = filter_essential_items(bundle)

        for cat in bundle.categories:
            if cat.code not in seen_codes:
                categories.append(cat)
                seen_codes.add(cat.code)

    # Sort by sort_order
    categories.sort(key=lambda c: c.sort_order)
    return categories


class BudgetCreationOptions(BaseModel):
    """Options for creating a budget"""
    project_type: BudgetProjectType = BudgetProjectType.FEATURE
    name: Optional[str] = None
    currency: str = "USD"
    contingency_percent: float = 10.0
    has_top_sheet: bool = True
    shoot_days: int = 10
    prep_days: int = 5
    wrap_days: int = 2

    # Seeding options
    seed_mode: str = "bundles"  # "blank" | "categories_only" | "bundles" | "essentials"
    selected_bundles: List[str] = []  # Bundle IDs to include

    # High-level category toggles (for "categories_only" mode)
    include_above_the_line: bool = True
    include_production: bool = True
    include_post: bool = True
    include_other: bool = True
