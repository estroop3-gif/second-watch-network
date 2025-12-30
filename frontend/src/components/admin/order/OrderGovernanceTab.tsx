/**
 * Order Governance Admin Tab
 * Manage governance positions - Grand Master, High Council, Lodge Masters, Craft Masters, etc.
 */
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  orderAPI,
  GovernancePosition,
  GovernancePositionType,
  GovernanceScopeType,
  GovernancePositionCreateRequest,
} from '@/lib/api/order';
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
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { Skeleton } from '@/components/ui/skeleton';
import { Crown, Scale, Plus, Users, Building, Hammer, Heart, X, UserPlus } from 'lucide-react';

const POSITION_TYPE_LABELS: Record<GovernancePositionType, string> = {
  high_council: 'High Council',
  grand_master: 'Grand Master',
  lodge_master: 'Lodge Master',
  lodge_council: 'Lodge Council',
  craft_master: 'Craft Master',
  craft_deputy: 'Craft Deputy',
  fellowship_leader: 'Fellowship Leader',
  regional_director: 'Regional Director',
};

const SCOPE_TYPE_ICONS: Record<GovernanceScopeType, React.ReactNode> = {
  order: <Scale className="h-4 w-4" />,
  lodge: <Building className="h-4 w-4" />,
  craft_house: <Hammer className="h-4 w-4" />,
  fellowship: <Heart className="h-4 w-4" />,
  region: <Users className="h-4 w-4" />,
};

const SCOPE_TYPE_LABELS: Record<GovernanceScopeType, string> = {
  order: 'The Order',
  lodge: 'Lodge',
  craft_house: 'Craft House',
  fellowship: 'Fellowship',
  region: 'Region',
};

