/**
 * Order Lodges Admin Tab
 * Manage lodges - create, edit, view members, appoint officers
 */
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { orderAPI, Lodge, LodgeStatus, LodgeCreateRequest, LodgeUpdateRequest } from '@/lib/api/order';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
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
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { toast } from 'sonner';
import { Skeleton } from '@/components/ui/skeleton';
import { Building, MoreHorizontal, Plus, Users, Edit, UserPlus } from 'lucide-react';

const STATUS_BADGES: Record<LodgeStatus, { variant: 'default' | 'secondary' | 'outline'; label: string }> = {
  active: { variant: 'default', label: 'Active' },
  forming: { variant: 'secondary', label: 'Forming' },
  inactive: { variant: 'outline', label: 'Inactive' },
};

export default function OrderLodgesTab() {
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editLodge, setEditLodge] = useState<Lodge | null>(null);
  const [appointOfficerDialog, setAppointOfficerDialog] = useState<{ lodge: Lodge | null; userId: string; title: string }>({ lodge: null, userId: '', title: '' });
  const [formData, setFormData] = useState<Partial<LodgeCreateRequest>>({});

  const { data, isLoading, error } = useQuery({
    queryKey: ['orderLodges', statusFilter],
    queryFn: () => orderAPI.listLodges(statusFilter !== 'all' ? { status: statusFilter as LodgeStatus } : undefined),
  });

  const createLodgeMutation = useMutation({
    mutationFn: (data: LodgeCreateRequest) => orderAPI.createLodge(data),
    onSuccess: () => {
      toast.success('Lodge created successfully');
      queryClient.invalidateQueries({ queryKey: ['orderLodges'] });
      setCreateDialogOpen(false);
      setFormData({});
    },
    onError: (error: Error) => {
      toast.error(`Error: ${error.message}`);
    },
  });

  const updateLodgeMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: LodgeUpdateRequest }) => orderAPI.updateLodge(id, data),
    onSuccess: () => {
      toast.success('Lodge updated successfully');
      queryClient.invalidateQueries({ queryKey: ['orderLodges'] });
      setEditLodge(null);
      setFormData({});
    },
    onError: (error: Error) => {
      toast.error(`Error: ${error.message}`);
    },
  });

  const appointOfficerMutation = useMutation({
    mutationFn: ({ lodgeId, userId, title }: { lodgeId: number; userId: string; title: string }) =>
      orderAPI.appointLodgeOfficer(lodgeId, { user_id: userId, officer_title: title }),
    onSuccess: () => {
      toast.success('Officer appointed successfully');
      queryClient.invalidateQueries({ queryKey: ['orderLodges'] });
      setAppointOfficerDialog({ lodge: null, userId: '', title: '' });
    },
    onError: (error: Error) => {
      toast.error(`Error: ${error.message}`);
    },
  });

  const lodges = data?.lodges || [];

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
        Error loading lodges: {error instanceof Error ? error.message : 'Unknown error'}
      </div>
    );
  }

  const generateSlug = (name: string) => {
    return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-4">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[150px] bg-charcoal-black border-muted-gray">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="forming">Forming</SelectItem>
              <SelectItem value="inactive">Inactive</SelectItem>
            </SelectContent>
          </Select>
          <span className="text-sm text-muted-gray">
            <Building className="h-4 w-4 inline mr-1" />
            {lodges.length} lodge{lodges.length !== 1 ? 's' : ''}
          </span>
        </div>
        <Button onClick={() => { setFormData({}); setCreateDialogOpen(true); }}>
          <Plus className="h-4 w-4 mr-2" />
          Create Lodge
        </Button>
      </div>

      {/* Table */}
      <div className="border border-muted-gray rounded-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>City</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Members</TableHead>
              <TableHead>Dues</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {lodges.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-gray py-8">
                  No lodges found
                </TableCell>
              </TableRow>
            ) : (
              lodges.map((lodge) => (
                <TableRow key={lodge.id}>
                  <TableCell>
                    <div>
                      <p className="font-medium">{lodge.name}</p>
                      <p className="text-xs text-muted-foreground">/{lodge.slug}</p>
                    </div>
                  </TableCell>
                  <TableCell>
                    {lodge.city}{lodge.region ? `, ${lodge.region}` : ''}
                  </TableCell>
                  <TableCell>
                    <Badge variant={STATUS_BADGES[lodge.status]?.variant || 'secondary'}>
                      {STATUS_BADGES[lodge.status]?.label || lodge.status}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <span className="flex items-center gap-1">
                      <Users className="h-4 w-4 text-muted-gray" />
                      {lodge.member_count || 0}
                    </span>
                  </TableCell>
                  <TableCell>
                    ${(lodge.base_lodge_dues_cents / 100).toFixed(2)}
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => {
                          setFormData({
                            name: lodge.name,
                            city: lodge.city,
                            region: lodge.region || '',
                            description: lodge.description || '',
                            base_lodge_dues_cents: lodge.base_lodge_dues_cents,
                            contact_email: lodge.contact_email || '',
                          });
                          setEditLodge(lodge);
                        }}>
                          <Edit className="h-4 w-4 mr-2" />
                          Edit Lodge
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => setAppointOfficerDialog({ lodge, userId: '', title: '' })}>
                          <UserPlus className="h-4 w-4 mr-2" />
                          Appoint Officer
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Create Lodge Dialog */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New Lodge</DialogTitle>
            <DialogDescription>
              Create a new local chapter of The Order
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <Label>Lodge Name</Label>
                <Input
                  value={formData.name || ''}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value, slug: generateSlug(e.target.value) })}
                  placeholder="Dallas Lodge"
                />
              </div>
              <div>
                <Label>City</Label>
                <Input
                  value={formData.city || ''}
                  onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                  placeholder="Dallas"
                />
              </div>
              <div>
                <Label>Region/State</Label>
                <Input
                  value={formData.region || ''}
                  onChange={(e) => setFormData({ ...formData, region: e.target.value })}
                  placeholder="TX"
                />
              </div>
              <div>
                <Label>Contact Email</Label>
                <Input
                  type="email"
                  value={formData.contact_email || ''}
                  onChange={(e) => setFormData({ ...formData, contact_email: e.target.value })}
                  placeholder="lodge@example.com"
                />
              </div>
              <div>
                <Label>Base Dues (cents)</Label>
                <Input
                  type="number"
                  value={formData.base_lodge_dues_cents || 2500}
                  onChange={(e) => setFormData({ ...formData, base_lodge_dues_cents: parseInt(e.target.value) })}
                />
              </div>
            </div>
            <div>
              <Label>Description</Label>
              <Textarea
                value={formData.description || ''}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Describe the lodge..."
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (formData.name && formData.city) {
                  createLodgeMutation.mutate({
                    name: formData.name,
                    slug: formData.slug || generateSlug(formData.name),
                    city: formData.city,
                    region: formData.region,
                    description: formData.description,
                    base_lodge_dues_cents: formData.base_lodge_dues_cents || 2500,
                    contact_email: formData.contact_email,
                  });
                }
              }}
              disabled={!formData.name || !formData.city || createLodgeMutation.isPending}
            >
              Create Lodge
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Lodge Dialog */}
      <Dialog open={!!editLodge} onOpenChange={() => setEditLodge(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Lodge</DialogTitle>
            <DialogDescription>
              Update lodge details for {editLodge?.name}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <Label>Lodge Name</Label>
                <Input
                  value={formData.name || ''}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                />
              </div>
              <div>
                <Label>City</Label>
                <Input
                  value={formData.city || ''}
                  onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                />
              </div>
              <div>
                <Label>Region/State</Label>
                <Input
                  value={formData.region || ''}
                  onChange={(e) => setFormData({ ...formData, region: e.target.value })}
                />
              </div>
              <div>
                <Label>Status</Label>
                <Select
                  value={(formData as any).status || editLodge?.status}
                  onValueChange={(v) => setFormData({ ...formData, status: v as LodgeStatus } as any)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="forming">Forming</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Base Dues (cents)</Label>
                <Input
                  type="number"
                  value={formData.base_lodge_dues_cents || 2500}
                  onChange={(e) => setFormData({ ...formData, base_lodge_dues_cents: parseInt(e.target.value) })}
                />
              </div>
            </div>
            <div>
              <Label>Description</Label>
              <Textarea
                value={formData.description || ''}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditLodge(null)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (editLodge) {
                  updateLodgeMutation.mutate({
                    id: editLodge.id,
                    data: formData as LodgeUpdateRequest,
                  });
                }
              }}
              disabled={updateLodgeMutation.isPending}
            >
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Appoint Officer Dialog */}
      <Dialog open={!!appointOfficerDialog.lodge} onOpenChange={() => setAppointOfficerDialog({ lodge: null, userId: '', title: '' })}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Appoint Lodge Officer</DialogTitle>
            <DialogDescription>
              Appoint an officer to {appointOfficerDialog.lodge?.name}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>User ID</Label>
              <Input
                value={appointOfficerDialog.userId}
                onChange={(e) => setAppointOfficerDialog({ ...appointOfficerDialog, userId: e.target.value })}
                placeholder="Enter user ID (UUID)"
              />
              <p className="text-xs text-muted-gray mt-1">
                Paste the UUID of the Order member to appoint
              </p>
            </div>
            <div>
              <Label>Officer Title</Label>
              <Input
                value={appointOfficerDialog.title}
                onChange={(e) => setAppointOfficerDialog({ ...appointOfficerDialog, title: e.target.value })}
                placeholder="e.g., Lodge Master, Treasurer"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAppointOfficerDialog({ lodge: null, userId: '', title: '' })}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (appointOfficerDialog.lodge && appointOfficerDialog.userId && appointOfficerDialog.title) {
                  appointOfficerMutation.mutate({
                    lodgeId: appointOfficerDialog.lodge.id,
                    userId: appointOfficerDialog.userId,
                    title: appointOfficerDialog.title,
                  });
                }
              }}
              disabled={!appointOfficerDialog.userId || !appointOfficerDialog.title || appointOfficerMutation.isPending}
            >
              Appoint Officer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
