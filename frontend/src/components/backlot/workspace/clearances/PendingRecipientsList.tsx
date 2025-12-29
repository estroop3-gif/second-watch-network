/**
 * PendingRecipientsList - Display list of pending recipients in Add Clearance form
 */
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Building,
  User,
  Mail,
  X,
  Pen,
} from 'lucide-react';
import { PendingRecipient } from './RecipientPicker';

interface PendingRecipientsListProps {
  recipients: PendingRecipient[];
  onRemove: (id: string) => void;
  onToggleSignature: (id: string) => void;
}

function getRecipientIcon(type: PendingRecipient['type']) {
  switch (type) {
    case 'contact':
      return (
        <div className="h-8 w-8 rounded-full bg-blue-500/20 flex items-center justify-center shrink-0">
          <Building className="h-4 w-4 text-blue-400" />
        </div>
      );
    case 'team':
      return (
        <div className="h-8 w-8 rounded-full bg-green-500/20 flex items-center justify-center shrink-0">
          <User className="h-4 w-4 text-green-400" />
        </div>
      );
    default:
      return (
        <div className="h-8 w-8 rounded-full bg-muted-gray/20 flex items-center justify-center shrink-0">
          <Mail className="h-4 w-4 text-muted-foreground" />
        </div>
      );
  }
}

export function PendingRecipientsList({
  recipients,
  onRemove,
  onToggleSignature,
}: PendingRecipientsListProps) {
  if (recipients.length === 0) {
    return null;
  }

  return (
    <ScrollArea className="max-h-[150px]">
      <div className="space-y-2">
        {recipients.map((recipient) => (
          <div
            key={recipient.id}
            className="flex items-center justify-between gap-3 p-2 rounded-lg bg-muted-gray/10 border border-muted-gray/20"
          >
            <div className="flex items-center gap-2 min-w-0">
              {getRecipientIcon(recipient.type)}
              <div className="min-w-0">
                <p className="text-sm font-medium text-bone-white truncate">
                  {recipient.displayName}
                </p>
                {recipient.displayEmail && recipient.displayEmail !== recipient.displayName && (
                  <p className="text-xs text-muted-foreground truncate">
                    {recipient.displayEmail}
                  </p>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {/* Signature Required Badge/Toggle */}
              <div className="flex items-center gap-1.5">
                <Switch
                  checked={recipient.requires_signature}
                  onCheckedChange={() => onToggleSignature(recipient.id)}
                  className="scale-75"
                />
                {recipient.requires_signature && (
                  <Badge variant="outline" className="text-xs bg-yellow-500/10 text-yellow-400 border-yellow-500/30 gap-1">
                    <Pen className="h-3 w-3" />
                    Sign
                  </Badge>
                )}
              </div>

              {/* Remove Button */}
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => onRemove(recipient.id)}
                className="h-7 w-7 text-muted-foreground hover:text-red-400"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
        ))}
      </div>
    </ScrollArea>
  );
}

export default PendingRecipientsList;
