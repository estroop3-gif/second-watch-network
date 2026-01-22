/**
 * Incidents View
 * Manage incidents and issues for Set House spaces
 */
import React, { useState } from 'react';
import {
  AlertTriangle,
  Plus,
  Search,
  MoreVertical,
  Edit,
  Eye,
  CheckCircle2,
  Clock,
  XCircle,
  Home,
  User,
  Calendar,
  Loader2,
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

import { useSetHouseIncidents, useSetHouseSpaces } from '@/hooks/set-house';
import type { SetHouseIncident, IncidentStatus, IncidentSeverity, CreateIncidentInput } from '@/types/set-house';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';

const STATUS_CONFIG: Record<IncidentStatus, { label: string; color: string; icon: React.ReactNode }> = {
  open: {
    label: 'Open',
    color: 'bg-red-500/20 text-red-400 border-red-500/30',
    icon: <AlertTriangle className="w-3 h-3" />,
  },
  investigating: {
    label: 'Investigating',
    color: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
    icon: <Clock className="w-3 h-3" />,
  },
  resolved: {
    label: 'Resolved',
    color: 'bg-green-500/20 text-green-400 border-green-500/30',
    icon: <CheckCircle2 className="w-3 h-3" />,
  },
  closed: {
    label: 'Closed',
    color: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
    icon: <XCircle className="w-3 h-3" />,
  },
};

const SEVERITY_CONFIG: Record<IncidentSeverity, { label: string; color: string }> = {
  low: { label: 'Low', color: 'text-blue-400' },
  medium: { label: 'Medium', color: 'text-yellow-400' },
  high: { label: 'High', color: 'text-orange-400' },
  critical: { label: 'Critical', color: 'text-red-400' },
};

interface IncidentsViewProps {
  orgId: string;
}

export function IncidentsView({ orgId }: IncidentsViewProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<IncidentStatus | 'all'>('all');
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  const { incidents, isLoading, createIncident } = useSetHouseIncidents(orgId, {
    status: statusFilter === 'all' ? undefined : statusFilter,
  });
  const { spaces } = useSetHouseSpaces({ orgId });

  const filteredIncidents = incidents.filter((i) =>
    i.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    i.description?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Stats
  const stats = {
    total: incidents.length,
    open: incidents.filter(i => i.status === 'open').length,
    investigating: incidents.filter(i => i.status === 'investigating').length,
    resolved: incidents.filter(i => i.status === 'resolved').length,
  };

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Total Incidents" value={stats.total} icon={<AlertTriangle className="w-5 h-5" />} />
        <StatCard label="Open" value={stats.open} icon={<AlertTriangle className="w-5 h-5" />} color="text-red-400" />
        <StatCard label="Investigating" value={stats.investigating} icon={<Clock className="w-5 h-5" />} color="text-yellow-400" />
        <StatCard label="Resolved" value={stats.resolved} icon={<CheckCircle2 className="w-5 h-5" />} color="text-green-400" />
      </div>

      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-gray" />
          <Input
            placeholder="Search incidents..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9"
          />
        </div>
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
        <Button onClick={() => setIsCreateModalOpen(true)}>
          <Plus className="w-4 h-4 mr-2" />
          Report Incident
        </Button>
      </div>

      {/* Incidents List */}
      {isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </div>
      ) : filteredIncidents.length === 0 ? (
        <Card className="bg-charcoal-black/50 border-muted-gray/30">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <CheckCircle2 className="w-12 h-12 text-green-400 mb-4" />
            <h3 className="text-lg font-medium text-bone-white mb-2">No Incidents</h3>
            <p className="text-muted-gray text-center max-w-md">
              Great news! There are no incidents to report at this time.
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card className="bg-charcoal-black/50 border-muted-gray/30">
          <Table>
            <TableHeader>
              <TableRow className="border-muted-gray/30 hover:bg-transparent">
                <TableHead>Incident</TableHead>
                <TableHead>Space</TableHead>
                <TableHead>Severity</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Reported</TableHead>
                <TableHead className="w-10"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredIncidents.map((incident) => (
                <IncidentRow key={incident.id} incident={incident} />
              ))}
            </TableBody>
          </Table>
        </Card>
      )}

      {/* Create Incident Modal */}
      <CreateIncidentModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        spaces={spaces}
        onSubmit={async (data) => {
          await createIncident.mutateAsync(data);
          setIsCreateModalOpen(false);
        }}
        isSubmitting={createIncident.isPending}
      />
    </div>
  );
}

