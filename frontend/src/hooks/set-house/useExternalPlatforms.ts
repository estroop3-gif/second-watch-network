/**
 * External Platforms Hook
 * Data fetching and mutations for external booking platform integrations
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/context/AuthContext';
import type {
  ExternalPlatform,
  ExternalPlatformDetailResponse,
  ExternalSyncLog,
  ExternalBooking,
  ICalValidationResult,
  ICalPreviewResponse,
  CSVUploadResult,
  CSVImportResult,
  CSVTemplate,
  CreateExternalPlatformInput,
  UpdateExternalPlatformInput,
  CSVImportInput,
  CreateCSVTemplateInput,
  SyncTriggerResult,
} from '@/types/set-house';

const API_BASE = import.meta.env.VITE_API_URL || '';

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

async function fetchWithAuth(url: string, token: string, options?: RequestInit) {
  const fullUrl = `${API_BASE}${url}`;
  console.log(`[External Platforms API] ${options?.method || 'GET'} ${fullUrl}`);

  const response = await fetch(fullUrl, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...options?.headers,
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    let errorDetail = `HTTP ${response.status}: ${response.statusText}`;
    try {
      const errorJson = JSON.parse(errorText);
      errorDetail = errorJson.detail || errorJson.message || errorDetail;
    } catch {
      if (errorText) errorDetail += ` - ${errorText}`;
    }
    console.error(`[External Platforms API] Error: ${errorDetail}`);
    throw new Error(errorDetail);
  }

  const data = await response.json();
  console.log(`[External Platforms API] Response:`, data);
  return data;
}

async function uploadFile(url: string, token: string, file: File) {
  const fullUrl = `${API_BASE}${url}`;
  console.log(`[External Platforms API] Upload ${fullUrl}`);

  const formData = new FormData();
  formData.append('file', file);

  const response = await fetch(fullUrl, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: formData,
  });

  if (!response.ok) {
    const errorText = await response.text();
    let errorDetail = `HTTP ${response.status}: ${response.statusText}`;
    try {
      const errorJson = JSON.parse(errorText);
      errorDetail = errorJson.detail || errorJson.message || errorDetail;
    } catch {
      if (errorText) errorDetail += ` - ${errorText}`;
    }
    throw new Error(errorDetail);
  }

  return response.json();
}

// ============================================================================
// EXTERNAL PLATFORMS HOOKS
// ============================================================================

export interface UseExternalPlatformsOptions {
  enabled?: boolean;
  isActive?: boolean;
  platformType?: string;
}

export function useExternalPlatforms(orgId: string | null, options?: UseExternalPlatformsOptions) {
  const { session } = useAuth();
  const token = session?.access_token;
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['external-platforms', orgId, options?.isActive, options?.platformType],
    queryFn: () => {
      const params = new URLSearchParams();
      if (options?.isActive !== undefined) params.set('is_active', String(options.isActive));
      if (options?.platformType) params.set('platform_type', options.platformType);
      const queryString = params.toString();
      return fetchWithAuth(
        `/api/v1/set-house/external-platforms/${orgId}${queryString ? `?${queryString}` : ''}`,
        token!
      );
    },
    enabled: !!token && !!orgId && (options?.enabled ?? true),
    select: (data) => ({
      platforms: data.platforms as ExternalPlatform[],
      total: data.total as number,
    }),
  });

  const createPlatform = useMutation({
    mutationFn: (input: CreateExternalPlatformInput) =>
      fetchWithAuth(`/api/v1/set-house/external-platforms/${orgId}`, token!, {
        method: 'POST',
        body: JSON.stringify(input),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['external-platforms', orgId] });
    },
  });

  const updatePlatform = useMutation({
    mutationFn: ({ platformId, ...input }: UpdateExternalPlatformInput & { platformId: string }) =>
      fetchWithAuth(`/api/v1/set-house/external-platforms/${orgId}/${platformId}`, token!, {
        method: 'PATCH',
        body: JSON.stringify(input),
      }),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['external-platforms', orgId] });
      queryClient.invalidateQueries({ queryKey: ['external-platform', orgId, variables.platformId] });
    },
  });

  const deletePlatform = useMutation({
    mutationFn: (platformId: string) =>
      fetchWithAuth(`/api/v1/set-house/external-platforms/${orgId}/${platformId}`, token!, {
        method: 'DELETE',
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['external-platforms', orgId] });
    },
  });

  const triggerSync = useMutation({
    mutationFn: (platformId: string) =>
      fetchWithAuth(`/api/v1/set-house/external-platforms/${orgId}/${platformId}/sync`, token!, {
        method: 'POST',
      }) as Promise<SyncTriggerResult>,
    onSuccess: (_, platformId) => {
      queryClient.invalidateQueries({ queryKey: ['external-platforms', orgId] });
      queryClient.invalidateQueries({ queryKey: ['external-platform', orgId, platformId] });
      queryClient.invalidateQueries({ queryKey: ['external-sync-logs', orgId, platformId] });
      queryClient.invalidateQueries({ queryKey: ['external-bookings', orgId] });
    },
  });

  return {
    platforms: query.data?.platforms ?? [],
    total: query.data?.total ?? 0,
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
    createPlatform,
    updatePlatform,
    deletePlatform,
    triggerSync,
  };
}

export function useExternalPlatformDetail(orgId: string | null, platformId: string | null) {
  const { session } = useAuth();
  const token = session?.access_token;

  const query = useQuery({
    queryKey: ['external-platform', orgId, platformId],
    queryFn: () =>
      fetchWithAuth(
        `/api/v1/set-house/external-platforms/${orgId}/${platformId}`,
        token!
      ) as Promise<ExternalPlatformDetailResponse>,
    enabled: !!token && !!orgId && !!platformId,
  });

  return {
    platform: query.data?.platform ?? null,
    syncStats: query.data?.sync_stats ?? null,
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
  };
}

// ============================================================================
// SYNC LOGS HOOKS
// ============================================================================

export function useExternalSyncLogs(
  orgId: string | null,
  platformId: string | null,
  options?: { limit?: number; offset?: number; enabled?: boolean }
) {
  const { session } = useAuth();
  const token = session?.access_token;

  const query = useQuery({
    queryKey: ['external-sync-logs', orgId, platformId, options?.limit, options?.offset],
    queryFn: () => {
      const params = new URLSearchParams();
      if (options?.limit) params.set('limit', String(options.limit));
      if (options?.offset) params.set('offset', String(options.offset));
      const queryString = params.toString();
      return fetchWithAuth(
        `/api/v1/set-house/external-platforms/${orgId}/${platformId}/logs${queryString ? `?${queryString}` : ''}`,
        token!
      );
    },
    enabled: !!token && !!orgId && !!platformId && (options?.enabled ?? true),
    select: (data) => ({
      logs: data.logs as ExternalSyncLog[],
      total: data.total as number,
    }),
  });

  return {
    logs: query.data?.logs ?? [],
    total: query.data?.total ?? 0,
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
  };
}

// ============================================================================
// ICAL HOOKS
// ============================================================================

export function useValidateICalUrl(orgId: string | null) {
  const { session } = useAuth();
  const token = session?.access_token;

  const validateUrl = useMutation({
    mutationFn: (url: string) =>
      fetchWithAuth(`/api/v1/set-house/external-platforms/${orgId}/validate-ical`, token!, {
        method: 'POST',
        body: JSON.stringify({ url }),
      }) as Promise<ICalValidationResult>,
  });

  return {
    validateUrl,
    isValidating: validateUrl.isPending,
    validationResult: validateUrl.data,
  };
}

export function useICalPreview(orgId: string | null, platformId: string | null, options?: { enabled?: boolean }) {
  const { session } = useAuth();
  const token = session?.access_token;

  const query = useQuery({
    queryKey: ['ical-preview', orgId, platformId],
    queryFn: () =>
      fetchWithAuth(
        `/api/v1/set-house/external-platforms/${orgId}/${platformId}/preview-ical`,
        token!
      ) as Promise<ICalPreviewResponse>,
    enabled: !!token && !!orgId && !!platformId && (options?.enabled ?? true),
  });

  return {
    totalEvents: query.data?.total_events ?? 0,
    previewEvents: query.data?.preview_events ?? [],
    alreadyImportedCount: query.data?.already_imported_count ?? 0,
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
  };
}

// ============================================================================
// CSV IMPORT HOOKS
// ============================================================================

export function useCSVUpload(orgId: string | null) {
  const { session } = useAuth();
  const token = session?.access_token;

  const uploadCSV = useMutation({
    mutationFn: (file: File) =>
      uploadFile(`/api/v1/set-house/external-platforms/${orgId}/upload-csv`, token!, file) as Promise<CSVUploadResult>,
  });

  return {
    uploadCSV,
    isUploading: uploadCSV.isPending,
    uploadResult: uploadCSV.data,
    uploadError: uploadCSV.error,
    reset: uploadCSV.reset,
  };
}

export function useCSVImport(orgId: string | null) {
  const { session } = useAuth();
  const token = session?.access_token;
  const queryClient = useQueryClient();

  const importCSV = useMutation({
    mutationFn: (input: CSVImportInput) =>
      fetchWithAuth(`/api/v1/set-house/external-platforms/${orgId}/import-csv`, token!, {
        method: 'POST',
        body: JSON.stringify(input),
      }) as Promise<CSVImportResult>,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['external-platforms', orgId] });
      queryClient.invalidateQueries({ queryKey: ['external-bookings', orgId] });
      queryClient.invalidateQueries({ queryKey: ['set-house-transactions', orgId] });
    },
  });

  return {
    importCSV,
    isImporting: importCSV.isPending,
    importResult: importCSV.data,
    importError: importCSV.error,
    reset: importCSV.reset,
  };
}

export function useDownloadCSVTemplate(orgId: string | null) {
  const { session } = useAuth();
  const token = session?.access_token;

  const downloadTemplate = async () => {
    const fullUrl = `${API_BASE}/api/v1/set-house/external-platforms/${orgId}/csv-template`;

    const response = await fetch(fullUrl, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      throw new Error('Failed to download template');
    }

    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'booking_import_template.csv';
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
  };

  return { downloadTemplate };
}

// ============================================================================
// CSV TEMPLATES HOOKS
// ============================================================================

export function useCSVTemplates(orgId: string | null, options?: { enabled?: boolean }) {
  const { session } = useAuth();
  const token = session?.access_token;
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['csv-templates', orgId],
    queryFn: () => fetchWithAuth(`/api/v1/set-house/external-platforms/${orgId}/csv-templates`, token!),
    enabled: !!token && !!orgId && (options?.enabled ?? true),
    select: (data) => data.templates as CSVTemplate[],
  });

  const createTemplate = useMutation({
    mutationFn: (input: CreateCSVTemplateInput) =>
      fetchWithAuth(`/api/v1/set-house/external-platforms/${orgId}/csv-templates`, token!, {
        method: 'POST',
        body: JSON.stringify(input),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['csv-templates', orgId] });
    },
  });

  const deleteTemplate = useMutation({
    mutationFn: (templateId: string) =>
      fetchWithAuth(`/api/v1/set-house/external-platforms/${orgId}/csv-templates/${templateId}`, token!, {
        method: 'DELETE',
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['csv-templates', orgId] });
    },
  });

  return {
    templates: query.data ?? [],
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
    createTemplate,
    deleteTemplate,
  };
}

// ============================================================================
// EXTERNAL BOOKINGS HOOKS
// ============================================================================

export function useExternalBookings(
  orgId: string | null,
  options?: { platformId?: string; limit?: number; offset?: number; enabled?: boolean }
) {
  const { session } = useAuth();
  const token = session?.access_token;

  const query = useQuery({
    queryKey: ['external-bookings', orgId, options?.platformId, options?.limit, options?.offset],
    queryFn: () => {
      const params = new URLSearchParams();
      if (options?.platformId) params.set('platform_id', options.platformId);
      if (options?.limit) params.set('limit', String(options.limit));
      if (options?.offset) params.set('offset', String(options.offset));
      const queryString = params.toString();
      return fetchWithAuth(
        `/api/v1/set-house/external-platforms/${orgId}/bookings${queryString ? `?${queryString}` : ''}`,
        token!
      );
    },
    enabled: !!token && !!orgId && (options?.enabled ?? true),
    select: (data) => ({
      bookings: data.bookings as ExternalBooking[],
      total: data.total as number,
    }),
  });

  return {
    bookings: query.data?.bookings ?? [],
    total: query.data?.total ?? 0,
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
  };
}
