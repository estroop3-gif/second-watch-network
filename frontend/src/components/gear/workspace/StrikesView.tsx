/**
 * Strikes View
 * Manage user strikes and escalation
 */
import React, { useState } from 'react';
import {
  Shield,
  Plus,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  User,
  Loader2,
  Eye,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

import { useGearStrikes, useGearPendingReviews, useGearVoidStrike } from '@/hooks/gear';
import type { GearStrike, GearUserEscalationStatus, StrikeSeverity } from '@/types/gear';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';

const SEVERITY_CONFIG: Record<StrikeSeverity, { label: string; color: string; points: number }> = {
  warning: { label: 'Warning', color: 'bg-blue-500/20 text-blue-400 border-blue-500/30', points: 0 },
  minor: { label: 'Minor', color: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30', points: 1 },
  major: { label: 'Major', color: 'bg-orange-500/20 text-orange-400 border-orange-500/30', points: 2 },
  critical: { label: 'Critical', color: 'bg-red-500/20 text-red-400 border-red-500/30', points: 3 },
};

interface StrikesViewProps {
  orgId: string;
}

export function StrikesView({ orgId }: StrikesViewProps) {
  const [activeTab, setActiveTab] = useState<'strikes' | 'reviews'>('strikes');
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  const { strikes, isLoading, createStrike } = useGearStrikes({ orgId });
  const { pendingReviews, isLoading: reviewsLoading, reviewEscalation } = useGearPendingReviews(orgId);
  const voidStrike = useGearVoidStrike();

  const handleVoidStrike = async (strikeId: string) => {
    const reason = window.prompt('Enter reason for voiding this strike:');
    if (reason) {
      await voidStrike.mutateAsync({ strikeId, reason });
    }
  };

  return (
    <div className="space-y-6">
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'strikes' | 'reviews')}>
        <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
          <TabsList className="bg-charcoal-black/50 border border-muted-gray/30">
            <TabsTrigger value="strikes">Active Strikes ({strikes.length})</TabsTrigger>
            <TabsTrigger value="reviews">
              Pending Reviews
              {pendingReviews.length > 0 && (
                <Badge className="ml-2 bg-red-500/20 text-red-400">{pendingReviews.length}</Badge>
              )}
            </TabsTrigger>
          </TabsList>

          <Button onClick={() => setIsCreateModalOpen(true)}>
            <Plus className="w-4 h-4 mr-2" />
            Issue Strike
          </Button>
        </div>

        <TabsContent value="strikes" className="mt-6">
          {isLoading ? (
            <TableSkeleton />
          ) : strikes.length === 0 ? (
            <EmptyState message="No active strikes" icon={<CheckCircle2 className="w-12 h-12 text-green-400" />} />
          ) : (
            <StrikesTable strikes={strikes} onVoid={handleVoidStrike} />
          )}
        </TabsContent>

        <TabsContent value="reviews" className="mt-6">
          {reviewsLoading ? (
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-24" />
              ))}
            </div>
          ) : pendingReviews.length === 0 ? (
            <EmptyState message="No pending reviews" icon={<CheckCircle2 className="w-12 h-12 text-green-400" />} />
          ) : (
            <div className="space-y-4">
              {pendingReviews.map((review) => (
                <PendingReviewCard
                  key={review.id}
                  review={review}
                  onReview={async (decision) => {
                    await reviewEscalation.mutateAsync({
                      userId: review.user_id,
                      decision,
                    });
                  }}
                  isSubmitting={reviewEscalation.isPending}
                />
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

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

function StrikesTable({ strikes, onVoid }: { strikes: GearStrike[]; onVoid: (id: string) => void }) {
  return (
    <Card className="bg-charcoal-black/50 border-muted-gray/30">
      <Table>
        <TableHeader>
          <TableRow className="border-muted-gray/30 hover:bg-transparent">
            <TableHead>User</TableHead>
            <TableHead>Severity</TableHead>
            <TableHead>Points</TableHead>
            <TableHead>Reason</TableHead>
            <TableHead>Issued By</TableHead>
            <TableHead>Date</TableHead>
            <TableHead className="w-20"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {strikes.map((strike) => {
            const severityConfig = SEVERITY_CONFIG[strike.severity];

            return (
              <TableRow key={strike.id} className="border-muted-gray/30 hover:bg-charcoal-black/30">
                <TableCell>
                  <div className="flex items-center gap-2">
                    <User className="w-4 h-4 text-muted-gray" />
                    <span className="text-bone-white">{strike.user_name || strike.user_id.slice(0, 8)}</span>
                  </div>
                </TableCell>
                <TableCell>
                  <Badge className={cn('border', severityConfig.color)}>{severityConfig.label}</Badge>
                </TableCell>
                <TableCell>
                  <span className="font-mono">{strike.points}</span>
                </TableCell>
                <TableCell>
                  <span className="text-muted-gray line-clamp-1 max-w-[200px]">{strike.reason}</span>
                </TableCell>
                <TableCell>
                  <span className="text-muted-gray">{strike.issued_by_name || '—'}</span>
                </TableCell>
                <TableCell>
                  <span className="text-sm text-muted-gray">
                    {format(new Date(strike.issued_at), 'MMM d, yyyy')}
                  </span>
                </TableCell>
                <TableCell>
                  <Button variant="ghost" size="sm" onClick={() => onVoid(strike.id)}>
                    <XCircle className="w-4 h-4 text-muted-gray hover:text-red-400" />
                  </Button>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </Card>
  );
}

function PendingReviewCard({
  review,
  onReview,
  isSubmitting,
}: {
  review: GearUserEscalationStatus;
  onReview: (decision: string) => Promise<void>;
  isSubmitting: boolean;
}) {
  return (
    <Card className="bg-charcoal-black/50 border-orange-500/30">
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-lg bg-orange-500/20 flex items-center justify-center">
              <AlertTriangle className="w-6 h-6 text-orange-400" />
            </div>
            <div>
              <p className="font-medium text-bone-white">{review.user_name || 'User'}</p>
              <p className="text-sm text-muted-gray">
                {review.total_active_strikes} strikes • {review.total_active_points} points
              </p>
              <p className="text-sm text-orange-400">Level: {review.escalation_level}</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => onReview('approved')}
              disabled={isSubmitting}
              className="border-green-500/30 text-green-400 hover:bg-green-500/20"
            >
              Approve
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => onReview('probation')}
              disabled={isSubmitting}
              className="border-yellow-500/30 text-yellow-400 hover:bg-yellow-500/20"
            >
              Probation
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => onReview('suspended')}
              disabled={isSubmitting}
              className="border-red-500/30 text-red-400 hover:bg-red-500/20"
            >
              Suspend
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function TableSkeleton() {
  return (
    <div className="space-y-2">
      {[1, 2, 3, 4, 5].map((i) => (
        <Skeleton key={i} className="h-14 w-full" />
      ))}
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
            />
          </div>

          <div>
            <Label>Severity</Label>
            <Select value={severity} onValueChange={(v) => setSeverity(v as StrikeSeverity)}>
              <SelectTrigger>
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
            />
          </div>

          <div>
            <Label>Custom Points (optional)</Label>
            <Input
              type="number"
              value={customPoints}
              onChange={(e) => setCustomPoints(e.target.value)}
              placeholder="Override default points"
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
