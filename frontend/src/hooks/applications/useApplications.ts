/**
 * Application Hooks
 * Hooks for application templates, collab applications, and role applications
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/context/AuthContext';
import type {
  ApplicationTemplate,
  ApplicationTemplateInput,
  CollabApplication,
  UnifiedApplicationInput,
  ApplicationStatusUpdate,
  SelectableCredit,
  ApplicationStatus,
} from '@/types/applications';

const API_BASE = import.meta.env.VITE_API_URL || '';

// =============================================================================
// APPLICATION TEMPLATES HOOKS
// =============================================================================

/**
 * Get all application templates for current user
 */
export function useApplicationTemplates() {
  const { session } = useAuth();

  return useQuery({
    queryKey: ['application-templates'],
    queryFn: async () => {
      const response = await fetch(`${API_BASE}/api/v1/application-templates`, {
        headers: {
          Authorization: `Bearer ${session?.access_token}`,
        },
      });
      if (!response.ok) throw new Error('Failed to fetch templates');
      return response.json() as Promise<ApplicationTemplate[]>;
    },
    enabled: !!session?.access_token,
  });
}

/**
 * Get a single application template
 */
export function useApplicationTemplate(templateId: string | undefined) {
  const { session } = useAuth();

  return useQuery({
    queryKey: ['application-template', templateId],
    queryFn: async () => {
      const response = await fetch(
        `${API_BASE}/api/v1/application-templates/${templateId}`,
        {
          headers: {
            Authorization: `Bearer ${session?.access_token}`,
          },
        }
      );
      if (!response.ok) throw new Error('Failed to fetch template');
      return response.json() as Promise<ApplicationTemplate>;
    },
    enabled: !!templateId && !!session?.access_token,
  });
}

/**
 * Application template mutations (create, update, delete)
 */
