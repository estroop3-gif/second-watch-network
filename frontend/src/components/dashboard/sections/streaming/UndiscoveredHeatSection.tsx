/**
 * UndiscoveredHeatSection
 * Hidden gems waiting to be discovered
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
  tagline: "Nobody's watching - and that's a mistake.",
});

export function UndiscoveredHeatSection({ className = '' }: SectionProps) {
  const { data: worldsData, isLoading, error } = useWorlds({ limit: 12 });

  // Get regular active worlds (not featured, not coming soon)
  const regularWorlds = worldsData?.worlds?.filter(
    w => w.status === 'active' && !w.is_featured
  ) || [];
  // Skip the first 4 (used by Zine Picks) and take the next 4
  const undiscoveredWorlds = regularWorlds.slice(4, 8);

  if (isLoading) {
    return <SectionSkeleton className={className} />;
  }

  if (error || undiscoveredWorlds.length === 0) {
    return null;
  }

  return (
    <div className={className}>
      <DashboardSection title="Undiscovered Heat">
        {undiscoveredWorlds.map(world => (
          <DashboardCard key={world.id} {...mapWorld(world)} />
        ))}
      </DashboardSection>
    </div>
  );
}

export default UndiscoveredHeatSection;
