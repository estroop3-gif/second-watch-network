/**
 * Second Watch Order API Client
 * The Order is a professional guild for filmmakers and crew.
 */

import { api } from '../api';

// ============ Enums ============

export type OrderMemberStatus = 'probationary' | 'active' | 'suspended' | 'expelled';
export type OrderApplicationStatus = 'pending' | 'approved' | 'rejected';
export type LodgeStatus = 'forming' | 'active' | 'inactive';
export type LodgeMembershipStatus = 'pending' | 'active' | 'former';
export type OrderJobType = 'shoot' | 'edit' | 'remote' | 'hybrid' | 'other';
export type OrderJobVisibility = 'order_only' | 'order_priority' | 'public';
export type OrderJobApplicationStatus = 'submitted' | 'reviewed' | 'accepted' | 'rejected';

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

export type MembershipTier = 'base' | 'steward' | 'patron';
export type CraftHouseStatus = 'active' | 'inactive' | 'forming';
export type CraftHouseRole = 'apprentice' | 'associate' | 'member' | 'steward';
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

export const PRIMARY_TRACKS: { value: PrimaryTrack; label: string }[] = [
  { value: 'camera', label: 'Camera / Cinematography' },
  { value: 'post', label: 'Post-Production / Editing' },
  { value: 'audio', label: 'Audio / Sound' },
  { value: 'lighting', label: 'Lighting / Grip' },
  { value: 'production', label: 'Production Management' },
  { value: 'directing', label: 'Directing' },
  { value: 'writing', label: 'Writing / Screenwriting' },
  { value: 'church_media', label: 'Church Media' },
  { value: 'vfx', label: 'Visual Effects' },
  { value: 'motion_graphics', label: 'Motion Graphics' },
  { value: 'colorist', label: 'Color Grading' },
  { value: 'producer', label: 'Producer' },
  { value: 'art_department', label: 'Art Department' },
  { value: 'wardrobe', label: 'Wardrobe' },
  { value: 'makeup_hair', label: 'Makeup & Hair' },
  { value: 'other', label: 'Other' },
];

export const MEMBERSHIP_TIERS: { value: MembershipTier; label: string; price_cents: number }[] = [
  { value: 'base', label: 'Base Member', price_cents: 5000 },
  { value: 'steward', label: 'Steward', price_cents: 10000 },
  { value: 'patron', label: 'Patron', price_cents: 25000 },
];

export const TRACK_TO_CRAFT_HOUSE: Record<PrimaryTrack, string> = {
  camera: 'order-of-the-lens',
  lighting: 'guild-of-sparks-and-steel',
  audio: 'echo-and-frame-guild',
  production: 'keepers-of-the-line',
  post: 'echo-and-frame-guild',
  vfx: 'realm-of-illusions',
  motion_graphics: 'realm-of-illusions',
  writing: 'scribes-of-the-second-draft',
  directing: 'circle-of-action',
  art_department: 'worldbuilders-hall',
  wardrobe: 'worldbuilders-hall',
  makeup_hair: 'worldbuilders-hall',
  colorist: 'echo-and-frame-guild',
  producer: 'keepers-of-the-line',
  church_media: 'live-signal-collective',
  other: 'channel-and-feed-guild',
};

// ============ Types ============

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
  joined_at?: string;
  dues_status?: string;
  created_at: string;
  updated_at: string;
  user_name?: string;
  user_email?: string;
  lodge_name?: string;
  lodge_city?: string;
}

export interface OrderMemberDirectoryEntry {
  user_id: string;
  user_name?: string;
  primary_track: PrimaryTrack;
  city?: string;
  region?: string;
  lodge_name?: string;
  availability_status?: string;
  years_experience?: number;
  bio?: string;
}

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

export interface OrderJob {
  id: number;
  title: string;
  description: string;
  location?: string;
  job_type: OrderJobType;
  roles_needed?: string;
  pay_info?: string;
  is_paid: boolean;
  visibility: OrderJobVisibility;
  created_by_id: string;
  lodge_id?: number;
  organization_name?: string;
  is_active: boolean;
  starts_at?: string;
  ends_at?: string;
  application_deadline?: string;
  created_at: string;
  updated_at: string;
  lodge_name?: string;
  created_by_name?: string;
  application_count?: number;
  user_has_applied?: boolean;
}

export interface OrderJobApplication {
  id: number;
  job_id: number;
  user_id: string;
  cover_note?: string;
  portfolio_url?: string;
  status: OrderJobApplicationStatus;
  reviewed_by_id?: string;
  reviewed_at?: string;
  feedback?: string;
  created_at: string;
  updated_at: string;
  job_title?: string;
  applicant_name?: string;
  applicant_track?: PrimaryTrack;
}

export interface OrderBookingRequest {
  id: number;
  target_user_id: string;
  requester_user_id?: string;
  requester_name: string;
  requester_email: string;
  requester_phone?: string;
  requester_org?: string;
  project_title?: string;
  details: string;
  location?: string;
  dates?: string;
  budget_range?: string;
  roles_needed?: string;
  status: string;
  response_notes?: string;
  created_at: string;
  updated_at: string;
  target_user_name?: string;
}

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

