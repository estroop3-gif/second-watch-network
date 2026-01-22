/**
 * Set House TypeScript Types
 * Space/location rental management system types
 */

// ============================================================================
// ENUMS
// ============================================================================

export type SetHouseOrganizationType = 'studio' | 'location_house' | 'hybrid' | 'agency' | 'other';

export type OrganizationMemberRole = 'owner' | 'admin' | 'manager' | 'member';

export type SpaceType =
  | 'sound_stage'
  | 'studio'
  | 'backlot'
  | 'location'
  | 'office'
  | 'warehouse'
  | 'parking'
  | 'green_room'
  | 'production_office'
  | 'mill_space'
  | 'other';

export type SpaceStatus =
  | 'available'
  | 'reserved'
  | 'booked'
  | 'under_maintenance'
  | 'retired';

export type SpaceCondition = 'excellent' | 'good' | 'fair' | 'poor' | 'non_functional';

export type TransactionType =
  | 'booking_confirmed'
  | 'booking_completed'
  | 'booking_cancelled'
  | 'hold_placed'
  | 'hold_released'
  | 'maintenance_start'
  | 'maintenance_end'
  | 'inspection';

export type TransactionStatus = 'draft' | 'pending' | 'confirmed' | 'in_progress' | 'completed' | 'cancelled';

export type IncidentType =
  | 'damage'
  | 'safety_issue'
  | 'policy_violation'
  | 'noise_complaint'
  | 'cleanup_required';

export type IncidentStatus = 'open' | 'investigating' | 'repair' | 'resolved';

export type IncidentResolutionType = 'repaired' | 'cleaned' | 'no_action_needed' | 'charged_client';

export type DamageTier = 'cosmetic' | 'functional' | 'structural' | 'hazardous';

export type RepairStatus =
  | 'open'
  | 'diagnosing'
  | 'awaiting_approval'
  | 'in_repair'
  | 'ready_for_qc'
  | 'closed'
  | 'cancelled';

export type RepairPriority = 'low' | 'normal' | 'high' | 'urgent';

export type StrikeSeverity = 'warning' | 'minor' | 'major' | 'critical';

// Check-in permission and policy types
export type CheckinPermissionLevel = 'anyone' | 'custodian_only' | 'custodian_and_admins';
export type PartialReturnPolicy = 'allow' | 'warn' | 'block';
export type CheckinDamageTier = 'cosmetic' | 'functional' | 'structural';

// Verification types
export type VerifyMethod = 'checkoff_only' | 'photo_required' | 'checklist_required';
export type DiscrepancyAction = 'block' | 'warn';
export type PackageVerificationMode = 'package_only' | 'verify_contents';
export type ReceiverVerificationMode = 'none' | 'signature' | 'photo' | 'signature_and_photo';
export type ReceiverVerificationTiming = 'same_session' | 'async_link' | 'both';
export type VerificationStatus = 'pending' | 'in_progress' | 'completed' | 'expired' | 'cancelled';
export type VerificationType = 'booking_start' | 'booking_end' | 'inspection';
export type ItemVerificationStatus = 'pending' | 'verified' | 'discrepancy';

// ============================================================================
// ORGANIZATION TYPES
// ============================================================================

export interface SetHouseOrganization {
  id: string;
  name: string;
  slug?: string;
  org_type?: SetHouseOrganizationType;
  description?: string;
  logo_url?: string;
  website_url?: string;
  status?: string;
  // Address
  address_line1?: string;
  address_line2?: string;
  city?: string;
  state?: string;
  postal_code?: string;
  country?: string;
  latitude?: number;
  longitude?: number;
  phone?: string;
  email?: string;
  created_by?: string;
  created_at: string;
  updated_at: string;
  // Joined from organization_members
  role?: string;
}

export interface SetHouseOrganizationMember {
  id: string;
  organization_id: string;
  user_id: string;
  role: OrganizationMemberRole;
  invited_by_user_id?: string;
  invited_at?: string;
  accepted_at?: string;
  is_active: boolean;
  created_at: string;
  // Joined fields
  display_name?: string;
  email?: string;
  avatar_url?: string;
}

export interface SetHouseOrganizationSettings {
  id: string;
  organization_id: string;
  default_booking_duration_days: number;
  require_photos_on_booking_start?: boolean;
  require_photos_on_booking_end?: boolean;
  require_photos_on_damage?: boolean;
  enable_strikes: boolean;
  strikes_before_suspension: number;
  enable_auto_strikes: boolean;
  late_fee_per_day?: number;
  damage_deposit_percent?: number;
  // Booking start verification settings
  booking_start_verification_required?: boolean;
  booking_start_verify_method?: VerifyMethod;
  booking_start_discrepancy_action?: DiscrepancyAction;
  // Booking end verification settings
  booking_end_verification_required?: boolean;
  booking_end_verify_method?: VerifyMethod;
  booking_end_discrepancy_action?: DiscrepancyAction;
  // Receiver verification settings
  receiver_verification_mode?: ReceiverVerificationMode;
  receiver_verification_timing?: ReceiverVerificationTiming;
  // Check-in permissions & policies
  checkin_permission_level?: CheckinPermissionLevel;
  require_condition_on_booking_end?: boolean;
  partial_booking_policy?: PartialReturnPolicy;
  // Late/overdue settings
  late_return_auto_incident?: boolean;
  late_grace_period_hours?: number;
  // Notifications
  notify_on_booking_start?: boolean;
  notify_on_booking_end?: boolean;
  notify_late_return?: boolean;
  notify_damage_found?: boolean;
}

// Verification session types
export interface VerificationItem {
  id: string;
  type: 'space' | 'package';
  name: string;
  internal_id: string;
  parent_package_id?: string;
  parent_package_name?: string;
  is_package_parent?: boolean;
  required: boolean;
  status: ItemVerificationStatus;
  verified_at?: string;
  verified_by?: string;
  method?: 'photo' | 'checkoff';
}

