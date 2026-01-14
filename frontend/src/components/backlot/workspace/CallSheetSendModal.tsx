/**
 * CallSheetSendModal - Modal for sending call sheets to production team
 */
import React, { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Send,
  Mail,
  Bell,
  Users,
  UserCheck,
  UserPlus,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Calendar,
  MapPin,
  Clock,
} from 'lucide-react';
import {
  useSendCallSheet,
  useProjectMembersForSend,
  useCallSheetPeople,
} from '@/hooks/backlot';
import {
  BacklotCallSheet,
  CallSheetSendChannel,
  CallSheetRecipientMode,
} from '@/types/backlot';
import { format } from 'date-fns';
import { parseLocalDate } from '@/lib/dateUtils';
import { cn } from '@/lib/utils';

interface CallSheetSendModalProps {
  isOpen: boolean;
  onClose: () => void;
  callSheet: BacklotCallSheet;
  projectId: string;
}

const CHANNEL_OPTIONS: { value: CallSheetSendChannel; label: string; icon: React.ReactNode; description: string }[] = [
  {
    value: 'email_and_notification',
    label: 'Email & Notification',
    icon: <><Mail className="w-4 h-4" /><Bell className="w-4 h-4" /></>,
    description: 'Send via email and create in-app notifications',
  },
  {
    value: 'email',
    label: 'Email Only',
    icon: <Mail className="w-4 h-4" />,
    description: 'Send via email only',
  },
  {
    value: 'notification',
    label: 'In-App Only',
    icon: <Bell className="w-4 h-4" />,
    description: 'Create in-app notifications only (for platform members)',
  },
];

const RECIPIENT_OPTIONS: { value: CallSheetRecipientMode; label: string; icon: React.ReactNode; description: string }[] = [
  {
    value: 'all_project_members',
    label: 'All Team Members',
    icon: <Users className="w-4 h-4" />,
    description: 'Send to everyone on the project team',
  },
  {
    value: 'call_sheet_people',
    label: 'Call Sheet People',
    icon: <UserCheck className="w-4 h-4" />,
    description: 'Send to people listed on this call sheet (with emails)',
  },
  {
    value: 'custom',
    label: 'Custom Selection',
    icon: <UserPlus className="w-4 h-4" />,
    description: 'Choose specific recipients',
  },
];

