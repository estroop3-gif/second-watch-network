/**
 * Backlot Production Hub Type Definitions
 */

// Enums
export type BacklotVisibility = 'private' | 'unlisted' | 'public';
export type BacklotProjectStatus = 'pre_production' | 'production' | 'post_production' | 'completed' | 'on_hold' | 'archived';
export type BacklotMemberRole = 'owner' | 'admin' | 'editor' | 'viewer';
export type BacklotTaskStatus = 'todo' | 'in_progress' | 'review' | 'completed' | 'blocked';
export type BacklotTaskPriority = 'low' | 'medium' | 'high' | 'urgent';
export type BacklotContactType = 'investor' | 'crew' | 'collaborator' | 'vendor' | 'talent' | 'other';
export type BacklotContactStatus = 'new' | 'contacted' | 'in_discussion' | 'confirmed' | 'declined' | 'archived';
export type BacklotUpdateType = 'announcement' | 'milestone' | 'schedule_change' | 'general';
export type BacklotGearStatus = 'available' | 'in_use' | 'reserved' | 'maintenance' | 'retired';

// Call Sheet Template Types
export type BacklotCallSheetTemplate =
  | 'feature'
  | 'documentary'
  | 'music_video'
  | 'commercial'
  | 'medical_corporate'
  | 'news_eng'
  | 'live_event';
export type BacklotIntExt = 'INT' | 'EXT' | 'INT/EXT' | 'EXT/INT';
export type BacklotTimeOfDay = 'day' | 'night' | 'dawn' | 'dusk' | 'golden_hour' | 'magic_hour' | 'morning' | 'afternoon' | 'evening';

// Profile type for joined data (matching existing pattern)
export interface BacklotProfile {
  id: string;
  username: string | null;
  full_name: string | null;
  display_name: string | null;
  avatar_url: string | null;
  role: string | null;
  is_order_member?: boolean;
  marker_color?: string | null; // Per-project marker color for timeline notes
}

// Project
export interface BacklotProject {
  id: string;
  owner_id: string;
  title: string;
  slug: string;
  logline: string | null;
  description: string | null;
  cover_image_url: string | null;
  thumbnail_url: string | null;
  project_type: string | null;
  genre: string | null;
  format: string | null;
  runtime_minutes: number | null;
  status: BacklotProjectStatus;
  visibility: BacklotVisibility;
  target_start_date: string | null;
  target_end_date: string | null;
  actual_start_date: string | null;
  actual_end_date: string | null;
  settings: Record<string, any>;
  header_logo_url: string | null; // Logo for call sheet headers
  created_at: string;
  updated_at: string;
  // Joined data
  owner?: BacklotProfile;
  member_count?: number;
  task_count?: number;
}

// Project Member
export interface BacklotProjectMember {
  id: string;
  project_id: string;
  user_id: string;
  role: BacklotMemberRole;
  production_role: string | null;
  department: string | null;
  phone: string | null;
  email: string | null;
  invited_by: string | null;
  joined_at: string;
  // Joined data
  profile?: BacklotProfile;
}

// Production Day
export interface BacklotProductionDay {
  id: string;
  project_id: string;
  day_number: number;
  date: string;
  title: string | null;
  description: string | null;
  general_call_time: string | null;
  wrap_time: string | null;
  location_id: string | null;
  location_name: string | null;
  location_address: string | null;
  is_completed: boolean;
  notes: string | null;
  weather_notes: string | null;
  created_at: string;
  updated_at: string;
  // Joined data
  location?: BacklotLocation;
  call_sheets?: BacklotCallSheet[];
  task_count?: number;
  // Scene assignments from schedule
  assigned_scenes?: ProductionDayScene[];
  scene_count?: number;
  // Hour-by-hour schedule
  hour_schedule?: HourScheduleBlock[];
  schedule_config?: HourScheduleConfig;
  hour_schedule_updated_at?: string;
}

// Production Day Scene Assignment (for schedule scene assignment)
export interface ProductionDayScene {
  id: string;
  production_day_id: string;
  scene_id: string;
  sort_order: number;
  estimated_duration: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  // Joined scene data
  scene?: {
    id: string;
    scene_number: string;
    slugline: string | null;
    set_name: string | null;
    description: string | null;
    page_length: number | null;
    int_ext: string | null;
    time_of_day: string | null;
    status: string | null;
  };
}

// Input for adding a scene to a production day
export interface ProductionDaySceneInput {
  scene_id: string;
  sort_order?: number;
  estimated_duration?: string;
  notes?: string;
}

// Input for reordering scenes in a production day
export interface ProductionDaySceneReorderInput {
  scene_orders: { scene_id: string; sort_order: number }[];
}

// Production Day / Call Sheet Sync
export interface SyncStatusResponse {
  has_linked_call_sheet: boolean;
  call_sheet_id: string | null;
  is_in_sync: boolean;
  stale_entity: 'production_day' | 'call_sheet' | null;
  fields_differ: string[];
  day_updated_at: string | null;
  sheet_updated_at: string | null;
}

export interface BidirectionalSyncRequest {
  force_direction?: 'schedule_to_callsheet' | 'callsheet_to_schedule';
  sync_date?: boolean;
  sync_times?: boolean;
  sync_location?: boolean;
}

export interface BidirectionalSyncResponse {
  success: boolean;
  direction: 'schedule_to_callsheet' | 'callsheet_to_schedule';
  fields_synced: string[];
  source: 'production_day' | 'call_sheet';
  target: 'production_day' | 'call_sheet';
}

// Call Sheet
export interface BacklotCallSheet {
  id: string;
  project_id: string;
  production_day_id: string | null;
  title: string;
  date: string;
  general_call_time: string | null;
  location_name: string | null;
  location_address: string | null;
  parking_notes: string | null;
  production_contact: string | null;
  production_phone: string | null;
  schedule_blocks: ScheduleBlock[];
  weather_info: string | null;
  special_instructions: string | null;
  safety_notes: string | null;
  hospital_name: string | null;
  hospital_address: string | null;
  hospital_phone: string | null;
  is_published: boolean;
  published_at: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;

  // Extended Template Fields
  template_type: BacklotCallSheetTemplate;
  production_title: string | null;
  production_company: string | null;
  shoot_day_number: number | null;
  total_shoot_days: number | null;

  // Extended Timing
  crew_call_time: string | null;
  first_shot_time: string | null;
  breakfast_time: string | null;
  lunch_time: string | null;
  dinner_time: string | null;
  estimated_wrap_time: string | null;
  sunrise_time: string | null;
  sunset_time: string | null;

  // Extended Location
  location_id: string | null;
  parking_instructions: string | null;
  basecamp_location: string | null;

  // Production Contacts
  production_office_phone: string | null;
  production_email: string | null;
  upm_name: string | null;
  upm_phone: string | null;
  first_ad_name: string | null;
  first_ad_phone: string | null;
  director_name: string | null;
  director_phone: string | null;
  producer_name: string | null;
  producer_phone: string | null;

  // Department Notes
  camera_notes: string | null;
  sound_notes: string | null;
  grip_electric_notes: string | null;
  art_notes: string | null;
  wardrobe_notes: string | null;
  makeup_hair_notes: string | null;
  stunts_notes: string | null;
  vfx_notes: string | null;
  transport_notes: string | null;
  catering_notes: string | null;

  // Weather
  weather_forecast: string | null;

  // Safety
  nearest_hospital: string | null;
  set_medic: string | null;
  fire_safety_officer: string | null;

  // Additional Notes
  general_notes: string | null;
  advance_schedule: string | null;

  // === NEW TEMPLATE-SPECIFIC FIELDS ===

  // Medical/Corporate Template Fields
  hipaa_officer: string | null;
  privacy_notes: string | null;
  release_status: string | null;
  restricted_areas: string | null;
  dress_code: string | null;
  client_name: string | null;
  client_phone: string | null;
  facility_contact: string | null;
  facility_phone: string | null;

  // News/ENG Template Fields
  deadline_time: string | null;
  story_angle: string | null;
  reporter_name: string | null;
  reporter_phone: string | null;
  subject_notes: string | null;
  location_2_name: string | null;
  location_2_address: string | null;
  location_3_name: string | null;
  location_3_address: string | null;

  // Live Event/Multi-cam Template Fields
  load_in_time: string | null;
  rehearsal_time: string | null;
  doors_time: string | null;
  intermission_time: string | null;
  strike_time: string | null;
  truck_location: string | null;
  video_village: string | null;
  comm_channel: string | null;
  td_name: string | null;
  td_phone: string | null;
  stage_manager_name: string | null;
  stage_manager_phone: string | null;
  camera_plot: string | null;
  show_rundown: string | null;
  rain_plan: string | null;
  client_notes: string | null;

  // Additional Department Notes
  broadcast_notes: string | null;
  playback_notes: string | null;

  // Branding & PDF
  header_logo_url: string | null;
  pdf_url: string | null;
  pdf_generated_at: string | null;

  // Custom Contacts (JSONB array)
  custom_contacts: CallSheetCustomContact[];

  // Schedule blocks sync tracking
  schedule_blocks_updated_at?: string;

  // Joined data
  people?: BacklotCallSheetPerson[];
  production_day?: BacklotProductionDay;
  scenes?: BacklotCallSheetScene[];
  locations?: BacklotCallSheetLocation[];
  location?: BacklotLocation;
}

export interface ScheduleBlock {
  time: string;
  activity: string;
  notes?: string;
}

// Hour Schedule Block Types for production day hour-by-hour scheduling
export type HourScheduleBlockType =
  | 'scene'           // Scene shooting
  | 'activity'        // Generic activity (blocking, rehearsal)
  | 'meal'            // Meal breaks
  | 'crew_call'       // Crew call time
  | 'first_shot'      // First shot marker
  | 'company_move'    // Travel between locations
  | 'wrap'            // End of day
  | 'custom'          // User-defined
  | 'segment'         // Non-scripted segment
  | 'camera_reset'    // Camera/lighting reset between scenes
  | 'lighting_reset'; // Major lighting reset (day/night changes)

// Schedule mode for wizard
export type HourScheduleMode = 'scripted' | 'non_scripted' | 'mixed';

// Non-scripted segment categories
export type NonScriptedSegmentCategory =
  | 'interview'
  | 'broll'
  | 'technical'
  | 'talent'
  | 'presentation'
  | 'performance'
  | 'location'
  | 'custom';

// Segment preset definition (from library or user-created)
export interface NonScriptedSegmentPreset {
  id: string;
  category: NonScriptedSegmentCategory;
  name: string;
  description?: string;
  duration_min_minutes: number;
  duration_max_minutes: number;
  duration_default_minutes: number;
  icon?: string;
  color?: string;
  is_system_preset: boolean;
}

// Segment instance in a schedule
export interface NonScriptedSegment {
  id: string;
  preset_id?: string;
  category: NonScriptedSegmentCategory;
  name: string;
  duration_minutes: number;
  description?: string;
  location_id?: string;
  location_name?: string;
  notes?: string;
  sort_order: number;
}

// User's custom presets (stored in user profile)
export interface UserSegmentPresets {
  presets: NonScriptedSegmentPreset[];
}

export interface HourScheduleBlock {
  id: string;
  type: HourScheduleBlockType;
  start_time: string;              // HH:MM format
  end_time: string;                // HH:MM format
  duration_minutes: number;

  // Scene-specific (when type === 'scene')
  scene_id?: string;
  scene_number?: string;
  scene_slugline?: string;
  page_count?: number;

  // Activity fields
  activity_name?: string;
  activity_notes?: string;

  // Location (for company moves and segments)
  location_id?: string;
  location_name?: string;

  // Segment-specific (when type === 'segment')
  segment_category?: NonScriptedSegmentCategory;
  segment_preset_id?: string;
  segment_description?: string;

  sort_order: number;
}

export interface HourScheduleConfig {
  pages_per_hour: number;              // 0.5 drama, 1.0 comedy
  crew_call_time: string;              // HH:MM
  first_shot_offset_minutes: number;   // Time after crew call
  meal_1_after_hours: number;          // Default: 6
  meal_1_duration_minutes: number;     // Default: 30-60
  meal_2_enabled: boolean;
  meal_2_after_hours: number;
  meal_2_duration_minutes: number;
  default_move_duration_minutes: number;
  scene_buffer_minutes: number;
  // Mode and segment settings
  mode?: HourScheduleMode;
  segment_buffer_minutes?: number;     // Buffer between segments
  group_by_location?: boolean;         // Auto-group segments by location
  // Reset time settings
  camera_reset_minutes?: number;       // Default: 10 - between all scenes
  lighting_reset_minutes?: number;     // Default: 20 - day/night changes
  major_setup_minutes?: number;        // Default: 30 - INT/EXT changes
  enable_auto_resets?: boolean;        // Default: true - auto-insert resets
}

export const PAGES_PER_HOUR_PRESETS = {
  drama_slow: 0.25,
  drama_standard: 0.5,
  comedy_sitcom: 1.0,
  action_heavy: 0.33,
} as const;

export const DEFAULT_HOUR_SCHEDULE_CONFIG: HourScheduleConfig = {
  pages_per_hour: 0.5,
  crew_call_time: '06:00',
  first_shot_offset_minutes: 60,
  meal_1_after_hours: 6,
  meal_1_duration_minutes: 30,
  meal_2_enabled: false,
  meal_2_after_hours: 12,
  meal_2_duration_minutes: 30,
  default_move_duration_minutes: 30,
  scene_buffer_minutes: 5,
  mode: 'scripted',
  segment_buffer_minutes: 5,
  group_by_location: true,
  camera_reset_minutes: 10,
  lighting_reset_minutes: 20,
  major_setup_minutes: 30,
  enable_auto_resets: true,
};

// Custom Contact for call sheets (stored as JSONB array)
export interface CallSheetCustomContact {
  id?: string; // Client-side ID for React keys
  title: string; // Role/title like "Location Manager", "Stunt Coordinator"
  name: string;
  phone?: string;
  email?: string;
}

// Call Sheet Person
export interface BacklotCallSheetPerson {
  id: string;
  call_sheet_id: string;
  member_id: string | null;
  name: string;
  role: string | null;
  department: string | null;
  call_time: string;
  phone: string | null;
  email: string | null;
  notes: string | null;
  makeup_time: string | null;
  wardrobe_notes: string | null;
  sort_order: number;
  created_at: string;
  // Cast-specific fields
  is_cast: boolean;
  cast_number: string | null; // e.g., "1", "2", "SWF" (stunt double for)
  character_name: string | null;
  pickup_time: string | null;
  on_set_time: string | null;
  // Joined data
  member?: BacklotProjectMember;
}

// Call Sheet Scene / Segment Breakdown
export interface BacklotCallSheetScene {
  id: string;
  call_sheet_id: string;
  scene_number: string | null;
  segment_label: string | null;
  page_count: string | null;
  set_name: string;
  int_ext: BacklotIntExt | null;
  time_of_day: BacklotTimeOfDay | null;
  description: string | null;
  cast_ids: string | null;
  cast_names: string | null;
  location_id: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
  // Joined data
  location?: BacklotLocation;
}

// Call Sheet Location (Multiple locations per call sheet)
export interface BacklotCallSheetLocation {
  id: string;
  call_sheet_id: string;
  location_number: number;
  location_id: string | null;
  name: string;
  address: string | null;
  parking_instructions: string | null;
  basecamp_location: string | null;
  call_time: string | null;
  notes: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
  // Joined data
  location?: BacklotLocation;
}

// Call Sheet Template (account-level, saved for reuse)
export interface BacklotSavedCallSheetTemplate {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  template_type: BacklotCallSheetTemplate | null;
  call_sheet_data: CallSheetTemplateData;
  use_count: number;
  last_used_at: string | null;
  created_at: string;
  updated_at: string;
}

// Data stored in a saved call sheet template (subset of BacklotCallSheet)
export interface CallSheetTemplateData {
  // Basic info (excluding project/date specifics)
  title?: string;
  template_type?: BacklotCallSheetTemplate;
  production_title?: string;
  production_company?: string;
  header_logo_url?: string;
  shoot_day_number?: number;
  total_shoot_days?: number;

  // Timing
  crew_call_time?: string;
  general_call_time?: string;
  first_shot_time?: string;
  breakfast_time?: string;
  lunch_time?: string;
  dinner_time?: string;
  estimated_wrap_time?: string;
  sunrise_time?: string;
  sunset_time?: string;

  // Contacts
  production_office_phone?: string;
  production_email?: string;
  upm_name?: string;
  upm_phone?: string;
  first_ad_name?: string;
  first_ad_phone?: string;
  director_name?: string;
  director_phone?: string;
  producer_name?: string;
  producer_phone?: string;
  production_contact?: string;
  production_phone?: string;

  // Department notes
  camera_notes?: string;
  sound_notes?: string;
  grip_electric_notes?: string;
  art_notes?: string;
  wardrobe_notes?: string;
  makeup_hair_notes?: string;
  stunts_notes?: string;
  vfx_notes?: string;
  transport_notes?: string;
  catering_notes?: string;

  // Schedule
  schedule_blocks?: Array<{ time: string; activity: string; notes?: string }>;

  // Custom contacts
  custom_contacts?: Array<{ name: string; title?: string; phone?: string; email?: string }>;

  // Weather/Safety/Notes
  weather_forecast?: string;
  weather_info?: string;
  nearest_hospital?: string;
  hospital_address?: string;
  hospital_name?: string;
  hospital_phone?: string;
  set_medic?: string;
  fire_safety_officer?: string;
  safety_notes?: string;
  general_notes?: string;
  advance_schedule?: string;
  special_instructions?: string;

  // Template-specific fields (all optional)
  hipaa_officer?: string;
  privacy_notes?: string;
  release_status?: string;
  restricted_areas?: string;
  dress_code?: string;
  client_name?: string;
  client_phone?: string;
  facility_contact?: string;
  facility_phone?: string;
  deadline_time?: string;
  story_angle?: string;
  reporter_name?: string;
  reporter_phone?: string;
  subject_notes?: string;
  load_in_time?: string;
  rehearsal_time?: string;
  doors_time?: string;
  intermission_time?: string;
  strike_time?: string;
  truck_location?: string;
  video_village?: string;
  comm_channel?: string;
  td_name?: string;
  td_phone?: string;
  stage_manager_name?: string;
  stage_manager_phone?: string;
  camera_plot?: string;
  show_rundown?: string;
  rain_plan?: string;
  client_notes?: string;
  broadcast_notes?: string;
  playback_notes?: string;

  // Nested data (stripped of IDs for templates)
  locations?: CallSheetTemplateLocation[];
  scenes?: CallSheetTemplateScene[];
  people?: CallSheetTemplatePerson[];
}

// Location data stored in template (no IDs)
export interface CallSheetTemplateLocation {
  location_number: number;
  name: string;
  address?: string;
  parking_instructions?: string;
  basecamp_location?: string;
  call_time?: string;
  notes?: string;
  sort_order?: number;
}

// Scene data stored in template (no IDs)
export interface CallSheetTemplateScene {
  scene_number?: string;
  segment_label?: string;
  page_count?: string;
  set_name?: string;
  int_ext?: BacklotIntExt;
  time_of_day?: BacklotTimeOfDay;
  description?: string;
  cast_ids?: string;
  notes?: string;
  sort_order?: number;
}

// Person data stored in template (no IDs)
export interface CallSheetTemplatePerson {
  name: string;
  role?: string;
  department?: string;
  call_time?: string;
  phone?: string;
  email?: string;
  notes?: string;
  makeup_time?: string;
  pickup_time?: string;
  on_set_time?: string;
  wardrobe_notes?: string;
  is_cast: boolean;
  cast_number?: string;
  character_name?: string;
  sort_order?: number;
}

// Task
export interface BacklotTask {
  id: string;
  project_id: string;
  title: string;
  description: string | null;
  status: BacklotTaskStatus;
  priority: BacklotTaskPriority;
  assigned_to: string | null;
  department: string | null;
  due_date: string | null;
  completed_at: string | null;
  parent_task_id: string | null;
  production_day_id: string | null;
  position: number;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  // Source tracking (for tasks created from call sheets)
  source_type: 'manual' | 'call_sheet' | 'import' | null;
  source_call_sheet_id: string | null;
  // Joined data
  assignee?: BacklotProfile;
  creator?: BacklotProfile;
  subtasks?: BacklotTask[];
  production_day?: BacklotProductionDay;
}

// Location
// Location Types for Global Location Library
export type BacklotLocationType =
  | 'studio'
  | 'residential'
  | 'commercial'
  | 'exterior'
  | 'industrial'
  | 'nature'
  | 'urban'
  | 'rural'
  | 'institutional'
  | 'other';

// Location (now supports both project-specific and global library)
export interface BacklotLocation {
  id: string;
  project_id: string | null; // Nullable for global locations
  name: string;
  description: string | null;
  scene_description: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  country: string;
  latitude: number | null;
  longitude: number | null;
  contact_name: string | null;
  contact_phone: string | null;
  contact_email: string | null;
  parking_notes: string | null;
  load_in_notes: string | null;
  power_available: boolean;
  restrooms_available: boolean;
  permit_required: boolean;
  permit_notes: string | null;
  permit_obtained: boolean;
  location_fee: number | null;
  fee_notes: string | null;
  images: string[];
  // Global library fields
  is_public: boolean;
  visibility: 'public' | 'unlisted' | 'private';
  created_by_user_id: string | null;
  created_by_project_id: string | null;
  region_tag: string | null;
  location_type: BacklotLocationType | string | null;
  amenities: string[];
  created_at: string;
  updated_at: string;
  // Project attachment metadata (when fetched via project)
  attachment_id?: string;
  project_notes?: string | null;
  scene_description_override?: string | null;
  attached_at?: string;
  attached_by_user_id?: string | null;
  // Scout photo data (from global search)
  primary_photo_url?: string | null;
  primary_photo_thumbnail?: string | null;
  scout_photo_count?: number;
  scout_tags?: string[];
}

// Project Location Attachment (junction table)
export interface BacklotProjectLocation {
  id: string;
  project_id: string;
  location_id: string;
  project_notes: string | null;
  scene_description: string | null;
  attached_by_user_id: string | null;
  attached_at: string;
  updated_at: string;
  // Joined location data
  location?: BacklotLocation;
}

// Location Input for creating/updating
export interface BacklotLocationInput {
  name: string;
  description?: string | null;
  scene_description?: string | null;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  zip?: string | null;
  country?: string;
  latitude?: number | null;
  longitude?: number | null;
  contact_name?: string | null;
  contact_phone?: string | null;
  contact_email?: string | null;
  parking_notes?: string | null;
  load_in_notes?: string | null;
  power_available?: boolean;
  restrooms_available?: boolean;
  permit_required?: boolean;
  permit_notes?: string | null;
  permit_obtained?: boolean;
  location_fee?: number | null;
  fee_notes?: string | null;
  images?: string[];
  is_public?: boolean;
  visibility?: 'public' | 'unlisted' | 'private';
  region_tag?: string | null;
  location_type?: BacklotLocationType | string | null;
  amenities?: string[];
}

// Attachment input for linking locations to projects
export interface BacklotLocationAttachmentInput {
  location_id: string;
  project_notes?: string | null;
  scene_description?: string | null;
}

// Search parameters for global location library
export interface BacklotLocationSearchParams {
  query?: string;
  region?: string;
  city?: string;
  state?: string;
  location_type?: string;
  limit?: number;
  offset?: number;
}

// Search response
export interface BacklotLocationSearchResponse {
  locations: BacklotLocation[];
  count: number;
  offset: number;
  limit: number;
}

// =====================================================
// SCOUT PHOTOS
// =====================================================

// Scout photo vantage types
export type ScoutPhotoVantageType = 'wide' | 'medium' | 'close-up' | 'detail' | 'overhead' | 'drone';

// Scout photo time of day
export type ScoutPhotoTimeOfDay = 'morning' | 'midday' | 'afternoon' | 'golden_hour' | 'blue_hour' | 'night';

// Scout photo interior/exterior
export type ScoutPhotoInteriorExterior = 'interior' | 'exterior' | 'both';

// Scout photo weather conditions
export type ScoutPhotoWeather = 'clear' | 'overcast' | 'cloudy' | 'rainy' | 'foggy' | 'snowy';

// Full scout photo interface
export interface BacklotScoutPhoto {
  id: string;
  location_id: string;

  // Core media info
  image_url: string;
  thumbnail_url: string | null;
  original_filename: string | null;

  // Composition & vantage
  angle_label: string | null;
  vantage_type: ScoutPhotoVantageType | string | null;
  camera_facing: string | null;

  // Time & conditions
  time_of_day: ScoutPhotoTimeOfDay | string | null;
  shoot_date: string | null;
  weather: ScoutPhotoWeather | string | null;

  // Practical notes
  light_notes: string | null;
  sound_notes: string | null;
  access_notes: string | null;
  power_notes: string | null;
  parking_notes: string | null;
  restrictions_notes: string | null;
  general_notes: string | null;

  // Classification
  is_primary: boolean;
  interior_exterior: ScoutPhotoInteriorExterior | string | null;

  // Meta
  uploaded_by_user_id: string | null;
  created_at: string;
  updated_at: string;
}

