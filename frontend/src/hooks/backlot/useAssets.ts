/**
 * Assets & Deliverables Hooks
 * React Query hooks for managing project assets and deliverables
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import {
  BacklotAsset,
  AssetInput,
  BacklotDeliverableTemplate,
  DeliverableTemplateInput,
  BacklotProjectDeliverable,
  ProjectDeliverableInput,
  BulkDeliverableInput,
  AssetsSummary,
  DeliverablesSummary,
  BacklotDeliverableStatus,
} from '@/types/backlot';

// =====================================================
// ASSETS HOOKS
// =====================================================

// Get all assets for a project
export function useAssets(projectId: string | null) {
  return useQuery({
    queryKey: ['backlot', 'assets', projectId],
    queryFn: async (): Promise<BacklotAsset[]> => {
      if (!projectId) return [];
      const response = await api.get<{ success: boolean; assets: BacklotAsset[] }>(`/api/v1/backlot/projects/${projectId}/assets`);
      return response.assets || [];
    },
    enabled: !!projectId,
  });
}

// Get a single asset
export function useAsset(assetId: string | null) {
  return useQuery({
    queryKey: ['backlot', 'asset', assetId],
    queryFn: async (): Promise<BacklotAsset | null> => {
      if (!assetId) return null;
      return api.get<BacklotAsset>(`/api/v1/backlot/assets/${assetId}`);
    },
    enabled: !!assetId,
  });
}

// Get assets summary for a project
export function useAssetsSummary(projectId: string | null) {
  return useQuery({
    queryKey: ['backlot', 'assets', 'summary', projectId],
    queryFn: async (): Promise<AssetsSummary | null> => {
      if (!projectId) return null;
      return api.get<AssetsSummary>(`/api/v1/backlot/projects/${projectId}/assets/summary`);
    },
    enabled: !!projectId,
  });
}

// Asset mutations
export function useAssetMutations(projectId: string) {
  const queryClient = useQueryClient();

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['backlot', 'assets', projectId] });
    queryClient.invalidateQueries({ queryKey: ['backlot', 'assets', 'summary', projectId] });
  };

  const createAsset = useMutation({
    mutationFn: async (input: AssetInput): Promise<BacklotAsset> => {
      return api.post<BacklotAsset>(`/api/v1/backlot/projects/${projectId}/assets`, input);
    },
    onSuccess: invalidate,
  });

  const updateAsset = useMutation({
    mutationFn: async ({ assetId, input }: { assetId: string; input: Partial<AssetInput> }): Promise<BacklotAsset> => {
      return api.put<BacklotAsset>(`/api/v1/backlot/assets/${assetId}`, input);
    },
    onSuccess: (_, variables) => {
      invalidate();
      queryClient.invalidateQueries({ queryKey: ['backlot', 'asset', variables.assetId] });
    },
  });

  const updateAssetStatus = useMutation({
    mutationFn: async ({ assetId, status }: { assetId: string; status: BacklotDeliverableStatus }): Promise<BacklotAsset> => {
      return api.patch<BacklotAsset>(`/api/v1/backlot/assets/${assetId}/status`, { status });
    },
    onSuccess: (_, variables) => {
      invalidate();
      queryClient.invalidateQueries({ queryKey: ['backlot', 'asset', variables.assetId] });
    },
  });

  const deleteAsset = useMutation({
    mutationFn: async (assetId: string): Promise<void> => {
      await api.delete(`/api/v1/backlot/assets/${assetId}`);
    },
    onSuccess: invalidate,
  });

  return {
    createAsset,
    updateAsset,
    updateAssetStatus,
    deleteAsset,
  };
}

// =====================================================
// DELIVERABLE TEMPLATES HOOKS
// =====================================================

// Get all deliverable templates
export function useDeliverableTemplates() {
  return useQuery({
    queryKey: ['backlot', 'deliverable-templates'],
    queryFn: async (): Promise<BacklotDeliverableTemplate[]> => {
      return api.get<BacklotDeliverableTemplate[]>('/api/v1/backlot/deliverable-templates');
    },
  });
}

// Get a single template
export function useDeliverableTemplate(templateId: string | null) {
  return useQuery({
    queryKey: ['backlot', 'deliverable-template', templateId],
    queryFn: async (): Promise<BacklotDeliverableTemplate | null> => {
      if (!templateId) return null;
      return api.get<BacklotDeliverableTemplate>(`/api/v1/backlot/deliverable-templates/${templateId}`);
    },
    enabled: !!templateId,
  });
}

// Get list of all platforms
export function useDeliverablePlatforms() {
  return useQuery({
    queryKey: ['backlot', 'deliverable-platforms'],
    queryFn: async (): Promise<string[]> => {
      return api.get<string[]>('/api/v1/backlot/deliverable-templates/platforms/list');
    },
  });
}

// Template mutations
export function useDeliverableTemplateMutations() {
  const queryClient = useQueryClient();

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['backlot', 'deliverable-templates'] });
    queryClient.invalidateQueries({ queryKey: ['backlot', 'deliverable-platforms'] });
  };

  const createTemplate = useMutation({
    mutationFn: async (input: DeliverableTemplateInput): Promise<BacklotDeliverableTemplate> => {
      return api.post<BacklotDeliverableTemplate>('/api/v1/backlot/deliverable-templates', input);
    },
    onSuccess: invalidate,
  });

  const updateTemplate = useMutation({
    mutationFn: async ({ templateId, input }: { templateId: string; input: Partial<DeliverableTemplateInput> }): Promise<BacklotDeliverableTemplate> => {
      return api.put<BacklotDeliverableTemplate>(`/api/v1/backlot/deliverable-templates/${templateId}`, input);
    },
    onSuccess: (_, variables) => {
      invalidate();
      queryClient.invalidateQueries({ queryKey: ['backlot', 'deliverable-template', variables.templateId] });
    },
  });

  const deleteTemplate = useMutation({
    mutationFn: async (templateId: string): Promise<void> => {
      await api.delete(`/api/v1/backlot/deliverable-templates/${templateId}`);
    },
    onSuccess: invalidate,
  });

  return {
    createTemplate,
    updateTemplate,
    deleteTemplate,
  };
}

// =====================================================
// PROJECT DELIVERABLES HOOKS
// =====================================================

// Get all deliverables for a project
export function useProjectDeliverables(projectId: string | null) {
  return useQuery({
    queryKey: ['backlot', 'deliverables', projectId],
    queryFn: async (): Promise<BacklotProjectDeliverable[]> => {
      if (!projectId) return [];
      const response = await api.get<{ success: boolean; deliverables: BacklotProjectDeliverable[] }>(`/api/v1/backlot/projects/${projectId}/deliverables`);
      return response.deliverables || [];
    },
    enabled: !!projectId,
  });
}

// Get a single deliverable
export function useProjectDeliverable(deliverableId: string | null) {
  return useQuery({
    queryKey: ['backlot', 'deliverable', deliverableId],
    queryFn: async (): Promise<BacklotProjectDeliverable | null> => {
      if (!deliverableId) return null;
      return api.get<BacklotProjectDeliverable>(`/api/v1/backlot/deliverables/${deliverableId}`);
    },
    enabled: !!deliverableId,
  });
}

// Get deliverables summary for a project
export function useDeliverablesSummary(projectId: string | null) {
  return useQuery({
    queryKey: ['backlot', 'deliverables', 'summary', projectId],
    queryFn: async (): Promise<DeliverablesSummary | null> => {
      if (!projectId) return null;
      return api.get<DeliverablesSummary>(`/api/v1/backlot/projects/${projectId}/deliverables/summary`);
    },
    enabled: !!projectId,
  });
}

// Deliverable mutations
export function useDeliverableMutations(projectId: string) {
  const queryClient = useQueryClient();

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['backlot', 'deliverables', projectId] });
    queryClient.invalidateQueries({ queryKey: ['backlot', 'deliverables', 'summary', projectId] });
    // Also invalidate assets since deliverables count might change
    queryClient.invalidateQueries({ queryKey: ['backlot', 'assets', projectId] });
  };

  const createDeliverable = useMutation({
    mutationFn: async (input: ProjectDeliverableInput): Promise<BacklotProjectDeliverable> => {
      return api.post<BacklotProjectDeliverable>(`/api/v1/backlot/projects/${projectId}/deliverables`, input);
    },
    onSuccess: invalidate,
  });

  const updateDeliverable = useMutation({
    mutationFn: async ({ deliverableId, input }: { deliverableId: string; input: Partial<ProjectDeliverableInput> }): Promise<BacklotProjectDeliverable> => {
      return api.put<BacklotProjectDeliverable>(`/api/v1/backlot/deliverables/${deliverableId}`, input);
    },
    onSuccess: (_, variables) => {
      invalidate();
      queryClient.invalidateQueries({ queryKey: ['backlot', 'deliverable', variables.deliverableId] });
    },
  });

  const updateDeliverableStatus = useMutation({
    mutationFn: async ({ deliverableId, status }: { deliverableId: string; status: BacklotDeliverableStatus }): Promise<BacklotProjectDeliverable> => {
      return api.patch<BacklotProjectDeliverable>(`/api/v1/backlot/deliverables/${deliverableId}/status`, { status });
    },
    onSuccess: (_, variables) => {
      invalidate();
      queryClient.invalidateQueries({ queryKey: ['backlot', 'deliverable', variables.deliverableId] });
    },
  });

  const deleteDeliverable = useMutation({
    mutationFn: async (deliverableId: string): Promise<void> => {
      await api.delete(`/api/v1/backlot/deliverables/${deliverableId}`);
    },
    onSuccess: invalidate,
  });

  const bulkCreateDeliverables = useMutation({
    mutationFn: async ({ assetId, input }: { assetId: string; input: BulkDeliverableInput }): Promise<BacklotProjectDeliverable[]> => {
      return api.post<BacklotProjectDeliverable[]>(`/api/v1/backlot/assets/${assetId}/deliverables/bulk`, input);
    },
    onSuccess: invalidate,
  });

  return {
    createDeliverable,
    updateDeliverable,
    updateDeliverableStatus,
    deleteDeliverable,
    bulkCreateDeliverables,
  };
}

// =====================================================
// UNIFIED ASSETS HOOKS (Assets Tab - combines all sources)
// =====================================================

import {
  UnifiedAsset,
  UnifiedAssetSource,
  StandaloneAsset,
  StandaloneAssetInput,
  AssetFolder,
  AssetFolderInput,
} from '@/types/backlot';

interface UseUnifiedAssetsOptions {
  projectId: string | null;
  source?: UnifiedAssetSource;
  assetType?: string;
  search?: string;
  limit?: number;
  offset?: number;
  enabled?: boolean;
}

export function useUnifiedAssets(options: UseUnifiedAssetsOptions) {
  const { projectId, source, assetType, search, limit = 100, offset = 0, enabled = true } = options;

  const queryKey = ['backlot-unified-assets', { projectId, source, assetType, search, limit, offset }];

  const { data, isLoading, error, refetch } = useQuery({
    queryKey,
    queryFn: async () => {
      if (!projectId) return { assets: [], total: 0, limit, offset };
      return api.listUnifiedAssets(projectId, { source, asset_type: assetType, search, limit, offset });
    },
    enabled: !!projectId && enabled,
  });

  return {
    assets: data?.assets || [],
    total: data?.total || 0,
    isLoading,
    error,
    refetch,
  };
}

// Get unified assets summary
interface UseUnifiedAssetsSummaryOptions {
  projectId: string | null;
}

export function useUnifiedAssetsSummary(options: UseUnifiedAssetsSummaryOptions) {
  const { projectId } = options;

  const queryKey = ['backlot-assets-summary', { projectId }];

  const { data, isLoading, error, refetch } = useQuery({
    queryKey,
    queryFn: async () => {
      if (!projectId) return { summary: [], total_storage_bytes: 0 };
      return api.getAssetsSummary(projectId);
    },
    enabled: !!projectId,
  });

  // Calculate totals by source and type
  const summaryBySource: Record<string, number> = {};
  const summaryByType: Record<string, number> = {};

  (data?.summary || []).forEach((item) => {
    summaryBySource[item.source] = (summaryBySource[item.source] || 0) + item.count;
    summaryByType[item.asset_type] = (summaryByType[item.asset_type] || 0) + item.count;
  });

  return {
    summary: data?.summary || [],
    summaryBySource,
    summaryByType,
    totalStorageBytes: data?.total_storage_bytes || 0,
    totalAssets: Object.values(summaryBySource).reduce((a, b) => a + b, 0),
    isLoading,
    error,
    refetch,
  };
}

// =====================================================
// STANDALONE ASSETS HOOKS
// =====================================================

interface UseStandaloneAssetsOptions {
  projectId: string | null;
  folderId?: string | null;
  assetType?: string;
  tags?: string[];
}

export function useStandaloneAssets(options: UseStandaloneAssetsOptions) {
  const { projectId, folderId, assetType, tags } = options;
  const queryClient = useQueryClient();

  const queryKey = ['backlot-standalone-assets', { projectId, folderId, assetType, tags }];

  const { data: assets = [], isLoading, error, refetch } = useQuery({
    queryKey,
    queryFn: async () => {
      if (!projectId) return [];
      const result = await api.listStandaloneAssets(projectId, {
        folder_id: folderId || undefined,
        asset_type: assetType,
        tags: tags?.join(','),
      });
      return result.assets;
    },
    enabled: !!projectId,
  });

  // Create standalone asset
  const createAssetMutation = useMutation({
    mutationFn: async (input: StandaloneAssetInput) => {
      if (!projectId) throw new Error('Project ID required');
      return api.createStandaloneAsset(projectId, input);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['backlot-standalone-assets'] });
      queryClient.invalidateQueries({ queryKey: ['backlot-unified-assets'] });
      queryClient.invalidateQueries({ queryKey: ['backlot-assets-summary'] });
    },
  });

  // Update standalone asset
  const updateAssetMutation = useMutation({
    mutationFn: async ({ assetId, data }: { assetId: string; data: Partial<{
      name: string;
      description: string | null;
      tags: string[];
      metadata: Record<string, unknown>;
      folder_id: string | null;
    }> }) => {
      return api.updateStandaloneAsset(assetId, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['backlot-standalone-assets'] });
      queryClient.invalidateQueries({ queryKey: ['backlot-unified-assets'] });
    },
  });

  // Delete standalone asset
  const deleteAssetMutation = useMutation({
    mutationFn: async (assetId: string) => {
      return api.deleteStandaloneAsset(assetId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['backlot-standalone-assets'] });
      queryClient.invalidateQueries({ queryKey: ['backlot-unified-assets'] });
      queryClient.invalidateQueries({ queryKey: ['backlot-assets-summary'] });
    },
  });

  return {
    assets,
    isLoading,
    error,
    refetch,
    createAsset: createAssetMutation,
    updateAsset: updateAssetMutation,
    deleteAsset: deleteAssetMutation,
  };
}

// =====================================================
// ASSET FOLDERS HOOKS
// =====================================================

interface UseAssetFoldersOptions {
  projectId: string | null;
}

export function useAssetFolders(options: UseAssetFoldersOptions) {
  const { projectId } = options;
  const queryClient = useQueryClient();

  const queryKey = ['backlot-asset-folders', { projectId }];

  const { data: folders = [], isLoading, error, refetch } = useQuery({
    queryKey,
    queryFn: async () => {
      if (!projectId) return [];
      const result = await api.listAssetFolders(projectId);
      return result.folders;
    },
    enabled: !!projectId,
  });

  // Create folder
  const createFolderMutation = useMutation({
    mutationFn: async (input: AssetFolderInput) => {
      if (!projectId) throw new Error('Project ID required');
      return api.createAssetFolder(projectId, input);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
    },
  });

  // Update folder
  const updateFolderMutation = useMutation({
    mutationFn: async ({ folderId, data }: { folderId: string; data: Partial<{
      name: string;
      folder_type: string | null;
      parent_folder_id: string | null;
      sort_order: number;
    }> }) => {
      return api.updateAssetFolder(folderId, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
    },
  });

  // Delete folder
  const deleteFolderMutation = useMutation({
    mutationFn: async (folderId: string) => {
      return api.deleteAssetFolder(folderId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
    },
  });

  return {
    folders,
    isLoading,
    error,
    refetch,
    createFolder: createFolderMutation,
    updateFolder: updateFolderMutation,
    deleteFolder: deleteFolderMutation,
  };
}

// =====================================================
// UNIFIED ASSETS HELPER FUNCTIONS
// =====================================================

export function formatFileSize(bytes: number | null): string {
  if (bytes === null || bytes === undefined) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

export function getAssetTypeIcon(assetType: string): string {
  switch (assetType) {
    case 'video': return 'Film';
    case 'audio':
    case 'music':
    case 'sfx': return 'Music';
    case '3d_model': return 'Box';
    case 'image':
    case 'graphics': return 'Image';
    case 'document': return 'FileText';
    default: return 'File';
  }
}

export function getAssetTypeColor(assetType: string): string {
  switch (assetType) {
    case 'video': return 'text-accent-yellow';
    case 'audio':
    case 'music':
    case 'sfx': return 'text-purple-400';
    case '3d_model': return 'text-green-400';
    case 'image':
    case 'graphics': return 'text-blue-400';
    case 'document': return 'text-orange-400';
    default: return 'text-muted-gray';
  }
}

export function getSourceLabel(source: UnifiedAssetSource): string {
  switch (source) {
    case 'dailies': return 'Dailies';
    case 'review': return 'Review';
    case 'standalone': return 'Assets';
    default: return source;
  }
}

export function getSourceColor(source: UnifiedAssetSource): string {
  switch (source) {
    case 'dailies': return 'bg-blue-500/20 text-blue-400';
    case 'review': return 'bg-accent-yellow/20 text-accent-yellow';
    case 'standalone': return 'bg-purple-500/20 text-purple-400';
    default: return 'bg-muted-gray/20 text-muted-gray';
  }
}
