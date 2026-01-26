/**
 * MessageReportDetailDialog
 * Dialog for viewing report details and taking moderation actions
 */

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import {
  User,
  Loader2,
  Flag,
  MessageSquare,
  Clock,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Ban,
  ShieldAlert,
  FileWarning,
} from 'lucide-react';
import {
  MessageReportDetail,
  useAdminResolveReport,
  useAdminDismissReport,
  useAdminUpdateReport,
} from '@/hooks/useMessageSettings';
import { useToast } from '@/hooks/use-toast';
import { format, formatDistanceToNow } from 'date-fns';

interface MessageReportDetailDialogProps {
  isOpen: boolean;
  onClose: () => void;
  report: MessageReportDetail;
}

type ResolutionAction = 'warning_issued' | 'user_blocked' | 'no_action' | 'content_removed';

const RESOLUTION_ACTIONS: { value: ResolutionAction; label: string; description: string; icon: React.ReactNode }[] = [
  {
    value: 'no_action',
    label: 'No Action Needed',
    description: 'The reported content does not violate guidelines',
    icon: <CheckCircle className="h-4 w-4 text-green-500" />,
  },
  {
    value: 'warning_issued',
    label: 'Issue Warning',
    description: 'Send a warning to the user about their behavior',
    icon: <AlertTriangle className="h-4 w-4 text-yellow-500" />,
  },
  {
    value: 'content_removed',
    label: 'Remove Content',
    description: 'Delete the offending message',
    icon: <FileWarning className="h-4 w-4 text-orange-500" />,
  },
  {
    value: 'user_blocked',
    label: 'Block User',
    description: 'Block the user from messaging the reporter',
    icon: <Ban className="h-4 w-4 text-red-500" />,
  },
];

