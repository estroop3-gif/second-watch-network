/**
 * ExpiringClearancesAlert - Alert widget showing clearances expiring soon
 */
import { useExpiringClearances } from '@/hooks/backlot/useClearances';
import { CLEARANCE_TYPE_LABELS } from '@/types/backlot';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { format } from 'date-fns';
import {
  AlertTriangle,
  Clock,
  ChevronDown,
  ChevronUp,
  Shield,
  ExternalLink,
} from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';

interface ExpiringClearancesAlertProps {
  projectId: string;
  days?: number;
  onClearanceClick?: (clearanceId: string) => void;
}

export function ExpiringClearancesAlert({
  projectId,
  days = 90,
  onClearanceClick,
}: ExpiringClearancesAlertProps) {
  const [isOpen, setIsOpen] = useState(true);
  const { data: expiring, isLoading } = useExpiringClearances(projectId, days);

  if (isLoading) {
    return (
      <div className="p-4 border border-muted-gray/30 rounded-lg">
        <Skeleton className="h-6 w-full" />
      </div>
    );
  }

  if (!expiring || expiring.length === 0) {
    return null;
  }

  // Group by urgency
  const critical = expiring.filter((c) => c.days_until_expiry <= 7);
  const warning = expiring.filter((c) => c.days_until_expiry > 7 && c.days_until_expiry <= 30);
  const upcoming = expiring.filter((c) => c.days_until_expiry > 30);

  const getBadgeClass = (days: number) => {
    if (days <= 7) return 'bg-red-500 text-white';
    if (days <= 30) return 'bg-orange-500 text-white';
    return 'bg-yellow-500 text-black';
  };

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <div className="border border-orange-500/50 bg-orange-500/5 rounded-lg overflow-hidden">
        <CollapsibleTrigger asChild>
          <Button
            variant="ghost"
            className="w-full flex items-center justify-between p-4 h-auto hover:bg-orange-500/10"
          >
            <div className="flex items-center gap-3">
              <AlertTriangle className="h-5 w-5 text-orange-500" />
              <div className="text-left">
                <p className="font-medium">Expiring Clearances</p>
                <p className="text-xs text-muted-foreground">
                  {expiring.length} clearance{expiring.length !== 1 ? 's' : ''} expiring in the next {days} days
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {critical.length > 0 && (
                <Badge className="bg-red-500">{critical.length} critical</Badge>
              )}
              {warning.length > 0 && (
                <Badge className="bg-orange-500">{warning.length} warning</Badge>
              )}
              {isOpen ? (
                <ChevronUp className="h-4 w-4" />
              ) : (
                <ChevronDown className="h-4 w-4" />
              )}
            </div>
          </Button>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <ScrollArea className="max-h-[300px]">
            <div className="px-4 pb-4 space-y-2">
              {expiring.map((clearance) => (
                <div
                  key={clearance.id}
                  className="flex items-center gap-3 p-3 bg-background rounded-lg border border-muted-gray/30"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm truncate">{clearance.title}</span>
                      {clearance.is_eo_critical && (
                        <Shield className="h-4 w-4 text-red-500" title="E&O Critical" />
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
                      <span>{CLEARANCE_TYPE_LABELS[clearance.type] || clearance.type}</span>
                      {clearance.related_name && (
                        <>
                          <span>•</span>
                          <span>{clearance.related_name}</span>
                        </>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 flex-shrink-0">
                    <Badge className={getBadgeClass(clearance.days_until_expiry)}>
                      <Clock className="h-3 w-3 mr-1" />
                      {clearance.days_until_expiry === 0
                        ? 'Today'
                        : clearance.days_until_expiry === 1
                        ? '1 day'
                        : `${clearance.days_until_expiry} days`}
                    </Badge>

                    {onClearanceClick ? (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => onClearanceClick(clearance.id)}
                      >
                        <ExternalLink className="h-4 w-4" />
                      </Button>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}

/**
 * Compact version for dashboard widgets
 */
export function ExpiringClearancesCompact({
  projectId,
  days = 30,
}: {
  projectId: string;
  days?: number;
}) {
  const { data: expiring, isLoading } = useExpiringClearances(projectId, days);

  if (isLoading) {
    return <Skeleton className="h-20 w-full" />;
  }

  if (!expiring || expiring.length === 0) {
    return (
      <div className="flex items-center gap-2 p-3 bg-green-500/10 border border-green-500/30 rounded-lg">
        <Shield className="h-5 w-5 text-green-500" />
        <div>
          <p className="font-medium text-sm">All Clear</p>
          <p className="text-xs text-muted-foreground">No clearances expiring soon</p>
        </div>
      </div>
    );
  }

  const critical = expiring.filter((c) => c.days_until_expiry <= 7).length;

  return (
    <div
      className={`flex items-center gap-2 p-3 rounded-lg border ${
        critical > 0
          ? 'bg-red-500/10 border-red-500/30'
          : 'bg-orange-500/10 border-orange-500/30'
      }`}
    >
      <AlertTriangle className={critical > 0 ? 'h-5 w-5 text-red-500' : 'h-5 w-5 text-orange-500'} />
      <div>
        <p className="font-medium text-sm">
          {expiring.length} Expiring
          {critical > 0 && <span className="text-red-500"> ({critical} critical)</span>}
        </p>
        <p className="text-xs text-muted-foreground">
          Next: {expiring[0].title} in {expiring[0].days_until_expiry} days
        </p>
      </div>
    </div>
  );
}
