/**
 * useChurchTools - Hooks for Church Production Tools
 * Service Plans, Volunteers, Training, Content Requests, Events, Gear, and Readiness
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

const RAW_API_URL = import.meta.env.VITE_API_URL || '';
const API_BASE = RAW_API_URL.endsWith('/api/v1') ? RAW_API_URL : `${RAW_API_URL}/api/v1`;

// =============================================================================
// TYPES - Section A: Service Planning
// =============================================================================

export interface ServicePlan {
  id: string;
  org_id?: string;
  service_date: string;
  service_name: string;
  campus_id?: string;
  template_id?: string;
  data: Record<string, unknown>;
  status: 'draft' | 'planning' | 'ready' | 'completed' | 'archived';
  created_by_user_id?: string;
  created_at: string;
  updated_at: string;
}

export interface CreateServicePlanInput {
  service_date: string;
  service_name: string;
  campus_id?: string;
  template_id?: string;
  data?: Record<string, unknown>;
  status?: string;
}

export interface RehearsalPlan {
  id: string;
  service_plan_id: string;
  rehearsal_datetime: string;
  data: Record<string, unknown>;
  notes?: string;
  status: string;
  created_by_user_id?: string;
  created_at: string;
  updated_at: string;
}

export interface TechAssignment {
  id: string;
  service_plan_id: string;
  position_name: string;
  user_id?: string;
  notes?: string;
  status: string;
  created_at: string;
  updated_at: string;
}

// =============================================================================
// TYPES - Section B: Volunteers & Training
// =============================================================================

export interface VolunteerShift {
  id: string;
  org_id?: string;
  user_id: string;
  position_name: string;
  shift_date: string;
  start_time?: string;
  end_time?: string;
  status: 'scheduled' | 'confirmed' | 'checked_in' | 'completed' | 'no_show';
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface TrainingModule {
  id: string;
  org_id?: string;
  title: string;
  description?: string;
  category?: string;
  content_url?: string;
  duration_minutes?: number;
  is_required: boolean;
  position_tags: string[];
  created_by_user_id?: string;
  created_at: string;
  updated_at: string;
}

export interface TrainingProgress {
  id: string;
  user_id: string;
  module_id: string;
  status: 'not_started' | 'in_progress' | 'completed';
  progress_percent: number;
  completed_at?: string;
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface SkillEntry {
  id: string;
  org_id?: string;
  user_id: string;
  skill_name: string;
  proficiency_level: 'beginner' | 'intermediate' | 'advanced' | 'expert';
  years_experience?: number;
  notes?: string;
  verified_by_user_id?: string;
  verified_at?: string;
  created_at: string;
  updated_at: string;
}

export interface PositionCard {
  id: string;
  org_id?: string;
  position_name: string;
  department?: string;
  description?: string;
  responsibilities: string[];
  required_skills: string[];
  training_modules: string[];
  quick_reference: Record<string, unknown>;
  created_by_user_id?: string;
  created_at: string;
  updated_at: string;
}

// =============================================================================
// TYPES - Section C: Content & Requests
// =============================================================================

export interface ClipRequest {
  id: string;
  org_id?: string;
  requester_user_id: string;
  title: string;
  description?: string;
  source_service_date?: string;
  timestamp_start?: string;
  timestamp_end?: string;
  priority: 'low' | 'normal' | 'high' | 'urgent';
  status: 'pending' | 'assigned' | 'in_progress' | 'completed' | 'cancelled';
  assigned_to_user_id?: string;
  output_url?: string;
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface StoryLead {
  id: string;
  org_id?: string;
  submitted_by_user_id: string;
  title: string;
  description?: string;
  contact_info?: string;
  category?: string;
  urgency: 'normal' | 'time_sensitive' | 'urgent';
  status: 'new' | 'reviewing' | 'assigned' | 'in_progress' | 'published' | 'archived';
  assigned_to_user_id?: string;
  follow_up_notes?: string;
  created_at: string;
  updated_at: string;
}

export interface ContentShoot {
  id: string;
  org_id?: string;
  title: string;
  description?: string;
  shoot_date?: string;
  location?: string;
  shoot_type?: string;
  status: 'planning' | 'scheduled' | 'shooting' | 'post_production' | 'completed';
  crew_assignments: Record<string, unknown>;
  equipment_list: string[];
  deliverables: string[];
  notes?: string;
  created_by_user_id?: string;
  created_at: string;
  updated_at: string;
}

export interface Announcement {
  id: string;
  org_id?: string;
  title: string;
  content?: string;
  announcement_type: string;
  target_date?: string;
  target_services: string[];
  status: 'draft' | 'pending_approval' | 'approved' | 'published' | 'archived';
  priority: number;
  graphics_url?: string;
  video_url?: string;
  created_by_user_id?: string;
  approved_by_user_id?: string;
  approved_at?: string;
  created_at: string;
  updated_at: string;
}

// =============================================================================
// TYPES - Section D: Calendar & Briefs
// =============================================================================

export interface ChurchEvent {
  id: string;
  org_id?: string;
  title: string;
  description?: string;
  event_type: string;
  start_datetime: string;
  end_datetime?: string;
  location?: string;
  campus_id?: string;
  is_recurring: boolean;
  recurrence_rule?: string;
  parent_event_id?: string;
  status: 'scheduled' | 'in_progress' | 'completed' | 'cancelled';
  visibility: 'internal' | 'public';
  data: Record<string, unknown>;
  created_by_user_id?: string;
  created_at: string;
  updated_at: string;
}

export interface CreativeBrief {
  id: string;
  org_id?: string;
  title: string;
  project_type: string;
  description?: string;
  objectives: string[];
  target_audience?: string;
  key_messages: string[];
  deliverables: string[];
  timeline: Record<string, unknown>;
  budget?: string;
  brand_guidelines?: string;
  references: string[];
  status: 'draft' | 'pending_approval' | 'approved' | 'in_progress' | 'completed';
  linked_event_id?: string;
  created_by_user_id?: string;
  approved_by_user_id?: string;
  approved_at?: string;
  created_at: string;
  updated_at: string;
}

export interface License {
  id: string;
  org_id?: string;
  license_type: string;
  name: string;
  provider?: string;
  license_number?: string;
  description?: string;
  start_date?: string;
  expiration_date?: string;
  auto_renew: boolean;
  cost?: string;
  payment_frequency?: string;
  status: 'active' | 'expired' | 'pending_renewal';
  contact_info?: string;
  notes?: string;
  document_urls: string[];
  created_by_user_id?: string;
  created_at: string;
  updated_at: string;
}

// =============================================================================
// TYPES - Section E: Gear & Routing
// =============================================================================

export interface Room {
  id: string;
  org_id?: string;
  name: string;
  location?: string;
  campus_id?: string;
  capacity?: number;
  room_type: string;
  amenities: string[];
  equipment: string[];
  notes?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface GearItem {
  id: string;
  org_id?: string;
  name: string;
  category: string;
  manufacturer?: string;
  model?: string;
  serial_number?: string;
  asset_tag?: string;
  location?: string;
  room_id?: string;
  status: 'available' | 'in_use' | 'reserved' | 'maintenance' | 'retired';
  condition: 'excellent' | 'good' | 'fair' | 'needs_repair' | 'broken';
  purchase_date?: string;
  purchase_price?: string;
  warranty_expiration?: string;
  notes?: string;
  specs: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface Reservation {
  id: string;
  org_id?: string;
  resource_type: 'room' | 'gear';
  resource_id: string;
  reserved_by_user_id: string;
  title: string;
  description?: string;
  start_datetime: string;
  end_datetime: string;
  status: 'pending' | 'approved' | 'rejected' | 'cancelled' | 'completed';
  approved_by_user_id?: string;
  approved_at?: string;
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface PatchMatrix {
  id: string;
  org_id?: string;
  name: string;
  location?: string;
  room_id?: string;
  description?: string;
  matrix_data: Record<string, unknown>;
  inputs: Array<Record<string, unknown>>;
  outputs: Array<Record<string, unknown>>;
  patches: Array<Record<string, unknown>>;
  created_by_user_id?: string;
  created_at: string;
  updated_at: string;
}

export interface CameraPlot {
  id: string;
  org_id?: string;
  name: string;
  venue?: string;
  room_id?: string;
  event_type?: string;
  description?: string;
  plot_data: Record<string, unknown>;
  cameras: Array<Record<string, unknown>>;
  notes?: string;
  created_by_user_id?: string;
  created_at: string;
  updated_at: string;
}

// =============================================================================
// TYPES - Section F: Sunday Readiness
// =============================================================================

export interface PreflightChecklist {
  id: string;
  org_id?: string;
  name: string;
  checklist_type: string;
  description?: string;
  items: Array<Record<string, unknown>>;
  is_template: boolean;
  linked_event_id?: string;
  linked_service_plan_id?: string;
  status: 'pending' | 'in_progress' | 'completed';
  completed_at?: string;
  completed_by_user_id?: string;
  created_by_user_id?: string;
  created_at: string;
  updated_at: string;
}

export interface StreamQCSession {
  id: string;
  org_id?: string;
  service_plan_id?: string;
  event_id?: string;
  session_date: string;
  session_type: string;
  status: 'scheduled' | 'in_progress' | 'completed';
  checklist_items: Array<Record<string, unknown>>;
  audio_notes?: string;
  video_notes?: string;
  stream_notes?: string;
  issues_found: Array<Record<string, unknown>>;
  overall_rating?: number;
  qc_by_user_id?: string;
  started_at?: string;
  completed_at?: string;
  created_at: string;
  updated_at: string;
}

export interface MacroCommand {
  id: string;
  org_id?: string;
  name: string;
  category: string;
  description?: string;
  trigger_type: 'manual' | 'scheduled' | 'event';
  trigger_config: Record<string, unknown>;
  actions: Array<Record<string, unknown>>;
  is_active: boolean;
  hotkey?: string;
  tags: string[];
  created_by_user_id?: string;
  created_at: string;
  updated_at: string;
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

function getAuthHeaders() {
  const token = api.getToken();
  if (!token) {
    throw new Error('No authentication token available');
  }
  return {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json',
  };
}

async function fetchWithAuth(url: string, options: RequestInit = {}) {
  const headers = getAuthHeaders();
  const response = await fetch(url, {
    ...options,
    headers: { ...headers, ...options.headers },
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: 'Request failed' }));
    throw new Error(error.detail || `Request failed: ${response.status}`);
  }
  return response.json();
}

// =============================================================================
// SECTION A: SERVICE PLANNING HOOKS
// =============================================================================

export function useServicePlans(filters?: {
  status?: string;
  start_date?: string;
  end_date?: string;
  limit?: number;
}) {
  return useQuery({
    queryKey: ['church', 'service-plans', filters],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filters?.status) params.append('status', filters.status);
      if (filters?.start_date) params.append('start_date', filters.start_date);
      if (filters?.end_date) params.append('end_date', filters.end_date);
      if (filters?.limit) params.append('limit', filters.limit.toString());
      const url = `${API_BASE}/church/services/plans?${params.toString()}`;
      return fetchWithAuth(url) as Promise<ServicePlan[]>;
    },
  });
}

export function useServicePlan(planId: string) {
  return useQuery({
    queryKey: ['church', 'service-plan', planId],
    queryFn: async () => {
      return fetchWithAuth(`${API_BASE}/church/services/plans/${planId}`) as Promise<ServicePlan>;
    },
    enabled: !!planId,
  });
}

export function useCreateServicePlan() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: CreateServicePlanInput) => {
      return fetchWithAuth(`${API_BASE}/church/services/plans`, {
        method: 'POST',
        body: JSON.stringify(data),
      }) as Promise<ServicePlan>;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['church', 'service-plans'] });
    },
  });
}

export function useUpdateServicePlan() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...data }: { id: string } & Partial<CreateServicePlanInput>) => {
      return fetchWithAuth(`${API_BASE}/church/services/plans/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      }) as Promise<ServicePlan>;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['church', 'service-plans'] });
      queryClient.invalidateQueries({ queryKey: ['church', 'service-plan', variables.id] });
    },
  });
}

export function useCloneServicePlan() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ planId, newDate }: { planId: string; newDate: string }) => {
      return fetchWithAuth(`${API_BASE}/church/services/plans/${planId}/clone?new_date=${newDate}`, {
        method: 'POST',
      }) as Promise<ServicePlan>;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['church', 'service-plans'] });
    },
  });
}

export function useRehearsals(servicePlanId: string) {
  return useQuery({
    queryKey: ['church', 'rehearsals', servicePlanId],
    queryFn: async () => {
      return fetchWithAuth(`${API_BASE}/church/services/plans/${servicePlanId}/rehearsals`) as Promise<RehearsalPlan[]>;
    },
    enabled: !!servicePlanId,
  });
}

export function useCreateRehearsal(servicePlanId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: Omit<RehearsalPlan, 'id' | 'service_plan_id' | 'created_by_user_id' | 'created_at' | 'updated_at'>) => {
      return fetchWithAuth(`${API_BASE}/church/services/plans/${servicePlanId}/rehearsals`, {
        method: 'POST',
        body: JSON.stringify(data),
      }) as Promise<RehearsalPlan>;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['church', 'rehearsals', servicePlanId] });
    },
  });
}

export function useTechAssignments(servicePlanId: string) {
  return useQuery({
    queryKey: ['church', 'tech-assignments', servicePlanId],
    queryFn: async () => {
      return fetchWithAuth(`${API_BASE}/church/services/plans/${servicePlanId}/tech-positions`) as Promise<TechAssignment[]>;
    },
    enabled: !!servicePlanId,
  });
}

export function useCreateTechAssignment(servicePlanId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: { position_name: string; user_id?: string; notes?: string }) => {
      return fetchWithAuth(`${API_BASE}/church/services/plans/${servicePlanId}/tech-positions`, {
        method: 'POST',
        body: JSON.stringify(data),
      }) as Promise<TechAssignment>;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['church', 'tech-assignments', servicePlanId] });
    },
  });
}

// =============================================================================
// SECTION B: VOLUNTEERS & TRAINING HOOKS
// =============================================================================

export function useVolunteerShifts(filters?: {
  user_id?: string;
  position_name?: string;
  start_date?: string;
  end_date?: string;
  status?: string;
}) {
  return useQuery({
    queryKey: ['church', 'volunteer-shifts', filters],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filters?.user_id) params.append('user_id', filters.user_id);
      if (filters?.position_name) params.append('position_name', filters.position_name);
      if (filters?.start_date) params.append('start_date', filters.start_date);
      if (filters?.end_date) params.append('end_date', filters.end_date);
      if (filters?.status) params.append('status', filters.status);
      return fetchWithAuth(`${API_BASE}/church/volunteers/shifts?${params.toString()}`) as Promise<VolunteerShift[]>;
    },
  });
}

export function useCreateVolunteerShift() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: Omit<VolunteerShift, 'id' | 'org_id' | 'created_at' | 'updated_at'>) => {
      return fetchWithAuth(`${API_BASE}/church/volunteers/shifts`, {
        method: 'POST',
        body: JSON.stringify(data),
      }) as Promise<VolunteerShift>;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['church', 'volunteer-shifts'] });
    },
  });
}

export function useTrainingModules(filters?: { category?: string; is_required?: boolean }) {
  return useQuery({
    queryKey: ['church', 'training-modules', filters],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filters?.category) params.append('category', filters.category);
      if (filters?.is_required !== undefined) params.append('is_required', String(filters.is_required));
      return fetchWithAuth(`${API_BASE}/church/training/modules?${params.toString()}`) as Promise<TrainingModule[]>;
    },
  });
}

export function useMyTrainingProgress() {
  return useQuery({
    queryKey: ['church', 'training-progress', 'me'],
    queryFn: async () => {
      return fetchWithAuth(`${API_BASE}/church/training/progress/me`) as Promise<TrainingProgress[]>;
    },
  });
}

export function useSkillsDirectory(filters?: { user_id?: string; skill_name?: string }) {
  return useQuery({
    queryKey: ['church', 'skills', filters],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filters?.user_id) params.append('user_id', filters.user_id);
      if (filters?.skill_name) params.append('skill_name', filters.skill_name);
      return fetchWithAuth(`${API_BASE}/church/skills?${params.toString()}`) as Promise<SkillEntry[]>;
    },
  });
}

export function usePositionCards(filters?: { department?: string; search?: string }) {
  return useQuery({
    queryKey: ['church', 'position-cards', filters],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filters?.department) params.append('department', filters.department);
      if (filters?.search) params.append('search', filters.search);
      return fetchWithAuth(`${API_BASE}/church/positions/cards?${params.toString()}`) as Promise<PositionCard[]>;
    },
  });
}

// =============================================================================
// SECTION C: CONTENT & REQUESTS HOOKS
// =============================================================================

export function useClipRequests(filters?: { status?: string; priority?: string; assigned_to?: string }) {
  return useQuery({
    queryKey: ['church', 'clip-requests', filters],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filters?.status) params.append('status', filters.status);
      if (filters?.priority) params.append('priority', filters.priority);
      if (filters?.assigned_to) params.append('assigned_to', filters.assigned_to);
      return fetchWithAuth(`${API_BASE}/church/content/clip-requests?${params.toString()}`) as Promise<ClipRequest[]>;
    },
  });
}

export function useMyClipRequests() {
  return useQuery({
    queryKey: ['church', 'clip-requests', 'mine'],
    queryFn: async () => {
      return fetchWithAuth(`${API_BASE}/church/content/clip-requests/mine`) as Promise<ClipRequest[]>;
    },
  });
}

export function useCreateClipRequest() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: {
      title: string;
      description?: string;
      source_service_date?: string;
      timestamp_start?: string;
      timestamp_end?: string;
      priority?: string;
      notes?: string;
    }) => {
      return fetchWithAuth(`${API_BASE}/church/content/clip-requests`, {
        method: 'POST',
        body: JSON.stringify(data),
      }) as Promise<ClipRequest>;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['church', 'clip-requests'] });
    },
  });
}

export function useStoryLeads(filters?: { status?: string; category?: string; urgency?: string }) {
  return useQuery({
    queryKey: ['church', 'story-leads', filters],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filters?.status) params.append('status', filters.status);
      if (filters?.category) params.append('category', filters.category);
      if (filters?.urgency) params.append('urgency', filters.urgency);
      return fetchWithAuth(`${API_BASE}/church/content/story-leads?${params.toString()}`) as Promise<StoryLead[]>;
    },
  });
}

export function useContentShoots(filters?: { status?: string; shoot_type?: string }) {
  return useQuery({
    queryKey: ['church', 'content-shoots', filters],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filters?.status) params.append('status', filters.status);
      if (filters?.shoot_type) params.append('shoot_type', filters.shoot_type);
      return fetchWithAuth(`${API_BASE}/church/content/shoots?${params.toString()}`) as Promise<ContentShoot[]>;
    },
  });
}

export function useAnnouncements(filters?: { status?: string; announcement_type?: string; target_date?: string }) {
  return useQuery({
    queryKey: ['church', 'announcements', filters],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filters?.status) params.append('status', filters.status);
      if (filters?.announcement_type) params.append('announcement_type', filters.announcement_type);
      if (filters?.target_date) params.append('target_date', filters.target_date);
      return fetchWithAuth(`${API_BASE}/church/content/announcements?${params.toString()}`) as Promise<Announcement[]>;
    },
  });
}

// =============================================================================
// SECTION D: CALENDAR & BRIEFS HOOKS
// =============================================================================

export function useChurchEvents(filters?: {
  event_type?: string;
  status?: string;
  start_date?: string;
  end_date?: string;
  campus_id?: string;
}) {
  return useQuery({
    queryKey: ['church', 'events', filters],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filters?.event_type) params.append('event_type', filters.event_type);
      if (filters?.status) params.append('status', filters.status);
      if (filters?.start_date) params.append('start_date', filters.start_date);
      if (filters?.end_date) params.append('end_date', filters.end_date);
      if (filters?.campus_id) params.append('campus_id', filters.campus_id);
      return fetchWithAuth(`${API_BASE}/church/planning/events?${params.toString()}`) as Promise<ChurchEvent[]>;
    },
  });
}

export function useChurchEvent(eventId: string) {
  return useQuery({
    queryKey: ['church', 'event', eventId],
    queryFn: async () => {
      return fetchWithAuth(`${API_BASE}/church/planning/events/${eventId}`) as Promise<ChurchEvent>;
    },
    enabled: !!eventId,
  });
}

export function useCreateChurchEvent() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: {
      title: string;
      description?: string;
      event_type?: string;
      start_datetime: string;
      end_datetime?: string;
      location?: string;
      campus_id?: string;
      visibility?: string;
    }) => {
      return fetchWithAuth(`${API_BASE}/church/planning/events`, {
        method: 'POST',
        body: JSON.stringify(data),
      }) as Promise<ChurchEvent>;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['church', 'events'] });
    },
  });
}

export function useCreativeBriefs(filters?: { status?: string; project_type?: string }) {
  return useQuery({
    queryKey: ['church', 'creative-briefs', filters],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filters?.status) params.append('status', filters.status);
      if (filters?.project_type) params.append('project_type', filters.project_type);
      return fetchWithAuth(`${API_BASE}/church/planning/briefs?${params.toString()}`) as Promise<CreativeBrief[]>;
    },
  });
}

export function useLicenses(filters?: { license_type?: string; status?: string; expiring_before?: string }) {
  return useQuery({
    queryKey: ['church', 'licenses', filters],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filters?.license_type) params.append('license_type', filters.license_type);
      if (filters?.status) params.append('status', filters.status);
      if (filters?.expiring_before) params.append('expiring_before', filters.expiring_before);
      return fetchWithAuth(`${API_BASE}/church/planning/licenses?${params.toString()}`) as Promise<License[]>;
    },
  });
}

export function useExpiringLicenses(days = 30) {
  return useQuery({
    queryKey: ['church', 'licenses', 'expiring', days],
    queryFn: async () => {
      return fetchWithAuth(`${API_BASE}/church/planning/licenses/expiring-soon?days=${days}`) as Promise<License[]>;
    },
  });
}

// =============================================================================
// SECTION E: GEAR & ROUTING HOOKS
// =============================================================================

export function useRooms(filters?: { room_type?: string; campus_id?: string; is_active?: boolean }) {
  return useQuery({
    queryKey: ['church', 'rooms', filters],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filters?.room_type) params.append('room_type', filters.room_type);
      if (filters?.campus_id) params.append('campus_id', filters.campus_id);
      if (filters?.is_active !== undefined) params.append('is_active', String(filters.is_active));
      return fetchWithAuth(`${API_BASE}/church/resources/rooms?${params.toString()}`) as Promise<Room[]>;
    },
  });
}

export function useGearInventory(filters?: { category?: string; status?: string; room_id?: string; search?: string }) {
  return useQuery({
    queryKey: ['church', 'gear', filters],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filters?.category) params.append('category', filters.category);
      if (filters?.status) params.append('status', filters.status);
      if (filters?.room_id) params.append('room_id', filters.room_id);
      if (filters?.search) params.append('search', filters.search);
      return fetchWithAuth(`${API_BASE}/church/resources/gear?${params.toString()}`) as Promise<GearItem[]>;
    },
  });
}

export function useGearCategories() {
  return useQuery({
    queryKey: ['church', 'gear', 'categories'],
    queryFn: async () => {
      return fetchWithAuth(`${API_BASE}/church/resources/gear/categories/list`) as Promise<string[]>;
    },
  });
}

export function useReservations(filters?: {
  resource_type?: string;
  resource_id?: string;
  status?: string;
  start_date?: string;
  end_date?: string;
}) {
  return useQuery({
    queryKey: ['church', 'reservations', filters],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filters?.resource_type) params.append('resource_type', filters.resource_type);
      if (filters?.resource_id) params.append('resource_id', filters.resource_id);
      if (filters?.status) params.append('status', filters.status);
      if (filters?.start_date) params.append('start_date', filters.start_date);
      if (filters?.end_date) params.append('end_date', filters.end_date);
      return fetchWithAuth(`${API_BASE}/church/resources/reservations?${params.toString()}`) as Promise<Reservation[]>;
    },
  });
}

export function useMyReservations() {
  return useQuery({
    queryKey: ['church', 'reservations', 'mine'],
    queryFn: async () => {
      return fetchWithAuth(`${API_BASE}/church/resources/reservations/mine`) as Promise<Reservation[]>;
    },
  });
}

export function useCreateReservation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: {
      resource_type: string;
      resource_id: string;
      title: string;
      description?: string;
      start_datetime: string;
      end_datetime: string;
      notes?: string;
    }) => {
      return fetchWithAuth(`${API_BASE}/church/resources/reservations`, {
        method: 'POST',
        body: JSON.stringify(data),
      }) as Promise<Reservation>;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['church', 'reservations'] });
    },
  });
}

export function usePatchMatrices(filters?: { room_id?: string }) {
  return useQuery({
    queryKey: ['church', 'patch-matrices', filters],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filters?.room_id) params.append('room_id', filters.room_id);
      return fetchWithAuth(`${API_BASE}/church/resources/patch-matrices?${params.toString()}`) as Promise<PatchMatrix[]>;
    },
  });
}

export function useCameraPlots(filters?: { venue?: string; event_type?: string }) {
  return useQuery({
    queryKey: ['church', 'camera-plots', filters],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filters?.venue) params.append('venue', filters.venue);
      if (filters?.event_type) params.append('event_type', filters.event_type);
      return fetchWithAuth(`${API_BASE}/church/resources/camera-plots?${params.toString()}`) as Promise<CameraPlot[]>;
    },
  });
}

// =============================================================================
// SECTION F: SUNDAY READINESS HOOKS
// =============================================================================

export function usePreflightChecklists(filters?: {
  checklist_type?: string;
  is_template?: boolean;
  status?: string;
  service_plan_id?: string;
}) {
  return useQuery({
    queryKey: ['church', 'preflight-checklists', filters],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filters?.checklist_type) params.append('checklist_type', filters.checklist_type);
      if (filters?.is_template !== undefined) params.append('is_template', String(filters.is_template));
      if (filters?.status) params.append('status', filters.status);
      if (filters?.service_plan_id) params.append('service_plan_id', filters.service_plan_id);
      return fetchWithAuth(`${API_BASE}/church/readiness/checklists?${params.toString()}`) as Promise<PreflightChecklist[]>;
    },
  });
}

export function useChecklistTemplates(checklistType?: string) {
  return useQuery({
    queryKey: ['church', 'checklist-templates', checklistType],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (checklistType) params.append('checklist_type', checklistType);
      return fetchWithAuth(`${API_BASE}/church/readiness/checklists/templates?${params.toString()}`) as Promise<PreflightChecklist[]>;
    },
  });
}

export function useInstantiateChecklist() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ templateId, servicePlanId, eventId }: {
      templateId: string;
      servicePlanId?: string;
      eventId?: string;
    }) => {
      const params = new URLSearchParams();
      if (servicePlanId) params.append('service_plan_id', servicePlanId);
      if (eventId) params.append('event_id', eventId);
      return fetchWithAuth(`${API_BASE}/church/readiness/checklists/${templateId}/instantiate?${params.toString()}`, {
        method: 'POST',
      }) as Promise<PreflightChecklist>;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['church', 'preflight-checklists'] });
    },
  });
}

export function useCompleteChecklist() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (checklistId: string) => {
      return fetchWithAuth(`${API_BASE}/church/readiness/checklists/${checklistId}/complete`, {
        method: 'POST',
      }) as Promise<PreflightChecklist>;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['church', 'preflight-checklists'] });
    },
  });
}

export function useStreamQCSessions(filters?: {
  status?: string;
  session_type?: string;
  start_date?: string;
  end_date?: string;
}) {
  return useQuery({
    queryKey: ['church', 'stream-qc', filters],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filters?.status) params.append('status', filters.status);
      if (filters?.session_type) params.append('session_type', filters.session_type);
      if (filters?.start_date) params.append('start_date', filters.start_date);
      if (filters?.end_date) params.append('end_date', filters.end_date);
      return fetchWithAuth(`${API_BASE}/church/readiness/stream-qc?${params.toString()}`) as Promise<StreamQCSession[]>;
    },
  });
}

export function useCreateStreamQCSession() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: {
      service_plan_id?: string;
      event_id?: string;
      session_date: string;
      session_type?: string;
      checklist_items?: Array<Record<string, unknown>>;
    }) => {
      return fetchWithAuth(`${API_BASE}/church/readiness/stream-qc`, {
        method: 'POST',
        body: JSON.stringify(data),
      }) as Promise<StreamQCSession>;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['church', 'stream-qc'] });
    },
  });
}

export function useMacroLibrary(filters?: {
  category?: string;
  is_active?: boolean;
  trigger_type?: string;
  search?: string;
}) {
  return useQuery({
    queryKey: ['church', 'macros', filters],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filters?.category) params.append('category', filters.category);
      if (filters?.is_active !== undefined) params.append('is_active', String(filters.is_active));
      if (filters?.trigger_type) params.append('trigger_type', filters.trigger_type);
      if (filters?.search) params.append('search', filters.search);
      return fetchWithAuth(`${API_BASE}/church/readiness/macros?${params.toString()}`) as Promise<MacroCommand[]>;
    },
  });
}

export function useMacroCategories() {
  return useQuery({
    queryKey: ['church', 'macros', 'categories'],
    queryFn: async () => {
      return fetchWithAuth(`${API_BASE}/church/readiness/macros/categories`) as Promise<string[]>;
    },
  });
}

export function useCreateMacro() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: {
      name: string;
      category: string;
      description?: string;
      trigger_type?: string;
      trigger_config?: Record<string, unknown>;
      actions?: Array<Record<string, unknown>>;
      hotkey?: string;
      tags?: string[];
    }) => {
      return fetchWithAuth(`${API_BASE}/church/readiness/macros`, {
        method: 'POST',
        body: JSON.stringify(data),
      }) as Promise<MacroCommand>;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['church', 'macros'] });
    },
  });
}

export function useDuplicateMacro() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ macroId, newName }: { macroId: string; newName?: string }) => {
      const params = newName ? `?new_name=${encodeURIComponent(newName)}` : '';
      return fetchWithAuth(`${API_BASE}/church/readiness/macros/${macroId}/duplicate${params}`, {
        method: 'POST',
      }) as Promise<MacroCommand>;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['church', 'macros'] });
    },
  });
}
