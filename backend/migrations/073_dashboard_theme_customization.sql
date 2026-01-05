-- Migration: 073_dashboard_theme_customization.sql
-- Description: Add customizable dashboard and theme system
-- Tables: user_dashboard_settings, role_default_dashboards, dashboard_templates,
--         user_themes, theme_templates, preset_themes

-- ============================================================================
-- USER DASHBOARD SETTINGS - Per-user dashboard customization
-- ============================================================================
CREATE TABLE IF NOT EXISTS user_dashboard_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID UNIQUE NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,

    -- Which role default this was derived from (for reset capability)
    derived_from_role TEXT,
    derived_from_template_id UUID,

    -- Section configuration (JSONB array)
    -- Each element: {section_id, visible, order, size, collapsed}
    sections JSONB NOT NULL DEFAULT '[]',

    -- Custom widgets/quick links (JSONB array)
    -- Each element: {id, type, label, href, icon, order}
    custom_widgets JSONB DEFAULT '[]',

    -- Quick actions order (array of action IDs)
    quick_actions_order TEXT[] DEFAULT '{}',

    -- Layout preferences
    layout_mode TEXT DEFAULT 'auto' CHECK (layout_mode IN ('auto', 'compact', 'spacious', 'grid')),

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_dashboard_user_id ON user_dashboard_settings(user_id);
CREATE INDEX IF NOT EXISTS idx_user_dashboard_derived_role ON user_dashboard_settings(derived_from_role);

