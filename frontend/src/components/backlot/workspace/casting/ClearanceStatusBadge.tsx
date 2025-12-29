/**
 * ClearanceStatusBadge - Shows clearance status for a person
 * Used in Booked tab cards in Casting & Crew
 */
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { CheckCircle2, Clock, AlertTriangle, Loader2 } from 'lucide-react';
import { usePersonClearancesDetailed } from '@/hooks/backlot';
import { cn } from '@/lib/utils';

interface ClearanceStatusBadgeProps {
  projectId: string;
  personId: string;
  personName?: string;
  onClick?: () => void;
  className?: string;
}

export function ClearanceStatusBadge({
  projectId,
  personId,
  personName,
  onClick,
  className,
}: ClearanceStatusBadgeProps) {
  const { data, isLoading } = usePersonClearancesDetailed(projectId, personId);

  if (isLoading) {
    return (
      <Badge variant="outline" className={cn('text-muted-foreground border-muted-gray/30', className)}>
        <Loader2 className="w-3 h-3 animate-spin" />
      </Badge>
    );
  }

  const summary = data?.summary || { total: 0, signed: 0, pending: 0, missing: 0 };
  const { total, signed, pending } = summary;

  // If no clearances at all, show nothing or a subtle indicator
  if (total === 0) {
    return null;
  }

  // Determine status
  const allSigned = signed === total && total > 0;
  const hasPending = pending > 0;

  let badgeContent: React.ReactNode;
  let badgeClass: string;
  let tooltipText: string;

  if (allSigned) {
    badgeContent = (
      <>
        <CheckCircle2 className="w-3 h-3 mr-1" />
        All Clear
      </>
    );
    badgeClass = 'bg-green-500/10 text-green-400 border-green-500/30 hover:bg-green-500/20';
    tooltipText = `${signed} clearance${signed > 1 ? 's' : ''} signed`;
  } else if (hasPending) {
    badgeContent = (
      <>
        <Clock className="w-3 h-3 mr-1" />
        {signed}/{total}
      </>
    );
    badgeClass = 'bg-yellow-500/10 text-yellow-400 border-yellow-500/30 hover:bg-yellow-500/20';
    tooltipText = `${signed} of ${total} clearances signed, ${pending} pending`;
  } else {
    badgeContent = (
      <>
        <AlertTriangle className="w-3 h-3 mr-1" />
        Missing
      </>
    );
    badgeClass = 'bg-red-500/10 text-red-400 border-red-500/30 hover:bg-red-500/20';
    tooltipText = `No clearances signed for ${personName || 'this person'}`;
  }

  const badge = (
    <Badge
      variant="outline"
      className={cn(
        'cursor-pointer transition-colors text-xs',
        badgeClass,
        className
      )}
      onClick={(e) => {
        e.stopPropagation();
        onClick?.();
      }}
    >
      {badgeContent}
    </Badge>
  );

  return (
    <Tooltip>
      <TooltipTrigger asChild>{badge}</TooltipTrigger>
      <TooltipContent side="top" className="text-xs">
        {tooltipText}
        {onClick && <span className="block text-muted-foreground">Click to view clearances</span>}
      </TooltipContent>
    </Tooltip>
  );
}

export default ClearanceStatusBadge;
