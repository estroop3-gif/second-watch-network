/**
 * useCommunityActivity - Hook for fetching recent community activity
 */
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { CommunityActivity } from '@/types/community';

interface UseCommunityActivityOptions {
  limit?: number;
}

export function useCommunityActivity(options: UseCommunityActivityOptions = {}) {
  const { limit = 20 } = options;

  return useQuery({
    queryKey: ['community-activity', { limit }],
    queryFn: async () => {
      // Fetch recent collabs
      const { data: collabs, error: collabsError } = await supabase
        .from('community_collabs')
        .select('id, title, type, created_at, user_id')
        .eq('is_active', true)
        .order('created_at', { ascending: false })
        .limit(limit / 2);

      if (collabsError) throw collabsError;

      // Fetch recent threads
      const { data: threads, error: threadsError } = await supabase
        .from('community_topic_threads')
        .select('id, title, created_at, user_id, topic:community_topics(name, slug)')
        .order('created_at', { ascending: false })
        .limit(limit / 2);

      if (threadsError) throw threadsError;

      // Collect all user IDs and fetch profiles
      const allUserIds = [
        ...(collabs?.map(c => c.user_id) || []),
        ...(threads?.map(t => t.user_id) || []),
      ];
      const uniqueUserIds = [...new Set(allUserIds)];

      let profileMap = new Map<string, any>();
      if (uniqueUserIds.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, username, display_name, full_name, avatar_url')
          .in('id', uniqueUserIds);
        profileMap = new Map(profiles?.map(p => [p.id, p]) || []);
      }

      // Combine and format activity items
      const activity: CommunityActivity[] = [];

      // Add collab activities
      collabs?.forEach((collab) => {
        activity.push({
          id: collab.id,
          type: 'collab',
          action: 'created',
          title: collab.title,
          user_id: collab.user_id,
          created_at: collab.created_at,
          profile: profileMap.get(collab.user_id) || null,
          metadata: { collab_type: collab.type },
        });
      });

      // Add thread activities
      threads?.forEach((thread) => {
        activity.push({
          id: thread.id,
          type: 'thread',
          action: 'created',
          title: thread.title,
          user_id: thread.user_id,
          created_at: thread.created_at,
          profile: profileMap.get(thread.user_id) || null,
          metadata: { topic_name: thread.topic?.name },
        });
      });

      // Sort by created_at descending
      activity.sort((a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );

      return activity.slice(0, limit);
    },
  });
}
