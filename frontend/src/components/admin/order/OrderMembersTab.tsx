/**
 * Order Members Admin Tab
 * Manage Order members - view, search, update status, tier, and lodge assignment
 */
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { orderAPI, OrderMemberProfile, OrderMemberStatus, MembershipTier, PrimaryTrack, PRIMARY_TRACKS, MEMBERSHIP_TIERS } from '@/lib/api/order';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { Skeleton } from '@/components/ui/skeleton';
import { Search, Users, MoreHorizontal, UserCog, Building, Star, AlertTriangle, ChevronLeft, ChevronRight } from 'lucide-react';

const STATUS_BADGES: Record<OrderMemberStatus, { variant: 'default' | 'secondary' | 'destructive' | 'outline'; label: string }> = {
  active: { variant: 'default', label: 'Active' },
  probationary: { variant: 'secondary', label: 'Probationary' },
  suspended: { variant: 'destructive', label: 'Suspended' },
  expelled: { variant: 'destructive', label: 'Expelled' },
};

const TIER_BADGES: Record<MembershipTier, { color: string; label: string }> = {
  base: { color: 'bg-gray-500', label: 'Base' },
  steward: { color: 'bg-blue-500', label: 'Steward' },
  patron: { color: 'bg-yellow-500 text-black', label: 'Patron' },
};

