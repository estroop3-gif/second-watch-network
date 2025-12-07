/**
 * useTaskLists - Hooks for managing Notion-style task lists
 * For producers, coordinators, and team members to create and manage collaborative task lists
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import {
  BacklotTaskList,
  BacklotTask,
  BacklotTaskLabel,
  BacklotTaskComment,
  BacklotTaskView,
  BacklotTaskListMember,
  TaskListInput,
  TaskListUpdateInput,
  TaskListMemberInput,
  TaskInput,
  TaskUpdateInput,
  TaskCommentInput,
  TaskViewInput,
  TaskReorderItem,
  BacklotTaskStatus,
} from '@/types/backlot';

// =====================================================
// TASK LABELS HOOKS
// =====================================================

interface UseTaskLabelsOptions {
  projectId: string | null;
}

/**
 * Get all task labels for a project
 */
export function useTaskLabels(options: UseTaskLabelsOptions) {
  const { projectId } = options;
  const queryClient = useQueryClient();

  const queryKey = ['backlot-task-labels', { projectId }];

  const { data, isLoading, error, refetch } = useQuery({
    queryKey,
    queryFn: async () => {
      if (!projectId) return [];
      const result = await api.get<{ success: boolean; labels: BacklotTaskLabel[] }>(
        `/api/v1/backlot/projects/${projectId}/task-labels`
      );
      return result.labels || [];
    },
    enabled: !!projectId,
  });

  const createLabel = useMutation({
    mutationFn: async (input: { name: string; color: string; description?: string }) => {
      if (!projectId) throw new Error('No project ID');
      const result = await api.post<{ success: boolean; label: BacklotTaskLabel }>(
        `/api/v1/backlot/projects/${projectId}/task-labels`,
        input
      );
      return result.label;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['backlot-task-labels'] });
    },
  });

  const updateLabel = useMutation({
    mutationFn: async ({ id, ...input }: { id: string; name?: string; color?: string; description?: string }) => {
      const result = await api.put<{ success: boolean; label: BacklotTaskLabel }>(
        `/api/v1/backlot/task-labels/${id}`,
        input
      );
      return result.label;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['backlot-task-labels'] });
    },
  });

  const deleteLabel = useMutation({
    mutationFn: async (id: string) => {
      await api.delete<{ success: boolean }>(`/api/v1/backlot/task-labels/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['backlot-task-labels'] });
    },
  });

  return {
    labels: data || [],
    isLoading,
    error,
    refetch,
    createLabel,
    updateLabel,
    deleteLabel,
  };
}

// =====================================================
// TASK LISTS HOOKS
// =====================================================

interface UseTaskListsOptions {
  projectId: string | null;
  includeArchived?: boolean;
}

/**
 * Get all task lists for a project
 */
export function useTaskLists(options: UseTaskListsOptions) {
  const { projectId, includeArchived = false } = options;
  const queryClient = useQueryClient();

  const queryKey = ['backlot-task-lists', { projectId, includeArchived }];

  const { data, isLoading, error, refetch } = useQuery({
    queryKey,
    queryFn: async () => {
      if (!projectId) return [];
      const params = new URLSearchParams();
      if (includeArchived) params.set('include_archived', 'true');
      const result = await api.get<{ success: boolean; task_lists: BacklotTaskList[] }>(
        `/api/v1/backlot/projects/${projectId}/task-lists?${params.toString()}`
      );
      return result.task_lists || [];
    },
    enabled: !!projectId,
  });

  const createTaskList = useMutation({
    mutationFn: async (input: TaskListInput) => {
      if (!projectId) throw new Error('No project ID');
      const result = await api.post<{ success: boolean; task_list: BacklotTaskList }>(
        `/api/v1/backlot/projects/${projectId}/task-lists`,
        input
      );
      return result.task_list;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['backlot-task-lists'] });
    },
  });

  const archiveTaskList = useMutation({
    mutationFn: async ({ taskListId, isArchived }: { taskListId: string; isArchived: boolean }) => {
      const result = await api.put<{ success: boolean; task_list: BacklotTaskList }>(
        `/api/v1/backlot/task-lists/${taskListId}`,
        { is_archived: isArchived }
      );
      return result.task_list;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['backlot-task-lists'] });
    },
  });

  return {
    taskLists: data || [],
    isLoading,
    error,
    refetch,
    createTaskList,
    archiveTaskList,
  };
}

/**
 * Get a single task list with all its data
 */
export function useTaskList(taskListId: string | null) {
  const queryClient = useQueryClient();

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['backlot-task-list', taskListId],
    queryFn: async () => {
      if (!taskListId) return null;
      const result = await api.get<{ success: boolean; task_list: BacklotTaskList }>(
        `/api/v1/backlot/task-lists/${taskListId}`
      );
      return result.task_list || null;
    },
    enabled: !!taskListId,
  });

  const updateTaskList = useMutation({
    mutationFn: async (input: TaskListUpdateInput) => {
      if (!taskListId) throw new Error('No task list ID');
      const result = await api.put<{ success: boolean; task_list: BacklotTaskList }>(
        `/api/v1/backlot/task-lists/${taskListId}`,
        input
      );
      return result.task_list;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['backlot-task-list', taskListId] });
      queryClient.invalidateQueries({ queryKey: ['backlot-task-lists'] });
    },
  });

  const deleteTaskList = useMutation({
    mutationFn: async (hardDelete: boolean = false) => {
      if (!taskListId) throw new Error('No task list ID');
      await api.delete<{ success: boolean }>(
        `/api/v1/backlot/task-lists/${taskListId}?hard_delete=${hardDelete}`
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['backlot-task-lists'] });
    },
  });

  return {
    taskList: data,
    tasks: data?.tasks || [],
    members: data?.members || [],
    views: data?.views || [],
    isLoading,
    error,
    refetch,
    updateTaskList,
    deleteTaskList,
  };
}

// =====================================================
// TASK LIST MEMBERS HOOKS
// =====================================================

interface UseTaskListMembersOptions {
  taskListId: string | null;
}

/**
 * Manage members of a task list (for selective sharing)
 */
export function useTaskListMembers(options: UseTaskListMembersOptions) {
  const { taskListId } = options;
  const queryClient = useQueryClient();

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['backlot-task-list-members', taskListId],
    queryFn: async () => {
      if (!taskListId) return [];
      const result = await api.get<{ success: boolean; members: BacklotTaskListMember[] }>(
        `/api/v1/backlot/task-lists/${taskListId}/members`
      );
      return result.members || [];
    },
    enabled: !!taskListId,
  });

  const addMember = useMutation({
    mutationFn: async (input: TaskListMemberInput) => {
      if (!taskListId) throw new Error('No task list ID');
      const result = await api.post<{ success: boolean; member: BacklotTaskListMember }>(
        `/api/v1/backlot/task-lists/${taskListId}/members`,
        input
      );
      return result.member;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['backlot-task-list-members', taskListId] });
      queryClient.invalidateQueries({ queryKey: ['backlot-task-list', taskListId] });
    },
  });

  const updateMember = useMutation({
    mutationFn: async ({ userId, canEdit }: { userId: string; canEdit: boolean }) => {
      if (!taskListId) throw new Error('No task list ID');
      const result = await api.put<{ success: boolean; member: BacklotTaskListMember }>(
        `/api/v1/backlot/task-lists/${taskListId}/members/${userId}`,
        { can_edit: canEdit }
      );
      return result.member;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['backlot-task-list-members', taskListId] });
      queryClient.invalidateQueries({ queryKey: ['backlot-task-list', taskListId] });
    },
  });

  const removeMember = useMutation({
    mutationFn: async (userId: string) => {
      if (!taskListId) throw new Error('No task list ID');
      await api.delete<{ success: boolean }>(
        `/api/v1/backlot/task-lists/${taskListId}/members/${userId}`
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['backlot-task-list-members', taskListId] });
      queryClient.invalidateQueries({ queryKey: ['backlot-task-list', taskListId] });
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

// =====================================================
// TASKS HOOKS (within a task list)
// =====================================================

interface UseTaskListTasksOptions {
  taskListId: string | null;
}

/**
 * Manage tasks within a task list
 */
export function useTaskListTasks(options: UseTaskListTasksOptions) {
  const { taskListId } = options;
  const queryClient = useQueryClient();

  const createTask = useMutation({
    mutationFn: async (input: TaskInput) => {
      if (!taskListId) throw new Error('No task list ID');
      console.log('[createTask] Creating task with input:', input, 'for task list:', taskListId);
      try {
        const result = await api.post<{ success: boolean; task: BacklotTask }>(
          `/api/v1/backlot/task-lists/${taskListId}/tasks`,
          input
        );
        console.log('[createTask] Result:', result);
        return result.task;
      } catch (error) {
        console.error('[createTask] Error:', error);
        throw error;
      }
    },
    onSuccess: (task) => {
      console.log('[createTask] Success, invalidating queries for task:', task);
      queryClient.invalidateQueries({ queryKey: ['backlot-task-list', taskListId] });
      queryClient.invalidateQueries({ queryKey: ['backlot-task-lists'] });
    },
    onError: (error) => {
      console.error('[createTask] Mutation error:', error);
    },
  });

  const updateTask = useMutation({
    mutationFn: async ({ id, ...input }: TaskUpdateInput & { id: string }) => {
      const result = await api.put<{ success: boolean; task: BacklotTask }>(
        `/api/v1/backlot/tasks/${id}`,
        input
      );
      return result.task;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['backlot-task-list', taskListId] });
      queryClient.invalidateQueries({ queryKey: ['backlot-task-lists'] });
      queryClient.invalidateQueries({ queryKey: ['backlot-task'] });
    },
  });

  const deleteTask = useMutation({
    mutationFn: async (id: string) => {
      await api.delete<{ success: boolean }>(`/api/v1/backlot/tasks/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['backlot-task-list', taskListId] });
      queryClient.invalidateQueries({ queryKey: ['backlot-task-lists'] });
    },
  });

  const updateTaskStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: BacklotTaskStatus }) => {
      const result = await api.put<{ success: boolean; task: BacklotTask }>(
        `/api/v1/backlot/tasks/${id}`,
        { status }
      );
      return result.task;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['backlot-task-list', taskListId] });
      queryClient.invalidateQueries({ queryKey: ['backlot-task-lists'] });
      queryClient.invalidateQueries({ queryKey: ['backlot-task'] });
    },
  });

  const reorderTasks = useMutation({
    mutationFn: async (tasks: TaskReorderItem[]) => {
      if (!taskListId) throw new Error('No task list ID');
      await api.post<{ success: boolean }>(
        `/api/v1/backlot/task-lists/${taskListId}/tasks/reorder`,
        { tasks }
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['backlot-task-list', taskListId] });
    },
  });

  return {
    createTask,
    updateTask,
    deleteTask,
    updateTaskStatus,
    reorderTasks,
  };
}