export function useApplicationTemplateMutations() {
  const { session } = useAuth();
  const queryClient = useQueryClient();

  const createTemplate = useMutation({
    mutationFn: async (input: ApplicationTemplateInput) => {
      const response = await fetch(`${API_BASE}/api/v1/application-templates`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify(input),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'Failed to create template');
      }
      return response.json() as Promise<ApplicationTemplate>;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['application-templates'] });
    },
  });

  const updateTemplate = useMutation({
    mutationFn: async ({
      templateId,
      input,
    }: {
      templateId: string;
      input: Partial<ApplicationTemplateInput>;
    }) => {
      const response = await fetch(
        `${API_BASE}/api/v1/application-templates/${templateId}`,
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session?.access_token}`,
          },
          body: JSON.stringify(input),
        }
      );
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'Failed to update template');
      }
      return response.json() as Promise<ApplicationTemplate>;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['application-templates'] });
      queryClient.invalidateQueries({
        queryKey: ['application-template', variables.templateId],
      });
    },
  });

  const deleteTemplate = useMutation({
    mutationFn: async (templateId: string) => {
      const response = await fetch(
        `${API_BASE}/api/v1/application-templates/${templateId}`,
        {
          method: 'DELETE',
          headers: {
            Authorization: `Bearer ${session?.access_token}`,
          },
        }
      );
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'Failed to delete template');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['application-templates'] });
    },
  });

  const setDefaultTemplate = useMutation({
    mutationFn: async (templateId: string) => {
      const response = await fetch(
        `${API_BASE}/api/v1/application-templates/${templateId}/set-default`,
        {
          method: 'PATCH',
          headers: {
            Authorization: `Bearer ${session?.access_token}`,
          },
        }
      );
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'Failed to set default template');
      }
      return response.json() as Promise<ApplicationTemplate>;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['application-templates'] });
    },
  });

  return { createTemplate, updateTemplate, deleteTemplate, setDefaultTemplate };
}

// =============================================================================
// COLLAB APPLICATIONS HOOKS
// =============================================================================

/**
 * Apply to a community collab
 */
export function useApplyToCollab() {
  const { session } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      collabId,
      input,
    }: {
      collabId: string;
      input: UnifiedApplicationInput;
    }) => {
      const response = await fetch(
        `${API_BASE}/api/v1/community/collabs/${collabId}/apply`,
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
        throw new Error(error.detail || 'Failed to submit application');
      }
      return response.json() as Promise<CollabApplication>;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['community-collabs'] });
      queryClient.invalidateQueries({ queryKey: ['community-collab', variables.collabId] });
      queryClient.invalidateQueries({ queryKey: ['my-collab-applications'] });
      queryClient.invalidateQueries({ queryKey: ['application-templates'] });
    },
  });
}

/**
 * Get applications for a collab (owner only)
 */
export function useCollabApplications(
  collabId: string | undefined,
  status?: ApplicationStatus
) {
  const { session } = useAuth();

  return useQuery({
    queryKey: ['collab-applications', collabId, status],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (status) params.append('status', status);

      const response = await fetch(
        `${API_BASE}/api/v1/community/collabs/${collabId}/applications?${params}`,
        {
          headers: {
            Authorization: `Bearer ${session?.access_token}`,
          },
        }
      );
      if (!response.ok) throw new Error('Failed to fetch applications');
      return response.json() as Promise<CollabApplication[]>;
    },
    enabled: !!collabId && !!session?.access_token,
  });
}

/**
 * Get current user's collab applications
 */
export function useMyCollabApplications(status?: ApplicationStatus) {
  const { session } = useAuth();

  return useQuery({
    queryKey: ['my-collab-applications', status],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (status) params.append('status', status);

      const response = await fetch(
        `${API_BASE}/api/v1/community/my-collab-applications?${params}`,
        {
          headers: {
            Authorization: `Bearer ${session?.access_token}`,
          },
        }
      );
      if (!response.ok) throw new Error('Failed to fetch my applications');
      return response.json() as Promise<CollabApplication[]>;
    },
    enabled: !!session?.access_token,
  });
}

/**
 * Get a single collab application
 */
export function useCollabApplication(applicationId: string | undefined) {
  const { session } = useAuth();

  return useQuery({
    queryKey: ['collab-application', applicationId],
    queryFn: async () => {
      const response = await fetch(
        `${API_BASE}/api/v1/community/collab-applications/${applicationId}`,
        {
          headers: {
            Authorization: `Bearer ${session?.access_token}`,
          },
        }
      );
      if (!response.ok) throw new Error('Failed to fetch application');
      return response.json() as Promise<CollabApplication>;
    },
    enabled: !!applicationId && !!session?.access_token,
  });
}

/**
 * Update collab application status (owner only)
 */
export function useUpdateCollabApplicationStatus() {
  const { session } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      applicationId,
      input,
    }: {
      applicationId: string;
      input: ApplicationStatusUpdate;
    }) => {
      const response = await fetch(
        `${API_BASE}/api/v1/community/collab-applications/${applicationId}/status`,
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session?.access_token}`,
          },
          body: JSON.stringify(input),
        }
      );
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'Failed to update application');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['collab-applications'] });
      queryClient.invalidateQueries({ queryKey: ['collab-application'] });
      queryClient.invalidateQueries({ queryKey: ['my-collab-applications'] });
    },
  });
}

/**
 * Promote a collab application
 */
export function usePromoteCollabApplication() {
  const { session } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (applicationId: string) => {
      const response = await fetch(
        `${API_BASE}/api/v1/community/collab-applications/${applicationId}/promote`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${session?.access_token}`,
          },
        }
      );
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'Failed to promote application');
      }
      return response.json() as Promise<{
        success: boolean;
        is_free: boolean;
        message: string;
        application: CollabApplication | null;
      }>;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['collab-applications'] });
      queryClient.invalidateQueries({ queryKey: ['my-collab-applications'] });
    },
  });
}

/**
 * Withdraw a collab application
 */
export function useWithdrawCollabApplication() {
  const { session } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (applicationId: string) => {
      const response = await fetch(
        `${API_BASE}/api/v1/community/collab-applications/${applicationId}`,
        {
          method: 'DELETE',
          headers: {
            Authorization: `Bearer ${session?.access_token}`,
          },
        }
      );
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'Failed to withdraw application');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['community-collabs'] });
      queryClient.invalidateQueries({ queryKey: ['my-collab-applications'] });
    },
  });
}

// =============================================================================
// ROLE APPLICATION PROMOTION HOOK
// =============================================================================

/**
 * Promote a role application
 */
export function usePromoteRoleApplication() {
  const { session } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (applicationId: string) => {
      const response = await fetch(
        `${API_BASE}/api/v1/backlot/applications/${applicationId}/promote`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${session?.access_token}`,
          },
        }
      );
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'Failed to promote application');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['backlot-role-applications'] });
      queryClient.invalidateQueries({ queryKey: ['backlot-my-applications'] });
    },
  });
}

