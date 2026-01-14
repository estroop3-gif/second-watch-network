/**
 * Script Sides Hooks
 * React Query hooks for script documents, scenes, and sides packets
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

// =====================================================
// Types
// =====================================================

export interface ScriptDocument {
  id: string;
  project_id: string;
  title: string;
  format: 'FOUNTAIN' | 'PLAIN';
  raw_text: string;
  is_active: boolean;
  created_by_user_id: string;
  created_at: string;
  updated_at: string;
}

export interface ScriptScene {
  id: string;
  script_document_id: string;
  project_id: string;
  scene_number: number;
  slugline: string;
  location?: string;
  time_of_day?: string;
  page_start?: number;
  page_end?: number;
  raw_scene_text: string;
  characters?: string[];
  created_at: string;
  updated_at: string;
}

export interface ProductionDay {
  id: string;
  shoot_date: string;
  day_type: string;
  notes?: string;
}

export interface SidesPacket {
  id: string;
  project_id: string;
  production_day_id: string;
  episode_id?: string;
  title: string;
  notes?: string;
  status: 'DRAFT' | 'PUBLISHED';
  created_by_user_id: string;
  created_at: string;
  updated_at: string;
  production_day?: ProductionDay;
  scenes_count?: number;
}

export interface PacketScene {
  id: string;
  sides_packet_id: string;
  script_scene_id: string;
  sort_order: number;
  scene_notes?: string;
  script_scene?: ScriptScene;
  created_at: string;
  updated_at: string;
}

export interface SidesPacketDetail {
  packet: SidesPacket;
  production_day: ProductionDay | null;
  scenes: PacketScene[];
  cast_working: { id: string; display_name: string; subject_type: string }[];
  characters_from_scenes: string[];
}

export interface SidesPrintData {
  project_title: string;
  packet: SidesPacket;
  production_day: ProductionDay | null;
  scenes: {
    sort_order: number;
    scene_notes?: string;
    script_scene: ScriptScene;
  }[];
  cast_working: string[];
  characters_from_scenes: string[];
  generated_at: string;
}

// =====================================================
// Query Keys
// =====================================================

const scriptSidesKeys = {
  script: (projectId: string) => ['script', projectId] as const,
  scenes: (projectId: string) => ['script-scenes', projectId] as const,
  productionDays: (projectId: string) => ['production-days', projectId] as const,
  packets: (projectId: string) => ['sides-packets', projectId] as const,
  packet: (projectId: string, packetId: string) => ['sides-packet', projectId, packetId] as const,
  print: (projectId: string, packetId: string) => ['sides-print', projectId, packetId] as const,
  scheduleDayScenes: (projectId: string, dayId: string) => ['schedule-day-scenes', projectId, dayId] as const,
};

// =====================================================
// Script Document Hooks
// =====================================================

export function useActiveScript(projectId: string | null) {
  return useQuery({
    queryKey: scriptSidesKeys.script(projectId || ''),
    queryFn: async () => {
      const token = localStorage.getItem('access_token');
      const response = await fetch(`/api/v1/backlot/projects/${projectId}/script`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) throw new Error('Failed to fetch script');
      const data = await response.json();
      return data as { script: ScriptDocument | null; scenes_count: number };
    },
    enabled: !!projectId,
  });
}

export function useCreateScript(projectId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: { title: string; format: string; raw_text: string }) => {
      const token = localStorage.getItem('access_token');
      const response = await fetch(`/api/v1/backlot/projects/${projectId}/script`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error('Failed to create script');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: scriptSidesKeys.script(projectId) });
      queryClient.invalidateQueries({ queryKey: scriptSidesKeys.scenes(projectId) });
    },
  });
}

export function useUpdateScript(projectId: string, scriptId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: { title?: string; raw_text?: string }) => {
      const token = localStorage.getItem('access_token');
      const response = await fetch(`/api/v1/backlot/projects/${projectId}/script/${scriptId}`, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error('Failed to update script');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: scriptSidesKeys.script(projectId) });
      queryClient.invalidateQueries({ queryKey: scriptSidesKeys.scenes(projectId) });
    },
  });
}

// =====================================================
// Script Scenes Hooks
// =====================================================

export function useScriptScenes(projectId: string | null, search?: string) {
  return useQuery({
    queryKey: [...scriptSidesKeys.scenes(projectId || ''), search],
    queryFn: async () => {
      const token = localStorage.getItem('access_token');
      const url = new URL(`/api/v1/backlot/projects/${projectId}/script/scenes`, window.location.origin);
      if (search) url.searchParams.set('search', search);
      const response = await fetch(url.toString(), {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) throw new Error('Failed to fetch scenes');
      const data = await response.json();
      return data.scenes as ScriptScene[];
    },
    enabled: !!projectId,
  });
}

// =====================================================
// Production Days Hooks
// =====================================================

export function useProductionDaysForSides(projectId: string | null) {
  return useQuery({
    queryKey: scriptSidesKeys.productionDays(projectId || ''),
    queryFn: async () => {
      const token = localStorage.getItem('access_token');
      const response = await fetch(`/api/v1/backlot/projects/${projectId}/production-days`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) throw new Error('Failed to fetch production days');
      const data = await response.json();
      return data.days as ProductionDay[];
    },
    enabled: !!projectId,
  });
}

// =====================================================
// Sides Packet Hooks
// =====================================================

export function useSidesPackets(projectId: string | null) {
  return useQuery({
    queryKey: scriptSidesKeys.packets(projectId || ''),
    queryFn: async () => {
      const token = localStorage.getItem('access_token');
      const response = await fetch(`/api/v1/backlot/projects/${projectId}/sides`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) throw new Error('Failed to fetch sides packets');
      const data = await response.json();
      return data.packets as SidesPacket[];
    },
    enabled: !!projectId,
  });
}

export function useSidesPacket(projectId: string | null, packetId: string | null) {
  return useQuery({
    queryKey: scriptSidesKeys.packet(projectId || '', packetId || ''),
    queryFn: async () => {
      const token = localStorage.getItem('access_token');
      const response = await fetch(`/api/v1/backlot/projects/${projectId}/sides/${packetId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) throw new Error('Failed to fetch sides packet');
      return response.json() as Promise<SidesPacketDetail>;
    },
    enabled: !!projectId && !!packetId,
  });
}

export function useCreateSidesPacket(projectId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: {
      production_day_id: string;
      title: string;
      episode_id?: string;
      notes?: string;
      mode?: 'AUTO' | 'MANUAL';
    }) => {
      const token = localStorage.getItem('access_token');
      const response = await fetch(`/api/v1/backlot/projects/${projectId}/sides`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error('Failed to create sides packet');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: scriptSidesKeys.packets(projectId) });
    },
  });
}

export function useUpdateSidesPacket(projectId: string, packetId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: { title?: string; notes?: string; status?: string }) => {
      const token = localStorage.getItem('access_token');
      const response = await fetch(`/api/v1/backlot/projects/${projectId}/sides/${packetId}`, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error('Failed to update sides packet');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: scriptSidesKeys.packets(projectId) });
      queryClient.invalidateQueries({ queryKey: scriptSidesKeys.packet(projectId, packetId) });
    },
  });
}

export function useDeleteSidesPacket(projectId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (packetId: string) => {
      const token = localStorage.getItem('access_token');
      const response = await fetch(`/api/v1/backlot/projects/${projectId}/sides/${packetId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) throw new Error('Failed to delete sides packet');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: scriptSidesKeys.packets(projectId) });
    },
  });
}

// =====================================================
// Packet Scenes Hooks
// =====================================================

export function useAddSceneToPacket(projectId: string, packetId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (sceneId: string) => {
      const token = localStorage.getItem('access_token');
      const response = await fetch(`/api/v1/backlot/projects/${projectId}/sides/${packetId}/scenes`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ scene_id: sceneId }),  // Use scene_id for backlot scenes
      });
      if (!response.ok) throw new Error('Failed to add scene to packet');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: scriptSidesKeys.packet(projectId, packetId) });
    },
  });
}

export function useUpdatePacketScene(projectId: string, packetId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ packetSceneId, data }: { packetSceneId: string; data: { scene_notes?: string } }) => {
      const token = localStorage.getItem('access_token');
      const response = await fetch(`/api/v1/backlot/projects/${projectId}/sides/${packetId}/scenes/${packetSceneId}`, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error('Failed to update packet scene');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: scriptSidesKeys.packet(projectId, packetId) });
    },
  });
}

export function useRemoveSceneFromPacket(projectId: string, packetId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (packetSceneId: string) => {
      const token = localStorage.getItem('access_token');
      const response = await fetch(`/api/v1/backlot/projects/${projectId}/sides/${packetId}/scenes/${packetSceneId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) throw new Error('Failed to remove scene from packet');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: scriptSidesKeys.packet(projectId, packetId) });
    },
  });
}

export function useReorderPacketScene(projectId: string, packetId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ packetSceneId, direction }: { packetSceneId: string; direction: 'UP' | 'DOWN' }) => {
      const token = localStorage.getItem('access_token');
      const response = await fetch(`/api/v1/backlot/projects/${projectId}/sides/${packetId}/scenes/reorder`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ packet_scene_id: packetSceneId, direction }),
      });
      if (!response.ok) throw new Error('Failed to reorder scene');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: scriptSidesKeys.packet(projectId, packetId) });
    },
  });
}

export function useSyncPacketFromSchedule(projectId: string, packetId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const token = localStorage.getItem('access_token');
      const response = await fetch(`/api/v1/backlot/projects/${projectId}/sides/${packetId}/sync-from-schedule`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'Failed to sync from schedule');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: scriptSidesKeys.packet(projectId, packetId) });
    },
  });
}

// =====================================================
// Print Data Hook
// =====================================================

export function useSidesPrintData(projectId: string | null, packetId: string | null) {
  return useQuery({
    queryKey: scriptSidesKeys.print(projectId || '', packetId || ''),
    queryFn: async () => {
      const token = localStorage.getItem('access_token');
      const response = await fetch(`/api/v1/backlot/projects/${projectId}/sides/${packetId}/print`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) throw new Error('Failed to fetch print data');
      return response.json() as Promise<SidesPrintData>;
    },
    enabled: !!projectId && !!packetId,
  });
}

// =====================================================
// Schedule Day Scenes Hooks
// =====================================================

export function useScheduleDayScenes(projectId: string | null, dayId: string | null) {
  return useQuery({
    queryKey: scriptSidesKeys.scheduleDayScenes(projectId || '', dayId || ''),
    queryFn: async () => {
      const token = localStorage.getItem('access_token');
      const response = await fetch(`/api/v1/backlot/projects/${projectId}/schedule/${dayId}/scenes`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) throw new Error('Failed to fetch schedule scenes');
      const data = await response.json();
      return data.scenes;
    },
    enabled: !!projectId && !!dayId,
  });
}

export function useAddSceneToSchedule(projectId: string, dayId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (scriptSceneId: string) => {
      const token = localStorage.getItem('access_token');
      const response = await fetch(`/api/v1/backlot/projects/${projectId}/schedule/${dayId}/scenes`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ script_scene_id: scriptSceneId }),
      });
      if (!response.ok) throw new Error('Failed to add scene to schedule');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: scriptSidesKeys.scheduleDayScenes(projectId, dayId) });
    },
  });
}

export function useRemoveSceneFromSchedule(projectId: string, dayId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (scheduleSceneId: string) => {
      const token = localStorage.getItem('access_token');
      const response = await fetch(`/api/v1/backlot/projects/${projectId}/schedule/${dayId}/scenes/${scheduleSceneId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) throw new Error('Failed to remove scene from schedule');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: scriptSidesKeys.scheduleDayScenes(projectId, dayId) });
    },
  });
}