/**
 * Get a single task with full details
 */
export function useTaskDetail(taskId: string | null) {
  const queryClient = useQueryClient();

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['backlot-task', taskId],
    queryFn: async () => {
      if (!taskId) return null;
      const result = await api.get<{ success: boolean; task: BacklotTask }>(
        `/api/v1/backlot/tasks/${taskId}`
      );
      return result.task || null;
    },
    enabled: !!taskId,
  });

  const updateTask = useMutation({
    mutationFn: async (input: TaskUpdateInput) => {
      if (!taskId) throw new Error('No task ID');
      const result = await api.put<{ success: boolean; task: BacklotTask }>(
        `/api/v1/backlot/tasks/${taskId}`,
        input
      );
      return result.task;
    },
    onSuccess: (updatedTask) => {
      queryClient.invalidateQueries({ queryKey: ['backlot-task', taskId] });
      if (updatedTask?.task_list_id) {
        queryClient.invalidateQueries({ queryKey: ['backlot-task-list', updatedTask.task_list_id] });
      }
      queryClient.invalidateQueries({ queryKey: ['backlot-task-lists'] });
    },
  });

  return {
    task: data,
    isLoading,
    error,
    refetch,
    updateTask,
  };
}

// =====================================================
// TASK COMMENTS HOOKS
// =====================================================

