/**
 * ShortlistReviewView - Grid/gallery view for comparing shortlisted candidates
 */
import React, { useState, useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Star,
  StarOff,
  Video,
  Film,
  Image as ImageIcon,
  ExternalLink,
  Grid3X3,
  LayoutGrid,
  X,
  Calendar,
  MessageSquare,
  Play,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import VideoPreview from '@/components/shared/VideoPreview';
import type { BacklotRoleApplication } from '@/types/backlot';

interface ShortlistReviewViewProps {
  applications: BacklotRoleApplication[];
  onRequestTape?: (applicationId: string) => void;
  onStatusChange?: (applicationId: string, status: string) => void;
  onRating?: (applicationId: string, rating: number) => void;
  isRequestingTape?: boolean;
}

export function ShortlistReviewView({
  applications,
  onRequestTape,
  onStatusChange,
  onRating,
  isRequestingTape = false,
}: ShortlistReviewViewProps) {
  const [viewMode, setViewMode] = useState<'grid' | 'gallery'>('grid');
  const [selectedForCompare, setSelectedForCompare] = useState<string[]>([]);
  const [compareDialogOpen, setCompareDialogOpen] = useState(false);

  const shortlistedApps = useMemo(
    () => applications.filter((app) => app.status === 'shortlisted'),
    [applications]
  );

  const selectedApps = useMemo(
    () => shortlistedApps.filter((app) => selectedForCompare.includes(app.id)),
    [shortlistedApps, selectedForCompare]
  );

  const toggleSelect = (id: string) => {
    setSelectedForCompare((prev) => {
      if (prev.includes(id)) {
        return prev.filter((x) => x !== id);
      }
      if (prev.length >= 3) {
        return [...prev.slice(1), id];
      }
      return [...prev, id];
    });
  };

  const canRequestTape = (app: BacklotRoleApplication) =>
    !app.tape_requested_at && !app.self_tape_url && !app.tape_submitted_at;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-medium text-lg">Shortlist Review</h3>
          <p className="text-sm text-muted-foreground">
            {shortlistedApps.length} shortlisted candidate{shortlistedApps.length !== 1 ? 's' : ''}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {selectedForCompare.length > 0 && (
            <Button
              size="sm"
              onClick={() => setCompareDialogOpen(true)}
              className="bg-accent-yellow text-charcoal-black hover:bg-bone-white"
            >
              Compare ({selectedForCompare.length})
            </Button>
          )}
          <div className="flex border rounded-md">
            <Button
              variant="ghost"
              size="sm"
              className={cn(viewMode === 'grid' && 'bg-muted')}
              onClick={() => setViewMode('grid')}
            >
              <Grid3X3 className="w-4 h-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className={cn(viewMode === 'gallery' && 'bg-muted')}
              onClick={() => setViewMode('gallery')}
            >
              <LayoutGrid className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>

      {shortlistedApps.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <p>No shortlisted candidates yet.</p>
          <p className="text-sm mt-1">Move applicants to the shortlist to compare them here.</p>
        </div>
      ) : (
        <div
          className={cn(
            'grid gap-4',
            viewMode === 'grid'
              ? 'grid-cols-2 md:grid-cols-3 lg:grid-cols-4'
              : 'grid-cols-1 md:grid-cols-2'
          )}
        >
          {shortlistedApps.map((app) => (
            <CandidateCard
              key={app.id}
              application={app}
              isSelected={selectedForCompare.includes(app.id)}
              onToggleSelect={() => toggleSelect(app.id)}
              onRequestTape={onRequestTape}
              onRating={onRating}
              isRequestingTape={isRequestingTape}
              canRequestTape={canRequestTape(app)}
              compact={viewMode === 'grid'}
            />
          ))}
        </div>
      )}

      {/* Comparison Dialog */}
      <Dialog open={compareDialogOpen} onOpenChange={setCompareDialogOpen}>
        <DialogContent className="max-w-5xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle>Compare Candidates</DialogTitle>
          </DialogHeader>
          <ScrollArea className="max-h-[70vh]">
            <div className={cn(
              'grid gap-4',
              selectedApps.length === 2 ? 'grid-cols-2' : 'grid-cols-3'
            )}>
              {selectedApps.map((app) => (
                <ComparisonColumn
                  key={app.id}
                  application={app}
                  onRating={onRating}
                  onRequestTape={onRequestTape}
                  isRequestingTape={isRequestingTape}
                  canRequestTape={canRequestTape(app)}
                />
              ))}
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// =============================================================================
// Candidate Card
// =============================================================================

interface CandidateCardProps {
  application: BacklotRoleApplication;
  isSelected: boolean;
  onToggleSelect: () => void;
  onRequestTape?: (id: string) => void;
  onRating?: (id: string, rating: number) => void;
  isRequestingTape: boolean;
  canRequestTape: boolean;
  compact: boolean;
}

function CandidateCard({
  application,
  isSelected,
  onToggleSelect,
  onRequestTape,
  onRating,
  isRequestingTape,
  canRequestTape,
  compact,
}: CandidateCardProps) {
  const profile = application.applicant_profile_snapshot;

  return (
    <Card
      className={cn(
        'relative transition-all',
        isSelected && 'ring-2 ring-accent-yellow'
      )}
    >
      {/* Selection Checkbox */}
      <div className="absolute top-2 right-2 z-10">
        <Checkbox
          checked={isSelected}
          onCheckedChange={() => onToggleSelect()}
          className="bg-charcoal-black/70 border-muted-gray"
        />
      </div>

      <CardContent className={cn('p-3', compact ? 'space-y-2' : 'space-y-3')}>
        {/* Avatar and Name */}
        <div className="flex items-center gap-3">
          <Avatar className={cn(compact ? 'h-10 w-10' : 'h-14 w-14')}>
            {application.headshot_url ? (
              <AvatarImage src={application.headshot_url} />
            ) : (
              <AvatarImage src={profile.avatar_url || undefined} />
            )}
            <AvatarFallback>{profile.name?.charAt(0) || '?'}</AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <p className={cn('font-medium truncate', compact ? 'text-sm' : 'text-base')}>
              {profile.name}
            </p>
            <p className="text-xs text-muted-foreground truncate">
              {profile.primary_role || profile.department || 'Unknown'}
            </p>
          </div>
        </div>

        {/* Rating */}
        <div className="flex items-center gap-0.5">
          {[1, 2, 3, 4, 5].map((star) => (
            <button
              key={star}
              onClick={() => onRating?.(application.id, star)}
              className="p-0.5 hover:scale-110 transition-transform"
            >
              {star <= (application.rating || 0) ? (
                <Star className="w-4 h-4 fill-amber-400 text-amber-400" />
              ) : (
                <StarOff className="w-4 h-4 text-muted-foreground" />
              )}
            </button>
          ))}
        </div>

        {/* Media Badges */}
        <div className="flex flex-wrap gap-1">
          {application.self_tape_url && (
            <Badge variant="secondary" className="text-xs bg-cyan-600/20 text-cyan-400">
              <Video className="w-3 h-3 mr-0.5" />
              Tape
            </Badge>
          )}
          {application.demo_reel_url && (
            <Badge variant="secondary" className="text-xs bg-purple-600/20 text-purple-400">
              <Film className="w-3 h-3 mr-0.5" />
              Reel
            </Badge>
          )}
          {application.tape_requested_at && !application.tape_submitted_at && (
            <Badge variant="secondary" className="text-xs bg-amber-600/20 text-amber-400">
              Requested
            </Badge>
          )}
        </div>

        {/* Quick Actions */}
        {!compact && (
          <div className="flex flex-wrap gap-1 pt-2">
            {application.self_tape_url && (
              <Button variant="outline" size="sm" className="h-7 text-xs" asChild>
                <a href={application.self_tape_url} target="_blank" rel="noopener noreferrer">
                  <Play className="w-3 h-3 mr-1" />
                  Tape
                </a>
              </Button>
            )}
            {application.demo_reel_url && (
              <Button variant="outline" size="sm" className="h-7 text-xs" asChild>
                <a href={application.demo_reel_url} target="_blank" rel="noopener noreferrer">
                  <Film className="w-3 h-3 mr-1" />
                  Reel
                </a>
              </Button>
            )}
            {canRequestTape && onRequestTape && (
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-xs"
                onClick={() => onRequestTape(application.id)}
                disabled={isRequestingTape}
              >
                <Video className="w-3 h-3 mr-1" />
                Request Tape
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// =============================================================================
// Comparison Column
// =============================================================================

interface ComparisonColumnProps {
  application: BacklotRoleApplication;
  onRating?: (id: string, rating: number) => void;
  onRequestTape?: (id: string) => void;
  isRequestingTape: boolean;
  canRequestTape: boolean;
}

function ComparisonColumn({
  application,
  onRating,
  onRequestTape,
  isRequestingTape,
  canRequestTape,
}: ComparisonColumnProps) {
  const profile = application.applicant_profile_snapshot;

  return (
    <div className="space-y-4 border rounded-lg p-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Avatar className="h-16 w-16">
          {application.headshot_url ? (
            <AvatarImage src={application.headshot_url} />
          ) : (
            <AvatarImage src={profile.avatar_url || undefined} />
          )}
          <AvatarFallback className="text-lg">{profile.name?.charAt(0) || '?'}</AvatarFallback>
        </Avatar>
        <div>
          <p className="font-semibold">{profile.name}</p>
          <p className="text-sm text-muted-foreground">
            {profile.primary_role || profile.department}
          </p>
          {profile.city && (
            <p className="text-xs text-muted-foreground">{profile.city}</p>
          )}
        </div>
      </div>

      {/* Rating */}
      <div className="flex items-center gap-1">
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            onClick={() => onRating?.(application.id, star)}
            className="p-0.5 hover:scale-110 transition-transform"
          >
            {star <= (application.rating || 0) ? (
              <Star className="w-5 h-5 fill-amber-400 text-amber-400" />
            ) : (
              <StarOff className="w-5 h-5 text-muted-foreground" />
            )}
          </button>
        ))}
      </div>

      {/* Videos */}
      <div className="space-y-3">
        {application.self_tape_url && (
          <div className="space-y-1">
            <p className="text-xs font-medium flex items-center gap-1">
              <Video className="w-3 h-3" />
              Self-Tape
            </p>
            <VideoPreview url={application.self_tape_url} label="Self-Tape" />
          </div>
        )}
        {application.demo_reel_url && (
          <div className="space-y-1">
            <p className="text-xs font-medium flex items-center gap-1">
              <Film className="w-3 h-3" />
              Demo Reel
            </p>
            <VideoPreview url={application.demo_reel_url} label="Demo Reel" />
          </div>
        )}
        {!application.self_tape_url && !application.demo_reel_url && (
          <div className="text-center py-4 text-sm text-muted-foreground border rounded-lg">
            No video materials
          </div>
        )}
      </div>

      {/* Headshot */}
      {application.headshot_url && (
        <div className="space-y-1">
          <p className="text-xs font-medium flex items-center gap-1">
            <ImageIcon className="w-3 h-3" />
            Headshot
          </p>
          <img
            src={application.headshot_url}
            alt={`${profile.name} headshot`}
            className="w-full aspect-[3/4] object-cover rounded-lg"
          />
        </div>
      )}

      {/* Special Skills */}
      {application.special_skills && application.special_skills.length > 0 && (
        <div className="space-y-1">
          <p className="text-xs font-medium">Special Skills</p>
          <div className="flex flex-wrap gap-1">
            {application.special_skills.map((skill, i) => (
              <Badge key={i} variant="secondary" className="text-xs">
                {skill}
              </Badge>
            ))}
          </div>
        </div>
      )}

      {/* Cover Note */}
      {application.cover_note && (
        <div className="space-y-1">
          <p className="text-xs font-medium flex items-center gap-1">
            <MessageSquare className="w-3 h-3" />
            Cover Note
          </p>
          <p className="text-sm text-muted-foreground line-clamp-3">
            {application.cover_note}
          </p>
        </div>
      )}

      {/* Actions */}
      <div className="flex flex-wrap gap-2 pt-2 border-t">
        {canRequestTape && onRequestTape && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => onRequestTape(application.id)}
            disabled={isRequestingTape}
          >
            <Video className="w-4 h-4 mr-1" />
            Request Tape
          </Button>
        )}
        <Button variant="outline" size="sm" asChild>
          <a href={`/backlot/people/${application.applicant_user_id}`} target="_blank">
            <ExternalLink className="w-4 h-4 mr-1" />
            Full Profile
          </a>
        </Button>
      </div>
    </div>
  );
}

export default ShortlistReviewView;
