import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
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
import { X, CheckCircle, XCircle, Clock, Archive, Eye, Loader2 } from 'lucide-react';
import { api } from '@/lib/api';

interface SubmissionBulkActionsBarProps {
  selectedIds: string[];
  submissionType: 'content' | 'greenroom';
  onClearSelection: () => void;
}

export const SubmissionBulkActionsBar = ({
  selectedIds,
  submissionType,
  onClearSelection,
}: SubmissionBulkActionsBarProps) => {
  const queryClient = useQueryClient();
  const [confirmAction, setConfirmAction] = useState<{
    action: string;
    title: string;
    description: string;
  } | null>(null);

  const bulkMutation = useMutation({
    mutationFn: ({ action }: { action: string }) =>
      api.bulkSubmissionAction(selectedIds, action, submissionType, false),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['adminSubmissions'] });
      queryClient.invalidateQueries({ queryKey: ['adminGreenRoom'] });
      queryClient.invalidateQueries({ queryKey: ['admin-submission-stats'] });
      toast.success(result.message);
      onClearSelection();
      setConfirmAction(null);
    },
    onError: (err: any) => {
      toast.error(err.message || 'Bulk action failed');
    },
  });

  const handleAction = (action: string) => {
    const count = selectedIds.length;
    const typeLabel = submissionType === 'content' ? 'submissions' : 'projects';

    const actionConfigs: Record<string, { title: string; description: string }> = {
      approve: {
        title: `Approve ${count} ${typeLabel}?`,
        description: `This will approve ${count} selected ${typeLabel}.`,
      },
      reject: {
        title: `Reject ${count} ${typeLabel}?`,
        description: `This will reject ${count} selected ${typeLabel}.`,
      },
      in_review: {
        title: `Mark ${count} ${typeLabel} as In Review?`,
        description: `This will move ${count} ${typeLabel} to the review queue.`,
      },
      archive: {
        title: `Archive ${count} ${typeLabel}?`,
        description: `This will archive ${count} selected ${typeLabel}.`,
      },
      considered: {
        title: `Mark ${count} ${typeLabel} as Considered?`,
        description: `This will mark ${count} ${typeLabel} as being considered.`,
      },
    };

    const config = actionConfigs[action];
    if (config) {
      setConfirmAction({ action, ...config });
    }
  };

  const executeAction = () => {
    if (confirmAction) {
      bulkMutation.mutate({ action: confirmAction.action });
    }
  };

  if (selectedIds.length === 0) return null;

  return (
    <>
      <AnimatePresence>
        <motion.div
          initial={{ y: 100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 100, opacity: 0 }}
          className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50"
        >
          <div className="flex items-center gap-3 px-4 py-3 bg-charcoal-black border-2 border-accent-yellow rounded-lg shadow-lg">
            <span className="text-bone-white font-medium">
              {selectedIds.length} {submissionType === 'content' ? 'submission' : 'project'}
              {selectedIds.length > 1 ? 's' : ''} selected
            </span>

            <div className="h-6 w-px bg-muted-gray" />

            <Button
              variant="outline"
              size="sm"
              onClick={() => handleAction('approve')}
              className="bg-charcoal-black border-green-500 text-green-500 hover:bg-green-500 hover:text-bone-white"
            >
              <CheckCircle className="h-4 w-4 mr-1" />
              Approve
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={() => handleAction('reject')}
              className="bg-charcoal-black border-primary-red text-primary-red hover:bg-primary-red hover:text-bone-white"
            >
              <XCircle className="h-4 w-4 mr-1" />
              Reject
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={() => handleAction('in_review')}
              className="bg-charcoal-black border-blue-500 text-blue-500 hover:bg-blue-500 hover:text-bone-white"
            >
              <Eye className="h-4 w-4 mr-1" />
              In Review
            </Button>

            {submissionType === 'content' && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleAction('considered')}
                className="bg-charcoal-black border-purple-500 text-purple-500 hover:bg-purple-500 hover:text-bone-white"
              >
                <Clock className="h-4 w-4 mr-1" />
                Considered
              </Button>
            )}

            <Button
              variant="outline"
              size="sm"
              onClick={() => handleAction('archive')}
              className="bg-charcoal-black border-muted-gray text-muted-gray hover:bg-muted-gray hover:text-bone-white"
            >
              <Archive className="h-4 w-4 mr-1" />
              Archive
            </Button>

            <div className="h-6 w-px bg-muted-gray" />

            <Button
              variant="ghost"
              size="sm"
              onClick={onClearSelection}
              className="text-muted-gray hover:text-bone-white"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </motion.div>
      </AnimatePresence>

      {/* Confirmation Dialog */}
      <AlertDialog open={!!confirmAction} onOpenChange={() => setConfirmAction(null)}>
        <AlertDialogContent className="bg-charcoal-black border-muted-gray">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-bone-white">
              {confirmAction?.title}
            </AlertDialogTitle>
            <AlertDialogDescription className="text-muted-gray">
              {confirmAction?.description}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-charcoal-black border-muted-gray text-bone-white">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={executeAction}
              disabled={bulkMutation.isPending}
              className={
                confirmAction?.action === 'reject'
                  ? 'bg-primary-red hover:bg-red-700'
                  : 'bg-accent-yellow text-charcoal-black hover:bg-yellow-500'
              }
            >
              {bulkMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                'Confirm'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default SubmissionBulkActionsBar;
