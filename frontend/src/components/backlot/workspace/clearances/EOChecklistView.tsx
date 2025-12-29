/**
 * EOChecklistView - E&O Requirements checklist for delivery readiness
 */
import { useState } from 'react';
import {
  useEORequirements,
  useEOSummary,
  useInitializeEORequirements,
  useUpdateEORequirement,
} from '@/hooks/backlot/useClearances';
import {
  EORequirement,
  EORequirementStatus,
  BacklotClearanceType,
  CLEARANCE_TYPE_LABELS,
  EO_STATUS_LABELS,
  EO_STATUS_COLORS,
} from '@/types/backlot';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import {
  CheckCircle,
  Circle,
  AlertCircle,
  XCircle,
  Shield,
  Link as LinkIcon,
  RefreshCw,
  Loader2,
  FileCheck,
} from 'lucide-react';

interface EOChecklistViewProps {
  projectId: string;
  clearances?: Array<{ id: string; title: string; status: string }>;
}

const STATUS_ICONS: Record<EORequirementStatus, typeof CheckCircle> = {
  complete: CheckCircle,
  partial: AlertCircle,
  missing: Circle,
  waived: XCircle,
};

export function EOChecklistView({ projectId, clearances = [] }: EOChecklistViewProps) {
  const [waiveDialogOpen, setWaiveDialogOpen] = useState(false);
  const [selectedRequirement, setSelectedRequirement] = useState<EORequirement | null>(null);
  const [waiveReason, setWaiveReason] = useState('');

  const { data: requirements, isLoading: loadingRequirements } = useEORequirements(projectId);
  const { data: summary, isLoading: loadingSummary } = useEOSummary(projectId);
  const initMutation = useInitializeEORequirements();
  const updateMutation = useUpdateEORequirement();

  const handleInitialize = async () => {
    try {
      const result = await initMutation.mutateAsync(projectId);
      toast.success('E&O checklist initialized', {
        description: `${result.count} requirements added`,
      });
    } catch (error) {
      toast.error('Failed to initialize E&O checklist');
    }
  };

  const handleStatusChange = async (requirement: EORequirement, status: EORequirementStatus) => {
    if (status === 'waived') {
      setSelectedRequirement(requirement);
      setWaiveDialogOpen(true);
      return;
    }

    try {
      await updateMutation.mutateAsync({
        requirementId: requirement.id,
        status,
      });
      toast.success('Status updated');
    } catch (error) {
      toast.error('Failed to update status');
    }
  };

  const handleLinkClearance = async (requirement: EORequirement, clearanceId: string | null) => {
    try {
      await updateMutation.mutateAsync({
        requirementId: requirement.id,
        linkedClearanceId: clearanceId,
        status: clearanceId ? 'complete' : 'missing',
      });
      toast.success(clearanceId ? 'Clearance linked' : 'Link removed');
    } catch (error) {
      toast.error('Failed to link clearance');
    }
  };

  const handleWaive = async () => {
    if (!selectedRequirement) return;

    try {
      await updateMutation.mutateAsync({
        requirementId: selectedRequirement.id,
        status: 'waived',
        waivedReason: waiveReason,
      });
      toast.success('Requirement waived');
      setWaiveDialogOpen(false);
      setSelectedRequirement(null);
      setWaiveReason('');
    } catch (error) {
      toast.error('Failed to waive requirement');
    }
  };

  // Group requirements by type
  const groupedRequirements = (requirements || []).reduce<Record<BacklotClearanceType, EORequirement[]>>(
    (acc, req) => {
      const type = req.clearance_type as BacklotClearanceType;
      if (!acc[type]) acc[type] = [];
      acc[type].push(req);
      return acc;
    },
    {} as Record<BacklotClearanceType, EORequirement[]>
  );

  if (loadingRequirements || loadingSummary) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  // No requirements initialized yet
  if (!requirements || requirements.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <Shield className="h-12 w-12 text-muted-foreground mb-4" />
        <h3 className="font-semibold text-lg mb-2">E&O Checklist Not Initialized</h3>
        <p className="text-muted-foreground text-sm mb-4 max-w-md">
          Initialize the E&O requirements checklist to track all necessary clearances for delivery.
        </p>
        <Button onClick={handleInitialize} disabled={initMutation.isPending}>
          {initMutation.isPending ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Initializing...
            </>
          ) : (
            <>
              <RefreshCw className="h-4 w-4 mr-2" />
              Initialize E&O Checklist
            </>
          )}
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary Card */}
      <div className="bg-muted-gray/20 rounded-lg p-4 border border-muted-gray/30">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <FileCheck className="h-5 w-5 text-primary-red" />
            <h3 className="font-semibold">Delivery Readiness</h3>
          </div>
          <Badge
            variant={summary?.is_delivery_ready ? 'default' : 'secondary'}
            className={summary?.is_delivery_ready ? 'bg-green-500' : ''}
          >
            {summary?.is_delivery_ready ? 'Ready' : 'Not Ready'}
          </Badge>
        </div>

        <Progress value={summary?.readiness_percentage || 0} className="h-2 mb-2" />

        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">
            {summary?.complete_count || 0} of {summary?.required_count || 0} required complete
          </span>
          <span className="font-medium">{summary?.readiness_percentage || 0}%</span>
        </div>

        {summary?.missing_critical && summary.missing_critical.length > 0 && (
          <div className="mt-3 pt-3 border-t border-muted-gray/30">
            <p className="text-sm font-medium text-red-500 mb-2">
              Missing Critical ({summary.missing_critical.length})
            </p>
            <div className="space-y-1">
              {summary.missing_critical.slice(0, 3).map((item) => (
                <p key={item.id} className="text-xs text-muted-foreground">
                  • {item.requirement_name}
                </p>
              ))}
              {summary.missing_critical.length > 3 && (
                <p className="text-xs text-muted-foreground">
                  ... and {summary.missing_critical.length - 3} more
                </p>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Requirements by Type */}
      <ScrollArea className="h-[500px] pr-4">
        <div className="space-y-6">
          {Object.entries(groupedRequirements).map(([type, reqs]) => (
            <div key={type}>
              <h4 className="font-medium text-sm text-muted-foreground mb-3">
                {CLEARANCE_TYPE_LABELS[type as BacklotClearanceType] || type}
              </h4>
              <div className="space-y-2">
                {reqs.map((req) => {
                  const StatusIcon = STATUS_ICONS[req.status];
                  const statusColor = EO_STATUS_COLORS[req.status];

                  return (
                    <div
                      key={req.id}
                      className="flex items-start gap-3 p-3 bg-background rounded-lg border border-muted-gray/30"
                    >
                      <div className={`mt-0.5 text-${statusColor}-500`}>
                        <StatusIcon className="h-5 w-5" />
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-sm">{req.requirement_name}</span>
                          {req.is_required && (
                            <Badge variant="outline" className="text-xs px-1 py-0">
                              Required
                            </Badge>
                          )}
                        </div>
                        {req.description && (
                          <p className="text-xs text-muted-foreground mt-1">{req.description}</p>
                        )}
                        {req.status === 'waived' && req.waived_reason && (
                          <p className="text-xs text-muted-foreground mt-1 italic">
                            Waived: {req.waived_reason}
                          </p>
                        )}
                        {req.linked_clearance && (
                          <div className="flex items-center gap-1 mt-1 text-xs text-muted-foreground">
                            <LinkIcon className="h-3 w-3" />
                            <span>Linked to: {req.linked_clearance.title}</span>
                          </div>
                        )}
                      </div>

                      <div className="flex items-center gap-2">
                        {/* Link clearance dropdown */}
                        <Select
                          value={req.linked_clearance_id || 'none'}
                          onValueChange={(value) =>
                            handleLinkClearance(req, value === 'none' ? null : value)
                          }
                        >
                          <SelectTrigger className="w-[140px] h-8 text-xs">
                            <SelectValue placeholder="Link clearance" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">No link</SelectItem>
                            {clearances.map((c) => (
                              <SelectItem key={c.id} value={c.id}>
                                {c.title}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>

                        {/* Status dropdown */}
                        <Select
                          value={req.status}
                          onValueChange={(value) =>
                            handleStatusChange(req, value as EORequirementStatus)
                          }
                        >
                          <SelectTrigger className="w-[100px] h-8 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {Object.entries(EO_STATUS_LABELS).map(([key, label]) => (
                              <SelectItem key={key} value={key}>
                                {label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </ScrollArea>

      {/* Waive Dialog */}
      <Dialog open={waiveDialogOpen} onOpenChange={setWaiveDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Waive Requirement</DialogTitle>
            <DialogDescription>
              Provide a reason for waiving this requirement. This will be recorded for audit purposes.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Requirement</Label>
              <p className="text-sm font-medium">{selectedRequirement?.requirement_name}</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="reason">Reason for waiver</Label>
              <Input
                id="reason"
                value={waiveReason}
                onChange={(e) => setWaiveReason(e.target.value)}
                placeholder="e.g., Not applicable for this production"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setWaiveDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleWaive}
              disabled={!waiveReason.trim() || updateMutation.isPending}
            >
              {updateMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                'Waive Requirement'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
