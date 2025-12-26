/**
 * UnifiedApplicationCard - Display a user's submitted application (both Backlot and Community)
 */
import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Clock,
  Film,
  Users,
  MapPin,
  Globe,
  ExternalLink,
  Sparkles,
  Eye,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { cn } from '@/lib/utils';
import type { UnifiedApplication, ApplicationStatus } from '@/types/applications';
import { applicationStatusConfig } from '@/types/applications';

interface UnifiedApplicationCardProps {
  application: UnifiedApplication;
  onViewDetails?: (application: UnifiedApplication) => void;
}

const UnifiedApplicationCard: React.FC<UnifiedApplicationCardProps> = ({
  application,
  onViewDetails,
}) => {
  const statusConfig = applicationStatusConfig[application.status];
  const isBacklot = application.source === 'backlot';

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
              isBacklot
                ? 'bg-purple-600 text-white'
                : 'bg-blue-600 text-white'
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

      {/* Title */}
      <h3 className="font-heading text-lg text-bone-white mb-1 line-clamp-1">
        {application.title}
      </h3>

      {/* Project Name (for Backlot) or Location (for Community) */}
      <div className="flex items-center gap-2 text-sm text-muted-gray mb-3">
        {application.project_name && (
          <span className="flex items-center gap-1">
            <Film className="w-3 h-3" />
            {application.project_name}
          </span>
        )}
        {application.location && (
          <span className="flex items-center gap-1">
            <MapPin className="w-3 h-3" />
            {application.location}
          </span>
        )}
        {application.is_remote && (
          <span className="flex items-center gap-1">
            <Globe className="w-3 h-3" />
            Remote
          </span>
        )}
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
          Applied {formatDistanceToNow(new Date(application.applied_at), { addSuffix: true })}
        </div>

        <Button
          size="sm"
          variant="outline"
          className="border-muted-gray/30 text-muted-gray hover:text-bone-white"
          onClick={() => onViewDetails?.(application)}
        >
          <Eye className="w-3 h-3 mr-1" />
          Details
        </Button>
      </div>
    </div>
  );
};

export default UnifiedApplicationCard;
