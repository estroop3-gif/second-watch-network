import { useState } from 'react';
import { ShieldOff, Mail, Phone, MessageSquare } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { useRepDNCList, useUpdateContactDNC } from '@/hooks/crm/useCampaigns';

const RepDNCList = () => {
  const [page, setPage] = useState(0);
  const limit = 50;
  const { data, isLoading } = useRepDNCList({ limit, offset: page * limit });
  const updateDNC = useUpdateContactDNC();

  const [editContact, setEditContact] = useState<any>(null);
  const [dncForm, setDncForm] = useState({
    do_not_email: false,
    do_not_call: false,
    do_not_text: false,
  });

  const openEdit = (contact: any) => {
    setEditContact(contact);
    setDncForm({
      do_not_email: !!contact.do_not_email,
      do_not_call: !!contact.do_not_call,
      do_not_text: !!contact.do_not_text,
    });
  };

  const saveDNC = () => {
    if (!editContact) return;
    updateDNC.mutate(
      { contactId: editContact.id, data: dncForm },
      { onSuccess: () => setEditContact(null) }
    );
  };

  const totalPages = data?.total ? Math.ceil(data.total / limit) : 0;

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <ShieldOff className="h-6 w-6 text-red-400" />
        <h1 className="text-2xl font-heading text-bone-white">Do Not Contact List</h1>
        {data?.total !== undefined && (
          <span className="text-muted-gray text-sm">({data.total} contacts)</span>
        )}
      </div>

      {isLoading ? (
        <div className="text-muted-gray">Loading DNC list...</div>
      ) : !data?.contacts?.length ? (
        <div className="text-center py-12 text-muted-gray">
          <p className="text-lg mb-2">No contacts on the DNC list</p>
          <p className="text-sm">Contacts with DNC flags will appear here.</p>
        </div>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-muted-gray/30 text-muted-gray text-left">
                  <th className="pb-3 pr-4">Name</th>
                  <th className="pb-3 pr-4">Email</th>
                  <th className="pb-3 pr-4">Phone</th>
                  <th className="pb-3 pr-4">Company</th>
                  <th className="pb-3 pr-4">Status</th>
                  <th className="pb-3 pr-4 text-center">No Email</th>
                  <th className="pb-3 pr-4 text-center">No Call</th>
                  <th className="pb-3 pr-4 text-center">No Text</th>
                  <th className="pb-3">Rep</th>
                  <th className="pb-3"></th>
                </tr>
              </thead>
              <tbody>
                {data.contacts.map((contact: any) => (
                  <tr key={contact.id} className="border-b border-muted-gray/10">
                    <td className="py-3 pr-4 text-bone-white">
                      {contact.first_name} {contact.last_name}
                    </td>
                    <td className="py-3 pr-4 text-muted-gray">{contact.email || '-'}</td>
                    <td className="py-3 pr-4 text-muted-gray">{contact.phone || '-'}</td>
                    <td className="py-3 pr-4 text-muted-gray">{contact.company || '-'}</td>
                    <td className="py-3 pr-4">
                      <span className={`text-xs px-2 py-1 rounded-full ${
                        contact.status === 'do_not_contact'
                          ? 'bg-red-900/40 text-red-400'
                          : 'bg-muted-gray/30 text-bone-white'
                      }`}>
                        {contact.status}
                      </span>
                    </td>
                    <td className="py-3 pr-4 text-center">
                      {contact.do_not_email && <Mail className="h-4 w-4 text-red-400 mx-auto" />}
                    </td>
                    <td className="py-3 pr-4 text-center">
                      {contact.do_not_call && <Phone className="h-4 w-4 text-red-400 mx-auto" />}
                    </td>
                    <td className="py-3 pr-4 text-center">
                      {contact.do_not_text && <MessageSquare className="h-4 w-4 text-red-400 mx-auto" />}
                    </td>
                    <td className="py-3 pr-4 text-muted-gray text-xs">
                      {contact.assigned_rep_name || '-'}
                    </td>
                    <td className="py-3">
                      <Button variant="ghost" size="sm" onClick={() => openEdit(contact)}>
                        Edit
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 mt-6">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                disabled={page === 0}
              >
                Previous
              </Button>
              <span className="text-sm text-muted-gray">
                Page {page + 1} of {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                disabled={page >= totalPages - 1}
              >
                Next
              </Button>
            </div>
          )}
        </>
      )}

      <Dialog open={!!editContact} onOpenChange={(open) => !open && setEditContact(null)}>
        <DialogContent className="bg-charcoal-black border-muted-gray/30 text-bone-white max-w-sm">
          <DialogHeader>
            <DialogTitle>
              Edit DNC — {editContact?.first_name} {editContact?.last_name}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="flex items-center justify-between">
              <Label className="flex items-center gap-2">
                <Mail className="h-4 w-4" /> Do Not Email
              </Label>
              <Switch
                checked={dncForm.do_not_email}
                onCheckedChange={(v) => setDncForm({ ...dncForm, do_not_email: v })}
              />
            </div>
            <div className="flex items-center justify-between">
              <Label className="flex items-center gap-2">
                <Phone className="h-4 w-4" /> Do Not Call
              </Label>
              <Switch
                checked={dncForm.do_not_call}
                onCheckedChange={(v) => setDncForm({ ...dncForm, do_not_call: v })}
              />
            </div>
            <div className="flex items-center justify-between">
              <Label className="flex items-center gap-2">
                <MessageSquare className="h-4 w-4" /> Do Not Text
              </Label>
              <Switch
                checked={dncForm.do_not_text}
                onCheckedChange={(v) => setDncForm({ ...dncForm, do_not_text: v })}
              />
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <Button variant="outline" onClick={() => setEditContact(null)}>Cancel</Button>
              <Button
                onClick={saveDNC}
                disabled={updateDNC.isPending}
                className="bg-accent-yellow text-charcoal-black hover:bg-accent-yellow/90"
              >
                {updateDNC.isPending ? 'Saving...' : 'Save'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default RepDNCList;
