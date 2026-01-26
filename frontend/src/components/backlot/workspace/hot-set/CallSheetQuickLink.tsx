/**
 * CallSheetQuickLink - Quick access to the call sheet for the current day
 *
 * Shows a button/card that opens the call sheet in a new tab or modal
 */
import React from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { FileText, ExternalLink, Calendar } from 'lucide-react';
import { cn } from '@/lib/utils';

interface CallSheetQuickLinkProps {
  projectId: string;
  callSheetId: string | null;
  productionDayId: string;
  dayNumber: number;
  date?: string;
  className?: string;
}

export const CallSheetQuickLink: React.FC<CallSheetQuickLinkProps> = ({
  projectId,
  callSheetId,
  productionDayId,
  dayNumber,
  date,
  className,
}) => {
  const handleOpenCallSheet = () => {
    if (callSheetId) {
      // Open call sheet in new tab
      const url = `/backlot/${projectId}/call-sheets/${callSheetId}`;
      window.open(url, '_blank');
    } else {
      // If no call sheet, go to call sheets list for this day
      const url = `/backlot/${projectId}/call-sheets?day=${productionDayId}`;
      window.open(url, '_blank');
    }
  };

  const formattedDate = date
    ? new Date(date + 'T00:00:00').toLocaleDateString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
      })
    : null;

  return (
    <Card className={cn('bg-soft-black border-muted-gray/20', className)}>
      <CardContent className="p-4">
        <Button
          variant="outline"
          className="w-full h-auto py-3 flex items-center justify-between gap-3 border-accent-yellow/30 text-accent-yellow hover:bg-accent-yellow/10 hover:border-accent-yellow/50"
          onClick={handleOpenCallSheet}
        >
          <div className="flex items-center gap-3">
            <div className="p-2 bg-accent-yellow/10 rounded-lg">
              <FileText className="w-5 h-5" />
            </div>
            <div className="text-left">
              <div className="font-medium">
                {callSheetId ? 'View Call Sheet' : 'Call Sheets'}
              </div>
              <div className="text-xs text-muted-gray flex items-center gap-1">
                <Calendar className="w-3 h-3" />
                Day {dayNumber}
                {formattedDate && <span>- {formattedDate}</span>}
              </div>
            </div>
          </div>
          <ExternalLink className="w-4 h-4 text-muted-gray" />
        </Button>
      </CardContent>
    </Card>
  );
};