interface UseTaskCommentsOptions {
  taskId: string | null;
}

/**
 * Manage comments on a task
 */
export function useTaskComments(options: UseTaskCommentsOptions) {
  const { taskId } = options;
  const queryClient = useQueryClient();

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['backlot-task-comments', taskId],
    queryFn: async () => {
      if (!taskId) return [];
      const result = await api.get<{ success: boolean; comments: BacklotTaskComment[] }>(
        `/api/v1/backlot/tasks/${taskId}/comments`
      );
      return result.comments || [];
    },
    enabled: !!taskId,
  });

  const createComment = useMutation({
    mutationFn: async (input: TaskCommentInput) => {
      if (!taskId) throw new Error('No task ID');
      const result = await api.post<{ success: boolean; comment: BacklotTaskComment }>(
        `/api/v1/backlot/tasks/${taskId}/comments`,
        input
      );
      return result.comment;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['backlot-task-comments', taskId] });
      queryClient.invalidateQueries({ queryKey: ['backlot-task', taskId] });
    },
  });

  const updateComment = useMutation({
    mutationFn: async ({ commentId, content }: { commentId: string; content: string }) => {
      const result = await api.put<{ success: boolean; comment: BacklotTaskComment }>(
        `/api/v1/backlot/task-comments/${commentId}`,
        { content }
      );
      return result.comment;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['backlot-task-comments', taskId] });
    },
  });

  const deleteComment = useMutation({
    mutationFn: async (commentId: string) => {
      await api.delete<{ success: boolean }>(`/api/v1/backlot/task-comments/${commentId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['backlot-task-comments', taskId] });
      queryClient.invalidateQueries({ queryKey: ['backlot-task', taskId] });
    },
  });

  return {
    comments: data || [],
    isLoading,
    error,
    refetch,
    createComment,
    updateComment,
    deleteComment,
  };
}

// =====================================================
// TASK VIEWS HOOKS
// =====================================================

interface UseTaskViewsOptions {
  taskListId: string | null;
}

/**
 * Manage saved views for a task list
 */
export function useTaskViews(options: UseTaskViewsOptions) {
  const { taskListId } = options;
  const queryClient = useQueryClient();

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['backlot-task-views', taskListId],
    queryFn: async () => {
      if (!taskListId) return [];
      const result = await api.get<{ success: boolean; views: BacklotTaskView[] }>(
        `/api/v1/backlot/task-lists/${taskListId}/views`
      );
      return result.views || [];
    },
    enabled: !!taskListId,
  });

  const createView = useMutation({
    mutationFn: async (input: TaskViewInput) => {
      if (!taskListId) throw new Error('No task list ID');
      const result = await api.post<{ success: boolean; view: BacklotTaskView }>(
        `/api/v1/backlot/task-lists/${taskListId}/views`,
        input
      );
      return result.view;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['backlot-task-views', taskListId] });
      queryClient.invalidateQueries({ queryKey: ['backlot-task-list', taskListId] });
    },
  });

  const updateView = useMutation({
    mutationFn: async ({ viewId, ...input }: Partial<TaskViewInput> & { viewId: string }) => {
      const result = await api.put<{ success: boolean; view: BacklotTaskView }>(
        `/api/v1/backlot/task-views/${viewId}`,
        input
      );
      return result.view;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['backlot-task-views', taskListId] });
      queryClient.invalidateQueries({ queryKey: ['backlot-task-list', taskListId] });
    },
  });

  const deleteView = useMutation({
    mutationFn: async (viewId: string) => {
      await api.delete<{ success: boolean }>(`/api/v1/backlot/task-views/${viewId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['backlot-task-views', taskListId] });
      queryClient.invalidateQueries({ queryKey: ['backlot-task-list', taskListId] });
    },
  });

  return {
    views: data || [],
    isLoading,
    error,
    refetch,
    createView,
    updateView,
    deleteView,
  };
}
