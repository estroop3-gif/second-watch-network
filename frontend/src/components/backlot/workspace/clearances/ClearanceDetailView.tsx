/**
 * ClearanceDetailView - Wrapper for clearance detail page
 * Handles data fetching and loading states
 */
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ArrowLeft } from 'lucide-react';
import { useClearanceItem } from '@/hooks/backlot/useClearances';
import ClearanceDetailPage from './ClearanceDetailPage';

interface ClearanceDetailViewProps {
  projectId: string;
  clearanceId: string;
  canEdit: boolean;
  onBack: () => void;
}

export default function ClearanceDetailView({
  projectId,
  clearanceId,
  canEdit,
  onBack,
}: ClearanceDetailViewProps) {
  const { data: clearance, isLoading, error } = useClearanceItem(clearanceId);

  if (isLoading) {
    return (
      <div className="space-y-6">
        {/* Header skeleton */}
        <div className="flex items-center gap-4">
          <Skeleton className="h-10 w-10" />
          <div className="space-y-2">
            <Skeleton className="h-8 w-64" />
            <Skeleton className="h-4 w-48" />
          </div>
        </div>
        {/* Summary cards skeleton */}
        <div className="grid grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-24" />)}
        </div>
        {/* Content skeleton */}
        <Skeleton className="h-[500px]" />
      </div>
    );
  }

  if (error || !clearance) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <p className="text-muted-gray mb-4">
          {error instanceof Error ? error.message : 'Clearance not found'}
        </p>
        <Button variant="outline" onClick={onBack}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Clearances
        </Button>
      </div>
    );
  }

  return (
    <ClearanceDetailPage
      projectId={projectId}
      clearance={clearance}
      canEdit={canEdit}
      onBack={onBack}
    />
  );
}
