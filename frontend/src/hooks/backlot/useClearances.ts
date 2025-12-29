/**
 * useClearances - Hook for managing project clearances/releases
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import {
  BacklotClearanceItem,
  BacklotClearanceTemplate,
  BacklotClearanceType,
  BacklotClearanceStatus,
  ClearanceItemInput,
  ClearanceSummary,
  ClearanceBulkStatusResponse,
  ClearanceHistoryEntry,
  EORequirement,
  EOSummary,
  ExpiringClearance,
  ClearanceDocumentVersion,
} from '@/types/backlot';

const API_BASE = import.meta.env.VITE_API_URL || '';

interface UseClearancesOptions {
  projectId: string | null;
  type?: BacklotClearanceType | 'all';
  status?: BacklotClearanceStatus | 'all';
  search?: string;
  limit?: number;
}

export function useClearances(options: UseClearancesOptions) {
  const { projectId, type = 'all', status = 'all', search, limit = 200 } = options;
  const queryClient = useQueryClient();

  const queryKey = ['backlot-clearances', { projectId, type, status, search, limit }];

  const { data, isLoading, error, refetch } = useQuery({
    queryKey,
    queryFn: async () => {
      if (!projectId) return [];

      const token = api.getToken();
      if (!token) throw new Error('Not authenticated');

      const params = new URLSearchParams();
      params.append('limit', String(limit));
      if (type !== 'all') params.append('type', type);
      if (status !== 'all') params.append('status', status);
      if (search) params.append('search', search);

      const response = await fetch(
        `${API_BASE}/api/v1/backlot/projects/${projectId}/clearances?${params.toString()}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (!response.ok) {
        const error = await response.json().catch(() => ({ detail: 'Failed to fetch clearances' }));
        throw new Error(error.detail);
      }

      const result = await response.json();
      return (result.clearances || result || []) as BacklotClearanceItem[];
    },
    enabled: !!projectId,
  });

  const createClearance = useMutation({
    mutationFn: async ({ projectId, ...input }: ClearanceItemInput & { projectId: string }) => {
      const token = api.getToken();
      if (!token) throw new Error('Not authenticated');

      const response = await fetch(
        `${API_BASE}/api/v1/backlot/projects/${projectId}/clearances`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(input),
        }
      );

      if (!response.ok) {
        const error = await response.json().catch(() => ({ detail: 'Failed to create clearance' }));
        throw new Error(error.detail);
      }

      const result = await response.json();
      return (result.clearance || result) as BacklotClearanceItem;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['backlot-clearances'] });
      queryClient.invalidateQueries({ queryKey: ['backlot-clearance-summary'] });
    },
  });

  const updateClearance = useMutation({
    mutationFn: async ({ id, ...input }: Partial<ClearanceItemInput> & { id: string }) => {
      const token = api.getToken();
      if (!token) throw new Error('Not authenticated');

      const response = await fetch(`${API_BASE}/api/v1/backlot/clearances/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(input),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({ detail: 'Failed to update clearance' }));
        throw new Error(error.detail);
      }

      const result = await response.json();
      return (result.clearance || result) as BacklotClearanceItem;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['backlot-clearances'] });
      queryClient.invalidateQueries({ queryKey: ['backlot-clearance-summary'] });
    },
  });

  const updateStatus = useMutation({
    mutationFn: async ({ id, status, signedDate }: { id: string; status: BacklotClearanceStatus; signedDate?: string }) => {
      const token = api.getToken();
      if (!token) throw new Error('Not authenticated');

      const params = new URLSearchParams();
      params.append('status', status);
      if (signedDate) params.append('signed_date', signedDate);

      const response = await fetch(
        `${API_BASE}/api/v1/backlot/clearances/${id}/status?${params.toString()}`,
        {
          method: 'PATCH',
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      if (!response.ok) {
        const error = await response.json().catch(() => ({ detail: 'Failed to update status' }));
        throw new Error(error.detail);
      }

      const result = await response.json();
      return (result.clearance || result) as BacklotClearanceItem;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['backlot-clearances'] });
      queryClient.invalidateQueries({ queryKey: ['backlot-clearance-summary'] });
    },
  });

  const deleteClearance = useMutation({
    mutationFn: async (id: string) => {
      const token = api.getToken();
      if (!token) throw new Error('Not authenticated');

      const response = await fetch(`${API_BASE}/api/v1/backlot/clearances/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({ detail: 'Failed to delete clearance' }));
        throw new Error(error.detail);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['backlot-clearances'] });
      queryClient.invalidateQueries({ queryKey: ['backlot-clearance-summary'] });
    },
  });

  return {
    clearances: data || [],
    isLoading,
    error,
    refetch,
    createClearance,
    updateClearance,
    updateStatus,
    deleteClearance,
  };
}

// Fetch single clearance item
export function useClearanceItem(id: string | null) {
  return useQuery({
    queryKey: ['backlot-clearance-item', id],
    queryFn: async () => {
      if (!id) return null;

      const token = api.getToken();
      if (!token) throw new Error('Not authenticated');

      const response = await fetch(`${API_BASE}/api/v1/backlot/clearances/${id}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({ detail: 'Failed to fetch clearance' }));
        throw new Error(error.detail);
      }

      const result = await response.json();
      return (result.clearance || result) as BacklotClearanceItem;
    },
    enabled: !!id,
  });
}

// Get clearance summary for a project
export function useClearanceSummary(projectId: string | null) {
  return useQuery({
    queryKey: ['backlot-clearance-summary', projectId],
    queryFn: async (): Promise<ClearanceSummary | null> => {
      if (!projectId) return null;

      const token = api.getToken();
      if (!token) throw new Error('Not authenticated');

      const response = await fetch(
        `${API_BASE}/api/v1/backlot/projects/${projectId}/clearances/report`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (!response.ok) {
        const error = await response.json().catch(() => ({ detail: 'Failed to fetch summary' }));
        throw new Error(error.detail);
      }

      const data = await response.json();

      // Transform report data to ClearanceSummary format
      const summary: ClearanceSummary = {
        total: data.total_clearances || 0,
        by_status: {
          not_started: data.status_breakdown?.not_started || 0,
          requested: data.status_breakdown?.requested || 0,
          signed: data.status_breakdown?.signed || 0,
          expired: data.status_breakdown?.expired || 0,
          rejected: data.status_breakdown?.rejected || 0,
        },
        by_type: {} as ClearanceSummary['by_type'],
        expiring_soon: data.expiring_soon_count || 0,
      };

      // Build by_type from type_breakdown if available
      if (data.type_breakdown) {
        for (const [typeName, typeData] of Object.entries(data.type_breakdown as Record<string, any>)) {
          summary.by_type[typeName as BacklotClearanceType] = {
            total: typeData.total || 0,
            signed: typeData.signed || 0,
            requested: typeData.requested || 0,
            not_started: typeData.not_started || 0,
            expired: typeData.expired || 0,
          };
        }
      }

      return summary;
    },
    enabled: !!projectId,
  });
}

// Get clearance templates
export function useClearanceTemplates(type?: BacklotClearanceType) {
  return useQuery({
    queryKey: ['backlot-clearance-templates', type],
    queryFn: async () => {
      const token = api.getToken();
      if (!token) throw new Error('Not authenticated');

      const params = new URLSearchParams();
      if (type) params.append('type', type);

      const response = await fetch(
        `${API_BASE}/api/v1/backlot/clearance-templates?${params.toString()}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (!response.ok) {
        const error = await response.json().catch(() => ({ detail: 'Failed to fetch templates' }));
        throw new Error(error.detail);
      }

      const result = await response.json();
      return (result.templates || result || []) as BacklotClearanceTemplate[];
    },
  });
}

// Get clearances for a specific location
export function useLocationClearances(projectId: string | null, locationId: string | null) {
  return useQuery({
    queryKey: ['backlot-location-clearances', projectId, locationId],
    queryFn: async () => {
      if (!projectId || !locationId) return [];

      const token = api.getToken();
      if (!token) throw new Error('Not authenticated');

      const response = await fetch(
        `${API_BASE}/api/v1/backlot/projects/${projectId}/clearances/location/${locationId}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (!response.ok) {
        const error = await response.json().catch(() => ({ detail: 'Failed to fetch clearances' }));
        throw new Error(error.detail);
      }

      const result = await response.json();
      return (result.clearances || result || []) as BacklotClearanceItem[];
    },
    enabled: !!projectId && !!locationId,
  });
}

// Get clearances for a specific person
export function usePersonClearances(
  projectId: string | null,
  personId: string | null,
  releaseType: BacklotClearanceType = 'talent_release'
) {
  return useQuery({
    queryKey: ['backlot-person-clearances', projectId, personId, releaseType],
    queryFn: async () => {
      if (!projectId || !personId) return [];

      const token = api.getToken();
      if (!token) throw new Error('Not authenticated');

      const params = new URLSearchParams();
      params.append('release_type', releaseType);

      const response = await fetch(
        `${API_BASE}/api/v1/backlot/projects/${projectId}/clearances/person/${personId}?${params.toString()}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (!response.ok) {
        const error = await response.json().catch(() => ({ detail: 'Failed to fetch clearances' }));
        throw new Error(error.detail);
      }

      const result = await response.json();
      return (result.clearances || result || []) as BacklotClearanceItem[];
    },
    enabled: !!projectId && !!personId,
  });
}

// Get detailed clearances for a person (with recipients)
export function usePersonClearancesDetailed(
  projectId: string | null,
  personId: string | null
) {
  return useQuery({
    queryKey: ['backlot-person-clearances-detailed', projectId, personId],
    queryFn: async () => {
      if (!projectId || !personId) return { clearances: [], summary: { total: 0, signed: 0, pending: 0, missing: 0 } };

      const token = api.getToken();
      if (!token) throw new Error('Not authenticated');

      const response = await fetch(
        `${API_BASE}/api/v1/backlot/projects/${projectId}/clearances/person/${personId}/detailed`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (!response.ok) {
        const error = await response.json().catch(() => ({ detail: 'Failed to fetch clearances' }));
        throw new Error(error.detail);
      }

      const result = await response.json();
      return result as { clearances: BacklotClearanceItem[], summary: { total: number, signed: number, pending: number, missing: number } };
    },
    enabled: !!projectId && !!personId,
  });
}

// Bulk check clearance status for call sheets
export function useBulkClearanceStatus(
  projectId: string | null,
  locationIds: string[],
  personIds: string[]
) {
  return useQuery({
    queryKey: ['backlot-bulk-clearance-status', projectId, locationIds, personIds],
    queryFn: async (): Promise<ClearanceBulkStatusResponse> => {
      if (!projectId || (locationIds.length === 0 && personIds.length === 0)) {
        return { locations: {}, persons: {} };
      }

      const token = api.getToken();
      if (!token) throw new Error('Not authenticated');

      const response = await fetch(
        `${API_BASE}/api/v1/backlot/projects/${projectId}/clearances/bulk-status`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            location_ids: locationIds,
            person_ids: personIds,
          }),
        }
      );

      if (!response.ok) {
        const error = await response.json().catch(() => ({ detail: 'Failed to fetch status' }));
        throw new Error(error.detail);
      }

      const result = await response.json();
      return {
        locations: result.locations || {},
        persons: result.persons || {},
      };
    },
    enabled: !!projectId && (locationIds.length > 0 || personIds.length > 0),
  });
}

// Helper to check if a location has a signed release
export function locationHasSignedRelease(
  clearances: BacklotClearanceItem[],
  locationId: string
): boolean {
  const today = new Date().toISOString().split('T')[0];
  return clearances.some(
    c =>
      c.type === 'location_release' &&
      (c.related_location_id === locationId || c.related_project_location_id === locationId) &&
      c.status === 'signed' &&
      (!c.expiration_date || c.expiration_date > today)
  );
}

// Helper to check if a person has a signed release
export function personHasSignedRelease(
  clearances: BacklotClearanceItem[],
  personId: string,
  releaseType: BacklotClearanceType = 'talent_release'
): boolean {
  const today = new Date().toISOString().split('T')[0];
  return clearances.some(
    c =>
      c.type === releaseType &&
      c.related_person_id === personId &&
      c.status === 'signed' &&
      (!c.expiration_date || c.expiration_date > today)
  );
}

// Get clearance status badge color
export function getClearanceStatusColor(status: BacklotClearanceStatus | 'missing'): string {
  const colors: Record<string, string> = {
    signed: 'green',
    requested: 'yellow',
    pending: 'blue',
    not_started: 'gray',
    expired: 'orange',
    rejected: 'red',
    missing: 'slate',
  };
  return colors[status] || 'gray';
}

// =============================================================================
// DOCUMENT UPLOAD HOOKS
// =============================================================================

interface UploadDocumentOptions {
  clearanceId: string;
  file: File;
}

export function useClearanceDocumentUpload() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ clearanceId, file }: UploadDocumentOptions) => {
      const token = api.getToken();
      if (!token) throw new Error('Not authenticated');

      // Step 1: Get presigned upload URL
      const urlResponse = await fetch(
        `${API_BASE}/api/v1/backlot/clearances/${clearanceId}/upload-url`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            file_name: file.name,
            content_type: file.type,
            file_size: file.size,
          }),
        }
      );

      if (!urlResponse.ok) {
        const error = await urlResponse.json().catch(() => ({ detail: 'Failed to get upload URL' }));
        throw new Error(error.detail);
      }

      const { upload_url, file_url } = await urlResponse.json();

      // Step 2: Upload file to S3
      const uploadResponse = await fetch(upload_url, {
        method: 'PUT',
        headers: {
          'Content-Type': file.type,
        },
        body: file,
      });

      if (!uploadResponse.ok) {
        throw new Error('Failed to upload file to S3');
      }

      // Step 3: Update clearance with file info
      const updateResponse = await fetch(
        `${API_BASE}/api/v1/backlot/clearances/${clearanceId}/document`,
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            file_url,
            file_name: file.name,
          }),
        }
      );

      if (!updateResponse.ok) {
        const error = await updateResponse.json().catch(() => ({ detail: 'Failed to update clearance' }));
        throw new Error(error.detail);
      }

      return { file_url, file_name: file.name };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['backlot-clearances'] });
      queryClient.invalidateQueries({ queryKey: ['backlot-clearance-item'] });
    },
  });
}

export function useClearanceDocumentRemove() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (clearanceId: string) => {
      const token = api.getToken();
      if (!token) throw new Error('Not authenticated');

      const response = await fetch(
        `${API_BASE}/api/v1/backlot/clearances/${clearanceId}/document`,
        {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      if (!response.ok) {
        const error = await response.json().catch(() => ({ detail: 'Failed to remove document' }));
        throw new Error(error.detail);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['backlot-clearances'] });
      queryClient.invalidateQueries({ queryKey: ['backlot-clearance-item'] });
    },
  });
}

// =============================================================================
// WORKFLOW HOOKS (Assignment, Status with History)
// =============================================================================

interface AssignClearanceOptions {
  clearanceId: string;
  userId: string;
  notes?: string;
}

export function useClearanceAssignment() {
  const queryClient = useQueryClient();

  const assign = useMutation({
    mutationFn: async ({ clearanceId, userId, notes }: AssignClearanceOptions) => {
      const token = api.getToken();
      if (!token) throw new Error('Not authenticated');

      const response = await fetch(
        `${API_BASE}/api/v1/backlot/clearances/${clearanceId}/assign`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ user_id: userId, notes }),
        }
      );

      if (!response.ok) {
        const error = await response.json().catch(() => ({ detail: 'Failed to assign clearance' }));
        throw new Error(error.detail);
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['backlot-clearances'] });
      queryClient.invalidateQueries({ queryKey: ['backlot-clearance-item'] });
    },
  });

  const unassign = useMutation({
    mutationFn: async (clearanceId: string) => {
      const token = api.getToken();
      if (!token) throw new Error('Not authenticated');

      const response = await fetch(
        `${API_BASE}/api/v1/backlot/clearances/${clearanceId}/unassign`,
        {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      if (!response.ok) {
        const error = await response.json().catch(() => ({ detail: 'Failed to unassign clearance' }));
        throw new Error(error.detail);
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['backlot-clearances'] });
      queryClient.invalidateQueries({ queryKey: ['backlot-clearance-item'] });
    },
  });

  return { assign, unassign };
}

interface UpdateWorkflowStatusOptions {
  clearanceId: string;
  status: BacklotClearanceStatus;
  rejectionReason?: string;
  notes?: string;
}

export function useClearanceWorkflowStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ clearanceId, status, rejectionReason, notes }: UpdateWorkflowStatusOptions) => {
      const token = api.getToken();
      if (!token) throw new Error('Not authenticated');

      const response = await fetch(
        `${API_BASE}/api/v1/backlot/clearances/${clearanceId}/workflow-status`,
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            status,
            rejection_reason: rejectionReason,
            notes,
          }),
        }
      );

      if (!response.ok) {
        const error = await response.json().catch(() => ({ detail: 'Failed to update status' }));
        throw new Error(error.detail);
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['backlot-clearances'] });
      queryClient.invalidateQueries({ queryKey: ['backlot-clearance-item'] });
      queryClient.invalidateQueries({ queryKey: ['backlot-clearance-history'] });
      queryClient.invalidateQueries({ queryKey: ['backlot-clearance-summary'] });
    },
  });
}

// =============================================================================
// CLEARANCE HISTORY HOOK
// =============================================================================

export function useClearanceHistory(clearanceId: string | null) {
  return useQuery({
    queryKey: ['backlot-clearance-history', clearanceId],
    queryFn: async () => {
      if (!clearanceId) return [];

      const token = api.getToken();
      if (!token) throw new Error('Not authenticated');

      const response = await fetch(
        `${API_BASE}/api/v1/backlot/clearances/${clearanceId}/history`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      if (!response.ok) {
        const error = await response.json().catch(() => ({ detail: 'Failed to fetch history' }));
        throw new Error(error.detail);
      }

      const result = await response.json();
      return (result.history || []) as ClearanceHistoryEntry[];
    },
    enabled: !!clearanceId,
  });
}

// =============================================================================
// E&O REQUIREMENTS HOOKS
// =============================================================================

export function useEORequirements(projectId: string | null) {
  return useQuery({
    queryKey: ['backlot-eo-requirements', projectId],
    queryFn: async () => {
      if (!projectId) return [];

      const token = api.getToken();
      if (!token) throw new Error('Not authenticated');

      const response = await fetch(
        `${API_BASE}/api/v1/backlot/projects/${projectId}/eo-requirements`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      if (!response.ok) {
        const error = await response.json().catch(() => ({ detail: 'Failed to fetch E&O requirements' }));
        throw new Error(error.detail);
      }

      const result = await response.json();
      return (result.requirements || []) as EORequirement[];
    },
    enabled: !!projectId,
  });
}

export function useInitializeEORequirements() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (projectId: string) => {
      const token = api.getToken();
      if (!token) throw new Error('Not authenticated');

      const response = await fetch(
        `${API_BASE}/api/v1/backlot/projects/${projectId}/eo-requirements/initialize`,
        {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      if (!response.ok) {
        const error = await response.json().catch(() => ({ detail: 'Failed to initialize E&O requirements' }));
        throw new Error(error.detail);
      }

      return response.json();
    },
    onSuccess: (_, projectId) => {
      queryClient.invalidateQueries({ queryKey: ['backlot-eo-requirements', projectId] });
      queryClient.invalidateQueries({ queryKey: ['backlot-eo-summary', projectId] });
    },
  });
}

interface UpdateEORequirementOptions {
  requirementId: string;
  status?: string;
  linkedClearanceId?: string | null;
  waivedReason?: string;
}

export function useUpdateEORequirement() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ requirementId, status, linkedClearanceId, waivedReason }: UpdateEORequirementOptions) => {
      const token = api.getToken();
      if (!token) throw new Error('Not authenticated');

      const response = await fetch(
        `${API_BASE}/api/v1/backlot/eo-requirements/${requirementId}`,
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            status,
            linked_clearance_id: linkedClearanceId,
            waived_reason: waivedReason,
          }),
        }
      );

      if (!response.ok) {
        const error = await response.json().catch(() => ({ detail: 'Failed to update E&O requirement' }));
        throw new Error(error.detail);
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['backlot-eo-requirements'] });
      queryClient.invalidateQueries({ queryKey: ['backlot-eo-summary'] });
    },
  });
}

export function useEOSummary(projectId: string | null) {
  return useQuery({
    queryKey: ['backlot-eo-summary', projectId],
    queryFn: async () => {
      if (!projectId) return null;

      const token = api.getToken();
      if (!token) throw new Error('Not authenticated');

      const response = await fetch(
        `${API_BASE}/api/v1/backlot/projects/${projectId}/eo-summary`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      if (!response.ok) {
        const error = await response.json().catch(() => ({ detail: 'Failed to fetch E&O summary' }));
        throw new Error(error.detail);
      }

      const result = await response.json();
      return (result.summary || null) as EOSummary | null;
    },
    enabled: !!projectId,
  });
}

// =============================================================================
// EXPIRING CLEARANCES HOOK
// =============================================================================

export function useExpiringClearances(projectId: string | null, days: number = 90) {
  return useQuery({
    queryKey: ['backlot-expiring-clearances', projectId, days],
    queryFn: async () => {
      if (!projectId) return [];

      const token = api.getToken();
      if (!token) throw new Error('Not authenticated');

      const response = await fetch(
        `${API_BASE}/api/v1/backlot/projects/${projectId}/clearances/expiring?days=${days}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      if (!response.ok) {
        const error = await response.json().catch(() => ({ detail: 'Failed to fetch expiring clearances' }));
        throw new Error(error.detail);
      }

      const result = await response.json();
      return (result.expiring_clearances || []) as ExpiringClearance[];
    },
    enabled: !!projectId,
  });
}

// =============================================================================
// BULK UPDATE HOOK
// =============================================================================

interface BulkUpdateOptions {
  projectId: string;
  clearanceIds: string[];
  status: BacklotClearanceStatus;
  notes?: string;
}

export function useBulkUpdateClearances() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ projectId, clearanceIds, status, notes }: BulkUpdateOptions) => {
      const token = api.getToken();
      if (!token) throw new Error('Not authenticated');

      const response = await fetch(
        `${API_BASE}/api/v1/backlot/projects/${projectId}/clearances/bulk-update`,
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            clearance_ids: clearanceIds,
            status,
            notes,
          }),
        }
      );

      if (!response.ok) {
        const error = await response.json().catch(() => ({ detail: 'Failed to bulk update clearances' }));
        throw new Error(error.detail);
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['backlot-clearances'] });
      queryClient.invalidateQueries({ queryKey: ['backlot-clearance-summary'] });
      queryClient.invalidateQueries({ queryKey: ['backlot-eo-summary'] });
    },
  });
}

/**
 * Hook to fetch document versions for a clearance
 */
