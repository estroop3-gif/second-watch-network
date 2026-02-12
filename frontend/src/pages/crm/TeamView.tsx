import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Users, Phone, Mail, MessageSquare, Monitor, UserPlus, MoreVertical, Search } from 'lucide-react';
import {
  useCRMReps,
  useAddCRMTeamMember,
  useRemoveCRMTeamMember,
  useUpdateCRMTeamMemberRole,
} from '@/hooks/crm';
import { api } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';

const CRM_ROLES = [
  { value: 'sales_rep', label: 'Sales Rep' },
  { value: 'sales_agent', label: 'Sales Agent' },
  { value: 'sales_admin', label: 'Sales Admin' },
] as const;

function getRoleBadge(rep: any) {
  if (rep.is_superadmin) return { label: 'Superadmin', variant: 'destructive' as const };
  if (rep.is_admin) return { label: 'Admin', variant: 'destructive' as const };
  if (rep.is_sales_admin) return { label: 'Sales Admin', variant: 'default' as const };
  if (rep.is_sales_agent) return { label: 'Sales Agent', variant: 'secondary' as const };
  if (rep.is_sales_rep) return { label: 'Sales Rep', variant: 'outline' as const };
  return null;
}

function getCurrentCRMRole(rep: any): string | null {
  if (rep.is_sales_admin) return 'sales_admin';
  if (rep.is_sales_agent) return 'sales_agent';
  if (rep.is_sales_rep) return 'sales_rep';
  return null;
}

