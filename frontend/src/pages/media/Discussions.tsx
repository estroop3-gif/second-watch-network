import { useState } from 'react';
import { Plus, Search, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { usePermissions } from '@/hooks/usePermissions';
import {
  useMediaDiscussionCategories,
  useMediaDiscussionThreads,
  useCreateMediaDiscussionThread,
} from '@/hooks/media';
import DiscussionCategoryTabs from '@/components/media/DiscussionCategoryTabs';
import ThreadCard from '@/components/media/ThreadCard';

const SORT_OPTIONS = [
  { value: 'recent', label: 'Most Recent' },
  { value: 'popular', label: 'Most Popular' },
  { value: 'oldest', label: 'Oldest' },
];

const Discussions = () => {
  const { toast } = useToast();
  const { hasAnyRole } = usePermissions();
  const isTeam = hasAnyRole(['media_team', 'admin', 'superadmin']);

  const [categorySlug, setCategorySlug] = useState('');
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState('recent');
  const [showNewThread, setShowNewThread] = useState(false);
  const [newThread, setNewThread] = useState({ category_id: '', title: '', content: '' });

  const { data: catData } = useMediaDiscussionCategories();
  const categories = catData?.categories || [];

  const { data: threadData, isLoading } = useMediaDiscussionThreads({
    category_slug: categorySlug || undefined,
    search: search || undefined,
    sort,
  });
  const threads = threadData?.threads || [];

  const createThread = useCreateMediaDiscussionThread();

  const handleCreateThread = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newThread.title || !newThread.content || !newThread.category_id) return;
    try {
      await createThread.mutateAsync(newThread);
      toast({ title: 'Thread created' });
      setShowNewThread(false);
      setNewThread({ category_id: '', title: '', content: '' });
    } catch {
      toast({ title: 'Failed to create thread', variant: 'destructive' });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-heading text-accent-yellow">Discussions</h1>
        <Button
          onClick={() => setShowNewThread(true)}
          className="bg-accent-yellow text-charcoal-black hover:bg-accent-yellow/80"
        >
          <Plus className="h-4 w-4 mr-2" /> New Thread
        </Button>
      </div>

      <DiscussionCategoryTabs
        categories={categories}
        activeSlug={categorySlug}
        onSelect={setCategorySlug}
      />

      <div className="flex gap-3 items-center">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-gray" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search threads..."
            className="w-full pl-9 pr-3 py-2 rounded bg-charcoal-black border border-muted-gray/50 text-bone-white text-sm"
          />
        </div>
        <select
          value={sort}
          onChange={e => setSort(e.target.value)}
          className="px-3 py-2 rounded bg-charcoal-black border border-muted-gray/50 text-bone-white text-sm"
        >
          {SORT_OPTIONS.map(s => (
            <option key={s.value} value={s.value}>{s.label}</option>
          ))}
        </select>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-accent-yellow" />
        </div>
      ) : threads.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-muted-gray">No threads found</p>
          <button
            onClick={() => setShowNewThread(true)}
            className="text-accent-yellow text-sm hover:underline mt-2 inline-block"
          >
            Start the first discussion
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {threads.map((thread: any) => (
            <ThreadCard key={thread.id} thread={thread} />
          ))}
        </div>
      )}

      {/* New Thread Dialog */}
      <Dialog open={showNewThread} onOpenChange={setShowNewThread}>
        <DialogContent className="bg-charcoal-black border-muted-gray/50 text-bone-white max-w-lg">
          <DialogHeader>
            <DialogTitle>New Discussion Thread</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreateThread} className="space-y-4">
            <div>
              <label className="text-sm text-muted-gray">Category *</label>
              <select
                value={newThread.category_id}
                onChange={e => setNewThread(f => ({ ...f, category_id: e.target.value }))}
                className="w-full mt-1 px-3 py-2 rounded bg-charcoal-black border border-muted-gray/50 text-bone-white text-sm"
                required
              >
                <option value="">Select a category...</option>
                {categories.map((cat: any) => (
                  <option key={cat.id} value={cat.id}>{cat.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-sm text-muted-gray">Title *</label>
              <input
                type="text"
                value={newThread.title}
                onChange={e => setNewThread(f => ({ ...f, title: e.target.value }))}
                className="w-full mt-1 px-3 py-2 rounded bg-charcoal-black border border-muted-gray/50 text-bone-white text-sm"
                required
              />
            </div>
            <div>
              <label className="text-sm text-muted-gray">Content *</label>
              <textarea
                value={newThread.content}
                onChange={e => setNewThread(f => ({ ...f, content: e.target.value }))}
                className="w-full mt-1 px-3 py-2 rounded bg-charcoal-black border border-muted-gray/50 text-bone-white text-sm"
                rows={5}
                required
              />
            </div>
            <Button
              type="submit"
              className="w-full bg-accent-yellow text-charcoal-black hover:bg-accent-yellow/80"
              disabled={createThread.isPending}
            >
              {createThread.isPending ? 'Creating...' : 'Create Thread'}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Discussions;
