/**
 * useProjects - Hook for fetching and managing Backlot projects
 * Uses the backend API for all operations (Cognito auth compatible)
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/context/AuthContext';
import { api } from '@/lib/api';
import {
  BacklotProject,
  BacklotProjectMember,
  ProjectInput,
  ProjectMemberInput,
  ProjectFilters,
  BacklotMemberRole,
} from '@/types/backlot';

const API_BASE = import.meta.env.VITE_API_URL || '';

interface UseProjectsOptions extends ProjectFilters {
  limit?: number;
  ownership?: 'owner' | 'member' | 'all';
}

// Fetch all projects for the current user
export function useProjects(options: UseProjectsOptions = {}) {
  const { status = 'all', visibility = 'all', search, ownership = 'all', limit = 50 } = options;
  const queryClient = useQueryClient();
  const { user } = useAuth();

  const queryKey = ['backlot-projects', { status, visibility, search, ownership, limit }];

  const { data, isLoading, error, refetch } = useQuery({
    queryKey,
    queryFn: async () => {
      if (!user) throw new Error('Not authenticated');

      const projects = await api.listBacklotProjects({
        status: status !== 'all' ? status : undefined,
        visibility: visibility !== 'all' ? visibility : undefined,
        ownership: ownership !== 'all' ? ownership : undefined,
        search,
        limit,
      });

      return projects as BacklotProject[];
    },
    enabled: !!user,
  });

  const createProject = useMutation({
    mutationFn: async (input: ProjectInput) => {
      if (!user) throw new Error('Not authenticated');

      const project = await api.createBacklotProject({
        title: input.title,
        logline: input.logline || null,
        description: input.description || null,
        project_type: input.project_type || null,
        genre: input.genre || null,
        format: input.format || null,
        runtime_minutes: input.runtime_minutes || null,
        status: input.status || 'pre_production',
        visibility: input.visibility || 'private',
        target_start_date: input.target_start_date || null,
        target_end_date: input.target_end_date || null,
        cover_image_url: input.cover_image_url || null,
        thumbnail_url: input.thumbnail_url || null,
      });

      return project as BacklotProject;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['backlot-projects'] });
    },
  });

  const updateProject = useMutation({
    mutationFn: async ({ id, ...input }: ProjectInput & { id: string }) => {
      const project = await api.updateBacklotProject(id, {
        title: input.title,
        logline: input.logline || null,
        description: input.description || null,
        project_type: input.project_type || null,
        genre: input.genre || null,
        format: input.format || null,
        runtime_minutes: input.runtime_minutes || null,
        status: input.status,
        visibility: input.visibility,
        target_start_date: input.target_start_date || null,
        target_end_date: input.target_end_date || null,
        cover_image_url: input.cover_image_url || null,
        thumbnail_url: input.thumbnail_url || null,
      });

      return project as BacklotProject;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['backlot-projects'] });
      queryClient.invalidateQueries({ queryKey: ['backlot-project', data.id] });
      queryClient.invalidateQueries({ queryKey: ['backlot-project-slug', data.slug] });
    },
  });

  const deleteProject = useMutation({
    mutationFn: async (id: string) => {
      await api.deleteBacklotProject(id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['backlot-projects'] });
    },
  });

  return {
    projects: data || [],
    isLoading,
    error,
    refetch,
    createProject,
    updateProject,
    deleteProject,
  };
}

// Public project with has_access flag and donation info
export interface PublicBacklotProject extends BacklotProject {
  has_access: boolean;
  donations_enabled?: boolean;
  donation_message?: string;
  donation_goal_cents?: number;
}

// Fetch all public projects in the system
export function usePublicProjects(options: { status?: string; search?: string; limit?: number } = {}) {
  const { status = 'all', search, limit = 50 } = options;
  const { user } = useAuth();

  const queryKey = ['backlot-public-projects', { status, search, limit }];

  const { data, isLoading, error, refetch } = useQuery({
    queryKey,
    queryFn: async () => {
      const response = await api.listPublicBacklotProjects({
        status: status !== 'all' ? status : undefined,
        search,
        limit,
      });

      return response.projects as PublicBacklotProject[];
    },
    // Enable even without user - public projects are viewable by anyone
    enabled: true,
  });

  return {
    projects: data || [],
    isLoading,
    error,
    refetch,
  };
}

// Fetch a single project by ID with live updates
export function useProject(id: string | null) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['backlot-project', id],
    queryFn: async () => {
      if (!id) return null;
      const project = await api.getBacklotProject(id);
      return project as BacklotProject;
    },
    enabled: !!id && !!user,
    staleTime: 10000, // Data is fresh for 10 seconds
    refetchOnWindowFocus: true, // Refetch when tab is focused
    refetchInterval: 30000, // Refetch every 30 seconds for live updates
  });
}

// Fetch a project by slug (for public pages)
export function useProjectBySlug(slug: string | null) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['backlot-project-slug', slug],
    queryFn: async () => {
      if (!slug) return null;
      // For now, we don't have a slug endpoint, but we could add one
      // This would need a backend endpoint: GET /api/v1/backlot/projects/by-slug/{slug}
      throw new Error('Project by slug not yet implemented via API');
    },
    enabled: !!slug && !!user,
  });
}

// Fetch project members - still uses API
export function useProjectMembers(projectId: string | null) {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['backlot-project-members', projectId],
    queryFn: async () => {
      if (!projectId) return [];
      // This would need a backend endpoint: GET /api/v1/backlot/projects/{projectId}/members
      // For now, return empty array since we need to implement the endpoint
      return [] as BacklotProjectMember[];
    },
    enabled: !!projectId && !!user,
  });

  const addMember = useMutation({
    mutationFn: async ({ projectId, ...input }: ProjectMemberInput & { projectId: string }) => {
      // This would need a backend endpoint: POST /api/v1/backlot/projects/{projectId}/members
      throw new Error('Add member not yet implemented via API');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['backlot-project-members', projectId] });
    },
  });

  const updateMember = useMutation({
    mutationFn: async ({ id, ...input }: Partial<ProjectMemberInput> & { id: string }) => {
      // This would need a backend endpoint: PUT /api/v1/backlot/members/{memberId}
      throw new Error('Update member not yet implemented via API');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['backlot-project-members', projectId] });
    },
  });

  const removeMember = useMutation({
    mutationFn: async (memberId: string) => {
      // This would need a backend endpoint: DELETE /api/v1/backlot/members/{memberId}
      throw new Error('Remove member not yet implemented via API');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['backlot-project-members', projectId] });
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

// Check if current user has permission for a project
export function useProjectPermission(projectId: string | null) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['backlot-project-permission', projectId],
    queryFn: async () => {
      if (!projectId || !user) {
        return { canView: false, canEdit: false, isAdmin: false, isOwner: false, role: null as BacklotMemberRole | null };
      }

      try {
        // Fetch the user's actual role from the backend
        const token = api.getToken();
        if (!token) {
          return { canView: false, canEdit: false, isAdmin: false, isOwner: false, role: null };
        }

        const response = await fetch(
          `${API_BASE}/api/v1/backlot/projects/${projectId}/my-role`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );

        if (!response.ok) {
          // If 403, user doesn't have access
          if (response.status === 403) {
            return { canView: false, canEdit: false, isAdmin: false, isOwner: false, role: null };
          }
          throw new Error('Failed to fetch role');
        }

        const roleData = await response.json();

        return {
          canView: roleData.can_view ?? false,
          canEdit: roleData.can_edit ?? false,
          isAdmin: roleData.is_admin ?? false,
          isOwner: roleData.is_owner ?? false,
          role: (roleData.role as BacklotMemberRole) || null,
        };
      } catch (error) {
        console.error('Error fetching project permission:', error);
        return { canView: false, canEdit: false, isAdmin: false, isOwner: false, role: null };
      }
    },
    enabled: !!projectId && !!user,
  });
}

// Approver roles (duplicated from useProjectRoles to avoid circular imports)
const APPROVER_ROLES = ['showrunner', 'upm', 'line_producer', 'producer', 'executive_producer'];

/**
 * Combined workspace initialization hook.
 * Fetches project, permission, view-config, can-manage-roles, my-roles,
 * and production-days in a single API call to reduce concurrent Lambda invocations.
 * Returns all workspace data directly and populates individual query caches
 * for child components that use the individual hooks.
 */
