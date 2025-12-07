/**
 * useProjects - Hook for fetching and managing Backlot projects
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import {
  BacklotProject,
  BacklotProjectMember,
  ProjectInput,
  ProjectMemberInput,
  ProjectFilters,
  BacklotMemberRole,
} from '@/types/backlot';

interface UseProjectsOptions extends ProjectFilters {
  limit?: number;
}

// Fetch all projects for the current user
export function useProjects(options: UseProjectsOptions = {}) {
  const { status = 'all', visibility = 'all', search, limit = 50 } = options;
  const queryClient = useQueryClient();

  const queryKey = ['backlot-projects', { status, visibility, search, limit }];

  const { data, isLoading, error, refetch } = useQuery({
    queryKey,
    queryFn: async () => {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) throw new Error('Not authenticated');

      // First get projects where user is owner or member
      const { data: memberProjects } = await supabase
        .from('backlot_project_members')
        .select('project_id')
        .eq('user_id', userData.user.id);

      const memberProjectIds = memberProjects?.map(m => m.project_id) || [];

      // Build query for projects
      let query = supabase
        .from('backlot_projects')
        .select('*')
        .order('updated_at', { ascending: false })
        .limit(limit);

      // Filter to owned or member projects
      if (memberProjectIds.length > 0) {
        query = query.or(`owner_id.eq.${userData.user.id},id.in.(${memberProjectIds.join(',')})`);
      } else {
        query = query.eq('owner_id', userData.user.id);
      }

      if (status !== 'all') {
        query = query.eq('status', status);
      }

      if (visibility !== 'all') {
        query = query.eq('visibility', visibility);
      }

      if (search) {
        query = query.ilike('title', `%${search}%`);
      }

      const { data: projectsData, error } = await query;
      if (error) throw error;
      if (!projectsData || projectsData.length === 0) return [];

      // Fetch owner profiles
      const ownerIds = [...new Set(projectsData.map(p => p.owner_id))];
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, username, full_name, display_name, avatar_url, role, is_order_member')
        .in('id', ownerIds);

      const profileMap = new Map(profiles?.map(p => [p.id, p]) || []);

      return projectsData.map(project => ({
        ...project,
        owner: profileMap.get(project.owner_id) || null,
      })) as BacklotProject[];
    },
  });

  const createProject = useMutation({
    mutationFn: async (input: ProjectInput) => {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) throw new Error('Not authenticated');

      const { data, error } = await supabase
        .from('backlot_projects')
        .insert({
          owner_id: userData.user.id,
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
        })
        .select()
        .single();

      if (error) throw error;

      // Also add the owner as an admin member so RLS policies work correctly
      const { error: memberError } = await supabase
        .from('backlot_project_members')
        .insert({
          project_id: data.id,
          user_id: userData.user.id,
          role: 'admin',
        });

      if (memberError) {
        console.error('Failed to add owner as member:', memberError);
        // Don't throw - project was created, member insert might fail due to RLS
        // but the owner_id on the project will still work for ownership checks
      }

      return data as BacklotProject;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['backlot-projects'] });
    },
  });

  const updateProject = useMutation({
    mutationFn: async ({ id, ...input }: ProjectInput & { id: string }) => {
      const { data, error } = await supabase
        .from('backlot_projects')
        .update({
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
        })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data as BacklotProject;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['backlot-projects'] });
      queryClient.invalidateQueries({ queryKey: ['backlot-project', data.id] });
      queryClient.invalidateQueries({ queryKey: ['backlot-project-slug', data.slug] });
    },
  });

  const deleteProject = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('backlot_projects')
        .delete()
        .eq('id', id);

      if (error) throw error;
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

// Fetch a single project by ID
export function useProject(id: string | null) {
  return useQuery({
    queryKey: ['backlot-project', id],
    queryFn: async () => {
      if (!id) return null;

      const { data: project, error } = await supabase
        .from('backlot_projects')
        .select('*')
        .eq('id', id)
        .single();

      if (error) throw error;

      // Fetch owner profile
      const { data: owner } = await supabase
        .from('profiles')
        .select('id, username, full_name, display_name, avatar_url, role, is_order_member')
        .eq('id', project.owner_id)
        .single();

      return { ...project, owner } as BacklotProject;
    },
    enabled: !!id,
  });
}

// Fetch a project by slug (for public pages)
export function useProjectBySlug(slug: string | null) {
  return useQuery({
    queryKey: ['backlot-project-slug', slug],
    queryFn: async () => {
      if (!slug) return null;

      const { data: project, error } = await supabase
        .from('backlot_projects')
        .select('*')
        .eq('slug', slug)
        .single();

      if (error) throw error;

      // Fetch owner profile
      const { data: owner } = await supabase
        .from('profiles')
        .select('id, username, full_name, display_name, avatar_url, role, is_order_member')
        .eq('id', project.owner_id)
        .single();

      return { ...project, owner } as BacklotProject;
    },
    enabled: !!slug,
  });
}

// Fetch project members
export function useProjectMembers(projectId: string | null) {
  const queryClient = useQueryClient();

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['backlot-project-members', projectId],
    queryFn: async () => {
      if (!projectId) return [];

      const { data: membersData, error } = await supabase
        .from('backlot_project_members')
        .select('*')
        .eq('project_id', projectId)
        .order('joined_at', { ascending: true });

      if (error) throw error;
      if (!membersData || membersData.length === 0) return [];

      // Fetch profiles
      const userIds = [...new Set(membersData.map(m => m.user_id))];
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, username, full_name, display_name, avatar_url, role, is_order_member')
        .in('id', userIds);

      const profileMap = new Map(profiles?.map(p => [p.id, p]) || []);

      return membersData.map(member => ({
        ...member,
        profile: profileMap.get(member.user_id) || null,
      })) as BacklotProjectMember[];
    },
    enabled: !!projectId,
  });

  const addMember = useMutation({
    mutationFn: async ({ projectId, ...input }: ProjectMemberInput & { projectId: string }) => {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) throw new Error('Not authenticated');

      const { data, error } = await supabase
        .from('backlot_project_members')
        .insert({
          project_id: projectId,
          user_id: input.user_id,
          role: input.role || 'viewer',
          production_role: input.production_role || null,
          department: input.department || null,
          phone: input.phone || null,
          email: input.email || null,
          invited_by: userData.user.id,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['backlot-project-members', projectId] });
    },
  });

  const updateMember = useMutation({
    mutationFn: async ({ id, ...input }: Partial<ProjectMemberInput> & { id: string }) => {
      const updateData: Record<string, any> = {};
      if (input.role !== undefined) updateData.role = input.role;
      if (input.production_role !== undefined) updateData.production_role = input.production_role;
      if (input.department !== undefined) updateData.department = input.department;
      if (input.phone !== undefined) updateData.phone = input.phone;
      if (input.email !== undefined) updateData.email = input.email;

      const { data, error } = await supabase
        .from('backlot_project_members')
        .update(updateData)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['backlot-project-members', projectId] });
    },
  });

  const removeMember = useMutation({
    mutationFn: async (memberId: string) => {
      const { error } = await supabase
        .from('backlot_project_members')
        .delete()
        .eq('id', memberId);

      if (error) throw error;
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
  return useQuery({
    queryKey: ['backlot-project-permission', projectId],
    queryFn: async () => {
      if (!projectId) return { canView: false, canEdit: false, isAdmin: false, isOwner: false, role: null as BacklotMemberRole | null };

      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) return { canView: false, canEdit: false, isAdmin: false, isOwner: false, role: null };

      // Check if owner
      const { data: project } = await supabase
        .from('backlot_projects')
        .select('owner_id, visibility')
        .eq('id', projectId)
        .single();

      if (!project) return { canView: false, canEdit: false, isAdmin: false, isOwner: false, role: null };

      const isOwner = project.owner_id === userData.user.id;

      if (isOwner) {
        return { canView: true, canEdit: true, isAdmin: true, isOwner: true, role: 'owner' as BacklotMemberRole };
      }

      // Check membership
      const { data: member } = await supabase
        .from('backlot_project_members')
        .select('role')
        .eq('project_id', projectId)
        .eq('user_id', userData.user.id)
        .single();

      if (member) {
        const role = member.role as BacklotMemberRole;
        const canEdit = ['owner', 'admin', 'editor'].includes(role);
        const isAdmin = ['owner', 'admin'].includes(role);
        return { canView: true, canEdit, isAdmin, isOwner: false, role };
      }

      // Check if public/unlisted
      if (project.visibility === 'public' || project.visibility === 'unlisted') {
        return { canView: true, canEdit: false, isAdmin: false, isOwner: false, role: null };
      }

      return { canView: false, canEdit: false, isAdmin: false, isOwner: false, role: null };
    },
    enabled: !!projectId,
  });
}
