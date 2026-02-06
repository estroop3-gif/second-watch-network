/**
 * useProjectAccess - Hook for Team & Access management in Backlot projects
 * Uses the backend API for permission management with view/edit support
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';

// Permission value with view/edit split
export interface PermissionValue {
  view: boolean;
  edit: boolean;
}

// View config with view/edit permissions per tab/section
export interface ViewEditConfig {
  tabs: Record<string, PermissionValue>;
  sections: Record<string, PermissionValue>;
}

// Effective view config returned from backend
export interface EffectiveConfig {
  role: string;
  is_owner: boolean;
  has_overrides: boolean;
  tabs: Record<string, PermissionValue>;
  sections: Record<string, PermissionValue>;
}

// Member with roles and permission info
export interface ProjectMemberWithRoles {
  id: string;
  project_id: string;
  user_id: string;
  role: string; // owner, admin, editor, viewer
  production_role?: string;
  department?: string;
  phone?: string;
  email?: string;
  invited_by?: string;
  joined_at: string;
  user_name?: string;
  user_avatar?: string;
  user_username?: string;
  backlot_roles: string[];
  primary_role?: string;
  has_overrides: boolean;
}

// View profile for a role
export interface ViewProfile {
  id: string;
  project_id: string;
  backlot_role: string;
  label: string;
  is_default: boolean;
  config: ViewEditConfig;
  created_by_user_id: string;
  created_at: string;
  updated_at: string;
}

// Per-user view override
export interface ViewOverride {
  id: string;
  project_id: string;
  user_id: string;
  config: ViewEditConfig;
  created_at: string;
  updated_at: string;
  user_name?: string;
}

// Role preset with default config
export interface RolePreset {
  role: string;
  label: string;
  config: ViewEditConfig;
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Normalize a permission value to handle both boolean (legacy) and object formats
 */
export function normalizePermission(value: boolean | PermissionValue | undefined): PermissionValue {
  if (value === undefined || value === null) {
    return { view: false, edit: false };
  }
  if (typeof value === 'boolean') {
    return { view: value, edit: false };
  }
  return {
    view: value.view ?? false,
    edit: value.edit ?? false,
  };
}

/**
 * Check if user can view a tab (works with both old boolean and new object formats)
 */
export function canViewTab(
  config: EffectiveConfig | ViewEditConfig | undefined,
  tabKey: string
): boolean {
  if (!config) return false;
  const tabs = 'tabs' in config ? config.tabs : {};
  const perm = tabs[tabKey];
  if (perm === undefined) return false;
  return normalizePermission(perm).view;
}

/**
 * Check if user can edit in a tab
 */
export function canEditTab(
  config: EffectiveConfig | ViewEditConfig | undefined,
  tabKey: string
): boolean {
  if (!config) return false;
  const tabs = 'tabs' in config ? config.tabs : {};
  const perm = tabs[tabKey];
  if (perm === undefined) return false;
  return normalizePermission(perm).edit;
}

/**
 * Check if user can view a section
 */
export function canViewSection(
  config: EffectiveConfig | ViewEditConfig | undefined,
  sectionKey: string
): boolean {
  if (!config) return false;
  const sections = 'sections' in config ? config.sections : {};
  const perm = sections[sectionKey];
  if (perm === undefined) return false;
  return normalizePermission(perm).view;
}

/**
 * Check if user can edit in a section
 */
export function canEditSection(
  config: EffectiveConfig | ViewEditConfig | undefined,
  sectionKey: string
): boolean {
  if (!config) return false;
  const sections = 'sections' in config ? config.sections : {};
  const perm = sections[sectionKey];
  if (perm === undefined) return false;
  return normalizePermission(perm).edit;
}

// ============================================================================
// HOOKS
// ============================================================================

/**
 * Get effective view config for current user
 */
export function useEffectiveConfig(projectId: string | null) {
  return useQuery({
    queryKey: ['backlot-effective-config', projectId],
    queryFn: async (): Promise<EffectiveConfig> => {
      if (!projectId) {
        return {
          role: 'crew',
          is_owner: false,
          has_overrides: false,
          tabs: {},
          sections: {},
        };
      }

      const response = await apiClient.get<EffectiveConfig>(
        `/api/v1/backlot/projects/${projectId}/access/effective-config`
      );
      return response;
    },
    enabled: !!projectId,
  });
}

/**
 * Get effective config for a specific user (admin only)
 */
