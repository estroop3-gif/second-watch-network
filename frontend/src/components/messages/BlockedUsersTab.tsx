/**
 * BlockedUsersTab
 * Manage blocked users list
 */

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
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
import { Loader2, User, Ban, UserX, Unlock } from 'lucide-react';
import { useBlockedUsers, useUnblockUser, BlockedUser } from '@/hooks/useMessageSettings';
import { useToast } from '@/hooks/use-toast';
import { formatDistanceToNow } from 'date-fns';

export function BlockedUsersTab() {
  const { data: blockedUsers, isLoading } = useBlockedUsers();
  const unblockUser = useUnblockUser();
  const { toast } = useToast();

  const [unblockingUser, setUnblockingUser] = useState<BlockedUser | null>(null);

  const handleUnblock = async () => {
    if (!unblockingUser) return;

    try {
      await unblockUser.mutateAsync(unblockingUser.blocked_user_id);
      toast({
        title: 'User unblocked',
        description: `${unblockingUser.blocked_user_name || 'User'} has been unblocked.`,
      });
      setUnblockingUser(null);
    } catch (error: any) {
      toast({
        title: 'Failed to unblock user',
        description: error.message || 'An error occurred',
        variant: 'destructive',
      });
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!blockedUsers || blockedUsers.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <UserX className="h-12 w-12 mx-auto mb-4 opacity-50" />
        <p>No blocked users</p>
        <p className="text-sm mt-1">Users you block will appear here</p>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-2">
        <p className="text-sm text-muted-foreground mb-4">
          {blockedUsers.length} blocked user{blockedUsers.length !== 1 ? 's' : ''}
        </p>

        <ScrollArea className="max-h-[350px]">
          <div className="space-y-2">
            {blockedUsers.map((blocked) => (
              <div
                key={blocked.id}
                className="flex items-center gap-3 p-3 rounded-lg bg-muted-gray/10 border border-muted-gray/30"
              >
                <Avatar className="h-10 w-10">
                  <AvatarImage src={blocked.blocked_user_avatar} alt={blocked.blocked_user_name} />
                  <AvatarFallback>
                    {blocked.blocked_user_name?.[0] || <User className="h-4 w-4" />}
                  </AvatarFallback>
                </Avatar>

                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">
                    {blocked.blocked_user_name || 'Unknown User'}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Blocked {formatDistanceToNow(new Date(blocked.created_at), { addSuffix: true })}
                  </p>
                  {blocked.reason && (
                    <p className="text-xs text-muted-foreground mt-1 truncate">
                      Reason: {blocked.reason}
                    </p>
                  )}
                </div>

                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setUnblockingUser(blocked)}
                  className="text-muted-foreground hover:text-bone-white"
                >
                  <Unlock className="h-4 w-4 mr-1" />
                  Unblock
                </Button>
              </div>
            ))}
          </div>
        </ScrollArea>
      </div>

      {/* Unblock confirmation dialog */}
      <AlertDialog open={!!unblockingUser} onOpenChange={() => setUnblockingUser(null)}>
        <AlertDialogContent className="bg-charcoal-black border-muted-gray text-bone-white">
          <AlertDialogHeader>
            <AlertDialogTitle>Unblock User</AlertDialogTitle>
            <AlertDialogDescription className="text-muted-gray">
              Are you sure you want to unblock {unblockingUser?.blocked_user_name || 'this user'}?
              They will be able to message you again.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              onClick={() => setUnblockingUser(null)}
              disabled={unblockUser.isPending}
            >
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleUnblock}
              disabled={unblockUser.isPending}
            >
              {unblockUser.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Unblocking...
                </>
              ) : (
                'Unblock'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