export interface OrderAdminStats {
  total_members: number;
  active_members: number;
  probationary_members: number;
  suspended_members: number;
  pending_applications: number;
  total_lodges: number;
  active_lodges: number;
  active_jobs: number;
  members_by_track: Record<string, number>;
  members_by_city: Record<string, number>;
}

export type OrderProfileVisibility = 'public' | 'members-only' | 'private';

export interface OrderProfileSettings {
  id: string;
  user_id: string;
  show_membership_status: boolean;
  show_order_badge: boolean;
  show_joined_date: boolean;
  show_city_region: boolean;
  show_lodge_info: boolean;
  show_order_track: boolean;
  show_order_activity: boolean;
  public_visibility: OrderProfileVisibility;
  created_at: string;
  updated_at: string;
}

export interface OrderProfileSettingsUpdate {
  show_membership_status?: boolean;
  show_order_badge?: boolean;
  show_joined_date?: boolean;
  show_city_region?: boolean;
  show_lodge_info?: boolean;
  show_order_track?: boolean;
  show_order_activity?: boolean;
  public_visibility?: OrderProfileVisibility;
}

// Default settings for new users
export const DEFAULT_ORDER_PROFILE_SETTINGS: Omit<OrderProfileSettings, 'id' | 'user_id' | 'created_at' | 'updated_at'> = {
  show_membership_status: true,
  show_order_badge: true,
  show_joined_date: true,
  show_city_region: true,
  show_lodge_info: true,
  show_order_track: true,
  show_order_activity: true,
  public_visibility: 'members-only',
};

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
  steward_name?: string;
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
  craft_house?: CraftHouse;
}

export interface CraftHouseMember {
  user_id: string;
  user_name?: string;
  role: CraftHouseRole;
  primary_track?: PrimaryTrack;
  city?: string;
  joined_at: string;
}

// ============ Craft House Discussion Types ============

export interface CraftHouseTopic {
  id: string;
  craft_house_id: number;
  name: string;
  slug: string;
  description?: string;
  icon?: string;
  sort_order: number;
  is_members_only: boolean;
  is_active: boolean;
  created_by?: string;
  thread_count: number;
  created_at: string;
  updated_at: string;
}

export interface CraftHouseThread {
  id: string;
  topic_id: string;
  user_id: string;
  title: string;
  content: string;
  is_pinned: boolean;
  is_announcement: boolean;
  is_locked: boolean;
  reply_count: number;
  view_count: number;
  last_activity_at: string;
  last_reply_by?: string;
  created_at: string;
  updated_at: string;
  user_name?: string;
  user_role?: CraftHouseRole;
  topic_name?: string;
  last_reply_by_name?: string;
}

export interface CraftHouseReply {
  id: string;
  thread_id: string;
  user_id: string;
  content: string;
  parent_reply_id?: string;
  is_edited: boolean;
  created_at: string;
  updated_at: string;
  user_name?: string;
  user_role?: CraftHouseRole;
}

export interface CraftHouseThreadDetail extends CraftHouseThread {
  replies: CraftHouseReply[];
  topic: CraftHouseTopic;
}

export interface CraftHouseTopicCreateRequest {
  name: string;
  slug?: string;
  description?: string;
  icon?: string;
  sort_order?: number;
  is_members_only?: boolean;
}

export interface CraftHouseTopicUpdateRequest {
  name?: string;
  description?: string;
  icon?: string;
  sort_order?: number;
  is_members_only?: boolean;
  is_active?: boolean;
}

export interface CraftHouseThreadCreateRequest {
  topic_id: string;
  title: string;
  content: string;
  is_announcement?: boolean;
}

export interface CraftHouseThreadUpdateRequest {
  title?: string;
  content?: string;
  is_locked?: boolean;
}

export interface CraftHouseReplyCreateRequest {
  content: string;
  parent_reply_id?: string;
}

export interface CraftHouseReplyUpdateRequest {
  content: string;
}

