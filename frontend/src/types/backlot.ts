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
export interface BacklotLocation {
  id: string;
  project_id: string;
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
  created_at: string;
  updated_at: string;
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

export interface TaskInput {
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
  | 'schedule'
  | 'call-sheets'
  | 'tasks'
  | 'locations'
  | 'gear'
  | 'budget'
  | 'daily-budget'
  | 'receipts'
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
