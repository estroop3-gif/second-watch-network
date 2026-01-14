/**
 * useExpenses - Hooks for Expenses system
 * Provides mileage, kit rentals, per diem, and expense settings management
 */
import React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';

// =============================================================================
// TYPES
// =============================================================================

// Mileage Types
export interface MileageEntry {
  id: string;
  project_id: string;
  user_id: string;
  date: string;
  description: string | null;
  start_location: string | null;
  end_location: string | null;
  miles: number;
  rate_per_mile: number;
  total_amount: number | null;
  is_round_trip: boolean;
  purpose: string | null;
  receipt_id: string | null;
  status: 'pending' | 'approved' | 'rejected' | 'reimbursed';
  approved_by: string | null;
  approved_at: string | null;
  rejected_by: string | null;
  rejected_at: string | null;
  rejection_reason: string | null;
  reimbursed_at: string | null;
  reimbursed_via: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  user_name?: string | null;
  // Scene linking
  scene_id: string | null;
}

export interface CreateMileageData {
  date: string;
  description?: string | null;
  start_location?: string | null;
  end_location?: string | null;
  miles: number;
  rate_per_mile?: number;
  is_round_trip?: boolean;
  purpose?: string | null;
  receipt_id?: string | null;
  notes?: string | null;
  scene_id?: string | null;
}

export interface UpdateMileageData {
  description?: string | null;
  start_location?: string | null;
  end_location?: string | null;
  miles?: number;
  rate_per_mile?: number;
  is_round_trip?: boolean;
  purpose?: string | null;
  receipt_id?: string | null;
  notes?: string | null;
  scene_id?: string | null;
}

// Kit Rental Types
export type KitRentalGearSourceType = 'asset' | 'kit' | 'lite' | null;

export interface KitRental {
  id: string;
  project_id: string;
  user_id: string;
  kit_name: string;
  kit_description: string | null;
  daily_rate: number;
  weekly_rate: number | null;
  start_date: string;
  end_date: string | null;
  days_used: number | null;
  total_amount: number | null;
  rental_type: 'daily' | 'weekly' | 'flat';
  status: 'draft' | 'pending' | 'approved' | 'rejected' | 'active' | 'completed' | 'reimbursed';
  approved_by: string | null;
  approved_at: string | null;
  rejected_by: string | null;
  rejected_at: string | null;
  rejection_reason: string | null;
  completed_at: string | null;
  reimbursed_at: string | null;
  reimbursed_via: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  user_name?: string | null;
  // Scene linking
  scene_id: string | null;
  // Gear House linking
  gear_source_type: KitRentalGearSourceType;
  gear_organization_id: string | null;
  gear_asset_id: string | null;
  gear_kit_instance_id: string | null;
  // Computed from gear joins
  gear_asset_name?: string | null;
  gear_asset_internal_id?: string | null;
  gear_kit_name?: string | null;
  gear_organization_name?: string | null;
}

export interface CreateKitRentalData {
  kit_name: string;
  kit_description?: string | null;
  daily_rate: number;
  weekly_rate?: number | null;
  start_date: string;
  end_date?: string | null;
  rental_type?: 'daily' | 'weekly' | 'flat';
  notes?: string | null;
  scene_id?: string | null;
  // Gear House linking (optional)
  gear_source_type?: KitRentalGearSourceType;
  gear_organization_id?: string | null;
  gear_asset_id?: string | null;
  gear_kit_instance_id?: string | null;
}

export interface UpdateKitRentalData {
  kit_name?: string;
  kit_description?: string | null;
  daily_rate?: number;
  weekly_rate?: number | null;
  end_date?: string | null;
  rental_type?: 'daily' | 'weekly' | 'flat';
  notes?: string | null;
  scene_id?: string | null;
  // Gear House linking (can be updated)
  gear_source_type?: KitRentalGearSourceType;
  gear_organization_id?: string | null;
  gear_asset_id?: string | null;
  gear_kit_instance_id?: string | null;
}

// Per Diem Types
export interface PerDiemEntry {
  id: string;
  project_id: string;
  user_id: string;
  date: string;
  meal_type: 'breakfast' | 'lunch' | 'dinner' | 'full_day';
  amount: number;
  location: string | null;
  status: 'pending' | 'approved' | 'rejected' | 'reimbursed';
  approved_by: string | null;
  approved_at: string | null;
  rejected_by: string | null;
  rejected_at: string | null;
  rejection_reason: string | null;
  reimbursed_at: string | null;
  reimbursed_via: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  user_name?: string | null;
  // Scene linking
  scene_id: string | null;
}

export interface CreatePerDiemData {
  date: string;
  meal_type: 'breakfast' | 'lunch' | 'dinner' | 'full_day';
  amount: number;
  location?: string | null;
  notes?: string | null;
  scene_id?: string | null;
}

export interface BulkPerDiemData {
  start_date: string;
  end_date: string;
  meal_type: 'breakfast' | 'lunch' | 'dinner' | 'full_day';
  amount: number;
  location?: string | null;
  notes?: string | null;
  scene_id?: string | null;
}

export interface UpdatePerDiemData {
  meal_type?: 'breakfast' | 'lunch' | 'dinner' | 'full_day';
  amount?: number;
  location?: string | null;
  notes?: string | null;
  scene_id?: string | null;
}