export interface CraftHouseMemberRoleUpdateRequest {
  role: CraftHouseRole;
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

// ============ Extended Dashboard Types ============

export interface OrderDashboardStatsExtended extends OrderDashboardStats {
  membership_tier?: MembershipTier;
  craft_houses: CraftHouseMembership[];
  fellowships: FellowshipMembership[];
  governance_positions: GovernancePosition[];
}

// ============ Event Types ============

export type OrderEventType = 'meetup' | 'workshop' | 'online' | 'screening' | 'regional' | 'conference';

export interface OrderEvent {
  id: number;
  title: string;
  description?: string;
  event_type: OrderEventType;
  start_date: string;
  end_date?: string;
  location?: string;
  is_online: boolean;
  online_link?: string;
  lodge_id?: number;
  lodge_name?: string;
  craft_house_id?: number;
  craft_house_name?: string;
  fellowship_id?: number;
  fellowship_name?: string;
  created_by?: string;
  created_by_name?: string;
  is_active: boolean;
  max_attendees?: number;
  rsvp_count: number;
  user_rsvp_status?: 'attending' | 'maybe' | 'declined';
  created_at: string;
  updated_at: string;
}

export interface OrderEventListResponse {
  events: OrderEvent[];
  total: number;
  skip: number;
  limit: number;
}

export interface OrderEventRSVP {
  id: number;
  event_id: number;
  user_id: string;
  user_name?: string;
  status: 'attending' | 'maybe' | 'declined';
  created_at: string;
}

export const EVENT_TYPES: { value: OrderEventType; label: string }[] = [
  { value: 'meetup', label: 'Meetup' },
  { value: 'workshop', label: 'Workshop' },
  { value: 'online', label: 'Online Event' },
  { value: 'screening', label: 'Screening' },
  { value: 'regional', label: 'Regional Gathering' },
  { value: 'conference', label: 'Conference' },
];

// ============ Request Types ============

export interface OrderApplicationCreateRequest {
  primary_track: PrimaryTrack;
  city?: string;
  region?: string;
  portfolio_links?: string;
  statement?: string;
  years_experience?: number;
  current_role?: string;
}

export interface OrderMemberProfileCreateRequest {
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

export interface OrderMemberProfileUpdateRequest {
  primary_track?: PrimaryTrack;
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

export interface LodgeCreateRequest {
  name: string;
  slug: string;
  city: string;
  region?: string;
  description?: string;
  base_lodge_dues_cents?: number;
  contact_email?: string;
  contact_user_id?: string;
}

export interface LodgeUpdateRequest {
  name?: string;
  city?: string;
  region?: string;
  status?: LodgeStatus;
  description?: string;
  base_lodge_dues_cents?: number;
  contact_email?: string;
  contact_user_id?: string;
}

export interface OrderJobCreateRequest {
  title: string;
  description: string;
  location?: string;
  job_type?: OrderJobType;
  roles_needed?: string;
  pay_info?: string;
  is_paid?: boolean;
  visibility?: OrderJobVisibility;
  lodge_id?: number;
  organization_name?: string;
  starts_at?: string;
  ends_at?: string;
  application_deadline?: string;
}

export interface OrderJobUpdateRequest {
  title?: string;
  description?: string;
  location?: string;
  job_type?: OrderJobType;
  roles_needed?: string;
  pay_info?: string;
  is_paid?: boolean;
  visibility?: OrderJobVisibility;
  is_active?: boolean;
  starts_at?: string;
  ends_at?: string;
  application_deadline?: string;
}

export interface OrderJobApplicationCreateRequest {
  cover_note?: string;
  portfolio_url?: string;
}

export interface OrderBookingRequestCreateRequest {
  target_user_id: string;
  requester_name: string;
  requester_email: string;
  requester_phone?: string;
  requester_org?: string;
  project_title?: string;
  details: string;
  location?: string;
  dates?: string;
  budget_range?: string;
  roles_needed?: string;
}

export interface OrderBookingRequestUpdateRequest {
  status: string;
  response_notes?: string;
}

// ============ Event Request Types ============

export interface OrderEventCreateRequest {
  title: string;
  description?: string;
  event_type: OrderEventType;
  start_date: string;
  end_date?: string;
  location?: string;
  is_online?: boolean;
  online_link?: string;
  lodge_id?: number;
  craft_house_id?: number;
  fellowship_id?: number;
  max_attendees?: number;
}

export interface OrderEventUpdateRequest {
  title?: string;
  description?: string;
  event_type?: OrderEventType;
  start_date?: string;
  end_date?: string;
  location?: string;
  is_online?: boolean;
  online_link?: string;
  max_attendees?: number;
  is_active?: boolean;
}

export interface OrderEventRSVPRequest {
  status: 'attending' | 'maybe' | 'declined';
}

// ============ Admin Request Types ============

export interface GovernancePositionCreateRequest {
  user_id: string;
  position_type: GovernancePositionType;
  scope_type?: GovernanceScopeType;
  scope_id?: number;
  title: string;
  description?: string;
}

export interface GovernancePositionUpdateRequest {
  title?: string;
  description?: string;
  is_active?: boolean;
  ended_at?: string;
}

export interface LodgeOfficerAppointRequest {
  user_id: string;
  officer_title: string;
}

export interface LodgeMembershipUpdateRequest {
  is_officer?: boolean;
  officer_title?: string;
  status?: LodgeMembershipStatus;
}

export interface CraftHouseLeadershipAppointRequest {
  user_id: string;
  role?: CraftHouseRole;
}

export interface CraftHouseMembershipUpdateRequest {
  role?: CraftHouseRole;
}

export interface FellowshipLeadershipAppointRequest {
  user_id: string;
  role?: FellowshipRole;
}

export interface FellowshipMembershipUpdateRequest {
  role?: FellowshipRole;
}

export interface MemberTierUpdateRequest {
  membership_tier: MembershipTier;
  reason?: string;
}

export interface MemberLodgeAssignmentRequest {
  lodge_id: number;
  is_officer?: boolean;
  officer_title?: string;
}

export interface MemberStatusUpdateRequest {
  status: OrderMemberStatus;
  reason?: string;
}

// ============ Response Types ============

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  skip: number;
  limit: number;
}

// ============ API Client ============

export class OrderAPI {
  private baseURL = '/api/v1/order';

  // ============ Application Endpoints ============

  /**
   * Submit application to join The Order
   */
  async submitApplication(application: OrderApplicationCreateRequest): Promise<OrderApplication> {
    return api.post(`${this.baseURL}/applications`, application);
  }

  /**
   * Get current user's application
   */
  async getMyApplication(): Promise<OrderApplication | null> {
    return api.get(`${this.baseURL}/applications/me`);
  }

