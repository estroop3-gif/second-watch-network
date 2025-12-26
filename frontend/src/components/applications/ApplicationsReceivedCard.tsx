/**
 * ApplicationsReceivedCard - Display an application received for the user's post
 */
import React from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Clock,
  Film,
  Users,
  Shield,
  Sparkles,
  Eye,
  CheckCircle,
  XCircle,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { cn } from '@/lib/utils';
import type { ApplicationReceivedItem } from '@/types/applications';
import { applicationStatusConfig } from '@/types/applications';

interface ApplicationsReceivedCardProps {
  application: ApplicationReceivedItem;
  onViewDetails?: (application: ApplicationReceivedItem) => void;
  onShortlist?: (application: ApplicationReceivedItem) => void;
  onReject?: (application: ApplicationReceivedItem) => void;
}

const ApplicationsReceivedCard: React.FC<ApplicationsReceivedCardProps> = ({
  application,
  onViewDetails,
  onShortlist,
  onReject,
}) => {
  const statusConfig = applicationStatusConfig[application.status];
  const isBacklot = application.source === 'backlot';
  const displayName =
    application.applicant.display_name ||
    application.applicant.full_name ||
    application.applicant.username ||
    'Anonymous';
  const initials = displayName.slice(0, 1).toUpperCase();

  return (
    <div
      className={cn(
        'bg-charcoal-black/50 border border-muted-gray/20 rounded-lg p-4 transition-all',
        'hover:border-muted-gray/40',
        application.is_promoted && 'ring-1 ring-amber-400/30'
      )}
    >
      {/* Header with Source Badge and Status */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2 flex-wrap">
          {/* Source Badge */}
          <Badge
            className={cn(
              'text-xs flex items-center gap-1',
              isBacklot ? 'bg-purple-600 text-white' : 'bg-blue-600 text-white'
            )}
          >
            {isBacklot ? (
              <>
                <Film className="w-3 h-3" />
                Backlot
              </>
            ) : (
              <>
                <Users className="w-3 h-3" />
                Community
              </>
            )}
          </Badge>

          {/* Promoted Badge */}
          {application.is_promoted && (
            <Badge className="bg-amber-600/20 text-amber-400 text-xs flex items-center gap-1">
              <Sparkles className="w-3 h-3" />
              Promoted
            </Badge>
          )}
        </div>

        {/* Status Badge */}
        <Badge className={cn('text-xs', statusConfig.bgColor, statusConfig.color)}>
          {statusConfig.label}
        </Badge>
      </div>

      {/* Applicant Info */}
      <div className="flex items-start gap-3 mb-3">
        <Avatar className="w-10 h-10">
          <AvatarImage src={application.applicant.avatar_url || ''} alt={displayName} />
          <AvatarFallback className="text-sm">{initials}</AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1">
            <span className="font-medium text-bone-white truncate">{displayName}</span>
          </div>
          <div className="text-xs text-muted-gray">
            Applied for: <span className="text-bone-white">{application.title}</span>
          </div>
          {application.project_name && (
            <div className="text-xs text-muted-gray">
              on <span className="text-bone-white">{application.project_name}</span>
            </div>
          )}
        </div>
      </div>

      {/* Elevator Pitch Preview */}
      {application.elevator_pitch && (
        <p className="text-sm text-muted-gray mb-3 line-clamp-2 italic">
          "{application.elevator_pitch}"
        </p>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between pt-3 border-t border-muted-gray/20">
        <div className="flex items-center gap-1 text-xs text-muted-gray">
          <Clock className="w-3 h-3" />
          {formatDistanceToNow(new Date(application.applied_at), { addSuffix: true })}
        </div>

        <div className="flex items-center gap-2">
          {/* Quick Actions - only show for pending applications */}
          {application.status === 'applied' && (
            <>
              <Button
                size="sm"
                variant="ghost"
                className="text-green-400 hover:text-green-300 hover:bg-green-600/10 p-1 h-auto"
                onClick={() => onShortlist?.(application)}
                title="Shortlist"
              >
                <CheckCircle className="w-4 h-4" />
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="text-red-400 hover:text-red-300 hover:bg-red-600/10 p-1 h-auto"
                onClick={() => onReject?.(application)}
                title="Reject"
              >
                <XCircle className="w-4 h-4" />
              </Button>
            </>
          )}
          <Button
            size="sm"
            variant="outline"
            className="border-muted-gray/30 text-muted-gray hover:text-bone-white"
            onClick={() => onViewDetails?.(application)}
          >
            <Eye className="w-3 h-3 mr-1" />
            Review
          </Button>
        </div>
      </div>
    </div>
  );
};

export default ApplicationsReceivedCard;
