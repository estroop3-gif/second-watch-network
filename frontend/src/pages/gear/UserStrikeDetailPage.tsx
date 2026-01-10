/**
 * User Strike Detail Page
 * Full-page view of a user's strikes with management actions
 */
import React, { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { format } from 'date-fns';
import {
  ArrowLeft,
  Plus,
  AlertTriangle,
  User,
  XCircle,
  CheckCircle2,
  Clock,
  FileText,
  ExternalLink,
  Loader2,
  Mail,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
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
import { Input } from '@/components/ui/input';

import {
  useUserStrikes,
  useUserEscalationStatus,
  useVoidStrike,
  useReviewEscalation,
} from '@/hooks/gear/useGearStrikes';
import { EscalationStatusBadge, ManagerReviewPanel } from '@/components/gear/strikes';
import { cn } from '@/lib/utils';
import type { GearStrike, StrikeSeverity } from '@/types/gear';

const SEVERITY_CONFIG: Record<
  StrikeSeverity,
  { label: string; color: string; bgColor: string; points: number }
> = {
  warning: {
    label: 'Warning',
    color: 'text-blue-400',
    bgColor: 'bg-blue-500/20 border-blue-500/30',
    points: 0,
  },
  minor: {
    label: 'Minor',
    color: 'text-yellow-400',
    bgColor: 'bg-yellow-500/20 border-yellow-500/30',
    points: 1,
  },
  major: {
    label: 'Major',
    color: 'text-orange-400',
    bgColor: 'bg-orange-500/20 border-orange-500/30',
    points: 2,
  },
  critical: {
    label: 'Critical',
    color: 'text-red-400',
    bgColor: 'bg-red-500/20 border-red-500/30',
    points: 3,
  },
};

type FilterType = 'all' | 'active' | 'voided';

export default function UserStrikeDetailPage() {
  const { orgId, userId } = useParams<{ orgId: string; userId: string }>();
  const navigate = useNavigate();

  const [filter, setFilter] = useState<FilterType>('all');
  const [voidDialog, setVoidDialog] = useState<{ open: boolean; strikeId: string | null }>({
    open: false,
    strikeId: null,
  });
  const [voidReason, setVoidReason] = useState('');

  const { data: strikes = [], isLoading: strikesLoading } = useUserStrikes(
    orgId || null,
    userId || null,
    filter === 'active'
  );
  const { data: escalationStatus, isLoading: statusLoading } = useUserEscalationStatus(
    orgId || null,
    userId || null
  );
  const voidStrike = useVoidStrike();
  const reviewEscalation = useReviewEscalation(orgId || null);

  const isLoading = strikesLoading || statusLoading;

  // Filter strikes based on selection
  const filteredStrikes =
    filter === 'voided' ? strikes.filter((s) => !s.is_active) : strikes;

  // Calculate stats
  const activeStrikes = strikes.filter((s) => s.is_active);
  const totalPoints = activeStrikes.reduce((sum, s) => sum + (s.points || 0), 0);
  const lifetimeStrikes = strikes.length;

  const handleVoidStrike = async () => {
    if (!voidDialog.strikeId || !voidReason) return;
    await voidStrike.mutateAsync({ strikeId: voidDialog.strikeId, reason: voidReason });
    setVoidDialog({ open: false, strikeId: null });
    setVoidReason('');
  };

  const handleReview = async (decision: 'approved' | 'probation' | 'suspended', notes?: string) => {
    if (!userId) return;
    await reviewEscalation.mutateAsync({ userId, decision, notes });
  };

  // Get user info from escalation status or first strike
  const userName = escalationStatus?.user_name || strikes[0]?.user_name || 'User';
  const initials = userName
    .split(' ')
    .map((n) => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  if (isLoading) {
    return (
      <div className="p-6 space-y-6 max-w-6xl mx-auto">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 max-w-6xl mx-auto">
      {/* Back Button */}
      <Button variant="ghost" className="gap-2 text-muted-gray" onClick={() => navigate(-1)}>
        <ArrowLeft className="w-4 h-4" />
        Back to Strikes
      </Button>

      {/* User Header */}
      <Card className="bg-charcoal-black/50 border-muted-gray/30">
        <CardContent className="p-6">
          <div className="flex flex-col md:flex-row gap-6 items-start md:items-center justify-between">
            {/* User Info */}
            <div className="flex items-center gap-4">
              <Avatar className="w-16 h-16">
                <AvatarImage src={escalationStatus?.avatar_url} alt={userName} />
                <AvatarFallback className="bg-muted-gray/20 text-bone-white text-xl">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <div>
                <h1 className="text-2xl font-bold text-bone-white">{userName}</h1>
                {escalationStatus?.email && (
                  <p className="text-sm text-muted-gray flex items-center gap-1 mt-1">
                    <Mail className="w-3 h-3" />
                    {escalationStatus.email}
                  </p>
                )}
              </div>
            </div>

            {/* Stats Cards */}
            <div className="flex gap-4 flex-wrap">
              <StatCard label="Active Strikes" value={activeStrikes.length} />
              <StatCard label="Active Points" value={totalPoints} />
              <StatCard label="Lifetime" value={lifetimeStrikes} />
              <div className="px-4 py-2 rounded-lg bg-charcoal-black/30 border border-muted-gray/20">
                <p className="text-xs text-muted-gray mb-1">Status</p>
                <EscalationStatusBadge
                  isEscalated={escalationStatus?.is_escalated || false}
                  requiresReview={escalationStatus?.requires_manager_review || false}
                  reviewDecision={escalationStatus?.review_decision}
                  activeStrikes={activeStrikes.length}
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Manager Review Panel - only show if escalated */}
      {(escalationStatus?.requires_manager_review || escalationStatus?.review_decision) && (
        <ManagerReviewPanel
          userName={userName}
          requiresReview={escalationStatus?.requires_manager_review || false}
          currentDecision={escalationStatus?.review_decision}
          onReview={handleReview}
          isLoading={reviewEscalation.isPending}
        />
      )}

      {/* Strike History */}
      <Card className="bg-charcoal-black/50 border-muted-gray/30">
        <CardHeader className="pb-4">
          <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
            <CardTitle className="text-lg font-medium text-bone-white">Strike History</CardTitle>
            <Select value={filter} onValueChange={(v) => setFilter(v as FilterType)}>
              <SelectTrigger className="w-[150px] bg-charcoal-black/50 border-muted-gray/30">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Strikes</SelectItem>
                <SelectItem value="active">Active Only</SelectItem>
                <SelectItem value="voided">Voided Only</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {filteredStrikes.length === 0 ? (
            <div className="text-center py-12">
              <CheckCircle2 className="w-12 h-12 text-green-400 mx-auto mb-4" />
              <p className="text-muted-gray">
                {filter === 'all'
                  ? 'No strikes on record'
                  : filter === 'active'
                    ? 'No active strikes'
                    : 'No voided strikes'}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredStrikes.map((strike) => (
                <StrikeRow
                  key={strike.id}
                  strike={strike}
                  orgId={orgId || ''}
                  onVoid={() => setVoidDialog({ open: true, strikeId: strike.id })}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Void Strike Dialog */}
      <AlertDialog
        open={voidDialog.open}
        onOpenChange={(open) => !open && setVoidDialog({ open: false, strikeId: null })}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Void Strike</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div>
                <p className="mb-4">
                  Voiding this strike will remove it from the user's active record. This action is
                  permanent.
                </p>
                <Input
                  value={voidReason}
                  onChange={(e) => setVoidReason(e.target.value)}
                  placeholder="Reason for voiding (required)"
                  className="bg-charcoal-black/50 border-muted-gray/30"
                />
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleVoidStrike}
              disabled={!voidReason || voidStrike.isPending}
              className="bg-red-600 hover:bg-red-700"
            >
              {voidStrike.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Void Strike
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="px-4 py-2 rounded-lg bg-charcoal-black/30 border border-muted-gray/20 text-center min-w-[80px]">
      <p className="text-2xl font-bold text-bone-white">{value}</p>
      <p className="text-xs text-muted-gray">{label}</p>
    </div>
  );
}

function StrikeRow({
  strike,
  orgId,
  onVoid,
}: {
  strike: GearStrike;
  orgId: string;
  onVoid: () => void;
}) {
  const config = SEVERITY_CONFIG[strike.severity];
  const isVoided = !strike.is_active;

  return (
    <div
      className={cn(
        'p-4 rounded-lg border transition-colors',
        isVoided
          ? 'bg-charcoal-black/20 border-muted-gray/20 opacity-60'
          : 'bg-charcoal-black/30 border-muted-gray/30'
      )}
    >
      <div className="flex items-start justify-between gap-4">
        {/* Left: Severity + Details */}
        <div className="flex gap-4">
          {/* Severity Badge */}
          <div
            className={cn(
              'px-3 py-2 rounded-lg border text-center min-w-[80px]',
              isVoided ? 'bg-muted-gray/10 border-muted-gray/20' : config.bgColor
            )}
          >
            <p className={cn('text-sm font-medium uppercase', isVoided ? 'text-muted-gray' : config.color)}>
              {config.label}
            </p>
            <p className={cn('text-xs', isVoided ? 'text-muted-gray/60' : 'text-muted-gray')}>
              {strike.points} pt{strike.points !== 1 ? 's' : ''}
            </p>
          </div>

          {/* Details */}
          <div className="flex-1">
            <p className={cn('font-medium', isVoided ? 'text-muted-gray' : 'text-bone-white')}>
              {strike.reason}
            </p>

            <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-xs text-muted-gray">
              <span className="flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {format(new Date(strike.issued_at), 'MMM d, yyyy')}
              </span>
              <span className="flex items-center gap-1">
                <User className="w-3 h-3" />
                {strike.is_auto_applied ? 'Auto-applied' : strike.issued_by_name || 'Unknown'}
              </span>
            </div>

            {/* Links */}
            <div className="flex flex-wrap gap-2 mt-2">
              {strike.incident_id && (
                <Link
                  to={`/gear/${orgId}/incidents/${strike.incident_id}`}
                  className="text-xs text-accent-yellow hover:underline flex items-center gap-1"
                >
                  <FileText className="w-3 h-3" />
                  View Incident
                </Link>
              )}
              {strike.transaction_id && (
                <span className="text-xs text-muted-gray flex items-center gap-1">
                  <FileText className="w-3 h-3" />
                  Transaction: {strike.transaction_id.slice(0, 8)}...
                </span>
              )}
            </div>

            {/* Voided Info */}
            {isVoided && strike.void_reason && (
              <div className="mt-2 px-3 py-2 rounded bg-muted-gray/10 text-xs text-muted-gray">
                <span className="font-medium">Voided:</span> {strike.void_reason}
                {strike.voided_at && (
                  <span className="ml-2">
                    ({format(new Date(strike.voided_at), 'MMM d, yyyy')})
                  </span>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Right: Actions */}
        {!isVoided && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onVoid}
            className="text-muted-gray hover:text-red-400"
          >
            <XCircle className="w-4 h-4" />
          </Button>
        )}
      </div>
    </div>
  );
}
