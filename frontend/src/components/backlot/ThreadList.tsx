import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { ThreadCard, Thread as ThreadType } from './ThreadCard';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useState } from 'react';
import { useAuth } from '@/context/AuthContext';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000';

interface ThreadListProps {
  categorySlug?: string;
}

const fetchThreads = async (categorySlug?: string, searchTerm?: string, sortBy?: string) => {
  const token = api.getToken();
  if (!token) throw new Error('Not authenticated');

  const params = new URLSearchParams();
  params.append('limit', '50');
  if (categorySlug) params.append('category_slug', categorySlug);
  if (searchTerm) params.append('search', searchTerm);
  if (sortBy) params.append('sort_by', sortBy);

  const response = await fetch(
    `${API_BASE}/api/v1/forum/threads-with-details?${params.toString()}`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }
  );

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: 'Failed to fetch threads' }));
    throw new Error(error.detail);
  }

  return response.json() as Promise<ThreadType[]>;
};

const ThreadListPlaceholder = () => (
  <div className="space-y-4">
    {[...Array(5)].map((_, i) => (
      <div key={i} className="p-4 border border-muted-gray/20 rounded-lg flex gap-4 items-center">
        <Skeleton className="h-12 w-12 rounded-full" />
        <div className="flex-grow space-y-2">
          <Skeleton className="h-6 w-3/4" />
          <Skeleton className="h-4 w-1/2" />
        </div>
      </div>
    ))}
  </div>
);

export const ThreadList = ({ categorySlug }: ThreadListProps) => {
  const { loading: authLoading } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState('active'); // 'active' or 'latest'

  const { data: threads, isLoading, error } = useQuery({
    queryKey: ['threads', categorySlug, searchTerm, sortBy],
    queryFn: () => fetchThreads(categorySlug, searchTerm, sortBy),
    enabled: !authLoading, // Only fetch data when auth state is resolved
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  const showLoadingState = authLoading || isLoading;

  return (
    <div>
      <div className="flex flex-col sm:flex-row gap-4 mb-6 p-4 bg-charcoal-black/30 rounded-lg border border-muted-gray/20">
        <Input
          placeholder="Search threads by title..."
          className="flex-grow bg-charcoal-black border-muted-gray focus:ring-accent-yellow"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
        <Select value={sortBy} onValueChange={setSortBy}>
          <SelectTrigger className="w-full sm:w-[180px] bg-charcoal-black border-muted-gray focus:ring-accent-yellow">
            <SelectValue placeholder="Sort by" />
          </SelectTrigger>
          <SelectContent className="bg-charcoal-black border-muted-gray text-bone-white">
            <SelectItem value="active">Most Active</SelectItem>
            <SelectItem value="latest">Latest</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {showLoadingState && <ThreadListPlaceholder />}
      {error && !showLoadingState && <p className="text-red-500 text-center py-8">Failed to load threads. Please try again later.</p>}

      {!showLoadingState && !error && threads?.length === 0 && (
        <div className="text-center py-12 border border-dashed border-muted-gray/30 rounded-lg">
          <h3 className="text-xl font-bold">No Threads Yet</h3>
          <p className="text-muted-gray mt-2">Be the first to start a conversation!</p>
        </div>
      )}

      {!showLoadingState && !error && threads && threads.length > 0 && (
        <div className="space-y-4">
          {threads.map(thread => (
            <ThreadCard key={thread.id} thread={thread} />
          ))}
        </div>
      )}
    </div>
  );
};
