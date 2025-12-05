import React, { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
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

// Fetch function
const fetchAdminFeed = async (): Promise<CombinedFeedItem[]> => {
  const { data: submissions, error: subError } = await supabase
    .from('submissions')
    .select('id, project_title, created_at, profiles(username, full_name)')
    .order('created_at', { ascending: false })
    .limit(10);

  if (subError) throw new Error(subError.message);

  const { data: users, error: userError } = await supabase
    .from('profiles')
    .select('id, username, full_name, created_at')
    .order('created_at', { ascending: false })
    .limit(10);

  if (userError) throw new Error(userError.message);

  const typedSubmissions: SubmissionFeedItem[] = submissions.map(s => ({ ...s, type: 'submission' }));
  const typedUsers: UserFeedItem[] = users.map(u => ({ ...u, type: 'user' }));

  const combined = [...typedSubmissions, ...typedUsers];
  
  combined.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  return combined.slice(0, 15); // Limit the final combined feed
};

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
    queryFn: fetchAdminFeed,
    staleTime: 60 * 1000, // 1 minute
  });

  useEffect(() => {
    const handleNewSubmission = (payload: any) => {
      const newSubmission = payload.new;
      supabase.from('profiles').select('username, full_name').eq('id', newSubmission.user_id).single().then(({ data: profileData }) => {
        const submitterName = profileData?.full_name || profileData?.username || 'A user';
        toast.info(`New Submission: "${newSubmission.project_title}"`, {
          description: `From: ${submitterName}`,
        });
        queryClient.invalidateQueries({ queryKey: ['adminFeed'] });
        queryClient.invalidateQueries({ queryKey: ['adminDashboardStats'] });
      });
    };

    const handleNewUser = (payload: any) => {
      const newUser = payload.new;
      const userName = newUser.full_name || newUser.username || 'a new user';
      toast.info(`New User Signup: ${userName}`);
      queryClient.invalidateQueries({ queryKey: ['adminFeed'] });
      queryClient.invalidateQueries({ queryKey: ['adminDashboardStats'] });
    };

    const submissionChannel = supabase
      .channel('admin-realtime-submissions')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'submissions' }, handleNewSubmission)
      .subscribe();

    const profileChannel = supabase
      .channel('admin-realtime-profiles')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'profiles' }, handleNewUser)
      .subscribe();

    return () => {
      supabase.removeChannel(submissionChannel);
      supabase.removeChannel(profileChannel);
    };
  }, [queryClient]);

  return (
    <Card className="transform -rotate-1 border-2 border-dashed border-muted-gray bg-transparent">
      <CardHeader>
        <CardTitle className="text-3xl font-heading">Notifications Feed</CardTitle>
        <p className="text-muted-gray">Live updates for new submissions, signups, and more.</p>
      </CardHeader>
      <CardContent>
        {isLoading && (
          <div className="flex justify-center items-center h-40">
            <Loader2 className="h-8 w-8 animate-spin text-accent-yellow" />
          </div>
        )}
        {error && <p className="text-primary-red text-center">Could not load feed: {error.message}</p>}
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