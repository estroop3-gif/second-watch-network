/**
 * ForYouSection
 * Personalized content recommendations for authenticated users
 * Shows free content (livestreams, FAST channels) for guests
 */

import { Link } from 'react-router-dom';
import { useForYouContent } from '@/hooks/watch';
import { DashboardSection } from '@/components/dashboard/DashboardSection';
import { DashboardCard } from '@/components/dashboard/DashboardCard';
import { SectionSkeleton } from '@/components/dashboard/widgets/SectionSkeleton';
import { Button } from '@/components/ui/button';
import { RefreshCw, Play, Radio } from 'lucide-react';
import type { SectionProps } from '@/components/dashboard/config/sectionRegistry';
import type { RecommendedItem, FreeContentItem } from '@/lib/api/watch';

// Map recommended item to card props
const mapRecommendedItem = (item: RecommendedItem) => {
  const isEpisode = item.type === 'episode';

  return {
    imageUrl: item.thumbnail_url || item.cover_art_url || '/images/placeholder.jpg',
    title: isEpisode
      ? `${item.world_title} - ${item.title}`
      : item.title,
    creator: item.reason || 'Recommended',
    linkTo: isEpisode
      ? `/watch/episode/${item.id}`
      : `/watch/worlds/${item.slug}`,
    badge: isEpisode ? `S${item.season_number} E${item.episode_number}` : undefined,
  };
};

// Map free content item to card props
const mapFreeContentItem = (item: FreeContentItem) => {
  const isLive = item.type === 'live_event' && item.status === 'live';

  return {
    imageUrl: item.thumbnail_url || '/images/placeholder.jpg',
    title: item.title,
    creator: item.type === 'live_event'
      ? (isLive ? 'Live Now' : 'Upcoming')
      : 'Free to Watch',
    linkTo: item.type === 'live_event'
      ? `/watch/events/${item.id}`
      : `/watch/worlds/${item.id}`,
    badge: isLive ? (
      <span className="flex items-center gap-1 text-xs text-red-500">
        <Radio className="h-3 w-3 animate-pulse" />
        LIVE
      </span>
    ) : undefined,
  };
};

export function ForYouSection({ className = '' }: SectionProps) {
  const { data, isLoading, error, isAuthenticated, contentType } = useForYouContent(12);

  if (isLoading) {
    return <SectionSkeleton className={className} />;
  }

  if (error || !data || (Array.isArray(data) && data.length === 0)) {
    return null;
  }

  const items = Array.isArray(data) ? data : [];

  // Determine section title based on content type
  const sectionTitle = isAuthenticated ? 'For You' : 'Watch Free';
  const sectionIcon = isAuthenticated ? undefined : <Play className="h-5 w-5" />;

  return (
    <div className={className}>
      <DashboardSection
        title={sectionTitle}
        icon={sectionIcon}
        action={
          !isAuthenticated && (
            <Button variant="ghost" size="sm" asChild>
              <Link to="/signup" className="text-accent-yellow">
                Sign up for personalized picks
              </Link>
            </Button>
          )
        }
      >
        {contentType === 'for-you'
          ? (items as RecommendedItem[]).map(item => (
              <DashboardCard key={item.id} {...mapRecommendedItem(item)} />
            ))
          : (items as FreeContentItem[]).map(item => (
              <DashboardCard key={item.id} {...mapFreeContentItem(item)} />
            ))
        }
      </DashboardSection>
    </div>
  );
}

export default ForYouSection;
