/**
 * useProjectRoles - Hook for managing Backlot project roles and view configurations
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { BacklotProfile } from '@/types/backlot';

const API_BASE = import.meta.env.VITE_API_URL || '';

// Backlot role definitions
export const BACKLOT_ROLES = [
  { value: 'showrunner', label: 'Showrunner', description: 'Full project control' },
  { value: 'producer', label: 'Producer', description: 'Production oversight and budget access' },
  { value: 'director', label: 'Director', description: 'Creative control, no budget' },
  { value: 'first_ad', label: '1st AD', description: 'Scheduling and on-set management' },
  { value: 'dp', label: 'DP', description: 'Camera and lighting focus' },
  { value: 'editor', label: 'Editor', description: 'Post-production focus' },
  { value: 'department_head', label: 'Department Head', description: 'Department-specific access' },
  { value: 'crew', label: 'Crew', description: 'Basic crew member access' },
] as const;

export type BacklotRoleValue = typeof BACKLOT_ROLES[number]['value'];

export interface BacklotProjectRole {
  id: string;
  project_id: string;
  user_id: string;
  backlot_role: BacklotRoleValue;
  is_primary: boolean;
  created_at: string;
  updated_at: string;
  // Joined
  profile?: BacklotProfile;
}

export interface BacklotViewProfile {
  id: string;
  project_id: string;
  backlot_role: string;
  label: string;
  is_default: boolean;
  config: ViewConfig;
  created_by_user_id: string;
  created_at: string;
  updated_at: string;
}

export interface ViewConfig {
  tabs: Record<string, boolean>;
  sections: Record<string, boolean>;
}

export interface EffectiveViewConfig {
  role: string;
  config?: ViewConfig;
  tabs?: Record<string, boolean>;
  sections?: Record<string, boolean>;
}

// Default view configs (mirroring SQL function)
export const DEFAULT_VIEW_CONFIGS: Record<string, ViewConfig> = {
  showrunner: {
    tabs: {
      overview: true, script: true, scenes: true, 'shot-lists': true, coverage: true,
      schedule: true, days: true, 'call-sheets': true, casting: true, people: true, locations: true,
      gear: true, 'hot-set': true, 'camera-continuity': true, scripty: true, dailies: true, checkin: true,
      review: true, assets: true,
      budget: true, 'daily-budget': true, timecards: true, expenses: true, invoices: true, receipts: true, analytics: true,
      tasks: true, coms: true, updates: true, contacts: true,
      clearances: true, credits: true, 'my-space': true, 'church-tools': true,
      access: true, roles: true, settings: true,
    },
    sections: { budget_numbers: true, admin_tools: true },
  },
  producer: {
    tabs: {
      overview: true, script: true, scenes: true, 'shot-lists': true, coverage: true,
      schedule: true, days: true, 'call-sheets': true, casting: true, people: true, locations: true,
      gear: true, 'hot-set': true, 'camera-continuity': true, scripty: true, dailies: true, checkin: true,
      review: true, assets: true,
      budget: true, 'daily-budget': true, timecards: true, expenses: true, invoices: true, receipts: true, analytics: true,
      tasks: true, coms: true, updates: true, contacts: true,
      clearances: true, credits: true, 'my-space': true, 'church-tools': true,
      access: false, roles: false, settings: false,
    },
    sections: { budget_numbers: true, admin_tools: false },
  },
  director: {
    tabs: {
      overview: true, script: true, scenes: true, 'shot-lists': true, coverage: true,
      schedule: true, days: true, 'call-sheets': true, casting: true, people: true, locations: true,
      gear: true, 'hot-set': true, 'camera-continuity': true, scripty: true, dailies: true, checkin: true,
      review: true, assets: true,
      budget: false, 'daily-budget': false, timecards: false, expenses: false, invoices: false, receipts: false, analytics: false,
      tasks: true, coms: true, updates: true, contacts: true,
      clearances: true, credits: true, 'my-space': true, 'church-tools': false,
      access: false, roles: false, settings: false,
    },
    sections: { budget_numbers: false, admin_tools: false },
  },
  first_ad: {
    tabs: {
      overview: true, script: true, scenes: true, 'shot-lists': true, coverage: true,
      schedule: true, days: true, 'call-sheets': true, casting: true, people: true, locations: true,
      gear: true, 'hot-set': true, 'camera-continuity': true, scripty: true, dailies: true, checkin: true,
      review: true, assets: false,
      budget: false, 'daily-budget': true, timecards: true, expenses: false, invoices: false, receipts: false, analytics: false,
      tasks: true, coms: true, updates: true, contacts: true,
      clearances: true, credits: false, 'my-space': true, 'church-tools': false,
      access: false, roles: false, settings: false,
    },
    sections: { budget_numbers: false, admin_tools: false },
  },
  dp: {
    tabs: {
      overview: true, script: true, scenes: true, 'shot-lists': true, coverage: true,
      schedule: true, days: true, 'call-sheets': true, casting: false, people: true, locations: true,
      gear: true, 'hot-set': true, 'camera-continuity': true, scripty: false, dailies: true, checkin: true,
      review: true, assets: false,
      budget: false, 'daily-budget': false, timecards: true, expenses: false, invoices: true, receipts: false, analytics: false,
      tasks: true, coms: true, updates: true, contacts: false,
      clearances: false, credits: false, 'my-space': true, 'church-tools': false,
      access: false, roles: false, settings: false,
    },
    sections: { budget_numbers: false, admin_tools: false },
  },
  editor: {
    tabs: {
      overview: true, script: true, scenes: true, 'shot-lists': true, coverage: true,
      schedule: false, days: false, 'call-sheets': false, casting: false, people: false, locations: false,
      gear: false, 'hot-set': false, 'camera-continuity': false, scripty: false, dailies: true, checkin: false,
      review: true, assets: true,
      budget: false, 'daily-budget': false, timecards: true, expenses: false, invoices: true, receipts: false, analytics: false,
      tasks: true, coms: true, updates: true, contacts: false,
      clearances: false, credits: true, 'my-space': true, 'church-tools': false,
      access: false, roles: false, settings: false,
    },
    sections: { budget_numbers: false, admin_tools: false },
  },
  department_head: {
    tabs: {
      overview: true, script: true, scenes: true, 'shot-lists': true, coverage: true,
      schedule: true, days: true, 'call-sheets': true, casting: true, people: true, locations: true,
      gear: true, 'hot-set': true, 'camera-continuity': true, scripty: true, dailies: true, checkin: true,
      review: true, assets: false,
      budget: false, 'daily-budget': true, timecards: true, expenses: true, invoices: true, receipts: false, analytics: false,
      tasks: true, coms: true, updates: true, contacts: true,
      clearances: true, credits: false, 'my-space': true, 'church-tools': false,
      access: false, roles: false, settings: false,
    },
    sections: { budget_numbers: false, admin_tools: false },
  },
  crew: {
    tabs: {
      overview: true, script: true, scenes: false, 'shot-lists': false, coverage: false,
      schedule: true, days: true, 'call-sheets': true, casting: false, people: true, locations: false,
      gear: false, 'hot-set': true, 'camera-continuity': false, scripty: false, dailies: false, checkin: true,
      review: false, assets: false,
      budget: false, 'daily-budget': false, timecards: true, expenses: false, invoices: true, receipts: false, analytics: false,
      tasks: true, coms: true, updates: true, contacts: false,
      clearances: false, credits: false, 'my-space': true, 'church-tools': false,
      access: false, roles: false, settings: false,
    },
    sections: { budget_numbers: false, admin_tools: false },
  },
};

// Get all roles assigned in a project
export function useProjectRoles(projectId: string | null) {
  const queryClient = useQueryClient();
  const queryKey = ['backlot-project-roles', projectId];

  const { data, isLoading, error, refetch } = useQuery({
    queryKey,
    queryFn: async () => {
      if (!projectId) return [];

      const token = api.getToken();
      if (!token) throw new Error('Not authenticated');

      const response = await fetch(`${API_BASE}/api/v1/backlot/projects/${projectId}/member-roles`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({ detail: 'Failed to fetch roles' }));
        throw new Error(error.detail);
      }

      return (await response.json()) as BacklotProjectRole[];
    },
    enabled: !!projectId,
  });

  const assignRole = useMutation({
    mutationFn: async ({
      projectId,
      userId,
      backlotRole,
      isPrimary = false,
    }: {
      projectId: string;
      userId: string;
      backlotRole: BacklotRoleValue;
      isPrimary?: boolean;
    }) => {
      const token = api.getToken();
      if (!token) throw new Error('Not authenticated');

      const response = await fetch(`${API_BASE}/api/v1/backlot/projects/${projectId}/member-roles`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          user_id: userId,
          backlot_role: backlotRole,
          is_primary: isPrimary,
        }),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({ detail: 'Failed to assign role' }));
        throw new Error(error.detail);
      }

      return (await response.json()) as BacklotProjectRole;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['backlot-project-roles'] });
      queryClient.invalidateQueries({ queryKey: ['backlot-project-members-access'] });
      queryClient.invalidateQueries({ queryKey: ['backlot-view-config'] });
    },
  });

  const removeRole = useMutation({
    mutationFn: async (roleId: string) => {
      const token = api.getToken();
      if (!token) throw new Error('Not authenticated');

      const response = await fetch(`${API_BASE}/api/v1/backlot/member-roles/${roleId}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({ detail: 'Failed to remove role' }));
        throw new Error(error.detail);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['backlot-project-roles'] });
      queryClient.invalidateQueries({ queryKey: ['backlot-project-members-access'] });
      queryClient.invalidateQueries({ queryKey: ['backlot-view-config'] });
    },
  });

  const setPrimaryRole = useMutation({
    mutationFn: async ({
      projectId,
      userId,
      roleId,
    }: {
      projectId: string;
      userId: string;
      roleId: string;
    }) => {
      const token = api.getToken();
      if (!token) throw new Error('Not authenticated');

      const response = await fetch(`${API_BASE}/api/v1/backlot/member-roles/${roleId}/primary`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({ detail: 'Failed to set primary role' }));
        throw new Error(error.detail);
      }

      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['backlot-project-roles'] });
      queryClient.invalidateQueries({ queryKey: ['backlot-project-members-access'] });
      queryClient.invalidateQueries({ queryKey: ['backlot-view-config'] });
    },
  });

  return {
    roles: data || [],
    isLoading,
    error,
    refetch,
    assignRole,
    removeRole,
    setPrimaryRole,
  };
}

// Get current user's roles in a project
export function useMyProjectRoles(projectId: string | null) {
  return useQuery({
    queryKey: ['backlot-my-project-roles', projectId],
    queryFn: async () => {
      if (!projectId) return [];

      const token = api.getToken();
      if (!token) return [];

      const response = await fetch(`${API_BASE}/api/v1/backlot/projects/${projectId}/my-roles`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({ detail: 'Failed to fetch my roles' }));
        throw new Error(error.detail);
      }

      return (await response.json()) as BacklotProjectRole[];
    },
    enabled: !!projectId,
  });
}

// Get effective view config for current user (or for "view as" mode)
export function useViewConfig(projectId: string | null, viewAsRole?: string | null) {
  return useQuery({
    queryKey: ['backlot-view-config', projectId, viewAsRole],
    queryFn: async (): Promise<EffectiveViewConfig> => {
      if (!projectId) {
        return { role: 'crew', ...DEFAULT_VIEW_CONFIGS.crew };
      }

      // If viewing as a specific role (admin feature)
      if (viewAsRole) {
        const config = DEFAULT_VIEW_CONFIGS[viewAsRole] || DEFAULT_VIEW_CONFIGS.crew;
        return { role: viewAsRole, ...config };
      }

      const token = api.getToken();
      if (!token) {
        return { role: 'crew', ...DEFAULT_VIEW_CONFIGS.crew };
      }

      const params = viewAsRole ? `?view_as_role=${viewAsRole}` : '';
      const response = await fetch(`${API_BASE}/api/v1/backlot/projects/${projectId}/view-config${params}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        return { role: 'crew', ...DEFAULT_VIEW_CONFIGS.crew };
      }

      return (await response.json()) as EffectiveViewConfig;
    },
    enabled: !!projectId,
  });
}

// Get view profiles for a project (for admin management)
export function useViewProfiles(projectId: string | null) {
  const queryClient = useQueryClient();
  const queryKey = ['backlot-view-profiles', projectId];

  const { data, isLoading, error, refetch } = useQuery({
    queryKey,
    queryFn: async () => {
      if (!projectId) return [];

      const token = api.getToken();
      if (!token) throw new Error('Not authenticated');

      const response = await fetch(`${API_BASE}/api/v1/backlot/projects/${projectId}/view-profiles`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        // May not exist yet - return empty array
        return [];
      }

      return (await response.json()) as BacklotViewProfile[];
    },
    enabled: !!projectId,
  });

  const createViewProfile = useMutation({
    mutationFn: async ({
      projectId,
      backlotRole,
      label,
      config,
      isDefault = true,
    }: {
      projectId: string;
      backlotRole: string;
      label: string;
      config: ViewConfig;
      isDefault?: boolean;
    }) => {
      const token = api.getToken();
      if (!token) throw new Error('Not authenticated');

      const response = await fetch(`${API_BASE}/api/v1/backlot/projects/${projectId}/view-profiles`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          backlot_role: backlotRole,
          label,
          config,
          is_default: isDefault,
        }),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({ detail: 'Failed to create view profile' }));
        throw new Error(error.detail);
      }

      return (await response.json()) as BacklotViewProfile;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['backlot-view-profiles'] });
      queryClient.invalidateQueries({ queryKey: ['backlot-view-config'] });
    },
  });

  const updateViewProfile = useMutation({
    mutationFn: async ({
      id,
      label,
      config,
      isDefault,
    }: {
      id: string;
      label?: string;
      config?: ViewConfig;
      isDefault?: boolean;
    }) => {
      const token = api.getToken();
      if (!token) throw new Error('Not authenticated');

      const response = await fetch(`${API_BASE}/api/v1/backlot/view-profiles/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          label,
          config,
          is_default: isDefault,
        }),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({ detail: 'Failed to update view profile' }));
        throw new Error(error.detail);
      }

      return (await response.json()) as BacklotViewProfile;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['backlot-view-profiles'] });
      queryClient.invalidateQueries({ queryKey: ['backlot-view-config'] });
    },
  });

  const deleteViewProfile = useMutation({
    mutationFn: async (id: string) => {
      const token = api.getToken();
      if (!token) throw new Error('Not authenticated');

      const response = await fetch(`${API_BASE}/api/v1/backlot/view-profiles/${id}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({ detail: 'Failed to delete view profile' }));
        throw new Error(error.detail);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['backlot-view-profiles'] });
      queryClient.invalidateQueries({ queryKey: ['backlot-view-config'] });
    },
  });

  return {
    viewProfiles: data || [],
    isLoading,
    error,
    refetch,
    createViewProfile,
    updateViewProfile,
    deleteViewProfile,
  };
}

// Helper to check if user can manage roles
export function useCanManageRoles(projectId: string | null) {
  return useQuery({
    queryKey: ['backlot-can-manage-roles', projectId],
    queryFn: async () => {
      if (!projectId) return false;

      const token = api.getToken();
      if (!token) return false;

      const response = await fetch(`${API_BASE}/api/v1/backlot/projects/${projectId}/can-manage-roles`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        console.error('[useCanManageRoles] Request failed:', response.status);
        return false;
      }

      const result = await response.json();
      console.log('[useCanManageRoles] Result:', result);
      return result.can_manage || false;
    },
    enabled: !!projectId,
    staleTime: 0, // Always refetch
    gcTime: 0, // Don't cache (formerly cacheTime)
  });
}

// Helper to check if user can use "View as Role" feature
export function useCanViewAsRole(projectId: string | null) {
  return useQuery({
    queryKey: ['backlot-can-view-as-role', projectId],
    queryFn: async () => {
      if (!projectId) return false;

      const token = api.getToken();
      if (!token) return false;

      // Same permissions as canManageRoles
      const response = await fetch(`${API_BASE}/api/v1/backlot/projects/${projectId}/can-manage-roles`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        return false;
      }

      const result = await response.json();
      return result.can_manage || false;
    },
    enabled: !!projectId,
  });
}
