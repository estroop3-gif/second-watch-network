import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import ContactCard from '@/components/crm/ContactCard';
import ContactForm from '@/components/crm/ContactForm';
import ContactFilters from '@/components/crm/ContactFilters';
import { useContacts, useCreateContact } from '@/hooks/crm';
import { useEmailCompose } from '@/context/EmailComposeContext';
import { toast } from 'sonner';

const Contacts = () => {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [temperature, setTemperature] = useState('all');
  const [status, setStatus] = useState('all');
  const [sortBy, setSortBy] = useState('created_at');
  const [showCreate, setShowCreate] = useState(false);
  const [offset, setOffset] = useState(0);
  const limit = 50;

  const { data, isLoading } = useContacts({
    search: search || undefined,
    temperature: temperature !== 'all' ? temperature : undefined,
    status: status !== 'all' ? status : undefined,
    sort_by: sortBy,
    sort_order: sortBy === 'created_at' ? 'desc' : 'asc',
    limit,
    offset,
  });

  const createContact = useCreateContact();
  const { openCompose } = useEmailCompose();

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

  const contacts = data?.contacts || [];
  const total = data?.total || 0;

  const handleCreate = async (values: any) => {
    try {
      const result = await createContact.mutateAsync(values);
      setShowCreate(false);
      toast.success('Contact created');
      navigate(`/crm/contacts/${result.id}`);
    } catch (err: any) {
      toast.error(err.message || 'Failed to create contact');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-heading text-bone-white">Contacts</h1>
        <Button
          onClick={() => setShowCreate(true)}
          className="bg-accent-yellow text-charcoal-black hover:bg-accent-yellow/90"
        >
          <Plus className="h-4 w-4 mr-2" /> New Contact
        </Button>
      </div>

      <ContactFilters
        search={search}
        onSearchChange={v => { setSearch(v); setOffset(0); }}
        temperature={temperature}
        onTemperatureChange={v => { setTemperature(v); setOffset(0); }}
        status={status}
        onStatusChange={v => { setStatus(v); setOffset(0); }}
        sortBy={sortBy}
        onSortByChange={v => { setSortBy(v); setOffset(0); }}
      />

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map(i => (
            <Skeleton key={i} className="h-40 rounded-lg" />
          ))}
        </div>
      ) : contacts.length === 0 ? (
        <div className="text-center py-12 text-muted-gray">
          <p className="text-lg mb-2">No contacts found</p>
          <p className="text-sm">Create your first contact to get started.</p>
        </div>
      ) : (
        <>
          <div className="text-sm text-muted-gray">{total} contacts</div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {contacts.map((contact: any) => (
              <ContactCard key={contact.id} contact={contact} onEmail={handleEmail} />
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

      {/* Create Contact Dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="bg-charcoal-black border-muted-gray max-w-2xl max-h-[90vh] flex flex-col overflow-hidden p-0">
          <DialogHeader className="p-6 pb-0">
            <DialogTitle className="text-bone-white">New Contact</DialogTitle>
          </DialogHeader>
          <div className="overflow-y-auto flex-1 p-6 pt-4">
            <ContactForm
              onSubmit={handleCreate}
              isSubmitting={createContact.isPending}
              submitLabel="Create Contact"
            />
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Contacts;