// ============================================================================
// INCIDENT ROW
// ============================================================================

function IncidentRow({ incident }: { incident: SetHouseIncident }) {
  const statusConfig = STATUS_CONFIG[incident.status] || STATUS_CONFIG.open;
  const severityConfig = incident.severity ? SEVERITY_CONFIG[incident.severity] : null;

  return (
    <TableRow className="border-muted-gray/30 hover:bg-charcoal-black/30 cursor-pointer">
      <TableCell>
        <div>
          <p className="font-medium text-bone-white">{incident.title}</p>
          {incident.description && (
            <p className="text-xs text-muted-gray line-clamp-1">{incident.description}</p>
          )}
        </div>
      </TableCell>
      <TableCell>
        <div className="flex items-center gap-2">
          <Home className="w-4 h-4 text-muted-gray" />
          <span className="text-muted-gray">{incident.space_name || '—'}</span>
        </div>
      </TableCell>
      <TableCell>
        {severityConfig ? (
          <span className={severityConfig.color}>{severityConfig.label}</span>
        ) : (
          <span className="text-muted-gray">—</span>
        )}
      </TableCell>
      <TableCell>
        <Badge className={cn('border', statusConfig.color)}>
          {statusConfig.icon}
          <span className="ml-1">{statusConfig.label}</span>
        </Badge>
      </TableCell>
      <TableCell>
        {incident.created_at ? (
          <span className="text-sm text-muted-gray">
            {format(new Date(incident.created_at), 'MMM d, yyyy')}
          </span>
        ) : (
          <span className="text-muted-gray">—</span>
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
// CREATE INCIDENT MODAL
// ============================================================================

function CreateIncidentModal({
  isOpen,
  onClose,
  spaces,
  onSubmit,
  isSubmitting,
}: {
  isOpen: boolean;
  onClose: () => void;
  spaces: Array<{ id: string; name: string }>;
  onSubmit: (data: CreateIncidentInput) => Promise<void>;
  isSubmitting: boolean;
}) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [spaceId, setSpaceId] = useState('');
  const [severity, setSeverity] = useState<IncidentSeverity>('medium');
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setError('Incident title is required');
      return;
    }
    setError(null);
    try {
      await onSubmit({
        title: title.trim(),
        description: description.trim() || undefined,
        space_id: spaceId || undefined,
        severity,
      });
      setTitle('');
      setDescription('');
      setSpaceId('');
      setSeverity('medium');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create incident');
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Report Incident</DialogTitle>
          <DialogDescription>Report a new incident or issue</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="incident-title">Title *</Label>
            <Input
              id="incident-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Brief description of the incident"
            />
          </div>
          <div>
            <Label htmlFor="incident-space">Related Space</Label>
            <Select value={spaceId} onValueChange={setSpaceId}>
              <SelectTrigger>
                <SelectValue placeholder="Select space (optional)" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">No specific space</SelectItem>
                {spaces.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="incident-severity">Severity</Label>
            <Select value={severity} onValueChange={(v) => setSeverity(v as IncidentSeverity)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(SEVERITY_CONFIG).map(([value, config]) => (
                  <SelectItem key={value} value={value}>
                    {config.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="incident-description">Description</Label>
            <Textarea
              id="incident-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Detailed description of the incident..."
              rows={4}
            />
          </div>
          {error && <div className="text-sm text-primary-red">{error}</div>}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Report Incident'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
