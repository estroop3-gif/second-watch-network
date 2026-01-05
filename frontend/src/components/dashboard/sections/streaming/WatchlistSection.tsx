/**
 * WatchlistSection
 * Shows the user's saved watchlist items
 */

import { useWatchlistItems } from '@/hooks/watch';
import { DashboardSection } from '@/components/dashboard/DashboardSection';
import { DashboardCard } from '@/components/dashboard/DashboardCard';
import { SectionSkeleton } from '@/components/dashboard/widgets/SectionSkeleton';
import type { SectionProps } from '@/components/dashboard/config/sectionRegistry';
import type { WorldWatchlistItem } from '@/types/watch';

const mapWatchlistItem = (item: WorldWatchlistItem) => ({
  imageUrl: item.world?.thumbnail_url || '/images/placeholder.jpg',
  title: item.world?.title || 'Untitled',
  creator: 'Second Watch Originals',
  linkTo: `/watch/worlds/${item.world?.slug}`,
});

export function WatchlistSection({ className = '' }: SectionProps) {
  const { data: watchlist, isLoading, error } = useWatchlistItems(6);

  if (isLoading) {
    return <SectionSkeleton className={className} />;
  }

  if (error || !watchlist || watchlist.length === 0) {
    return null;
  }

  return (
    <div className={className}>
      <DashboardSection title="Saved For Later">
        {watchlist.map(item => (
          <DashboardCard key={item.id} {...mapWatchlistItem(item)} />
        ))}
      </DashboardSection>
    </div>
  );
}

export default WatchlistSection;