// --- Add to Team Dialog ---
function AddToTeamDialog({
  open,
  onOpenChange,
  existingRepIds,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  existingRepIds: Set<string>;
}) {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [selectedRole, setSelectedRole] = useState('sales_rep');
  const addMember = useAddCRMTeamMember();
  const { toast } = useToast();

  const handleSearch = async (query: string) => {
    setSearchQuery(query);
    if (query.length < 2) {
      setSearchResults([]);
      return;
    }
    setSearching(true);
    try {
      const results = await api.searchUsers(query, 20);
      setSearchResults(results || []);
    } catch {
      setSearchResults([]);
    } finally {
      setSearching(false);
    }
  };

  const handleAdd = () => {
    if (!selectedUser) return;
    addMember.mutate(
      { userId: selectedUser.id, role: selectedRole },
      {
        onSuccess: () => {
          toast({ title: `${selectedUser.full_name} added to team as ${CRM_ROLES.find(r => r.value === selectedRole)?.label}` });
          onOpenChange(false);
          setSelectedUser(null);
          setSearchQuery('');
          setSearchResults([]);
          setSelectedRole('sales_rep');
        },
        onError: (err: any) => {
          toast({ title: 'Failed to add team member', description: err?.message || 'Unknown error', variant: 'destructive' });
        },
      }
    );
  };

  const handleClose = (open: boolean) => {
    if (!open) {
      setSelectedUser(null);
      setSearchQuery('');
      setSearchResults([]);
      setSelectedRole('sales_rep');
    }
    onOpenChange(open);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md bg-charcoal-black border-muted-gray/30">
        <DialogHeader>
          <DialogTitle className="text-bone-white">Add to Sales Team</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-gray" />
            <Input
              placeholder="Search users by name or email..."
              value={searchQuery}
              onChange={(e) => handleSearch(e.target.value)}
              className="pl-9 bg-muted-gray/10 border-muted-gray/30 text-bone-white"
            />
          </div>

          {/* Results */}
          {searchQuery.length >= 2 && (
            <div className="max-h-48 overflow-y-auto space-y-1 rounded border border-muted-gray/20 p-1">
              {searching && <div className="p-3 text-sm text-muted-gray text-center">Searching...</div>}
              {!searching && searchResults.length === 0 && (
                <div className="p-3 text-sm text-muted-gray text-center">No users found</div>
              )}
              {searchResults.map((user) => {
                const isAlreadyOnTeam = existingRepIds.has(user.id);
                const isSelected = selectedUser?.id === user.id;
                return (
                  <button
                    key={user.id}
                    disabled={isAlreadyOnTeam}
                    onClick={() => setSelectedUser(user)}
                    className={`w-full flex items-center gap-3 p-2 rounded text-left transition-colors ${
                      isAlreadyOnTeam
                        ? 'opacity-50 cursor-not-allowed'
                        : isSelected
                        ? 'bg-accent-yellow/20 border border-accent-yellow/40'
                        : 'hover:bg-muted-gray/10'
                    }`}
                  >
                    {user.avatar_url ? (
                      <img src={user.avatar_url} alt="" className="h-8 w-8 rounded-full" />
                    ) : (
                      <div className="h-8 w-8 rounded-full bg-accent-yellow/20 flex items-center justify-center">
                        <Users className="h-4 w-4 text-accent-yellow" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="text-sm text-bone-white truncate">{user.full_name}</div>
                      <div className="text-xs text-muted-gray truncate">{user.email}</div>
                    </div>
                    {isAlreadyOnTeam && (
                      <span className="text-xs text-muted-gray shrink-0">Already on team</span>
                    )}
                  </button>
                );
              })}
            </div>
          )}

          {/* Selected user + role picker */}
          {selectedUser && (
            <div className="space-y-3 border-t border-muted-gray/20 pt-3">
              <div className="flex items-center gap-3">
                {selectedUser.avatar_url ? (
                  <img src={selectedUser.avatar_url} alt="" className="h-8 w-8 rounded-full" />
                ) : (
                  <div className="h-8 w-8 rounded-full bg-accent-yellow/20 flex items-center justify-center">
                    <Users className="h-4 w-4 text-accent-yellow" />
                  </div>
                )}
                <div>
                  <div className="text-sm font-medium text-bone-white">{selectedUser.full_name}</div>
                  <div className="text-xs text-muted-gray">{selectedUser.email}</div>
                </div>
              </div>

              <div>
                <label className="text-xs text-muted-gray mb-1 block">Role</label>
                <Select value={selectedRole} onValueChange={setSelectedRole}>
                  <SelectTrigger className="bg-muted-gray/10 border-muted-gray/30 text-bone-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CRM_ROLES.map((r) => (
                      <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => handleClose(false)} className="text-muted-gray">
            Cancel
          </Button>
          <Button
            onClick={handleAdd}
            disabled={!selectedUser || addMember.isPending}
            className="bg-accent-yellow text-charcoal-black hover:bg-accent-yellow/90"
          >
            {addMember.isPending ? 'Adding...' : 'Add to Team'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// --- Change Role Dialog ---
function ChangeRoleDialog({
  open,
  onOpenChange,
  rep,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  rep: any;
}) {
  const currentRole = getCurrentCRMRole(rep);
  const [newRole, setNewRole] = useState(currentRole || 'sales_rep');
  const updateRole = useUpdateCRMTeamMemberRole();
  const { toast } = useToast();

  const handleSave = () => {
    updateRole.mutate(
      { userId: rep.id, role: newRole },
      {
        onSuccess: () => {
          toast({ title: `${rep.full_name} role updated to ${CRM_ROLES.find(r => r.value === newRole)?.label}` });
          onOpenChange(false);
        },
        onError: (err: any) => {
          toast({ title: 'Failed to update role', description: err?.message || 'Unknown error', variant: 'destructive' });
        },
      }
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm bg-charcoal-black border-muted-gray/30">
        <DialogHeader>
          <DialogTitle className="text-bone-white">Change Role — {rep.full_name}</DialogTitle>
        </DialogHeader>
        <div>
          <Select value={newRole} onValueChange={setNewRole}>
            <SelectTrigger className="bg-muted-gray/10 border-muted-gray/30 text-bone-white">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {CRM_ROLES.map((r) => (
                <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} className="text-muted-gray">Cancel</Button>
          <Button
            onClick={handleSave}
            disabled={newRole === currentRole || updateRole.isPending}
            className="bg-accent-yellow text-charcoal-black hover:bg-accent-yellow/90"
          >
            {updateRole.isPending ? 'Saving...' : 'Save'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// --- Main TeamView ---
const TeamView = () => {
  const { data, isLoading } = useCRMReps();
  const reps = data?.reps || [];
  const removeMember = useRemoveCRMTeamMember();
  const { toast } = useToast();

  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [changeRoleRep, setChangeRoleRep] = useState<any>(null);
  const [removeConfirmRep, setRemoveConfirmRep] = useState<any>(null);

  const existingRepIds = new Set(reps.map((r: any) => r.id));

  const handleRemove = () => {
    if (!removeConfirmRep) return;
    removeMember.mutate(removeConfirmRep.id, {
      onSuccess: () => {
        toast({ title: `${removeConfirmRep.full_name} removed from team` });
        setRemoveConfirmRep(null);
      },
      onError: (err: any) => {
        toast({ title: 'Failed to remove', description: err?.message || 'Unknown error', variant: 'destructive' });
      },
    });
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-heading text-bone-white">Sales Team</h1>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-48" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-heading text-bone-white">Sales Team</h1>
        <Button
          onClick={() => setAddDialogOpen(true)}
          className="bg-accent-yellow text-charcoal-black hover:bg-accent-yellow/90"
        >
          <UserPlus className="h-4 w-4 mr-2" />
          Add to Team
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {reps.map((rep: any) => {
          const roleBadge = getRoleBadge(rep);
          const crmRole = getCurrentCRMRole(rep);
          const isSystemAdmin = rep.is_admin || rep.is_superadmin;
          const canManage = crmRole !== null; // only manage CRM roles, not system admins without CRM role

          return (
            <Card key={rep.id} className="bg-charcoal-black border-muted-gray/30">
              <CardHeader className="pb-3">
                <div className="flex items-center gap-3">
                  {rep.avatar_url ? (
                    <img src={rep.avatar_url} alt="" className="h-10 w-10 rounded-full" />
                  ) : (
                    <div className="h-10 w-10 rounded-full bg-accent-yellow/20 flex items-center justify-center">
                      <Users className="h-5 w-5 text-accent-yellow" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <CardTitle className="text-bone-white text-base truncate">{rep.full_name}</CardTitle>
                      {roleBadge && (
                        <Badge variant={roleBadge.variant} className="text-[10px] shrink-0">
                          {roleBadge.label}
                        </Badge>
                      )}
                    </div>
                    <div className="text-xs text-muted-gray truncate">{rep.email}</div>
                  </div>

                  {/* Three-dot menu — only for users with CRM roles */}
                  {(canManage || isSystemAdmin) && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-gray hover:text-bone-white">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => setChangeRoleRep(rep)}>
                          Change Role
                        </DropdownMenuItem>
                        {!isSystemAdmin && (
                          <DropdownMenuItem
                            className="text-red-400 focus:text-red-400"
                            onClick={() => setRemoveConfirmRep(rep)}
                          >
                            Remove from Team
                          </DropdownMenuItem>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-3 gap-3 text-center mb-3">
                  <div className="p-2 rounded bg-muted-gray/10">
                    <div className="text-lg font-semibold text-bone-white">{rep.contact_count || 0}</div>
                    <div className="text-xs text-muted-gray">Contacts</div>
                  </div>
                  <div className="p-2 rounded bg-muted-gray/10">
                    <div className="text-lg font-semibold text-bone-white">{rep.activities_today || 0}</div>
                    <div className="text-xs text-muted-gray">Today</div>
                  </div>
                  <div className="p-2 rounded bg-muted-gray/10">
                    <div className="text-lg font-semibold text-bone-white">{rep.activities_30d || 0}</div>
                    <div className="text-xs text-muted-gray">30d</div>
                  </div>
                </div>

                <div className="flex items-center gap-4 text-xs text-muted-gray">
                  <span className="flex items-center gap-1">
                    <Phone className="h-3 w-3" /> {rep.today_calls || 0}
                  </span>
                  <span className="flex items-center gap-1">
                    <Mail className="h-3 w-3" /> {rep.today_emails || 0}
                  </span>
                  <span className="flex items-center gap-1">
                    <MessageSquare className="h-3 w-3" /> {rep.today_texts || 0}
                  </span>
                  <span className="flex items-center gap-1">
                    <Monitor className="h-3 w-3" /> {rep.today_demos || 0}
                  </span>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {reps.length === 0 && (
        <div className="text-center py-12 text-muted-gray">
          No sales team members found. Click "Add to Team" to get started.
        </div>
      )}

      {/* Add to Team Dialog */}
      <AddToTeamDialog
        open={addDialogOpen}
        onOpenChange={setAddDialogOpen}
        existingRepIds={existingRepIds}
      />

      {/* Change Role Dialog */}
      {changeRoleRep && (
        <ChangeRoleDialog
          open={!!changeRoleRep}
          onOpenChange={(open) => !open && setChangeRoleRep(null)}
          rep={changeRoleRep}
        />
      )}

      {/* Remove Confirmation */}
      <AlertDialog open={!!removeConfirmRep} onOpenChange={(open) => !open && setRemoveConfirmRep(null)}>
        <AlertDialogContent className="bg-charcoal-black border-muted-gray/30">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-bone-white">Remove from Team</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove <strong>{removeConfirmRep?.full_name}</strong> from the sales team?
              This will clear all their CRM role flags.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="text-muted-gray">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleRemove}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              {removeMember.isPending ? 'Removing...' : 'Remove'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default TeamView;
