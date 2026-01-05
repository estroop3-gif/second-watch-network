import React from 'react';
import { useAuth } from '@/context/AuthContext';
import { api } from '@/lib/api';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { formatDistanceToNow } from 'date-fns';
import { toast } from 'sonner';

import { FilmmakerProfileData, StatusUpdate } from '@/types';
import { CommunityPost } from '@/types/community';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Form, FormField, FormItem, FormMessage } from '@/components/ui/form';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, User, MessageCircle, Heart } from 'lucide-react';
import { Link } from 'react-router-dom';

const statusUpdateSchema = z.object({
  content: z.string().min(1, "Update can't be empty.").max(1000, "Update must be 1000 characters or less."),
});

type StatusUpdateFormValues = z.infer<typeof statusUpdateSchema>;

const linkify = (text: string) => {
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  return text.split(urlRegex).map((part, i) => {
    if (part.match(urlRegex)) {
      return <a key={i} href={part} target="_blank" rel="noopener noreferrer" className="text-accent-yellow hover:underline">{part}</a>;
    }
    return part;
  });
};

// Display a status update
const StatusUpdatePost = ({ update }: { update: StatusUpdate }) => {
  const author = update.profiles;
  const nameToDisplay = author?.display_name ? `${author.display_name} (${author.full_name})` : author?.full_name || author?.username || 'Anonymous';

  return (
    <div className="flex gap-4 py-4">
      <Link to={`/profile/${author?.username}`}>
        <Avatar>
          <AvatarImage src={author?.avatar_url || undefined} />
          <AvatarFallback><User /></AvatarFallback>
        </Avatar>
      </Link>
      <div className="flex-grow">
        <div className="flex items-baseline gap-2">
          <Link to={`/profile/${author?.username}`} className="font-bold hover:underline">{nameToDisplay}</Link>
          <span className="text-xs text-muted-gray">
            {formatDistanceToNow(new Date(update.created_at), { addSuffix: true })}
          </span>
        </div>
        <p className="text-bone-white whitespace-pre-wrap">{linkify(update.content)}</p>
      </div>
    </div>
  );
};

// Display a community post marked as profile update
const ProfileUpdatePost = ({ post }: { post: CommunityPost & { profiles?: any } }) => {
  const author = post.profiles || post.author;
  const nameToDisplay = author?.display_name
    ? `${author.display_name} (${author.full_name})`
    : author?.full_name || author?.username || 'Anonymous';

  return (
    <div className="flex gap-4 py-4">
      <Link to={`/profile/${author?.username}`}>
        <Avatar>
          <AvatarImage src={author?.avatar_url || undefined} />
          <AvatarFallback><User /></AvatarFallback>
        </Avatar>
      </Link>
      <div className="flex-grow">
        <div className="flex items-baseline gap-2 flex-wrap">
          <Link to={`/profile/${author?.username}`} className="font-bold hover:underline">{nameToDisplay}</Link>
          <Badge variant="outline" className="text-xs border-accent-yellow/50 text-accent-yellow">
            Feed Post
          </Badge>
          <span className="text-xs text-muted-gray">
            {formatDistanceToNow(new Date(post.created_at), { addSuffix: true })}
          </span>
        </div>
        <p className="text-bone-white whitespace-pre-wrap mt-1">{linkify(post.content)}</p>
        {/* Show engagement stats */}
        <div className="flex items-center gap-4 mt-2 text-xs text-muted-gray">
          <span className="flex items-center gap-1">
            <Heart className="h-3 w-3" />
            {post.reactions_count || post.like_count || 0}
          </span>
          <span className="flex items-center gap-1">
            <MessageCircle className="h-3 w-3" />
            {post.comments_count || post.comment_count || 0}
          </span>
        </div>
      </div>
    </div>
  );
};

// Union type for combined updates
type CombinedUpdate =
  | { type: 'status'; data: StatusUpdate; created_at: string }
  | { type: 'post'; data: CommunityPost & { profiles?: any; reactions_count?: number; comments_count?: number }; created_at: string };

