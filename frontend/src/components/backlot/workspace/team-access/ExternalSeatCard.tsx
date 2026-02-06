import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { FileText, Receipt, Clock, UserCog, Trash2 } from 'lucide-react';
import type { ExternalSeat } from '@/hooks/backlot/useExternalSeats';
import { TAB_DEFINITIONS } from './constants';
import { cn } from '@/lib/utils';

interface ExternalSeatCardProps {
  seat: ExternalSeat;
  onEdit: (seat: ExternalSeat) => void;
  onRemove: (seat: ExternalSeat) => void;
  isLoading?: boolean;
}

const ExternalSeatCard: React.FC<ExternalSeatCardProps> = ({ seat, onEdit, onRemove, isLoading }) => {
  const displayName = seat.user_name || seat.user_email || 'Unknown User';
  const initials = displayName
    .split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  const isFreelancer = seat.seat_type === 'project';

  // Count visible tabs for clients
  const visibleTabCount = !isFreelancer
    ? Object.values(seat.tab_permissions || {}).filter(p => p?.view).length
    : 0;

  return (
    <div className="bg-charcoal-black/50 border border-muted-gray/20 rounded-lg p-4 hover:border-muted-gray/40 transition-colors">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Avatar className="h-10 w-10">
            <AvatarImage src={seat.user_avatar || undefined} />
            <AvatarFallback className="bg-primary/20 text-primary">
              {initials}
            </AvatarFallback>
          </Avatar>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-medium text-bone-white">{displayName}</span>
            </div>
            <div className="flex items-center gap-2 mt-1">
              <Badge
                variant="outline"
                className={cn(
                  'text-xs',
                  isFreelancer
                    ? 'bg-green-500/20 text-green-400 border-green-500/30'
                    : 'bg-blue-500/20 text-blue-400 border-blue-500/30'
                )}
              >
                {isFreelancer ? 'Freelancer' : 'Client'}
              </Badge>
              {isFreelancer && (
                <div className="flex items-center gap-2 text-xs text-muted-gray">
                  {seat.can_invoice && (
                    <span className="flex items-center gap-1">
                      <FileText className="h-3 w-3" />
                      Invoice
                    </span>
                  )}
                  {seat.can_expense && (
                    <span className="flex items-center gap-1">
                      <Receipt className="h-3 w-3" />
                      Expense
                    </span>
                  )}
                  {seat.can_timecard && (
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      Timecard
                    </span>
                  )}
                </div>
              )}
              {!isFreelancer && (
                <span className="text-xs text-muted-gray">
                  {visibleTabCount} of {TAB_DEFINITIONS.length} tabs visible
                </span>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-muted-gray hover:text-bone-white"
            onClick={() => onEdit(seat)}
            disabled={isLoading}
          >
            <UserCog className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-destructive hover:text-destructive"
            onClick={() => onRemove(seat)}
            disabled={isLoading}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
};

export default ExternalSeatCard;