// Input for creating/updating scout photos
export interface BacklotScoutPhotoInput {
  image_url: string;
  thumbnail_url?: string | null;
  original_filename?: string | null;
  angle_label?: string | null;
  vantage_type?: ScoutPhotoVantageType | string | null;
  camera_facing?: string | null;
  time_of_day?: ScoutPhotoTimeOfDay | string | null;
  shoot_date?: string | null;
  weather?: ScoutPhotoWeather | string | null;
  light_notes?: string | null;
  sound_notes?: string | null;
  access_notes?: string | null;
  power_notes?: string | null;
  parking_notes?: string | null;
  restrictions_notes?: string | null;
  general_notes?: string | null;
  is_primary?: boolean;
  interior_exterior?: ScoutPhotoInteriorExterior | string | null;
}

// Scout photo filters for queries
export interface ScoutPhotoFilters {
  vantage_type?: ScoutPhotoVantageType | string;
  time_of_day?: ScoutPhotoTimeOfDay | string;
  interior_exterior?: ScoutPhotoInteriorExterior | string;
}

// Scout summary response (for call sheet preview)
export interface BacklotScoutSummary {
  success: boolean;
  has_scout_photos: boolean;
  primary_photo: {
    id: string;
    image_url: string;
    thumbnail_url: string;
    angle_label: string | null;
    vantage_type: string | null;
    time_of_day: string | null;
  } | null;
  photo_count: number;
  practical_summary: {
    access: string | null;
    parking: string | null;
    power: string | null;
    sound: string | null;
    light: string | null;
    restrictions: string | null;
  } | null;
  tags: string[];
}

// API response types
export interface ScoutPhotosResponse {
  success: boolean;
  photos: BacklotScoutPhoto[];
  count: number;
}

export interface ScoutPhotoResponse {
  success: boolean;
  photo: BacklotScoutPhoto;
}

// Gear Item
export interface BacklotGearItem {
  id: string;
  project_id: string;
  name: string;
  category: string | null;
  description: string | null;
  serial_number: string | null;
  asset_tag: string | null;
  status: BacklotGearStatus;
  is_owned: boolean;
  rental_house: string | null;
  rental_cost_per_day: number | null;
  assigned_to: string | null;
  assigned_production_day_id: string | null;
  pickup_date: string | null;
  return_date: string | null;
  notes: string | null;
  condition_notes: string | null;
  created_at: string;
  updated_at: string;
  // Joined data
  assignee?: BacklotProfile;
  assigned_day?: BacklotProductionDay;
}

// Backlot Gear Item Enriched (with rental order data)
export interface BacklotGearItemEnriched extends BacklotGearItem {
  // Rental order linkage
  gear_rental_order_item_id?: string | null;
  rental_order_id?: string;
  rental_order?: {
    id: string;
    order_number: string;
    status: string;
    rental_start_date: string;
    rental_end_date: string;
    rental_house_org_id: string;
    rental_house_name?: string;
    rental_house_avatar?: string;
  };

  // Work order linkage
  work_order_id?: string;
  work_order?: {
    id: string;
    title: string;
    status: string;
    notes: string;
  };

  // Rate details
  rental_rate_type?: 'daily' | 'weekly' | 'monthly' | 'flat';
  rental_weekly_rate?: number | null;
  rental_monthly_rate?: number | null;

  // Delivery tracking
  delivery_tracking_number?: string;
  delivery_status?: string;
}

// Backlot Rental Summary
export interface BacklotRentalSummary {
  active_rentals_count: number;
  total_daily_cost: number;
  total_weekly_cost: number;
  total_monthly_cost: number;
  upcoming_pickups: Array<{
    order_id: string;
    item_name: string;
    pickup_date: string;
    days_until: number;
  }>;
  pending_returns: Array<{
    order_id: string;
    item_name: string;
    return_date: string;
    days_until: number;
    is_overdue: boolean;
  }>;
}

// Project Update
export interface BacklotProjectUpdate {
  id: string;
  project_id: string;
  title: string;
  content: string;
  type: BacklotUpdateType;
  is_public: boolean;
  attachments: Attachment[];
  created_by: string;
  created_at: string;
  updated_at: string;
  // Joined data
  author?: BacklotProfile;
}

export interface Attachment {
  url: string;
  name: string;
  type: string;
}

// Project Contact
export interface BacklotProjectContact {
  id: string;
  project_id: string;
  contact_type: BacklotContactType;
  status: BacklotContactStatus;
  name: string;
  company: string | null;
  email: string | null;
  phone: string | null;
  role_interest: string | null;
  notes: string | null;
  last_contact_date: string | null;
  next_follow_up_date: string | null;
  user_id: string | null;
  source: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  // Joined data
  linked_user?: BacklotProfile;
  creator?: BacklotProfile;
}

// Project Credit
export interface BacklotProjectCredit {
  id: string;
  project_id: string;
  user_id: string | null;
  name: string;
  credit_role: string;
  department: string | null;
  is_primary: boolean;
  is_public: boolean;
  order_index: number;
  endorsement_note: string | null;
  imdb_id: string | null;
  credit_preference_id: string | null;
  auto_created: boolean;
  source_role_id: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  // Joined data
  linked_user?: BacklotProfile;
  credit_preference?: CreditPreference | null;
  source_role?: {
    id: string;
    title: string;
    department: string | null;
    type: 'cast' | 'crew';
  } | null;
}

// Input types for mutations
export interface ProjectInput {
  title: string;
  logline?: string;
  description?: string;
  project_type?: string;
  genre?: string;
  format?: string;
  runtime_minutes?: number;
  status?: BacklotProjectStatus;
  visibility?: BacklotVisibility;
  target_start_date?: string;
  target_end_date?: string;
  cover_image_url?: string;
  thumbnail_url?: string;
}

export interface ProjectMemberInput {
  user_id: string;
  role?: BacklotMemberRole;
  production_role?: string;
  department?: string;
  phone?: string;
  email?: string;
}

export interface ProductionDayInput {
  day_number: number;
  date: string;
  title?: string;
  description?: string;
  general_call_time?: string;
  wrap_time?: string;
  location_id?: string;
  location_name?: string;
  location_address?: string;
  notes?: string;
  weather_notes?: string;
}

export interface CallSheetInput {
  production_day_id?: string;
  title: string;
  date: string;
  general_call_time?: string;
  location_name?: string;
  location_address?: string;
  parking_notes?: string;
  production_contact?: string;
  production_phone?: string;
  schedule_blocks?: ScheduleBlock[];
  weather_info?: string;
  special_instructions?: string;
  safety_notes?: string;
  hospital_name?: string;
  hospital_address?: string;
  hospital_phone?: string;

  // Extended Template Fields
  template_type?: BacklotCallSheetTemplate;
  production_title?: string;
  production_company?: string;
  shoot_day_number?: number;
  total_shoot_days?: number;

  // Extended Timing
  crew_call_time?: string;
  first_shot_time?: string;
  breakfast_time?: string;
  lunch_time?: string;
  dinner_time?: string;
  estimated_wrap_time?: string;
  sunrise_time?: string;
  sunset_time?: string;

  // Extended Location
  location_id?: string;
  parking_instructions?: string;
  basecamp_location?: string;

  // Production Contacts
  production_office_phone?: string;
  production_email?: string;
  upm_name?: string;
  upm_phone?: string;
  first_ad_name?: string;
  first_ad_phone?: string;
  director_name?: string;
  director_phone?: string;
  producer_name?: string;
  producer_phone?: string;

  // Department Notes
  camera_notes?: string;
  sound_notes?: string;
  grip_electric_notes?: string;
  art_notes?: string;
  wardrobe_notes?: string;
  makeup_hair_notes?: string;
  stunts_notes?: string;
  vfx_notes?: string;
  transport_notes?: string;
  catering_notes?: string;

  // Weather
  weather_forecast?: string;

  // Safety
  nearest_hospital?: string;
  set_medic?: string;
  fire_safety_officer?: string;

  // Additional Notes
  general_notes?: string;
  advance_schedule?: string;

  // Branding
  header_logo_url?: string;

  // Custom Contacts
  custom_contacts?: CallSheetCustomContact[];

  // Medical/Corporate template fields
  hipaa_officer?: string;
  privacy_notes?: string;
  release_status?: string;
  restricted_areas?: string;
  dress_code?: string;
  client_name?: string;
  client_phone?: string;
  facility_contact?: string;
  facility_phone?: string;

  // News/ENG template fields
  deadline_time?: string;
  story_angle?: string;
  reporter_name?: string;
  reporter_phone?: string;
  subject_notes?: string;
  location_2_name?: string;
  location_2_address?: string;
  location_3_name?: string;
  location_3_address?: string;

  // Live Event template fields
  load_in_time?: string;
  rehearsal_time?: string;
  doors_time?: string;
  intermission_time?: string;
  strike_time?: string;
  truck_location?: string;
  video_village?: string;
  comm_channel?: string;
  td_name?: string;
  td_phone?: string;
  stage_manager_name?: string;
  stage_manager_phone?: string;
  camera_plot?: string;
  show_rundown?: string;
  rain_plan?: string;
  client_notes?: string;
  broadcast_notes?: string;
  playback_notes?: string;
}

export interface CallSheetPersonInput {
  member_id?: string;
  name: string;
  role?: string;
  department?: string;
  call_time: string;
  phone?: string;
  email?: string;
  notes?: string;
  makeup_time?: string;
  wardrobe_notes?: string;
  sort_order?: number;
  // Cast-specific fields
  is_cast?: boolean;
  cast_number?: string;
  character_name?: string;
  pickup_time?: string;
  on_set_time?: string;
}

export interface CallSheetSceneInput {
  scene_number?: string;
  segment_label?: string;
  page_count?: string;
  set_name: string;
  int_ext?: BacklotIntExt;
  time_of_day?: BacklotTimeOfDay;
  description?: string;
  cast_ids?: string;
  cast_names?: string;
  location_id?: string;
  sort_order?: number;
}

export interface CallSheetLocationInput {
  location_number?: number;
  location_id?: string;
  name: string;
  address?: string;
  parking_instructions?: string;
  basecamp_location?: string;
  call_time?: string;
  notes?: string;
  sort_order?: number;
}

// Input for production day tasks (legacy backlot_tasks system)
export interface ProductionTaskInput {
  title: string;
  description?: string;
  status?: BacklotTaskStatus;
  priority?: BacklotTaskPriority;
  assigned_to?: string;
  department?: string;
  due_date?: string;
  parent_task_id?: string;
  production_day_id?: string;
  position?: number;
}

export interface LocationInput {
  name: string;
  description?: string;
  scene_description?: string;
  address?: string;
  city?: string;
  state?: string;
  zip?: string;
  country?: string;
  latitude?: number;
  longitude?: number;
  contact_name?: string;
  contact_phone?: string;
  contact_email?: string;
  parking_notes?: string;
  load_in_notes?: string;
  power_available?: boolean;
  restrooms_available?: boolean;
  permit_required?: boolean;
  permit_notes?: string;
  permit_obtained?: boolean;
  location_fee?: number;
  fee_notes?: string;
  images?: string[];
}

export interface GearItemInput {
  name: string;
  category?: string;
  description?: string;
  serial_number?: string;
  asset_tag?: string;
  status?: BacklotGearStatus;
  is_owned?: boolean;
  rental_house?: string;
  rental_cost_per_day?: number;
  assigned_to?: string;
  assigned_production_day_id?: string;
  pickup_date?: string;
  return_date?: string;
  notes?: string;
  condition_notes?: string;
}

export interface ProjectUpdateInput {
  title: string;
  content: string;
  type?: BacklotUpdateType;
  is_public?: boolean;
  attachments?: Attachment[];
}

export interface ProjectContactInput {
  contact_type?: BacklotContactType;
  status?: BacklotContactStatus;
  name: string;
  company?: string;
  email?: string;
  phone?: string;
  role_interest?: string;
  notes?: string;
  last_contact_date?: string;
  next_follow_up_date?: string;
  user_id?: string;
  source?: string;
}

export interface ProjectCreditInput {
  user_id?: string;
  name: string;
  credit_role: string;
  department?: string;
  is_primary?: boolean;
  is_public?: boolean;
  order_index?: number;
  endorsement_note?: string;
  imdb_id?: string;
}

// Filter types
export interface ProjectFilters {
  status?: BacklotProjectStatus | 'all';
  visibility?: BacklotVisibility | 'all';
  search?: string;
}

export interface TaskFilters {
  status?: BacklotTaskStatus | 'all';
  priority?: BacklotTaskPriority | 'all';
  assigned_to?: string;
  department?: string;
  production_day_id?: string;
}

export interface ContactFilters {
  contact_type?: BacklotContactType | 'all';
  status?: BacklotContactStatus | 'all';
  search?: string;
}

// Unified Person - combines team members and contacts
export interface UnifiedPerson {
  id: string; // Primary identifier
  source: 'team' | 'contact' | 'both';
  name: string;
  email?: string | null;
  phone?: string | null;
  // Team member fields
  access_role?: string | null; // owner, admin, editor, viewer
  backlot_roles: string[];
  primary_role?: string | null;
  user_avatar?: string | null;
  user_username?: string | null;
  // Contact fields
  contact_type?: string | null;
  contact_status?: string | null;
  company?: string | null;
  role_interest?: string | null;
  // Relationship identifiers
  is_team_member: boolean;
  has_account: boolean; // has user_id
  contact_id?: string | null;
  member_id?: string | null;
  user_id?: string | null;
}

export interface UnifiedPeopleResponse {
  team: BacklotProjectMember[];
  contacts: BacklotProjectContact[];
  unified: UnifiedPerson[];
}

// View/Tab types for workspace navigation
export type BacklotWorkspaceView =
  | 'overview'
  | 'script'
  | 'scenes'
  | 'shot-lists'
  | 'coverage'
  | 'schedule'
  | 'days'
  | 'call-sheets'
  | 'hot-set'
  | 'casting'
  | 'people'
  | 'tasks'
  | 'review'
  | 'dailies'
  | 'camera-continuity'
  | 'continuity'
  | 'checkin'
  | 'my-space'
  | 'locations'
  | 'gear'
  | 'budget'
  | 'daily-budget'
  | 'timecards'
  | 'receipts'
  | 'clearances'
  | 'assets'
  | 'analytics'
  | 'updates'
  | 'contacts'
  | 'credits'
  | 'roles'
  | 'access'
  | 'settings'
  | 'church-tools'
  | 'invoices'
  | 'coms'
  | 'scripty'
  | 'expenses'
  | 'approvals'
  | 'camera'
  | 'budget-comparison'
  | 'day-out-of-days'
  | 'strip-board'
  | 'storyboard'
  | 'moodboard'
  | 'episode-management'
  | 'files'
  | 'script-sides'
  | 'story-management'
  | 'av-script'
  | 'run-of-show'
  | 'media-pipeline'
  | 'program-rundown';

// =============================================================================
// HOT SET (Production Day) TYPES
// =============================================================================

export type HotSetDayType = '4hr' | '8hr' | '10hr' | '12hr' | '6th_day' | '7th_day';
export type HotSetSessionStatus = 'not_started' | 'in_progress' | 'wrapped';
export type HotSetSceneStatus = 'pending' | 'in_progress' | 'completed' | 'skipped' | 'moved';
export type HotSetScheduleStatus = 'ahead' | 'on_time' | 'behind';
export type HotSetMarkerType =
  | 'call_time'
  | 'first_shot'
  | 'meal_in'
  | 'meal_out'
  | 'company_move'
  | 'camera_wrap'
  | 'martini'
  | 'wrap'
  | 'ot_threshold_1'
  | 'ot_threshold_2'
  | 'custom';

// Schedule import source for session creation
export type HotSetScheduleImportSource = 'hour_schedule' | 'call_sheet' | 'none';

// Schedule tracking mode
export type HotSetScheduleTrackingMode = 'auto_reorder' | 'track_deviation';

export interface HotSetSession {
  id: string;
  project_id: string;
  production_day_id: string;
  call_sheet_id: string | null;
  day_type: HotSetDayType;
  actual_call_time: string | null;
  actual_first_shot_time: string | null;
  actual_wrap_time: string | null;
  status: HotSetSessionStatus;
  started_at: string | null;
  wrapped_at: string | null;
  default_hourly_rate: number | null;
  ot_multiplier_1: number;
  ot_multiplier_2: number;
  ot_threshold_1_hours: number;
  ot_threshold_2_hours: number;
  notes: string | null;
  created_at: string;
  updated_at: string;
  // NEW: Auto-start and confirmation fields
  crew_call_confirmed_at?: string | null;
  crew_call_confirmed_by?: string | null;
  first_shot_confirmed_at?: string | null;
  first_shot_confirmed_by?: string | null;
  auto_started?: boolean;
  // Timezone and location fields (imported from call sheet)
  timezone?: string | null;
  timezone_offset?: string | null;
  location_name?: string | null;
  location_address?: string | null;
  // Joined data
  backlot_production_days?: {
    day_number: number;
    date: string;
    title: string | null;
    general_call_time: string | null;
  };
  // Hour Schedule Integration
  imported_schedule?: HourScheduleBlock[];
  imported_schedule_config?: HourScheduleConfig;
  schedule_import_source?: HotSetScheduleImportSource;
  schedule_tracking_mode?: HotSetScheduleTrackingMode;
}

export interface HotSetSceneLog {
  id: string;
  session_id: string;
  call_sheet_scene_id: string | null;
  scene_number: string | null;
  set_name: string | null;
  int_ext: string | null;
  description: string | null;
  estimated_minutes: number | null;
  scheduled_start_time: string | null;
  actual_start_time: string | null;
  actual_end_time: string | null;
  actual_duration_minutes: number | null;
  status: HotSetSceneStatus;
  sort_order: number;
  notes: string | null;
  skip_reason: string | null;
  // From imported schedule
  expected_start_time?: string;
  expected_end_time?: string;
  expected_duration_minutes?: number;
  // Deviation tracking (calculated)
  start_deviation_minutes?: number;
  end_deviation_minutes?: number;
  duration_deviation_minutes?: number;
  // NEW: Dual variance tracking
  cumulative_variance_minutes?: number;  // Total variance accumulated
  realtime_deviation_minutes?: number;   // Real-time comparison to schedule
}

export interface HotSetMarker {
  id: string;
  session_id: string;
  marker_type: HotSetMarkerType;
  timestamp: string;
  label: string | null;
  notes: string | null;
}

export interface HotSetCrew {
  id: string;
  session_id: string;
  call_sheet_person_id: string | null;
  name: string;
  department: string | null;
  role: string | null;
  rate_type: 'hourly' | 'daily' | 'weekly' | 'flat';
  rate_amount: number | null;
  actual_call_time: string | null;
  actual_wrap_time: string | null;
  total_hours: number | null;
  regular_hours: number | null;
  ot_hours_1: number | null;
  ot_hours_2: number | null;
  calculated_cost: number | null;
}

export interface HotSetTimeStats {
  call_time: string | null;
  first_shot_time: string | null;
  current_time: string;
  elapsed_minutes: number;
  ot_threshold_1_at: string | null;
  ot_threshold_2_at: string | null;
  projected_wrap_time: string | null;
}

export interface HotSetCostProjection {
  current_regular_cost: number;
  current_ot1_cost: number;
  current_ot2_cost: number;
  current_total_cost: number;
  projected_regular_cost: number;
  projected_ot1_cost: number;
  projected_ot2_cost: number;
  projected_total_cost: number;
  ot_overage_alert: boolean;
}

export interface HotSetScheduleInfo {
  status: HotSetScheduleStatus;
  variance_minutes: number;
  scenes_completed: number;
  scenes_total: number;
  percent_complete: number;
}

// Unified schedule item with projected times
export type ProjectedScheduleItemType = 'scene' | 'meal' | 'company_move' | 'activity' | 'crew_call' | 'first_shot' | 'wrap';
export type ProjectedScheduleItemStatus = 'pending' | 'in_progress' | 'completed' | 'skipped';
export type ProjectedScheduleSourceType = 'scene_log' | 'schedule_block' | 'imported';

export interface ProjectedScheduleItem {
  id: string;
  type: ProjectedScheduleItemType;
  name: string;  // Scene number or activity name
  description?: string;  // Slugline or location

  // Planned times (from imported schedule)
  planned_start_time: string;  // HH:MM
  planned_end_time: string;
  planned_duration_minutes: number;

  // Projected times (after cascading variance)
  projected_start_time?: string;
  projected_end_time?: string;
  variance_from_plan?: number;  // Cumulative variance: negative = late, positive = ahead

  // Actual times (when completed)
  actual_start_time?: string;
  actual_end_time?: string;
  actual_duration_minutes?: number;

  status: ProjectedScheduleItemStatus;
  is_current?: boolean;

  // NEW: Real-time deviation - compares current time to where we should be
  realtime_deviation_minutes?: number;  // Negative = behind schedule, Positive = ahead of schedule

  // Source reference (to link back to scene or schedule block)
  source_type: ProjectedScheduleSourceType;
  source_id?: string;
}

// Real-time OT projection based on current progress
export interface OTProjectionData {
  projected_wrap_time: string;  // HH:MM
  call_time: string;  // HH:MM
  total_hours: number;
  regular_hours: number;
  ot1_hours: number;
  ot2_hours: number;
  projected_ot_cost: number;
  // Breakdown by crew if available
  crew_count: number;
  crew_with_rates: number;
}

export interface HotSetDashboard {
  session: HotSetSession;
  current_scene: HotSetSceneLog | null;
  next_scenes: HotSetSceneLog[];
  completed_scenes: HotSetSceneLog[];
  markers: HotSetMarker[];
  time_stats: HotSetTimeStats;
  cost_projection: HotSetCostProjection;
  schedule_status: HotSetScheduleInfo;
  // Schedule integration (optional for backward compatibility)
  schedule_blocks?: HotSetScheduleBlock[];
  schedule_deviation_minutes?: number;
  current_expected_block?: HourScheduleBlock | null;
  next_expected_block?: HourScheduleBlock | null;
  catch_up_suggestions?: HotSetCatchUpSuggestion[];
  timeline?: HotSetTimeline;
  // New: Full projected schedule with live updates
  projected_schedule?: ProjectedScheduleItem[];
  ot_projection?: OTProjectionData;
}

// =============================================================================
// HOT SET SCHEDULE INTEGRATION TYPES
// =============================================================================

// Schedule block status for non-scene items
export type HotSetScheduleBlockStatus = 'pending' | 'in_progress' | 'completed' | 'skipped';

// Schedule block type for non-scene items
export type HotSetScheduleBlockType = 'meal' | 'company_move' | 'activity' | 'crew_call' | 'first_shot' | 'wrap';

// Track non-scene schedule items (meals, moves, activities)
export interface HotSetScheduleBlock {
  id: string;
  session_id: string;
  block_type: HotSetScheduleBlockType;
  // From imported schedule
  expected_start_time: string;
  expected_end_time: string;
  expected_duration_minutes: number;
  // Actual tracking
  actual_start_time?: string;
  actual_end_time?: string;
  status: HotSetScheduleBlockStatus;
  // Display
  name: string;
  location_name?: string;
  notes?: string;
  // Linked marker (created when block completes)
  linked_marker_id?: string;
  // Original schedule block reference
  original_schedule_block_id?: string;
  sort_order: number;
}

// Catch-up suggestion types
export type HotSetCatchUpSuggestionType =
  | 'break_shortening'      // Reduce meal/break duration (compliance warning)
  | 'walking_lunch'         // Take lunch while working (compliance warning)
  | 'skip_activity'         // Skip non-essential activities
  | 'scene_consolidation'   // Combine similar scenes (same location/setup)
  | 'schedule_reordering'   // Shoot scenes out of order to optimize
  | 'scene_cut'             // Cut non-essential scenes
  | 'scene_move'            // Move scenes to another day
  | 'extend_day'            // Work into overtime (cost impact warning)
  | 'meal_penalty_warning'  // Warning: approaching meal penalty
  | 'wrap_extension_warning' // Warning: projected wrap significantly over
  // Legacy types (for backward compatibility)
  | 'shorten_meal'
  | 'combine_setups'
  | 'cut_scene';

// Impact level for suggestions
export type HotSetCatchUpImpact = 'low' | 'medium' | 'high';

// Catch-up suggestion when behind schedule
export interface HotSetCatchUpSuggestion {
  id: string;
  type: HotSetCatchUpSuggestionType;
  description: string;
  time_saved_minutes: number;
  impact: HotSetCatchUpImpact;
  action_data?: Record<string, unknown>;
}

// Timeline data for visual display
export interface HotSetTimeline {
  day_start: string;
  day_end: string;
  current_time: string;
  expected_position_minutes: number;
  actual_position_minutes: number;
}

// =============================================================================
// HOT SET DAY PREVIEW TYPES (for session creation with OT projection)
// =============================================================================

export interface HotSetDayPreviewProductionDay {
  id: string;
  day_number: number;
  date: string;
  title: string | null;
  general_call_time: string | null;
  location_name: string | null;
}

export interface HotSetDayPreviewExpectedHours {
  call_time: string | null;
  wrap_time: string | null;
  total_hours: number;
}

export interface HotSetCrewPreviewPerson {
  id: string;
  name: string;
  role: string | null;
  department: string | null;
  source: 'dood' | 'call_sheet' | 'both';
  user_id: string | null;
  has_rate: boolean;
  rate_type: 'hourly' | 'daily' | 'weekly' | 'flat' | null;
  rate_amount: number | null;
  rate_source: 'user' | 'role' | 'booking' | null;
  projected_cost: number | null;
}

export interface HotSetOTProjection {
  day_type: string;
  ot1_threshold: number;
  ot2_threshold: number;
  regular_hours: number;
  ot1_hours: number;
  ot2_hours: number;
  total_regular_cost: number;
  total_ot1_cost: number;
  total_ot2_cost: number;
  total_cost: number;
  crew_with_rates: number;
  crew_without_rates: number;
}