// Expense Settings Types
export interface ExpenseSettings {
  project_id: string;
  mileage_rate: number;
  per_diem_breakfast: number;
  per_diem_lunch: number;
  per_diem_dinner: number;
  per_diem_full_day: number;
  require_receipts_over: number;
  require_mileage_locations: boolean;
  auto_approve_under: number | null;
  allowed_categories: string[];
  created_at?: string;
  updated_at?: string;
}

export interface UpdateExpenseSettingsData {
  mileage_rate?: number;
  per_diem_breakfast?: number;
  per_diem_lunch?: number;
  per_diem_dinner?: number;
  per_diem_full_day?: number;
  require_receipts_over?: number;
  require_mileage_locations?: boolean;
  auto_approve_under?: number | null;
  allowed_categories?: string[];
}

// Summary Types
export interface ExpenseSummary {
  pending_mileage: number;
  pending_kit_rentals: number;
  pending_per_diem: number;
  pending_receipts: number;
  total_pending: number;
  approved_mileage: number;
  approved_kit_rentals: number;
  approved_per_diem: number;
  approved_receipts: number;
  total_approved: number;
  reimbursed_total: number;
  pending_count: number;
  approved_count: number;
}

// =============================================================================
// MILEAGE HOOKS
// =============================================================================

export interface MileageFilters {
  status?: string;
  user_id?: string;
  start_date?: string;
  end_date?: string;
}

export function useMileageEntries(projectId: string | null, filters?: MileageFilters) {
  return useQuery({
    queryKey: ['backlot', 'expenses', 'mileage', projectId, filters],
    queryFn: async () => {
      if (!projectId) return [];
      const params = new URLSearchParams();
      if (filters?.status) params.append('status', filters.status);
      if (filters?.user_id) params.append('user_id', filters.user_id);
      if (filters?.start_date) params.append('start_date', filters.start_date);
      if (filters?.end_date) params.append('end_date', filters.end_date);
      const queryString = params.toString();
      return apiClient.get<MileageEntry[]>(
        `/api/v1/backlot/projects/${projectId}/mileage${queryString ? `?${queryString}` : ''}`
      );
    },
    enabled: !!projectId,
  });
}

/**
 * Get a single mileage entry by ID
 */
export function useMileageEntry(projectId: string | null, mileageId: string | null) {
  return useQuery({
    queryKey: ['backlot', 'expenses', 'mileage', projectId, mileageId],
    queryFn: async () => {
      if (!projectId || !mileageId) return null;
      return apiClient.get<MileageEntry>(
        `/api/v1/backlot/projects/${projectId}/mileage/${mileageId}`
      );
    },
    enabled: !!projectId && !!mileageId,
  });
}

export function useCreateMileage(projectId: string | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: CreateMileageData) => {
      if (!projectId) throw new Error('Project ID required');
      return apiClient.post<MileageEntry>(`/api/v1/backlot/projects/${projectId}/mileage`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['backlot', 'expenses', 'mileage', projectId] });
      queryClient.invalidateQueries({ queryKey: ['backlot', 'expenses', 'summary', projectId] });
    },
  });
}

export function useUpdateMileage(projectId: string | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ mileageId, data }: { mileageId: string; data: UpdateMileageData }) => {
      if (!projectId) throw new Error('Project ID required');
      return apiClient.put<MileageEntry>(`/api/v1/backlot/projects/${projectId}/mileage/${mileageId}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['backlot', 'expenses', 'mileage', projectId] });
      queryClient.invalidateQueries({ queryKey: ['backlot', 'expenses', 'summary', projectId] });
    },
  });
}

export function useDeleteMileage(projectId: string | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (mileageId: string) => {
      if (!projectId) throw new Error('Project ID required');
      return apiClient.delete(`/api/v1/backlot/projects/${projectId}/mileage/${mileageId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['backlot', 'expenses', 'mileage', projectId] });
      queryClient.invalidateQueries({ queryKey: ['backlot', 'expenses', 'summary', projectId] });
    },
  });
}

export function useApproveMileage(projectId: string | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ mileageId, notes }: { mileageId: string; notes?: string }) => {
      if (!projectId) throw new Error('Project ID required');
      return apiClient.post(`/api/v1/backlot/projects/${projectId}/mileage/${mileageId}/approve`, notes ? { notes } : {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['backlot', 'expenses', 'mileage', projectId] });
      queryClient.invalidateQueries({ queryKey: ['backlot', 'expenses', 'summary', projectId] });
      // Also invalidate budget and invoice queries for cross-tab sync
      queryClient.invalidateQueries({ queryKey: ['backlot', 'budget', projectId] });
      queryClient.invalidateQueries({ queryKey: ['backlot', 'invoices', projectId, 'importable'] });
      // Invalidate budget actuals queries - approval records to budget actuals
      queryClient.invalidateQueries({ queryKey: ['backlot-budget-actuals', projectId] });
      queryClient.invalidateQueries({ queryKey: ['backlot-budget-actuals-summary', projectId] });
      queryClient.invalidateQueries({ queryKey: ['backlot-budget-comparison', projectId] });
    },
  });
}

export function useRejectMileage(projectId: string | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ mileageId, reason }: { mileageId: string; reason?: string }) => {
      if (!projectId) throw new Error('Project ID required');
      return apiClient.post(`/api/v1/backlot/projects/${projectId}/mileage/${mileageId}/reject`, { reason });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['backlot', 'expenses', 'mileage', projectId] });
      queryClient.invalidateQueries({ queryKey: ['backlot', 'expenses', 'summary', projectId] });
      // Also invalidate budget queries for cross-tab sync
      queryClient.invalidateQueries({ queryKey: ['backlot', 'budget', projectId] });
    },
  });
}