const ProfileStatusUpdates = ({ profile }: { profile: FilmmakerProfileData | any }) => {
  const { profileId } = useAuth();
  const queryClient = useQueryClient();

  // The profile object can come from two different sources with different shapes.
  // This line reliably gets the user UUID from either `profile.user_id` or `profile.id`.
  const targetUserId = profile?.user_id || profile?.id;

  const isOwner = profileId === targetUserId;

  // Fetch status updates
  const { data: statusUpdates, isLoading: statusLoading } = useQuery({
    queryKey: ['status_updates', targetUserId],
    queryFn: async () => {
      if (!targetUserId) return [];
      return await api.listStatusUpdates(targetUserId) as StatusUpdate[];
    },
    enabled: !!targetUserId,
  });

  // Fetch profile posts (community posts marked as profile updates)
  const { data: profilePosts, isLoading: postsLoading } = useQuery({
    queryKey: ['profile_updates', targetUserId],
    queryFn: async () => {
      if (!targetUserId) return [];
      return await api.getProfileUpdates(targetUserId) as (CommunityPost & { profiles?: any; reactions_count?: number; comments_count?: number })[];
    },
    enabled: !!targetUserId,
  });

  // Combine and sort all updates by date
  const combinedUpdates: CombinedUpdate[] = React.useMemo(() => {
    const items: CombinedUpdate[] = [];

    // Add status updates
    (statusUpdates || []).forEach((update) => {
      items.push({ type: 'status', data: update, created_at: update.created_at });
    });

    // Add profile posts
    (profilePosts || []).forEach((post) => {
      items.push({ type: 'post', data: post, created_at: post.created_at });
    });

    // Sort by date descending
    return items.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }, [statusUpdates, profilePosts]);

  const isLoading = statusLoading || postsLoading;

  const mutation = useMutation({
    mutationFn: async (newUpdate: { content: string }) => {
      if (!profileId) throw new Error("Not authenticated");
      return await api.createStatusUpdate({
        content: newUpdate.content,
        type: 'manual',
      });
    },
    onSuccess: (newlyCreatedUpdate) => {
      queryClient.setQueryData(['status_updates', targetUserId], (oldData: StatusUpdate[] | undefined) => {
        return newlyCreatedUpdate ? [newlyCreatedUpdate, ...(oldData || [])] : oldData;
      });
      toast.success("Status posted to your profile!");
      form.reset();
    },
    onError: (error: any) => {
      toast.error(`Failed to post update: ${error.message}`);
    },
  });

  const form = useForm<StatusUpdateFormValues>({
    resolver: zodResolver(statusUpdateSchema),
    defaultValues: { content: "" },
  });

  const onSubmit = (data: StatusUpdateFormValues) => {
    mutation.mutate(data);
  };

  return (
    <div className="space-y-6">
      {isOwner && (
        <Card className="bg-charcoal-black/50 border-muted-gray/20">
          <CardContent className="p-4">
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="content"
                  render={({ field }) => (
                    <FormItem>
                      <Textarea {...field} placeholder="Post an update..." className="bg-charcoal-black border-muted-gray/50 min-h-[80px]" />
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="flex justify-end">
                  <Button type="submit" disabled={mutation.isPending}>
                    {mutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Post Update
                  </Button>
                </div>
              </form>
            </Form>
          </CardContent>
        </Card>
      )}
      
      {isLoading ? (
        <div className="flex justify-center py-8"><Loader2 className="h-8 w-8 animate-spin" /></div>
      ) : combinedUpdates && combinedUpdates.length > 0 ? (
        <div className="divide-y divide-muted-gray/20">
          {combinedUpdates.map((item) =>
            item.type === 'status' ? (
              <StatusUpdatePost key={`status-${item.data.id}`} update={item.data} />
            ) : (
              <ProfileUpdatePost key={`post-${item.data.id}`} post={item.data} />
            )
          )}
        </div>
      ) : (
        <p className="text-center text-muted-gray py-8">No updates yet.</p>
      )}
    </div>
  );
};

export default ProfileStatusUpdates;