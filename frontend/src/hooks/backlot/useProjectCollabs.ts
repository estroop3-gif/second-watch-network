/**
 * useProjectCollabs - Hook for managing collabs linked to a Backlot project
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { CommunityCollab } from '@/types/community';
import { ApplicationBookingInput } from '@/types/applications';

/**
 * Fetch all collabs linked to a specific Backlot project
 */
export function useProjectCollabs(projectId: string | undefined) {
  return useQuery({
    queryKey: ['project-collabs', projectId],
    queryFn: () => api.getProjectCollabs(projectId!),
    enabled: !!projectId,
  });
}

/**
 * Fetch applications for a specific collab
 */
export function useCollabApplications(collabId: string | undefined) {
  return useQuery({
    queryKey: ['collab-applications', collabId],
    queryFn: () => api.getCollabApplications(collabId!),
    enabled: !!collabId,
  });
}

/**
 * Mutations for managing project collabs
 */
export function useProjectCollabMutations(projectId: string) {
  const queryClient = useQueryClient();

  const invalidateCollabs = () => {
    queryClient.invalidateQueries({ queryKey: ['project-collabs', projectId] });
    queryClient.invalidateQueries({ queryKey: ['collabs'] });
  };

  const updateCollab = useMutation({
    mutationFn: ({ collabId, data }: { collabId: string; data: Partial<CommunityCollab> }) =>
      api.updateCollab(collabId, data),
    onSuccess: invalidateCollabs,
  });

  const deleteCollab = useMutation({
    mutationFn: (collabId: string) => api.deleteCollab(collabId),
    onSuccess: invalidateCollabs,
  });

  const deactivateCollab = useMutation({
    mutationFn: (collabId: string) => api.deactivateCollab(collabId),
    onSuccess: invalidateCollabs,
  });

  return {
    updateCollab,
    deleteCollab,
    deactivateCollab,
  };
}

/**
 * Update collab application status
 */
export function useUpdateCollabApplicationStatus(collabId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      applicationId,
      status,
      internalNotes,
      rating,
    }: {
      applicationId: string;
      status: string;
      internalNotes?: string;
      rating?: number;
    }) => api.updateCollabApplicationStatus(applicationId, status, internalNotes, rating),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['collab-applications', collabId] });
    },
  });
}

/**
 * Book an applicant
 */
export function useBookApplicant(collabId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      applicationId,
      booking,
    }: {
      applicationId: string;
      booking: ApplicationBookingInput;
    }) => api.bookApplicant(applicationId, booking),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['collab-applications', collabId] });
    },
  });
}

/**
 * Unbook an applicant
 */
export function useUnbookApplicant(collabId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      applicationId,
      reason,
    }: {
      applicationId: string;
      reason: string;
    }) => api.unbookApplicant(applicationId, reason),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['collab-applications', collabId] });
    },
  });
}
