/**
 * CreditReview - Admin page for reviewing pending credit submissions
 */
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { CheckCircle, XCircle, Film, Clock } from 'lucide-react';
import { toast } from 'sonner';
import { usePendingCredits, useApproveCredit, useRejectCredit } from '@/hooks/useCreditReview';

const CreditReview: React.FC = () => {
  const { data, isLoading } = usePendingCredits();
  const approveMutation = useApproveCredit();
  const rejectMutation = useRejectCredit();
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectNote, setRejectNote] = useState('');

  const credits = data?.credits || [];
  const total = data?.total || 0;

  const handleApprove = async (creditId: string) => {
    try {
      await approveMutation.mutateAsync({ creditId });
      toast.success('Credit approved');
    } catch (e: any) {
      toast.error(`Failed to approve: ${e.message}`);
    }
  };

  const handleReject = async () => {
    if (!rejectingId || !rejectNote.trim()) return;
    try {
      await rejectMutation.mutateAsync({ creditId: rejectingId, note: rejectNote.trim() });
      toast.success('Credit rejected');
      setRejectingId(null);
      setRejectNote('');
    } catch (e: any) {
      toast.error(`Failed to reject: ${e.message}`);
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-heading text-bone-white">Credit Review</h1>
          <p className="text-muted-gray text-sm mt-1">
            Review and approve pending credit submissions
          </p>
        </div>
        {total > 0 && (
          <Badge className="bg-accent-yellow/20 text-accent-yellow border-accent-yellow/30">
            {total} pending
          </Badge>
        )}
      </div>

      {isLoading ? (
        <div className="space-y-4">
          {[...Array(5)].map((_, i) => (
            <Skeleton key={i} className="h-20 w-full rounded-lg" />
          ))}
        </div>
      ) : credits.length === 0 ? (
        <div className="text-center py-16">
          <CheckCircle className="w-12 h-12 text-green-500/30 mx-auto mb-3" />
          <p className="text-muted-gray text-lg">No pending credits to review.</p>
          <p className="text-muted-gray/60 text-sm mt-1">All caught up!</p>
        </div>
      ) : (
        <div className="space-y-3">
          {credits.map((credit: any) => {
            const initials = (credit.submitter_name || 'U')
              .split(' ')
              .map((n: string) => n[0])
              .join('')
              .toUpperCase()
              .slice(0, 2);

            return (
              <div
                key={credit.id}
                className="flex items-center gap-4 p-4 rounded-lg bg-charcoal-black/50 border border-muted-gray/20"
              >
                {/* Submitter Info */}
                <Avatar className="h-10 w-10 flex-shrink-0">
                  <AvatarImage src={credit.submitter_avatar} />
                  <AvatarFallback className="bg-muted-gray/20 text-bone-white text-sm">
                    {initials}
                  </AvatarFallback>
                </Avatar>

                {/* Credit Details */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-semibold text-bone-white text-sm truncate">
                      {credit.submitter_name || credit.submitter_username}
                    </p>
                    <span className="text-muted-gray text-xs">as</span>
                    <Badge variant="outline" className="text-xs border-accent-yellow/30 text-accent-yellow">
                      {credit.position}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    <Film className="w-3 h-3 text-muted-gray" />
                    <span className="text-sm text-muted-gray truncate">
                      {credit.production_name}
                    </span>
                    {credit.created_at && (
                      <>
                        <Clock className="w-3 h-3 text-muted-gray/50 ml-2" />
                        <span className="text-xs text-muted-gray/50">
                          {new Date(credit.created_at).toLocaleDateString()}
                        </span>
                      </>
                    )}
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex items-center gap-2 flex-shrink-0">
                  <Button
                    size="sm"
                    className="bg-green-600 hover:bg-green-700 text-white"
                    onClick={() => handleApprove(credit.id)}
                    disabled={approveMutation.isPending}
                  >
                    <CheckCircle className="w-4 h-4 mr-1" />
                    Approve
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="border-primary-red/50 text-primary-red hover:bg-primary-red/10"
                    onClick={() => {
                      setRejectingId(credit.id);
                      setRejectNote('');
                    }}
                    disabled={rejectMutation.isPending}
                  >
                    <XCircle className="w-4 h-4 mr-1" />
                    Reject
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Reject Dialog */}
      <Dialog open={!!rejectingId} onOpenChange={(open) => !open && setRejectingId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject Credit</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-gray">
              Please provide a reason for rejecting this credit. The submitter will see this note.
            </p>
            <Textarea
              value={rejectNote}
              onChange={(e) => setRejectNote(e.target.value)}
              placeholder="Reason for rejection..."
              rows={3}
            />
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setRejectingId(null)}>
                Cancel
              </Button>
              <Button
                className="bg-primary-red hover:bg-red-700"
                onClick={handleReject}
                disabled={!rejectNote.trim() || rejectMutation.isPending}
              >
                Reject Credit
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default CreditReview;
