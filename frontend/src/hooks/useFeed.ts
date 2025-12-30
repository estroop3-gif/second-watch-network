/**
 * useFeed - Hook for fetching and managing community feed posts
 */
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type {
  CommunityPost,
  PostComment,
  PostInput,
  PostUpdateInput,
  CommentInput,
  FeedResponse,
} from '@/types/community';

type FeedType = 'public' | 'connections';

interface UseFeedOptions {
  type: FeedType;
  limit?: number;
  enabled?: boolean;
}

export function useFeed(options: UseFeedOptions) {
  const { type, limit = 20, enabled = true } = options;
  const queryClient = useQueryClient();

  const queryKey = ['community-feed', type];

  const query = useInfiniteQuery({
    queryKey,
    queryFn: async ({ pageParam }) => {
      const data = type === 'public'
        ? await api.listPublicFeed({ limit, before: pageParam })
        : await api.listConnectionsFeed({ limit, before: pageParam });
      return data as FeedResponse;
    },
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.next_cursor || undefined,
    enabled,
  });

  // Flatten posts from all pages
  const posts = query.data?.pages.flatMap((p) => p.posts) as CommunityPost[] | undefined;

  const createPost = useMutation({
    mutationFn: async (input: PostInput) => {
      return api.createPost(input);
    },
    onSuccess: async () => {
      // Invalidate and refetch both feeds since a new post was created
      await queryClient.invalidateQueries({ queryKey: ['community-feed'] });
      await queryClient.refetchQueries({ queryKey: ['community-feed'] });
    },
  });

  const updatePost = useMutation({
    mutationFn: async ({ id, ...input }: PostUpdateInput & { id: string }) => {
      return api.updatePost(id, input);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['community-feed'] });
      await queryClient.refetchQueries({ queryKey: ['community-feed'] });
    },
  });

  const deletePost = useMutation({
    mutationFn: async (id: string) => {
      return api.deletePost(id);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['community-feed'] });
      await queryClient.refetchQueries({ queryKey: ['community-feed'] });
    },
  });

  const likePost = useMutation({
    mutationFn: async (postId: string) => {
      return api.likePost(postId);
    },
    onMutate: async (postId) => {
      // Optimistic update
      await queryClient.cancelQueries({ queryKey });

      const previousData = queryClient.getQueryData(queryKey);

      queryClient.setQueryData(queryKey, (old: any) => {
        if (!old) return old;
        return {
          ...old,
          pages: old.pages.map((page: FeedResponse) => ({
            ...page,
            posts: page.posts.map((post: CommunityPost) =>
              post.id === postId
                ? { ...post, is_liked: true, like_count: post.like_count + 1 }
                : post
            ),
          })),
        };
      });

      return { previousData };
    },
    onError: (_err, _postId, context) => {
      // Rollback on error
      if (context?.previousData) {
        queryClient.setQueryData(queryKey, context.previousData);
      }
    },
    onSettled: () => {
      // Optionally refetch to ensure consistency
      // queryClient.invalidateQueries({ queryKey });
    },
  });

  const unlikePost = useMutation({
    mutationFn: async (postId: string) => {
      return api.unlikePost(postId);
    },
    onMutate: async (postId) => {
      // Optimistic update
      await queryClient.cancelQueries({ queryKey });

      const previousData = queryClient.getQueryData(queryKey);

      queryClient.setQueryData(queryKey, (old: any) => {
        if (!old) return old;
        return {
          ...old,
          pages: old.pages.map((page: FeedResponse) => ({
            ...page,
            posts: page.posts.map((post: CommunityPost) =>
              post.id === postId
                ? { ...post, is_liked: false, like_count: Math.max(0, post.like_count - 1) }
                : post
            ),
          })),
        };
      });

      return { previousData };
    },
    onError: (_err, _postId, context) => {
      if (context?.previousData) {
        queryClient.setQueryData(queryKey, context.previousData);
      }
    },
  });

  return {
    posts,
    isLoading: query.isLoading,
    isFetchingNextPage: query.isFetchingNextPage,
    hasNextPage: query.hasNextPage,
    fetchNextPage: query.fetchNextPage,
    error: query.error,
    refetch: query.refetch,
    createPost,
    updatePost,
    deletePost,
    likePost,
    unlikePost,
  };
}

export function usePostComments(postId: string | null) {
  const queryClient = useQueryClient();
  const queryKey = ['post-comments', postId];

  const query = useQuery({
    queryKey,
    queryFn: async () => {
      if (!postId) return [];
      return api.listPostComments(postId) as Promise<PostComment[]>;
    },
    enabled: !!postId,
  });

  const createComment = useMutation({
    mutationFn: async (input: CommentInput) => {
      if (!postId) throw new Error('Post ID required');
      return api.createPostComment(postId, input);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      // Also update comment count in feed
      queryClient.invalidateQueries({ queryKey: ['community-feed'] });
    },
  });

  const updateComment = useMutation({
    mutationFn: async ({ id, content }: { id: string; content: string }) => {
      return api.updatePostComment(id, { content });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
    },
  });

  const deleteComment = useMutation({
    mutationFn: async (id: string) => {
      return api.deletePostComment(id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      queryClient.invalidateQueries({ queryKey: ['community-feed'] });
    },
  });

  return {
    comments: query.data || [],
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
    createComment,
    updateComment,
    deleteComment,
  };
}

export function useLinkPreview() {
  return useMutation({
    mutationFn: async (url: string) => {
      return api.fetchLinkPreview(url);
    },
  });
}