const CallSheetSendModal: React.FC<CallSheetSendModalProps> = ({
  isOpen,
  onClose,
  callSheet,
  projectId,
}) => {
  const [channel, setChannel] = useState<CallSheetSendChannel>('email_and_notification');
  const [recipientMode, setRecipientMode] = useState<CallSheetRecipientMode>('all_project_members');
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [extraEmails, setExtraEmails] = useState('');
  const [message, setMessage] = useState('');
  const [sendResult, setSendResult] = useState<{ success: boolean; message: string } | null>(null);

  const { data: projectMembers, isLoading: membersLoading } = useProjectMembersForSend(projectId);
  const { people: callSheetPeople } = useCallSheetPeople(callSheet.id);
  const sendMutation = useSendCallSheet();

  const handleToggleUser = (userId: string) => {
    setSelectedUserIds((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]
    );
  };

  const handleSelectAll = () => {
    if (projectMembers) {
      setSelectedUserIds(projectMembers.map((m) => m.user_id));
    }
  };

  const handleDeselectAll = () => {
    setSelectedUserIds([]);
  };

  const estimatedRecipients = useMemo(() => {
    if (recipientMode === 'all_project_members') {
      return projectMembers?.length || 0;
    } else if (recipientMode === 'call_sheet_people') {
      return callSheetPeople.filter((p) => p.email).length;
    } else {
      const extraEmailCount = extraEmails
        .split(',')
        .map((e) => e.trim())
        .filter((e) => e.includes('@')).length;
      return selectedUserIds.length + extraEmailCount;
    }
  }, [recipientMode, projectMembers, callSheetPeople, selectedUserIds, extraEmails]);

  const handleSend = async () => {
    try {
      setSendResult(null);

      const extraEmailsList = extraEmails
        .split(',')
        .map((e) => e.trim())
        .filter((e) => e.includes('@'));

      const result = await sendMutation.mutateAsync({
        callSheetId: callSheet.id,
        request: {
          channel,
          recipient_mode: recipientMode,
          recipient_user_ids: recipientMode === 'custom' ? selectedUserIds : undefined,
          extra_emails: extraEmailsList.length > 0 ? extraEmailsList : undefined,
          message: message.trim() || undefined,
        },
      });

      setSendResult({
        success: true,
        message: `Call sheet sent to ${result.total_recipients} recipient(s). ${result.emails_sent} email(s) sent, ${result.notifications_sent} notification(s) created.`,
      });

      // Reset form after successful send
      setTimeout(() => {
        onClose();
        setSendResult(null);
        setMessage('');
        setExtraEmails('');
        setSelectedUserIds([]);
      }, 2000);
    } catch (error: any) {
      setSendResult({
        success: false,
        message: error.message || 'Failed to send call sheet',
      });
    }
  };

  const handleClose = () => {
    if (!sendMutation.isPending) {
      onClose();
      setSendResult(null);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg bg-charcoal-black border-muted-gray/30">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-bone-white">
            <Send className="w-5 h-5 text-accent-yellow" />
            Send Call Sheet
          </DialogTitle>
          <DialogDescription className="text-muted-gray">
            Distribute this call sheet to your production team
          </DialogDescription>
        </DialogHeader>

        {/* Call Sheet Summary */}
        <div className="bg-muted-gray/10 rounded-lg p-3 space-y-2">
          <h4 className="font-medium text-bone-white">{callSheet.title}</h4>
          <div className="flex flex-wrap gap-3 text-sm text-muted-gray">
            <div className="flex items-center gap-1">
              <Calendar className="w-4 h-4" />
              {format(parseLocalDate(callSheet.date), 'EEE, MMM d, yyyy')}
            </div>
            {callSheet.general_call_time && (
              <div className="flex items-center gap-1">
                <Clock className="w-4 h-4" />
                {callSheet.general_call_time}
              </div>
            )}
            {callSheet.location_name && (
              <div className="flex items-center gap-1">
                <MapPin className="w-4 h-4" />
                {callSheet.location_name}
              </div>
            )}
          </div>
        </div>

        <ScrollArea className="max-h-[50vh]">
          <div className="space-y-6 pr-4">
            {/* Channel Selection */}
            <div className="space-y-3">
              <Label className="text-bone-white">How to Send</Label>
              <div className="space-y-2">
                {CHANNEL_OPTIONS.map((option) => (
                  <button
                    key={option.value}
                    onClick={() => setChannel(option.value)}
                    className={cn(
                      'w-full flex items-center gap-3 p-3 rounded-lg border transition-colors text-left',
                      channel === option.value
                        ? 'border-accent-yellow bg-accent-yellow/10'
                        : 'border-muted-gray/30 hover:border-muted-gray/50'
                    )}
                  >
                    <div className={cn(
                      'flex items-center gap-1',
                      channel === option.value ? 'text-accent-yellow' : 'text-muted-gray'
                    )}>
                      {option.icon}
                    </div>
                    <div className="flex-1">
                      <div className={cn(
                        'font-medium',
                        channel === option.value ? 'text-bone-white' : 'text-muted-gray'
                      )}>
                        {option.label}
                      </div>
                      <div className="text-xs text-muted-gray">{option.description}</div>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Recipient Selection */}
            <div className="space-y-3">
              <Label className="text-bone-white">Recipients</Label>
              <div className="space-y-2">
                {RECIPIENT_OPTIONS.map((option) => (
                  <button
                    key={option.value}
                    onClick={() => setRecipientMode(option.value)}
                    className={cn(
                      'w-full flex items-center gap-3 p-3 rounded-lg border transition-colors text-left',
                      recipientMode === option.value
                        ? 'border-accent-yellow bg-accent-yellow/10'
                        : 'border-muted-gray/30 hover:border-muted-gray/50'
                    )}
                  >
                    <div className={cn(
                      recipientMode === option.value ? 'text-accent-yellow' : 'text-muted-gray'
                    )}>
                      {option.icon}
                    </div>
                    <div className="flex-1">
                      <div className={cn(
                        'font-medium',
                        recipientMode === option.value ? 'text-bone-white' : 'text-muted-gray'
                      )}>
                        {option.label}
                      </div>
                      <div className="text-xs text-muted-gray">{option.description}</div>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Custom Selection */}
            {recipientMode === 'custom' && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="text-bone-white">Select Team Members</Label>
                  <div className="flex gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleSelectAll}
                      className="text-xs text-accent-yellow"
                    >
                      Select All
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleDeselectAll}
                      className="text-xs text-muted-gray"
                    >
                      Deselect All
                    </Button>
                  </div>
                </div>

                {membersLoading ? (
                  <div className="text-center py-4">
                    <Loader2 className="w-6 h-6 animate-spin mx-auto text-muted-gray" />
                  </div>
                ) : (
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {projectMembers?.map((member) => (
                      <label
                        key={member.user_id}
                        className="flex items-center gap-3 p-2 rounded hover:bg-muted-gray/10 cursor-pointer"
                      >
                        <Checkbox
                          checked={selectedUserIds.includes(member.user_id)}
                          onCheckedChange={() => handleToggleUser(member.user_id)}
                        />
                        <div className="flex-1">
                          <div className="text-sm text-bone-white">{member.name}</div>
                          <div className="text-xs text-muted-gray">
                            {member.production_role || member.role}
                            {member.email && ` • ${member.email}`}
                          </div>
                        </div>
                      </label>
                    ))}
                  </div>
                )}

                {/* Extra Emails */}
                <div className="space-y-2">
                  <Label className="text-muted-gray text-sm">
                    Additional Email Addresses (comma-separated)
                  </Label>
                  <Input
                    value={extraEmails}
                    onChange={(e) => setExtraEmails(e.target.value)}
                    placeholder="guest@example.com, another@example.com"
                    className="bg-charcoal-black border-muted-gray/30"
                  />
                </div>
              </div>
            )}

            {/* Message */}
            <div className="space-y-2">
              <Label className="text-bone-white">Message (Optional)</Label>
              <Textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Add a note to include with the call sheet..."
                className="bg-charcoal-black border-muted-gray/30 min-h-[80px]"
              />
            </div>

            {/* Estimated Recipients */}
            <div className="flex items-center justify-between p-3 bg-muted-gray/10 rounded-lg">
              <span className="text-muted-gray">Estimated Recipients</span>
              <Badge variant="outline" className="text-accent-yellow border-accent-yellow/30">
                {estimatedRecipients} {estimatedRecipients === 1 ? 'person' : 'people'}
              </Badge>
            </div>

            {/* Result Message */}
            {sendResult && (
              <div
                className={cn(
                  'flex items-start gap-2 p-3 rounded-lg',
                  sendResult.success
                    ? 'bg-green-500/20 text-green-400'
                    : 'bg-red-500/20 text-red-400'
                )}
              >
                {sendResult.success ? (
                  <CheckCircle2 className="w-5 h-5 shrink-0" />
                ) : (
                  <AlertCircle className="w-5 h-5 shrink-0" />
                )}
                <span className="text-sm">{sendResult.message}</span>
              </div>
            )}
          </div>
        </ScrollArea>

        <DialogFooter className="gap-2">
          <Button
            variant="outline"
            onClick={handleClose}
            disabled={sendMutation.isPending}
            className="border-muted-gray/30"
          >
            Cancel
          </Button>
          <Button
            onClick={handleSend}
            disabled={sendMutation.isPending || estimatedRecipients === 0}
            className="bg-accent-yellow text-charcoal-black hover:bg-bone-white"
          >
            {sendMutation.isPending ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Sending...
              </>
            ) : (
              <>
                <Send className="w-4 h-4 mr-2" />
                Send Call Sheet
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default CallSheetSendModal;
