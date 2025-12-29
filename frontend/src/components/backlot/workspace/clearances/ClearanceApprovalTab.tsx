/**
 * ClearanceApprovalTab - Approval status and actions for a clearance
 * Shows approval workflow after document is signed
 */
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  CheckCircle,
  XCircle,
  AlertTriangle,
  Clock,
  Shield,
  Lock,
  Loader2,
  User,
  Calendar,
  MessageSquare,
} from 'lucide-react';
import {
  useClearanceApproval,
  useConfigureApproval,
  useApproveClearance,
  useRequestClearanceChanges,
  useRejectClearance,
  APPROVAL_STATUS_CONFIG,
} from '@/hooks/backlot/useClearanceApproval';
import { ClearanceApprovalStatus, BacklotClearanceItem } from '@/types/backlot';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';

interface ClearanceApprovalTabProps {
  clearance: BacklotClearanceItem;
  canApprove: boolean;
  onApprovalChange?: () => void;
}

type ActionType = 'approve' | 'request_changes' | 'reject' | null;

export function ClearanceApprovalTab({
  clearance,
  canApprove,
  onApprovalChange,
}: ClearanceApprovalTabProps) {
  const { data: approval, isLoading, error } = useClearanceApproval(clearance.id);
  const approveMutation = useApproveClearance();
  const requestChangesMutation = useRequestClearanceChanges();
  const rejectMutation = useRejectClearance();

  const [actionType, setActionType] = useState<ActionType>(null);
  const [notes, setNotes] = useState('');

  const isSigned = clearance.status === 'signed';
  const hasApproval = !!approval;
  const requiresApproval = approval?.requires_approval;
  const approvalStatus = approval?.approval_status || 'not_required';

  const handleAction = async () => {
    if (!actionType) return;

    try {
      switch (actionType) {
        case 'approve':
          await approveMutation.mutateAsync({
            clearanceId: clearance.id,
            notes: notes.trim() || undefined,
          });
          toast.success('Document approved');
          break;
        case 'request_changes':
          if (!notes.trim()) {
            toast.error('Please provide a reason for requesting changes');
            return;
          }
          await requestChangesMutation.mutateAsync({
            clearanceId: clearance.id,
            notes: notes.trim(),
          });
          toast.success('Changes requested');
          break;
        case 'reject':
          if (!notes.trim()) {
            toast.error('Please provide a reason for rejection');
            return;
          }
          await rejectMutation.mutateAsync({
            clearanceId: clearance.id,
            notes: notes.trim(),
          });
          toast.success('Document rejected');
          break;
      }

      setActionType(null);
      setNotes('');
      onApprovalChange?.();
    } catch (err) {
      toast.error('Failed to process approval action', {
        description: err instanceof Error ? err.message : 'Unknown error',
      });
    }
  };

  const isPending =
    approveMutation.isPending ||
    requestChangesMutation.isPending ||
    rejectMutation.isPending;

  if (isLoading) {
    return (
      <Card className="bg-charcoal-black border-muted-gray/30">
        <CardHeader>
          <Skeleton className="h-6 w-32" />
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-20" />
          <Skeleton className="h-12" />
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="bg-charcoal-black border-muted-gray/30">
        <CardContent className="py-6">
          <div className="flex items-center gap-2 text-red-400">
            <AlertTriangle className="h-5 w-5" />
            <span>Failed to load approval status</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Document not signed yet
  if (!isSigned) {
    return (
      <Card className="bg-charcoal-black border-muted-gray/30">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-bone-white">
            <Shield className="h-5 w-5 text-muted-foreground" />
            Approval
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-6 text-center">
            <Clock className="h-12 w-12 text-muted-foreground mb-3" />
            <p className="text-muted-foreground">
              Approval workflow will be available once the document is signed.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Approval not configured
  if (!requiresApproval) {
    return (
      <Card className="bg-charcoal-black border-muted-gray/30">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-bone-white">
            <Shield className="h-5 w-5 text-muted-foreground" />
            Approval
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-6 text-center">
            <CheckCircle className="h-12 w-12 text-green-500 mb-3" />
            <p className="font-medium text-bone-white">No Approval Required</p>
            <p className="text-sm text-muted-foreground mt-1">
              This document does not require additional approval after signing.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const statusConfig = APPROVAL_STATUS_CONFIG[approvalStatus];

  return (
    <Card className="bg-charcoal-black border-muted-gray/30">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-bone-white">
            <Shield className="h-5 w-5 text-primary-red" />
            Approval Status
          </CardTitle>
          <Badge variant="outline" className={cn('text-xs', statusConfig.bgColor, statusConfig.color)}>
            {statusConfig.label}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Status Info */}
        <div className="space-y-4">
          {approvalStatus === 'approved' && approval && (
            <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <CheckCircle className="h-5 w-5 text-green-400 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium text-green-400">Approved</p>
                  {approval.approved_at && (
                    <p className="text-sm text-muted-foreground mt-1">
                      <Calendar className="h-3 w-3 inline mr-1" />
                      {format(new Date(approval.approved_at), 'MMM d, yyyy h:mm a')}
                    </p>
                  )}
                  {approval.approved_by_name && (
                    <p className="text-sm text-muted-foreground">
                      <User className="h-3 w-3 inline mr-1" />
                      By {approval.approved_by_name}
                    </p>
                  )}
                  <div className="flex items-center gap-2 mt-2">
                    <Lock className="h-4 w-4 text-green-400" />
                    <span className="text-sm text-green-400">Document is now locked</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {approvalStatus === 'pending_approval' && (
            <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <Clock className="h-5 w-5 text-yellow-400 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium text-yellow-400">Awaiting Approval</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    This document has been signed and is waiting for review.
                  </p>
                </div>
              </div>
            </div>
          )}

          {approvalStatus === 'changes_requested' && approval && (
            <div className="bg-orange-500/10 border border-orange-500/30 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <AlertTriangle className="h-5 w-5 text-orange-400 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium text-orange-400">Changes Requested</p>
                  {approval.change_request_notes && (
                    <div className="mt-2 p-3 bg-black/30 rounded text-sm">
                      <MessageSquare className="h-3 w-3 inline mr-1 text-muted-foreground" />
                      {approval.change_request_notes}
                    </div>
                  )}
                  <p className="text-sm text-muted-foreground mt-2">
                    The signer needs to address the feedback and re-sign.
                  </p>
                </div>
              </div>
            </div>
          )}

          {approvalStatus === 'rejected' && approval && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <XCircle className="h-5 w-5 text-red-400 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium text-red-400">Rejected</p>
                  {approval.change_request_notes && (
                    <div className="mt-2 p-3 bg-black/30 rounded text-sm">
                      <MessageSquare className="h-3 w-3 inline mr-1 text-muted-foreground" />
                      {approval.change_request_notes}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Approval Actions */}
        {canApprove && approvalStatus === 'pending_approval' && (
          <div className="space-y-4 pt-4 border-t border-muted-gray/20">
            <p className="text-sm font-medium text-bone-white">Approval Actions</p>
            <div className="flex flex-wrap gap-2">
              <Button
                onClick={() => setActionType('approve')}
                className="bg-green-600 hover:bg-green-700"
              >
                <CheckCircle className="h-4 w-4 mr-2" />
                Approve
              </Button>
              <Button
                variant="outline"
                onClick={() => setActionType('request_changes')}
                className="border-orange-500/50 text-orange-400 hover:bg-orange-500/10"
              >
                <AlertTriangle className="h-4 w-4 mr-2" />
                Request Changes
              </Button>
              <Button
                variant="outline"
                onClick={() => setActionType('reject')}
                className="border-red-500/50 text-red-400 hover:bg-red-500/10"
              >
                <XCircle className="h-4 w-4 mr-2" />
                Reject
              </Button>
            </div>
          </div>
        )}
      </CardContent>

      {/* Action Dialog */}
      <AlertDialog open={!!actionType} onOpenChange={() => setActionType(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {actionType === 'approve' && 'Approve Document'}
              {actionType === 'request_changes' && 'Request Changes'}
              {actionType === 'reject' && 'Reject Document'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {actionType === 'approve' &&
                'This will approve the document and lock it from further changes.'}
              {actionType === 'request_changes' &&
                'The signer will be notified to review and re-sign the document.'}
              {actionType === 'reject' &&
                'This will permanently reject the document.'}
            </AlertDialogDescription>
          </AlertDialogHeader>

          <div className="py-4">
            <Label htmlFor="notes">
              {actionType === 'approve' ? 'Notes (optional)' : 'Reason (required)'}
            </Label>
            <Textarea
              id="notes"
              placeholder={
                actionType === 'approve'
                  ? 'Add any notes about this approval...'
                  : 'Explain why changes are needed or why the document is being rejected...'
              }
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              className="mt-2"
            />
          </div>

          <AlertDialogFooter>
            <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleAction}
              disabled={isPending || (actionType !== 'approve' && !notes.trim())}
              className={cn(
                actionType === 'approve' && 'bg-green-600 hover:bg-green-700',
                actionType === 'request_changes' && 'bg-orange-600 hover:bg-orange-700',
                actionType === 'reject' && 'bg-red-600 hover:bg-red-700'
              )}
            >
              {isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {actionType === 'approve' && 'Approve'}
              {actionType === 'request_changes' && 'Request Changes'}
              {actionType === 'reject' && 'Reject'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
