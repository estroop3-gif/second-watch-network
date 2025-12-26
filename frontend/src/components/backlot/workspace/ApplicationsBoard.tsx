/**
 * ApplicationsBoard - Kanban-style board for managing role applications
 */

import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/hooks/use-toast';
import {
  useRoleApplications,
  useUpdateApplicationStatus,
  useProjectRoleMutations,
  useDealMemos,
  useDealMemoMutations,
} from '@/hooks/backlot';
import { DealMemoDialog } from './DealMemoDialog';
import { DealMemoStatusBadge } from './DealMemoStatus';
import { CreditPreferencesForm } from './CreditPreferencesForm';
import {
  BacklotProjectRole,
  BacklotRoleApplication,
  BacklotApplicationStatus,
  APPLICATION_STATUS_LABELS,
  APPLICATION_STATUS_COLORS,
  DealMemo,
} from '@/types/backlot';
import {
  MoreVertical,
  Star,
  StarOff,
  UserCheck,
  X,
  ExternalLink,
  MessageSquare,
  Calendar,
  MapPin,
  Briefcase,
  Clock,
  Shield,
  ChevronRight,
  ChevronDown,
  Loader2,
  FileSignature,
  Award,
} from 'lucide-react';
import { format } from 'date-fns';

interface ApplicationsBoardProps {
  projectId: string;
  role: BacklotProjectRole;
  onClose: () => void;
}

// Board columns configuration
const BOARD_COLUMNS: { key: BacklotApplicationStatus; label: string; color: string }[] = [
  { key: 'applied', label: 'Applied', color: 'bg-gray-100' },
  { key: 'shortlisted', label: 'Shortlisted', color: 'bg-yellow-100' },
  { key: 'interview', label: 'Interview', color: 'bg-purple-100' },
  { key: 'offered', label: 'Offered', color: 'bg-cyan-100' },
  { key: 'booked', label: 'Booked', color: 'bg-green-100' },
  { key: 'rejected', label: 'Rejected', color: 'bg-red-100' },
];

