import { useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { CommunityProfile } from '@/types';
import { useQueryClient } from '@tanstack/react-query';

type Props = {
  onUpsert: (profile: CommunityProfile) => void;
  onRemove: (profileId: string) => void;
  queryKey: unknown[];
};

export function useCommunityRealtime({ onUpsert, onRemove, queryKey }: Props) {
  const qc = useQueryClient();

  useEffect(() => {
    const channel = supabase
      .channel('community-live')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'community_profiles' }, (payload) => {
        const row = payload.new as CommunityProfile & { is_visible?: boolean };
        if (!row) return;
        // Only consider eligible/visible profiles
        if ((row as any).is_visible === true) {
          onUpsert({
            profile_id: row.profile_id,
            username: row.username ?? null,
            full_name: row.full_name ?? null,
            display_name: row.display_name ?? null,
            avatar_url: row.avatar_url ?? null,
            created_at: (row as any).created_at,
            updated_at: (row as any).updated_at,
          });
        }
        // Invalidate all community caches so other filters stay fresh
        qc.invalidateQueries({ queryKey: ['community'] });
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'community_profiles' }, (payload) => {
        const row = payload.new as CommunityProfile & { is_visible?: boolean };
        if (!row) return;
        if ((row as any).is_visible === true) {
          onUpsert({
            profile_id: row.profile_id,
            username: row.username ?? null,
            full_name: row.full_name ?? null,
            display_name: row.display_name ?? null,
            avatar_url: row.avatar_url ?? null,
            created_at: (row as any).created_at,
            updated_at: (row as any).updated_at,
          });
        } else {
          onRemove(row.profile_id);
        }
        qc.invalidateQueries({ queryKey: ['community'] });
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'community_profiles' }, (payload) => {
        const oldRow = payload.old as { profile_id: string } | null;
        if (oldRow?.profile_id) {
          onRemove(oldRow.profile_id);
        }
        qc.invalidateQueries({ queryKey: ['community'] });
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [onUpsert, onRemove, qc, JSON.stringify(queryKey)]);
}