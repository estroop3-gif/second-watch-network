/**
 * CollabCard - Individual collab post card
 */
import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { CommunityCollab, CollabType, CompensationType } from '@/types/community';
import { PRODUCTION_TYPE_LABELS, UNION_OPTIONS } from '@/types/productions';
import {
  Users,
  Briefcase,
  Building2,
  MapPin,
  Globe,
  Calendar,
  DollarSign,
  Send,
  Eye,
  Shield,
  FileText,
  Film,
  Tv,
  HelpCircle
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface CollabCardProps {
  collab: CommunityCollab;
  onViewDetails?: (collab: CommunityCollab) => void;
  onApply?: (collab: CommunityCollab) => void;
  onViewApplications?: (collab: CommunityCollab) => void;
  isOwnCollab?: boolean;
  applicationCount?: number;
}

const collabTypeConfig: Record<string, { label: string; icon: React.ElementType; color: string }> = {
  looking_for_crew: { label: 'Looking for Crew', icon: Users, color: 'bg-blue-600' },
  available_for_hire: { label: 'Available for Hire', icon: Briefcase, color: 'bg-green-600' },
  partner_opportunity: { label: 'Partner Opportunity', icon: Building2, color: 'bg-purple-600' },
  crew: { label: 'Looking for Crew', icon: Users, color: 'bg-blue-600' },
  cast: { label: 'Looking for Cast', icon: Users, color: 'bg-amber-600' },
};

const defaultTypeConfig = { label: 'Opportunity', icon: Briefcase, color: 'bg-gray-600' };

const compensationLabels: Record<CompensationType, string> = {
  paid: 'Paid',
  unpaid: 'Unpaid',
  deferred: 'Deferred Pay',
  negotiable: 'Negotiable',
};

const CollabCard: React.FC<CollabCardProps> = ({
  collab,
  onViewDetails,
  onApply,
  onViewApplications,
  isOwnCollab = false,
  applicationCount,
}) => {
  const typeConfig = collabTypeConfig[collab.type] || defaultTypeConfig;
  const TypeIcon = typeConfig.icon;

  // Check for requirements
  const hasRequirements = collab.requires_resume || collab.requires_local_hire;
  const hasUnionOrOrder = (collab.union_requirements && collab.union_requirements.length > 0) || collab.requires_order_membership;
  const hasNetwork = collab.network_id && collab.network;
  const hasProductionInfo = collab.production_type || collab.company || hasNetwork;

  return (
    <div className="bg-charcoal-black/50 border border-muted-gray/20 rounded-lg p-5 hover:border-muted-gray/40 transition-colors">
      {/* Header: Type Badge + Time + Network Logo */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2 flex-wrap">
          <Badge className={`${typeConfig.color} text-white flex items-center gap-1`}>
            <TypeIcon className="w-3 h-3" />
            {typeConfig.label}
          </Badge>
          {collab.production_type && (
            <Badge variant="outline" className="border-blue-400/30 text-blue-300 text-xs">
              <Film className="w-3 h-3 mr-1" />
              {PRODUCTION_TYPE_LABELS[collab.production_type] || collab.production_type}
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-2">
          {hasNetwork && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="flex items-center">
                    {collab.network?.logo_url ? (
                      <img
                        src={collab.network.logo_url}
                        alt={collab.network.name}
                        className="h-6 max-w-[80px] object-contain"
                      />
                    ) : (
                      <div className="flex items-center gap-1 px-2 py-1 bg-muted-gray/20 rounded text-xs text-muted-gray">
                        <Tv className="w-3 h-3" />
                        {collab.network?.name}
                      </div>
                    )}
                  </div>
                </TooltipTrigger>
                <TooltipContent className="bg-charcoal-black border-muted-gray/30">
                  <p className="text-sm">{collab.network?.name}</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
          <span className="text-xs text-muted-gray">
            {formatDistanceToNow(new Date(collab.created_at), { addSuffix: true })}
          </span>
        </div>
      </div>

      {/* Company Name (if present) */}
      {collab.company && (
        <div className="flex items-center gap-1 text-xs text-muted-gray mb-2">
          <Building2 className="w-3 h-3" />
          <span>{collab.company}</span>
        </div>
      )}

      {/* Title */}
      <h3 className="font-heading text-lg text-bone-white mb-2 line-clamp-2">
        {collab.title}
      </h3>

      {/* Description */}
      <p className="text-muted-gray text-sm mb-4 line-clamp-3">
        {collab.description}
      </p>

      {/* Meta Info */}
      <div className="flex flex-wrap gap-3 mb-4 text-xs text-muted-gray">
        {(collab.location || collab.is_remote) && (
          <span className="flex items-center gap-1">
            {collab.is_remote ? (
              <>
                <Globe className="w-3 h-3" />
                Remote
              </>
            ) : (
              <>
                <MapPin className="w-3 h-3" />
                {collab.location}
              </>
            )}
          </span>
        )}

        {collab.compensation_type && (
          <span className="flex items-center gap-1">
            <DollarSign className="w-3 h-3" />
            {compensationLabels[collab.compensation_type]}
          </span>
        )}

        {collab.start_date && (
          <span className="flex items-center gap-1">
            <Calendar className="w-3 h-3" />
            Starts {new Date(collab.start_date).toLocaleDateString()}
          </span>
        )}

        {collab.is_order_only && (
          <span className="flex items-center gap-1 text-emerald-400">
            <Shield className="w-3 h-3" />
            Order Only
          </span>
        )}
      </div>

      {/* Requirements Indicators */}
      {hasRequirements && (
        <div className="flex flex-wrap gap-2 mb-4">
          {collab.requires_resume && (
            <Badge variant="outline" className="text-xs border-amber-400/30 text-amber-400">
              <FileText className="w-3 h-3 mr-1" />
              Resume Required
            </Badge>
          )}
          {collab.requires_local_hire && (
            <Badge variant="outline" className="text-xs border-amber-400/30 text-amber-400">
              <MapPin className="w-3 h-3 mr-1" />
              Local Hire Only
            </Badge>
          )}
        </div>
      )}

      {/* Union & Order Requirements */}
      {hasUnionOrOrder && (
        <div className="flex flex-wrap gap-2 mb-4">
          {/* Order of the Second Watch - Distinct emerald styling */}
          {collab.requires_order_membership && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Badge className="bg-emerald-600/20 text-emerald-300 border border-emerald-500/40 text-xs flex items-center gap-1">
                    <Shield className="w-3 h-3" />
                    Order Members Only
                  </Badge>
                </TooltipTrigger>
                <TooltipContent className="bg-charcoal-black border-muted-gray/30 max-w-xs">
                  <p className="text-sm">
                    <strong>Order of the Second Watch</strong>
                    <br />
                    This is our platform's professional community, not a labor union.
                  </p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}

          {/* Union Requirements - Yellow/amber styling */}
          {collab.union_requirements && collab.union_requirements.map((union) => {
            const unionOption = UNION_OPTIONS.find(u => u.value === union);
            return (
              <TooltipProvider key={union}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Badge variant="outline" className="text-xs border-accent-yellow/40 text-accent-yellow">
                      {unionOption?.label || union}
                    </Badge>
                  </TooltipTrigger>
                  <TooltipContent className="bg-charcoal-black border-muted-gray/30">
                    <p className="text-sm">{unionOption?.description || 'Union requirement'}</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            );
          })}
        </div>
      )}

      {/* Custom Questions Indicator */}
      {collab.custom_questions && collab.custom_questions.length > 0 && (
        <div className="flex items-center gap-1 mb-4 text-xs text-muted-gray">
          <HelpCircle className="w-3 h-3" />
          <span>{collab.custom_questions.length} screening question{collab.custom_questions.length !== 1 ? 's' : ''}</span>
        </div>
      )}

      {/* Tags */}
      {collab.tags && collab.tags.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-4">
          {collab.tags.slice(0, 4).map((tag) => (
            <Badge
              key={tag}
              variant="outline"
              className="text-xs border-muted-gray/30 text-muted-gray"
            >
              {tag}
            </Badge>
          ))}
          {collab.tags.length > 4 && (
            <Badge variant="outline" className="text-xs border-muted-gray/30 text-muted-gray">
              +{collab.tags.length - 4}
            </Badge>
          )}
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center justify-end pt-4 border-t border-muted-gray/20">
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="outline"
            className="border-muted-gray/30 text-muted-gray hover:text-bone-white"
            onClick={() => onViewDetails?.(collab)}
          >
            <Eye className="w-3 h-3 mr-1" />
            Details
          </Button>
          {isOwnCollab ? (
            <Button
              size="sm"
              variant="outline"
              className="border-accent-yellow/50 text-accent-yellow hover:bg-accent-yellow hover:text-charcoal-black"
              onClick={() => onViewApplications?.(collab)}
            >
              <Users className="w-3 h-3 mr-1" />
              Applications
              {applicationCount !== undefined && applicationCount > 0 && (
                <Badge className="ml-1 bg-accent-yellow text-charcoal-black text-[10px] px-1.5 py-0">
                  {applicationCount}
                </Badge>
              )}
            </Button>
          ) : (
            <Button
              size="sm"
              className="bg-accent-yellow text-charcoal-black hover:bg-bone-white"
              onClick={() => onApply?.(collab)}
            >
              <Send className="w-3 h-3 mr-1" />
              Apply
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};

export default CollabCard;
