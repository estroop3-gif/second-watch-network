/**
 * invalidateSceneQueries - Shared helper for scene query invalidation
 * Use this to ensure consistent cache invalidation across all scene-related tabs
 */
import { QueryClient } from '@tanstack/react-query';

/**
 * Invalidates all scene-related queries to ensure data consistency across tabs.
 * Should be called whenever a scene's status changes in any tab.
 *
 * @param queryClient - The React Query client
 * @param projectId - The current project ID
 * @param sceneId - Optional specific scene ID for targeted invalidation
 */
export function invalidateSceneQueries(
  queryClient: QueryClient,
  projectId: string | null,
  sceneId?: string
) {
  if (!projectId) return;

  // Core scene queries
  queryClient.invalidateQueries({ queryKey: ['backlot-scenes', projectId] });
  queryClient.invalidateQueries({ queryKey: ['backlot', 'scenes', projectId] });

  // Coverage queries (depend on scene status)
  queryClient.invalidateQueries({ queryKey: ['backlot-coverage-summary', projectId] });
  queryClient.invalidateQueries({ queryKey: ['backlot-coverage-by-scene', projectId] });
  queryClient.invalidateQueries({ queryKey: ['backlot-coverage', projectId] });

  // Schedule queries (scenes are scheduled)
  queryClient.invalidateQueries({ queryKey: ['backlot-schedule', projectId] });
  queryClient.invalidateQueries({ queryKey: ['backlot', 'schedule', projectId] });

  // Call sheets (reference scenes)
  queryClient.invalidateQueries({ queryKey: ['backlot-call-sheets', projectId] });
  queryClient.invalidateQueries({ queryKey: ['backlot', 'call-sheets', projectId] });

  // Shot lists (linked to scenes)
  queryClient.invalidateQueries({ queryKey: ['backlot-shots', projectId] });
  queryClient.invalidateQueries({ queryKey: ['backlot', 'shots', projectId] });

  // Tasks (can be linked to scenes)
  queryClient.invalidateQueries({ queryKey: ['backlot-tasks', projectId] });
  queryClient.invalidateQueries({ queryKey: ['backlot', 'tasks', projectId] });

  // Specific scene hub if sceneId provided
  if (sceneId) {
    queryClient.invalidateQueries({ queryKey: ['backlot-scene-hub', sceneId] });
    queryClient.invalidateQueries({ queryKey: ['backlot', 'scene', sceneId] });
  }
}

/**
 * Invalidates shot-related queries for coverage updates.
 *
 * @param queryClient - The React Query client
 * @param projectId - The current project ID
 * @param shotId - Optional specific shot ID for targeted invalidation
 */
export function invalidateShotQueries(
  queryClient: QueryClient,
  projectId: string | null,
  shotId?: string
) {
  if (!projectId) return;

  // Shot queries
  queryClient.invalidateQueries({ queryKey: ['backlot-shots', projectId] });
  queryClient.invalidateQueries({ queryKey: ['backlot', 'shots', projectId] });

  // Coverage queries
  queryClient.invalidateQueries({ queryKey: ['backlot-coverage-summary', projectId] });
  queryClient.invalidateQueries({ queryKey: ['backlot-coverage-by-scene', projectId] });
  queryClient.invalidateQueries({ queryKey: ['backlot-coverage', projectId] });

  // Specific shot if provided
  if (shotId) {
    queryClient.invalidateQueries({ queryKey: ['backlot-shot', shotId] });
    queryClient.invalidateQueries({ queryKey: ['backlot', 'shot', shotId] });
  }
}

/**
 * Invalidates production day related queries.
 *
 * @param queryClient - The React Query client
 * @param projectId - The current project ID
 * @param productionDayId - Optional specific production day ID
 */
export function invalidateProductionDayQueries(
  queryClient: QueryClient,
  projectId: string | null,
  productionDayId?: string
) {
  if (!projectId) return;

  // Schedule queries
  queryClient.invalidateQueries({ queryKey: ['backlot-schedule', projectId] });
  queryClient.invalidateQueries({ queryKey: ['backlot', 'schedule', projectId] });

  // Call sheets
  queryClient.invalidateQueries({ queryKey: ['backlot-call-sheets', projectId] });
  queryClient.invalidateQueries({ queryKey: ['backlot', 'call-sheets', projectId] });

  // Daily budget
  queryClient.invalidateQueries({ queryKey: ['backlot-daily-budget', projectId] });
  queryClient.invalidateQueries({ queryKey: ['backlot', 'daily-budget', projectId] });

  // Hot set sessions
  queryClient.invalidateQueries({ queryKey: ['hot-set-sessions', projectId] });

  // Check-in sessions
  queryClient.invalidateQueries({ queryKey: ['backlot-checkin', projectId] });
  queryClient.invalidateQueries({ queryKey: ['backlot', 'checkin', projectId] });

  // Specific day if provided
  if (productionDayId) {
    queryClient.invalidateQueries({ queryKey: ['backlot-production-day', productionDayId] });
    queryClient.invalidateQueries({ queryKey: ['backlot', 'production-day', productionDayId] });
  }
}

/**
 * Invalidates person-related queries.
 *
 * @param queryClient - The React Query client
 * @param projectId - The current project ID
 * @param userId - Optional specific user ID
 */
export function invalidatePersonQueries(
  queryClient: QueryClient,
  projectId: string | null,
  userId?: string
) {
  if (!projectId) return;

  // People/team queries
  queryClient.invalidateQueries({ queryKey: ['backlot-people', projectId] });
  queryClient.invalidateQueries({ queryKey: ['backlot', 'people', projectId] });
  queryClient.invalidateQueries({ queryKey: ['backlot-team', projectId] });
  queryClient.invalidateQueries({ queryKey: ['backlot', 'team', projectId] });

  // Casting/crew
  queryClient.invalidateQueries({ queryKey: ['backlot-cast', projectId] });
  queryClient.invalidateQueries({ queryKey: ['backlot', 'cast', projectId] });
  queryClient.invalidateQueries({ queryKey: ['backlot-crew', projectId] });
  queryClient.invalidateQueries({ queryKey: ['backlot', 'crew', projectId] });

  // Timecards (per person)
  queryClient.invalidateQueries({ queryKey: ['backlot', 'timecards', projectId] });

  // Specific person if provided
  if (userId) {
    queryClient.invalidateQueries({ queryKey: ['backlot-person', userId] });
    queryClient.invalidateQueries({ queryKey: ['backlot', 'person', userId] });
  }
}
