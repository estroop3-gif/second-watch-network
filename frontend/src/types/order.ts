/**
 * Order of the Second Watch Types
 * TypeScript types for the Order guild system
 */

// ============ Enums ============

export type OrderMemberStatus = 'probationary' | 'active' | 'suspended' | 'expelled';
export type OrderApplicationStatus = 'pending' | 'approved' | 'rejected';
export type LodgeStatus = 'forming' | 'active' | 'inactive';
export type LodgeMembershipStatus = 'pending' | 'active' | 'former';
export type MembershipTier = 'base' | 'steward' | 'patron';
export type CraftHouseStatus = 'active' | 'inactive' | 'forming';
export type CraftHouseRole = 'member' | 'deputy' | 'master';
export type FellowshipType = 'entry_level' | 'faith_based' | 'special_interest' | 'regional';
export type FellowshipRole = 'member' | 'leader' | 'coordinator';
export type GovernancePositionType =
  | 'high_council'
  | 'grand_master'
  | 'lodge_master'
  | 'lodge_council'
  | 'craft_master'
  | 'craft_deputy'
  | 'fellowship_leader'
  | 'regional_director';
export type GovernanceScopeType = 'order' | 'lodge' | 'craft_house' | 'fellowship' | 'region';
export type DuesPaymentStatus = 'pending' | 'succeeded' | 'failed' | 'refunded';

export type PrimaryTrack =
  | 'camera'
  | 'post'
  | 'audio'
  | 'lighting'
  | 'production'
  | 'directing'
  | 'writing'
  | 'church_media'
  | 'vfx'
  | 'motion_graphics'
  | 'colorist'
  | 'producer'
  | 'art_department'
  | 'wardrobe'
  | 'makeup_hair'
  | 'other';

// ============ Lodge Types ============

export interface Lodge {
  id: number;
  name: string;
  slug: string;
  city: string;
  region?: string;
  status: LodgeStatus;
  description?: string;
  base_lodge_dues_cents: number;
  contact_email?: string;
  contact_user_id?: string;
  created_at: string;
  updated_at: string;
  member_count?: number;
  officer_name?: string;
}

export interface LodgeMembership {
  id: number;
  user_id: string;
  lodge_id: number;
  status: LodgeMembershipStatus;
  is_officer: boolean;
  officer_title?: string;
  joined_at?: string;
  dues_status?: string;
  created_at: string;
  lodge_name?: string;
  lodge_city?: string;
}

// ============ Order Member Types ============

export interface OrderMemberProfile {
  id: number;
  user_id: string;
  primary_track: PrimaryTrack;
  secondary_tracks?: string;
  city?: string;
  region?: string;
  portfolio_url?: string;
  imdb_url?: string;
  youtube_url?: string;
  vimeo_url?: string;
  website_url?: string;
  gear_summary?: string;
  bio?: string;
  years_experience?: number;
  availability_status?: string;
  lodge_id?: number;
  status: OrderMemberStatus;
  membership_tier: MembershipTier;
  tier_started_at?: string;
  joined_at?: string;
  probation_ends_at?: string;
  stripe_customer_id?: string;
  stripe_subscription_id?: string;
  stripe_price_id?: string;
  dues_status?: string;
  created_at: string;
  updated_at: string;
  user_name?: string;
  user_email?: string;
  lodge_name?: string;
  lodge_city?: string;
}

export interface OrderApplication {
  id: number;
  user_id: string;
  primary_track: PrimaryTrack;
  city?: string;
  region?: string;
  portfolio_links?: string;
  statement?: string;
  years_experience?: number;
  current_role?: string;
  status: OrderApplicationStatus;
  reviewed_by_id?: string;
  reviewed_at?: string;
  rejection_reason?: string;
  created_at: string;
  updated_at: string;
  applicant_name?: string;
  applicant_email?: string;
}

// ============ Craft House Types ============

export interface CraftHouse {
  id: number;
  name: string;
  slug: string;
  description?: string;
  icon?: string;
  primary_tracks?: string[];
  status: CraftHouseStatus;
  created_at: string;
  updated_at: string;
  member_count?: number;
  master_name?: string;
}

export interface CraftHouseMembership {
  id: number;
  user_id: string;
  craft_house_id: number;
  role: CraftHouseRole;
  joined_at: string;
  created_at: string;
  craft_house_name?: string;
  user_name?: string;
}

export interface CraftHouseMember {
  user_id: string;
  user_name?: string;
  role: CraftHouseRole;
  primary_track?: PrimaryTrack;
  city?: string;
  joined_at: string;
}

// ============ Fellowship Types ============

export interface Fellowship {
  id: number;
  name: string;
  slug: string;
  fellowship_type: FellowshipType;
  description?: string;
  requirements?: string;
  is_opt_in: boolean;
  is_visible: boolean;
  status: CraftHouseStatus;
  created_at: string;
  updated_at: string;
  member_count?: number;
}

export interface FellowshipMembership {
  id: number;
  user_id: string;
  fellowship_id: number;
  role: FellowshipRole;
  joined_at: string;
  created_at: string;
  fellowship_name?: string;
  user_name?: string;
}