export function ApplicationsBoard({ projectId, role, onClose }: ApplicationsBoardProps) {
  const { toast } = useToast();
  const { data, isLoading, refetch } = useRoleApplications(role.id);
  const updateStatus = useUpdateApplicationStatus();
  const { bookRole } = useProjectRoleMutations(projectId);
  const { dealMemos } = useDealMemos(projectId);
  const { createDealMemo, createRateFromDealMemo } = useDealMemoMutations(projectId);

  const [selectedApplication, setSelectedApplication] = useState<BacklotRoleApplication | null>(
    null
  );
  const [expandedColumn, setExpandedColumn] = useState<string | null>(null);

  // Deal memo dialog state
  const [dealMemoDialogOpen, setDealMemoDialogOpen] = useState(false);
  const [dealMemoApplication, setDealMemoApplication] = useState<BacklotRoleApplication | null>(null);

  // Credit preferences dialog state
  const [creditPrefsOpen, setCreditPrefsOpen] = useState(false);
  const [creditPrefsApplication, setCreditPrefsApplication] = useState<BacklotRoleApplication | null>(null);

  // Get deal memo for an application (by user_id and role_id)
  const getDealMemoForApplication = (app: BacklotRoleApplication): DealMemo | undefined => {
    return dealMemos.find(
      (dm) => dm.user_id === app.applicant_user_id && dm.role_id === role.id
    );
  };

  const handleStatusChange = async (
    application: BacklotRoleApplication,
    newStatus: BacklotApplicationStatus
  ) => {
    try {
      await updateStatus.mutateAsync({
        applicationId: application.id,
        input: { status: newStatus },
      });
      toast({
        title: 'Status updated',
        description: `Application moved to ${APPLICATION_STATUS_LABELS[newStatus]}`,
      });
      refetch();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to update status',
        variant: 'destructive',
      });
    }
  };

  const handleBook = async (application: BacklotRoleApplication) => {
    try {
      await bookRole.mutateAsync({
        roleId: role.id,
        userId: application.applicant_user_id,
      });
      toast({
        title: 'Role booked',
        description: `${application.applicant_profile_snapshot.name} has been booked for this role`,
      });
      refetch();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to book role',
        variant: 'destructive',
      });
    }
  };

  const handleRating = async (application: BacklotRoleApplication, rating: number) => {
    try {
      await updateStatus.mutateAsync({
        applicationId: application.id,
        input: { status: application.status, rating },
      });
      refetch();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to update rating',
        variant: 'destructive',
      });
    }
  };

  // Open deal memo dialog for an application
  const handleOpenDealMemo = (application: BacklotRoleApplication) => {
    setDealMemoApplication(application);
    setDealMemoDialogOpen(true);
  };

  // Handle deal memo creation success
  const handleDealMemoSuccess = async () => {
    setDealMemoDialogOpen(false);
    setDealMemoApplication(null);
    toast({
      title: 'Deal Memo Created',
      description: 'The deal memo has been saved. You can send it for signature.',
    });
  };

  // Open credit preferences dialog
  const handleOpenCreditPrefs = (application: BacklotRoleApplication) => {
    setCreditPrefsApplication(application);
    setCreditPrefsOpen(true);
  };

  // Book with credit preferences
  const handleBookWithCredits = async (application: BacklotRoleApplication) => {
    // First book the role
    await handleBook(application);
    // Then offer to set credit preferences
    handleOpenCreditPrefs(application);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const applicationsByStatus = data?.applicationsByStatus || {};

  return (
    <div className="space-y-4">
      {/* Board View */}
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {BOARD_COLUMNS.map((column) => {
          const applications = applicationsByStatus[column.key] || [];
          const isExpanded = expandedColumn === column.key;

          return (
            <div key={column.key} className="space-y-2">
              <div
                className={`px-3 py-2 rounded-lg ${column.color} flex items-center justify-between cursor-pointer md:cursor-default`}
                onClick={() =>
                  setExpandedColumn(isExpanded ? null : column.key)
                }
              >
                <div className="flex items-center gap-2">
                  <span className="font-medium text-sm">{column.label}</span>
                  <Badge variant="secondary" className="text-xs">
                    {applications.length}
                  </Badge>
                </div>
                <ChevronDown
                  className={`w-4 h-4 md:hidden transition-transform ${
                    isExpanded ? 'rotate-180' : ''
                  }`}
                />
              </div>

              <ScrollArea className={`${isExpanded ? 'block' : 'hidden md:block'}`}>
                <div className="space-y-2 max-h-[400px] pr-2">
                  {applications.length === 0 ? (
                    <div className="text-center py-4 text-sm text-muted-foreground">
                      No applications
                    </div>
                  ) : (
                    applications.map((app) => (
                      <ApplicationCard
                        key={app.id}
                        application={app}
                        currentStatus={column.key}
                        dealMemo={getDealMemoForApplication(app)}
                        onStatusChange={(newStatus) => handleStatusChange(app, newStatus)}
                        onBook={() => handleBook(app)}
                        onRating={(rating) => handleRating(app, rating)}
                        onViewDetails={() => setSelectedApplication(app)}
                        onSendDealMemo={() => handleOpenDealMemo(app)}
                        isBookingPending={bookRole.isPending}
                      />
                    ))
                  )}
                </div>
              </ScrollArea>
            </div>
          );
        })}
      </div>

      {/* Application Detail Dialog */}
      <Dialog
        open={!!selectedApplication}
        onOpenChange={(open) => {
          if (!open) setSelectedApplication(null);
        }}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Application Details</DialogTitle>
            <DialogDescription>
              Review this applicant's information
            </DialogDescription>
          </DialogHeader>
          {selectedApplication && (
            <ApplicationDetails
              application={selectedApplication}
              dealMemo={getDealMemoForApplication(selectedApplication)}
              onStatusChange={(newStatus) => {
                handleStatusChange(selectedApplication, newStatus);
                setSelectedApplication(null);
              }}
              onBook={() => {
                handleBook(selectedApplication);
                setSelectedApplication(null);
              }}
              onSendDealMemo={() => {
                setSelectedApplication(null);
                handleOpenDealMemo(selectedApplication);
              }}
              onSetCreditPrefs={() => {
                setSelectedApplication(null);
                handleOpenCreditPrefs(selectedApplication);
              }}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Deal Memo Dialog */}
      {dealMemoApplication && (
        <DealMemoDialog
          open={dealMemoDialogOpen}
          onOpenChange={(open) => {
            setDealMemoDialogOpen(open);
            if (!open) setDealMemoApplication(null);
          }}
          projectId={projectId}
          roleId={role.id}
          userId={dealMemoApplication.applicant_user_id}
          userName={dealMemoApplication.applicant_profile_snapshot.name}
          roleName={role.title}
          onSuccess={handleDealMemoSuccess}
        />
      )}

      {/* Credit Preferences Dialog */}
      {creditPrefsApplication && (
        <CreditPreferencesForm
          open={creditPrefsOpen}
          onOpenChange={(open) => {
            setCreditPrefsOpen(open);
            if (!open) setCreditPrefsApplication(null);
          }}
          userId={creditPrefsApplication.applicant_user_id}
          projectId={projectId}
          roleId={role.id}
          roleName={role.title}
          onSuccess={() => {
            setCreditPrefsOpen(false);
            setCreditPrefsApplication(null);
          }}
        />
      )}
    </div>
  );
}

// =============================================================================
// Application Card Component
// =============================================================================

interface ApplicationCardProps {
  application: BacklotRoleApplication;
  currentStatus: BacklotApplicationStatus;
  dealMemo?: DealMemo;
  onStatusChange: (status: BacklotApplicationStatus) => void;
  onBook: () => void;
  onRating: (rating: number) => void;
  onViewDetails: () => void;
  onSendDealMemo: () => void;
  isBookingPending: boolean;
}

function ApplicationCard({
  application,
  currentStatus,
  dealMemo,
  onStatusChange,
  onBook,
  onRating,
  onViewDetails,
  onSendDealMemo,
  isBookingPending,
}: ApplicationCardProps) {
  const profile = application.applicant_profile_snapshot;

  return (
    <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={onViewDetails}>
      <CardContent className="p-3">
        <div className="flex items-start gap-2">
          <Avatar className="h-8 w-8">
            <AvatarImage src={profile.avatar_url || undefined} />
            <AvatarFallback className="text-xs">
              {profile.name?.charAt(0) || '?'}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1">
              <p className="font-medium text-sm truncate">{profile.name}</p>
              {profile.is_order_member && (
                <Shield className="w-3 h-3 text-amber-500" title="Order Member" />
              )}
            </div>
            <p className="text-xs text-muted-foreground truncate">
              {profile.primary_role || profile.department || 'Unknown'}
            </p>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
              <Button variant="ghost" size="icon" className="h-6 w-6">
                <MoreVertical className="w-3 h-3" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {currentStatus !== 'shortlisted' && (
                <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onStatusChange('shortlisted'); }}>
                  <Star className="w-4 h-4 mr-2" />
                  Shortlist
                </DropdownMenuItem>
              )}
              {currentStatus !== 'interview' && (
                <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onStatusChange('interview'); }}>
                  <Calendar className="w-4 h-4 mr-2" />
                  Schedule Interview
                </DropdownMenuItem>
              )}
              {currentStatus !== 'offered' && (
                <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onStatusChange('offered'); }}>
                  <Briefcase className="w-4 h-4 mr-2" />
                  Make Offer
                </DropdownMenuItem>
              )}
              {!dealMemo && (currentStatus === 'offered' || currentStatus === 'interview' || currentStatus === 'shortlisted') && (
                <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onSendDealMemo(); }}>
                  <FileSignature className="w-4 h-4 mr-2" />
                  Create Deal Memo
                </DropdownMenuItem>
              )}
              {currentStatus !== 'booked' && (
                <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onBook(); }} disabled={isBookingPending}>
                  <UserCheck className="w-4 h-4 mr-2" />
                  Book Now
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
              {currentStatus !== 'rejected' && (
                <DropdownMenuItem
                  onClick={(e) => { e.stopPropagation(); onStatusChange('rejected'); }}
                  className="text-red-600"
                >
                  <X className="w-4 h-4 mr-2" />
                  Reject
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Rating Stars & Deal Memo Status */}
        <div className="flex items-center justify-between mt-2">
          <div className="flex items-center gap-0.5" onClick={(e) => e.stopPropagation()}>
            {[1, 2, 3, 4, 5].map((star) => (
              <button
                key={star}
                onClick={() => onRating(star)}
                className="p-0.5 hover:scale-110 transition-transform"
              >
                {star <= (application.rating || 0) ? (
                  <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                ) : (
                  <StarOff className="w-3 h-3 text-gray-300" />
                )}
              </button>
            ))}
          </div>
          {dealMemo && (
            <DealMemoStatusBadge status={dealMemo.status} className="text-[10px] px-1.5 py-0" />
          )}
        </div>

        {/* Quick Info */}
        <div className="flex flex-wrap gap-1 mt-2 text-xs text-muted-foreground">
          {profile.city && (
            <span className="flex items-center gap-0.5">
              <MapPin className="w-3 h-3" />
              {profile.city}
            </span>
          )}
          {profile.years_experience && (
            <span className="flex items-center gap-0.5">
              <Clock className="w-3 h-3" />
              {profile.years_experience}yr exp
            </span>
          )}
        </div>

        {/* Cover Note Preview */}
        {application.cover_note && (
          <p className="text-xs text-muted-foreground mt-2 line-clamp-2">
            {application.cover_note}
          </p>
        )}

        <p className="text-xs text-muted-foreground mt-2">
          Applied {format(new Date(application.created_at), 'MMM d, yyyy')}
        </p>
      </CardContent>
    </Card>
  );
}