// =============================================================================
// SELECTABLE CREDITS HOOK
// =============================================================================

/**
 * Get user's credits for selection in applications
 */
export function useSelectableCredits() {
  const { session } = useAuth();

  return useQuery({
    queryKey: ['selectable-credits'],
    queryFn: async () => {
      const response = await fetch(`${API_BASE}/api/v1/credits/my-credits`, {
        headers: {
          Authorization: `Bearer ${session?.access_token}`,
        },
      });
      if (!response.ok) throw new Error('Failed to fetch credits');
      const data = await response.json();
      // Map to selectable format
      return (data.credits || data || []).map((credit: SelectableCredit) => ({
        id: credit.id,
        project_title: credit.project_title,
        role: credit.role,
        role_type: credit.role_type,
        year: credit.year,
        department: credit.department,
      })) as SelectableCredit[];
    },
    enabled: !!session?.access_token,
  });
}

// =============================================================================
// COVER LETTER TEMPLATES HOOKS
// =============================================================================

import type { CoverLetterTemplate, CoverLetterTemplateInput, UserResume } from '@/types/applications';

/**
 * Get all cover letter templates for current user
 */
export function useCoverLetterTemplates() {
  const { session } = useAuth();

  return useQuery({
    queryKey: ['cover-letter-templates'],
    queryFn: async () => {
      const response = await fetch(`${API_BASE}/api/v1/cover-letter-templates`, {
        headers: {
          Authorization: `Bearer ${session?.access_token}`,
        },
      });
      if (!response.ok) throw new Error('Failed to fetch cover letter templates');
      return response.json() as Promise<CoverLetterTemplate[]>;
    },
    enabled: !!session?.access_token,
  });
}

/**
 * Cover letter template mutations
 */
export function useCoverLetterTemplateMutations() {
  const { session } = useAuth();
  const queryClient = useQueryClient();

  const createTemplate = useMutation({
    mutationFn: async (input: CoverLetterTemplateInput) => {
      const response = await fetch(`${API_BASE}/api/v1/cover-letter-templates`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify(input),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'Failed to create template');
      }
      return response.json() as Promise<CoverLetterTemplate>;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cover-letter-templates'] });
    },
  });

  const deleteTemplate = useMutation({
    mutationFn: async (templateId: string) => {
      const response = await fetch(
        `${API_BASE}/api/v1/cover-letter-templates/${templateId}`,
        {
          method: 'DELETE',
          headers: {
            Authorization: `Bearer ${session?.access_token}`,
          },
        }
      );
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'Failed to delete template');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cover-letter-templates'] });
    },
  });

  return { createTemplate, deleteTemplate };
}

// =============================================================================
// USER RESUMES HOOKS
// =============================================================================

/**
 * Get all resumes for current user
 */
export function useUserResumes() {
  const { session } = useAuth();

  return useQuery({
    queryKey: ['user-resumes'],
    queryFn: async () => {
      const response = await fetch(`${API_BASE}/api/v1/resumes`, {
        headers: {
          Authorization: `Bearer ${session?.access_token}`,
        },
      });
      if (!response.ok) throw new Error('Failed to fetch resumes');
      return response.json() as Promise<UserResume[]>;
    },
    enabled: !!session?.access_token,
  });
}

/**
 * Upload a new resume
 */
