/**
 * Organization Management Hooks
 * Handles organization Backlot seat management and project access
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

// =============================================================================
// Types
// =============================================================================

export interface BacklotSeat {
  id: string;
  organization_id: string;
  user_id: string;
  role: 'owner' | 'admin' | 'collaborative';
  can_create_projects: boolean;
  status: string;
  joined_at: string | null;
  user_name: string | null;
  user_email: string | null;
  user_avatar: string | null;
}

export interface OrganizationBacklotStatus {
  organization_id: string;
  organization_name: string;
  backlot_enabled: boolean;
  backlot_billing_status: string;
  backlot_seat_limit: number;
  seats_used: number;
  seats_available: number;
  projects_count: number;
}

export interface ProjectAccess {
  id: string;
  organization_id: string;
  user_id: string;
  project_id: string;
  project_name: string | null;
  tab_permissions: Record<string, { view: boolean; edit: boolean }>;
  granted_by: string | null;
  granted_at: string | null;
}

export interface MyBacklotOrg {
  id: string;
  name: string;
  slug: string;
  logo_url: string | null;
  backlot_enabled: boolean;
  backlot_billing_status: string;
  backlot_seat_limit: number;
  role: string;
  can_create_projects: boolean;
  seats_used: number;
  projects_count: number;
}

// =============================================================================
// Organization List Hooks
// =============================================================================

/**
 * Get all organizations where the current user has Backlot access
 */
export function useMyBacklotOrganizations() {
  return useQuery({
    queryKey: ['my-backlot-orgs'],
    queryFn: async (): Promise<MyBacklotOrg[]> => {
      const response = await api.get('/api/v1/organizations/my-backlot-orgs');
      return response;
    },
  });
}

/**
 * Get Backlot status for a specific organization
 */
export function useOrganizationBacklotStatus(organizationId: string) {
  return useQuery({
    queryKey: ['org-backlot-status', organizationId],
    queryFn: async (): Promise<OrganizationBacklotStatus> => {
      const response = await api.get(`/api/v1/organizations/${organizationId}/backlot/status`);
      return response;
    },
    enabled: !!organizationId,
  });
}

// =============================================================================
// Backlot Enable/Disable
// =============================================================================

export function useEnableBacklot() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ organizationId, seatLimit }: { organizationId: string; seatLimit: number }) => {
      return api.post(`/api/v1/organizations/${organizationId}/backlot/enable`, { seat_limit: seatLimit });
    },
    onSuccess: (_, { organizationId }) => {
      queryClient.invalidateQueries({ queryKey: ['org-backlot-status', organizationId] });
      queryClient.invalidateQueries({ queryKey: ['my-backlot-orgs'] });
    },
  });
}

// =============================================================================
// Seat Management Hooks
// =============================================================================

/**
 * Get all Backlot seats for an organization
 */
export function useOrganizationSeats(organizationId: string) {
  return useQuery({
    queryKey: ['org-backlot-seats', organizationId],
    queryFn: async (): Promise<BacklotSeat[]> => {
      const response = await api.get(`/api/v1/organizations/${organizationId}/backlot/seats`);
      return response;
    },
    enabled: !!organizationId,
  });
}

/**
 * Add a new Backlot seat
 */
export function useAddOrganizationSeat() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      organizationId,
      userId,
      role,
      canCreateProjects,
    }: {
      organizationId: string;
      userId: string;
      role: 'owner' | 'admin' | 'collaborative';
      canCreateProjects: boolean;
    }) => {
      return api.post(`/api/v1/organizations/${organizationId}/backlot/seats`, {
        user_id: userId,
        role,
        can_create_projects: canCreateProjects,
      });
    },
    onSuccess: (_, { organizationId }) => {
      queryClient.invalidateQueries({ queryKey: ['org-backlot-seats', organizationId] });
      queryClient.invalidateQueries({ queryKey: ['org-backlot-status', organizationId] });
    },
  });
}

/**
 * Update a Backlot seat
 */
export function useUpdateOrganizationSeat() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      organizationId,
      userId,
      role,
      canCreateProjects,
    }: {
      organizationId: string;
      userId: string;
      role?: 'owner' | 'admin' | 'collaborative';
      canCreateProjects?: boolean;
    }) => {
      return api.patch(`/api/v1/organizations/${organizationId}/backlot/seats/${userId}`, {
        role,
        can_create_projects: canCreateProjects,
      });
    },
    onSuccess: (_, { organizationId }) => {
      queryClient.invalidateQueries({ queryKey: ['org-backlot-seats', organizationId] });
    },
  });
}

/**
 * Remove a Backlot seat
 */
