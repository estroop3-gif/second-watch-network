/**
 * WorkOrderRequestsSection - Display incoming work order requests
 * Shows requests from renters waiting for gear house approval.
 */
import React, { useState } from 'react';
import {
  ShoppingCart,
  ChevronRight,
  Calendar,
  Package,
  User,
  CheckCircle2,
  XCircle,
  Loader2,
  Eye,
  Clock,
  MessageSquare,
  Send,
  ArrowLeft,
} from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/context/AuthContext';
import { api } from '@/lib/api';

import {
  useIncomingWorkOrderRequests,
  useIncomingRequestCounts,
  useWorkOrderRequest,
  useApproveWorkOrderRequest,
  useRejectWorkOrderRequest,
} from '@/hooks/gear/useWorkOrderRequests';
import type {
  GearWorkOrderRequest,
  GearWorkOrderRequestItem,
  WorkOrderRequestStatus,
  AssetStatus,
} from '@/types/gear';
import { cn } from '@/lib/utils';

// Availability badge configuration
const ASSET_STATUS_CONFIG: Record<AssetStatus, { label: string; color: string }> = {
  available: { label: 'Available', color: 'bg-green-500/20 text-green-400 border-green-500/30' },
  reserved: { label: 'Reserved', color: 'bg-blue-500/20 text-blue-400 border-blue-500/30' },
  checked_out: { label: 'Checked Out', color: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30' },
  in_transit: { label: 'In Transit', color: 'bg-purple-500/20 text-purple-400 border-purple-500/30' },
  pending_return: { label: 'Pending Return', color: 'bg-orange-500/20 text-orange-400 border-orange-500/30' },
  under_repair: { label: 'Under Repair', color: 'bg-orange-500/20 text-orange-400 border-orange-500/30' },
  retired: { label: 'Retired', color: 'bg-gray-500/20 text-gray-400 border-gray-500/30' },
  lost: { label: 'Lost', color: 'bg-red-500/20 text-red-400 border-red-500/30' },
  sold: { label: 'Sold', color: 'bg-gray-500/20 text-gray-400 border-gray-500/30' },
};

const STATUS_CONFIG: Record<WorkOrderRequestStatus, { label: string; color: string }> = {
  pending: { label: 'Pending', color: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30' },
  approved: { label: 'Approved', color: 'bg-green-500/20 text-green-400 border-green-500/30' },
  rejected: { label: 'Rejected', color: 'bg-red-500/20 text-red-400 border-red-500/30' },
};

interface WorkOrderRequestsSectionProps {
  orgId: string;
}

export function WorkOrderRequestsSection({ orgId }: WorkOrderRequestsSectionProps) {
  const [selectedRequestId, setSelectedRequestId] = useState<string | null>(null);

  const { counts, isLoading: countsLoading } = useIncomingRequestCounts(orgId);
  const { requests, isLoading, refetch } = useIncomingWorkOrderRequests(orgId, {
    status: 'pending',
  });

  if (countsLoading || isLoading) {
    return (
      <Card className="bg-charcoal-black/50 border-muted-gray/30">
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin text-muted-gray" />
        </CardContent>
      </Card>
    );
  }

  // Only show if there are pending requests
  if (counts.pending === 0) {
    return null;
  }

  return (
    <>
      <Card className="bg-charcoal-black/50 border-muted-gray/30">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <ShoppingCart className="w-4 h-4 text-accent-yellow" />
            Rental Requests
            <Badge className="ml-2 bg-accent-yellow/20 text-accent-yellow border-accent-yellow/30">
              {counts.pending} pending
            </Badge>
          </CardTitle>
          <CardDescription>
            Work order requests from renters waiting for approval
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {requests.map((request) => (
            <RequestCard
              key={request.id}
              request={request}
              onClick={() => setSelectedRequestId(request.id)}
            />
          ))}
        </CardContent>
      </Card>

      {/* Request Detail Dialog */}
      <RequestDetailDialog
        requestId={selectedRequestId}
        open={!!selectedRequestId}
        onClose={() => setSelectedRequestId(null)}
        onActionComplete={() => {
          setSelectedRequestId(null);
          refetch();
        }}
      />
    </>
  );
}

// Request Card Component
function RequestCard({
  request,
  onClick,
}: {
  request: GearWorkOrderRequest;
  onClick: () => void;
}) {
  const statusConfig = STATUS_CONFIG[request.status];

  // Get initials for avatar fallback
  const getInitials = (name?: string) => {
    if (!name) return 'U';
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <div
      className="flex items-center justify-between p-3 rounded-lg bg-charcoal-black/30 hover:bg-charcoal-black/50 cursor-pointer transition-colors"
      onClick={onClick}
    >
      <div className="flex items-center gap-4">
        <Avatar className="h-10 w-10">
          <AvatarImage src={request.requester_avatar} />
          <AvatarFallback className="bg-accent-yellow/20 text-accent-yellow">
            {getInitials(request.requester_name)}
          </AvatarFallback>
        </Avatar>
        <div>
          <p className="font-medium text-bone-white">
            {request.title || `Request ${request.reference_number}`}
          </p>
          <p className="text-sm text-muted-gray">
            From {request.requester_name || 'Unknown'}{' '}
            {request.requester_org_name && `(${request.requester_org_name})`}
          </p>
          <div className="flex items-center gap-3 text-xs text-muted-gray mt-1">
            {request.rental_start_date && request.rental_end_date && (
              <span className="flex items-center gap-1">
                <Calendar className="w-3 h-3" />
                {format(new Date(request.rental_start_date), 'MMM d')} -{' '}
                {format(new Date(request.rental_end_date), 'MMM d')}
              </span>
            )}
            {request.item_count && (
              <span className="flex items-center gap-1">
                <Package className="w-3 h-3" />
                {request.item_count} item{request.item_count !== 1 ? 's' : ''}
              </span>
            )}
            <span className="flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {formatDistanceToNow(new Date(request.created_at), { addSuffix: true })}
            </span>
          </div>
        </div>
      </div>
      <div className="flex items-center gap-3">
        {request.total_daily_rate && (
          <span className="text-sm font-medium text-green-400">
            ${request.total_daily_rate.toFixed(2)}/day
          </span>
        )}
        <Badge className={cn('border', statusConfig.color)}>{statusConfig.label}</Badge>
        <ChevronRight className="w-4 h-4 text-muted-gray" />
      </div>
    </div>
  );
}

// Dialog mode type
type DialogMode = 'view' | 'reject_with_notes' | 'compose_message';

// Request Detail Dialog
interface RequestDetailDialogProps {
  requestId: string | null;
  open: boolean;
  onClose: () => void;
  onActionComplete: () => void;
}

function RequestDetailDialog({
  requestId,
  open,
  onClose,
  onActionComplete,
}: RequestDetailDialogProps) {
  const { toast } = useToast();
  const { user } = useAuth();
  const [dialogMode, setDialogMode] = useState<DialogMode>('view');
  const [rejectReason, setRejectReason] = useState('');
  const [messageContent, setMessageContent] = useState('');
  const [isSendingMessage, setIsSendingMessage] = useState(false);

  const { request, isLoading } = useWorkOrderRequest(requestId || '');
  const approve = useApproveWorkOrderRequest();
  const reject = useRejectWorkOrderRequest();

  // Reset state when dialog closes
  const handleClose = () => {
    setDialogMode('view');
    setRejectReason('');
    setMessageContent('');
    onClose();
  };

  const handleApprove = async () => {
    if (!requestId) return;

    try {
      const result = await approve.mutateAsync(requestId);
      toast({
        title: 'Request Approved',
        description: `Work order ${result.work_order_reference} created. The renter will be notified.`,
      });
      onActionComplete();
    } catch (error) {
      toast({
        title: 'Approval Failed',
        description: error instanceof Error ? error.message : 'Failed to approve request',
        variant: 'destructive',
      });
    }
  };

  // Quick reject without notes
  const handleQuickReject = async () => {
    if (!requestId) return;

    try {
      await reject.mutateAsync({
        requestId,
        data: {},  // Empty reason for quick reject
      });
      toast({
        title: 'Request Rejected',
        description: 'The renter has been notified of your decision.',
      });
      onActionComplete();
    } catch (error) {
      toast({
        title: 'Rejection Failed',
        description: error instanceof Error ? error.message : 'Failed to reject request',
        variant: 'destructive',
      });
    }
  };

  // Reject with notes
  const handleRejectWithNotes = async () => {
    if (!requestId || !rejectReason.trim()) return;

    try {
      await reject.mutateAsync({
        requestId,
        data: { reason: rejectReason },
      });
      toast({
        title: 'Request Rejected',
        description: 'The renter has been notified with your reason.',
      });
      setRejectReason('');
      setDialogMode('view');
      onActionComplete();
    } catch (error) {
      toast({
        title: 'Rejection Failed',
        description: error instanceof Error ? error.message : 'Failed to reject request',
        variant: 'destructive',
      });
    }
  };

  // Send message to requester
  const handleSendMessage = async () => {
    if (!request || !messageContent.trim() || !user?.id) return;

    setIsSendingMessage(true);
    try {
      // Create or get private conversation
      const conversationResult = await api.createPrivateConversation(
        user.id,
        request.requesting_profile_id
      );

      // Send the message
      await api.sendMessage(user.id, {
        conversation_id: conversationResult.conversation_id,
        content: messageContent,
      });

      toast({
        title: 'Message Sent',
        description: `Your message has been sent to ${request.requester_name || 'the requester'}.`,
      });

      setMessageContent('');
      setDialogMode('view');
    } catch (error) {
      toast({
        title: 'Failed to Send',
        description: error instanceof Error ? error.message : 'Could not send message',
        variant: 'destructive',
      });
    } finally {
      setIsSendingMessage(false);
    }
  };

  // Helper to get first photo from asset
  const getAssetPhoto = (item: GearWorkOrderRequestItem): string | null => {
    if (!item.asset_photos || item.asset_photos.length === 0) return null;
    const photos = item.asset_photos;
    if (typeof photos === 'string') {
      try {
        const parsed = JSON.parse(photos);
        return parsed[0]?.url || parsed[0] || null;
      } catch {
        return null;
      }
    }
    if (Array.isArray(photos)) {
      const first = photos[0];
      if (typeof first === 'string') return first;
      if (first && typeof first === 'object' && 'url' in first) return first.url;
    }
    return null;
  };

  if (!open) return null;

  return (
    <Dialog open={open} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {request?.title || `Request ${request?.reference_number}`}
          </DialogTitle>
          <DialogDescription>
            {dialogMode === 'view' && 'Review this rental request and take action.'}
            {dialogMode === 'reject_with_notes' && 'Provide a reason for rejecting this request.'}
            {dialogMode === 'compose_message' && `Send a message to ${request?.requester_name || 'the requester'}.`}
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-muted-gray" />
          </div>
        ) : request ? (
          <>
            {/* VIEW MODE */}
            {dialogMode === 'view' && (
              <div className="space-y-4">
                {/* Requester Info */}
                <div className="flex items-center gap-4 p-4 rounded-lg bg-muted/50">
                  <Avatar className="h-12 w-12">
                    <AvatarImage src={request.requester_avatar} />
                    <AvatarFallback className="bg-accent-yellow/20 text-accent-yellow">
                      {request.requester_name?.slice(0, 2).toUpperCase() || 'U'}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1">
                    <p className="font-medium">{request.requester_name || 'Unknown'}</p>
                    {request.requester_org_name && (
                      <p className="text-sm text-muted-foreground">{request.requester_org_name}</p>
                    )}
                    {request.project_title && (
                      <p className="text-xs text-muted-foreground">Project: {request.project_title}</p>
                    )}
                  </div>
                </div>

                {/* Rental Dates */}
                {request.rental_start_date && request.rental_end_date && (
                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-3 rounded-lg bg-muted/50">
                      <p className="text-xs text-muted-foreground">Start Date</p>
                      <p className="font-medium">
                        {format(new Date(request.rental_start_date), 'PPP')}
                      </p>
                    </div>
                    <div className="p-3 rounded-lg bg-muted/50">
                      <p className="text-xs text-muted-foreground">End Date</p>
                      <p className="font-medium">
                        {format(new Date(request.rental_end_date), 'PPP')}
                      </p>
                    </div>
                  </div>
                )}

                {/* Notes */}
                {request.notes && (
                  <div className="p-3 rounded-lg bg-muted/50">
                    <p className="text-xs text-muted-foreground mb-1">Notes from Requester</p>
                    <p className="text-sm">{request.notes}</p>
                  </div>
                )}

                {/* Items - Enhanced Display */}
                <div>
                  <p className="text-sm font-medium mb-2">
                    Requested Items ({request.items?.length || 0})
                  </p>
                  <ScrollArea className="h-[240px] rounded-lg border">
                    <div className="p-3 space-y-3">
                      {request.items?.map((item) => {
                        const photo = getAssetPhoto(item);
                        const statusConfig = item.asset_status
                          ? ASSET_STATUS_CONFIG[item.asset_status]
                          : null;

                        return (
                          <div
                            key={item.id}
                            className="flex gap-3 p-3 rounded-lg bg-muted/30"
                          >
                            {/* Photo */}
                            <div className="w-16 h-16 rounded-lg overflow-hidden bg-muted flex-shrink-0">
                              {photo ? (
                                <img
                                  src={photo}
                                  alt={item.asset_name || 'Asset'}
                                  className="w-full h-full object-cover"
                                />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center">
                                  <Package className="w-6 h-6 text-muted-foreground" />
                                </div>
                              )}
                            </div>

                            {/* Details */}
                            <div className="flex-1 min-w-0">
                              <p className="font-medium truncate">
                                {item.asset_name || 'Item'}
                              </p>
                              {(item.manufacturer || item.model) && (
                                <p className="text-sm text-muted-foreground">
                                  {[item.manufacturer, item.model].filter(Boolean).join(' ')}
                                </p>
                              )}
                              <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                                {item.category_name && (
                                  <Badge variant="outline" className="text-xs">
                                    {item.category_name}
                                  </Badge>
                                )}
                                {statusConfig && (
                                  <Badge className={cn('text-xs border', statusConfig.color)}>
                                    {statusConfig.label}
                                  </Badge>
                                )}
                              </div>
                              {/* Item notes */}
                              {(item.asset_notes || item.listing_notes) && (
                                <p className="text-xs text-muted-foreground mt-1.5 italic">
                                  {item.listing_notes || item.asset_notes}
                                </p>
                              )}
                            </div>

                            {/* Quantity & Rate */}
                            <div className="text-right flex-shrink-0">
                              <Badge variant="secondary" className="text-xs">
                                Qty: {item.quantity}
                              </Badge>
                              {item.daily_rate && (
                                <p className="text-sm text-green-400 mt-1">
                                  ${item.daily_rate}/day
                                </p>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </ScrollArea>
                </div>

                {/* Total */}
                {request.total_daily_rate && (
                  <div className="flex justify-between items-center p-3 rounded-lg bg-green-500/10 border border-green-500/20">
                    <span className="text-sm font-medium">Estimated Daily Total</span>
                    <span className="text-lg font-semibold text-green-400">
                      ${request.total_daily_rate.toFixed(2)}/day
                    </span>
                  </div>
                )}
              </div>
            )}

            {/* REJECT WITH NOTES MODE */}
            {dialogMode === 'reject_with_notes' && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="reason">Rejection Reason</Label>
                  <Textarea
                    id="reason"
                    placeholder="e.g., Items not available for requested dates, pricing issue, etc."
                    value={rejectReason}
                    onChange={(e) => setRejectReason(e.target.value)}
                    rows={4}
                    autoFocus
                  />
                  <p className="text-xs text-muted-foreground">
                    This reason will be sent to {request.requester_name || 'the requester'}.
                  </p>
                </div>
              </div>
            )}

            {/* COMPOSE MESSAGE MODE */}
            {dialogMode === 'compose_message' && (
              <div className="space-y-4">
                <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                  <Avatar className="h-10 w-10">
                    <AvatarImage src={request.requester_avatar} />
                    <AvatarFallback className="bg-accent-yellow/20 text-accent-yellow">
                      {request.requester_name?.slice(0, 2).toUpperCase() || 'U'}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="font-medium text-sm">To: {request.requester_name || 'Unknown'}</p>
                    {request.requester_org_name && (
                      <p className="text-xs text-muted-foreground">{request.requester_org_name}</p>
                    )}
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="message">Message</Label>
                  <Textarea
                    id="message"
                    placeholder="Hi, I have a question about your rental request..."
                    value={messageContent}
                    onChange={(e) => setMessageContent(e.target.value)}
                    rows={5}
                    autoFocus
                  />
                </div>
              </div>
            )}
          </>
        ) : null}

        {/* Footer Actions */}
        <DialogFooter className="gap-2 flex-wrap">
          {/* VIEW MODE ACTIONS */}
          {dialogMode === 'view' && (
            <>
              <Button variant="outline" onClick={handleClose}>
                Cancel
              </Button>
              {request?.status === 'pending' && (
                <>
                  <Button
                    variant="ghost"
                    onClick={() => setDialogMode('compose_message')}
                    disabled={approve.isPending || reject.isPending}
                  >
                    <MessageSquare className="w-4 h-4 mr-2" />
                    Contact Requester
                  </Button>
                  <Button
                    variant="outline"
                    onClick={handleQuickReject}
                    disabled={approve.isPending || reject.isPending}
                  >
                    {reject.isPending ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <XCircle className="w-4 h-4 mr-2" />
                    )}
                    Quick Reject
                  </Button>
                  <Button
                    variant="outline"
                    className="text-destructive hover:text-destructive"
                    onClick={() => setDialogMode('reject_with_notes')}
                    disabled={approve.isPending || reject.isPending}
                  >
                    Reject with Notes...
                  </Button>
                  <Button
                    onClick={handleApprove}
                    disabled={approve.isPending || reject.isPending}
                  >
                    {approve.isPending ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <CheckCircle2 className="w-4 h-4 mr-2" />
                    )}
                    Approve
                  </Button>
                </>
              )}
            </>
          )}

          {/* REJECT WITH NOTES ACTIONS */}
          {dialogMode === 'reject_with_notes' && (
            <>
              <Button variant="outline" onClick={() => setDialogMode('view')}>
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back
              </Button>
              <Button
                variant="destructive"
                onClick={handleRejectWithNotes}
                disabled={!rejectReason.trim() || reject.isPending}
              >
                {reject.isPending ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <XCircle className="w-4 h-4 mr-2" />
                )}
                Reject Request
              </Button>
            </>
          )}

          {/* COMPOSE MESSAGE ACTIONS */}
          {dialogMode === 'compose_message' && (
            <>
              <Button variant="outline" onClick={() => setDialogMode('view')}>
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back
              </Button>
              <Button
                onClick={handleSendMessage}
                disabled={!messageContent.trim() || isSendingMessage}
              >
                {isSendingMessage ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Send className="w-4 h-4 mr-2" />
                )}
                Send Message
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default WorkOrderRequestsSection;
