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
    not_started: 'gray',
    expired: 'orange',
    rejected: 'red',
    missing: 'slate',
  };
  return colors[status] || 'gray';
}
