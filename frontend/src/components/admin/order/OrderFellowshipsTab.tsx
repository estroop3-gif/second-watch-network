/**
 * Order Fellowships Admin Tab
 * View and manage fellowship leadership
 */
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { orderAPI, Fellowship, FellowshipRole, FellowshipType } from '@/lib/api/order';
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
import { Heart, Users, UserPlus, GraduationCap, Globe, Star } from 'lucide-react';

const TYPE_LABELS: Record<FellowshipType, { label: string; icon: React.ReactNode }> = {
  entry_level: { label: 'Entry Level', icon: <GraduationCap className="h-4 w-4" /> },
  faith_based: { label: 'Faith-Based', icon: <Heart className="h-4 w-4" /> },
  special_interest: { label: 'Special Interest', icon: <Star className="h-4 w-4" /> },
  regional: { label: 'Regional', icon: <Globe className="h-4 w-4" /> },
};

export default function OrderFellowshipsTab() {
  const queryClient = useQueryClient();
  const [appointDialog, setAppointDialog] = useState<{ fellowship: Fellowship | null; userId: string; role: FellowshipRole }>({
    fellowship: null, userId: '', role: 'leader'
  });

  const { data, isLoading, error } = useQuery({
    queryKey: ['orderFellowships'],
    queryFn: () => orderAPI.listFellowships(),
  });

  const appointMutation = useMutation({
    mutationFn: ({ fellowshipId, userId, role }: { fellowshipId: number; userId: string; role: FellowshipRole }) =>
      orderAPI.appointFellowshipLeadership(fellowshipId, { user_id: userId, role }),
    onSuccess: () => {
      toast.success('Leadership appointed');
      queryClient.invalidateQueries({ queryKey: ['orderFellowships'] });
      setAppointDialog({ fellowship: null, userId: '', role: 'leader' });
    },
    onError: (error: Error) => {
      toast.error(`Error: ${error.message}`);
    },
  });

  const fellowships = data?.fellowships || [];

  if (isLoading) {
    return <div className="space-y-2"><Skeleton className="h-12 w-full" /><Skeleton className="h-12 w-full" /></div>;
  }

  if (error) {
    return <div className="text-red-500">Error loading fellowships</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-muted-gray text-sm">
        <Heart className="h-4 w-4" />
        <span>{fellowships.length} fellowship{fellowships.length !== 1 ? 's' : ''}</span>
      </div>

      <div className="border border-muted-gray rounded-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Members</TableHead>
              <TableHead>Opt-In</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {fellowships.map((fellowship) => (
              <TableRow key={fellowship.id}>
                <TableCell>
                  <div>
                    <p className="font-medium">{fellowship.name}</p>
                    <p className="text-xs text-muted-foreground">/{fellowship.slug}</p>
                  </div>
                </TableCell>
                <TableCell>
                  <Badge variant="outline" className="flex items-center gap-1 w-fit">
                    {TYPE_LABELS[fellowship.fellowship_type]?.icon}
                    {TYPE_LABELS[fellowship.fellowship_type]?.label}
                  </Badge>
                </TableCell>
                <TableCell>
                  <span className="flex items-center gap-1">
                    <Users className="h-4 w-4 text-muted-gray" />
                    {fellowship.member_count || 0}
                  </span>
                </TableCell>
                <TableCell>
                  <Badge variant={fellowship.is_opt_in ? 'default' : 'secondary'}>
                    {fellowship.is_opt_in ? 'Yes' : 'Auto'}
                  </Badge>
                </TableCell>
                <TableCell>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setAppointDialog({ fellowship, userId: '', role: 'leader' })}
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

      <Dialog open={!!appointDialog.fellowship} onOpenChange={() => setAppointDialog({ fellowship: null, userId: '', role: 'leader' })}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Appoint Fellowship Leadership</DialogTitle>
            <DialogDescription>Appoint leadership for {appointDialog.fellowship?.name}</DialogDescription>
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
              <Select value={appointDialog.role} onValueChange={(v) => setAppointDialog({ ...appointDialog, role: v as FellowshipRole })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="leader">Leader</SelectItem>
                  <SelectItem value="coordinator">Coordinator</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAppointDialog({ fellowship: null, userId: '', role: 'leader' })}>Cancel</Button>
            <Button
              onClick={() => {
                if (appointDialog.fellowship && appointDialog.userId) {
                  appointMutation.mutate({
                    fellowshipId: appointDialog.fellowship.id,
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