export function useUploadResume() {
  const { session } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      file,
      name,
      isDefault = false,
    }: {
      file: File;
      name?: string;
      isDefault?: boolean;
    }) => {
      const formData = new FormData();
      formData.append('file', file);
      if (name) formData.append('name', name);
      formData.append('is_default', String(isDefault));

      const response = await fetch(`${API_BASE}/api/v1/resumes`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session?.access_token}`,
        },
        body: formData,
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'Failed to upload resume');
      }
      return response.json() as Promise<UserResume>;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-resumes'] });
    },
  });
}

/**
 * Delete a resume
 */
export function useDeleteResume() {
  const { session } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (resumeId: string) => {
      const response = await fetch(`${API_BASE}/api/v1/resumes/${resumeId}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${session?.access_token}`,
        },
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'Failed to delete resume');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-resumes'] });
    },
  });
}

/**
 * Set a resume as default
 */
export function useSetDefaultResume() {
  const { session } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (resumeId: string) => {
      const response = await fetch(
        `${API_BASE}/api/v1/resumes/${resumeId}/set-default`,
        {
          method: 'PATCH',
          headers: {
            Authorization: `Bearer ${session?.access_token}`,
          },
        }
      );
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'Failed to set default resume');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-resumes'] });
    },
  });
}

// =============================================================================
// UNIFIED APPLICATION HOOKS
// =============================================================================

import type {
  UnifiedApplication,
  ApplicationReceivedItem,
  ApplicationGroup,
  RoleApplication,
} from '@/types/applications';

/**
 * Get all of current user's applications (both backlot and community)
 * Returns a unified normalized list sorted by date
 */
export function useUnifiedMyApplications(status?: ApplicationStatus) {
  const { session } = useAuth();

  return useQuery({
    queryKey: ['unified-my-applications', status],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (status) params.append('status', status);

      // Fetch both sources in parallel
      const [backlotRes, communityRes] = await Promise.all([
        fetch(`${API_BASE}/api/v1/backlot/my-applications?${params}`, {
          headers: { Authorization: `Bearer ${session?.access_token}` },
        }),
        fetch(`${API_BASE}/api/v1/community/my-collab-applications?${params}`, {
          headers: { Authorization: `Bearer ${session?.access_token}` },
        }),
      ]);

      const backlotData = backlotRes.ok ? await backlotRes.json() : { applications: [] };
      const communityData = communityRes.ok ? await communityRes.json() : [];

      // Normalize backlot applications
      const backlotApps: UnifiedApplication[] = (backlotData.applications || []).map(
        (app: RoleApplication) => ({
          id: app.id,
          source: 'backlot' as const,
          title: app.backlot_project_roles?.title || 'Unknown Role',
          project_name: app.backlot_project_roles?.backlot_projects?.title,
          project_id: app.backlot_project_roles?.project_id,
          status: app.status,
          applied_at: app.created_at,
          status_changed_at: app.status_changed_at || undefined,
          elevator_pitch: app.elevator_pitch || undefined,
          cover_note: app.cover_note || undefined,
          is_promoted: app.is_promoted,
          original: app,
        })
      );

      // Normalize community applications
      const communityApps: UnifiedApplication[] = (communityData || []).map(
        (app: CollabApplication) => ({
          id: app.id,
          source: 'community' as const,
          title: app.collab?.title || 'Unknown Collab',
          location: app.collab?.location,
          is_remote: app.collab?.is_remote,
          status: app.status,
          applied_at: app.created_at,
          status_changed_at: app.status_changed_at || undefined,
          elevator_pitch: app.elevator_pitch || undefined,
          cover_note: app.cover_note || undefined,
          is_promoted: app.is_promoted,
          original: app,
        })
      );

      // Combine and sort by date (newest first)
      const all = [...backlotApps, ...communityApps].sort(
        (a, b) => new Date(b.applied_at).getTime() - new Date(a.applied_at).getTime()
      );

      return all;
    },
    enabled: !!session?.access_token,
  });
}

/**
 * Get all applications received for current user's posts (both backlot and community)
 * Returns normalized list grouped by source and project/collab
 */
export function useUnifiedApplicationsReceived(status?: ApplicationStatus) {
  const { session } = useAuth();

  return useQuery({
    queryKey: ['unified-applications-received', status],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (status) params.append('status', status);

      // Fetch both sources in parallel
      const [backlotRes, communityRes] = await Promise.all([
        fetch(`${API_BASE}/api/v1/backlot/applications-received?${params}`, {
          headers: { Authorization: `Bearer ${session?.access_token}` },
        }),
        fetch(`${API_BASE}/api/v1/community/collab-applications-received?${params}`, {
          headers: { Authorization: `Bearer ${session?.access_token}` },
        }),
      ]);

      const backlotData = backlotRes.ok ? await backlotRes.json() : { applications: [], by_project: {} };
      const communityData = communityRes.ok ? await communityRes.json() : { applications: [], by_collab: {} };

      // Normalize backlot applications
      const backlotApps: ApplicationReceivedItem[] = (backlotData.applications || []).map(
        (app: RoleApplication) => ({
          id: app.id,
          source: 'backlot' as const,
          title: app.backlot_project_roles?.title || 'Unknown Role',
          project_name: app.backlot_project_roles?.backlot_projects?.title,
          applicant: {
            id: app.applicant_user_id,
            username: app.applicant_profile_snapshot?.username || 'Unknown',
            full_name: app.applicant_profile_snapshot?.full_name,
            display_name: app.applicant_profile_snapshot?.display_name,
            avatar_url: app.applicant_profile_snapshot?.avatar_url,
          },
          status: app.status,
          applied_at: app.created_at,
          is_promoted: app.is_promoted,
          elevator_pitch: app.elevator_pitch || undefined,
          original: app,
        })
      );

      // Normalize community applications
      const communityApps: ApplicationReceivedItem[] = (communityData.applications || []).map(
        (app: CollabApplication & { applicant_profile?: { id: string; username: string; full_name?: string; display_name?: string; avatar_url?: string } }) => ({
          id: app.id,
          source: 'community' as const,
          title: app.collab?.title || 'Unknown Collab',
          applicant: {
            id: app.applicant_user_id,
            username: app.applicant_profile?.username || app.applicant_profile_snapshot?.username || 'Unknown',
            full_name: app.applicant_profile?.full_name || app.applicant_profile_snapshot?.full_name,
            display_name: app.applicant_profile?.display_name || app.applicant_profile_snapshot?.display_name,
            avatar_url: app.applicant_profile?.avatar_url || app.applicant_profile_snapshot?.avatar_url,
          },
          status: app.status,
          applied_at: app.created_at,
          is_promoted: app.is_promoted,
          elevator_pitch: app.elevator_pitch || undefined,
          original: app,
        })
      );

      // Combine and sort by date (newest first)
      const all = [...backlotApps, ...communityApps].sort(
        (a, b) => new Date(b.applied_at).getTime() - new Date(a.applied_at).getTime()
      );

      // Create grouped view
      const groups: ApplicationGroup[] = [];

      // Group backlot by project
      const backlotByProject = backlotData.by_project || {};
      Object.entries(backlotByProject).forEach(([projectId, data]: [string, { project: { title: string }; applications: RoleApplication[] }]) => {
        groups.push({
          id: projectId,
          source: 'backlot',
          name: data.project?.title || 'Unknown Project',
          applications: data.applications.map((app: RoleApplication) => ({
            id: app.id,
            source: 'backlot' as const,
            title: app.backlot_project_roles?.title || 'Unknown Role',
            project_name: data.project?.title,
            applicant: {
              id: app.applicant_user_id,
              username: app.applicant_profile_snapshot?.username || 'Unknown',
              full_name: app.applicant_profile_snapshot?.full_name,
              display_name: app.applicant_profile_snapshot?.display_name,
              avatar_url: app.applicant_profile_snapshot?.avatar_url,
            },
            status: app.status,
            applied_at: app.created_at,
            is_promoted: app.is_promoted,
            elevator_pitch: app.elevator_pitch || undefined,
            original: app,
          })),
        });
      });

      // Group community by collab
      const communityByCollab = communityData.by_collab || {};
      Object.entries(communityByCollab).forEach(([collabId, data]: [string, { collab: { title: string }; applications: (CollabApplication & { applicant_profile?: { id: string; username: string; full_name?: string; display_name?: string; avatar_url?: string } })[] }]) => {
        groups.push({
          id: collabId,
          source: 'community',
          name: data.collab?.title || 'Unknown Collab',
          applications: data.applications.map((app) => ({
            id: app.id,
            source: 'community' as const,
            title: data.collab?.title || 'Unknown Collab',
            applicant: {
              id: app.applicant_user_id,
              username: app.applicant_profile?.username || app.applicant_profile_snapshot?.username || 'Unknown',
              full_name: app.applicant_profile?.full_name || app.applicant_profile_snapshot?.full_name,
              display_name: app.applicant_profile?.display_name || app.applicant_profile_snapshot?.display_name,
              avatar_url: app.applicant_profile?.avatar_url || app.applicant_profile_snapshot?.avatar_url,
            },
            status: app.status,
            applied_at: app.created_at,
            is_promoted: app.is_promoted,
            elevator_pitch: app.elevator_pitch || undefined,
            original: app,
          })),
        });
      });

      return {
        applications: all,
        groups,
        count: all.length,
      };
    },
    enabled: !!session?.access_token,
  });
}
