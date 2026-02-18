import { useState } from 'react';
import {
  useAdminEmailAccounts,
  useCreateAdminEmailAccount,
  useUpdateAdminEmailAccount,
  useDeactivateAdminEmailAccount,
  useAdminEmailAccountAccess,
  useGrantAdminEmailAccess,
  useRevokeAdminEmailAccess,
} from '@/hooks/useAdminEmail';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Plus, Pencil, Power, Users, X, Loader2, Search } from 'lucide-react';
import { toast } from 'sonner';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';

const AdminEmailAccounts = () => {
  const { data, isLoading } = useAdminEmailAccounts();
  const accounts = data?.accounts || [];

  const [showCreate, setShowCreate] = useState(false);
  const [editAccount, setEditAccount] = useState<any>(null);
  const [accessAccount, setAccessAccount] = useState<any>(null);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-heading text-bone-white">Platform Email Accounts</h2>
        <Button onClick={() => setShowCreate(true)} className="bg-accent-yellow text-charcoal-black hover:bg-accent-yellow/90">
          <Plus className="h-4 w-4 mr-2" />
          Create Account
        </Button>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
        </div>
      ) : accounts.length === 0 ? (
        <div className="text-center py-12 text-muted-gray">
          <p>No admin/system email accounts yet.</p>
          <p className="text-sm mt-1">Create one to start sending and receiving platform emails.</p>
        </div>
      ) : (
        <div className="bg-gray-900 border border-muted-gray rounded-lg overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="border-muted-gray hover:bg-transparent">
                <TableHead className="text-muted-gray">Email Address</TableHead>
                <TableHead className="text-muted-gray">Display Name</TableHead>
                <TableHead className="text-muted-gray">Type</TableHead>
                <TableHead className="text-muted-gray">Status</TableHead>
                <TableHead className="text-muted-gray">Users</TableHead>
                <TableHead className="text-muted-gray">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {accounts.map((account: any) => (
                <TableRow key={account.id} className="border-muted-gray/50">
                  <TableCell className="font-mono text-sm">{account.email_address}</TableCell>
                  <TableCell>{account.display_name}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className={
                      account.account_type === 'admin'
                        ? 'border-accent-yellow text-accent-yellow'
                        : 'border-muted-gray text-muted-gray'
                    }>
                      {account.account_type}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge className={account.is_active ? 'bg-emerald-600' : 'bg-red-600'}>
                      {account.is_active ? 'Active' : 'Inactive'}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-gray">{account.access_count || 0}</TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="sm" onClick={() => setEditAccount(account)} title="Edit">
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => setAccessAccount(account)} title="Manage Access">
                        <Users className="h-4 w-4" />
                      </Button>
                      <DeactivateButton accountId={account.id} isActive={account.is_active} />
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {showCreate && <CreateAccountDialog onClose={() => setShowCreate(false)} />}
      {editAccount && <EditAccountDialog account={editAccount} onClose={() => setEditAccount(null)} />}
      {accessAccount && <ManageAccessDialog account={accessAccount} onClose={() => setAccessAccount(null)} />}
    </div>
  );
};

// ============================================================================
// Create Account Dialog
// ============================================================================

const CreateAccountDialog = ({ onClose }: { onClose: () => void }) => {
  const [email, setEmail] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [accountType, setAccountType] = useState('admin');
  const create = useCreateAdminEmailAccount();

  const handleSubmit = () => {
    if (!email || !displayName) {
      toast.error('Email address and display name are required');
      return;
    }
    create.mutate(
      { email_address: email, display_name: displayName, account_type: accountType },
      {
        onSuccess: () => {
          toast.success('Email account created');
          onClose();
        },
        onError: (err: any) => toast.error(err?.message || 'Failed to create account'),
      }
    );
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="bg-gray-900 border-muted-gray">
        <DialogHeader>
          <DialogTitle className="text-accent-yellow">Create Email Account</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label className="text-bone-white/70 text-xs">Email Address</Label>
            <Input value={email} onChange={e => setEmail(e.target.value)}
              placeholder="admin@theswn.com"
              className="bg-charcoal-black border-muted-gray/50 text-bone-white" />
          </div>
          <div>
            <Label className="text-bone-white/70 text-xs">Display Name</Label>
            <Input value={displayName} onChange={e => setDisplayName(e.target.value)}
              placeholder="SWN Admin"
              className="bg-charcoal-black border-muted-gray/50 text-bone-white" />
          </div>
          <div>
            <Label className="text-bone-white/70 text-xs">Account Type</Label>
            <Select value={accountType} onValueChange={setAccountType}>
              <SelectTrigger className="bg-charcoal-black border-muted-gray/50 text-bone-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="admin">Admin</SelectItem>
                <SelectItem value="system">System</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={onClose}>Cancel</Button>
            <Button onClick={handleSubmit} disabled={create.isPending}
              className="bg-accent-yellow text-charcoal-black hover:bg-accent-yellow/90">
              {create.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Create
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

// ============================================================================
// Edit Account Dialog
// ============================================================================

const EditAccountDialog = ({ account, onClose }: { account: any; onClose: () => void }) => {
  const [displayName, setDisplayName] = useState(account.display_name || '');
  const [signatureHtml, setSignatureHtml] = useState(account.signature_html || '');
  const update = useUpdateAdminEmailAccount();

  const handleSubmit = () => {
    update.mutate(
      { id: account.id, data: { display_name: displayName, signature_html: signatureHtml || null } },
      {
        onSuccess: () => {
          toast.success('Account updated');
          onClose();
        },
        onError: (err: any) => toast.error(err?.message || 'Failed to update'),
      }
    );
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="bg-gray-900 border-muted-gray">
        <DialogHeader>
          <DialogTitle className="text-accent-yellow">Edit {account.email_address}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label className="text-bone-white/70 text-xs">Display Name</Label>
            <Input value={displayName} onChange={e => setDisplayName(e.target.value)}
              className="bg-charcoal-black border-muted-gray/50 text-bone-white" />
          </div>
          <div>
            <Label className="text-bone-white/70 text-xs">Signature (HTML)</Label>
            <textarea value={signatureHtml} onChange={e => setSignatureHtml(e.target.value)}
              rows={4}
              className="w-full bg-charcoal-black border border-muted-gray/50 text-bone-white rounded-md p-2 text-sm font-mono" />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={onClose}>Cancel</Button>
            <Button onClick={handleSubmit} disabled={update.isPending}
              className="bg-accent-yellow text-charcoal-black hover:bg-accent-yellow/90">
              {update.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Save
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

// ============================================================================
// Deactivate Button
// ============================================================================

const DeactivateButton = ({ accountId, isActive }: { accountId: string; isActive: boolean }) => {
  const deactivate = useDeactivateAdminEmailAccount();
  const update = useUpdateAdminEmailAccount();

  const handleToggle = () => {
    if (isActive) {
      deactivate.mutate(accountId, {
        onSuccess: () => toast.success('Account deactivated'),
        onError: (err: any) => toast.error(err?.message || 'Failed'),
      });
    } else {
      update.mutate({ id: accountId, data: { is_active: true } }, {
        onSuccess: () => toast.success('Account reactivated'),
        onError: (err: any) => toast.error(err?.message || 'Failed'),
      });
    }
  };

  return (
    <Button variant="ghost" size="sm" onClick={handleToggle}
      disabled={deactivate.isPending || update.isPending}
      title={isActive ? 'Deactivate' : 'Reactivate'}
      className={isActive ? 'text-muted-gray hover:text-red-400' : 'text-emerald-500'}
    >
      <Power className="h-4 w-4" />
    </Button>
  );
};

// ============================================================================
// Manage Access Dialog
// ============================================================================

const ManageAccessDialog = ({ account, onClose }: { account: any; onClose: () => void }) => {
  const { data, isLoading } = useAdminEmailAccountAccess(account.id);
  const grants = data?.grants || [];
  const grant = useGrantAdminEmailAccess();
  const revoke = useRevokeAdminEmailAccess();
  const [search, setSearch] = useState('');

  // Search for users to add
  const { data: searchResults } = useQuery({
    queryKey: ['profile-search', search],
    queryFn: async () => {
      if (search.length < 2) return [];
      const res = await api.get<any[]>(`/api/v1/admin/users/search?q=${encodeURIComponent(search)}&limit=10`);
      return res || [];
    },
    enabled: search.length >= 2,
  });

  const grantedIds = new Set(grants.map((g: any) => g.profile_id));

  const handleGrant = (profileId: string) => {
    grant.mutate(
      { accountId: account.id, data: { profile_id: profileId } },
      {
        onSuccess: () => {
          toast.success('Access granted');
          setSearch('');
        },
        onError: (err: any) => toast.error(err?.message || 'Failed'),
      }
    );
  };

  const handleRevoke = (profileId: string) => {
    revoke.mutate(
      { accountId: account.id, profileId },
      {
        onSuccess: () => toast.success('Access revoked'),
        onError: (err: any) => toast.error(err?.message || 'Failed'),
      }
    );
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="bg-gray-900 border-muted-gray max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-accent-yellow">Manage Access — {account.email_address}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <p className="text-xs text-muted-gray">All admins have implicit access. Add non-admin users below.</p>

          {/* Search to add */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-gray" />
            <Input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search users to grant access..."
              className="pl-10 bg-charcoal-black border-muted-gray/50 text-bone-white"
            />
          </div>

          {/* Search results */}
          {searchResults && searchResults.length > 0 && (
            <div className="border border-muted-gray/30 rounded-md max-h-40 overflow-y-auto">
              {searchResults.filter((u: any) => !grantedIds.has(u.id)).map((user: any) => (
                <button
                  key={user.id}
                  onClick={() => handleGrant(user.id)}
                  className="w-full flex items-center justify-between px-3 py-2 text-sm hover:bg-muted-gray/10 transition-colors"
                >
                  <span className="text-bone-white">{user.full_name || user.email}</span>
                  <span className="text-xs text-muted-gray">{user.email}</span>
                </button>
              ))}
            </div>
          )}

          {/* Current grants */}
          <div>
            <Label className="text-bone-white/70 text-xs mb-2 block">Users with Access</Label>
            {isLoading ? (
              <Skeleton className="h-20 w-full" />
            ) : grants.length === 0 ? (
              <p className="text-sm text-muted-gray py-4 text-center">No non-admin users have been granted access.</p>
            ) : (
              <div className="space-y-2">
                {grants.map((g: any) => (
                  <div key={g.id} className="flex items-center justify-between px-3 py-2 bg-muted-gray/5 rounded-md">
                    <div>
                      <p className="text-sm text-bone-white">{g.full_name}</p>
                      <p className="text-xs text-muted-gray">{g.email}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="border-muted-gray/50 text-muted-gray text-xs">{g.role}</Badge>
                      <Button variant="ghost" size="sm" onClick={() => handleRevoke(g.profile_id)}
                        disabled={revoke.isPending} className="text-muted-gray hover:text-red-400">
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="flex justify-end">
            <Button variant="ghost" onClick={onClose}>Close</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default AdminEmailAccounts;
