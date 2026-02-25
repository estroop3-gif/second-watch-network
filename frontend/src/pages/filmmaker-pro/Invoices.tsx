/**
 * Invoice List — View, filter, and manage standalone invoices.
 */
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Plus, FileText, Send, CheckCircle, Clock, AlertCircle, X } from 'lucide-react';
import { useInvoices } from '@/hooks/useFilmmakerPro';
import { useEnrichedProfile } from '@/context/EnrichedProfileContext';
import ProUpgradePrompt from '@/components/filmmaker-pro/ProUpgradePrompt';

const STATUS_FILTERS = [
  { label: 'All', value: '' },
  { label: 'Draft', value: 'draft' },
  { label: 'Sent', value: 'sent' },
  { label: 'Viewed', value: 'viewed' },
  { label: 'Paid', value: 'paid' },
  { label: 'Overdue', value: 'overdue' },
];

const STATUS_STYLES: Record<string, { icon: any; class: string }> = {
  draft: { icon: FileText, class: 'border-muted-gray text-muted-gray' },
  sent: { icon: Send, class: 'border-blue-500 text-blue-400' },
  viewed: { icon: Clock, class: 'border-yellow-500 text-yellow-400' },
  paid: { icon: CheckCircle, class: 'border-green-500 text-green-400' },
  overdue: { icon: AlertCircle, class: 'border-red-500 text-red-400' },
  canceled: { icon: X, class: 'border-muted-gray text-muted-gray' },
};

const Invoices = () => {
  const { profile } = useEnrichedProfile();
  const navigate = useNavigate();
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(0);
  const { data, isLoading } = useInvoices(statusFilter || undefined, 20, page * 20);

  if (!profile?.is_filmmaker_pro) {
    return (
      <div className="max-w-2xl mx-auto">
        <h1 className="text-3xl font-heading text-bone-white mb-6">Invoices</h1>
        <ProUpgradePrompt feature="Invoicing" />
      </div>
    );
  }

  const invoices = data?.invoices || [];
  const total = data?.total || 0;
  const totalPages = Math.ceil(total / 20);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-heading text-bone-white">Invoices</h1>
        <Button className="bg-amber-500 hover:bg-amber-600 text-charcoal-black"
          onClick={() => navigate('/filmmaker-pro/invoices/new')}>
          <Plus className="h-4 w-4 mr-2" />New Invoice
        </Button>
      </div>

      {/* Status Filters */}
      <div className="flex gap-1 flex-wrap">
        {STATUS_FILTERS.map((f) => (
          <Button key={f.value} size="sm" variant={statusFilter === f.value ? 'default' : 'ghost'}
            className={statusFilter === f.value ? 'bg-amber-500 text-charcoal-black' : 'text-muted-gray'}
            onClick={() => { setStatusFilter(f.value); setPage(0); }}>
            {f.label}
          </Button>
        ))}
      </div>

      {isLoading ? (
        <p className="text-muted-gray text-center py-12">Loading...</p>
      ) : invoices.length === 0 ? (
        <Card className="bg-charcoal-black border-muted-gray">
          <CardContent className="p-8 text-center">
            <FileText className="h-12 w-12 text-muted-gray mx-auto mb-4" />
            <p className="text-muted-gray mb-4">No invoices {statusFilter ? `with status "${statusFilter}"` : 'yet'}.</p>
            <Button variant="outline" onClick={() => navigate('/filmmaker-pro/invoices/new')}>
              <Plus className="h-4 w-4 mr-2" />Create Invoice
            </Button>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="space-y-2">
            {invoices.map((inv: any) => {
              const style = STATUS_STYLES[inv.status] || STATUS_STYLES.draft;
              const StatusIcon = style.icon;
              return (
                <Card key={inv.id} className="bg-charcoal-black border-muted-gray hover:border-amber-500/30 transition-colors cursor-pointer"
                  onClick={() => navigate(`/filmmaker-pro/invoices/${inv.id}`)}>
                  <CardContent className="p-4 flex items-center gap-4">
                    <StatusIcon className={`h-5 w-5 shrink-0 ${style.class.split(' ').pop()}`} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-sm font-medium text-bone-white">{inv.invoice_number}</span>
                        <Badge variant="outline" className={style.class}>{inv.status}</Badge>
                      </div>
                      <p className="text-sm text-muted-gray truncate">
                        {inv.recipient_name}
                        {inv.project_name && <span> &middot; {inv.project_name}</span>}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-lg font-bold text-bone-white">${(inv.total_cents / 100).toFixed(2)}</p>
                      <p className="text-xs text-muted-gray">
                        {inv.due_date ? `Due ${new Date(inv.due_date).toLocaleDateString()}` : 'No due date'}
                      </p>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex justify-center gap-2">
              <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage(p => p - 1)}>Previous</Button>
              <span className="text-sm text-muted-gray py-2">Page {page + 1} of {totalPages}</span>
              <Button variant="outline" size="sm" disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)}>Next</Button>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default Invoices;