// ============ Governance Types ============

export interface GovernancePosition {
  id: number;
  user_id: string;
  position_type: GovernancePositionType;
  scope_type?: GovernanceScopeType;
  scope_id?: number;
  title: string;
  description?: string;
  started_at: string;
  ended_at?: string;
  is_active: boolean;
  appointed_by?: string;
  created_at: string;
  updated_at: string;
  user_name?: string;
  scope_name?: string;
}

export interface HighCouncil {
  grand_master?: GovernancePosition;
  council_members: GovernancePosition[];
}

// ============ Membership Tier Types ============

export interface MembershipTierInfo {
  tier: MembershipTier;
  name: string;
  price_cents: number;
  description: string;
  benefits: string[];
}

export interface MembershipStatus {
  is_order_member: boolean;
  membership_status?: OrderMemberStatus;
  membership_tier?: MembershipTier;
  tier_started_at?: string;
  dues_status?: string;
  next_billing_date?: string;
  stripe_customer_id?: string;
}

// ============ Dues Payment Types ============

export interface DuesPayment {
  id: number;
  user_id: string;
  amount_cents: number;
  tier: MembershipTier;
  stripe_payment_intent_id?: string;
  stripe_invoice_id?: string;
  status: DuesPaymentStatus;
  period_start?: string;
  period_end?: string;
  created_at: string;
}

// ============ Dashboard Types ============

export interface OrderDashboardStats {
  is_order_member: boolean;
  membership_status?: OrderMemberStatus;
  dues_status?: string;
  primary_track?: PrimaryTrack;
  lodge_id?: number;
  lodge_name?: string;
  joined_at?: string;
  pending_booking_requests: number;
  active_job_applications: number;
}

export interface OrderDashboardStatsExtended extends OrderDashboardStats {
  membership_tier?: MembershipTier;
  craft_houses: CraftHouseMembership[];
  fellowships: FellowshipMembership[];
  governance_positions: GovernancePosition[];
}

// ============ API Response Types ============

export interface CraftHouseListResponse {
  craft_houses: CraftHouse[];
  total: number;
}

export interface CraftHouseMemberListResponse {
  members: CraftHouseMember[];
  total: number;
}

export interface FellowshipListResponse {
  fellowships: Fellowship[];
  total: number;
}

export interface GovernancePositionListResponse {
  positions: GovernancePosition[];
  total: number;
}

export interface LodgeListResponse {
  lodges: Lodge[];
  total: number;
}

export interface OrderApplicationListResponse {
  applications: OrderApplication[];
  total: number;
  skip: number;
  limit: number;
}

export interface OrderMemberListResponse {
  members: OrderMemberProfile[];
  total: number;
  skip: number;
  limit: number;
}

// ============ Input Types ============

export interface OrderApplicationInput {
  primary_track: PrimaryTrack;
  city?: string;
  region?: string;
  portfolio_links?: string;
  statement?: string;
  years_experience?: number;
  current_role?: string;
}

export interface OrderMemberProfileInput {
  primary_track: PrimaryTrack;
  secondary_tracks?: string;
  city?: string;
  region?: string;
  portfolio_url?: string;
  imdb_url?: string;
  youtube_url?: string;
  vimeo_url?: string;
  website_url?: string;
  gear_summary?: string;
  bio?: string;
  years_experience?: number;
  availability_status?: string;
}

// ============ Track Mapping ============

export const TRACK_LABELS: Record<PrimaryTrack, string> = {
  camera: 'Camera',
  post: 'Post-Production',
  audio: 'Audio',
  lighting: 'Lighting & Grip',
  production: 'Production',
  directing: 'Directing',
  writing: 'Writing',
  church_media: 'Church Media',
  vfx: 'VFX',
  motion_graphics: 'Motion Graphics',
  colorist: 'Colorist',
  producer: 'Producer',
  art_department: 'Art Department',
  wardrobe: 'Wardrobe',
  makeup_hair: 'Makeup & Hair',
  other: 'Other',
};

export const TRACK_TO_CRAFT_HOUSE: Record<PrimaryTrack, string> = {
  camera: 'camera-guild',
  lighting: 'lighting-grip-house',
  audio: 'audio-sanctum',
  production: 'production-office',
  post: 'post-house',
  vfx: 'vfx-motion-hall',
  motion_graphics: 'vfx-motion-hall',
  writing: 'writers-chamber',
  directing: 'directors-circle',
  art_department: 'art-wardrobe-house',
  wardrobe: 'art-wardrobe-house',
  makeup_hair: 'makeup-hair-guild',
  colorist: 'post-house',
  producer: 'production-office',
  church_media: 'production-office',
  other: 'first-watch-order',
};

export const TIER_LABELS: Record<MembershipTier, string> = {
  base: 'Base Member',
  steward: 'Steward',
  patron: 'Patron',
};

export const FELLOWSHIP_TYPE_LABELS: Record<FellowshipType, string> = {
  entry_level: 'Entry Level',
  faith_based: 'Faith-Based',
  special_interest: 'Special Interest',
  regional: 'Regional',
};
