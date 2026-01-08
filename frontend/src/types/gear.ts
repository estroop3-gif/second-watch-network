/**
 * Gear House TypeScript Types
 * Equipment management system types
 */

// ============================================================================
// ENUMS
// ============================================================================

export type OrganizationType = 'production_company' | 'rental_house' | 'hybrid' | 'studio' | 'agency' | 'other';

export type OrganizationMemberRole = 'owner' | 'admin' | 'manager' | 'member';

export type AssetType = 'serialized' | 'consumable' | 'expendable' | 'component';

export type AssetStatus =
  | 'available'
  | 'reserved'
  | 'checked_out'
  | 'in_transit'
  | 'quarantined'
  | 'under_repair'
  | 'retired'
  | 'lost';

export type AssetCondition = 'excellent' | 'good' | 'fair' | 'poor' | 'non_functional';

export type TransactionType =
  | 'internal_checkout'
  | 'internal_checkin'
  | 'transfer'
  | 'rental_reservation'
  | 'rental_pickup'
  | 'rental_return'
  | 'write_off'
  | 'maintenance_send'
  | 'maintenance_return'
  | 'inventory_adjustment'
  | 'initial_intake';

export type TransactionStatus = 'draft' | 'pending' | 'in_progress' | 'checked_out' | 'completed' | 'cancelled';

export type IncidentType =
  | 'damage'
  | 'missing_item'
  | 'late_return'
  | 'policy_violation'
  | 'unsafe_behavior';

export type IncidentStatus = 'open' | 'investigating' | 'resolved' | 'escalated' | 'closed';

export type DamageTier = 'cosmetic' | 'functional' | 'unsafe' | 'out_of_service';

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

export type ScanMode = 'none' | 'case_only' | 'case_plus_items' | 'all_items';

export type BarcodeFormat = 'CODE128' | 'CODE39' | 'EAN13' | 'EAN8' | 'UPC';

// Check-in permission and policy types
export type CheckinPermissionLevel = 'anyone' | 'custodian_only' | 'custodian_and_admins';
export type PartialReturnPolicy = 'allow' | 'warn' | 'block';
export type CheckinDamageTier = 'cosmetic' | 'functional' | 'unsafe';

// Work order staging verification method
export type WorkOrderStagingVerifyMethod = 'checkoff_only' | 'barcode_required' | 'qr_required' | 'scan_or_checkoff';

// Label printing types
export type LabelSize = '2x1' | '1.5x0.5' | '3x2' | 'custom';
export type PrintMode = 'sheet' | 'roll';
export type PrinterType = 'generic' | 'zebra' | 'dymo' | 'brother';
export type CodeType = 'barcode' | 'qr' | 'both';

export interface LabelBatchOptions {
  asset_ids: string[];
  label_type: CodeType;
  include_name: boolean;
  include_category: boolean;
  label_size: LabelSize;
  print_mode: PrintMode;
  printer_type: PrinterType;
  sheet_rows?: number;
  sheet_columns?: number;
  custom_width_mm?: number;
  custom_height_mm?: number;
}

// ============================================================================
// ORGANIZATION TYPES
// ============================================================================

export interface GearOrganization {
  id: string;
  name: string;
  slug?: string;
  org_type?: OrganizationType;
  description?: string;
  logo_url?: string;
  website_url?: string;
  status?: string;
  created_by?: string;
  created_at: string;
  updated_at: string;
  // Joined from organization_members
  role?: string;
}

export interface GearOrganizationMember {
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

// Verification type enums
export type VerifyMethod = 'scan_only' | 'scan_or_checkoff';
export type DiscrepancyAction = 'block' | 'warn';
export type KitVerificationMode = 'kit_only' | 'verify_contents';
export type ReceiverVerificationMode = 'none' | 'signature' | 'scan' | 'signature_and_scan';
export type ReceiverVerificationTiming = 'same_session' | 'async_link' | 'both';
export type VerificationStatus = 'pending' | 'in_progress' | 'completed' | 'expired' | 'cancelled';
export type VerificationType = 'sender_verification' | 'receiver_verification' | 'checkin_verification';
export type ItemVerificationStatus = 'pending' | 'verified' | 'discrepancy';

export interface GearOrganizationSettings {
  id: string;
  organization_id: string;
  default_checkout_duration_days: number;
  require_photos_on_intake?: boolean;
  require_photos_on_checkout?: boolean;
  require_photos_on_checkin?: boolean;
  require_photos_on_damage?: boolean;
  auto_generate_barcodes: boolean;
  barcode_format: BarcodeFormat;
  barcode_prefix?: string;
  enable_strikes: boolean;
  strikes_before_suspension: number;
  enable_auto_strikes: boolean;
  rental_late_fee_per_day?: number;
  rental_damage_deposit_percent?: number;
  // Team checkout verification settings
  team_checkout_verification_required?: boolean;
  team_checkout_verify_method?: VerifyMethod;
  team_checkout_discrepancy_action?: DiscrepancyAction;
  team_checkout_kit_verification?: KitVerificationMode;
  // Client checkout verification settings
  client_checkout_verification_required?: boolean;
  client_checkout_verify_method?: VerifyMethod;
  client_checkout_discrepancy_action?: DiscrepancyAction;
  client_checkout_kit_verification?: KitVerificationMode;
  // Receiver verification settings
  receiver_verification_mode?: ReceiverVerificationMode;
  receiver_verification_timing?: ReceiverVerificationTiming;
  // Check-in verification settings
  checkin_verification_required?: boolean;
  checkin_verify_method?: VerifyMethod;
  checkin_kit_verification?: KitVerificationMode;
  checkin_discrepancy_action?: DiscrepancyAction;
  // Equipment package verification settings
  team_checkout_package_verification?: KitVerificationMode;
  client_checkout_package_verification?: KitVerificationMode;
  checkin_package_verification?: KitVerificationMode;

  // Check-in permissions & policies
  checkin_permission_level?: CheckinPermissionLevel;
  require_condition_on_checkin?: boolean;
  partial_return_policy?: PartialReturnPolicy;

  // Late/overdue settings
  late_return_auto_incident?: boolean;
  late_fee_per_day?: number;
  late_grace_period_hours?: number;

  // Check-in notifications
  notify_on_checkin?: boolean;
  notify_late_return?: boolean;
  notify_damage_found?: boolean;

