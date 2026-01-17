/**
 * useEpisodes - Hook for Episode Management
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

// =====================================================
// Types
// =====================================================

export type EpisodePipelineStage =
  | 'DEVELOPMENT'
  | 'PRE_PRO'
  | 'PRODUCTION'
  | 'POST'
  | 'DELIVERED'
  | 'RELEASED';

export type EpisodeEditStatus =
  | 'NOT_STARTED'
  | 'INGEST'
  | 'ASSEMBLY'
  | 'ROUGH_CUT'
  | 'FINE_CUT'
  | 'PICTURE_LOCK'
  | 'SOUND'
  | 'COLOR'
  | 'MASTERING';

export type EpisodeDeliveryStatus =
  | 'NOT_STARTED'
  | 'QC'
  | 'CAPTIONS'
  | 'ARTWORK'
  | 'EXPORTS'
  | 'DELIVERED'
  | 'RELEASED';

export type EpisodeSubjectType = 'CAST' | 'CREW' | 'CONTRIBUTOR' | 'OTHER';
export type EpisodeListItemKind = 'INTERVIEW' | 'SCENE' | 'SEGMENT';
export type DeliverableStatus = 'NOT_STARTED' | 'IN_PROGRESS' | 'READY_FOR_REVIEW' | 'APPROVED' | 'DELIVERED';
export type ApprovalType = 'EDIT_LOCK' | 'DELIVERY_APPROVAL' | 'ROUGH_CUT' | 'FINE_CUT' | 'PICTURE_LOCK' | 'COLOR' | 'SOUND';
export type ApprovalStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

export interface Season {
  id: string;
  project_id: string;
  season_number: number;
  title: string | null;
  episode_count?: number;
  created_at: string;
  updated_at: string;
}

export interface Episode {
  id: string;
  project_id: string;
  season_id: string | null;
  episode_number: number;
  episode_code: string;
  title: string;
  logline: string | null;
  synopsis: string | null;
  outline: string | null;
  beat_sheet: string | null;
  notes: string | null;
  pipeline_stage: EpisodePipelineStage;
  edit_status: EpisodeEditStatus;
  delivery_status: EpisodeDeliveryStatus;
  is_edit_locked: boolean;
  editor_user_id: string | null;
  ae_user_id: string | null;
  post_supervisor_user_id: string | null;
  planned_runtime_minutes: number | null;
  actual_runtime_minutes: number | null;
  created_by_user_id: string;
  created_at: string;
  updated_at: string;
  // Joined fields
  season_number?: number;
  season_title?: string;
  pending_approvals?: number;
}

export interface EpisodeSubject {
  id: string;
  episode_id: string;
  subject_type: EpisodeSubjectType;
  name: string;
  role: string | null;
  contact_info: string | null;
  notes: string | null;
  contact_id: string | null;
  contact_name: string | null; // Populated from join
  created_at: string;
  updated_at: string;
}

export interface EpisodeLocation {
  id: string;
  episode_id: string;
  name: string;
  address: string | null;
  notes: string | null;
  project_location_id: string | null;
  project_location_name?: string | null;
  created_at: string;
  updated_at: string;
}

export interface EpisodeListItem {
  id: string;
  episode_id: string;
  kind: EpisodeListItemKind;
  sort_order: number;
  title: string;
  description: string | null;
  status: string | null;
  created_at: string;
  updated_at: string;
}

export interface EpisodeMilestone {
  id: string;
  episode_id: string;
  milestone_type: string;
  date: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface EpisodeDeliverable {
  id: string;
  episode_id: string;
  deliverable_type: string;
  status: DeliverableStatus;
  due_date: string | null;
  owner_user_id: string | null;
  notes: string | null;
  project_deliverable_id: string | null;
  project_deliverable_name: string | null; // Populated from join
  created_at: string;
  updated_at: string;
}

export interface EpisodeAssetLink {
  id: string;
  episode_id: string;
  label: string;
  url: string | null;
  asset_id: string | null;
  asset_name?: string | null;
  created_at: string;
  updated_at: string;
}

export interface EpisodeShootDay {
  id: string;
  episode_id: string;
  production_day_id: string;
  date: string;
  day_type: string;
  day_title: string | null;
  created_at: string;
}

export interface EpisodeApproval {
  id: string;
  episode_id: string;
  approval_type: ApprovalType;
  status: ApprovalStatus;
  requested_by_user_id: string;
  requested_at: string;
  decided_by_user_id: string | null;
  decided_at: string | null;
  notes: string | null;
  requested_by_name?: string;
  decided_by_name?: string;
}

export interface EpisodeStoryboard {
  id: string;
  title: string;
  status: string;
  aspect_ratio: string;
}

export interface EpisodeDetail extends Episode {
  subjects: EpisodeSubject[];
  locations: EpisodeLocation[];
  list_items: EpisodeListItem[];
  milestones: EpisodeMilestone[];
  deliverables: EpisodeDeliverable[];
  asset_links: EpisodeAssetLink[];
  shoot_days: EpisodeShootDay[];
  approvals: EpisodeApproval[];
  storyboards: EpisodeStoryboard[];
}

export interface DeliverableTemplate {
  id: string;
  project_id: string;
  name: string;
  items: Array<{ deliverable_type: string; notes?: string }>;
  created_at: string;
  updated_at: string;
}

export interface ProjectDay {
  id: string;
  project_id: string;
  date: string;
  day_type: string;
  title: string | null;
}

export interface EpisodeSettings {
  canCreate: string[];
  canEdit: string[];
  canDelete: string[];
  canApproveEditLock: string[];
  canApproveDelivery: string[];
  defaultAssignees: {
    editorUserId: string | null;
    postSupervisorUserId: string | null;
  };
}

export interface PrintData {
  project_title: string;
  generated_at: string;
  seasons: Array<{
    id: string | null;
    season_number: number | null;
    title: string | null;
    episodes: Episode[];
  }>;
}

// =====================================================
// Constants
// =====================================================

export const PIPELINE_STAGES: { value: EpisodePipelineStage; label: string; color: string }[] = [
  { value: 'DEVELOPMENT', label: 'Development', color: 'bg-gray-500' },
  { value: 'PRE_PRO', label: 'Pre-Production', color: 'bg-blue-500' },
  { value: 'PRODUCTION', label: 'Production', color: 'bg-green-500' },
  { value: 'POST', label: 'Post-Production', color: 'bg-purple-500' },
  { value: 'DELIVERED', label: 'Delivered', color: 'bg-yellow-500' },
  { value: 'RELEASED', label: 'Released', color: 'bg-emerald-500' },
];

export const EDIT_STATUSES: { value: EpisodeEditStatus; label: string }[] = [
  { value: 'NOT_STARTED', label: 'Not Started' },
  { value: 'INGEST', label: 'Ingest' },
  { value: 'ASSEMBLY', label: 'Assembly' },
  { value: 'ROUGH_CUT', label: 'Rough Cut' },
  { value: 'FINE_CUT', label: 'Fine Cut' },
  { value: 'PICTURE_LOCK', label: 'Picture Lock' },
  { value: 'SOUND', label: 'Sound' },
  { value: 'COLOR', label: 'Color' },
  { value: 'MASTERING', label: 'Mastering' },
];

export const DELIVERY_STATUSES: { value: EpisodeDeliveryStatus; label: string }[] = [
  { value: 'NOT_STARTED', label: 'Not Started' },
  { value: 'QC', label: 'QC' },
  { value: 'CAPTIONS', label: 'Captions' },
  { value: 'ARTWORK', label: 'Artwork' },
  { value: 'EXPORTS', label: 'Exports' },
  { value: 'DELIVERED', label: 'Delivered' },
  { value: 'RELEASED', label: 'Released' },
];

export const SUBJECT_TYPES: { value: EpisodeSubjectType; label: string }[] = [
  { value: 'CAST', label: 'Cast' },
  { value: 'CREW', label: 'Crew' },
  { value: 'CONTRIBUTOR', label: 'Contributor' },
  { value: 'OTHER', label: 'Other' },
];

export const LIST_ITEM_KINDS: { value: EpisodeListItemKind; label: string }[] = [
  { value: 'INTERVIEW', label: 'Interview' },
  { value: 'SCENE', label: 'Scene' },
  { value: 'SEGMENT', label: 'Segment' },
];

export const DELIVERABLE_STATUSES_CONFIG: { value: DeliverableStatus; label: string; color: string }[] = [
  { value: 'NOT_STARTED', label: 'Not Started', color: 'bg-gray-500' },
  { value: 'IN_PROGRESS', label: 'In Progress', color: 'bg-blue-500' },
  { value: 'READY_FOR_REVIEW', label: 'Ready for Review', color: 'bg-yellow-500' },
  { value: 'APPROVED', label: 'Approved', color: 'bg-green-500' },
  { value: 'DELIVERED', label: 'Delivered', color: 'bg-emerald-500' },
];

export const APPROVAL_TYPES: { value: ApprovalType; label: string; description: string }[] = [
  { value: 'ROUGH_CUT', label: 'Rough Cut', description: 'First assembly review' },
  { value: 'FINE_CUT', label: 'Fine Cut', description: 'Refined edit review' },
  { value: 'PICTURE_LOCK', label: 'Picture Lock', description: 'Final picture approval - no more visual changes' },
  { value: 'COLOR', label: 'Color Grade', description: 'Color correction approval' },
  { value: 'SOUND', label: 'Sound Mix', description: 'Audio mix approval' },
  { value: 'DELIVERY_APPROVAL', label: 'Delivery Approval', description: 'Final delivery package approval' },
  { value: 'EDIT_LOCK', label: 'Edit Lock', description: 'Lock episode to prevent further edits' },
];

// =====================================================
// Query Keys
// =====================================================

const episodeKeys = {
  all: ['episodes'] as const,
  seasons: (projectId: string) => [...episodeKeys.all, 'seasons', projectId] as const,
  list: (projectId: string, filters?: { seasonId?: string; search?: string; pipelineStage?: string }) =>
    [...episodeKeys.all, 'list', projectId, filters] as const,
  detail: (projectId: string, episodeId: string) =>
    [...episodeKeys.all, 'detail', projectId, episodeId] as const,
  templates: (projectId: string) => [...episodeKeys.all, 'templates', projectId] as const,
  projectDays: (projectId: string, start?: string, end?: string) =>
    [...episodeKeys.all, 'projectDays', projectId, start, end] as const,
  storyboards: (projectId: string, unlinkedOnly?: boolean) =>
    [...episodeKeys.all, 'storyboards', projectId, unlinkedOnly] as const,
  settings: (projectId: string) => [...episodeKeys.all, 'settings', projectId] as const,
  allMilestones: (projectId: string) => [...episodeKeys.all, 'allMilestones', projectId] as const,
  print: (projectId: string, seasonId?: string) =>
    [...episodeKeys.all, 'print', projectId, seasonId] as const,
};

// =====================================================
// Season Hooks
// =====================================================

export function useSeasons(projectId: string | null) {
  return useQuery({
    queryKey: episodeKeys.seasons(projectId || ''),
    queryFn: async (): Promise<Season[]> => {
      if (!projectId) throw new Error('Project ID required');
      const response = await api.get(`/api/v1/backlot/projects/${projectId}/seasons`);
      return response.seasons;
    },
    enabled: !!projectId,
    staleTime: 30000,
  });
}

export function useCreateSeason(projectId: string | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: { season_number: number; title?: string }) => {
      if (!projectId) throw new Error('Project ID required');
      return api.post(`/api/v1/backlot/projects/${projectId}/seasons`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: episodeKeys.seasons(projectId || '') });
    },
  });
}

export function useUpdateSeason(projectId: string | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ seasonId, data }: { seasonId: string; data: Partial<{ season_number: number; title: string }> }) => {
      if (!projectId) throw new Error('Project ID required');
      return api.put(`/api/v1/backlot/projects/${projectId}/seasons/${seasonId}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: episodeKeys.seasons(projectId || '') });
      queryClient.invalidateQueries({ queryKey: episodeKeys.list(projectId || '') });
    },
  });
}

export function useDeleteSeason(projectId: string | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (seasonId: string) => {
      if (!projectId) throw new Error('Project ID required');
      return api.delete(`/api/v1/backlot/projects/${projectId}/seasons/${seasonId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: episodeKeys.seasons(projectId || '') });
      queryClient.invalidateQueries({ queryKey: episodeKeys.list(projectId || '') });
    },
  });
}

// =====================================================
// Episode List and CRUD Hooks
// =====================================================

export function useEpisodes(
  projectId: string | null,
  filters?: { seasonId?: string; search?: string; pipelineStage?: string }
) {
  return useQuery({
    queryKey: episodeKeys.list(projectId || '', filters),
    queryFn: async (): Promise<Episode[]> => {
      if (!projectId) throw new Error('Project ID required');
      const params = new URLSearchParams();
      if (filters?.seasonId) params.set('season_id', filters.seasonId);
      if (filters?.search) params.set('search', filters.search);
      if (filters?.pipelineStage) params.set('pipeline_stage', filters.pipelineStage);
      const url = `/api/v1/backlot/projects/${projectId}/episodes${params.toString() ? `?${params}` : ''}`;
      const response = await api.get(url);
      return response.episodes;
    },
    enabled: !!projectId,
    staleTime: 30000,
  });
}

// Helper to check if string looks like a UUID
const isValidUUID = (str: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);

export function useEpisode(projectId: string | null, episodeId: string | null) {
  // Only enable if episodeId is a valid UUID (prevents "all-milestones" etc from being passed)
  const isValidEpisodeId = !!episodeId && isValidUUID(episodeId);

  return useQuery({
    queryKey: episodeKeys.detail(projectId || '', episodeId || ''),
    queryFn: async (): Promise<EpisodeDetail> => {
      if (!projectId || !episodeId) throw new Error('Project ID and Episode ID required');
      return api.get(`/api/v1/backlot/projects/${projectId}/episodes/${episodeId}`);
    },
    enabled: !!projectId && isValidEpisodeId,
    staleTime: 30000,
  });
}

export function useCreateEpisode(projectId: string | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: {
      season_id?: string;
      episode_number: number;
      episode_code?: string;
      title: string;
      logline?: string;
      synopsis?: string;
      planned_runtime_minutes?: number;
    }) => {
      if (!projectId) throw new Error('Project ID required');
      return api.post(`/api/v1/backlot/projects/${projectId}/episodes`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: episodeKeys.list(projectId || '') });
      queryClient.invalidateQueries({ queryKey: episodeKeys.seasons(projectId || '') });
    },
  });
}

export function useUpdateEpisode(projectId: string | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ episodeId, data }: { episodeId: string; data: Partial<Episode> }) => {
      if (!projectId) throw new Error('Project ID required');
      return api.put(`/api/v1/backlot/projects/${projectId}/episodes/${episodeId}`, data);
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: episodeKeys.list(projectId || '') });
      queryClient.invalidateQueries({ queryKey: episodeKeys.detail(projectId || '', variables.episodeId) });
    },
  });
}

export function useDeleteEpisode(projectId: string | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (episodeId: string) => {
      if (!projectId) throw new Error('Project ID required');
      return api.delete(`/api/v1/backlot/projects/${projectId}/episodes/${episodeId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: episodeKeys.list(projectId || '') });
      queryClient.invalidateQueries({ queryKey: episodeKeys.seasons(projectId || '') });
    },
  });
}

// =====================================================
// Subject Hooks
// =====================================================

// Data type for creating/updating subjects with contact info
export interface SubjectWithContactData {
  subject_type: EpisodeSubjectType;
  name: string;
  role?: string;
  // Contact fields
  company?: string;
  email?: string;
  phone?: string;
  role_interest?: string;
  status?: string;
  source?: string;
  notes?: string;
}

export function useCreateSubject(projectId: string | null, episodeId: string | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: SubjectWithContactData) => {
      if (!projectId || !episodeId) throw new Error('Project and Episode IDs required');
      return api.post(`/api/v1/backlot/projects/${projectId}/episodes/${episodeId}/subjects`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: episodeKeys.detail(projectId || '', episodeId || '') });
      queryClient.invalidateQueries({ queryKey: ['backlot-contacts'] }); // Also refresh contacts
    },
  });
}

export function useUpdateSubject(projectId: string | null, episodeId: string | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ subjectId, data }: { subjectId: string; data: Partial<SubjectWithContactData> }) => {
      if (!projectId || !episodeId) throw new Error('Project and Episode IDs required');
      return api.put(`/api/v1/backlot/projects/${projectId}/episodes/${episodeId}/subjects/${subjectId}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: episodeKeys.detail(projectId || '', episodeId || '') });
      queryClient.invalidateQueries({ queryKey: ['backlot-contacts'] }); // Also refresh contacts
    },
  });
}

export function useDeleteSubject(projectId: string | null, episodeId: string | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (subjectId: string) => {
      if (!projectId || !episodeId) throw new Error('Project and Episode IDs required');
      return api.delete(`/api/v1/backlot/projects/${projectId}/episodes/${episodeId}/subjects/${subjectId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: episodeKeys.detail(projectId || '', episodeId || '') });
    },
  });
}

export function useLinkContact(projectId: string | null, episodeId: string | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (contactId: string) => {
      if (!projectId || !episodeId) throw new Error('Project and Episode IDs required');
      return api.post(`/api/v1/backlot/projects/${projectId}/episodes/${episodeId}/subjects/link-contact`, {
        contact_id: contactId,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: episodeKeys.detail(projectId || '', episodeId || '') });
      queryClient.invalidateQueries({ queryKey: ['backlot-contacts'] });
    },
  });
}

// =====================================================
// Location Hooks
// =====================================================

export function useCreateLocation(projectId: string | null, episodeId: string | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: { name: string; address?: string; notes?: string }) => {
      if (!projectId || !episodeId) throw new Error('Project and Episode IDs required');
      return api.post(`/api/v1/backlot/projects/${projectId}/episodes/${episodeId}/locations`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: episodeKeys.detail(projectId || '', episodeId || '') });
    },
  });
}

export function useUpdateLocation(projectId: string | null, episodeId: string | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ locationId, data }: { locationId: string; data: Partial<EpisodeLocation> }) => {
      if (!projectId || !episodeId) throw new Error('Project and Episode IDs required');
      return api.put(`/api/v1/backlot/projects/${projectId}/episodes/${episodeId}/locations/${locationId}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: episodeKeys.detail(projectId || '', episodeId || '') });
    },
  });
}

export function useDeleteLocation(projectId: string | null, episodeId: string | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (locationId: string) => {
      if (!projectId || !episodeId) throw new Error('Project and Episode IDs required');
      return api.delete(`/api/v1/backlot/projects/${projectId}/episodes/${episodeId}/locations/${locationId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: episodeKeys.detail(projectId || '', episodeId || '') });
    },
  });
}

export function useLinkProjectLocation(projectId: string | null, episodeId: string | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (projectLocationId: string) => {
      if (!projectId || !episodeId) throw new Error('Project and Episode IDs required');
      return api.post(`/api/v1/backlot/projects/${projectId}/episodes/${episodeId}/locations/link`, {
        project_location_id: projectLocationId,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: episodeKeys.detail(projectId || '', episodeId || '') });
    },
  });
}

// =====================================================
// List Item Hooks
// =====================================================

export function useCreateListItem(projectId: string | null, episodeId: string | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: { kind: EpisodeListItemKind; title: string; description?: string; status?: string }) => {
      if (!projectId || !episodeId) throw new Error('Project and Episode IDs required');
      return api.post(`/api/v1/backlot/projects/${projectId}/episodes/${episodeId}/list-items`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: episodeKeys.detail(projectId || '', episodeId || '') });
    },
  });
}

export function useUpdateListItem(projectId: string | null, episodeId: string | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ itemId, data }: { itemId: string; data: Partial<EpisodeListItem> }) => {
      if (!projectId || !episodeId) throw new Error('Project and Episode IDs required');
      return api.put(`/api/v1/backlot/projects/${projectId}/episodes/${episodeId}/list-items/${itemId}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: episodeKeys.detail(projectId || '', episodeId || '') });
    },
  });
}

export function useDeleteListItem(projectId: string | null, episodeId: string | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (itemId: string) => {
      if (!projectId || !episodeId) throw new Error('Project and Episode IDs required');
      return api.delete(`/api/v1/backlot/projects/${projectId}/episodes/${episodeId}/list-items/${itemId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: episodeKeys.detail(projectId || '', episodeId || '') });
    },
  });
}

export function useReorderListItem(projectId: string | null, episodeId: string | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: { item_id: string; direction: 'up' | 'down' }) => {
      if (!projectId || !episodeId) throw new Error('Project and Episode IDs required');
      return api.post(`/api/v1/backlot/projects/${projectId}/episodes/${episodeId}/list-items/reorder`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: episodeKeys.detail(projectId || '', episodeId || '') });
    },
  });
}

// =====================================================
// Milestone Hooks
// =====================================================

export function useCreateMilestone(projectId: string | null, episodeId: string | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: { milestone_type: string; date: string; notes?: string }) => {
      if (!projectId || !episodeId) throw new Error('Project and Episode IDs required');
      return api.post(`/api/v1/backlot/projects/${projectId}/episodes/${episodeId}/milestones`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: episodeKeys.detail(projectId || '', episodeId || '') });
    },
  });
}

export function useUpdateMilestone(projectId: string | null, episodeId: string | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ milestoneId, data }: { milestoneId: string; data: Partial<EpisodeMilestone> }) => {
      if (!projectId || !episodeId) throw new Error('Project and Episode IDs required');
      return api.put(`/api/v1/backlot/projects/${projectId}/episodes/${episodeId}/milestones/${milestoneId}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: episodeKeys.detail(projectId || '', episodeId || '') });
    },
  });
}

export function useDeleteMilestone(projectId: string | null, episodeId: string | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (milestoneId: string) => {
      if (!projectId || !episodeId) throw new Error('Project and Episode IDs required');
      return api.delete(`/api/v1/backlot/projects/${projectId}/episodes/${episodeId}/milestones/${milestoneId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: episodeKeys.detail(projectId || '', episodeId || '') });
    },
  });
}

// =====================================================
// Deliverable Hooks
// =====================================================

export function useEpisodeDeliverableTemplates(projectId: string | null) {
  return useQuery({
    queryKey: episodeKeys.templates(projectId || ''),
    queryFn: async (): Promise<DeliverableTemplate[]> => {
      if (!projectId) throw new Error('Project ID required');
      const response = await api.get(`/api/v1/backlot/projects/${projectId}/deliverable-templates`);
      return response.templates;
    },
    enabled: !!projectId,
    staleTime: 60000,
  });
}

export function useCreateDeliverableTemplate(projectId: string | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: { name: string; items: Array<{ deliverable_type: string; notes?: string }> }) => {
      if (!projectId) throw new Error('Project ID required');
      return api.post(`/api/v1/backlot/projects/${projectId}/deliverable-templates`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: episodeKeys.templates(projectId || '') });
    },
  });
}

export function useCreateDeliverable(projectId: string | null, episodeId: string | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: {
      deliverable_type: string;
      status?: DeliverableStatus;
      due_date?: string;
      owner_user_id?: string;
      notes?: string;
    }) => {
      if (!projectId || !episodeId) throw new Error('Project and Episode IDs required');
      return api.post(`/api/v1/backlot/projects/${projectId}/episodes/${episodeId}/deliverables`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: episodeKeys.detail(projectId || '', episodeId || '') });
    },
  });
}

export function useUpdateDeliverable(projectId: string | null, episodeId: string | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ deliverableId, data }: { deliverableId: string; data: Partial<EpisodeDeliverable> }) => {
      if (!projectId || !episodeId) throw new Error('Project and Episode IDs required');
      return api.put(`/api/v1/backlot/projects/${projectId}/episodes/${episodeId}/deliverables/${deliverableId}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: episodeKeys.detail(projectId || '', episodeId || '') });
    },
  });
}

export function useDeleteDeliverable(projectId: string | null, episodeId: string | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (deliverableId: string) => {
      if (!projectId || !episodeId) throw new Error('Project and Episode IDs required');
      return api.delete(`/api/v1/backlot/projects/${projectId}/episodes/${episodeId}/deliverables/${deliverableId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: episodeKeys.detail(projectId || '', episodeId || '') });
    },
  });
}

export function useLinkProjectDeliverable(projectId: string | null, episodeId: string | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (projectDeliverableId: string) => {
      if (!projectId || !episodeId) throw new Error('Project and Episode IDs required');
      return api.post(`/api/v1/backlot/projects/${projectId}/episodes/${episodeId}/deliverables/link`, {
        project_deliverable_id: projectDeliverableId,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: episodeKeys.detail(projectId || '', episodeId || '') });
    },
  });
}

export function useApplyDeliverableTemplate(projectId: string | null, episodeId: string | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (templateId: string) => {
      if (!projectId || !episodeId) throw new Error('Project and Episode IDs required');
      return api.post(`/api/v1/backlot/projects/${projectId}/episodes/${episodeId}/deliverables/apply-template`, {
        template_id: templateId,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: episodeKeys.detail(projectId || '', episodeId || '') });
    },
  });
}

// =====================================================
// Asset Link Hooks
// =====================================================

export function useCreateAssetLink(projectId: string | null, episodeId: string | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: { label: string; url: string }) => {
      if (!projectId || !episodeId) throw new Error('Project and Episode IDs required');
      return api.post(`/api/v1/backlot/projects/${projectId}/episodes/${episodeId}/asset-links`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: episodeKeys.detail(projectId || '', episodeId || '') });
    },
  });
}

export function useDeleteAssetLink(projectId: string | null, episodeId: string | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (linkId: string) => {
      if (!projectId || !episodeId) throw new Error('Project and Episode IDs required');
      return api.delete(`/api/v1/backlot/projects/${projectId}/episodes/${episodeId}/asset-links/${linkId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: episodeKeys.detail(projectId || '', episodeId || '') });
    },
  });
}

export function useLinkAsset(projectId: string | null, episodeId: string | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (assetId: string) => {
      if (!projectId || !episodeId) throw new Error('Project and Episode IDs required');
      return api.post(`/api/v1/backlot/projects/${projectId}/episodes/${episodeId}/asset-links/link-asset`, {
        asset_id: assetId,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: episodeKeys.detail(projectId || '', episodeId || '') });
    },
  });
}

// =====================================================
// Shoot Day Hooks
// =====================================================

export function useProjectDays(projectId: string | null, start?: string, end?: string) {
  return useQuery({
    queryKey: episodeKeys.projectDays(projectId || '', start, end),
    queryFn: async (): Promise<ProjectDay[]> => {
      if (!projectId) throw new Error('Project ID required');
      const params = new URLSearchParams();
      if (start) params.set('start', start);
      if (end) params.set('end', end);
      const url = `/api/v1/backlot/projects/${projectId}/project-days${params.toString() ? `?${params}` : ''}`;
      const response = await api.get(url);
      return response.days;
    },
    enabled: !!projectId,
    staleTime: 60000,
  });
}

export function useTagShootDay(projectId: string | null, episodeId: string | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (productionDayId: string) => {
      if (!projectId || !episodeId) throw new Error('Project and Episode IDs required');
      return api.post(`/api/v1/backlot/projects/${projectId}/episodes/${episodeId}/shoot-days`, {
        production_day_id: productionDayId,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: episodeKeys.detail(projectId || '', episodeId || '') });
    },
  });
}

export function useUntagShootDay(projectId: string | null, episodeId: string | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (shootDayId: string) => {
      if (!projectId || !episodeId) throw new Error('Project and Episode IDs required');
      return api.delete(`/api/v1/backlot/projects/${projectId}/episodes/${episodeId}/shoot-days/${shootDayId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: episodeKeys.detail(projectId || '', episodeId || '') });
    },
  });
}

// =====================================================
// Storyboard Linking Hooks
// =====================================================

export function useProjectStoryboards(projectId: string | null, unlinkedOnly: boolean = false) {
  return useQuery({
    queryKey: episodeKeys.storyboards(projectId || '', unlinkedOnly),
    queryFn: async (): Promise<EpisodeStoryboard[]> => {
      if (!projectId) throw new Error('Project ID required');
      const url = `/api/v1/backlot/projects/${projectId}/storyboards${unlinkedOnly ? '?unlinked_only=true' : ''}`;
      const response = await api.get(url);
      return response.storyboards;
    },
    enabled: !!projectId,
    staleTime: 30000,
  });
}

export function useLinkStoryboard(projectId: string | null, episodeId: string | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (storyboardId: string) => {
      if (!projectId || !episodeId) throw new Error('Project and Episode IDs required');
      return api.post(`/api/v1/backlot/projects/${projectId}/episodes/${episodeId}/link-storyboard`, {
        storyboard_id: storyboardId,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: episodeKeys.detail(projectId || '', episodeId || '') });
      queryClient.invalidateQueries({ queryKey: episodeKeys.storyboards(projectId || '') });
    },
  });
}

export function useUnlinkStoryboard(projectId: string | null, episodeId: string | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (storyboardId: string) => {
      if (!projectId || !episodeId) throw new Error('Project and Episode IDs required');
      return api.post(`/api/v1/backlot/projects/${projectId}/episodes/${episodeId}/unlink-storyboard`, {
        storyboard_id: storyboardId,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: episodeKeys.detail(projectId || '', episodeId || '') });
      queryClient.invalidateQueries({ queryKey: episodeKeys.storyboards(projectId || '') });
    },
  });
}

// =====================================================
// Approval Hooks
// =====================================================

export function useRequestApproval(projectId: string | null, episodeId: string | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: { approval_type: ApprovalType; notes?: string }) => {
      if (!projectId || !episodeId) throw new Error('Project and Episode IDs required');
      return api.post(`/api/v1/backlot/projects/${projectId}/episodes/${episodeId}/approvals`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: episodeKeys.detail(projectId || '', episodeId || '') });
      queryClient.invalidateQueries({ queryKey: episodeKeys.list(projectId || '') });
    },
  });
}

export function useDecideApproval(projectId: string | null, episodeId: string | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ approvalId, decision, notes }: { approvalId: string; decision: 'APPROVE' | 'REJECT'; notes?: string }) => {
      if (!projectId || !episodeId) throw new Error('Project and Episode IDs required');
      return api.post(`/api/v1/backlot/projects/${projectId}/episodes/${episodeId}/approvals/${approvalId}/decide`, {
        decision,
        notes,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: episodeKeys.detail(projectId || '', episodeId || '') });
      queryClient.invalidateQueries({ queryKey: episodeKeys.list(projectId || '') });
    },
  });
}

export function useUnlockEpisode(projectId: string | null, episodeId: string | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      if (!projectId || !episodeId) throw new Error('Project and Episode IDs required');
      return api.post(`/api/v1/backlot/projects/${projectId}/episodes/${episodeId}/unlock`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: episodeKeys.detail(projectId || '', episodeId || '') });
      queryClient.invalidateQueries({ queryKey: episodeKeys.list(projectId || '') });
    },
  });
}

// =====================================================
// Milestone Import Hooks
// =====================================================

export interface MilestoneWithEpisode extends EpisodeMilestone {
  episode_code: string;
  episode_title: string;
}

export function useAllMilestones(projectId: string | null) {
  return useQuery({
    queryKey: episodeKeys.allMilestones(projectId || ''),
    queryFn: async (): Promise<MilestoneWithEpisode[]> => {
      if (!projectId) throw new Error('Project ID required');
      const response = await api.get(`/api/v1/backlot/projects/${projectId}/episodes/all-milestones`);
      return response.milestones;
    },
    enabled: !!projectId,
    staleTime: 30000,
  });
}

export function useImportMilestones(projectId: string | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (milestoneIds: string[]) => {
      if (!projectId) throw new Error('Project ID required');
      return api.post(`/api/v1/backlot/projects/${projectId}/production-days/from-milestones`, {
        milestone_ids: milestoneIds,
      });
    },
    onSuccess: () => {
      // Invalidate production days to refresh schedule
      queryClient.invalidateQueries({ queryKey: ['backlot', 'production-days', projectId] });
    },
  });
}

// =====================================================
// Settings Hooks
// =====================================================

export function useEpisodeSettings(projectId: string | null) {
  return useQuery({
    queryKey: episodeKeys.settings(projectId || ''),
    queryFn: async (): Promise<EpisodeSettings> => {
      if (!projectId) throw new Error('Project ID required');
      const response = await api.get(`/api/v1/backlot/projects/${projectId}/episode-settings`);
      return response.settings;
    },
    enabled: !!projectId,
    staleTime: 60000,
  });
}

export function useUpdateEpisodeSettings(projectId: string | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (settings: EpisodeSettings) => {
      if (!projectId) throw new Error('Project ID required');
      return api.put(`/api/v1/backlot/projects/${projectId}/episode-settings`, {
        settings_json: settings,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: episodeKeys.settings(projectId || '') });
    },
  });
}

// =====================================================
// Import/Export Hooks
// =====================================================

export function useImportEpisodes(projectId: string | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (file: File) => {
      if (!projectId) throw new Error('Project ID required');
      const formData = new FormData();
      formData.append('file', file);
      return api.post(`/api/v1/backlot/projects/${projectId}/episodes/import`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: episodeKeys.list(projectId || '') });
      queryClient.invalidateQueries({ queryKey: episodeKeys.seasons(projectId || '') });
    },
  });
}

export function usePrintData(projectId: string | null, seasonId?: string, enabled: boolean = false) {
  return useQuery({
    queryKey: episodeKeys.print(projectId || '', seasonId),
    queryFn: async (): Promise<PrintData> => {
      if (!projectId) throw new Error('Project ID required');
      const url = `/api/v1/backlot/projects/${projectId}/episodes/print${seasonId ? `?season_id=${seasonId}` : ''}`;
      return api.get(url);
    },
    enabled: !!projectId && enabled,
  });
}

// =====================================================
// Episode-Story Link Types
// =====================================================

export interface EpisodeStoryLink {
  id: string;
  story_id: string;
  episode_id: string;
  relationship: string;
  notes: string | null;
  created_at: string;
  story?: {
    id: string;
    title: string;
    logline: string | null;
    genre: string | null;
    tone: string | null;
    structure_type: string | null;
  };
}

// =====================================================
// Episode-Story Link Hooks
// =====================================================

export function useEpisodeStoryLinks(projectId: string | null, episodeId: string | null) {
  return useQuery({
    queryKey: [...episodeKeys.all, 'storyLinks', projectId || '', episodeId || ''],
    queryFn: async (): Promise<EpisodeStoryLink[]> => {
      if (!projectId || !episodeId) throw new Error('Project ID and Episode ID required');
      const response = await api.get(`/api/v1/backlot/projects/${projectId}/episodes/${episodeId}/stories`);
      return response.links;
    },
    enabled: !!projectId && !!episodeId,
    staleTime: 30000,
  });
}

export function useLinkEpisodeToStory(projectId: string | null, episodeId: string | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: { story_id: string; relationship?: string; notes?: string }) => {
      if (!projectId || !episodeId) throw new Error('Project ID and Episode ID required');
      return api.post(`/api/v1/backlot/projects/${projectId}/episodes/${episodeId}/stories`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [...episodeKeys.all, 'storyLinks', projectId || '', episodeId || ''] });
      queryClient.invalidateQueries({ queryKey: episodeKeys.detail(projectId || '', episodeId || '') });
      // Also invalidate story-side connections
      queryClient.invalidateQueries({ queryKey: ['stories'] });
    },
  });
}

export function useUnlinkEpisodeFromStory(projectId: string | null, episodeId: string | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (linkId: string) => {
      if (!projectId || !episodeId) throw new Error('Project ID and Episode ID required');
      return api.delete(`/api/v1/backlot/projects/${projectId}/episodes/${episodeId}/stories/${linkId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [...episodeKeys.all, 'storyLinks', projectId || '', episodeId || ''] });
      queryClient.invalidateQueries({ queryKey: episodeKeys.detail(projectId || '', episodeId || '') });
      // Also invalidate story-side connections
      queryClient.invalidateQueries({ queryKey: ['stories'] });
    },
  });
}

// =====================================================
// Helper Functions
// =====================================================

export function getEpisodeExportUrl(projectId: string, seasonId?: string): string {
  const baseUrl = import.meta.env.VITE_API_URL || '';
  return `${baseUrl}/api/v1/backlot/projects/${projectId}/episodes/export.csv${seasonId ? `?season_id=${seasonId}` : ''}`;
}

export function getImportTemplateUrl(projectId: string): string {
  const baseUrl = import.meta.env.VITE_API_URL || '';
  return `${baseUrl}/api/v1/backlot/projects/${projectId}/episodes/template.csv`;
}

export function getPipelineStageInfo(stage: EpisodePipelineStage) {
  return PIPELINE_STAGES.find((s) => s.value === stage);
}

export function getEditStatusInfo(status: EpisodeEditStatus) {
  return EDIT_STATUSES.find((s) => s.value === status);
}

export function getDeliveryStatusInfo(status: EpisodeDeliveryStatus) {
  return DELIVERY_STATUSES.find((s) => s.value === status);
}

export function getDeliverableStatusInfo(status: DeliverableStatus) {
  return DELIVERABLE_STATUSES_CONFIG.find((s) => s.value === status);
}

export function getApprovalTypeInfo(type: ApprovalType) {
  return APPROVAL_TYPES.find((t) => t.value === type);
}

export function formatEpisodeCode(seasonNumber: number | null, episodeNumber: number): string {
  if (seasonNumber) {
    return `S${seasonNumber.toString().padStart(2, '0')}E${episodeNumber.toString().padStart(2, '0')}`;
  }
  return `E${episodeNumber.toString().padStart(2, '0')}`;
}