  /**
   * List all applications (admin only)
   */
  async listApplications(options?: {
    status?: OrderApplicationStatus;
    skip?: number;
    limit?: number;
  }): Promise<{ applications: OrderApplication[]; total: number }> {
    const params = new URLSearchParams();
    if (options?.status) params.append('status', options.status);
    if (options?.skip !== undefined) params.append('skip', options.skip.toString());
    if (options?.limit !== undefined) params.append('limit', options.limit.toString());

    return api.get(`${this.baseURL}/applications?${params}`);
  }

  /**
   * Approve an application (admin only)
   */
  async approveApplication(applicationId: number): Promise<OrderApplication> {
    return api.post(`${this.baseURL}/applications/${applicationId}/approve`);
  }

  /**
   * Reject an application (admin only)
   */
  async rejectApplication(applicationId: number, reason?: string): Promise<OrderApplication> {
    return api.post(`${this.baseURL}/applications/${applicationId}/reject`, {
      status: 'rejected',
      rejection_reason: reason,
    });
  }

  // ============ Profile Endpoints ============

  /**
   * Get current user's Order profile
   */
  async getMyProfile(): Promise<OrderMemberProfile | null> {
    return api.get(`${this.baseURL}/profile/me`);
  }

  /**
   * Create or update Order profile
   */
  async saveProfile(profile: OrderMemberProfileCreateRequest): Promise<OrderMemberProfile> {
    return api.post(`${this.baseURL}/profile`, profile);
  }

  /**
   * Update Order profile fields
   */
  async updateProfile(update: OrderMemberProfileUpdateRequest): Promise<OrderMemberProfile> {
    return api.patch(`${this.baseURL}/profile`, update);
  }

  /**
   * Get Order member directory
   */
  async getDirectory(options?: {
    track?: PrimaryTrack;
    city?: string;
    lodge_id?: number;
    availability?: string;
    search?: string;
    skip?: number;
    limit?: number;
  }): Promise<OrderMemberDirectoryEntry[]> {
    const params = new URLSearchParams();
    if (options?.track) params.append('track', options.track);
    if (options?.city) params.append('city', options.city);
    if (options?.lodge_id) params.append('lodge_id', options.lodge_id.toString());
    if (options?.availability) params.append('availability', options.availability);
    if (options?.search) params.append('search', options.search);
    if (options?.skip !== undefined) params.append('skip', options.skip.toString());
    if (options?.limit !== undefined) params.append('limit', options.limit.toString());

    return api.get(`${this.baseURL}/directory?${params}`);
  }

  /**
   * Get a specific member's profile
   */
  async getMemberProfile(userId: string): Promise<OrderMemberProfile> {
    return api.get(`${this.baseURL}/members/${userId}`);
  }

  /**
   * List all members (admin only)
   */
  async listMembers(options?: {
    track?: PrimaryTrack;
    city?: string;
    lodge_id?: number;
    status?: OrderMemberStatus;
    skip?: number;
    limit?: number;
  }): Promise<{ members: OrderMemberProfile[]; total: number }> {
    const params = new URLSearchParams();
    if (options?.track) params.append('track', options.track);
    if (options?.city) params.append('city', options.city);
    if (options?.lodge_id) params.append('lodge_id', options.lodge_id.toString());
    if (options?.status) params.append('status', options.status);
    if (options?.skip !== undefined) params.append('skip', options.skip.toString());
    if (options?.limit !== undefined) params.append('limit', options.limit.toString());

    return api.get(`${this.baseURL}/members?${params}`);
  }

  /**
   * Update member status (admin only)
   */
  async updateMemberStatus(userId: string, status: OrderMemberStatus): Promise<OrderMemberProfile> {
    return api.patch(`${this.baseURL}/members/${userId}`, { status });
  }

  // ============ Lodge Endpoints ============

  /**
   * List all lodges
   */
  async listLodges(options?: {
    status?: LodgeStatus;
    city?: string;
  }): Promise<{ lodges: Lodge[]; total: number }> {
    const params = new URLSearchParams();
    if (options?.status) params.append('status', options.status);
    if (options?.city) params.append('city', options.city);

    return api.get(`${this.baseURL}/lodges?${params}`);
  }

  /**
   * Get lodge details
   */
  async getLodge(lodgeId: number): Promise<Lodge> {
    return api.get(`${this.baseURL}/lodges/${lodgeId}`);
  }

  /**
   * Join a lodge
   */
  async joinLodge(lodgeId: number): Promise<LodgeMembership> {
    return api.post(`${this.baseURL}/lodges/${lodgeId}/join`);
  }

  /**
   * Get current user's lodge memberships
   */
  async getMyLodgeMemberships(): Promise<LodgeMembership[]> {
    return api.get(`${this.baseURL}/lodges/my`);
  }

  /**
   * Create a new lodge (admin only)
   */
  async createLodge(lodge: LodgeCreateRequest): Promise<Lodge> {
    return api.post(`${this.baseURL}/lodges`, lodge);
  }

  /**
   * Update a lodge (admin only)
   */
  async updateLodge(lodgeId: number, update: LodgeUpdateRequest): Promise<Lodge> {
    return api.patch(`${this.baseURL}/lodges/${lodgeId}`, update);
  }

