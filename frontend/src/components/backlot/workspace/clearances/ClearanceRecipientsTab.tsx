/**
 * ClearanceRecipientsTab - Manage recipients for a clearance document
 */
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
  Users,
  UserPlus,
  Mail,
  Trash2,
  Send,
  Eye,
  CheckCircle2,
  Clock,
  XCircle,
  AlertCircle,
  Building,
  User,
  Loader2,
  Pen,
} from 'lucide-react';
import { useClearanceRecipients, useProjectMembers } from '@/hooks/backlot';
import { useContacts } from '@/hooks/backlot/useContacts';
import {
  ClearanceRecipient,
  ClearanceRecipientInput,
  ClearanceSignatureStatus,
} from '@/types/backlot';
import { formatDistanceToNow } from 'date-fns';

interface ClearanceRecipientsTabProps {
  clearanceId: string;
  projectId: string;
  canEdit: boolean;
  hasDocument: boolean;
  onOpenSendModal?: () => void;
}

function getStatusIcon(status: ClearanceSignatureStatus) {
  switch (status) {
    case 'signed':
      return <CheckCircle2 className="h-4 w-4 text-green-500" />;
    case 'viewed':
      return <Eye className="h-4 w-4 text-blue-500" />;
    case 'pending':
      return <Clock className="h-4 w-4 text-yellow-500" />;
    case 'declined':
      return <XCircle className="h-4 w-4 text-red-500" />;
    default:
      return <Mail className="h-4 w-4 text-muted-foreground" />;
  }
}

function getStatusLabel(status: ClearanceSignatureStatus) {
  switch (status) {
    case 'signed':
      return 'Signed';
    case 'viewed':
      return 'Viewed';
    case 'pending':
      return 'Pending Signature';
    case 'declined':
      return 'Declined';
    default:
      return 'View Only';
  }
}

function getStatusColor(status: ClearanceSignatureStatus) {
  switch (status) {
    case 'signed':
      return 'bg-green-500/10 text-green-400 border-green-500/30';
    case 'viewed':
      return 'bg-blue-500/10 text-blue-400 border-blue-500/30';
    case 'pending':
      return 'bg-yellow-500/10 text-yellow-400 border-yellow-500/30';
    case 'declined':
      return 'bg-red-500/10 text-red-400 border-red-500/30';
    default:
      return 'bg-gray-500/10 text-gray-400 border-gray-500/30';
  }
}

