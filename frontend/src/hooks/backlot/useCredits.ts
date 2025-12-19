/**
 * useCredits - React Query hooks for Backlot project credits
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { BacklotProjectCredit, ProjectCreditInput, BacklotProfile } from '@/types/backlot';

const API_BASE = import.meta.env.VITE_API_URL || '';

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

  const query = useQuery({
    queryKey: ['backlot', 'credits', projectId],
    queryFn: async () => {
      if (!projectId) return [];

      const token = api.getToken();
      if (!token) throw new Error('Not authenticated');

      const response = await fetch(`${API_BASE}/api/v1/backlot/projects/${projectId}/credits`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({ detail: 'Failed to fetch credits' }));
        throw new Error(error.detail);
      }

      return (await response.json()) as BacklotProjectCredit[];
    },
    enabled: !!projectId,
  });

  // Create credit
  const createCredit = useMutation({
    mutationFn: async (input: ProjectCreditInput & { project_id: string }) => {
      const token = api.getToken();
      if (!token) throw new Error('Not authenticated');

      const response = await fetch(`${API_BASE}/api/v1/backlot/projects/${input.project_id}/credits`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          department: input.department,
          role: input.role,
          name: input.name,
          user_id: input.user_id,
          is_primary: input.is_primary ?? false,
          is_public: input.is_public ?? true,
          order_index: input.order_index ?? 0,
        }),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({ detail: 'Failed to create credit' }));
        throw new Error(error.detail);
      }

      return await response.json();
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
      const token = api.getToken();
      if (!token) throw new Error('Not authenticated');

      const response = await fetch(`${API_BASE}/api/v1/backlot/credits/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          department: updates.department,
          role: updates.role,
          name: updates.name,
          user_id: updates.user_id,
          is_primary: updates.is_primary ?? false,
          is_public: updates.is_public ?? true,
          order_index: updates.order_index ?? 0,
        }),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({ detail: 'Failed to update credit' }));
        throw new Error(error.detail);
      }

      return await response.json();
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
      const token = api.getToken();
      if (!token) throw new Error('Not authenticated');

      const response = await fetch(`${API_BASE}/api/v1/backlot/credits/${id}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({ detail: 'Failed to delete credit' }));
        throw new Error(error.detail);
      }

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
      const token = api.getToken();
      if (!token) throw new Error('Not authenticated');

      const response = await fetch(`${API_BASE}/api/v1/backlot/projects/${project_id}/credits/reorder`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(credits),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({ detail: 'Failed to reorder credits' }));
        throw new Error(error.detail);
      }

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
      const token = api.getToken();
      if (!token) throw new Error('Not authenticated');

      const response = await fetch(`${API_BASE}/api/v1/backlot/credits/${id}/primary`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ is_primary }),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({ detail: 'Failed to toggle primary' }));
        throw new Error(error.detail);
      }

      return await response.json();
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
      const token = api.getToken();
      if (!token) throw new Error('Not authenticated');

      const response = await fetch(`${API_BASE}/api/v1/backlot/credits/${id}/public`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ is_public }),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({ detail: 'Failed to toggle public' }));
        throw new Error(error.detail);
      }

      return await response.json();
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

      const response = await fetch(`${API_BASE}/api/v1/backlot/projects/${projectId}/credits/public`);

      if (!response.ok) {
        const error = await response.json().catch(() => ({ detail: 'Failed to fetch public credits' }));
        throw new Error(error.detail);
      }

      return (await response.json()) as BacklotProjectCredit[];
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
