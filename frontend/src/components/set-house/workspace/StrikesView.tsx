/**
 * Strikes View
 * Manage user strikes and violations for Set House
 */
import React, { useState } from 'react';
import {
  Shield,
  Plus,
  Search,
  MoreVertical,
  Edit,
  Eye,
  User,
  AlertTriangle,
  Calendar,
  Loader2,
  CheckCircle2,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

import { useSetHouseStrikes, useSetHouseUsersWithStrikes } from '@/hooks/set-house';
import type { SetHouseStrike, StrikeStatus, StrikeReason } from '@/types/set-house';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';

const STATUS_CONFIG: Record<StrikeStatus, { label: string; color: string }> = {
  active: { label: 'Active', color: 'bg-red-500/20 text-red-400 border-red-500/30' },
  appealed: { label: 'Appealed', color: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30' },
  expired: { label: 'Expired', color: 'bg-gray-500/20 text-gray-400 border-gray-500/30' },
  removed: { label: 'Removed', color: 'bg-green-500/20 text-green-400 border-green-500/30' },
};

const REASON_LABELS: Record<StrikeReason, string> = {
  late_return: 'Late Return',
  damage: 'Damage',
  no_show: 'No Show',
  policy_violation: 'Policy Violation',
  payment_issue: 'Payment Issue',
  other: 'Other',
};

interface StrikesViewProps {
  orgId: string;
}

export function StrikesView({ orgId }: StrikesViewProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<StrikeStatus | 'all'>('all');
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  const { strikes, isLoading, createStrike } = useSetHouseStrikes(orgId, {
    status: statusFilter === 'all' ? undefined : statusFilter,
  });
  const { usersWithStrikes } = useSetHouseUsersWithStrikes(orgId);

  const filteredStrikes = strikes.filter((s) =>
    s.user_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    s.reason?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Stats
  const stats = {
    total: strikes.length,
    active: strikes.filter(s => s.status === 'active').length,
    appealed: strikes.filter(s => s.status === 'appealed').length,
    usersAffected: usersWithStrikes.length,
  };

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Total Strikes" value={stats.total} icon={<Shield className="w-5 h-5" />} />
        <StatCard label="Active" value={stats.active} icon={<AlertTriangle className="w-5 h-5" />} color="text-red-400" />
        <StatCard label="Appealed" value={stats.appealed} icon={<Shield className="w-5 h-5" />} color="text-yellow-400" />
        <StatCard label="Users Affected" value={stats.usersAffected} icon={<User className="w-5 h-5" />} color="text-purple-400" />
      </div>

      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-gray" />
          <Input
            placeholder="Search strikes..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as StrikeStatus | 'all')}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            {Object.entries(STATUS_CONFIG).map(([value, config]) => (
              <SelectItem key={value} value={value}>
                {config.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button onClick={() => setIsCreateModalOpen(true)}>
          <Plus className="w-4 h-4 mr-2" />
          Issue Strike
        </Button>
      </div>

      {/* Strikes List */}
      {isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </div>
      ) : filteredStrikes.length === 0 ? (
        <Card className="bg-charcoal-black/50 border-muted-gray/30">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <CheckCircle2 className="w-12 h-12 text-green-400 mb-4" />
            <h3 className="text-lg font-medium text-bone-white mb-2">No Strikes</h3>
            <p className="text-muted-gray text-center max-w-md">
              Great! There are no strikes recorded at this time.
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card className="bg-charcoal-black/50 border-muted-gray/30">
          <Table>
            <TableHeader>
              <TableRow className="border-muted-gray/30 hover:bg-transparent">
                <TableHead>User</TableHead>
                <TableHead>Reason</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Issued</TableHead>
                <TableHead>Expires</TableHead>
                <TableHead className="w-10"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredStrikes.map((strike) => (
                <StrikeRow key={strike.id} strike={strike} />
              ))}
            </TableBody>
          </Table>
        </Card>
      )}

      {/* Create Strike Modal */}
      <CreateStrikeModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onSubmit={async (data) => {
          await createStrike.mutateAsync(data);
          setIsCreateModalOpen(false);
        }}
        isSubmitting={createStrike.isPending}
      />
    </div>
  );
}

// ============================================================================
// STRIKE ROW
// ============================================================================

function StrikeRow({ strike }: { strike: SetHouseStrike }) {
  const statusConfig = STATUS_CONFIG[strike.status] || STATUS_CONFIG.active;

  return (
    <TableRow className="border-muted-gray/30 hover:bg-charcoal-black/30 cursor-pointer">
      <TableCell>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-red-500/20 flex items-center justify-center">
            <User className="w-5 h-5 text-red-400" />
          </div>
          <div>
            <p className="font-medium text-bone-white">{strike.user_name || 'Unknown User'}</p>
            {strike.user_email && (
              <p className="text-xs text-muted-gray">{strike.user_email}</p>
            )}
          </div>
        </div>
      </TableCell>
      <TableCell>
        <span className="text-muted-gray">
          {strike.strike_reason ? REASON_LABELS[strike.strike_reason] : strike.reason || '—'}
        </span>
      </TableCell>
      <TableCell>
        <Badge className={cn('border', statusConfig.color)}>
          {statusConfig.label}
        </Badge>
      </TableCell>
      <TableCell>
        {strike.issued_at ? (
          <span className="text-sm text-muted-gray">
            {format(new Date(strike.issued_at), 'MMM d, yyyy')}
          </span>
        ) : (
          <span className="text-muted-gray">—</span>
        )}
      </TableCell>
      <TableCell>
        {strike.expires_at ? (
          <span className="text-sm text-muted-gray">
            {format(new Date(strike.expires_at), 'MMM d, yyyy')}
          </span>
        ) : (
          <span className="text-muted-gray">Never</span>
        )}
      </TableCell>
      <TableCell>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm">
              <MoreVertical className="w-4 h-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem>
              <Eye className="w-4 h-4 mr-2" />
              View Details
            </DropdownMenuItem>
            <DropdownMenuItem>
              <Edit className="w-4 h-4 mr-2" />
              Edit
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </TableCell>
    </TableRow>
  );
}

// ============================================================================
// STAT CARD
// ============================================================================

function StatCard({
  label,
  value,
  icon,
  color,
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
  color?: string;
}) {
  return (
    <Card className="bg-charcoal-black/50 border-muted-gray/30">
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-muted-gray">{label}</p>
            <p className={cn('text-2xl font-bold', color || 'text-bone-white')}>{value}</p>
          </div>
          <div className={cn('opacity-50', color || 'text-muted-gray')}>{icon}</div>
        </div>
      </CardContent>
    </Card>
  );
}

// ============================================================================
// CREATE STRIKE MODAL
// ============================================================================

function CreateStrikeModal({
  isOpen,
  onClose,
  onSubmit,
  isSubmitting,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: { user_id: string; strike_reason: StrikeReason; reason?: string; notes?: string }) => Promise<void>;
  isSubmitting: boolean;
}) {
  const [userId, setUserId] = useState('');
  const [strikeReason, setStrikeReason] = useState<StrikeReason>('policy_violation');
  const [reason, setReason] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userId.trim()) {
      setError('User ID is required');
      return;
    }
    setError(null);
    try {
      await onSubmit({
        user_id: userId.trim(),
        strike_reason: strikeReason,
        reason: reason.trim() || undefined,
        notes: notes.trim() || undefined,
      });
      setUserId('');
      setStrikeReason('policy_violation');
      setReason('');
      setNotes('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to issue strike');
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Issue Strike</DialogTitle>
          <DialogDescription>Issue a strike to a user for policy violations</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="strike-user">User ID *</Label>
            <Input
              id="strike-user"
              value={userId}
              onChange={(e) => setUserId(e.target.value)}
              placeholder="User ID or email"
            />
          </div>
          <div>
            <Label htmlFor="strike-reason-type">Reason Type</Label>
            <Select value={strikeReason} onValueChange={(v) => setStrikeReason(v as StrikeReason)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(REASON_LABELS).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="strike-reason">Reason Details</Label>
            <Input
              id="strike-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Brief reason for the strike"
            />
          </div>
          <div>
            <Label htmlFor="strike-notes">Notes</Label>
            <Textarea
              id="strike-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Additional notes..."
              rows={3}
            />
          </div>
          {error && <div className="text-sm text-primary-red">{error}</div>}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting} variant="destructive">
              {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Issue Strike'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
