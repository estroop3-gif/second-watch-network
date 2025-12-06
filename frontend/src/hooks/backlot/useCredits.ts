/**
 * useCredits - React Query hooks for Backlot project credits
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/context/AuthContext';
import { BacklotProjectCredit, ProjectCreditInput, BacklotProfile } from '@/types/backlot';

// Predefined credit departments
export const CREDIT_DEPARTMENTS = [
  'Direction',
  'Production',
  'Writing',
  'Camera',
  'Lighting',
  'Sound',
  'Art',
  'Costume',
  'Makeup',
  'Editing',
  'Visual Effects',
  'Music',
  'Cast',
  'Stunts',
  'Locations',
  'Transportation',
  'Catering',
  'Other',
] as const;

// Common credit roles by department
export const CREDIT_ROLES: Record<string, string[]> = {
  Direction: ['Director', 'First Assistant Director', 'Second Assistant Director', 'Script Supervisor'],
  Production: ['Producer', 'Executive Producer', 'Co-Producer', 'Associate Producer', 'Line Producer', 'Production Manager', 'Production Coordinator', 'Production Assistant'],
  Writing: ['Writer', 'Screenwriter', 'Co-Writer', 'Story By'],
  Camera: ['Director of Photography', 'Cinematographer', 'Camera Operator', 'First AC', 'Second AC', 'Steadicam Operator', 'DIT'],
  Lighting: ['Gaffer', 'Best Boy Electric', 'Electrician', 'Lighting Technician'],
  Sound: ['Production Sound Mixer', 'Boom Operator', 'Sound Designer', 'Composer', 'Music Supervisor'],
  Art: ['Production Designer', 'Art Director', 'Set Decorator', 'Props Master', 'Set Dresser'],
  Costume: ['Costume Designer', 'Wardrobe Supervisor', 'Wardrobe Assistant'],
  Makeup: ['Makeup Artist', 'Hair Stylist', 'Special Effects Makeup'],
  Editing: ['Editor', 'Assistant Editor', 'Colorist'],
  'Visual Effects': ['VFX Supervisor', 'VFX Artist', 'Compositor'],
  Music: ['Composer', 'Music Supervisor', 'Music Editor'],
  Cast: ['Lead Actor', 'Supporting Actor', 'Featured Extra', 'Voice Actor'],
  Stunts: ['Stunt Coordinator', 'Stunt Performer'],
  Locations: ['Location Manager', 'Location Scout'],
  Transportation: ['Transportation Coordinator', 'Driver'],
  Catering: ['Craft Services', 'Catering'],
  Other: ['Other'],
};

/**
 * Get all credits for a project
 */