export function MessageReportDetailDialog({
  isOpen,
  onClose,
  report,
}: MessageReportDetailDialogProps) {
  const [selectedAction, setSelectedAction] = useState<ResolutionAction | null>(null);
  const [resolutionNotes, setResolutionNotes] = useState('');

  const resolveReport = useAdminResolveReport();
  const dismissReport = useAdminDismissReport();
  const updateReport = useAdminUpdateReport();
  const { toast } = useToast();

  const handleResolve = async () => {
    if (!selectedAction) return;

    try {
      await resolveReport.mutateAsync({
        reportId: report.id,
        resolution_action: selectedAction,
        resolution_notes: resolutionNotes.trim() || undefined,
      });

      toast({
        title: 'Report resolved',
        description: 'The report has been resolved with the selected action.',
      });

      onClose();
    } catch (error: any) {
      toast({
        title: 'Failed to resolve report',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  const handleDismiss = async () => {
    try {
      await dismissReport.mutateAsync({
        reportId: report.id,
        notes: resolutionNotes.trim() || 'Dismissed by admin',
      });

      toast({
        title: 'Report dismissed',
        description: 'The report has been dismissed.',
      });

      onClose();
    } catch (error: any) {
      toast({
        title: 'Failed to dismiss report',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  const handleMarkReviewing = async () => {
    try {
      await updateReport.mutateAsync({
        reportId: report.id,
        update: { status: 'reviewing' },
      });

      toast({
        title: 'Status updated',
        description: 'Report marked as under review.',
      });
    } catch (error: any) {
      toast({
        title: 'Failed to update status',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  const getReasonBadge = (reason: string) => {
    switch (reason) {
      case 'spam':
        return <Badge className="bg-orange-600">Spam</Badge>;
      case 'harassment':
        return <Badge className="bg-red-600">Harassment</Badge>;
      case 'inappropriate':
        return <Badge className="bg-purple-600">Inappropriate</Badge>;
      case 'other':
        return <Badge className="bg-gray-600">Other</Badge>;
      default:
        return <Badge>{reason}</Badge>;
    }
  };

  const isResolved = report.status === 'resolved' || report.status === 'dismissed';
  const isPending = report.status === 'pending' || report.status === 'reviewing';

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[600px] bg-charcoal-black border-muted-gray text-bone-white max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Flag className="h-5 w-5 text-red-500" />
            Report Details
          </DialogTitle>
          <DialogDescription className="text-muted-gray">
            Review the report and take appropriate action
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Status and meta info */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {getReasonBadge(report.reason)}
              <Badge variant="outline" className={
                report.status === 'pending' ? 'text-yellow-500 border-yellow-500' :
                report.status === 'reviewing' ? 'text-blue-500 border-blue-500' :
                report.status === 'resolved' ? 'text-green-500 border-green-500' :
                'text-gray-500 border-gray-500'
              }>
                {report.status.charAt(0).toUpperCase() + report.status.slice(1)}
              </Badge>
            </div>
            <div className="text-xs text-muted-foreground flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {formatDistanceToNow(new Date(report.created_at), { addSuffix: true })}
            </div>
          </div>

          {/* Reporter info */}
          <div className="p-4 rounded-lg bg-muted-gray/10 border border-muted-gray/30">
            <p className="text-xs text-muted-foreground mb-2">Reported by</p>
            <div className="flex items-center gap-3">
              <Avatar className="h-10 w-10">
                <AvatarImage src={report.reporter_avatar} alt={report.reporter_name} />
                <AvatarFallback>
                  {report.reporter_name?.[0] || <User className="h-4 w-4" />}
                </AvatarFallback>
              </Avatar>
              <div>
                <p className="font-medium">{report.reporter_name || 'Unknown User'}</p>
                <p className="text-xs text-muted-foreground">ID: {report.reporter_id}</p>
              </div>
            </div>
          </div>

          {/* Reported user info */}
          <div className="p-4 rounded-lg bg-red-900/10 border border-red-700/30">
            <p className="text-xs text-muted-foreground mb-2">Reported user</p>
            <div className="flex items-center gap-3">
              <Avatar className="h-10 w-10">
                <AvatarImage src={report.message_sender_avatar} alt={report.message_sender_name} />
                <AvatarFallback>
                  {report.message_sender_name?.[0] || <User className="h-4 w-4" />}
                </AvatarFallback>
              </Avatar>
              <div>
                <p className="font-medium">{report.message_sender_name || 'Unknown User'}</p>
                <p className="text-xs text-muted-foreground">ID: {report.message_sender_id}</p>
              </div>
            </div>
          </div>

          {/* Reported message */}
          <div className="space-y-2">
            <Label className="text-muted-foreground flex items-center gap-1">
              <MessageSquare className="h-4 w-4" />
              Reported Message
            </Label>
            <div className="p-4 rounded-lg bg-muted-gray/20 border border-muted-gray/30">
              <p className="text-sm whitespace-pre-wrap">
                {report.message_content || '[No content available]'}
              </p>
            </div>
          </div>

          {/* Reporter's description */}
          {report.description && (
            <div className="space-y-2">
              <Label className="text-muted-foreground">Reporter's description</Label>
              <div className="p-4 rounded-lg bg-muted-gray/10 border border-muted-gray/30">
                <p className="text-sm">{report.description}</p>
              </div>
            </div>
          )}

          {/* Resolution info if already resolved */}
          {isResolved && (
            <div className="p-4 rounded-lg bg-green-900/10 border border-green-700/30">
              <p className="text-xs text-green-400 mb-2">Resolution</p>
              <p className="font-medium">
                {report.resolution_action?.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
              </p>
              {report.resolution_notes && (
                <p className="text-sm text-muted-foreground mt-2">{report.resolution_notes}</p>
              )}
              {report.reviewer_name && (
                <p className="text-xs text-muted-foreground mt-2">
                  Reviewed by {report.reviewer_name} • {format(new Date(report.updated_at), 'PPp')}
                </p>
              )}
            </div>
          )}

          {/* Action selection (only for pending/reviewing) */}
          {isPending && (
            <>
              <Separator className="bg-muted-gray/30" />

              <div className="space-y-3">
                <Label>Take Action</Label>
                <div className="grid gap-2">
                  {RESOLUTION_ACTIONS.map((action) => (
                    <button
                      key={action.value}
                      onClick={() => setSelectedAction(action.value)}
                      className={`flex items-start gap-3 p-3 rounded-lg border transition-colors text-left ${
                        selectedAction === action.value
                          ? 'bg-accent-yellow/20 border-accent-yellow'
                          : 'bg-muted-gray/10 border-muted-gray/30 hover:bg-muted-gray/20'
                      }`}
                    >
                      <div className="mt-0.5">{action.icon}</div>
                      <div>
                        <p className="font-medium">{action.label}</p>
                        <p className="text-xs text-muted-foreground">{action.description}</p>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Resolution notes */}
              <div className="space-y-2">
                <Label htmlFor="notes">Resolution Notes (optional)</Label>
                <Textarea
                  id="notes"
                  value={resolutionNotes}
                  onChange={(e) => setResolutionNotes(e.target.value)}
                  placeholder="Add any notes about your decision..."
                  className="bg-muted-gray/20 border-muted-gray resize-none"
                  rows={3}
                />
              </div>
            </>
          )}
        </div>

        <DialogFooter className="gap-2 flex-wrap">
          {isPending && report.status === 'pending' && (
            <Button
              variant="outline"
              onClick={handleMarkReviewing}
              disabled={updateReport.isPending}
              className="mr-auto"
            >
              {updateReport.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                'Mark as Reviewing'
              )}
            </Button>
          )}

          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>

          {isPending && (
            <>
              <Button
                variant="outline"
                onClick={handleDismiss}
                disabled={dismissReport.isPending || resolveReport.isPending}
              >
                {dismissReport.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <>
                    <XCircle className="h-4 w-4 mr-2" />
                    Dismiss
                  </>
                )}
              </Button>

              <Button
                onClick={handleResolve}
                disabled={!selectedAction || resolveReport.isPending || dismissReport.isPending}
              >
                {resolveReport.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <>
                    <CheckCircle className="h-4 w-4 mr-2" />
                    Resolve
                  </>
                )}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