  // ============ Job Endpoints ============

  /**
   * List jobs
   */
  async listJobs(options?: {
    job_type?: OrderJobType;
    visibility?: OrderJobVisibility;
    lodge_id?: number;
    active_only?: boolean;
    skip?: number;
    limit?: number;
  }): Promise<{ jobs: OrderJob[]; total: number }> {
    const params = new URLSearchParams();
    if (options?.job_type) params.append('job_type', options.job_type);
    if (options?.visibility) params.append('visibility', options.visibility);
    if (options?.lodge_id) params.append('lodge_id', options.lodge_id.toString());
    if (options?.active_only !== undefined) params.append('active_only', options.active_only.toString());
    if (options?.skip !== undefined) params.append('skip', options.skip.toString());
    if (options?.limit !== undefined) params.append('limit', options.limit.toString());

    return api.get(`${this.baseURL}/jobs?${params}`);
  }

  /**
   * Get job details
   */
  async getJob(jobId: number): Promise<OrderJob> {
    return api.get(`${this.baseURL}/jobs/${jobId}`);
  }

  /**
   * Create a job posting
   */
  async createJob(job: OrderJobCreateRequest): Promise<OrderJob> {
    return api.post(`${this.baseURL}/jobs`, job);
  }

  /**
   * Update a job posting
   */
  async updateJob(jobId: number, update: OrderJobUpdateRequest): Promise<OrderJob> {
    return api.patch(`${this.baseURL}/jobs/${jobId}`, update);
  }

  /**
   * Apply to a job
   */
  async applyToJob(jobId: number, application: OrderJobApplicationCreateRequest): Promise<OrderJobApplication> {
    return api.post(`${this.baseURL}/jobs/${jobId}/apply`, application);
  }

  /**
   * Get current user's job applications
   */
  async getMyJobApplications(): Promise<{ applications: OrderJobApplication[]; total: number }> {
    return api.get(`${this.baseURL}/jobs/applications/my`);
  }

  // ============ Booking Request Endpoints ============

  /**
   * Create a booking request
   */
  async createBookingRequest(request: OrderBookingRequestCreateRequest): Promise<OrderBookingRequest> {
    return api.post(`${this.baseURL}/booking-requests`, request);
  }

  /**
   * Get current user's booking requests (as target)
   */
  async getMyBookingRequests(): Promise<OrderBookingRequest[]> {
    return api.get(`${this.baseURL}/booking-requests/my`);
  }

  /**
   * Update a booking request
   */
  async updateBookingRequest(requestId: number, update: OrderBookingRequestUpdateRequest): Promise<OrderBookingRequest> {
    return api.patch(`${this.baseURL}/booking-requests/${requestId}`, update);
  }

  // ============ Dashboard & Stats Endpoints ============

  /**
   * Get Order dashboard stats for current user
   */
  async getDashboard(): Promise<OrderDashboardStats> {
    return api.get(`${this.baseURL}/dashboard`);
  }

  /**
   * Get admin stats
   */
  async getAdminStats(): Promise<OrderAdminStats> {
    return api.get(`${this.baseURL}/admin/stats`);
  }

  // ============ Craft House Endpoints ============

  /**
   * List all craft houses
   */
  async listCraftHouses(options?: {
    status?: CraftHouseStatus;
  }): Promise<{ craft_houses: CraftHouse[]; total: number }> {
    const params = new URLSearchParams();
    if (options?.status) params.append('status', options.status);
    return api.get(`${this.baseURL}/craft-houses?${params}`);
  }

  /**
   * Get craft house details
   */
  async getCraftHouse(craftHouseId: number): Promise<CraftHouse> {
    return api.get(`${this.baseURL}/craft-houses/${craftHouseId}`);
  }

  /**
   * Get craft house by slug
   */
  async getCraftHouseBySlug(slug: string): Promise<CraftHouse> {
    return api.get(`${this.baseURL}/craft-houses/slug/${slug}`);
  }

  /**
   * Get craft house members
   */
  async getCraftHouseMembers(craftHouseId: number): Promise<{ members: CraftHouseMember[]; total: number }> {
    return api.get(`${this.baseURL}/craft-houses/${craftHouseId}/members`);
  }

  /**
   * Join a craft house
   */
  async joinCraftHouse(craftHouseId: number): Promise<CraftHouseMembership> {
    return api.post(`${this.baseURL}/craft-houses/${craftHouseId}/join`);
  }

  /**
   * Leave a craft house
   */
  async leaveCraftHouse(craftHouseId: number): Promise<void> {
    return api.delete(`${this.baseURL}/craft-houses/${craftHouseId}/leave`);
  }

  /**
   * Get current user's craft house memberships
   */
  async getMyCraftHouseMemberships(): Promise<CraftHouseMembership[]> {
    return api.get(`${this.baseURL}/craft-houses/my/memberships`);
  }

  // ============ Craft House Discussion Endpoints ============

  /**
   * List topics for a craft house
   */
  async listCraftHouseTopics(craftHouseId: number, options?: {
    include_inactive?: boolean;
  }): Promise<{ topics: CraftHouseTopic[]; total: number }> {
    const params = new URLSearchParams();
    if (options?.include_inactive) params.append('include_inactive', 'true');
    return api.get(`${this.baseURL}/craft-houses/${craftHouseId}/topics?${params}`);
  }