export interface HotSetDayPreview {
  production_day: HotSetDayPreviewProductionDay;
  expected_hours: HotSetDayPreviewExpectedHours;
  crew: HotSetCrewPreviewPerson[];
  ot_projection: HotSetOTProjection;
}

// OT Threshold configuration
export interface HotSetOTConfig {
  ot1_after: number;
  ot2_after: number;
  label: string;
  desc: string;
}

// =============================================================================
// HOT SET SETTINGS & NOTIFICATIONS (NEW)
// =============================================================================

// Hot Set settings for auto-start and notifications
export interface HotSetSettings {
  id: string;
  project_id: string;
  timezone?: string | null;  // IANA timezone (e.g., "America/Los_Angeles")
  auto_start_enabled: boolean;
  auto_start_minutes_before_call: number;
  notifications_enabled: boolean;
  notify_minutes_before_call: number;
  notify_crew_on_auto_start: boolean;
  suggestion_trigger_minutes_behind: number;
  suggestion_trigger_meal_penalty_minutes: number;
  suggestion_trigger_wrap_extension_minutes: number;
  default_schedule_view: 'current' | 'full' | 'completed';
  created_at: string;
  updated_at: string;
}

// Hot Set settings update payload
export interface HotSetSettingsUpdate {
  timezone?: string | null;  // IANA timezone (e.g., "America/Los_Angeles")
  auto_start_enabled?: boolean;
  auto_start_minutes_before_call?: number;
  notifications_enabled?: boolean;
  notify_minutes_before_call?: number;
  notify_crew_on_auto_start?: boolean;
  suggestion_trigger_minutes_behind?: number;
  suggestion_trigger_meal_penalty_minutes?: number;
  suggestion_trigger_wrap_extension_minutes?: number;
  default_schedule_view?: 'current' | 'full' | 'completed';
}

// Hot Set notification types
export type HotSetNotificationType =
  | 'pre_crew_call'
  | 'auto_start'
  | 'crew_call_confirmed'
  | 'first_shot_confirmed'
  | 'meal_penalty_warning'
  | 'wrap_extension_warning'
  | 'catch_up_suggestion'
  | 'custom';

// Hot Set notification
export interface HotSetNotification {
  id: string;
  session_id: string;
  notification_type: HotSetNotificationType;
  recipient_profile_ids: string[];
  recipient_count: number;
  title: string;
  message: string;
  sent_at: string;
  delivery_method: 'in_app' | 'email' | 'sms' | 'push';
  metadata?: Record<string, unknown>;
  created_at: string;
}

// Project stats for dashboard
export interface ProjectStats {
  total_tasks: number;
  completed_tasks: number;
  upcoming_days: number;
  total_locations: number;
  total_gear: number;
  active_contacts: number;
}

// Call Sheet Send Types
export type CallSheetSendChannel = 'email' | 'notification' | 'email_and_notification';
export type CallSheetRecipientMode = 'all_project_members' | 'call_sheet_people' | 'custom';

export interface CallSheetSendRequest {
  channel: CallSheetSendChannel;
  recipient_mode: CallSheetRecipientMode;
  recipient_user_ids?: string[];
  extra_emails?: string[];
  message?: string;
}

export interface CallSheetSendResponse {
  success: boolean;
  send_id?: string;
  emails_sent: number;
  notifications_sent: number;
  total_recipients: number;
  message: string;
}

export interface CallSheetSendHistory {
  id: string;
  sent_at: string;
  sent_by_name?: string;
  channel: CallSheetSendChannel;
  recipient_count: number;
  emails_sent: number;
  notifications_sent: number;
  message?: string;
}

export interface ProjectMemberForSend {
  user_id: string;
  name: string;
  email?: string;
  avatar_url?: string;
  role: string;
  production_role?: string;
}

// PDF Generation Types
export interface CallSheetPdfGenerateRequest {
  regenerate?: boolean; // Force regeneration even if PDF exists
  include_logo?: boolean;
}

export interface CallSheetPdfGenerateResponse {
  success: boolean;
  pdf_url: string;
  generated_at: string;
  message: string;
}

// Logo Upload Types
export interface LogoUploadResponse {
  success: boolean;
  logo_url: string;
  message: string;
}

// Sync Types
export interface CallSheetSyncRequest {
  sync_production_day?: boolean;
  sync_locations?: boolean;
  sync_tasks?: boolean;
}

export interface CallSheetSyncResponse {
  success: boolean;
  production_day_synced: boolean;
  locations_created: number;
  tasks_created: number;
  message: string;
}

// =====================================================
// BUDGET SYSTEM TYPES
// =====================================================

// Budget Status Enum
export type BacklotBudgetStatus = 'draft' | 'pending_approval' | 'approved' | 'locked' | 'archived';

// Receipt OCR Status Enum
export type BacklotReceiptOcrStatus = 'pending' | 'processing' | 'succeeded' | 'failed';

// Line Item Rate Type (legacy - kept for backwards compatibility)
export type BacklotLineItemRateType = 'flat' | 'daily' | 'weekly' | 'hourly' | 'per_unit';

// Payment Method for Receipts
export type BacklotPaymentMethod = 'cash' | 'card' | 'check' | 'wire' | 'petty_cash';

// Reimbursement Status
export type BacklotReimbursementStatus = 'not_applicable' | 'pending' | 'approved' | 'reimbursed' | 'changes_requested' | 'denied';

// =====================================================
// PROFESSIONAL BUDGET TYPES (New)
// =====================================================

// Budget Project Type Template
export type BacklotBudgetProjectType =
  | 'feature'
  | 'episodic'
  | 'documentary'
  | 'music_video'
  | 'commercial'
  | 'short'
  | 'custom';

// Budget Category Type (for Top Sheet grouping)
export type BacklotCategoryType = 'above_the_line' | 'production' | 'post' | 'other';

// Budget Phase
export type BacklotBudgetPhase =
  | 'development'
  | 'prep'
  | 'production'
  | 'wrap'
  | 'post'
  | 'delivery';

// Enhanced Calculation Mode
export type BacklotCalcMode =
  | 'flat'
  | 'rate_x_days'
  | 'rate_x_weeks'
  | 'rate_x_units'
  | 'rate_x_episodes'
  | 'rate_x_hours'
  | 'percent_of_total'
  | 'percent_of_subtotal';

// Union Type for projects
export type BacklotUnionType = 'non_union' | 'sag_aftra' | 'iatse' | 'dga' | 'wga' | 'mixed';

// Budget Account Template (for seeding budgets by project type)
export interface BacklotBudgetAccount {
  id: string;
  project_type: BacklotBudgetProjectType;
  account_code: string;
  sub_code: string | null;
  name: string;
  description: string | null;
  category_type: BacklotCategoryType;
  category_name: string;
  department: string | null;
  phase: BacklotBudgetPhase | null;
  default_calc_mode: BacklotCalcMode;
  default_units: string | null;
  sort_order: number;
  is_common: boolean;
  aicp_code: string | null;
  dga_code: string | null;
  union_codes: string[] | null;
  created_at: string;
  updated_at: string;
}

// Top Sheet Cache
export interface BacklotTopSheetCache {
  id: string;
  budget_id: string;
  above_the_line_total: number;
  production_total: number;
  post_total: number;
  other_total: number;
  total_fringes: number;
  subtotal: number;
  contingency_amount: number;
  grand_total: number;
  category_summaries: BacklotTopSheetCategorySummary[];
  computed_at: string;
  is_stale: boolean;
}

export interface BacklotTopSheetCategorySummary {
  id: string;
  name: string;
  code: string | null;
  category_type: BacklotCategoryType;
  sort_order: number;
  estimated_total: number;
  actual_total: number;
}

// Main Budget
export interface BacklotBudget {
  id: string;
  project_id: string;
  name: string;
  description: string | null;
  currency: string;
  status: BacklotBudgetStatus;
  approved_by: string | null;
  approved_at: string | null;
  locked_at: string | null;
  estimated_total: number;
  actual_total: number;
  variance: number;
  contingency_percent: number;
  contingency_amount: number;
  notes: string | null;
  version: number;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  // Professional budget fields (new)
  project_type_template: BacklotBudgetProjectType;
  has_top_sheet: boolean;
  pdf_url: string | null;
  last_pdf_generated_at: string | null;
  fringes_total: number;
  grand_total: number;
  shoot_days: number;
  prep_days: number;
  wrap_days: number;
  post_days: number;
  episode_count: number;
  union_type: string;
  // Joined data
  categories?: BacklotBudgetCategory[];
  line_items?: BacklotBudgetLineItem[];
  daily_budgets?: BacklotDailyBudget[];
  top_sheet?: BacklotTopSheetCache;
}

// Budget Category
export interface BacklotBudgetCategory {
  id: string;
  budget_id: string;
  name: string;
  code: string | null;
  description: string | null;
  estimated_subtotal: number;
  actual_subtotal: number;
  sort_order: number;
  color: string | null;
  icon: string | null;
  created_at: string;
  updated_at: string;
  // Professional budget fields (new)
  category_type: BacklotCategoryType;
  account_code_prefix: string | null;
  phase: BacklotBudgetPhase | null;
  is_above_the_line: boolean;
  // Sales tax fields
  is_taxable: boolean;
  tax_rate: number; // Stored as decimal (e.g., 0.0825 for 8.25%)
  // Joined data
  line_items?: BacklotBudgetLineItem[];
  // Computed
  variance?: number;
}

// Budget Line Item
export interface BacklotBudgetLineItem {
  id: string;
  budget_id: string;
  category_id: string | null;
  account_code: string | null;
  description: string;
  rate_type: BacklotLineItemRateType;
  rate_amount: number;
  quantity: number;
  units: string | null;
  estimated_total: number;
  actual_total: number;
  variance: number;
  vendor_name: string | null;
  po_number: string | null;
  invoice_reference: string | null;
  notes: string | null;
  internal_notes: string | null;
  is_allocated_to_days: boolean;
  total_allocated: number;
  is_locked: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
  // Professional budget fields (new)
  calc_mode: BacklotCalcMode;
  days: number | null;
  weeks: number | null;
  episodes: number | null;
  union_code: string | null;
  is_fringe: boolean;
  fringe_base_item_id: string | null;
  fringe_percent: number | null;
  source_type: string | null;
  source_id: string | null;
  sub_account_code: string | null;
  phase: BacklotBudgetPhase | null;
  department: string | null;
  manual_total_override: number | null;
  use_manual_total: boolean;
  // Tax line item fields
  is_tax_line_item: boolean;
  tax_source_category_id: string | null;
  // Joined data
  category?: BacklotBudgetCategory;
  receipts?: BacklotReceipt[];
  day_links?: BacklotBudgetDayLink[];
  fringe_base_item?: BacklotBudgetLineItem;
}

// Daily Budget (Per Production Day)
export interface BacklotDailyBudget {
  id: string;
  project_id: string;
  budget_id: string;
  production_day_id: string;
  date: string;
  estimated_total: number;
  actual_total: number;
  variance: number;
  variance_percent: number;
  notes: string | null;
  created_at: string;
  updated_at: string;
  // Joined data
  production_day?: BacklotProductionDay;
  items?: BacklotDailyBudgetItem[];
  receipts?: BacklotReceipt[];
}

// Daily Budget Item
export interface BacklotDailyBudgetItem {
  id: string;
  daily_budget_id: string;
  budget_line_item_id: string | null;
  label: string;
  category_name: string | null;
  estimated_amount: number;
  actual_amount: number;
  vendor_name: string | null;
  notes: string | null;
  is_ad_hoc: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
  // Joined data
  line_item?: BacklotBudgetLineItem;
}

// Budget Day Link (Maps line items to production days)
export interface BacklotBudgetDayLink {
  id: string;
  project_id: string;
  budget_id: string;
  budget_line_item_id: string;
  production_day_id: string;
  call_sheet_id: string | null;
  estimated_share: number;
  actual_share: number;
  notes: string | null;
  created_at: string;
  updated_at: string;
  // Joined data
  line_item?: BacklotBudgetLineItem;
  production_day?: BacklotProductionDay;
}

// Receipt
export interface BacklotReceipt {
  id: string;
  project_id: string;
  budget_id: string | null;
  daily_budget_id: string | null;
  budget_line_item_id: string | null;
  file_url: string;
  original_filename: string | null;
  file_type: string | null;
  file_size_bytes: number | null;
  vendor_name: string | null;
  description: string | null;
  purchase_date: string | null;
  amount: number | null;
  tax_amount: number | null;
  currency: string;
  ocr_status: BacklotReceiptOcrStatus;
  ocr_confidence: number | null;
  raw_ocr_json: Record<string, any> | null;
  extracted_text: string | null;
  is_mapped: boolean;
  is_verified: boolean;
  payment_method: BacklotPaymentMethod | null;
  reimbursement_status: BacklotReimbursementStatus;
  rejection_reason: string | null;
  reimbursement_to: string | null;
  notes: string | null;
  created_by_user_id: string;
  created_at: string;
  updated_at: string;
  // Joined data
  line_item?: BacklotBudgetLineItem;
  daily_budget?: BacklotDailyBudget;
  created_by?: BacklotProfile;
}

// =====================================================
// BUDGET INPUT TYPES
// =====================================================

export interface BudgetInput {
  name?: string;
  description?: string;
  currency?: string;
  status?: BacklotBudgetStatus;
  contingency_percent?: number;
  notes?: string;
  // Professional budget fields (new)
  project_type_template?: BacklotBudgetProjectType;
  shoot_days?: number;
  prep_days?: number;
  wrap_days?: number;
  post_days?: number;
  episode_count?: number;
  union_type?: string;
}

export interface BudgetCategoryInput {
  name: string;
  code?: string;
  description?: string;
  sort_order?: number;
  color?: string;
  icon?: string;
  // Professional budget fields (new)
  category_type?: BacklotCategoryType;
  account_code_prefix?: string;
  phase?: BacklotBudgetPhase;
  is_above_the_line?: boolean;
  // Sales tax fields
  is_taxable?: boolean;
  tax_rate?: number; // Stored as decimal (e.g., 0.0825 for 8.25%)
}

export interface BudgetLineItemInput {
  category_id?: string;
  account_code?: string;
  description: string;
  rate_type?: BacklotLineItemRateType;
  rate_amount?: number;
  quantity?: number;
  units?: string;
  actual_total?: number;
  vendor_name?: string;
  po_number?: string;
  invoice_reference?: string;
  notes?: string;
  internal_notes?: string;
  is_locked?: boolean;
  sort_order?: number;
  // Professional budget fields (new)
  calc_mode?: BacklotCalcMode;
  days?: number;
  weeks?: number;
  episodes?: number;
  union_code?: string;
  is_fringe?: boolean;
  fringe_base_item_id?: string;
  fringe_percent?: number;
  source_type?: string;
  source_id?: string;
  sub_account_code?: string;
  phase?: BacklotBudgetPhase;
  department?: string;
  manual_total_override?: number;
  use_manual_total?: boolean;
}

export interface DailyBudgetInput {
  date?: string;
  notes?: string;
}

export interface DailyBudgetItemInput {
  budget_line_item_id?: string;
  label: string;
  category_name?: string;
  estimated_amount?: number;
  actual_amount?: number;
  vendor_name?: string;
  notes?: string;
  is_ad_hoc?: boolean;
  sort_order?: number;
}

export interface BudgetDayLinkInput {
  budget_line_item_id: string;
  production_day_id: string;
  call_sheet_id?: string;
  estimated_share?: number;
  actual_share?: number;
  notes?: string;
}

export interface ReceiptInput {
  budget_id?: string;
  daily_budget_id?: string;
  budget_line_item_id?: string;
  scene_id?: string;
  vendor_name?: string;
  description?: string;
  purchase_date?: string;
  amount?: number;
  tax_amount?: number;
  currency?: string;
  payment_method?: BacklotPaymentMethod;
  reimbursement_status?: BacklotReimbursementStatus;
  reimbursement_to?: string;
  notes?: string;
}

export interface ReceiptMappingInput {
  budget_line_item_id?: string;
  daily_budget_id?: string;
  scene_id?: string;
  vendor_name?: string;
  amount?: number;
  purchase_date?: string;
  is_verified?: boolean;
}

// =====================================================
// BUDGET API RESPONSE TYPES
// =====================================================

export interface BudgetSummary {
  budget: BacklotBudget;
  categories: BacklotBudgetCategory[];
  total_line_items: number;
  total_receipts: number;
  unmapped_receipts: number;
  daily_budgets_count: number;
}

export interface DailyBudgetSummary {
  id: string;
  date: string;
  production_day_number: number;
  production_day_title: string | null;
  estimated_total: number;
  actual_total: number;
  variance: number;
  variance_percent: number;
  item_count: number;
  receipt_count: number;
  has_call_sheet: boolean;
}

export interface BudgetStats {
  estimated_total: number;
  actual_total: number;
  variance: number;
  variance_percent: number;
  receipt_total: number;
  unmapped_receipt_total: number;
  categories_over_budget: number;
  categories_under_budget: number;
  days_over_budget: number;
}

export interface ReceiptOcrResult {
  vendor_name?: string;
  amount?: number;
  tax_amount?: number;
  purchase_date?: string;
  line_items?: Array<{ description: string; amount: number }>;
  confidence: number;
  raw_text: string;
}

export interface SuggestedLineItemsForDay {
  production_day_id: string;
  date: string;
  suggestions: Array<{
    line_item: BacklotBudgetLineItem;
    match_reason: string;
    suggested_share: number;
  }>;
}

// Update workspace views to include budget
export type BacklotWorkspaceViewExtended =
  | BacklotWorkspaceView
  | 'budget'
  | 'daily-budget';

// Budget Filter types
export interface BudgetFilters {
  category_id?: string | 'all';
  has_variance?: boolean;
  search?: string;
}

export interface ReceiptFilters {
  is_mapped?: boolean;
  is_verified?: boolean;
  date_from?: string;
  date_to?: string;
  budget_line_item_id?: string;
  daily_budget_id?: string;
  search?: string;
  reimbursement_status?: BacklotReimbursementStatus;
}

// CSV Export types for tax/accounting
export interface ReceiptExportRow {
  date: string;
  vendor: string;
  description: string;
  amount: number;
  tax_amount: number | null;
  category: string;
  line_item: string;
  production_day: string | null;
  payment_method: string | null;
  reimbursement_status: string;
  file_url: string;
}

// =====================================================
// PROFESSIONAL BUDGET API TYPES (New)
// =====================================================

// Top Sheet data structure for display
export interface TopSheetData {
  budget_id: string;
  project_title: string;
  project_type: BacklotBudgetProjectType;
  prepared_date: string;
  // Category type breakdowns
  above_the_line: TopSheetSection;
  production: TopSheetSection;
  post: TopSheetSection;
  other: TopSheetSection;
  // Totals
  subtotal: number;
  contingency_percent: number;
  contingency_amount: number;
  fringes_total: number;
  grand_total: number;
  // Metadata
  is_stale: boolean;
  last_computed: string;
}

export interface TopSheetSection {
  label: string;
  total: number;
  categories: TopSheetCategoryRow[];
}

export interface TopSheetCategoryRow {
  code: string | null;
  name: string;
  estimated: number;
  actual: number;
  variance: number;
}

// Budget Template for creating from project type
export interface BudgetTemplate {
  project_type: BacklotBudgetProjectType;
  name: string;
  description: string;
  categories: BudgetTemplateCategory[];
}

export interface BudgetTemplateCategory {
  name: string;
  code: string;
  category_type: BacklotCategoryType;
  account_code_prefix: string;
  sort_order: number;
  line_items: BudgetTemplateLineItem[];
}

export interface BudgetTemplateLineItem {
  account_code: string;
  description: string;
  calc_mode: BacklotCalcMode;
  default_units: string;
  department: string | null;
}

// Create budget from template input
export interface CreateBudgetFromTemplateInput {
  project_id: string;
  project_type: BacklotBudgetProjectType;
  name?: string;
  shoot_days?: number;
  prep_days?: number;
  wrap_days?: number;
  post_days?: number;
  episode_count?: number;
  union_type?: string;
  include_common_only?: boolean;
}

// PDF Export options
export interface BudgetPdfExportOptions {
  include_top_sheet: boolean;
  include_detail: boolean;
  include_daily_budgets: boolean;
  include_receipts_summary: boolean;
  show_actuals: boolean;
  show_variance: boolean;
  category_types?: BacklotCategoryType[];
}

// Daily Budget sync/interpretation result
export interface DailyBudgetSyncResult {
  daily_budget_id: string;
  production_day_id: string;
  date: string;
  items_created: number;
  items_updated: number;
  items_removed: number;
  total_estimated: number;
  warnings: string[];
}

// Sync configuration for budget-to-daily
export interface BudgetToDailySyncConfig {
  sync_mode: 'full' | 'incremental';
  include_phases?: BacklotBudgetPhase[];
  include_departments?: string[];
  split_method: 'equal' | 'weighted' | 'manual';
}

// Full sync summary returned from API
export interface BudgetSyncSummary {
  project_id: string;
  budget_id: string;
  total_days_synced: number;
  total_items_created: number;
  total_items_updated: number;
  total_items_removed: number;
  total_estimated: number;
  warnings: string[];
  day_results: DailyBudgetSyncResult[];
}

// =============================================================================
// DEPARTMENT BUNDLE TYPES (for intentional budget creation)
// =============================================================================

export type BudgetSeedMode = 'blank' | 'categories_only' | 'bundles' | 'essentials';

export interface BundleLineItem {
  account_code: string;
  description: string;
  calc_mode: string;
  default_units: string;
  department: string | null;
  phase: string | null;
  is_essential: boolean;
}

export interface BundleCategory {
  name: string;
  code: string;
  account_code_prefix: string;
  category_type: BacklotCategoryType;
  sort_order: number;
  color: string;
  line_items: BundleLineItem[];
}

export interface DepartmentBundle {
  id: string;
  name: string;
  description: string;
  category_type: BacklotCategoryType;
  icon: string;
  categories: BundleCategory[];
  total_line_items: number;
  is_recommended: boolean;
}

export interface BundleListResponse {
  bundles: DepartmentBundle[];
  project_types: string[];
  category_types: string[];
}

export interface RecommendedBundlesResponse {
  project_type: string;
  recommended: DepartmentBundle[];
  core_essentials: DepartmentBundle[];
  all_available: DepartmentBundle[];
}

export interface CreateBudgetFromBundlesInput {
  name?: string;
  project_type?: BacklotBudgetProjectType;
  currency?: string;
  contingency_percent?: number;
  shoot_days?: number;
  prep_days?: number;
  wrap_days?: number;
  post_days?: number;
  episode_count?: number;
  union_type?: string;
  seed_mode: BudgetSeedMode;
  selected_bundle_ids?: string[];
  include_above_the_line?: boolean;
  include_production?: boolean;
  include_post?: boolean;
  include_other?: boolean;
}

export interface BudgetCreationResult {
  budget: BacklotBudget;
  categories_created: number;
  line_items_created: number;
  bundles_used: string[];
  seed_mode: BudgetSeedMode;
}

export interface AddBundleResult {
  success: boolean;
  bundle_id: string;
  categories_created: number;
  line_items_created: number;
  message: string;
}

// Labels for seed modes
export const SEED_MODE_LABELS: Record<BudgetSeedMode, string> = {
  blank: 'Start from Blank',
  categories_only: 'Categories Only',
  bundles: 'From Department Bundles',
  essentials: 'Core Essentials Only',
};

export const SEED_MODE_DESCRIPTIONS: Record<BudgetSeedMode, string> = {
  blank: 'Create an empty budget with no categories or line items',
  categories_only: 'Create high-level categories without line items',
  bundles: 'Select specific department bundles to include',
  essentials: 'Start with core essential items for your project type',
};

// Labels for display
export const BUDGET_PROJECT_TYPE_LABELS: Record<BacklotBudgetProjectType, string> = {
  feature: 'Feature Film',
  episodic: 'Episodic/TV Series',
  documentary: 'Documentary',
  music_video: 'Music Video',
  commercial: 'Commercial',
  short: 'Short Film',
  custom: 'Custom',
};

export const CATEGORY_TYPE_LABELS: Record<BacklotCategoryType, string> = {
  above_the_line: 'Above the Line',
  production: 'Production',
  post: 'Post-Production',
  other: 'Other/Indirect',
};

export const CALC_MODE_LABELS: Record<BacklotCalcMode, string> = {
  flat: 'Flat/Allow',
  rate_x_days: 'Rate × Days',
  rate_x_weeks: 'Rate × Weeks',
  rate_x_units: 'Rate × Units',
  rate_x_episodes: 'Rate × Episodes',
  rate_x_hours: 'Rate × Hours',
  percent_of_total: '% of Total',
  percent_of_subtotal: '% of Subtotal',
};

export const BUDGET_PHASE_LABELS: Record<BacklotBudgetPhase, string> = {
  development: 'Development',
  prep: 'Pre-Production',
  production: 'Production',
  wrap: 'Wrap',
  post: 'Post-Production',
  delivery: 'Delivery',
};

// =============================================================================
// SCRIPT BREAKDOWN SYSTEM TYPES
// =============================================================================

// Script status
export type BacklotScriptStatus = 'draft' | 'locked' | 'archived';

// Scene coverage status
export type BacklotSceneCoverageStatus = 'not_scheduled' | 'scheduled' | 'shot' | 'needs_pickup';

