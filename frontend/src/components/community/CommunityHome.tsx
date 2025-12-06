/**
 * CommunityHome - Home tab with hero, quick filters, and activity feed
 */
import React from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { useCommunityActivity } from '@/hooks/useCommunityActivity';
import { useCollabs } from '@/hooks/useCollabs';
import { useThreads } from '@/hooks/useTopics';
import { CommunityTabType } from './CommunityTabs';
import {
  Users,
  Handshake,
  Briefcase,
  Church,
  Flag,
  Shield,
  Search,
  MessageSquare,
  FileText,
  Loader2,
  ArrowRight
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

interface CommunityHomeProps {
  onNavigate: (tab: CommunityTabType, filters?: Record<string, any>) => void;
}

const quickFilters = [
  { id: 'looking', label: 'Looking for work', icon: Search },
  { id: 'hiring', label: 'Hiring', icon: Briefcase },
  { id: 'church', label: 'Church media', icon: Church },
  { id: 'motorsports', label: 'Motorsports', icon: Flag },
  { id: 'order', label: 'Order members', icon: Shield },
];

const CommunityHome: React.FC<CommunityHomeProps> = ({ onNavigate }) => {
  const { data: activity, isLoading: activityLoading } = useCommunityActivity({ limit: 10 });
  const { collabs, isLoading: collabsLoading } = useCollabs({ limit: 3 });
  const { threads, isLoading: threadsLoading } = useThreads({ limit: 3 });

  return (
    <div className="space-y-10">
      {/* Hero Section */}
      <div className="text-center py-8">
        <h1 className="text-4xl md:text-6xl font-heading tracking-tighter mb-4 -rotate-1">
          The <span className="font-spray text-accent-yellow">Community</span>
        </h1>
        <p className="text-muted-gray max-w-2xl mx-auto mb-8">
          A living hub for filmmakers, editors, churches, and brands to collaborate,
          share knowledge, and build together.
        </p>
        <div className="flex flex-wrap gap-4 justify-center">
          <Button
            onClick={() => onNavigate('collabs')}
            className="bg-accent-yellow text-charcoal-black hover:bg-bone-white"
          >
            <Handshake className="w-4 h-4 mr-2" />
            Find Collaborators
          </Button>
          <Button
            onClick={() => onNavigate('people')}
            variant="outline"
            className="border-bone-white text-bone-white hover:bg-bone-white hover:text-charcoal-black"
          >
            <Users className="w-4 h-4 mr-2" />
            Browse Filmmakers
          </Button>
        </div>
      </div>

      {/* Quick Filters */}
      <div className="flex flex-wrap gap-2 justify-center">
        {quickFilters.map((filter) => (
          <button
            key={filter.id}
            onClick={() => onNavigate('people', { filter: filter.id })}
            className="flex items-center gap-2 px-4 py-2 rounded-full bg-charcoal-black/50 border border-muted-gray/30 text-sm text-muted-gray hover:text-bone-white hover:border-accent-yellow transition-colors"
          >
            <filter.icon className="w-4 h-4" />
            {filter.label}
          </button>
        ))}
      </div>

      {/* Two Column Layout for Recent Items */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Collabs */}
        <div className="bg-charcoal-black/50 border border-muted-gray/20 rounded-lg overflow-hidden">
          <div className="flex items-center justify-between p-4 border-b border-muted-gray/20">
            <h2 className="font-heading text-bone-white flex items-center gap-2">
              <Handshake className="w-5 h-5 text-accent-yellow" />
              Recent Collabs
            </h2>
            <button
              onClick={() => onNavigate('collabs')}
              className="text-sm text-muted-gray hover:text-accent-yellow flex items-center gap-1"
            >
              View All <ArrowRight className="w-3 h-3" />
            </button>
          </div>

          {collabsLoading ? (
            <div className="p-8 flex justify-center">
              <Loader2 className="w-6 h-6 animate-spin text-accent-yellow" />
            </div>
          ) : collabs.length > 0 ? (
            <div className="divide-y divide-muted-gray/10">
              {collabs.map((collab) => {
                const authorName = collab.profile?.display_name || collab.profile?.full_name || 'Member';
                return (
                  <div key={collab.id} className="p-4 hover:bg-muted-gray/5 transition-colors">
                    <div className="flex items-start gap-3">
                      <Avatar className="w-8 h-8 flex-shrink-0">
                        <AvatarImage src={collab.profile?.avatar_url || ''} alt={authorName} />
                        <AvatarFallback className="text-xs">{authorName.slice(0, 1)}</AvatarFallback>
                      </Avatar>
                      <div className="min-w-0 flex-1">
                        <h4 className="font-medium text-bone-white text-sm line-clamp-1">{collab.title}</h4>
                        <p className="text-xs text-muted-gray line-clamp-1">{collab.description}</p>
                        <div className="flex items-center gap-2 mt-1 text-xs text-muted-gray">
                          <span>{authorName}</span>
                          <span>•</span>
                          <span>{formatDistanceToNow(new Date(collab.created_at), { addSuffix: true })}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="p-8 text-center text-muted-gray text-sm">
              No collabs yet. Be the first to post!
            </div>
          )}
        </div>

        {/* Recent Threads */}
        <div className="bg-charcoal-black/50 border border-muted-gray/20 rounded-lg overflow-hidden">
          <div className="flex items-center justify-between p-4 border-b border-muted-gray/20">
            <h2 className="font-heading text-bone-white flex items-center gap-2">
              <MessageSquare className="w-5 h-5 text-accent-yellow" />
              Recent Discussions
            </h2>
            <button
              onClick={() => onNavigate('topics')}
              className="text-sm text-muted-gray hover:text-accent-yellow flex items-center gap-1"
            >
              View All <ArrowRight className="w-3 h-3" />
            </button>
          </div>

          {threadsLoading ? (
            <div className="p-8 flex justify-center">
              <Loader2 className="w-6 h-6 animate-spin text-accent-yellow" />
            </div>
          ) : threads.length > 0 ? (
            <div className="divide-y divide-muted-gray/10">
              {threads.map((thread) => {
                const authorName = thread.author?.display_name || thread.author?.full_name || 'Member';
                return (
                  <div key={thread.id} className="p-4 hover:bg-muted-gray/5 transition-colors">
                    <div className="flex items-start gap-3">
                      <Avatar className="w-8 h-8 flex-shrink-0">
                        <AvatarImage src={thread.author?.avatar_url || ''} alt={authorName} />
                        <AvatarFallback className="text-xs">{authorName.slice(0, 1)}</AvatarFallback>
                      </Avatar>
                      <div className="min-w-0 flex-1">
                        <h4 className="font-medium text-bone-white text-sm line-clamp-1">{thread.title}</h4>
                        <p className="text-xs text-muted-gray line-clamp-1">{thread.content}</p>
                        <div className="flex items-center gap-2 mt-1 text-xs text-muted-gray">
                          <span>{authorName}</span>
                          {thread.topic && (
                            <>
                              <span>•</span>
                              <Badge variant="outline" className="text-xs border-muted-gray/30 px-1 py-0">
                                {thread.topic.name}
                              </Badge>
                            </>
                          )}
                          <span>•</span>
                          <span>{formatDistanceToNow(new Date(thread.created_at), { addSuffix: true })}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="p-8 text-center text-muted-gray text-sm">
              No discussions yet. Start a conversation!
            </div>
          )}
        </div>
      </div>

      {/* Activity Feed */}
      <div className="space-y-4">
        <h2 className="text-xl font-heading text-bone-white">Recent Activity</h2>

        {activityLoading ? (
          <div className="bg-charcoal-black/50 border border-muted-gray/20 rounded-lg p-8 flex justify-center">
            <Loader2 className="w-8 h-8 animate-spin text-accent-yellow" />
          </div>
        ) : activity && activity.length > 0 ? (
          <div className="bg-charcoal-black/50 border border-muted-gray/20 rounded-lg divide-y divide-muted-gray/10">
            {activity.map((item) => {
              const authorName = item.profile?.display_name || item.profile?.full_name || 'Member';
              const authorInitials = authorName.slice(0, 1).toUpperCase();
              const authorUsername = item.profile?.username || 'member';

              return (
                <div key={`${item.type}-${item.id}`} className="p-4 flex items-start gap-3">
                  <Link to={`/profile/${authorUsername}`} className="flex-shrink-0">
                    <Avatar className="w-10 h-10">
                      <AvatarImage src={item.profile?.avatar_url || ''} alt={authorName} />
                      <AvatarFallback>{authorInitials}</AvatarFallback>
                    </Avatar>
                  </Link>

                  <div className="flex-1 min-w-0">
                    <div className="text-sm">
                      <Link
                        to={`/profile/${authorUsername}`}
                        className="font-medium text-bone-white hover:text-accent-yellow"
                      >
                        {authorName}
                      </Link>
                      <span className="text-muted-gray">
                        {' '}
                        {item.type === 'collab' ? 'posted a collab' : 'started a thread'}
                      </span>
                    </div>

                    <div className="mt-1">
                      <span className="text-sm text-bone-white/80 line-clamp-1">
                        {item.title}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 mt-1 text-xs text-muted-gray">
                      {item.type === 'collab' ? (
                        <Badge variant="outline" className="text-xs border-blue-500/30 text-blue-400">
                          <Handshake className="w-3 h-3 mr-1" />
                          Collab
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-xs border-purple-500/30 text-purple-400">
                          <MessageSquare className="w-3 h-3 mr-1" />
                          Thread
                        </Badge>
                      )}
                      {item.metadata?.topic_name && (
                        <Badge variant="outline" className="text-xs border-muted-gray/30">
                          {item.metadata.topic_name}
                        </Badge>
                      )}
                      <span>{formatDistanceToNow(new Date(item.created_at), { addSuffix: true })}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="bg-charcoal-black/50 border border-muted-gray/20 rounded-lg p-8 text-center">
            <p className="text-muted-gray">
              No activity yet. Check out the{' '}
              <button
                onClick={() => onNavigate('collabs')}
                className="text-accent-yellow hover:underline"
              >
                Collabs
              </button>
              {' '}and{' '}
              <button
                onClick={() => onNavigate('topics')}
                className="text-accent-yellow hover:underline"
              >
                Topics
              </button>
              {' '}tabs to get started.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default CommunityHome;
