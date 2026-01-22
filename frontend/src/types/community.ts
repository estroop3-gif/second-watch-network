/**
 * Community Hub Type Definitions
 */
import type { ProductionType, UnionType, TvNetwork, CustomQuestion } from './productions';

// Collab types
export type CollabType = 'looking_for_crew' | 'looking_for_cast' | 'available_for_hire' | 'partner_opportunity';
export type TapeWorkflow = 'upfront' | 'after_shortlist';
export type CompensationType = 'paid' | 'unpaid' | 'deferred' | 'negotiable';
export type JobType = 'freelance' | 'full_time';

// Company type
export interface Company {
  id: string;
  name: string;
  slug?: string | null;
  logo_url?: string | null;
  website?: string | null;
  is_verified?: boolean;
}

export type CollabApprovalStatus = 'pending' | 'approved' | 'rejected';

export interface CommunityCollab {
  id: string;
  user_id: string;
  title: string;
  type: CollabType;
  description: string;
  location: string | null;
  is_remote: boolean;
  compensation_type: CompensationType | null;
  start_date: string | null;
  end_date: string | null;
  tags: string[];
  is_active: boolean;
  is_order_only: boolean;
  // Job type (freelance vs full-time)
  job_type?: JobType;
  // Backlot project link (when posted from Backlot)
  backlot_project_id?: string | null;
  // Approval status fields
  approval_status?: CollabApprovalStatus;
  approved_by?: string | null;
  approved_at?: string | null;
  rejection_reason?: string | null;
  // Application count (from project collabs endpoint)
  application_count?: number;
  // Production info
  production_id?: string | null;
  production_title?: string | null;
  production_type?: ProductionType | null;
  company?: string | null;
  company_id?: string | null;
  network_id?: string | null;
  hide_production_info?: boolean;
  // Freelance compensation
  day_rate_min?: number | null;
  day_rate_max?: number | null;
  // Full-time compensation
  salary_min?: number | null;
  salary_max?: number | null;
  benefits_info?: string | null;
  // Application requirements
  requires_local_hire?: boolean;
  requires_order_member?: boolean;
  requires_resume?: boolean;
  application_deadline?: string | null;
  max_applications?: number | null;
  // Union and Order requirements
  union_requirements?: UnionType[];
  requires_order_membership?: boolean;
  // Custom questions
  custom_questions?: CustomQuestion[];
  // Featured post
  is_featured?: boolean;
  featured_until?: string | null;
  stripe_payment_id?: string | null;
  // Cast-specific fields
  requires_reel?: boolean;
  requires_headshot?: boolean;
  requires_self_tape?: boolean;
  tape_instructions?: string | null;
  tape_format_preferences?: string | null;
  tape_workflow?: TapeWorkflow;
  cast_position_type_id?: string | null;
  // Joined cast position type data
  cast_position_type?: {
    id: string;
    name: string;
    slug: string;
  } | null;
  // Crew position for scoring
  crew_position?: string | null;
  crew_department?: string | null;
  created_at: string;
  updated_at: string;
  // Joined data
  network?: TvNetwork;
  company_data?: Company;
  // Joined profile data
  profile?: {
    username: string | null;
    full_name: string | null;
    display_name: string | null;
    avatar_url: string | null;
    role: string | null;
    is_order_member?: boolean;
  };
}

// Topic types
export interface CommunityTopic {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  icon: string;
  sort_order: number;
  is_active: boolean;
  created_at: string;
  thread_count?: number;
}

// Thread types
export interface CommunityThread {
  id: string;
  topic_id: string;
  user_id: string;
  title: string;
  body: string;
  is_pinned: boolean;
  is_locked: boolean;
  reply_count: number;
  last_activity_at: string;
  created_at: string;
  updated_at: string;
  // Joined data
  topic?: CommunityTopic;
  profile?: {
    username: string | null;
    full_name: string | null;
    display_name: string | null;
    avatar_url: string | null;
    role: string | null;
    is_order_member?: boolean;
  };
}

