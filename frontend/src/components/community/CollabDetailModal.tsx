/**
 * CollabDetailModal - Full detail view of a collab post
 */
import React from 'react';
import { Link } from 'react-router-dom';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { CommunityCollab } from '@/types/community';
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
  Shield,
  FileText,
  Film,
  Tv,
  X,
  ExternalLink,
  HelpCircle
} from 'lucide-react';
import { formatDistanceToNow, format } from 'date-fns';

interface CollabDetailModalProps {
  collab: CommunityCollab | null;
  isOpen: boolean;
  onClose: () => void;
  onApply?: (collab: CommunityCollab) => void;
  isOwnCollab?: boolean;
}

const collabTypeConfig: Record<string, { label: string; icon: React.ElementType; color: string }> = {
  looking_for_crew: { label: 'Looking for Crew', icon: Users, color: 'bg-blue-600' },
  available_for_hire: { label: 'Available for Hire', icon: Briefcase, color: 'bg-green-600' },
  partner_opportunity: { label: 'Partner Opportunity', icon: Building2, color: 'bg-purple-600' },
  crew: { label: 'Looking for Crew', icon: Users, color: 'bg-blue-600' },
  cast: { label: 'Looking for Cast', icon: Users, color: 'bg-amber-600' },
};

const compensationLabels: Record<string, string> = {
  paid: 'Paid',
  unpaid: 'Unpaid',
  deferred: 'Deferred Pay',
  negotiable: 'Negotiable',
};

