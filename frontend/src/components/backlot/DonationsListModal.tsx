/**
 * DonationsListModal - Shows all donations for a project (owner-only view)
 */
import React from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Heart, User, Calendar, MessageSquare, DollarSign } from 'lucide-react';
import { api } from '@/lib/api';
import { formatDistanceToNow } from 'date-fns';

interface DonationsListModalProps {
  projectId: string;
  isOpen: boolean;
  onClose: () => void;
}

const formatCurrency = (cents: number): string => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
  }).format(cents / 100);
};

const getStatusColor = (status: string): string => {
  switch (status) {
    case 'succeeded':
      return 'bg-green-500/20 text-green-400 border-green-500/30';
    case 'pending':
      return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30';
    case 'failed':
      return 'bg-red-500/20 text-red-400 border-red-500/30';
    case 'refunded':
      return 'bg-muted-gray/20 text-muted-gray border-muted-gray/30';
    default:
      return 'bg-muted-gray/20 text-muted-gray border-muted-gray/30';
  }
};

const DonationsListModal: React.FC<DonationsListModalProps> = ({
  projectId,
  isOpen,
  onClose,
}) => {
  const { data, isLoading, error } = useQuery({
    queryKey: ['project-donations', projectId],
    queryFn: () => api.listProjectDonations(projectId),
    enabled: isOpen && !!projectId,
  });

  const donations = data?.donations || [];

  // Calculate totals
  const succeededDonations = donations.filter((d) => d.status === 'succeeded');
  const totalRaised = succeededDonations.reduce((sum, d) => sum + d.amount_cents, 0);
  const totalNet = succeededDonations.reduce((sum, d) => sum + (d.net_amount_cents || d.amount_cents), 0);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[600px] bg-charcoal-black border-muted-gray max-h-[85vh]">
        <DialogHeader>
          <DialogTitle className="text-bone-white flex items-center gap-2">
            <Heart className="w-5 h-5 text-primary-red" />
            Donation History
          </DialogTitle>
          <DialogDescription className="text-muted-gray">
            All donations received for this project
          </DialogDescription>
        </DialogHeader>

        {/* Summary Stats */}
        {!isLoading && donations.length > 0 && (
          <div className="grid grid-cols-3 gap-3 mb-4">
            <div className="bg-muted-gray/10 rounded-lg p-3 text-center">
              <div className="text-lg font-bold text-primary-red">{formatCurrency(totalRaised)}</div>
              <div className="text-xs text-muted-gray">Total Raised</div>
            </div>
            <div className="bg-muted-gray/10 rounded-lg p-3 text-center">
              <div className="text-lg font-bold text-green-400">{formatCurrency(totalNet)}</div>
              <div className="text-xs text-muted-gray">Your Earnings</div>
            </div>
            <div className="bg-muted-gray/10 rounded-lg p-3 text-center">
              <div className="text-lg font-bold text-bone-white">{succeededDonations.length}</div>
              <div className="text-xs text-muted-gray">Donations</div>
            </div>
          </div>
        )}

        {/* Loading State */}
        {isLoading && (
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3 p-3 bg-muted-gray/10 rounded-lg">
                <Skeleton className="w-10 h-10 rounded-full" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-3 w-24" />
                </div>
                <Skeleton className="h-6 w-16" />
              </div>
            ))}
          </div>
        )}

        {/* Error State */}
        {error && (
          <div className="text-center py-8 text-red-400">
            Failed to load donations. Please try again.
          </div>
        )}

        {/* Empty State */}
        {!isLoading && !error && donations.length === 0 && (
          <div className="text-center py-12">
            <Heart className="w-12 h-12 text-muted-gray/30 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-bone-white mb-2">No donations yet</h3>
            <p className="text-sm text-muted-gray">
              Share your project to start receiving donations from supporters.
            </p>
          </div>
        )}

        {/* Donations List */}
        {!isLoading && !error && donations.length > 0 && (
          <ScrollArea className="h-[400px] pr-4">
            <div className="space-y-3">
              {donations.map((donation) => (
                <div
                  key={donation.id}
                  className="bg-muted-gray/10 rounded-lg p-4 space-y-2"
                >
                  {/* Header: Donor + Amount + Status */}
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-muted-gray/30 flex items-center justify-center">
                        <User className="w-5 h-5 text-muted-gray" />
                      </div>
                      <div>
                        <div className="font-medium text-bone-white">
                          {donation.is_anonymous
                            ? 'Anonymous'
                            : donation.donor?.name || 'Unknown Donor'}
                        </div>
                        {!donation.is_anonymous && donation.donor?.email && (
                          <div className="text-xs text-muted-gray">{donation.donor.email}</div>
                        )}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="flex items-center gap-2">
                        <span className="text-lg font-bold text-bone-white">
                          {formatCurrency(donation.amount_cents)}
                        </span>
                        <Badge variant="outline" className={getStatusColor(donation.status)}>
                          {donation.status}
                        </Badge>
                      </div>
                      {donation.net_amount_cents && donation.platform_fee_cents && (
                        <div className="text-xs text-muted-gray mt-1">
                          Net: {formatCurrency(donation.net_amount_cents)} (fee: {formatCurrency(donation.platform_fee_cents)})
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Message */}
                  {donation.message && (
                    <div className="flex items-start gap-2 pt-2 border-t border-muted-gray/20">
                      <MessageSquare className="w-4 h-4 text-muted-gray shrink-0 mt-0.5" />
                      <p className="text-sm text-bone-white/80 italic">"{donation.message}"</p>
                    </div>
                  )}

                  {/* Date */}
                  <div className="flex items-center gap-1 text-xs text-muted-gray">
                    <Calendar className="w-3 h-3" />
                    {formatDistanceToNow(new Date(donation.created_at), { addSuffix: true })}
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default DonationsListModal;