export function useUserEffectiveConfig(projectId: string | null, userId: string | null) {
  return useQuery({
    queryKey: ['backlot-user-effective-config', projectId, userId],
    queryFn: async (): Promise<EffectiveConfig> => {
      if (!projectId || !userId) {
        return {
          role: 'crew',
          is_owner: false,
          has_overrides: false,
          tabs: {},
          sections: {},
        };
      }

      const response = await apiClient.get<EffectiveConfig>(
        `/api/v1/backlot/projects/${projectId}/access/effective-config/${userId}`
      );
      return response;
    },
    enabled: !!projectId && !!userId,
  });
}

/**
 * Preview what a role would see
 */
export function useRolePreview(projectId: string | null, role: string | null) {
  return useQuery({
    queryKey: ['backlot-role-preview', projectId, role],
    queryFn: async (): Promise<EffectiveConfig> => {
      if (!projectId || !role) {
        return {
          role: 'crew',
          is_owner: false,
          has_overrides: false,
          tabs: {},
          sections: {},
        };
      }

      const response = await apiClient.get<EffectiveConfig>(
        `/api/v1/backlot/projects/${projectId}/access/preview/${role}`
      );
      return response;
    },
    enabled: !!projectId && !!role,
  });
}

/**
 * Get all project members with their roles
 */