  /**
   * Create a topic in a craft house (steward only)
   */
  async createCraftHouseTopic(craftHouseId: number, topic: CraftHouseTopicCreateRequest): Promise<CraftHouseTopic> {
    return api.post(`${this.baseURL}/craft-houses/${craftHouseId}/topics`, topic);
  }

  /**
   * Update a craft house topic (steward only)
   */
  async updateCraftHouseTopic(topicId: string, update: CraftHouseTopicUpdateRequest): Promise<CraftHouseTopic> {
    return api.patch(`${this.baseURL}/craft-houses/topics/${topicId}`, update);
  }

  /**
   * List threads in a craft house
   */
  async listCraftHouseThreads(craftHouseId: number, options?: {
    topic_id?: string;
    skip?: number;
    limit?: number;
  }): Promise<{ threads: CraftHouseThread[]; total: number }> {
    const params = new URLSearchParams();
    if (options?.topic_id) params.append('topic_id', options.topic_id);
    if (options?.skip !== undefined) params.append('skip', options.skip.toString());
    if (options?.limit !== undefined) params.append('limit', options.limit.toString());
    return api.get(`${this.baseURL}/craft-houses/${craftHouseId}/threads?${params}`);
  }

  /**
   * Create a thread in a craft house (member only)
   */
  async createCraftHouseThread(craftHouseId: number, thread: CraftHouseThreadCreateRequest): Promise<CraftHouseThread> {
    return api.post(`${this.baseURL}/craft-houses/${craftHouseId}/threads`, thread);
  }

  /**
   * Get a thread with its replies
   */
  async getCraftHouseThread(threadId: string): Promise<CraftHouseThreadDetail> {
    return api.get(`${this.baseURL}/craft-houses/threads/${threadId}`);
  }

  /**
   * Update a thread (author or steward)
   */
  async updateCraftHouseThread(threadId: string, update: CraftHouseThreadUpdateRequest): Promise<CraftHouseThread> {
    return api.patch(`${this.baseURL}/craft-houses/threads/${threadId}`, update);
  }

  /**
   * Delete a thread (author or steward)
   */
  async deleteCraftHouseThread(threadId: string): Promise<void> {
    return api.delete(`${this.baseURL}/craft-houses/threads/${threadId}`);
  }

  /**
   * Toggle pin status of a thread (steward only)
   */
  async toggleCraftHouseThreadPin(threadId: string): Promise<CraftHouseThread> {
    return api.post(`${this.baseURL}/craft-houses/threads/${threadId}/pin`);
  }

  /**
   * Create a reply to a thread
   */
  async createCraftHouseReply(threadId: string, reply: CraftHouseReplyCreateRequest): Promise<CraftHouseReply> {
    return api.post(`${this.baseURL}/craft-houses/threads/${threadId}/replies`, reply);
  }

  /**
   * Update a reply (author only)
   */
  async updateCraftHouseReply(replyId: string, update: CraftHouseReplyUpdateRequest): Promise<CraftHouseReply> {
    return api.patch(`${this.baseURL}/craft-houses/replies/${replyId}`, update);
  }

  /**
   * Delete a reply (author or steward)
   */
  async deleteCraftHouseReply(replyId: string): Promise<void> {
    return api.delete(`${this.baseURL}/craft-houses/replies/${replyId}`);
  }

  /**
   * Update a member's role in a craft house (steward only)
   */
  async updateCraftHouseMemberRole(craftHouseId: number, userId: string, update: CraftHouseMemberRoleUpdateRequest): Promise<CraftHouseMembership> {
    return api.post(`${this.baseURL}/craft-houses/${craftHouseId}/members/${userId}/role`, update);
  }

  // ============ Fellowship Endpoints ============

  /**
   * List all fellowships
   */
  async listFellowships(options?: {
    fellowship_type?: FellowshipType;
    status?: CraftHouseStatus;
    visible_only?: boolean;
  }): Promise<{ fellowships: Fellowship[]; total: number }> {
    const params = new URLSearchParams();
    if (options?.fellowship_type) params.append('fellowship_type', options.fellowship_type);
    if (options?.status) params.append('status', options.status);
    if (options?.visible_only !== undefined) params.append('visible_only', options.visible_only.toString());
    return api.get(`${this.baseURL}/fellowships?${params}`);
  }

  /**
   * Get fellowship details
   */
  async getFellowship(fellowshipId: number): Promise<Fellowship> {
    return api.get(`${this.baseURL}/fellowships/${fellowshipId}`);
  }

  /**
   * Get fellowship by slug
   */
  async getFellowshipBySlug(slug: string): Promise<Fellowship> {
    return api.get(`${this.baseURL}/fellowships/slug/${slug}`);
  }

  /**
   * Join a fellowship
   */
  async joinFellowship(fellowshipId: number): Promise<FellowshipMembership> {
    return api.post(`${this.baseURL}/fellowships/${fellowshipId}/join`);
  }

  /**
   * Leave a fellowship
   */
  async leaveFellowship(fellowshipId: number): Promise<void> {
    return api.delete(`${this.baseURL}/fellowships/${fellowshipId}/leave`);
  }