const CollabDetailModal: React.FC<CollabDetailModalProps> = ({
  collab,
  isOpen,
  onClose,
  onApply,
  isOwnCollab = false,
}) => {
  if (!collab) return null;

  const typeConfig = collabTypeConfig[collab.type] || { label: 'Opportunity', icon: Briefcase, color: 'bg-gray-600' };
  const TypeIcon = typeConfig.icon;
  const authorName = collab.profile?.display_name || collab.profile?.full_name || collab.profile?.username || 'Member';
  const authorInitials = authorName.slice(0, 1).toUpperCase();
  const authorUsername = collab.profile?.username || 'member';

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="bg-deep-black border-muted-gray/30 max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-start justify-between">
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
          </div>
          <DialogTitle className="text-xl font-heading text-bone-white mt-2">
            {collab.title}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Author */}
          <div className="flex items-center justify-between pt-2 border-t border-muted-gray/20">
            <Link
              to={`/profile/${authorUsername}`}
              className="flex items-center gap-3 hover:text-accent-yellow transition-colors"
            >
              <Avatar className="w-10 h-10">
                <AvatarImage src={collab.profile?.avatar_url || ''} alt={authorName} />
                <AvatarFallback>{authorInitials}</AvatarFallback>
              </Avatar>
              <div>
                <span className="text-bone-white font-medium">{authorName}</span>
                {collab.profile?.is_order_member && (
                  <Shield className="w-3 h-3 text-emerald-400 inline ml-1" />
                )}
                <div className="text-xs text-muted-gray">
                  Posted {formatDistanceToNow(new Date(collab.created_at), { addSuffix: true })}
                </div>
              </div>
            </Link>
            <Link
              to={`/profile/${authorUsername}`}
              className="text-xs text-muted-gray hover:text-accent-yellow flex items-center gap-1"
            >
              View Profile <ExternalLink className="w-3 h-3" />
            </Link>
          </div>

          {/* Company & Network */}
          {(collab.company || collab.network) && (
            <div className="flex flex-wrap gap-4 text-sm">
              {collab.company && (
                <div className="flex items-center gap-2 text-muted-gray">
                  <Building2 className="w-4 h-4" />
                  <span>{collab.company}</span>
                </div>
              )}
              {collab.network && (
                <div className="flex items-center gap-2">
                  {collab.network.logo_url ? (
                    <img
                      src={collab.network.logo_url}
                      alt={collab.network.name}
                      className="h-6 max-w-[100px] object-contain"
                    />
                  ) : (
                    <div className="flex items-center gap-1 text-muted-gray">
                      <Tv className="w-4 h-4" />
                      <span>{collab.network.name}</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Meta Info */}
          <div className="flex flex-wrap gap-4 text-sm">
            {(collab.location || collab.is_remote) && (
              <div className="flex items-center gap-1 text-muted-gray">
                {collab.is_remote ? (
                  <>
                    <Globe className="w-4 h-4" />
                    <span>Remote</span>
                  </>
                ) : (
                  <>
                    <MapPin className="w-4 h-4" />
                    <span>{collab.location}</span>
                  </>
                )}
              </div>
            )}

            {collab.compensation_type && (
              <div className="flex items-center gap-1 text-muted-gray">
                <DollarSign className="w-4 h-4" />
                <span>{compensationLabels[collab.compensation_type] || collab.compensation_type}</span>
                {collab.compensation_details && (
                  <span className="text-bone-white ml-1">- {collab.compensation_details}</span>
                )}
              </div>
            )}

            {collab.start_date && (
              <div className="flex items-center gap-1 text-muted-gray">
                <Calendar className="w-4 h-4" />
                <span>Starts {format(new Date(collab.start_date), 'MMM d, yyyy')}</span>
              </div>
            )}

            {collab.end_date && (
              <div className="flex items-center gap-1 text-muted-gray">
                <Calendar className="w-4 h-4" />
                <span>Ends {format(new Date(collab.end_date), 'MMM d, yyyy')}</span>
              </div>
            )}
          </div>

          {/* Description */}
          <div className="bg-charcoal-black/50 border border-muted-gray/20 rounded-lg p-4">
            <p className="text-bone-white whitespace-pre-wrap">{collab.description}</p>
          </div>

          {/* Requirements */}
          {(collab.requires_resume || collab.requires_local_hire || collab.requires_order_membership || (collab.union_requirements && collab.union_requirements.length > 0)) && (
            <div className="space-y-3">
              <h4 className="text-sm font-medium text-bone-white">Requirements</h4>
              <div className="flex flex-wrap gap-2">
                {collab.requires_resume && (
                  <Badge variant="outline" className="border-amber-400/30 text-amber-400">
                    <FileText className="w-3 h-3 mr-1" />
                    Resume Required
                  </Badge>
                )}
                {collab.requires_local_hire && (
                  <Badge variant="outline" className="border-amber-400/30 text-amber-400">
                    <MapPin className="w-3 h-3 mr-1" />
                    Local Hire Only
                  </Badge>
                )}
                {collab.requires_order_membership && (
                  <Badge className="bg-emerald-600/20 text-emerald-300 border border-emerald-500/40">
                    <Shield className="w-3 h-3 mr-1" />
                    Order Members Only
                  </Badge>
                )}
                {collab.union_requirements?.map((union) => {
                  const unionOption = UNION_OPTIONS.find(u => u.value === union);
                  return (
                    <Badge key={union} variant="outline" className="border-accent-yellow/40 text-accent-yellow">
                      {unionOption?.label || union}
                    </Badge>
                  );
                })}
              </div>
            </div>
          )}

          {/* Custom Questions */}
          {collab.custom_questions && collab.custom_questions.length > 0 && (
            <div className="space-y-3">
              <h4 className="text-sm font-medium text-bone-white flex items-center gap-2">
                <HelpCircle className="w-4 h-4" />
                Screening Questions ({collab.custom_questions.length})
              </h4>
              <ul className="space-y-2 text-sm text-muted-gray">
                {collab.custom_questions.map((q, i) => (
                  <li key={q.id || i} className="flex items-start gap-2">
                    <span className="text-accent-yellow">{i + 1}.</span>
                    <span>{q.question}</span>
                    {q.required && <Badge variant="outline" className="text-xs border-red-400/30 text-red-400">Required</Badge>}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Tags */}
          {collab.tags && collab.tags.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {collab.tags.map((tag) => (
                <Badge key={tag} variant="outline" className="border-muted-gray/30 text-muted-gray">
                  {tag}
                </Badge>
              ))}
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3 pt-4 border-t border-muted-gray/20">
            <Button
              variant="outline"
              className="flex-1 border-muted-gray/30"
              onClick={onClose}
            >
              Close
            </Button>
            {!isOwnCollab && (
              <Button
                className="flex-1 bg-accent-yellow text-charcoal-black hover:bg-bone-white"
                onClick={() => {
                  onClose();
                  onApply?.(collab);
                }}
              >
                <Send className="w-4 h-4 mr-2" />
                Apply Now
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default CollabDetailModal;
