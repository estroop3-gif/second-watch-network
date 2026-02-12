import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { useAssignContact, useBulkAssignContacts, useCRMReps } from '@/hooks/crm';
import { toast } from 'sonner';

interface ContactAssignmentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contact?: any;
  contactIds?: string[];
  onSuccess?: () => void;
}

const ContactAssignmentDialog = ({
  open,
  onOpenChange,
  contact,
  contactIds,
  onSuccess,
}: ContactAssignmentDialogProps) => {
  const [selectedRepId, setSelectedRepId] = useState('');
  const [notes, setNotes] = useState('');

  const { data: repsData } = useCRMReps();
  const assignContact = useAssignContact();
  const bulkAssign = useBulkAssignContacts();

  const reps = repsData?.reps || [];
  const isBulk = contactIds && contactIds.length > 0;
  const isTransfer = contact?.assigned_rep_id;
  const title = isBulk
    ? `Assign ${contactIds.length} Contacts`
    : isTransfer
      ? `Transfer ${contact?.first_name} ${contact?.last_name}`
      : `Assign ${contact?.first_name || ''} ${contact?.last_name || ''}`;

  const handleSubmit = async () => {
    if (!selectedRepId) {
      toast.error('Please select a rep');
      return;
    }

    try {
      if (isBulk) {
        await bulkAssign.mutateAsync({
          contactIds,
          repId: selectedRepId,
          notes: notes || undefined,
        });
        toast.success(`${contactIds.length} contacts assigned`);
      } else if (contact) {
        await assignContact.mutateAsync({
          contactId: contact.id,
          repId: selectedRepId,
          notes: notes || undefined,
        });
        toast.success(isTransfer ? 'Contact transferred' : 'Contact assigned');
      }
      setSelectedRepId('');
      setNotes('');
      onOpenChange(false);
      onSuccess?.();
    } catch (err: any) {
      toast.error(err.message || 'Failed to assign');
    }
  };

  const isPending = assignContact.isPending || bulkAssign.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-charcoal-black border-muted-gray/30 text-bone-white max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          {contact?.assigned_rep_name && (
            <div className="text-sm text-muted-gray">
              Currently assigned to: <span className="text-bone-white">{contact.assigned_rep_name}</span>
            </div>
          )}

          <div className="space-y-2">
            <Label>Assign to Rep</Label>
            <Select value={selectedRepId} onValueChange={setSelectedRepId}>
              <SelectTrigger className="bg-charcoal-black border-muted-gray/50">
                <SelectValue placeholder="Select a rep..." />
              </SelectTrigger>
              <SelectContent>
                {reps.map((rep: any) => (
                  <SelectItem key={rep.id} value={rep.id}>
                    {rep.full_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Notes (optional)</Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Reason for assignment..."
              className="bg-charcoal-black border-muted-gray/50 resize-none"
              rows={3}
            />
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={!selectedRepId || isPending}
              className="bg-accent-yellow text-charcoal-black hover:bg-accent-yellow/90"
            >
              {isPending ? 'Assigning...' : isTransfer ? 'Transfer' : 'Assign'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ContactAssignmentDialog;
