/**
 * FeaturedWorldsSection
 * Shows featured creator worlds
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
});

export function FeaturedWorldsSection({ className = '' }: SectionProps) {
  const { data: worldsData, isLoading, error } = useWorlds({ limit: 12, featured: true });

  const featuredWorlds = worldsData?.worlds?.filter(w => w.is_featured).slice(0, 4) || [];

  if (isLoading) {
    return <SectionSkeleton className={className} />;
  }

  if (error || featuredWorlds.length === 0) {
    return null;
  }

  return (
    <div className={className}>
      <DashboardSection title="Featured Artists">
        {featuredWorlds.map(world => (
          <DashboardCard key={world.id} {...mapWorld(world)} />
        ))}
      </DashboardSection>
    </div>
  );
}

export default FeaturedWorldsSection;