// Breakdown item types
export type BacklotBreakdownItemType =
  | 'cast'
  | 'background'
  | 'stunt'
  | 'location'
  | 'prop'
  | 'set_dressing'
  | 'wardrobe'
  | 'makeup'
  | 'sfx'
  | 'vfx'
  | 'vehicle'
  | 'animal'
  | 'greenery'
  | 'special_equipment'
  | 'sound'
  | 'music';

// Budget suggestion status
export type BacklotBudgetSuggestionStatus = 'pending' | 'accepted' | 'rejected' | 'modified';

// Title Page Data Types
export interface TitlePageContact {
  name?: string;
  company?: string;
  address?: string;
  phone?: string;
  email?: string;
}

export interface TitlePageDraftInfo {
  date?: string;
  revision?: string;
}

export interface TitlePageData {
  title?: string;
  written_by?: string[];
  based_on?: string;
  contact?: TitlePageContact;
  draft_info?: TitlePageDraftInfo;
  copyright?: string;
  additional_lines?: string[];
}

// Script
export interface BacklotScript {
  id: string;
  project_id: string;
  title: string;
  version: string | null;
  draft_date: string | null;
  author: string | null;
  file_url: string | null;
  file_type: 'fdx' | 'pdf' | 'manual' | null;
  total_pages: number | null;
  status: BacklotScriptStatus;
  notes: string | null;
  created_by_user_id: string | null;
  created_at: string;
  updated_at: string;
  title_page_data?: TitlePageData | null;  // Structured title page metadata
  // Joined data
  scenes?: BacklotScene[];
  scene_count?: number;
}

// Scene
export interface BacklotScene {
  id: string;
  script_id: string;
  project_id: string;
  scene_number: string;
  int_ext: BacklotIntExt | null;
  time_of_day: BacklotTimeOfDay | string | null;
  set_name: string | null;
  location_id: string | null;
  page_start: number | null;
  page_end: number | null;
  page_count: string | null;
  synopsis: string | null;
  notes: string | null;
  coverage_status: BacklotSceneCoverageStatus;
  is_omitted: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
  // Joined data
  location?: BacklotLocation;
  breakdown_items?: BacklotBreakdownItem[];
  call_sheet_links?: BacklotCallSheetSceneLink[];
  breakdown_count?: number;
}

// Breakdown Item
export interface BacklotBreakdownItem {
  id: string;
  scene_id: string;
  item_type: BacklotBreakdownItemType;
  name: string;
  description: string | null;
  quantity: number;
  notes: string | null;
  linked_cast_member_id: string | null;
  linked_prop_id: string | null;
  linked_vehicle_id: string | null;
  budget_estimate: number | null;
  budget_category_id: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
  // Joined data
  cast_member?: BacklotProjectMember;
  budget_category?: BacklotBudgetCategory;
}

// Budget Suggestion (from script breakdown)
export interface BacklotBudgetSuggestion {
  id: string;
  project_id: string;
  script_id: string | null;
  suggested_category: string;
  suggested_description: string;
  suggested_amount: number;
  source_type: string;
  source_id: string | null;
  source_name: string | null;
  scene_count: number;
  status: BacklotBudgetSuggestionStatus;
  applied_line_item_id: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  // Joined data
  applied_line_item?: BacklotBudgetLineItem;
}

// Call Sheet Scene Link (junction table)
export interface BacklotCallSheetSceneLink {
  id: string;
  call_sheet_id: string;
  scene_id: string;
  sequence: number;        // Order in the call sheet's scene list (from DB)
  sort_order: number;      // Alias for sequence (UI compatibility)
  shoot_order?: number;    // Legacy alias
  notes: string | null;
  created_at: string;
  // Joined data
  scene?: BacklotScene;
  call_sheet?: BacklotCallSheet;
}

// =============================================================================
// SCRIPT BREAKDOWN INPUT TYPES
// =============================================================================

export interface ScriptInput {
  title: string;
  version?: string | null;
  draft_date?: string | null;
  author?: string | null;
  file_url?: string | null;
  file_type?: 'fdx' | 'pdf' | 'manual' | null;
  total_pages?: number | null;
  status?: BacklotScriptStatus;
  notes?: string | null;
}

export interface SceneInput {
  script_id?: string;
  scene_number: string;
  int_ext?: BacklotIntExt | null;
  time_of_day?: BacklotTimeOfDay | string | null;
  set_name?: string | null;
  location_id?: string | null;
  page_start?: number | null;
  page_end?: number | null;
  page_length?: number | null;
  page_count?: string | null;
  synopsis?: string | null;
  notes?: string | null;
  coverage_status?: BacklotSceneCoverageStatus;
  is_omitted?: boolean;
  sort_order?: number;
}

export interface BreakdownItemInput {
  item_type: BacklotBreakdownItemType;
  name: string;
  description?: string | null;
  quantity?: number;
  notes?: string | null;
  linked_cast_member_id?: string | null;
  linked_prop_id?: string | null;
  linked_vehicle_id?: string | null;
  budget_estimate?: number | null;
  budget_category_id?: string | null;
  sort_order?: number;
}

export interface CallSheetSceneLinkInput {
  scene_id: string;
  shoot_order?: number;
  notes?: string | null;
}

// =============================================================================
// SCRIPT BREAKDOWN API RESPONSE TYPES
// =============================================================================

// Script import response
export interface ScriptImportResponse {
  success: boolean;
  script: BacklotScript;
  scenes_created: number;
  message: string;
}

// Coverage statistics
export interface SceneCoverageStats {
  total_scenes: number;
  not_scheduled: number;
  scheduled: number;
  shot: number;
  needs_pickup: number;
  omitted: number;
  total_pages: number;
  pages_shot: number;
  percent_complete: number;
  scenes_by_location: Array<{
    location_id: string | null;
    location_name: string | null;
    scene_count: number;
    page_count: number;
  }>;
  scenes_by_int_ext: Array<{
    int_ext: string | null;
    scene_count: number;
  }>;
}

// Location needs analysis
export interface LocationNeedsItem {
  location_name: string;
  location_id: string | null;
  scene_count: number;
  scenes: Array<{
    scene_id: string;
    scene_number: string;
    int_ext: string | null;
    time_of_day: string | null;
    page_count: string | null;
    coverage_status: BacklotSceneCoverageStatus;
  }>;
  day_night_breakdown: {
    day: number;
    night: number;
    other: number;
  };
  int_ext_breakdown: {
    interior: number;
    exterior: number;
    both: number;
  };
  total_pages: number;
  has_location_assigned: boolean;
}

export interface LocationNeedsResponse {
  success: boolean;
  project_id: string;
  total_unique_locations: number;
  locations_assigned: number;
  locations_unassigned: number;
  needs: LocationNeedsItem[];
}

// Task generation response
export interface TaskGenerationResponse {
  success: boolean;
  tasks_created: number;
  breakdown_items_processed: number;
  message: string;
  tasks: BacklotTask[];
}

// Proposed task for preview before creation
export interface ProposedTask {
  breakdown_item_id: string;
  scene_id: string;
  scene_number: string;
  title: string;
  description: string;
  department: string;
  priority: BacklotTaskPriority;
  item_type: string;
  item_label: string;
  quantity: number;
  // UI state for editing
  selected?: boolean;
}

// Task preview response
export interface TaskPreviewResponse {
  success: boolean;
  proposed_tasks: ProposedTask[];
  message: string;
}

// Input for creating tasks from preview
export interface CreateTasksFromPreviewInput {
  tasks: Array<{
    title: string;
    description: string;
    department: string;
    priority: string;
    breakdown_item_id?: string;
  }>;
}

// Budget suggestion generation response
export interface BudgetSuggestionGenerationResponse {
  success: boolean;
  suggestions_created: number;
  total_suggested_amount: number;
  message: string;
  suggestions: BacklotBudgetSuggestion[];
}

// Scene breakdown summary (for quick view)
export interface SceneBreakdownSummary {
  scene_id: string;
  scene_number: string;
  total_items: number;
  items_by_type: Array<{
    item_type: BacklotBreakdownItemType;
    count: number;
    estimated_cost: number;
  }>;
  total_estimated_cost: number;
  has_cast: boolean;
  has_stunts: boolean;
  has_vfx: boolean;
  has_sfx: boolean;
}

// =============================================================================
// SCRIPT BREAKDOWN FILTER TYPES
// =============================================================================

export interface SceneFilters {
  coverage_status?: BacklotSceneCoverageStatus | 'all';
  int_ext?: BacklotIntExt | 'all';
  location_id?: string | 'all';
  has_breakdown?: boolean;
  search?: string;
}

export interface BreakdownItemFilters {
  item_type?: BacklotBreakdownItemType | 'all';
  has_budget_estimate?: boolean;
  search?: string;
}

// =============================================================================
// SCRIPT BREAKDOWN LABELS
// =============================================================================

export const SCENE_COVERAGE_STATUS_LABELS: Record<BacklotSceneCoverageStatus, string> = {
  not_scheduled: 'Not Scheduled',
  scheduled: 'Scheduled',
  shot: 'Shot',
  needs_pickup: 'Needs Pickup',
};

export const SCENE_COVERAGE_STATUS_COLORS: Record<BacklotSceneCoverageStatus, string> = {
  not_scheduled: 'gray',
  scheduled: 'blue',
  shot: 'green',
  needs_pickup: 'orange',
};

export const BREAKDOWN_ITEM_TYPE_LABELS: Record<BacklotBreakdownItemType, string> = {
  cast: 'Cast',
  background: 'Background/Extras',
  stunt: 'Stunts',
  location: 'Location',
  prop: 'Props',
  set_dressing: 'Set Dressing',
  wardrobe: 'Wardrobe',
  makeup: 'Makeup/Hair',
  sfx: 'Special Effects',
  vfx: 'Visual Effects',
  vehicle: 'Vehicles',
  animal: 'Animals',
  greenery: 'Greenery',
  special_equipment: 'Special Equipment',
  sound: 'Sound',
  music: 'Music',
};

export const BREAKDOWN_ITEM_TYPE_COLORS: Record<BacklotBreakdownItemType, string> = {
  cast: 'red',
  background: 'orange',
  stunt: 'purple',
  location: 'brown',
  prop: 'violet',
  set_dressing: 'amber',
  wardrobe: 'blue',
  makeup: 'pink',
  sfx: 'yellow',
  vfx: 'cyan',
  vehicle: 'slate',
  animal: 'lime',
  greenery: 'emerald',
  special_equipment: 'indigo',
  sound: 'sky',
  music: 'fuchsia',
};

export const SCRIPT_STATUS_LABELS: Record<BacklotScriptStatus, string> = {
  draft: 'Draft',
  locked: 'Locked',
  archived: 'Archived',
};

// =============================================================================
// SCRIPT PAGE NOTES TYPES
// =============================================================================

// Script page note types
export type BacklotScriptPageNoteType =
  | 'general'
  | 'direction'
  | 'production'
  | 'character'
  | 'blocking'
  | 'camera'
  | 'continuity'
  | 'sound'
  | 'vfx'
  | 'prop'
  | 'wardrobe'
  | 'makeup'
  | 'location'
  | 'safety'
  | 'other';

// Script page note
export interface BacklotScriptPageNote {
  id: string;
  script_id: string;
  project_id: string;
  page_number: number;
  position_x: number | null;
  position_y: number | null;
  note_text: string;
  note_type: BacklotScriptPageNoteType;
  scene_id: string | null;
  resolved: boolean;
  resolved_at: string | null;
  resolved_by_user_id: string | null;
  author_user_id: string;
  created_at: string;
  updated_at: string;
  // Joined data
  author?: BacklotProfile;
  resolved_by?: BacklotProfile;
  scene?: BacklotScene;
}

// Script page note input
export interface ScriptPageNoteInput {
  page_number: number;
  position_x?: number | null;
  position_y?: number | null;
  note_text: string;
  note_type?: BacklotScriptPageNoteType;
  scene_id?: string | null;
}

// Script page note update input
export interface ScriptPageNoteUpdateInput {
  page_number?: number;
  position_x?: number | null;
  position_y?: number | null;
  note_text?: string;
  note_type?: BacklotScriptPageNoteType;
  scene_id?: string | null;
}

// Script page notes summary (per page)
export interface ScriptPageNoteSummary {
  page_number: number;
  note_count: number;
  unresolved_count: number;
  note_types: BacklotScriptPageNoteType[];
}

// Script page notes filter
export interface ScriptPageNoteFilters {
  page_number?: number;
  note_type?: BacklotScriptPageNoteType | 'all';
  resolved?: boolean;
  scene_id?: string;
  author_user_id?: string;
}

// Labels for script page note types
export const SCRIPT_PAGE_NOTE_TYPE_LABELS: Record<BacklotScriptPageNoteType, string> = {
  general: 'General',
  direction: "Director's Note",
  production: 'Production',
  character: 'Character',
  blocking: 'Blocking/Staging',
  camera: 'Camera/Shot',
  continuity: 'Continuity',
  sound: 'Sound/Audio',
  vfx: 'VFX',
  prop: 'Props',
  wardrobe: 'Wardrobe',
  makeup: 'Makeup/Hair',
  location: 'Location',
  safety: 'Safety',
  other: 'Other',
};

// Colors for script page note types
export const SCRIPT_PAGE_NOTE_TYPE_COLORS: Record<BacklotScriptPageNoteType, string> = {
  general: 'gray',
  direction: 'purple',
  production: 'blue',
  character: 'red',
  blocking: 'orange',
  camera: 'cyan',
  continuity: 'yellow',
  sound: 'sky',
  vfx: 'fuchsia',
  prop: 'violet',
  wardrobe: 'indigo',
  makeup: 'pink',
  location: 'amber',
  safety: 'rose',
  other: 'slate',
};

// =============================================================================
// SCRIPT VERSIONING TYPES
// =============================================================================

// Industry standard revision colors
export type BacklotScriptColorCode =
  | 'white'      // First draft
  | 'blue'       // 1st revision
  | 'pink'       // 2nd revision
  | 'yellow'     // 3rd revision
  | 'green'      // 4th revision
  | 'goldenrod'  // 5th revision
  | 'buff'       // 6th revision
  | 'salmon'     // 7th revision
  | 'cherry'     // 8th revision
  | 'tan'        // 9th revision
  | 'gray'       // 10th revision
  | 'ivory';     // 11th revision

// Extended BacklotScript interface with versioning fields
export interface BacklotScriptVersion {
  id: string;
  project_id: string;
  parent_version_id: string | null;
  version_number: number;
  title: string;
  version: string | null;
  color_code: BacklotScriptColorCode;
  revision_notes: string | null;
  is_current: boolean;
  is_locked: boolean;
  locked_by_user_id: string | null;
  locked_at: string | null;
  text_content: string | null;
  file_url: string | null;
  file_type: 'fdx' | 'pdf' | 'manual' | null;
  page_count: number | null;
  total_pages: number | null;
  format: string | null;
  parse_status: string | null;
  parse_error: string | null;
  total_scenes: number;
  created_by_user_id: string | null;
  created_at: string;
  updated_at: string;
  // Joined data
  created_by?: BacklotProfile;
  locked_by?: BacklotProfile;
  scenes?: BacklotScene[];
  scene_count?: number;
}

// Version history item
export interface BacklotScriptVersionHistoryItem {
  id: string;
  version: string | null;
  version_number: number;
  color_code: BacklotScriptColorCode;
  is_current: boolean;
  is_locked: boolean;
  revision_notes: string | null;
  created_at: string;
  created_by_user_id: string | null;
  created_by?: BacklotProfile;
}

// Input for creating a new script version
export interface ScriptVersionInput {
  parent_version_id?: string;
  title?: string;
  version?: string;
  color_code?: BacklotScriptColorCode;
  revision_notes?: string;
  text_content?: string;
  file_url?: string;
  file_type?: 'fdx' | 'pdf' | 'manual';
}

// Labels for script color codes
export const SCRIPT_COLOR_CODE_LABELS: Record<BacklotScriptColorCode, string> = {
  white: 'White (First Draft)',
  blue: 'Blue',
  pink: 'Pink',
  yellow: 'Yellow',
  green: 'Green',
  goldenrod: 'Goldenrod',
  buff: 'Buff',
  salmon: 'Salmon',
  cherry: 'Cherry',
  tan: 'Tan',
  gray: 'Gray',
  ivory: 'Ivory',
};

// Hex colors for script revisions (for rendering)
export const SCRIPT_COLOR_CODE_HEX: Record<BacklotScriptColorCode, string> = {
  white: '#FFFFFF',
  blue: '#ADD8E6',
  pink: '#FFB6C1',
  yellow: '#FFFFE0',
  green: '#90EE90',
  goldenrod: '#DAA520',
  buff: '#F0DC82',
  salmon: '#FA8072',
  cherry: '#DE3163',
  tan: '#D2B48C',
  gray: '#D3D3D3',
  ivory: '#FFFFF0',
};

// =============================================================================
// SCRIPT HIGHLIGHT BREAKDOWN TYPES
// =============================================================================

// Highlight status
export type BacklotHighlightStatus = 'pending' | 'confirmed' | 'rejected';

// Highlight breakdown (text selection that creates breakdown items)
export interface BacklotScriptHighlightBreakdown {
  id: string;
  script_id: string;
  scene_id: string | null;
  page_number: number;
  start_offset: number;
  end_offset: number;
  highlighted_text: string;
  rect_x: number | null;
  rect_y: number | null;
  rect_width: number | null;
  rect_height: number | null;
  category: BacklotBreakdownItemType;
  department: BacklotBreakdownDepartment | null;
  color: string;
  suggested_label: string | null;
  breakdown_item_id: string | null;
  status: BacklotHighlightStatus;
  created_by_user_id: string;
  created_at: string;
  updated_at: string;
  // Joined data
  breakdown_item?: BacklotBreakdownItem;
  scene?: BacklotScene;
  created_by?: BacklotProfile;
}

// Input for creating a highlight
export interface ScriptHighlightInput {
  scene_id?: string;
  page_number?: number;
  start_offset: number;
  end_offset: number;
  highlighted_text?: string;
  text?: string; // Alias for highlighted_text (used in text-based viewer)
  rect_x?: number;
  rect_y?: number;
  rect_width?: number;
  rect_height?: number;
  category: BacklotBreakdownItemType;
  department?: BacklotBreakdownDepartment;
  color?: string;
  suggested_label?: string;
  status?: string;
  // Scene detection info (for auto-linking to scenes by scene number)
  scene_number?: string;
  scene_slugline?: string;
}

// Highlight summary by category
export interface ScriptHighlightSummary {
  category: BacklotBreakdownItemType;
  total_count: number;
  pending_count: number;
  confirmed_count: number;
  labels: string[];
}

// =============================================================================
// SCENE PAGE MAPPING TYPES
// =============================================================================

// Mapping source
export type BacklotMappingSource = 'auto' | 'manual' | 'ai';

// Scene to page mapping
export interface BacklotScenePageMapping {
  id: string;
  script_id: string;
  scene_id: string;
  page_start: number;
  page_end: number;
  start_y: number | null;
  end_y: number | null;
  mapping_source: BacklotMappingSource;
  created_at: string;
  updated_at: string;
  // Joined data
  scene?: BacklotScene;
}

// Input for creating/updating a mapping
export interface ScenePageMappingInput {
  scene_id: string;
  page_start: number;
  page_end: number;
  start_y?: number;
  end_y?: number;
  mapping_source?: BacklotMappingSource;
}

// =============================================================================
// HIGHLIGHT BREAKDOWN COLORS (Standard breakdown colors)
// =============================================================================

export const BREAKDOWN_HIGHLIGHT_COLORS: Record<BacklotBreakdownItemType, string> = {
  cast: '#FF0000',           // Red
  background: '#00FF00',     // Green
  stunt: '#FFA500',          // Orange
  location: '#8B4513',       // Brown
  prop: '#800080',           // Purple
  set_dressing: '#00FFFF',   // Cyan
  wardrobe: '#0000FF',       // Blue (circled)
  makeup: '#FF69B4',         // Pink
  sfx: '#FFFF00',            // Yellow
  vfx: '#FF00FF',            // Magenta
  vehicle: '#A52A2A',        // Brown
  animal: '#32CD32',         // Lime green
  greenery: '#228B22',       // Forest green
  special_equipment: '#4B0082', // Indigo
  sound: '#87CEEB',          // Sky blue
  music: '#DA70D6',          // Orchid
};

// =============================================================================
// CASTING & CREW HIRING PIPELINE TYPES
// =============================================================================

// Project Role Type (cast or crew)
export type BacklotProjectRoleType = 'cast' | 'crew';

// Project Role Status
export type BacklotProjectRoleStatus = 'draft' | 'open' | 'closed' | 'booked' | 'cancelled';

// Role Application Status
export type BacklotApplicationStatus =
  | 'applied'
  | 'viewed'
  | 'shortlisted'
  | 'interview'
  | 'offered'
  | 'booked'
  | 'rejected'
  | 'withdrawn';

// User Availability Status
export type BacklotAvailabilityStatus = 'available' | 'unavailable' | 'hold' | 'booked' | 'tentative';

// Rate Type
export type BacklotRateType = 'flat' | 'daily' | 'weekly' | 'hourly';

// Cast Position Type (database-backed, user-addable)
export interface CastPositionType {
  id: string;
  name: string;
  slug: string;
  created_at: string;
}

// Applicant Profile Snapshot (cached at application time)
export interface BacklotApplicantProfileSnapshot {
  name: string;
  avatar_url?: string | null;
  primary_role?: string;
  department?: string;
  city?: string;
  portfolio_url?: string | null;
  reel_url?: string | null;
  years_experience?: number | null;
  is_order_member: boolean;
  credits_count?: number;
}

// Project Role (casting/crew position)
export interface BacklotProjectRole {
  id: string;
  project_id: string;
  type: BacklotProjectRoleType;
  title: string;
  description: string | null;
  department: string | null;
  // Cast-specific
  character_name: string | null;
  character_description: string | null;
  age_range: string | null;
  gender_requirement: string | null;
  cast_position_type_id: string | null;
  // Joined cast position type data
  cast_position_type?: CastPositionType | null;
  // Location & Schedule
  location: string | null;
  start_date: string | null;
  end_date: string | null;
  days_estimated: number | null;
  // Compensation
  paid: boolean;
  rate_description: string | null;
  rate_amount_cents: number | null;
  rate_type: BacklotRateType | null;
  // Visibility
  is_order_only: boolean;
  is_featured: boolean;
  // Status
  status: BacklotProjectRoleStatus;
  booked_user_id: string | null;
  booked_at: string | null;
  // Application settings
  application_deadline: string | null;
  max_applications: number | null;
  // Cast-specific application requirements
  requires_reel: boolean;
  requires_headshot: boolean;
  requires_self_tape: boolean;
  tape_instructions: string | null;
  tape_format_preferences: string | null;
  tape_workflow: 'upfront' | 'after_shortlist';
  // Audit
  created_by_user_id: string;
  created_at: string;
  updated_at: string;
  // Joined data
  booked_user?: BacklotProfile;
  application_count?: number;
  shortlisted_count?: number;
  booked_count?: number;
  applications?: BacklotRoleApplication[];
  project_title?: string;
  // From join with projects
  backlot_projects?: {
    id: string;
    title: string;
    slug: string;
    cover_image_url: string | null;
    owner_id: string;
  };
  // Community posting
  community_job_id: number | null;
  posted_to_community_at: string | null;
  // For open roles listing
  user_has_applied?: boolean;
  user_application_status?: BacklotApplicationStatus | null;
}

// Role Application
export interface BacklotRoleApplication {
  id: string;
  role_id: string;
  applicant_user_id: string;
  applicant_profile_snapshot: BacklotApplicantProfileSnapshot;
  cover_note: string | null;
  availability_notes: string | null;
  rate_expectation: string | null;
  reel_url: string | null;
  headshot_url: string | null;
  resume_url: string | null;
  // Cast-specific fields
  demo_reel_url: string | null;
  self_tape_url: string | null;
  special_skills: string[] | null;
  tape_requested_at: string | null;
  tape_submitted_at: string | null;
  status: BacklotApplicationStatus;
  status_changed_at: string | null;
  status_changed_by_user_id: string | null;
  internal_notes: string | null;
  rating: number | null;
  created_at: string;
  updated_at: string;
  // Joined data
  backlot_project_roles?: BacklotProjectRole & {
    backlot_projects?: {
      id: string;
      title: string;
      slug: string;
      cover_image_url: string | null;
    };
  };
}

// User Availability Entry
export interface BacklotUserAvailability {
  id: string;
  user_id: string;
  date: string;
  status: BacklotAvailabilityStatus;
  project_id: string | null;
  role_id: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  // Joined data
  backlot_projects?: { id: string; title: string } | null;
  backlot_project_roles?: { id: string; title: string; type: string } | null;
}

// Booked Person (for call sheet integration)
export interface BacklotBookedPerson {
  role_id: string;
  role_title: string;
  role_type: BacklotProjectRoleType;
  department: string | null;
  character_name: string | null;
  user_id: string;
  name: string;
  avatar_url: string | null;
  email: string | null;
  start_date: string | null;
  end_date: string | null;
  booking_rate: string | null;  // e.g., "$500/daily", "$2000/weekly"
}

// =============================================================================
// CASTING & CREW INPUT TYPES
// =============================================================================

