import { useEffect } from 'react';
import { CommunityProfile } from '@/types';
import { useQueryClient } from '@tanstack/react-query';

type Props = {
  onUpsert: (profile: CommunityProfile) => void;
  onRemove: (profileId: string) => void;
  queryKey: unknown[];
};

/**
 * Community realtime hook - currently a no-op after migration from Supabase.
 * Realtime updates are handled via polling in useCommunity hook.
 * This hook can be enhanced in the future with WebSocket support if needed.
 */
export function useCommunityRealtime({ onUpsert, onRemove, queryKey }: Props) {
  const qc = useQueryClient();

  useEffect(() => {
    // No-op: Realtime subscriptions have been migrated to polling.
    // The useCommunity hook has refetchInterval set for updates.
    // Future enhancement: Add WebSocket support for real-time updates.
  }, [onUpsert, onRemove, qc, JSON.stringify(queryKey)]);
}
