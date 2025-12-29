/**
 * usePendingDocuments - Hook for signing portal and batch signing
 * Allows users to view and sign their pending documents
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import {
  PendingDocument,
  SignedDocumentHistory,
  BatchSignInput,
  BatchSignResult,
} from '@/types/backlot';

const API_BASE = import.meta.env.VITE_API_URL || '';

// =============================================================================
// Pending Documents Query (Signing Portal)
// =============================================================================

/**
 * Fetch all pending documents for the current user across all projects
 */
export function usePendingDocuments() {
  return useQuery({
    queryKey: ['pending-documents', 'me'],
    queryFn: async () => {
      const token = api.getToken();
      if (!token) throw new Error('Not authenticated');

      const response = await fetch(
        `${API_BASE}/api/v1/users/me/pending-documents`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (!response.ok) {
        const error = await response.json().catch(() => ({ detail: 'Failed to fetch pending documents' }));
        throw new Error(error.detail);
      }

      const result = await response.json();
      return (result.documents || result || []) as PendingDocument[];
    },
  });
}

/**
 * Fetch pending documents for a specific user (admin view)
 */
export function useUserPendingDocuments(userId: string | null) {
  return useQuery({
    queryKey: ['pending-documents', userId],
    queryFn: async () => {
      if (!userId) return [];

      const token = api.getToken();
      if (!token) throw new Error('Not authenticated');

      const response = await fetch(
        `${API_BASE}/api/v1/users/${userId}/pending-documents`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (!response.ok) {
        const error = await response.json().catch(() => ({ detail: 'Failed to fetch pending documents' }));
        throw new Error(error.detail);
      }

      const result = await response.json();
      return (result.documents || result || []) as PendingDocument[];
    },
    enabled: !!userId,
  });
}

// =============================================================================
// Document History Query
// =============================================================================

/**
 * Fetch signed document history for the current user
 */
export function useDocumentHistory() {
  return useQuery({
    queryKey: ['document-history', 'me'],
    queryFn: async () => {
      const token = api.getToken();
      if (!token) throw new Error('Not authenticated');

      const response = await fetch(
        `${API_BASE}/api/v1/users/me/clearances/history`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (!response.ok) {
        const error = await response.json().catch(() => ({ detail: 'Failed to fetch document history' }));
        throw new Error(error.detail);
      }

      const result = await response.json();
      return (result.documents || result || []) as SignedDocumentHistory[];
    },
  });
}

// =============================================================================
// Batch Sign Mutation
// =============================================================================

/**
 * Sign multiple documents at once with a single signature
 */
export function useBatchSign() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: BatchSignInput) => {
      const token = api.getToken();
      if (!token) throw new Error('Not authenticated');

      const response = await fetch(
        `${API_BASE}/api/v1/clearances/batch-sign`,
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
        const error = await response.json().catch(() => ({ detail: 'Failed to batch sign documents' }));
        throw new Error(error.detail);
      }

      return (await response.json()) as BatchSignResult;
    },
    onSuccess: () => {
      // Invalidate all related queries
      queryClient.invalidateQueries({ queryKey: ['pending-documents'] });
      queryClient.invalidateQueries({ queryKey: ['document-history'] });
      queryClient.invalidateQueries({ queryKey: ['backlot-clearances'] });
      queryClient.invalidateQueries({ queryKey: ['package-assignments'] });
      queryClient.invalidateQueries({ queryKey: ['crew-document-summary'] });
    },
  });
}

// =============================================================================
// Document Access (for external signing links)
// =============================================================================

/**
 * Access a document via token (for external signing)
 */
export function useDocumentByToken(accessToken: string | null) {
  return useQuery({
    queryKey: ['document-access', accessToken],
    queryFn: async () => {
      if (!accessToken) return null;

      const response = await fetch(
        `${API_BASE}/api/v1/clearances/access/${accessToken}`,
        {
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );

      if (!response.ok) {
        const error = await response.json().catch(() => ({ detail: 'Invalid or expired access link' }));
        throw new Error(error.detail);
      }

      return await response.json();
    },
    enabled: !!accessToken,
  });
}

/**
 * Sign a document via token (for external signing)
 */
export function useSignByToken() {
  return useMutation({
    mutationFn: async ({
      accessToken,
      signatureData,
      signedByName,
    }: {
      accessToken: string;
      signatureData: string;
      signedByName: string;
    }) => {
      const response = await fetch(
        `${API_BASE}/api/v1/clearances/access/${accessToken}/sign`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            signature_data: signatureData,
            signed_by_name: signedByName,
          }),
        }
      );

      if (!response.ok) {
        const error = await response.json().catch(() => ({ detail: 'Failed to sign document' }));
        throw new Error(error.detail);
      }

      return await response.json();
    },
  });
}
