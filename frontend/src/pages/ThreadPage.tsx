import { useParams, Link, useLocation, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Skeleton } from '@/components/ui/skeleton';
import { ForumThread, ForumReply } from '@/types';
import { ReplyCard } from '@/components/backlot/ReplyCard';
import { ReplyForm } from '@/components/forms/ReplyForm';
import { usePermissions } from '@/hooks/usePermissions';
import { useAuth } from '@/context/AuthContext';
import { formatDistanceToNow } from 'date-fns';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { User, ShieldQuestion, MessageSquare, Pin } from 'lucide-react';
import { useEffect } from 'react';

const fetchThread = async (threadId: string) => {
  const { data, error } = await supabase
    .from('forum_threads_with_details')
    .select('*')
    .eq('id', threadId)
    .single();
  
  if (error) throw new Error(error.message);
  return data as ForumThread;
};

const fetchReplies = async (threadId: string) => {
  const { data, error } = await supabase
    .from('forum_replies_with_profiles')
    .select('*')
    .eq('thread_id', threadId)
    .order('created_at', { ascending: true });

  if (error) throw new Error(error.message);
  return data as ForumReply[];
};

const getRoleBadge = (roles: string[] | undefined | null) => {
  if (!roles) return null;
  if (roles.includes('admin')) return <Badge className="bg-red-500 text-white">Admin</Badge>;
  if (roles.includes('filmmaker')) return <Badge variant="secondary">Filmmaker</Badge>;
  return null;
};

const ThreadPage = () => {
  const { threadId } = useParams<{ threadId: string }>();
  const { user, loading: authLoading } = useAuth();
  const { hasAnyRole, isLoading: permissionsLoading } = usePermissions();
  const location = useLocation();
  const navigate = useNavigate();

  const { data: thread, isLoading: isLoadingThread, isError: isErrorThread } = useQuery({
    queryKey: ['thread', threadId],
    queryFn: () => fetchThread(threadId!),
    enabled: !!threadId,
  });

  const { data: replies, isLoading: isLoadingReplies } = useQuery({
    queryKey: ['thread_replies', threadId],
    queryFn: () => fetchReplies(threadId!),
    enabled: !!threadId,
  });

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const resume = params.get('resume') === '1';
    const context = params.get('context');
    if (resume && context === 'forum_reply') {
      // Try to focus the first reply textarea
      const el = document.querySelector('textarea');
      if (el && 'focus' in el) {
        (el as HTMLTextAreaElement).focus();
        (el as HTMLTextAreaElement).scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
      // Clean URL
      navigate(location.pathname, { replace: true });
    }
  }, [location, navigate]);

  if (isLoadingThread || authLoading || permissionsLoading) {
    return (
      <div className="container mx-auto py-8 px-4 md:px-8">
        <Skeleton className="h-10 w-3/4 mb-4" />
        <Skeleton className="h-6 w-1/2 mb-8" />
        <div className="space-y-6">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
        </div>
      </div>
    );
  }

  if (isErrorThread || !thread) {
    return <div className="text-center py-12 text-bone-white">Could not load thread. It might not exist or there was an error.</div>;
  }
  
  const isAnonymous = thread.is_anonymous;
  const authorProfileLink = !isAnonymous && thread.username ? `/profile/${thread.username}` : '#';
  const isAuthorClickable = !isAnonymous && !!thread.username;
  const nameToDisplay = isAnonymous 
    ? 'Anonymous' 
    : thread.display_name || thread.full_name || thread.username || 'Unknown User';

  return (
    <div className="container mx-auto py-8 px-4 md:px-8">
      {/* Thread Header */}
      <div className="mb-8">
        <div className="flex items-center gap-2 mb-2">
          {thread.is_pinned && <Pin className="h-5 w-5 text-accent-yellow" />}
          <h1 className="text-3xl md:text-4xl font-bold text-bone-white">{thread.title}</h1>
        </div>
        <div className="flex items-center flex-wrap gap-x-4 gap-y-2 text-sm text-muted-gray">
          <div className="flex items-center gap-2">
            {isAuthorClickable ? (
              <Link to={authorProfileLink}>
                <Avatar className="h-8 w-8">
                  <AvatarImage src={thread.avatar_url || undefined} alt={thread.username || ''} />
                  <AvatarFallback><User className="h-4 w-4" /></AvatarFallback>
                </Avatar>
              </Link>
            ) : (
              <Avatar className="h-8 w-8">
                {isAnonymous ? (
                  <AvatarFallback><ShieldQuestion className="h-4 w-4" /></AvatarFallback>
                ) : (
                  <>
                    <AvatarImage src={thread.avatar_url || undefined} alt={thread.username || ''} />
                    <AvatarFallback><User className="h-4 w-4" /></AvatarFallback>
                  </>
                )}
              </Avatar>
            )}
            {isAuthorClickable ? (
              <Link to={authorProfileLink} className="hover:underline font-semibold text-bone-white">{nameToDisplay}</Link>
            ) : (
              <span className="font-semibold text-bone-white">{nameToDisplay}</span>
            )}
            {!isAnonymous && getRoleBadge(thread.roles)}
          </div>
          <span>·</span>
          <span>Posted {formatDistanceToNow(new Date(thread.created_at), { addSuffix: true })}</span>
          {thread.category_name && <Badge variant="outline">{thread.category_name}</Badge>}
        </div>
      </div>

      {/* Thread Body */}
      <div className="prose prose-invert max-w-none prose-p:text-bone-white prose-headings:text-bone-white prose-strong:text-bone-white prose-a:text-accent-yellow">
        <p>{thread.body}</p>
      </div>
      
      <div className="flex gap-2 flex-wrap mt-4">
        {thread.tags?.map(tag => <Badge key={tag} variant="secondary">{tag}</Badge>)}
      </div>

      <hr className="my-8 border-muted-gray/20" />

      {/* Replies Section */}
      <div className="space-y-6">
        <h2 className="text-2xl font-bold text-bone-white flex items-center gap-2">
          <MessageSquare className="h-6 w-6" />
          Replies ({replies?.length || 0})
        </h2>
        {isLoadingReplies ? (
          <div className="space-y-4">
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-20 w-full" />
          </div>
        ) : (
          replies?.map(reply => <ReplyCard key={reply.id} reply={reply} />)
        )}
        {replies?.length === 0 && !isLoadingReplies && (
          <p className="text-muted-gray text-center py-4">No replies yet. Be the first to respond!</p>
        )}
      </div>

      {/* Reply Form (permission gate is handled inside the form via UpgradeGate) */}
      {user && (
        <div className="mt-12">
          <ReplyForm threadId={threadId!} />
        </div>
      )}
      {!user && !authLoading && (
        <div className="mt-12 text-center p-6 bg-muted-gray/10 rounded-lg">
          <p className="text-bone-white">
            <Link to="/login" className="text-accent-yellow font-bold hover:underline">Log in</Link> or <Link to="/signup" className="text-accent-yellow font-bold hover:underline">sign up</Link> to join the conversation.
          </p>
        </div>
      )}
    </div>
  );
};

export default ThreadPage;