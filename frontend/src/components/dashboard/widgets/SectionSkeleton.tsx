/**
 * SectionSkeleton
 * Loading skeleton for dashboard sections
 */

import { Skeleton } from '@/components/ui/skeleton';

interface SectionSkeletonProps {
  /** Number of cards to show in skeleton */
  cardCount?: number;
  /** Show title skeleton */
  showTitle?: boolean;
  /** Custom className */
  className?: string;
}

export function SectionSkeleton({
  cardCount = 4,
  showTitle = true,
  className = '',
}: SectionSkeletonProps) {
  return (
    <div className={`space-y-4 ${className}`}>
      {showTitle && (
        <Skeleton className="h-6 w-48 bg-muted-gray/20" />
      )}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[...Array(cardCount)].map((_, i) => (
          <div key={i} className="space-y-2">
            <Skeleton className="aspect-video w-full rounded-lg bg-muted-gray/20" />
            <Skeleton className="h-4 w-3/4 bg-muted-gray/20" />
            <Skeleton className="h-3 w-1/2 bg-muted-gray/20" />
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * Hero skeleton for the featured section
 */
export function HeroSkeleton({ className = '' }: { className?: string }) {
  return (
    <div className={`relative aspect-[21/9] w-full rounded-xl overflow-hidden ${className}`}>
      <Skeleton className="absolute inset-0 bg-muted-gray/20" />
      <div className="absolute bottom-0 left-0 right-0 p-8 space-y-4">
        <Skeleton className="h-8 w-1/3 bg-muted-gray/30" />
        <Skeleton className="h-4 w-1/2 bg-muted-gray/30" />
        <div className="flex gap-3">
          <Skeleton className="h-10 w-24 rounded-md bg-muted-gray/30" />
          <Skeleton className="h-10 w-24 rounded-md bg-muted-gray/30" />
        </div>
      </div>
    </div>
  );
}

/**
 * Widget skeleton for compact dashboard widgets
 */
export function WidgetSkeleton({ className = '' }: { className?: string }) {
  return (
    <div className={`p-4 border border-muted-gray/20 rounded-lg space-y-3 ${className}`}>
      <Skeleton className="h-5 w-32 bg-muted-gray/20" />
      <div className="space-y-2">
        <Skeleton className="h-4 w-full bg-muted-gray/20" />
        <Skeleton className="h-4 w-3/4 bg-muted-gray/20" />
        <Skeleton className="h-4 w-1/2 bg-muted-gray/20" />
      </div>
    </div>
  );
}

export default SectionSkeleton;
