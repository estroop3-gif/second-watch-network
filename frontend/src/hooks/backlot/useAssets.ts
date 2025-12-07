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
      return api.get<BacklotAsset[]>(`/api/backlot/projects/${projectId}/assets`);
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
      return api.get<BacklotAsset>(`/api/backlot/assets/${assetId}`);
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
      return api.get<AssetsSummary>(`/api/backlot/projects/${projectId}/assets/summary`);
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
      return api.post<BacklotAsset>(`/api/backlot/projects/${projectId}/assets`, input);
    },
    onSuccess: invalidate,
  });

  const updateAsset = useMutation({
    mutationFn: async ({ assetId, input }: { assetId: string; input: Partial<AssetInput> }): Promise<BacklotAsset> => {
      return api.put<BacklotAsset>(`/api/backlot/assets/${assetId}`, input);
    },
    onSuccess: (_, variables) => {
      invalidate();
      queryClient.invalidateQueries({ queryKey: ['backlot', 'asset', variables.assetId] });
    },
  });

  const updateAssetStatus = useMutation({
    mutationFn: async ({ assetId, status }: { assetId: string; status: BacklotDeliverableStatus }): Promise<BacklotAsset> => {
      return api.patch<BacklotAsset>(`/api/backlot/assets/${assetId}/status`, { status });
    },
    onSuccess: (_, variables) => {
      invalidate();
      queryClient.invalidateQueries({ queryKey: ['backlot', 'asset', variables.assetId] });
    },
  });

  const deleteAsset = useMutation({
    mutationFn: async (assetId: string): Promise<void> => {
      await api.delete(`/api/backlot/assets/${assetId}`);
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
      return api.get<BacklotDeliverableTemplate[]>('/api/backlot/deliverable-templates');
    },
  });
}

// Get a single template
export function useDeliverableTemplate(templateId: string | null) {
  return useQuery({
    queryKey: ['backlot', 'deliverable-template', templateId],
    queryFn: async (): Promise<BacklotDeliverableTemplate | null> => {
      if (!templateId) return null;
      return api.get<BacklotDeliverableTemplate>(`/api/backlot/deliverable-templates/${templateId}`);
    },
    enabled: !!templateId,
  });
}

// Get list of all platforms
export function useDeliverablePlatforms() {
  return useQuery({
    queryKey: ['backlot', 'deliverable-platforms'],
    queryFn: async (): Promise<string[]> => {
      return api.get<string[]>('/api/backlot/deliverable-templates/platforms/list');
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
      return api.post<BacklotDeliverableTemplate>('/api/backlot/deliverable-templates', input);
    },
    onSuccess: invalidate,
  });

  const updateTemplate = useMutation({
    mutationFn: async ({ templateId, input }: { templateId: string; input: Partial<DeliverableTemplateInput> }): Promise<BacklotDeliverableTemplate> => {
      return api.put<BacklotDeliverableTemplate>(`/api/backlot/deliverable-templates/${templateId}`, input);
    },
    onSuccess: (_, variables) => {
      invalidate();
      queryClient.invalidateQueries({ queryKey: ['backlot', 'deliverable-template', variables.templateId] });
    },
  });

  const deleteTemplate = useMutation({
    mutationFn: async (templateId: string): Promise<void> => {
      await api.delete(`/api/backlot/deliverable-templates/${templateId}`);
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
      return api.get<BacklotProjectDeliverable[]>(`/api/backlot/projects/${projectId}/deliverables`);
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
      return api.get<BacklotProjectDeliverable>(`/api/backlot/deliverables/${deliverableId}`);
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
      return api.get<DeliverablesSummary>(`/api/backlot/projects/${projectId}/deliverables/summary`);
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
      return api.post<BacklotProjectDeliverable>(`/api/backlot/projects/${projectId}/deliverables`, input);
    },
    onSuccess: invalidate,
  });

  const updateDeliverable = useMutation({
    mutationFn: async ({ deliverableId, input }: { deliverableId: string; input: Partial<ProjectDeliverableInput> }): Promise<BacklotProjectDeliverable> => {
      return api.put<BacklotProjectDeliverable>(`/api/backlot/deliverables/${deliverableId}`, input);
    },
    onSuccess: (_, variables) => {
      invalidate();
      queryClient.invalidateQueries({ queryKey: ['backlot', 'deliverable', variables.deliverableId] });
    },
  });

  const updateDeliverableStatus = useMutation({
    mutationFn: async ({ deliverableId, status }: { deliverableId: string; status: BacklotDeliverableStatus }): Promise<BacklotProjectDeliverable> => {
      return api.patch<BacklotProjectDeliverable>(`/api/backlot/deliverables/${deliverableId}/status`, { status });
    },
    onSuccess: (_, variables) => {
      invalidate();
      queryClient.invalidateQueries({ queryKey: ['backlot', 'deliverable', variables.deliverableId] });
    },
  });

  const deleteDeliverable = useMutation({
    mutationFn: async (deliverableId: string): Promise<void> => {
      await api.delete(`/api/backlot/deliverables/${deliverableId}`);
    },
    onSuccess: invalidate,
  });

  const bulkCreateDeliverables = useMutation({
    mutationFn: async ({ assetId, input }: { assetId: string; input: BulkDeliverableInput }): Promise<BacklotProjectDeliverable[]> => {
      return api.post<BacklotProjectDeliverable[]>(`/api/backlot/assets/${assetId}/deliverables/bulk`, input);
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
