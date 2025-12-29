/**
 * useCrewDocuments - Hook for crew document summary and checklist tracking
 * Used in Cast/Crew tab for onboarding progress tracking
 */
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import {
  CrewDocumentSummary,
  PersonDocumentChecklist,
} from '@/types/backlot';

const API_BASE = import.meta.env.VITE_API_URL || '';

// =============================================================================
// Crew Document Summary Query
// =============================================================================

/**
 * Fetch document completion summary for all crew in a project
 * Returns aggregated stats for each person
 */
export function useCrewDocumentSummary(projectId: string | null) {
  return useQuery({
    queryKey: ['crew-document-summary', projectId],
    queryFn: async () => {
      if (!projectId) return [];

      const token = api.getToken();
      if (!token) throw new Error('Not authenticated');

      const response = await fetch(
        `${API_BASE}/api/v1/backlot/projects/${projectId}/crew-document-summary`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (!response.ok) {
        const error = await response.json().catch(() => ({ detail: 'Failed to fetch crew document summary' }));
        throw new Error(error.detail);
      }

      const result = await response.json();
      return (result.crew || result || []) as CrewDocumentSummary[];
    },
    enabled: !!projectId,
  });
}

// =============================================================================
// Person Document Checklist Query
// =============================================================================

/**
 * Fetch detailed document checklist for a specific person
 * Shows each required document and its status
 */
export function usePersonDocumentChecklist(
  projectId: string | null,
  personId: string | null
) {
  return useQuery({
    queryKey: ['person-document-checklist', projectId, personId],
    queryFn: async () => {
      if (!projectId || !personId) return null;

      const token = api.getToken();
      if (!token) throw new Error('Not authenticated');

      const response = await fetch(
        `${API_BASE}/api/v1/backlot/projects/${projectId}/person-checklist/${personId}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (!response.ok) {
        const error = await response.json().catch(() => ({ detail: 'Failed to fetch person checklist' }));
        throw new Error(error.detail);
      }

      const result = await response.json();
      return (result.checklist || result) as PersonDocumentChecklist;
    },
    enabled: !!projectId && !!personId,
  });
}

// =============================================================================
// Completion Status Helpers
// =============================================================================

export type CompletionStatus = 'complete' | 'in_progress' | 'missing' | 'not_started';

export function getCompletionStatus(summary: CrewDocumentSummary): CompletionStatus {
  const { documents } = summary;

  if (documents.required === 0) return 'complete';
  if (documents.signed >= documents.required) return 'complete';
  if (documents.signed > 0 || documents.pending > 0) return 'in_progress';
  if (documents.missing > 0) return 'missing';
  return 'not_started';
}

export const COMPLETION_STATUS_CONFIG: Record<
  CompletionStatus,
  { label: string; color: string; bgColor: string; icon: 'check' | 'clock' | 'alert' | 'circle' }
> = {
  complete: {
    label: 'Complete',
    color: 'text-green-400',
    bgColor: 'bg-green-500/20',
    icon: 'check',
  },
  in_progress: {
    label: 'In Progress',
    color: 'text-yellow-400',
    bgColor: 'bg-yellow-500/20',
    icon: 'clock',
  },
  missing: {
    label: 'Missing Documents',
    color: 'text-red-400',
    bgColor: 'bg-red-500/20',
    icon: 'alert',
  },
  not_started: {
    label: 'Not Started',
    color: 'text-muted-foreground',
    bgColor: 'bg-muted-gray/20',
    icon: 'circle',
  },
};

export function getCompletionStatusConfig(status: CompletionStatus) {
  return COMPLETION_STATUS_CONFIG[status];
}

/**
 * Calculate progress bar color based on percentage
 */
export function getProgressColor(percentage: number): string {
  if (percentage >= 100) return 'bg-green-500';
  if (percentage >= 75) return 'bg-lime-500';
  if (percentage >= 50) return 'bg-yellow-500';
  if (percentage >= 25) return 'bg-orange-500';
  return 'bg-red-500';
}

/**
 * Format completion percentage for display
 */
export function formatCompletionPercentage(percentage: number): string {
  return `${Math.round(percentage)}%`;
}

/**
 * Get summary stats from crew document summaries
 */
export function getCrewSummaryStats(summaries: CrewDocumentSummary[]) {
  const total = summaries.length;
  const complete = summaries.filter(s => getCompletionStatus(s) === 'complete').length;
  const inProgress = summaries.filter(s => getCompletionStatus(s) === 'in_progress').length;
  const missing = summaries.filter(s =>
    getCompletionStatus(s) === 'missing' || getCompletionStatus(s) === 'not_started'
  ).length;

  const overallPercentage = total > 0
    ? Math.round(summaries.reduce((sum, s) => sum + s.completion_percentage, 0) / total)
    : 0;

  return {
    total,
    complete,
    inProgress,
    missing,
    overallPercentage,
  };
}
