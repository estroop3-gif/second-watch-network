/**
 * IncomingQuoteRequestDialog - Full-featured dialog for incoming rental requests
 * Displays request details with approve/reject/message actions
 */
import React, { useState } from 'react';
import {
  CheckCircle2,
  XCircle,
  Loader2,
  MessageSquare,
  Send,
  ArrowLeft,
  Package,
  Calendar,
} from 'lucide-react';
import { format } from 'date-fns';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
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
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/context/AuthContext';
import { api } from '@/lib/api';

import {
  useRentalRequest,
  useApproveRentalRequest,
  useRejectRentalRequest,
} from '@/hooks/gear/useGearMarketplace';
import type {
  GearRentalRequest,
  GearRentalRequestItem,
  RentalRequestStatus,
} from '@/types/gear';
import { cn } from '@/lib/utils';

// Dialog mode type
type DialogMode = 'view' | 'reject_with_notes' | 'compose_message';

// Request Detail Dialog
interface IncomingQuoteRequestDialogProps {
  requestId: string | null;
  orgId: string;
  open: boolean;
  onClose: () => void;
  onActionComplete: () => void;
}

export function IncomingQuoteRequestDialog({
  requestId,
  orgId,
  open,
  onClose,
  onActionComplete,
}: IncomingQuoteRequestDialogProps) {
  const { toast } = useToast();
  const { user } = useAuth();
  const [dialogMode, setDialogMode] = useState<DialogMode>('view');
  const [rejectReason, setRejectReason] = useState('');
  const [messageContent, setMessageContent] = useState('');
  const [isSendingMessage, setIsSendingMessage] = useState(false);

  const { request, isLoading } = useRentalRequest(requestId || '');
  const approve = useApproveRentalRequest(orgId);
  const reject = useRejectRentalRequest();

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
        description: `Work order ${result.work_order_number || 'created'}. The renter will be notified.`,
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
      console.log('[handleQuickReject] Starting rejection for:', requestId);
      await reject.mutateAsync({
        requestId,
      });
      console.log('[handleQuickReject] Rejection successful');
      toast({
        title: 'Request Rejected',
        description: 'The renter has been notified of your decision.',
      });
      onActionComplete();
    } catch (error) {
      console.error('[handleQuickReject] Rejection failed:', error);
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
      console.log('[handleRejectWithNotes] Starting rejection with notes for:', requestId);
      await reject.mutateAsync({
        requestId,
        reason: rejectReason,
      });
      console.log('[handleRejectWithNotes] Rejection successful');
      toast({
        title: 'Request Rejected',
        description: 'The renter has been notified with your reason.',
      });
      setRejectReason('');
      setDialogMode('view');
      onActionComplete();
    } catch (error) {
      console.error('[handleRejectWithNotes] Rejection failed:', error);
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
        request.requested_by_user_id
      );

      // Send the message
      await api.sendMessage(user.id, {
        conversation_id: conversationResult.conversation_id,
        content: messageContent,
      });

      toast({
        title: 'Message Sent',
        description: `Your message has been sent to ${request.requested_by_name || 'the requester'}.`,
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

  // Helper to get first photo from item
  const getItemPhoto = (item: GearRentalRequestItem): string | null => {
    // Items in rental requests don't have asset_photos directly
    // We'd need to fetch the asset or listing separately, or the backend should join it
    // For now, return null and show placeholder
    return null;
  };

  if (!open) return null;

  return (
    <Dialog open={open} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {request?.title || `Request ${request?.request_number}`}
          </DialogTitle>
          <DialogDescription>
            {dialogMode === 'view' && 'Review this rental request and take action.'}
            {dialogMode === 'reject_with_notes' && 'Provide a reason for rejecting this request.'}
            {dialogMode === 'compose_message' && `Send a message to ${request?.requested_by_name || 'the requester'}.`}
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
                    <AvatarFallback className="bg-accent-yellow/20 text-accent-yellow">
                      {request.requested_by_name?.slice(0, 2).toUpperCase() || 'U'}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1">
                    <p className="font-medium">{request.requested_by_name || 'Unknown'}</p>
                    {request.requesting_org_name && (
                      <p className="text-sm text-muted-foreground">{request.requesting_org_name}</p>
                    )}
                    {request.project_name && (
                      <p className="text-xs text-muted-foreground">Project: {request.project_name}</p>
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

                {/* Description */}
                {request.description && (
                  <div className="p-3 rounded-lg bg-muted/50">
                    <p className="text-xs text-muted-foreground mb-1">Description</p>
                    <p className="text-sm">{request.description}</p>
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
                        const photo = getItemPhoto(item);

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
                                {item.asset_name || item.item_description || 'Item'}
                              </p>
                              {item.asset_internal_id && (
                                <p className="text-sm text-muted-foreground">
                                  ID: {item.asset_internal_id}
                                </p>
                              )}
                              <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                                {item.category_name && (
                                  <Badge variant="outline" className="text-xs">
                                    {item.category_name}
                                  </Badge>
                                )}
                              </div>
                              {/* Item notes */}
                              {item.notes && (
                                <p className="text-xs text-muted-foreground mt-1.5 italic">
                                  {item.notes}
                                </p>
                              )}
                            </div>

                            {/* Quantity */}
                            <div className="text-right flex-shrink-0">
                              <Badge variant="secondary" className="text-xs">
                                Qty: {item.quantity}
                              </Badge>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </ScrollArea>
                </div>
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
                    This reason will be sent to {request.requested_by_name || 'the requester'}.
                  </p>
                </div>
              </div>
            )}

            {/* COMPOSE MESSAGE MODE */}
            {dialogMode === 'compose_message' && (
              <div className="space-y-4">
                <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                  <Avatar className="h-10 w-10">
                    <AvatarFallback className="bg-accent-yellow/20 text-accent-yellow">
                      {request.requested_by_name?.slice(0, 2).toUpperCase() || 'U'}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="font-medium text-sm">To: {request.requested_by_name || 'Unknown'}</p>
                    {request.requesting_org_name && (
                      <p className="text-xs text-muted-foreground">{request.requesting_org_name}</p>
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
              {request?.status === 'submitted' && (
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

export default IncomingQuoteRequestDialog;
