/**
 * Community Hub Type Definitions
 */

// Collab types
export type CollabType = 'looking_for_crew' | 'available_for_hire' | 'partner_opportunity';
export type CompensationType = 'paid' | 'unpaid' | 'deferred' | 'negotiable';

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
