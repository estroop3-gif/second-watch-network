import React, { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Link } from 'react-router-dom';
import { formatDistanceToNow } from 'date-fns';
import { FileText, UserPlus, Loader2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

// Define types for the feed items
interface FeedItemBase {
  id: string;
  created_at: string;
}

interface SubmissionFeedItem extends FeedItemBase {
  type: 'submission';
  project_title: string;
  profiles: {
    username: string | null;
    full_name: string | null;
  } | null;
}

interface UserFeedItem extends FeedItemBase {
  type: 'user';
  username: string | null;
  full_name: string | null;
}

type CombinedFeedItem = SubmissionFeedItem | UserFeedItem;

// Component to render a single feed item
const FeedItem = ({ item }: { item: CombinedFeedItem }) => {
  if (item.type === 'submission') {
    const submitterName = item.profiles?.full_name || item.profiles?.username || 'A user';
    return (
      <Link to={`/admin/submissions`} className="block p-3 hover:bg-muted-gray/20 rounded-md">
        <div className="flex items-start gap-3">
          <FileText className="h-5 w-5 text-accent-yellow mt-1 flex-shrink-0" />
          <div className="flex-grow">
            <p>
              <span className="font-bold">{submitterName}</span> submitted a new project: <span className="italic">"{item.project_title}"</span>
            </p>
            <p className="text-xs text-muted-gray">{formatDistanceToNow(new Date(item.created_at), { addSuffix: true })}</p>
          </div>
        </div>
      </Link>
    );
  }

  if (item.type === 'user') {
    const userName = item.full_name || item.username || 'a new user';
    return (
      <Link to={`/admin/users`} className="block p-3 hover:bg-muted-gray/20 rounded-md">
        <div className="flex items-start gap-3">
          <UserPlus className="h-5 w-5 text-accent-yellow mt-1 flex-shrink-0" />
          <div className="flex-grow">
            <p>
              New user signed up: <span className="font-bold">{userName}</span>
            </p>
            <p className="text-xs text-muted-gray">{formatDistanceToNow(new Date(item.created_at), { addSuffix: true })}</p>
          </div>
        </div>
      </Link>
    );
  }

  return null;
};


const AdminNotificationsFeed = () => {
  const queryClient = useQueryClient();
  const { data: feedItems, isLoading, error } = useQuery<CombinedFeedItem[]>({
    queryKey: ['adminFeed'],
    queryFn: () => api.getAdminFeed(15),
    staleTime: 60 * 1000, // 1 minute
  });

  // Polling fallback for realtime updates (replaces Supabase realtime subscriptions)
  useEffect(() => {
    const interval = setInterval(() => {
      queryClient.invalidateQueries({ queryKey: ['adminFeed'] });
      queryClient.invalidateQueries({ queryKey: ['adminDashboardStats'] });
    }, 30000); // Poll every 30 seconds

    return () => clearInterval(interval);
  }, [queryClient]);

  return (
    <Card className="transform -rotate-1 border-2 border-dashed border-muted-gray bg-transparent">
      <CardHeader>
        <CardTitle className="text-3xl font-heading">Notifications Feed</CardTitle>
        <p className="text-muted-gray">Updates for new submissions, signups, and more.</p>
      </CardHeader>
      <CardContent>
        {isLoading && (
          <div className="flex justify-center items-center h-40">
            <Loader2 className="h-8 w-8 animate-spin text-accent-yellow" />
          </div>
        )}
        {error && <p className="text-primary-red text-center">Could not load feed: {(error as Error).message}</p>}
        {feedItems && feedItems.length > 0 && (
          <div className="space-y-2 max-h-96 overflow-y-auto pr-2">
            {feedItems.map(item => <FeedItem key={`${item.type}-${item.id}`} item={item} />)}
          </div>
        )}
        {feedItems && feedItems.length === 0 && !isLoading && (
          <p className="text-muted-gray text-center h-40 flex items-center justify-center">No recent activity.</p>
        )}
      </CardContent>
    </Card>
  );
};

export default AdminNotificationsFeed;