export function useDenyMileage(projectId: string | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ mileageId, reason }: { mileageId: string; reason: string }) => {
      if (!projectId) throw new Error('Project ID required');
      return apiClient.post(`/api/v1/backlot/projects/${projectId}/mileage/${mileageId}/deny`, { reason });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['backlot', 'expenses', 'mileage', projectId] });
      queryClient.invalidateQueries({ queryKey: ['backlot', 'expenses', 'summary', projectId] });
      queryClient.invalidateQueries({ queryKey: ['backlot', 'budget', projectId] });
    },
  });
}

export function useResubmitMileage(projectId: string | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (mileageId: string) => {
      if (!projectId) throw new Error('Project ID required');
      return apiClient.post(`/api/v1/backlot/projects/${projectId}/mileage/${mileageId}/resubmit`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['backlot', 'expenses', 'mileage', projectId] });
      queryClient.invalidateQueries({ queryKey: ['backlot', 'expenses', 'summary', projectId] });
      queryClient.invalidateQueries({ queryKey: ['backlot', 'budget', projectId] });
    },
  });
}

export function useMarkMileageReimbursed(projectId: string | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ mileageId, via }: { mileageId: string; via?: string }) => {
      if (!projectId) throw new Error('Project ID required');
      return apiClient.post(`/api/v1/backlot/projects/${projectId}/mileage/${mileageId}/mark-reimbursed`, { via });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['backlot', 'expenses', 'mileage', projectId] });
      queryClient.invalidateQueries({ queryKey: ['backlot', 'expenses', 'summary', projectId] });
      // Also invalidate budget queries for cross-tab sync
      queryClient.invalidateQueries({ queryKey: ['backlot', 'budget', projectId] });
    },
  });
}

/**
 * Submit a draft mileage entry for approval (changes status from draft to pending)
 */
export function useSubmitMileageForApproval(projectId: string | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (mileageId: string) => {
      if (!projectId) throw new Error('Project ID required');
      return apiClient.post<MileageEntry>(`/api/v1/backlot/projects/${projectId}/mileage/${mileageId}/submit-for-approval`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['backlot', 'expenses', 'mileage', projectId] });
      queryClient.invalidateQueries({ queryKey: ['backlot', 'expenses', 'summary', projectId] });
    },
  });
}

/**
 * Bulk submit draft mileage entries for approval
 */
export function useBulkSubmitMileageForApproval(projectId: string | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (entryIds: string[]) => {
      if (!projectId) throw new Error('Project ID required');
      return apiClient.post<{ submitted_count: number; failed_count: number; failed_ids: string[] }>(
        `/api/v1/backlot/projects/${projectId}/mileage/bulk-submit-for-approval`,
        { entry_ids: entryIds }
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['backlot', 'expenses', 'mileage', projectId] });
      queryClient.invalidateQueries({ queryKey: ['backlot', 'expenses', 'summary', projectId] });
    },
  });
}

// =============================================================================
// KIT RENTAL HOOKS
// =============================================================================

export interface KitRentalFilters {
  status?: string;
  user_id?: string;
}

export function useKitRentals(projectId: string | null, filters?: KitRentalFilters) {
  return useQuery({
    queryKey: ['backlot', 'expenses', 'kit-rentals', projectId, filters],
    queryFn: async () => {
      if (!projectId) return [];
      const params = new URLSearchParams();
      if (filters?.status) params.append('status', filters.status);
      if (filters?.user_id) params.append('user_id', filters.user_id);
      const queryString = params.toString();
      return apiClient.get<KitRental[]>(
        `/api/v1/backlot/projects/${projectId}/kit-rentals${queryString ? `?${queryString}` : ''}`
      );
    },
    enabled: !!projectId,
  });
}

/**
 * Get a single kit rental by ID
 */
export function useKitRental(projectId: string | null, kitRentalId: string | null) {
  return useQuery({
    queryKey: ['backlot', 'expenses', 'kit-rentals', projectId, kitRentalId],
    queryFn: async () => {
      if (!projectId || !kitRentalId) return null;
      return apiClient.get<KitRental>(
        `/api/v1/backlot/projects/${projectId}/kit-rentals/${kitRentalId}`
      );
    },
    enabled: !!projectId && !!kitRentalId,
  });
}

export function useCreateKitRental(projectId: string | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: CreateKitRentalData) => {
      if (!projectId) throw new Error('Project ID required');
      return apiClient.post<KitRental>(`/api/v1/backlot/projects/${projectId}/kit-rentals`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['backlot', 'expenses', 'kit-rentals', projectId] });
      queryClient.invalidateQueries({ queryKey: ['backlot', 'expenses', 'summary', projectId] });
    },
  });
}

export function useUpdateKitRental(projectId: string | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ rentalId, data }: { rentalId: string; data: UpdateKitRentalData }) => {
      if (!projectId) throw new Error('Project ID required');
      return apiClient.put<KitRental>(`/api/v1/backlot/projects/${projectId}/kit-rentals/${rentalId}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['backlot', 'expenses', 'kit-rentals', projectId] });
      queryClient.invalidateQueries({ queryKey: ['backlot', 'expenses', 'summary', projectId] });
    },
  });
}

export function useDeleteKitRental(projectId: string | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (rentalId: string) => {
      if (!projectId) throw new Error('Project ID required');
      return apiClient.delete(`/api/v1/backlot/projects/${projectId}/kit-rentals/${rentalId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['backlot', 'expenses', 'kit-rentals', projectId] });
      queryClient.invalidateQueries({ queryKey: ['backlot', 'expenses', 'summary', projectId] });
    },
  });
}