// Reply types
export interface CommunityReply {
  id: string;
  thread_id: string;
  user_id: string;
  body: string;
  created_at: string;
  updated_at: string;
  // Joined profile data
  profile?: {
    username: string | null;
    full_name: string | null;
    display_name: string | null;
    avatar_url: string | null;
    role: string | null;
    is_order_member?: boolean;
  };
}

// Activity feed types
export type ActivityType = 'collab' | 'thread';

export interface CommunityActivity {
  activity_type: ActivityType;
  id: string;
  title: string;
  body: string;
  subtype: string;
  user_id: string;
  created_at: string;
  topic_id: string | null;
  topic_name: string | null;
  // Joined profile data
  profile?: {
    username: string | null;
    full_name: string | null;
    display_name: string | null;
    avatar_url: string | null;
    role: string | null;
    is_order_member?: boolean;
  };
}

// Extended profile for people directory
export interface CommunityMember {
  profile_id: string;
  username: string | null;
  full_name: string | null;
  display_name: string | null;
  avatar_url: string | null;
  bio?: string | null;
  location?: string | null;
  role: string | null;
  roles?: string[] | null;
  skills?: string[] | null;
  department?: string | null;
  experience_level?: string | null;
  is_order_member?: boolean;
  is_lodge_officer?: boolean;
  looking_for_work?: boolean;
  hiring?: boolean;
  open_to_collabs?: boolean;
  created_at: string;
  updated_at: string;
}

// Filter types
export interface PeopleFilters {
  search: string;
  roles: string[];
  lookingForWork: boolean;
  hiring: boolean;
  openToCollabs: boolean;
  orderMembersOnly: boolean;
  inLodge: boolean;
}

export interface CollabFilters {
  type: CollabType | 'all';
  isRemote: boolean | null;
  compensationType: CompensationType | 'all';
  orderOnly: boolean;
}

// =====================================================
// COMMUNITY FEED TYPES
// =====================================================

export type PostVisibility = 'public' | 'connections';

export interface PostImage {
  url: string;
  alt?: string;
  width?: number;
  height?: number;
}

export interface PostLinkPreview {
  url: string;
  title?: string;
  description?: string;
  image?: string;
  site_name?: string;
}

export interface PostAuthor {
  id: string;
  username: string | null;
  full_name: string | null;
  display_name: string | null;
  avatar_url: string | null;
  role?: string | null;
  is_order_member?: boolean;
}

export interface CommunityPost {
  id: string;
  user_id: string;
  content: string;
  images: PostImage[];
  link_url?: string | null;
  link_title?: string | null;
  link_description?: string | null;
  link_image?: string | null;
  link_site_name?: string | null;
  visibility: PostVisibility;
  like_count: number;
  comment_count: number;
  is_hidden: boolean;
  is_profile_update?: boolean;
  created_at: string;
  updated_at: string;
  // Joined data
  author?: PostAuthor;
  // User interaction state
  is_liked?: boolean;
}

export interface PostComment {
  id: string;
  post_id: string;
  user_id: string;
  parent_comment_id?: string | null;
  content: string;
  is_hidden: boolean;
  created_at: string;
  updated_at: string;
  // Joined data
  author?: PostAuthor;
}

export interface FeedResponse {
  posts: CommunityPost[];
  next_cursor: string | null;
}

// Input types for creating/updating
export interface PostInput {
  content: string;
  images?: PostImage[];
  link_url?: string;
  link_title?: string;
  link_description?: string;
  link_image?: string;
  link_site_name?: string;
  visibility: PostVisibility;
  is_profile_update?: boolean;
}

export interface PostUpdateInput {
  content?: string;
  visibility?: PostVisibility;
}

export interface CommentInput {
  content: string;
  parent_comment_id?: string;
}
