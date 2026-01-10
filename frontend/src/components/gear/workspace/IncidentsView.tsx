/**
 * Incidents View
 * Manage damage reports and incidents
 */
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertTriangle,
  Plus,
  Search,
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Loader2,
  Eye,
  Wrench,
  RefreshCw,
  RefreshCcw,
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useToast } from '@/components/ui/use-toast';

import { useGearIncidents, useGearIncidentStats } from '@/hooks/gear';
import type { GearIncident, IncidentType, IncidentStatus, DamageTier } from '@/types/gear';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';

const STATUS_CONFIG: Record<IncidentStatus, { label: string; color: string; icon: React.ReactNode }> = {
  open: {
    label: 'Open',
    color: 'bg-red-500/20 text-red-400 border-red-500/30',
    icon: <AlertCircle className="w-3 h-3" />,
  },
  investigating: {
    label: 'Investigating',
    color: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
    icon: <Eye className="w-3 h-3" />,
  },
  repair: {
    label: 'In Repair',
    color: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
    icon: <Wrench className="w-3 h-3" />,
  },
  replacement: {
    label: 'Replacement',
    color: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
    icon: <RefreshCw className="w-3 h-3" />,
  },
  resolved: {
    label: 'Resolved',
    color: 'bg-green-500/20 text-green-400 border-green-500/30',
    icon: <CheckCircle2 className="w-3 h-3" />,
  },
};

const TYPE_CONFIG: Record<IncidentType, { label: string; color: string }> = {
  damage: { label: 'Damage', color: 'text-red-400' },
  missing_item: { label: 'Missing Item', color: 'text-orange-400' },
  late_return: { label: 'Late Return', color: 'text-yellow-400' },
  policy_violation: { label: 'Policy Violation', color: 'text-purple-400' },
  unsafe_behavior: { label: 'Unsafe Behavior', color: 'text-pink-400' },
};

const DAMAGE_TIER_CONFIG: Record<DamageTier, { label: string; color: string }> = {
  cosmetic: { label: 'Cosmetic', color: 'text-blue-400' },
  functional: { label: 'Functional', color: 'text-yellow-400' },
  unsafe: { label: 'Unsafe', color: 'text-orange-400' },
  out_of_service: { label: 'Out of Service', color: 'text-red-400' },
};

interface IncidentsViewProps {
  orgId: string;
}

