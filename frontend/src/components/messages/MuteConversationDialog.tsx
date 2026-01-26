/**
 * MuteConversationDialog
 * Dialog for muting a conversation with duration options
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
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { BellOff, Loader2, User } from 'lucide-react';
import { useMuteConversation } from '@/hooks/useMessageSettings';
import { useToast } from '@/hooks/use-toast';

interface MuteConversationDialogProps {
  isOpen: boolean;
  onClose: () => void;
  conversationPartnerId?: string;
  channelId?: string;
  partnerName?: string;
  partnerAvatar?: string;
  channelName?: string;
  onMuted?: () => void;
}

type MuteDuration = '60' | '480' | '1440' | '10080' | 'forever';

const MUTE_DURATIONS: { value: MuteDuration; label: string; description: string }[] = [
  {
    value: '60',
    label: '1 hour',
    description: 'Mute for 1 hour',
  },
  {
    value: '480',
    label: '8 hours',
    description: 'Mute for 8 hours',
  },
  {
    value: '1440',
    label: '1 day',
    description: 'Mute for 24 hours',
  },
  {
    value: '10080',
    label: '1 week',
    description: 'Mute for 7 days',
  },
  {
    value: 'forever',
    label: 'Forever',
    description: 'Mute until you unmute',
  },
];

export function MuteConversationDialog({
  isOpen,
  onClose,
  conversationPartnerId,
  channelId,
  partnerName,
  partnerAvatar,
  channelName,
  onMuted,
}: MuteConversationDialogProps) {
  const [duration, setDuration] = useState<MuteDuration>('1440');
  const muteConversation = useMuteConversation();
  const { toast } = useToast();

  const handleMute = async () => {
    try {
      await muteConversation.mutateAsync({
        conversation_partner_id: conversationPartnerId,
        channel_id: channelId,
        duration_minutes: duration === 'forever' ? undefined : parseInt(duration),
      });

      const durationLabel = MUTE_DURATIONS.find(d => d.value === duration)?.label || duration;
      const targetName = partnerName || channelName || 'Conversation';

      toast({
        title: 'Conversation muted',
        description: `${targetName} has been muted${duration !== 'forever' ? ` for ${durationLabel}` : ' indefinitely'}.`,
      });

      onMuted?.();
      handleClose();
    } catch (error: any) {
      toast({
        title: 'Failed to mute conversation',
        description: error.message || 'An error occurred',
        variant: 'destructive',
      });
    }
  };

  const handleClose = () => {
    setDuration('1440');
    onClose();
  };

  const displayName = partnerName || channelName || 'this conversation';

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[425px] bg-charcoal-black border-muted-gray text-bone-white">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <BellOff className="h-5 w-5 text-muted-foreground" />
            Mute Conversation
          </DialogTitle>
          <DialogDescription className="text-muted-gray">
            How long would you like to mute notifications?
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Conversation info */}
          {(partnerName || channelName) && (
            <div className="flex items-center gap-3 p-3 rounded-lg bg-muted-gray/10 border border-muted-gray/30">
              {partnerAvatar || partnerName ? (
                <Avatar className="h-10 w-10">
                  <AvatarImage src={partnerAvatar} alt={partnerName} />
                  <AvatarFallback>
                    {partnerName?.[0] || <User className="h-4 w-4" />}
                  </AvatarFallback>
                </Avatar>
              ) : null}
              <div>
                <p className="font-medium">{displayName}</p>
                <p className="text-xs text-muted-foreground">
                  {channelId ? 'Channel' : 'Direct message'}
                </p>
              </div>
            </div>
          )}

          {/* Duration selection */}
          <div className="space-y-3">
            <Label>Mute duration</Label>
            <RadioGroup value={duration} onValueChange={(v) => setDuration(v as MuteDuration)}>
              {MUTE_DURATIONS.map((d) => (
                <div
                  key={d.value}
                  className="flex items-center space-x-3 p-3 rounded-lg bg-muted-gray/10 border border-muted-gray/30 hover:bg-muted-gray/20 transition-colors cursor-pointer"
                  onClick={() => setDuration(d.value)}
                >
                  <RadioGroupItem value={d.value} id={d.value} />
                  <div className="flex-1">
                    <Label htmlFor={d.value} className="cursor-pointer font-medium">
                      {d.label}
                    </Label>
                  </div>
                </div>
              ))}
            </RadioGroup>
          </div>

          <p className="text-xs text-muted-foreground">
            You'll still receive messages, but you won't get notifications for them.
          </p>
        </div>

        <DialogFooter className="gap-2">
          <Button
            variant="ghost"
            onClick={handleClose}
            disabled={muteConversation.isPending}
          >
            Cancel
          </Button>
          <Button
            onClick={handleMute}
            disabled={muteConversation.isPending}
          >
            {muteConversation.isPending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Muting...
              </>
            ) : (
              <>
                <BellOff className="h-4 w-4 mr-2" />
                Mute
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
