/**
 * BudgetDeleteConfirmDialog - Triple-confirmation dialog for deleting a budget
 *
 * This component enforces a 3-step confirmation process:
 * 1. "Are you sure?"
 * 2. "Are you positive?"
 * 3. "This will delete the current budget. Do you understand?"
 */
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { AlertTriangle, Trash2, Loader2, CheckCircle2 } from 'lucide-react';
import { BacklotBudget } from '@/types/backlot';

interface BudgetDeleteConfirmDialogProps {
  budget: BacklotBudget | null;
  isOpen: boolean;
  onClose: () => void;
  onConfirmDelete: () => Promise<void>;
  isDeleting: boolean;
}

type ConfirmationStep = 1 | 2 | 3 | 'deleting' | 'complete';

const STEP_CONFIG: Record<1 | 2 | 3, {
  title: string;
  question: string;
  description: string;
  confirmLabel: string;
  confirmVariant: 'outline' | 'destructive';
}> = {
  1: {
    title: 'Delete Budget',
    question: 'Are you sure?',
    description: 'You are about to delete this budget. This action will remove all categories, line items, daily budgets, and receipts associated with it.',
    confirmLabel: 'Yes, I\'m sure',
    confirmVariant: 'outline',
  },
  2: {
    title: 'Confirm Deletion',
    question: 'Are you positive?',
    description: 'This is a destructive action that cannot be undone. All budget data will be permanently lost.',
    confirmLabel: 'Yes, I\'m positive',
    confirmVariant: 'outline',
  },
  3: {
    title: 'Final Confirmation',
    question: 'This will delete the current budget. Do you understand?',
    description: 'By clicking the button below, you acknowledge that this budget and all its data will be permanently deleted and cannot be recovered.',
    confirmLabel: 'I understand, delete permanently',
    confirmVariant: 'destructive',
  },
};

export function BudgetDeleteConfirmDialog({
  budget,
  isOpen,
  onClose,
  onConfirmDelete,
  isDeleting,
}: BudgetDeleteConfirmDialogProps) {
  const [step, setStep] = useState<ConfirmationStep>(1);

  const handleClose = () => {
    setStep(1); // Reset to first step when closing
    onClose();
  };

  const handleConfirm = async () => {
    if (step === 1) {
      setStep(2);
    } else if (step === 2) {
      setStep(3);
    } else if (step === 3) {
      setStep('deleting');
      try {
        await onConfirmDelete();
        setStep('complete');
        // Auto-close after brief delay
        setTimeout(() => {
          handleClose();
        }, 1500);
      } catch {
        // If error, go back to step 3
        setStep(3);
      }
    }
  };

  const handleBack = () => {
    if (step === 2) {
      setStep(1);
    } else if (step === 3) {
      setStep(2);
    }
  };

  if (!budget) return null;

  const currentStep = typeof step === 'number' ? step : 3;
  const config = STEP_CONFIG[currentStep];

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-red-400">
            <AlertTriangle className="w-5 h-5" />
            {step === 'deleting' ? 'Deleting...' : step === 'complete' ? 'Deleted' : config.title}
          </DialogTitle>
          {step !== 'deleting' && step !== 'complete' && (
            <DialogDescription className="text-muted-gray">
              Budget: <span className="font-medium text-bone-white">{budget.name}</span>
            </DialogDescription>
          )}
        </DialogHeader>

        <div className="space-y-4 mt-4">
          {/* Progress indicator */}
          {typeof step === 'number' && (
            <div className="flex items-center justify-center gap-2 mb-6">
              {[1, 2, 3].map((s) => (
                <div
                  key={s}
                  className={`w-3 h-3 rounded-full transition-all ${
                    s < step
                      ? 'bg-red-400'
                      : s === step
                      ? 'bg-red-500 ring-2 ring-red-500/30'
                      : 'bg-muted-gray/30'
                  }`}
                />
              ))}
            </div>
          )}

          {/* Deleting state */}
          {step === 'deleting' && (
            <div className="text-center py-8">
              <Loader2 className="w-12 h-12 text-red-400 mx-auto mb-4 animate-spin" />
              <p className="text-bone-white font-medium">Deleting budget...</p>
              <p className="text-muted-gray text-sm mt-2">
                Removing all categories, line items, and associated data
              </p>
            </div>
          )}

          {/* Complete state */}
          {step === 'complete' && (
            <div className="text-center py-8">
              <CheckCircle2 className="w-12 h-12 text-green-400 mx-auto mb-4" />
              <p className="text-bone-white font-medium">Budget deleted successfully</p>
            </div>
          )}

          {/* Question steps */}
          {typeof step === 'number' && (
            <>
              <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4">
                <h3 className="text-lg font-semibold text-bone-white mb-2">
                  {config.question}
                </h3>
                <p className="text-muted-gray text-sm">
                  {config.description}
                </p>
              </div>

              {/* Warning about what will be deleted */}
              {step >= 2 && (
                <div className="bg-charcoal-black/50 border border-muted-gray/20 rounded-lg p-4 space-y-2">
                  <p className="text-sm font-medium text-bone-white">The following will be deleted:</p>
                  <ul className="text-sm text-muted-gray space-y-1">
                    <li className="flex items-center gap-2">
                      <Trash2 className="w-3 h-3 text-red-400" />
                      All budget categories
                    </li>
                    <li className="flex items-center gap-2">
                      <Trash2 className="w-3 h-3 text-red-400" />
                      All line items
                    </li>
                    <li className="flex items-center gap-2">
                      <Trash2 className="w-3 h-3 text-red-400" />
                      All daily budgets and their items
                    </li>
                    <li className="flex items-center gap-2">
                      <Trash2 className="w-3 h-3 text-red-400" />
                      All receipts linked to this budget
                    </li>
                  </ul>
                </div>
              )}

              {/* Actions */}
              <div className="flex justify-between gap-3 pt-4">
                <div>
                  {step > 1 && (
                    <Button variant="ghost" onClick={handleBack}>
                      Back
                    </Button>
                  )}
                </div>
                <div className="flex gap-3">
                  <Button variant="ghost" onClick={handleClose}>
                    Cancel
                  </Button>
                  <Button
                    variant={config.confirmVariant}
                    onClick={handleConfirm}
                    disabled={isDeleting}
                    className={step === 3 ? 'bg-red-600 hover:bg-red-700 text-white' : ''}
                  >
                    {config.confirmLabel}
                  </Button>
                </div>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
