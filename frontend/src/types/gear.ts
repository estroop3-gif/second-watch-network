/**
 * Gear House TypeScript Types
 * Equipment management system types
 */

// ============================================================================
// ENUMS
// ============================================================================

export type OrganizationType = 'production_company' | 'rental_house' | 'hybrid';

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

export type TransactionStatus = 'draft' | 'pending' | 'in_progress' | 'completed' | 'cancelled';

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

// ============================================================================
// ORGANIZATION TYPES
// ============================================================================

export interface GearOrganization {
  id: string;
  name: string;
  organization_type: OrganizationType;
  description?: string;
  logo_url?: string;
  contact_email?: string;
  contact_phone?: string;
  address?: Record<string, unknown>;
  is_active: boolean;
  created_at: string;
  updated_at: string;
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

export interface GearOrganizationSettings {
  id: string;
  organization_id: string;
  default_checkout_duration_days: number;
  require_condition_photos: boolean;
  auto_generate_barcodes: boolean;
  barcode_format: BarcodeFormat;
  barcode_prefix?: string;
  enable_strikes: boolean;
  strikes_before_suspension: number;
  enable_auto_strikes: boolean;
  rental_late_fee_per_day?: number;
  rental_damage_deposit_percent?: number;
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

export interface GearLocation {
  id: string;
  organization_id: string;
  name: string;
  location_type: string;
  address?: Record<string, unknown>;
  parent_location_id?: string;
  is_active: boolean;
  sort_order: number;
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
  condition: AssetCondition;
  manufacturer?: string;
  model?: string;
  serial_number?: string;
  internal_id: string;
  barcode?: string;
  qr_code?: string;
  primary_scan_code?: string;
  purchase_date?: string;
  purchase_price?: number;
  replacement_value?: number;
  current_location_id?: string;
  current_location_name?: string;
  current_custodian_user_id?: string;
  current_custodian_name?: string;
  home_location_id?: string;
  weight_kg?: number;
  dimensions?: Record<string, unknown>;
  power_requirements?: string;
  accessories?: string[];
  notes?: string;
  photos?: string[];
  is_rentable: boolean;
  rental_price_daily?: number;
  rental_price_weekly?: number;
  insurance_policy_number?: string;
  last_maintenance_date?: string;
  next_maintenance_date?: string;
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
}

export interface GearKitInstance {
  id: string;
  organization_id: string;
  template_id?: string;
  template_name?: string;
  name: string;
  internal_id: string;
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
  asset_id: string;
  asset_name?: string;
  asset_internal_id?: string;
  added_at: string;
  added_by_user_id?: string;
  is_present: boolean;
  slot_number?: number;
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
  initiated_by_user_id: string;
  initiated_by_name?: string;
  primary_custodian_user_id?: string;
  primary_custodian_name?: string;
  counterparty_org_id?: string;
  backlot_project_id?: string;
  backlot_project_name?: string;
  source_location_id?: string;
  source_location_name?: string;
  destination_location_id?: string;
  destination_location_name?: string;
  destination_address?: Record<string, unknown>;
  scheduled_at?: string;
  checked_out_at?: string;
  expected_return_at?: string;
  returned_at?: string;
  scan_mode_required: ScanMode;
  all_items_scanned_out: boolean;
  all_items_scanned_in: boolean;
  notes?: string;
  created_at: string;
  updated_at: string;
  items?: GearTransactionItem[];
  item_count?: number;
}

export interface GearTransactionItem {
  id: string;
  transaction_id: string;
  asset_id?: string;
  asset_name?: string;
  asset_internal_id?: string;
  kit_instance_id?: string;
  kit_name?: string;
  quantity: number;
  scanned_out_at?: string;
  scanned_out_by_user_id?: string;
  scanned_in_at?: string;
  scanned_in_by_user_id?: string;
  condition_at_checkout?: AssetCondition;
  condition_at_checkin?: AssetCondition;
  notes?: string;
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
  organization_type: OrganizationType;
  description?: string;
  contact_email?: string;
  contact_phone?: string;
}

export interface CreateAssetInput {
  name: string;
  category_id?: string;
  asset_type: AssetType;
  description?: string;
  manufacturer?: string;
  model?: string;
  serial_number?: string;
  purchase_price?: number;
  replacement_value?: number;
  home_location_id?: string;
  is_rentable?: boolean;
  rental_price_daily?: number;
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
