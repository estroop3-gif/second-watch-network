-- Migration 036: Add missing call sheet people and scenes tables

-- =====================================================
-- TABLE: backlot_call_sheet_people
-- =====================================================
CREATE TABLE IF NOT EXISTS backlot_call_sheet_people (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  call_sheet_id UUID NOT NULL REFERENCES backlot_call_sheets(id) ON DELETE CASCADE,

  -- Person Info (can be member or external)
  member_id UUID REFERENCES backlot_project_members(id) ON DELETE SET NULL,
  user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,

  -- If not a member, store info directly
  name TEXT NOT NULL,
  role TEXT,
  department TEXT,

  -- Call Time
  call_time TIME,

  -- Contact
  phone TEXT,
  email TEXT,

  -- Notes
  notes TEXT,
  makeup_time TIME,
  wardrobe_notes TEXT,

  -- Cast specific
  is_cast BOOLEAN DEFAULT FALSE,
  cast_number TEXT,
  character_name TEXT,

  -- Order for display
  sort_order INTEGER DEFAULT 0,

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_call_sheet_people_call_sheet ON backlot_call_sheet_people(call_sheet_id);
CREATE INDEX IF NOT EXISTS idx_call_sheet_people_member ON backlot_call_sheet_people(member_id);
CREATE INDEX IF NOT EXISTS idx_call_sheet_people_user ON backlot_call_sheet_people(user_id);

-- =====================================================
-- TABLE: backlot_call_sheet_scenes
-- =====================================================
CREATE TABLE IF NOT EXISTS backlot_call_sheet_scenes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  call_sheet_id UUID NOT NULL REFERENCES backlot_call_sheets(id) ON DELETE CASCADE,

  -- Scene info
  scene_number TEXT NOT NULL,
  scene_name TEXT,
  description TEXT,
  location TEXT,
  time_of_day TEXT,
  pages DECIMAL(5,2),
  estimated_time_minutes INTEGER,

  -- Status
  status TEXT DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'in_progress', 'completed', 'moved', 'cut')),

  -- Order
  sort_order INTEGER DEFAULT 0,

  -- Notes
  notes TEXT,

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_call_sheet_scenes_call_sheet ON backlot_call_sheet_scenes(call_sheet_id);

-- =====================================================
-- TABLE: backlot_call_sheet_send_history
-- =====================================================
CREATE TABLE IF NOT EXISTS backlot_call_sheet_send_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  call_sheet_id UUID NOT NULL REFERENCES backlot_call_sheets(id) ON DELETE CASCADE,

  -- Send details
  sent_by_user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  sent_at TIMESTAMPTZ DEFAULT NOW(),
  channel TEXT NOT NULL DEFAULT 'email',
  recipient_count INTEGER DEFAULT 0,
  recipients JSONB DEFAULT '[]',
  message TEXT,

  -- Status
  status TEXT DEFAULT 'sent',

  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_call_sheet_send_history_call_sheet ON backlot_call_sheet_send_history(call_sheet_id);
CREATE INDEX IF NOT EXISTS idx_call_sheet_send_history_sent_at ON backlot_call_sheet_send_history(sent_at);