  // Work order staging settings
  work_order_staging_verify_method?: WorkOrderStagingVerifyMethod;
  work_order_auto_ready?: boolean;
}

// Verification session types
export interface VerificationItem {
  id: string;
  type: 'asset' | 'kit';
  name: string;
  internal_id: string;
  parent_kit_id?: string;
  parent_kit_name?: string;
  // Equipment package tracking
  parent_package_id?: string;
  parent_package_name?: string;
  is_package_parent?: boolean;  // True if this item is an equipment package
  required: boolean;
  status: ItemVerificationStatus;
  verified_at?: string;
  verified_by?: string;
  method?: 'scan' | 'checkoff';
}

export interface VerificationDiscrepancy {
  item_id: string;
  issue_type: 'missing' | 'wrong_item' | 'damaged' | 'other';
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

export interface GearCategory {
  id: string;
  organization_id: string;
  name: string;
  description?: string;
  parent_category_id?: string;
  icon?: string;
  color?: string;
  default_checkout_duration_days?: number;
  requires_certification: boolean;
  is_active: boolean;
  sort_order: number;
}

export type LocationType = 'warehouse' | 'stage' | 'vehicle' | 'client_site' | 'other';

export interface GearLocation {
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
  is_default_home?: boolean;
  is_active: boolean;
  // Metadata
  created_at?: string;
  updated_at?: string;
}

// ============================================================================
// ASSET TYPES
// ============================================================================

export interface GearAsset {
  id: string;
  organization_id: string;
  category_id?: string;
  category_name?: string;
  name: string;
  description?: string;
  asset_type: AssetType;
  status: AssetStatus;
  current_condition?: AssetCondition;
  manufacturer?: string;
  model?: string;
  serial_number?: string;
  internal_id: string;
  barcode?: string;
  qr_code?: string;
  primary_scan_code?: string;
  // Purchase & Value
  purchase_date?: string;
  purchase_price?: number;
  current_value?: number;
  replacement_cost?: number;
  insured_value?: number;
  // Rental Rates
  daily_rate?: number;
  weekly_rate?: number;
  monthly_rate?: number;
  // Location & Custody
  current_location_id?: string;
  current_location_name?: string;
  current_custodian_user_id?: string;
  current_custodian_name?: string;
  home_location_id?: string;
  // Physical
  weight_kg?: number;
  dimensions?: Record<string, unknown>;
  power_requirements?: string;
  accessories?: string[];
  notes?: string;
  photos?: string[];
  // Maintenance
  insurance_policy_number?: string;
  last_maintenance_date?: string;
  next_maintenance_date?: string;
  // Equipment Package (Accessories)
  parent_asset_id?: string;
  parent_asset_name?: string;
  is_equipment_package: boolean;
  accessory_count?: number;
  accessories?: GearAsset[];
  // Status
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface GearAssetHistory {
  id: string;
  asset_id: string;
  event_type: string;
  event_data: Record<string, unknown>;
  performed_by_user_id?: string;
  performed_by_name?: string;
  created_at: string;
}

// ============================================================================
// KIT TYPES
// ============================================================================

export interface GearKitTemplate {
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
  items?: GearKitTemplateItem[];
}

export interface GearKitTemplateItem {
  id: string;
  template_id: string;
  category_id?: string;
  category_name?: string;
  specific_asset_id?: string;
  specific_asset_name?: string;
  description?: string;
  quantity: number;
  is_required: boolean;
  sort_order: number;
  // Nested template support (for sub-kit templates)
  nested_template_id?: string;
  nested_template_name?: string;
}

export interface GearKitInstance {
  id: string;
  organization_id: string;
  template_id?: string;
  template_name?: string;
  name: string;
  internal_id: string;
  barcode?: string;
  qr_code?: string;
  primary_scan_code?: string;
  status: AssetStatus;
  current_location_id?: string;
  current_location_name?: string;
  current_custodian_user_id?: string;
  current_custodian_name?: string;
  notes?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  contents?: GearKitMembership[];
}

export interface GearKitMembership {
  id: string;
  kit_instance_id: string;
  asset_id?: string;
  asset_name?: string;
  asset_internal_id?: string;
  asset_status?: AssetStatus;
  added_at: string;
  added_by_user_id?: string;
  is_present: boolean;
  slot_name?: string;
  slot_number?: number;
  // Nested kit support (for sub-kits within kits)
  nested_kit_id?: string;
  nested_kit_name?: string;
  nested_kit_internal_id?: string;
  nested_kit_status?: AssetStatus;
  nested_kit_contents?: GearKitMembership[];
}

// ============================================================================
// TRANSACTION TYPES
// ============================================================================

export interface GearTransaction {
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
  secondary_custodian_user_id?: string;
  secondary_custodian_name?: string;

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

  // Locations
  source_location_id?: string;
  source_location_name?: string;
  destination_location_id?: string;
  destination_location_name?: string;
  destination_name?: string;
  destination_address?: Record<string, unknown>;

  // Timing
  scheduled_at?: string;
  checked_out_at?: string;
  expected_return_at?: string;
  returned_at?: string;
  initiated_at?: string;
  packed_at?: string;
  handed_off_at?: string;
  accepted_at?: string;
  reconciled_at?: string;

  // Verification
  sender_verification_required?: boolean;
  sender_verification_completed_at?: string;
  receiver_verification_required?: boolean;
  receiver_verification_mode?: string;
  receiver_verification_completed_at?: string;
  checkin_verification_required?: boolean;
  checkin_verification_completed_at?: string;

  // Signatures
  initiator_signature_url?: string;
  custodian_signature_url?: string;

  // Scan tracking
  scan_mode_required: ScanMode;
  all_items_scanned_out: boolean;
  all_items_scanned_in: boolean;

  // Notes & metadata
  notes?: string;
  created_at: string;
  updated_at: string;

