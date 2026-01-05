// This file is for sharing common type definitions across the application.

// Dashboard customization
export * from './dashboard';

// Theme system
export * from './theme';

export type ForumThread = {
  id: string;
  title: string;
  body: string;
  created_at: string;
  last_reply_at: string;
  is_pinned: boolean;
  is_anonymous: boolean;
  tags: string[] | null;
  username: string | null;
  avatar_url: string | null;
  roles: string[] | null;
  full_name: string | null;
  display_name: string | null;
  replies_count: number;
  category_name: string | null;
  category_slug: string | null;
};

export type ForumReply = {
  id: string;
  body: string;
  created_at: string;
  user_id: string;
  username: string | null;
  avatar_url: string | null;
  roles: string[] | null;
  full_name: string | null;
  display_name: string | null;
};

export interface Profile {
  id: string;
  username: string | null;
  avatar_url: string | null;
  full_name: string | null;
  display_name: string | null;
  role: string | null;
  roles: string[] | null;
  location_visible: boolean;
  has_completed_filmmaker_onboarding: boolean;
}

export interface FilmmakerProfileData extends Profile {
  user_id: string;
  bio?: string;
  reel_links?: string[];
  portfolio_website?: string;
  location?: string;
  department?: string;
  experience_level?: string;
  skills?: string[];
  accepting_work?: boolean;
  available_for?: string[];
  preferred_locations?: string[];
  contact_method?: string;
  show_email?: boolean;
  profile_image_url?: string;
}

export type FilmmakerApplication = {
  id: string;
  user_id: string;
  full_name: string;
  display_name: string;
  email: string;
  location?: string;
  portfolio_link?: string;
  professional_profile_link?: string;
  years_of_experience?: string;
  primary_roles?: string[];
  top_projects?: { title: string; role: string; link?: string; description: string }[];
  join_reason?: string;
  status: 'pending' | 'approved' | 'rejected';
  created_at: string;
  profile?: Profile;
};

export type PartnerApplication = {
  id: string;
  user_id: string | null;
  // New fields from public form
  full_name: string | null;
  company_name: string | null;
  phone: string | null;
  website_url: string | null;
  primary_platforms: string[] | null;
  audience_size: string | null;
  content_focus: string | null;
  sample_links: string | null;
  location: string | null;
  message: string | null;
  admin_notes: string | null;
  status: 'new' | 'under_review' | 'approved' | 'rejected';
  created_at: string;
  updated_at: string;
  // Legacy fields (still present in DB)
  brand_name?: string | null;
  website?: string | null;
  contact_name?: string | null;
  contact_email?: string | null;
  partnership_type?: string | null;
};

export type SubscriptionActivity = {
  id: string;
  user_id: string;
  created_at: string;
  event_type: string;
  details: {
    plan?: string;
    billing_cycle?: 'monthly' | 'yearly';
    message?: string;
  } | null;
};

// Add: CommunityProfile type used by the Community list
export type CommunityProfile = {
  profile_id: string;
  username: string | null;
  full_name: string | null;
  display_name: string | null;
  avatar_url: string | null;
  created_at: string;
  updated_at: string;
};

// Desktop API Keys for SWN Dailies Helper
export type DesktopKey = {
  id: string;
  key_prefix: string;
  name: string;
  last_used_at: string | null;
  created_at: string;
  is_active: boolean;
};

export type DesktopKeyCreateResponse = {
  id: string;
  key: string;  // Only returned at creation time
  key_prefix: string;
  name: string;
  created_at: string;
};

export type DesktopKeyVerifyResponse = {
  valid: boolean;
  user?: {
    id: string;
    email: string;
    display_name: string;
  };
  projects?: Array<{
    id: string;
    name: string;
    role: string;
  }>;
};