/**
 * ZinePicksSection
 * Staff curated selections
 */

import { useWorlds } from '@/hooks/watch';
import { DashboardSection } from '@/components/dashboard/DashboardSection';
import { DashboardCard } from '@/components/dashboard/DashboardCard';
import { SectionSkeleton } from '@/components/dashboard/widgets/SectionSkeleton';
import type { SectionProps } from '@/components/dashboard/config/sectionRegistry';
import type { WorldSummary } from '@/types/watch';

const mapWorld = (world: WorldSummary) => ({
  imageUrl: world.thumbnail_url || '/images/placeholder.jpg',
  title: world.title,
  creator: 'Second Watch Originals',
  linkTo: `/watch/worlds/${world.slug}`,
  stamp: 'zine-pick' as const,
});

export function ZinePicksSection({ className = '' }: SectionProps) {
  const { data: worldsData, isLoading, error } = useWorlds({ limit: 12 });

  // Get regular active worlds (not featured, not coming soon)
  const regularWorlds = worldsData?.worlds?.filter(
    w => w.status === 'active' && !w.is_featured
  ) || [];
  const zinePickWorlds = regularWorlds.slice(0, 4);

  if (isLoading) {
    return <SectionSkeleton className={className} />;
  }

  if (error || zinePickWorlds.length === 0) {
    return null;
  }

  return (
    <div className={className}>
      <DashboardSection title="Zine Picks">
        {zinePickWorlds.map(world => (
          <DashboardCard key={world.id} {...mapWorld(world)} />
        ))}
      </DashboardSection>
    </div>
  );
}

export default ZinePicksSection;
