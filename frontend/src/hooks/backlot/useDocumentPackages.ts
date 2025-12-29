/**
 * useDocumentPackages - Hook for managing document packages (crew onboarding bundles)
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import {
  DocumentPackage,
  DocumentPackageInput,
  PackageAssignment,
  SendPackageInput,
  SendPackageResult,
} from '@/types/backlot';

const API_BASE = import.meta.env.VITE_API_URL || '';

// =============================================================================
// Document Package Queries
// =============================================================================

/**
 * Fetch all document packages for a project (includes org-wide packages)
 */
export function useDocumentPackages(projectId: string | null) {
  const queryClient = useQueryClient();

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['document-packages', projectId],
    queryFn: async () => {
      if (!projectId) return [];

      const token = api.getToken();
      if (!token) throw new Error('Not authenticated');

      const response = await fetch(
        `${API_BASE}/api/v1/backlot/projects/${projectId}/document-packages`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (!response.ok) {
        const error = await response.json().catch(() => ({ detail: 'Failed to fetch packages' }));
        throw new Error(error.detail);
      }

      const result = await response.json();
      return (result.packages || result || []) as DocumentPackage[];
    },
    enabled: !!projectId,
  });

  const createPackage = useMutation({
    mutationFn: async ({
      projectId,
      ...input
    }: DocumentPackageInput & { projectId: string }) => {
      const token = api.getToken();
      if (!token) throw new Error('Not authenticated');

      const response = await fetch(
        `${API_BASE}/api/v1/backlot/projects/${projectId}/document-packages`,
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
        const error = await response.json().catch(() => ({ detail: 'Failed to create package' }));
        throw new Error(error.detail);
      }

      const result = await response.json();
      return (result.package || result) as DocumentPackage;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['document-packages'] });
    },
  });

  const updatePackage = useMutation({
    mutationFn: async ({
      packageId,
      ...input
    }: Partial<DocumentPackageInput> & { packageId: string }) => {
      const token = api.getToken();
      if (!token) throw new Error('Not authenticated');

      const response = await fetch(
        `${API_BASE}/api/v1/backlot/document-packages/${packageId}`,
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(input),
        }
      );

      if (!response.ok) {
        const error = await response.json().catch(() => ({ detail: 'Failed to update package' }));
        throw new Error(error.detail);
      }

      const result = await response.json();
      return (result.package || result) as DocumentPackage;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['document-packages'] });
    },
  });

  const deletePackage = useMutation({
    mutationFn: async (packageId: string) => {
      const token = api.getToken();
      if (!token) throw new Error('Not authenticated');

      const response = await fetch(
        `${API_BASE}/api/v1/backlot/document-packages/${packageId}`,
        {
          method: 'DELETE',
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (!response.ok) {
        const error = await response.json().catch(() => ({ detail: 'Failed to delete package' }));
        throw new Error(error.detail);
      }

      return true;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['document-packages'] });
    },
  });

  return {
    packages: data || [],
    isLoading,
    error,
    refetch,
    createPackage,
    updatePackage,
    deletePackage,
  };
}

/**
 * Fetch a single document package with items
 */
export function useDocumentPackage(packageId: string | null) {
  return useQuery({
    queryKey: ['document-package', packageId],
    queryFn: async () => {
      if (!packageId) return null;

      const token = api.getToken();
      if (!token) throw new Error('Not authenticated');

      const response = await fetch(
        `${API_BASE}/api/v1/backlot/document-packages/${packageId}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (!response.ok) {
        const error = await response.json().catch(() => ({ detail: 'Failed to fetch package' }));
        throw new Error(error.detail);
      }

      const result = await response.json();
      return (result.package || result) as DocumentPackage;
    },
    enabled: !!packageId,
  });
}

// =============================================================================
// Package Assignment Queries
// =============================================================================

/**
 * Fetch package assignments for a project
 */
export function usePackageAssignments(projectId: string | null) {
  return useQuery({
    queryKey: ['package-assignments', projectId],
    queryFn: async () => {
      if (!projectId) return [];

      const token = api.getToken();
      if (!token) throw new Error('Not authenticated');

      const response = await fetch(
        `${API_BASE}/api/v1/backlot/projects/${projectId}/package-assignments`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (!response.ok) {
        const error = await response.json().catch(() => ({ detail: 'Failed to fetch assignments' }));
        throw new Error(error.detail);
      }

      const result = await response.json();
      return (result.assignments || result || []) as PackageAssignment[];
    },
    enabled: !!projectId,
  });
}

/**
 * Fetch package assignments for a specific user in a project
 */
export function useUserPackageAssignments(projectId: string | null, userId: string | null) {
  return useQuery({
    queryKey: ['package-assignments', projectId, 'user', userId],
    queryFn: async () => {
      if (!projectId || !userId) return [];

      const token = api.getToken();
      if (!token) throw new Error('Not authenticated');

      const response = await fetch(
        `${API_BASE}/api/v1/backlot/projects/${projectId}/package-assignments?user_id=${userId}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (!response.ok) {
        const error = await response.json().catch(() => ({ detail: 'Failed to fetch assignments' }));
        throw new Error(error.detail);
      }

      const result = await response.json();
      return (result.assignments || result || []) as PackageAssignment[];
    },
    enabled: !!projectId && !!userId,
  });
}

// =============================================================================
// Send Package Mutation
// =============================================================================

/**
 * Send a document package to one or more recipients
 */
export function useSendPackage() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      projectId,
      ...input
    }: SendPackageInput & { projectId: string }) => {
      const token = api.getToken();
      if (!token) throw new Error('Not authenticated');

      const response = await fetch(
        `${API_BASE}/api/v1/backlot/projects/${projectId}/send-package`,
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
        const error = await response.json().catch(() => ({ detail: 'Failed to send package' }));
        throw new Error(error.detail);
      }

      return (await response.json()) as SendPackageResult;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['package-assignments', variables.projectId] });
      queryClient.invalidateQueries({ queryKey: ['backlot-clearances'] });
      queryClient.invalidateQueries({ queryKey: ['crew-document-summary'] });
    },
  });
}

// =============================================================================
// Cancel Assignment Mutation
// =============================================================================

/**
 * Cancel a package assignment
 */
export function useCancelPackageAssignment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      projectId,
      assignmentId,
    }: {
      projectId: string;
      assignmentId: string;
    }) => {
      const token = api.getToken();
      if (!token) throw new Error('Not authenticated');

      const response = await fetch(
        `${API_BASE}/api/v1/backlot/projects/${projectId}/package-assignments/${assignmentId}`,
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ status: 'cancelled' }),
        }
      );

      if (!response.ok) {
        const error = await response.json().catch(() => ({ detail: 'Failed to cancel assignment' }));
        throw new Error(error.detail);
      }

      return await response.json();
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['package-assignments', variables.projectId] });
    },
  });
}
