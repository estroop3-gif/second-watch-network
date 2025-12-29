/**
 * TopicsBoard - Lightweight forum topics with thread browsing
 */
import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { useTopics, useThreads } from '@/hooks/useTopics';
import ThreadCard from './ThreadCard';
import { CommunityTopic, CommunityThread } from '@/types/community';
import {
  Plus,
  MessageSquare,
  Camera,
  Sliders,
  Church,
  Flag,
  Package,
  Briefcase,
  Loader2,
  Hash
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface TopicsBoardProps {
  onCreateThread?: (topicId?: string) => void;
  onViewThread?: (thread: CommunityThread) => void;
}

// Icon mapping for topics
const iconMap: Record<string, React.ElementType> = {
  'message-square': MessageSquare,
  'camera': Camera,
  'sliders': Sliders,
  'church': Church,
  'flag': Flag,
  'package': Package,
  'briefcase': Briefcase,
  'hash': Hash,
};

const TopicsBoard: React.FC<TopicsBoardProps> = ({ onCreateThread, onViewThread }) => {
  const [searchParams, setSearchParams] = useSearchParams();
  const { data: topics, isLoading: topicsLoading } = useTopics();
  const [activeTopic, setActiveTopic] = useState<CommunityTopic | null>(null);

  // Set topic from URL param or default to first topic
  useEffect(() => {
    if (topics && topics.length > 0) {
      const topicSlug = searchParams.get('topic');
      if (topicSlug) {
        const urlTopic = topics.find(t => t.slug === topicSlug);
        if (urlTopic) {
          setActiveTopic(urlTopic);
          return;
        }
      }
      // Default to first topic if no URL param or topic not found
      if (!activeTopic) {
        setActiveTopic(topics[0]);
      }
    }
  }, [topics, searchParams]);

  const { threads, isLoading: threadsLoading, error } = useThreads({
    topicId: activeTopic?.id,
    limit: 50,
  });

  const handleTopicClick = (topic: CommunityTopic) => {
    setActiveTopic(topic);
    // Update URL with topic slug
    const newParams = new URLSearchParams(searchParams);
    newParams.set('topic', topic.slug);
    setSearchParams(newParams, { replace: true });
  };

  const handleCreateThread = () => {
    onCreateThread?.(activeTopic?.id);
  };

  const handleViewThread = (thread: CommunityThread) => {
    onViewThread?.(thread);
  };

  const getTopicIcon = (iconName: string | null): React.ElementType => {
    if (!iconName) return Hash;
    return iconMap[iconName] || Hash;
  };

  if (topicsLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-accent-yellow" />
      </div>
    );
  }

  return (
    <div className="flex flex-col lg:flex-row gap-6">
      {/* Topics Sidebar */}
      <div className="lg:w-64 flex-shrink-0">
        <div className="bg-charcoal-black/50 border border-muted-gray/20 rounded-lg overflow-hidden sticky top-4">
          <div className="p-4 border-b border-muted-gray/20">
            <h3 className="font-medium text-bone-white">Topics</h3>
          </div>
          <nav className="p-2">
            {topics?.map((topic) => {
              const TopicIcon = getTopicIcon(topic.icon);
              return (
                <button
                  key={topic.id}
                  onClick={() => handleTopicClick(topic)}
                  className={cn(
                    'w-full flex items-center gap-3 px-3 py-2 rounded-md text-left transition-colors',
                    activeTopic?.id === topic.id
                      ? 'bg-accent-yellow/10 text-accent-yellow'
                      : 'text-muted-gray hover:text-bone-white hover:bg-muted-gray/10'
                  )}
                >
                  <TopicIcon className="w-4 h-4 flex-shrink-0" />
                  <span className="text-sm truncate">{topic.name}</span>
                </button>
              );
            })}
          </nav>
        </div>
      </div>

      {/* Thread List Area */}
      <div className="flex-1 space-y-4">
        {/* Topic Header */}
        {activeTopic && (
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-2xl font-heading text-bone-white flex items-center gap-2">
                {React.createElement(getTopicIcon(activeTopic.icon), { className: 'w-6 h-6' })}
                {activeTopic.name}
              </h2>
              {activeTopic.description && (
                <p className="text-muted-gray text-sm">{activeTopic.description}</p>
              )}
            </div>
            <Button
              onClick={handleCreateThread}
              className="bg-accent-yellow text-charcoal-black hover:bg-bone-white"
            >
              <Plus className="w-4 h-4 mr-2" />
              Start a Thread
            </Button>
          </div>
        )}

        {/* Loading State */}
        {threadsLoading && (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-accent-yellow" />
          </div>
        )}

        {/* Error State */}
        {error && (
          <div className="bg-red-900/20 border border-red-600/30 rounded-lg p-4 text-center">
            <p className="text-red-400">Failed to load threads: {error.message}</p>
          </div>
        )}

        {/* Thread List */}
        {!threadsLoading && !error && threads.length > 0 && (
          <div className="space-y-3">
            {threads.map((thread) => (
              <ThreadCard
                key={thread.id}
                thread={thread}
                onClick={handleViewThread}
              />
            ))}
          </div>
        )}

        {/* Empty State */}
        {!threadsLoading && !error && threads.length === 0 && activeTopic && (
          <div className="bg-charcoal-black/50 border border-muted-gray/20 rounded-lg p-12 text-center">
            <MessageSquare className="w-12 h-12 text-muted-gray mx-auto mb-4" />
            <h3 className="text-lg font-medium text-bone-white mb-2">No threads yet</h3>
            <p className="text-muted-gray mb-6">
              Start the conversation in {activeTopic.name}!
            </p>
            <Button
              onClick={handleCreateThread}
              className="bg-accent-yellow text-charcoal-black hover:bg-bone-white"
            >
              <Plus className="w-4 h-4 mr-2" />
              Create First Thread
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};

export default TopicsBoard;
