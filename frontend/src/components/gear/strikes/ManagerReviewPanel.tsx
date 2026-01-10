/**
 * Manager Review Panel
 * Actions panel for reviewing escalated users
 */
import React, { useState } from 'react';
import { CheckCircle, Clock, Ban, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';

type ReviewDecision = 'approved' | 'probation' | 'suspended';

interface ManagerReviewPanelProps {
  userName: string;
  requiresReview: boolean;
  currentDecision?: ReviewDecision | null;
  onReview: (decision: ReviewDecision, notes?: string) => Promise<void>;
  isLoading?: boolean;
  className?: string;
}

export function ManagerReviewPanel({
  userName,
  requiresReview,
  currentDecision,
  onReview,
  isLoading,
  className,
}: ManagerReviewPanelProps) {
  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean;
    decision: ReviewDecision | null;
  }>({ open: false, decision: null });
  const [notes, setNotes] = useState('');

  const handleConfirm = async () => {
    if (!confirmDialog.decision) return;
    await onReview(confirmDialog.decision, notes || undefined);
    setConfirmDialog({ open: false, decision: null });
    setNotes('');
  };

  const decisions: {
    value: ReviewDecision;
    label: string;
    description: string;
    icon: React.ElementType;
    className: string;
  }[] = [
    {
      value: 'approved',
      label: 'Clear Escalation',
      description: 'Acknowledge and clear the escalation status',
      icon: CheckCircle,
      className: 'border-green-500/30 text-green-400 hover:bg-green-500/10',
    },
    {
      value: 'probation',
      label: 'Place on Probation',
      description: 'Allow continued access with monitoring',
      icon: Clock,
      className: 'border-orange-500/30 text-orange-400 hover:bg-orange-500/10',
    },
    {
      value: 'suspended',
      label: 'Suspend Access',
      description: 'Restrict user from checking out equipment',
      icon: Ban,
      className: 'border-red-500/30 text-red-400 hover:bg-red-500/10',
    },
  ];

  if (!requiresReview && !currentDecision) {
    return null;
  }

  return (
    <>
      <Card className={cn('bg-charcoal-black/50 border-muted-gray/30', className)}>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium text-bone-white">Manager Actions</CardTitle>
        </CardHeader>
        <CardContent>
          {requiresReview ? (
            <div className="space-y-3">
              <p className="text-sm text-muted-gray">
                This user has reached the escalation threshold and requires manager review.
              </p>
              <div className="flex flex-wrap gap-2">
                {decisions.map(({ value, label, icon: Icon, className: btnClass }) => (
                  <Button
                    key={value}
                    variant="outline"
                    size="sm"
                    disabled={isLoading}
                    className={cn('gap-2', btnClass)}
                    onClick={() => setConfirmDialog({ open: true, decision: value })}
                  >
                    {isLoading ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Icon className="w-4 h-4" />
                    )}
                    {label}
                  </Button>
                ))}
              </div>
            </div>
          ) : (
            <div className="text-sm text-muted-gray">
              Current status:{' '}
              <span
                className={cn(
                  'font-medium capitalize',
                  currentDecision === 'approved' && 'text-green-400',
                  currentDecision === 'probation' && 'text-orange-400',
                  currentDecision === 'suspended' && 'text-red-400'
                )}
              >
                {currentDecision}
              </span>
            </div>
          )}
        </CardContent>
      </Card>

      <AlertDialog
        open={confirmDialog.open}
        onOpenChange={(open) => !open && setConfirmDialog({ open: false, decision: null })}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Confirm{' '}
              {confirmDialog.decision === 'approved'
                ? 'Clear Escalation'
                : confirmDialog.decision === 'probation'
                  ? 'Probation'
                  : 'Suspension'}
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div>
                <p className="mb-4">
                  {confirmDialog.decision === 'approved' &&
                    `Clear the escalation status for ${userName}. They will still have their strikes on record.`}
                  {confirmDialog.decision === 'probation' &&
                    `Place ${userName} on probation. They can continue to check out equipment but will be monitored.`}
                  {confirmDialog.decision === 'suspended' &&
                    `Suspend ${userName}'s equipment checkout privileges. They will not be able to check out equipment until reinstated.`}
                </p>
                <Textarea
                  placeholder="Add notes (optional)"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="bg-charcoal-black/50 border-muted-gray/30"
                />
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirm}
              className={cn(
                confirmDialog.decision === 'approved' && 'bg-green-600 hover:bg-green-700',
                confirmDialog.decision === 'probation' && 'bg-orange-600 hover:bg-orange-700',
                confirmDialog.decision === 'suspended' && 'bg-red-600 hover:bg-red-700'
              )}
            >
              Confirm
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

export default ManagerReviewPanel;
