/**
 * ApplicationDetailModal - View and manage a single application
 */
import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Shield,
  Sparkles,
  Star,
  StarOff,
  FileText,
  MapPin,
  Calendar,
  ExternalLink,
  Clock,
  User,
  Film,
  MessageSquare,
  Check,
  Loader2,
  Video,
  Image,
  Clapperboard,
  HelpCircle,
  ListChecks,
} from 'lucide-react';
import { formatDistanceToNow, format } from 'date-fns';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

import { useUpdateCollabApplicationStatus, useUpdateRoleApplicationStatus } from '@/hooks/applications';
import type {
  CollabApplication,
  RoleApplication,
  ApplicationStatus,
  ApplicationSource,
  applicationStatusConfig,
} from '@/types/applications';

interface ApplicationDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  application: CollabApplication | RoleApplication | null;
  source?: ApplicationSource;
  onStatusUpdate?: () => void;
}

const statusOptions: { value: ApplicationStatus; label: string }[] = [
  { value: 'applied', label: 'Applied' },
  { value: 'viewed', label: 'Viewed' },
  { value: 'shortlisted', label: 'Shortlisted' },
  { value: 'interview', label: 'Interview' },
  { value: 'offered', label: 'Offered' },
  { value: 'booked', label: 'Booked' },
  { value: 'rejected', label: 'Rejected' },
];

const statusConfig: Record<ApplicationStatus, { label: string; color: string; bgColor: string }> = {
  applied: { label: 'Applied', color: 'text-blue-400', bgColor: 'bg-blue-600/20' },
  viewed: { label: 'Viewed', color: 'text-purple-400', bgColor: 'bg-purple-600/20' },
  shortlisted: { label: 'Shortlisted', color: 'text-amber-400', bgColor: 'bg-amber-600/20' },
  interview: { label: 'Interview', color: 'text-cyan-400', bgColor: 'bg-cyan-600/20' },
  offered: { label: 'Offered', color: 'text-green-400', bgColor: 'bg-green-600/20' },
  booked: { label: 'Booked', color: 'text-emerald-400', bgColor: 'bg-emerald-600/20' },
  rejected: { label: 'Rejected', color: 'text-red-400', bgColor: 'bg-red-600/20' },
  withdrawn: { label: 'Withdrawn', color: 'text-gray-500', bgColor: 'bg-gray-600/20' },
};