  // Related data
  items?: GearTransactionItem[];
  item_count?: number;
  condition_reports?: TransactionConditionReportItem[];
}

export interface GearTransactionItem {
  id: string;
  transaction_id: string;
  asset_id?: string;
  asset_name?: string;
  asset_internal_id?: string;
  serial_number?: string;
  make?: string;
  model?: string;
  barcode?: string;
  category_name?: string;
  kit_instance_id?: string;
  kit_name?: string;
  kit_internal_id?: string;
  quantity: number;
  scanned_out_at?: string;
  scanned_out_by_user_id?: string;
  scanned_out_by_name?: string;
  scanned_in_at?: string;
  scanned_in_by_user_id?: string;
  scanned_in_by_name?: string;
  condition_at_checkout?: AssetCondition;
  condition_at_checkin?: AssetCondition;
  condition_out?: AssetCondition;
  condition_in?: AssetCondition;
  notes?: string;
}

export interface TransactionConditionReportItem {
  id: string;
  checkpoint_type: string;
  reported_at: string;
  report_notes?: string;
  asset_id: string;
  condition_grade: AssetCondition;
  notes?: string;
  photos?: string[];
  has_cosmetic_damage: boolean;
  has_functional_damage: boolean;
  is_unsafe: boolean;
  reported_by_name?: string;
}

// ============================================================================
// CONDITION REPORT TYPES
// ============================================================================

export interface GearConditionReport {
  id: string;
  organization_id: string;
  transaction_id?: string;
  asset_id?: string;
  kit_instance_id?: string;
  checkpoint_type: string;
  reported_by_user_id: string;
  reported_by_name?: string;
  overall_notes?: string;
  scan_mode_used?: ScanMode;
  photos_captured: boolean;
  created_at: string;
  items?: GearConditionReportItem[];
}

export interface GearConditionReportItem {
  id: string;
  report_id: string;
  asset_id: string;
  asset_name?: string;
  condition_grade: AssetCondition;
  notes?: string;
  has_cosmetic_damage: boolean;
  has_functional_damage: boolean;
  is_unsafe: boolean;
  photos?: string[];
}

// ============================================================================
// INCIDENT TYPES
// ============================================================================

export interface GearIncident {
  id: string;
  organization_id: string;
  incident_type: IncidentType;
  status: IncidentStatus;
  asset_id?: string;
  asset_name?: string;
  kit_instance_id?: string;
  transaction_id?: string;
  reported_by_user_id: string;
  reported_by_name?: string;
  reported_at: string;
  assigned_to_user_id?: string;
  assigned_to_name?: string;
  damage_tier?: DamageTier;
  damage_description?: string;
  photos?: string[];
  notes?: string;
  estimated_cost?: number;
  actual_cost?: number;
  resolution_notes?: string;
  resolved_by_user_id?: string;
  resolved_at?: string;
  created_at: string;
  updated_at: string;
}

// ============================================================================
// REPAIR TYPES
// ============================================================================

export interface GearRepairTicket {
  id: string;
  organization_id: string;
  asset_id: string;
  asset_name?: string;
  asset_internal_id?: string;
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

export interface GearVendor {
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

export interface GearStrike {
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

export interface GearUserEscalationStatus {
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

export interface GearStrikeRule {
  id: string;
  organization_id: string;
  trigger_type: string;
  trigger_damage_tier?: DamageTier;
  trigger_incident_type?: IncidentType;
  strike_severity: StrikeSeverity;
  strike_points: number;
  is_auto_applied: boolean;
  requires_review: boolean;
  description?: string;
  is_active: boolean;
}

// ============================================================================
// LABEL TYPES
// ============================================================================

export interface LabelBatchRequest {
  asset_ids: string[];
  label_type: 'barcode' | 'qr' | 'both';
  include_name: boolean;
  include_category: boolean;
}

// ============================================================================
// API RESPONSE TYPES
// ============================================================================

export interface GearOrganizationsResponse {
  organizations: GearOrganization[];
}

export interface GearAssetsResponse {
  assets: GearAsset[];
  total?: number;
}

export interface GearAssetStatsResponse {
  total: number;
  by_status: Record<AssetStatus, number>;
  by_condition: Record<AssetCondition, number>;
  total_value: number;
}

export interface GearTransactionsResponse {
  transactions: GearTransaction[];
  total?: number;
}

export interface GearIncidentsResponse {
  incidents: GearIncident[];
  total?: number;
}

export interface GearRepairTicketsResponse {
  tickets: GearRepairTicket[];
  total?: number;
}

export interface GearStrikesResponse {
  strikes: GearStrike[];
}

// ============================================================================
// FORM INPUT TYPES
// ============================================================================

export interface CreateOrganizationInput {
  name: string;
  org_type?: OrganizationType;
  description?: string;
  website?: string;
}

export interface CreateAssetInput {
  name: string;
  category_id?: string;
  asset_type: AssetType;
  description?: string;
  manufacturer?: string;
  model?: string;
  serial_number?: string;
  // Pricing & Value
  purchase_price?: number;
  replacement_cost?: number;
  daily_rate?: number;
  weekly_rate?: number;
  monthly_rate?: number;
  // Location
  home_location_id?: string;
  notes?: string;
}

export interface CreateTransactionInput {
  transaction_type: TransactionType;
  items: Array<{
    asset_id?: string;
    kit_instance_id?: string;
    quantity?: number;
    notes?: string;
  }>;
  primary_custodian_user_id?: string;
  backlot_project_id?: string;
  destination_location_id?: string;
  expected_return_at?: string;
  scan_mode_required?: ScanMode;
  notes?: string;
}

export interface CreateIncidentInput {
  incident_type: IncidentType;
  asset_id?: string;
  kit_instance_id?: string;
  transaction_id?: string;
  damage_tier?: DamageTier;
  damage_description?: string;
  photos?: string[];
  notes?: string;
}

export interface CreateRepairTicketInput {
  asset_id: string;
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

export interface GearClientCompany {
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

export interface GearClientContact {
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
// LABEL TEMPLATE TYPES
// ============================================================================

export interface GearLabelTemplate {
  id: string;
  organization_id: string;
  user_id?: string | null;  // null = org-level template
  name: string;
  description?: string;
  is_default: boolean;

  // Print settings
  label_size: LabelSize;
  print_mode: PrintMode;
  printer_type: PrinterType;
  code_type: CodeType;
  sheet_rows: number;
  sheet_columns: number;
  custom_width_mm?: number;
  custom_height_mm?: number;

  // Content settings
  include_name: boolean;
  include_category: boolean;
  include_internal_id: boolean;
  include_serial_number: boolean;
  include_manufacturer: boolean;
  include_model: boolean;
  include_purchase_date: boolean;
  include_logo: boolean;
  custom_logo_url?: string;
  color_coding_enabled: boolean;

  // Kit settings
  kit_include_contents: boolean;
  kit_contents_max_items: number;

  created_at: string;
  updated_at: string;
}

export interface CreateLabelTemplateInput {
  name: string;
  description?: string;
  is_default?: boolean;
  label_size?: LabelSize;
  print_mode?: PrintMode;
  printer_type?: PrinterType;
  code_type?: CodeType;
  sheet_rows?: number;
  sheet_columns?: number;
  custom_width_mm?: number;
  custom_height_mm?: number;
  include_name?: boolean;
  include_category?: boolean;
  include_internal_id?: boolean;
  include_serial_number?: boolean;
  include_manufacturer?: boolean;
  include_model?: boolean;
  include_purchase_date?: boolean;
  include_logo?: boolean;
  custom_logo_url?: string;
  color_coding_enabled?: boolean;
  kit_include_contents?: boolean;
  kit_contents_max_items?: number;
  is_org_template?: boolean;
}

// ============================================================================
// PRINT QUEUE TYPES
// ============================================================================

export interface GearPrintQueueItem {
  id: string;
  organization_id: string;
  user_id: string;
  asset_id?: string;
  kit_id?: string;
  quantity: number;
  template_id?: string;
  include_kit_contents: boolean;
  added_at: string;

