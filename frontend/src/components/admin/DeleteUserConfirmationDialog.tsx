import React from 'react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from '@/components/ui/button';

interface User {
  id: string;
  email: string;
  profile: {
    username: string;
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
  if (!user) return null;

  return (
    <AlertDialog open={isOpen} onOpenChange={onClose}>
      <AlertDialogContent className="bg-charcoal-black border-muted-gray text-bone-white">
        <AlertDialogHeader>
          <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
          <AlertDialogDescription>
            This action cannot be undone. This will permanently delete the user{' '}
            <span className="font-bold text-accent-yellow">{user.profile?.username || user.email}</span>{' '}
            and all of their associated data from the platform.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel asChild>
            <Button variant="outline" onClick={onClose} disabled={isDeleting}>
              Cancel
            </Button>
          </AlertDialogCancel>
          <AlertDialogAction asChild>
            <Button
              variant="destructive"
              onClick={onConfirm}
              disabled={isDeleting}
              className="bg-primary-red text-bone-white hover:bg-primary-red/90"
            >
              {isDeleting ? 'Deleting...' : 'Yes, delete user'}
            </Button>
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};

export default DeleteUserConfirmationDialog;