export function IncidentsView({ orgId }: IncidentsViewProps) {
  const { toast } = useToast();
  const [statusFilter, setStatusFilter] = useState<IncidentStatus | 'all'>('all');
  const [typeFilter, setTypeFilter] = useState<IncidentType | 'all'>('all');
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [errorModalOpen, setErrorModalOpen] = useState(false);
  const [errorDetails, setErrorDetails] = useState<{ title: string; message: string } | null>(null);

  const { incidents, isLoading, error, refetch, createIncident } = useGearIncidents({
    orgId,
    status: statusFilter === 'all' ? undefined : statusFilter,
    incidentType: typeFilter === 'all' ? undefined : typeFilter,
  });

  const { data: stats, error: statsError } = useGearIncidentStats(orgId);

  // Show error dialog for detailed errors
  const showErrorModal = (title: string, message: string) => {
    setErrorDetails({ title, message });
    setErrorModalOpen(true);
  };

  // Handle create incident with error handling
  const handleCreateIncident = async (data: {
    incident_type: IncidentType;
    asset_id?: string;
    damage_tier?: DamageTier;
    damage_description?: string;
    notes?: string;
  }) => {
    try {
      await createIncident.mutateAsync(data);
      setIsCreateModalOpen(false);
      toast({
        title: 'Incident Reported',
        description: 'The incident has been successfully logged.',
      });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An unexpected error occurred';
      toast({
        title: 'Failed to Report Incident',
        description: 'There was a problem creating the incident report.',
        variant: 'destructive',
      });
      showErrorModal('Failed to Report Incident', errorMessage);
    }
  };

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Open" value={stats?.by_status?.open ?? 0} color="text-red-400" />
        <StatCard label="Investigating" value={stats?.by_status?.investigating ?? 0} color="text-yellow-400" />
        <StatCard label="Resolved" value={stats?.by_status?.resolved ?? 0} color="text-green-400" />
        <StatCard
          label="Total Cost (30d)"
          value={`$${(stats?.last_30_days?.total_cost ?? 0).toLocaleString()}`}
        />
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as IncidentStatus | 'all')}>
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
        <Select value={typeFilter} onValueChange={(v) => setTypeFilter(v as IncidentType | 'all')}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            {Object.entries(TYPE_CONFIG).map(([value, config]) => (
              <SelectItem key={value} value={value}>
                {config.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="flex-1" />
        <Button onClick={() => setIsCreateModalOpen(true)}>
          <Plus className="w-4 h-4 mr-2" />
          Report Incident
        </Button>
      </div>

      {/* Incidents Table with Error Handling */}
      {error ? (
        <ErrorState
          message={error instanceof Error ? error.message : 'Failed to load incidents'}
          onRetry={() => refetch()}
        />
      ) : isLoading ? (
        <IncidentsTableSkeleton />
      ) : incidents.length === 0 ? (
        <EmptyState />
      ) : (
        <IncidentsTable incidents={incidents} orgId={orgId} />
      )}

      {/* Create Incident Modal */}
      <CreateIncidentModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onSubmit={handleCreateIncident}
        isSubmitting={createIncident.isPending}
        error={createIncident.error instanceof Error ? createIncident.error.message : null}
      />

      {/* Error Details Modal */}
      <AlertDialog open={errorModalOpen} onOpenChange={setErrorModalOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-red-400">
              <AlertTriangle className="w-5 h-5" />
              {errorDetails?.title || 'Error'}
            </AlertDialogTitle>
            <AlertDialogDescription className="text-left">
              <p className="text-muted-gray mb-2">The following error occurred:</p>
              <div className="bg-charcoal-black/50 rounded-lg p-3 text-sm text-bone-white font-mono break-all">
                {errorDetails?.message || 'Unknown error'}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction onClick={() => setErrorModalOpen(false)}>
              Dismiss
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function StatCard({ label, value, color }: { label: string; value: string | number; color?: string }) {
  return (
    <Card className="bg-charcoal-black/50 border-muted-gray/30">
      <CardContent className="p-4">
        <p className="text-sm text-muted-gray">{label}</p>
        <p className={cn('text-2xl font-bold', color || 'text-bone-white')}>{value}</p>
      </CardContent>
    </Card>
  );
}

function IncidentsTable({ incidents, orgId }: { incidents: GearIncident[]; orgId: string }) {
  const navigate = useNavigate();

  const handleRowClick = (incidentId: string) => {
    navigate(`/gear/${orgId}/incidents/${incidentId}`);
  };

  return (
    <Card className="bg-charcoal-black/50 border-muted-gray/30">
      <Table>
        <TableHeader>
          <TableRow className="border-muted-gray/30 hover:bg-transparent">
            <TableHead>Type</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Asset</TableHead>
            <TableHead>Damage Tier</TableHead>
            <TableHead>Reported By</TableHead>
            <TableHead>Date</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {incidents.map((incident) => {
            const statusConfig = STATUS_CONFIG[incident.status];
            const typeConfig = TYPE_CONFIG[incident.incident_type];
            const damageConfig = incident.damage_tier ? DAMAGE_TIER_CONFIG[incident.damage_tier] : null;

            return (
              <TableRow
                key={incident.id}
                className="border-muted-gray/30 hover:bg-accent-yellow/5 cursor-pointer transition-colors"
                onClick={() => handleRowClick(incident.id)}
              >
                <TableCell>
                  <span className={typeConfig.color}>{typeConfig.label}</span>
                </TableCell>
                <TableCell>
                  <Badge className={cn('border', statusConfig.color)}>
                    {statusConfig.icon}
                    <span className="ml-1">{statusConfig.label}</span>
                  </Badge>
                </TableCell>
                <TableCell>
                  <span className="text-bone-white">{incident.asset_name || '—'}</span>
                </TableCell>
                <TableCell>
                  {damageConfig ? (
                    <span className={damageConfig.color}>{damageConfig.label}</span>
                  ) : (
                    '—'
                  )}
                </TableCell>
                <TableCell>
                  <span className="text-muted-gray">{incident.reported_by_name || '—'}</span>
                </TableCell>
                <TableCell>
                  <span className="text-sm text-muted-gray">
                    {format(new Date(incident.reported_at), 'MMM d, yyyy')}
                  </span>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </Card>
  );
}

function IncidentsTableSkeleton() {
  return (
    <div className="space-y-2">
      {[1, 2, 3, 4, 5].map((i) => (
        <Skeleton key={i} className="h-14 w-full" />
      ))}
    </div>
  );
}

function EmptyState() {
  return (
    <Card className="bg-charcoal-black/50 border-muted-gray/30">
      <CardContent className="flex flex-col items-center justify-center py-12">
        <CheckCircle2 className="w-12 h-12 text-green-400 mb-4" />
        <p className="text-muted-gray">No incidents reported</p>
      </CardContent>
    </Card>
  );
}

function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <Card className="bg-charcoal-black/50 border-red-500/30">
      <CardContent className="flex flex-col items-center justify-center py-12">
        <AlertTriangle className="w-12 h-12 text-red-400 mb-4" />
        <p className="text-bone-white font-medium mb-2">Failed to Load Incidents</p>
        <p className="text-muted-gray text-sm text-center max-w-md mb-4">{message}</p>
        <Button onClick={onRetry} variant="outline" className="border-red-500/30 text-red-400 hover:bg-red-500/10">
          <RefreshCcw className="w-4 h-4 mr-2" />
          Retry
        </Button>
      </CardContent>
    </Card>
  );
}

function CreateIncidentModal({
  isOpen,
  onClose,
  onSubmit,
  isSubmitting,
  error,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: {
    incident_type: IncidentType;
    asset_id?: string;
    damage_tier?: DamageTier;
    damage_description?: string;
    notes?: string;
  }) => Promise<void>;
  isSubmitting: boolean;
  error?: string | null;
}) {
  const [incidentType, setIncidentType] = useState<IncidentType>('damage');
  const [assetId, setAssetId] = useState('');
  const [damageTier, setDamageTier] = useState<DamageTier | ''>('');
  const [description, setDescription] = useState('');
  const [notes, setNotes] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onSubmit({
      incident_type: incidentType,
      asset_id: assetId || undefined,
      damage_tier: damageTier || undefined,
      damage_description: description || undefined,
      notes: notes || undefined,
    });
    // Reset
    setIncidentType('damage');
    setAssetId('');
    setDamageTier('');
    setDescription('');
    setNotes('');
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Report Incident</DialogTitle>
          <DialogDescription>Report damage, missing items, or policy violations</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-red-400 mt-0.5 flex-shrink-0" />
              <p className="text-sm text-red-400">{error}</p>
            </div>
          )}
          <div>
            <Label>Incident Type</Label>
            <Select value={incidentType} onValueChange={(v) => setIncidentType(v as IncidentType)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(TYPE_CONFIG).map(([value, config]) => (
                  <SelectItem key={value} value={value}>
                    {config.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Asset ID (optional)</Label>
            <Input
              value={assetId}
              onChange={(e) => setAssetId(e.target.value)}
              placeholder="Scan or enter asset ID"
            />
          </div>

          {incidentType === 'damage' && (
            <div>
              <Label>Damage Tier</Label>
              <Select value={damageTier} onValueChange={(v) => setDamageTier(v as DamageTier)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select severity" />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(DAMAGE_TIER_CONFIG).map(([value, config]) => (
                    <SelectItem key={value} value={value}>
                      {config.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div>
            <Label>Description</Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe what happened..."
              rows={3}
            />
          </div>

          <div>
            <Label>Notes (optional)</Label>
            <Input
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Additional notes"
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Submit Report
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
