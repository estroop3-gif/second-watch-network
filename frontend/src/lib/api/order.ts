/**
 * Second Watch Order API Client
 * The Order is a professional, God-centered guild for filmmakers and crew.
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
  | 'other';

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
  { value: 'other', label: 'Other' },
];

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
}

// Export singleton instance
export const orderAPI = new OrderAPI();
