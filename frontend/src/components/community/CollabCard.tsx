/**
 * CollabCard - Individual collab post card
 */
import React from 'react';
import { Link } from 'react-router-dom';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { CommunityCollab, CollabType, CompensationType } from '@/types/community';
import {
  Users,
  Briefcase,
  Building2,
  MapPin,
  Globe,
  Calendar,
  DollarSign,
  MessageSquare,
  Eye,
  Shield
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

interface CollabCardProps {
  collab: CommunityCollab;
  onViewDetails?: (collab: CommunityCollab) => void;
  onMessage?: (userId: string) => void;
}

const collabTypeConfig: Record<CollabType, { label: string; icon: React.ElementType; color: string }> = {
  looking_for_crew: { label: 'Looking for Crew', icon: Users, color: 'bg-blue-600' },
  available_for_hire: { label: 'Available for Hire', icon: Briefcase, color: 'bg-green-600' },
  partner_opportunity: { label: 'Partner Opportunity', icon: Building2, color: 'bg-purple-600' },
};

const compensationLabels: Record<CompensationType, string> = {
  paid: 'Paid',
  unpaid: 'Unpaid',
  deferred: 'Deferred Pay',
  negotiable: 'Negotiable',
};

const CollabCard: React.FC<CollabCardProps> = ({ collab, onViewDetails, onMessage }) => {
  const typeConfig = collabTypeConfig[collab.type];
  const TypeIcon = typeConfig.icon;

  const authorName = collab.profile?.display_name || collab.profile?.full_name || collab.profile?.username || 'Member';
  const authorInitials = authorName.slice(0, 1).toUpperCase();
  const authorUsername = collab.profile?.username || 'member';

  return (
    <div className="bg-charcoal-black/50 border border-muted-gray/20 rounded-lg p-5 hover:border-muted-gray/40 transition-colors">
      {/* Header: Type Badge + Time */}
      <div className="flex items-center justify-between mb-3">
        <Badge className={`${typeConfig.color} text-white flex items-center gap-1`}>
          <TypeIcon className="w-3 h-3" />
          {typeConfig.label}
        </Badge>
        <span className="text-xs text-muted-gray">
          {formatDistanceToNow(new Date(collab.created_at), { addSuffix: true })}
        </span>
      </div>

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

      {/* Author & Actions */}
      <div className="flex items-center justify-between pt-4 border-t border-muted-gray/20">
        <Link
          to={`/profile/${authorUsername}`}
          className="flex items-center gap-2 hover:text-accent-yellow transition-colors"
        >
          <Avatar className="w-8 h-8">
            <AvatarImage src={collab.profile?.avatar_url || ''} alt={authorName} />
            <AvatarFallback className="text-xs">{authorInitials}</AvatarFallback>
          </Avatar>
          <div>
            <span className="text-sm text-bone-white">{authorName}</span>
            {collab.profile?.is_order_member && (
              <Shield className="w-3 h-3 text-emerald-400 inline ml-1" />
            )}
          </div>
        </Link>

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
          <Button
            size="sm"
            className="bg-accent-yellow text-charcoal-black hover:bg-bone-white"
            onClick={() => onMessage?.(collab.user_id)}
          >
            <MessageSquare className="w-3 h-3 mr-1" />
            Message
          </Button>
        </div>
      </div>
    </div>
  );
};

export default CollabCard;