  /**
   * Get current user's fellowship memberships
   */
  async getMyFellowshipMemberships(): Promise<FellowshipMembership[]> {
    return api.get(`${this.baseURL}/fellowships/my`);
  }

  // ============ Governance Endpoints ============

  /**
   * List governance positions
   */
  async listGovernancePositions(options?: {
    position_type?: GovernancePositionType;
    scope_type?: GovernanceScopeType;
    scope_id?: number;
    active_only?: boolean;
  }): Promise<{ positions: GovernancePosition[]; total: number }> {
    const params = new URLSearchParams();
    if (options?.position_type) params.append('position_type', options.position_type);
    if (options?.scope_type) params.append('scope_type', options.scope_type);
    if (options?.scope_id !== undefined) params.append('scope_id', options.scope_id.toString());
    if (options?.active_only !== undefined) params.append('active_only', options.active_only.toString());
    return api.get(`${this.baseURL}/governance/positions?${params}`);
  }

  /**
   * Get High Council (Grand Master + Council Members)
   */
  async getHighCouncil(): Promise<HighCouncil> {
    return api.get(`${this.baseURL}/governance/high-council`);
  }

  // ============ Membership Tier Endpoints ============

  /**
   * Get membership tier info
   */
  async getMembershipTiers(): Promise<MembershipTierInfo[]> {
    return api.get(`${this.baseURL}/membership/tiers`);
  }

  /**
   * Get current user's membership status
   */
  async getMyMembershipStatus(): Promise<MembershipStatus> {
    return api.get(`${this.baseURL}/membership/me`);
  }

  /**
   * Get extended dashboard with Craft Houses, Fellowships, and Governance
   */
  async getDashboardExtended(): Promise<OrderDashboardStatsExtended> {
    return api.get(`${this.baseURL}/dashboard/extended`);
  }

  // ============ Event Endpoints ============

  /**
   * List Order events
   */
  async listEvents(options?: {
    event_type?: OrderEventType;
    lodge_id?: number;
    craft_house_id?: number;
    fellowship_id?: number;
    upcoming_only?: boolean;
    skip?: number;
    limit?: number;
  }): Promise<OrderEventListResponse> {
    const params = new URLSearchParams();
    if (options?.event_type) params.append('event_type', options.event_type);
    if (options?.lodge_id) params.append('lodge_id', options.lodge_id.toString());
    if (options?.craft_house_id) params.append('craft_house_id', options.craft_house_id.toString());
    if (options?.fellowship_id) params.append('fellowship_id', options.fellowship_id.toString());
    if (options?.upcoming_only !== undefined) params.append('upcoming_only', options.upcoming_only.toString());
    if (options?.skip !== undefined) params.append('skip', options.skip.toString());
    if (options?.limit !== undefined) params.append('limit', options.limit.toString());
    return api.get(`${this.baseURL}/events?${params}`);
  }

  /**
   * Get a single event by ID
   */
  async getEvent(eventId: number): Promise<OrderEvent> {
    return api.get(`${this.baseURL}/events/${eventId}`);
  }

  /**
   * Create a new event
   */
  async createEvent(event: OrderEventCreateRequest): Promise<OrderEvent> {
    return api.post(`${this.baseURL}/events`, event);
  }

  /**
   * Update an event
   */
  async updateEvent(eventId: number, update: OrderEventUpdateRequest): Promise<OrderEvent> {
    return api.patch(`${this.baseURL}/events/${eventId}`, update);
  }

  /**
   * Delete/cancel an event
   */
  async deleteEvent(eventId: number): Promise<void> {
    return api.delete(`${this.baseURL}/events/${eventId}`);
  }

  /**
   * RSVP to an event
   */
  async rsvpToEvent(eventId: number, rsvp: OrderEventRSVPRequest): Promise<OrderEventRSVP> {
    return api.post(`${this.baseURL}/events/${eventId}/rsvp`, rsvp);
  }

  /**
   * Cancel RSVP to an event
   */
  async cancelRsvp(eventId: number): Promise<void> {
    return api.delete(`${this.baseURL}/events/${eventId}/rsvp`);
  }

  /**
   * Get RSVPs for an event (event creator and admins only)
   */
  async getEventRsvps(eventId: number): Promise<OrderEventRSVP[]> {
    return api.get(`${this.baseURL}/events/${eventId}/rsvps`);
  }

  // ============ Admin Governance Endpoints ============

  /**
   * Create a governance position (admin only)
   */
  async createGovernancePosition(position: GovernancePositionCreateRequest): Promise<GovernancePosition> {
    return api.post(`${this.baseURL}/admin/governance/positions`, position);
  }

  /**
   * Update a governance position (admin only)
   */
  async updateGovernancePosition(positionId: number, update: GovernancePositionUpdateRequest): Promise<GovernancePosition> {
    return api.patch(`${this.baseURL}/admin/governance/positions/${positionId}`, update);
  }

  /**
   * End/remove a governance position (admin only)
   */
  async removeGovernancePosition(positionId: number): Promise<void> {
    return api.delete(`${this.baseURL}/admin/governance/positions/${positionId}`);
  }

  // ============ Admin Lodge Endpoints ============

