/**
 * Deal Memo PDF & Signing Hooks
 * Handles PDF generation, sending, and signing workflows
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/context/AuthContext';

const API_BASE = import.meta.env.VITE_API_URL || '';

// =============================================================================
// PDF Generation
// =============================================================================

/**
 * Generate a PDF for a deal memo
 */
export function useGenerateDealMemoPDF() {
  const { session } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (dealMemoId: string) => {
      const response = await fetch(
        `${API_BASE}/api/v1/backlot/deal-memos/${dealMemoId}/generate-pdf`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${session?.access_token}`,
          },
        }
      );
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'Failed to generate PDF');
      }
      return response.json();
    },
    onSuccess: (_, dealMemoId) => {
      queryClient.invalidateQueries({ queryKey: ['backlot-deal-memo', dealMemoId] });
    },
  });
}

/**
 * Get a presigned URL for a deal memo PDF
 */
export function useDealMemoPDFUrl(dealMemoId: string | undefined, hasPdf: boolean) {
  const { session } = useAuth();

  return useQuery({
    queryKey: ['deal-memo-pdf-url', dealMemoId],
    queryFn: async () => {
      const response = await fetch(
        `${API_BASE}/api/v1/backlot/deal-memos/${dealMemoId}/encrypted-document`,
        {
          headers: {
            Authorization: `Bearer ${session?.access_token}`,
          },
        }
      );
      if (!response.ok) return null;
      const result = await response.json();
      return result.pdf_url as string | null;
    },
    enabled: !!dealMemoId && !!session?.access_token && hasPdf,
    staleTime: 30 * 60 * 1000, // 30 minutes (presigned URLs last 1 hour)
  });
}

// =============================================================================
// Send Deal Memo
// =============================================================================

interface SendDealMemoInput {
  dealMemoId: string;
  signerEmail?: string;
  signerName?: string;
  message?: string;
}

/**
 * Send a deal memo for in-app signature
 */
export function useSendDealMemo() {
  const { session } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ dealMemoId, ...input }: SendDealMemoInput) => {
      const response = await fetch(
        `${API_BASE}/api/v1/backlot/deal-memos/${dealMemoId}/send`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session?.access_token}`,
          },
          body: JSON.stringify(input),
        }
      );
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'Failed to send deal memo');
      }
      return response.json();
    },
    onSuccess: (_, { dealMemoId }) => {
      queryClient.invalidateQueries({ queryKey: ['backlot-deal-memo', dealMemoId] });
      queryClient.invalidateQueries({ queryKey: ['backlot-deal-memos'] });
    },
  });
}

// =============================================================================
// Signing Portal (Public - Token Based)
// =============================================================================

/**
 * Fetch deal memo data for signing portal (public, no auth)
 */
export function useDealMemoSigningData(token: string | undefined) {
  return useQuery({
    queryKey: ['deal-memo-signing', token],
    queryFn: async () => {
      const response = await fetch(
        `${API_BASE}/api/v1/backlot/deal-memos/sign/${token}`
      );
      if (!response.ok) {
        const error = await response.json().catch(() => ({ detail: 'Failed to load' }));
        throw new Error(error.detail || 'Failed to load signing data');
      }
      return response.json();
    },
    enabled: !!token,
    retry: false,
  });
}

interface SignDealMemoInput {
  token: string;
  signatureData: string;
  signatureType: 'draw' | 'type' | 'saved';
  signerName?: string;
}

/**
 * Sign a deal memo via token (public, no auth)
 */
export function useSignDealMemo() {
  return useMutation({
    mutationFn: async ({ token, signatureData, signatureType, signerName }: SignDealMemoInput) => {
      const response = await fetch(
        `${API_BASE}/api/v1/backlot/deal-memos/sign/${token}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            signature_data: signatureData,
            signature_type: signatureType,
            signer_name: signerName,
          }),
        }
      );
      if (!response.ok) {
        const error = await response.json().catch(() => ({ detail: 'Failed to sign' }));
        throw new Error(error.detail || 'Failed to sign deal memo');
      }
      return response.json();
    },
  });
}

// =============================================================================
// Deal Memo Templates
// =============================================================================

export function useDealMemoTemplates(templateType?: string) {
  const { session } = useAuth();

  return useQuery({
    queryKey: ['deal-memo-templates', templateType],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (templateType) params.append('template_type', templateType);

      const response = await fetch(
        `${API_BASE}/api/v1/backlot/deal-memo-templates?${params}`,
        {
          headers: {
            Authorization: `Bearer ${session?.access_token}`,
          },
        }
      );
      if (!response.ok) throw new Error('Failed to fetch templates');
      const result = await response.json();
      return result.templates as Array<{
        id: string;
        name: string;
        template_type: string;
        is_system_template: boolean;
        field_schema: Record<string, unknown>;
      }>;
    },
    enabled: !!session?.access_token,
  });
}

// =============================================================================
// E2EE Encrypted Fields
// =============================================================================

export function useEncryptDealMemoFields() {
  const { session } = useAuth();

  return useMutation({
    mutationFn: async ({
      dealMemoId,
      fields,
    }: {
      dealMemoId: string;
      fields: Record<string, { encrypted_value: string; nonce: string }>;
    }) => {
      const response = await fetch(
        `${API_BASE}/api/v1/backlot/deal-memos/${dealMemoId}/encrypt-fields`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session?.access_token}`,
          },
          body: JSON.stringify(fields),
        }
      );
      if (!response.ok) throw new Error('Failed to encrypt fields');
      return response.json();
    },
  });
}