export interface ProjectRoleInput {
  type: BacklotProjectRoleType;
  title: string;
  description?: string | null;
  department?: string | null;
  character_name?: string | null;
  character_description?: string | null;
  age_range?: string | null;
  gender_requirement?: string | null;
  cast_position_type_id?: string | null;
  location?: string | null;
  start_date?: string | null;
  end_date?: string | null;
  days_estimated?: number | null;
  paid?: boolean;
  rate_description?: string | null;
  rate_amount_cents?: number | null;
  rate_type?: BacklotRateType | null;
  is_order_only?: boolean;
  is_featured?: boolean;
  status?: BacklotProjectRoleStatus;
  application_deadline?: string | null;
  max_applications?: number | null;
  // Cast-specific application requirements
  requires_reel?: boolean;
  requires_headshot?: boolean;
  requires_self_tape?: boolean;
  tape_instructions?: string | null;
  tape_format_preferences?: string | null;
  tape_workflow?: 'upfront' | 'after_shortlist';
}

export interface RoleApplicationInput {
  cover_note?: string | null;
  availability_notes?: string | null;
  resume_url?: string | null;
  // Cast-specific fields
  demo_reel_url?: string | null;
  self_tape_url?: string | null;
  headshot_url?: string | null;
  special_skills?: string[] | null;
}

export interface ApplicationStatusUpdateInput {
  status: BacklotApplicationStatus;
  internal_notes?: string | null;
  rating?: number | null;
}

export interface UserAvailabilityInput {
  date: string;
  status: BacklotAvailabilityStatus;
  notes?: string | null;
  project_id?: string | null;
}

export interface BulkAvailabilityInput {
  start_date: string;
  end_date: string;
  status: BacklotAvailabilityStatus;
  notes?: string | null;
}

// =============================================================================
// CASTING & CREW FILTER TYPES
// =============================================================================

export interface ProjectRoleFilters {
  type?: BacklotProjectRoleType | 'all';
  status?: BacklotProjectRoleStatus | 'all';
}

export interface OpenRoleFilters {
  type?: BacklotProjectRoleType | 'all';
  location?: string;
  paid_only?: boolean;
  order_only?: boolean;
}

export interface ApplicationFilters {
  status?: BacklotApplicationStatus | 'all';
}

// =============================================================================
// CASTING & CREW LABELS
// =============================================================================

export const PROJECT_ROLE_TYPE_LABELS: Record<BacklotProjectRoleType, string> = {
  cast: 'Cast',
  crew: 'Crew',
};

export const PROJECT_ROLE_STATUS_LABELS: Record<BacklotProjectRoleStatus, string> = {
  draft: 'Draft',
  open: 'Open',
  closed: 'Closed',
  booked: 'Booked',
  cancelled: 'Cancelled',
};

export const PROJECT_ROLE_STATUS_COLORS: Record<BacklotProjectRoleStatus, string> = {
  draft: 'gray',
  open: 'green',
  closed: 'yellow',
  booked: 'blue',
  cancelled: 'red',
};

export const APPLICATION_STATUS_LABELS: Record<BacklotApplicationStatus, string> = {
  applied: 'Applied',
  viewed: 'Viewed',
  shortlisted: 'Shortlisted',
  interview: 'Interview',
  offered: 'Offered',
  booked: 'Booked',
  rejected: 'Rejected',
  withdrawn: 'Withdrawn',
};

export const APPLICATION_STATUS_COLORS: Record<BacklotApplicationStatus, string> = {
  applied: 'gray',
  viewed: 'blue',
  shortlisted: 'yellow',
  interview: 'purple',
  offered: 'cyan',
  booked: 'green',
  rejected: 'red',
  withdrawn: 'slate',
};

export const AVAILABILITY_STATUS_LABELS: Record<BacklotAvailabilityStatus, string> = {
  available: 'Available',
  unavailable: 'Unavailable',
  hold: 'On Hold',
  booked: 'Booked',
  tentative: 'Tentative',
};

export const AVAILABILITY_STATUS_COLORS: Record<BacklotAvailabilityStatus, string> = {
  available: 'green',
  unavailable: 'red',
  hold: 'yellow',
  booked: 'blue',
  tentative: 'orange',
};

// Common crew departments
export const CREW_DEPARTMENTS = [
  'Camera',
  'Sound',
  'Lighting/Grip',
  'Art Department',
  'Wardrobe',
  'Makeup/Hair',
  'Production',
  'Post-Production',
  'VFX',
  'Stunts',
  'Transportation',
  'Locations',
  'Catering/Craft Services',
  'Other',
] as const;

// Gender options for cast roles
export const GENDER_OPTIONS = [
  { value: 'any', label: 'Any' },
  { value: 'male', label: 'Male' },
  { value: 'female', label: 'Female' },
  { value: 'rather_not_answer', label: 'Rather Not Answer' },
] as const;

// =============================================================================
// CLEARANCES & RELEASES TYPES
// =============================================================================

// Clearance Item Type
export type BacklotClearanceType =
  | 'talent_release'
  | 'location_release'
  | 'appearance_release'
  | 'nda'
  | 'music_license'
  | 'stock_license'
  | 'other_contract';

// Clearance Status
export type BacklotClearanceStatus =
  | 'not_started'
  | 'requested'
  | 'pending'
  | 'signed'
  | 'expired'
  | 'rejected';

// Clearance Priority
export type ClearancePriority = 'low' | 'normal' | 'high' | 'urgent';

// Clearance Media Types (for usage rights)
export type ClearanceMediaType =
  | 'theatrical'
  | 'streaming'
  | 'television'
  | 'home_video'
  | 'online'
  | 'festival'
  | 'educational'
  | 'all_media';

// Territory Scope
export type TerritoryScope = 'worldwide' | 'north_america' | 'us_only' | 'regional' | 'specific';

// Term Type
export type TermType = 'perpetual' | 'limited';

// Music License Type
export type MusicLicenseType = 'sync' | 'master' | 'both';

// Music Usage Context
export type MusicUsageContext = 'background' | 'feature' | 'credits' | 'promotional';

// PRO Affiliation
export type PROAffiliation = 'ascap' | 'bmi' | 'sesac' | 'other' | 'none';

// Usage Rights (flexible JSONB structure)
export interface ClearanceUsageRights {
  media_types?: ClearanceMediaType[];
  territories?: {
    scope: TerritoryScope;
    regions?: string[];
    countries?: string[];
  };
  term?: {
    type: TermType;
    start_date?: string;
    end_date?: string;
  };
  exclusivity?: 'exclusive' | 'non-exclusive';
  music_details?: {
    license_type?: MusicLicenseType;
    usage_context?: MusicUsageContext[];
    duration_limit?: '30_sec' | '60_sec' | 'full_track' | 'unlimited';
    pro_affiliation?: PROAffiliation;
    publisher?: string;
    isrc?: string;
  };
}

// Clearance History Action
export type ClearanceHistoryAction =
  | 'created'
  | 'status_changed'
  | 'assigned'
  | 'unassigned'
  | 'file_uploaded'
  | 'file_removed'
  | 'edited'
  | 'rejected'
  | 'reminder_sent'
  | 'expired'
  | 'reviewed'
  | 'usage_rights_updated'
  | 'eo_flagged';

// Clearance History Entry
export interface ClearanceHistoryEntry {
  id: string;
  clearance_id: string;
  action: ClearanceHistoryAction;
  old_status?: string;
  new_status?: string;
  user_id?: string;
  user_name?: string;
  notes?: string;
  metadata?: Record<string, unknown>;
  created_at: string;
}

// E&O Requirement Status
export type EORequirementStatus = 'missing' | 'partial' | 'complete' | 'waived';