export interface VerificationDiscrepancy {
  item_id: string;
  issue_type: 'damage' | 'missing_item' | 'cleanliness' | 'other';
  notes?: string;
}

export interface VerificationSession {
  id: string;
  organization_id: string;
  transaction_id: string;
  verification_type: VerificationType;
  status: VerificationStatus;
  token?: string;
  link_sent_to?: string;
  link_sent_at?: string;
  link_expires_at?: string;
  items_to_verify: VerificationItem[];
  items_verified: VerificationItem[];
  discrepancies: VerificationDiscrepancy[];
  discrepancy_acknowledged: boolean;
  signature_url?: string;
  signature_captured_at?: string;
  started_at?: string;
  completed_at?: string;
  completed_by?: string;
  created_at: string;
  updated_at: string;
}

export interface SetHouseCategory {
  id: string;
  organization_id: string;
  name: string;
  description?: string;
  parent_category_id?: string;
  icon?: string;
  color?: string;
  default_booking_duration_days?: number;
  is_active: boolean;
  sort_order: number;
}

export type LocationType = 'main_facility' | 'satellite' | 'partner_location' | 'other';

export interface SetHouseLocation {
  id: string;
  organization_id: string;
  name: string;
  location_type: LocationType;
  // Address
  address_line1?: string;
  address_line2?: string;
  city?: string;
  state?: string;
  postal_code?: string;
  country?: string;
  // Coordinates
  latitude?: number;
  longitude?: number;
  // Contact
  contact_name?: string;
  contact_phone?: string;
  contact_email?: string;
  // Settings
  is_default_location?: boolean;
  is_active: boolean;
  // Metadata
  created_at?: string;
  updated_at?: string;
}

// ============================================================================
// SPACE TYPES (analogous to ASSET TYPES in Gear House)
// ============================================================================

export interface SetHouseSpace {
  id: string;
  organization_id: string;
  category_id?: string;
  category_name?: string;
  name: string;
  description?: string;
  space_type: SpaceType;
  status: SpaceStatus;
  current_condition?: SpaceCondition;
  internal_id: string;
  // Physical attributes
  square_footage?: number;
  ceiling_height_feet?: number;
  dimensions?: Record<string, unknown>;
  max_occupancy?: number;
  features?: string[];
  amenities?: string[];
  // Media
  photos?: string[];
  floor_plan_url?: string;
  virtual_tour_url?: string;
  // Pricing
  daily_rate?: number;
  half_day_rate?: number;
  hourly_rate?: number;
  weekly_rate?: number;
  monthly_rate?: number;
  // Location & Custody
  location_id?: string;
  location_name?: string;
  current_custodian_user_id?: string;
  current_custodian_name?: string;
  // Access
  access_instructions?: string;
  parking_info?: string;
  loading_dock_info?: string;
  // Package membership
  parent_package_id?: string;
  parent_package_name?: string;
  is_package: boolean;
  contained_space_count?: number;
  contained_spaces?: SetHouseSpace[];
  // Notes
  notes?: string;
  // Status
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface SetHouseSpaceImage {
  id: string;
  space_id: string;
  image_url: string;
  caption?: string;
  is_primary: boolean;
  sort_order: number;
  created_at: string;
}

export interface SetHouseSpaceHistory {
  id: string;
  space_id: string;
  event_type: string;
  event_data: Record<string, unknown>;
  performed_by_user_id?: string;
  performed_by_name?: string;
  created_at: string;
}

// ============================================================================
// PACKAGE TYPES (analogous to KIT TYPES in Gear House)
// ============================================================================

export interface SetHousePackageTemplate {
  id: string;
  organization_id: string;
  name: string;
  description?: string;
  category_id?: string;
  category_name?: string;
  photo_url?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  items?: SetHousePackageTemplateItem[];
}

export interface SetHousePackageTemplateItem {
  id: string;
  template_id: string;
  category_id?: string;
  category_name?: string;
  specific_space_id?: string;
  specific_space_name?: string;
  description?: string;
  quantity: number;
  is_required: boolean;
  sort_order: number;
  nested_template_id?: string;
  nested_template_name?: string;
}

export interface SetHousePackageInstance {
  id: string;
  organization_id: string;
  template_id?: string;
  template_name?: string;
  name: string;
  internal_id: string;
  status: SpaceStatus;
  location_id?: string;
  location_name?: string;
  current_custodian_user_id?: string;
  current_custodian_name?: string;
  notes?: string;
  // Pricing
  hourly_rate?: number;
  half_day_rate?: number;
  daily_rate?: number;
  weekly_rate?: number;
  monthly_rate?: number;
  discount_percent?: number;
  // Metadata
  is_active: boolean;
  created_at: string;
  updated_at: string;
  contents?: SetHousePackageMembership[];
  space_count?: number;
}

export interface SetHousePackageMembership {
  id: string;
  package_instance_id: string;
  space_id?: string;
  space_name?: string;
  space_internal_id?: string;
  space_status?: SpaceStatus;
  added_at: string;
  added_by_user_id?: string;
  is_present: boolean;
  slot_name?: string;
  slot_number?: number;
  nested_package_id?: string;
  nested_package_name?: string;
  nested_package_internal_id?: string;
  nested_package_status?: SpaceStatus;
  nested_package_contents?: SetHousePackageMembership[];
}

// ============================================================================
// TRANSACTION TYPES
// ============================================================================

export interface SetHouseTransaction {
  id: string;
  organization_id: string;
  transaction_type: TransactionType;
  status: TransactionStatus;
  reference_number?: string;

