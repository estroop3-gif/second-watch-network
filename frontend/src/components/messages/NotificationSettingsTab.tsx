/**
 * NotificationSettingsTab
 * Manage muted conversations
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
import { Loader2, User, BellOff, Bell, Volume2 } from 'lucide-react';
import { useMutedConversations, useUnmuteConversation, MutedConversation } from '@/hooks/useMessageSettings';
import { useToast } from '@/hooks/use-toast';
import { formatDistanceToNow, format, isPast } from 'date-fns';

export function NotificationSettingsTab() {
  const { data: mutedConversations, isLoading } = useMutedConversations();
  const unmuteConversation = useUnmuteConversation();
  const { toast } = useToast();

  const [unmutingConversation, setUnmutingConversation] = useState<MutedConversation | null>(null);

  const handleUnmute = async () => {
    if (!unmutingConversation) return;

    try {
      await unmuteConversation.mutateAsync(unmutingConversation.id);
      const name = unmutingConversation.conversation_partner_name || unmutingConversation.channel_name || 'Conversation';
      toast({
        title: 'Notifications enabled',
        description: `Notifications for ${name} have been turned on.`,
      });
      setUnmutingConversation(null);
    } catch (error: any) {
      toast({
        title: 'Failed to unmute',
        description: error.message || 'An error occurred',
        variant: 'destructive',
      });
    }
  };

  const getMuteStatus = (muted: MutedConversation) => {
    if (!muted.muted_until) {
      return 'Muted forever';
    }
    const mutedUntil = new Date(muted.muted_until);
    if (isPast(mutedUntil)) {
      return 'Expired';
    }
    return `Muted until ${format(mutedUntil, 'MMM d, h:mm a')}`;
  };

  // Filter out expired mutes
  const activeMutes = mutedConversations?.filter((m) => {
    if (!m.muted_until) return true;
    return !isPast(new Date(m.muted_until));
  }) || [];

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (activeMutes.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <Bell className="h-12 w-12 mx-auto mb-4 opacity-50" />
        <p>No muted conversations</p>
        <p className="text-sm mt-1">Conversations you mute will appear here</p>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-2">
        <p className="text-sm text-muted-foreground mb-4">
          {activeMutes.length} muted conversation{activeMutes.length !== 1 ? 's' : ''}
        </p>

        <ScrollArea className="max-h-[350px]">
          <div className="space-y-2">
            {activeMutes.map((muted) => (
              <div
                key={muted.id}
                className="flex items-center gap-3 p-3 rounded-lg bg-muted-gray/10 border border-muted-gray/30"
              >
                {/* Avatar or channel icon */}
                {muted.conversation_partner_id ? (
                  <Avatar className="h-10 w-10">
                    <AvatarImage src={muted.conversation_partner_avatar} alt={muted.conversation_partner_name} />
                    <AvatarFallback>
                      {muted.conversation_partner_name?.[0] || <User className="h-4 w-4" />}
                    </AvatarFallback>
                  </Avatar>
                ) : (
                  <div className="h-10 w-10 rounded-full bg-muted-gray/30 flex items-center justify-center">
                    <Volume2 className="h-5 w-5 text-muted-foreground" />
                  </div>
                )}

                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">
                    {muted.conversation_partner_name || muted.channel_name || 'Unknown'}
                  </p>
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <BellOff className="h-3 w-3" />
                    <span>{getMuteStatus(muted)}</span>
                  </div>
                </div>

                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setUnmutingConversation(muted)}
                  className="text-muted-foreground hover:text-bone-white"
                >
                  <Bell className="h-4 w-4 mr-1" />
                  Unmute
                </Button>
              </div>
            ))}
          </div>
        </ScrollArea>

        <div className="pt-4 border-t border-muted-gray/30">
          <p className="text-xs text-muted-foreground">
            Muted conversations still receive messages, but you won't get notifications.
          </p>
        </div>
      </div>

      {/* Unmute confirmation dialog */}
      <AlertDialog open={!!unmutingConversation} onOpenChange={() => setUnmutingConversation(null)}>
        <AlertDialogContent className="bg-charcoal-black border-muted-gray text-bone-white">
          <AlertDialogHeader>
            <AlertDialogTitle>Enable Notifications</AlertDialogTitle>
            <AlertDialogDescription className="text-muted-gray">
              Enable notifications for {unmutingConversation?.conversation_partner_name || unmutingConversation?.channel_name || 'this conversation'}?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              onClick={() => setUnmutingConversation(null)}
              disabled={unmuteConversation.isPending}
            >
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleUnmute}
              disabled={unmuteConversation.isPending}
            >
              {unmuteConversation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Enabling...
                </>
              ) : (
                'Enable Notifications'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
