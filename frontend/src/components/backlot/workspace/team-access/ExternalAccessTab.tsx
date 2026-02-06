import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Checkbox } from '@/components/ui/checkbox';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
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
import {
  Plus,
  Loader2,
  Search,
  Eye,
  Check,
  Briefcase,
  FileText,
  Receipt,
  Clock,
} from 'lucide-react';
import {
  useExternalSeats,
  useAddExternalSeat,
  useUpdateExternalSeat,
  useRemoveExternalSeat,
  type ExternalSeat,
} from '@/hooks/backlot/useExternalSeats';
import { useUserSearch } from '@/hooks/useUserSearch';
import ExternalSeatCard from './ExternalSeatCard';
import ClientTabPermissionsEditor from './ClientTabPermissionsEditor';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface ExternalAccessTabProps {
  projectId: string;
}

const ExternalAccessTab: React.FC<ExternalAccessTabProps> = ({ projectId }) => {
  const { data: externalSeats, isLoading } = useExternalSeats(projectId);
  const addSeat = useAddExternalSeat(projectId);
  const updateSeat = useUpdateExternalSeat(projectId);
  const removeSeat = useRemoveExternalSeat(projectId);

  const [showAddDialog, setShowAddDialog] = useState(false);
  const [addSeatType, setAddSeatType] = useState<'project' | 'view_only'>('project');
  const [editingSeat, setEditingSeat] = useState<ExternalSeat | null>(null);
  const [editingClientSeat, setEditingClientSeat] = useState<ExternalSeat | null>(null);
  const [removingSeat, setRemovingSeat] = useState<ExternalSeat | null>(null);

  // Add form state
  const [newUserSearch, setNewUserSearch] = useState('');
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [canInvoice, setCanInvoice] = useState(true);
  const [canExpense, setCanExpense] = useState(true);
  const [canTimecard, setCanTimecard] = useState(true);

  const { data: searchResults, isLoading: searchingUsers } = useUserSearch(newUserSearch, { minLength: 2 });

  const freelancers = externalSeats?.filter(s => s.seat_type === 'project') || [];
  const clients = externalSeats?.filter(s => s.seat_type === 'view_only') || [];

  const resetAddForm = () => {
    setNewUserSearch('');
    setSelectedUserId(null);
    setCanInvoice(true);
    setCanExpense(true);
    setCanTimecard(true);
  };

  const handleAddSeat = async () => {
    if (!selectedUserId) return;
    try {
      await addSeat.mutateAsync({
        userId: selectedUserId,
        seatType: addSeatType,
        canInvoice: addSeatType === 'project' ? canInvoice : false,
        canExpense: addSeatType === 'project' ? canExpense : false,
        canTimecard: addSeatType === 'project' ? canTimecard : false,
        tabPermissions: {},
      });
      toast.success(`${addSeatType === 'project' ? 'Freelancer' : 'Client'} added`);
      setShowAddDialog(false);
      resetAddForm();
    } catch (err: any) {
      toast.error(err.message || 'Failed to add external seat');
    }
  };

  const handleRemoveSeat = async () => {
    if (!removingSeat) return;
    try {
      await removeSeat.mutateAsync(removingSeat.id);
      toast.success('External seat removed');
      setRemovingSeat(null);
    } catch (err) {
      toast.error('Failed to remove external seat');
    }
  };

  const handleEditSeat = (seat: ExternalSeat) => {
    if (seat.seat_type === 'view_only') {
      setEditingClientSeat(seat);
    } else {
      setEditingSeat(seat);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-20 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Freelancers Section */}
      <Card className="bg-charcoal-black/50 border-muted-gray/20">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg text-bone-white flex items-center gap-2">
                <Briefcase className="h-5 w-5 text-green-400" />
                Freelancers
              </CardTitle>
              <CardDescription>
                External contractors who can submit invoices, expenses, and timecards
              </CardDescription>
            </div>
            <Button
              size="sm"
              onClick={() => {
                setAddSeatType('project');
                setShowAddDialog(true);
              }}
              className="bg-accent-yellow text-charcoal-black hover:bg-bone-white"
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Freelancer
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {freelancers.length === 0 ? (
            <div className="text-center py-6 text-muted-gray">
              <Briefcase className="h-10 w-10 mx-auto mb-3 opacity-50" />
              <p className="text-sm">No freelancers added yet</p>
            </div>
          ) : (
            <div className="space-y-2">
              {freelancers.map(seat => (
                <ExternalSeatCard
                  key={seat.id}
                  seat={seat}
                  onEdit={handleEditSeat}
                  onRemove={setRemovingSeat}
                  isLoading={removeSeat.isPending || updateSeat.isPending}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Clients Section */}
      <Card className="bg-charcoal-black/50 border-muted-gray/20">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg text-bone-white flex items-center gap-2">
                <Eye className="h-5 w-5 text-blue-400" />
                Clients
              </CardTitle>
              <CardDescription>
                External viewers with limited, configurable access to project tabs
              </CardDescription>
            </div>
            <Button
              size="sm"
              onClick={() => {
                setAddSeatType('view_only');
                setShowAddDialog(true);
              }}
              className="bg-accent-yellow text-charcoal-black hover:bg-bone-white"
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Client
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {clients.length === 0 ? (
            <div className="text-center py-6 text-muted-gray">
              <Eye className="h-10 w-10 mx-auto mb-3 opacity-50" />
              <p className="text-sm">No clients added yet</p>
            </div>
          ) : (
            <div className="space-y-2">
              {clients.map(seat => (
                <ExternalSeatCard
                  key={seat.id}
                  seat={seat}
                  onEdit={handleEditSeat}
                  onRemove={setRemovingSeat}
                  isLoading={removeSeat.isPending || updateSeat.isPending}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add External Seat Dialog */}
      <Dialog open={showAddDialog} onOpenChange={(open) => {
        setShowAddDialog(open);
        if (!open) resetAddForm();
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Add {addSeatType === 'project' ? 'Freelancer' : 'Client'}
            </DialogTitle>
            <DialogDescription>
              {addSeatType === 'project'
                ? 'Add a freelancer who can submit invoices, expenses, and timecards for this project.'
                : 'Add a client with limited view access to specific project tabs.'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Search Users</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by name or username..."
                  value={newUserSearch}
                  onChange={(e) => setNewUserSearch(e.target.value)}
                  className="pl-9"
                />
              </div>
              {searchingUsers && (
                <div className="flex items-center gap-2 mt-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Searching...
                </div>
              )}
              {searchResults && searchResults.length > 0 && (
                <div className="mt-2 border rounded-lg max-h-40 overflow-y-auto">
                  {searchResults.map(user => (
                    <button
                      key={user.id}
                      className={cn(
                        'w-full flex items-center gap-2 p-2 hover:bg-muted/50 text-left transition-colors',
                        selectedUserId === user.id && 'bg-primary/10'
                      )}
                      onClick={() => setSelectedUserId(user.id)}
                    >
                      <Avatar className="h-8 w-8">
                        <AvatarImage src={user.avatar_url || undefined} />
                        <AvatarFallback>
                          {(user.display_name || user.username || 'U')[0].toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <div className="font-medium text-sm">{user.display_name || user.full_name || user.username}</div>
                        <div className="text-xs text-muted-foreground">@{user.username}</div>
                      </div>
                      {selectedUserId === user.id && (
                        <Check className="h-4 w-4 ml-auto text-primary" />
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {addSeatType === 'project' && (
              <div className="space-y-3 p-4 rounded-lg bg-muted/30">
                <label className="text-sm font-medium">Freelancer Permissions</label>
                <div className="space-y-2">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <Checkbox
                      checked={canInvoice}
                      onCheckedChange={(checked) => setCanInvoice(!!checked)}
                    />
                    <FileText className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm">Can submit invoices</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <Checkbox
                      checked={canExpense}
                      onCheckedChange={(checked) => setCanExpense(!!checked)}
                    />
                    <Receipt className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm">Can submit expenses</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <Checkbox
                      checked={canTimecard}
                      onCheckedChange={(checked) => setCanTimecard(!!checked)}
                    />
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm">Can submit timecards</span>
                  </label>
                </div>
              </div>
            )}
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button variant="outline" onClick={() => setShowAddDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleAddSeat}
              disabled={!selectedUserId || addSeat.isPending}
              className="bg-accent-yellow text-charcoal-black hover:bg-bone-white"
            >
              {addSeat.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Plus className="h-4 w-4 mr-2" />}
              Add {addSeatType === 'project' ? 'Freelancer' : 'Client'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Freelancer Dialog */}
      <Dialog open={!!editingSeat} onOpenChange={(open) => !open && setEditingSeat(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Edit Freelancer Permissions
            </DialogTitle>
            <DialogDescription>
              Configure permissions for {editingSeat?.user_name || editingSeat?.user_email}
            </DialogDescription>
          </DialogHeader>

          {editingSeat && (
            <div className="space-y-3 p-4 rounded-lg bg-muted/30">
              <label className="text-sm font-medium">Freelancer Permissions</label>
              <div className="space-y-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <Checkbox
                    checked={editingSeat.can_invoice}
                    onCheckedChange={(checked) => {
                      updateSeat.mutate(
                        { seatId: editingSeat.id, canInvoice: !!checked },
                        { onError: (err: any) => toast.error(err?.message || 'Failed to update freelancer permissions') }
                      );
                    }}
                  />
                  <FileText className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm">Can submit invoices</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <Checkbox
                    checked={editingSeat.can_expense}
                    onCheckedChange={(checked) => {
                      updateSeat.mutate(
                        { seatId: editingSeat.id, canExpense: !!checked },
                        { onError: (err: any) => toast.error(err?.message || 'Failed to update freelancer permissions') }
                      );
                    }}
                  />
                  <Receipt className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm">Can submit expenses</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <Checkbox
                    checked={editingSeat.can_timecard}
                    onCheckedChange={(checked) => {
                      updateSeat.mutate(
                        { seatId: editingSeat.id, canTimecard: !!checked },
                        { onError: (err: any) => toast.error(err?.message || 'Failed to update freelancer permissions') }
                      );
                    }}
                  />
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm">Can submit timecards</span>
                </label>
              </div>
            </div>
          )}

          <div className="flex justify-end pt-4">
            <Button variant="outline" onClick={() => setEditingSeat(null)}>
              Close
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Client Tab Permissions Editor */}
      <ClientTabPermissionsEditor
        open={!!editingClientSeat}
        onOpenChange={(open) => !open && setEditingClientSeat(null)}
        seat={editingClientSeat}
        projectId={projectId}
      />

      {/* Remove Confirmation Dialog */}
      <AlertDialog open={!!removingSeat} onOpenChange={(open) => !open && setRemovingSeat(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove External Access</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove {removingSeat?.user_name || removingSeat?.user_email} from this project?
              {removingSeat?.seat_type === 'project' && (
                <span className="block mt-2 text-amber-400">
                  Any work items (invoices, expenses, timecards) submitted by this freelancer will be transferred to the project owner.
                </span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={handleRemoveSeat}
            >
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default ExternalAccessTab;