export function useProjectMembers(projectId: string | null) {
  const queryClient = useQueryClient();
  const queryKey = ['backlot-project-members-access', projectId];

  const { data, isLoading, error, refetch } = useQuery({
    queryKey,
    queryFn: async (): Promise<ProjectMemberWithRoles[]> => {
      if (!projectId) return [];

      const response = await apiClient.get<ProjectMemberWithRoles[]>(
        `/api/v1/backlot/projects/${projectId}/access/members`
      );
      // Debug: log the API response
      console.log('[useProjectMembers] API response:', response?.slice(0, 3).map(m => ({
        user_id: m.user_id,
        user_name: m.user_name,
        user_username: m.user_username,
        email: m.email,
      })));
      return response;
    },
    enabled: !!projectId,
  });

  const addMember = useMutation({
    mutationFn: async ({
      userId,
      role,
      backlotRole,
      productionRole,
      department,
    }: {
      userId: string;
      role?: string;
      backlotRole?: string;
      productionRole?: string;
      department?: string;
    }) => {
      if (!projectId) throw new Error('Project ID required');

      const response = await apiClient.post<ProjectMemberWithRoles>(
        `/api/v1/backlot/projects/${projectId}/access/members`,
        {
          user_id: userId,
          role: role || 'viewer',
          backlot_role: backlotRole,
          production_role: productionRole,
          department,
        }
      );
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      queryClient.invalidateQueries({ queryKey: ['backlot-project-members'] });
    },
  });

  const updateMember = useMutation({
    mutationFn: async ({
      memberId,
      role,
      productionRole,
      department,
    }: {
      memberId: string;
      role?: string;
      productionRole?: string;
      department?: string;
    }) => {
      if (!projectId) throw new Error('Project ID required');

      await apiClient.patch(
        `/api/v1/backlot/projects/${projectId}/access/members/${memberId}`,
        {
          role,
          production_role: productionRole,
          department,
        }
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      queryClient.invalidateQueries({ queryKey: ['backlot-project-members'] });
    },
  });

  const removeMember = useMutation({
    mutationFn: async (memberId: string) => {
      if (!projectId) throw new Error('Project ID required');

      await apiClient.delete(
        `/api/v1/backlot/projects/${projectId}/access/members/${memberId}`
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      queryClient.invalidateQueries({ queryKey: ['backlot-project-members'] });
    },
  });

  return {
    members: data || [],
    isLoading,
    error,
    refetch,
    addMember,
    updateMember,
    removeMember,
  };
}

/**
 * Manage role assignments for project members
 */
export function useRoleAssignments(projectId: string | null) {
  const queryClient = useQueryClient();

  const assignRole = useMutation({
    mutationFn: async ({
      userId,
      backlotRole,
      isPrimary = false,
    }: {
      userId: string;
      backlotRole: string;
      isPrimary?: boolean;
    }) => {
      if (!projectId) throw new Error('Project ID required');

      await apiClient.post(`/api/v1/backlot/projects/${projectId}/access/roles`, {
        user_id: userId,
        backlot_role: backlotRole,
        is_primary: isPrimary,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['backlot-project-members-access', projectId] });
      queryClient.invalidateQueries({ queryKey: ['backlot-project-roles'] });
      queryClient.invalidateQueries({ queryKey: ['backlot-effective-config'] });
    },
  });

  const removeRole = useMutation({
    mutationFn: async ({
      userId,
      backlotRole,
    }: {
      userId: string;
      backlotRole: string;
    }) => {
      if (!projectId) throw new Error('Project ID required');

      await apiClient.delete(`/api/v1/backlot/projects/${projectId}/access/roles`, {
        data: {
          user_id: userId,
          backlot_role: backlotRole,
        },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['backlot-project-members-access', projectId] });
      queryClient.invalidateQueries({ queryKey: ['backlot-project-roles'] });
      queryClient.invalidateQueries({ queryKey: ['backlot-effective-config'] });
    },
  });

  return {
    assignRole,
    removeRole,
  };
}

/**
 * Get default role presets
 */
export function useRolePresets(projectId: string | null) {
  return useQuery({
    queryKey: ['backlot-role-presets', projectId],
    queryFn: async (): Promise<RolePreset[]> => {
      if (!projectId) return [];

      const response = await apiClient.get<RolePreset[]>(
        `/api/v1/backlot/projects/${projectId}/access/profiles/defaults`
      );
      return response;
    },
    enabled: !!projectId,
  });
}

/**
 * Manage view profiles for roles
 */
export function useViewProfiles(projectId: string | null) {
  const queryClient = useQueryClient();
  const queryKey = ['backlot-view-profiles-access', projectId];

  const { data, isLoading, error, refetch } = useQuery({
    queryKey,
    queryFn: async (): Promise<ViewProfile[]> => {
      if (!projectId) return [];

      const response = await apiClient.get<ViewProfile[]>(
        `/api/v1/backlot/projects/${projectId}/access/profiles`
      );
      return response;
    },
    enabled: !!projectId,
  });

  const updateProfile = useMutation({
    mutationFn: async ({
      role,
      config,
      label,
    }: {
      role: string;
      config: ViewEditConfig;
      label?: string;
    }) => {
      if (!projectId) throw new Error('Project ID required');

      await apiClient.put(
        `/api/v1/backlot/projects/${projectId}/access/profiles/${role}`,
        { config, label }
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      queryClient.invalidateQueries({ queryKey: ['backlot-effective-config'] });
      queryClient.invalidateQueries({ queryKey: ['backlot-role-preview'] });
    },
  });

  const deleteProfile = useMutation({
    mutationFn: async (role: string) => {
      if (!projectId) throw new Error('Project ID required');

      await apiClient.delete(
        `/api/v1/backlot/projects/${projectId}/access/profiles/${role}`
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      queryClient.invalidateQueries({ queryKey: ['backlot-effective-config'] });
      queryClient.invalidateQueries({ queryKey: ['backlot-role-preview'] });
    },
  });

  return {
    viewProfiles: data || [],
    isLoading,
    error,
    refetch,
    updateProfile,
    deleteProfile,
  };
}

/**
 * Manage per-user view overrides
 */
export function useViewOverrides(projectId: string | null) {
  const queryClient = useQueryClient();
  const queryKey = ['backlot-view-overrides', projectId];

  const { data, isLoading, error, refetch } = useQuery({
    queryKey,
    queryFn: async (): Promise<ViewOverride[]> => {
      if (!projectId) return [];

      const response = await apiClient.get<ViewOverride[]>(
        `/api/v1/backlot/projects/${projectId}/access/overrides`
      );
      return response;
    },
    enabled: !!projectId,
  });

  const getUserOverride = async (userId: string): Promise<ViewOverride | null> => {
    if (!projectId) return null;

    try {
      const response = await apiClient.get<ViewOverride>(
        `/api/v1/backlot/projects/${projectId}/access/overrides/${userId}`
      );
      return response;
    } catch {
      return null;
    }
  };

  const updateOverride = useMutation({
    mutationFn: async ({
      userId,
      config,
    }: {
      userId: string;
      config: ViewEditConfig;
    }) => {
      if (!projectId) throw new Error('Project ID required');

      await apiClient.put(
        `/api/v1/backlot/projects/${projectId}/access/overrides/${userId}`,
        { config }
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      queryClient.invalidateQueries({ queryKey: ['backlot-project-members-access', projectId] });
      queryClient.invalidateQueries({ queryKey: ['backlot-effective-config'] });
      queryClient.invalidateQueries({ queryKey: ['backlot-user-effective-config'] });
    },
  });

  const deleteOverride = useMutation({
    mutationFn: async (userId: string) => {
      if (!projectId) throw new Error('Project ID required');

      await apiClient.delete(
        `/api/v1/backlot/projects/${projectId}/access/overrides/${userId}`
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      queryClient.invalidateQueries({ queryKey: ['backlot-project-members-access', projectId] });
      queryClient.invalidateQueries({ queryKey: ['backlot-effective-config'] });
      queryClient.invalidateQueries({ queryKey: ['backlot-user-effective-config'] });
    },
  });

  return {
    overrides: data || [],
    isLoading,
    error,
    refetch,
    getUserOverride,
    updateOverride,
    deleteOverride,
  };
}

/**
 * Check if current user can manage project access
 */
export function useCanManageAccess(projectId: string | null) {
  const { data: config } = useEffectiveConfig(projectId);

  // Owner, showrunner, or admin can manage access
  if (!config) return false;

  return (
    config.is_owner ||
    config.role === 'showrunner' ||
    canViewTab(config, 'access')
  );
}

// ============================================================================
// UNIFIED PEOPLE
// ============================================================================

// Unified person interface (mirrors backend)
export interface UnifiedPerson {
  id: string;
  source: 'team' | 'contact' | 'both';
  name: string;
  email?: string | null;
  phone?: string | null;
  access_role?: string | null;
  backlot_roles: string[];
  primary_role?: string | null;
  user_avatar?: string | null;
  user_username?: string | null;
  contact_type?: string | null;
  contact_status?: string | null;
  company?: string | null;
  role_interest?: string | null;
  is_team_member: boolean;
  has_account: boolean;
  contact_id?: string | null;
  member_id?: string | null;
  user_id?: string | null;
}

export interface UnifiedPeopleResponse {
  team: ProjectMemberWithRoles[];
  contacts: Record<string, unknown>[];
  unified: UnifiedPerson[];
}

/**
 * Get unified view of all people (team members + contacts)
 */
export function useUnifiedPeople(projectId: string | null) {
  return useQuery({
    queryKey: ['backlot-unified-people', projectId],
    queryFn: async (): Promise<UnifiedPeopleResponse> => {
      if (!projectId) {
        return { team: [], contacts: [], unified: [] };
      }

      const response = await apiClient.get<UnifiedPeopleResponse>(
        `/api/v1/backlot/projects/${projectId}/people`
      );
      return response;
    },
    enabled: !!projectId,
  });
}

/**
 * Add a team member from an existing contact
 */
export function useAddMemberFromContact(projectId: string | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      contactId,
      role,
      backlotRole,
    }: {
      contactId: string;
      role?: string;
      backlotRole?: string;
    }) => {
      if (!projectId) throw new Error('Project ID required');

      const response = await apiClient.post<ProjectMemberWithRoles>(
        `/api/v1/backlot/projects/${projectId}/access/members/from-contact`,
        {
          contact_id: contactId,
          role: role || 'viewer',
          backlot_role: backlotRole,
        }
      );
      return response;
    },
    onSuccess: () => {
      // Invalidate all relevant queries
      queryClient.invalidateQueries({ queryKey: ['backlot-project-members-access', projectId] });
      queryClient.invalidateQueries({ queryKey: ['backlot-project-members'] });
      queryClient.invalidateQueries({ queryKey: ['backlot-unified-people', projectId] });
      queryClient.invalidateQueries({ queryKey: ['backlot-project-contacts', projectId] });
    },
  });
}

/**
 * Get suggested backlot role for a contact
 */
export function useSuggestRole(projectId: string | null, contactId: string | null) {
  return useQuery({
    queryKey: ['backlot-suggest-role', projectId, contactId],
    queryFn: async (): Promise<{ role_interest: string | null; suggested_role: string | null }> => {
      if (!projectId || !contactId) {
        return { role_interest: null, suggested_role: null };
      }

      const response = await apiClient.get<{ role_interest: string | null; suggested_role: string | null }>(
        `/api/v1/backlot/projects/${projectId}/people/suggest-role?contact_id=${contactId}`
      );
      return response;
    },
    enabled: !!projectId && !!contactId,
  });
}
