/**
 * useSceneHub - Hook for Scene Detail Page hub data
 * Provides comprehensive scene data including all related entities
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';

// Types matching backend models
export interface SceneMetadata {
  id: string;
  project_id: string;
  script_id: string | null;
  scene_number: string;
  slugline: string | null;
  int_ext: string | null;
  day_night: string | null;
  page_length: number | null;
  page_start: number | null;
  page_end: number | null;
  location_hint: string | null;
  location_id: string | null;
  scheduled_day_id: string | null;
  shot_day_id: string | null;
  is_scheduled: boolean;
  is_shot: boolean;
  needs_pickup: boolean;
  created_at: string | null;
  updated_at: string | null;
}

export interface BreakdownItem {
  id: string;
  scene_id: string;
  type: string;
  name: string;
  description: string | null;
  notes: string | null;
  quantity: number | null;
}

export interface ShotSummary {
  id: string;
  shot_number: string;
  description: string | null;
  frame_size: string | null;
  camera_movement: string | null;
  is_covered: boolean;
  circle_take_count: number;
}

export interface LocationSummary {
  id: string;
  name: string;
  address: string | null;
  type: string | null;
  is_primary: boolean;
}

export interface DailiesClipSummary {
  id: string;
  file_name: string;
  scene_number: string | null;
  take_number: number | null;
  is_circle_take: boolean;
  rating: number | null;
  duration_seconds: number | null;
}

export interface TaskSummary {
  id: string;
  title: string;
  status: string;
  priority: string | null;
  due_date: string | null;
  assigned_to_name: string | null;
}

export interface CallSheetLink {
  id: string;
  call_sheet_id: string;
  call_sheet_title: string;
  call_sheet_date: string;
  is_published: boolean;
  sequence: number;
  status: string;
}

export interface BudgetItemSummary {
  id: string;
  description: string;
  category_name: string | null;
  rate_amount: number;
  quantity: number;
  actual_total: number;
  vendor_name: string | null;
  is_from_location: boolean;
}

export interface ReceiptSummary {
  id: string;
  vendor_name: string | null;
  description: string | null;
  amount: number | null;
  purchase_date: string | null;
  is_verified: boolean;
  is_from_location: boolean;
  file_url: string | null;
}

export interface ClearanceSummary {
  id: string;
  type: string;
  title: string;
  status: string;
  related_person_name: string | null;
  expiration_date: string | null;
  is_from_location: boolean;
  file_url: string | null;
}

export interface CoverageSummary {
  total_shots: number;
  covered_shots: number;
  coverage_percent: number;
  total_clips: number;
  circle_takes: number;
  is_shot: boolean;
  needs_pickup: boolean;
}

export interface BudgetSummary {
  total_items: number;
  total_estimated: number;
  total_actual: number;
  total_receipts: number;
  receipts_count: number;
}

export interface ClearanceSummaryStats {
  total_items: number;
  signed_count: number;
  pending_count: number;
  completion_percent: number;
}

export interface SceneHubData {
  scene: SceneMetadata;
  breakdown_items: BreakdownItem[];
  breakdown_by_type: Record<string, BreakdownItem[]>;
  shots: ShotSummary[];
  locations: LocationSummary[];
  dailies_clips: DailiesClipSummary[];
  tasks: TaskSummary[];
  coverage_summary: CoverageSummary;
  call_sheet_links: CallSheetLink[];
  budget_items: BudgetItemSummary[];
  budget_items_from_location: BudgetItemSummary[];
  receipts: ReceiptSummary[];
  receipts_from_location: ReceiptSummary[];
  clearances: ClearanceSummary[];
  clearances_from_location: ClearanceSummary[];
  budget_summary: BudgetSummary;
  clearance_summary: ClearanceSummaryStats;
}

/**
 * Get comprehensive scene hub data
 */
export function useSceneHub(projectId: string | null, sceneId: string | null) {
  return useQuery({
    queryKey: ['backlot', 'scenes', projectId, sceneId, 'hub'],
    queryFn: async () => {
      if (!projectId || !sceneId) return null;
      return apiClient.get<SceneHubData>(
        `/api/v1/backlot/projects/${projectId}/scenes/${sceneId}/hub`
      );
    },
    enabled: !!projectId && !!sceneId,
  });
}