// =============================================================================
// Application Details Component
// =============================================================================

interface ApplicationDetailsProps {
  application: BacklotRoleApplication;
  dealMemo?: DealMemo;
  onStatusChange: (status: BacklotApplicationStatus) => void;
  onBook: () => void;
  onSendDealMemo: () => void;
  onSetCreditPrefs: () => void;
}

function ApplicationDetails({
  application,
  dealMemo,
  onStatusChange,
  onBook,
  onSendDealMemo,
  onSetCreditPrefs,
}: ApplicationDetailsProps) {
  const profile = application.applicant_profile_snapshot;

  return (
    <div className="space-y-4">
      {/* Profile Header */}
      <div className="flex items-center gap-4">
        <Avatar className="h-16 w-16">
          <AvatarImage src={profile.avatar_url || undefined} />
          <AvatarFallback>{profile.name?.charAt(0) || '?'}</AvatarFallback>
        </Avatar>
        <div>
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-lg">{profile.name}</h3>
            {profile.is_order_member && (
              <Badge variant="secondary" className="gap-1">
                <Shield className="w-3 h-3" />
                Order Member
              </Badge>
            )}
          </div>
          <p className="text-muted-foreground">
            {profile.primary_role || profile.department || 'Unknown Role'}
          </p>
          <div className="flex items-center gap-3 mt-1 text-sm text-muted-foreground">
            {profile.city && (
              <span className="flex items-center gap-1">
                <MapPin className="w-4 h-4" />
                {profile.city}
              </span>
            )}
            {profile.years_experience && (
              <span className="flex items-center gap-1">
                <Clock className="w-4 h-4" />
                {profile.years_experience} years exp
              </span>
            )}
            {profile.credits_count !== undefined && profile.credits_count > 0 && (
              <span className="flex items-center gap-1">
                <Briefcase className="w-4 h-4" />
                {profile.credits_count} credits
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Links */}
      <div className="flex flex-wrap gap-2">
        {profile.portfolio_url && (
          <Button variant="outline" size="sm" asChild>
            <a href={profile.portfolio_url} target="_blank" rel="noopener noreferrer">
              <ExternalLink className="w-4 h-4 mr-1" />
              Portfolio
            </a>
          </Button>
        )}
        {profile.reel_url && (
          <Button variant="outline" size="sm" asChild>
            <a href={profile.reel_url} target="_blank" rel="noopener noreferrer">
              <ExternalLink className="w-4 h-4 mr-1" />
              Demo Reel
            </a>
          </Button>
        )}
        {application.resume_url && (
          <Button variant="outline" size="sm" asChild>
            <a href={application.resume_url} target="_blank" rel="noopener noreferrer">
              <ExternalLink className="w-4 h-4 mr-1" />
              Resume
            </a>
          </Button>
        )}
      </div>

      {/* Cover Note */}
      {application.cover_note && (
        <div className="space-y-1">
          <h4 className="font-medium text-sm flex items-center gap-1">
            <MessageSquare className="w-4 h-4" />
            Cover Note
          </h4>
          <p className="text-sm text-muted-foreground whitespace-pre-wrap">
            {application.cover_note}
          </p>
        </div>
      )}

      {/* Availability Notes */}
      {application.availability_notes && (
        <div className="space-y-1">
          <h4 className="font-medium text-sm flex items-center gap-1">
            <Calendar className="w-4 h-4" />
            Availability Notes
          </h4>
          <p className="text-sm text-muted-foreground">
            {application.availability_notes}
          </p>
        </div>
      )}

      {/* Internal Notes */}
      {application.internal_notes && (
        <div className="space-y-1 p-3 bg-muted rounded-lg">
          <h4 className="font-medium text-sm">Internal Notes</h4>
          <p className="text-sm">{application.internal_notes}</p>
        </div>
      )}

      {/* Deal Memo Status */}
      {dealMemo && (
        <div className="p-3 bg-muted/50 rounded-lg border">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FileSignature className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm font-medium">Deal Memo</span>
            </div>
            <DealMemoStatusBadge status={dealMemo.status} />
          </div>
          <div className="mt-2 text-sm text-muted-foreground">
            <span>
              {dealMemo.rate_amount.toLocaleString('en-US', { style: 'currency', currency: 'USD' })}
              /{dealMemo.rate_type}
            </span>
            {dealMemo.start_date && (
              <span className="ml-2">
                Starting {new Date(dealMemo.start_date).toLocaleDateString()}
              </span>
            )}
          </div>
        </div>
      )}

      {/* Current Status */}
      <div className="flex items-center gap-2 pt-2 border-t">
        <span className="text-sm text-muted-foreground">Current Status:</span>
        <Badge className={`bg-${APPLICATION_STATUS_COLORS[application.status]}-100 text-${APPLICATION_STATUS_COLORS[application.status]}-800`}>
          {APPLICATION_STATUS_LABELS[application.status]}
        </Badge>
      </div>

      {/* Actions */}
      <div className="flex flex-wrap gap-2 pt-2">
        {application.status !== 'shortlisted' && (
          <Button variant="outline" size="sm" onClick={() => onStatusChange('shortlisted')}>
            <Star className="w-4 h-4 mr-1" />
            Shortlist
          </Button>
        )}
        {application.status !== 'interview' && (
          <Button variant="outline" size="sm" onClick={() => onStatusChange('interview')}>
            <Calendar className="w-4 h-4 mr-1" />
            Interview
          </Button>
        )}
        {application.status !== 'offered' && (
          <Button variant="outline" size="sm" onClick={() => onStatusChange('offered')}>
            <Briefcase className="w-4 h-4 mr-1" />
            Offer
          </Button>
        )}
        {!dealMemo && (application.status === 'offered' || application.status === 'interview' || application.status === 'shortlisted') && (
          <Button variant="outline" size="sm" onClick={onSendDealMemo}>
            <FileSignature className="w-4 h-4 mr-1" />
            Deal Memo
          </Button>
        )}
        {application.status !== 'booked' && (
          <Button size="sm" onClick={onBook}>
            <UserCheck className="w-4 h-4 mr-1" />
            Book Now
          </Button>
        )}
        {application.status === 'booked' && (
          <Button variant="outline" size="sm" onClick={onSetCreditPrefs}>
            <Award className="w-4 h-4 mr-1" />
            Credit Preferences
          </Button>
        )}
        {application.status !== 'rejected' && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => onStatusChange('rejected')}
            className="text-red-600 hover:text-red-700"
          >
            <X className="w-4 h-4 mr-1" />
            Reject
          </Button>
        )}
      </div>
    </div>
  );
}