  // People
  initiated_by_user_id: string;
  initiated_by_name?: string;
  primary_custodian_user_id?: string;
  primary_custodian_name?: string;

  // External contact custodian
  custodian_contact_id?: string;
  custodian_contact_name?: string;
  custodian_contact_company?: string;
  custodian_contact_email?: string;
  custodian_contact_phone?: string;

  // Project & counterparty
  counterparty_org_id?: string;
  backlot_project_id?: string;
  backlot_project_name?: string;
  project_name?: string;

  // Timing
  scheduled_start?: string;
  scheduled_end?: string;
  actual_start?: string;
  actual_end?: string;
  initiated_at?: string;

  // Verification
  start_verification_required?: boolean;
  start_verification_completed_at?: string;
  end_verification_required?: boolean;
  end_verification_completed_at?: string;

  // Signatures
  initiator_signature_url?: string;
  custodian_signature_url?: string;

  // Notes & metadata
  notes?: string;
  created_at: string;
  updated_at: string;

  // Related data
  items?: SetHouseTransactionItem[];
  item_count?: number;
  condition_reports?: TransactionConditionReportItem[];
  existing_incidents?: ExistingIncident[];
}

// Stage where damage was reported
export type IncidentReportedStage = 'booking_start' | 'booking_end' | 'work_order' | 'inspection';

// Incident data returned with transaction for booking end
export interface ExistingIncident {
  id: string;
  space_id: string;
  space_name?: string;
  space_internal_id?: string;
  damage_tier: CheckinDamageTier;
  damage_description?: string;
  photos?: string[];
  has_repair_ticket: boolean;
  reported_at?: string;
  reported_stage?: IncidentReportedStage;
  status?: string;
}

export interface SetHouseTransactionItem {
  id: string;
  transaction_id: string;
  space_id?: string;
  space_name?: string;
  space_internal_id?: string;
  space_type?: SpaceType;
  package_instance_id?: string;
  package_name?: string;
  package_internal_id?: string;
  quantity: number;
  condition_at_start?: SpaceCondition;
  condition_at_end?: SpaceCondition;
  notes?: string;
  daily_rate?: number;
}

export interface TransactionConditionReportItem {
  id: string;
  checkpoint_type: string;
  reported_at: string;
  report_notes?: string;
  space_id: string;
  condition_grade: SpaceCondition;
  notes?: string;
  photos?: string[];
  has_cosmetic_damage: boolean;
  has_functional_damage: boolean;
  has_structural_damage: boolean;
  reported_by_name?: string;
}

// ============================================================================
// INCIDENT TYPES
// ============================================================================

export interface SetHouseIncident {
  id: string;
  organization_id: string;
  incident_type: IncidentType;
  status: IncidentStatus;
  space_id?: string;
  space_name?: string;
  space_internal_id?: string;
  package_instance_id?: string;
  transaction_id?: string;
  reported_by_user_id: string;
  reported_by_name?: string;
  reported_at: string;
  reported_stage?: IncidentReportedStage;
  assigned_to_user_id?: string;
  assigned_to_name?: string;
  damage_tier?: DamageTier;
  damage_description?: string;
  photos?: string[];
  notes?: string;
  estimated_cost?: number;
  actual_cost?: number;
  resolution_type?: IncidentResolutionType;
  resolution_notes?: string;
  resolved_by_user_id?: string;
  resolved_by_name?: string;
  resolved_at?: string;
  created_at: string;
  updated_at: string;
}

// ============================================================================
// REPAIR TYPES
// ============================================================================

export interface SetHouseRepairTicket {
  id: string;
  organization_id: string;
  space_id: string;
  space_name?: string;
  space_internal_id?: string;
  incident_id?: string;
  ticket_number: string;
  title: string;
  description?: string;
  status: RepairStatus;
  priority: RepairPriority;
  created_by_user_id: string;
  created_by_name?: string;
  assigned_to_user_id?: string;
  assigned_to_name?: string;
  vendor_id?: string;
  vendor_name?: string;
  vendor_reference?: string;
  diagnosis?: string;
  quote_amount?: number;
  quote_approved?: boolean;
  quote_approved_by_user_id?: string;
  quote_approved_at?: string;
  parts_cost?: number;
  labor_cost?: number;
  total_cost?: number;
  estimated_completion_date?: string;
  actual_completion_date?: string;
  downtime_days?: number;
  qc_passed?: boolean;
  qc_notes?: string;
  qc_by_user_id?: string;
  qc_at?: string;
  created_at: string;
  updated_at: string;
}

export interface SetHouseVendor {
  id: string;
  organization_id: string;
  name: string;
  vendor_type: string;
  email?: string;
  phone?: string;
  website?: string;
  address?: Record<string, unknown>;
  is_preferred: boolean;
  is_active: boolean;
  created_at: string;
}

// ============================================================================
// STRIKE TYPES
// ============================================================================

export interface SetHouseStrike {
  id: string;
  organization_id: string;
  user_id: string;
  user_name?: string;
  issued_by_user_id: string;
  issued_by_name?: string;
  severity: StrikeSeverity;
  points: number;
  reason: string;
  incident_id?: string;
  repair_ticket_id?: string;
  transaction_id?: string;
  backlot_project_id?: string;
  photos?: string[];
  is_active: boolean;
  voided_at?: string;
  voided_by_user_id?: string;
  voided_reason?: string;
  expires_at?: string;
  issued_at: string;
}

export interface SetHouseUserEscalationStatus {
  id: string;
  organization_id: string;
  user_id: string;
  user_name?: string;
  total_active_points: number;
  total_active_strikes: number;
  escalation_level: string;
  requires_manager_review: boolean;
  escalated_at?: string;
  reviewed_by_user_id?: string;
  reviewed_at?: string;
  review_decision?: string;
  last_strike_at?: string;
  created_at: string;
  updated_at: string;
}

// ============================================================================
// API RESPONSE TYPES
// ============================================================================

export interface SetHouseOrganizationsResponse {
  organizations: SetHouseOrganization[];
}

export interface SetHouseSpacesResponse {
  spaces: SetHouseSpace[];
  total?: number;
}

export interface SetHouseSpaceStatsResponse {
  total: number;
  by_status: Record<SpaceStatus, number>;
  by_condition: Record<SpaceCondition, number>;
  total_square_footage: number;
}

export interface SetHouseTransactionsResponse {
  transactions: SetHouseTransaction[];
  total?: number;
}

export interface SetHouseIncidentsResponse {
  incidents: SetHouseIncident[];
  total?: number;
}

export interface SetHouseRepairTicketsResponse {
  tickets: SetHouseRepairTicket[];
  total?: number;
}

export interface SetHouseStrikesResponse {
  strikes: SetHouseStrike[];
}

export interface UserStrikeSummary {
  user_id: string;
  user_name: string;
  avatar_url?: string;
  email?: string;
  active_strikes: number;
  active_points: number;
  lifetime_strikes: number;
  is_escalated: boolean;
  requires_manager_review: boolean;
  review_decision?: 'approved' | 'probation' | 'suspended';
  escalated_at?: string;
  latest_strike?: {
    severity: StrikeSeverity;
    reason: string;
    issued_at: string;
  };
}

export interface UsersWithStrikesResponse {
  users: UserStrikeSummary[];
}

// ============================================================================
// FORM INPUT TYPES
// ============================================================================

export interface CreateOrganizationInput {
  name: string;
  org_type?: SetHouseOrganizationType;
  description?: string;
  website?: string;
  // Required location fields
  address_line1: string;
  city: string;
  state: string;
  postal_code: string;
  country?: string;
}

export interface CreateSpaceInput {
  name: string;
  category_id?: string;
  space_type: SpaceType;
  description?: string;
  // Physical attributes
  square_footage?: number;
  ceiling_height_feet?: number;
  max_occupancy?: number;
  features?: string[];
  amenities?: string[];
  // Pricing
  daily_rate?: number;
  half_day_rate?: number;
  hourly_rate?: number;
  weekly_rate?: number;
  monthly_rate?: number;
  // Location
  location_id?: string;
  notes?: string;
}

export interface CreateTransactionInput {
  transaction_type: TransactionType;
  items?: Array<{
    space_id?: string;
    package_instance_id?: string;
    quantity?: number;
    notes?: string;
  }>;
  space_ids?: string[];
  package_instance_ids?: string[];
  primary_custodian_user_id?: string;
  backlot_project_id?: string;
  scheduled_start?: string;
  scheduled_end?: string;
  rental_start_date?: string;
  rental_end_date?: string;
  notes?: string;
  // Client linking (preferred - ties to Clients tab)
  client_company_id?: string;
  client_contact_id?: string;
  // Legacy free-form client info
  client_name?: string;
  client_email?: string;
  client_phone?: string;
}

export interface CreateIncidentInput {
  incident_type: IncidentType;
  space_id?: string;
  package_instance_id?: string;
  transaction_id?: string;
  damage_tier?: DamageTier;
  damage_description?: string;
  photos?: string[];
  notes?: string;
}

export interface CreateRepairTicketInput {
  space_id: string;
  title: string;
  description?: string;
  priority?: RepairPriority;
  vendor_id?: string;
  assigned_to_user_id?: string;
  incident_id?: string;
}

export interface CreateStrikeInput {
  user_id: string;
  severity: StrikeSeverity;
  reason: string;
  incident_id?: string;
  repair_ticket_id?: string;
  transaction_id?: string;
  points?: number;
  photos?: string[];
}

// ============================================================================
// CLIENT COMPANY TYPES
// ============================================================================

export type IDType = 'drivers_license' | 'passport' | 'state_id' | 'other';

export interface SetHouseClientCompany {
  id: string;
  organization_id: string;
  name: string;
  email?: string;
  phone?: string;
  website?: string;
  address_line1?: string;
  address_line2?: string;
  city?: string;
  state?: string;
  postal_code?: string;
  country?: string;
  insurance_file_url?: string;
  insurance_file_name?: string;
  insurance_expiry?: string;
  coi_file_url?: string;
  coi_file_name?: string;
  coi_expiry?: string;
  notes?: string;
  is_active: boolean;
  created_by?: string;
  created_at: string;
  updated_at: string;
  contact_count?: number;
}

export interface SetHouseClientContact {
  id: string;
  organization_id: string;
  first_name: string;
  last_name: string;
  email?: string;
  phone?: string;
  company?: string;
  job_title?: string;
  address_line1?: string;
  address_line2?: string;
  city?: string;
  state?: string;
  postal_code?: string;
  country?: string;
  notes?: string;
  is_active: boolean;
  created_by?: string;
  created_at: string;
  updated_at: string;
  // Enhanced fields
  client_company_id?: string;
  client_company_name?: string;
  linked_user_id?: string;
  linked_user_name?: string;
  linked_user_email?: string;
  id_photo_url?: string;
  id_photo_file_name?: string;
  id_type?: IDType;
  id_expiry?: string;
  personal_insurance_url?: string;
  personal_insurance_file_name?: string;
  personal_insurance_expiry?: string;
}

export interface CreateClientCompanyInput {
  name: string;
  email?: string;
  phone?: string;
  website?: string;
  address_line1?: string;
  address_line2?: string;
  city?: string;
  state?: string;
  postal_code?: string;
  country?: string;
  notes?: string;
}

export interface CreateClientContactInput {
  first_name: string;
  last_name: string;
  email?: string;
  phone?: string;
  company?: string;
  job_title?: string;
  client_company_id?: string;
  address_line1?: string;
  address_line2?: string;
  city?: string;
  state?: string;
  postal_code?: string;
  country?: string;
  notes?: string;
  id_type?: IDType;
  id_expiry?: string;
}

export interface LinkedProject {
  id: string;
  name: string;
  status: string;
  role?: string;
}

export interface UserSearchResult {
  id: string;
  display_name: string;
  email?: string;
  avatar_url?: string;
}

// ============================================================================
// BOOKING END (CHECK-IN) TYPES
// ============================================================================

export interface BookingEndConditionReport {
  space_id: string;
  condition_grade: SpaceCondition;
  has_damage: boolean;
  damage_tier?: CheckinDamageTier;
  damage_description?: string;
  damage_photo_keys?: string[];
  create_repair_ticket?: boolean;
  notes?: string;
}

export interface MyBookingItem {
  id: string;
  space_id: string;
  space_name: string;
  space_internal_id: string;
  space_type?: SpaceType;
  transaction_id: string;
  booking_start: string;
  booking_end?: string;
  is_overdue: boolean;
  days_overdue: number;
  custodian_name?: string;
  project_name?: string;
}

export interface MyBookingTransaction {
  transaction_id: string;
  transaction_type: TransactionType;
  booking_start: string;
  booking_end?: string;
  is_overdue: boolean;
  days_overdue: number;
  custodian_name?: string;
  project_name?: string;
  items: MyBookingItem[];
}

export interface BookingEndSettings {
  checkin_permission_level: CheckinPermissionLevel;
  booking_end_verification_required: boolean;
  booking_end_verify_method: VerifyMethod;
  booking_end_discrepancy_action: DiscrepancyAction;
  require_condition_on_booking_end: boolean;
  partial_booking_policy: PartialReturnPolicy;
  late_return_auto_incident: boolean;
  late_fee_per_day: number;
  late_grace_period_hours: number;
  notify_on_booking_end: boolean;
  notify_late_return: boolean;
  notify_damage_found: boolean;
}

export interface LateInfo {
  is_late: boolean;
  late_days: number;
  late_fee_amount: number;
  within_grace_period: boolean;
  scheduled_end?: string;
  grace_period_hours: number;
}

export interface BookingEndStartResponse {
  transaction: SetHouseTransaction;
  late_info: LateInfo;
  settings: BookingEndSettings;
  can_complete: boolean;
}

export interface BookingEndReceipt {
  transaction_id: string;
  transaction_type: TransactionType;
  completed_at?: string;
  completed_by_id?: string;
  custodian_name: string;
  items: BookingEndReceiptItem[];
  total_items: number;
  is_overdue: boolean;
  late_days: number;
  late_fee_amount: number;
  incidents: BookingEndReceiptIncident[];
  repairs: BookingEndReceiptRepair[];
  notes?: string;
  project_name?: string;
  organization_id: string;
}

export interface BookingEndReceiptItem {
  space_id: string;
  space_name: string;
  space_type?: SpaceType;
  current_status: SpaceStatus;
  condition_grade?: SpaceCondition;
  has_cosmetic_damage: boolean;
  has_functional_damage: boolean;
  has_structural_damage: boolean;
  condition_notes?: string;
}

export interface BookingEndReceiptIncident {
  id: string;
  incident_type: IncidentType;
  severity: string;
  description?: string;
  space_name: string;
}

export interface BookingEndReceiptRepair {
  id: string;
  status: RepairStatus;
  priority: RepairPriority;
  issue_description?: string;
  space_name: string;
}

// ============================================================================
// MARKETPLACE TYPES
// ============================================================================

export type ListerType = 'studio' | 'location_house' | 'individual';
export type QuoteStatus = 'draft' | 'sent' | 'approved' | 'rejected' | 'expired' | 'cancelled';
export type RentalRequestStatus = 'draft' | 'submitted' | 'quoted' | 'approved' | 'rejected' | 'cancelled' | 'converted';
export type RentalOrderStatus =
  | 'draft'
  | 'confirmed'
  | 'ready'
  | 'in_use'
  | 'completed'
  | 'reconciling'
  | 'closed'
  | 'cancelled'
  | 'disputed';

export interface SetHouseMarketplaceSettings {
  id: string;
  organization_id: string;
  lister_type: ListerType;
  is_marketplace_enabled: boolean;
  marketplace_name?: string;
  marketplace_description?: string;
  marketplace_logo_url?: string;
  marketplace_location?: string;
  marketplace_website?: string;
  is_verified: boolean;
  verified_at?: string;
  successful_bookings_count: number;
  default_deposit_percent: number;
  require_deposit: boolean;
  default_insurance_required: boolean;
  cancellation_policy?: string;
  cancellation_notice_hours?: number;
  cancellation_fee_percent?: number;
  accepts_stripe: boolean;
  accepts_invoice: boolean;
  stripe_account_id?: string;
  contact_email?: string;
  contact_phone?: string;
  created_at: string;
  updated_at: string;
}

export interface SetHouseMarketplaceListing {
  id: string;
  space_id: string;
  organization_id: string;
  is_listed: boolean;
  listed_at?: string;
  delisted_at?: string;
  // Pricing
  daily_rate: number;
  hourly_rate?: number;
  half_day_rate?: number;
  weekly_rate?: number;
  monthly_rate?: number;
  // Booking terms
  deposit_amount?: number;
  deposit_percent?: number;
  insurance_required: boolean;
  min_booking_hours: number;
  max_booking_days?: number;
  advance_booking_days: number;
  blackout_dates?: Array<{ start: string; end: string }>;
  booking_notes?: string;
  access_instructions?: string;
  created_at: string;
  updated_at: string;
  // Joined fields
  space?: SetHouseSpace;
  organization?: {
    id: string;
    name: string;
    is_verified: boolean;
    logo_url?: string;
    marketplace_name?: string;
    lister_type?: ListerType;
    marketplace_location?: string;
    city?: string;
    state?: string;
  };
}

export interface SetHouseMarketplaceSearchFilters {
  q?: string;
  search?: string;
  category_id?: string;
  organization_id?: string;
  space_type?: SpaceType;
  location?: string;
  city?: string;
  state?: string;
  min_price?: number;
  max_price?: number;
  min_square_footage?: number;
  max_square_footage?: number;
  available_from?: string;
  available_to?: string;
  timezone?: string;
  lister_type?: ListerType;
  verified_only?: boolean;
  insurance_required?: boolean;
  limit?: number;
  offset?: number;
}

export interface MarketplaceSearchResponse {
  listings: SetHouseMarketplaceListing[];
  total: number;
  filters_applied: SetHouseMarketplaceSearchFilters;
}

export interface CreateListingInput {
  space_id: string;
  daily_rate: number;
  hourly_rate?: number;
  half_day_rate?: number;
  weekly_rate?: number;
  monthly_rate?: number;
  deposit_amount?: number;
  deposit_percent?: number;
  insurance_required?: boolean;
  min_booking_hours?: number;
  max_booking_days?: number;
  advance_booking_days?: number;
  blackout_dates?: Array<{ start: string; end: string }>;
  booking_notes?: string;
  access_instructions?: string;
}

// ============================================================================
// WORK ORDER TYPES
// ============================================================================

export type WorkOrderStatus = 'draft' | 'in_progress' | 'ready' | 'booked' | 'cancelled';

export interface SetHouseWorkOrder {
  id: string;
  organization_id: string;
  reference_number?: string;
  title: string;
  notes?: string;
  status: WorkOrderStatus;
  // Assignment
  created_by: string;
  created_by_name?: string;
  assigned_to?: string;
  assigned_to_name?: string;
  // Custodian (who uses the space)
  custodian_user_id?: string;
  custodian_user_name?: string;
  custodian_contact_id?: string;
  custodian_contact_name?: string;
  backlot_project_id?: string;
  project_name?: string;
  // Dates
  due_date?: string;
  booking_date?: string;
  booking_start_time?: string;
  booking_end_time?: string;
  // Booking link
  booking_transaction_id?: string;
  booked_at?: string;
  booked_by?: string;
  booked_by_name?: string;
  // Counts
  item_count?: number;
  confirmed_count?: number;
  // Timestamps
  created_at: string;
  updated_at: string;
  // Related data
  items?: SetHouseWorkOrderItem[];
}

export interface SetHouseWorkOrderItem {
  id: string;
  work_order_id: string;
  space_id?: string;
  space_name?: string;
  space_internal_id?: string;
  space_type?: SpaceType;
  package_instance_id?: string;
  package_name?: string;
  package_internal_id?: string;
  is_confirmed: boolean;
  confirmed_at?: string;
  confirmed_by?: string;
  confirmed_by_name?: string;
  notes?: string;
  sort_order: number;
}

export interface SetHouseWorkOrderCounts {
  draft: number;
  in_progress: number;
  ready: number;
  booked: number;
  total: number;
}

export interface CreateWorkOrderInput {
  title: string;
  notes?: string;
  assigned_to?: string;
  custodian_user_id?: string;
  custodian_contact_id?: string;
  backlot_project_id?: string;
  due_date?: string;
  booking_date?: string;
  booking_start_time?: string;
  booking_end_time?: string;
  items?: Array<{
    space_id?: string;
    package_instance_id?: string;
    notes?: string;
  }>;
}

export interface UpdateWorkOrderInput {
  title?: string;
  notes?: string;
  status?: WorkOrderStatus;
  assigned_to?: string;
  custodian_user_id?: string;
  custodian_contact_id?: string;
  backlot_project_id?: string;
  due_date?: string;
  booking_date?: string;
  booking_start_time?: string;
  booking_end_time?: string;
}

// ============================================================================
// CART TYPES
// ============================================================================

export interface SetHouseCartItem {
  id: string;
  profile_id: string;
  listing_id: string;
  organization_id: string;
  backlot_project_id?: string;
  project_title?: string;
  booking_start_date?: string;
  booking_end_date?: string;
  booking_start_time?: string;
  booking_end_time?: string;
  created_at: string;
  updated_at: string;
  // Listing details (joined)
  listing: {
    id: string;
    daily_rate: number;
    hourly_rate?: number;
    is_listed: boolean;
    space: {
      id: string;
      name: string;
      space_type?: SpaceType;
      square_footage?: number;
      photos?: string[];
    };
  };
}

export interface SetHouseCartGrouped {
  organization: MarketplaceOrganizationEnriched;
  items: SetHouseCartItem[];
  total_daily_rate: number;
}

export interface SetHouseCartResponse {
  groups: SetHouseCartGrouped[];
  total_items: number;
}

export interface CartItemAddInput {
  listing_id: string;
  organization_id: string;
  backlot_project_id?: string;
  booking_start_date?: string;
  booking_end_date?: string;
  booking_start_time?: string;
  booking_end_time?: string;
}

export interface CartItemUpdateInput {
  booking_start_date?: string;
  booking_end_date?: string;
  booking_start_time?: string;
  booking_end_time?: string;
  backlot_project_id?: string;
}

// ============================================================================
// WORK ORDER REQUEST TYPES
// ============================================================================

export type WorkOrderRequestStatus = 'pending' | 'approved' | 'rejected';

export interface SetHouseWorkOrderRequest {
  id: string;
  reference_number: string;
  // Parties
  requesting_profile_id: string;
  requesting_org_id?: string;
  set_house_org_id: string;
  backlot_project_id?: string;
  // Request details
  title?: string;
  notes?: string;
  booking_start_date?: string;
  booking_end_date?: string;
  // Status
  status: WorkOrderRequestStatus;
  // Review info
  reviewed_by?: string;
  reviewed_at?: string;
  rejection_reason?: string;
  // Created work order (on approval)
  created_work_order_id?: string;
  // Timestamps
  created_at: string;
  updated_at: string;
  // Joined fields
  requester_name?: string;
  requester_avatar?: string;
  requester_org_name?: string;
  set_house_name?: string;
  set_house_marketplace_name?: string;
  set_house_logo?: string;
  reviewer_name?: string;
  project_title?: string;
  work_order_reference?: string;
  item_count?: number;
  total_daily_rate?: number;
  items?: SetHouseWorkOrderRequestItem[];
}

export interface SetHouseWorkOrderRequestItem {
  id: string;
  request_id: string;
  listing_id: string;
  space_id?: string;
  daily_rate?: number;
  created_at: string;
  // Joined fields
  listing_notes?: string;
  space_name?: string;
  space_type?: SpaceType;
  square_footage?: number;
  space_status?: SpaceStatus;
  space_notes?: string;
  space_photos?: string[];
  category_name?: string;
}

export interface WorkOrderRequestsResponse {
  requests: SetHouseWorkOrderRequest[];
  total: number;
  limit: number;
  offset: number;
}

export interface WorkOrderRequestCounts {
  pending: number;
  approved: number;
  rejected: number;
  total: number;
}

// ============================================================================
// MARKETPLACE LOCATION-BASED SEARCH TYPES
// ============================================================================

export type LocationSource = 'browser' | 'profile' | 'manual';
export type ViewMode = 'map' | 'grid' | 'list';
export type ResultMode = 'set_houses' | 'spaces';
export type RadiusMiles = 25 | 50 | 100 | 250;

export interface MarketplaceSearchPreferences {
  id?: string;
  project_id: string;
  profile_id?: string;
  search_latitude?: number;
  search_longitude?: number;
  search_location_name?: string;
  location_source: LocationSource;
  search_radius_miles: RadiusMiles;
  view_mode: ViewMode;
  result_mode: ResultMode;
  created_at?: string;
  updated_at?: string;
}

export interface SetHouseTopCategory {
  id: string;
  name: string;
  count: number;
}

export interface SetHouseFeaturedSpace {
  id: string;
  space_id: string;
  name: string;
  daily_rate?: number;
  photo_url?: string;
  space_type?: SpaceType;
  square_footage?: number;
}

export interface MarketplaceOrganizationEnriched {
  id: string;
  name: string;
  marketplace_name?: string;
  marketplace_description?: string;
  marketplace_logo_url?: string;
  location_display?: string;
  city?: string;
  state?: string;
  location_latitude?: number;
  location_longitude?: number;
  lister_type?: ListerType;
  is_verified?: boolean;
  contact_email?: string;
  contact_phone?: string;
  // Enriched fields from nearby search
  distance_miles?: number;
  top_categories?: SetHouseTopCategory[];
  featured_spaces?: SetHouseFeaturedSpace[];
  is_favorited?: boolean;
  listing_count?: number;
  min_daily_rate?: number;
}

export interface MarketplaceNearbySearchParams {
  lat: number;
  lng: number;
  radius_miles?: RadiusMiles;
  result_mode?: ResultMode;
  q?: string;
  category_id?: string;
  space_type?: SpaceType;
  lister_type?: ListerType;
  verified_only?: boolean;
  available_from?: string;
  available_to?: string;
  timezone?: string;
  limit?: number;
  offset?: number;
}

export interface MarketplaceSetHousesResponse {
  set_houses: MarketplaceOrganizationEnriched[];
  total: number;
  user_location: { lat: number; lng: number };
  radius_miles: number;
}

export interface MarketplaceListingWithDistance extends SetHouseMarketplaceListing {
  distance_miles?: number;
  location_display?: string;
}

export interface MarketplaceListingsNearbyResponse {
  listings: MarketplaceListingWithDistance[];
  total: number;
  user_location: { lat: number; lng: number };
  radius_miles: number;
}

export interface UserLocation {
  latitude: number;
  longitude: number;
  name?: string;
  source: LocationSource;
}

// ============================================================================
// INCIDENT DETAIL TYPES
// ============================================================================

export interface SpaceCustodianHistory {
  user_id: string;
  user_name: string;
  booking_start: string;
  booking_end?: string;
  transaction_id: string;
  end_condition?: string;
  end_notes?: string;
  is_recommended: boolean;
}

export interface IncidentSpaceInfo {
  id: string;
  name?: string;
  internal_id?: string;
  category_name?: string;
  square_footage?: number;
  status?: string;
}

export interface IncidentDetailResponse {
  incident: SetHouseIncident;
  space: IncidentSpaceInfo | null;
  transactions: SpaceCustodianHistory[];
  repairs: SetHouseRepairTicket[];
  strikes: SetHouseStrike[];
  recommended_custodian: SpaceCustodianHistory | null;
}

export interface IncidentCustodiansResponse {
  custodians: SpaceCustodianHistory[];
  recommended: SpaceCustodianHistory | null;
}

// ============================================================================
// EXTERNAL PLATFORM TYPES
// ============================================================================

export type ExternalPlatformType =
  | 'peerspace'
  | 'giggster'
  | 'splacer'
  | 'spacetoco'
  | 'ical'
  | 'csv'
  | 'manual';

export type SyncStatus = 'pending' | 'syncing' | 'success' | 'error';

export interface ExternalPlatform {
  id: string;
  organization_id: string;
  platform_type: ExternalPlatformType;
  platform_name: string;
  ical_url?: string;
  default_space_id?: string;
  default_space_name?: string;
  default_space_internal_id?: string;
  space_name_mapping?: Record<string, string>;
  sync_frequency_minutes: number;
  auto_create_transactions: boolean;
  is_active: boolean;
  last_sync_at?: string;
  last_sync_status: SyncStatus;
  last_sync_error?: string;
  last_sync_bookings_found?: number;
  last_sync_bookings_created?: number;
  last_sync_bookings_updated?: number;
  next_sync_at?: string;
  notes?: string;
  created_at: string;
  updated_at: string;
  created_by?: string;
}

export interface ExternalPlatformSyncStats {
  total_syncs: number;
  successful_syncs: number;
  total_created: number;
  total_updated: number;
}

export interface ExternalSyncLog {
  id: string;
  platform_id: string;
  organization_id: string;
  sync_type: 'auto' | 'manual' | 'ical' | 'csv';
  status: 'started' | 'completed' | 'failed' | 'completed_with_errors';
  bookings_found: number;
  bookings_created: number;
  bookings_updated: number;
  bookings_skipped: number;
  bookings_errors: number;
  error_message?: string;
  error_details?: Record<string, unknown>;
  sync_details?: Array<{
    external_id: string;
    action: 'created' | 'updated' | 'skipped' | 'error';
    error?: string;
    transaction_id?: string;
    reason?: string;
  }>;
  started_at: string;
  completed_at?: string;
  duration_ms?: number;
  triggered_by?: string;
  triggered_by_name?: string;
}

export interface ExternalBooking {
  id: string;
  organization_id: string;
  transaction_type: TransactionType;
  status: TransactionStatus;
  scheduled_start?: string;
  scheduled_end?: string;
  notes?: string;
  external_platform_id: string;
  external_booking_id?: string;
  external_booking_url?: string;
  external_event_uid?: string;
  external_metadata?: Record<string, unknown>;
  is_external_booking: boolean;
  platform_type?: ExternalPlatformType;
  platform_name?: string;
  space_name?: string;
  space_internal_id?: string;
  client_name?: string;
  client_email?: string;
  created_at: string;
  updated_at: string;
}

export interface ICalPreviewEvent {
  uid: string;
  summary: string;
  start?: string;
  end?: string;
  location?: string;
  description?: string;
  already_imported?: boolean;
}

export interface ICalValidationResult {
  valid: boolean;
  error?: string;
  events_count: number;
  preview_events: ICalPreviewEvent[];
}

export interface CSVColumnMapping {
  external_booking_id?: string;
  platform?: string;
  space_name?: string;
  client_name?: string;
  client_email?: string;
  client_phone?: string;
  start_date?: string;
  end_date?: string;
  start_time?: string;
  end_time?: string;
  total_amount?: string;
  status?: string;
  notes?: string;
}

export interface CSVUploadResult {
  columns: string[];
  row_count: number;
  preview_rows: Array<Record<string, string>>;
  auto_mapping: CSVColumnMapping;
}

export interface CSVImportResult {
  total_rows: number;
  imported: number;
  skipped: number;
  errors: number;
  error_details: Array<{
    row: number;
    error: string;
    data?: Record<string, string>;
  }>;
  created_transactions: Array<{
    id: string;
    external_id: string;
    row: number;
  }>;
}

export interface CSVTemplate {
  id: string;
  organization_id: string;
  name: string;
  description?: string;
  column_mappings: Record<string, string>;
  date_format: string;
  time_format: string;
  timezone: string;
  delimiter: string;
  has_header_row: boolean;
  skip_rows: number;
  is_default: boolean;
  created_at: string;
  updated_at: string;
  created_by?: string;
}

// API Input Types

export interface CreateExternalPlatformInput {
  platform_type: ExternalPlatformType;
  platform_name: string;
  ical_url?: string;
  default_space_id?: string;
  space_name_mapping?: Record<string, string>;
  sync_frequency_minutes?: number;
  auto_create_transactions?: boolean;
  notes?: string;
}

export interface UpdateExternalPlatformInput {
  platform_name?: string;
  ical_url?: string;
  default_space_id?: string;
  space_name_mapping?: Record<string, string>;
  sync_frequency_minutes?: number;
  auto_create_transactions?: boolean;
  is_active?: boolean;
  notes?: string;
}

export interface CSVImportInput {
  column_mapping: CSVColumnMapping;
  rows: Array<Record<string, string>>;
  default_space_id?: string;
  skip_duplicates?: boolean;
}

export interface CreateCSVTemplateInput {
  name: string;
  description?: string;
  column_mappings: Record<string, string>;
  date_format?: string;
  time_format?: string;
  timezone?: string;
  delimiter?: string;
  has_header_row?: boolean;
  skip_rows?: number;
  is_default?: boolean;
}

// API Response Types

export interface ExternalPlatformsResponse {
  platforms: ExternalPlatform[];
  total: number;
  limit: number;
  offset: number;
}

export interface ExternalPlatformDetailResponse {
  platform: ExternalPlatform;
  sync_stats: ExternalPlatformSyncStats;
}

export interface ExternalSyncLogsResponse {
  logs: ExternalSyncLog[];
  total: number;
  limit: number;
  offset: number;
}

export interface ExternalBookingsResponse {
  bookings: ExternalBooking[];
  total: number;
  limit: number;
  offset: number;
}

export interface ICalPreviewResponse {
  total_events: number;
  preview_events: ICalPreviewEvent[];
  already_imported_count: number;
}

export interface CSVTemplatesResponse {
  templates: CSVTemplate[];
}

export interface SyncTriggerResult {
  success: boolean;
  sync_log_id: string;
  bookings_found?: number;
  bookings_created?: number;
  bookings_updated?: number;
  bookings_skipped?: number;
  bookings_errors?: number;
  error?: string;
}
