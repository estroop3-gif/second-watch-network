/**
 * Application Types
 * Types for application templates, collab applications, and role applications
 */
import type { CustomQuestionResponses } from './productions';

// Application status for both collab and role applications
export type ApplicationStatus =
  | 'applied'
  | 'viewed'
  | 'shortlisted'
  | 'interview'
  | 'offered'
  | 'booked'
  | 'rejected'
  | 'withdrawn';

// Score breakdown for applicant matching
export interface RoleCreditsScore {
  score: number;
  exact_matches: number;
  department_matches: number;
  transferable_matches: number;
  exact_match_credits?: Array<{
    role: string;
    project: string;
  }>;
  dept_match_credits?: Array<{
    role: string;
    department: string;
    project: string;
  }>;
  transferable_credits?: Array<{
    role: string;
    category: string;
    project: string;
  }>;
}

export interface ExperienceScore {
  score: number;
  total_credits: number;
}

export interface NetworkScore {
  score: number;
  direct_connections: number;
  shared_projects: number;
  connected_to?: string[];
}

export interface ScoreBreakdown {
  role_credits: RoleCreditsScore;
  experience: ExperienceScore;
  network: NetworkScore;
  total: number;
}

// Application Template - saved reusable application data
export interface ApplicationTemplate {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  is_default: boolean;
  cover_letter: string | null;
  elevator_pitch: string | null;
  rate_expectation: string | null;
  availability_notes: string | null;
  default_reel_url: string | null;
  default_headshot_url: string | null;
  default_resume_url: string | null;
  default_resume_id: string | null;
  default_credit_ids: string[];
  use_count: number;
  last_used_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface ApplicationTemplateInput {
  name: string;
  description?: string;
  is_default?: boolean;
  cover_letter?: string;
  elevator_pitch?: string;
  availability_notes?: string;
  default_resume_id?: string;
  default_credit_ids?: string[];
}

// Cover Letter Template - saved reusable cover letters
export interface CoverLetterTemplate {
  id: string;
  user_id: string;
  name: string;
  content: string;
  is_default: boolean;
  use_count: number;
  last_used_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface CoverLetterTemplateInput {
  name: string;
  content: string;
  is_default?: boolean;
}

// User Resume - uploaded resume files
export interface UserResume {
  id: string;
  user_id: string;
  name: string;
  file_key: string;
  file_url: string;
  file_size: number | null;
  file_type: string;
  is_default: boolean;
  created_at: string;
  updated_at: string;
}

// Unified application input that works for both collab and role applications
export interface UnifiedApplicationInput {
  elevator_pitch?: string;
  cover_note?: string;
  availability_notes?: string;
  resume_id?: string;
  selected_credit_ids?: string[];
  template_id?: string;
  local_hire_confirmed?: boolean;
  is_promoted?: boolean;
  save_as_template?: boolean;
  template_name?: string;
  // Cover letter template handling
  cover_letter_template_id?: string;
  save_cover_letter_as_template?: boolean;
  cover_letter_template_name?: string;
  // Custom question responses
  custom_question_responses?: CustomQuestionResponses;
  // Cast-specific fields
  demo_reel_url?: string;
  self_tape_url?: string;
  headshot_url?: string;
  special_skills?: string[];
}

// Profile snapshot captured at application time
export interface ApplicantProfileSnapshot {
  id: string;
  username: string;
  full_name?: string;
  display_name?: string;
  avatar_url?: string;
  role?: string;
  is_order_member?: boolean;
}

// Community Collab Application
export interface CollabApplication {
  id: string;
  collab_id: string;
  applicant_user_id: string;
  applicant_profile_snapshot: ApplicantProfileSnapshot;
  elevator_pitch: string | null;
  cover_note: string | null;
  availability_notes: string | null;
  rate_expectation: string | null;
  reel_url: string | null;
  headshot_url: string | null;
  resume_url: string | null;
  selected_credit_ids: string[];
  selected_credits?: SelectableCredit[];
  template_id: string | null;
  local_hire_confirmed: boolean | null;
  is_promoted: boolean;
  promoted_at: string | null;
  status: ApplicationStatus;
  status_changed_at: string | null;
  internal_notes: string | null;
  rating: number | null;
  custom_question_responses: CustomQuestionResponses | null;
  // Match score fields
  match_score: number | null;
  score_breakdown: ScoreBreakdown | null;
  score_calculated_at: string | null;
  // Cast-specific fields
  demo_reel_url: string | null;
  self_tape_url: string | null;
  special_skills: string[] | null;
  tape_requested_at: string | null;
  tape_submitted_at: string | null;
  created_at: string;
  updated_at: string;
  // Joined data
  collab?: {
    id: string;
    title: string;
    type: string;
    location?: string;
    is_remote?: boolean;
    user_id: string;
    owner_profile?: {
      id: string;
      username: string;
      full_name?: string;
      display_name?: string;
      avatar_url?: string;
    };
  };
  current_profile?: ApplicantProfileSnapshot;
}

// Backlot Role Application
export interface RoleApplication {
  id: string;
  role_id: string;
  applicant_user_id: string;
  applicant_profile_snapshot: ApplicantProfileSnapshot;
  elevator_pitch: string | null;
  cover_note: string | null;
  availability_notes: string | null;
  rate_expectation: string | null;
  reel_url: string | null;
  headshot_url: string | null;
  resume_url: string | null;
  selected_credit_ids: string[];
  selected_credits?: SelectableCredit[];
  template_id: string | null;
  local_hire_confirmed: boolean | null;
  is_promoted: boolean;
  promoted_at: string | null;
  status: ApplicationStatus;
  status_changed_at: string | null;
  status_changed_by_user_id: string | null;
  internal_notes: string | null;
  rating: number | null;
  custom_question_responses: CustomQuestionResponses | null;
  // Cast-specific fields
  demo_reel_url: string | null;
  self_tape_url: string | null;
  special_skills: string[] | null;
  tape_requested_at: string | null;
  tape_submitted_at: string | null;
  created_at: string;
  updated_at: string;
  // Joined data
  backlot_project_roles?: {
    id: string;
    title: string;
    type: string;
    project_id: string;
    backlot_projects?: {
      id: string;
      title: string;
      slug: string;
      cover_image_url?: string;
    };
  };
  current_profile?: ApplicantProfileSnapshot;
}

// Selectable credit for applications
export interface SelectableCredit {
  id: string;
  project_title: string;
  role: string;
  role_type?: string;
  year?: number;
  department?: string;
}

// Application status update
export interface ApplicationStatusUpdate {
  status: ApplicationStatus;
  internal_notes?: string;
  rating?: number; // 1-5
}

// Requirements that can be set on collabs or roles
export interface ApplicationRequirements {
  requires_local_hire?: boolean;
  requires_order_member?: boolean;
  requires_resume?: boolean;
  application_deadline?: string;
  max_applications?: number;
}

// Application form state
export interface ApplicationFormState {
  elevator_pitch: string;
  cover_note: string;
  availability_notes: string;
  resume_id: string | null;
  selected_credit_ids: string[];
  template_id: string | null;
  local_hire_confirmed: boolean | null;
  is_promoted: boolean;
  save_as_template: boolean;
  template_name: string;
  // Cover letter template fields
  cover_letter_template_id: string | null;
  save_cover_letter_as_template: boolean;
  cover_letter_template_name: string;
  // Custom question responses
  custom_question_responses: CustomQuestionResponses;
  // Cast-specific fields
  demo_reel_url: string;
  self_tape_url: string;
  headshot_url: string;
  special_skills: string[];
}

// Initial form state
export const initialApplicationFormState: ApplicationFormState = {
  elevator_pitch: '',
  cover_note: '',
  availability_notes: '',
  resume_id: null,
  selected_credit_ids: [],
  template_id: null,
  local_hire_confirmed: null,
  is_promoted: false,
  save_as_template: false,
  template_name: '',
  cover_letter_template_id: null,
  save_cover_letter_as_template: false,
  cover_letter_template_name: '',
  custom_question_responses: {},
  // Cast-specific fields
  demo_reel_url: '',
  self_tape_url: '',
  headshot_url: '',
  special_skills: [],
};

// Application statistics for a collab/role owner
export interface ApplicationStats {
  total: number;
  by_status: Record<ApplicationStatus, number>;
}

// Status badge colors
export const applicationStatusConfig: Record<ApplicationStatus, { label: string; color: string; bgColor: string }> = {
  applied: { label: 'Applied', color: 'text-blue-400', bgColor: 'bg-blue-600/20' },
  viewed: { label: 'Viewed', color: 'text-purple-400', bgColor: 'bg-purple-600/20' },
  shortlisted: { label: 'Shortlisted', color: 'text-amber-400', bgColor: 'bg-amber-600/20' },
  interview: { label: 'Interview', color: 'text-cyan-400', bgColor: 'bg-cyan-600/20' },
  offered: { label: 'Offered', color: 'text-green-400', bgColor: 'bg-green-600/20' },
  booked: { label: 'Booked', color: 'text-emerald-400', bgColor: 'bg-emerald-600/20' },
  rejected: { label: 'Rejected', color: 'text-red-400', bgColor: 'bg-red-600/20' },
  withdrawn: { label: 'Withdrawn', color: 'text-gray-500', bgColor: 'bg-gray-600/20' },
};

// Source type for unified applications
export type ApplicationSource = 'backlot' | 'community';

// Unified application - normalized view combining both types
export interface UnifiedApplication {
  id: string;
  source: ApplicationSource;
  title: string;
  project_name?: string;
  project_id?: string;
  location?: string;
  is_remote?: boolean;
  status: ApplicationStatus;
  applied_at: string;
  status_changed_at?: string;
  elevator_pitch?: string;
  cover_note?: string;
  is_promoted?: boolean;
  // Original data for reference
  original: CollabApplication | RoleApplication;
}

// Application received item - for viewing applications from poster's perspective
export interface ApplicationReceivedItem {
  id: string;
  source: ApplicationSource;
  title: string;  // Role/collab title
  project_name?: string;
  applicant: {
    id: string;
    username: string;
    full_name?: string;
    display_name?: string;
    avatar_url?: string;
  };
  status: ApplicationStatus;
  applied_at: string;
  is_promoted?: boolean;
  elevator_pitch?: string;
  original: CollabApplication | RoleApplication;
}

// Group of applications by project/collab
export interface ApplicationGroup {
  id: string;  // project_id or collab_id
  source: ApplicationSource;
  name: string;  // project or collab title
  applications: ApplicationReceivedItem[];
}

// Application booking input for booking an applicant
export interface ApplicationBookingInput {
  booking_rate?: string;
  booking_start_date?: string; // YYYY-MM-DD
  booking_end_date?: string;
  booking_notes?: string;
  booking_schedule_notes?: string;
  // Cast-specific
  character_id?: string;
  billing_position?: number;
  contract_type?: 'series_regular' | 'recurring' | 'guest_star' | 'day_player';
  // Crew-specific
  role_title?: string;
  department?: string;
  // Document requests
  request_documents?: boolean;
  document_types?: string[];
  // Notification
  send_notification?: boolean;
  notification_message?: string;
}