export function useWorkspaceInit(projectId: string | null) {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['backlot-workspace-init', projectId],
    queryFn: async () => {
      if (!projectId) return null;
      const data = await api.getBacklotWorkspaceInit(projectId);

      // Populate individual query caches so child components
      // that call useProject / useProjectPermission etc. get instant cache hits
      queryClient.setQueryData(['backlot-project', projectId], data.project);
      queryClient.setQueryData(['backlot-project-permission', projectId], {
        canView: data.permission.can_view ?? false,
        canEdit: data.permission.can_edit ?? false,
        isAdmin: data.permission.is_admin ?? false,
        isOwner: data.permission.is_owner ?? false,
        role: (data.permission.role as BacklotMemberRole) || null,
      });
      queryClient.setQueryData(['backlot-view-config', projectId, null], data.view_config);
      queryClient.setQueryData(['backlot-can-view-as-role', projectId], data.can_manage_roles);
      queryClient.setQueryData(['backlot-my-project-roles', projectId], data.my_roles || []);
      queryClient.setQueryData(['backlot-production-days', projectId], data.production_days || []);

      return data;
    },
    enabled: !!projectId && !!user,
    staleTime: 10000,
    refetchOnWindowFocus: true,
    refetchInterval: 30000,
  });

  const data = query.data;

  // Derive permission
  const permission = data ? {
    canView: data.permission?.can_view ?? false,
    canEdit: data.permission?.can_edit ?? false,
    isAdmin: data.permission?.is_admin ?? false,
    isOwner: data.permission?.is_owner ?? false,
    role: (data.permission?.role as BacklotMemberRole) || null,
  } : undefined;

  // Derive canApprove from my_roles
  const myRoles = data?.my_roles || [];
  const primaryRole = myRoles.find((r: any) => r.is_primary) || myRoles[0];
  const backlotRole = primaryRole?.backlot_role;
  const isApprover = backlotRole ? APPROVER_ROLES.includes(backlotRole) : false;
  const isFirstAD = backlotRole === 'first_ad';
  const isDepartmentHead = backlotRole === 'department_head';
  const isOwnerOrAdmin = permission?.isOwner || permission?.isAdmin || false;

  // Derive todayShootDay from production_days
  const productionDays = data?.production_days || [];
  const today = new Date().toISOString().split('T')[0];
  const todayDay = productionDays.find((d: any) => d.date === today) || null;

  return {
    ...query,
    project: data?.project as BacklotProject | undefined,
    permission,
    viewConfig: data?.view_config,
    canViewAsRole: data?.can_manage_roles ?? false,
    todayDay,
    hasShootToday: !!todayDay,
    canViewApprovalsDashboard: isApprover || isOwnerOrAdmin,
  };
}
