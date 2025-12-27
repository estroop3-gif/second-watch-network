import React from 'react';
import { Skeleton } from '@/components/ui/skeleton';

type Props = {
  count?: number;
};

const CommunitySkeleton: React.FC<Props> = ({ count = 9 }) => {
  const items = Array.from({ length: count });
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-8">
      {items.map((_, idx) => (
        <div key={idx} className="bg-charcoal-black/50 border border-muted-gray/20 rounded-lg p-6 text-center flex flex-col items-center">
          <div className="mb-4">
            <Skeleton className="h-24 w-24 rounded-full border-4 border-muted-gray" />
          </div>
          <Skeleton className="h-5 w-40 mb-2" />
          <Skeleton className="h-4 w-28 mb-4" />
          <div className="mt-auto flex flex-col gap-2 w-full pt-4">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        </div>
      ))}
    </div>
  );
};

export default CommunitySkeleton;