/**
 * Submit a draft kit rental for approval (changes status from draft to pending)
 */
export function useSubmitKitRentalForApproval(projectId: string | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (rentalId: string) => {
      if (!projectId) throw new Error('Project ID required');
      return apiClient.post<KitRental>(`/api/v1/backlot/projects/${projectId}/kit-rentals/${rentalId}/submit-for-approval`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['backlot', 'expenses', 'kit-rentals', projectId] });
      queryClient.invalidateQueries({ queryKey: ['backlot', 'expenses', 'summary', projectId] });
    },
  });
}

/**
 * Bulk submit draft kit rentals for approval
 */
export function useBulkSubmitKitRentalsForApproval(projectId: string | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (rentalIds: string[]) => {
      if (!projectId) throw new Error('Project ID required');
      return apiClient.post<{ submitted_count: number; failed_count: number; failed_ids: string[] }>(
        `/api/v1/backlot/projects/${projectId}/kit-rentals/bulk-submit-for-approval`,
        { rental_ids: rentalIds }
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['backlot', 'expenses', 'kit-rentals', projectId] });
      queryClient.invalidateQueries({ queryKey: ['backlot', 'expenses', 'summary', projectId] });
    },
  });
}

export function useApproveKitRental(projectId: string | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ rentalId, notes }: { rentalId: string; notes?: string }) => {
      if (!projectId) throw new Error('Project ID required');
      return apiClient.post(`/api/v1/backlot/projects/${projectId}/kit-rentals/${rentalId}/approve`, notes ? { notes } : {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['backlot', 'expenses', 'kit-rentals', projectId] });
      queryClient.invalidateQueries({ queryKey: ['backlot', 'expenses', 'summary', projectId] });
      // Also invalidate budget and invoice queries for cross-tab sync
      queryClient.invalidateQueries({ queryKey: ['backlot', 'budget', projectId] });
      queryClient.invalidateQueries({ queryKey: ['backlot', 'invoices', projectId, 'importable'] });
      // Invalidate budget actuals queries - approval records to budget actuals
      queryClient.invalidateQueries({ queryKey: ['backlot-budget-actuals', projectId] });
      queryClient.invalidateQueries({ queryKey: ['backlot-budget-actuals-summary', projectId] });
      queryClient.invalidateQueries({ queryKey: ['backlot-budget-comparison', projectId] });
    },
  });
}

export function useRejectKitRental(projectId: string | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ rentalId, reason }: { rentalId: string; reason?: string }) => {
      if (!projectId) throw new Error('Project ID required');
      return apiClient.post(`/api/v1/backlot/projects/${projectId}/kit-rentals/${rentalId}/reject`, { reason });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['backlot', 'expenses', 'kit-rentals', projectId] });
      queryClient.invalidateQueries({ queryKey: ['backlot', 'expenses', 'summary', projectId] });
      // Also invalidate budget queries for cross-tab sync
      queryClient.invalidateQueries({ queryKey: ['backlot', 'budget', projectId] });
    },
  });
}

export function useDenyKitRental(projectId: string | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ rentalId, reason }: { rentalId: string; reason: string }) => {
      if (!projectId) throw new Error('Project ID required');
      return apiClient.post(`/api/v1/backlot/projects/${projectId}/kit-rentals/${rentalId}/deny`, { reason });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['backlot', 'expenses', 'kit-rentals', projectId] });
      queryClient.invalidateQueries({ queryKey: ['backlot', 'expenses', 'summary', projectId] });
      queryClient.invalidateQueries({ queryKey: ['backlot', 'budget', projectId] });
    },
  });
}

export function useResubmitKitRental(projectId: string | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (rentalId: string) => {
      if (!projectId) throw new Error('Project ID required');
      return apiClient.post(`/api/v1/backlot/projects/${projectId}/kit-rentals/${rentalId}/resubmit`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['backlot', 'expenses', 'kit-rentals', projectId] });
      queryClient.invalidateQueries({ queryKey: ['backlot', 'expenses', 'summary', projectId] });
      queryClient.invalidateQueries({ queryKey: ['backlot', 'budget', projectId] });
    },
  });
}

export function useCompleteKitRental(projectId: string | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (rentalId: string) => {
      if (!projectId) throw new Error('Project ID required');
      return apiClient.post(`/api/v1/backlot/projects/${projectId}/kit-rentals/${rentalId}/complete`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['backlot', 'expenses', 'kit-rentals', projectId] });
      queryClient.invalidateQueries({ queryKey: ['backlot', 'expenses', 'summary', projectId] });
      // Also invalidate budget and invoice queries for cross-tab sync
      queryClient.invalidateQueries({ queryKey: ['backlot', 'budget', projectId] });
      queryClient.invalidateQueries({ queryKey: ['backlot', 'invoices', projectId, 'importable'] });
    },
  });
}

export function useMarkKitRentalReimbursed(projectId: string | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ rentalId, via }: { rentalId: string; via?: string }) => {
      if (!projectId) throw new Error('Project ID required');
      return apiClient.post(`/api/v1/backlot/projects/${projectId}/kit-rentals/${rentalId}/mark-reimbursed`, { via });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['backlot', 'expenses', 'kit-rentals', projectId] });
      queryClient.invalidateQueries({ queryKey: ['backlot', 'expenses', 'summary', projectId] });
      // Also invalidate budget queries for cross-tab sync
      queryClient.invalidateQueries({ queryKey: ['backlot', 'budget', projectId] });
    },
  });
}