export default function OrderMembersTab() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(0);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [tierFilter, setTierFilter] = useState<string>('all');
  const [trackFilter, setTrackFilter] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedMember, setSelectedMember] = useState<OrderMemberProfile | null>(null);
  const [actionDialog, setActionDialog] = useState<{ type: 'status' | 'tier' | 'lodge' | null; member: OrderMemberProfile | null }>({ type: null, member: null });
  const [newValue, setNewValue] = useState<string>('');

  const pageSize = 25;

  const { data, isLoading, error } = useQuery({
    queryKey: ['orderAdminMembers', page, statusFilter, tierFilter, trackFilter, searchTerm],
    queryFn: () => orderAPI.listAllMembers({
      status: statusFilter !== 'all' ? statusFilter as OrderMemberStatus : undefined,
      tier: tierFilter !== 'all' ? tierFilter as MembershipTier : undefined,
      track: trackFilter !== 'all' ? trackFilter as PrimaryTrack : undefined,
      search: searchTerm || undefined,
      skip: page * pageSize,
      limit: pageSize,
    }),
  });

  const updateStatusMutation = useMutation({
    mutationFn: ({ userId, status }: { userId: string; status: OrderMemberStatus }) =>
      orderAPI.updateMemberStatusAdmin(userId, { status }),
    onSuccess: () => {
      toast.success('Member status updated');
      queryClient.invalidateQueries({ queryKey: ['orderAdminMembers'] });
      setActionDialog({ type: null, member: null });
    },
    onError: (error: Error) => {
      toast.error(`Error: ${error.message}`);
    },
  });

  const updateTierMutation = useMutation({
    mutationFn: ({ userId, tier }: { userId: string; tier: MembershipTier }) =>
      orderAPI.updateMemberTier(userId, { membership_tier: tier }),
    onSuccess: () => {
      toast.success('Member tier updated');
      queryClient.invalidateQueries({ queryKey: ['orderAdminMembers'] });
      setActionDialog({ type: null, member: null });
    },
    onError: (error: Error) => {
      toast.error(`Error: ${error.message}`);
    },
  });

  const removeLodgeMutation = useMutation({
    mutationFn: (userId: string) => orderAPI.removeMemberFromLodge(userId),
    onSuccess: () => {
      toast.success('Member removed from lodge');
      queryClient.invalidateQueries({ queryKey: ['orderAdminMembers'] });
    },
    onError: (error: Error) => {
      toast.error(`Error: ${error.message}`);
    },
  });

  const members = data?.members || [];
  const total = data?.total || 0;
  const totalPages = Math.ceil(total / pageSize);

  if (isLoading) {
    return (
      <div className="space-y-2">
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-12 w-full" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-red-500">
        Error loading members: {error instanceof Error ? error.message : 'Unknown error'}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-gray" />
          <Input
            placeholder="Search by name or email..."
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setPage(0);
            }}
            className="pl-10 bg-charcoal-black border-muted-gray"
          />
        </div>
        <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(0); }}>
          <SelectTrigger className="w-[150px] bg-charcoal-black border-muted-gray">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="probationary">Probationary</SelectItem>
            <SelectItem value="suspended">Suspended</SelectItem>
            <SelectItem value="expelled">Expelled</SelectItem>
          </SelectContent>
        </Select>
        <Select value={tierFilter} onValueChange={(v) => { setTierFilter(v); setPage(0); }}>
          <SelectTrigger className="w-[150px] bg-charcoal-black border-muted-gray">
            <SelectValue placeholder="Tier" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Tiers</SelectItem>
            {MEMBERSHIP_TIERS.map(t => (
              <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={trackFilter} onValueChange={(v) => { setTrackFilter(v); setPage(0); }}>
          <SelectTrigger className="w-[180px] bg-charcoal-black border-muted-gray">
            <SelectValue placeholder="Track" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Tracks</SelectItem>
            {PRIMARY_TRACKS.map(t => (
              <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Stats */}
      <div className="flex items-center gap-2 text-muted-gray text-sm">
        <Users className="h-4 w-4" />
        <span>{total} member{total !== 1 ? 's' : ''}</span>
      </div>

      {/* Table */}
      <div className="border border-muted-gray rounded-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Track</TableHead>
              <TableHead>Lodge</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Tier</TableHead>
              <TableHead>Joined</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {members.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-muted-gray py-8">
                  No members found
                </TableCell>
              </TableRow>
            ) : (
              members.map((member) => (
                <TableRow key={member.user_id}>
                  <TableCell>
                    <div>
                      <p className="font-medium">{member.user_name || 'Unknown'}</p>
                      <p className="text-xs text-muted-foreground">{member.user_email}</p>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="capitalize">
                      {PRIMARY_TRACKS.find(t => t.value === member.primary_track)?.label || member.primary_track}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {member.lodge_name ? (
                      <span className="text-sm">{member.lodge_name}</span>
                    ) : (
                      <span className="text-muted-gray text-sm">None</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant={STATUS_BADGES[member.status]?.variant || 'secondary'}>
                      {STATUS_BADGES[member.status]?.label || member.status}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {member.membership_tier && (
                      <Badge className={TIER_BADGES[member.membership_tier]?.color || 'bg-gray-500'}>
                        {TIER_BADGES[member.membership_tier]?.label || member.membership_tier}
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {member.joined_at ? format(new Date(member.joined_at), 'MMM d, yyyy') : '-'}
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => setSelectedMember(member)}>
                          <UserCog className="h-4 w-4 mr-2" />
                          View Details
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => {
                          setNewValue(member.status);
                          setActionDialog({ type: 'status', member });
                        }}>
                          <AlertTriangle className="h-4 w-4 mr-2" />
                          Change Status
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => {
                          setNewValue(member.membership_tier || 'base');
                          setActionDialog({ type: 'tier', member });
                        }}>
                          <Star className="h-4 w-4 mr-2" />
                          Change Tier
                        </DropdownMenuItem>
                        {member.lodge_id && (
                          <DropdownMenuItem
                            onClick={() => removeLodgeMutation.mutate(member.user_id)}
                            className="text-red-500"
                          >
                            <Building className="h-4 w-4 mr-2" />
                            Remove from Lodge
                          </DropdownMenuItem>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-gray">
            Page {page + 1} of {totalPages}
          </span>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage(p => Math.max(0, p - 1))}
              disabled={page === 0}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
              disabled={page >= totalPages - 1}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Change Status Dialog */}
      <Dialog open={actionDialog.type === 'status'} onOpenChange={() => setActionDialog({ type: null, member: null })}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Change Member Status</DialogTitle>
            <DialogDescription>
              Update the membership status for {actionDialog.member?.user_name}
            </DialogDescription>
          </DialogHeader>
          <Select value={newValue} onValueChange={setNewValue}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="probationary">Probationary</SelectItem>
              <SelectItem value="suspended">Suspended</SelectItem>
              <SelectItem value="expelled">Expelled</SelectItem>
            </SelectContent>
          </Select>
          <DialogFooter>
            <Button variant="outline" onClick={() => setActionDialog({ type: null, member: null })}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (actionDialog.member) {
                  updateStatusMutation.mutate({
                    userId: actionDialog.member.user_id,
                    status: newValue as OrderMemberStatus,
                  });
                }
              }}
              disabled={updateStatusMutation.isPending}
            >
              Update Status
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Change Tier Dialog */}
      <Dialog open={actionDialog.type === 'tier'} onOpenChange={() => setActionDialog({ type: null, member: null })}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Change Membership Tier</DialogTitle>
            <DialogDescription>
              Update the tier for {actionDialog.member?.user_name}
            </DialogDescription>
          </DialogHeader>
          <Select value={newValue} onValueChange={setNewValue}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {MEMBERSHIP_TIERS.map(t => (
                <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <DialogFooter>
            <Button variant="outline" onClick={() => setActionDialog({ type: null, member: null })}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (actionDialog.member) {
                  updateTierMutation.mutate({
                    userId: actionDialog.member.user_id,
                    tier: newValue as MembershipTier,
                  });
                }
              }}
              disabled={updateTierMutation.isPending}
            >
              Update Tier
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Member Details Dialog */}
      <Dialog open={!!selectedMember} onOpenChange={() => setSelectedMember(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Member Details</DialogTitle>
          </DialogHeader>
          {selectedMember && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-muted-foreground">Name</p>
                  <p className="font-medium">{selectedMember.user_name || 'Unknown'}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Email</p>
                  <p>{selectedMember.user_email}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Primary Track</p>
                  <p>{PRIMARY_TRACKS.find(t => t.value === selectedMember.primary_track)?.label || selectedMember.primary_track}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Status</p>
                  <Badge variant={STATUS_BADGES[selectedMember.status]?.variant}>
                    {STATUS_BADGES[selectedMember.status]?.label}
                  </Badge>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Tier</p>
                  <Badge className={TIER_BADGES[selectedMember.membership_tier || 'base']?.color}>
                    {TIER_BADGES[selectedMember.membership_tier || 'base']?.label}
                  </Badge>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Lodge</p>
                  <p>{selectedMember.lodge_name || 'None'}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Location</p>
                  <p>{selectedMember.city}{selectedMember.region ? `, ${selectedMember.region}` : ''}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Experience</p>
                  <p>{selectedMember.years_experience ? `${selectedMember.years_experience} years` : '-'}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Joined</p>
                  <p>{selectedMember.joined_at ? format(new Date(selectedMember.joined_at), 'MMMM d, yyyy') : '-'}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Dues Status</p>
                  <p>{selectedMember.dues_status || '-'}</p>
                </div>
              </div>
              {selectedMember.bio && (
                <div>
                  <p className="text-xs text-muted-foreground">Bio</p>
                  <p className="text-sm whitespace-pre-wrap">{selectedMember.bio}</p>
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setSelectedMember(null)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