  /**
   * Appoint a lodge officer (admin only)
   */
  async appointLodgeOfficer(lodgeId: number, appointment: LodgeOfficerAppointRequest): Promise<LodgeMembership> {
    return api.post(`${this.baseURL}/admin/lodges/${lodgeId}/officers`, appointment);
  }

  /**
   * Remove a lodge officer (admin only)
   */
  async removeLodgeOfficer(lodgeId: number, userId: string): Promise<void> {
    return api.delete(`${this.baseURL}/admin/lodges/${lodgeId}/officers/${userId}`);
  }

  /**
   * Update a lodge membership (admin only)
   */
  async updateLodgeMembership(membershipId: number, update: LodgeMembershipUpdateRequest): Promise<LodgeMembership> {
    return api.patch(`${this.baseURL}/admin/lodge-memberships/${membershipId}`, update);
  }

  /**
   * List all members in a lodge (admin only)
   */
  async listLodgeMembers(lodgeId: number, options?: { skip?: number; limit?: number }): Promise<{ members: OrderMemberProfile[]; total: number }> {
    const params = new URLSearchParams();
    if (options?.skip !== undefined) params.append('skip', options.skip.toString());
    if (options?.limit !== undefined) params.append('limit', options.limit.toString());
    return api.get(`${this.baseURL}/admin/lodges/${lodgeId}/members?${params}`);
  }

  // ============ Admin Craft House Endpoints ============

  /**
   * Appoint craft house leadership (admin only)
   */
  async appointCraftHouseLeadership(craftHouseId: number, appointment: CraftHouseLeadershipAppointRequest): Promise<CraftHouseMembership> {
    return api.post(`${this.baseURL}/admin/craft-houses/${craftHouseId}/leadership`, appointment);
  }

  /**
   * Remove craft house leadership (admin only)
   */
  async removeCraftHouseLeadership(craftHouseId: number, userId: string): Promise<void> {
    return api.delete(`${this.baseURL}/admin/craft-houses/${craftHouseId}/leadership/${userId}`);
  }

  /**
   * Update a craft house membership (admin only)
   */
  async updateCraftHouseMembership(membershipId: number, update: CraftHouseMembershipUpdateRequest): Promise<CraftHouseMembership> {
    return api.patch(`${this.baseURL}/admin/craft-house-memberships/${membershipId}`, update);
  }

  // ============ Admin Fellowship Endpoints ============

  /**
   * Appoint fellowship leadership (admin only)
   */
  async appointFellowshipLeadership(fellowshipId: number, appointment: FellowshipLeadershipAppointRequest): Promise<FellowshipMembership> {
    return api.post(`${this.baseURL}/admin/fellowships/${fellowshipId}/leadership`, appointment);
  }

  /**
   * Remove fellowship leadership (admin only)
   */
  async removeFellowshipLeadership(fellowshipId: number, userId: string): Promise<void> {
    return api.delete(`${this.baseURL}/admin/fellowships/${fellowshipId}/leadership/${userId}`);
  }

  /**
   * Update a fellowship membership (admin only)
   */
  async updateFellowshipMembership(membershipId: number, update: FellowshipMembershipUpdateRequest): Promise<FellowshipMembership> {
    return api.patch(`${this.baseURL}/admin/fellowship-memberships/${membershipId}`, update);
  }

  // ============ Admin Member Management Endpoints ============

  /**
   * List all Order members with filters (admin only)
   */
  async listAllMembers(options?: {
    status?: OrderMemberStatus;
    tier?: MembershipTier;
    lodge_id?: number;
    track?: PrimaryTrack;
    search?: string;
    skip?: number;
    limit?: number;
  }): Promise<{ members: OrderMemberProfile[]; total: number; skip: number; limit: number }> {
    const params = new URLSearchParams();
    if (options?.status) params.append('status', options.status);
    if (options?.tier) params.append('tier', options.tier);
    if (options?.lodge_id !== undefined) params.append('lodge_id', options.lodge_id.toString());
    if (options?.track) params.append('track', options.track);
    if (options?.search) params.append('search', options.search);
    if (options?.skip !== undefined) params.append('skip', options.skip.toString());
    if (options?.limit !== undefined) params.append('limit', options.limit.toString());
    return api.get(`${this.baseURL}/admin/members?${params}`);
  }

  /**
   * Update member tier (admin only)
   */
  async updateMemberTier(userId: string, update: MemberTierUpdateRequest): Promise<OrderMemberProfile> {
    return api.patch(`${this.baseURL}/admin/members/${userId}/tier`, update);
  }

  /**
   * Assign member to a lodge (admin only)
   */
  async assignMemberToLodge(userId: string, assignment: MemberLodgeAssignmentRequest): Promise<OrderMemberProfile> {
    return api.patch(`${this.baseURL}/admin/members/${userId}/lodge`, assignment);
  }

  /**
   * Remove member from their lodge (admin only)
   */
  async removeMemberFromLodge(userId: string): Promise<void> {
    return api.delete(`${this.baseURL}/admin/members/${userId}/lodge`);
  }

  /**
   * Update member status (admin only)
   */
  async updateMemberStatusAdmin(userId: string, update: MemberStatusUpdateRequest): Promise<OrderMemberProfile> {
    return api.patch(`${this.baseURL}/admin/members/${userId}/status`, update);
  }
}

// Export singleton instance
export const orderAPI = new OrderAPI();
