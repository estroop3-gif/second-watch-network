/**
 * Onboarding Wizard Hooks
 * Handles onboarding sessions, steps, and progress
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/context/AuthContext';

const API_BASE = import.meta.env.VITE_API_URL || '';

// =============================================================================
// Types
// =============================================================================

export interface OnboardingSession {
  id: string;
  project_id: string;
  user_id: string | null;
  access_token: string | null;
  package_id: string | null;
  deal_memo_id: string | null;
  current_step: number;
  total_steps: number;
  status: 'in_progress' | 'completed' | 'abandoned';
  completed_at: string | null;
  created_at: string;
  updated_at: string;
  steps?: OnboardingStep[];
  progress_percentage?: number;
  user_name?: string;
}

export interface OnboardingStep {
  id: string;
  session_id: string;
  step_number: number;
  step_type: 'deal_memo_review' | 'document_sign' | 'form_fill';
  reference_type: 'deal_memo' | 'clearance' | null;
  reference_id: string | null;
  form_fields: FormFieldSchema[];
  form_data: Record<string, unknown>;
  status: 'pending' | 'in_progress' | 'completed' | 'skipped';
  completed_at: string | null;
  // Enriched
  document_title?: string;
  document_url?: string;
}

export interface FormFieldSchema {
  name: string;
  label: string;
  type: 'text' | 'email' | 'phone' | 'date' | 'address' | 'ssn' | 'textarea';
  required: boolean;
  placeholder?: string;
  save_to_profile?: boolean;
}

// =============================================================================
// Session Hooks
// =============================================================================

export function useOnboardingSession(sessionId: string | undefined) {
  const { session } = useAuth();

  return useQuery({
    queryKey: ['onboarding-session', sessionId],
    queryFn: async () => {
      const response = await fetch(
        `${API_BASE}/api/v1/onboarding/sessions/${sessionId}`,
        {
          headers: { Authorization: `Bearer ${session?.access_token}` },
        }
      );
      if (!response.ok) throw new Error('Failed to fetch onboarding session');
      const result = await response.json();
      return result.session as OnboardingSession;
    },
    enabled: !!sessionId && !!session?.access_token,
  });
}

export function useOnboardingSessionByToken(token: string | undefined) {
  return useQuery({
    queryKey: ['onboarding-session-token', token],
    queryFn: async () => {
      const response = await fetch(
        `${API_BASE}/api/v1/onboarding/sessions/by-token/${token}`
      );
      if (!response.ok) throw new Error('Failed to fetch onboarding session');
      const result = await response.json();
      return result.session as OnboardingSession;
    },
    enabled: !!token,
    retry: false,
  });
}

// =============================================================================
// Start Onboarding
// =============================================================================

interface StartOnboardingInput {
  projectId: string;
  userId: string;
  packageId?: string;
  dealMemoId?: string;
}

export function useStartOnboarding() {
  const { session } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ projectId, userId, packageId, dealMemoId }: StartOnboardingInput) => {
      const response = await fetch(
        `${API_BASE}/api/v1/onboarding/projects/${projectId}/onboarding/${userId}/start`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session?.access_token}`,
          },
          body: JSON.stringify({
            package_id: packageId,
            deal_memo_id: dealMemoId,
          }),
        }
      );
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'Failed to start onboarding');
      }
      return response.json();
    },
    onSuccess: (_, { projectId }) => {
      queryClient.invalidateQueries({ queryKey: ['onboarding-summary', projectId] });
    },
  });
}

// =============================================================================
// Step Operations
// =============================================================================

interface CompleteStepInput {
  sessionId: string;
  stepNumber: number;
  formData?: Record<string, unknown>;
  signatureData?: string;
}

export function useCompleteStep() {
  const { session } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ sessionId, stepNumber, formData, signatureData }: CompleteStepInput) => {
      const response = await fetch(
        `${API_BASE}/api/v1/onboarding/sessions/${sessionId}/step/${stepNumber}/complete`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session?.access_token}`,
          },
          body: JSON.stringify({
            form_data: formData,
            signature_data: signatureData,
          }),
        }
      );
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'Failed to complete step');
      }
      return response.json();
    },
    onSuccess: (_, { sessionId }) => {
      queryClient.invalidateQueries({ queryKey: ['onboarding-session', sessionId] });
    },
  });
}

export function useSaveStepProgress() {
  const { session } = useAuth();

  return useMutation({
    mutationFn: async ({ sessionId, stepNumber, formData }: { sessionId: string; stepNumber: number; formData: Record<string, unknown> }) => {
      const response = await fetch(
        `${API_BASE}/api/v1/onboarding/sessions/${sessionId}/step/${stepNumber}/save-progress`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session?.access_token}`,
          },
          body: JSON.stringify({ form_data: formData }),
        }
      );
      if (!response.ok) throw new Error('Failed to save progress');
      return response.json();
    },
  });
}

// =============================================================================
// Complete Session
// =============================================================================

export function useCompleteOnboarding() {
  const { session } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (sessionId: string) => {
      const response = await fetch(
        `${API_BASE}/api/v1/onboarding/sessions/${sessionId}/complete`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${session?.access_token}`,
          },
        }
      );
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'Failed to complete onboarding');
      }
      return response.json();
    },
    onSuccess: (_, sessionId) => {
      queryClient.invalidateQueries({ queryKey: ['onboarding-session', sessionId] });
    },
  });
}

// =============================================================================
// Project Summary
// =============================================================================

export function useOnboardingSummary(projectId: string | undefined) {
  const { session } = useAuth();

  return useQuery({
    queryKey: ['onboarding-summary', projectId],
    queryFn: async () => {
      const response = await fetch(
        `${API_BASE}/api/v1/onboarding/projects/${projectId}/onboarding-summary`,
        {
          headers: { Authorization: `Bearer ${session?.access_token}` },
        }
      );
      if (!response.ok) throw new Error('Failed to fetch onboarding summary');
      const result = await response.json();
      return result.sessions as OnboardingSession[];
    },
    enabled: !!projectId && !!session?.access_token,
  });
}

// =============================================================================
// Save to Profile
// =============================================================================

export function useSaveToProfile() {
  const { session } = useAuth();

  return useMutation({
    mutationFn: async ({ sessionId, stepNumber, fields }: { sessionId: string; stepNumber: number; fields: Record<string, unknown> }) => {
      const response = await fetch(
        `${API_BASE}/api/v1/onboarding/sessions/${sessionId}/step/${stepNumber}/save-to-profile`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session?.access_token}`,
          },
          body: JSON.stringify({ fields }),
        }
      );
      if (!response.ok) throw new Error('Failed to save to profile');
      return response.json();
    },
  });
}