/**
 * Mutations for linking entities to scenes
 */
export function useSceneLinkMutations(projectId: string, sceneId: string) {
  const queryClient = useQueryClient();

  const invalidateHub = () => {
    queryClient.invalidateQueries({
      queryKey: ['backlot', 'scenes', projectId, sceneId, 'hub'],
    });
  };

  // Link budget item to scene
  const linkBudgetItem = useMutation({
    mutationFn: async (itemId: string) => {
      return apiClient.post(
        `/api/v1/backlot/scenes/${sceneId}/budget-items/${itemId}/link`
      );
    },
    onSuccess: invalidateHub,
  });

  // Unlink budget item from scene
  const unlinkBudgetItem = useMutation({
    mutationFn: async (itemId: string) => {
      return apiClient.delete(
        `/api/v1/backlot/scenes/${sceneId}/budget-items/${itemId}/link`
      );
    },
    onSuccess: invalidateHub,
  });

  // Link receipt to scene
  const linkReceipt = useMutation({
    mutationFn: async (receiptId: string) => {
      return apiClient.post(
        `/api/v1/backlot/scenes/${sceneId}/receipts/${receiptId}/link`
      );
    },
    onSuccess: invalidateHub,
  });

  // Unlink receipt from scene
  const unlinkReceipt = useMutation({
    mutationFn: async (receiptId: string) => {
      return apiClient.delete(
        `/api/v1/backlot/scenes/${sceneId}/receipts/${receiptId}/link`
      );
    },
    onSuccess: invalidateHub,
  });

  // Link clearance to scene
  const linkClearance = useMutation({
    mutationFn: async (clearanceId: string) => {
      return apiClient.post(
        `/api/v1/backlot/scenes/${sceneId}/clearances/${clearanceId}/link`
      );
    },
    onSuccess: invalidateHub,
  });

  // Unlink clearance from scene
  const unlinkClearance = useMutation({
    mutationFn: async (clearanceId: string) => {
      return apiClient.delete(
        `/api/v1/backlot/scenes/${sceneId}/clearances/${clearanceId}/link`
      );
    },
    onSuccess: invalidateHub,
  });

  // Update scene location
  const updateLocation = useMutation({
    mutationFn: async (locationId: string | null) => {
      return apiClient.patch(
        `/api/v1/backlot/projects/${projectId}/scenes/${sceneId}`,
        { location_id: locationId }
      );
    },
    onSuccess: invalidateHub,
  });

  return {
    linkBudgetItem,
    unlinkBudgetItem,
    linkReceipt,
    unlinkReceipt,
    linkClearance,
    unlinkClearance,
    updateLocation,
  };
}

// Clearance type labels
export const CLEARANCE_TYPES = [
  { value: 'talent_release', label: 'Talent Release' },
  { value: 'location_release', label: 'Location Release' },
  { value: 'appearance_release', label: 'Appearance Release' },
  { value: 'nda', label: 'NDA' },
  { value: 'music_license', label: 'Music License' },
  { value: 'stock_license', label: 'Stock License' },
  { value: 'other_contract', label: 'Other Contract' },
] as const;

// Clearance status labels and colors
export const CLEARANCE_STATUSES = [
  { value: 'not_started', label: 'Not Started', color: 'bg-gray-500' },
  { value: 'requested', label: 'Requested', color: 'bg-yellow-500' },
  { value: 'signed', label: 'Signed', color: 'bg-green-500' },
  { value: 'expired', label: 'Expired', color: 'bg-red-500' },
  { value: 'rejected', label: 'Rejected', color: 'bg-red-600' },
] as const;

export function getClearanceTypeLabel(type: string) {
  return CLEARANCE_TYPES.find((t) => t.value === type)?.label || type;
}

export function getClearanceStatusInfo(status: string) {
  return (
    CLEARANCE_STATUSES.find((s) => s.value === status) || CLEARANCE_STATUSES[0]
  );
}