const ApplicationDetailModal: React.FC<ApplicationDetailModalProps> = ({
  isOpen,
  onClose,
  application,
  source = 'community',
  onStatusUpdate,
}) => {
  const [status, setStatus] = useState<ApplicationStatus>('applied');
  const [rating, setRating] = useState<number | null>(null);
  const [internalNotes, setInternalNotes] = useState('');
  const [hasChanges, setHasChanges] = useState(false);

  const updateCollabStatusMutation = useUpdateCollabApplicationStatus();
  const updateRoleStatusMutation = useUpdateRoleApplicationStatus();

  // Select the appropriate mutation based on source
  const updateStatusMutation = source === 'community' ? updateCollabStatusMutation : updateRoleStatusMutation;

  // Sync state with application
  useEffect(() => {
    if (application) {
      setStatus(application.status);
      setRating(application.rating);
      setInternalNotes(application.internal_notes || '');
      setHasChanges(false);
    }
  }, [application]);

  // Track changes
  useEffect(() => {
    if (application) {
      const changed =
        status !== application.status ||
        rating !== application.rating ||
        internalNotes !== (application.internal_notes || '');
      setHasChanges(changed);
    }
  }, [status, rating, internalNotes, application]);

  const handleSave = async () => {
    if (!application) return;

    try {
      await updateStatusMutation.mutateAsync({
        applicationId: application.id,
        input: {
          status,
          rating: rating ?? undefined,
          internal_notes: internalNotes || undefined,
        },
      });
      toast.success('Application updated');
      onStatusUpdate?.();
      setHasChanges(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to update');
    }
  };

  if (!application) return null;

  const profile = application.current_profile || application.applicant_profile_snapshot;
  const displayName = profile?.display_name || profile?.full_name || profile?.username || 'Anonymous';
  const initials = displayName.slice(0, 1).toUpperCase();
  const username = profile?.username || 'member';

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl bg-charcoal-black text-bone-white border-muted-gray max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl text-bone-white flex items-center gap-2">
            Application Details
            {application.is_promoted && (
              <Badge className="bg-amber-600/20 text-amber-400 border-amber-400/30">
                <Sparkles className="w-3 h-3 mr-1" />
                Promoted
              </Badge>
            )}
          </DialogTitle>
          <DialogDescription className="text-muted-gray">
            Review and manage this application
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Applicant Header */}
          <div className="flex items-start gap-4 p-4 bg-charcoal-black/50 border border-muted-gray/20 rounded-lg">
            <Avatar className="w-16 h-16">
              <AvatarImage src={profile?.avatar_url || ''} alt={displayName} />
              <AvatarFallback className="text-xl">{initials}</AvatarFallback>
            </Avatar>
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-lg font-medium text-bone-white">{displayName}</span>
                {profile?.is_order_member && (
                  <Shield className="w-4 h-4 text-emerald-400" />
                )}
              </div>
              <div className="text-sm text-muted-gray mb-2">{profile?.role || 'Member'}</div>
              <Link
                to={`/profile/${username}`}
                className="inline-flex items-center gap-1 text-sm text-accent-yellow hover:underline"
              >
                <User className="w-3 h-3" />
                View Profile
                <ExternalLink className="w-3 h-3" />
              </Link>
            </div>
            <div className="text-right">
              <Badge className={cn(statusConfig[application.status].bgColor, statusConfig[application.status].color)}>
                {statusConfig[application.status].label}
              </Badge>
              <div className="flex items-center gap-1 text-xs text-muted-gray mt-2">
                <Clock className="w-3 h-3" />
                {formatDistanceToNow(new Date(application.created_at), { addSuffix: true })}
              </div>
            </div>
          </div>

          {/* Elevator Pitch */}
          {application.elevator_pitch && (
            <div>
              <h4 className="text-sm font-medium text-bone-white mb-2 flex items-center gap-2">
                <MessageSquare className="w-4 h-4 text-accent-yellow" />
                Elevator Pitch
              </h4>
              <div className="bg-charcoal-black/50 border border-muted-gray/20 rounded-lg p-3">
                <p className="text-muted-gray italic">"{application.elevator_pitch}"</p>
              </div>
            </div>
          )}

          {/* Cover Note */}
          {application.cover_note && (
            <div>
              <h4 className="text-sm font-medium text-bone-white mb-2">Cover Letter</h4>
              <div className="bg-charcoal-black/50 border border-muted-gray/20 rounded-lg p-3">
                <p className="text-muted-gray whitespace-pre-wrap">{application.cover_note}</p>
              </div>
            </div>
          )}

          {/* Attachments & Info Grid */}
          <div className="grid grid-cols-2 gap-4">
            {/* Left Column */}
            <div className="space-y-3">
              {application.resume_url && (
                <a
                  href={application.resume_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 p-3 bg-green-600/10 border border-green-400/30 rounded-lg hover:bg-green-600/20 transition-colors"
                >
                  <FileText className="w-4 h-4 text-green-400" />
                  <span className="text-sm text-green-400">View Resume</span>
                  <ExternalLink className="w-3 h-3 text-green-400 ml-auto" />
                </a>
              )}

              {application.reel_url && (
                <a
                  href={application.reel_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 p-3 bg-purple-600/10 border border-purple-400/30 rounded-lg hover:bg-purple-600/20 transition-colors"
                >
                  <Video className="w-4 h-4 text-purple-400" />
                  <span className="text-sm text-purple-400">View Demo Reel</span>
                  <ExternalLink className="w-3 h-3 text-purple-400 ml-auto" />
                </a>
              )}

              {application.self_tape_url && (
                <a
                  href={application.self_tape_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 p-3 bg-blue-600/10 border border-blue-400/30 rounded-lg hover:bg-blue-600/20 transition-colors"
                >
                  <Clapperboard className="w-4 h-4 text-blue-400" />
                  <span className="text-sm text-blue-400">View Self-Tape</span>
                  <ExternalLink className="w-3 h-3 text-blue-400 ml-auto" />
                </a>
              )}

              {application.headshot_url && (
                <a
                  href={application.headshot_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 p-3 bg-amber-600/10 border border-amber-400/30 rounded-lg hover:bg-amber-600/20 transition-colors"
                >
                  <Image className="w-4 h-4 text-amber-400" />
                  <span className="text-sm text-amber-400">View Headshot</span>
                  <ExternalLink className="w-3 h-3 text-amber-400 ml-auto" />
                </a>
              )}
            </div>

            {/* Right Column */}
            <div className="space-y-3">
              {application.local_hire_confirmed !== null && (
                <div className="flex items-center gap-2 p-3 bg-charcoal-black/50 border border-muted-gray/20 rounded-lg">
                  <MapPin className="w-4 h-4 text-amber-400" />
                  <span className="text-sm text-muted-gray">
                    Local Hire: {application.local_hire_confirmed ? (
                      <span className="text-green-400">Yes</span>
                    ) : (
                      <span className="text-red-400">No</span>
                    )}
                  </span>
                </div>
              )}

              {application.availability_notes && (
                <div className="flex items-start gap-2 p-3 bg-charcoal-black/50 border border-muted-gray/20 rounded-lg">
                  <Calendar className="w-4 h-4 text-cyan-400 mt-0.5" />
                  <span className="text-sm text-muted-gray">{application.availability_notes}</span>
                </div>
              )}

              {/* Special Skills */}
              {application.special_skills && application.special_skills.length > 0 && (
                <div className="p-3 bg-charcoal-black/50 border border-muted-gray/20 rounded-lg">
                  <h5 className="text-xs font-medium text-muted-gray mb-2 flex items-center gap-1">
                    <ListChecks className="w-3 h-3" />
                    Special Skills
                  </h5>
                  <div className="flex flex-wrap gap-1">
                    {application.special_skills.map((skill, index) => (
                      <Badge key={index} variant="outline" className="text-xs border-muted-gray/30 text-muted-gray">
                        {skill}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Custom Question Responses */}
          {application.custom_question_responses && Object.keys(application.custom_question_responses).length > 0 && (
            <div>
              <h4 className="text-sm font-medium text-bone-white mb-2 flex items-center gap-2">
                <HelpCircle className="w-4 h-4 text-accent-yellow" />
                Screening Questions
              </h4>
              <div className="space-y-3">
                {Object.entries(application.custom_question_responses).map(([questionId, answer]) => (
                  <div key={questionId} className="bg-charcoal-black/50 border border-muted-gray/20 rounded-lg p-3">
                    <p className="text-muted-gray whitespace-pre-wrap">{answer}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Selected Credits */}
          {application.selected_credits && application.selected_credits.length > 0 && (
            <div>
              <h4 className="text-sm font-medium text-bone-white mb-2 flex items-center gap-2">
                <Film className="w-4 h-4 text-accent-yellow" />
                Selected Credits ({application.selected_credits.length})
              </h4>
              <div className="bg-charcoal-black/50 border border-muted-gray/20 rounded-lg p-3 space-y-2">
                {application.selected_credits.map((credit) => (
                  <div
                    key={credit.id}
                    className="flex items-center justify-between text-sm py-1 border-b border-muted-gray/10 last:border-0"
                  >
                    <span className="text-bone-white">{credit.project_title}</span>
                    <span className="text-muted-gray">
                      {credit.role} {credit.year && `(${credit.year})`}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Divider */}
          <hr className="border-muted-gray/20" />

          {/* Status Management */}
          <div className="space-y-4">
            <h4 className="text-sm font-medium text-bone-white">Manage Application</h4>

            <div className="grid grid-cols-2 gap-4">
              {/* Status Select */}
              <div className="space-y-2">
                <label className="text-xs text-muted-gray">Status</label>
                <Select value={status} onValueChange={(v) => setStatus(v as ApplicationStatus)}>
                  <SelectTrigger className="bg-charcoal-black/50 border-muted-gray/30 text-bone-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-charcoal-black border-muted-gray/30">
                    {statusOptions.map((opt) => (
                      <SelectItem
                        key={opt.value}
                        value={opt.value}
                        className="text-bone-white hover:bg-muted-gray/20"
                      >
                        <div className="flex items-center gap-2">
                          <div className={cn('w-2 h-2 rounded-full', statusConfig[opt.value].bgColor.replace('/20', ''))} />
                          {opt.label}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Rating */}
              <div className="space-y-2">
                <label className="text-xs text-muted-gray">Rating</label>
                <div className="flex items-center gap-1 h-10">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      onClick={() => setRating(rating === star ? null : star)}
                      className="p-1 hover:scale-110 transition-transform"
                    >
                      {rating && rating >= star ? (
                        <Star className="w-6 h-6 text-amber-400 fill-amber-400" />
                      ) : (
                        <StarOff className="w-6 h-6 text-muted-gray/50 hover:text-muted-gray" />
                      )}
                    </button>
                  ))}
                  {rating && (
                    <span className="text-sm text-muted-gray ml-2">{rating}/5</span>
                  )}
                </div>
              </div>
            </div>

            {/* Internal Notes */}
            <div className="space-y-2">
              <label className="text-xs text-muted-gray">Internal Notes (not visible to applicant)</label>
              <Textarea
                value={internalNotes}
                onChange={(e) => setInternalNotes(e.target.value)}
                placeholder="Add notes about this applicant..."
                className="min-h-24 bg-charcoal-black/50 border-muted-gray/30 text-bone-white placeholder:text-muted-gray"
              />
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between pt-4 border-t border-muted-gray/20">
          <Button
            variant="outline"
            onClick={onClose}
            className="border-muted-gray/30 text-muted-gray hover:text-bone-white"
          >
            Close
          </Button>
          <Button
            onClick={handleSave}
            disabled={!hasChanges || updateStatusMutation.isPending}
            className="bg-accent-yellow text-charcoal-black hover:bg-bone-white"
          >
            {updateStatusMutation.isPending ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Check className="w-4 h-4 mr-2" />
                Save Changes
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ApplicationDetailModal;
