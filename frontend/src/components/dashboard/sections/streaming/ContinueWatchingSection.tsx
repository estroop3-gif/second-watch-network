/**
 * ContinueWatchingSection
 * Shows episodes the user has started watching
 */

import { useContinueWatching } from '@/hooks/watch';
import { DashboardSection } from '@/components/dashboard/DashboardSection';
import { DashboardCard } from '@/components/dashboard/DashboardCard';
import { SectionSkeleton } from '@/components/dashboard/widgets/SectionSkeleton';
import type { SectionProps } from '@/components/dashboard/config/sectionRegistry';
import type { WatchHistoryItem } from '@/types/watch';

const mapContinueWatching = (item: WatchHistoryItem) => ({
  imageUrl: item.episode?.thumbnail_url || item.world?.thumbnail_url || '/images/placeholder.jpg',
  title: item.episode?.title || 'Untitled',
  creator: item.world?.title || 'Second Watch Originals',
  linkTo: `/watch/episode/${item.episode_id}`,
});

export function ContinueWatchingSection({ className = '' }: SectionProps) {
  const { data: continueWatching, isLoading, error } = useContinueWatching(6);

  if (isLoading) {
    return <SectionSkeleton className={className} />;
  }

  if (error || !continueWatching || continueWatching.length === 0) {
    return null;
  }

  return (
    <div className={className}>
      <DashboardSection title="Continue Watching">
        {continueWatching.map(item => (
          <DashboardCard key={item.id} {...mapContinueWatching(item)} />
        ))}
      </DashboardSection>
    </div>
  );
}

export default ContinueWatchingSection;
