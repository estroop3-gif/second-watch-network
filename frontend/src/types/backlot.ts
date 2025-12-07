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
export type BacklotCallSheetTemplate = 'feature' | 'documentary' | 'music_video' | 'commercial';
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

  // Branding & PDF
  header_logo_url: string | null;
  pdf_url: string | null;
  pdf_generated_at: string | null;

  // Custom Contacts (JSONB array)
  custom_contacts: CallSheetCustomContact[];

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
  created_by: string | null;
  created_at: string;
  updated_at: string;
  // Joined data
  linked_user?: BacklotProfile;
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

// View/Tab types for workspace navigation
export type BacklotWorkspaceView =
  | 'overview'
  | 'script'
  | 'shot-lists'
  | 'coverage'
  | 'schedule'
  | 'call-sheets'
  | 'casting'
  | 'tasks'
  | 'locations'
  | 'gear'
  | 'budget'
  | 'daily-budget'
  | 'receipts'
  | 'clearances'
  | 'assets'
  | 'analytics'
  | 'updates'
  | 'contacts'
  | 'credits'
  | 'settings';

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
export type BacklotReimbursementStatus = 'not_applicable' | 'pending' | 'approved' | 'reimbursed';

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
  page_number: number;
  start_offset: number;
  end_offset: number;
  highlighted_text: string;
  rect_x?: number;
  rect_y?: number;
  rect_width?: number;
  rect_height?: number;
  category: BacklotBreakdownItemType;
  color?: string;
  suggested_label?: string;
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
  requires_reel: boolean;
  requires_headshot: boolean;
  application_deadline: string | null;
  max_applications: number | null;
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
  requires_reel?: boolean;
  requires_headshot?: boolean;
  application_deadline?: string | null;
  max_applications?: number | null;
}

export interface RoleApplicationInput {
  cover_note?: string | null;
  availability_notes?: string | null;
  rate_expectation?: string | null;
  reel_url?: string | null;
  headshot_url?: string | null;
  resume_url?: string | null;
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
  | 'signed'
  | 'expired'
  | 'rejected';

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
  // Audit
  created_by_user_id: string;
  created_at: string;
  updated_at: string;
  // Joined data
  related_location?: BacklotLocation;
  created_by?: BacklotProfile;
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
  signed: 'Signed',
  expired: 'Expired',
  rejected: 'Rejected',
};

export const CLEARANCE_STATUS_COLORS: Record<BacklotClearanceStatus, string> = {
  not_started: 'gray',
  requested: 'yellow',
  signed: 'green',
  expired: 'orange',
  rejected: 'red',
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
export type BacklotAssetType = 'episode' | 'feature' | 'trailer' | 'teaser' | 'social' | 'bts' | 'other';

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
  is_edited: boolean;
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
