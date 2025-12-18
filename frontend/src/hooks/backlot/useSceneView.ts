/**
 * useSceneView - Hook for Scene View aggregation
 * Provides scene list and scene overview data from the Scene View API
 */
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';

// Types
export interface SceneListItem {
  id: string;
  scene_number: string;
  slugline: string | null;
  int_ext: string | null;
  day_night: string | null;
  page_length: number | null;
  is_scheduled: boolean;
  is_shot: boolean;
  needs_pickup: boolean;
  shot_count: number;
  dailies_clip_count: number;
  has_coverage: boolean;
  breakdown_item_count: number;
}

export interface BreakdownItem {
  id: string;
  scene_id: string;
  type: string;
  name: string;
  description: string | null;
  notes: string | null;
  quantity: number | null;
}

export interface ShotSummary {
  id: string;
  shot_number: string;
  description: string | null;
  frame_size: string | null;
  camera_movement: string | null;
  is_covered: boolean;
  circle_take_count: number;
}

export interface LocationSummary {
  id: string;
  name: string;
  address: string | null;
  type: string | null;
  is_primary: boolean;
}

export interface DailiesClipSummary {
  id: string;
  file_name: string;
  scene_number: string | null;
  take_number: number | null;
  is_circle_take: boolean;
  rating: number | null;
  duration_seconds: number | null;
}

export interface ReviewNoteSummary {
  id: string;
  asset_id: string;
  content: string;
  timecode: string | null;
  author_name: string | null;
  is_resolved: boolean;
  created_at: string;
}

export interface TaskSummary {
  id: string;
  title: string;
  status: string;
  priority: string | null;
  due_date: string | null;
  assigned_to_name: string | null;
}

export interface SceneMetadata {
  id: string;
  project_id: string;
  script_id: string | null;
  scene_number: string;
  slugline: string | null;
  int_ext: string | null;
  day_night: string | null;
  page_length: number | null;
  page_start: number | null;
  page_end: number | null;
  location_hint: string | null;
  location_id: string | null;
  scheduled_day_id: string | null;
  shot_day_id: string | null;
  is_scheduled: boolean;
  is_shot: boolean;
  needs_pickup: boolean;
  created_at: string | null;
  updated_at: string | null;
}

export interface CoverageSummary {
  total_shots: number;
  covered_shots: number;
  coverage_percent: number;
  total_clips: number;
  circle_takes: number;
  is_shot: boolean;
  needs_pickup: boolean;
}

export interface SceneOverview {
  scene: SceneMetadata;
  breakdown_items: BreakdownItem[];
  breakdown_by_type: Record<string, BreakdownItem[]>;
  shots: ShotSummary[];
  locations: LocationSummary[];
  dailies_clips: DailiesClipSummary[];
  review_notes: ReviewNoteSummary[];
  tasks: TaskSummary[];
  coverage_summary: CoverageSummary;
}

interface ScenesListParams {
  scriptVersionId?: string;
  search?: string;
}

/**
 * Get list of scenes for a project
 */
export function useScenesList(projectId: string | null, params?: ScenesListParams) {
  return useQuery({
    queryKey: ['backlot', 'scenes', projectId, params],
    queryFn: async () => {
      if (!projectId) return [];
      const queryParams = new URLSearchParams();
      if (params?.scriptVersionId) queryParams.append('script_version_id', params.scriptVersionId);
      if (params?.search) queryParams.append('search', params.search);
      const queryString = queryParams.toString();
      const url = `/api/v1/backlot/projects/${projectId}/scenes${queryString ? `?${queryString}` : ''}`;
      const response = await apiClient.get<{ scenes: any[] } | any[]>(url);

      // Handle both formats: { scenes: [...] } and direct array
      const rawScenes = Array.isArray(response) ? response : (response?.scenes || []);

      // Map to SceneListItem format
      return rawScenes.map((scene: any) => {
        // Build slugline from components if not set
        let slugline = scene.slugline;
        if (!slugline) {
          const parts: string[] = [];
          if (scene.int_ext) parts.push(scene.int_ext.toUpperCase());
          if (scene.set_name) parts.push(scene.set_name);
          if (scene.time_of_day) parts.push(`- ${scene.time_of_day.toUpperCase()}`);
          slugline = parts.length > 0 ? parts.join(' ') : null;
        }

        return {
          id: scene.id,
          scene_number: scene.scene_number || '',
          slugline,
          int_ext: scene.int_ext,
          day_night: scene.time_of_day || scene.day_night, // Handle both field names
          page_length: scene.page_length || scene.page_count,
          is_scheduled: scene.is_scheduled || scene.coverage_status === 'scheduled',
          is_shot: scene.is_shot || scene.coverage_status === 'shot',
          needs_pickup: scene.needs_pickup || scene.coverage_status === 'needs_pickup',
          shot_count: scene.shot_count || 0,
          dailies_clip_count: scene.dailies_clip_count || 0,
          has_coverage: scene.has_coverage || false,
          breakdown_item_count: scene.breakdown_item_count || scene.breakdown_count || 0,
        } as SceneListItem;
      });
    },
    enabled: !!projectId,
  });
}

/**
 * Get comprehensive overview of a single scene
 */
export function useSceneOverview(projectId: string | null, sceneId: string | null) {
  return useQuery({
    queryKey: ['backlot', 'scenes', projectId, sceneId, 'overview'],
    queryFn: async () => {
      if (!projectId || !sceneId) return null;
      return apiClient.get<SceneOverview>(`/api/v1/backlot/projects/${projectId}/scenes/${sceneId}/overview`);
    },
    enabled: !!projectId && !!sceneId,
  });
}

// Breakdown type labels and colors
export const BREAKDOWN_TYPES = [
  { value: 'cast', label: 'Cast', color: 'bg-red-500' },
  { value: 'background', label: 'Background', color: 'bg-orange-500' },
  { value: 'stunt', label: 'Stunts', color: 'bg-yellow-500' },
  { value: 'prop', label: 'Props', color: 'bg-green-500' },
  { value: 'vehicle', label: 'Vehicles', color: 'bg-teal-500' },
  { value: 'wardrobe', label: 'Wardrobe', color: 'bg-blue-500' },
  { value: 'makeup', label: 'Makeup/Hair', color: 'bg-indigo-500' },
  { value: 'sfx', label: 'SFX', color: 'bg-purple-500' },
  { value: 'vfx', label: 'VFX', color: 'bg-pink-500' },
  { value: 'animal', label: 'Animals', color: 'bg-amber-500' },
  { value: 'location', label: 'Locations', color: 'bg-cyan-500' },
  { value: 'other', label: 'Other', color: 'bg-gray-500' },
] as const;

export function getBreakdownTypeInfo(type: string) {
  return BREAKDOWN_TYPES.find(t => t.value === type) || BREAKDOWN_TYPES[BREAKDOWN_TYPES.length - 1];
}