// E&O Requirement
export interface EORequirement {
  id: string;
  project_id: string;
  clearance_type: BacklotClearanceType;
  requirement_name: string;
  description?: string;
  is_required: boolean;
  linked_clearance_id?: string;
  linked_clearance?: Pick<BacklotClearanceItem, 'id' | 'title' | 'status' | 'file_url'>;
  status: EORequirementStatus;
  waived_reason?: string;
  waived_by_user_id?: string;
  waived_at?: string;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

// E&O Summary
export interface EOSummary {
  total_requirements: number;
  required_count: number;
  complete_count: number;
  partial_count: number;
  missing_count: number;
  waived_count: number;
  readiness_percentage: number;
  is_delivery_ready: boolean;
  by_type: Record<BacklotClearanceType, {
    total: number;
    complete: number;
    missing: number;
    partial: number;
  }>;
  missing_critical: Array<{
    id: string;
    requirement_name: string;
    clearance_type: BacklotClearanceType;
  }>;
}

// Expiring Clearance
export interface ExpiringClearance {
  id: string;
  title: string;
  type: BacklotClearanceType;
  status: BacklotClearanceStatus;
  expiration_date: string;
  days_until_expiry: number;
  is_eo_critical: boolean;
  related_name?: string;
  assigned_to_user_id?: string;
}

// Clearance Item
export interface BacklotClearanceItem {
  id: string;
  project_id: string;
  type: BacklotClearanceType;
  // Related entities
  related_person_id: string | null;
  related_person_name: string | null;
  related_location_id: string | null;
  related_project_location_id: string | null;
  related_asset_label: string | null;
  // Details
  title: string;
  description: string | null;
  file_url: string | null;
  file_name: string | null;
  file_is_sensitive: boolean;
  // Status
  status: BacklotClearanceStatus;
  // Important dates
  requested_date: string | null;
  signed_date: string | null;
  expiration_date: string | null;
  // Additional info
  notes: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  // Assignment & workflow (new)
  assigned_to_user_id: string | null;
  assigned_at: string | null;
  assigned_by_user_id: string | null;
  rejection_reason: string | null;
  rejected_at: string | null;
  rejected_by_user_id: string | null;
  priority: ClearancePriority;
  // Usage rights (new)
  usage_rights: ClearanceUsageRights;
  // E&O tracking (new)
  is_eo_critical: boolean;
  chain_of_title_url: string | null;
  chain_of_title_notes: string | null;
  scene_id: string | null;
  // Reminder tracking (new)
  last_reminder_sent_at: string | null;
  reminder_count: number;
  // Audit
  created_by_user_id: string;
  created_at: string;
  updated_at: string;
  // Joined data
  related_location?: BacklotLocation;
  created_by?: BacklotProfile;
  assigned_to?: BacklotProfile;
  scene?: { id: string; scene_number: string; };
}

// Clearance Template
export interface BacklotClearanceTemplate {
  id: string;
  owner_user_id: string | null;
  name: string;
  type: BacklotClearanceType;
  description: string | null;
  template_file_url: string | null;
  default_notes: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// =============================================================================
// CLEARANCES INPUT TYPES
// =============================================================================

export interface ClearanceItemInput {
  type: BacklotClearanceType;
  title: string;
  description?: string | null;
  related_person_id?: string | null;
  related_person_name?: string | null;
  related_location_id?: string | null;
  related_project_location_id?: string | null;
  related_asset_label?: string | null;
  file_url?: string | null;
  file_name?: string | null;
  file_is_sensitive?: boolean;
  status?: BacklotClearanceStatus;
  requested_date?: string | null;
  signed_date?: string | null;
  expiration_date?: string | null;
  notes?: string | null;
  contact_email?: string | null;
  contact_phone?: string | null;
  // New workflow fields
  priority?: ClearancePriority;
  usage_rights?: ClearanceUsageRights;
  is_eo_critical?: boolean;
  chain_of_title_url?: string | null;
  chain_of_title_notes?: string | null;
  scene_id?: string | null;
}

// =============================================================================
// CLEARANCES FILTER TYPES
// =============================================================================

export interface ClearanceFilters {
  type?: BacklotClearanceType | 'all';
  status?: BacklotClearanceStatus | 'all';
  search?: string;
}

// =============================================================================
// CLEARANCE RECIPIENTS TYPES
// =============================================================================

export type ClearanceRecipientType = 'contact' | 'member' | 'manual';
export type ClearanceSignatureStatus = 'not_required' | 'pending' | 'viewed' | 'signed' | 'declined';

export interface ClearanceRecipient {
  id: string;
  clearance_id: string;
  project_contact_id: string | null;
  project_member_user_id: string | null;
  manual_email: string | null;
  manual_name: string | null;
  requires_signature: boolean;
  signature_status: ClearanceSignatureStatus;
  signed_at: string | null;
  viewed_at: string | null;
  last_email_sent_at: string | null;
  email_send_count: number;
  last_email_type: 'link' | 'pdf_attachment' | null;
  access_token: string | null;
  access_token_expires_at: string | null;
  added_by_user_id: string | null;
  created_at: string;
  updated_at: string;
  // Resolved data (populated by backend)
  name: string;
  email: string | null;
  phone?: string | null;
  recipient_type: ClearanceRecipientType;
  // Optional joined data
  contact?: BacklotProjectContact;
  member?: BacklotProfile;
}

export interface ClearanceRecipientInput {
  project_contact_id?: string;
  project_member_user_id?: string;
  manual_email?: string;
  manual_name?: string;
  requires_signature?: boolean;
}

export type ClearanceSendType = 'link' | 'pdf_attachment';

export interface ClearanceSendRequest {
  recipient_ids: string[];
  send_type: ClearanceSendType;
  message?: string;
  subject_override?: string;
}

export interface ClearanceSendResult {
  success: boolean;
  emails_sent: number;
  emails_failed: number;
  message: string;
}

// Person clearance with recipients (for Casting & Crew integration)
export interface PersonClearanceDetail extends BacklotClearanceItem {
  recipients: ClearanceRecipient[];
}

export interface PersonClearanceSummary {
  total: number;
  signed: number;
  pending: number;
  missing: number;
}

export interface PersonClearancesResponse {
  clearances: PersonClearanceDetail[];
  summary: PersonClearanceSummary;
}

// =============================================================================
// CLEARANCES API RESPONSE TYPES
// =============================================================================

// Clearance summary (for project overview)
export interface ClearanceSummary {
  total: number;
  by_status: Record<BacklotClearanceStatus, number>;
  by_type: Record<
    BacklotClearanceType,
    {
      total: number;
      signed: number;
      requested: number;
      not_started: number;
      expired: number;
    }
  >;
  expiring_soon: number;
}

// Bulk status lookup response
export interface ClearanceBulkStatusResponse {
  locations: Record<string, BacklotClearanceStatus | 'missing'>;
  persons: Record<string, BacklotClearanceStatus | 'missing'>;
}

// Clearance report row (for CSV export)
export interface ClearanceReportRow {
  type: string;
  title: string;
  status: string;
  related_name: string;
  requested_date: string | null;
  signed_date: string | null;
  expiration_date: string | null;
  contact_email: string | null;
  notes: string | null;
}

// =============================================================================
// CLEARANCES LABELS
// =============================================================================

export const CLEARANCE_TYPE_LABELS: Record<BacklotClearanceType, string> = {
  talent_release: 'Talent Release',
  location_release: 'Location Release',
  appearance_release: 'Appearance Release',
  nda: 'NDA',
  music_license: 'Music License',
  stock_license: 'Stock License',
  other_contract: 'Other Contract',
};

export const CLEARANCE_TYPE_COLORS: Record<BacklotClearanceType, string> = {
  talent_release: 'red',
  location_release: 'blue',
  appearance_release: 'orange',
  nda: 'purple',
  music_license: 'pink',
  stock_license: 'cyan',
  other_contract: 'gray',
};

export const CLEARANCE_STATUS_LABELS: Record<BacklotClearanceStatus, string> = {
  not_started: 'Not Started',
  requested: 'Requested',
  pending: 'Pending',
  signed: 'Signed',
  expired: 'Expired',
  rejected: 'Rejected',
};

export const CLEARANCE_STATUS_COLORS: Record<BacklotClearanceStatus, string> = {
  not_started: 'gray',
  requested: 'yellow',
  pending: 'blue',
  signed: 'green',
  expired: 'orange',
  rejected: 'red',
};

// Priority labels and colors
export const CLEARANCE_PRIORITY_LABELS: Record<ClearancePriority, string> = {
  low: 'Low',
  normal: 'Normal',
  high: 'High',
  urgent: 'Urgent',
};

export const CLEARANCE_PRIORITY_COLORS: Record<ClearancePriority, string> = {
  low: 'gray',
  normal: 'blue',
  high: 'orange',
  urgent: 'red',
};

// E&O Requirement Status Labels
export const EO_STATUS_LABELS: Record<EORequirementStatus, string> = {
  missing: 'Missing',
  partial: 'Partial',
  complete: 'Complete',
  waived: 'Waived',
};

export const EO_STATUS_COLORS: Record<EORequirementStatus, string> = {
  missing: 'red',
  partial: 'yellow',
  complete: 'green',
  waived: 'gray',
};

// Media Type Labels
export const MEDIA_TYPE_LABELS: Record<ClearanceMediaType, string> = {
  theatrical: 'Theatrical',
  streaming: 'Streaming',
  television: 'Television',
  home_video: 'Home Video',
  online: 'Online/Digital',
  festival: 'Festival',
  educational: 'Educational',
  all_media: 'All Media',
};

// Territory Labels
export const TERRITORY_SCOPE_LABELS: Record<TerritoryScope, string> = {
  worldwide: 'Worldwide',
  north_america: 'North America',
  us_only: 'US Only',
  regional: 'Regional',
  specific: 'Specific Countries',
};

// Clearance type groups for matrix view
export const CLEARANCE_TYPE_GROUPS = {
  talent: ['talent_release', 'appearance_release'] as BacklotClearanceType[],
  locations: ['location_release'] as BacklotClearanceType[],
  music: ['music_license'] as BacklotClearanceType[],
  other: ['nda', 'stock_license', 'other_contract'] as BacklotClearanceType[],
};

export const CLEARANCE_TYPE_GROUP_LABELS: Record<keyof typeof CLEARANCE_TYPE_GROUPS, string> = {
  talent: 'Talent',
  locations: 'Locations',
  music: 'Music',
  other: 'Stock & Other',
};

// =============================================================================
// CLEARANCE DOCUMENT VERSIONS
// =============================================================================

export interface ClearanceDocumentVersion {
  id: string;
  clearance_id: string;
  version_number: number;
  file_url: string;
  file_name: string;
  file_size: number | null;
  content_type: string | null;
  uploaded_by_user_id: string | null;
  uploaded_by_name: string | null;
  notes: string | null;
  is_current: boolean;
  created_at: string;
}

export type ClearanceFileType = 'pdf' | 'image' | 'spreadsheet' | 'document' | 'other';

/**
 * Get the file type category from a file name
 */
export function getClearanceFileType(fileName: string): ClearanceFileType {
  const ext = fileName.toLowerCase().split('.').pop();
  if (ext === 'pdf') return 'pdf';
  if (['png', 'jpg', 'jpeg', 'gif', 'webp'].includes(ext || '')) return 'image';
  if (['xls', 'xlsx', 'csv'].includes(ext || '')) return 'spreadsheet';
  if (['doc', 'docx'].includes(ext || '')) return 'document';
  return 'other';
}

/**
 * Get a human-readable label for a file type
 */
export function getClearanceFileTypeLabel(fileType: ClearanceFileType): string {
  switch (fileType) {
    case 'pdf': return 'PDF Document';
    case 'image': return 'Image';
    case 'spreadsheet': return 'Spreadsheet';
    case 'document': return 'Word Document';
    default: return 'File';
  }
}

// =============================================================================
// SHOT LIST & COVERAGE TYPES
// =============================================================================

// Shot Type Enum
export type BacklotShotType =
  | 'ECU'    // Extreme Close-Up
  | 'CU'     // Close-Up
  | 'MCU'    // Medium Close-Up
  | 'MS'     // Medium Shot
  | 'MLS'    // Medium Long Shot
  | 'LS'     // Long Shot / Wide Shot
  | 'WS'     // Wide Shot
  | 'EWS'    // Extreme Wide Shot
  | 'POV'    // Point of View
  | 'OTS'    // Over the Shoulder
  | 'INSERT' // Insert shot
  | '2SHOT'  // Two Shot
  | 'GROUP'  // Group Shot
  | 'OTHER'; // Custom/Other

// Camera Movement Enum
export type BacklotCameraMovement =
  | 'static'
  | 'pan'
  | 'tilt'
  | 'dolly'
  | 'dolly_in'
  | 'dolly_out'
  | 'tracking'
  | 'handheld'
  | 'gimbal'
  | 'steadicam'
  | 'crane'
  | 'drone'
  | 'push_in'
  | 'pull_out'
  | 'zoom'
  | 'whip_pan'
  | 'rack_focus'
  | 'other';

// Coverage Status Enum
export type BacklotCoverageStatus = 'not_shot' | 'shot' | 'alt_needed' | 'dropped';

// Shot Priority Enum
export type BacklotShotPriority = 'must_have' | 'nice_to_have';

// Scene Shot Interface
export interface BacklotSceneShot {
  id: string;
  project_id: string;
  scene_id: string;
  shot_number: string;
  shot_type: BacklotShotType;
  lens?: string;
  camera_movement?: BacklotCameraMovement;
  description?: string;
  est_time_minutes?: number;
  priority?: BacklotShotPriority;
  coverage_status: BacklotCoverageStatus;
  covered_at?: string;
  covered_by_user_id?: string;
  notes?: string;
  sort_order: number;
  created_by_user_id: string;
  created_at: string;
  updated_at: string;
  // Joined fields
  scene?: BacklotScene;
  images?: BacklotShotImage[];
  covered_by_name?: string;
}

// Shot Image Interface
export interface BacklotShotImage {
  id: string;
  scene_shot_id: string;
  image_url: string;
  thumbnail_url?: string;
  description?: string;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

// Shot Input for create/update
export interface SceneShotInput {
  shot_number?: string;
  shot_type: BacklotShotType;
  lens?: string;
  camera_movement?: BacklotCameraMovement;
  description?: string;
  est_time_minutes?: number;
  priority?: BacklotShotPriority;
  notes?: string;
  sort_order?: number;
}

// Shot Image Input
export interface ShotImageInput {
  image_url: string;
  thumbnail_url?: string;
  description?: string;
  sort_order?: number;
}

// Coverage Update Input
export interface CoverageUpdateInput {
  coverage_status: BacklotCoverageStatus;
  notes?: string;
}

// Bulk Coverage Update Input
export interface BulkCoverageUpdateInput {
  shot_ids: string[];
  coverage_status: BacklotCoverageStatus;
}

// Scene Coverage Summary
export interface SceneCoverageSummary {
  total_shots: number;
  shot: number;
  not_shot: number;
  alt_needed: number;
  dropped: number;
  must_have_total: number;
  must_have_shot: number;
  est_time_minutes: number;
  shot_time_minutes: number;
}

// Project Coverage Summary
export interface ProjectCoverageSummary {
  total_scenes: number;
  total_shots: number;
  shot: number;
  not_shot: number;
  alt_needed: number;
  dropped: number;
  coverage_percentage: number;
  must_have_coverage: number;
  est_total_minutes: number;
  est_remaining_minutes: number;
  by_type: Record<BacklotShotType, number>;
}

// Coverage By Scene Response
export interface CoverageByScene {
  scene_id: string;
  scene_number: string;
  scene_heading?: string;
  total_shots: number;
  shot: number;
  not_shot: number;
  alt_needed: number;
  dropped: number;
  coverage_percentage: number;
}

// Shot with Scene Info (for flat list views)
export interface ShotWithScene extends BacklotSceneShot {
  scene_number: string;
  scene_heading?: string;
}

// AI Coverage Summary Response
export interface AICoverageSummary {
  project_id: string;
  project_title: string;
  overall: ProjectCoverageSummary;
  scenes: CoverageByScene[];
  needs_attention: Array<{
    shot_id: string;
    scene_number: string;
    shot_number: string;
    shot_type: BacklotShotType;
    status: BacklotCoverageStatus;
    priority?: BacklotShotPriority;
    description?: string;
  }>;
  timestamp: string;
}

// Call Sheet Shots Response
export interface CallSheetShotsResponse {
  call_sheet_id: string;
  production_day_id: string;
  scenes: Array<{
    scene_id: string;
    scene_number: string;
    scene_heading?: string;
    shots: BacklotSceneShot[];
    coverage: SceneCoverageSummary;
  }>;
}

// Shot Filters
export interface ShotFilters {
  scene_id?: string;
  shot_type?: BacklotShotType | 'all';
  coverage_status?: BacklotCoverageStatus | 'all';
  priority?: BacklotShotPriority | 'all';
}

// =============================================================================
// SHOT LIST LABELS & CONSTANTS
// =============================================================================

export const SHOT_TYPE_LABELS: Record<BacklotShotType, string> = {
  ECU: 'Extreme Close-Up',
  CU: 'Close-Up',
  MCU: 'Medium Close-Up',
  MS: 'Medium Shot',
  MLS: 'Medium Long Shot',
  LS: 'Long Shot',
  WS: 'Wide Shot',
  EWS: 'Extreme Wide',
  POV: 'Point of View',
  OTS: 'Over the Shoulder',
  INSERT: 'Insert',
  '2SHOT': 'Two Shot',
  GROUP: 'Group Shot',
  OTHER: 'Other',
};

export const SHOT_TYPE_SHORT_LABELS: Record<BacklotShotType, string> = {
  ECU: 'ECU',
  CU: 'CU',
  MCU: 'MCU',
  MS: 'MS',
  MLS: 'MLS',
  LS: 'LS',
  WS: 'WS',
  EWS: 'EWS',
  POV: 'POV',
  OTS: 'OTS',
  INSERT: 'INS',
  '2SHOT': '2S',
  GROUP: 'GRP',
  OTHER: 'OTH',
};

export const CAMERA_MOVEMENT_LABELS: Record<BacklotCameraMovement, string> = {
  static: 'Static',
  pan: 'Pan',
  tilt: 'Tilt',
  dolly: 'Dolly',
  dolly_in: 'Dolly In',
  dolly_out: 'Dolly Out',
  tracking: 'Tracking',
  handheld: 'Handheld',
  gimbal: 'Gimbal',
  steadicam: 'Steadicam',
  crane: 'Crane',
  drone: 'Drone',
  push_in: 'Push In',
  pull_out: 'Pull Out',
  zoom: 'Zoom',
  whip_pan: 'Whip Pan',
  rack_focus: 'Rack Focus',
  other: 'Other',
};

export const COVERAGE_STATUS_LABELS: Record<BacklotCoverageStatus, string> = {
  not_shot: 'Not Shot',
  shot: 'Shot',
  alt_needed: 'Alt Needed',
  dropped: 'Dropped',
};

export const COVERAGE_STATUS_COLORS: Record<BacklotCoverageStatus, string> = {
  not_shot: 'gray',
  shot: 'green',
  alt_needed: 'orange',
  dropped: 'red',
};

export const SHOT_PRIORITY_LABELS: Record<BacklotShotPriority, string> = {
  must_have: 'Must Have',
  nice_to_have: 'Nice to Have',
};

export const SHOT_PRIORITY_COLORS: Record<BacklotShotPriority, string> = {
  must_have: 'red',
  nice_to_have: 'blue',
};

// Common lens options
export const COMMON_LENSES = [
  '14mm',
  '18mm',
  '24mm',
  '35mm',
  '50mm',
  '85mm',
  '100mm',
  '135mm',
  '200mm',
  '16-35mm',
  '24-70mm',
  '70-200mm',
] as const;

// Shot types grouped by category
export const SHOT_TYPE_GROUPS = {
  closeups: ['ECU', 'CU', 'MCU'] as BacklotShotType[],
  medium: ['MS', 'MLS'] as BacklotShotType[],
  wide: ['LS', 'WS', 'EWS'] as BacklotShotType[],
  specialty: ['POV', 'OTS', 'INSERT', '2SHOT', 'GROUP', 'OTHER'] as BacklotShotType[],
};

export const SHOT_TYPE_GROUP_LABELS: Record<keyof typeof SHOT_TYPE_GROUPS, string> = {
  closeups: 'Close-Ups',
  medium: 'Medium Shots',
  wide: 'Wide Shots',
  specialty: 'Specialty',
};

// =====================================================
// ASSETS & DELIVERABLES SYSTEM
// =====================================================

// Asset Types
export type BacklotAssetType = 'episode' | 'feature' | 'trailer' | 'teaser' | 'social' | 'bts' | 'footage' | 'other';

// Asset/Deliverable Status
export type BacklotDeliverableStatus = 'not_started' | 'in_progress' | 'in_review' | 'approved' | 'delivered';

// Asset Interface
export interface BacklotAsset {
  id: string;
  project_id: string;
  asset_type: BacklotAssetType;
  title: string;
  description: string | null;
  duration_seconds: number | null;
  version_label: string | null;
  file_reference: string | null;
  status: BacklotDeliverableStatus;
  sort_order: number;
  created_by_user_id: string | null;
  created_at: string;
  updated_at: string;
  // Joined data
  created_by_name?: string;
  deliverables_count?: number;
  approved_count?: number;
  delivered_count?: number;
}

// Asset Input
export interface AssetInput {
  asset_type: BacklotAssetType;
  title: string;
  description?: string;
  duration_seconds?: number;
  version_label?: string;
  file_reference?: string;
  status?: BacklotDeliverableStatus;
  sort_order?: number;
}

// Platform Specs (stored as JSONB)
export interface DeliverablePlatformSpecs {
  resolution?: string;
  aspect_ratio?: string;
  codec?: string;
  bitrate?: string;
  frame_rate?: string;
  audio_codec?: string;
  audio_channels?: number;
  audio_sample_rate?: string;
  max_file_size_gb?: number;
  container_format?: string;
  color_space?: string;
  hdr?: boolean;
  closed_captions?: boolean;
  subtitles?: boolean;
  loudness_standard?: string;
  additional_requirements?: string;
}

// Deliverable Template
export interface BacklotDeliverableTemplate {
  id: string;
  name: string;
  platform: string;
  description: string | null;
  specs: DeliverablePlatformSpecs;
  is_system: boolean;
  created_by_user_id: string | null;
  created_at: string;
  updated_at: string;
}

// Template Input
export interface DeliverableTemplateInput {
  name: string;
  platform: string;
  description?: string;
  specs?: DeliverablePlatformSpecs;
}

// Project Deliverable
export interface BacklotProjectDeliverable {
  id: string;
  project_id: string;
  asset_id: string | null;
  template_id: string | null;
  platform: string;
  name: string;
  specs: DeliverablePlatformSpecs;
  status: BacklotDeliverableStatus;
  due_date: string | null;
  delivered_date: string | null;
  delivery_notes: string | null;
  download_url: string | null;
  created_by_user_id: string | null;
  created_at: string;
  updated_at: string;
  // Joined data
  asset_title?: string;
  asset_type?: BacklotAssetType;
  template_name?: string;
  created_by_name?: string;
}

// Project Deliverable Input
export interface ProjectDeliverableInput {
  asset_id?: string;
  template_id?: string;
  platform: string;
  name: string;
  specs?: DeliverablePlatformSpecs;
  status?: BacklotDeliverableStatus;
  due_date?: string;
  delivered_date?: string;
  delivery_notes?: string;
  download_url?: string;
}

// Bulk Create Input
export interface BulkDeliverableInput {
  template_ids: string[];
  name_prefix?: string;
}

// Asset Summary
export interface AssetsSummary {
  total_assets: number;
  by_status: Record<BacklotDeliverableStatus, number>;
  by_type: Record<BacklotAssetType, number>;
}

// Deliverables Summary
export interface DeliverablesSummary {
  total_deliverables: number;
  by_status: Record<BacklotDeliverableStatus, number>;
  by_platform: Record<string, number>;
  overdue_count: number;
  upcoming_due: number;
}

// Asset Filters
export interface AssetFilters {
  asset_type?: BacklotAssetType | 'all';
  status?: BacklotDeliverableStatus | 'all';
  search?: string;
}

// Deliverable Filters
export interface DeliverableFilters {
  platform?: string | 'all';
  status?: BacklotDeliverableStatus | 'all';
  asset_id?: string | 'all';
  search?: string;
}

// Status Labels
export const ASSET_TYPE_LABELS: Record<BacklotAssetType, string> = {
  episode: 'Episode',
  feature: 'Feature',
  trailer: 'Trailer',
  teaser: 'Teaser',
  social: 'Social',
  bts: 'Behind the Scenes',
  footage: 'Raw Footage',
  other: 'Other',
};

export const DELIVERABLE_STATUS_LABELS: Record<BacklotDeliverableStatus, string> = {
  not_started: 'Not Started',
  in_progress: 'In Progress',
  in_review: 'In Review',
  approved: 'Approved',
  delivered: 'Delivered',
};

export const DELIVERABLE_STATUS_COLORS: Record<BacklotDeliverableStatus, string> = {
  not_started: 'bg-muted-gray/20 text-muted-gray border-muted-gray/30',
  in_progress: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  in_review: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
  approved: 'bg-green-500/20 text-green-400 border-green-500/30',
  delivered: 'bg-accent-yellow/20 text-accent-yellow border-accent-yellow/30',
};

export const ASSET_TYPE_COLORS: Record<BacklotAssetType, string> = {
  episode: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  feature: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
  trailer: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
  teaser: 'bg-pink-500/20 text-pink-400 border-pink-500/30',
  social: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30',
  bts: 'bg-green-500/20 text-green-400 border-green-500/30',
  footage: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  other: 'bg-muted-gray/20 text-muted-gray border-muted-gray/30',
};

// =====================================================
// PRODUCER ANALYTICS TYPES (READ-ONLY)
// =====================================================

// Schedule Status
export type AnalyticsScheduleStatus = 'not_started' | 'ahead' | 'on_track' | 'behind';

// Budget Status
export type AnalyticsBudgetStatus = 'on_track' | 'over_budget' | 'under_budget';

// Cost by Department Analytics
export interface DepartmentCostData {
  department: string;
  category_type: string;
  budgeted_amount: number;
  actual_amount: number;
  variance: number;
  variance_percent: number;
}

export interface CostByDepartmentAnalytics {
  success: boolean;
  has_budget: boolean;
  budget_name?: string;
  departments: DepartmentCostData[];
  totals: {
    budgeted: number;
    actual: number;
    variance: number;
  };
}

// Time & Schedule Analytics
export interface DailyTrendData {
  day_number: number;
  date: string | null;
  is_completed: boolean;
  pages_planned: number;
  pages_shot: number;
  cumulative_planned: number;
  cumulative_shot: number;
}

export interface TimeScheduleAnalytics {
  success: boolean;
  summary: {
    total_pages: number;
    pages_shot: number;
    pages_scheduled: number;
    pages_remaining: number;
    total_shoot_days: number;
    completed_days: number;
    remaining_days: number;
    progress_percent: number;
    schedule_status: AnalyticsScheduleStatus;
    avg_pages_per_day: number;
    target_pages_per_day: number;
  };
  pages_by_status: {
    not_scheduled: number;
    scheduled: number;
    shot: number;
    needs_pickup: number;
  };
  daily_trend: DailyTrendData[];
}

// Utilization Analytics
export interface LocationUsageData {
  location_id: string | null;
  name: string;
  days_scheduled: number;
  days_completed: number;
}

export interface PersonUsageData {
  name: string;
  role: string;
  department: string;
  is_cast: boolean;
  days_scheduled: number;
  days_worked: number;
}

export interface UtilizationAnalytics {
  success: boolean;
  summary: {
    total_shoot_days: number;
    completed_days: number;
    unique_locations: number;
    total_cast_booked: number;
    total_crew_booked: number;
    open_roles: number;
    filled_roles: number;
  };
  locations: LocationUsageData[];
  cast: PersonUsageData[];
  crew: PersonUsageData[];
  roles_summary: {
    total: number;
    booked: number;
    open: number;
    cast_roles: number;
    crew_roles: number;
  };
}

// Analytics Overview
export interface AnalyticsOverview {
  success: boolean;
  project: {
    title: string;
    status: string;
  };
  budget: {
    has_budget: boolean;
    estimated_total: number;
    actual_total: number;
    variance: number;
    budget_status: AnalyticsBudgetStatus;
  };
  schedule: {
    total_pages: number;
    pages_shot: number;
    progress_percent: number;
    total_shoot_days: number;
    completed_days: number;
    schedule_status: AnalyticsScheduleStatus;
  };
  team: {
    total_members: number;
    total_roles: number;
    open_roles: number;
    booked_roles: number;
  };
}

// Schedule status labels
export const SCHEDULE_STATUS_LABELS: Record<AnalyticsScheduleStatus, string> = {
  not_started: 'Not Started',
  ahead: 'Ahead of Schedule',
  on_track: 'On Track',
  behind: 'Behind Schedule',
};

export const SCHEDULE_STATUS_COLORS: Record<AnalyticsScheduleStatus, string> = {
  not_started: 'bg-muted-gray/20 text-muted-gray border-muted-gray/30',
  ahead: 'bg-green-500/20 text-green-400 border-green-500/30',
  on_track: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  behind: 'bg-red-500/20 text-red-400 border-red-500/30',
};

export const BUDGET_STATUS_LABELS: Record<AnalyticsBudgetStatus, string> = {
  on_track: 'On Track',
  over_budget: 'Over Budget',
  under_budget: 'Under Budget',
};

export const BUDGET_STATUS_COLORS: Record<AnalyticsBudgetStatus, string> = {
  on_track: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  over_budget: 'bg-red-500/20 text-red-400 border-red-500/30',
  under_budget: 'bg-green-500/20 text-green-400 border-green-500/30',
};

// =============================================================================
// PROFESSIONAL SHOT LISTS (DP/Producer Tool)
// =============================================================================

// Shot List Type
export type ShotListType =
  | 'scene_based'
  | 'day_based'
  | 'sequence_based'
  | 'location_based'
  | 'custom';

// Frame Size Options
export type ShotFrameSize =
  | 'ECU'    // Extreme Close-Up
  | 'BCU'    // Big Close-Up
  | 'CU'     // Close-Up
  | 'MCU'    // Medium Close-Up
  | 'MS'     // Medium Shot
  | 'MWS'    // Medium Wide Shot
  | 'MLS'    // Medium Long Shot
  | 'LS'     // Long Shot
  | 'WS'     // Wide Shot
  | 'EWS'    // Extreme Wide Shot
  | 'POV'    // Point of View
  | 'OTS'    // Over the Shoulder
  | 'INSERT' // Insert
  | '2SHOT'  // Two Shot
  | 'GROUP'  // Group Shot
  | 'AERIAL' // Aerial/Drone
  | 'ESTAB'  // Establishing
  | 'OTHER'; // Other

// Camera Height Options
export type ShotCameraHeight =
  | 'floor_level'
  | 'low_angle'
  | 'eye_level'
  | 'high_angle'
  | 'overhead'
  | 'birds_eye'
  | 'dutch'
  | 'other';

// Movement Options
export type ShotMovement =
  | 'static'
  | 'pan'
  | 'pan_left'
  | 'pan_right'
  | 'tilt'
  | 'tilt_up'
  | 'tilt_down'
  | 'dolly'
  | 'dolly_in'
  | 'dolly_out'
  | 'tracking'
  | 'handheld'
  | 'gimbal'
  | 'steadicam'
  | 'crane'
  | 'drone'
  | 'push_in'
  | 'pull_out'
  | 'zoom_in'
  | 'zoom_out'
  | 'whip_pan'
  | 'rack_focus'
  | 'roll'
  | 'combination'
  | 'other';

// Time of Day Options
export type ShotTimeOfDay =
  | 'DAY'
  | 'NIGHT'
  | 'DAWN'
  | 'DUSK'
  | 'MAGIC_HOUR'
  | 'CONTINUOUS'
  | 'SAME'
  | 'LATER'
  | 'OTHER';

// Shot List Interface
export interface BacklotShotList {
  id: string;
  project_id: string;
  title: string;
  description?: string;
  list_type?: ShotListType;
  production_day_id?: string;
  scene_id?: string;
  is_archived: boolean;
  created_by_user_id: string;
  created_at: string;
  updated_at: string;
  // Joined fields
  creator?: {
    id: string;
    email: string;
  };
  production_day?: {
    id: string;
    date: string;
    label?: string;
  };
  scene?: {
    id: string;
    scene_number: string;
    slugline?: string;
  };
  // Computed fields
  shot_count?: number;
  completed_count?: number;
  shots?: BacklotShot[];
}

// Shot Interface
export interface BacklotShot {
  id: string;
  project_id: string;
  shot_list_id: string;
  sort_order: number;
  shot_number: string;
  scene_number?: string;
  scene_id?: string;
  camera_label?: string;
  frame_size?: ShotFrameSize;
  lens?: string;
  focal_length_mm?: number;
  camera_height?: ShotCameraHeight;
  movement?: ShotMovement;
  location_hint?: string;
  time_of_day?: ShotTimeOfDay;
  description?: string;
  technical_notes?: string;
  performance_notes?: string;
  est_time_minutes?: number;
  is_completed: boolean;
  created_by_user_id: string;
  created_at: string;
  updated_at: string;
  // Joined fields
  scene?: {
    id: string;
    scene_number: string;
    slugline?: string;
  };
}

// Shot List Input for create/update
export interface ShotListInput {
  title: string;
  description?: string;
  list_type?: ShotListType;
  production_day_id?: string;
  scene_id?: string;
}

// Shot Input for create/update
export interface ShotInput {
  shot_number?: string;
  scene_number?: string;
  scene_id?: string;
  camera_label?: string;
  frame_size?: ShotFrameSize;
  lens?: string;
  focal_length_mm?: number;
  camera_height?: ShotCameraHeight;
  movement?: ShotMovement;
  location_hint?: string;
  time_of_day?: ShotTimeOfDay;
  description?: string;
  technical_notes?: string;
  performance_notes?: string;
  est_time_minutes?: number;
  is_completed?: boolean;
  sort_order?: number;
}

// Labels and Colors
export const SHOT_LIST_TYPE_LABELS: Record<ShotListType, string> = {
  scene_based: 'Scene-Based',
  day_based: 'Day-Based',
  sequence_based: 'Sequence-Based',
  location_based: 'Location-Based',
  custom: 'Custom',
};

export const SHOT_FRAME_SIZE_LABELS: Record<ShotFrameSize, string> = {
  ECU: 'Extreme Close-Up',
  BCU: 'Big Close-Up',
  CU: 'Close-Up',
  MCU: 'Medium Close-Up',
  MS: 'Medium Shot',
  MWS: 'Medium Wide Shot',
  MLS: 'Medium Long Shot',
  LS: 'Long Shot',
  WS: 'Wide Shot',
  EWS: 'Extreme Wide Shot',
  POV: 'Point of View',
  OTS: 'Over the Shoulder',
  INSERT: 'Insert',
  '2SHOT': 'Two Shot',
  GROUP: 'Group Shot',
  AERIAL: 'Aerial/Drone',
  ESTAB: 'Establishing',
  OTHER: 'Other',
};

export const SHOT_FRAME_SIZE_SHORT_LABELS: Record<ShotFrameSize, string> = {
  ECU: 'ECU',
  BCU: 'BCU',
  CU: 'CU',
  MCU: 'MCU',
  MS: 'MS',
  MWS: 'MWS',
  MLS: 'MLS',
  LS: 'LS',
  WS: 'WS',
  EWS: 'EWS',
  POV: 'POV',
  OTS: 'OTS',
  INSERT: 'INS',
  '2SHOT': '2S',
  GROUP: 'GRP',
  AERIAL: 'AER',
  ESTAB: 'EST',
  OTHER: 'OTH',
};

export const SHOT_CAMERA_HEIGHT_LABELS: Record<ShotCameraHeight, string> = {
  floor_level: 'Floor Level',
  low_angle: 'Low Angle',
  eye_level: 'Eye Level',
  high_angle: 'High Angle',
  overhead: 'Overhead',
  birds_eye: "Bird's Eye",
  dutch: 'Dutch Angle',
  other: 'Other',
};

export const SHOT_MOVEMENT_LABELS: Record<ShotMovement, string> = {
  static: 'Static',
  pan: 'Pan',
  pan_left: 'Pan Left',
  pan_right: 'Pan Right',
  tilt: 'Tilt',
  tilt_up: 'Tilt Up',
  tilt_down: 'Tilt Down',
  dolly: 'Dolly',
  dolly_in: 'Dolly In',
  dolly_out: 'Dolly Out',
  tracking: 'Tracking',
  handheld: 'Handheld',
  gimbal: 'Gimbal',
  steadicam: 'Steadicam',
  crane: 'Crane',
  drone: 'Drone',
  push_in: 'Push In',
  pull_out: 'Pull Out',
  zoom_in: 'Zoom In',
  zoom_out: 'Zoom Out',
  whip_pan: 'Whip Pan',
  rack_focus: 'Rack Focus',
  roll: 'Roll',
  combination: 'Combination',
  other: 'Other',
};

export const SHOT_TIME_OF_DAY_LABELS: Record<ShotTimeOfDay, string> = {
  DAY: 'Day',
  NIGHT: 'Night',
  DAWN: 'Dawn',
  DUSK: 'Dusk',
  MAGIC_HOUR: 'Magic Hour',
  CONTINUOUS: 'Continuous',
  SAME: 'Same',
  LATER: 'Later',
  OTHER: 'Other',
};

// =====================================================
// TASK SYSTEM TYPES (Notion-style Task Database)
// =====================================================

// Task List Sharing Mode
export type TaskListSharingMode = 'project_wide' | 'selective';

// Task List View Type
export type TaskListViewType = 'board' | 'list' | 'calendar';

// Task Label
export interface BacklotTaskLabel {
  id: string;
  project_id: string;
  name: string;
  color: string | null;
  created_at: string;
}

// Task List Member
export interface BacklotTaskListMember {
  id: string;
  task_list_id: string;
  user_id: string;
  can_edit: boolean;
  created_at: string;
  // Joined data
  profile?: BacklotProfile;
}

// Task List
export interface BacklotTaskList {
  id: string;
  project_id: string;
  created_by_user_id: string;
  name: string;
  description: string | null;
  icon: string | null;
  sharing_mode: TaskListSharingMode;
  default_view_type: TaskListViewType;
  is_archived: boolean;
  created_at: string;
  updated_at: string;
  // Joined data
  created_by_profile?: BacklotProfile;
  members?: BacklotTaskListMember[];
  tasks?: BacklotTask[];
  task_count?: number;
  status_counts?: Record<string, number>;
  views?: BacklotTaskView[];
}

// Task Assignee
export interface BacklotTaskAssignee {
  id: string;
  task_id: string;
  user_id: string;
  assigned_by: string | null;
  assigned_at: string;
  // Joined data
  profile?: BacklotProfile;
}

// Task Watcher
export interface BacklotTaskWatcher {
  id: string;
  task_id: string;
  user_id: string;
  added_at: string;
  // Joined data
  profile?: BacklotProfile;
}

// Task Label Link (many-to-many)
export interface BacklotTaskLabelLink {
  id: string;
  task_id: string;
  label_id: string;
  added_at: string;
  // Joined data
  label?: BacklotTaskLabel;
}

// Task Comment
export interface BacklotTaskComment {
  id: string;
  task_id: string;
  user_id: string;
  content: string;
  created_at: string;
  updated_at: string;
  // Joined data
  user_profile?: BacklotProfile;
}

// Task View (saved view configurations)
export interface BacklotTaskView {
  id: string;
  task_list_id: string;
  created_by: string;
  name: string;
  view_type: TaskListViewType;
  filters: TaskViewFilters;
  grouping: TaskViewGrouping | null;
  sorting: TaskViewSorting[];
  is_default: boolean;
  is_shared: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
  // Joined data
  created_by_profile?: BacklotProfile;
}

// Task View Filter Configuration
export interface TaskViewFilters {
  status?: BacklotTaskStatus[];
  priority?: BacklotTaskPriority[];
  assignee_ids?: string[];
  label_ids?: string[];
  due_date_range?: {
    start?: string;
    end?: string;
  };
  search?: string;
}

// Task View Grouping Configuration
export interface TaskViewGrouping {
  field: 'status' | 'priority' | 'assignee' | 'label' | 'due_date' | 'none';
  order?: 'asc' | 'desc';
}

// Task View Sorting Configuration
export interface TaskViewSorting {
  field: 'title' | 'status' | 'priority' | 'due_date' | 'created_at' | 'updated_at' | 'sort_order';
  order: 'asc' | 'desc';
}

// Main Task Entity
export interface BacklotTask {
  id: string;
  task_list_id: string;
  created_by: string;
  title: string;
  description: string | null;
  status: BacklotTaskStatus;
  priority: BacklotTaskPriority;
  due_date: string | null;
  due_time: string | null;
  estimated_hours: number | null;
  actual_hours: number | null;
  sort_order: number;
  // Integration Links
  linked_scene_id: string | null;
  linked_location_id: string | null;
  linked_call_sheet_id: string | null;
  linked_shot_list_id: string | null;
  linked_production_day_id: string | null;
  // Extended source tracking
  source_type: 'manual' | 'call_sheet' | 'import' | 'camera_media' | 'continuity' | 'location' | 'hot_set' | 'gear' | 'costume' | null;
  source_camera_media_id: string | null;
  source_continuity_note_id: string | null;
  source_location_id: string | null;
  source_hot_set_session_id: string | null;
  source_gear_id: string | null;
  source_costume_id: string | null;
  scene_id: string | null;
  production_day_id: string | null;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
  // Joined data
  created_by_profile?: BacklotProfile;
  assignees?: BacklotTaskAssignee[];
  watchers?: BacklotTaskWatcher[];
  labels?: BacklotTaskLabel[];
  comments?: BacklotTaskComment[];
  comment_count?: number;
  // Linked entity data (for display)
  linked_scene?: { id: string; scene_number: string; description?: string };
  linked_location?: { id: string; name: string };
  linked_call_sheet?: { id: string; title: string };
  linked_shot_list?: { id: string; title: string };
  linked_production_day?: { id: string; day_number: number; date: string };
  // Extended source entity data (for display)
  source_camera_media?: { id: string; card_label: string; camera_id?: string };
  source_continuity_note?: { id: string; department: string; character_name?: string };
  source_location?: { id: string; name: string };
  source_hot_set_session?: { id: string; day_number: number; date: string };
  source_gear?: { id: string; name: string; category?: string };
  source_costume?: { id: string; character_name: string };
}

// =====================================================
// TASK SYSTEM INPUT TYPES
// =====================================================

// Task Label Input
export interface TaskLabelInput {
  name: string;
  color?: string;
}

// Task List Input
export interface TaskListInput {
  name: string;
  description?: string;
  icon?: string;
  sharing_mode?: TaskListSharingMode;
  default_view_type?: TaskListViewType;
}

// Task List Update Input
export interface TaskListUpdateInput {
  name?: string;
  description?: string;
  icon?: string;
  sharing_mode?: TaskListSharingMode;
  default_view_type?: TaskListViewType;
  is_archived?: boolean;
}

// Task List Member Input
export interface TaskListMemberInput {
  user_id: string;
  can_edit?: boolean;
}

// Task Input for Notion-style task lists (backlot_task_lists system)
export interface TaskInput {
  title: string;
  description?: string;
  status?: BacklotTaskStatus;
  priority?: BacklotTaskPriority;
  due_date?: string;
  due_time?: string;
  department?: string;
  estimated_hours?: number;
  sort_order?: number;
  assignee_ids?: string[];
  watcher_ids?: string[];
  label_ids?: string[];
  linked_scene_id?: string;
  linked_location_id?: string;
  linked_call_sheet_id?: string;
  linked_shot_list_id?: string;
  linked_production_day_id?: string;
  // Extended source tracking
  source_type?: string;
  source_camera_media_id?: string;
  source_continuity_note_id?: string;
  source_location_id?: string;
  source_hot_set_session_id?: string;
  source_gear_id?: string;
  source_costume_id?: string;
  scene_id?: string;
  production_day_id?: string;
}

// Task Update Input
export interface TaskUpdateInput {
  title?: string;
  description?: string;
  status?: BacklotTaskStatus;
  priority?: BacklotTaskPriority;
  due_date?: string | null;
  due_time?: string | null;
  estimated_hours?: number | null;
  actual_hours?: number | null;
  sort_order?: number;
  assignee_ids?: string[];
  watcher_ids?: string[];
  label_ids?: string[];
  linked_scene_id?: string | null;
  linked_location_id?: string | null;
  linked_call_sheet_id?: string | null;
  linked_shot_list_id?: string | null;
  linked_production_day_id?: string | null;
  // Extended source tracking
  source_type?: string | null;
  source_camera_media_id?: string | null;
  source_continuity_note_id?: string | null;
  source_location_id?: string | null;
  source_hot_set_session_id?: string | null;
  source_gear_id?: string | null;
  source_costume_id?: string | null;
  scene_id?: string | null;
  production_day_id?: string | null;
}

// Task Comment Input
export interface TaskCommentInput {
  content: string;
}

// Task View Input
export interface TaskViewInput {
  name: string;
  view_type: TaskListViewType;
  filters?: TaskViewFilters;
  grouping?: TaskViewGrouping;
  sorting?: TaskViewSorting[];
  is_default?: boolean;
  is_shared?: boolean;
  sort_order?: number;
}

// Task Reorder Item
export interface TaskReorderItem {
  id: string;
  sort_order: number;
  status?: BacklotTaskStatus;
}

// =====================================================
// TASK SYSTEM FILTER TYPES
// =====================================================

export interface TaskListFilters {
  search?: string;
  include_archived?: boolean;
}

export interface TaskFiltersExtended {
  status?: BacklotTaskStatus | BacklotTaskStatus[] | 'all';
  priority?: BacklotTaskPriority | BacklotTaskPriority[] | 'all';
  assignee_id?: string | string[];
  label_id?: string | string[];
  due_date_start?: string;
  due_date_end?: string;
  has_due_date?: boolean;
  is_overdue?: boolean;
  search?: string;
}

// =====================================================
// TASK SYSTEM CONSTANTS
// =====================================================

export const TASK_STATUS_LABELS: Record<BacklotTaskStatus, string> = {
  todo: 'To Do',
  in_progress: 'In Progress',
  review: 'Review',
  completed: 'Completed',
  blocked: 'Blocked',
};

export const TASK_STATUS_COLORS: Record<BacklotTaskStatus, string> = {
  todo: 'gray',
  in_progress: 'blue',
  review: 'amber',
  completed: 'green',
  blocked: 'red',
};

export const TASK_PRIORITY_LABELS: Record<BacklotTaskPriority, string> = {
  low: 'Low',
  medium: 'Medium',
  high: 'High',
  urgent: 'Urgent',
};

export const TASK_PRIORITY_COLORS: Record<BacklotTaskPriority, string> = {
  low: 'slate',
  medium: 'blue',
  high: 'orange',
  urgent: 'red',
};

export const TASK_VIEW_TYPE_LABELS: Record<TaskListViewType, string> = {
  board: 'Board',
  list: 'List',
  calendar: 'Calendar',
};

export const TASK_SHARING_MODE_LABELS: Record<TaskListSharingMode, string> = {
  project_wide: 'All Project Members',
  selective: 'Selected Members Only',
};

// Default label colors for new projects
export const DEFAULT_TASK_LABEL_COLORS = [
  '#ef4444', // red
  '#f97316', // orange
  '#f59e0b', // amber
  '#eab308', // yellow
  '#84cc16', // lime
  '#22c55e', // green
  '#14b8a6', // teal
  '#06b6d4', // cyan
  '#3b82f6', // blue
  '#6366f1', // indigo
  '#8b5cf6', // violet
  '#a855f7', // purple
  '#d946ef', // fuchsia
  '#ec4899', // pink
  '#64748b', // slate
];

// =====================================================
// Review System Types (Frame.io-style)
// =====================================================

export type VideoProvider = 'placeholder' | 'vimeo' | 'youtube';

export interface ReviewVersion {
  id: string;
  asset_id: string;
  version_number: number;
  name: string | null;
  video_url: string;
  video_provider: VideoProvider;
  external_video_id: string | null;
  thumbnail_url: string | null;
  duration_seconds: number | null;
  created_by_user_id: string;
  created_at: string;
  // Computed
  note_count?: number;
}

export interface ReviewAsset {
  id: string;
  project_id: string;
  name: string;
  description: string | null;
  thumbnail_url: string | null;
  active_version_id: string | null;
  linked_scene_id: string | null;
  linked_shot_list_id: string | null;
  created_by_user_id: string;
  created_at: string;
  updated_at: string;
  // Joined
  active_version: ReviewVersion | null;
  versions?: ReviewVersion[];
  // Computed
  version_count?: number;
  note_count?: number;
}

export interface ReviewNoteUser {
  id: string;
  display_name: string;
  avatar_url: string | null;
}

export interface ReviewNoteReply {
  id: string;
  note_id: string;
  content: string;
  created_by_user_id: string;
  created_at: string;
  // Joined
  created_by_user: ReviewNoteUser | null;
}

export interface ReviewNote {
  id: string;
  version_id: string;
  timecode_seconds: number | null;
  timecode_end_seconds: number | null;
  content: string;
  drawing_data: Record<string, unknown> | null;
  is_resolved: boolean;
  linked_task_id: string | null;
  created_by_user_id: string;
  created_at: string;
  updated_at: string;
  // Joined
  created_by_user: ReviewNoteUser | null;
  replies: ReviewNoteReply[];
}

// Input types for creating/updating
export interface ReviewAssetInput {
  name: string;
  description?: string | null;
  video_url?: string;
  video_provider?: VideoProvider;
  external_video_id?: string | null;
  thumbnail_url?: string | null;
  duration_seconds?: number | null;
  linked_scene_id?: string | null;
  linked_shot_list_id?: string | null;
}

export interface ReviewAssetUpdateInput {
  name?: string;
  description?: string | null;
  thumbnail_url?: string | null;
  linked_scene_id?: string | null;
  linked_shot_list_id?: string | null;
}

export interface ReviewVersionInput {
  name?: string | null;
  video_url: string;
  video_provider?: VideoProvider;
  external_video_id?: string | null;
  thumbnail_url?: string | null;
  duration_seconds?: number | null;
}

export interface ReviewNoteInput {
  timecode_seconds?: number | null;
  timecode_end_seconds?: number | null;
  content: string;
  drawing_data?: Record<string, unknown> | null;
}

export interface ReviewNoteUpdateInput {
  content?: string;
  drawing_data?: Record<string, unknown> | null;
  is_resolved?: boolean;
}

export interface CreateTaskFromNoteInput {
  task_list_id: string;
  title?: string;
  priority?: BacklotTaskPriority;
  assignee_user_id?: string | null;
}

// =====================================================
// Review Folder System (Frame.io-style organization)
// =====================================================

export type ReviewAssetStatus = 'draft' | 'in_review' | 'changes_requested' | 'approved' | 'final';
export type ReviewAssetPriority = 'low' | 'normal' | 'high' | 'urgent';
export type ReviewStorageMode = 'external' | 's3';
export type ReviewTranscodeStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'skipped';

export interface ReviewFolder {
  id: string;
  project_id: string;
  parent_folder_id: string | null;
  name: string;
  description: string | null;
  color: string | null;
  sort_order: number;
  created_by_user_id: string | null;
  created_at: string;
  updated_at: string;
  // Computed/joined
  children?: ReviewFolder[];
  asset_count?: number;
  subfolder_count?: number;
}

export interface ReviewFolderInput {
  name: string;
  description?: string | null;
  color?: string | null;
  parent_folder_id?: string | null;
}

export interface ReviewFolderUpdate {
  name?: string;
  description?: string | null;
  color?: string | null;
  parent_folder_id?: string | null;
  sort_order?: number;
}

// Enhanced ReviewAsset with folder support
export interface ReviewAssetEnhanced extends ReviewAsset {
  folder_id: string | null;
  status: ReviewAssetStatus;
  sort_order: number;
  due_date: string | null;
  priority: ReviewAssetPriority | null;
}

// Enhanced ReviewVersion with S3 storage
export interface ReviewVersionEnhanced extends ReviewVersion {
  storage_mode: ReviewStorageMode;
  s3_key: string | null;
  renditions: Record<string, string>; // { "480p": "key", "720p": "key", "1080p": "key" }
  original_filename: string | null;
  file_size_bytes: number | null;
  codec: string | null;
  resolution: string | null;
  frame_rate: number | null;
  transcode_status: ReviewTranscodeStatus;
  transcode_error: string | null;
}

// External reviewer access
export interface ReviewExternalLink {
  id: string;
  project_id: string;
  asset_id: string | null;
  folder_id: string | null;
  token: string;
  name: string;
  can_comment: boolean;
  can_download: boolean;
  can_approve: boolean;
  expires_at: string | null;
  max_views: number | null;
  view_count: number;
  created_by_user_id: string | null;
  created_at: string;
  last_accessed_at: string | null;
  is_active: boolean;
}

export interface ReviewExternalLinkInput {
  name: string;
  asset_id?: string | null;
  folder_id?: string | null;
  password?: string;
  can_comment?: boolean;
  can_download?: boolean;
  can_approve?: boolean;
  expires_at?: string | null;
  max_views?: number | null;
}

export interface ReviewExternalSession {
  id: string;
  link_id: string;
  session_token: string;
  display_name: string;
  email: string | null;
  created_at: string;
  expires_at: string;
}

// Folder tree response with nested structure
export interface ReviewFolderTree {
  folders: ReviewFolder[];
  root_assets: ReviewAssetEnhanced[];
}

// Folder contents response
export interface ReviewFolderContents {
  folder: ReviewFolder;
  subfolders: ReviewFolder[];
  assets: ReviewAssetEnhanced[];
  breadcrumbs: ReviewFolderBreadcrumb[];
}

export interface ReviewFolderBreadcrumb {
  id: string;
  name: string;
}

// =====================================================
// Review Player Adapter Interface
// =====================================================

/**
 * Abstract interface for video players.
 * Allows swapping between placeholder HTML5 player and Vimeo SDK player.
 */
export interface ReviewPlayerAdapter {
  // Lifecycle
  initialize(container: HTMLElement, videoUrl: string): Promise<void>;
  destroy(): void;

