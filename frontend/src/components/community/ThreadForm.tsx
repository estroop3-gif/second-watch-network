/**
 * ThreadForm - Form for creating/editing threads
 */
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useTopics, useThreads } from '@/hooks/useTopics';
import { CommunityThread, CommunityTopic } from '@/types/community';
import { X, Loader2, Hash, MessageSquare } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface ThreadFormProps {
  onClose: () => void;
  onSuccess?: (thread: CommunityThread) => void;
  editThread?: CommunityThread;
  initialTopicId?: string;
}

const ThreadForm: React.FC<ThreadFormProps> = ({ onClose, onSuccess, editThread, initialTopicId }) => {
  const { data: topics } = useTopics();
  const { createThread, updateThread } = useThreads();
  const isEditing = !!editThread;

  const [formData, setFormData] = useState({
    topic_id: editThread?.topic_id || initialTopicId || '',
    title: editThread?.title || '',
    content: editThread?.content || '',
  });

  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.topic_id) {
      toast.error('Please select a topic');
      return;
    }

    if (!formData.title.trim()) {
      toast.error('Please enter a title');
      return;
    }

    if (!formData.content.trim()) {
      toast.error('Please enter some content');
      return;
    }

    setIsSubmitting(true);

    try {
      const payload = {
        topic_id: formData.topic_id,
        title: formData.title.trim(),
        content: formData.content.trim(),
      };

      if (isEditing && editThread) {
        await updateThread.mutateAsync({ id: editThread.id, ...payload });
        toast.success('Thread updated!');
      } else {
        const result = await createThread.mutateAsync(payload);
        toast.success('Thread created!');
        onSuccess?.(result as CommunityThread);
      }

      onClose();
    } catch (error: any) {
      toast.error(error.message || 'Failed to save thread');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70">
      <div className="bg-charcoal-black border border-muted-gray/30 rounded-lg w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-muted-gray/20">
          <h2 className="text-xl font-heading text-bone-white">
            {isEditing ? 'Edit Thread' : 'Start a New Thread'}
          </h2>
          <button
            onClick={onClose}
            className="text-muted-gray hover:text-bone-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-6">
          {/* Topic Selection */}
          <div className="space-y-2">
            <Label className="text-bone-white">Topic</Label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {topics?.map((topic) => (
                <button
                  key={topic.id}
                  type="button"
                  onClick={() => setFormData({ ...formData, topic_id: topic.id })}
                  className={cn(
                    'flex items-center gap-2 px-3 py-2 rounded-md border text-left text-sm transition-colors',
                    formData.topic_id === topic.id
                      ? 'border-accent-yellow bg-accent-yellow/10 text-accent-yellow'
                      : 'border-muted-gray/30 text-muted-gray hover:text-bone-white hover:border-muted-gray/50'
                  )}
                >
                  <Hash className="w-4 h-4 flex-shrink-0" />
                  <span className="truncate">{topic.name}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Title */}
          <div className="space-y-2">
            <Label htmlFor="title" className="text-bone-white">Title</Label>
            <Input
              id="title"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              placeholder="What's on your mind?"
              className="bg-charcoal-black/50 border-muted-gray/30"
            />
          </div>

          {/* Content */}
          <div className="space-y-2">
            <Label htmlFor="content" className="text-bone-white">Content</Label>
            <Textarea
              id="content"
              value={formData.content}
              onChange={(e) => setFormData({ ...formData, content: e.target.value })}
              placeholder="Share your thoughts, ask a question, or start a discussion..."
              className="bg-charcoal-black/50 border-muted-gray/30 min-h-[200px]"
            />
            <p className="text-xs text-muted-gray">
              Markdown formatting is supported
            </p>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-4 border-t border-muted-gray/20">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              className="border-muted-gray/30"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting}
              className="bg-accent-yellow text-charcoal-black hover:bg-bone-white"
            >
              {isSubmitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {isEditing ? 'Save Changes' : 'Post Thread'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ThreadForm;