// =============================================================================
// KIT RENTAL GEAR OPTIONS HOOK
// =============================================================================

export interface GearAssetOption {
  id: string;
  name: string;
  internal_id?: string | null;
  category_name?: string | null;
  daily_rate?: number | null;
  weekly_rate?: number | null;
  description?: string | null;
  is_available_for_dates: boolean;
}

export interface GearKitOption {
  id: string;
  name: string;
  internal_id?: string | null;
  is_available_for_dates: boolean;
}

export interface GearOrganizationOption {
  id: string;
  name: string;
  assets: GearAssetOption[];
  kits: GearKitOption[];
}

export interface GearOptionsResponse {
  organizations: GearOrganizationOption[];
  personal_gear: GearAssetOption[];
}

export interface GearOptionsFilters {
  start_date?: string;
  end_date?: string;
  org_id?: string;
  show_all?: boolean;
}

export function useKitRentalGearOptions(projectId: string | null, filters?: GearOptionsFilters) {
  return useQuery({
    queryKey: ['backlot', 'expenses', 'kit-rentals', 'gear-options', projectId, filters],
    queryFn: async (): Promise<GearOptionsResponse> => {
      if (!projectId) return { organizations: [], personal_gear: [] };

      const params = new URLSearchParams();
      if (filters?.start_date) params.append('start_date', filters.start_date);
      if (filters?.end_date) params.append('end_date', filters.end_date);
      if (filters?.org_id) params.append('org_id', filters.org_id);
      if (filters?.show_all) params.append('show_all', 'true');

      const queryString = params.toString();
      const url = `/api/v1/backlot/projects/${projectId}/kit-rentals/gear-options${queryString ? `?${queryString}` : ''}`;

      console.log('[useKitRentalGearOptions] Fetching:', url);
      const result = await apiClient.get<GearOptionsResponse>(url);
      console.log('[useKitRentalGearOptions] Result:', result);
      return result;
    },
    enabled: !!projectId,
    staleTime: 30000, // 30 seconds
    retry: 2, // Retry on failure
    refetchOnMount: true, // Refetch when component mounts
  });
}

// =============================================================================
// PER DIEM HOOKS
// =============================================================================

export interface PerDiemFilters {
  status?: string;
  user_id?: string;
  start_date?: string;
  end_date?: string;
}

export function usePerDiemEntries(projectId: string | null, filters?: PerDiemFilters) {
  return useQuery({
    queryKey: ['backlot', 'expenses', 'per-diem', projectId, filters],
    queryFn: async () => {
      if (!projectId) return [];
      const params = new URLSearchParams();
      if (filters?.status) params.append('status', filters.status);
      if (filters?.user_id) params.append('user_id', filters.user_id);
      if (filters?.start_date) params.append('start_date', filters.start_date);
      if (filters?.end_date) params.append('end_date', filters.end_date);
      const queryString = params.toString();
      return apiClient.get<PerDiemEntry[]>(
        `/api/v1/backlot/projects/${projectId}/per-diem${queryString ? `?${queryString}` : ''}`
      );
    },
    enabled: !!projectId,
  });
}

/**
 * Get a single per diem entry by ID
 */
export function usePerDiemEntry(projectId: string | null, perDiemId: string | null) {
  return useQuery({
    queryKey: ['backlot', 'expenses', 'per-diem', projectId, perDiemId],
    queryFn: async () => {
      if (!projectId || !perDiemId) return null;
      return apiClient.get<PerDiemEntry>(
        `/api/v1/backlot/projects/${projectId}/per-diem/${perDiemId}`
      );
    },
    enabled: !!projectId && !!perDiemId,
  });
}

export function useClaimPerDiem(projectId: string | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: CreatePerDiemData) => {
      if (!projectId) throw new Error('Project ID required');
      return apiClient.post<PerDiemEntry>(`/api/v1/backlot/projects/${projectId}/per-diem`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['backlot', 'expenses', 'per-diem', projectId] });
      queryClient.invalidateQueries({ queryKey: ['backlot', 'expenses', 'summary', projectId] });
    },
  });
}

export function useBulkClaimPerDiem(projectId: string | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: BulkPerDiemData) => {
      if (!projectId) throw new Error('Project ID required');
      return apiClient.post<{ created_count: number; skipped_count: number }>(
        `/api/v1/backlot/projects/${projectId}/per-diem/bulk`,
        data
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['backlot', 'expenses', 'per-diem', projectId] });
      queryClient.invalidateQueries({ queryKey: ['backlot', 'expenses', 'summary', projectId] });
    },
  });
}