export default function OrderGovernanceTab() {
  const queryClient = useQueryClient();
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [formData, setFormData] = useState<Partial<GovernancePositionCreateRequest>>({});

  const { data: highCouncil, isLoading: loadingCouncil } = useQuery({
    queryKey: ['orderHighCouncil'],
    queryFn: () => orderAPI.getHighCouncil(),
  });

  const { data: allPositions, isLoading: loadingPositions } = useQuery({
    queryKey: ['orderGovernancePositions'],
    queryFn: () => orderAPI.listGovernancePositions({ active_only: true }),
  });

  const createPositionMutation = useMutation({
    mutationFn: (data: GovernancePositionCreateRequest) => orderAPI.createGovernancePosition(data),
    onSuccess: () => {
      toast.success('Governance position created');
      queryClient.invalidateQueries({ queryKey: ['orderHighCouncil'] });
      queryClient.invalidateQueries({ queryKey: ['orderGovernancePositions'] });
      setCreateDialogOpen(false);
      setFormData({});
    },
    onError: (error: Error) => {
      toast.error(`Error: ${error.message}`);
    },
  });

  const removePositionMutation = useMutation({
    mutationFn: (positionId: number) => orderAPI.removeGovernancePosition(positionId),
    onSuccess: () => {
      toast.success('Position ended');
      queryClient.invalidateQueries({ queryKey: ['orderHighCouncil'] });
      queryClient.invalidateQueries({ queryKey: ['orderGovernancePositions'] });
    },
    onError: (error: Error) => {
      toast.error(`Error: ${error.message}`);
    },
  });

  const isLoading = loadingCouncil || loadingPositions;

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  // Filter positions by type
  const lodgePositions = allPositions?.positions.filter(p => p.scope_type === 'lodge') || [];
  const craftHousePositions = allPositions?.positions.filter(p => p.scope_type === 'craft_house') || [];
  const fellowshipPositions = allPositions?.positions.filter(p => p.scope_type === 'fellowship') || [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Scale className="h-5 w-5 text-accent-yellow" />
            Governance Positions
          </h3>
          <p className="text-sm text-muted-gray">Manage Order leadership and governance</p>
        </div>
        <Button onClick={() => { setFormData({}); setCreateDialogOpen(true); }}>
          <Plus className="h-4 w-4 mr-2" />
          Appoint Position
        </Button>
      </div>

      {/* High Council Section */}
      <Card className="border-yellow-500/50">
        <CardHeader className="bg-gradient-to-r from-yellow-500/10 to-amber-500/10">
          <CardTitle className="flex items-center gap-2">
            <Crown className="h-5 w-5 text-yellow-500" />
            High Council
          </CardTitle>
          <CardDescription>The governing body of The Order</CardDescription>
        </CardHeader>
        <CardContent className="pt-4">
          {/* Grand Master */}
          <div className="mb-4">
            <h4 className="text-sm font-semibold text-muted-gray mb-2">Grand Master</h4>
            {highCouncil?.grand_master ? (
              <div className="flex items-center justify-between p-4 border border-yellow-500/50 rounded-lg bg-yellow-500/5">
                <div className="flex items-center gap-4">
                  <Avatar className="h-12 w-12 border-2 border-yellow-500">
                    <AvatarFallback className="bg-yellow-500/20">
                      {highCouncil.grand_master.user_name?.charAt(0) || '?'}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="font-semibold flex items-center gap-2">
                      {highCouncil.grand_master.user_name || 'Unknown'}
                      <Crown className="h-4 w-4 text-yellow-500" />
                    </p>
                    <p className="text-sm text-muted-gray">{highCouncil.grand_master.title}</p>
                    <p className="text-xs text-muted-gray">
                      Since {format(new Date(highCouncil.grand_master.started_at), 'MMM d, yyyy')}
                    </p>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-red-500"
                  onClick={() => removePositionMutation.mutate(highCouncil.grand_master!.id)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              <div className="p-4 border border-dashed rounded-lg text-center text-muted-gray">
                <Crown className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p>No Grand Master appointed</p>
                <Button
                  variant="link"
                  size="sm"
                  onClick={() => {
                    setFormData({ position_type: 'grand_master' as GovernancePositionType, title: 'Grand Master' });
                    setCreateDialogOpen(true);
                  }}
                >
                  <UserPlus className="h-4 w-4 mr-1" /> Appoint Grand Master
                </Button>
              </div>
            )}
          </div>

          {/* Council Members */}
          <div>
            <h4 className="text-sm font-semibold text-muted-gray mb-2">Council Members</h4>
            {highCouncil?.council_members && highCouncil.council_members.length > 0 ? (
              <div className="grid gap-2">
                {highCouncil.council_members.map((member) => (
                  <div key={member.id} className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="flex items-center gap-3">
                      <Avatar>
                        <AvatarFallback>{member.user_name?.charAt(0) || '?'}</AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="font-medium">{member.user_name || 'Unknown'}</p>
                        <p className="text-xs text-muted-gray">{member.title}</p>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-red-500"
                      onClick={() => removePositionMutation.mutate(member.id)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-center text-muted-gray py-4">No council members appointed</p>
            )}
            <Button
              variant="link"
              size="sm"
              className="mt-2"
              onClick={() => {
                setFormData({ position_type: 'high_council' as GovernancePositionType, title: 'High Council Member' });
                setCreateDialogOpen(true);
              }}
            >
              <Plus className="h-4 w-4 mr-1" /> Add Council Member
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Other Positions */}
      <div className="grid md:grid-cols-3 gap-4">
        {/* Lodge Leaders */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Building className="h-4 w-4" />
              Lodge Leaders ({lodgePositions.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {lodgePositions.length > 0 ? (
              <div className="space-y-2">
                {lodgePositions.slice(0, 5).map((pos) => (
                  <div key={pos.id} className="flex items-center justify-between text-sm">
                    <div>
                      <p className="font-medium">{pos.user_name}</p>
                      <p className="text-xs text-muted-gray">{pos.scope_name} - {pos.title}</p>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 text-red-500"
                      onClick={() => removePositionMutation.mutate(pos.id)}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-gray text-center py-2">No lodge leaders</p>
            )}
          </CardContent>
        </Card>

        {/* Craft House Leaders */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Hammer className="h-4 w-4" />
              Craft Masters ({craftHousePositions.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {craftHousePositions.length > 0 ? (
              <div className="space-y-2">
                {craftHousePositions.slice(0, 5).map((pos) => (
                  <div key={pos.id} className="flex items-center justify-between text-sm">
                    <div>
                      <p className="font-medium">{pos.user_name}</p>
                      <p className="text-xs text-muted-gray">{pos.scope_name}</p>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 text-red-500"
                      onClick={() => removePositionMutation.mutate(pos.id)}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-gray text-center py-2">No craft masters</p>
            )}
          </CardContent>
        </Card>

        {/* Fellowship Leaders */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Heart className="h-4 w-4" />
              Fellowship Leaders ({fellowshipPositions.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {fellowshipPositions.length > 0 ? (
              <div className="space-y-2">
                {fellowshipPositions.slice(0, 5).map((pos) => (
                  <div key={pos.id} className="flex items-center justify-between text-sm">
                    <div>
                      <p className="font-medium">{pos.user_name}</p>
                      <p className="text-xs text-muted-gray">{pos.scope_name}</p>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 text-red-500"
                      onClick={() => removePositionMutation.mutate(pos.id)}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-gray text-center py-2">No fellowship leaders</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* All Positions Table */}
      <Card>
        <CardHeader>
          <CardTitle>All Active Positions</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Person</TableHead>
                <TableHead>Position</TableHead>
                <TableHead>Scope</TableHead>
                <TableHead>Started</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(allPositions?.positions || []).map((pos) => (
                <TableRow key={pos.id}>
                  <TableCell className="font-medium">{pos.user_name || 'Unknown'}</TableCell>
                  <TableCell>
                    <Badge variant="outline">
                      {POSITION_TYPE_LABELS[pos.position_type] || pos.position_type}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {pos.scope_type && (
                      <span className="flex items-center gap-1 text-sm">
                        {SCOPE_TYPE_ICONS[pos.scope_type]}
                        {pos.scope_name || SCOPE_TYPE_LABELS[pos.scope_type]}
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="text-sm text-muted-gray">
                    {format(new Date(pos.started_at), 'MMM d, yyyy')}
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-red-500"
                      onClick={() => removePositionMutation.mutate(pos.id)}
                    >
                      End Position
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Create Position Dialog */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Appoint Governance Position</DialogTitle>
            <DialogDescription>
              Assign a member to a governance role
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>User ID</Label>
              <Input
                value={formData.user_id || ''}
                onChange={(e) => setFormData({ ...formData, user_id: e.target.value })}
                placeholder="Enter Order member's UUID"
              />
            </div>
            <div>
              <Label>Position Type</Label>
              <Select
                value={formData.position_type}
                onValueChange={(v) => setFormData({ ...formData, position_type: v as GovernancePositionType })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select position type" />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(POSITION_TYPE_LABELS).map(([value, label]) => (
                    <SelectItem key={value} value={value}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Title</Label>
              <Input
                value={formData.title || ''}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                placeholder="e.g., Grand Master, Lodge Master"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Scope Type (optional)</Label>
                <Select
                  value={formData.scope_type || ''}
                  onValueChange={(v) => setFormData({ ...formData, scope_type: v as GovernanceScopeType })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select scope" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">None (Order-wide)</SelectItem>
                    {Object.entries(SCOPE_TYPE_LABELS).map(([value, label]) => (
                      <SelectItem key={value} value={value}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Scope ID (optional)</Label>
                <Input
                  type="number"
                  value={formData.scope_id || ''}
                  onChange={(e) => setFormData({ ...formData, scope_id: parseInt(e.target.value) || undefined })}
                  placeholder="Lodge/House/Fellowship ID"
                />
              </div>
            </div>
            <div>
              <Label>Description (optional)</Label>
              <Textarea
                value={formData.description || ''}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Position responsibilities..."
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (formData.user_id && formData.position_type && formData.title) {
                  createPositionMutation.mutate(formData as GovernancePositionCreateRequest);
                }
              }}
              disabled={!formData.user_id || !formData.position_type || !formData.title || createPositionMutation.isPending}
            >
              Appoint Position
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