export function useRemoveOrganizationSeat() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ organizationId, userId }: { organizationId: string; userId: string }) => {
      return api.delete(`/api/v1/organizations/${organizationId}/backlot/seats/${userId}`);
    },
    onSuccess: (_, { organizationId }) => {
      queryClient.invalidateQueries({ queryKey: ['org-backlot-seats', organizationId] });
      queryClient.invalidateQueries({ queryKey: ['org-backlot-status', organizationId] });
    },
  });
}

// =============================================================================
// Project Access Hooks (for Collaborative Seats)
// =============================================================================

/**
 * Get projects a user can access in an organization
 */
export function useUserProjectAccess(organizationId: string, userId: string) {
  return useQuery({
    queryKey: ['org-user-project-access', organizationId, userId],
    queryFn: async (): Promise<ProjectAccess[]> => {
      const response = await api.get(`/api/v1/organizations/${organizationId}/backlot/seats/${userId}/projects`);
      return response;
    },
    enabled: !!organizationId && !!userId,
  });
}

/**
 * Grant project access to a collaborative seat
 */
export function useGrantProjectAccess() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      organizationId,
      userId,
      projectId,
      tabPermissions,
    }: {
      organizationId: string;
      userId: string;
      projectId: string;
      tabPermissions?: Record<string, { view: boolean; edit: boolean }>;
    }) => {
      return api.post(`/api/v1/organizations/${organizationId}/backlot/seats/${userId}/projects`, {
        project_id: projectId,
        tab_permissions: tabPermissions,
      });
    },
    onSuccess: (_, { organizationId, userId }) => {
      queryClient.invalidateQueries({ queryKey: ['org-user-project-access', organizationId, userId] });
    },
  });
}

/**
 * Update project access permissions
 */
export function useUpdateProjectAccess() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      organizationId,
      userId,
      projectId,
      tabPermissions,
    }: {
      organizationId: string;
      userId: string;
      projectId: string;
      tabPermissions: Record<string, { view: boolean; edit: boolean }>;
    }) => {
      return api.patch(`/api/v1/organizations/${organizationId}/backlot/seats/${userId}/projects/${projectId}`, {
        tab_permissions: tabPermissions,
      });
    },
    onSuccess: (_, { organizationId, userId }) => {
      queryClient.invalidateQueries({ queryKey: ['org-user-project-access', organizationId, userId] });
    },
  });
}

/**
 * Revoke project access
 */
export function useRevokeProjectAccess() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      organizationId,
      userId,
      projectId,
    }: {
      organizationId: string;
      userId: string;
      projectId: string;
    }) => {
      return api.delete(`/api/v1/organizations/${organizationId}/backlot/seats/${userId}/projects/${projectId}`);
    },
    onSuccess: (_, { organizationId, userId }) => {
      queryClient.invalidateQueries({ queryKey: ['org-user-project-access', organizationId, userId] });
    },
  });
}

// =============================================================================
// Organization Projects
// =============================================================================

/**
 * Get all projects owned by an organization
 */
export function useOrganizationProjects(organizationId: string) {
  return useQuery({
    queryKey: ['org-projects', organizationId],
    queryFn: async () => {
      const response = await api.get(`/api/v1/organizations/${organizationId}/projects`);
      return response;
    },
    enabled: !!organizationId,
  });
}

/**
 * Assign a project to an organization
 */
export function useAssignProjectToOrg() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      projectId,
      organizationId,
    }: {
      projectId: string;
      organizationId: string | null;
    }) => {
      return api.post(`/api/v1/projects/${projectId}/organization`, { organization_id: organizationId });
    },
    onSuccess: (_, { organizationId }) => {
      if (organizationId) {
        queryClient.invalidateQueries({ queryKey: ['org-projects', organizationId] });
        queryClient.invalidateQueries({ queryKey: ['org-backlot-status', organizationId] });
      }
      queryClient.invalidateQueries({ queryKey: ['backlot-projects'] });
    },
  });
}

// =============================================================================
// Backlot Access Check
// =============================================================================

export interface BacklotAccessInfo {
  has_access: boolean;
  reason: 'dev_mode' | 'admin' | 'subscription' | 'organization_seat' | 'no_subscription' | 'no_profile';
  organization_id?: string;
  organization_name?: string;
  role?: string;
  can_create_projects?: boolean;
}

/**
 * Check if current user has Backlot access
 */
export function useBacklotAccess() {
  return useQuery({
    queryKey: ['backlot-access'],
    queryFn: async (): Promise<BacklotAccessInfo> => {
      const response = await api.get('/api/v1/backlot/access');
      return response;
    },
    staleTime: 30000, // Cache for 30 seconds
  });
}