export function useClearanceDocumentVersions(clearanceId: string | null) {
  return useQuery<ClearanceDocumentVersion[]>({
    queryKey: ['backlot-clearance-versions', clearanceId],
    queryFn: async () => {
      if (!clearanceId) return [];

      const response = await api.fetch(
        `${API_BASE}/api/v1/backlot/clearances/${clearanceId}/versions`
      );

      if (!response.ok) {
        const error = await response.json().catch(() => ({ detail: 'Failed to fetch versions' }));
        throw new Error(error.detail);
      }

      return response.json();
    },
    enabled: !!clearanceId,
  });
}

/**
 * Hook to restore a document version
 */
export function useRestoreClearanceVersion() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      clearanceId,
      versionId,
    }: {
      clearanceId: string;
      versionId: string;
    }) => {
      const response = await api.fetch(
        `${API_BASE}/api/v1/backlot/clearances/${clearanceId}/versions/${versionId}/restore`,
        {
          method: 'POST',
        }
      );

      if (!response.ok) {
        const error = await response.json().catch(() => ({ detail: 'Failed to restore version' }));
        throw new Error(error.detail);
      }

      return response.json();
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['backlot-clearance-versions', variables.clearanceId] });
      queryClient.invalidateQueries({ queryKey: ['backlot-clearance', variables.clearanceId] });
      queryClient.invalidateQueries({ queryKey: ['backlot-clearance-history', variables.clearanceId] });
    },
  });
}
