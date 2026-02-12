import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRightLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import ContactCard from '@/components/crm/ContactCard';
import ContactAssignmentDialog from '@/components/crm/ContactAssignmentDialog';
import { useContacts, useCRMReps } from '@/hooks/crm';
import { useEmailCompose } from '@/context/EmailComposeContext';

const LeadManagement = () => {
  const navigate = useNavigate();
  const [selectedRepId, setSelectedRepId] = useState('');
  const [transferTarget, setTransferTarget] = useState<any>(null);
  const [offset, setOffset] = useState(0);
  const limit = 50;

  const { data: repsData } = useCRMReps();
  const reps = repsData?.reps || [];

  const { data: contactsData, isLoading } = useContacts(
    selectedRepId
      ? { assigned_rep_id: selectedRepId, limit, offset }
      : undefined
  );

  const { openCompose } = useEmailCompose();

  const contacts = contactsData?.contacts || [];
  const total = contactsData?.total || 0;

  const handleEmail = (contact: any) => {
    openCompose({
      defaultTo: contact.email,
      contactId: contact.id,
      contactData: {
        first_name: contact.first_name,
        last_name: contact.last_name,
        company: contact.company,
        email: contact.email,
      },
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <div className="w-72">
          <Select value={selectedRepId} onValueChange={(v) => { setSelectedRepId(v); setOffset(0); }}>
            <SelectTrigger className="bg-charcoal-black border-muted-gray/50">
              <SelectValue placeholder="Select a rep to manage..." />
            </SelectTrigger>
            <SelectContent>
              {reps.map((rep: any) => (
                <SelectItem key={rep.id} value={rep.id}>
                  {rep.full_name} ({rep.contact_count || 0} contacts)
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {selectedRepId && (
          <span className="text-sm text-muted-gray">{total} contacts</span>
        )}
      </div>

      {!selectedRepId ? (
        <div className="text-center py-12 text-muted-gray">
          <ArrowRightLeft className="h-8 w-8 mx-auto mb-3 opacity-50" />
          <p className="text-lg mb-2">Select a rep to view their contacts</p>
          <p className="text-sm">You can then transfer contacts between reps.</p>
        </div>
      ) : isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map(i => (
            <Skeleton key={i} className="h-40 rounded-lg" />
          ))}
        </div>
      ) : contacts.length === 0 ? (
        <div className="text-center py-12 text-muted-gray">
          <p className="text-lg">No contacts assigned to this rep</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {contacts.map((contact: any) => (
              <ContactCard
                key={contact.id}
                contact={contact}
                onEmail={handleEmail}
                showAdminControls
                onAssign={(c) => setTransferTarget(c)}
              />
            ))}
          </div>

          {/* Pagination */}
          {total > limit && (
            <div className="flex items-center justify-center gap-4 pt-4">
              <Button
                variant="outline"
                size="sm"
                disabled={offset === 0}
                onClick={() => setOffset(Math.max(0, offset - limit))}
              >
                Previous
              </Button>
              <span className="text-sm text-muted-gray">
                {offset + 1}-{Math.min(offset + limit, total)} of {total}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={offset + limit >= total}
                onClick={() => setOffset(offset + limit)}
              >
                Next
              </Button>
            </div>
          )}
        </>
      )}

      {/* Transfer Dialog */}
      <ContactAssignmentDialog
        open={!!transferTarget}
        onOpenChange={(open) => { if (!open) setTransferTarget(null); }}
        contact={transferTarget}
      />
    </div>
  );
};

export default LeadManagement;
