/**
 * RecipientPicker - Reusable dialog for selecting recipients
 * Used in both Add Clearance form (pending recipients) and ClearanceRecipientsTab
 */
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { toast } from 'sonner';
import {
  UserPlus,
  Building,
  User,
  Mail,
  Loader2,
} from 'lucide-react';
import { useProjectMembers } from '@/hooks/backlot';
import { useContacts } from '@/hooks/backlot/useContacts';

// Type for pending recipients (before clearance is created)
export interface PendingRecipient {
  id: string; // Temp client-side ID
  type: 'contact' | 'team' | 'manual';
  project_contact_id?: string;
  project_member_user_id?: string;
  manual_email?: string;
  manual_name?: string;
  requires_signature: boolean;
  displayName: string;
  displayEmail?: string;
}

interface RecipientPickerProps {
  projectId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAdd: (recipient: PendingRecipient) => void;
  excludeContactIds?: string[];
  excludeMemberIds?: string[];
  isSubmitting?: boolean;
}

export function RecipientPicker({
  projectId,
  open,
  onOpenChange,
  onAdd,
  excludeContactIds = [],
  excludeMemberIds = [],
  isSubmitting = false,
}: RecipientPickerProps) {
  const [addTab, setAddTab] = useState<'contacts' | 'team' | 'manual'>('contacts');
  const [manualEmail, setManualEmail] = useState('');
  const [manualName, setManualName] = useState('');
  const [requiresSignature, setRequiresSignature] = useState(false);
  const [selectedContactId, setSelectedContactId] = useState<string | null>(null);
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null);

  const { contacts } = useContacts({ projectId, enabled: open });
  const { members } = useProjectMembers(projectId);

  const resetForm = () => {
    setManualEmail('');
    setManualName('');
    setRequiresSignature(false);
    setSelectedContactId(null);
    setSelectedMemberId(null);
    setAddTab('contacts');
  };

  const handleAdd = () => {
    let recipient: PendingRecipient | null = null;

    if (addTab === 'contacts' && selectedContactId) {
      const contact = contacts.find(c => c.id === selectedContactId);
      if (contact) {
        recipient = {
          id: `pending-contact-${Date.now()}`,
          type: 'contact',
          project_contact_id: selectedContactId,
          requires_signature: requiresSignature,
          displayName: contact.name,
          displayEmail: contact.email || undefined,
        };
      }
    } else if (addTab === 'team' && selectedMemberId) {
      const member = (members || []).find(m => m.user_id === selectedMemberId);
      if (member) {
        recipient = {
          id: `pending-member-${Date.now()}`,
          type: 'team',
          project_member_user_id: selectedMemberId,
          requires_signature: requiresSignature,
          displayName: member.user?.full_name || member.user?.username || 'Unknown',
          displayEmail: member.email || member.user?.email || undefined,
        };
      }
    } else if (addTab === 'manual' && manualEmail) {
      recipient = {
        id: `pending-manual-${Date.now()}`,
        type: 'manual',
        manual_email: manualEmail,
        manual_name: manualName || undefined,
        requires_signature: requiresSignature,
        displayName: manualName || manualEmail,
        displayEmail: manualEmail,
      };
    }

    if (!recipient) {
      toast.error('Please select or enter a recipient');
      return;
    }

    onAdd(recipient);
    resetForm();
    onOpenChange(false);
  };

  // Filter out already-added contacts/members
  const availableContacts = contacts.filter(
    c => !excludeContactIds.includes(c.id) && c.email
  );
  const availableMembers = (members || []).filter(
    m => !excludeMemberIds.includes(m.user_id)
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-charcoal-black border-muted-gray/30 max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-bone-white">Add Recipient</DialogTitle>
          <DialogDescription>
            Add someone to receive this clearance document
          </DialogDescription>
        </DialogHeader>

        <Tabs value={addTab} onValueChange={(v) => setAddTab(v as typeof addTab)}>
          <TabsList className="grid w-full grid-cols-3 bg-muted-gray/20">
            <TabsTrigger value="contacts">Contacts</TabsTrigger>
            <TabsTrigger value="team">Team</TabsTrigger>
            <TabsTrigger value="manual">Manual</TabsTrigger>
          </TabsList>

          <TabsContent value="contacts" className="mt-4">
            <ScrollArea className="h-[200px]">
              {availableContacts.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">
                  No contacts with email available
                </p>
              ) : (
                <div className="space-y-2">
                  {availableContacts.map((contact) => (
                    <div
                      key={contact.id}
                      onClick={() => setSelectedContactId(contact.id)}
                      className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-colors ${
                        selectedContactId === contact.id
                          ? 'bg-primary-red/20 border border-primary-red/50'
                          : 'bg-muted-gray/10 hover:bg-muted-gray/20'
                      }`}
                    >
                      <Building className="h-5 w-5 text-muted-foreground" />
                      <div>
                        <p className="text-sm font-medium text-bone-white">{contact.name}</p>
                        <p className="text-xs text-muted-foreground">{contact.email}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </TabsContent>

          <TabsContent value="team" className="mt-4">
            <ScrollArea className="h-[200px]">
              {availableMembers.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">
                  No team members available
                </p>
              ) : (
                <div className="space-y-2">
                  {availableMembers.map((member) => (
                    <div
                      key={member.user_id}
                      onClick={() => setSelectedMemberId(member.user_id)}
                      className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-colors ${
                        selectedMemberId === member.user_id
                          ? 'bg-primary-red/20 border border-primary-red/50'
                          : 'bg-muted-gray/10 hover:bg-muted-gray/20'
                      }`}
                    >
                      <User className="h-5 w-5 text-muted-foreground" />
                      <div>
                        <p className="text-sm font-medium text-bone-white">
                          {member.user?.full_name || member.user?.username || 'Unknown'}
                        </p>
                        <p className="text-xs text-muted-foreground">{member.role}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </TabsContent>

          <TabsContent value="manual" className="mt-4 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="manual-email">Email Address *</Label>
              <Input
                id="manual-email"
                type="email"
                placeholder="email@example.com"
                value={manualEmail}
                onChange={(e) => setManualEmail(e.target.value)}
                className="bg-muted-gray/10 border-muted-gray/30"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="manual-name">Name (optional)</Label>
              <Input
                id="manual-name"
                placeholder="John Doe"
                value={manualName}
                onChange={(e) => setManualName(e.target.value)}
                className="bg-muted-gray/10 border-muted-gray/30"
              />
            </div>
          </TabsContent>
        </Tabs>

        <div className="flex items-center justify-between pt-4 border-t border-muted-gray/20">
          <div className="flex items-center gap-2">
            <Switch
              id="requires-signature"
              checked={requiresSignature}
              onCheckedChange={setRequiresSignature}
            />
            <Label htmlFor="requires-signature" className="text-sm">
              Require signature
            </Label>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleAdd}
            disabled={isSubmitting}
            className="bg-primary-red hover:bg-primary-red/90"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Adding...
              </>
            ) : (
              <>
                <UserPlus className="h-4 w-4 mr-2" />
                Add Recipient
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default RecipientPicker;