  // Joined fields
  asset_name?: string;
  asset_internal_id?: string;
  asset_barcode?: string;
  asset_qr_code?: string;
  asset_category_id?: string;
  asset_category_name?: string;
  kit_name?: string;
  kit_internal_id?: string;
  kit_barcode?: string;
  kit_qr_code?: string;
  template_name?: string;
}

export interface AddToPrintQueueInput {
  asset_ids?: string[];
  kit_ids?: string[];
  quantity?: number;
  template_id?: string;
  include_kit_contents?: boolean;
}

export interface GearPrintQueueResponse {
  queue: GearPrintQueueItem[];
  count: number;
}

// ============================================================================
// PRINT HISTORY TYPES
// ============================================================================

export interface GearPrintHistoryEntry {
  id: string;
  organization_id: string;
  user_id: string;
  asset_id?: string;
  kit_id?: string;
  item_name: string;
  item_internal_id?: string;
  item_type: 'asset' | 'kit';
  item_category?: string;
  template_id?: string;
  template_name?: string;
  label_size: string;
  print_mode: string;
  printer_type: string;
  code_type: string;
  quantity: number;
  included_kit_contents: boolean;
  barcode_generated?: string;
  qr_code_generated?: string;
  printed_at: string;

  // Joined fields
  printed_by_name?: string;
  printed_by_avatar?: string;
}

export interface GearPrintHistoryStats {
  total_prints: number;
  total_labels: number;
  unique_assets_printed: number;
  unique_kits_printed: number;
  this_month: {
    prints: number;
    labels: number;
  };
  most_printed_assets: Array<{
    id: string;
    name: string;
    internal_id: string;
    print_count: number;
    label_count: number;
  }>;
  most_printed_kits: Array<{
    id: string;
    name: string;
    internal_id: string;
    print_count: number;
    label_count: number;
  }>;
  prints_by_user: Array<{
    user_id: string;
    name: string;
    print_count: number;
    label_count: number;
  }>;
  prints_by_day: Array<{
    date: string;
    print_count: number;
    label_count: number;
  }>;
}

export interface GearPrintHistoryResponse {
  history: GearPrintHistoryEntry[];
  total: number;
  limit: number;
  offset: number;
}

export interface GearLabelTemplatesResponse {
  templates: GearLabelTemplate[];
}

// ============================================================================
// CHECK-IN TYPES
// ============================================================================

export interface CheckinConditionReport {
  asset_id: string;
  condition_grade: AssetCondition;
  has_damage: boolean;
  damage_tier?: CheckinDamageTier;
  damage_description?: string;
  damage_photo_keys?: string[];  // S3 keys for damage photos
  notes?: string;
}

export interface MyCheckoutItem {
  id: string;
  asset_id: string;
  asset_name: string;
  asset_internal_id: string;
  barcode?: string;
  category_name?: string;
  transaction_id: string;
  checkout_date: string;
  expected_return_date?: string;
  is_overdue: boolean;
  days_overdue: number;
  custodian_name?: string;
  project_name?: string;
}

export interface MyCheckoutTransaction {
  transaction_id: string;
  transaction_type: TransactionType;
  checkout_date: string;
  expected_return_date?: string;
  is_overdue: boolean;
  days_overdue: number;
  custodian_name?: string;
  project_name?: string;
  items: MyCheckoutItem[];
}

export interface CheckinSettings {
  checkin_permission_level: CheckinPermissionLevel;
  checkin_verification_required: boolean;
  checkin_verify_method: VerifyMethod;
  checkin_kit_verification: KitVerificationMode;
  checkin_discrepancy_action: DiscrepancyAction;
  require_condition_on_checkin: boolean;
  partial_return_policy: PartialReturnPolicy;
  late_return_auto_incident: boolean;
  late_fee_per_day: number;
  late_grace_period_hours: number;
  notify_on_checkin: boolean;
  notify_late_return: boolean;
  notify_damage_found: boolean;
}

export interface LateInfo {
  is_late: boolean;
  late_days: number;
  late_fee_amount: number;
  within_grace_period: boolean;
  expected_return_at?: string;
  grace_period_hours: number;
}

export interface CheckinStartResponse {
  transaction: GearTransaction;
  late_info: LateInfo;
  settings: CheckinSettings;
  can_checkin: boolean;
}

export interface DamageReportResult {
  success: boolean;
  incident_id?: string;
  repair_ticket_id?: string;
  asset_status: AssetStatus;
  message?: string;
}

export interface CheckinReceiptItem {
  asset_id: string;
  asset_name: string;
  barcode?: string;
  current_status: AssetStatus;
  scanned_in_at?: string;
  condition_grade?: AssetCondition;
  has_cosmetic_damage: boolean;
  has_functional_damage: boolean;
  is_unsafe: boolean;
  condition_notes?: string;
}

export interface CheckinReceiptIncident {
  id: string;
  incident_type: IncidentType;
  severity: string;
  description?: string;
  asset_name: string;
}

export interface CheckinReceiptRepair {
  id: string;
  status: RepairStatus;
  priority: RepairPriority;
  issue_description?: string;
  asset_name: string;
}

export interface CheckinReceipt {
  transaction_id: string;
  transaction_type: TransactionType;
  returned_at?: string;
  returned_by_id?: string;
  custodian_name: string;
  items: CheckinReceiptItem[];
  total_items: number;
  is_overdue: boolean;
  late_days: number;
  late_fee_amount: number;
  partial_return: boolean;
  items_not_returned: number;
  incidents: CheckinReceiptIncident[];
  repairs: CheckinReceiptRepair[];
  notes?: string;
  project_name?: string;
  organization_id: string;
}

export interface CheckinCompleteRequest {
  items_to_return: string[];
  condition_reports: CheckinConditionReport[];
  checkin_location_id?: string;
  notes?: string;
}

export interface CheckinCompleteResponse {
  success: boolean;
  transaction: GearTransaction;
  late_info?: LateInfo;
  incidents_created?: string[];
  repairs_created?: string[];
  partial_return?: boolean;
  items_not_returned?: number;
  error?: string;
}

// ============================================================================
// MARKETPLACE TYPES
// ============================================================================

export type ListerType = 'individual' | 'production_company' | 'rental_house';
export type ExtensionPolicy = 'request_approve' | 'auto_extend' | 'negotiated';
export type QuoteStatus = 'draft' | 'sent' | 'approved' | 'rejected' | 'expired' | 'cancelled';

// Sale-related types
export type ListingType = 'rent' | 'sale' | 'both';
export type SaleCondition = 'new' | 'like_new' | 'good' | 'fair' | 'parts';
export type SaleStatus =
  | 'offered'
  | 'countered'
  | 'accepted'
  | 'payment_pending'
  | 'paid'
  | 'shipped'
  | 'delivered'
  | 'completed'
  | 'cancelled'
  | 'rejected'
  | 'expired'
  | 'disputed';
export type RentalRequestStatus = 'draft' | 'submitted' | 'quoted' | 'approved' | 'rejected' | 'cancelled' | 'converted';
export type ExtensionStatus = 'pending' | 'approved' | 'denied' | 'auto_approved';
export type RentalOrderStatus =
  | 'draft'
  | 'confirmed'
  | 'building'
  | 'packed'
  | 'ready_for_pickup'
  | 'picked_up'
  | 'in_use'
  | 'returned'
  | 'reconciling'
  | 'closed'
  | 'cancelled'
  | 'disputed';

export interface GearMarketplaceSettings {
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
  successful_rentals_count: number;
  default_deposit_percent: number;
  require_deposit: boolean;
  default_insurance_required: boolean;
  offers_delivery: boolean;
  delivery_radius_miles?: number;
  delivery_base_fee?: number;
  delivery_per_mile_fee?: number;
  extension_policy: ExtensionPolicy;
  auto_extend_max_days: number;
  accepts_stripe: boolean;
  accepts_invoice: boolean;
  stripe_account_id?: string;
  contact_email?: string;
  contact_phone?: string;
  created_at: string;
  updated_at: string;
}

export interface GearMarketplaceListing {
  id: string;
  asset_id: string;
  organization_id: string;
  is_listed: boolean;
  listed_at?: string;
  delisted_at?: string;
  // Listing type: rent, sale, or both
  listing_type: ListingType;
  // Rental pricing
  daily_rate?: number;
  weekly_rate?: number;
  monthly_rate?: number;
  weekly_discount_percent: number;
  monthly_discount_percent: number;
  quantity_discount_threshold?: number;
  quantity_discount_percent?: number;
  // Sale pricing
  sale_price?: number;
  sale_condition?: SaleCondition;
  sale_includes?: string;
  sale_negotiable: boolean;
  // Common fields
  deposit_amount?: number;
  deposit_percent?: number;
  insurance_required: boolean;
  insurance_daily_rate?: number;
  min_rental_days: number;
  max_rental_days?: number;
  advance_booking_days: number;
  blackout_dates?: Array<{ start: string; end: string }>;
  rental_notes?: string;
  pickup_instructions?: string;
  created_at: string;
  updated_at: string;
  // Joined fields
  asset?: GearAsset;
  organization?: {
    id: string;
    name: string;
    is_verified: boolean;
    logo_url?: string;
    marketplace_name?: string;
    lister_type?: ListerType;
    marketplace_location?: string;
  };
}

export interface GearMarketplaceSearchFilters {
  search?: string;
  category_id?: string;
  location?: string;
  min_price?: number;
  max_price?: number;
  available_from?: string;
  available_to?: string;
  lister_type?: ListerType;
  listing_type?: ListingType;
  verified_only?: boolean;
  insurance_required?: boolean;
  // Sale-specific filters
  condition?: SaleCondition;
  // Grouping and prioritization
  group_by_org?: boolean;
  priority_org_ids?: string; // Comma-separated org IDs to prioritize (e.g., cart items)
}

export interface MarketplaceOrganizationGroup {
  id: string;
  name: string;
  marketplace_name?: string;
  logo_url?: string;
  marketplace_location?: string;
  lister_type?: ListerType;
  is_verified: boolean;
  is_priority: boolean;
  listings: GearMarketplaceListing[];
}

export interface MarketplaceGroupedSearchResponse {
  organizations: MarketplaceOrganizationGroup[];
  total: number;
  limit: number;
  offset: number;
}

export interface GearRentalRequest {
  id: string;
  requesting_org_id: string;
  rental_house_org_id?: string;
  backlot_project_id?: string;
  project_name?: string;
  budget_line_item_id?: string;
  auto_create_budget_line: boolean;
  request_number?: string;
  title: string;
  description?: string;
  rental_start_date: string;
  rental_end_date: string;
  delivery_location_id?: string;
  delivery_address?: Record<string, unknown>;
  delivery_notes?: string;
  status: RentalRequestStatus;
  requested_by_user_id: string;
  requested_at: string;
  notes?: string;
  created_at: string;
  updated_at: string;
  // Joined fields
  requesting_org_name?: string;
  rental_house_name?: string;
  requested_by_name?: string;
  item_count?: number;
  quote_count?: number;
  items?: GearRentalRequestItem[];
  quotes?: GearRentalQuote[];
}

export interface GearRentalRequestItem {
  id: string;
  request_id: string;
  asset_id?: string;
  listing_id?: string;
  category_id?: string;
  item_description?: string;
  quantity: number;
  notes?: string;
  sort_order: number;
  // Joined fields
  asset_name?: string;
  asset_internal_id?: string;
  category_name?: string;
}

export interface GearRentalQuote {
  id: string;
  request_id: string;
  rental_house_org_id: string;
  quote_number?: string;
  rental_start_date: string;
  rental_end_date: string;
  subtotal?: number;
  tax_amount?: number;
  insurance_amount?: number;
  delivery_fee?: number;
  deposit_amount?: number;
  total_amount?: number;
  payment_terms?: string;
  cancellation_policy?: string;
  insurance_requirements?: string;
  damage_policy?: string;
  status: QuoteStatus;
  valid_until?: string;
  inventory_held: boolean;
  hold_expires_at?: string;
  prepared_by_user_id: string;
  sent_at?: string;
  approved_at?: string;
  approved_by_user_id?: string;
  rejection_reason?: string;
  notes?: string;
  created_at: string;
  updated_at: string;
  // Joined fields
  rental_house_name?: string;
  rental_house_logo?: string;
  prepared_by_name?: string;
  requesting_org_id?: string;
  requesting_org_name?: string;
  request_title?: string;
  items?: GearRentalQuoteItem[];
}

export interface GearRentalQuoteItem {
  id: string;
  quote_id: string;
  request_item_id?: string;
  asset_id?: string;
  listing_id?: string;
  item_description?: string;
  quantity: number;
  daily_rate?: number;
  weekly_rate?: number;
  quoted_rate?: number;
  rate_type: 'daily' | 'weekly' | 'flat';
  line_total?: number;
  is_substitution: boolean;
  substitution_notes?: string;
  notes?: string;
  sort_order: number;
  // Joined fields
  asset_name?: string;
  asset_internal_id?: string;
  asset_photos?: string[];
}

export interface GearRentalOrder {
  id: string;
  quote_id?: string;
  rental_house_org_id: string;
  client_org_id: string;
  backlot_project_id?: string;
  order_number: string;
  rental_start_date: string;
  rental_end_date: string;
  status: RentalOrderStatus;
  delivery_location_id?: string;
  delivery_address?: Record<string, unknown>;
  subtotal?: number;
  tax_amount?: number;
  insurance_amount?: number;
  delivery_fee?: number;
  total_amount?: number;
  damage_charges: number;
  late_fees: number;
  consumables_charged: number;
  consumables_credited: number;
  final_amount?: number;
  built_at?: string;
  built_by_user_id?: string;
  packed_at?: string;
  packed_by_user_id?: string;
  picked_up_at?: string;
  returned_at?: string;
  reconciled_at?: string;
  reconciled_by_user_id?: string;
  closed_at?: string;
  build_notes?: string;
  pack_notes?: string;
  reconciliation_notes?: string;
  notes?: string;
  created_at: string;
  updated_at: string;
  created_by_user_id: string;
  // Joined fields
  rental_house_name?: string;
  client_org_name?: string;
  project_name?: string;
  items?: GearRentalOrderItem[];
}

export interface GearRentalOrderItem {
  id: string;
  order_id: string;
  quote_item_id?: string;
  asset_id?: string;
  kit_instance_id?: string;
  item_description?: string;
  quantity: number;
  quantity_dispatched?: number;
  quantity_returned?: number;
  quoted_rate?: number;
  line_total?: number;
  is_packed: boolean;
  packed_at?: string;
  pack_photo_url?: string;
  checkout_transaction_id?: string;
  return_transaction_id?: string;
  notes?: string;
  sort_order: number;
  // Joined fields
  asset_name?: string;
  asset_internal_id?: string;
}

export interface GearRentalExtension {
  id: string;
  transaction_id: string;
  order_id?: string;
  original_end_date: string;
  requested_end_date: string;
  approved_end_date?: string;
  status: ExtensionStatus;
  extension_type: ExtensionPolicy;
  additional_days: number;
  daily_rate?: number;
  additional_amount?: number;
  new_quote_id?: string;
  requested_by: string;
  reviewed_by?: string;
  requested_at: string;
  reviewed_at?: string;
  reason?: string;
  denial_reason?: string;
  created_at: string;
  updated_at: string;
  // Joined fields
  requester_name?: string;
  reviewer_name?: string;
  order_number?: string;
  renter_org_name?: string;
}

export interface GearRenterReputation {
  id: string;
  organization_id: string;
  total_rentals: number;
  successful_rentals: number;
  late_returns: number;
  damage_incidents: number;
  total_rental_value: number;
  is_verified: boolean;
  verified_at?: string;
  verification_threshold: number;
  average_rating?: number;
  rating_count: number;
  created_at: string;
  updated_at: string;
}

// ============================================================================
// MARKETPLACE REQUEST/RESPONSE TYPES
// ============================================================================

export interface MarketplaceSearchResponse {
  listings: GearMarketplaceListing[];
  total: number;
  filters_applied: GearMarketplaceSearchFilters;
}

export interface MarketplaceOrganizationsResponse {
  organizations: Array<{
    id: string;
    name: string;
    marketplace_name?: string;
    marketplace_description?: string;
    marketplace_logo_url?: string;
    marketplace_location?: string;
    lister_type: ListerType;
    is_verified: boolean;
    successful_rentals_count: number;
    listing_count: number;
  }>;
  total: number;
}

export interface CreateRentalRequestInput {
  rental_house_org_id?: string;
  backlot_project_id?: string;
  project_name?: string;
  budget_line_item_id?: string;
  auto_create_budget_line?: boolean;
  title: string;
  description?: string;
  rental_start_date: string;
  rental_end_date: string;
  delivery_address?: Record<string, unknown>;
  delivery_notes?: string;
  items: Array<{
    asset_id?: string;
    listing_id?: string;
    category_id?: string;
    item_description?: string;
    quantity: number;
    notes?: string;
  }>;
  notes?: string;
}

export interface CreateQuoteInput {
  rental_start_date: string;
  rental_end_date: string;
  items: Array<{
    request_item_id?: string;
    asset_id?: string;
    listing_id?: string;
    item_description?: string;
    quantity: number;
    daily_rate: number;
    rate_type: 'daily' | 'weekly' | 'flat';
    line_total: number;
    is_substitution?: boolean;
    substitution_notes?: string;
    notes?: string;
  }>;
  subtotal: number;
  tax_amount?: number;
  insurance_amount?: number;
  delivery_fee?: number;
  deposit_amount?: number;
  total_amount: number;
  payment_terms?: string;
  cancellation_policy?: string;
  insurance_requirements?: string;
  damage_policy?: string;
  valid_until?: string;
  hold_inventory?: boolean;
  notes?: string;
}

export interface CreateListingInput {
  asset_id: string;
  // Listing type: rent, sale, or both
  listing_type?: ListingType;
  // Rental pricing (required if listing_type is 'rent' or 'both')
  daily_rate?: number;
  weekly_rate?: number;
  monthly_rate?: number;
  weekly_discount_percent?: number;
  monthly_discount_percent?: number;
  quantity_discount_threshold?: number;
  quantity_discount_percent?: number;
  // Sale pricing (required if listing_type is 'sale' or 'both')
  sale_price?: number;
  sale_condition?: SaleCondition;
  sale_includes?: string;
  sale_negotiable?: boolean;
  // Common fields
  deposit_amount?: number;
  deposit_percent?: number;
  insurance_required?: boolean;
  insurance_daily_rate?: number;
  min_rental_days?: number;
  max_rental_days?: number;
  advance_booking_days?: number;
  blackout_dates?: Array<{ start: string; end: string }>;
  rental_notes?: string;
  pickup_instructions?: string;
}

export interface RequestExtensionInput {
  requested_end_date: string;
  reason?: string;
}

export interface ExtensionResponseInput {
  approved_end_date?: string;
  additional_amount?: number;
  daily_rate?: number;
  denial_reason?: string;
}

// ============================================================================
// WORK ORDER TYPES
// ============================================================================

export type WorkOrderStatus = 'draft' | 'in_progress' | 'ready' | 'checked_out' | 'cancelled';

export interface WorkOrderStatusConfig {
  id: string;
  label: string;
  color: string;
  sort_order: number;
}

export interface GearWorkOrder {
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
  // Custodian (who gets equipment)
  custodian_user_id?: string;
  custodian_user_name?: string;
  custodian_contact_id?: string;
  custodian_contact_name?: string;
  backlot_project_id?: string;
  project_name?: string;
  // Dates
  due_date?: string;
  pickup_date?: string;
  expected_return_date?: string;
  destination_location_id?: string;
  destination_location_name?: string;
  // Checkout link
  checkout_transaction_id?: string;
  checked_out_at?: string;
  checked_out_by?: string;
  checked_out_by_name?: string;
  // Counts
  item_count?: number;
  staged_count?: number;
  // Timestamps
  created_at: string;
  updated_at: string;
  // Related data
  items?: GearWorkOrderItem[];
}

export interface GearWorkOrderItem {
  id: string;
  work_order_id: string;
  asset_id?: string;
  asset_name?: string;
  asset_internal_id?: string;
  kit_instance_id?: string;
  kit_name?: string;
  kit_internal_id?: string;
  quantity: number;
  is_staged: boolean;
  staged_at?: string;
  staged_by?: string;
  staged_by_name?: string;
  notes?: string;
  sort_order: number;
}

export interface GearWorkOrderCounts {
  draft: number;
  in_progress: number;
  ready: number;
  checked_out: number;
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
  pickup_date?: string;
  expected_return_date?: string;
  destination_location_id?: string;
  items?: Array<{
    asset_id?: string;
    kit_instance_id?: string;
    quantity?: number;
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
  pickup_date?: string;
  expected_return_date?: string;
  destination_location_id?: string;
}

export interface WorkOrderCheckoutResponse {
  work_order: GearWorkOrder;
  transaction: GearTransaction;
}

// ============================================================================
// TRANSACTIONS 6-TAB TYPES
// ============================================================================

export type TransactionTab = 'outgoing' | 'incoming' | 'requests' | 'history' | 'overdue' | 'work_orders';

export interface OutgoingTransaction extends GearTransaction {
  renter_org_name?: string;
  rental_total?: number;
  rental_start_date?: string;
  rental_end_date?: string;
  is_overdue: boolean;
  contact_company?: string;
}

export interface IncomingTransaction extends GearTransaction {
  rental_house_name?: string;
  rental_total?: number;
  rental_start_date?: string;
  rental_end_date?: string;
  order_number?: string;
  is_overdue: boolean;
}

export interface TransactionRequestsResponse {
  incoming_quotes: Array<{
    request_type: 'incoming_quote';
    id: string;
    request_number?: string;
    title: string;
    status: RentalRequestStatus;
    rental_start_date: string;
    rental_end_date: string;
    created_at: string;
    counterparty_org_id: string;
    counterparty_name: string;
    requester_name?: string;
    item_count: number;
  }>;
  outgoing_quotes: Array<{
    request_type: 'outgoing_quote';
    id: string;
    request_number?: string;
    title: string;
    status: RentalRequestStatus;
    rental_start_date: string;
    rental_end_date: string;
    created_at: string;
    counterparty_org_id: string;
    counterparty_name: string;
    quoted_total?: number;
    quote_expires_at?: string;
    item_count: number;
  }>;
  extensions: Array<{
    request_type: 'extension';
    id: string;
    status: ExtensionStatus;
    extension_type: ExtensionPolicy;
    original_end_date: string;
    requested_end_date: string;
    additional_days: number;
    additional_amount?: number;
    created_at: string;
    reason?: string;
    rental_house_org_id: string;
    renter_org_id?: string;
    direction: 'incoming' | 'outgoing';
    requester_name?: string;
  }>;
  totals: {
    incoming_quotes: number;
    outgoing_quotes: number;
    extensions: number;
  };
}

export interface HistoryTransaction extends GearTransaction {
  renter_org_name?: string;
  rental_house_org_name?: string;
  rental_total?: number;
  rental_start_date?: string;
  rental_end_date?: string;
  late_days?: number;
  late_fee_amount?: number;
}

// ============================================================================
// SHIPPING & DELIVERY TYPES
// ============================================================================

export type DeliveryMethod = 'pickup' | 'local_delivery' | 'shipping';
export type ShippingCarrier = 'usps' | 'ups' | 'fedex' | 'dhl' | 'other';
export type ShippingPricingMode = 'real_time' | 'flat_rate' | 'both';
export type ShipmentStatus =
  | 'pending'
  | 'label_created'
  | 'label_purchased'
  | 'shipped'
  | 'in_transit'
  | 'out_for_delivery'
  | 'delivered'
  | 'return_to_sender'
  | 'failure'
  | 'cancelled';
export type ShipmentType = 'outbound' | 'return';
export type ShipmentPaidBy = 'renter' | 'rental_house' | 'split';

export interface ShippingAddress {
  name: string;
  company?: string;
  street1: string;
  street2?: string;
  city: string;
  state: string;
  zip: string;
  country: string;
  phone?: string;
  email?: string;
}

export interface ShippingRate {
  id: string;
  carrier: ShippingCarrier;
  service: string;
  service_name: string;
  rate: number;
  currency: string;
  estimated_days?: number;
  delivery_date?: string;
  delivery_date_guaranteed: boolean;
}

export interface FlatRateOptions {
  ground?: number;
  express?: number;
  overnight?: number;
}

export interface PackageDimensions {
  length: number;
  width: number;
  height: number;
  weight: number;
}

export interface LocalDeliveryOptions {
  enabled: boolean;
  radius_miles?: number;
  base_fee?: number;
  per_mile_fee?: number;
}

export interface ShippingOptions {
  enabled: boolean;
  carriers: ShippingCarrier[];
  pricing_mode: ShippingPricingMode;
  flat_rates?: FlatRateOptions;
  free_threshold?: number;
}

export interface DeliveryOptions {
  allows_pickup: boolean;
  pickup_address?: string;
  pickup_instructions?: string;
  pickup_hours?: Record<string, string>;
  local_delivery: LocalDeliveryOptions;
  shipping: ShippingOptions;
}

export interface GearShipment {
  id: string;
  quote_id?: string;
  order_id?: string;
  transaction_id?: string;
  organization_id: string;
  shipment_type: ShipmentType;
  easypost_shipment_id?: string;
  easypost_rate_id?: string;
  easypost_tracker_id?: string;
  carrier: ShippingCarrier;
  service: string;
  service_name?: string;
  tracking_number?: string;
  tracking_url?: string;
  status: ShipmentStatus;
  from_address: ShippingAddress;
  to_address: ShippingAddress;
  package_type?: string;
  package_dimensions?: PackageDimensions;
  quoted_rate?: number;
  shipping_cost?: number;
  insurance_cost?: number;
  total_cost?: number;
  paid_by: ShipmentPaidBy;
  label_url?: string;
  label_format?: string;
  label_size?: string;
  label_created_at?: string;
  insured_value?: number;
  insurance_provider?: string;
  estimated_delivery_date?: string;
  actual_delivery_date?: string;
  shipped_at?: string;
  delivered_at?: string;
  tracking_events?: TrackingEvent[];
  notes?: string;
  created_by?: string;
  created_at: string;
  updated_at: string;
}

export interface TrackingEvent {
  status: string;
  message: string;
  location?: string;
  timestamp: string;
}

export interface TrackingInfo {
  tracking_number: string;
  carrier: ShippingCarrier;
  status: string;
  estimated_delivery_date?: string;
  events: TrackingEvent[];
  shipment_id?: string;
}

export interface AddressVerification {
  is_valid: boolean;
  verified_address?: ShippingAddress;
  errors: string[];
  warnings: string[];
}

// Shipping Settings (extends GearMarketplaceSettings)
export interface GearShippingSettings {
  allows_customer_pickup: boolean;
  pickup_address?: string;
  pickup_instructions?: string;
  pickup_hours?: Record<string, string>;
  local_delivery_enabled: boolean;
  offers_delivery: boolean;
  delivery_radius_miles?: number;
  delivery_base_fee?: number;
  delivery_per_mile_fee?: number;
  shipping_enabled: boolean;
  shipping_carriers: ShippingCarrier[];
  shipping_pricing_mode: ShippingPricingMode;
  flat_rate_shipping?: FlatRateOptions;
  free_shipping_threshold?: number;
  ships_from_address?: ShippingAddress;
  ships_from_address_verified?: boolean;
  package_defaults?: Record<string, PackageDimensions>;
  return_shipping_paid_by: ShipmentPaidBy;
  auto_insurance_threshold?: number;
  use_platform_easypost: boolean;
}

// API Request/Response types
export interface GetShippingRatesRequest {
  from_org_id: string;
  to_address: ShippingAddress;
  item_ids: string[];
  carriers?: ShippingCarrier[];
}

export interface GetShippingRatesResponse {
  shipment_id: string;
  rates: ShippingRate[];
  free_shipping_threshold?: number;
  package_dimensions: PackageDimensions;
}

export interface BuyLabelRequest {
  quote_id?: string;
  order_id?: string;
  rate_id: string;
  shipment_id: string;
  shipment_type: ShipmentType;
  label_format?: string;
}

export interface BuyLabelResponse {
  id: string;
  tracking_number?: string;
  tracking_url?: string;
  label_url?: string;
  label_format?: string;
  carrier: string;
  service: string;
  rate?: number;
  status: string;
  message?: string;
}

export interface UpdateShippingSettingsInput {
  allows_customer_pickup?: boolean;
  pickup_address?: string;
  pickup_instructions?: string;
  pickup_hours?: Record<string, string>;
  local_delivery_enabled?: boolean;
  offers_delivery?: boolean;
  delivery_radius_miles?: number;
  delivery_base_fee?: number;
  delivery_per_mile_fee?: number;
  shipping_enabled?: boolean;
  shipping_carriers?: ShippingCarrier[];
  shipping_pricing_mode?: ShippingPricingMode;
  flat_rate_shipping?: FlatRateOptions;
  free_shipping_threshold?: number;
  ships_from_address?: ShippingAddress;
  package_defaults?: Record<string, PackageDimensions>;
  return_shipping_paid_by?: ShipmentPaidBy;
  auto_insurance_threshold?: number;
  use_platform_easypost?: boolean;
}

// ============================================================================
// SALE TYPES
// ============================================================================

export interface NegotiationHistoryEntry {
  from: string; // user_id
  to: string; // user_id
  price: number;
  message?: string;
  timestamp: string;
}

export interface GearSale {
  id: string;
  listing_id: string;
  asset_id: string;
  // Seller info
  seller_org_id: string;
  seller_user_id: string;
  seller_org_name?: string;
  seller_user_name?: string;
  // Buyer info
  buyer_org_id?: string;
  buyer_user_id: string;
  buyer_org_name?: string;
  buyer_user_name?: string;
  // Pricing
  asking_price: number;
  offer_price: number;
  final_price?: number;
  platform_fee: number;
  seller_payout?: number;
  // Status
  status: SaleStatus;
  // Negotiation
  negotiation_history: NegotiationHistoryEntry[];
  // Payment
  payment_method?: 'stripe' | 'invoice' | 'cash' | 'external';
  stripe_payment_intent_id?: string;
  invoice_id?: string;
  paid_at?: string;
  payment_notes?: string;
  // Delivery
  delivery_method: DeliveryMethod;
  shipping_address?: ShippingAddress;
  shipment_id?: string;
  // Messages
  buyer_message?: string;
  seller_notes?: string;
  // Offer expiration
  offer_expires_at?: string;
  // Timestamps
  offered_at: string;
  countered_at?: string;
  accepted_at?: string;
  shipped_at?: string;
  delivered_at?: string;
  completed_at?: string;
  cancelled_at?: string;
  cancelled_by?: string;
  cancellation_reason?: string;
  created_at: string;
  updated_at: string;
  // Joined fields
  listing?: GearMarketplaceListing;
  asset?: GearAsset;
}

export interface MakeOfferInput {
  listing_id: string;
  offer_price: number;
  message?: string;
  delivery_method: DeliveryMethod;
  shipping_address?: ShippingAddress;
  offer_expires_in_days?: number;
}

export interface CounterOfferInput {
  counter_price: number;
  message?: string;
}

export interface AcceptOfferInput {
  payment_method?: 'stripe' | 'invoice' | 'cash' | 'external';
  message?: string;
}

export interface GearSalesResponse {
  sales: GearSale[];
  total: number;
}

// ============================================================================
// PERSONAL GEAR / GEAR HOUSE LITE TYPES
// ============================================================================

export interface QuickAddAssetInput {
  name: string;
  category_id?: string;
  manufacturer?: string;
  model?: string;
  photos: string[];
  listing_type?: ListingType;
  daily_rate?: number;
  weekly_rate?: number;
  sale_price?: number;
  sale_condition?: SaleCondition;
  sale_includes?: string;
  sale_negotiable?: boolean;
  create_listing?: boolean;
}

export interface PersonalGearAsset {
  id: string;
  name: string;
  make?: string;
  manufacturer?: string; // Alias for make
  model?: string;
  serial_number?: string;
  barcode?: string;
  status?: string;
  current_condition?: string;
  photos_current?: string[];
  photos_baseline?: string[];
  photos?: string[]; // For API updates - maps to photos_current on backend
  category_id?: string;
  category_name?: string;
  created_at?: string;
  // Listing info (joined)
  listing_id?: string;
  is_listed?: boolean;
  listing_type?: ListingType;
  daily_rate?: number;
  weekly_rate?: number;
  monthly_rate?: number;
  sale_price?: number;
  sale_condition?: SaleCondition;
  sale_includes?: string;
  deposit_amount?: number;
  deposit_percent?: number;
  insurance_required?: boolean;
  min_rental_days?: number;
}

export interface PersonalGearResponse {
  org_id: string | null;
  assets: PersonalGearAsset[];
}

export interface EnsurePersonalOrgResponse {
  org_id: string;
  created: boolean;
}

export interface QuickAddAssetResponse {
  asset_id: string;
  listing_id: string | null;
  org_id: string;
}