export default function ClearanceRecipientsTab({
  clearanceId,
  projectId,
  canEdit,
  hasDocument,
  onOpenSendModal,
}: ClearanceRecipientsTabProps) {
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [addTab, setAddTab] = useState<'contacts' | 'team' | 'manual'>('contacts');
  const [manualEmail, setManualEmail] = useState('');
  const [manualName, setManualName] = useState('');
  const [requiresSignature, setRequiresSignature] = useState(false);
  const [selectedContactId, setSelectedContactId] = useState<string | null>(null);
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null);

  const {
    recipients,
    isLoading,
    addRecipient,
    removeRecipient,
    updateRecipient,
  } = useClearanceRecipients(clearanceId);

  const { contacts } = useContacts({ projectId, enabled: showAddDialog });
  const { members } = useProjectMembers(projectId);

  const handleAddRecipient = async () => {
    let input: ClearanceRecipientInput = { requires_signature: requiresSignature };

    if (addTab === 'contacts' && selectedContactId) {
      input.project_contact_id = selectedContactId;
    } else if (addTab === 'team' && selectedMemberId) {
      input.project_member_user_id = selectedMemberId;
    } else if (addTab === 'manual' && manualEmail) {
      input.manual_email = manualEmail;
      input.manual_name = manualName || undefined;
    } else {
      toast.error('Please select or enter a recipient');
      return;
    }

    try {
      await addRecipient.mutateAsync(input);
      toast.success('Recipient added');
      setShowAddDialog(false);
      resetForm();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to add recipient');
    }
  };

  const handleRemoveRecipient = async (recipientId: string) => {
    try {
      await removeRecipient.mutateAsync(recipientId);
      toast.success('Recipient removed');
    } catch (error) {
      toast.error('Failed to remove recipient');
    }
  };

  const handleToggleSignature = async (recipientId: string, currentValue: boolean) => {
    try {
      await updateRecipient.mutateAsync({
        recipientId,
        requires_signature: !currentValue,
      });
      toast.success(!currentValue ? 'Signature now required' : 'Signature no longer required');
    } catch (error) {
      toast.error('Failed to update recipient');
    }
  };

  const resetForm = () => {
    setManualEmail('');
    setManualName('');
    setRequiresSignature(false);
    setSelectedContactId(null);
    setSelectedMemberId(null);
    setAddTab('contacts');
  };

  // Filter out contacts/members already added as recipients
  const existingContactIds = recipients
    .filter(r => r.project_contact_id)
    .map(r => r.project_contact_id);
  const existingMemberIds = recipients
    .filter(r => r.project_member_user_id)
    .map(r => r.project_member_user_id);

  const availableContacts = contacts.filter(c => !existingContactIds.includes(c.id) && c.email);
  const availableMembers = (members || []).filter(m => !existingMemberIds.includes(m.user_id));

  const signatureRequired = recipients.filter(r => r.requires_signature);
  const signedCount = signatureRequired.filter(r => r.signature_status === 'signed').length;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="bg-charcoal-black/50 border-muted-gray/30">
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Total Recipients</span>
            </div>
            <p className="text-2xl font-bold text-bone-white mt-1">{recipients.length}</p>
          </CardContent>
        </Card>

        <Card className="bg-charcoal-black/50 border-muted-gray/30">
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <Pen className="h-4 w-4 text-yellow-500" />
              <span className="text-sm text-muted-foreground">Signatures</span>
            </div>
            <p className="text-2xl font-bold text-bone-white mt-1">
              {signedCount}/{signatureRequired.length}
            </p>
          </CardContent>
        </Card>

        <Card className="bg-charcoal-black/50 border-muted-gray/30">
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <Send className="h-4 w-4 text-blue-500" />
              <span className="text-sm text-muted-foreground">Sent</span>
            </div>
            <p className="text-2xl font-bold text-bone-white mt-1">
              {recipients.filter(r => r.last_email_sent_at).length}
            </p>
          </CardContent>
        </Card>

        <Card className="bg-charcoal-black/50 border-muted-gray/30">
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <Eye className="h-4 w-4 text-green-500" />
              <span className="text-sm text-muted-foreground">Viewed</span>
            </div>
            <p className="text-2xl font-bold text-bone-white mt-1">
              {recipients.filter(r => r.viewed_at).length}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Actions */}
      {canEdit && (
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowAddDialog(true)}
            className="border-primary-red/50 text-primary-red hover:bg-primary-red/10"
          >
            <UserPlus className="h-4 w-4 mr-2" />
            Add Recipient
          </Button>

          {hasDocument && recipients.length > 0 && onOpenSendModal && (
            <Button
              size="sm"
              onClick={onOpenSendModal}
              className="bg-accent-yellow text-charcoal-black hover:bg-accent-yellow/90"
            >
              <Send className="h-4 w-4 mr-2" />
              Send to Recipients
            </Button>
          )}
        </div>
      )}

      {/* Recipients List */}
      {recipients.length === 0 ? (
        <Card className="bg-charcoal-black/50 border-muted-gray/30">
          <CardContent className="py-12 text-center">
            <Users className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
            <p className="text-muted-foreground">No recipients added yet</p>
            {canEdit && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowAddDialog(true)}
                className="mt-4 border-primary-red/50 text-primary-red hover:bg-primary-red/10"
              >
                <UserPlus className="h-4 w-4 mr-2" />
                Add First Recipient
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <Card className="bg-charcoal-black/50 border-muted-gray/30">
          <CardHeader className="pb-2">
            <CardTitle className="text-bone-white text-base">Recipients</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y divide-muted-gray/20">
              {recipients.map((recipient) => (
                <div
                  key={recipient.id}
                  className="flex items-center justify-between p-4 hover:bg-muted-gray/5"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="flex-shrink-0">
                      {recipient.recipient_type === 'contact' ? (
                        <div className="h-10 w-10 rounded-full bg-blue-500/20 flex items-center justify-center">
                          <Building className="h-5 w-5 text-blue-400" />
                        </div>
                      ) : recipient.recipient_type === 'member' ? (
                        <div className="h-10 w-10 rounded-full bg-green-500/20 flex items-center justify-center">
                          <User className="h-5 w-5 text-green-400" />
                        </div>
                      ) : (
                        <div className="h-10 w-10 rounded-full bg-muted-gray/20 flex items-center justify-center">
                          <Mail className="h-5 w-5 text-muted-foreground" />
                        </div>
                      )}
                    </div>

                    <div className="min-w-0">
                      <p className="text-sm font-medium text-bone-white truncate">
                        {recipient.name}
                      </p>
                      <p className="text-xs text-muted-foreground truncate">
                        {recipient.email || 'No email'}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    {/* Status Badge */}
                    <Badge
                      variant="outline"
                      className={`flex items-center gap-1 ${getStatusColor(recipient.signature_status)}`}
                    >
                      {getStatusIcon(recipient.signature_status)}
                      <span className="text-xs">{getStatusLabel(recipient.signature_status)}</span>
                    </Badge>

                    {/* Last Sent */}
                    {recipient.last_email_sent_at && (
                      <span className="text-xs text-muted-foreground hidden md:inline">
                        Sent {formatDistanceToNow(new Date(recipient.last_email_sent_at), { addSuffix: true })}
                      </span>
                    )}

                    {/* Signature Toggle */}
                    {canEdit && (
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={recipient.requires_signature}
                          onCheckedChange={() => handleToggleSignature(recipient.id, recipient.requires_signature)}
                          disabled={recipient.signature_status === 'signed'}
                        />
                        <span className="text-xs text-muted-foreground">Sign</span>
                      </div>
                    )}

                    {/* Remove Button */}
                    {canEdit && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleRemoveRecipient(recipient.id)}
                        className="h-8 w-8 text-muted-foreground hover:text-red-400"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Add Recipient Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
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
            <Button variant="outline" onClick={() => setShowAddDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleAddRecipient}
              disabled={addRecipient.isPending}
              className="bg-primary-red hover:bg-primary-red/90"
            >
              {addRecipient.isPending ? (
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
    </div>
  );
}