export function useCredits(projectId: string | null) {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  const query = useQuery({
    queryKey: ['backlot', 'credits', projectId],
    queryFn: async () => {
      if (!projectId) return [];

      const { data, error } = await supabase
        .from('backlot_project_credits')
        .select('*')
        .eq('project_id', projectId)
        .order('department', { ascending: true })
        .order('order_index', { ascending: true });

      if (error) throw error;

      // Fetch linked user profiles
      const userIds = data
        .filter((c) => c.user_id)
        .map((c) => c.user_id as string);

      let profilesMap: Record<string, BacklotProfile> = {};
      if (userIds.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, username, full_name, display_name, avatar_url, role')
          .in('id', userIds);

        if (profiles) {
          profilesMap = profiles.reduce((acc, p) => {
            acc[p.id] = p as BacklotProfile;
            return acc;
          }, {} as Record<string, BacklotProfile>);
        }
      }

      return data.map((credit) => ({
        ...credit,
        linked_user: credit.user_id ? profilesMap[credit.user_id] : undefined,
      })) as BacklotProjectCredit[];
    },
    enabled: !!projectId,
  });

  // Create credit
  const createCredit = useMutation({
    mutationFn: async (input: ProjectCreditInput & { project_id: string }) => {
      const { data, error } = await supabase
        .from('backlot_project_credits')
        .insert({
          ...input,
          created_by: user?.id,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: ['backlot', 'credits', variables.project_id],
      });
    },
  });

  // Update credit
  const updateCredit = useMutation({
    mutationFn: async ({
      id,
      ...updates
    }: Partial<ProjectCreditInput> & { id: string; project_id: string }) => {
      const { data, error } = await supabase
        .from('backlot_project_credits')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: ['backlot', 'credits', variables.project_id],
      });
    },
  });

  // Delete credit
  const deleteCredit = useMutation({
    mutationFn: async ({ id, project_id }: { id: string; project_id: string }) => {
      const { error } = await supabase
        .from('backlot_project_credits')
        .delete()
        .eq('id', id);

      if (error) throw error;
      return { id, project_id };
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: ['backlot', 'credits', variables.project_id],
      });
    },
  });

  // Reorder credits within a department
  const reorderCredits = useMutation({
    mutationFn: async ({
      project_id,
      credits,
    }: {
      project_id: string;
      credits: { id: string; order_index: number }[];
    }) => {
      // Update each credit's order_index
      const updates = credits.map((c) =>
        supabase
          .from('backlot_project_credits')
          .update({ order_index: c.order_index })
          .eq('id', c.id)
      );

      await Promise.all(updates);
      return { project_id };
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: ['backlot', 'credits', variables.project_id],
      });
    },
  });

  // Toggle primary status
  const togglePrimary = useMutation({
    mutationFn: async ({
      id,
      is_primary,
      project_id,
    }: {
      id: string;
      is_primary: boolean;
      project_id: string;
    }) => {
      const { data, error } = await supabase
        .from('backlot_project_credits')
        .update({ is_primary })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: ['backlot', 'credits', variables.project_id],
      });
    },
  });

  // Toggle public visibility
  const togglePublic = useMutation({
    mutationFn: async ({
      id,
      is_public,
      project_id,
    }: {
      id: string;
      is_public: boolean;
      project_id: string;
    }) => {
      const { data, error } = await supabase
        .from('backlot_project_credits')
        .update({ is_public })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: ['backlot', 'credits', variables.project_id],
      });
    },
  });

  return {
    credits: query.data || [],
    isLoading: query.isLoading,
    error: query.error,
    createCredit,
    updateCredit,
    deleteCredit,
    reorderCredits,
    togglePrimary,
    togglePublic,
  };
}

/**
 * Get public credits for a project (for public project page)
 */
export function usePublicCredits(projectId: string | null) {
  return useQuery({
    queryKey: ['backlot', 'credits', 'public', projectId],
    queryFn: async () => {
      if (!projectId) return [];

      const { data, error } = await supabase
        .from('backlot_project_credits')
        .select('*')
        .eq('project_id', projectId)
        .eq('is_public', true)
        .order('is_primary', { ascending: false })
        .order('department', { ascending: true })
        .order('order_index', { ascending: true });

      if (error) throw error;

      // Fetch linked user profiles
      const userIds = data
        .filter((c) => c.user_id)
        .map((c) => c.user_id as string);

      let profilesMap: Record<string, BacklotProfile> = {};
      if (userIds.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, username, full_name, display_name, avatar_url, role')
          .in('id', userIds);

        if (profiles) {
          profilesMap = profiles.reduce((acc, p) => {
            acc[p.id] = p as BacklotProfile;
            return acc;
          }, {} as Record<string, BacklotProfile>);
        }
      }

      return data.map((credit) => ({
        ...credit,
        linked_user: credit.user_id ? profilesMap[credit.user_id] : undefined,
      })) as BacklotProjectCredit[];
    },
    enabled: !!projectId,
  });
}

/**
 * Get credits grouped by department
 */
export function useCreditsByDepartment(projectId: string | null) {
  const { credits, isLoading, error } = useCredits(projectId);

  const groupedCredits = credits.reduce((acc, credit) => {
    const dept = credit.department || 'Other';
    if (!acc[dept]) {
      acc[dept] = [];
    }
    acc[dept].push(credit);
    return acc;
  }, {} as Record<string, BacklotProjectCredit[]>);

  return {
    groupedCredits,
    departments: Object.keys(groupedCredits),
    isLoading,
    error,
  };
}