export function useUpdatePerDiem(projectId: string | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ entryId, data }: { entryId: string; data: UpdatePerDiemData }) => {
      if (!projectId) throw new Error('Project ID required');
      return apiClient.put<PerDiemEntry>(`/api/v1/backlot/projects/${projectId}/per-diem/${entryId}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['backlot', 'expenses', 'per-diem', projectId] });
      queryClient.invalidateQueries({ queryKey: ['backlot', 'expenses', 'summary', projectId] });
    },
  });
}

export function useDeletePerDiem(projectId: string | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (entryId: string) => {
      if (!projectId) throw new Error('Project ID required');
      return apiClient.delete(`/api/v1/backlot/projects/${projectId}/per-diem/${entryId}`);
    },
    // Optimistic update: remove item immediately
    onMutate: async (entryId: string) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: ['backlot', 'expenses', 'per-diem', projectId] });

      // Snapshot the previous value
      const previousEntries = queryClient.getQueriesData({ queryKey: ['backlot', 'expenses', 'per-diem', projectId] });

      // Optimistically remove the entry
      queryClient.setQueriesData(
        { queryKey: ['backlot', 'expenses', 'per-diem', projectId] },
        (old: PerDiemEntry[] | undefined) => old?.filter(entry => entry.id !== entryId)
      );

      return { previousEntries };
    },
    onError: (_err, _entryId, context) => {
      // Rollback on error
      if (context?.previousEntries) {
        context.previousEntries.forEach(([queryKey, data]) => {
          queryClient.setQueryData(queryKey, data);
        });
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['backlot', 'expenses', 'per-diem', projectId] });
      queryClient.invalidateQueries({ queryKey: ['backlot', 'expenses', 'summary', projectId] });
    },
  });
}

export function useApprovePerDiem(projectId: string | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ entryId, notes }: { entryId: string; notes?: string }) => {
      if (!projectId) throw new Error('Project ID required');
      return apiClient.post(`/api/v1/backlot/projects/${projectId}/per-diem/${entryId}/approve`, notes ? { notes } : {});
    },
    // Optimistic update: set status to 'approved' immediately
    onMutate: async ({ entryId }) => {
      await queryClient.cancelQueries({ queryKey: ['backlot', 'expenses', 'per-diem', projectId] });

      const previousEntries = queryClient.getQueriesData({ queryKey: ['backlot', 'expenses', 'per-diem', projectId] });

      queryClient.setQueriesData(
        { queryKey: ['backlot', 'expenses', 'per-diem', projectId] },
        (old: PerDiemEntry[] | undefined) =>
          old?.map(entry => entry.id === entryId ? { ...entry, status: 'approved' } : entry)
      );

      return { previousEntries };
    },
    onError: (_err, _vars, context) => {
      if (context?.previousEntries) {
        context.previousEntries.forEach(([queryKey, data]) => {
          queryClient.setQueryData(queryKey, data);
        });
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['backlot', 'expenses', 'per-diem', projectId] });
      queryClient.invalidateQueries({ queryKey: ['backlot', 'expenses', 'summary', projectId] });
      queryClient.invalidateQueries({ queryKey: ['backlot', 'budget', projectId] });
      queryClient.invalidateQueries({ queryKey: ['backlot', 'invoices', projectId, 'importable'] });
      // Invalidate budget actuals queries - approval records to budget actuals
      queryClient.invalidateQueries({ queryKey: ['backlot-budget-actuals', projectId] });
      queryClient.invalidateQueries({ queryKey: ['backlot-budget-actuals-summary', projectId] });
      queryClient.invalidateQueries({ queryKey: ['backlot-budget-comparison', projectId] });
    },
  });
}

export function useRejectPerDiem(projectId: string | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ entryId, reason }: { entryId: string; reason?: string }) => {
      if (!projectId) throw new Error('Project ID required');
      return apiClient.post(`/api/v1/backlot/projects/${projectId}/per-diem/${entryId}/reject`, { reason });
    },
    // Optimistic update: set status to 'rejected' immediately
    onMutate: async ({ entryId, reason }) => {
      await queryClient.cancelQueries({ queryKey: ['backlot', 'expenses', 'per-diem', projectId] });

      const previousEntries = queryClient.getQueriesData({ queryKey: ['backlot', 'expenses', 'per-diem', projectId] });

      queryClient.setQueriesData(
        { queryKey: ['backlot', 'expenses', 'per-diem', projectId] },
        (old: PerDiemEntry[] | undefined) =>
          old?.map(entry => entry.id === entryId ? { ...entry, status: 'rejected', rejection_reason: reason } : entry)
      );

      return { previousEntries };
    },
    onError: (_err, _vars, context) => {
      if (context?.previousEntries) {
        context.previousEntries.forEach(([queryKey, data]) => {
          queryClient.setQueryData(queryKey, data);
        });
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['backlot', 'expenses', 'per-diem', projectId] });
      queryClient.invalidateQueries({ queryKey: ['backlot', 'expenses', 'summary', projectId] });
      queryClient.invalidateQueries({ queryKey: ['backlot', 'budget', projectId] });
    },
  });
}

export function useDenyPerDiem(projectId: string | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ entryId, reason }: { entryId: string; reason: string }) => {
      if (!projectId) throw new Error('Project ID required');
      return apiClient.post(`/api/v1/backlot/projects/${projectId}/per-diem/${entryId}/deny`, { reason });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['backlot', 'expenses', 'per-diem', projectId] });
      queryClient.invalidateQueries({ queryKey: ['backlot', 'expenses', 'summary', projectId] });
      queryClient.invalidateQueries({ queryKey: ['backlot', 'budget', projectId] });
    },
  });
}

/**
 * Submit a draft per diem entry for approval
 */
export function useSubmitPerDiemForApproval(projectId: string | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (entryId: string) => {
      if (!projectId) throw new Error('Project ID required');
      return apiClient.post<PerDiemEntry>(`/api/v1/backlot/projects/${projectId}/per-diem/${entryId}/submit-for-approval`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['backlot', 'expenses', 'per-diem', projectId] });
      queryClient.invalidateQueries({ queryKey: ['backlot', 'expenses', 'summary', projectId] });
    },
  });
}

/**
 * Bulk submit draft per diem entries for approval
 */
export function useBulkSubmitPerDiemForApproval(projectId: string | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (entryIds: string[]) => {
      if (!projectId) throw new Error('Project ID required');
      return apiClient.post<{ submitted_count: number; failed_count: number; failed_ids: string[] }>(
        `/api/v1/backlot/projects/${projectId}/per-diem/bulk-submit-for-approval`,
        { entry_ids: entryIds }
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['backlot', 'expenses', 'per-diem', projectId] });
      queryClient.invalidateQueries({ queryKey: ['backlot', 'expenses', 'summary', projectId] });
    },
  });
}

export function useResubmitPerDiem(projectId: string | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (entryId: string) => {
      if (!projectId) throw new Error('Project ID required');
      return apiClient.post(`/api/v1/backlot/projects/${projectId}/per-diem/${entryId}/resubmit`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['backlot', 'expenses', 'per-diem', projectId] });
      queryClient.invalidateQueries({ queryKey: ['backlot', 'expenses', 'summary', projectId] });
      queryClient.invalidateQueries({ queryKey: ['backlot', 'budget', projectId] });
    },
  });
}

export function useMarkPerDiemReimbursed(projectId: string | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ entryId, via }: { entryId: string; via?: string }) => {
      if (!projectId) throw new Error('Project ID required');
      return apiClient.post(`/api/v1/backlot/projects/${projectId}/per-diem/${entryId}/mark-reimbursed`, { via });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['backlot', 'expenses', 'per-diem', projectId] });
      queryClient.invalidateQueries({ queryKey: ['backlot', 'expenses', 'summary', projectId] });
      // Also invalidate budget queries for cross-tab sync
      queryClient.invalidateQueries({ queryKey: ['backlot', 'budget', projectId] });
    },
  });
}

export function useBulkApprovePerDiem(projectId: string | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ entryIds, notes }: { entryIds: string[]; notes?: string }) => {
      if (!projectId) throw new Error('Project ID required');
      return apiClient.post<{ approved_count: number; failed_count: number; failed_ids: string[] }>(
        `/api/v1/backlot/projects/${projectId}/per-diem/bulk-approve`,
        { entry_ids: entryIds, notes }
      );
    },
    // Optimistic update: set status to 'approved' for all entries immediately
    onMutate: async ({ entryIds }) => {
      await queryClient.cancelQueries({ queryKey: ['backlot', 'expenses', 'per-diem', projectId] });

      const previousEntries = queryClient.getQueriesData({ queryKey: ['backlot', 'expenses', 'per-diem', projectId] });
      const entryIdSet = new Set(entryIds);

      queryClient.setQueriesData(
        { queryKey: ['backlot', 'expenses', 'per-diem', projectId] },
        (old: PerDiemEntry[] | undefined) =>
          old?.map(entry => entryIdSet.has(entry.id) ? { ...entry, status: 'approved' } : entry)
      );

      return { previousEntries };
    },
    onError: (_err, _vars, context) => {
      if (context?.previousEntries) {
        context.previousEntries.forEach(([queryKey, data]) => {
          queryClient.setQueryData(queryKey, data);
        });
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['backlot', 'expenses', 'per-diem', projectId] });
      queryClient.invalidateQueries({ queryKey: ['backlot', 'expenses', 'summary', projectId] });
      queryClient.invalidateQueries({ queryKey: ['backlot', 'budget', projectId] });
      queryClient.invalidateQueries({ queryKey: ['backlot', 'invoices', projectId, 'importable'] });
      // Invalidate budget actuals queries - approval records to budget actuals
      queryClient.invalidateQueries({ queryKey: ['backlot-budget-actuals', projectId] });
      queryClient.invalidateQueries({ queryKey: ['backlot-budget-actuals-summary', projectId] });
      queryClient.invalidateQueries({ queryKey: ['backlot-budget-comparison', projectId] });
    },
  });
}

export function useBulkRejectPerDiem(projectId: string | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ entryIds, reason }: { entryIds: string[]; reason?: string }) => {
      if (!projectId) throw new Error('Project ID required');
      return apiClient.post<{ rejected_count: number; failed_count: number; failed_ids: string[] }>(
        `/api/v1/backlot/projects/${projectId}/per-diem/bulk-reject`,
        { entry_ids: entryIds, reason }
      );
    },
    // Optimistic update: set status to 'rejected' for all entries immediately
    onMutate: async ({ entryIds, reason }) => {
      await queryClient.cancelQueries({ queryKey: ['backlot', 'expenses', 'per-diem', projectId] });

      const previousEntries = queryClient.getQueriesData({ queryKey: ['backlot', 'expenses', 'per-diem', projectId] });
      const entryIdSet = new Set(entryIds);

      queryClient.setQueriesData(
        { queryKey: ['backlot', 'expenses', 'per-diem', projectId] },
        (old: PerDiemEntry[] | undefined) =>
          old?.map(entry => entryIdSet.has(entry.id) ? { ...entry, status: 'rejected', rejection_reason: reason } : entry)
      );

      return { previousEntries };
    },
    onError: (_err, _vars, context) => {
      if (context?.previousEntries) {
        context.previousEntries.forEach(([queryKey, data]) => {
          queryClient.setQueryData(queryKey, data);
        });
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['backlot', 'expenses', 'per-diem', projectId] });
      queryClient.invalidateQueries({ queryKey: ['backlot', 'expenses', 'summary', projectId] });
      queryClient.invalidateQueries({ queryKey: ['backlot', 'budget', projectId] });
    },
  });
}

// =============================================================================
// EXPENSE SETTINGS HOOKS
// =============================================================================

export function useExpenseSettings(projectId: string | null) {
  return useQuery({
    queryKey: ['backlot', 'expenses', 'settings', projectId],
    queryFn: async () => {
      if (!projectId) return null;
      return apiClient.get<ExpenseSettings>(`/api/v1/backlot/projects/${projectId}/expense-settings`);
    },
    enabled: !!projectId,
  });
}

export function useUpdateExpenseSettings(projectId: string | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: UpdateExpenseSettingsData) => {
      if (!projectId) throw new Error('Project ID required');
      return apiClient.put<ExpenseSettings>(`/api/v1/backlot/projects/${projectId}/expense-settings`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['backlot', 'expenses', 'settings', projectId] });
    },
  });
}

// =============================================================================
// EXPENSE SUMMARY HOOKS
// =============================================================================

export interface ExpenseSummaryFilters {
  user_id?: string;
  start_date?: string;
  end_date?: string;
}

export function useExpenseSummary(projectId: string | null, filters?: ExpenseSummaryFilters) {
  return useQuery({
    queryKey: ['backlot', 'expenses', 'summary', projectId, filters],
    queryFn: async () => {
      if (!projectId) return null;
      const params = new URLSearchParams();
      if (filters?.user_id) params.append('user_id', filters.user_id);
      if (filters?.start_date) params.append('start_date', filters.start_date);
      if (filters?.end_date) params.append('end_date', filters.end_date);
      const queryString = params.toString();
      return apiClient.get<ExpenseSummary>(
        `/api/v1/backlot/projects/${projectId}/expenses/summary${queryString ? `?${queryString}` : ''}`
      );
    },
    enabled: !!projectId,
  });
}

// =============================================================================
// GEOCODING / PLACE SEARCH HOOKS
// =============================================================================

export interface PlaceSuggestion {
  place_id: string;
  label: string;
  lat: number;
  lon: number;
  street?: string;
  city?: string;
  state?: string;
  postal_code?: string;
}

export interface RouteCalculationResult {
  start: PlaceSuggestion;
  end: PlaceSuggestion;
  distance_miles: number | null;
  is_round_trip: boolean;
}

/**
 * Search for places/addresses for mileage entry autocomplete
 */
export function useSearchPlaces(projectId: string | null) {
  const searchPlaces = React.useCallback(async (query: string): Promise<PlaceSuggestion[]> => {
    if (!projectId || query.length < 3) return [];
    try {
      const results = await apiClient.get<PlaceSuggestion[]>(
        `/api/v1/backlot/projects/${projectId}/mileage/search-places?q=${encodeURIComponent(query)}`
      );
      return results;
    } catch (error) {
      console.error('Place search failed:', error);
      return [];
    }
  }, [projectId]);

  return { searchPlaces };
}

/**
 * Calculate route distance between two addresses
 */
export function useCalculateRoute(projectId: string | null) {
  return useMutation({
    mutationFn: async ({ startAddress, endAddress }: { startAddress: string; endAddress: string }) => {
      if (!projectId) throw new Error('Project ID required');
      return apiClient.get<RouteCalculationResult>(
        `/api/v1/backlot/projects/${projectId}/mileage/calculate-route?start_address=${encodeURIComponent(startAddress)}&end_address=${encodeURIComponent(endAddress)}`
      );
    },
  });
}

// =============================================================================
// HELPERS
// =============================================================================

export const MILEAGE_PURPOSE_OPTIONS = [
  { value: 'location_scout', label: 'Location Scout' },
  { value: 'equipment_pickup', label: 'Equipment Pickup' },
  { value: 'set_travel', label: 'Travel' },
  { value: 'meeting', label: 'Meeting' },
  { value: 'other', label: 'Other' },
] as const;

export const MEAL_TYPE_OPTIONS = [
  { value: 'breakfast', label: 'Breakfast' },
  { value: 'lunch', label: 'Lunch' },
  { value: 'dinner', label: 'Dinner' },
  { value: 'full_day', label: 'Full Day' },
] as const;

export const RENTAL_TYPE_OPTIONS = [
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'flat', label: 'Flat Rate' },
] as const;

export const EXPENSE_STATUS_CONFIG = {
  draft: { label: 'Draft', color: 'bg-gray-500/20 text-gray-400 border-gray-500/30' },
  pending: { label: 'Pending', color: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30' },
  approved: { label: 'Approved', color: 'bg-green-500/20 text-green-400 border-green-500/30' },
  rejected: { label: 'Rejected', color: 'bg-red-500/20 text-red-400 border-red-500/30' },
  reimbursed: { label: 'Reimbursed', color: 'bg-blue-500/20 text-blue-400 border-blue-500/30' },
  active: { label: 'Active', color: 'bg-purple-500/20 text-purple-400 border-purple-500/30' },
  completed: { label: 'Completed', color: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30' },
} as const;

export function formatCurrency(amount: number | null | undefined): string {
  if (amount == null) return '-';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(amount);
}

export function calculateMileageTotal(miles: number, ratePerMile: number, isRoundTrip: boolean): number {
  const effectiveMiles = isRoundTrip ? miles * 2 : miles;
  return Math.round(effectiveMiles * ratePerMile * 100) / 100;
}
