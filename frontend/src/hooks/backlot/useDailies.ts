/**
 * useDailies - Hooks for managing dailies, cards, clips, and notes
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import {
  BacklotDailiesDay,
  BacklotDailiesCard,
  BacklotDailiesClip,
  BacklotDailiesClipNote,
  DailiesDayInput,
  DailiesCardInput,
  DailiesClipInput,
  DailiesClipUpdateInput,
  DailiesClipNoteInput,
  DailiesLocalIngestRequest,
  DailiesProjectSummary,
  DailiesDaySummary,
  DailiesClipFilters,
  DailiesStorageMode,
} from '@/types/backlot';

// =============================================================================
// DAILIES DAYS
// =============================================================================

interface UseDailiesDaysOptions {
  projectId: string | null;
  limit?: number;
}

export function useDailiesDays(options: UseDailiesDaysOptions) {
  const { projectId, limit = 100 } = options;
  const queryClient = useQueryClient();

  const queryKey = ['dailies-days', { projectId, limit }];

  const { data, isLoading, error, refetch } = useQuery({
    queryKey,
    queryFn: async () => {
      if (!projectId) return [];

      const { data: days, error } = await supabase
        .from('backlot_dailies_days')
        .select('*')
        .eq('project_id', projectId)
        .order('shoot_date', { ascending: false })
        .limit(limit);

      if (error) throw error;
      if (!days || days.length === 0) return [];

      // Get clip/card counts for each day
      const dayIds = days.map(d => d.id);

      // Fetch cards
      const { data: cards } = await supabase
        .from('backlot_dailies_cards')
        .select('id, dailies_day_id')
        .in('dailies_day_id', dayIds);

      // Count cards per day
      const cardCountMap = new Map<string, number>();
      cards?.forEach(card => {
        cardCountMap.set(card.dailies_day_id, (cardCountMap.get(card.dailies_day_id) || 0) + 1);
      });

      // Fetch clips
      const cardIds = cards?.map(c => c.id) || [];
      let clipStats = new Map<string, { count: number; circles: number; duration: number }>();

      if (cardIds.length > 0) {
        const { data: clips } = await supabase
          .from('backlot_dailies_clips')
          .select('dailies_card_id, is_circle_take, duration_seconds')
          .in('dailies_card_id', cardIds);

        // Map card to day
        const cardToDayMap = new Map<string, string>();
        cards?.forEach(c => cardToDayMap.set(c.id, c.dailies_day_id));

        clips?.forEach(clip => {
          const dayId = cardToDayMap.get(clip.dailies_card_id);
          if (dayId) {
            const stats = clipStats.get(dayId) || { count: 0, circles: 0, duration: 0 };
            stats.count++;
            if (clip.is_circle_take) stats.circles++;
            if (clip.duration_seconds) stats.duration += clip.duration_seconds;
            clipStats.set(dayId, stats);
          }
        });
      }

      return days.map(day => ({
        ...day,
        card_count: cardCountMap.get(day.id) || 0,
        clip_count: clipStats.get(day.id)?.count || 0,
        circle_take_count: clipStats.get(day.id)?.circles || 0,
        total_duration_seconds: clipStats.get(day.id)?.duration || 0,
      })) as BacklotDailiesDay[];
    },
    enabled: !!projectId,
  });

  const createDay = useMutation({
    mutationFn: async ({ projectId, ...input }: DailiesDayInput & { projectId: string }) => {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) throw new Error('Not authenticated');

      const { data, error } = await supabase
        .from('backlot_dailies_days')
        .insert({
          project_id: projectId,
          shoot_date: input.shoot_date,
          label: input.label,
          unit: input.unit || null,
          notes: input.notes || null,
          created_by_user_id: userData.user.id,
        })
        .select()
        .single();

      if (error) throw error;
      return data as BacklotDailiesDay;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dailies-days'] });
      queryClient.invalidateQueries({ queryKey: ['dailies-summary'] });
    },
  });

  const updateDay = useMutation({
    mutationFn: async ({ id, ...input }: Partial<DailiesDayInput> & { id: string }) => {
      const updateData: Record<string, any> = {};
      if (input.shoot_date !== undefined) updateData.shoot_date = input.shoot_date;
      if (input.label !== undefined) updateData.label = input.label;
      if (input.unit !== undefined) updateData.unit = input.unit;
      if (input.notes !== undefined) updateData.notes = input.notes;

      const { data, error } = await supabase
        .from('backlot_dailies_days')
        .update(updateData)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data as BacklotDailiesDay;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dailies-days'] });
    },
  });

  const deleteDay = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('backlot_dailies_days').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dailies-days'] });
      queryClient.invalidateQueries({ queryKey: ['dailies-summary'] });
    },
  });

  return {
    days: data || [],
    isLoading,
    error,
    refetch,
    createDay,
    updateDay,
    deleteDay,
  };
}

// Single day fetch
export function useDailiesDay(dayId: string | null) {
  return useQuery({
    queryKey: ['dailies-day', dayId],
    queryFn: async () => {
      if (!dayId) return null;

      const { data, error } = await supabase
        .from('backlot_dailies_days')
        .select('*')
        .eq('id', dayId)
        .single();

      if (error) throw error;
      return data as BacklotDailiesDay;
    },
    enabled: !!dayId,
  });
}

// =============================================================================
// DAILIES CARDS
// =============================================================================

interface UseDailiesCardsOptions {
  dayId: string | null;
  projectId?: string | null;
  limit?: number;
}

export function useDailiesCards(options: UseDailiesCardsOptions) {
  const { dayId, projectId, limit = 50 } = options;
  const queryClient = useQueryClient();

  const queryKey = ['dailies-cards', { dayId, projectId, limit }];

  const { data, isLoading, error, refetch } = useQuery({
    queryKey,
    queryFn: async () => {
      if (!dayId && !projectId) return [];

      let query = supabase
        .from('backlot_dailies_cards')
        .select('*')
        .order('created_at', { ascending: true })
        .limit(limit);

      if (dayId) {
        query = query.eq('dailies_day_id', dayId);
      } else if (projectId) {
        query = query.eq('project_id', projectId);
      }

      const { data: cards, error } = await query;
      if (error) throw error;
      if (!cards || cards.length === 0) return [];

      // Get clip counts for each card
      const cardIds = cards.map(c => c.id);
      const { data: clips } = await supabase
        .from('backlot_dailies_clips')
        .select('dailies_card_id')
        .in('dailies_card_id', cardIds);

      const clipCountMap = new Map<string, number>();
      clips?.forEach(clip => {
        clipCountMap.set(clip.dailies_card_id, (clipCountMap.get(clip.dailies_card_id) || 0) + 1);
      });

      return cards.map(card => ({
        ...card,
        clip_count: clipCountMap.get(card.id) || 0,
      })) as BacklotDailiesCard[];
    },
    enabled: !!dayId || !!projectId,
  });

  const createCard = useMutation({
    mutationFn: async ({
      dayId,
      projectId,
      ...input
    }: DailiesCardInput & { dayId: string; projectId: string }) => {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) throw new Error('Not authenticated');

      const { data, error } = await supabase
        .from('backlot_dailies_cards')
        .insert({
          dailies_day_id: dayId,
          project_id: projectId,
          camera_label: input.camera_label,
          roll_name: input.roll_name,
          storage_mode: input.storage_mode || 'cloud',
          media_root_path: input.media_root_path || null,
          storage_location: input.storage_location || null,
          notes: input.notes || null,
          created_by_user_id: userData.user.id,
        })
        .select()
        .single();

      if (error) throw error;
      return data as BacklotDailiesCard;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dailies-cards'] });
      queryClient.invalidateQueries({ queryKey: ['dailies-days'] });
      queryClient.invalidateQueries({ queryKey: ['dailies-summary'] });
    },
  });

  const updateCard = useMutation({
    mutationFn: async ({ id, ...input }: Partial<DailiesCardInput> & { id: string }) => {
      const updateData: Record<string, any> = {};
      if (input.camera_label !== undefined) updateData.camera_label = input.camera_label;
      if (input.roll_name !== undefined) updateData.roll_name = input.roll_name;
      if (input.storage_mode !== undefined) updateData.storage_mode = input.storage_mode;
      if (input.media_root_path !== undefined) updateData.media_root_path = input.media_root_path;
      if (input.storage_location !== undefined) updateData.storage_location = input.storage_location;
      if (input.notes !== undefined) updateData.notes = input.notes;

      const { data, error } = await supabase
        .from('backlot_dailies_cards')
        .update(updateData)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data as BacklotDailiesCard;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dailies-cards'] });
    },
  });

  const deleteCard = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('backlot_dailies_cards').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dailies-cards'] });
      queryClient.invalidateQueries({ queryKey: ['dailies-days'] });
      queryClient.invalidateQueries({ queryKey: ['dailies-summary'] });
    },
  });

  const verifyChecksum = useMutation({
    mutationFn: async ({ id, verified }: { id: string; verified: boolean }) => {
      const { data, error } = await supabase
        .from('backlot_dailies_cards')
        .update({ checksum_verified: verified })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data as BacklotDailiesCard;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dailies-cards'] });
    },
  });

  return {
    cards: data || [],
    isLoading,
    error,
    refetch,
    createCard,
    updateCard,
    deleteCard,
    verifyChecksum,
  };
}

// =============================================================================
// DAILIES CLIPS
// =============================================================================

interface UseDailiesClipsOptions {
  cardId?: string | null;
  projectId?: string | null;
  dayId?: string | null;
  filters?: DailiesClipFilters;
  limit?: number;
}

export function useDailiesClips(options: UseDailiesClipsOptions) {
  const { cardId, projectId, dayId, filters = {}, limit = 200 } = options;
  const queryClient = useQueryClient();

  const queryKey = ['dailies-clips', { cardId, projectId, dayId, filters, limit }];

  const { data, isLoading, error, refetch } = useQuery({
    queryKey,
    queryFn: async () => {
      if (!cardId && !projectId && !dayId) return [];

      let query = supabase
        .from('backlot_dailies_clips')
        .select('*')
        .order('created_at', { ascending: true })
        .limit(limit);

      if (cardId) {
        query = query.eq('dailies_card_id', cardId);
      } else if (projectId) {
        query = query.eq('project_id', projectId);
      }

      // Apply filters
      if (filters.scene_number) {
        query = query.eq('scene_number', filters.scene_number);
      }
      if (filters.take_number !== undefined) {
        query = query.eq('take_number', filters.take_number);
      }
      if (filters.is_circle_take !== undefined) {
        query = query.eq('is_circle_take', filters.is_circle_take);
      }
      if (filters.rating_min !== undefined) {
        query = query.gte('rating', filters.rating_min);
      }
      if (filters.storage_mode) {
        query = query.eq('storage_mode', filters.storage_mode);
      }
      if (filters.text_search) {
        query = query.or(`file_name.ilike.%${filters.text_search}%,notes.ilike.%${filters.text_search}%`);
      }

      const { data: clips, error } = await query;
      if (error) throw error;
      if (!clips || clips.length === 0) return [];

      // If filtering by dayId, get the cards for that day first
      if (dayId && !cardId) {
        const { data: cards } = await supabase
          .from('backlot_dailies_cards')
          .select('id')
          .eq('dailies_day_id', dayId);

        const dayCardIds = new Set(cards?.map(c => c.id) || []);
        return clips.filter(clip => dayCardIds.has(clip.dailies_card_id)) as BacklotDailiesClip[];
      }

      // Fetch card info
      const cardIds = [...new Set(clips.map(c => c.dailies_card_id))];
      let cardMap = new Map<string, BacklotDailiesCard>();
      if (cardIds.length > 0) {
        const { data: cards } = await supabase
          .from('backlot_dailies_cards')
          .select('*')
          .in('id', cardIds);
        cardMap = new Map(cards?.map(c => [c.id, c as BacklotDailiesCard]) || []);
      }

      // Fetch note counts
      const clipIds = clips.map(c => c.id);
      let noteCountMap = new Map<string, number>();
      if (clipIds.length > 0) {
        const { data: notes } = await supabase
          .from('backlot_dailies_clip_notes')
          .select('dailies_clip_id')
          .in('dailies_clip_id', clipIds);

        notes?.forEach(note => {
          noteCountMap.set(note.dailies_clip_id, (noteCountMap.get(note.dailies_clip_id) || 0) + 1);
        });
      }

      return clips.map(clip => ({
        ...clip,
        card: cardMap.get(clip.dailies_card_id),
        note_count: noteCountMap.get(clip.id) || 0,
      })) as BacklotDailiesClip[];
    },
    enabled: !!cardId || !!projectId || !!dayId,
  });

  const createClip = useMutation({
    mutationFn: async ({
      cardId,
      projectId,
      ...input
    }: DailiesClipInput & { cardId: string; projectId: string }) => {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) throw new Error('Not authenticated');

      const { data, error } = await supabase
        .from('backlot_dailies_clips')
        .insert({
          dailies_card_id: cardId,
          project_id: projectId,
          file_name: input.file_name,
          relative_path: input.relative_path || null,
          storage_mode: input.storage_mode || 'cloud',
          cloud_url: input.cloud_url || null,
          duration_seconds: input.duration_seconds || null,
          timecode_start: input.timecode_start || null,
          frame_rate: input.frame_rate || null,
          resolution: input.resolution || null,
          codec: input.codec || null,
          camera_label: input.camera_label || null,
          scene_number: input.scene_number || null,
          take_number: input.take_number || null,
          is_circle_take: input.is_circle_take || false,
          rating: input.rating || null,
          script_scene_id: input.script_scene_id || null,
          shot_id: input.shot_id || null,
          notes: input.notes || null,
          created_by_user_id: userData.user.id,
        })
        .select()
        .single();

      if (error) throw error;
      return data as BacklotDailiesClip;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dailies-clips'] });
      queryClient.invalidateQueries({ queryKey: ['dailies-cards'] });
      queryClient.invalidateQueries({ queryKey: ['dailies-days'] });
      queryClient.invalidateQueries({ queryKey: ['dailies-summary'] });
    },
  });

  const updateClip = useMutation({
    mutationFn: async ({ id, ...input }: DailiesClipUpdateInput & { id: string }) => {
      const updateData: Record<string, any> = {};
      if (input.scene_number !== undefined) updateData.scene_number = input.scene_number;
      if (input.take_number !== undefined) updateData.take_number = input.take_number;
      if (input.is_circle_take !== undefined) updateData.is_circle_take = input.is_circle_take;
      if (input.rating !== undefined) updateData.rating = input.rating;
      if (input.script_scene_id !== undefined) updateData.script_scene_id = input.script_scene_id;
      if (input.shot_id !== undefined) updateData.shot_id = input.shot_id;
      if (input.notes !== undefined) updateData.notes = input.notes;

      const { data, error } = await supabase
        .from('backlot_dailies_clips')
        .update(updateData)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data as BacklotDailiesClip;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dailies-clips'] });
      queryClient.invalidateQueries({ queryKey: ['dailies-clip'] });
      queryClient.invalidateQueries({ queryKey: ['dailies-days'] });
    },
  });

  const deleteClip = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('backlot_dailies_clips').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dailies-clips'] });
      queryClient.invalidateQueries({ queryKey: ['dailies-cards'] });
      queryClient.invalidateQueries({ queryKey: ['dailies-days'] });
      queryClient.invalidateQueries({ queryKey: ['dailies-summary'] });
    },
  });

  const toggleCircleTake = useMutation({
    mutationFn: async ({ id, isCircle }: { id: string; isCircle: boolean }) => {
      const { data, error } = await supabase
        .from('backlot_dailies_clips')
        .update({ is_circle_take: isCircle })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data as BacklotDailiesClip;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dailies-clips'] });
      queryClient.invalidateQueries({ queryKey: ['dailies-clip'] });
      queryClient.invalidateQueries({ queryKey: ['dailies-days'] });
    },
  });

  const setRating = useMutation({
    mutationFn: async ({ id, rating }: { id: string; rating: number | null }) => {
      const { data, error } = await supabase
        .from('backlot_dailies_clips')
        .update({ rating })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data as BacklotDailiesClip;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dailies-clips'] });
      queryClient.invalidateQueries({ queryKey: ['dailies-clip'] });
    },
  });

  return {
    clips: data || [],
    isLoading,
    error,
    refetch,
    createClip,
    updateClip,
    deleteClip,
    toggleCircleTake,
    setRating,
  };
}

// Single clip fetch with full details
export function useDailiesClip(clipId: string | null) {
  return useQuery({
    queryKey: ['dailies-clip', clipId],
    queryFn: async () => {
      if (!clipId) return null;

      const { data: clip, error } = await supabase
        .from('backlot_dailies_clips')
        .select('*')
        .eq('id', clipId)
        .single();

      if (error) throw error;

      // Fetch card
      let card = null;
      if (clip.dailies_card_id) {
        const { data: cardData } = await supabase
          .from('backlot_dailies_cards')
          .select('*')
          .eq('id', clip.dailies_card_id)
          .single();
        card = cardData;
      }

      // Fetch scene
      let scene = null;
      if (clip.script_scene_id) {
        const { data: sceneData } = await supabase
          .from('backlot_scenes')
          .select('id, scene_number, scene_heading, int_ext, time_of_day')
          .eq('id', clip.script_scene_id)
          .single();
        scene = sceneData;
      }

      // Fetch note count
      const { count: noteCount } = await supabase
        .from('backlot_dailies_clip_notes')
        .select('*', { count: 'exact', head: true })
        .eq('dailies_clip_id', clipId);

      return {
        ...clip,
        card: card as BacklotDailiesCard,
        scene,
        note_count: noteCount || 0,
      } as BacklotDailiesClip;
    },
    enabled: !!clipId,
  });
}

// =============================================================================
// DAILIES CLIP NOTES
// =============================================================================

interface UseDailiesClipNotesOptions {
  clipId: string | null;
  includeResolved?: boolean;
}

export function useDailiesClipNotes(options: UseDailiesClipNotesOptions) {
  const { clipId, includeResolved = true } = options;
  const queryClient = useQueryClient();

  const queryKey = ['dailies-clip-notes', { clipId, includeResolved }];

  const { data, isLoading, error, refetch } = useQuery({
    queryKey,
    queryFn: async () => {
      if (!clipId) return [];

      let query = supabase
        .from('backlot_dailies_clip_notes')
        .select('*')
        .eq('dailies_clip_id', clipId)
        .order('time_seconds', { ascending: true, nullsFirst: false })
        .order('created_at', { ascending: true });

      if (!includeResolved) {
        query = query.eq('is_resolved', false);
      }

      const { data: notes, error } = await query;
      if (error) throw error;
      if (!notes || notes.length === 0) return [];

      // Fetch authors
      const authorIds = [...new Set(notes.map(n => n.author_user_id))];
      let authorMap = new Map<string, any>();
      if (authorIds.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, username, full_name, display_name, avatar_url')
          .in('id', authorIds);
        authorMap = new Map(profiles?.map(p => [p.id, p]) || []);
      }

      return notes.map(note => ({
        ...note,
        author: authorMap.get(note.author_user_id),
      })) as BacklotDailiesClipNote[];
    },
    enabled: !!clipId,
  });

  const addNote = useMutation({
    mutationFn: async ({ clipId, ...input }: DailiesClipNoteInput & { clipId: string }) => {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) throw new Error('Not authenticated');

      const { data, error } = await supabase
        .from('backlot_dailies_clip_notes')
        .insert({
          dailies_clip_id: clipId,
          author_user_id: userData.user.id,
          time_seconds: input.time_seconds || null,
          note_text: input.note_text,
          category: input.category || null,
        })
        .select()
        .single();

      if (error) throw error;
      return data as BacklotDailiesClipNote;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dailies-clip-notes'] });
      queryClient.invalidateQueries({ queryKey: ['dailies-clip'] });
      queryClient.invalidateQueries({ queryKey: ['dailies-clips'] });
      queryClient.invalidateQueries({ queryKey: ['dailies-summary'] });
    },
  });

  const updateNote = useMutation({
    mutationFn: async ({
      id,
      ...input
    }: Partial<DailiesClipNoteInput> & { id: string }) => {
      const updateData: Record<string, any> = {};
      if (input.time_seconds !== undefined) updateData.time_seconds = input.time_seconds;
      if (input.note_text !== undefined) updateData.note_text = input.note_text;
      if (input.category !== undefined) updateData.category = input.category;

      const { data, error } = await supabase
        .from('backlot_dailies_clip_notes')
        .update(updateData)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data as BacklotDailiesClipNote;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dailies-clip-notes'] });
    },
  });

  const resolveNote = useMutation({
    mutationFn: async ({ id, resolved }: { id: string; resolved: boolean }) => {
      const { data, error } = await supabase
        .from('backlot_dailies_clip_notes')
        .update({ is_resolved: resolved })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data as BacklotDailiesClipNote;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dailies-clip-notes'] });
      queryClient.invalidateQueries({ queryKey: ['dailies-summary'] });
    },
  });

  const deleteNote = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('backlot_dailies_clip_notes').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dailies-clip-notes'] });
      queryClient.invalidateQueries({ queryKey: ['dailies-clip'] });
      queryClient.invalidateQueries({ queryKey: ['dailies-clips'] });
      queryClient.invalidateQueries({ queryKey: ['dailies-summary'] });
    },
  });

  return {
    notes: data || [],
    isLoading,
    error,
    refetch,
    addNote,
    updateNote,
    resolveNote,
    deleteNote,
  };
}

// =============================================================================
// PROJECT SUMMARY
// =============================================================================

export function useDailiesSummary(projectId: string | null) {
  return useQuery({
    queryKey: ['dailies-summary', projectId],
    queryFn: async (): Promise<DailiesProjectSummary | null> => {
      if (!projectId) return null;

      // Count days
      const { count: totalDays } = await supabase
        .from('backlot_dailies_days')
        .select('*', { count: 'exact', head: true })
        .eq('project_id', projectId);

      // Count cards
      const { count: totalCards } = await supabase
        .from('backlot_dailies_cards')
        .select('*', { count: 'exact', head: true })
        .eq('project_id', projectId);

      // Get clips with details
      const { data: clips } = await supabase
        .from('backlot_dailies_clips')
        .select('id, is_circle_take, storage_mode')
        .eq('project_id', projectId);

      const totalClips = clips?.length || 0;
      const circleTakes = clips?.filter(c => c.is_circle_take).length || 0;
      const cloudClips = clips?.filter(c => c.storage_mode === 'cloud').length || 0;
      const localClips = clips?.filter(c => c.storage_mode === 'local_drive').length || 0;

      // Get notes
      const clipIds = clips?.map(c => c.id) || [];
      let totalNotes = 0;
      let unresolvedNotes = 0;

      if (clipIds.length > 0) {
        const { data: notes } = await supabase
          .from('backlot_dailies_clip_notes')
          .select('is_resolved')
          .in('dailies_clip_id', clipIds);

        totalNotes = notes?.length || 0;
        unresolvedNotes = notes?.filter(n => !n.is_resolved).length || 0;
      }

      return {
        total_days: totalDays || 0,
        total_cards: totalCards || 0,
        total_clips: totalClips,
        circle_takes: circleTakes,
        cloud_clips: cloudClips,
        local_clips: localClips,
        total_notes: totalNotes,
        unresolved_notes: unresolvedNotes,
      };
    },
    enabled: !!projectId,
  });
}

// =============================================================================
// LOCAL INGEST
// =============================================================================

export function useLocalIngest() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (request: DailiesLocalIngestRequest) => {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) throw new Error('Not authenticated');

      // Create or find day
      let { data: existingDay } = await supabase
        .from('backlot_dailies_days')
        .select('id')
        .eq('project_id', request.project_id)
        .eq('shoot_date', request.shoot_date)
        .single();

      let dayId = existingDay?.id;

      if (!dayId) {
        const { data: newDay, error: dayError } = await supabase
          .from('backlot_dailies_days')
          .insert({
            project_id: request.project_id,
            shoot_date: request.shoot_date,
            label: request.day_label,
            unit: request.unit || null,
            created_by_user_id: userData.user.id,
          })
          .select()
          .single();

        if (dayError) throw dayError;
        dayId = newDay.id;
      }

      // Process each card
      const results = {
        day_id: dayId,
        cards_created: 0,
        clips_created: 0,
      };

      for (const cardInput of request.cards) {
        // Create card
        const { data: card, error: cardError } = await supabase
          .from('backlot_dailies_cards')
          .insert({
            dailies_day_id: dayId,
            project_id: request.project_id,
            camera_label: cardInput.camera_label,
            roll_name: cardInput.roll_name,
            storage_mode: 'local_drive',
            media_root_path: cardInput.media_root_path || null,
            storage_location: cardInput.storage_location || null,
            created_by_user_id: userData.user.id,
          })
          .select()
          .single();

        if (cardError) throw cardError;
        results.cards_created++;

        // Create clips
        if (cardInput.clips && cardInput.clips.length > 0) {
          const clipInserts = cardInput.clips.map(clip => ({
            dailies_card_id: card.id,
            project_id: request.project_id,
            file_name: clip.file_name,
            relative_path: clip.relative_path || null,
            storage_mode: 'local_drive' as DailiesStorageMode,
            duration_seconds: clip.duration_seconds || null,
            timecode_start: clip.timecode_start || null,
            frame_rate: clip.frame_rate || null,
            resolution: clip.resolution || null,
            codec: clip.codec || null,
            scene_number: clip.scene_number || null,
            take_number: clip.take_number || null,
            is_circle_take: false,
            created_by_user_id: userData.user.id,
          }));

          const { error: clipsError } = await supabase
            .from('backlot_dailies_clips')
            .insert(clipInserts);

          if (clipsError) throw clipsError;
          results.clips_created += clipInserts.length;
        }
      }

      return results;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dailies-days'] });
      queryClient.invalidateQueries({ queryKey: ['dailies-cards'] });
      queryClient.invalidateQueries({ queryKey: ['dailies-clips'] });
      queryClient.invalidateQueries({ queryKey: ['dailies-summary'] });
    },
  });
}

// =============================================================================
// HELPER HOOKS
// =============================================================================

// Get clips by scene for linking
export function useDailiesClipsByScene(projectId: string | null, sceneId: string | null) {
  return useQuery({
    queryKey: ['dailies-clips-by-scene', projectId, sceneId],
    queryFn: async () => {
      if (!projectId || !sceneId) return [];

      const { data: clips, error } = await supabase
        .from('backlot_dailies_clips')
        .select('*')
        .eq('project_id', projectId)
        .eq('script_scene_id', sceneId)
        .order('take_number', { ascending: true });

      if (error) throw error;
      return clips as BacklotDailiesClip[];
    },
    enabled: !!projectId && !!sceneId,
  });
}

// Get circle takes for quick review
export function useDailiesCircleTakes(projectId: string | null, dayId?: string | null) {
  return useQuery({
    queryKey: ['dailies-circle-takes', projectId, dayId],
    queryFn: async () => {
      if (!projectId) return [];

      let query = supabase
        .from('backlot_dailies_clips')
        .select('*')
        .eq('project_id', projectId)
        .eq('is_circle_take', true)
        .order('scene_number', { ascending: true })
        .order('take_number', { ascending: true });

      const { data: clips, error } = await query;
      if (error) throw error;
      if (!clips || clips.length === 0) return [];

      // If dayId filter, get cards for that day
      if (dayId) {
        const { data: cards } = await supabase
          .from('backlot_dailies_cards')
          .select('id')
          .eq('dailies_day_id', dayId);

        const cardIds = new Set(cards?.map(c => c.id) || []);
        return clips.filter(clip => cardIds.has(clip.dailies_card_id)) as BacklotDailiesClip[];
      }

      return clips as BacklotDailiesClip[];
    },
    enabled: !!projectId,
  });
}
