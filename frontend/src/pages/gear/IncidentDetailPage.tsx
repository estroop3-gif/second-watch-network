/**
 * Incident Detail Page
 * Full-page view for managing incident workflow
 */
import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import {
  ChevronLeft,
  ChevronRight,
  AlertTriangle,
  Box,
  Wrench,
  Shield,
  ShoppingCart,
  Camera,
  Calendar,
  MapPin,
  User,
  DollarSign,
  FileText,
  Loader2,
  ExternalLink,
  CheckCircle2,
  Trash2,
  RefreshCcw,
  X,
  ZoomIn,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { cn } from '@/lib/utils';
import { useToast } from '@/components/ui/use-toast';

import { useGearIncidentDetail } from '@/hooks/gear';
import {
  IncidentStatusStepper,
  CustodianHistoryCard,
  AssignStrikeDialog,
  WriteOffDialog,
} from '@/components/gear/incidents';
import type {
  IncidentStatus,
  IncidentResolutionType,
  DamageTier,
  IncidentType,
  StrikeSeverity,
} from '@/types/gear';

// ============================================================================
// CONFIGURATION
// ============================================================================

const INCIDENT_TYPE_CONFIG: Record<IncidentType, { label: string; color: string }> = {
  damage: { label: 'Damage', color: 'bg-red-500/20 text-red-400 border-red-500/30' },
  missing_item: { label: 'Missing Item', color: 'bg-orange-500/20 text-orange-400 border-orange-500/30' },
  late_return: { label: 'Late Return', color: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30' },
  policy_violation: { label: 'Policy Violation', color: 'bg-purple-500/20 text-purple-400 border-purple-500/30' },
  unsafe_behavior: { label: 'Unsafe Behavior', color: 'bg-pink-500/20 text-pink-400 border-pink-500/30' },
};

const DAMAGE_TIER_CONFIG: Record<DamageTier, { label: string; color: string }> = {
  cosmetic: { label: 'Cosmetic', color: 'bg-blue-500/20 text-blue-400 border-blue-500/30' },
  functional: { label: 'Functional', color: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30' },
  unsafe: { label: 'Unsafe', color: 'bg-orange-500/20 text-orange-400 border-orange-500/30' },
  out_of_service: { label: 'Out of Service', color: 'bg-red-500/20 text-red-400 border-red-500/30' },
};

const STATUS_CONFIG: Record<IncidentStatus, { label: string; color: string }> = {
  open: { label: 'Open', color: 'bg-red-500/20 text-red-400 border-red-500/30' },
  investigating: { label: 'Investigating', color: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30' },
  repair: { label: 'In Repair', color: 'bg-blue-500/20 text-blue-400 border-blue-500/30' },
  replacement: { label: 'Replacement', color: 'bg-purple-500/20 text-purple-400 border-purple-500/30' },
  resolved: { label: 'Resolved', color: 'bg-green-500/20 text-green-400 border-green-500/30' },
};

// ============================================================================
// COMPONENT
// ============================================================================

export default function IncidentDetailPage() {
  const { orgId, incidentId } = useParams<{ orgId: string; incidentId: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();

  // Data fetching
  const {
    incident,
    asset,
    transactions,
    repairs,
    strikes,
    purchaseRequests,
    recommendedCustodian,
    isLoading,
    error,
    updateStatus,
    writeOff,
    assignStrike,
    refetch,
  } = useGearIncidentDetail(incidentId || null);

  // Dialog states
  const [showStrikeDialog, setShowStrikeDialog] = useState(false);
  const [strikeUserId, setStrikeUserId] = useState('');
  const [strikeUserName, setStrikeUserName] = useState('');
  const [showWriteOffDialog, setShowWriteOffDialog] = useState(false);
  const [showResolveDialog, setShowResolveDialog] = useState(false);
  const [errorModalOpen, setErrorModalOpen] = useState(false);
  const [errorDetails, setErrorDetails] = useState<{ title: string; message: string } | null>(null);
  const [photoGalleryOpen, setPhotoGalleryOpen] = useState(false);
  const [selectedPhotoIndex, setSelectedPhotoIndex] = useState(0);

  // Show error dialog for detailed errors
  const showErrorModal = (title: string, message: string) => {
    setErrorDetails({ title, message });
    setErrorModalOpen(true);
  };

  // Handle status change
  const handleStatusChange = async (newStatus: IncidentStatus, resolutionType?: IncidentResolutionType) => {
    try {
      await updateStatus.mutateAsync({
        status: newStatus,
        resolution_type: resolutionType
      });
      toast({
        title: 'Status Updated',
        description: `Incident status changed to ${STATUS_CONFIG[newStatus].label}`,
      });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An unexpected error occurred';
      toast({
        title: 'Error',
        description: 'Failed to update status',
        variant: 'destructive',
      });
      showErrorModal('Failed to Update Status', errorMessage);
    }
  };

  // Handle resolve with resolution type
  const handleResolve = async (resolutionType: IncidentResolutionType) => {
    setShowResolveDialog(false);
    await handleStatusChange('resolved', resolutionType);
  };

  // Handle strike assignment
  const handleAssignStrike = (userId: string, userName: string) => {
    setStrikeUserId(userId);
    setStrikeUserName(userName);
    setShowStrikeDialog(true);
  };

  const handleStrikeSubmit = async (data: {
    user_id: string;
    severity: StrikeSeverity;
    reason: string;
    notes?: string;
  }) => {
    try {
      await assignStrike.mutateAsync(data);
      toast({
        title: 'Strike Assigned',
        description: `Strike issued to ${strikeUserName}`,
      });
      setShowStrikeDialog(false);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An unexpected error occurred';
      toast({
        title: 'Error',
        description: 'Failed to assign strike',
        variant: 'destructive',
      });
      showErrorModal('Failed to Assign Strike', errorMessage);
    }
  };

  // Handle write-off
  const handleWriteOff = async (data: {
    write_off_value: number;
    write_off_reason: string;
    create_purchase_request?: boolean;
    purchase_request_title?: string;
    estimated_replacement_cost?: number;
  }) => {
    try {
      await writeOff.mutateAsync(data);
      toast({
        title: 'Asset Written Off',
        description: data.create_purchase_request
          ? 'Asset written off and purchase request created'
          : 'Asset has been written off',
      });
      setShowWriteOffDialog(false);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An unexpected error occurred';
      toast({
        title: 'Error',
        description: 'Failed to write off asset',
        variant: 'destructive',
      });
      showErrorModal('Failed to Write Off Asset', errorMessage);
    }
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="min-h-screen bg-charcoal-black p-6">
        <div className="max-w-5xl mx-auto space-y-6">
          <Skeleton className="h-12 w-48" />
          <Skeleton className="h-24 w-full" />
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <Skeleton className="h-64 lg:col-span-2" />
            <Skeleton className="h-64" />
          </div>
        </div>
      </div>
    );
  }

  // Error state
  if (error || !incident) {
    return (
      <div className="min-h-screen bg-charcoal-black p-6 flex items-center justify-center">
        <div className="text-center max-w-md">
          <AlertTriangle className="w-12 h-12 text-red-400 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-bone-white mb-2">
            {error ? 'Failed to Load Incident' : 'Incident Not Found'}
          </h2>
          <p className="text-muted-gray mb-2">
            {error?.message || "The incident you're looking for doesn't exist."}
          </p>
          {error && (
            <div className="bg-charcoal-black/50 border border-red-500/30 rounded-lg p-3 mb-4 text-left">
              <p className="text-xs text-muted-gray font-mono break-all">
                {error.message}
              </p>
            </div>
          )}
          <div className="flex gap-3 justify-center">
            <Button onClick={() => navigate(`/gear/${orgId}`)} variant="outline">
              <ChevronLeft className="w-4 h-4 mr-2" />
              Back to Workspace
            </Button>
            {error && (
              <Button onClick={() => refetch()} variant="outline" className="border-red-500/30 text-red-400 hover:bg-red-500/10">
                <RefreshCcw className="w-4 h-4 mr-2" />
                Retry
              </Button>
            )}
          </div>
        </div>
      </div>
    );
  }

  const typeConfig = INCIDENT_TYPE_CONFIG[incident.incident_type];
  const statusConfig = STATUS_CONFIG[incident.status];
  const damageConfig = incident.damage_tier ? DAMAGE_TIER_CONFIG[incident.damage_tier] : null;

  return (
    <div className="min-h-screen bg-charcoal-black">
      {/* Header */}
      <div className="border-b border-muted-gray/30 bg-charcoal-black/80 sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="sm" onClick={() => navigate(`/gear/${orgId}`)}>
                <ChevronLeft className="w-4 h-4 mr-1" />
                Back
              </Button>
              <div className="flex items-center gap-3">
                <Badge className={cn('border', typeConfig.color)}>
                  {typeConfig.label}
                </Badge>
                <Badge className={cn('border', statusConfig.color)}>
                  {statusConfig.label}
                </Badge>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-5xl mx-auto px-6 py-6 space-y-6">
        {/* Status Stepper */}
        <Card className="bg-charcoal-black/50 border-muted-gray/30">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-gray">
              Incident Progress
            </CardTitle>
          </CardHeader>
          <CardContent>
            <IncidentStatusStepper
              currentStatus={incident.status}
              onStatusChange={handleStatusChange}
              disabled={updateStatus.isPending}
            />
          </CardContent>
        </Card>

        {/* Main Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column - Incident Details */}
          <div className="lg:col-span-2 space-y-6">
            {/* Incident Info Card */}
            <Card className="bg-charcoal-black/50 border-muted-gray/30">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-bone-white flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-red-400" />
                  Incident Details
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Damage Tier */}
                {damageConfig && (
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-gray">Damage Tier</span>
                    <Badge className={cn('border', damageConfig.color)}>
                      {damageConfig.label}
                    </Badge>
                  </div>
                )}

                {/* Description */}
                {incident.damage_description && (
                  <div>
                    <span className="text-sm text-muted-gray block mb-1">Description</span>
                    <p className="text-sm text-bone-white bg-charcoal-black/30 rounded-lg p-3">
                      {incident.damage_description}
                    </p>
                  </div>
                )}

                {/* Metadata */}
                <div className="grid grid-cols-2 gap-4 pt-2">
                  <div className="flex items-center gap-2 text-sm">
                    <Calendar className="w-4 h-4 text-muted-gray" />
                    <span className="text-muted-gray">Reported:</span>
                    <span className="text-bone-white">
                      {format(new Date(incident.reported_at), 'MMM d, yyyy h:mm a')}
                    </span>
                  </div>
                  {incident.reported_by_name && (
                    <div className="flex items-center gap-2 text-sm">
                      <User className="w-4 h-4 text-muted-gray" />
                      <span className="text-muted-gray">By:</span>
                      <span className="text-bone-white">{incident.reported_by_name}</span>
                    </div>
                  )}
                  {incident.reported_stage && (
                    <div className="flex items-center gap-2 text-sm">
                      <MapPin className="w-4 h-4 text-muted-gray" />
                      <span className="text-muted-gray">Stage:</span>
                      <span className="text-bone-white capitalize">{incident.reported_stage}</span>
                    </div>
                  )}
                  {incident.estimated_cost && (
                    <div className="flex items-center gap-2 text-sm">
                      <DollarSign className="w-4 h-4 text-muted-gray" />
                      <span className="text-muted-gray">Est. Cost:</span>
                      <span className="text-bone-white">${incident.estimated_cost.toLocaleString()}</span>
                    </div>
                  )}
                </div>

                {/* Photos */}
                {incident.photos && incident.photos.length > 0 && (
                  <div>
                    <span className="text-sm text-muted-gray flex items-center gap-2 mb-2">
                      <Camera className="w-4 h-4" />
                      Photos ({incident.photos.length})
                    </span>
                    <div className="flex gap-2 flex-wrap">
                      {incident.photos.map((photo, idx) => (
                        <button
                          key={idx}
                          onClick={() => {
                            setSelectedPhotoIndex(idx);
                            setPhotoGalleryOpen(true);
                          }}
                          className="w-20 h-20 rounded-lg overflow-hidden bg-muted-gray/20 hover:opacity-80 transition-opacity relative group"
                        >
                          <img
                            src={photo}
                            alt={`Incident photo ${idx + 1}`}
                            className="w-full h-full object-cover"
                          />
                          <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                            <ZoomIn className="w-5 h-5 text-white" />
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Asset Info Card */}
            {asset && (
              <Card className="bg-charcoal-black/50 border-muted-gray/30">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium text-bone-white flex items-center gap-2">
                    <Box className="w-4 h-4 text-accent-yellow" />
                    Asset Information
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-bone-white">{asset.name}</p>
                      {asset.internal_id && (
                        <p className="text-sm text-muted-gray">{asset.internal_id}</p>
                      )}
                      {asset.category_name && (
                        <p className="text-xs text-muted-gray mt-1">{asset.category_name}</p>
                      )}
                    </div>
                    <div className="text-right">
                      {asset.value && (
                        <p className="text-sm text-bone-white">
                          Value: ${asset.value.toLocaleString()}
                        </p>
                      )}
                      {asset.status && (
                        <Badge variant="outline" className="mt-1 text-xs">
                          {asset.status}
                        </Badge>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Custodian History */}
            <CustodianHistoryCard
              custodians={transactions}
              recommendedCustodian={recommendedCustodian}
              onAssignStrike={handleAssignStrike}
            />
          </div>

          {/* Right Column - Actions & Links */}
          <div className="space-y-6">
            {/* Actions Card */}
            <Card className="bg-charcoal-black/50 border-muted-gray/30">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-bone-white">
                  Actions
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {/* Progress Status Buttons */}
                {incident.status !== 'resolved' && (
                  <>
                    {incident.status === 'open' && (
                      <Button
                        variant="outline"
                        className="w-full justify-start border-yellow-500/30 text-yellow-400 hover:bg-yellow-500/10"
                        onClick={() => handleStatusChange('investigating')}
                        disabled={updateStatus.isPending}
                      >
                        {updateStatus.isPending ? (
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        ) : (
                          <FileText className="w-4 h-4 mr-2" />
                        )}
                        Start Investigation
                      </Button>
                    )}

                    {incident.status === 'investigating' && (
                      <>
                        <Button
                          variant="outline"
                          className="w-full justify-start border-blue-500/30 text-blue-400 hover:bg-blue-500/10"
                          onClick={() => handleStatusChange('repair')}
                          disabled={updateStatus.isPending}
                        >
                          <Wrench className="w-4 h-4 mr-2" />
                          Progress to Repair
                        </Button>
                        <Button
                          variant="outline"
                          className="w-full justify-start border-purple-500/30 text-purple-400 hover:bg-purple-500/10"
                          onClick={() => handleStatusChange('replacement')}
                          disabled={updateStatus.isPending}
                        >
                          <ShoppingCart className="w-4 h-4 mr-2" />
                          Progress to Replacement
                        </Button>
                      </>
                    )}

                    {(incident.status === 'repair' || incident.status === 'replacement') && (
                      <Button
                        variant="outline"
                        className="w-full justify-start border-green-500/30 text-green-400 hover:bg-green-500/10"
                        onClick={() => setShowResolveDialog(true)}
                        disabled={updateStatus.isPending}
                      >
                        <CheckCircle2 className="w-4 h-4 mr-2" />
                        Mark Resolved
                      </Button>
                    )}

                    <Separator className="bg-muted-gray/20" />
                  </>
                )}

                {/* Strike Assignment */}
                <Button
                  variant="outline"
                  className="w-full justify-start border-accent-yellow/30 text-accent-yellow hover:bg-accent-yellow/10"
                  onClick={() => {
                    if (recommendedCustodian) {
                      handleAssignStrike(recommendedCustodian.user_id, recommendedCustodian.user_name);
                    } else {
                      setShowStrikeDialog(true);
                    }
                  }}
                >
                  <Shield className="w-4 h-4 mr-2" />
                  Assign Strike
                </Button>

                {/* Write Off */}
                {asset && incident.status !== 'resolved' && !incident.write_off_at && (
                  <Button
                    variant="outline"
                    className="w-full justify-start border-red-500/30 text-red-400 hover:bg-red-500/10"
                    onClick={() => setShowWriteOffDialog(true)}
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    Write Off Asset
                  </Button>
                )}
              </CardContent>
            </Card>

            {/* Linked Repairs */}
            {repairs.length > 0 && (
              <Card className="bg-charcoal-black/50 border-muted-gray/30">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium text-bone-white flex items-center gap-2">
                    <Wrench className="w-4 h-4 text-blue-400" />
                    Linked Repairs ({repairs.length})
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {repairs.map((repair) => (
                    <div
                      key={repair.id}
                      className="flex items-center justify-between p-2 rounded-lg bg-charcoal-black/30"
                    >
                      <div>
                        <p className="text-sm text-bone-white">{repair.ticket_number}</p>
                        <p className="text-xs text-muted-gray">{repair.title}</p>
                      </div>
                      <Badge variant="outline" className="text-xs">
                        {repair.status}
                      </Badge>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}

            {/* Linked Strikes */}
            {strikes.length > 0 && (
              <Card className="bg-charcoal-black/50 border-muted-gray/30">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium text-bone-white flex items-center gap-2">
                    <Shield className="w-4 h-4 text-accent-yellow" />
                    Issued Strikes ({strikes.length})
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {strikes.map((strike) => (
                    <div
                      key={strike.id}
                      className="flex items-center justify-between p-2 rounded-lg bg-charcoal-black/30"
                    >
                      <div>
                        <p className="text-sm text-bone-white">{strike.user_name}</p>
                        <p className="text-xs text-muted-gray capitalize">{strike.severity}</p>
                      </div>
                      <Badge
                        variant="outline"
                        className={cn(
                          'text-xs',
                          strike.is_active
                            ? 'border-accent-yellow/30 text-accent-yellow'
                            : 'border-muted-gray/30 text-muted-gray'
                        )}
                      >
                        {strike.is_active ? 'Active' : 'Voided'}
                      </Badge>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}

            {/* Purchase Requests */}
            {purchaseRequests.length > 0 && (
              <Card className="bg-charcoal-black/50 border-muted-gray/30">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium text-bone-white flex items-center gap-2">
                    <ShoppingCart className="w-4 h-4 text-purple-400" />
                    Purchase Requests ({purchaseRequests.length})
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {purchaseRequests.map((pr) => (
                    <div
                      key={pr.id}
                      className="flex items-center justify-between p-2 rounded-lg bg-charcoal-black/30"
                    >
                      <div>
                        <p className="text-sm text-bone-white">{pr.request_number}</p>
                        <p className="text-xs text-muted-gray">{pr.title}</p>
                      </div>
                      <Badge variant="outline" className="text-xs capitalize">
                        {pr.status}
                      </Badge>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}

            {/* Write-off Info */}
            {incident.write_off_at && (
              <Card className="bg-red-500/5 border-red-500/20">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium text-red-400 flex items-center gap-2">
                    <Trash2 className="w-4 h-4" />
                    Asset Written Off
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-gray">Value:</span>
                    <span className="text-red-400">
                      ${incident.write_off_value?.toLocaleString() || '0'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-gray">Date:</span>
                    <span className="text-bone-white">
                      {format(new Date(incident.write_off_at), 'MMM d, yyyy')}
                    </span>
                  </div>
                  {incident.write_off_reason && (
                    <div className="pt-2">
                      <span className="text-muted-gray block mb-1">Reason:</span>
                      <p className="text-bone-white text-xs bg-charcoal-black/30 rounded p-2">
                        {incident.write_off_reason}
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>

      {/* Dialogs */}
      <AssignStrikeDialog
        isOpen={showStrikeDialog}
        onClose={() => {
          setShowStrikeDialog(false);
          setStrikeUserId('');
          setStrikeUserName('');
        }}
        onSubmit={handleStrikeSubmit}
        isSubmitting={assignStrike.isPending}
        preselectedUserId={strikeUserId}
        preselectedUserName={strikeUserName}
        incidentDescription={incident.damage_description}
      />

      <WriteOffDialog
        isOpen={showWriteOffDialog}
        onClose={() => setShowWriteOffDialog(false)}
        onSubmit={handleWriteOff}
        isSubmitting={writeOff.isPending}
        assetName={asset?.name}
        assetValue={asset?.value}
      />

      {/* Resolve Dialog */}
      <AlertDialog open={showResolveDialog} onOpenChange={setShowResolveDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-green-400">
              <CheckCircle2 className="w-5 h-5" />
              Resolve Incident
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="text-left">
                <span className="text-muted-gray block mb-4">How was this incident resolved?</span>
                <div className="grid gap-2">
                  <Button
                    variant="outline"
                    className="w-full justify-start border-blue-500/30 text-blue-400 hover:bg-blue-500/10"
                    onClick={() => handleResolve('repaired')}
                    disabled={updateStatus.isPending}
                  >
                    <Wrench className="w-4 h-4 mr-2" />
                    Repaired - Item was fixed
                  </Button>
                  <Button
                    variant="outline"
                    className="w-full justify-start border-purple-500/30 text-purple-400 hover:bg-purple-500/10"
                    onClick={() => handleResolve('replaced')}
                    disabled={updateStatus.isPending}
                  >
                    <ShoppingCart className="w-4 h-4 mr-2" />
                    Replaced - Item was replaced
                  </Button>
                  <Button
                    variant="outline"
                    className="w-full justify-start border-orange-500/30 text-orange-400 hover:bg-orange-500/10"
                    onClick={() => handleResolve('written_off')}
                    disabled={updateStatus.isPending}
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    Written Off - Item was retired
                  </Button>
                  <Button
                    variant="outline"
                    className="w-full justify-start border-muted-gray/30 text-muted-gray hover:bg-muted-gray/10"
                    onClick={() => handleResolve('no_action_needed')}
                    disabled={updateStatus.isPending}
                  >
                    <CheckCircle2 className="w-4 h-4 mr-2" />
                    No Action Needed
                  </Button>
                </div>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction
              onClick={() => setShowResolveDialog(false)}
              className="bg-charcoal-black hover:bg-muted-gray/20"
            >
              Cancel
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Photo Gallery Modal */}
      {photoGalleryOpen && incident?.photos && incident.photos.length > 0 && (
        <div className="fixed inset-0 z-50 bg-black/95 flex items-center justify-center">
          {/* Close button */}
          <button
            onClick={() => setPhotoGalleryOpen(false)}
            className="absolute top-4 right-4 z-10 p-2 rounded-full bg-white/10 hover:bg-white/20 transition-colors"
          >
            <X className="w-6 h-6 text-white" />
          </button>

          {/* Photo counter */}
          <div className="absolute top-4 left-4 z-10 px-3 py-1.5 rounded-full bg-white/10 text-white text-sm">
            {selectedPhotoIndex + 1} / {incident.photos.length}
          </div>

          {/* Previous button */}
          {incident.photos.length > 1 && (
            <button
              onClick={() => setSelectedPhotoIndex((prev) =>
                prev === 0 ? incident.photos!.length - 1 : prev - 1
              )}
              className="absolute left-4 z-10 p-3 rounded-full bg-white/10 hover:bg-white/20 transition-colors"
            >
              <ChevronLeft className="w-8 h-8 text-white" />
            </button>
          )}

          {/* Main image */}
          <div className="max-w-[90vw] max-h-[85vh] flex items-center justify-center">
            <img
              src={incident.photos[selectedPhotoIndex]}
              alt={`Incident photo ${selectedPhotoIndex + 1}`}
              className="max-w-full max-h-[85vh] object-contain rounded-lg"
            />
          </div>

          {/* Next button */}
          {incident.photos.length > 1 && (
            <button
              onClick={() => setSelectedPhotoIndex((prev) =>
                prev === incident.photos!.length - 1 ? 0 : prev + 1
              )}
              className="absolute right-4 z-10 p-3 rounded-full bg-white/10 hover:bg-white/20 transition-colors"
            >
              <ChevronRight className="w-8 h-8 text-white" />
            </button>
          )}

          {/* Thumbnail strip */}
          {incident.photos.length > 1 && (
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2 p-2 bg-black/50 rounded-lg max-w-[80vw] overflow-x-auto">
              {incident.photos.map((photo, idx) => (
                <button
                  key={idx}
                  onClick={() => setSelectedPhotoIndex(idx)}
                  className={cn(
                    'w-16 h-16 rounded-lg overflow-hidden flex-shrink-0 transition-all',
                    idx === selectedPhotoIndex
                      ? 'ring-2 ring-white opacity-100'
                      : 'opacity-50 hover:opacity-75'
                  )}
                >
                  <img
                    src={photo}
                    alt={`Thumbnail ${idx + 1}`}
                    className="w-full h-full object-cover"
                  />
                </button>
              ))}
            </div>
          )}

          {/* Click outside to close */}
          <div
            className="absolute inset-0 -z-10"
            onClick={() => setPhotoGalleryOpen(false)}
          />
        </div>
      )}

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
              <div className="bg-charcoal-black/50 rounded-lg p-3 text-sm text-bone-white font-mono break-all max-h-40 overflow-y-auto">
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