-- ============================================================================
-- ROLE DEFAULT DASHBOARDS - Admin-configured defaults per role
-- ============================================================================
CREATE TABLE IF NOT EXISTS role_default_dashboards (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    role_name TEXT NOT NULL UNIQUE,

    -- Section configuration (same structure as user_dashboard_settings)
    sections JSONB NOT NULL DEFAULT '[]',

    -- Default quick actions for this role
    quick_actions_order TEXT[] DEFAULT '{}',

    -- Default custom widgets for this role
    default_widgets JSONB DEFAULT '[]',

    -- Layout mode default
    layout_mode TEXT DEFAULT 'auto',

    -- Admin metadata
    created_by UUID REFERENCES profiles(id),
    updated_by UUID REFERENCES profiles(id),

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_role_default_role ON role_default_dashboards(role_name);

-- ============================================================================
-- DASHBOARD TEMPLATES - Shareable dashboard layouts
-- ============================================================================
CREATE TABLE IF NOT EXISTS dashboard_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_by UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,

    -- Template metadata
    name TEXT NOT NULL,
    description TEXT,
    preview_image_url TEXT,

    -- Visibility: private, unlisted, public
    visibility TEXT DEFAULT 'private' CHECK (visibility IN ('private', 'unlisted', 'public')),

    -- Target roles (which roles this template is designed for)
    target_roles TEXT[] DEFAULT '{}',

    -- The actual layout configuration
    sections JSONB NOT NULL DEFAULT '[]',
    quick_actions_order TEXT[] DEFAULT '{}',
    custom_widgets JSONB DEFAULT '[]',
    layout_mode TEXT DEFAULT 'auto',

    -- Stats
    use_count INTEGER DEFAULT 0,

    -- Moderation
    is_featured BOOLEAN DEFAULT false,
    is_approved BOOLEAN DEFAULT true,

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_dashboard_templates_creator ON dashboard_templates(created_by);
CREATE INDEX IF NOT EXISTS idx_dashboard_templates_visibility ON dashboard_templates(visibility);
CREATE INDEX IF NOT EXISTS idx_dashboard_templates_featured ON dashboard_templates(is_featured) WHERE is_featured = true;
CREATE INDEX IF NOT EXISTS idx_dashboard_templates_roles ON dashboard_templates USING GIN(target_roles);

-- Add foreign key constraint after table creation
ALTER TABLE user_dashboard_settings
    ADD CONSTRAINT fk_derived_template
    FOREIGN KEY (derived_from_template_id)
    REFERENCES dashboard_templates(id) ON DELETE SET NULL;

-- ============================================================================
-- PRESET THEMES - System-defined themes (always available)
-- ============================================================================
CREATE TABLE IF NOT EXISTS preset_themes (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,

    -- Theme configuration
    colors JSONB NOT NULL,
    typography JSONB NOT NULL DEFAULT '{}',
    spacing JSONB NOT NULL DEFAULT '{}',
    effects JSONB NOT NULL DEFAULT '{}',

    is_dark BOOLEAN DEFAULT true,
    display_order INTEGER DEFAULT 0,

    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- THEME TEMPLATES - User-created shareable themes
-- ============================================================================
CREATE TABLE IF NOT EXISTS theme_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_by UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,

    -- Metadata
    name TEXT NOT NULL,
    description TEXT,
    preview_image_url TEXT,

    -- Visibility
    visibility TEXT DEFAULT 'private' CHECK (visibility IN ('private', 'unlisted', 'public')),

    -- Theme configuration
    colors JSONB NOT NULL,
    typography JSONB DEFAULT '{}',
    spacing JSONB DEFAULT '{}',
    effects JSONB DEFAULT '{}',

    is_dark BOOLEAN DEFAULT true,

    -- Stats
    use_count INTEGER DEFAULT 0,
    like_count INTEGER DEFAULT 0,

    -- Moderation
    is_featured BOOLEAN DEFAULT false,
    is_approved BOOLEAN DEFAULT true,

    -- Tags for discoverability
    tags TEXT[] DEFAULT '{}',
    category TEXT CHECK (category IN ('dark', 'light', 'colorful', 'minimal', 'branded')),

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_theme_templates_creator ON theme_templates(created_by);
CREATE INDEX IF NOT EXISTS idx_theme_templates_visibility ON theme_templates(visibility);
CREATE INDEX IF NOT EXISTS idx_theme_templates_featured ON theme_templates(is_featured) WHERE is_featured = true;
CREATE INDEX IF NOT EXISTS idx_theme_templates_tags ON theme_templates USING GIN(tags);
CREATE INDEX IF NOT EXISTS idx_theme_templates_category ON theme_templates(category);

-- ============================================================================
-- USER THEMES - Per-user theme preferences
-- ============================================================================
CREATE TABLE IF NOT EXISTS user_themes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID UNIQUE NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,

    -- Active theme (preset ID or template UUID)
    active_preset_id TEXT REFERENCES preset_themes(id),
    active_template_id UUID REFERENCES theme_templates(id),

    -- Custom theme overrides (if user wants to tweak an existing theme)
    custom_colors JSONB,
    custom_typography JSONB,
    custom_spacing JSONB,
    custom_effects JSONB,

    -- Installed marketplace themes
    installed_template_ids UUID[] DEFAULT '{}',

    -- Favorites for quick access
    favorite_template_ids UUID[] DEFAULT '{}',

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_themes_user_id ON user_themes(user_id);

-- ============================================================================
-- THEME LIKES - Track user engagement
-- ============================================================================
CREATE TABLE IF NOT EXISTS theme_likes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    theme_id UUID NOT NULL REFERENCES theme_templates(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE(user_id, theme_id)
);

CREATE INDEX IF NOT EXISTS idx_theme_likes_theme ON theme_likes(theme_id);

-- ============================================================================
-- TRIGGERS for updated_at
-- ============================================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_user_dashboard_settings_updated_at ON user_dashboard_settings;
CREATE TRIGGER update_user_dashboard_settings_updated_at
    BEFORE UPDATE ON user_dashboard_settings
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_role_default_dashboards_updated_at ON role_default_dashboards;
CREATE TRIGGER update_role_default_dashboards_updated_at
    BEFORE UPDATE ON role_default_dashboards
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_dashboard_templates_updated_at ON dashboard_templates;
CREATE TRIGGER update_dashboard_templates_updated_at
    BEFORE UPDATE ON dashboard_templates
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_theme_templates_updated_at ON theme_templates;
CREATE TRIGGER update_theme_templates_updated_at
    BEFORE UPDATE ON theme_templates
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_user_themes_updated_at ON user_themes;
CREATE TRIGGER update_user_themes_updated_at
    BEFORE UPDATE ON user_themes
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- SEED DATA - Preset Themes
-- ============================================================================
INSERT INTO preset_themes (id, name, description, colors, typography, spacing, effects, is_dark, display_order)
VALUES
(
    'swn-classic',
    'SWN Classic',
    'The original Second Watch Network dark theme with zine aesthetic',
    '{
        "background": "#121212",
        "backgroundSecondary": "#1a1a1a",
        "foreground": "#F9F5EF",
        "foregroundSecondary": "#cccccc",
        "foregroundMuted": "#4C4C4C",
        "card": "#1a1a1a",
        "cardForeground": "#F9F5EF",
        "primary": "#FF3C3C",
        "primaryForeground": "#FFFFFF",
        "secondary": "#333333",
        "secondaryForeground": "#F9F5EF",
        "accent": "#FCDC58",
        "accentForeground": "#121212",
        "muted": "#333333",
        "mutedForeground": "#808080",
        "destructive": "#DC2626",
        "destructiveForeground": "#FFFFFF",
        "border": "#4C4C4C",
        "input": "#4C4C4C",
        "ring": "#FCDC58",
        "success": "#22c55e",
        "warning": "#f59e0b",
        "error": "#ef4444"
    }',
    '{"fontHeading": "Space Grotesk", "fontBody": "IBM Plex Sans", "fontDisplay": "Permanent Marker"}',
    '{"borderRadius": "none", "density": "comfortable"}',
    '{"enableGrain": true, "enableAnimations": true, "reducedMotion": false}',
    true,
    1
),
(
    'light-mode',
    'Light Mode',
    'Clean light theme for daytime viewing',
    '{
        "background": "#F9F5EF",
        "backgroundSecondary": "#FFFFFF",
        "foreground": "#121212",
        "foregroundSecondary": "#333333",
        "foregroundMuted": "#666666",
        "card": "#FFFFFF",
        "cardForeground": "#121212",
        "primary": "#FF3C3C",
        "primaryForeground": "#FFFFFF",
        "secondary": "#e5e5e5",
        "secondaryForeground": "#121212",
        "accent": "#FCDC58",
        "accentForeground": "#121212",
        "muted": "#e5e5e5",
        "mutedForeground": "#666666",
        "destructive": "#DC2626",
        "destructiveForeground": "#FFFFFF",
        "border": "#d4d4d4",
        "input": "#d4d4d4",
        "ring": "#FF3C3C",
        "success": "#16a34a",
        "warning": "#d97706",
        "error": "#dc2626"
    }',
    '{"fontHeading": "Space Grotesk", "fontBody": "IBM Plex Sans", "fontDisplay": "Permanent Marker"}',
    '{"borderRadius": "sm", "density": "comfortable"}',
    '{"enableGrain": false, "enableAnimations": true, "reducedMotion": false}',
    false,
    2
),
(
    'high-contrast',
    'High Contrast',
    'Maximum contrast for accessibility',
    '{
        "background": "#000000",
        "backgroundSecondary": "#1a1a1a",
        "foreground": "#FFFFFF",
        "foregroundSecondary": "#FFFFFF",
        "foregroundMuted": "#cccccc",
        "card": "#1a1a1a",
        "cardForeground": "#FFFFFF",
        "primary": "#FFFF00",
        "primaryForeground": "#000000",
        "secondary": "#333333",
        "secondaryForeground": "#FFFFFF",
        "accent": "#00FFFF",
        "accentForeground": "#000000",
        "muted": "#333333",
        "mutedForeground": "#cccccc",
        "destructive": "#FF0000",
        "destructiveForeground": "#FFFFFF",
        "border": "#FFFFFF",
        "input": "#FFFFFF",
        "ring": "#FFFF00",
        "success": "#00FF00",
        "warning": "#FFFF00",
        "error": "#FF0000"
    }',
    '{"fontHeading": "Space Grotesk", "fontBody": "IBM Plex Sans", "fontDisplay": "Permanent Marker"}',
    '{"borderRadius": "none", "density": "spacious"}',
    '{"enableGrain": false, "enableAnimations": false, "reducedMotion": true}',
    true,
    3
),
(
    'midnight',
    'Midnight',
    'Deep blue dark theme',
    '{
        "background": "#0a0f1a",
        "backgroundSecondary": "#111827",
        "foreground": "#e2e8f0",
        "foregroundSecondary": "#94a3b8",
        "foregroundMuted": "#64748b",
        "card": "#111827",
        "cardForeground": "#e2e8f0",
        "primary": "#3b82f6",
        "primaryForeground": "#FFFFFF",
        "secondary": "#1e293b",
        "secondaryForeground": "#e2e8f0",
        "accent": "#8b5cf6",
        "accentForeground": "#FFFFFF",
        "muted": "#1e293b",
        "mutedForeground": "#64748b",
        "destructive": "#ef4444",
        "destructiveForeground": "#FFFFFF",
        "border": "#334155",
        "input": "#334155",
        "ring": "#3b82f6",
        "success": "#22c55e",
        "warning": "#f59e0b",
        "error": "#ef4444"
    }',
    '{"fontHeading": "Space Grotesk", "fontBody": "IBM Plex Sans", "fontDisplay": "Permanent Marker"}',
    '{"borderRadius": "md", "density": "comfortable"}',
    '{"enableGrain": false, "enableAnimations": true, "reducedMotion": false}',
    true,
    4
),
(
    'sunset',
    'Sunset',
    'Warm orange and purple tones',
    '{
        "background": "#1a1016",
        "backgroundSecondary": "#261820",
        "foreground": "#fce7d6",
        "foregroundSecondary": "#d4a574",
        "foregroundMuted": "#8b6b4a",
        "card": "#261820",
        "cardForeground": "#fce7d6",
        "primary": "#f97316",
        "primaryForeground": "#FFFFFF",
        "secondary": "#3d2030",
        "secondaryForeground": "#fce7d6",
        "accent": "#a855f7",
        "accentForeground": "#FFFFFF",
        "muted": "#3d2030",
        "mutedForeground": "#8b6b4a",
        "destructive": "#ef4444",
        "destructiveForeground": "#FFFFFF",
        "border": "#5c3a4a",
        "input": "#5c3a4a",
        "ring": "#f97316",
        "success": "#22c55e",
        "warning": "#f59e0b",
        "error": "#ef4444"
    }',
    '{"fontHeading": "Space Grotesk", "fontBody": "IBM Plex Sans", "fontDisplay": "Permanent Marker"}',
    '{"borderRadius": "lg", "density": "comfortable"}',
    '{"enableGrain": true, "enableAnimations": true, "reducedMotion": false}',
    true,
    5
)
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- SEED DATA - Role Default Dashboards
-- ============================================================================
INSERT INTO role_default_dashboards (role_name, sections, layout_mode)
VALUES
(
    'free',
    '[
        {"sectionId": "hero", "visible": true, "order": 0, "size": "large"},
        {"sectionId": "featured-worlds", "visible": true, "order": 1, "size": "large"},
        {"sectionId": "coming-soon", "visible": true, "order": 2, "size": "medium"},
        {"sectionId": "zine-picks", "visible": true, "order": 3, "size": "medium"},
        {"sectionId": "undiscovered-heat", "visible": true, "order": 4, "size": "medium"}
    ]',
    'auto'
),
(
    'premium',
    '[
        {"sectionId": "hero", "visible": true, "order": 0, "size": "large"},
        {"sectionId": "continue-watching", "visible": true, "order": 1, "size": "medium"},
        {"sectionId": "watchlist", "visible": true, "order": 2, "size": "medium"},
        {"sectionId": "featured-worlds", "visible": true, "order": 3, "size": "large"},
        {"sectionId": "coming-soon", "visible": true, "order": 4, "size": "medium"},
        {"sectionId": "zine-picks", "visible": true, "order": 5, "size": "medium"}
    ]',
    'auto'
),
(
    'filmmaker',
    '[
        {"sectionId": "creator-projects", "visible": true, "order": 0, "size": "large"},
        {"sectionId": "creator-submissions", "visible": true, "order": 1, "size": "medium"},
        {"sectionId": "continue-watching", "visible": true, "order": 2, "size": "medium"},
        {"sectionId": "featured-worlds", "visible": true, "order": 3, "size": "large"}
    ]',
    'auto'
),
(
    'order_member',
    '[
        {"sectionId": "order-dashboard", "visible": true, "order": 0, "size": "large"},
        {"sectionId": "order-jobs", "visible": true, "order": 1, "size": "medium"},
        {"sectionId": "continue-watching", "visible": true, "order": 2, "size": "medium"},
        {"sectionId": "featured-worlds", "visible": true, "order": 3, "size": "large"}
    ]',
    'auto'
),
(
    'admin',
    '[
        {"sectionId": "admin-stats", "visible": true, "order": 0, "size": "large"},
        {"sectionId": "admin-pending", "visible": true, "order": 1, "size": "medium"},
        {"sectionId": "creator-projects", "visible": true, "order": 2, "size": "medium"},
        {"sectionId": "continue-watching", "visible": true, "order": 3, "size": "medium"}
    ]',
    'auto'
),
(
    'superadmin',
    '[
        {"sectionId": "admin-stats", "visible": true, "order": 0, "size": "large"},
        {"sectionId": "admin-pending", "visible": true, "order": 1, "size": "medium"},
        {"sectionId": "order-dashboard", "visible": true, "order": 2, "size": "medium"},
        {"sectionId": "creator-projects", "visible": true, "order": 3, "size": "medium"}
    ]',
    'auto'
)
ON CONFLICT (role_name) DO NOTHING;

-- ============================================================================
-- SUCCESS
-- ============================================================================
DO $$
BEGIN
    RAISE NOTICE 'Migration 073: Dashboard and theme customization tables created successfully!';
END $$;
