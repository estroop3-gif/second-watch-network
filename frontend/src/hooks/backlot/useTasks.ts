/**
 * useTasks - Hook for managing production tasks
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import {
  BacklotTask,
  TaskInput,
  TaskFilters,
  BacklotTaskStatus,
} from '@/types/backlot';

interface UseTasksOptions extends TaskFilters {
  projectId: string | null;
  limit?: number;
}

export function useTasks(options: UseTasksOptions) {
  const {
    projectId,
    status = 'all',
    priority = 'all',
    assigned_to,
    department,
    production_day_id,
    limit = 100,
  } = options;

  const queryClient = useQueryClient();
  const queryKey = ['backlot-tasks', { projectId, status, priority, assigned_to, department, production_day_id, limit }];

  const { data, isLoading, error, refetch } = useQuery({
    queryKey,
    queryFn: async () => {
      if (!projectId) return [];

      let query = supabase
        .from('backlot_tasks')
        .select('*')
        .eq('project_id', projectId)
        .is('parent_task_id', null) // Only top-level tasks
        .order('position', { ascending: true })
        .limit(limit);

      if (status !== 'all') {
        query = query.eq('status', status);
      }

      if (priority !== 'all') {
        query = query.eq('priority', priority);
      }

      if (assigned_to) {
        query = query.eq('assigned_to', assigned_to);
      }

      if (department) {
        query = query.eq('department', department);
      }

      if (production_day_id) {
        query = query.eq('production_day_id', production_day_id);
      }

      const { data: tasksData, error } = await query;
      if (error) throw error;
      if (!tasksData || tasksData.length === 0) return [];

      // Fetch profiles for assigned users and creators
      const userIds = new Set<string>();
      tasksData.forEach(t => {
        if (t.assigned_to) userIds.add(t.assigned_to);
        if (t.created_by) userIds.add(t.created_by);
      });

      let profileMap = new Map<string, any>();
      if (userIds.size > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, username, full_name, display_name, avatar_url, role, is_order_member')
          .in('id', Array.from(userIds));
        profileMap = new Map(profiles?.map(p => [p.id, p]) || []);
      }

      // Fetch subtasks for each task
      const taskIds = tasksData.map(t => t.id);
      const { data: subtasks } = await supabase
        .from('backlot_tasks')
        .select('*')
        .in('parent_task_id', taskIds)
        .order('position', { ascending: true });

      const subtaskMap = new Map<string, BacklotTask[]>();
      subtasks?.forEach(st => {
        const parentId = st.parent_task_id!;
        if (!subtaskMap.has(parentId)) {
          subtaskMap.set(parentId, []);
        }
        subtaskMap.get(parentId)!.push({
          ...st,
          assignee: st.assigned_to ? profileMap.get(st.assigned_to) : null,
          creator: st.created_by ? profileMap.get(st.created_by) : null,
        } as BacklotTask);
      });

      return tasksData.map(task => ({
        ...task,
        assignee: task.assigned_to ? profileMap.get(task.assigned_to) : null,
        creator: task.created_by ? profileMap.get(task.created_by) : null,
        subtasks: subtaskMap.get(task.id) || [],
      })) as BacklotTask[];
    },
    enabled: !!projectId,
  });

  const createTask = useMutation({
    mutationFn: async (input: TaskInput & { projectId: string }) => {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) throw new Error('Not authenticated');

      // Get max position for ordering
      const { data: maxPosData } = await supabase
        .from('backlot_tasks')
        .select('position')
        .eq('project_id', input.projectId)
        .is('parent_task_id', input.parent_task_id || null)
        .order('position', { ascending: false })
        .limit(1)
        .single();

      const newPosition = (maxPosData?.position ?? -1) + 1;

      const { data, error } = await supabase
        .from('backlot_tasks')
        .insert({
          project_id: input.projectId,
          title: input.title,
          description: input.description || null,
          status: input.status || 'todo',
          priority: input.priority || 'medium',
          assigned_to: input.assigned_to || null,
          department: input.department || null,
          due_date: input.due_date || null,
          parent_task_id: input.parent_task_id || null,
          production_day_id: input.production_day_id || null,
          position: input.position ?? newPosition,
          created_by: userData.user.id,
        })
        .select()
        .single();

      if (error) throw error;
      return data as BacklotTask;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['backlot-tasks'] });
    },
  });

  const updateTask = useMutation({
    mutationFn: async ({ id, ...input }: Partial<TaskInput> & { id: string }) => {
      const updateData: Record<string, any> = {};
      if (input.title !== undefined) updateData.title = input.title;
      if (input.description !== undefined) updateData.description = input.description;
      if (input.status !== undefined) {
        updateData.status = input.status;
        if (input.status === 'completed') {
          updateData.completed_at = new Date().toISOString();
        } else {
          updateData.completed_at = null;
        }
      }
      if (input.priority !== undefined) updateData.priority = input.priority;
      if (input.assigned_to !== undefined) updateData.assigned_to = input.assigned_to;
      if (input.department !== undefined) updateData.department = input.department;
      if (input.due_date !== undefined) updateData.due_date = input.due_date;
      if (input.parent_task_id !== undefined) updateData.parent_task_id = input.parent_task_id;
      if (input.production_day_id !== undefined) updateData.production_day_id = input.production_day_id;
      if (input.position !== undefined) updateData.position = input.position;

      const { data, error } = await supabase
        .from('backlot_tasks')
        .update(updateData)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data as BacklotTask;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['backlot-tasks'] });
    },
  });

  const updateStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: BacklotTaskStatus }) => {
      const updateData: Record<string, any> = { status };
      if (status === 'completed') {
        updateData.completed_at = new Date().toISOString();
      } else {
        updateData.completed_at = null;
      }

      const { data, error } = await supabase
        .from('backlot_tasks')
        .update(updateData)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data as BacklotTask;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['backlot-tasks'] });
    },
  });

  const deleteTask = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('backlot_tasks')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['backlot-tasks'] });
    },
  });

  const reorderTasks = useMutation({
    mutationFn: async (orderedIds: string[]) => {
      const updates = orderedIds.map((id, index) =>
        supabase
          .from('backlot_tasks')
          .update({ position: index })
          .eq('id', id)
      );

      await Promise.all(updates);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['backlot-tasks'] });
    },
  });

  return {
    tasks: data || [],
    isLoading,
    error,
    refetch,
    createTask,
    updateTask,
    updateStatus,
    deleteTask,
    reorderTasks,
  };
}

// Fetch single task
export function useTask(id: string | null) {
  return useQuery({
    queryKey: ['backlot-task', id],
    queryFn: async () => {
      if (!id) return null;

      const { data: task, error } = await supabase
        .from('backlot_tasks')
        .select('*')
        .eq('id', id)
        .single();

      if (error) throw error;

      // Fetch profiles
      const userIds = new Set<string>();
      if (task.assigned_to) userIds.add(task.assigned_to);
      if (task.created_by) userIds.add(task.created_by);

      let profileMap = new Map<string, any>();
      if (userIds.size > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, username, full_name, display_name, avatar_url, role, is_order_member')
          .in('id', Array.from(userIds));
        profileMap = new Map(profiles?.map(p => [p.id, p]) || []);
      }

      // Fetch subtasks
      const { data: subtasks } = await supabase
        .from('backlot_tasks')
        .select('*')
        .eq('parent_task_id', id)
        .order('position', { ascending: true });

      return {
        ...task,
        assignee: task.assigned_to ? profileMap.get(task.assigned_to) : null,
        creator: task.created_by ? profileMap.get(task.created_by) : null,
        subtasks: subtasks || [],
      } as BacklotTask;
    },
    enabled: !!id,
  });
}

// Get task stats for a project
export function useTaskStats(projectId: string | null) {
  return useQuery({
    queryKey: ['backlot-task-stats', projectId],
    queryFn: async () => {
      if (!projectId) return null;

      const { data: tasks, error } = await supabase
        .from('backlot_tasks')
        .select('status')
        .eq('project_id', projectId);

      if (error) throw error;

      const stats = {
        total: tasks?.length || 0,
        todo: tasks?.filter(t => t.status === 'todo').length || 0,
        in_progress: tasks?.filter(t => t.status === 'in_progress').length || 0,
        review: tasks?.filter(t => t.status === 'review').length || 0,
        completed: tasks?.filter(t => t.status === 'completed').length || 0,
        blocked: tasks?.filter(t => t.status === 'blocked').length || 0,
      };

      return stats;
    },
    enabled: !!projectId,
  });
}
