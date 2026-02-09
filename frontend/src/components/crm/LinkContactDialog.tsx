import { useState, useMemo } from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Search, Link2, Loader2, User } from 'lucide-react';
import { useContacts } from '@/hooks/crm/useContacts';
import { useLinkContact } from '@/hooks/crm/useEmail';
import { useToast } from '@/hooks/use-toast';

interface LinkContactDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  threadId: string;
}

const LinkContactDialog = ({ open, onOpenChange, threadId }: LinkContactDialogProps) => {
  const [search, setSearch] = useState('');
  const { toast } = useToast();

  const { data: contactsData, isLoading } = useContacts({
    search: search.length >= 2 ? search : undefined,
    limit: 20,
  });

  const linkContact = useLinkContact();

  const contacts = useMemo(() => {
    const list = contactsData?.contacts || contactsData || [];
    return Array.isArray(list) ? list : [];
  }, [contactsData]);

  const handleLink = (contactId: string) => {
    linkContact.mutate(
      { threadId, contactId },
      {
        onSuccess: () => {
          toast({ title: 'Contact linked', description: 'Thread is now linked to the selected contact.' });
          onOpenChange(false);
          setSearch('');
        },
        onError: () => {
          toast({ title: 'Error', description: 'Failed to link contact.', variant: 'destructive' });
        },
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-charcoal-black border-muted-gray">
        <DialogHeader>
          <DialogTitle className="text-bone-white">Link to Contact</DialogTitle>
          <DialogDescription className="text-muted-gray">
            Search for a CRM contact to associate with this thread.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-gray" />
            <Input
              placeholder="Search contacts by name or email..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="bg-charcoal-black border-muted-gray pl-10"
              autoFocus
            />
          </div>

          <div className="max-h-64 overflow-y-auto space-y-1">
            {isLoading && search.length >= 2 && (
              <div className="flex items-center justify-center py-6">
                <Loader2 className="h-5 w-5 animate-spin text-muted-gray" />
              </div>
            )}

            {contacts.map((c: any) => (
              <div
                key={c.id}
                className="flex items-center justify-between p-3 rounded-lg border border-muted-gray/20 hover:border-accent-yellow/30 transition-colors"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="h-8 w-8 rounded-full bg-muted-gray/20 flex items-center justify-center flex-shrink-0">
                    <User className="h-4 w-4 text-muted-gray" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-bone-white truncate">
                      {c.first_name} {c.last_name}
                    </div>
                    {c.email && (
                      <div className="text-xs text-muted-gray truncate">{c.email}</div>
                    )}
                  </div>
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={linkContact.isPending}
                  onClick={() => handleLink(c.id)}
                  className="text-accent-yellow hover:text-accent-yellow flex-shrink-0"
                >
                  <Link2 className="h-4 w-4 mr-1" /> Link
                </Button>
              </div>
            ))}

            {contacts.length === 0 && search.length >= 2 && !isLoading && (
              <p className="text-center text-sm text-muted-gray py-6">No contacts found</p>
            )}

            {search.length < 2 && (
              <p className="text-center text-sm text-muted-gray py-6">
                Type at least 2 characters to search
              </p>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default LinkContactDialog;
