import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useOpenLogEntries, useUpdateLogEntry } from '@/hooks/crm/useCustomerLog';
import LogStatusBadge from '@/components/crm/LogStatusBadge';
import { Button } from '@/components/ui/button';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { useEmailCompose } from '@/context/EmailComposeContext';
import { ClipboardList, CheckCircle, Send } from 'lucide-react';
import { formatDate } from '@/lib/dateUtils';

const LOG_TYPE_LABELS: Record<string, string> = {
  complaint: 'Complaint',
  inquiry: 'Inquiry',
  support_ticket: 'Support',
  feedback: 'Feedback',
  suggestion: 'Suggestion',
  escalation: 'Escalation',
  general: 'General',
};

const CustomerLog = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { data, isLoading } = useOpenLogEntries();
  const updateLog = useUpdateLogEntry();

  const { openCompose } = useEmailCompose();
  const [resolvingId, setResolvingId] = useState<string | null>(null);
  const [resolution, setResolution] = useState('');
  const [newStatus, setNewStatus] = useState('resolved');

  const entries = data?.log_entries || [];

  const handleResolve = async () => {
    if (!resolvingId) return;
    try {
      await updateLog.mutateAsync({
        logId: resolvingId,
        data: { status: newStatus, resolution: resolution || undefined },
      });
      toast({ title: 'Log entry updated' });
      setResolvingId(null);
      setResolution('');
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-heading text-accent-yellow flex items-center gap-3">
          <ClipboardList className="h-8 w-8" />
          Customer Log
        </h1>
        <p className="text-muted-gray mt-1">{entries.length} open items</p>
      </div>

      {isLoading ? (
        <div className="text-center py-12 text-muted-gray">Loading...</div>
      ) : entries.length === 0 ? (
        <div className="text-center py-12">
          <CheckCircle className="h-12 w-12 text-emerald-500 mx-auto mb-3" />
          <p className="text-muted-gray">All clear! No open items.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {entries.map((entry: any) => {
            const contactName = [entry.contact_first_name, entry.contact_last_name].filter(Boolean).join(' ');
            return (
              <div
                key={entry.id}
                className="bg-charcoal-black border border-muted-gray/30 rounded-lg p-4 hover:border-accent-yellow/30 transition-colors"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-1">
                      <h3 className="text-sm font-medium text-bone-white">{entry.subject}</h3>
                      <LogStatusBadge status={entry.status} priority={entry.priority} />
                    </div>
                    {entry.description && (
                      <p className="text-xs text-muted-gray mb-2">{entry.description}</p>
                    )}
                    <div className="flex items-center gap-4 text-xs text-muted-gray">
                      <span className="px-1.5 py-0.5 rounded bg-muted-gray/20">
                        {LOG_TYPE_LABELS[entry.log_type] || entry.log_type}
                      </span>
                      {contactName && (
                        <button
                          onClick={() => navigate(`/crm/contacts/${entry.contact_id}`)}
                          className="hover:text-accent-yellow transition-colors"
                        >
                          {contactName}
                        </button>
                      )}
                      {entry.company && <span>{entry.company}</span>}
                      <span>{formatDate(entry.created_at)}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 ml-4">
                    {entry.contact_email && (
                      <button
                        onClick={() => openCompose({
                          defaultTo: entry.contact_email,
                          contactId: entry.contact_id,
                          contactData: {
                            first_name: entry.contact_first_name,
                            last_name: entry.contact_last_name,
                            company: entry.company,
                            email: entry.contact_email,
                          },
                        })}
                        className="p-1.5 rounded text-muted-gray hover:text-accent-yellow hover:bg-accent-yellow/10 transition-colors"
                        title="Send email"
                      >
                        <Send className="h-4 w-4" />
                      </button>
                    )}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setResolvingId(entry.id)}
                      className="border-muted-gray text-bone-white"
                    >
                      Update
                    </Button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Dialog open={!!resolvingId} onOpenChange={(open) => !open && setResolvingId(null)}>
        <DialogContent className="bg-charcoal-black border-muted-gray text-bone-white max-w-md">
          <DialogHeader>
            <DialogTitle>Update Log Entry</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm text-muted-gray block mb-2">Status</label>
              <Select value={newStatus} onValueChange={setNewStatus}>
                <SelectTrigger className="bg-charcoal-black border-muted-gray text-bone-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="in_progress">In Progress</SelectItem>
                  <SelectItem value="resolved">Resolved</SelectItem>
                  <SelectItem value="closed">Closed</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm text-muted-gray block mb-2">Resolution (optional)</label>
              <Textarea
                value={resolution}
                onChange={(e) => setResolution(e.target.value)}
                placeholder="How was this resolved?"
                className="bg-charcoal-black border-muted-gray text-bone-white"
                rows={3}
              />
            </div>
            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={() => setResolvingId(null)}>Cancel</Button>
              <Button
                onClick={handleResolve}
                disabled={updateLog.isPending}
                className="bg-accent-yellow text-charcoal-black hover:bg-accent-yellow/90"
              >
                {updateLog.isPending ? 'Updating...' : 'Update'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default CustomerLog;
