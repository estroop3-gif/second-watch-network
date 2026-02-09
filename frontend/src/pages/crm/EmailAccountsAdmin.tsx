import { useState } from 'react';
import { Plus, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useEmailAccounts, useCreateEmailAccount, useDeactivateEmailAccount } from '@/hooks/crm/useEmail';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';

const EmailAccountsAdmin = () => {
  const { data, isLoading } = useEmailAccounts();
  const createAccount = useCreateEmailAccount();
  const deactivateAccount = useDeactivateEmailAccount();
  const [showCreate, setShowCreate] = useState(false);
  const [selectedProfileId, setSelectedProfileId] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [emailAddress, setEmailAddress] = useState('');

  // Fetch sales reps for the create dialog
  const { data: repsData } = useQuery({
    queryKey: ['crm-team-reps'],
    queryFn: () => api.get<{ reps: any[] }>('/api/v1/admin/crm/reps'),
    enabled: showCreate,
  });

  const handleProfileSelect = (profileId: string) => {
    setSelectedProfileId(profileId);
    const rep = repsData?.reps?.find((r: any) => r.id === profileId);
    if (rep) {
      const names = (rep.full_name || '').toLowerCase().split(' ');
      const first = names[0] || '';
      const last = names[names.length - 1] || '';
      setEmailAddress(`${first}.${last}@theswn.com`);
      setDisplayName(rep.full_name || '');
    }
  };

  const handleCreate = () => {
    createAccount.mutate(
      { profile_id: selectedProfileId, email_address: emailAddress, display_name: displayName },
      {
        onSuccess: () => {
          setShowCreate(false);
          setSelectedProfileId('');
          setDisplayName('');
          setEmailAddress('');
        },
      }
    );
  };

  const handleDeactivate = (accountId: string, name: string) => {
    if (confirm(`Deactivate email account for ${name}?`)) {
      deactivateAccount.mutate(accountId);
    }
  };

  const accounts = data?.accounts || [];

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-medium text-bone-white">Email Accounts</h2>
        <Button onClick={() => setShowCreate(true)} size="sm" className="bg-accent-yellow text-charcoal-black hover:bg-accent-yellow/90">
          <Plus className="h-4 w-4 mr-1" /> Create Account
        </Button>
      </div>

      {isLoading ? (
        <div className="text-muted-gray">Loading accounts...</div>
      ) : !accounts.length ? (
        <div className="text-center py-8 text-muted-gray">
          <p>No email accounts configured yet.</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-muted-gray/30 text-muted-gray text-left">
                <th className="pb-2 pr-4">Display Name</th>
                <th className="pb-2 pr-4">Email Address</th>
                <th className="pb-2 pr-4">Profile</th>
                <th className="pb-2 pr-4">Status</th>
                <th className="pb-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {accounts.map((acct: any) => (
                <tr key={acct.id} className="border-b border-muted-gray/10">
                  <td className="py-3 pr-4 text-bone-white">{acct.display_name}</td>
                  <td className="py-3 pr-4 text-muted-gray">{acct.email_address}</td>
                  <td className="py-3 pr-4 text-muted-gray">{acct.profile_name}</td>
                  <td className="py-3 pr-4">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${
                      acct.is_active
                        ? 'bg-green-900/30 text-green-300'
                        : 'bg-red-900/30 text-red-300'
                    }`}>
                      {acct.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="py-3">
                    {acct.is_active && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeactivate(acct.id, acct.display_name)}
                        className="text-red-400 hover:text-red-300 hover:bg-red-900/20 h-7 px-2"
                      >
                        <XCircle className="h-4 w-4 mr-1" /> Deactivate
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="bg-charcoal-black border-muted-gray/30 text-bone-white max-w-md">
          <DialogHeader>
            <DialogTitle>Create Email Account</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Sales Rep</Label>
              <Select value={selectedProfileId} onValueChange={handleProfileSelect}>
                <SelectTrigger className="bg-charcoal-black border-muted-gray/30">
                  <SelectValue placeholder="Select a rep..." />
                </SelectTrigger>
                <SelectContent>
                  {repsData?.reps?.map((rep: any) => (
                    <SelectItem key={rep.id} value={rep.id}>{rep.full_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Display Name</Label>
              <Input
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="bg-charcoal-black border-muted-gray/30"
                placeholder="John Doe"
              />
            </div>
            <div>
              <Label>Email Address</Label>
              <Input
                value={emailAddress}
                onChange={(e) => setEmailAddress(e.target.value)}
                className="bg-charcoal-black border-muted-gray/30"
                placeholder="john.doe@secondwatch.network"
              />
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <Button variant="outline" onClick={() => setShowCreate(false)}>Cancel</Button>
              <Button
                onClick={handleCreate}
                disabled={!selectedProfileId || !emailAddress || !displayName || createAccount.isPending}
                className="bg-accent-yellow text-charcoal-black hover:bg-accent-yellow/90"
              >
                {createAccount.isPending ? 'Creating...' : 'Create Account'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default EmailAccountsAdmin;
