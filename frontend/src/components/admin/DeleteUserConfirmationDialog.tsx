import React, { useState, useEffect } from 'react';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { AlertTriangle, Trash2 } from 'lucide-react';

interface User {
  id: string;
  email: string;
  full_name?: string;
  profile?: {
    username?: string;
  };
}

interface DeleteUserConfirmationDialogProps {
  user: User | null;
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  isDeleting: boolean;
}

const DeleteUserConfirmationDialog: React.FC<DeleteUserConfirmationDialogProps> = ({
  user,
  isOpen,
  onClose,
  onConfirm,
  isDeleting,
}) => {
  const [step, setStep] = useState<1 | 2>(1);
  const [confirmText, setConfirmText] = useState('');

  // Reset state when dialog opens/closes
  useEffect(() => {
    if (!isOpen) {
      setStep(1);
      setConfirmText('');
    }
  }, [isOpen]);

  if (!user) return null;

  const displayName = user.full_name || user.profile?.username || user.email;
  const confirmationPhrase = 'DELETE';

  const handleFirstConfirm = () => {
    setStep(2);
  };

  const handleFinalConfirm = () => {
    if (confirmText === confirmationPhrase) {
      onConfirm();
    }
  };

  const handleClose = () => {
    setStep(1);
    setConfirmText('');
    onClose();
  };

  return (
    <AlertDialog open={isOpen} onOpenChange={handleClose}>
      <AlertDialogContent className="bg-charcoal-black border-muted-gray text-bone-white">
        {step === 1 ? (
          <>
            <AlertDialogHeader>
              <AlertDialogTitle className="flex items-center gap-2 text-primary-red">
                <AlertTriangle className="h-5 w-5" />
                Delete User Account
              </AlertDialogTitle>
              <AlertDialogDescription className="text-bone-white/80">
                You are about to permanently delete the account for:
                <div className="mt-3 p-3 bg-primary-red/10 border border-primary-red/30 rounded-lg">
                  <p className="font-bold text-accent-yellow">{displayName}</p>
                  <p className="text-sm text-muted-gray">{user.email}</p>
                </div>
                <p className="mt-3 text-sm">
                  This action will:
                </p>
                <ul className="mt-2 text-sm space-y-1 list-disc list-inside text-muted-gray">
                  <li>Remove the user from AWS Cognito</li>
                  <li>Delete all profile data and settings</li>
                  <li>Remove all associated content and files</li>
                  <li>Clear all role assignments and permissions</li>
                </ul>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <Button variant="outline" onClick={handleClose} disabled={isDeleting}>
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={handleFirstConfirm}
                className="bg-primary-red text-bone-white hover:bg-primary-red/90"
              >
                Continue to Final Confirmation
              </Button>
            </AlertDialogFooter>
          </>
        ) : (
          <>
            <AlertDialogHeader>
              <AlertDialogTitle className="flex items-center gap-2 text-primary-red">
                <Trash2 className="h-5 w-5" />
                Final Confirmation Required
              </AlertDialogTitle>
              <AlertDialogDescription className="text-bone-white/80">
                <p className="mb-4">
                  This action <span className="font-bold text-primary-red">CANNOT</span> be undone.
                </p>
                <p className="mb-2">
                  To confirm deletion of <span className="font-bold text-accent-yellow">{displayName}</span>,
                  type <span className="font-mono bg-muted-gray/30 px-2 py-1 rounded text-primary-red">DELETE</span> below:
                </p>
                <Input
                  value={confirmText}
                  onChange={(e) => setConfirmText(e.target.value.toUpperCase())}
                  placeholder="Type DELETE to confirm"
                  className="mt-3 bg-muted-gray/20 border-muted-gray text-bone-white font-mono text-center"
                  autoFocus
                />
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <Button variant="outline" onClick={() => setStep(1)} disabled={isDeleting}>
                Go Back
              </Button>
              <Button
                variant="destructive"
                onClick={handleFinalConfirm}
                disabled={isDeleting || confirmText !== confirmationPhrase}
                className="bg-primary-red text-bone-white hover:bg-primary-red/90 disabled:opacity-50"
              >
                {isDeleting ? 'Deleting...' : 'Permanently Delete User'}
              </Button>
            </AlertDialogFooter>
          </>
        )}
      </AlertDialogContent>
    </AlertDialog>
  );
};

export default DeleteUserConfirmationDialog;
