/**
 * Order Craft Houses Admin Tab
 * View and manage craft house leadership
 */
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { orderAPI, CraftHouse, CraftHouseRole } from '@/lib/api/order';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
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
import { toast } from 'sonner';
import { Skeleton } from '@/components/ui/skeleton';
import { Hammer, Users, UserPlus } from 'lucide-react';

const STATUS_BADGES = {
  active: { variant: 'default' as const, label: 'Active' },
  forming: { variant: 'secondary' as const, label: 'Forming' },
  inactive: { variant: 'outline' as const, label: 'Inactive' },
};

export default function OrderCraftHousesTab() {
  const queryClient = useQueryClient();
  const [appointDialog, setAppointDialog] = useState<{ house: CraftHouse | null; userId: string; role: CraftHouseRole }>({
    house: null, userId: '', role: 'master'
  });

  const { data, isLoading, error } = useQuery({
    queryKey: ['orderCraftHouses'],
    queryFn: () => orderAPI.listCraftHouses(),
  });

  const appointMutation = useMutation({
    mutationFn: ({ craftHouseId, userId, role }: { craftHouseId: number; userId: string; role: CraftHouseRole }) =>
      orderAPI.appointCraftHouseLeadership(craftHouseId, { user_id: userId, role }),
    onSuccess: () => {
      toast.success('Leadership appointed');
      queryClient.invalidateQueries({ queryKey: ['orderCraftHouses'] });
      setAppointDialog({ house: null, userId: '', role: 'master' });
    },
    onError: (error: Error) => {
      toast.error(`Error: ${error.message}`);
    },
  });

  const craftHouses = data?.craft_houses || [];

  if (isLoading) {
    return <div className="space-y-2"><Skeleton className="h-12 w-full" /><Skeleton className="h-12 w-full" /></div>;
  }

  if (error) {
    return <div className="text-red-500">Error loading craft houses</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-muted-gray text-sm">
        <Hammer className="h-4 w-4" />
        <span>{craftHouses.length} craft house{craftHouses.length !== 1 ? 's' : ''}</span>
      </div>

      <div className="border border-muted-gray rounded-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Members</TableHead>
              <TableHead>Craft Master</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {craftHouses.map((house) => (
              <TableRow key={house.id}>
                <TableCell>
                  <div>
                    <p className="font-medium">{house.name}</p>
                    <p className="text-xs text-muted-foreground">/{house.slug}</p>
                  </div>
                </TableCell>
                <TableCell>
                  <Badge variant={STATUS_BADGES[house.status]?.variant || 'secondary'}>
                    {STATUS_BADGES[house.status]?.label || house.status}
                  </Badge>
                </TableCell>
                <TableCell>
                  <span className="flex items-center gap-1">
                    <Users className="h-4 w-4 text-muted-gray" />
                    {house.member_count || 0}
                  </span>
                </TableCell>
                <TableCell>{house.master_name || <span className="text-muted-gray">None</span>}</TableCell>
                <TableCell>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setAppointDialog({ house, userId: '', role: 'master' })}
                  >
                    <UserPlus className="h-4 w-4 mr-1" />
                    Appoint
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Dialog open={!!appointDialog.house} onOpenChange={() => setAppointDialog({ house: null, userId: '', role: 'master' })}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Appoint Craft House Leadership</DialogTitle>
            <DialogDescription>Appoint leadership for {appointDialog.house?.name}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>User ID</Label>
              <Input
                value={appointDialog.userId}
                onChange={(e) => setAppointDialog({ ...appointDialog, userId: e.target.value })}
                placeholder="Enter Order member's UUID"
              />
            </div>
            <div>
              <Label>Role</Label>
              <Select value={appointDialog.role} onValueChange={(v) => setAppointDialog({ ...appointDialog, role: v as CraftHouseRole })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="master">Craft Master</SelectItem>
                  <SelectItem value="deputy">Deputy</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAppointDialog({ house: null, userId: '', role: 'master' })}>Cancel</Button>
            <Button
              onClick={() => {
                if (appointDialog.house && appointDialog.userId) {
                  appointMutation.mutate({
                    craftHouseId: appointDialog.house.id,
                    userId: appointDialog.userId,
                    role: appointDialog.role,
                  });
                }
              }}
              disabled={!appointDialog.userId || appointMutation.isPending}
            >
              Appoint
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
