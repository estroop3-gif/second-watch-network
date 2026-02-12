import { useState } from 'react';
import {
  useBusinessCards,
  useBusinessCardById,
  useUpdateBusinessCardStatus,
  useExportBusinessCards,
} from '@/hooks/crm/useBusinessCards';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Search,
  Download,
  Check,
  X,
  Printer,
  Eye,
  Loader2,
  CreditCard,
} from 'lucide-react';
import { formatDate as formatDateUtil } from '@/lib/dateUtils';

type CardStatus = 'draft' | 'submitted' | 'approved' | 'printed' | 'rejected';

const STATUS_OPTIONS = [
  { value: 'all', label: 'All' },
  { value: 'draft', label: 'Draft' },
  { value: 'submitted', label: 'Submitted' },
  { value: 'approved', label: 'Approved' },
  { value: 'printed', label: 'Printed' },
  { value: 'rejected', label: 'Rejected' },
] as const;

const STATUS_COLORS: Record<CardStatus, string> = {
  draft: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
  submitted: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  approved: 'bg-green-500/20 text-green-400 border-green-500/30',
  printed: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  rejected: 'bg-red-500/20 text-red-400 border-red-500/30',
};

const AdminBusinessCards = () => {
  const { toast } = useToast();
  const [statusFilter, setStatusFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);
  const [adminNotes, setAdminNotes] = useState('');

  const { data, isLoading } = useBusinessCards({
    status: statusFilter !== 'all' ? statusFilter : undefined,
    search: search || undefined,
  });

  const { data: cardDetailData } = useBusinessCardById(selectedCardId || '');
  const updateStatus = useUpdateBusinessCardStatus();
  const { refetch: exportCards, isFetching: isExporting } = useExportBusinessCards();

  const cards = data?.cards || [];
  const selectedCard = cardDetailData?.card || null;

  const handleStatusUpdate = async (id: string, status: string) => {
    if (status === 'rejected' && !adminNotes.trim()) {
      toast({ title: 'Please provide rejection notes', variant: 'destructive' });
      return;
    }
    try {
      await updateStatus.mutateAsync({
        id,
        status,
        admin_notes: adminNotes || undefined,
      });
      const label = status.charAt(0).toUpperCase() + status.slice(1);
      toast({ title: `Business card ${label.toLowerCase()}` });
      setAdminNotes('');
      setSelectedCardId(null);
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    }
  };

  const handleExport = async () => {
    try {
      const result = await exportCards();
      if (result.data) {
        const blob = new Blob([JSON.stringify(result.data, null, 2)], {
          type: 'application/json',
        });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `business-cards-export-${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        toast({ title: 'Export downloaded' });
      }
    } catch (err: any) {
      toast({ title: 'Export failed', description: err.message, variant: 'destructive' });
    }
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '--';
    return formatDateUtil(dateStr);
  };

  const getRepName = (card: any): string => {
    if (card.full_name) return card.full_name;
    if (card.rep_name) return card.rep_name;
    const first = card.first_name || '';
    const last = card.last_name || '';
    return `${first} ${last}`.trim() || 'Unknown';
  };

  return (
    <div className="space-y-6 bg-charcoal-black min-h-full">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-heading text-accent-yellow flex items-center gap-3">
            <CreditCard className="h-8 w-8" />
            Business Cards
          </h1>
          <p className="text-muted-gray mt-1">
            Review and manage rep business card submissions
          </p>
        </div>
        <Button
          onClick={handleExport}
          disabled={isExporting}
          className="bg-accent-yellow text-charcoal-black hover:bg-accent-yellow/90"
        >
          {isExporting ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Download className="h-4 w-4 mr-2" />
          )}
          Export Approved
        </Button>
      </div>

      {/* Filter Bar */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-gray" />
          <Input
            placeholder="Search by name..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 bg-charcoal-black border-muted-gray/30 text-bone-white placeholder:text-muted-gray"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-44 bg-charcoal-black border-muted-gray/30 text-bone-white">
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent>
            {STATUS_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12 text-muted-gray">
          <Loader2 className="h-5 w-5 mr-2 animate-spin" />
          Loading business cards...
        </div>
      ) : cards.length === 0 ? (
        <div className="text-center py-12 text-muted-gray">
          No business cards found.
        </div>
      ) : (
        <div className="border border-muted-gray/30 rounded-lg overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-muted-gray/30 bg-[#1a1a1a]">
                <th className="text-left px-4 py-3 text-sm font-medium text-muted-gray">
                  Rep Name
                </th>
                <th className="text-left px-4 py-3 text-sm font-medium text-muted-gray">
                  Status
                </th>
                <th className="text-left px-4 py-3 text-sm font-medium text-muted-gray">
                  Submitted Date
                </th>
                <th className="text-right px-4 py-3 text-sm font-medium text-muted-gray">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {cards.map((card: any) => {
                const status = (card.status || 'draft') as CardStatus;
                return (
                  <tr
                    key={card.id}
                    className="border-b border-muted-gray/30 hover:bg-muted-gray/10 cursor-pointer transition-colors"
                    onClick={() => {
                      setSelectedCardId(card.id);
                      setAdminNotes('');
                    }}
                  >
                    <td className="px-4 py-3 text-bone-white font-medium">
                      {getRepName(card)}
                    </td>
                    <td className="px-4 py-3">
                      <Badge
                        variant="outline"
                        className={STATUS_COLORS[status] || STATUS_COLORS.draft}
                      >
                        {status.charAt(0).toUpperCase() + status.slice(1)}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-muted-gray">
                      {formatDate(card.submitted_at || card.created_at)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedCardId(card.id);
                          setAdminNotes('');
                        }}
                        className="text-muted-gray hover:text-bone-white"
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Review Dialog */}
      <Dialog
        open={!!selectedCardId}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedCardId(null);
            setAdminNotes('');
          }
        }}
      >
        <DialogContent className="bg-[#1a1a1a] border-muted-gray/30 text-bone-white max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-accent-yellow flex items-center gap-2">
              <CreditCard className="h-5 w-5" />
              Business Card Review
            </DialogTitle>
            <DialogDescription className="text-muted-gray">
              Review the business card details and take action.
            </DialogDescription>
          </DialogHeader>

          {selectedCard ? (
            <div className="space-y-5">
              {/* Card Front - SWN Info */}
              <div>
                <Label className="text-sm text-muted-gray mb-2 block">
                  Front - SWN Information
                </Label>
                <div className="rounded-lg border border-muted-gray/30 bg-charcoal-black p-4 space-y-3">
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <span className="text-muted-gray block text-xs">Name</span>
                      <p className="text-bone-white">
                        {selectedCard.full_name ||
                          `${selectedCard.first_name || ''} ${selectedCard.last_name || ''}`.trim() ||
                          'N/A'}
                      </p>
                    </div>
                    <div>
                      <span className="text-muted-gray block text-xs">Title</span>
                      <p className="text-bone-white">
                        {selectedCard.title || selectedCard.job_title || 'N/A'}
                      </p>
                    </div>
                    <div>
                      <span className="text-muted-gray block text-xs">Email</span>
                      <p className="text-bone-white">{selectedCard.email || 'N/A'}</p>
                    </div>
                    <div>
                      <span className="text-muted-gray block text-xs">Phone</span>
                      <p className="text-bone-white">{selectedCard.phone || 'N/A'}</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Card Back - Personal Info */}
              <div>
                <Label className="text-sm text-muted-gray mb-2 block">
                  Back - Personal Information
                </Label>
                <div className="rounded-lg border border-muted-gray/30 bg-charcoal-black p-4 space-y-3">
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    {selectedCard.website && (
                      <div className="col-span-2">
                        <span className="text-muted-gray block text-xs">Website</span>
                        <p className="text-bone-white">{selectedCard.website}</p>
                      </div>
                    )}
                    {selectedCard.address && (
                      <div className="col-span-2">
                        <span className="text-muted-gray block text-xs">Address</span>
                        <p className="text-bone-white">{selectedCard.address}</p>
                      </div>
                    )}
                    {selectedCard.tagline && (
                      <div className="col-span-2">
                        <span className="text-muted-gray block text-xs">Tagline</span>
                        <p className="text-bone-white">{selectedCard.tagline}</p>
                      </div>
                    )}
                  </div>

                  {/* Personal Logo */}
                  {selectedCard.logo_url && (
                    <div className="pt-3 border-t border-muted-gray/30">
                      <span className="text-muted-gray text-xs block mb-1">
                        Personal Logo
                      </span>
                      <img
                        src={selectedCard.logo_url}
                        alt="Business card logo"
                        className="max-h-20 object-contain rounded"
                      />
                    </div>
                  )}

                  {/* Social Links */}
                  {(selectedCard.linkedin ||
                    selectedCard.twitter ||
                    selectedCard.instagram ||
                    selectedCard.facebook ||
                    selectedCard.social_links) && (
                    <div className="pt-3 border-t border-muted-gray/30">
                      <span className="text-muted-gray text-xs block mb-2">
                        Social Links
                      </span>
                      <div className="flex flex-wrap gap-2 text-sm">
                        {selectedCard.linkedin && (
                          <a
                            href={selectedCard.linkedin}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-400 hover:text-blue-300 underline"
                          >
                            LinkedIn
                          </a>
                        )}
                        {selectedCard.twitter && (
                          <a
                            href={selectedCard.twitter}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-400 hover:text-blue-300 underline"
                          >
                            Twitter
                          </a>
                        )}
                        {selectedCard.instagram && (
                          <a
                            href={selectedCard.instagram}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-400 hover:text-blue-300 underline"
                          >
                            Instagram
                          </a>
                        )}
                        {selectedCard.facebook && (
                          <a
                            href={selectedCard.facebook}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-400 hover:text-blue-300 underline"
                          >
                            Facebook
                          </a>
                        )}
                        {selectedCard.social_links &&
                          typeof selectedCard.social_links === 'object' &&
                          Object.entries(selectedCard.social_links).map(
                            ([platform, url]: [string, any]) =>
                              url && (
                                <a
                                  key={platform}
                                  href={url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-blue-400 hover:text-blue-300 underline"
                                >
                                  {platform.charAt(0).toUpperCase() + platform.slice(1)}
                                </a>
                              )
                          )}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Current Status */}
              <div className="flex items-center gap-2">
                <span className="text-muted-gray text-sm">Current Status:</span>
                <Badge
                  variant="outline"
                  className={
                    STATUS_COLORS[(selectedCard.status || 'draft') as CardStatus] ||
                    STATUS_COLORS.draft
                  }
                >
                  {(selectedCard.status || 'draft').charAt(0).toUpperCase() +
                    (selectedCard.status || 'draft').slice(1)}
                </Badge>
              </div>

              {/* Previous Admin Notes */}
              {selectedCard.admin_notes && (
                <div>
                  <Label className="text-sm text-muted-gray block mb-1">
                    Previous Admin Notes
                  </Label>
                  <p className="text-bone-white text-sm bg-charcoal-black rounded-lg p-3 border border-muted-gray/30">
                    {selectedCard.admin_notes}
                  </p>
                </div>
              )}

              {/* Admin Notes Input */}
              <div>
                <Label className="text-sm text-muted-gray block mb-2">
                  Admin Notes
                  {selectedCard.status === 'submitted' && (
                    <span className="text-red-400 ml-1">(required for rejection)</span>
                  )}
                </Label>
                <Textarea
                  value={adminNotes}
                  onChange={(e) => setAdminNotes(e.target.value)}
                  placeholder="Add notes about this business card..."
                  className="bg-charcoal-black border-muted-gray/30 text-bone-white placeholder:text-muted-gray"
                  rows={3}
                />
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-3 pt-2 border-t border-muted-gray/30">
                <Button
                  variant="outline"
                  onClick={() => {
                    setSelectedCardId(null);
                    setAdminNotes('');
                  }}
                  className="border-muted-gray/30 text-muted-gray hover:text-bone-white"
                >
                  Close
                </Button>

                {(selectedCard.status === 'submitted' ||
                  selectedCard.status === 'approved') && (
                  <Button
                    onClick={() => handleStatusUpdate(selectedCard.id, 'rejected')}
                    disabled={updateStatus.isPending || !adminNotes.trim()}
                    className="bg-red-500/20 text-red-400 border border-red-500/30 hover:bg-red-500/30"
                  >
                    {updateStatus.isPending ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <X className="h-4 w-4 mr-2" />
                    )}
                    Reject
                  </Button>
                )}

                {selectedCard.status === 'submitted' && (
                  <Button
                    onClick={() => handleStatusUpdate(selectedCard.id, 'approved')}
                    disabled={updateStatus.isPending}
                    className="bg-green-500/20 text-green-400 border border-green-500/30 hover:bg-green-500/30"
                  >
                    {updateStatus.isPending ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Check className="h-4 w-4 mr-2" />
                    )}
                    Approve
                  </Button>
                )}

                {selectedCard.status === 'approved' && (
                  <Button
                    onClick={() => handleStatusUpdate(selectedCard.id, 'printed')}
                    disabled={updateStatus.isPending}
                    className="bg-blue-500/20 text-blue-400 border border-blue-500/30 hover:bg-blue-500/30"
                  >
                    {updateStatus.isPending ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Printer className="h-4 w-4 mr-2" />
                    )}
                    Mark as Printed
                  </Button>
                )}
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center py-8 text-muted-gray">
              <Loader2 className="h-5 w-5 mr-2 animate-spin" />
              Loading card details...
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminBusinessCards;