  // Playback control
  play(): void;
  pause(): void;
  seekTo(seconds: number): void;

  // State getters
  getCurrentTime(): number;
  getDuration(): number;
  isPaused(): boolean;

  // Event handlers
  onTimeUpdate(callback: (currentTime: number) => void): void;
  onPlay(callback: () => void): void;
  onPause(callback: () => void): void;
  onSeeked(callback: (currentTime: number) => void): void;
  onDurationChange(callback: (duration: number) => void): void;
  onEnded(callback: () => void): void;
}

// Helper functions
export function formatTimecode(seconds: number | null): string {
  if (seconds === null || seconds === undefined) return '--:--';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

export function parseTimecode(timecode: string): number | null {
  const parts = timecode.split(':');
  if (parts.length !== 2) return null;
  const mins = parseInt(parts[0], 10);
  const secs = parseInt(parts[1], 10);
  if (isNaN(mins) || isNaN(secs)) return null;
  return mins * 60 + secs;
}

// =====================================================
// Unified Assets (Assets Tab)
// =====================================================

export type UnifiedAssetSource = 'dailies' | 'review' | 'standalone';
export type StandaloneAssetType = 'audio' | '3d_model' | 'image' | 'document' | 'graphics' | 'music' | 'sfx' | 'video' | 'video_link' | 'other';
export type AssetFolderType = 'audio' | '3d' | 'graphics' | 'documents' | 'mixed';

export interface UnifiedAsset {
  id: string;
  project_id: string;
  source: UnifiedAssetSource;
  name: string;
  asset_type: string;
  thumbnail_url: string | null;
  duration_seconds: number | null;
  file_size_bytes: number | null;
  created_at: string;
}

export interface UnifiedAssetsSummary {
  source: UnifiedAssetSource;
  asset_type: string;
  count: number;
}

export interface StandaloneAsset {
  id: string;
  project_id: string;
  folder_id: string | null;
  name: string;
  description: string | null;
  asset_type: StandaloneAssetType;
  file_name: string | null;
  s3_key: string | null;
  file_size_bytes: number | null;
  mime_type: string | null;
  duration_seconds: number | null;
  dimensions: string | null;
  tags: string[];
  metadata: Record<string, unknown>;
  thumbnail_url: string | null;
  created_by_user_id: string | null;
  created_at: string;
  updated_at: string;
  source_url: string | null;
  video_provider: string | null;
  external_video_id: string | null;
}

export interface StandaloneAssetInput {
  name: string;
  description?: string | null;
  asset_type: StandaloneAssetType;
  file_name?: string;
  s3_key?: string;
  file_size_bytes?: number | null;
  mime_type?: string | null;
  duration_seconds?: number | null;
  dimensions?: string | null;
  tags?: string[];
  metadata?: Record<string, unknown>;
  folder_id?: string | null;
  source_url?: string;
  video_provider?: string;
  external_video_id?: string;
}

export interface AssetFolder {
  id: string;
  project_id: string;
  parent_folder_id: string | null;
  name: string;
  folder_type: AssetFolderType | null;
  sort_order: number;
  created_by_user_id: string | null;
  created_at: string;
  updated_at: string;
  children?: AssetFolder[];
}

export interface AssetFolderInput {
  name: string;
  folder_type?: AssetFolderType | null;
  parent_folder_id?: string | null;
}

// =============================================================================
// SCRIPT BREAKDOWN TAB TYPES
// =============================================================================

// Department type for breakdown items
export type BacklotBreakdownDepartment =
  | 'cast'
  | 'locations'
  | 'props'
  | 'wardrobe'
  | 'makeup'
  | 'sfx'
  | 'vfx'
  | 'background'
  | 'stunts'
  | 'camera'
  | 'sound';

// Scene breakdown item (matches DB schema for backlot_scene_breakdown_items)
export interface BacklotSceneBreakdownItem {
  id: string;
  scene_id: string;
  type: BacklotBreakdownItemType;
  label: string;
  quantity: number;
  notes: string | null;
  linked_entity_id: string | null;
  linked_entity_type: string | null;
  task_generated: boolean;
  task_id: string | null;
  department: BacklotBreakdownDepartment | null;
  stripboard_day: number | null;
  created_at: string;
  updated_at: string;
  // Joined data from API
  scene?: BacklotScene;
  highlight_ids?: string[];
}

// Input for creating/updating a breakdown item
export interface BreakdownItemInput {
  type: BacklotBreakdownItemType;
  label: string;
  quantity?: number;
  notes?: string;
  linked_entity_id?: string;
  linked_entity_type?: string;
  department?: BacklotBreakdownDepartment;
  stripboard_day?: number;
  scene_id?: string; // Allow moving item to a different scene
}

// Project breakdown response from API
export interface ProjectBreakdownResponse {
  breakdown_items: BacklotSceneBreakdownItem[];
  scenes: BacklotScene[];
  grouped_by_type: Record<string, BacklotSceneBreakdownItem[]>;
  grouped_by_department: Record<string, BacklotSceneBreakdownItem[]>;
  grouped_by_scene: Record<string, {
    scene: BacklotScene;
    items: BacklotSceneBreakdownItem[];
  }>;
  project_title: string;
}

// Breakdown summary stats
export interface BreakdownSummaryStats {
  total_items: number;
  by_type: Record<string, number>;
  by_department: Record<string, number>;
  scenes_with_breakdown: number;
  total_scenes: number;
}

// Labels for breakdown item types
export const BREAKDOWN_TYPE_LABELS: Record<BacklotBreakdownItemType, string> = {
  cast: 'Cast',
  background: 'Background/Extras',
  stunt: 'Stunts',
  location: 'Locations',
  prop: 'Props',
  set_dressing: 'Set Dressing',
  wardrobe: 'Wardrobe',
  makeup: 'Makeup/Hair',
  sfx: 'Special Effects',
  vfx: 'Visual Effects',
  vehicle: 'Vehicles',
  animal: 'Animals',
  greenery: 'Greenery',
  special_equipment: 'Special Equipment',
  sound: 'Sound',
  music: 'Music',
  other: 'Other',
};

// Labels for departments
export const BREAKDOWN_DEPARTMENT_LABELS: Record<BacklotBreakdownDepartment, string> = {
  cast: 'Cast',
  locations: 'Locations',
  props: 'Props',
  wardrobe: 'Wardrobe',
  makeup: 'Makeup/Hair',
  sfx: 'SFX',
  vfx: 'VFX',
  background: 'Background',
  stunts: 'Stunts',
  camera: 'Camera',
  sound: 'Sound',
};

// All available breakdown departments
export const BREAKDOWN_DEPARTMENTS: BacklotBreakdownDepartment[] = [
  'cast',
  'locations',
  'props',
  'wardrobe',
  'makeup',
  'sfx',
  'vfx',
  'background',
  'stunts',
  'camera',
  'sound',
];

// All available breakdown item types
export const BREAKDOWN_ITEM_TYPES: BacklotBreakdownItemType[] = [
  'cast',
  'background',
  'stunt',
  'location',
  'prop',
  'set_dressing',
  'wardrobe',
  'makeup',
  'sfx',
  'vfx',
  'vehicle',
  'animal',
  'greenery',
  'special_equipment',
  'sound',
  'music',
  'other',
];

// Default department mapping for each breakdown type
export const TYPE_TO_DEPARTMENT: Record<BacklotBreakdownItemType, BacklotBreakdownDepartment> = {
  cast: 'cast',
  background: 'background',
  stunt: 'stunts',
  location: 'locations',
  prop: 'props',
  set_dressing: 'props',
  wardrobe: 'wardrobe',
  makeup: 'makeup',
  sfx: 'sfx',
  vfx: 'vfx',
  vehicle: 'props',
  animal: 'props',
  greenery: 'props',
  special_equipment: 'camera',
  sound: 'sound',
  music: 'sound',
  other: 'props',
};

// =============================================================================
// DAILIES SYSTEM TYPES
// =============================================================================

export type DailiesStorageMode = 'cloud' | 'local_drive';

export type DailiesClipNoteCategory =
  | 'performance'
  | 'camera'
  | 'sound'
  | 'technical'
  | 'continuity'
  | 'vfx'
  | 'general';

export interface BacklotDailiesDay {
  id: string;
  project_id: string;
  production_day_id?: string | null;
  shoot_date: string;
  label: string;
  unit?: string | null;
  notes?: string | null;
  created_at: string;
  updated_at: string;
  // Computed fields from summary
  card_count?: number;
  clip_count?: number;
  circle_take_count?: number;
  total_duration_seconds?: number;
  // Joined data
  production_day?: BacklotProductionDay;
}

export interface BacklotDailiesCard {
  id: string;
  dailies_day_id: string;
  project_id: string;
  camera_label: string;
  roll_name: string;
  storage_mode: DailiesStorageMode;
  media_root_path?: string | null;
  storage_location?: string | null;
  checksum_verified: boolean;
  notes?: string | null;
  created_by_user_id: string;
  created_at: string;
  updated_at: string;
  // Computed
  clip_count?: number;
}

export interface BacklotDailiesClip {
  id: string;
  dailies_card_id: string;
  project_id: string;
  file_name: string;
  relative_path?: string | null;
  storage_mode: DailiesStorageMode;
  cloud_url?: string | null;
  duration_seconds?: number | null;
  file_size_bytes?: number | null;
  timecode_start?: string | null;
  frame_rate?: number | null;
  resolution?: string | null;
  codec?: string | null;
  camera_label?: string | null;
  scene_number?: string | null;
  take_number?: number | null;
  is_circle_take: boolean;
  is_locked?: boolean;
  rating?: number | null;
  script_scene_id?: string | null;
  shot_id?: string | null;
  notes?: string | null;
  thumbnail_url?: string | null;
  production_day_id?: string | null;
  created_by_user_id: string;
  created_at: string;
  updated_at: string;
  // Joined data
  card?: BacklotDailiesCard;
  scene?: BacklotScene;
  note_count?: number;
}

export interface BacklotDailiesClipNote {
  id: string;
  dailies_clip_id: string;
  author_user_id: string;
  time_seconds?: number | null;
  note_text: string;
  category?: DailiesClipNoteCategory | null;
  is_resolved: boolean;
  created_at: string;
  updated_at: string;
  // Joined
  author?: BacklotProfile;
}

// Input types for creating/updating
export interface DailiesDayInput {
  shoot_date: string;
  label: string;
  unit?: string | null;
  production_day_id?: string | null;
  notes?: string | null;
}

export interface DailiesCardInput {
  camera_label: string;
  roll_name: string;
  storage_mode?: DailiesStorageMode;
  media_root_path?: string | null;
  storage_location?: string | null;
  notes?: string | null;
}

export interface DailiesClipInput {
  file_name: string;
  relative_path?: string | null;
  storage_mode?: DailiesStorageMode;
  cloud_url?: string | null;
  duration_seconds?: number | null;
  timecode_start?: string | null;
  frame_rate?: number | null;
  resolution?: string | null;
  codec?: string | null;
  camera_label?: string | null;
  scene_number?: string | null;
  take_number?: number | null;
  is_circle_take?: boolean;
  rating?: number | null;
  script_scene_id?: string | null;
  shot_id?: string | null;
  notes?: string | null;
}

export interface DailiesClipUpdateInput {
  file_name?: string | null;
  scene_number?: string | null;
  take_number?: number | null;
  camera_label?: string | null;
  timecode_start?: string | null;
  is_circle_take?: boolean;
  is_locked?: boolean;
  rating?: number | null;
  script_scene_id?: string | null;
  shot_id?: string | null;
  notes?: string | null;
  duration_seconds?: number | null;
  thumbnail_url?: string | null;
}

export interface DailiesClipNoteInput {
  time_seconds?: number | null;
  note_text: string;
  category?: DailiesClipNoteCategory | null;
}

// Local ingest for desktop companion
export interface DailiesLocalIngestClip {
  file_name: string;
  relative_path?: string | null;
  duration_seconds?: number | null;
  timecode_start?: string | null;
  frame_rate?: number | null;
  resolution?: string | null;
  codec?: string | null;
  scene_number?: string | null;
  take_number?: number | null;
}

export interface DailiesLocalIngestCard {
  camera_label: string;
  roll_name: string;
  media_root_path?: string | null;
  storage_location?: string | null;
  clips: DailiesLocalIngestClip[];
}

export interface DailiesLocalIngestRequest {
  project_id: string;
  shoot_date: string;
  day_label: string;
  unit?: string | null;
  cards: DailiesLocalIngestCard[];
}

// Summary types
export interface DailiesProjectSummary {
  total_days: number;
  total_cards: number;
  total_clips: number;
  circle_takes: number;
  cloud_clips: number;
  local_clips: number;
  total_notes: number;
  unresolved_notes: number;
}

export interface DailiesDaySummary {
  card_count: number;
  clip_count: number;
  circle_take_count: number;
  total_duration_seconds: number;
}

// Filter types
export interface DailiesClipFilters {
  scene_number?: string;
  take_number?: number;
  is_circle_take?: boolean;
  rating_min?: number;
  storage_mode?: DailiesStorageMode;
  text_search?: string;
}

// =====================================================
// OFFLOAD MANIFEST TYPES (Desktop Helper Integration)
// =====================================================

export type OffloadStatus = 'pending' | 'in_progress' | 'completed' | 'failed';
export type OffloadUploadStatus = 'pending' | 'uploading' | 'completed' | 'skipped' | 'failed';

export interface BacklotOffloadManifest {
  id: string;
  project_id: string;
  production_day_id?: string | null;
  dailies_day_id?: string | null;
  manifest_name: string;
  source_device?: string | null;
  camera_label?: string | null;
  roll_name?: string | null;
  total_files: number;
  total_bytes: number;
  offload_status: OffloadStatus;
  upload_status: OffloadUploadStatus;
  create_footage_asset: boolean;
  created_footage_asset_id?: string | null;
  started_at?: string | null;
  completed_at?: string | null;
  created_by_user_id?: string | null;
  created_at: string;
  updated_at: string;
  // Joined data
  production_day?: BacklotProductionDay;
  dailies_day?: BacklotDailiesDay;
  files?: BacklotOffloadManifestFile[];
}

export interface BacklotOffloadManifestFile {
  id: string;
  manifest_id: string;
  file_name: string;
  relative_path?: string | null;
  file_size_bytes: number;
  content_type?: string | null;
  offload_status: OffloadStatus | 'skipped';
  upload_status: OffloadUploadStatus;
  source_checksum?: string | null;
  dest_checksum?: string | null;
  checksum_verified: boolean;
  dailies_clip_id?: string | null;
  error_message?: string | null;
  created_at: string;
  updated_at: string;
}

export interface OffloadManifestInput {
  project_id: string;
  production_day_id?: string | null;
  manifest_name: string;
  source_device?: string | null;
  camera_label?: string | null;
  roll_name?: string | null;
  create_footage_asset?: boolean;
}

export interface OffloadManifestFileInput {
  file_name: string;
  relative_path?: string | null;
  file_size_bytes: number;
  content_type?: string | null;
}

export interface OffloadManifestSummary {
  total_files: number;
  total_bytes: number;
  pending_files: number;
  completed_files: number;
  failed_files: number;
  verified_files: number;
  uploaded_files: number;
  clips_created: number;
}

// Labels and constants
export const DAILIES_STORAGE_MODE_LABELS: Record<DailiesStorageMode, string> = {
  cloud: 'Cloud',
  local_drive: 'Local Drive',
};

export const DAILIES_CLIP_NOTE_CATEGORY_LABELS: Record<DailiesClipNoteCategory, string> = {
  performance: 'Performance',
  camera: 'Camera',
  sound: 'Sound',
  technical: 'Technical',
  continuity: 'Continuity',
  vfx: 'VFX',
  general: 'General',
};

export const DAILIES_CLIP_NOTE_CATEGORIES: DailiesClipNoteCategory[] = [
  'performance',
  'camera',
  'sound',
  'technical',
  'continuity',
  'vfx',
  'general',
];

export const DAILIES_RATING_LABELS: Record<number, string> = {
  0: 'No Rating',
  1: 'Poor',
  2: 'Below Average',
  3: 'Average',
  4: 'Good',
  5: 'Excellent',
};

// ============================================
// CREW PRESETS
// ============================================

export interface CrewPresetMember {
  name: string;
  role?: string;
  department?: string;
  default_call_time?: string;
  phone?: string;
  email?: string;
  is_cast?: boolean;
  cast_number?: string;
  character_name?: string;
}

export interface BacklotCrewPreset {
  id: string;
  project_id: string | null;
  user_id: string | null;
  name: string;
  description: string | null;
  template_type: BacklotCallSheetTemplate | null;
  crew_members: CrewPresetMember[];
  use_count: number;
  last_used_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface CrewPresetInput {
  name: string;
  description?: string;
  template_type?: BacklotCallSheetTemplate;
  crew_members: CrewPresetMember[];
  scope: 'project' | 'user';
}

// ============================================
// CALL SHEET CLONE
// ============================================

export interface CallSheetCloneRequest {
  new_date: string;
  new_day_number?: number;
  new_title?: string;
  keep_people?: boolean;
  keep_scenes?: boolean;
  keep_locations?: boolean;
  keep_schedule_blocks?: boolean;
  keep_department_notes?: boolean;
}

// ============================================
// BULK DEPARTMENT TIME UPDATE
// ============================================

export interface BulkDepartmentTimeUpdate {
  department: string;
  call_time?: string;
  makeup_time?: string;
  pickup_time?: string;
  on_set_time?: string;
  apply_to: 'all' | 'empty_only';
}

// =============================================================================
// INVOICES TYPES
// =============================================================================

export type InvoiceStatus = 'draft' | 'pending_approval' | 'approved' | 'changes_requested' | 'sent' | 'paid' | 'overdue' | 'cancelled';
export type InvoiceRateType = 'hourly' | 'daily' | 'weekly' | 'flat';
export type InvoicePaymentTerms = 'due_on_receipt' | 'net_15' | 'net_30' | 'net_45' | 'net_60' | 'custom';
export type InvoiceSourceType = 'manual' | 'timecard' | 'kit_rental' | 'mileage' | 'per_diem' | 'receipt';

export interface BacklotInvoice {
  id: string;
  project_id: string;
  user_id: string;
  invoice_number: string;
  invoice_date: string;
  due_date: string | null;
  invoicer_name: string;
  invoicer_email: string | null;
  invoicer_phone: string | null;
  invoicer_address: string | null;
  bill_to_name: string;
  bill_to_company: string | null;
  bill_to_address: string | null;
  bill_to_email: string | null;
  position_role: string | null;
  production_title: string | null;
  date_range_start: string | null;
  date_range_end: string | null;
  po_number: string | null;
  subtotal: number;
  tax_rate: number;
  tax_amount: number;
  discount_amount: number;
  total_amount: number;
  currency: string;
  payment_terms: InvoicePaymentTerms | null;
  payment_terms_custom: string | null;
  payment_method: string | null;
  payment_details: string | null;
  status: InvoiceStatus;
  sent_at: string | null;
  paid_at: string | null;
  paid_amount: number | null;
  notes: string | null;
  internal_notes: string | null;
  // Approval workflow fields
  submitted_for_approval_at: string | null;
  approved_at: string | null;
  approved_by: string | null;
  changes_requested_at: string | null;
  changes_requested_by: string | null;
  change_request_reason: string | null;
  created_at: string;
  updated_at: string;
  // Joined data
  line_items?: BacklotInvoiceLineItem[];
  user_name?: string;
  user_avatar?: string;
}

export interface BacklotInvoiceLineItem {
  id: string;
  invoice_id: string;
  description: string;
  rate_type: InvoiceRateType;
  rate_amount: number;
  quantity: number;
  units: string | null;
  line_total: number;
  source_type: InvoiceSourceType | null;
  source_id: string | null;
  service_date_start: string | null;
  service_date_end: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface InvoiceInput {
  invoice_number?: string;
  invoice_date: string;
  due_date?: string;
  invoicer_name: string;
  invoicer_email?: string;
  invoicer_phone?: string;
  invoicer_address?: string;
  bill_to_name: string;
  bill_to_company?: string;
  bill_to_address?: string;
  bill_to_email?: string;
  position_role?: string;
  production_title?: string;
  date_range_start?: string;
  date_range_end?: string;
  po_number?: string;
  payment_terms?: InvoicePaymentTerms;
  payment_terms_custom?: string;
  payment_method?: string;
  payment_details?: string;
  tax_rate?: number;
  discount_amount?: number;
  notes?: string;
}

export interface InvoiceLineItemInput {
  description: string;
  rate_type?: InvoiceRateType;
  rate_amount: number;
  quantity?: number;
  units?: string;
  service_date_start?: string;
  service_date_end?: string;
  source_type?: InvoiceSourceType;
  source_id?: string;
}

export interface InvoiceListItem {
  id: string;
  invoice_number: string;
  invoice_date: string;
  due_date: string | null;
  bill_to_name: string;
  bill_to_company: string | null;
  total_amount: number;
  status: InvoiceStatus;
  user_id: string;
  user_name?: string;
  line_item_count: number;
}

export interface InvoiceSummary {
  total_invoices: number;
  draft_count: number;
  pending_approval_count: number;
  approved_count: number;
  changes_requested_count: number;
  sent_count: number;
  paid_count: number;
  overdue_count: number;
  cancelled_count: number;
  total_outstanding: number;
  total_paid: number;
}

export interface ImportableInvoiceData {
  approved_timecards: Array<{
    id: string;
    week_start_date: string;
    total_hours: number;
    total_overtime: number;
    rate_amount: number | null;
    rate_type: string | null;
  }>;
  approved_kit_rentals: Array<{
    id: string;
    kit_name: string;
    start_date: string;
    end_date: string | null;
    daily_rate: number;
    total_amount: number;
  }>;
  approved_mileage: Array<{
    id: string;
    date: string;
    description: string | null;
    total_amount: number;
  }>;
  approved_per_diem: Array<{
    id: string;
    date: string;
    meal_type: string;
    amount: number;
  }>;
  approved_receipts: Array<{
    id: string;
    description: string | null;
    amount: number;
    purchase_date: string | null;
  }>;
}

export interface InvoicePrefillData {
  invoicer_name: string | null;
  invoicer_email: string | null;
  invoicer_phone: string | null;
  invoicer_address: string | null;
  bill_to_name: string | null;
  production_title: string | null;
  position_role: string | null;
}

// Invoice status configuration for UI
export const INVOICE_STATUS_CONFIG: Record<InvoiceStatus, { label: string; color: string }> = {
  draft: { label: 'Draft', color: 'bg-muted-gray/20 text-muted-gray border-muted-gray/30' },
  pending_approval: { label: 'Pending Approval', color: 'bg-amber-500/20 text-amber-400 border-amber-500/30' },
  approved: { label: 'Approved', color: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' },
  changes_requested: { label: 'Changes Requested', color: 'bg-orange-500/20 text-orange-400 border-orange-500/30' },
  sent: { label: 'Sent', color: 'bg-blue-500/20 text-blue-400 border-blue-500/30' },
  paid: { label: 'Paid', color: 'bg-green-500/20 text-green-400 border-green-500/30' },
  overdue: { label: 'Overdue', color: 'bg-red-500/20 text-red-400 border-red-500/30' },
  cancelled: { label: 'Cancelled', color: 'bg-gray-500/20 text-gray-500 border-gray-500/30' },
};

export const PAYMENT_TERMS_OPTIONS = [
  { value: 'due_on_receipt', label: 'Due on Receipt' },
  { value: 'net_15', label: 'Net 15' },
  { value: 'net_30', label: 'Net 30' },
  { value: 'net_45', label: 'Net 45' },
  { value: 'net_60', label: 'Net 60' },
  { value: 'custom', label: 'Custom' },
] as const;

export const RATE_TYPE_OPTIONS = [
  { value: 'hourly', label: 'Hourly' },
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'flat', label: 'Flat Rate' },
] as const;

// =====================================================
// Crew Rates Types
// =====================================================

export type CrewRateType = 'hourly' | 'daily' | 'weekly' | 'flat';

export type CrewRateSource = 'manual' | 'deal_memo' | 'imported';

export interface CrewRate {
  id: string;
  project_id: string;
  user_id: string | null;
  role_id: string | null;
  rate_type: CrewRateType;
  rate_amount: number;
  overtime_multiplier: number;
  double_time_multiplier: number;
  kit_rental_rate: number | null;
  car_allowance: number | null;
  phone_allowance: number | null;
  effective_start: string | null;
  effective_end: string | null;
  notes: string | null;
  deal_memo_id: string | null;
  source: CrewRateSource;
  created_at: string;
  updated_at: string;
  // Enriched fields from API
  user?: {
    id: string;
    full_name: string | null;
    username: string | null;
    avatar_url: string | null;
  } | null;
  role?: {
    id: string;
    title: string;
    department: string | null;
    type: 'cast' | 'crew';
  } | null;
  deal_memo?: DealMemo | null;
}

export interface CrewRateInput {
  user_id?: string | null;
  role_id?: string | null;
  rate_type: CrewRateType;
  rate_amount: number;
  overtime_multiplier?: number;
  double_time_multiplier?: number;
  kit_rental_rate?: number | null;
  car_allowance?: number | null;
  phone_allowance?: number | null;
  effective_start?: string | null;
  effective_end?: string | null;
  notes?: string | null;
}

export interface CrewRatesResponse {
  success: boolean;
  rates: CrewRate[];
  count: number;
}

export interface CrewRateResponse {
  success: boolean;
  rate: CrewRate;
  message?: string;
}

// =====================================================
// Daily Budget Labor Costs Types
// =====================================================

export interface LaborCostEntry {
  user_id: string;
  user_name: string | null;
  user_avatar: string | null;
  role_title: string | null;
  department: string | null;
  position: string | null;
  hours_worked: number;
  overtime_hours: number;
  double_time_hours: number;
  rate_type: CrewRateType;
  rate_amount: number;
  overtime_multiplier: number;
  double_time_multiplier: number;
  base_pay: number;
  overtime_pay: number;
  double_time_pay: number;
  kit_rental: number;
  car_allowance: number;
  phone_allowance: number;
  total_pay: number;
  rate_source: 'crew_rate' | 'entry' | 'budget';
  timecard_status: string;
  timecard_entry_id: string | null;
}

export interface DailyLaborCosts {
  production_day_id: string;
  date: string;
  entries: LaborCostEntry[];
  total_base_pay: number;
  total_overtime_pay: number;
  total_double_time_pay: number;
  total_allowances: number;
  grand_total: number;
  approved_count: number;
  pending_count: number;
}

// =============================================================================
// DAILY BUDGET SCENE COSTS
// =============================================================================

export interface SceneExpenseItem {
  id: string;
  expense_type: 'receipt' | 'mileage' | 'kit_rental' | 'per_diem' | 'invoice_line_item';
  description: string | null;
  amount: number;
  vendor: string | null;
  user_name: string | null;
  date: string | null;
  status: string | null;
}

export interface SceneBreakdownCostItem {
  id: string;
  item_type: string; // 'prop', 'wardrobe', 'makeup', 'special_effect', 'vehicle', 'animal', 'other'
  description: string;
  quantity: number;
  estimated_cost: number;
  notes: string | null;
}

export interface SceneCostDetail {
  scene_id: string;
  scene_number: string | null;
  scene_name: string | null;
  int_ext: string | null;
  location: string | null;

  // Breakdown items (from scene breakdown)
  breakdown_items: SceneBreakdownCostItem[];
  breakdown_subtotal: number;

  // Expenses linked to this scene
  expenses: SceneExpenseItem[];
  expenses_subtotal: number;

  // Total for this scene
  scene_total: number;
}

export interface DailySceneCosts {
  production_day_id: string;
  date: string;
  scenes: SceneCostDetail[];
  total_breakdown_costs: number;
  total_expense_costs: number;
  grand_total: number;
}

// =============================================================================
// DAILY BUDGET INVOICES
// =============================================================================

export interface DailyInvoiceLineItem {
  id: string;
  description: string | null;
  quantity: number;
  unit_price: number;
  amount: number;
  service_date: string | null;
  scene_id: string | null;
  scene_number: string | null;
}

export interface DailyInvoiceEntry {
  id: string;
  invoice_number: string | null;
  vendor_name: string | null;
  vendor_email: string | null;
  status: string;
  invoice_date: string | null;
  due_date: string | null;
  subtotal: number;
  tax_amount: number;
  total_amount: number;
  notes: string | null;
  line_items: DailyInvoiceLineItem[];
  link_type: 'production_day' | 'service_date';
}

export interface DailyInvoices {
  production_day_id: string;
  date: string;
  invoices: DailyInvoiceEntry[];
  total_amount: number;
  approved_total: number;
  pending_total: number;
  invoice_count: number;
  approved_count: number;
  pending_count: number;
}

// =============================================================================
// DEAL MEMOS
// =============================================================================

export type DealMemoStatus = 'draft' | 'pending_send' | 'sent' | 'viewed' | 'signed' | 'declined' | 'voided' | 'expired';
export type DealMemoRateType = 'hourly' | 'daily' | 'weekly' | 'flat';

export interface DealMemo {
  id: string;
  project_id: string;
  role_id: string | null;
  user_id: string;

  // Deal Terms
  position_title: string;
  rate_type: DealMemoRateType;
  rate_amount: number;
  overtime_multiplier: number;
  double_time_multiplier: number;
  kit_rental_rate: number | null;
  car_allowance: number | null;
  phone_allowance: number | null;
  per_diem_rate: number | null;
  start_date: string | null;
  end_date: string | null;
  additional_terms: Record<string, unknown>;
  notes: string | null;

  // DocuSign
  docusign_envelope_id: string | null;
  docusign_status: string;
  docusign_sent_at: string | null;
  docusign_signed_at: string | null;
  docusign_declined_at: string | null;
  docusign_void_reason: string | null;
  signed_document_url: string | null;

  // Status
  status: DealMemoStatus;

  created_by: string | null;
  created_at: string;
  updated_at: string;

  // PDF & In-App Signing
  template_id: string | null;
  template_type: 'crew' | 'talent' | null;
  pdf_s3_key: string | null;
  signed_pdf_s3_key: string | null;
  signature_request_token: string | null;
  signing_ip: string | null;
  signing_user_agent: string | null;
  signature_type: 'draw' | 'type' | 'saved' | null;
  signature_data: string | null;
  signed_at: string | null;
  sent_at: string | null;
  viewed_at: string | null;
  performer_category: string | null;
  usage_rights: Record<string, unknown> | null;
  signer_name: string | null;
  signer_email: string | null;
  email_message: string | null;

  // Joined data
  user?: BacklotProfile;
  role?: {
    id: string;
    title: string;
    department: string | null;
    type: 'cast' | 'crew';
  } | null;
  created_by_user?: BacklotProfile;
}

export interface DealMemoInput {
  role_id?: string | null;
  user_id: string;
  position_title: string;
  rate_type: DealMemoRateType;
  rate_amount: number;
  overtime_multiplier?: number;
  double_time_multiplier?: number;
  kit_rental_rate?: number | null;
  car_allowance?: number | null;
  phone_allowance?: number | null;
  per_diem_rate?: number | null;
  start_date?: string | null;
  end_date?: string | null;
  additional_terms?: Record<string, unknown>;
  notes?: string | null;
  template_type?: 'crew' | 'talent';
  performer_category?: string | null;
  usage_rights?: Record<string, unknown> | null;
  signer_name?: string | null;
  signer_email?: string | null;
}

export interface DealMemoTemplate {
  id: string;
  name: string;
  template_type: string;
  is_system_template: boolean;
  field_schema: Record<string, unknown>;
}

export interface DealMemoResponse {
  success: boolean;
  deal_memo: DealMemo;
  message?: string;
}

export interface DealMemosResponse {
  success: boolean;
  deal_memos: DealMemo[];
  count: number;
}

// =============================================================================
// CREDIT PREFERENCES
// =============================================================================

export interface CreditPreference {
  id: string;
  user_id: string;
  project_id: string | null;
  role_id: string | null;

  display_name: string | null;
  role_title_preference: string | null;
  department_preference: string | null;
  endorsement_note: string | null;
  imdb_id: string | null;
  use_as_default: boolean;
  is_public: boolean;

  created_at: string;
  updated_at: string;

  // Joined data
  user?: BacklotProfile;
  role?: {
    id: string;
    title: string;
    department: string | null;
    type: 'cast' | 'crew';
  } | null;
}

export interface CreditPreferenceInput {
  project_id?: string | null;
  role_id?: string | null;
  display_name?: string | null;
  role_title_preference?: string | null;
  department_preference?: string | null;
  endorsement_note?: string | null;
  imdb_id?: string | null;
  use_as_default?: boolean;
  is_public?: boolean;
}

export interface CreditPreferenceResponse {
  success: boolean;
  credit_preference: CreditPreference;
  message?: string;
}

export interface CreditPreferencesResponse {
  success: boolean;
  credit_preferences: CreditPreference[];
  count: number;
}

// =============================================================================
// DOCUSIGN WEBHOOKS
// =============================================================================

export interface DocuSignWebhook {
  id: string;
  envelope_id: string;
  event_type: string;
  event_timestamp: string;
  payload: Record<string, unknown>;
  processed_at: string | null;
  processing_error: string | null;
  created_at: string;
}

// =============================================================================
// DOCUMENT PACKAGES (Crew Onboarding)
// =============================================================================

export type DocumentPackageTargetType = 'cast' | 'crew' | 'all';

export interface DocumentPackage {
  id: string;
  project_id: string | null;
  owner_user_id: string | null;
  name: string;
  description: string | null;
  target_type: DocumentPackageTargetType;
  is_active: boolean;
  use_count: number;
  created_at: string;
  updated_at: string;
  // Joined data
  items?: DocumentPackageItem[];
  owner?: BacklotProfile;
}

export interface DocumentPackageItem {
  id: string;
  package_id: string;
  clearance_type: BacklotClearanceType;
  template_id: string | null;
  is_required: boolean;
  sort_order: number;
  custom_title: string | null;
  custom_description: string | null;
  created_at: string;
  // Joined data
  template?: BacklotClearanceTemplate;
}

export interface DocumentPackageInput {
  name: string;
  description?: string | null;
  target_type?: DocumentPackageTargetType;
  is_active?: boolean;
  items?: DocumentPackageItemInput[];
}

export interface DocumentPackageItemInput {
  clearance_type: BacklotClearanceType;
  template_id?: string | null;
  is_required?: boolean;
  sort_order?: number;
  custom_title?: string | null;
  custom_description?: string | null;
}

export type PackageAssignmentStatus = 'pending' | 'in_progress' | 'completed' | 'cancelled';

export interface PackageAssignment {
  id: string;
  package_id: string;
  project_id: string;
  assigned_to_user_id: string | null;
  assigned_by_user_id: string | null;
  assigned_at: string;
  due_date: string | null;
  notes: string | null;
  status: PackageAssignmentStatus;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
  // Joined data
  package?: DocumentPackage;
  assigned_to_user?: BacklotProfile;
  assigned_by_user?: BacklotProfile;
  items?: PackageAssignmentItem[];
  // Computed
  total_items?: number;
  signed_items?: number;
  pending_items?: number;
  completion_percentage?: number;
}

export interface PackageAssignmentItem {
  id: string;
  assignment_id: string;
  package_item_id: string;
  clearance_id: string | null;
  status: BacklotClearanceStatus;
  is_required: boolean;
  created_at: string;
  updated_at: string;
  // Joined data
  clearance?: BacklotClearanceItem;
  package_item?: DocumentPackageItem;
}

export interface SendPackageInput {
  package_id: string;
  recipient_user_ids: string[];
  due_date?: string | null;
  notes?: string | null;
  send_email_notification?: boolean;
}

export interface SendPackageResult {
  success: boolean;
  assignments_created: number;
  clearances_created: number;
  emails_sent: number;
  message: string;
  assignment_ids: string[];
}

// =============================================================================
// CLEARANCE APPROVALS (Post-Sign Workflow)
// =============================================================================

export type ClearanceApprovalStatus =
  | 'not_required'
  | 'pending_approval'
  | 'approved'
  | 'changes_requested'
  | 'rejected';

export interface ClearanceApproval {
  id: string;
  clearance_id: string;
  requires_approval: boolean;
  approver_user_id: string | null;
  approver_role: string | null;
  approval_status: ClearanceApprovalStatus;
  approved_at: string | null;
  approved_by_user_id: string | null;
  approved_by_name: string | null;
  change_request_notes: string | null;
  change_requested_at: string | null;
  change_requested_by_user_id: string | null;
  locked_at: string | null;
  created_at: string;
  updated_at: string;
  // Joined data
  approver?: BacklotProfile;
  approved_by?: BacklotProfile;
}

export interface ClearanceApprovalInput {
  requires_approval: boolean;
  approver_user_id?: string | null;
  approver_role?: string | null;
}

export interface ApprovalActionInput {
  action: 'approve' | 'request_changes' | 'reject';
  notes?: string | null;
}

export const CLEARANCE_APPROVAL_STATUS_LABELS: Record<ClearanceApprovalStatus, string> = {
  not_required: 'No Approval Required',
  pending_approval: 'Pending Approval',
  approved: 'Approved',
  changes_requested: 'Changes Requested',
  rejected: 'Rejected',
};

export const CLEARANCE_APPROVAL_STATUS_COLORS: Record<ClearanceApprovalStatus, string> = {
  not_required: 'gray',
  pending_approval: 'yellow',
  approved: 'green',
  changes_requested: 'orange',
  rejected: 'red',
};

// =============================================================================
// SIGNING PORTAL (Profile Pending Documents)
// =============================================================================

export interface PendingDocument {
  clearance_id: string;
  clearance_title: string;
  clearance_type: BacklotClearanceType;
  project_id: string;
  project_title: string;
  recipient_id: string;
  requires_signature: boolean;
  signature_status: ClearanceSignatureStatus;
  batch_sign_allowed: boolean;
  file_url: string | null;
  file_name: string | null;
  sent_at: string | null;
  expiration_date: string | null;
  access_token: string | null;
  // Package info if part of a package
  package_assignment_id: string | null;
  package_name: string | null;
}

export interface PendingDocumentsSummary {
  total: number;
  pending_signature: number;
  viewed: number;
  by_project: {
    project_id: string;
    project_title: string;
    count: number;
  }[];
}

export interface BatchSignInput {
  recipient_ids: string[];
  signature_data: string; // Base64 signature image
}

export interface BatchSignResult {
  success: boolean;
  documents_signed: number;
  session_id: string;
  message: string;
}

// =============================================================================
// CREW DOCUMENT SUMMARY (Cast/Crew Tab Dashboard)
// =============================================================================

export interface CrewDocumentSummary {
  person_id: string;
  person_name: string;
  role_title: string | null;
  role_type: 'cast' | 'crew' | null;
  department: string | null;
  avatar_url: string | null;
  documents: {
    required: number;
    signed: number;
    pending: number;
    missing: number;
  };
  completion_percentage: number;
  last_activity: string | null;
  onboarding_complete: boolean;
}

export interface CrewDocumentDashboardData {
  crew: CrewDocumentSummary[];
  totals: {
    total_crew: number;
    fully_complete: number;
    in_progress: number;
    not_started: number;
  };
}

export interface PersonDocumentChecklist {
  person_id: string;
  person_name: string;
  documents: {
    clearance_id: string;
    clearance_title: string;
    clearance_type: BacklotClearanceType;
    status: BacklotClearanceStatus;
    is_required: boolean;
    signed_date: string | null;
    sent_date: string | null;
    file_url: string | null;
    // Package info
    package_assignment_id: string | null;
    package_name: string | null;
  }[];
  summary: {
    total: number;
    signed: number;
    pending: number;
    missing: number;
    completion_percentage: number;
  };
}
