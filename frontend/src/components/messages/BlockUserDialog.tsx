/**
 * BlockUserDialog
 * Confirmation dialog for blocking a user
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
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { AlertTriangle, Ban, Loader2, User } from 'lucide-react';
import { useBlockUser } from '@/hooks/useMessageSettings';
import { useToast } from '@/hooks/use-toast';

interface BlockUserDialogProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
  userName?: string;
  userAvatar?: string;
  onBlocked?: () => void;
}

export function BlockUserDialog({
  isOpen,
  onClose,
  userId,
  userName,
  userAvatar,
  onBlocked,
}: BlockUserDialogProps) {
  const [reason, setReason] = useState('');
  const blockUser = useBlockUser();
  const { toast } = useToast();

  const handleBlock = async () => {
    try {
      await blockUser.mutateAsync({
        blocked_user_id: userId,
        reason: reason.trim() || undefined,
      });

      toast({
        title: 'User blocked',
        description: `${userName || 'User'} has been blocked. They can no longer message you.`,
      });

      onBlocked?.();
      handleClose();
    } catch (error: any) {
      toast({
        title: 'Failed to block user',
        description: error.message || 'An error occurred',
        variant: 'destructive',
      });
    }
  };

  const handleClose = () => {
    setReason('');
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[425px] bg-charcoal-black border-muted-gray text-bone-white">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Ban className="h-5 w-5 text-red-500" />
            Block User
          </DialogTitle>
          <DialogDescription className="text-muted-gray">
            Are you sure you want to block this user?
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* User info */}
          <div className="flex items-center gap-3 p-3 rounded-lg bg-muted-gray/10 border border-muted-gray/30">
            <Avatar className="h-12 w-12">
              <AvatarImage src={userAvatar} alt={userName} />
              <AvatarFallback>
                {userName?.[0] || <User className="h-5 w-5" />}
              </AvatarFallback>
            </Avatar>
            <div>
              <p className="font-medium">{userName || 'Unknown User'}</p>
            </div>
          </div>

          {/* What blocking means */}
          <div className="p-3 rounded-lg bg-amber-900/20 border border-amber-700/30">
            <div className="flex items-start gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-amber-200">
                <p className="font-medium mb-1">What happens when you block:</p>
                <ul className="list-disc list-inside space-y-1 text-amber-200/80">
                  <li>They won't be able to send you messages</li>
                  <li>You won't be able to message them</li>
                  <li>They won't see your online status</li>
                  <li>They can't start new conversations with you</li>
                </ul>
              </div>
            </div>
          </div>

          {/* Optional reason */}
          <div className="space-y-2">
            <Label htmlFor="reason" className="text-muted-foreground">
              Reason (optional)
            </Label>
            <Textarea
              id="reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Why are you blocking this user? (for your records only)"
              className="bg-muted-gray/20 border-muted-gray resize-none"
              rows={3}
            />
            <p className="text-xs text-muted-foreground">
              This is private and only visible to you.
            </p>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button
            variant="ghost"
            onClick={handleClose}
            disabled={blockUser.isPending}
          >
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={handleBlock}
            disabled={blockUser.isPending}
          >
            {blockUser.isPending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Blocking...
              </>
            ) : (
              <>
                <Ban className="h-4 w-4 mr-2" />
                Block User
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
