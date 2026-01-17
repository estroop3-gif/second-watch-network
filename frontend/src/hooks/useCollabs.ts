/**
 * useCollabs - Hook for fetching and managing community collabs
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { CommunityCollab, CollabType, CompensationType } from '@/types/community';

interface UseCollabsOptions {
  type?: CollabType | 'all';
  isRemote?: boolean | null;
  compensationType?: CompensationType | 'all';
  orderOnly?: boolean;
  userId?: string;
  limit?: number;
}

interface CollabInput {
  title: string;
  type: CollabType;
  description: string;
  location?: string;
  is_remote?: boolean;
  compensation_type?: CompensationType;
  start_date?: string;
  end_date?: string;
  tags?: string[];
  is_order_only?: boolean;
  // Backlot project link
  backlot_project_id?: string;
  // Production info
  production_type?: string;
  production_title?: string;
  production_id?: string;
  company?: string;
  company_id?: string;
  network_id?: string;
  hide_production_info?: boolean;
  // Job type
  job_type?: string;
  // Freelance compensation
  day_rate_min?: number;
  day_rate_max?: number;
  // Full-time compensation
  salary_min?: number;
  salary_max?: number;
  benefits_info?: string;
  // Application requirements
  requires_local_hire?: boolean;
  requires_order_member?: boolean;
  requires_resume?: boolean;
  application_deadline?: string;
  max_applications?: number;
  // Union and Order requirements
  union_requirements?: string[];
  requires_order_membership?: boolean;
  // Custom questions
  custom_questions?: Array<{ question: string; type: string; required: boolean; options?: string[] }>;
  // Featured post
  is_featured?: boolean;
  // Cast-specific requirements
  cast_position_type_id?: string;
  requires_reel?: boolean;
  requires_headshot?: boolean;
  requires_self_tape?: boolean;
  tape_instructions?: string;
  tape_format_preferences?: string;
  tape_workflow?: string;
}

export function useCollabs(options: UseCollabsOptions = {}) {
  const {
    type = 'all',
    isRemote = null,
    compensationType = 'all',
    orderOnly = false,
    userId,
    limit = 50,
  } = options;

  const queryClient = useQueryClient();

  const queryKey = ['community-collabs', { type, isRemote, compensationType, orderOnly, userId, limit }];

  const { data, isLoading, error, refetch } = useQuery({
    queryKey,
    queryFn: async () => {
      const collabsData = await api.listCollabs({
        type: type !== 'all' ? type : undefined,
        isRemote: isRemote !== null ? isRemote : undefined,
        compensationType: compensationType !== 'all' ? compensationType : undefined,
        orderOnly,
        userId,
        limit,
      });

      return (collabsData || []) as CommunityCollab[];
    },
  });

  const createCollab = useMutation({
    mutationFn: async (input: CollabInput) => {
      const data = await api.createCollab({
        title: input.title,
        type: input.type,
        description: input.description,
        location: input.location || undefined,
        is_remote: input.is_remote || false,
        compensation_type: input.compensation_type || undefined,
        start_date: input.start_date || undefined,
        end_date: input.end_date || undefined,
        tags: input.tags || [],
        is_order_only: input.is_order_only || false,
        // Backlot project link
        backlot_project_id: input.backlot_project_id || undefined,
        // Production info
        production_type: input.production_type || undefined,
        production_title: input.production_title || undefined,
        production_id: input.production_id || undefined,
        company: input.company || undefined,
        company_id: input.company_id || undefined,
        network_id: input.network_id || undefined,
        hide_production_info: input.hide_production_info || false,
        // Job type
        job_type: input.job_type || undefined,
        // Freelance compensation
        day_rate_min: input.day_rate_min || undefined,
        day_rate_max: input.day_rate_max || undefined,
        // Full-time compensation
        salary_min: input.salary_min || undefined,
        salary_max: input.salary_max || undefined,
        benefits_info: input.benefits_info || undefined,
        // Application requirements
        requires_local_hire: input.requires_local_hire || false,
        requires_order_member: input.requires_order_member || false,
        requires_resume: input.requires_resume || false,
        application_deadline: input.application_deadline || undefined,
        max_applications: input.max_applications || undefined,
        // Union and Order requirements
        union_requirements: input.union_requirements || undefined,
        requires_order_membership: input.requires_order_membership || false,
        // Custom questions
        custom_questions: input.custom_questions || undefined,
        // Featured post
        is_featured: input.is_featured || false,
        // Cast-specific requirements
        cast_position_type_id: input.cast_position_type_id || undefined,
        requires_reel: input.requires_reel || false,
        requires_headshot: input.requires_headshot || false,
        requires_self_tape: input.requires_self_tape || false,
        tape_instructions: input.tape_instructions || undefined,
        tape_format_preferences: input.tape_format_preferences || undefined,
        tape_workflow: input.tape_workflow || undefined,
      });
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['community-collabs'] });
    },
  });

  const updateCollab = useMutation({
    mutationFn: async ({ id, ...input }: CollabInput & { id: string }) => {
      const data = await api.updateCollab(id, {
        title: input.title,
        type: input.type,
        description: input.description,
        location: input.location || undefined,
        is_remote: input.is_remote || false,
        compensation_type: input.compensation_type || undefined,
        start_date: input.start_date || undefined,
        end_date: input.end_date || undefined,
        tags: input.tags || [],
        is_order_only: input.is_order_only || false,
        // Backlot project link
        backlot_project_id: input.backlot_project_id || undefined,
        // Production info
        production_type: input.production_type || undefined,
        production_title: input.production_title || undefined,
        production_id: input.production_id || undefined,
        company: input.company || undefined,
        company_id: input.company_id || undefined,
        network_id: input.network_id || undefined,
        hide_production_info: input.hide_production_info || false,
        // Job type
        job_type: input.job_type || undefined,
        // Freelance compensation
        day_rate_min: input.day_rate_min || undefined,
        day_rate_max: input.day_rate_max || undefined,
        // Full-time compensation
        salary_min: input.salary_min || undefined,
        salary_max: input.salary_max || undefined,
        benefits_info: input.benefits_info || undefined,
        // Application requirements
        requires_local_hire: input.requires_local_hire || false,
        requires_order_member: input.requires_order_member || false,
        requires_resume: input.requires_resume || false,
        application_deadline: input.application_deadline || undefined,
        max_applications: input.max_applications || undefined,
        // Union and Order requirements
        union_requirements: input.union_requirements || undefined,
        requires_order_membership: input.requires_order_membership || false,
        // Custom questions
        custom_questions: input.custom_questions || undefined,
        // Featured post
        is_featured: input.is_featured || false,
        // Cast-specific requirements
        cast_position_type_id: input.cast_position_type_id || undefined,
        requires_reel: input.requires_reel || false,
        requires_headshot: input.requires_headshot || false,
        requires_self_tape: input.requires_self_tape || false,
        tape_instructions: input.tape_instructions || undefined,
        tape_format_preferences: input.tape_format_preferences || undefined,
        tape_workflow: input.tape_workflow || undefined,
      });
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['community-collabs'] });
      queryClient.invalidateQueries({ queryKey: ['project-collabs'] });
    },
  });

  const deleteCollab = useMutation({
    mutationFn: async (id: string) => {
      await api.deleteCollab(id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['community-collabs'] });
    },
  });

  const deactivateCollab = useMutation({
    mutationFn: async (id: string) => {
      await api.deactivateCollab(id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['community-collabs'] });
    },
  });

  return {
    collabs: data || [],
    isLoading,
    error,
    refetch,
    createCollab,
    updateCollab,
    deleteCollab,
    deactivateCollab,
  };
}

export function useCollab(id: string | null) {
  return useQuery({
    queryKey: ['community-collab', id],
    queryFn: async () => {
      if (!id) return null;
      const collab = await api.getCollab(id);
      return collab as CommunityCollab;
    },
    enabled: !!id,
  });
}
