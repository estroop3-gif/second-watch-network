/**
 * useProjectRoles - Hook for managing Backlot project roles and view configurations
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { BacklotProfile } from '@/types/backlot';

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
      overview: true, script: true, 'shot-lists': true, coverage: true,
      schedule: true, 'call-sheets': true, casting: true, locations: true,
      gear: true, dailies: true, review: true, assets: true,
      budget: true, 'daily-budget': true, receipts: true, analytics: true,
      tasks: true, updates: true, contacts: true,
      clearances: true, credits: true, roles: true, settings: true,
    },
    sections: { budget_numbers: true, admin_tools: true },
  },
  producer: {
    tabs: {
      overview: true, script: true, 'shot-lists': true, coverage: true,
      schedule: true, 'call-sheets': true, casting: true, locations: true,
      gear: true, dailies: true, review: true, assets: true,
      budget: true, 'daily-budget': true, receipts: true, analytics: true,
      tasks: true, updates: true, contacts: true,
      clearances: true, credits: true, roles: false, settings: false,
    },
    sections: { budget_numbers: true, admin_tools: false },
  },
  director: {
    tabs: {
      overview: true, script: true, 'shot-lists': true, coverage: true,
      schedule: true, 'call-sheets': true, casting: true, locations: true,
      gear: true, dailies: true, review: true, assets: true,
      budget: false, 'daily-budget': false, receipts: false, analytics: false,
      tasks: true, updates: true, contacts: true,
      clearances: true, credits: true, roles: false, settings: false,
    },
    sections: { budget_numbers: false, admin_tools: false },
  },
  first_ad: {
    tabs: {
      overview: true, script: true, 'shot-lists': true, coverage: true,
      schedule: true, 'call-sheets': true, casting: true, locations: true,
      gear: true, dailies: true, review: true, assets: false,
      budget: false, 'daily-budget': true, receipts: false, analytics: false,
      tasks: true, updates: true, contacts: true,
      clearances: true, credits: false, roles: false, settings: false,
    },
    sections: { budget_numbers: false, admin_tools: false },
  },
  dp: {
    tabs: {
      overview: true, script: true, 'shot-lists': true, coverage: true,
      schedule: true, 'call-sheets': true, casting: false, locations: true,
      gear: true, dailies: true, review: true, assets: false,
      budget: false, 'daily-budget': false, receipts: false, analytics: false,
      tasks: true, updates: true, contacts: false,
      clearances: false, credits: false, roles: false, settings: false,
    },
    sections: { budget_numbers: false, admin_tools: false },
  },
  editor: {
    tabs: {
      overview: true, script: true, 'shot-lists': true, coverage: true,
      schedule: false, 'call-sheets': false, casting: false, locations: false,
      gear: false, dailies: true, review: true, assets: true,
      budget: false, 'daily-budget': false, receipts: false, analytics: false,
      tasks: true, updates: true, contacts: false,
      clearances: false, credits: true, roles: false, settings: false,
    },
    sections: { budget_numbers: false, admin_tools: false },
  },
  department_head: {
    tabs: {
      overview: true, script: true, 'shot-lists': true, coverage: true,
      schedule: true, 'call-sheets': true, casting: true, locations: true,
      gear: true, dailies: true, review: true, assets: false,
      budget: false, 'daily-budget': true, receipts: false, analytics: false,
      tasks: true, updates: true, contacts: true,
      clearances: true, credits: false, roles: false, settings: false,
    },
    sections: { budget_numbers: false, admin_tools: false },
  },
  crew: {
    tabs: {
      overview: true, script: true, 'shot-lists': false, coverage: false,
      schedule: true, 'call-sheets': true, casting: false, locations: false,
      gear: false, dailies: false, review: false, assets: false,
      budget: false, 'daily-budget': false, receipts: false, analytics: false,
      tasks: true, updates: true, contacts: false,
      clearances: false, credits: false, roles: false, settings: false,
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

      const { data: rolesData, error } = await supabase
        .from('backlot_project_roles')
        .select('*')
        .eq('project_id', projectId)
        .order('created_at', { ascending: true });

      if (error) throw error;
      if (!rolesData || rolesData.length === 0) return [];

      // Fetch user profiles
      const userIds = [...new Set(rolesData.map(r => r.user_id))];
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, username, full_name, display_name, avatar_url, role, is_order_member')
        .in('id', userIds);

      const profileMap = new Map(profiles?.map(p => [p.id, p]) || []);

      return rolesData.map(role => ({
        ...role,
        profile: profileMap.get(role.user_id) || null,
      })) as BacklotProjectRole[];
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
      // If setting as primary, clear other primary roles for this user
      if (isPrimary) {
        await supabase
          .from('backlot_project_roles')
          .update({ is_primary: false })
          .eq('project_id', projectId)
          .eq('user_id', userId);
      }

      const { data, error } = await supabase
        .from('backlot_project_roles')
        .upsert({
          project_id: projectId,
          user_id: userId,
          backlot_role: backlotRole,
          is_primary: isPrimary,
        }, {
          onConflict: 'project_id,user_id,backlot_role',
        })
        .select()
        .single();

      if (error) throw error;
      return data as BacklotProjectRole;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['backlot-project-roles'] });
      queryClient.invalidateQueries({ queryKey: ['backlot-project-members-access'] });
      queryClient.invalidateQueries({ queryKey: ['backlot-view-config'] });
    },
  });

  const removeRole = useMutation({
    mutationFn: async (roleId: string) => {
      const { error } = await supabase
        .from('backlot_project_roles')
        .delete()
        .eq('id', roleId);

      if (error) throw error;
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
      // Clear other primary roles for this user
      await supabase
        .from('backlot_project_roles')
        .update({ is_primary: false })
        .eq('project_id', projectId)
        .eq('user_id', userId);

      // Set the selected role as primary
      const { data, error } = await supabase
        .from('backlot_project_roles')
        .update({ is_primary: true })
        .eq('id', roleId)
        .select()
        .single();

      if (error) throw error;
      return data as BacklotProjectRole;
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

      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) return [];

      const { data, error } = await supabase
        .from('backlot_project_roles')
        .select('*')
        .eq('project_id', projectId)
        .eq('user_id', userData.user.id);

      if (error) throw error;
      return (data || []) as BacklotProjectRole[];
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

      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) {
        return { role: 'crew', ...DEFAULT_VIEW_CONFIGS.crew };
      }

      // Check if user is project owner
      const { data: project } = await supabase
        .from('backlot_projects')
        .select('owner_id')
        .eq('id', projectId)
        .single();

      if (project?.owner_id === userData.user.id) {
        return { role: 'owner', ...DEFAULT_VIEW_CONFIGS.showrunner };
      }

      // Check user's profile for global admin status
      const { data: profile } = await supabase
        .from('profiles')
        .select('is_admin, is_superadmin')
        .eq('id', userData.user.id)
        .single();

      if (profile?.is_superadmin || profile?.is_admin) {
        return { role: 'admin', ...DEFAULT_VIEW_CONFIGS.showrunner };
      }

      // Get user's primary backlot role
      const { data: roles } = await supabase
        .from('backlot_project_roles')
        .select('backlot_role, is_primary')
        .eq('project_id', projectId)
        .eq('user_id', userData.user.id)
        .order('is_primary', { ascending: false });

      const primaryRole = roles?.find(r => r.is_primary)?.backlot_role || roles?.[0]?.backlot_role || 'crew';

      // Check for custom view profile
      const { data: customProfile } = await supabase
        .from('backlot_project_view_profiles')
        .select('config')
        .eq('project_id', projectId)
        .eq('backlot_role', primaryRole)
        .eq('is_default', true)
        .single();

      if (customProfile?.config) {
        return { role: primaryRole, config: customProfile.config as ViewConfig };
      }

      // Return default config for the role
      const defaultConfig = DEFAULT_VIEW_CONFIGS[primaryRole] || DEFAULT_VIEW_CONFIGS.crew;
      return { role: primaryRole, ...defaultConfig };
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

      const { data, error } = await supabase
        .from('backlot_project_view_profiles')
        .select('*')
        .eq('project_id', projectId)
        .order('backlot_role', { ascending: true });

      if (error) throw error;
      return (data || []) as BacklotViewProfile[];
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
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) throw new Error('Not authenticated');

      // If setting as default, clear other defaults for this role
      if (isDefault) {
        await supabase
          .from('backlot_project_view_profiles')
          .update({ is_default: false })
          .eq('project_id', projectId)
          .eq('backlot_role', backlotRole);
      }

      const { data, error } = await supabase
        .from('backlot_project_view_profiles')
        .insert({
          project_id: projectId,
          backlot_role: backlotRole,
          label,
          config,
          is_default: isDefault,
          created_by_user_id: userData.user.id,
        })
        .select()
        .single();

      if (error) throw error;
      return data as BacklotViewProfile;
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
      const updateData: Record<string, any> = {};
      if (label !== undefined) updateData.label = label;
      if (config !== undefined) updateData.config = config;
      if (isDefault !== undefined) updateData.is_default = isDefault;

      const { data, error } = await supabase
        .from('backlot_project_view_profiles')
        .update(updateData)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data as BacklotViewProfile;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['backlot-view-profiles'] });
      queryClient.invalidateQueries({ queryKey: ['backlot-view-config'] });
    },
  });

  const deleteViewProfile = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('backlot_project_view_profiles')
        .delete()
        .eq('id', id);

      if (error) throw error;
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

      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) return false;

      // Check if project owner
      const { data: project } = await supabase
        .from('backlot_projects')
        .select('owner_id')
        .eq('id', projectId)
        .single();

      if (project?.owner_id === userData.user.id) return true;

      // Check global admin status
      const { data: profile } = await supabase
        .from('profiles')
        .select('is_admin, is_superadmin')
        .eq('id', userData.user.id)
        .single();

      if (profile?.is_superadmin || profile?.is_admin) return true;

      // Check if showrunner
      const { data: roles } = await supabase
        .from('backlot_project_roles')
        .select('backlot_role')
        .eq('project_id', projectId)
        .eq('user_id', userData.user.id)
        .eq('backlot_role', 'showrunner');

      return (roles?.length || 0) > 0;
    },
    enabled: !!projectId,
  });
}

// Helper to check if user can use "View as Role" feature
export function useCanViewAsRole(projectId: string | null) {
  return useQuery({
    queryKey: ['backlot-can-view-as-role', projectId],
    queryFn: async () => {
      if (!projectId) return false;

      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) return false;

      // Check global admin/superadmin
      const { data: profile } = await supabase
        .from('profiles')
        .select('is_admin, is_superadmin')
        .eq('id', userData.user.id)
        .single();

      if (profile?.is_superadmin || profile?.is_admin) return true;

      // Check if project owner
      const { data: project } = await supabase
        .from('backlot_projects')
        .select('owner_id')
        .eq('id', projectId)
        .single();

      if (project?.owner_id === userData.user.id) return true;

      // Check if showrunner
      const { data: roles } = await supabase
        .from('backlot_project_roles')
        .select('backlot_role')
        .eq('project_id', projectId)
        .eq('user_id', userData.user.id)
        .eq('backlot_role', 'showrunner');

      return (roles?.length || 0) > 0;
    },
    enabled: !!projectId,
  });
}
