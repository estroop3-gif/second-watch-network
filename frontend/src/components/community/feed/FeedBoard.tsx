/**
 * FeedBoard - Main container for the community feed with sub-tabs
 */
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { PenSquare, Loader2, Image, Link as LinkIcon, Activity } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useEnrichedProfile } from '@/context/EnrichedProfileContext';
import { useFeed } from '@/hooks/useFeed';
import { useFriendsActivity } from '@/hooks/useFriendsActivity';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import FeedSubTabs, { type FeedSubTab } from './FeedSubTabs';
import PostCard from './PostCard';
import PostForm from './PostForm';
import ActivityCard from './ActivityCard';
import AvailabilityQuickToggle from './AvailabilityQuickToggle';
import type { CommunityPost, PostInput } from '@/types/community';

const FeedBoard: React.FC = () => {
  const { user, profileId } = useAuth();
  const isAuthenticated = !!user;
  const { profile } = useEnrichedProfile();
  const [activeTab, setActiveTab] = useState<FeedSubTab>('public');
  const [postFormOpen, setPostFormOpen] = useState(false);
  const [editingPost, setEditingPost] = useState<CommunityPost | null>(null);

  // Fetch filmmaker profile for availability status
  const { data: filmmakerProfile } = useQuery({
    queryKey: ['filmmaker-profile', profileId],
    queryFn: async () => {
      if (!profileId) return null;
      try {
        return await api.getFilmmakerProfile(profileId);
      } catch {
        return null;
      }
    },
    enabled: isAuthenticated && !!profileId,
  });

  // Get user display info for the composer
  const userName = profile?.full_name || profile?.display_name || profile?.username || 'You';
  const userInitials = userName.slice(0, 1).toUpperCase();
  const userAvatar = profile?.avatar_url;

  const {
    posts,
    isLoading,
    isFetchingNextPage,
    hasNextPage,
    fetchNextPage,
    createPost,
    updatePost,
    deletePost,
    likePost,
    unlikePost,
  } = useFeed({
    type: activeTab,
    enabled: activeTab === 'public' || isAuthenticated,
  });

  // Fetch friends activity for the connections sub-tab
  const { data: friendsActivityData, isLoading: isLoadingActivity } = useFriendsActivity(
    15,
    activeTab === 'connections' && isAuthenticated,
  );
  const friendsActivities = friendsActivityData?.activities || [];

  const handleCreatePost = async (data: PostInput) => {
    await createPost.mutateAsync(data);
    setPostFormOpen(false);
  };

  const handleUpdatePost = async (data: PostInput) => {
    if (!editingPost) return;
    await updatePost.mutateAsync({ id: editingPost.id, ...data });
    setEditingPost(null);
  };

  const handleDeletePost = async (postId: string) => {
    if (!confirm('Are you sure you want to delete this post?')) return;
    await deletePost.mutateAsync(postId);
  };

  const handleEditPost = (post: CommunityPost) => {
    setEditingPost(post);
    setPostFormOpen(true);
  };

  const handleFormClose = (open: boolean) => {
    setPostFormOpen(open);
    if (!open) setEditingPost(null);
  };

  return (
    <div className="space-y-4">
      {/* Sub-tabs */}
      <FeedSubTabs
        activeTab={activeTab}
        onTabChange={setActiveTab}
        isAuthenticated={isAuthenticated}
      />

      {/* Quick Availability Toggle - shows for authenticated users with filmmaker profile */}
      {isAuthenticated && filmmakerProfile && (
        <AvailabilityQuickToggle
          initialAcceptingWork={filmmakerProfile.accepting_work || false}
          initialStatusMessage={profile?.status_message || ''}
        />
      )}

      {/* Inline Post Composer - shows for authenticated users */}
      {isAuthenticated && (
        <div className="bg-charcoal-black/50 border border-muted-gray/20 rounded-lg p-4">
          <div className="flex gap-3">
            <Avatar className="w-10 h-10 flex-shrink-0">
              <AvatarImage src={userAvatar || ''} alt={userName} />
              <AvatarFallback>{userInitials}</AvatarFallback>
            </Avatar>
            <button
              onClick={() => setPostFormOpen(true)}
              className="flex-1 bg-charcoal-black/50 border border-muted-gray/30 rounded-full px-4 py-2.5 text-left text-muted-gray hover:border-muted-gray/50 hover:text-bone-white transition-colors"
            >
              What's on your mind, {userName.split(' ')[0]}?
            </button>
          </div>
          <div className="flex gap-2 mt-3 pt-3 border-t border-muted-gray/20">
            <Button
              variant="ghost"
              size="sm"
              className="flex-1 text-muted-gray hover:text-bone-white hover:bg-muted-gray/10"
              onClick={() => setPostFormOpen(true)}
            >
              <Image className="w-4 h-4 mr-2 text-emerald-400" />
              Photo
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="flex-1 text-muted-gray hover:text-bone-white hover:bg-muted-gray/10"
              onClick={() => setPostFormOpen(true)}
            >
              <LinkIcon className="w-4 h-4 mr-2 text-blue-400" />
              Link
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="flex-1 text-muted-gray hover:text-bone-white hover:bg-muted-gray/10"
              onClick={() => setPostFormOpen(true)}
            >
              <PenSquare className="w-4 h-4 mr-2 text-accent-yellow" />
              Post
            </Button>
          </div>
        </div>
      )}

      {/* Sign in prompt for unauthenticated users */}
      {!isAuthenticated && (
        <div className="bg-charcoal-black/50 border border-muted-gray/20 rounded-lg p-4 text-center">
          <p className="text-muted-gray">
            <a href="/login" className="text-accent-yellow hover:underline">Sign in</a> to share posts with the community.
          </p>
        </div>
      )}

      {/* Connections tab message for unauthenticated users */}
      {activeTab === 'connections' && !isAuthenticated && (
        <div className="bg-charcoal-black/50 border border-muted-gray/20 rounded-lg p-8 text-center">
          <p className="text-muted-gray">
            Sign in to see posts from your connections.
          </p>
        </div>
      )}

      {/* Friends Activity - shown on connections sub-tab */}
      {activeTab === 'connections' && isAuthenticated && (
        <>
          {isLoadingActivity && (
            <div className="flex justify-center py-6">
              <Loader2 className="w-6 h-6 animate-spin text-muted-gray" />
            </div>
          )}
          {!isLoadingActivity && friendsActivities.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 px-1">
                <Activity className="w-4 h-4 text-accent-yellow" />
                <h3 className="text-sm font-medium text-bone-white">Friends Activity</h3>
              </div>
              <div className="space-y-2">
                {friendsActivities.map((activity, idx) => (
                  <ActivityCard key={`${activity.user_id}-${activity.type}-${idx}`} activity={activity} />
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {/* Loading state */}
      {isLoading && (
        <div className="flex justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-muted-gray" />
        </div>
      )}

      {/* Empty state */}
      {!isLoading && (!posts || posts.length === 0) && (activeTab === 'public' || isAuthenticated) && (
        <div className="bg-charcoal-black/50 border border-muted-gray/20 rounded-lg p-8 text-center">
          <p className="text-muted-gray mb-4">
            {activeTab === 'public'
              ? 'No posts yet. Be the first to share something!'
              : 'No posts from your connections yet.'}
          </p>
          {isAuthenticated && (
            <Button
              onClick={() => setPostFormOpen(true)}
              className="bg-accent-yellow text-charcoal-black hover:bg-accent-yellow/90"
            >
              <PenSquare className="w-4 h-4 mr-2" />
              Create the First Post
            </Button>
          )}
        </div>
      )}

      {/* Posts list */}
      {posts && posts.length > 0 && (
        <div className="space-y-4">
          {posts.map((post) => (
            <PostCard
              key={post.id}
              post={post}
              onLike={(id) => likePost.mutate(id)}
              onUnlike={(id) => unlikePost.mutate(id)}
              onEdit={handleEditPost}
              onDelete={handleDeletePost}
              isLiking={likePost.isPending || unlikePost.isPending}
            />
          ))}

          {/* Load more */}
          {hasNextPage && (
            <div className="flex justify-center pt-4">
              <Button
                variant="outline"
                onClick={() => fetchNextPage()}
                disabled={isFetchingNextPage}
              >
                {isFetchingNextPage ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Loading...
                  </>
                ) : (
                  'Load More'
                )}
              </Button>
            </div>
          )}
        </div>
      )}

      {/* Post form modal */}
      <PostForm
        open={postFormOpen}
        onOpenChange={handleFormClose}
        onSubmit={editingPost ? handleUpdatePost : handleCreatePost}
        editingPost={editingPost}
        isSubmitting={createPost.isPending || updatePost.isPending}
      />
    </div>
  );
};

export default FeedBoard;
