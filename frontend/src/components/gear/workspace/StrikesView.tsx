/**
 * Strikes View - User-Centric
 * Shows users with strike summaries, click to see full details
 */
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Shield,
  Plus,
  CheckCircle2,
  Search,
  Filter,
  Loader2,
  Users,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
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

import { useUsersWithStrikes, useCreateStrike } from '@/hooks/gear/useGearStrikes';
import { UserStrikeCard } from '@/components/gear/strikes';
import type { StrikeSeverity } from '@/types/gear';

const SEVERITY_CONFIG: Record<StrikeSeverity, { label: string; color: string; points: number }> = {
  warning: { label: 'Warning', color: 'bg-blue-500/20 text-blue-400 border-blue-500/30', points: 0 },
  minor: { label: 'Minor', color: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30', points: 1 },
  major: { label: 'Major', color: 'bg-orange-500/20 text-orange-400 border-orange-500/30', points: 2 },
  critical: { label: 'Critical', color: 'bg-red-500/20 text-red-400 border-red-500/30', points: 3 },
};

type FilterType = 'all' | 'escalated' | 'active';

interface StrikesViewProps {
  orgId: string;
}

export function StrikesView({ orgId }: StrikesViewProps) {
  const navigate = useNavigate();
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [filter, setFilter] = useState<FilterType>('active');
  const [searchTerm, setSearchTerm] = useState('');

  const createStrike = useCreateStrike(orgId);

  const { data: users = [], isLoading } = useUsersWithStrikes({
    orgId,
    includeClear: filter === 'all',
    escalatedOnly: filter === 'escalated',
  });

  // Filter users by search term
  const filteredUsers = users.filter((user) =>
    searchTerm
      ? user.user_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        user.email?.toLowerCase().includes(searchTerm.toLowerCase())
      : true
  );

  // Count escalated users
  const escalatedCount = users.filter((u) => u.is_escalated && u.requires_manager_review).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-semibold text-bone-white flex items-center gap-2">
            <Users className="w-5 h-5 text-muted-gray" />
            User Strikes
          </h2>
          {escalatedCount > 0 && (
            <Badge className="bg-red-500/20 text-red-400 border-red-500/30">
              {escalatedCount} Escalated
            </Badge>
          )}
        </div>

        <Button onClick={() => setIsCreateModalOpen(true)}>
          <Plus className="w-4 h-4 mr-2" />
          Issue Strike
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-gray" />
          <Input
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search by name or email..."
            className="pl-9 bg-charcoal-black/50 border-muted-gray/30"
          />
        </div>

        <Select value={filter} onValueChange={(v) => setFilter(v as FilterType)}>
          <SelectTrigger className="w-[180px] bg-charcoal-black/50 border-muted-gray/30">
            <Filter className="w-4 h-4 mr-2 text-muted-gray" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="active">With Active Strikes</SelectItem>
            <SelectItem value="escalated">Escalated Only</SelectItem>
            <SelectItem value="all">All Users</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* User List */}
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <Skeleton key={i} className="h-24 w-full" />
          ))}
        </div>
      ) : filteredUsers.length === 0 ? (
        <EmptyState
          message={
            searchTerm
              ? 'No users match your search'
              : filter === 'escalated'
                ? 'No escalated users'
                : 'No users with strikes'
          }
          icon={<CheckCircle2 className="w-12 h-12 text-green-400" />}
        />
      ) : (
        <div className="space-y-3">
          {filteredUsers.map((user) => (
            <UserStrikeCard
              key={user.user_id}
              user={user}
              onClick={() => navigate(`/gear/${orgId}/strikes/${user.user_id}`)}
            />
          ))}
        </div>
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

function EmptyState({ message, icon }: { message: string; icon?: React.ReactNode }) {
  return (
    <Card className="bg-charcoal-black/50 border-muted-gray/30">
      <CardContent className="flex flex-col items-center justify-center py-12">
        {icon || <Shield className="w-12 h-12 text-muted-gray mb-4" />}
        <p className="text-muted-gray mt-4">{message}</p>
      </CardContent>
    </Card>
  );
}

function CreateStrikeModal({
  isOpen,
  onClose,
  onSubmit,
  isSubmitting,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: {
    user_id: string;
    severity: StrikeSeverity;
    reason: string;
    points?: number;
  }) => Promise<void>;
  isSubmitting: boolean;
}) {
  const [userId, setUserId] = useState('');
  const [severity, setSeverity] = useState<StrikeSeverity>('minor');
  const [reason, setReason] = useState('');
  const [customPoints, setCustomPoints] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userId || !reason) return;
    await onSubmit({
      user_id: userId,
      severity,
      reason,
      points: customPoints ? parseInt(customPoints, 10) : undefined,
    });
    // Reset
    setUserId('');
    setSeverity('minor');
    setReason('');
    setCustomPoints('');
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Issue Strike</DialogTitle>
          <DialogDescription>Issue a strike against a user for policy violations</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label>User ID *</Label>
            <Input
              value={userId}
              onChange={(e) => setUserId(e.target.value)}
              placeholder="Enter user ID"
              className="bg-charcoal-black/50 border-muted-gray/30"
            />
          </div>

          <div>
            <Label>Severity</Label>
            <Select value={severity} onValueChange={(v) => setSeverity(v as StrikeSeverity)}>
              <SelectTrigger className="bg-charcoal-black/50 border-muted-gray/30">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(SEVERITY_CONFIG).map(([value, config]) => (
                  <SelectItem key={value} value={value}>
                    {config.label} ({config.points} pts)
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Reason *</Label>
            <Textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Describe the violation..."
              rows={3}
              className="bg-charcoal-black/50 border-muted-gray/30"
            />
          </div>

          <div>
            <Label>Custom Points (optional)</Label>
            <Input
              type="number"
              value={customPoints}
              onChange={(e) => setCustomPoints(e.target.value)}
              placeholder="Override default points"
              className="bg-charcoal-black/50 border-muted-gray/30"
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting || !userId || !reason}>
              {isSubmitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Issue Strike
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
