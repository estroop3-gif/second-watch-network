/**
 * ClearanceEOTab - E&O requirements linking and status
 * Shows E&O critical toggle and linked requirements
 */
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Shield,
  AlertTriangle,
  CheckCircle,
  Link2,
  Link2Off,
  FileCheck,
  FileX,
  Loader2,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  BacklotClearanceItem,
  CLEARANCE_TYPE_LABELS,
} from '@/types/backlot';
import { useClearances, useEORequirements, useUpdateEORequirement } from '@/hooks/backlot';

interface ClearanceEOTabProps {
  projectId: string;
  clearance: BacklotClearanceItem;
  canEdit: boolean;
}

export default function ClearanceEOTab({
  projectId,
  clearance,
  canEdit,
}: ClearanceEOTabProps) {
  const { updateClearance } = useClearances({ projectId });
  const { data: eoRequirements, isLoading: isLoadingEO } = useEORequirements(projectId);
  const updateEOMutation = useUpdateEORequirement();

  const [isUpdatingCritical, setIsUpdatingCritical] = useState(false);

  // Find E&O requirements that reference this clearance
  const linkedRequirements = eoRequirements?.filter(
    req => req.linked_clearance_id === clearance.id
  ) || [];

  // Find available E&O requirements that match this clearance type and aren't linked
  const availableRequirements = eoRequirements?.filter(
    req => req.clearance_type === clearance.type && !req.linked_clearance_id
  ) || [];

  const handleToggleEOCritical = async (checked: boolean) => {
    setIsUpdatingCritical(true);
    try {
      await updateClearance(clearance.id, { is_eo_critical: checked });
      toast.success(checked ? 'Marked as E&O Critical' : 'Removed E&O Critical flag');
    } catch (error) {
      toast.error('Failed to update E&O status');
    } finally {
      setIsUpdatingCritical(false);
    }
  };

  const handleLinkRequirement = async (requirementId: string) => {
    try {
      await updateEOMutation.mutateAsync({
        requirementId,
        linkedClearanceId: clearance.id,
      });
      toast.success('Linked to E&O requirement');
    } catch (error) {
      toast.error('Failed to link requirement');
    }
  };

  const handleUnlinkRequirement = async (requirementId: string) => {
    try {
      await updateEOMutation.mutateAsync({
        requirementId,
        linkedClearanceId: null,
      });
      toast.success('Unlinked from E&O requirement');
    } catch (error) {
      toast.error('Failed to unlink requirement');
    }
  };

  return (
    <div className="space-y-6">
      {/* E&O Critical Toggle Card */}
      <Card className="bg-charcoal-black border-muted-gray/30">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <Shield className="w-5 h-5 text-red-400" />
            E&O Insurance Status
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between p-4 bg-muted-gray/10 rounded-lg border border-muted-gray/20">
            <div className="space-y-1">
              <Label className="flex items-center gap-2 text-base">
                <AlertTriangle className="w-4 h-4 text-red-400" />
                E&O Critical
              </Label>
              <p className="text-sm text-muted-foreground">
                Mark this clearance as required for Errors & Omissions insurance coverage.
                Missing E&O critical documents may block distribution.
              </p>
            </div>
            <Switch
              checked={clearance.is_eo_critical}
              onCheckedChange={handleToggleEOCritical}
              disabled={!canEdit || isUpdatingCritical}
            />
          </div>

          {clearance.is_eo_critical && !clearance.file_url && (
            <div className="flex items-center gap-3 p-4 bg-red-500/10 border border-red-500/30 rounded-lg">
              <AlertTriangle className="w-5 h-5 text-red-400 shrink-0" />
              <div>
                <p className="font-medium text-red-400">Document Required</p>
                <p className="text-sm text-muted-foreground">
                  This clearance is E&O critical but has no document attached.
                  Upload a signed document to satisfy this requirement.
                </p>
              </div>
            </div>
          )}

          {clearance.is_eo_critical && clearance.file_url && clearance.status === 'signed' && (
            <div className="flex items-center gap-3 p-4 bg-green-500/10 border border-green-500/30 rounded-lg">
              <CheckCircle className="w-5 h-5 text-green-400 shrink-0" />
              <div>
                <p className="font-medium text-green-400">Requirement Satisfied</p>
                <p className="text-sm text-muted-foreground">
                  This E&O critical clearance has a signed document attached.
                </p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Linked E&O Requirements */}
      <Card className="bg-charcoal-black border-muted-gray/30">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <Link2 className="w-5 h-5" />
            Linked E&O Requirements ({linkedRequirements.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoadingEO ? (
            <div className="space-y-3">
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-16 w-full" />
            </div>
          ) : linkedRequirements.length > 0 ? (
            <div className="space-y-3">
              {linkedRequirements.map((req) => (
                <div
                  key={req.id}
                  className="flex items-center justify-between p-3 bg-muted-gray/10 rounded-lg border border-muted-gray/20"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-green-500/20 flex items-center justify-center">
                      <CheckCircle className="w-5 h-5 text-green-400" />
                    </div>
                    <div>
                      <p className="font-medium text-bone-white">{req.requirement_name}</p>
                      <p className="text-sm text-muted-foreground">
                        {CLEARANCE_TYPE_LABELS[req.clearance_type] || req.clearance_type}
                        {req.is_required && ' (Required)'}
                      </p>
                    </div>
                  </div>
                  {canEdit && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleUnlinkRequirement(req.id)}
                      disabled={updateEOMutation.isPending}
                      className="text-muted-foreground hover:text-red-400"
                    >
                      {updateEOMutation.isPending ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Link2Off className="w-4 h-4" />
                      )}
                    </Button>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-6">
              <Link2Off className="w-8 h-8 text-muted-gray mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">
                No E&O requirements linked to this clearance
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Available Requirements to Link */}
      {availableRequirements.length > 0 && canEdit && (
        <Card className="bg-charcoal-black border-muted-gray/30">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <Link2 className="w-5 h-5 text-muted-foreground" />
              Available Requirements to Link
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              These E&O requirements match this clearance type and can be linked.
            </p>
            <div className="space-y-3">
              {availableRequirements.map((req) => (
                <div
                  key={req.id}
                  className="flex items-center justify-between p-3 bg-muted-gray/10 rounded-lg border border-dashed border-muted-gray/30"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-muted-gray/20 flex items-center justify-center">
                      {clearance.file_url ? (
                        <FileCheck className="w-5 h-5 text-muted-gray" />
                      ) : (
                        <FileX className="w-5 h-5 text-muted-gray" />
                      )}
                    </div>
                    <div>
                      <p className="font-medium text-bone-white">{req.requirement_name}</p>
                      <p className="text-sm text-muted-foreground">
                        {req.description || CLEARANCE_TYPE_LABELS[req.clearance_type]}
                        {req.is_required && (
                          <Badge variant="outline" className="ml-2 text-xs">Required</Badge>
                        )}
                      </p>
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleLinkRequirement(req.id)}
                    disabled={updateEOMutation.isPending}
                  >
                    {updateEOMutation.isPending ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <>
                        <Link2 className="w-4 h-4 mr-1" />
                        Link
                      </>
                    )}
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
